# Codebase Concerns

**Analysis Date:** 2026-03-24

---

## Tech Debt

**`sales.ts` is 795 lines -- largest route file:**
- Issue: Contains sales CRUD, commission preview, status changes, tracker summary, owner summary, reporting periods, and sales board endpoints -- multiple unrelated domains.
- Files: `apps/ops-api/src/routes/sales.ts`
- Impact: Difficult to navigate and maintain. Multiple unrelated concerns in one file.
- Fix approach: Extract `tracker/summary`, `owner/summary`, `reporting/periods`, and `sales-board/*` into dedicated route files.

**Duplicated Socket.IO emit boilerplate:**
- Issue: The `emitSaleChanged` payload construction is copy-pasted across multiple route handlers with identical ~30-line blocks.
- Files: `apps/ops-api/src/routes/sales.ts` (lines 54-99), `apps/ops-api/src/routes/change-requests.ts` (lines 50-97)
- Impact: Any change to the payload shape must be updated in multiple places. Easy to introduce inconsistencies.
- Fix approach: Extract a `buildSaleChangedPayload(saleId)` helper function in `apps/ops-api/src/socket.ts` that fetches the sale + payroll entries and builds the payload.

**Legacy Morgan service is plain JS with no types:**
- Issue: Root-level Morgan service (`index.js` ~500+ lines) is CommonJS with zero TypeScript. Business logic lives alongside webhook handlers and debug endpoints.
- Files: `index.js`, `voiceGateway.js`, `morganToggle.js`, `rateLimitState.js`, `timeUtils.js`
- Impact: No compile-time safety. Two different module systems in the same repo. No shared type safety with the Ops Platform.
- Fix approach: Migrate to TypeScript; extract slot management into a stateful class or Redis-backed store.

**`as any` type escapes throughout routes:**
- Issue: Multiple `as any` casts used to work around Prisma include type mismatches, especially around addon premium calculations.
- Files: `apps/ops-api/src/routes/sales.ts` (lines 177, 281, 567, 593, 632-634, 692-693, 750-751, 768-770, 781-782), `apps/ops-api/src/routes/change-requests.ts` (line 14), `apps/ops-api/src/routes/chargebacks.ts` (line 139)
- Impact: Bypasses TypeScript safety. Type errors can slip through undetected.
- Fix approach: Create proper Prisma result types or use `satisfies` / generic helpers for included relations.

**Hardcoded commission constants:**
- Issue: Enrollment fee thresholds ($125 bonus, $99 half-commission, $50 standalone) are hardcoded in service logic.
- Files: `apps/ops-api/src/services/payroll.ts` (lines 8-9, 72-77)
- Impact: Changing business rules requires a code deployment. Cannot be configured by admin users.
- Fix approach: Move thresholds to `SalesBoardSetting` or a dedicated config table.

**AI model name hardcoded as string literal:**
- Issue: `"claude-sonnet-4-20250514"` is hardcoded in two places with no env var override.
- Files: `apps/ops-api/src/services/callAudit.ts` (line 164), `apps/ops-api/src/services/auditQueue.ts` (line 135)
- Impact: Upgrading the model requires a code deploy rather than a config change.
- Fix approach: Extract to env var `ANTHROPIC_MODEL_ID` with a fallback default.

**AI cost estimates are hardcoded with stale pricing:**
- Issue: Claude Sonnet cost is hardcoded as `$3/M input, $15/M output` in a function. Actual pricing changes without any code signal.
- Files: `apps/ops-api/src/services/callAudit.ts` (lines 252-260)
- Impact: Cost tracking in `ai_usage_log` silently drifts from actual billing as model pricing changes.
- Fix approach: Pull cost rates from a settings table or env vars.

**Integration tests entirely stubbed out:**
- Issue: Every integration test is a `TODO` placeholder with no actual implementation -- 40+ TODO comments.
- Files: `__tests__/integration.test.js`
- Impact: Zero integration test coverage for the Morgan voice service. Suite passes vacuously.
- Fix approach: Implement tests using supertest and mocked external APIs (Convoso, Vapi).

**`startAutoScorePolling` not called on boot:**
- Issue: `startAutoScorePolling()` is only called from the `POST /ai/auto-score` route handler. The Convoso KPI poller starts at boot, but the audit queue poller does not.
- Files: `apps/ops-api/src/services/auditQueue.ts`, `apps/ops-api/src/index.ts` (line 68)
- Impact: If ops-api restarts while calls are in `queued` status, they remain stuck until a human manually POSTs `/ai/auto-score`.
- Fix approach: Call `startAutoScorePolling()` at boot in `apps/ops-api/src/index.ts` alongside `startConvosoKpiPoller()`.

---

## Known Bugs

**`upsertPayrollEntryForSale` netAmount calculation uses stale values on update:**
- Symptoms: The `update` branch of the payroll entry upsert sets `netAmount` based on the newly calculated `payoutAmount` plus the fetched `existing` bonus/fronted/hold values, but then only passes `payoutAmount` and `netAmount` to the update -- discarding the existing adjustment context.
- Files: `apps/ops-api/src/services/payroll.ts` (lines 310-331)
- Trigger: Edit a sale that already has a bonus or fronted amount applied.
- Workaround: Manually re-enter bonus/fronted after editing.

**`handleSaleEditApproval` may double-clawback in same-period edits:**
- Symptoms: Lines 372-395 mark the finalized entry as `CLAWBACK_APPLIED` in both the "different period" and "same period" branches. In the same-period case, `upsertPayrollEntryForSale` already updated the entry in place, so the subsequent clawback marks an already-updated entry.
- Files: `apps/ops-api/src/services/payroll.ts` (lines 345-396)
- Trigger: Approve a sale edit when the sale's payroll period is finalized and the sale date/paymentType does not change periods.

**Clawback creation uses `sale.payrollEntries[0]` without ordering:**
- Symptoms: When creating a clawback via `POST /clawbacks`, the code takes `sale.payrollEntries[0]` without specifying an `orderBy`. Prisma returns entries in undefined order, so the "last entry" used for zeroing/deducting may not be the most recent.
- Files: `apps/ops-api/src/routes/payroll.ts` (lines 147-151)
- Trigger: Sale with multiple payroll entries across different periods.
- Workaround: None -- requires adding `orderBy: { createdAt: 'desc' }` to the include.

---

## Security Considerations

**JWT has an insecure fallback secret:**
- Risk: `packages/auth/src/index.ts` line 11 falls back to `"dev-secret"` if `AUTH_JWT_SECRET` is missing. Any deployment without the env var set will silently accept tokens signed with a predictable key.
- Files: `packages/auth/src/index.ts` (line 11)
- Current mitigation: `apps/ops-api/src/index.ts` validates `AUTH_JWT_SECRET` at startup and exits if missing. However, Next.js apps importing `@ops/auth` do not have this check.
- Recommendations: Remove the `"dev-secret"` fallback entirely. Throw if no key is configured.

**Socket.IO has no authentication:**
- Risk: Any client can connect to the Socket.IO server and receive all real-time events (sales, payroll, chargebacks, audit results).
- Files: `apps/ops-api/src/index.ts` (lines 58-63)
- Current mitigation: CORS restricts origins, but this is not authentication.
- Recommendations: Add Socket.IO middleware that validates the JWT token on connection via `io.use()`.

**No rate limiting on any API endpoint:**
- Risk: Login endpoint (`POST /api/auth/login`) and all other endpoints have no rate limiting. No `express-rate-limit` or similar package detected.
- Files: `apps/ops-api/src/index.ts`, `apps/ops-api/src/routes/auth.ts`
- Current mitigation: None.
- Recommendations: Add rate limiting on `/api/auth/login` (brute force protection), `/api/auth/change-password`, and expensive endpoints.

**No request body size limit configured:**
- Risk: `express.json()` is called with default settings (100kb limit). The `rawPaste` field for chargebacks/pending-terms can contain large CSV pastes.
- Files: `apps/ops-api/src/index.ts` (line 20)
- Current mitigation: Express default 100kb limit applies, but may be too low for bulk paste imports or too high for normal endpoints.
- Recommendations: Set explicit `express.json({ limit: '2mb' })` for paste endpoints, lower for others.

**JWT token passed via URL query parameter:**
- Risk: Session tokens appear in `?session_token=<jwt>` on redirect from auth-portal to dashboards. Tokens are visible in browser history, server access logs, and referrer headers.
- Files: `packages/auth/src/client.ts` (lines 11-24)
- Current mitigation: `captureTokenFromUrl()` removes the token via `history.replaceState`. However, the token has already been logged.
- Recommendations: Switch to a server-side cookie-only auth flow for dashboard redirects.

**JWT token stored in localStorage -- XSS accessible:**
- Risk: Tokens stored in `localStorage` under key `ops_session_token` are accessible to any JavaScript on the page, including injected scripts.
- Files: `packages/auth/src/client.ts` (lines 6, 16, 29)
- Current mitigation: HttpOnly session cookie is also set by the API.
- Recommendations: Migrate to httpOnly-only cookie flow and remove localStorage token storage.

**Change password endpoint has no auth middleware:**
- Risk: `POST /api/auth/change-password` does not require an authenticated session -- it accepts email + current password in the body. Combined with no rate limiting, vulnerable to brute-force.
- Files: `apps/ops-api/src/routes/auth.ts` (line 31)
- Recommendations: Add rate limiting on this endpoint.

---

## Performance Bottlenecks

**`GET /payroll/periods` loads all periods with deeply nested includes -- no pagination:**
- Problem: Fetches ALL payroll periods with all entries, each entry including sale details + agent + addons + service entries.
- Files: `apps/ops-api/src/routes/payroll.ts` (lines 10-27)
- Cause: `findMany` with no `take` or `where` filter, deep `include` tree.
- Improvement path: Add `orderBy: { weekStart: "desc" }, take: 12` as default; expose a `year` query param for historical access.

**`GET /sales` fetches all sales without pagination:**
- Problem: Returns all sales matching a date range with full includes. If no date range is provided, returns ALL sales.
- Files: `apps/ops-api/src/routes/sales.ts` (lines 209-232)
- Cause: No `take`/`skip` pagination.
- Improvement path: Enforce a default date range or add cursor-based pagination.

**Chargeback auto-matching does individual DB queries per record (N+1):**
- Problem: When creating chargebacks in batch, each chargeback individually queries `prisma.sale.findMany` for matching sales, then individually updates.
- Files: `apps/ops-api/src/routes/chargebacks.ts` (lines 67-97)
- Cause: Loop with individual queries and updates per chargeback record.
- Improvement path: Batch the member ID lookups into a single query, then batch update all matches.

**N+1 pattern in chargeback alert creation:**
- Problem: After batch chargeback creation, iterates over each chargeback calling `createAlertFromChargeback` individually.
- Files: `apps/ops-api/src/routes/chargebacks.ts` (lines 100-109)
- Improvement path: Batch alert creation using `createMany`.

**`/tracker/summary` aggregates all call logs in memory:**
- Problem: Fetches all agents with sales, all lead sources, and all call logs for a date range, then aggregates in JavaScript.
- Files: `apps/ops-api/src/routes/sales.ts` (lines 525-578)
- Cause: In-memory aggregation instead of database-level grouping.
- Improvement path: Use `groupBy` or raw SQL for call log aggregation by agent.

**`handleCommissionZeroing` updates entries one at a time:**
- Problem: Fetches all payroll entries for a sale, then updates each individually in a loop.
- Files: `apps/ops-api/src/services/payroll.ts` (lines 247-270)
- Improvement path: Use `updateMany` for OPEN period entries, batch the finalized entries.

---

## Scaling Limits

**In-memory Morgan queue -- lost on restart:**
- Current capacity: Max 10,000 queued IDs with LRU eviction.
- Files: `index.js` (lines 39-68)
- Limit: Queue is lost on process restart. Cannot scale to multiple instances. Slot state (`morganSlots`, `morganCallToSlot`) is plain `Map` objects -- any restart orphans active call slots permanently.
- Scaling path: Migrate to a persistent queue (Redis, BullMQ) for durability and multi-instance support.

**Single-process in-memory audit queue:**
- Current capacity: 3 concurrent audit jobs; queue state lives in `activeJobs` Set.
- Files: `apps/ops-api/src/services/auditQueue.ts` (lines 5-12)
- Limit: Horizontal scaling (multiple ops-api instances) will result in duplicate job processing since both instances pick the same `queued` records.
- Scaling path: Use a distributed lock (e.g., `pg_advisory_lock`) or a proper job queue (BullMQ with Redis).

**Single Prisma client instance with default connection pool:**
- Files: `packages/db/src/client.ts`
- Limit: Default Prisma connection pool is `num_cpus * 2 + 1`. Under heavy load, connection contention could occur.
- Scaling path: Configure explicit connection pool size via `DATABASE_URL` query params.

---

## Missing Database Indexes

**No index on `PayrollEntry.agentId`:**
- Problem: Queries that filter payroll entries by agent (used in tracker, groupBy) have no index.
- Files: `prisma/schema.prisma` (lines 282-305)
- Fix: Add `@@index([agentId])` to `PayrollEntry` model.

**No index on `Clawback.saleId` or `Clawback.agentId`:**
- Problem: Clawback queries filter by sale or agent but have no indexes.
- Files: `prisma/schema.prisma` (lines 362-380)
- Fix: Add `@@index([saleId])` and `@@index([agentId])`.

**No index on `ChargebackSubmission` for common query patterns:**
- Problem: Chargebacks are queried by `submittedAt`, `batchId`, and `memberId` but none are indexed.
- Files: `prisma/schema.prisma` (lines 537-573)
- Fix: Add `@@index([submittedAt])`, `@@index([batchId])`, `@@index([memberId])`.

**No index on `PendingTerm` for common query patterns:**
- Problem: Pending terms have no indexes at all.
- Files: `prisma/schema.prisma` (lines 610-649)
- Fix: Add `@@index([submittedAt])` and `@@index([memberId])`.

**`AppAuditLog` has no index on `actorUserId` or `createdAt`:**
- Problem: No foreign key to User and no index for efficient querying. Cannot join audit logs to user records.
- Files: `prisma/schema.prisma` (lines 445-455)
- Fix: Add relation to User and `@@index([actorUserId, createdAt])`.

---

## Dependencies at Risk

**Morgan service uses `node-fetch` alongside native fetch:**
- Risk: Node 18+ has native `fetch`. The Morgan service imports `node-fetch` (CommonJS v2) while the Ops Platform uses native fetch.
- Files: `index.js` (line 10)
- Impact: Unnecessary dependency, potential version conflicts, security patches may not arrive for v2.
- Migration plan: Remove `node-fetch` and use native `fetch`.

**Dual AI provider dependency (Anthropic + OpenAI):**
- Risk: OpenAI is the fallback path but produces a different data shape (no `issues`/`wins` arrays). The structured audit display will break if the fallback is invoked.
- Files: `apps/ops-api/src/services/callAudit.ts` (lines 218-242, 324-341)
- Migration plan: Standardize on one provider or ensure fallback produces the same structured output.

---

## Test Coverage Gaps

**Morgan service -- zero functional tests:**
- What's not tested: Slot management, Convoso lead enqueueing, Vapi call initiation, webhook handling, end-of-call processing.
- Files: `index.js`, `voiceGateway.js`, `morganToggle.js`, `rateLimitState.js`
- Risk: Any refactor has no regression safety net. This is the core AI calling system.
- Priority: High

**No tests for route-level authorization:**
- What's not tested: RBAC middleware behavior -- whether specific roles are correctly granted/denied access to each endpoint.
- Files: All route files in `apps/ops-api/src/routes/`
- Risk: Permission escalation bugs could go undetected.
- Priority: High

**`handleSaleEditApproval` -- finalized same-period edge case:**
- What's not tested: Scenario where a sale is edited but the new sale date stays in the same finalized payroll period.
- Files: `apps/ops-api/src/services/payroll.ts` (lines 345-396)
- Risk: Commission double-counting or incorrect clawback.
- Priority: High

**No tests for chargeback matching logic:**
- What's not tested: Auto-matching chargebacks to sales by memberId, including the MULTIPLE match scenario.
- Files: `apps/ops-api/src/routes/chargebacks.ts` (lines 67-97)
- Risk: Incorrect sale matching or missed matches.
- Priority: Medium

**No end-to-end tests for any dashboard:**
- What's not tested: Full user flows across auth-portal, payroll-dashboard, manager-dashboard, owner-dashboard.
- Files: All `apps/` Next.js applications
- Risk: UI regressions, broken auth flows, broken redirects.
- Priority: Medium

---

*Concerns audit: 2026-03-24*
