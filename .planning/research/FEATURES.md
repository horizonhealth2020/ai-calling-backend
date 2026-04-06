# Feature Landscape

**Domain:** Batch chargeback review and payroll agent tab navigation for internal ops platform
**Researched:** 2026-04-06

## Table Stakes

Features users expect. Missing = workflow feels broken or incomplete.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Multi-entry paste parsing | Current single-paste parser already exists; batch is the natural extension. Users paste full spreadsheet exports from carrier portal, not one row at a time. | Low | Existing `parseChargebackText()` in `CSSubmissions.tsx` already returns `ParsedRow[]` array; `consolidateByMember()` groups them. Parser handles batch natively. | Parser code already handles multiple rows. No parser changes needed -- the bottleneck is the review UX, not parsing. |
| Pre-submit review table | Users must verify parsed data before committing. Current flow: paste -> auto-parse -> editable table -> submit. Batch needs the same pattern but with richer per-entry context (matched agent, member info, amounts). | Medium | Requires chargeback auto-matching data (exists server-side: `matchStatus` with MATCHED/MULTIPLE/UNMATCHED). Needs to surface match info BEFORE submit. | Currently matching runs AFTER submit in POST /chargebacks handler. For pre-submit review, need client-side lookup or a new preview endpoint. |
| Per-entry edit/remove before bulk submit | Users need ability to edit individual parsed values (amount, product, assigned rep) and remove bad rows before submitting the batch. | Low | Existing `updateRecord()` pattern in CSSubmissions handles per-cell inline editing via `onRecordsChange`. | Already built for current flow. Extend with row-level remove button and validation badges per row. |
| Matched agent display in review table | When a chargeback's memberId matches a sale, show which agent it maps to. Critical for payroll staff to verify before clawback creation. | Medium | Existing auto-match logic uses `prisma.sale.findMany({ where: { memberId } })`. For preview, need client-side or lightweight API lookup. | Key change: move match info from post-submit to pre-submit. |
| Agent tab sidebar in payroll | Replace scrollable card list with fixed left sidebar listing agent names. Click agent -> show their pay data in main content area. | Medium | Existing `agentData` Map in `PayrollPeriods.tsx` already groups by agent name. `sortedAgents` provides ordered list with gross/net/activeCount. | Current layout: vertically stacked `AgentCard` components. New layout: sidebar (agent list) + main area (single agent's data). Major layout restructure but data layer is ready. |
| Last 4 pay periods per agent | Show only recent periods to reduce visual clutter and load time. Current implementation loads ALL periods for ALL agents in a single API call. | Low-Medium | Existing `sortedPeriods` in `AgentCard` already sorts by weekStart descending. Client-side `.slice(0, 4)` is simplest approach. | Can start client-side (slice display) without API changes. Server-side pagination is optimization for later. |
| Load More pagination per agent | Button to fetch older pay periods beyond the initial 4. | Low | Depends on tracking per-agent "how many periods shown" count. Client-side: increment slice. Server-side: offset/cursor param. | Simple counter state per agent. "Load More" increments by 4, appends to visible list. |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Pre-submit match preview with status badges | Show MATCHED/MULTIPLE/UNMATCHED status in the review table BEFORE submitting. Users fix issues before data enters the system. Prevents bad chargebacks from creating incorrect clawbacks. | Medium | New preview/lookup API endpoint accepting array of memberIds, returning match results without creating records. | Current flow: submit -> match -> alert. Better flow: preview -> fix -> submit. Prevents bad data from entering DB. |
| Batch validation summary bar | "12 parsed, 10 matched, 1 multiple, 1 unmatched" count strip above the review table. Instant confidence signal before submit. | Low | Client-side aggregation of match preview results. | Quick scan: green = matched, yellow = multiple (needs review), red = unmatched (fix or accept). |
| Partial product selection per chargeback in batch review | Already exists for single-chargeback flow in PayrollChargebacks tab (checkbox per product). Extending to batch: each matched row shows the sale's products with checkboxes for partial chargebacks. | High | Requires per-entry sale lookup to retrieve product list. Expensive for large batches (N+1 queries). | Only meaningful for MATCHED entries. UNMATCHED entries have no products. Defer unless explicitly requested. |
| Agent period status indicators in sidebar | Paid/unpaid/partial badges next to agent names in the sidebar. At a glance: who still needs payroll attention. | Low | Existing `allPaid` logic in `AgentCard` can be computed at sidebar level from `agentData`. | Removes need to click into each agent to check status. High value, low effort. |
| Agent sidebar search/filter | Type-ahead filter in sidebar to find agents by name. | Low | Client-side string filter on `sortedAgents` array. | Useful when agent roster exceeds 15. Not critical at current team size. |
| Round-robin assignment in batch review | Auto-assign CS reps to chargebacks in the review table using existing round-robin logic. Already built for current flow (`fetchBatchAssign`). | Low | Existing `batch-assign` API endpoint and `assignRoundRobinLocal` function. | Already works. Just needs to be wired into batch review table. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automatic batch submission without review | Chargebacks affect payroll via clawback auto-creation. Human verification is non-negotiable. | Always require explicit "Submit Batch" click after review table is visible and inspected. |
| Multi-step wizard for batch submit | Current paste-to-parse is single-step. Wizard (parse -> review -> match -> confirm -> submit) creates friction for a daily workflow. | Two states: (1) paste area with parse, (2) review table with submit. Same as existing CSSubmissions pattern. |
| CSV/file upload for chargebacks | Users copy-paste from carrier portal. Data source is tab-delimited text from a web page. CSV import adds unused code paths. | Paste-only input. Parser handles tab-delimited format. |
| Drag-and-drop agent reordering in sidebar | Agents sort by earnings (active first, then alphabetical). Custom ordering creates state complexity for no value. | Automatic sort: gross descending for agents with sales, alphabetical otherwise. Matches existing `sortedAgents` logic. |
| Agent sidebar as separate routes | Each agent as URL route (`/payroll/agents/[id]`) adds routing complexity. Payroll is already a sub-tab within unified dashboard. | Agent selection as component state within Periods sub-tab. No route changes. |
| Infinite scroll for periods | Pagination with explicit "Load More" is better for payroll. Users need clear period boundaries, not continuous streams. | "Load More" button that appends next batch of periods to agent's visible list. |
| Real-time collaborative batch editing | Only SUPER_ADMIN or OWNER_VIEW submits chargebacks. Single-user scenario. | Standard single-user review table with submit. |
| Batch undo after submit | Adds complex rollback logic (delete chargebacks, reverse clawbacks, clear alerts). Individual delete already exists. | Use existing per-chargeback delete endpoint (`DELETE /chargebacks/:id`) for corrections. |

## Feature Dependencies

```
Existing parser (parseChargebackText) -----> Batch Review Table -----> Bulk Submit (POST /chargebacks)
                                                  |
                                                  +---> Per-entry Edit/Remove
                                                  |
                                                  +---> Match Preview (new lookup) ---> Status Badges
                                                  |
                                                  +---> Round-robin Assignment (exists)

Existing agentData Map -----> Agent Sidebar List -----> Agent Selection State
                                                            |
                                                            +---> Single Agent Display (AgentCard reuse)
                                                            |
                                                            +---> Period Slice (last 4) ---> Load More
```

Key dependency notes:
- Batch review table is the core chargeback deliverable; match preview and status badges layer on top
- Agent sidebar is a layout restructure of PayrollPeriods; data layer (`agentData` Map, `sortedAgents`) already exists
- Match preview is the only NEW backend endpoint needed (lookup by memberId array without creating records)
- Load More can start client-side (slice existing data) then optimize to server-side pagination later
- Both features are independent of each other -- can be built in parallel or either order

## MVP Recommendation

Prioritize:
1. **Batch review table with inline editing** - Core deliverable. Parser already handles batch. Build editable table with row-remove, amount editing, rep assignment. Reuse existing `ConsolidatedRecord` type and `updateRecord` pattern from CSSubmissions.
2. **Match preview before submit** - Add API endpoint that accepts `memberId[]` and returns `{ memberId, matchStatus, agentName?, saleId? }[]`. Display MATCHED/UNMATCHED badges in review table. Client calls this on parse, not on submit.
3. **Agent tab sidebar** - Restructure PayrollPeriods from vertically stacked AgentCards to sidebar + content. `sortedAgents` becomes sidebar list, selected agent's `AgentCard` renders in main area. One agent visible at a time.
4. **Last 4 periods + Load More** - Client-side: `sortedPeriods.slice(0, visibleCount)` with a "Load More" button incrementing `visibleCount` by 4. No API changes for MVP.

Defer:
- **Partial product selection in batch review**: High complexity (N+1 lookups per batch entry). Add after batch workflow proves stable.
- **Agent sidebar search**: Only needed at 15+ agents. Add based on roster growth.
- **Server-side period pagination**: Optimize after measuring whether full-fetch + client-slice is fast enough.

## Sources

- Direct analysis: `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` (existing paste-to-parse flow, parser functions, round-robin, submit handler)
- Direct analysis: `apps/ops-api/src/routes/chargebacks.ts` (POST handler with auto-matching, batch create, alert creation)
- Direct analysis: `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx` (agent card structure, expand/collapse, week sections)
- Direct analysis: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` (agentData Map, sortedAgents, expand/select state, current layout)
- Direct analysis: `apps/ops-dashboard/app/(dashboard)/payroll/page.tsx` (payroll tab structure, PageShell nav, shared state)
- Direct analysis: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx` (single chargeback lookup, partial product selection pattern)
- PROJECT.md active requirements (v2.2 milestone definition)
