---
phase: 10-sale-status-payroll-logic
plan: 01
subsystem: database, api
tags: [prisma, postgresql, zod, commission, payroll, enum-migration]

requires:
  - phase: 02-commission-engine
    provides: calculateCommission and upsertPayrollEntryForSale functions
provides:
  - SaleStatus enum with RAN/DECLINED/DEAD values
  - ChangeRequestStatus enum (PENDING/APPROVED/REJECTED)
  - StatusChangeRequest model with sale/user relations
  - Commission gating on sale status in upsertPayrollEntryForSale
  - Updated POST/PATCH sale route schemas
  - Wave 0 test stubs for status-commission and status-change
affects: [10-sale-status-payroll-logic, payroll-dashboard, manager-dashboard]

tech-stack:
  added: []
  patterns:
    - "Status-gated commission: sale.status === 'RAN' check before calculateCommission"
    - "Manual SQL enum migration with CASE-based value mapping"

key-files:
  created:
    - prisma/migrations/20260315_sale_status_replacement/migration.sql
    - apps/ops-api/src/services/__tests__/status-commission.test.ts
    - apps/ops-api/src/services/__tests__/status-change.test.ts
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/routes/index.ts

key-decisions:
  - "All existing sales migrate to RAN (not REJECTED->DEAD) per user decision"
  - "Commission gate in upsertPayrollEntryForSale, not calculateCommission (keeps calc pure)"
  - "POST /api/sales requires explicit status (no default) so managers must choose"
  - "PATCH /api/sales/:id no longer accepts status (moved to dedicated endpoint in Plan 02)"

patterns-established:
  - "Status gate pattern: check sale.status before commission calculation"
  - "Enum replacement via manual SQL migration with type rename strategy"

requirements-completed: [STATUS-01, STATUS-02, STATUS-03]

duration: 3min
completed: 2026-03-15
---

# Phase 10 Plan 01: Schema & Commission Gate Summary

**SaleStatus enum replaced (RAN/DECLINED/DEAD), StatusChangeRequest model added, commission gated to $0 for non-RAN sales**

## Performance

- **Duration:** 3 min (192s)
- **Started:** 2026-03-15T16:46:33Z
- **Completed:** 2026-03-15T16:49:45Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Replaced SaleStatus enum from SUBMITTED/APPROVED/REJECTED/CANCELLED to RAN/DECLINED/DEAD with migration SQL
- Added StatusChangeRequest model with full relations to Sale and User
- Commission gated to $0 for DECLINED/DEAD sales in upsertPayrollEntryForSale
- POST /api/sales now requires explicit status selection (no default)
- PATCH /api/sales/:id no longer accepts status field
- Wave 0 test stubs created (14 todo tests across 2 files)

## Task Commits

Each task was committed atomically:

1. **Task 0: Create Wave 0 test stub files** - `fbd0fd6` (test)
2. **Task 1: Prisma schema update and manual migration SQL** - `b026934` (feat)
3. **Task 2: Commission gating in payroll service and route updates** - `7403098` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Updated SaleStatus enum, added ChangeRequestStatus enum and StatusChangeRequest model
- `prisma/migrations/20260315_sale_status_replacement/migration.sql` - Manual SQL migration mapping all old statuses to RAN
- `apps/ops-api/src/services/payroll.ts` - Commission gate: $0 for non-RAN sales
- `apps/ops-api/src/routes/index.ts` - POST requires RAN/DECLINED/DEAD, PATCH drops status field
- `apps/ops-api/src/services/__tests__/status-commission.test.ts` - 6 todo test stubs for commission gating
- `apps/ops-api/src/services/__tests__/status-change.test.ts` - 8 todo test stubs for status change workflow

## Decisions Made
- All existing sales migrate to RAN per user decision (not REJECTED->DEAD or CANCELLED->DEAD)
- Commission gate lives in upsertPayrollEntryForSale, keeping calculateCommission as a pure math function
- POST /api/sales has no default for status -- manager must explicitly choose RAN/DECLINED/DEAD
- Status removed from PATCH /api/sales/:id -- dedicated status change endpoint coming in Plan 02

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema foundation complete for status-driven commission
- Migration SQL ready for deployment (maps all existing sales to RAN)
- Test stubs ready to be filled in by Plan 02
- StatusChangeRequest model ready for the approval workflow endpoint in Plan 02

## Self-Check: PASSED

All 7 files verified present. All 3 commit hashes verified in git log.

---
*Phase: 10-sale-status-payroll-logic*
*Completed: 2026-03-15*
