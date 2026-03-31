# Phase 35: Fix KPI Polling Issues and Manager Dashboard Features - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the Convoso KPI poller timezone bug that delays polling start, add "Today" as a date range preset across dashboards, remove the redundant Today column from Manager Tracker, scope date range state per dashboard instead of globally, and fix CS round robin assignment fairness. No new capabilities — all items are bug fixes or adjustments to existing features.

</domain>

<decisions>
## Implementation Decisions

### KPI Poller Timezone Fix
- **D-01:** The business hours check in `convosoKpiPoller.ts:316` must use `America/New_York` instead of `America/Los_Angeles`. Business hours settings (09:00-18:00) are entered as Eastern time. The poller was comparing Pacific time against Eastern hours, causing a 3-hour delay before polling starts.
- **D-02:** `convosoDateToUTC()` stays as-is — Convoso genuinely returns timestamps in `America/Los_Angeles`. These are two separate concerns: ingesting Convoso data (Pacific) vs. checking when business operates (Eastern).
- **D-03:** No timezone setting UI needed — hardcode `America/New_York` to match payroll.ts, auditQueue.ts, and lead-timing.ts which all use the same timezone.

### "Today" Date Range Preset
- **D-04:** Add `{ key: "today", label: "Today" }` as the first entry in `KPI_PRESETS` in `packages/ui/src/components/DateRangeFilter.tsx`. New order: Today, Current Week, Last Week, 30 Days, Custom.
- **D-05:** The API `buildDateParams()` helper in each dashboard must handle the `"today"` preset key — generate date range for current day in Eastern time.

### Remove Today Column from Manager Tracker
- **D-06:** Remove the "Today" column (todaySalesCount, todayPremium) from the Manager Tracker table in `ManagerTracker.tsx`. This column is redundant once "Today" is a date range filter preset.
- **D-07:** Remove the Today columns from the CSV export header row as well.

### Owner KPIs Default to Today
- **D-08:** Owner dashboard Performance Overview (`OwnerKPIs.tsx`) should default to the "Today" preset instead of "Current Week".

### Date Range Scoped Per Dashboard
- **D-09:** The global `DateRangeProvider` in `layout.tsx:188` causes custom date ranges to persist across Manager/Owner/CS tabs. Each dashboard should manage its own date range state independently.
- **D-10:** Either move `DateRangeProvider` inside each dashboard page, or use a keyed/scoped approach so switching tabs resets the range to that dashboard's default. Manager Tracker defaults to "Today", Owner KPIs defaults to "Today", CS and other dashboards keep "Current Week" default.

### CS Round Robin Fairness
- **D-11:** Investigate and fix the round robin assignment in `repSync.ts`. The `batchRoundRobinAssign` function advances the index correctly in theory, but assignments appear uneven in practice. Check: (a) whether the persisted index gets out of sync when reps are added/removed, (b) whether the local fallback in `CSSubmissions.tsx:441-444` bypasses the server-side round robin, (c) whether multiple rapid submissions race on the same index.

### Claude's Discretion
- Exact implementation of per-dashboard date range scoping (separate providers vs. keyed context vs. local useState)
- Whether to extract a shared `BUSINESS_TIMEZONE` constant for use across poller, payroll, audit queue, and lead timing
- Round robin fix approach once root cause is identified

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### KPI Poller
- `apps/ops-api/src/workers/convosoKpiPoller.ts` — Business hours check at line 316 (the bug), convosoDateToUTC at line 13 (correct, don't touch)
- `apps/ops-api/src/services/convosoCallLogs.ts` — fetchConvosoCallLogs, enrichWithTiers, buildKpiSummary

### Timezone Precedents
- `apps/ops-api/src/services/payroll.ts:5` — `TIMEZONE = 'America/New_York'` (the pattern to follow)
- `apps/ops-api/src/services/auditQueue.ts:312-314` — Audit queue uses `America/New_York`
- `apps/ops-api/src/routes/lead-timing.ts:61-76` — SQL queries all convert to `America/New_York`

### Date Range Filter
- `packages/ui/src/components/DateRangeFilter.tsx:58-63` — `KPI_PRESETS` definition
- `apps/ops-dashboard/lib/DateRangeContext.tsx` — Global DateRangeProvider (the scoping bug)
- `apps/ops-dashboard/app/(dashboard)/layout.tsx:188` — Where provider wraps all dashboards

### Manager Tracker
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx` — Today column at lines 68-69, 148, 191-192
- `apps/ops-dashboard/app/(dashboard)/manager/page.tsx` — TrackerEntry type with todaySalesCount/todayPremium

### Owner KPIs
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerKPIs.tsx` — Uses useDateRange() with global default

### CS Round Robin
- `apps/ops-api/src/services/repSync.ts:84-111` — getNextRoundRobinRep
- `apps/ops-api/src/services/repSync.ts:117-151` — batchRoundRobinAssign
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx:433-445` — Client-side fetchBatchAssign with local fallback
- `apps/ops-api/src/routes/cs-reps.ts:107-119` — API routes for round robin

### Owner Config (business hours UI)
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerConfig.tsx:543-564` — Business hours input (no changes needed, hours stay as Eastern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `KPI_PRESETS` in `@ops/ui` — shared preset array used by Manager Tracker, Owner KPIs, CS Tracking
- `DateRangeFilter` component — already supports custom presets array via props
- `useDateRange()` hook — currently global, needs to be scoped per dashboard
- `buildDateParams()` helper — exists in ManagerTracker.tsx and OwnerKPIs.tsx, needs "today" case

### Established Patterns
- Timezone: `America/New_York` is the canonical business timezone across payroll, audit queue, and lead timing
- Convoso data: `America/Los_Angeles` for parsing Convoso timestamps only
- Date range: presets are key-based strings, API receives `range` query param
- Inline React.CSSProperties styling throughout — no Tailwind

### Integration Points
- `KPI_PRESETS` change in `@ops/ui` propagates to all consumers automatically
- `DateRangeContext` removal from layout.tsx requires each dashboard to manage its own state
- TrackerEntry type in manager/page.tsx needs todaySalesCount/todayPremium fields removed
- API tracker/summary endpoint may need adjustment if it currently returns today-specific fields

</code_context>

<specifics>
## Specific Ideas

- User confirmed business hours are entered as Eastern time — the 09:00-18:00 in the DB is EST/EDT
- The poller log from Mar 31, 9:07 AM EDT showed `currentTime: 06:07` (Pacific) with `businessHours: 09:00-18:00` — clear timezone mismatch
- Round robin data showed: Chargebacks — Jasmine (2), Ally (2), Alex (1); Pending terms — Alex (2), Ally (1), Jasmine (1). Investigate whether the local fallback path or index persistence is the cause.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 35-fix-kpi-polling-issues-and-manager-dashboard-features*
*Context gathered: 2026-03-31*
