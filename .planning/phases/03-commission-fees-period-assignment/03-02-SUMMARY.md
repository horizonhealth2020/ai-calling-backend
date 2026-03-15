---
phase: 03-commission-fees-period-assignment
plan: 02
subsystem: api
tags: [luxon, timezone, payroll, period-assignment, ach, zod]

requires:
  - phase: 02-commission-engine-core
    provides: getSundayWeekRange function and upsertPayrollEntryForSale
provides:
  - Luxon-based Eastern timezone period assignment in getSundayWeekRange
  - ACH +1 week period shift via shiftWeeks parameter
  - paymentType required on sale creation API
  - Backfill migration for null payment_type records
affects: [payroll-dashboard, manager-dashboard, commission-preview]

tech-stack:
  added: [luxon DateTime for timezone conversion]
  patterns: [Eastern timezone day-of-week determination, UTC midnight Date output for period IDs]

key-files:
  created:
    - apps/ops-api/src/services/__tests__/period-assignment.test.ts
    - prisma/migrations/20260315000001_backfill_payment_type/migration.sql
  modified:
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/routes/index.ts

key-decisions:
  - "Luxon America/New_York used only for day-of-week determination; output remains UTC midnight Date objects to preserve period ID format"
  - "shiftWeeks default=0 makes ACH shift opt-in and backward compatible"
  - "Backfill null payment_type to CC (not ACH) since CC is the common case and preserves existing period assignments"

patterns-established:
  - "Timezone-sensitive period logic: convert to Eastern, determine weekday, output UTC midnight dates"
  - "Payment type shift pattern: shiftWeeks parameter on getSundayWeekRange for future extensibility"

requirements-completed: [PAYR-01, COMM-10]

duration: 3min
completed: 2026-03-15
---

# Phase 3 Plan 2: Period Assignment & ACH Shift Summary

**Luxon Eastern timezone period assignment with ACH +1 week shift, paymentType required on sale creation, and null backfill migration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-15T01:07:13Z
- **Completed:** 2026-03-15T01:09:50Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Refactored getSundayWeekRange to use Luxon America/New_York timezone, fixing midnight UTC boundary errors
- Added ACH +1 week period shift via shiftWeeks parameter with 7 passing tests (4 PAYR-01 + 3 COMM-10)
- Made paymentType required on sale creation Zod schema
- Created backfill migration to set null payment_type records to CC

## Task Commits

Each task was committed atomically:

1. **Task 1: Period assignment tests (RED)** - `ca307f9` (test)
2. **Task 1: Luxon refactor + ACH shift (GREEN)** - `eb44c19` (feat)
3. **Task 2: paymentType required + backfill migration** - `cddc2fd` (feat)

## Files Created/Modified
- `apps/ops-api/src/services/payroll.ts` - Refactored getSundayWeekRange to Luxon Eastern timezone with shiftWeeks parameter; upsertPayrollEntryForSale passes shiftWeeks=1 for ACH
- `apps/ops-api/src/services/__tests__/period-assignment.test.ts` - 7 tests covering PAYR-01 (timezone + DST) and COMM-10 (ACH shift)
- `apps/ops-api/src/routes/index.ts` - paymentType changed from optional to required in sale creation schema
- `prisma/migrations/20260315000001_backfill_payment_type/migration.sql` - Backfill null payment_type to CC

## Decisions Made
- Luxon used only for day-of-week determination in Eastern time; output remains UTC midnight Date objects to preserve existing period ID format compatibility
- shiftWeeks defaults to 0, making the ACH shift backward compatible with all existing callers
- Null payment_type backfilled to CC (not ACH) since CC is the common case and avoids retroactively shifting existing period assignments

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Period assignment and ACH shift logic complete and tested
- paymentType enforcement ready for production after running backfill migration
- Ready for remaining Phase 3 plans (if any) or Phase 4

---
*Phase: 03-commission-fees-period-assignment*
*Completed: 2026-03-15*
