---
phase: 19-dashboard-consolidation-uniform-date-ranges
plan: 02
subsystem: ui, auth, api
tags: [date-range, jwt, shared-packages, backward-compatible]

requires:
  - phase: none
    provides: existing DateRangeFilter, auth client, dateRange utility
provides:
  - Configurable DateRangeFilter with presets prop and KPI_PRESETS constant
  - Exported decodeTokenPayload from @ops/auth/client
  - Server dateRange() last_week case for previous Sun-Sat boundaries
affects: [19-03, 19-04, 19-05, 19-06, 19-07, 19-08]

tech-stack:
  added: []
  patterns: [configurable-presets-with-default-fallback]

key-files:
  created: []
  modified:
    - packages/ui/src/components/DateRangeFilter.tsx
    - packages/ui/src/components/index.ts
    - packages/auth/src/client.ts
    - apps/ops-api/src/routes/index.ts

key-decisions:
  - "DEFAULT_PRESETS renamed from presets for clarity; KPI_PRESETS exported separately"
  - "decodeTokenPayload return type widened to Record<string, any> for full payload access"

patterns-established:
  - "Configurable presets pattern: component accepts optional presets array with default fallback"

requirements-completed: [DR-01]

duration: 3min
completed: 2026-03-19
---

# Phase 19 Plan 02: Shared Package Updates Summary

**Configurable DateRangeFilter with KPI_PRESETS, exported decodeTokenPayload, and server last_week date range support**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T19:05:00Z
- **Completed:** 2026-03-19T19:08:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- DateRangeFilter now accepts configurable presets prop with backward-compatible DEFAULT_PRESETS fallback
- KPI_PRESETS exported for unified dashboard use (week, last_week, 30d, custom)
- decodeTokenPayload publicly exported from @ops/auth/client with full payload return type
- Server dateRange() handles last_week computing previous Sunday-to-Saturday boundaries

## Task Commits

Each task was committed atomically:

1. **Task 1: Add configurable presets to DateRangeFilter and export KPI_PRESETS** - `49a3b23` (feat)
2. **Task 2: Export decodeTokenPayload and add last_week to server dateRange** - `c7741f2` (feat)

## Files Created/Modified
- `packages/ui/src/components/DateRangeFilter.tsx` - Added presets prop, DEFAULT_PRESETS, KPI_PRESETS export
- `packages/ui/src/components/index.ts` - Added KPI_PRESETS to barrel export
- `packages/auth/src/client.ts` - Exported decodeTokenPayload with widened return type
- `apps/ops-api/src/routes/index.ts` - Added last_week case to dateRange() utility

## Decisions Made
- Renamed hard-coded `presets` to `DEFAULT_PRESETS` for clarity when multiple preset arrays exist
- Widened decodeTokenPayload return type to `Record<string, any>` to expose full JWT payload (id, email, name, roles, exp) without changing implementation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Shared packages updated and backward-compatible, ready for dashboard migration plans (19-03 through 19-08)
- KPI_PRESETS available for import by unified dashboard
- decodeTokenPayload ready for client-side role decoding
- Server dateRange() ready to handle last_week requests from new dashboard

---
*Phase: 19-dashboard-consolidation-uniform-date-ranges*
*Completed: 2026-03-19*

## Self-Check: PASSED
