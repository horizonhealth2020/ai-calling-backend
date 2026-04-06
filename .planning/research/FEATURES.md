# Feature Research

**Domain:** Internal ops platform iteration (v2.1) -- batch chargeback processing, payroll navigation redesign, audit/tracker polish
**Researched:** 2026-04-06
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that follow directly from what is already built. Users will consider these obvious improvements to existing workflows.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| CSV upload for batch chargebacks | Current paste-to-parse handles single batches from clipboard; users already paste tab-delimited data. CSV file upload is the natural next step when dealing with carrier reports that arrive as spreadsheets. | MEDIUM | Reuse existing `parseChargebackText()` parser logic. CSV is tab-delimited like the paste data, so the parser already handles it. The new pieces: file input UI, `FileReader` API, and a pre-submit review table showing matched agent/product/amount per row with ability to remove bad rows before submission. |
| Pre-submit review with match indicators | The existing flow parses and consolidates by member, but there is no visual confirmation of what matched (agent, product, sale). Users need to see MATCHED/MULTIPLE/UNMATCHED status per row before committing a batch of 50+ chargebacks. | MEDIUM | Leverage existing chargeback auto-matching logic from v1.5 (`MATCHED/MULTIPLE/UNMATCHED` status by memberId). Call a dry-run match endpoint or do client-side preview using loaded agent/product data. Each row should show: parsed amount, matched agent name, matched product, match confidence badge. |
| Enrollment fee defaults to $0 when missing | Currently `enrollmentFee` is `nullable` throughout the stack. When null, the commission engine's enrollment fee threshold check (`enrollmentFee < threshold`) evaluates `null < 99` as falsy, which means it does NOT trigger halving. But the UI shows a "half commission" badge inconsistently, and the approve button behavior depends on this field. Defaulting to $0 when missing makes the halving logic deterministic: $0 is always below threshold, so missing fee = half commission unless manually approved. | LOW | Change is surgical: default `enrollmentFee` to `0` in the sale creation route when the field is omitted/null, update Zod schema default, and verify the commission engine and UI badge logic handle $0 consistently. |
| Call audit rolling window (last 30 audits) | Current default is "last 24 hours" which shows nothing on slow days and too much on busy days. A count-based window (last 30 audits) provides consistent density regardless of volume. | LOW | Change the default `where` clause in `call-audits.ts` from time-based (`now - 24h`) to count-based (`take: 30, orderBy: callDate desc`). Remove the time-based default entirely. The cursor pagination and date range filter continue to work as-is for non-default loads. |
| Performance tracker sections start expanded | Lead timing analytics (heatmap, sparklines, recommendation card) currently start collapsed (`useState(false)`). Users must click to expand every page load. For the Performance Tracker tab, these are the primary content -- they should start visible. | LOW | Change `useState(false)` to `useState(true)` in `LeadTimingSection.tsx`. The `useEffect` already triggers data fetch when `expanded` is true, so this is a one-line change that triggers initial load. |

### Differentiators (Competitive Advantage)

Features that go beyond the obvious iteration and add meaningful operational value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Payroll agent sidebar with per-agent historical view | Current layout: expand a period card to see ALL agents stacked vertically. With 15+ agents this is a long scroll. The redesign: a left sidebar listing all agents (with search/filter), clicking an agent shows their last 4 pay cards with a "Load More" button. This is a master-detail pattern that makes individual agent payroll review dramatically faster for payroll staff who process one agent at a time. | HIGH | This is the largest feature in the milestone. Requires restructuring the PayrollPeriods component from "period-first" (expand period, see agents) to "agent-first" (select agent, see periods). Data fetching changes from "load all entries for a period" to "load entries for an agent across recent periods." New API endpoint: `GET /api/payroll/agent/:id/history?limit=4&offset=0` returning the last N periods with that agent's entries. The sidebar needs agent list with gross/net summary per current period. |
| ACA product editable in payroll Products tab | Currently ACA PL products exist with `flatCommission` and `type: ACA_PL`, but the Products tab in payroll only shows read-only commission rates. Making ACA products editable means payroll staff can adjust flat commission per member and configure addon qualifier rules (which addons count as bundled vs standalone) without developer intervention. | MEDIUM | Add edit form for ACA_PL product type in the Products tab: editable `flatCommission` field, toggle for which addons qualify as bundle qualifiers. Reuse existing product update API endpoint but extend it to accept ACA-specific fields. Need to handle the addon qualifier rules as a relation (product -> qualifying addons). |
| Batch CSV upload with row-level error handling | Beyond basic CSV upload: show per-row validation errors (invalid date format, missing required field, unrecognized product name), allow fixing individual rows inline before submit, and provide a summary count (X valid, Y errors, Z duplicates). | MEDIUM | Extends the basic CSV upload. Parse all rows, run validation, show a two-section preview: "Ready to Submit" and "Needs Attention." Each error row has inline editing. Submit only sends valid rows. This prevents partial batch failures that would require re-uploading the entire file. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Drag-and-drop column mapping for CSV | "What if the CSV columns are in a different order?" | The chargeback CSVs come from a specific carrier system with a consistent format. Building a generic column mapper adds significant complexity for a problem that does not exist in practice. The existing tab-delimited parser already handles the known format. | Hard-code the expected column order. If the format changes, update the parser -- it is a single function (`parseChargebackText`). |
| Real-time collaborative editing of chargeback review | "Multiple CS staff reviewing the same batch simultaneously" | Adds WebSocket complexity, conflict resolution, and locking for a workflow that is sequential by nature (one person processes a carrier report). | Single-user batch processing. If someone else is uploading, the batchId deduplication already prevents double-submission. |
| Infinite scroll for payroll agent history | "Just keep scrolling to load more periods" | Infinite scroll is disorienting for financial data -- users lose context of which period they are looking at. It also makes print/export harder. | "Load More" button with explicit period cards. Show last 4 by default, load 4 more on click. Each card has clear period date labels. User always knows where they are. |
| Full-text search across all audit transcripts | "Search for keywords in call transcripts" | Call transcripts can be large. Full-text search requires indexing infrastructure (Elasticsearch or pg_tsvector), adds query complexity, and the use case is better served by the existing agent + date filters. | Keep agent filter + date range filter. If transcript search becomes a real need later, add pg_tsvector on the transcript column -- but do not build it preemptively. |
| Agent sidebar with real-time updates | "Sidebar totals should update live via Socket.IO" | The sidebar is a navigation aid, not a live ticker. Adding Socket.IO listeners for sidebar gross/net calculations introduces re-render complexity on every sale event across all agents. | Fetch sidebar data on mount and on agent selection. Manual refresh button if needed. The payroll tab already has Socket.IO for period-level changes -- that is sufficient. |

## Feature Dependencies

```
CSV Batch Upload
    requires: existing parseChargebackText() parser
    requires: existing chargeback auto-matching (memberId lookup)
    enhances: CS Submissions tab

Pre-Submit Review Table
    requires: CSV Batch Upload (shares the parsed data)
    requires: match status endpoint or client-side agent/product lookup

Enrollment Fee $0 Default
    independent (no dependencies on other v2.1 features)
    affects: commission engine halving logic, payroll UI badge display

Payroll Agent Sidebar
    requires: new agent history API endpoint
    independent of: existing period-based data fetching (can coexist)

ACA Product Editable
    requires: existing Products tab UI
    requires: existing product update API
    enhances: ACA PL commission workflow

Audit Rolling Window
    independent (API-only change to default query)

Performance Tracker Expanded + Sparkline Fix
    independent (UI state change + data rendering fix)
```

### Dependency Notes

- **CSV Batch Upload requires parseChargebackText():** The existing parser already handles tab-delimited text. CSV files from carrier systems use the same tab-delimited format, so `FileReader.readAsText()` + existing parser = batch upload. No new parser needed.
- **Pre-Submit Review requires match data:** Either call the existing chargeback matching logic as a dry-run preview (preferred -- keeps match logic server-authoritative) or load agents/products client-side for approximate matching. Server-side dry-run is more accurate but requires a new endpoint (`POST /api/chargebacks/preview`).
- **Payroll Agent Sidebar is independent but large:** Does not depend on any other v2.1 feature but is the most complex single feature. Should be phased last to avoid blocking other work.
- **Enrollment Fee $0 Default is fully independent:** Can be done first as a quick win. Fixes existing UX inconsistency.
- **Sparkline fix and expanded state are independent:** Both touch the Performance Tracker tab but in different ways -- one is a data issue, the other is a UI state default.

## MVP Definition

### Phase 1: Quick Fixes (low-cost, high-value)

- [x] Enrollment fee defaults to $0 when missing -- fixes half-commission badge and approve button inconsistency
- [x] Call audit rolling window: change default from 24-hour time window to last 30 audits
- [x] Performance tracker: lead source/timing analytics start expanded
- [x] Fix 7-day trend sparklines data rendering

### Phase 2: CSV Batch Chargeback Processing

- [x] CSV file upload UI on CS Submissions tab (file input + drag-drop area)
- [x] Parse CSV through existing `parseChargebackText()` parser
- [x] Pre-submit review table with match status badges (MATCHED/MULTIPLE/UNMATCHED)
- [x] Row removal and inline editing before submission
- [x] Submit batch through existing `/chargebacks` POST endpoint

### Phase 3: ACA Product Editing

- [x] ACA PL product type editable in payroll Products tab
- [x] Flat commission per member field with save
- [x] Addon qualifier rules configuration

### Phase 4: Payroll Agent Sidebar

- [x] New API endpoint: agent payroll history (last N periods with entries)
- [x] Agent sidebar with search/filter and current-period gross/net summary
- [x] Per-agent detail view with last 4 pay cards
- [x] "Load More" pagination for historical periods

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Enrollment fee $0 default | HIGH | LOW | P1 |
| Audit rolling window (30 audits) | MEDIUM | LOW | P1 |
| Tracker sections start expanded | MEDIUM | LOW | P1 |
| Sparkline data fix | MEDIUM | LOW | P1 |
| CSV batch chargeback upload | HIGH | MEDIUM | P1 |
| Pre-submit review with match badges | HIGH | MEDIUM | P1 |
| ACA product editable | MEDIUM | MEDIUM | P2 |
| Payroll agent sidebar redesign | HIGH | HIGH | P2 |

**Priority key:**
- P1: Must have -- either low-cost quick wins or high-value core features for this milestone
- P2: Should have -- important but can ship after P1 features are stable

## Existing Feature Inventory (What Is Already Built)

Understanding what is built is critical for scoping the iteration work accurately.

| Existing Feature | Relevant Code | What v2.1 Changes |
|------------------|---------------|-------------------|
| Paste-to-parse chargeback entry | `CSSubmissions.tsx` -- `parseChargebackText()`, `consolidateByMember()` | Extended with CSV file input; parser reused as-is |
| Chargeback auto-matching | `chargebacks.ts` -- memberId lookup after `createMany`, MATCHED/MULTIPLE/UNMATCHED status | Reused for pre-submit review match preview (new dry-run endpoint) |
| Chargeback batch submission | `chargebacks.ts` -- `POST /chargebacks` accepts `records[]` array with `batchId` | Unchanged -- CSV upload feeds the same endpoint |
| Agent pay cards | `PayrollPeriods.tsx` -- `AgentPayCard` component, period-first expand layout | Restructured to agent-first layout with sidebar navigation |
| ACA PL product type | `PayrollPeriods.tsx` -- ACA badge, `flatCommission` display, `memberCount` math | Products tab gets edit form for ACA-specific fields |
| Products tab (read-only) | `PayrollPeriods.tsx` -- shows commission rates and bundle config | Extended with ACA edit form |
| Call audit default query | `call-audits.ts` lines 44-52 -- `now - 24h` time window when no range/cursor | Changed from time-based to count-based (last 30 audits) |
| Lead timing section state | `LeadTimingSection.tsx` line 75 -- `useState(false)` collapsed by default | Changed to `useState(true)` for expanded default |
| Lead timing sparklines | `LeadTimingSparklines.tsx` -- inline SVG, 7-day close rate arrays | Data rendering fix for sparkline display |
| Sparklines API | `lead-timing.ts` lines 142-221 -- 7-day series with daypart bucketing | Query may need fix if sparkline data is empty/wrong |
| Commission halving | `commission.test.ts` -- enrollmentFee threshold check, `commissionApproved` bypass | $0 default makes halving deterministic for missing fees |
| Round-robin CS rep assignment | `cs-reps.ts` -- assigns chargebacks to service agents | Used in CSV batch to auto-assign uploaded chargebacks |

## Behavioral Expectations for New Features

### CSV Batch Upload Expected Behavior

1. **File input:** User clicks "Upload CSV" or drags a file onto a drop zone on the CS Submissions tab.
2. **Parsing:** File contents read via `FileReader.readAsText()`, passed to existing `parseChargebackText()`. Tab-delimited format is identical to what users currently paste.
3. **Consolidation:** Parsed rows consolidated by member via existing `consolidateByMember()`.
4. **Preview table:** Shows all consolidated records with columns: Posted Date, Member ID, Member Name, Product, Chargeback Amount, Match Status (badge), Matched Agent. Match status comes from a server-side dry-run or client-side memberId lookup against loaded sales.
5. **Row actions:** Remove row (X button), edit amount inline, re-assign agent dropdown.
6. **Submit:** "Submit Batch" button sends consolidated records to `POST /chargebacks` with a generated batchId. Success clears the preview and shows a count toast.
7. **Error handling:** If the file is not tab-delimited or has no parseable rows, show an error message instead of an empty preview.

### Payroll Agent Sidebar Expected Behavior

1. **Layout:** Two-column layout. Left sidebar (~280px) lists all agents. Right content area shows the selected agent's pay cards.
2. **Sidebar items:** Each agent row shows: name, current-period gross, current-period net, paid/unpaid badge. Sorted by gross descending.
3. **Agent selection:** Click an agent to load their history. Right side shows last 4 pay period cards with that agent's entries only.
4. **Pay card content:** Each period card is identical to the existing `AgentPayCard` component -- collapsible entries, bonus/fronted/hold inputs, approve/unapprove, print, mark paid.
5. **Load More:** Button below the 4 cards loads 4 more historical periods. No infinite scroll.
6. **Search/filter:** Text input at top of sidebar filters agent list by name.
7. **Coexistence:** The existing period-first view should remain accessible (toggle or tab) for users who prefer seeing all agents in one period.

### Rolling Audit Window Expected Behavior

1. **Default load:** When no date range is selected and no cursor is provided, fetch the 30 most recent audits ordered by `callDate desc`, regardless of when they occurred.
2. **Date range override:** When a user selects a date range, use the existing time-based filtering (unchanged).
3. **Cursor pagination:** When user scrolls/clicks "Load More," cursor pagination continues from where the initial 30 left off (unchanged).
4. **Net effect:** Slow days show the last 30 audits (may span multiple days). Busy days show the last 30 audits (may be from the last few hours). Consistent density.

## Sources

- Codebase analysis of existing implementations (HIGH confidence -- direct code inspection)
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` -- current chargeback parser and submission flow
- `apps/ops-api/src/routes/chargebacks.ts` -- chargeback API with batch submission and auto-matching
- `apps/ops-api/src/routes/call-audits.ts` -- current 24-hour default window logic (lines 44-52)
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` -- current AgentPayCard and period-first layout
- `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSection.tsx` -- current collapsed-by-default state (line 75)
- `apps/ops-api/src/routes/lead-timing.ts` -- sparklines endpoint with 7-day series generation
- `apps/ops-api/src/services/__tests__/commission.test.ts` -- enrollment fee halving test cases (COMM-08 series)

---
*Feature research for: v2.1 Chargeback Processing, Payroll Layout & Dashboard Polish*
*Researched: 2026-04-06*
