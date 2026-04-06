# Pitfalls Research

**Domain:** Batch chargeback review and payroll agent tab navigation for existing Ops Platform
**Researched:** 2026-04-06
**Confidence:** HIGH (based on direct codebase analysis of existing patterns)

## Critical Pitfalls

### Pitfall 1: Batch Clawback Dedupe Guard Bypass on Multiple Chargebacks for Same Sale

**What goes wrong:**
The existing dedupe guard in `approveAlert()` checks `matchedBy: "chargeback_alert"` + `matchedValue: chargebackSubmissionId`. In a batch of 5 chargebacks, two could match the same sale (same `memberId`). If both are approved, each creates a separate clawback because they have different `chargebackSubmissionId` values -- the dedupe guard passes for both. The agent gets double-clawed.

**Why it happens:**
The current dedupe guard was designed for single chargeback submission. It dedupes on chargeback-to-sale, not on sale-across-batch. Batch submission multiplies the surface area for this collision. The existing `consolidateByMember()` function groups rows by memberId, but the batch review table might present un-consolidated entries if users want per-line control.

**How to avoid:**
Before batch submission, run a pre-flight check: query existing clawbacks for all matched saleIds in the batch. Surface warnings in the review table for any sale that already has a clawback. For intra-batch duplicates (two entries matching the same sale), flag them visually and require explicit confirmation. The API endpoint should also validate no duplicate saleIds within a single batch request.

**Warning signs:**
- Two entries in the review table showing the same matched agent and member
- Test case with pasted data containing the same memberId on multiple lines
- Clawback total exceeding the agent's total commission for a sale

**Phase to address:**
Batch chargeback review phase -- the pre-submit review table must include this validation.

---

### Pitfall 2: Fetch-All Payroll Endpoint Breaks Under Agent Tab Pagination

**What goes wrong:**
The current `/payroll/periods` endpoint returns ALL periods with ALL entries for ALL agents in a single query (see `payroll.ts` line 12-32). The client then groups by agent in `useMemo`. Switching to agent tabs with "last 4 periods" and "load more" requires per-agent pagination, but the endpoint was never designed for it. If you add a new per-agent endpoint but leave the old fetch-all in place, you end up with two data sources that can go out of sync -- the summary strip uses one, the tab content uses another.

**Why it happens:**
The existing architecture fetched everything at once because agent cards were all visible on one scrollable page. Tabs change the access pattern fundamentally: you only need data for one agent at a time, but summary KPIs still need all-agent aggregates. Developers often add the new endpoint without removing the old fetch, creating dual-source truth.

**How to avoid:**
Design the API migration as two steps: (1) a lightweight summary endpoint that returns agent names, period counts, and aggregate KPIs without entry details; (2) a per-agent detail endpoint with period pagination. The summary powers the tab sidebar and KPI strip. The detail endpoint powers the active tab content. Do NOT try to keep the old fetch-all endpoint running in parallel -- it masks the migration and creates sync bugs.

**Warning signs:**
- Two separate `authFetch` calls for payroll data in the component
- `useMemo` still processing all-agent data after tab migration
- Slow initial load time not improving after tab switch (still fetching everything)

**Phase to address:**
Payroll agent tabs phase -- API refactor must come before UI tab migration.

---

### Pitfall 3: Batch Parse Losing Row Identity Through Consolidation

**What goes wrong:**
The existing `consolidateByMember()` merges multiple parsed rows into one consolidated record, summing amounts and joining product names. For batch review where users need to confirm/edit each line, consolidation destroys the per-line detail they need. If you consolidate first and then present the review table, users cannot select partial products per original chargeback entry -- they see a merged record with a comma-separated product string.

**Why it happens:**
The single-submission flow consolidates because it submits one chargeback at a time -- merging is fine. Batch review requires the opposite: show every line, let users pick which to include, and only consolidate (or not) at submit time. Developers reuse the existing consolidation function too early in the pipeline.

**How to avoid:**
Parse into individual rows and present them unconsolidated in the review table. Each row gets its own match status, product selection, and include/exclude toggle. Consolidation (if desired) happens only at the submission step, and only for entries the user has confirmed. Keep `parseChargebackText()` as-is (it already returns individual `ParsedRow[]`), but do NOT call `consolidateByMember()` before the review step.

**Warning signs:**
- Review table showing fewer rows than the user pasted
- Product column containing comma-separated values from consolidation
- Users unable to exclude a single product from a multi-product member

**Phase to address:**
Batch chargeback review phase -- parser output feeds directly to review table without consolidation.

---

### Pitfall 4: Socket.IO Batch Emission Causing N+1 Dashboard Refreshes

**What goes wrong:**
The existing chargeback submission calls `emitCSChanged()` once per batch (good), but `createAlertFromChargeback()` calls `emitAlertCreated()` once per chargeback entry (line 20 of alerts.ts). A batch of 15 chargebacks fires 15 socket events. The payroll dashboard listens and refreshes on each `alert_created` event, causing 15 consecutive re-fetches of all payroll data.

**Why it happens:**
The alert creation function was written for single chargebacks. It fires immediately on creation. Batch submission loops through all created chargebacks and calls it repeatedly. No batching or debounce on the socket emission side.

**How to avoid:**
Two options: (1) Batch the socket emission -- collect all created alerts, emit one `alerts_batch_created` event with the full list after all are created. (2) Add client-side debounce on the payroll dashboard's socket listener -- ignore rapid-fire alert events and only refresh once after a 500ms quiet period. Option 1 is cleaner. The `emitCSChanged` call already follows this pattern (single emission per batch).

**Warning signs:**
- Dashboard flickering/loading spinner appearing repeatedly after batch submit
- Network tab showing multiple rapid GET requests to `/payroll/periods` or `/alerts`
- Performance degradation proportional to batch size

**Phase to address:**
Batch chargeback review phase -- socket emission must be batched.

---

### Pitfall 5: Agent Tab State Loss on Period Lock/Unlock or Socket Update

**What goes wrong:**
The current `PayrollPeriods` component manages `expandedAgents`, `expandedWeeks`, and `selectedWeek` in local state. When `periods` data changes (from Socket.IO update, mark-paid, or period lock), the `useEffect` on line 146-192 either re-initializes everything (first load) or carefully preserves existing state (subsequent updates). Switching to agent tabs adds `selectedAgent` state. If a period lock triggers a full data re-fetch, the selected agent tab and scroll position within that tab reset -- the user loses their place.

**Why it happens:**
The existing code already has a careful `initializedRef` guard to distinguish first load from updates. But adding a new API pattern (per-agent fetch vs fetch-all) changes when and how data arrives. If the per-agent endpoint returns data that triggers the initial-load path, all UI state resets. This is especially likely after Socket.IO events that refresh data.

**How to avoid:**
Store `selectedAgentId` in a `useRef` that survives re-renders and data changes. When data refreshes, check if the selected agent still exists in the new data before preserving the selection. For socket-triggered updates, use a merge strategy: update only the affected agent's data in state rather than replacing the entire dataset. The existing pattern of `initializedRef` should extend to cover the agent tab selection.

**Warning signs:**
- Tab jumping back to first agent after clicking "Mark Paid"
- Selected week collapsing after another user submits a chargeback
- Console showing the initial-load path running on data updates

**Phase to address:**
Payroll agent tabs phase -- state management must handle partial updates.

---

### Pitfall 6: Batch Chargeback Auto-Match Producing N+1 Database Queries

**What goes wrong:**
The existing chargeback submission loops through each created chargeback and runs `prisma.sale.findMany({ where: { memberId } })` individually (chargebacks.ts lines 67-97). For a batch of 20 chargebacks, that is 20 separate sale lookups plus 20 individual chargeback updates. Each update is a separate query. Total: 40+ queries for one batch submission.

**Why it happens:**
The current loop was acceptable for the existing pattern where chargebacks are created via `createMany` and then individually matched. It was written for single-paste submissions of 1-5 records. Batch submission scales this to 10-30+ records per paste.

**How to avoid:**
Collect all unique `memberId` values from the batch. Run a single `prisma.sale.findMany({ where: { memberId: { in: memberIds } } })`. Build a lookup map of memberId to sale matches. Then run a single `prisma.$transaction()` to update all chargeback match statuses at once. This reduces 40+ queries to 2-3 queries regardless of batch size.

**Warning signs:**
- Batch submission taking over 3 seconds for 15+ entries
- Database connection pool warnings in logs
- Prisma query logs showing repetitive `SELECT` patterns

**Phase to address:**
Batch chargeback review phase -- query batching in the submission endpoint.

---

### Pitfall 7: Pre-Submit Review Table Showing Stale Match Data

**What goes wrong:**
The batch review workflow is: parse -> show review table -> user edits -> submit. If the review table shows "Matched to Agent X" based on a client-side or API lookup, but between the time the user sees the table and clicks submit, another user submits or resolves that same member's sale, the match data shown is stale. The user approves based on outdated information.

**Why it happens:**
The review step introduces a time gap between lookup and submission that did not exist in the single-submission flow. Single submission parsed and submitted immediately -- no review pause where data could go stale.

**How to avoid:**
Re-validate matches at submission time on the server. The pre-submit table is informational -- it shows the user what will likely happen. The actual matching runs server-side during submission with the current database state. Display a timestamp on the review table ("Matches as of 2:34 PM") and if the review sits open for more than 5 minutes, show a "Refresh matches" button. Never trust client-provided match data -- always re-run matching on the server.

**Warning signs:**
- Client sending `matchedSaleId` in the submission payload (should not)
- No server-side re-matching in the batch submission endpoint
- Users complaining about "wrong agent" on chargebacks submitted after long review periods

**Phase to address:**
Batch chargeback review phase -- server-side re-validation at submit time.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping fetch-all payroll endpoint alongside new per-agent endpoint | Faster initial delivery, no summary KPI refactor | Two sources of truth, doubled memory usage, sync bugs between tabs and summary | Never -- refactor to summary + detail endpoints together |
| Client-side match lookup for review table (no API call) | Faster perceived performance | Stale data, no access to server-side sale matching logic | Never -- always validate matches server-side |
| Reusing `consolidateByMember()` for batch review | Less new code | Users cannot do per-entry review, partial product selection breaks | Never for batch review -- consolidation defeats the purpose |
| Skipping Socket.IO batching for alerts | Simpler implementation | N dashboard refreshes per batch size, poor UX | Only if batch size is guaranteed under 3 entries (it is not) |
| Storing selected agent tab in URL query param | Shareable URLs, survives page refresh | Adds URL state management complexity, conflicts with existing tab routing | Only if there is a user request for shareable payroll links |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Clawback auto-creation from batch | Approving all alerts in a batch without checking for same-sale duplicates | Pre-flight dedupe check across the entire batch before any approvals |
| Socket.IO event handling for batch operations | Emitting per-item events in a loop | Collect results, emit single batch event with array payload |
| Payroll period status during batch clawback | Not checking if target period is still OPEN when processing the 15th item (another user may have locked it during processing) | Wrap batch clawback processing in a transaction, verify period status at the start |
| AgentPeriodAdjustment after clawback | Forgetting to recalculate net amounts on the agent's adjustment after clawback changes the entry | Clawback affects PayrollEntry, not AgentPeriodAdjustment -- but the UI net display must refresh |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetch-all periods on every tab switch | Loading spinner on each agent tab click, sluggish UI | Cache periods in parent state, only fetch detail for active agent | Immediately with current data volume (all agents x all periods) |
| Unindexed memberId lookup during batch matching | Batch submission timeout for 20+ entries | Verify `memberId` index exists on Sale table, use `IN` clause instead of loop | 10+ entries per batch with 1000+ sales in database |
| Re-rendering all AgentCards when only one agent's data changes | Visible lag, React DevTools showing unnecessary renders | `React.memo` on AgentCard, stable callback refs via `useCallback` | 10+ agents with complex entry data |
| Loading "last 4 periods" per agent without limit clause | Accidentally loading all periods for agent with 52+ weeks of history | Server-side `take: 4` with `orderBy: weekStart desc`, explicit pagination cursor | After 3+ months of operation |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Batch submission accepting client-provided matchedSaleId | User could associate chargebacks with arbitrary sales, triggering wrong clawbacks | Server-side matching only -- strip any match fields from client payload |
| No rate limit on batch submission endpoint | Accidental or malicious paste of thousands of rows could overwhelm DB | Add Zod validation `records.max(100)` on the batch array, return 400 for oversized batches |
| Agent tab endpoint leaking other agents' data | Payroll tab user seeing data they should not (unlikely with current RBAC but possible with bad query) | Per-agent endpoint must still enforce `requireRole("PAYROLL", "SUPER_ADMIN")`, do not create unguarded agent-specific routes |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Review table with no row-level error states | User submits batch, 3 of 20 fail, cannot tell which ones succeeded | Show per-row status in review table (pending/success/error), allow retry of failed rows |
| Agent tabs without visual indicator of which agents have pending items | User must click through every tab to find unpaid agents | Badge on agent tab showing unpaid entry count or pending alert count |
| "Load More" button with no indication of remaining periods | User clicks repeatedly without knowing when they have reached the end | Show "Showing 4 of 12 periods" counter, disable button when all loaded |
| Batch submit with no progress indication | User thinks the page is frozen during a large batch | Show progress bar or "Submitting 15 of 20..." counter during batch API call |
| Review table not sortable or filterable | User cannot find the one entry they want to exclude in a 30-row batch | Add sort by amount, filter by match status (matched/unmatched) |

## "Looks Done But Isn't" Checklist

- [ ] **Batch review table:** Often missing keyboard navigation (Tab between rows, Enter to toggle include) -- verify accessibility
- [ ] **Agent tabs:** Often missing the "no entries" empty state per agent -- verify agents with zero payroll entries show a clean empty message, not a broken layout
- [ ] **Batch submission:** Often missing the partial failure case -- verify what happens when 18 of 20 chargebacks insert but 2 fail validation
- [ ] **Load more pagination:** Often missing the cursor/offset persistence -- verify that after loading more periods, a data refresh does not reset to the first 4
- [ ] **Socket.IO after batch:** Often missing the batch event listener on the receiving dashboards -- verify CS tracking table updates after batch chargeback submission
- [ ] **Agent tab selection:** Often missing persistence across payroll tab switches -- verify switching to CS tab and back preserves the selected agent
- [ ] **Review table match column:** Often missing the MULTIPLE match case -- verify that chargebacks matching 2+ sales show "Multiple matches" warning, not the first match
- [ ] **Clawback creation from batch:** Often missing the "no OPEN period" error handling -- verify graceful message when agent has no open period for clawback

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Double clawback from same sale | MEDIUM | Query clawbacks by saleId, identify duplicates, soft-delete the duplicate, recalculate payroll entry amounts |
| Fetch-all endpoint kept alongside per-agent | LOW | Remove old endpoint usage from client, update summary to use lightweight summary endpoint, single PR |
| Consolidated data submitted instead of per-entry | HIGH | Cannot un-consolidate after submission -- must delete batch and re-submit. Users lose edited fields. |
| Socket.IO N+1 refresh storm | LOW | Add client-side debounce as hotfix, then refactor to batch emission |
| Stale match data submitted | MEDIUM | Re-run matching on all chargebacks in the affected batch, update match statuses, notify payroll of any changed matches |
| Agent tab state reset on update | LOW | Add `useRef` for selected agent, single component fix |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Batch clawback dedupe bypass | Batch chargeback review | Submit 2 chargebacks for same memberId, verify only 1 clawback created or warning shown |
| Fetch-all payroll endpoint conflict | Payroll agent tabs (API first) | Verify no remaining calls to old `/payroll/periods` fetch-all endpoint in client code |
| Consolidation destroying row identity | Batch chargeback review (parser step) | Paste 5 lines with 2 sharing a memberId, verify 5 rows in review table |
| Socket N+1 refresh | Batch chargeback review (submission step) | Submit 10 chargebacks, verify single socket emission and single dashboard refresh |
| Agent tab state loss | Payroll agent tabs (UI step) | Mark entry paid in active tab, verify same agent tab stays selected |
| N+1 match queries | Batch chargeback review (API optimization) | Submit 20 chargebacks, verify query count is 3-4 not 40+ |
| Stale match data | Batch chargeback review (submission step) | Open review table, change sale data in another tab, submit, verify server-side match wins |

## Sources

- Direct codebase analysis: `apps/ops-api/src/routes/chargebacks.ts` (current submission flow, auto-match loop)
- Direct codebase analysis: `apps/ops-api/src/services/alerts.ts` (dedupe guard, per-alert socket emission)
- Direct codebase analysis: `apps/ops-api/src/routes/payroll.ts` (fetch-all endpoint, clawback creation)
- Direct codebase analysis: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` (agent grouping, state management, initializedRef pattern)
- Direct codebase analysis: `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx` (component interface, prop drilling)
- Direct codebase analysis: `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` (parser, consolidateByMember, round-robin)
- Project context: `.planning/PROJECT.md` (key decisions, validated requirements, milestone scope)

---
*Pitfalls research for: Batch chargeback review and payroll agent tabs on Ops Platform v2.2*
*Researched: 2026-04-06*
