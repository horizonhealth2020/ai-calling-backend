# Domain Pitfalls

**Domain:** Platform Polish & Integration (v1.2) — AI scoring, alert pipelines, KPI wiring, cross-dashboard sync
**Researched:** 2026-03-18
**Applies to:** Adding features to an existing 6-dashboard + Express API + PostgreSQL/Prisma platform

## Critical Pitfalls

### P1: AI Scoring Pipeline Blocks the Event Loop

**What goes wrong:** The existing `processCallRecording` in `callAudit.ts` calls Claude API synchronously within the Express process. Adding auto-scoring for all Convoso transcripts (not just manual trigger) means every polled call log fires an API call. With the in-memory `auditQueue.ts` capping at `MAX_CONCURRENT = 3`, a burst of 50+ call logs from Convoso poller queues them all in-process memory. Claude API latency (5-15 seconds per call) means the queue grows unbounded.

**Why it happens:** The current queue is a plain array (`pendingJobs: string[]`) with no backpressure, no persistence, and no memory limit. It was designed for manual one-off audits, not batch processing.

**Consequences:**
- Memory pressure on the Express process during scoring bursts
- If the process restarts (Railway deploy, crash), all queued jobs are lost silently
- Long-running scoring blocks the download-retry loop (60s per attempt x 10 retries = 10 min per job worst case)
- Other API routes remain responsive (async), but any OOM crash takes down the entire API

**Prevention:**
- Add a queue size cap (e.g., 100) with a "queue full" rejection that the poller respects
- Add a `scoring_status` column to `ConvosoCallLog` so incomplete jobs can be recovered on restart
- Consider a simple DB-backed queue (poll `WHERE auditStatus = 'pending_score'`) instead of in-memory array — matches the existing Prisma pattern and survives restarts
- Rate-limit scoring to N per minute, not just N concurrent

**Detection:** Monitor `pendingJobs.length` via a `/health` endpoint. Log queue depth on each enqueue.

**Phase:** Must be addressed when adding auto-scoring to the Convoso poller. First phase of AI work.

---

### P2: Chargeback-to-Payroll Alert Creates Phantom Financial Impact

**What goes wrong:** Wiring `ChargebackSubmission` records into the payroll alert system requires matching chargebacks to sales. The current `ChargebackSubmission` model has `memberId` and `memberAgentId` fields, but these are free-text from paste-parsed data — not foreign keys to `Sale.memberId` or `Agent.id`. Naive string matching will produce false positives (partial matches, formatting differences) and false negatives (missing IDs).

**Why it happens:** CS dashboard was designed for tracking, not for financial integration. The paste-to-parse workflow captures whatever text the carrier report contains. Member IDs may have leading zeros stripped, different formatting, or be entirely absent.

**Consequences:**
- Alert shown in payroll for wrong sale/agent
- Payroll staff approves a clawback against the wrong agent
- Unmatched chargebacks silently ignored (no alert at all)
- If auto-deduction is added later, financial errors compound

**Prevention:**
- Matching must be fuzzy + manual confirmation, never auto-applied
- Add a `matchedSaleId` nullable FK on `ChargebackSubmission` — alerts only fire when explicitly matched
- Build a "match candidates" UI that shows possible Sale matches ranked by confidence (memberId exact, memberName fuzzy, date proximity)
- Alerts in payroll are informational only — require explicit "approve" action before any payroll entry is modified
- Track match confidence score so payroll staff knows how reliable the link is

**Detection:** Run matching against historical data before shipping. Count match rate and false positive rate.

**Phase:** Must be the first step of chargeback-payroll integration. Do NOT wire financial deductions before match quality is validated.

---

### P3: KPI Aggregation Double-Counting Across Time Windows

**What goes wrong:** The requirement says "pending terms + chargebacks within 30 days wired to agent KPIs." The `AgentCallKpi` table already stores point-in-time snapshots from the Convoso poller. Adding chargeback/pending-term counts to agent KPIs introduces a different time window (rolling 30 days from submission) that overlaps with the Convoso polling window (rolling since last poll). If the same metric is queried at different times, counts change retroactively.

**Why it happens:** Convoso KPIs are append-only snapshots. Chargeback KPIs are mutable (a chargeback can be resolved, changing the count). Mixing immutable and mutable data in one KPI view without clear semantics creates confusion.

**Consequences:**
- Agent KPI score changes without any new activity (a chargeback gets resolved)
- Manager sees different numbers than owner for the "same" metric depending on when they loaded the page
- Historical KPI comparisons become meaningless if the 30-day window shifts old chargebacks out

**Prevention:**
- Separate the KPI into distinct categories: **call performance KPIs** (from Convoso, immutable snapshots) and **retention KPIs** (from chargebacks/pending terms, live-computed)
- Never store computed chargeback KPIs as snapshots — compute them on read from the source tables
- Document clearly in the UI: "Chargebacks in last 30 days" with the exact date range shown
- Add `as of` timestamp to any KPI display so users know what they're looking at

**Detection:** Query the same agent's KPIs at different times in the same day and verify consistency with expectations.

**Phase:** KPI aggregation phase. Design the data model before building the UI.

---

### P4: Bidirectional Payroll Toggle Corrupts Finalized Periods

**What goes wrong:** The current payroll lifecycle is `PENDING -> READY -> PAID` (one direction). Adding a bidirectional toggle (PAID -> PENDING/READY) means a payroll entry that was already exported, reconciled, or used for tax reporting can be un-paid. The `PayrollPeriod` status (OPEN/LOCKED/FINALIZED) is supposed to guard against this, but the requirement says "toggle works both directions."

**Why it happens:** Business users need to fix mistakes (marked paid accidentally). But the guard rails on period status were designed assuming irreversibility.

**Consequences:**
- Un-paying an entry in a FINALIZED period creates an inconsistency: the period says "finalized" but contains unpaid entries
- If CSV exports were already generated for that period, the export no longer matches the DB state
- The existing `handleCommissionZeroing` function checks `payrollPeriod.status === 'OPEN'` to decide whether to zero vs clawback — toggling paid status in a non-OPEN period breaks this logic
- `isAgentPaidInPeriod()` guard returns false after un-paying, potentially allowing duplicate period creation

**Prevention:**
- Only allow PAID -> READY toggle on entries in OPEN periods. For LOCKED/FINALIZED periods, require a separate "adjustment" workflow that creates a compensating entry rather than modifying the original
- Add audit log entry every time paid status changes direction (already have `logAudit` infrastructure)
- Add a `paidToggledAt` timestamp and `paidToggledBy` user ID for accountability
- UI must show a warning: "This entry was previously marked as paid on [date]. Are you sure?"

**Detection:** Toggle an entry to PAID, finalize the period, then try to toggle back. Verify what breaks.

**Phase:** Payroll UX phase. Must be designed before implementation — the toggle logic affects `payroll.ts` core functions.

---

### P5: Service Agent Sync Creates Identity Split

**What goes wrong:** `ServiceAgent` (payroll dashboard) and `CsRepRoster` (CS dashboard) are completely separate tables with no shared key. The requirement says "sync service agents between payroll and CS dashboard reps." If sync is implemented as copying data between tables, any edit to one table must propagate to the other — but there's no event system for service agent changes (Socket.IO only covers sales and audits).

**Why it happens:** The two tables were created in different milestones for different purposes. `ServiceAgent` has financial data (`basePay`). `CsRepRoster` is a simple name list. They store overlapping but not identical data.

**Consequences:**
- Payroll adds a service agent, CS dashboard doesn't see them until manual refresh or next sync
- CS dashboard deactivates a rep, payroll dashboard still shows them as active
- Name changes in one place don't propagate
- If round robin assignment references `CsRepRoster` but payroll references `ServiceAgent`, assignment breaks when the rep exists in one but not the other

**Prevention:**
- Do NOT sync two tables. Instead, consolidate to a single source of truth. Either:
  - (A) Use `ServiceAgent` as the canonical table, add an `isCsRep` boolean flag, drop `CsRepRoster` — migration replaces roster entries with ServiceAgent records
  - (B) Create a shared `Staff` table that both dashboards reference
- Option A is simpler and matches the existing pattern (ServiceAgent already has the richer schema)
- If two tables must remain (business reasons), use a `serviceAgentId` FK on `CsRepRoster` to link them, and emit Socket.IO events on service agent mutations

**Detection:** Add a service agent in payroll, check if CS dashboard rep list updates.

**Phase:** Must be resolved before round robin assignment is built. Round robin depends on a single rep list.

## Moderate Pitfalls

### P6: Cross-Dashboard Date Range Picker Timezone Inconsistency

**What goes wrong:** The existing `dateRange()` function in routes uses local server time for "today/week/month" boundaries. Adding a custom date range picker means the client sends specific dates, but the client is in a different timezone than the server. A user selecting "March 15" in Pacific time gets different data than "March 15" in Eastern time.

**Why it happens:** The codebase already standardized on `America/New_York` via Luxon for payroll period boundaries, but the `dateRange()` utility and CSV export queries use `new Date()` (server-local time).

**Prevention:**
- All custom date range queries should accept ISO date strings and use UTC midnight boundaries (matching the existing payroll period convention)
- The date picker component should send dates as `YYYY-MM-DD` strings, and the API should interpret them as UTC midnight boundaries
- Add `startDate` and `endDate` query params to all export endpoints, validated with Zod `.datetime()` or `.string().regex(/^\d{4}-\d{2}-\d{2}$/)`
- Reuse the same date boundary logic across all 6 dashboards via a shared utility in `@ops/utils`

**Detection:** Set the server to UTC, use the app from Eastern timezone, select "today" and verify which records appear.

**Phase:** Cross-dashboard export phase. Build the shared date utility first, then wire to each dashboard.

---

### P7: Socket.IO Event Explosion for CS Submissions

**What goes wrong:** Adding real-time Socket.IO for CS submissions means every chargeback and pending term paste (which can contain 50-200 rows per batch) fires events. If the event is per-row, dashboards receive 200 events in rapid succession, each triggering a React re-render and state update.

**Why it happens:** The existing `sale:changed` event pattern emits one event per sale, which works because sales are entered one at a time. CS submissions are batch operations.

**Prevention:**
- Emit a single `cs:batch_submitted` event with summary data (batch ID, count, type) instead of per-row events
- Dashboard subscribes and does a single re-fetch of the updated data
- Do NOT send the full batch payload in the socket event — it's too large and the dashboard needs to fetch with its current filters anyway
- Add debouncing on the client side: if multiple events arrive within 500ms, batch them into one re-fetch

**Detection:** Submit a large paste (100+ rows) and monitor Socket.IO traffic and dashboard performance.

**Phase:** CS real-time phase. Simple to get right if designed correctly from the start.

---

### P8: AI System Prompt Editing Without Versioning

**What goes wrong:** The requirement says "system prompt visible and editable in owner dashboard AI tab." The current prompt is stored in `SalesBoardSetting` with key `ai_audit_system_prompt`. If an owner edits the prompt, all future audits use the new prompt, and there's no record of what prompt produced historical audit results. If the new prompt produces worse results, there's no rollback.

**Why it happens:** `SalesBoardSetting` is a simple key-value store with no history.

**Prevention:**
- Add a `prompt_version` field to `CallAudit` that stores which prompt version was used for that audit
- Store prompt history: either a separate `AiPromptHistory` table or a JSON array in the setting value
- Add a "revert to previous" button in the UI
- Show a "test prompt" feature that runs the new prompt against one existing transcript before saving

**Detection:** Edit the prompt, audit a call, edit the prompt again — verify you can tell which prompt was used for each audit.

**Phase:** AI config phase. The versioning table should be created in the same migration as the editable prompt UI.

---

### P9: Edit-Per-Sale in Payroll Bypasses Commission Recalculation Guards

**What goes wrong:** Adding an edit button per sale record in the payroll view creates a new mutation path. The existing sale edit flow goes through `handleSaleEditApproval()` which checks for finalized periods and creates compensating entries. A direct payroll-side edit might bypass this logic if it calls `prisma.payrollEntry.update()` directly instead of going through the sale edit pipeline.

**Why it happens:** Two different UIs (manager dashboard sale edit vs payroll dashboard sale edit) that should produce the same financial outcome but may use different API routes.

**Prevention:**
- There should be exactly ONE route for editing a sale's financial data, and both UIs call it
- The payroll "edit" button should navigate to the same sale edit form/modal, not create a parallel edit endpoint
- If the payroll edit only modifies payroll-specific fields (bonus, fronted, hold, adjustment), those already have their own update logic — but payout amount should NEVER be directly editable (it's always calculated from commission)
- Add a Zod schema that explicitly excludes `payoutAmount` and `netAmount` from the edit payload

**Detection:** Edit a sale from payroll dashboard, verify the payroll entry recalculation matches what would happen from manager dashboard.

**Phase:** Payroll UX phase. Design the route before building the UI.

---

### P10: Round Robin Assignment State Inconsistency

**What goes wrong:** Round robin assignment for pending terms and chargebacks needs to track which rep is "next" in the rotation. If this state is stored in memory (like the audit queue), it resets on deploy. If stored in the database, concurrent submissions can assign the same rep twice.

**Why it happens:** Round robin seems simple but has a concurrency problem: two paste submissions arriving simultaneously both read "next rep = Alice" and both assign to Alice.

**Prevention:**
- Store the `lastAssignedIndex` in the database (e.g., a `CsAssignmentState` table or a `SalesBoardSetting` entry)
- Use a database transaction with `SELECT ... FOR UPDATE` to atomically read and increment the index
- Handle inactive reps: if the "next" rep is inactive, skip to the next active rep
- The checklist tracking should be a separate concern from the assignment — don't couple "who's assigned" with "what steps they've completed"

**Detection:** Submit two batches simultaneously and verify assignments are distributed, not duplicated.

**Phase:** Round robin phase. Must come after service agent sync (P5) is resolved.

---

### P11: Convoso Transcript Auto-Scoring Cost Spiral

**What goes wrong:** The Convoso KPI poller runs every 10 minutes. If auto-scoring is wired to the poller, every new call log with a recording triggers a Whisper transcription + Claude API call. At $3/MTok for Claude and $0.006/min for Whisper, a team making 200 calls/day costs roughly $15-30/day in API fees. The cost is invisible until the first bill.

**Why it happens:** No cost tracking or budget cap in the current `callAudit.ts` pipeline. The `processCallRecording` function fires and forgets.

**Prevention:**
- Add a daily scoring budget cap (configurable via `SalesBoardSetting`)
- Track API spend per day in a `AiUsageLog` table or counter
- Default to scoring only calls longer than a threshold (e.g., 2+ minutes) — short calls have little coaching value
- Add a manual "score this call" button as the primary UX, with auto-scoring as an opt-in setting
- Show estimated monthly cost in the owner dashboard AI tab

**Detection:** Check Claude API usage dashboard after enabling auto-scoring for one day.

**Phase:** AI scoring phase. Budget controls must ship with auto-scoring, not after.

---

### P12: Storage Monitoring Without Baseline Metrics

**What goes wrong:** Adding storage monitoring and alerting requires knowing what "normal" looks like. The platform stores transcriptions (text), audit results (JSON), and references recordings (URLs). Without a baseline, any threshold is arbitrary. Alert fatigue sets in quickly if thresholds are wrong.

**Why it happens:** This is the first monitoring feature. There's no existing metrics infrastructure.

**Prevention:**
- Before building alerts, add a `/admin/storage-stats` endpoint that reports: total rows per table, total DB size, largest tables, growth rate over last 7 days
- Let the team observe for 1-2 weeks before setting alert thresholds
- Use PostgreSQL's `pg_total_relation_size()` for table size monitoring — no external tools needed
- Alert on growth rate (>20% week-over-week) rather than absolute size
- `ProcessedConvosoCall` already has a 30-day cleanup — add similar cleanup for old `ConvosoCallLog` records that have been scored

**Detection:** Query `pg_total_relation_size` for each table and compare against available disk.

**Phase:** Storage monitoring phase. Build the stats endpoint first, alerts second.

## Minor Pitfalls

### P13: CSV Export Memory Pressure on Large Date Ranges

**What goes wrong:** Custom date range pickers let users select "all time" which loads every record into memory for CSV generation. With thousands of sales, payroll entries, chargebacks, and pending terms, this can exhaust Node.js heap.

**Prevention:**
- Stream CSV rows instead of building the full string in memory (use Node.js `Transform` stream)
- Add a max date range limit (e.g., 90 days) or pagination for exports
- Alternatively, use Prisma's cursor-based pagination to fetch in batches

**Phase:** Export phase. Easy to prevent, hard to fix after shipping.

---

### P14: "+10" Enrollment Fee Indicator Display Logic Drift

**What goes wrong:** The requirement says show "+10" on enrollment fee when qualifying for $124 bonus. The actual threshold in `applyEnrollmentFee()` is `fee >= 125` for the $10 bonus. If the display threshold doesn't match the calculation threshold, the indicator shows on sales that don't actually get the bonus (or vice versa).

**Prevention:**
- The display logic must read from the same constant/config as the calculation logic
- Extract the threshold (`125`) and bonus amount (`10`) into shared constants in `@ops/utils` or the payroll service
- Never hardcode the threshold in the frontend

**Phase:** Payroll UX phase. Small but catches people off guard.

---

### P15: Owner Dashboard AI Tab "INP Not Defined" Error

**What goes wrong:** This is a known bug listed in PROJECT.md. The owner dashboard references an `INP` style constant that isn't imported or defined. This will block the AI prompt editing feature since it's on the same tab.

**Prevention:**
- Fix the undefined reference before adding new AI tab features
- Likely a missing import from `@ops/ui` or a locally defined style constant that was accidentally deleted

**Phase:** Must be fixed before or during AI config UI work. Quick fix but blocks the entire tab.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| AI call scoring pipeline | P1 (queue memory), P11 (cost spiral), P8 (prompt versioning) | DB-backed queue, budget cap, prompt history table |
| Chargeback-payroll alerts | P2 (phantom financial impact), P4 (toggle corruption) | Fuzzy match + manual confirm, OPEN-period-only toggle |
| KPI aggregation | P3 (double counting) | Separate call KPIs from retention KPIs, compute on read |
| Cross-dashboard exports | P6 (timezone), P13 (memory) | UTC boundaries, streaming CSV |
| CS real-time Socket.IO | P7 (event explosion) | Batch events, single re-fetch pattern |
| Payroll UX | P4 (toggle), P9 (edit bypass), P14 (display drift) | One edit route, shared constants, period guards |
| Service agent sync | P5 (identity split) | Consolidate to single table before building round robin |
| Round robin assignment | P10 (concurrency), P5 (depends on sync) | DB transaction for index, resolve sync first |
| Storage monitoring | P12 (no baseline) | Stats endpoint first, observe before alerting |
| Owner dashboard AI tab | P15 (INP error) | Fix before adding features |

## Sources

- Direct codebase analysis: `callAudit.ts`, `auditQueue.ts`, `payroll.ts`, `socket.ts`, `convosoKpiPoller.ts`, `schema.prisma`, `routes/index.ts`
- Existing architecture patterns observed in the v1.0 and v1.1 implementations
- Known issues documented in PROJECT.md

---
*Research completed: 2026-03-18*
