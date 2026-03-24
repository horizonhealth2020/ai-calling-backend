# Domain Pitfalls: v1.5 Platform Cleanup & Remaining Features

**Domain:** Adding AI scoring dashboard, chargeback-to-clawback automation, data archival, route splitting, CS payroll on owner dashboard, and payroll CSV export to existing Express/Prisma/Next.js insurance ops platform
**Researched:** 2026-03-24
**Overall confidence:** HIGH (based on direct codebase analysis of routes, payroll service, alerts service, audit queue, schema, socket events, and dashboard structure)

---

## Critical Pitfalls

Mistakes that cause production incidents, data corruption, or financial errors.

### P1: Chargeback-to-Clawback Automation Creates Double Deductions

**What goes wrong:** The current `approveAlert()` in `alerts.ts` (line 31-69) creates a `Clawback` record with `saleId: alert.chargeback.memberId || ""` -- it uses the chargeback's `memberId` field as the `saleId`, which is a memberId string, NOT a valid sale ID. This means the clawback record points to a nonexistent sale. When automation replaces manual approval, this broken FK reference becomes systematic rather than occasional.

The separate manual clawback route (`POST /clawbacks`, routes line 1127-1157) does it correctly: it looks up the sale by `memberId` or `memberName`, gets the actual `sale.id`, and uses that. The alert approval flow does NOT do this lookup.

**Why it happens:** The alert system was built as a notification pipeline (v1.2) -- "tell payroll about chargebacks." The `approveAlert()` was a quick path to create a clawback record, but it skipped the sale-matching logic that the manual clawback route performs. Automating this means the broken path becomes the primary path.

**Consequences:** Clawback records with invalid `saleId` values. The `Clawback.sale` relation fails. No actual payroll entry gets adjusted because there is no real sale to match against. Agent keeps the commission they should have lost. Financial leakage that is invisible because the clawback record exists and looks "processed."

**Prevention:**
1. The automation MUST replicate the sale-matching logic from the manual clawback route: look up the sale by `memberId` or `memberName`, verify the sale exists, get `sale.id` and `sale.agentId`
2. When no matching sale is found, the automation must NOT silently create a broken clawback -- it must flag the alert as "unmatched" and keep it pending for manual review
3. The `agentId` on the alert is also nullable (`String? @map("agent_id")`) -- the automation must handle this: either resolve the agent from the matched sale, or reject automation for alerts with no agent
4. Write an integration test: create a chargeback submission, generate an alert, auto-approve it, verify the clawback's `saleId` is a valid sale ID and the payroll entry was actually adjusted
5. Run a data quality check before deploying: `SELECT id, "sale_id" FROM clawbacks WHERE "sale_id" NOT IN (SELECT id FROM sales)` to find existing broken records

**Detection:** Any clawback where `saleId` does not match an existing sale is corrupt. Add a foreign key constraint check or a startup validation query.

**Phase:** This is the FIRST thing to fix in the clawback automation phase. The existing `approveAlert()` is broken for this purpose and must be rewritten, not extended.

---

### P2: Data Archival Locks Tables and Blocks Payroll Operations

**What goes wrong:** Archiving old sales requires DELETE operations on `sales`, `sale_addons`, `payroll_entries`, `clawbacks`, `status_change_requests`, and `sale_edit_requests` -- all tables with foreign key constraints. A naive `DELETE FROM sales WHERE sale_date < '2025-01-01'` acquires row-level locks on every related table. If this runs during business hours, payroll entry creation (`upsertPayrollEntryForSale`), sale submission, and clawback processing all block waiting for the lock.

PostgreSQL's MVCC means DELETEs create dead tuples that need VACUUM. A bulk delete of thousands of rows generates significant WAL (Write-Ahead Log) volume and can cause replication lag or disk pressure on Railway's managed Postgres.

**Why it happens:** The schema has cascading dependencies. A sale has: payroll entries, addons, clawbacks, status change requests, edit requests. The current delete route (routes line ~820-840) already uses `prisma.$transaction` with cascading deletes for single-sale deletion. Scaling this to bulk archival without batching will cause timeouts.

**Consequences:** The Express server's Prisma connection pool (default 5 connections) gets exhausted. API requests queue behind the archival transaction. Socket.IO events stop firing. Dashboard shows "Request failed (502)" because Railway kills the request after the 60-second proxy timeout.

**Prevention:**
1. Batch deletes: process 50-100 sales per transaction, not thousands. Use cursor-based pagination: `WHERE id > :lastId ORDER BY id LIMIT 100`
2. Run archival during off-hours or behind a manual trigger with a progress indicator -- not as an automatic background job
3. Delete in dependency order within each batch: `sale_edit_requests` -> `status_change_requests` -> `clawbacks` -> `payroll_entries` -> `sale_addons` -> `sales`. This is cleaner than relying on CASCADE
4. If "restore capability" is required, do not DELETE -- instead, add an `archivedAt` timestamp column and filter archived records from all queries. This is a soft-delete pattern that avoids lock contention entirely but requires updating every query that reads sales
5. For true archival (export then delete), generate a JSON or CSV export of the records BEFORE deleting. Store the export file, not the database records
6. Monitor `pg_stat_activity` during archival to verify no long-running transactions

**Detection:** Railway logs will show `FATAL: remaining connection slots are reserved for non-replication superuser connections` when the pool is exhausted. The `/storage-stats` endpoint (routes line 2720-2748) already exists -- monitor db size before and after archival.

**Phase:** Data archival should be a LATE phase, after all other features are stable. It touches the most tables and has the highest risk of collateral damage.

---

### P3: Route File Splitting Breaks Imports and Middleware Chain

**What goes wrong:** The route file is 2,750 lines in a single `index.ts`. Splitting it into domain files (e.g., `sales.ts`, `payroll.ts`, `clawbacks.ts`, `ai.ts`) seems straightforward but has multiple failure modes:

1. **Shared helpers become undefined.** `zodErr()`, `asyncHandler()`, and `dateRange()` are defined at the top of `index.ts` (lines 21-90) and used by every route. Moving routes to separate files requires exporting these helpers or creating a shared utils file. Missing one import = runtime crash on that route.

2. **Middleware ordering changes.** The current file applies `requireAuth` and `requireRole` per-route. If split files use `router.use(requireAuth)` at the file level, routes that should be public (like sales board endpoints) get auth-gated by accident. The sales board leaderboard endpoints are in the same file and do NOT require auth.

3. **The single `router` instance accumulates all routes.** If split files each create their own `Router()` and the main file mounts them with `app.use("/api", salesRouter)`, `app.use("/api", payrollRouter)`, etc., the route order changes. Express matches routes in registration order -- reordering can cause a catch-all or wildcard route to shadow a more specific one.

4. **Prisma import duplication.** Every split file will need `import { prisma } from "@ops/db"` and imports for services. Circular dependencies are possible if service files import from route files (currently they don't, but it's easy to accidentally introduce).

**Why it happens:** 2,750 lines accumulated over 4 milestones. Each feature added routes to the same file because it was faster than restructuring. The file has implicit dependencies on its top-level declarations.

**Consequences:** After splitting, some routes return 500 errors because a helper function was not imported. Or worse, routes silently stop matching because the mount path changed. Tests pass because they test services, not routes directly (no route-level integration tests exist).

**Prevention:**
1. Extract helpers FIRST, before moving any routes: create `apps/ops-api/src/routes/helpers.ts` with `zodErr`, `asyncHandler`, `dateRange`. Export them. Import them in the existing `index.ts`. Deploy this change alone. Verify nothing breaks.
2. Split ONE domain at a time. Start with the most isolated group (AI/audit routes, lines 2605-2628, have the fewest cross-dependencies). Deploy. Verify. Then the next group.
3. Keep a "barrel" `index.ts` that imports and re-exports all sub-routers. This preserves the existing import in `apps/ops-api/src/index.ts` (line 6: `import routes from "./routes"`)
4. After splitting, add a smoke test: hit every route path and verify it returns a non-404 status (even 401 is fine -- it means the route exists)
5. Do NOT change route paths during the split. No renaming, no reorganizing. Pure structural refactor.

**Detection:** After deployment, monitor for 404 responses on previously-working endpoints. Add a health check that lists all registered routes (`router.stack.map(r => r.route?.path)`).

**Phase:** Route splitting should be an EARLY phase (before other features) because every new feature adds more routes to the 2,750-line file. But it must be done carefully as a pure refactor with no feature changes mixed in.

---

### P4: Payroll CSV Export OOM on Large Datasets

**What goes wrong:** The current CSV export (if it follows the pattern visible in the codebase -- `JSON.stringify` for data serialization) loads all matching records into memory, formats them, and sends the response. For a payroll period with 500 agents and 20 sales each, that is 10,000 payroll entries with joins to sales, agents, and products. The entire result set is materialized in Node.js memory before the HTTP response begins.

The v1.5 requirement specifies "CSV export matching print card format" -- this implies per-agent grouping with subtotals, headers, and formatted sections. Building this string in memory for a large dataset can exceed the default Node.js heap (Railway default is 512MB for small plans).

**Why it happens:** Prisma's `findMany` returns the full result array. There is no built-in streaming query support in Prisma. The Express response is buffered by default.

**Consequences:** `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`. The process crashes. Railway restarts it. The user sees a 502 and retries, causing another crash. Meanwhile, other users' requests fail because the process is dead.

**Prevention:**
1. Use cursor-based pagination: fetch 100 entries at a time, write each batch to the response stream using `res.write()`, then fetch the next batch. Set `res.setHeader('Transfer-Encoding', 'chunked')` and `res.setHeader('Content-Type', 'text/csv')`
2. For the "print card format" requirement, process one agent at a time: fetch the agent list, then for each agent, fetch their entries, format the card section, write it to the stream, release the memory
3. Never use `JSON.stringify` on the full result set for CSV generation. Build CSV rows as strings and write them immediately
4. Set a hard limit: if the query would return more than 10,000 rows, require the user to narrow their date range. Return a 400 with a clear message, not a crash
5. Test with realistic data volumes BEFORE deploying. Create a seed script that generates 500 agents x 20 sales = 10,000 entries and verify the export completes under 30 seconds and under 200MB memory

**Detection:** Monitor Railway memory usage during CSV export. If memory spikes above 400MB during an export request, the approach needs streaming.

**Phase:** CSV export should include streaming from day one. Do not build a naive in-memory version with plans to "optimize later" -- the optimization IS the implementation.

---

## Moderate Pitfalls

### P5: AI Scoring Dashboard Queries Become Slow Without Indexes

**What goes wrong:** The AI scoring dashboard needs trend analysis: "average AI score per agent over time," "score distribution by lead source," "improvement trends over 30 days." These queries aggregate across `call_audits` joined with `convoso_call_logs` and `agents`. The `call_audits` table has indexes on nothing except the primary key and the `callAuditId` unique on `convoso_call_logs`. Aggregate queries over `ai_score`, `agent_id`, and `call_date` will do sequential scans.

**Prevention:**
1. Add indexes in a migration BEFORE building the dashboard:
   - `call_audits(agent_id, call_date)` for per-agent time series
   - `call_audits(ai_score)` for score distribution queries
   - `convoso_call_logs(audit_status, call_timestamp)` for the auto-score queue
2. Use `EXPLAIN ANALYZE` on dashboard queries before deploying to verify index usage
3. Pre-aggregate daily scores into a summary table if real-time aggregation is too slow (only needed at scale -- likely fine for current data volume)

**Phase:** Add indexes in the same phase as the dashboard. Include them in the migration, not as a follow-up.

---

### P6: Chargeback-to-Clawback Automation Requires Fuzzy Matching

**What goes wrong:** The manual clawback route (`POST /clawbacks`) matches chargebacks to sales using exact `memberId` or `memberName` match. Chargebacks from the carrier often have slightly different formatting: "JOHN DOE" vs "John Doe" vs "Doe, John". The `ChargebackSubmission.memberId` field may not exactly match `Sale.memberId` because the chargeback comes from a different data source than the original sale entry.

**Why it happens:** Chargebacks are pasted from carrier reports (paste-to-parse). Sales are entered manually by managers. The two data entry paths have different formatting conventions. The existing chargeback table has fields like `payeeName`, `memberId`, `memberCompany` -- none guaranteed to match the sale's `memberName` or `memberId` exactly.

**Consequences:** Automation attempts to match a chargeback to a sale, finds no match, and either: (a) creates a broken clawback with empty saleId (see P1), or (b) skips the chargeback entirely, leaving money on the table. Either way, the automation fails silently for a significant percentage of chargebacks.

**Prevention:**
1. Implement a matching hierarchy: exact `memberId` match first, then case-insensitive `memberName` match, then fuzzy match (Levenshtein distance or trigram similarity via `pg_trgm`)
2. When multiple sales match, do NOT auto-pick -- flag the alert as "multiple matches" and require manual selection
3. When zero sales match, keep the alert as "unmatched" with the attempted match criteria visible to payroll staff
4. Track match rate metrics: "X% of chargebacks auto-matched, Y% required manual review." If auto-match rate drops below 80%, the matching logic needs tuning
5. Consider adding a `normalizedMemberName` column to both `sales` and `chargeback_submissions` that stores `UPPER(TRIM(name))` for more reliable matching

**Phase:** This is a design decision that must be made before implementing automation. The matching strategy determines the automation's success rate.

---

### P7: CS Payroll Amount on Owner Dashboard Requires Cross-Domain Query

**What goes wrong:** The owner dashboard period summary currently shows agent payroll totals (from `PayrollEntry`). Adding CS/service payroll (from `ServicePayrollEntry`) requires joining a different table with a different schema. If the query naively sums both tables independently, the period summary shows two separate numbers. If it tries to combine them into one, the aggregation logic must handle: ServicePayrollEntry has `basePay + bonusAmount - deductionAmount - frontedAmount = totalPay`, while PayrollEntry has `payoutAmount + adjustmentAmount + bonusAmount - frontedAmount - holdAmount = netAmount`. Different formulas, different field names, same "total payroll" label.

**Prevention:**
1. Show CS payroll as a SEPARATE line item on the period summary, not merged into agent payroll. Labels: "Agent Payroll: $X" and "Service Payroll: $Y" and "Total: $X+Y"
2. The API endpoint for period summary must query both tables in a single request (use `Promise.all` for parallel queries, not sequential)
3. Ensure the date range filter works identically on both tables -- both use `payrollPeriodId` as the grouping key, so filter by period, not by date
4. Test with periods that have agent entries but no service entries, and vice versa. The summary should show $0 for the empty category, not omit it

**Phase:** Straightforward addition if kept as separate line items. Risk increases significantly if merged into a single total.

---

### P8: Soft-Delete Archival Contaminates Every Existing Query

**What goes wrong:** If data archival uses a soft-delete pattern (`archivedAt IS NOT NULL` means archived), every existing Prisma query that reads sales must add `where: { archivedAt: null }`. There are dozens of such queries across routes, services, and dashboard endpoints. Missing one means archived sales appear in the sales board, payroll calculations, KPI aggregations, or CSV exports.

**Why it happens:** Prisma does not have built-in soft-delete middleware (unlike some ORMs). Every `findMany`, `findFirst`, `count`, and `aggregate` on the `Sale` model must explicitly exclude archived records. The global middleware approach (`prisma.$use`) was deprecated in favor of Prisma Client extensions, but those require explicit setup.

**Consequences:** Archived sales count toward KPIs. Archived payroll entries inflate period totals. The sales board shows deleted members. Agents see incorrect commission totals.

**Prevention:**
1. Use Prisma Client extensions to add a default `where` filter on the Sale model. This ensures all queries exclude archived records unless explicitly overridden. Define it in `@ops/db` so every consumer gets the filter automatically
2. Alternatively, use hard delete (actual DELETE) with a pre-delete export. This is simpler if restore capability is not truly required
3. If using soft-delete, add `archivedAt` to the schema AND update the Prisma client setup in a single PR. Then do a codebase-wide grep for `prisma.sale.findMany`, `prisma.sale.findFirst`, `prisma.sale.count`, and `prisma.sale.aggregate` to verify each one either uses the extension filter or explicitly opts out
4. Write a test: create an archived sale, then call every endpoint that returns sales. None should include the archived sale unless it's an admin archive-management endpoint

**Detection:** After deploying, compare KPI numbers before and after archival. If they change, an archived record is leaking through.

**Phase:** This decision (soft-delete vs hard-delete with export) must be made in the design phase, before any archival code is written. It affects the entire codebase.

---

### P9: Auto-Score Polling Memory Leak on Long-Running Server

**What goes wrong:** The audit queue (`auditQueue.ts`) uses `setInterval` for polling (line 206-211) and an in-memory `Set<string>` for active jobs (line 11). The `downloadRecordingWithRetry` function fetches audio recordings into `Buffer` objects (line 174). If multiple jobs run concurrently and recordings are large (10+ minutes of audio = 10-50MB per recording), the server's memory spikes. The `MAX_CONCURRENT = 3` limit means up to 150MB of audio buffers simultaneously in memory.

For the AI scoring dashboard, users may trigger batch auto-scoring more frequently (viewing trends encourages "score more calls"). The `enqueueAutoScore()` function takes 50 calls at a time (line 36). If triggered repeatedly, the queue grows faster than processing capacity.

**Prevention:**
1. Stream audio directly to the AI API rather than buffering the entire recording in memory. If the transcription service requires a buffer, process one recording at a time (reduce `MAX_CONCURRENT` to 1) or ensure buffers are explicitly dereferenced after use
2. Add a guard in `enqueueAutoScore()`: if there are already more than 50 queued items, reject new batch requests with a message like "Scoring in progress, please wait"
3. Monitor Node.js heap usage: add a `/health` endpoint that reports `process.memoryUsage().heapUsed`
4. The polling interval (30s) is fine for current usage but should be configurable via environment variable for production tuning

**Phase:** Address when building the AI scoring dashboard, since that feature increases scoring frequency.

---

### P10: Route Splitting Combined with Feature Work Creates Unreviable PRs

**What goes wrong:** The temptation is to split routes AND add new routes for AI dashboard/archival/clawback automation in the same phase. This produces a PR that moves 2,750 lines of code AND adds 200+ new lines. The diff is unreadable. Review misses bugs. Merge conflicts with any parallel work are guaranteed.

**Prevention:**
1. Route splitting is a PURE REFACTOR phase. Zero feature changes. Zero new routes. Zero bug fixes mixed in. The before/after behavior must be identical
2. Deploy the refactor. Verify stability for at least one business day
3. THEN add new features to the newly split files
4. This means route splitting must be the FIRST phase of v1.5, not interleaved with features

**Phase:** Phase 1 of v1.5, standalone. Non-negotiable separation from feature work.

---

## Minor Pitfalls

### P11: Print Card CSV Format Requires Business Specification

**What goes wrong:** "CSV export matching print card format" implies a specific physical layout that matches an existing payroll print card used by the business. If the development team guesses at the format without seeing an actual print card, the output will not match and will be rejected by payroll staff. CSV is a flat format; print cards often have headers, subtotals, blank rows for visual separation, and specific column ordering that does not map naturally to a database query result.

**Prevention:**
1. Get an actual print card sample (PDF, scan, or Excel) before writing any CSV formatting code
2. The CSV may need to be "quasi-CSV" with header rows, agent section separators, and summary rows that break the standard column structure. This is fine for Excel consumption but breaks programmatic CSV parsers
3. Clarify: is the output consumed by Excel (where formatting matters) or by another system (where structure matters)?

**Phase:** Requirements clarification before implementation. Block the CSV phase on getting a sample.

---

### P12: Socket.IO Events for Clawback Changes Not Implemented

**What goes wrong:** The current socket events cover: sale changes (`sale:changed`), CS submissions (`cs:changed`), alert creation (`alert:created`), alert resolution (`alert:resolved`), and audit events. There is no event for clawback creation or payroll entry adjustment. When the automation creates clawbacks, the payroll dashboard will not update in real-time. Payroll staff will not see the deduction until they refresh.

**Prevention:**
1. Add `clawback:created` and `payrollEntry:adjusted` socket events
2. Emit them from the automated clawback flow
3. The payroll dashboard should listen for these events and update the relevant agent's pay card

**Phase:** Same phase as clawback automation. Not a follow-up.

---

### P13: Archival of Sales with Active Clawbacks

**What goes wrong:** A sale from 6 months ago may have an OPEN or MATCHED clawback that has not yet been DEDUCTED. Archiving the sale orphans the clawback. The clawback still shows up in the tracking table but its `sale` relation returns null. Clicking "view sale" from the clawback shows an error.

**Prevention:**
1. Archival must check: does this sale have any clawback with status != DEDUCTED and != ZEROED? If yes, exclude from archival
2. Archival must also check: does this sale have payroll entries in OPEN or PENDING periods? If yes, exclude
3. Only archive sales where ALL related financial records are in terminal states (PAID, DEDUCTED, ZEROED)

**Phase:** Part of archival design. This is a business rule for "what is safe to archive."

---

### P14: Prisma `$transaction` Timeout on Archival Batches

**What goes wrong:** Prisma's default interactive transaction timeout is 5 seconds. Archival batches that delete 100 sales with all their relations can easily exceed this. The transaction rolls back, the endpoint returns 500, and no data is archived.

**Prevention:**
1. Set explicit timeout on archival transactions: `prisma.$transaction(async (tx) => { ... }, { timeout: 30000 })` (30 seconds)
2. Keep batch sizes small enough that each batch completes within the timeout
3. Use sequential deletes within the transaction, not parallel `Promise.all` deletes (parallel deletes can deadlock on foreign key checks)

**Phase:** Implementation detail for archival, but must be planned upfront.

---

### P15: AI Dashboard Aggregation Counts Unscored Calls as Zero

**What goes wrong:** When calculating "average AI score per agent," calls with `aiScore: null` (never scored) should be excluded from the average, not counted as 0. If the dashboard query uses `AVG(ai_score)` in SQL, PostgreSQL correctly ignores nulls. But if the aggregation is done in JavaScript (fetching all call audits and computing the average in code), null values may be coerced to 0, dragging the average down.

**Prevention:**
1. Use Prisma's `aggregate` with `_avg: { aiScore: true }` which correctly ignores null values
2. Alternatively, use raw SQL: `AVG(ai_score)` which ignores nulls by definition
3. In the dashboard display, show "X scored / Y total" so users understand the sample size
4. Do NOT filter unscored calls out of the result set -- show them as "Pending" so the dashboard communicates scoring coverage

**Phase:** During AI dashboard implementation. Simple to get right if aware of it.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Route splitting | P3 (broken imports), P10 (unreviable PRs) | Extract helpers first, split one domain at a time, pure refactor with zero features mixed in |
| Chargeback-to-clawback automation | P1 (double deduction / invalid saleId), P6 (fuzzy matching), P12 (no socket events) | Rewrite `approveAlert()` to use proper sale-matching logic, implement matching hierarchy, add socket events |
| AI scoring dashboard | P5 (missing indexes), P9 (memory leak), P15 (null score averaging) | Add indexes in migration, monitor memory during batch scoring, use SQL-level aggregation |
| Data archival | P2 (table locks), P8 (soft-delete query contamination), P13 (active clawback orphans), P14 (transaction timeout) | Batch deletes, decide soft vs hard delete upfront, check financial record terminal states before archiving |
| CS payroll on owner dashboard | P7 (cross-domain query) | Separate line items, parallel queries, handle empty periods |
| Payroll CSV export | P4 (OOM on large datasets), P11 (unknown format spec) | Stream response from day one, get print card sample before coding |

## Recommended Phase Ordering Based on Pitfalls

1. **Route splitting** (P3, P10) -- Pure refactor, do first while the file is still familiar. Every other feature adds routes and benefits from the split structure.
2. **Chargeback-to-clawback automation** (P1, P6, P12) -- Fixes a known broken code path in `approveAlert()`. Financial correctness is higher priority than dashboard features.
3. **CS payroll on owner dashboard** (P7) -- Low risk, isolated addition, quick win.
4. **AI scoring dashboard** (P5, P9, P15) -- Requires migration for indexes, builds on existing audit queue infrastructure.
5. **Payroll CSV export** (P4, P11) -- Requires business input (print card format sample). Block on getting that sample.
6. **Data archival** (P2, P8, P13, P14) -- Highest risk, touches most tables, should be last when all other features are stable and tested.

## Sources

- `apps/ops-api/src/services/alerts.ts` -- `approveAlert()` (line 31-69) with broken saleId reference
- `apps/ops-api/src/routes/index.ts` -- 2,750 lines, manual clawback route (line 1127-1157), shared helpers (lines 21-90), sales board routes, AI routes (lines 2605-2628), storage stats (lines 2720-2748)
- `apps/ops-api/src/services/auditQueue.ts` -- in-memory job tracking, Buffer allocation for recordings (line 174), MAX_CONCURRENT=3 (line 6), batch enqueue limit of 50 (line 36)
- `apps/ops-api/src/services/payroll.ts` -- `upsertPayrollEntryForSale()` (line 272-332), `handleCommissionZeroing()` (line 247-270)
- `apps/ops-api/src/socket.ts` -- all socket events defined, no clawback/payroll-adjustment events
- `prisma/schema.prisma` -- all models and relations, ChargebackSubmission (line 536-568), PayrollAlert (line 570-590), Clawback (line 361-379), CallAudit indexes (none beyond PK)
- `apps/ops-dashboard/app/(dashboard)/owner/` -- OwnerOverview.tsx, OwnerKPIs.tsx (CS payroll integration point)
- `.planning/PROJECT.md` -- v1.5 milestone scope, deferred features list, architecture constraints

---
*Research completed: 2026-03-24*
