---
phase: 35-fix-kpi-polling-issues-and-manager-dashboard-features
plan: 01
subsystem: api, ui
tags: [luxon, timezone, convoso, kpi, date-range]

# Dependency graph
requires:
  - phase: 24-chargeback-automation-data-archival
    provides: Convoso KPI poller infrastructure
provides:
  - Corrected KPI poller business hours timezone (Eastern)
  - "Today" preset in shared KPI_PRESETS array
affects: [35-02, 35-03, manager-tracker, owner-kpis]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - apps/ops-api/src/workers/convosoKpiPoller.ts
    - packages/ui/src/components/DateRangeFilter.tsx

key-decisions:
  - "Business hours timezone hardcoded to America/New_York matching payroll.ts pattern"
  - "convosoDateToUTC left as America/Los_Angeles — Convoso data is genuinely Pacific"
  - "Today preset added as first KPI_PRESETS entry — API already supports range=today"

patterns-established: []

requirements-completed: [D-01, D-02, D-03, D-04]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 35 Plan 01: KPI Poller Timezone Fix and Today Preset Summary

**Fixed 3-hour KPI poller delay by correcting business hours timezone from Pacific to Eastern, added Today as first date range preset in shared KPI_PRESETS**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T16:42:56Z
- **Completed:** 2026-03-31T16:45:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed KPI poller comparing Pacific time against Eastern business hours (3-hour delay each morning)
- Added "Today" as first entry in shared KPI_PRESETS array for downstream dashboard consumption
- Preserved convosoDateToUTC timezone (America/Los_Angeles) which correctly handles Convoso data

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix KPI poller business hours timezone from Pacific to Eastern** - `fc5518e` (fix)
2. **Task 2: Add "Today" as first entry in KPI_PRESETS** - `89a9a12` (feat)

## Files Created/Modified
- `apps/ops-api/src/workers/convosoKpiPoller.ts` - Changed business hours check from America/Los_Angeles to America/New_York
- `packages/ui/src/components/DateRangeFilter.tsx` - Added { key: "today", label: "Today" } as first KPI_PRESETS entry

## Decisions Made
- Business hours timezone hardcoded to America/New_York matching payroll.ts, auditQueue.ts, lead-timing.ts pattern
- convosoDateToUTC left unchanged at America/Los_Angeles — Convoso genuinely returns Pacific timestamps
- Today preset placed first in array — API already supports range=today via buildDateParams helper

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- KPI_PRESETS now includes "Today" — Plan 02 can consume it for Manager Tracker and Owner KPIs
- Poller will start polling at correct Eastern business hours

---
*Phase: 35-fix-kpi-polling-issues-and-manager-dashboard-features*
*Completed: 2026-03-31*
