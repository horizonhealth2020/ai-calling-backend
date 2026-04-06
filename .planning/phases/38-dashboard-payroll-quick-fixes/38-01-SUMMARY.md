---
phase: 38-dashboard-payroll-quick-fixes
plan: 01
subsystem: api
tags: [prisma, express, sparkline, audit]

requires: []
provides:
  - Count-based rolling window audit query (no 24-hour default)
  - ISO date normalization for sparkline map keys
  - Frontend audit limit of 30
affects: [manager-dashboard]

tech-stack:
  added: []
  patterns: [toISODate helper for date normalization]

key-files:
  created: []
  modified:
    - apps/ops-api/src/routes/call-audits.ts
    - apps/ops-api/src/routes/lead-timing.ts
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx

key-decisions:
  - "Removed 24-hour default window entirely rather than extending it — count-based windowing via orderBy+take is sufficient"
  - "Added toISODate helper that handles Date objects, ISO strings, and long date strings for robustness"

patterns-established:
  - "toISODate: normalize SQL date results before using as map keys"

requirements-completed: [DASH-01, DASH-02, DASH-04]

duration: 5min
completed: 2026-04-06
---

# Plan 38-01: Audit Rolling Window & Sparkline Date Fix Summary

**Removed 24-hour audit default window and fixed sparkline date key format mismatch so audits always show recent data and sparklines render correctly**

## Performance

- **Duration:** 5 min
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Audit endpoint returns last N audits without time restriction on initial load
- Per-agent filter returns last N audits for that agent without time restriction
- Sparkline date keys use ISO format (YYYY-MM-DD) matching the days array
- Frontend requests 30 audits per page

## Task Commits

1. **Task 1: Remove 24-hour default and fix sparkline date keys** - `6b2ef31` (fix)
2. **Task 2: Update frontend audit limit from 25 to 30** - `c3b98b4` (fix)

## Files Created/Modified
- `apps/ops-api/src/routes/call-audits.ts` - Removed else-if block that created 24-hour default window
- `apps/ops-api/src/routes/lead-timing.ts` - Added toISODate helper for sparkline date key normalization
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx` - Limit bumped from 25 to 30

## Decisions Made
- Removed 24-hour default entirely — orderBy + take provides count-based windowing

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Audit and sparkline bugs resolved, ready for verification

---
*Phase: 38-dashboard-payroll-quick-fixes*
*Completed: 2026-04-06*
