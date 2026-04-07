---
phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no
plan: 05
subsystem: payroll
tags: [carryover, timezone, luxon, jest, payroll, dst]

# Dependency graph
requires:
  - phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no
    provides: "reverseCarryover (45-02) which keys off carryoverSourcePeriodId and inherits the next-period fix automatically"
provides:
  - "Timezone-safe next-period computation in executeCarryover (weekStart + 7d12h)"
  - "Safety assertion preventing carryover from ever writing to source period"
  - "CARRY-11 regression test covering the EDT/UTC day-rollover boundary"
affects: [payroll-lock, carryover, fronted-hold, clawback]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Offset-from-weekStart pattern (+7d12h) to pin intra-week UTC timestamps inside the target Eastern week across EDT/EST"
    - "Post-compute invariant assertion on nextPeriodId !== sourcePeriodId as regression tripwire"

key-files:
  created: []
  modified:
    - apps/ops-api/src/services/carryover.ts
    - apps/ops-api/src/services/__tests__/carryover.test.ts

key-decisions:
  - "Derive nextDay from period.weekStart + (7*24+12)h rather than period.weekEnd + 24h to avoid getSundayWeekRange returning the source week when Luxon converts UTC midnight Sunday to Saturday 8pm Eastern"
  - "Add a runtime safety assertion that throws when nextPeriodId === sourcePeriodId, so any future regression in getSundayWeekRange surfaces loudly instead of silently corrupting payroll"
  - "Skip optional CARRY-12 spy test; the safety assertion + CARRY-11 already cover the regression surface and spying on a const-exported helper adds fragility"

patterns-established:
  - "When computing next-week boundaries from a UTC-stored Sunday, offset by 7d12h (noon UTC of target Sunday) so the Eastern conversion lands after midnight local time"
  - "Guard carryover/cross-period writes with an assertion that destination id differs from source id"

requirements-completed: [BUGFIX-45-CARRYOVER]

# Metrics
duration: ~12min
completed: 2026-04-07
---

# Phase 45 Plan 05: Carryover Next-Period Timezone Fix Summary

**Fixed first-lock fronted-hold carryover so it lands on the NEXT payroll period by computing nextDay from weekStart + 7d12h (DST/UTC-rollover safe) and added CARRY-11 regression test**

## Performance

- **Duration:** ~12 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Root-caused UAT Test 2 failure to UTC-midnight-Saturday -> Luxon Eastern conversion collapsing "next day" back into the source week
- Replaced `weekEnd + 86400000` with `weekStart + (7*24+12)*3600*1000` — one definitive offset covering EDT and EST
- Added runtime safety assertion (`nextPeriodId === periodId` -> throw) so any future helper regression fails loud instead of silently misrouting holds
- Added CARRY-11 regression test exercising the real 2026-03-29 EDT boundary; proves upsert targets 2026-04-05 next period id, not source id
- Confirmed reverseCarryover needed no change (it keys off carryoverSourcePeriodId back-pointer, inherits fix automatically)

## Task Commits

1. **Task 1: Fix next-period selection in executeCarryover** - `ae4c368` (fix)
2. **Task 2: Add CARRY-11 regression test** - `356d348` (test)

## Files Created/Modified
- `apps/ops-api/src/services/carryover.ts` - Replaced 4-line next-period computation with weekStart + 7d12h offset + safety assertion; reverseCarryover untouched
- `apps/ops-api/src/services/__tests__/carryover.test.ts` - Added CARRY-11 describe/it block seeding sourceId=2026-03-29..2026-04-04 and asserting next-period upsert targets 2026-04-05..2026-04-11

## Decisions Made
- Chose +7d12h (noon UTC of next Sunday) over +7d1h or +7d5h so the result is robustly inside the next Eastern week during both EDT (UTC-4) and EST (UTC-5) without tempting future devs to shave the margin
- Kept safety assertion as a `throw` rather than a log-only warning — payroll correctness is higher priority than availability; a loud failure is better than a silent mis-route
- Declined optional CARRY-12 spy test: the existing mocks do not isolate the getSundayWeekRange import for jest.spyOn, and the runtime assertion + real-timezone CARRY-11 already cover the regression surface without adding fragile module-internal spies

## Deviations from Plan

None - plan executed exactly as written. The optional CARRY-12 spy test was explicitly marked "skip and document in Deviations if spyOn is not straightforward" in the plan; it is noted in Decisions above.

## Issues Encountered

- The untracked plan files (45-04/05/06-PLAN.md) only exist in the main working tree, not in the agent worktree filesystem snapshot. Execution proceeded in the main repo path where the plan lived. No impact on deliverables.

## Verification Results

- `npx tsc --noEmit` — no carryover.ts errors
- `npx jest src/services/__tests__/carryover.test.ts` — 11/11 passing including CARRY-11
- All 6 Task 1 acceptance greps pass (GAP-45-05 marker, weekStart.getTime, no old formulation, NEXT_PERIOD_OFFSET_MS x2, assertion x1)
- All 3 Task 2 acceptance checks pass (CARRY-11 marker x2, next-period literal x1, test suite green)

## Next Phase Readiness
- Path B (first-lock) now writes Fronted Hold to the correct next period
- Path A (lock -> unlock -> edit -> re-lock) is end-to-end correct because reverseCarryover (45-02) was already right
- Ready for manual UAT re-run of Test 2: lock period with FRONTED=200, verify HOLD=200 on next period only

## Self-Check: PASSED

- FOUND: apps/ops-api/src/services/carryover.ts (GAP-45-05 marker present)
- FOUND: apps/ops-api/src/services/__tests__/carryover.test.ts (CARRY-11 present)
- FOUND commit: ae4c368 (fix Task 1)
- FOUND commit: 356d348 (test Task 2)

---
*Phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no*
*Completed: 2026-04-07*
