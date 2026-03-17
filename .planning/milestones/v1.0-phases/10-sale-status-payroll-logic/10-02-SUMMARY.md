---
phase: 10-sale-status-payroll-logic
plan: 02
subsystem: api, payroll
tags: [express, prisma, approval-workflow, commission, status-change]

requires:
  - phase: 10-sale-status-payroll-logic
    plan: 01
    provides: SaleStatus enum, StatusChangeRequest model, commission gate
provides:
  - PATCH /sales/:id/status endpoint with transition rules
  - GET /status-change-requests endpoint
  - POST /status-change-requests/:id/approve and reject endpoints
  - handleCommissionZeroing function for Ran->Dead/Declined transitions
  - Sales board and owner summary filtered to RAN only
  - hasPendingStatusChange boolean on GET /sales
affects: [payroll-dashboard, manager-dashboard, sales-board, owner-dashboard]

tech-stack:
  added: []
  patterns:
    - "Approval workflow: Dead/Declined->Ran requires StatusChangeRequest, approved by PAYROLL/SUPER_ADMIN"
    - "Commission zeroing: ZEROED_OUT for open periods, CLAWBACK_APPLIED for finalized"
    - "Filtered count with _count select and where clause for hasPendingStatusChange"

key-files:
  created: []
  modified:
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/routes/index.ts

key-decisions:
  - "handleCommissionZeroing follows existing clawback pattern (ZEROED_OUT for OPEN, CLAWBACK_APPLIED for finalized)"
  - "Pending change requests auto-cancelled on Ran->Dead/Declined to prevent orphans"
  - "Status change requests explicitly deleted in sale delete transaction for safety"

patterns-established:
  - "Approval workflow pattern: create request -> review -> approve/reject with transaction"
  - "Dashboard query filtering: status=RAN on all leaderboard and KPI aggregations"

requirements-completed: [STATUS-04, STATUS-05, STATUS-06, STATUS-07, STATUS-08]

duration: 3min
completed: 2026-03-15
---

# Phase 10 Plan 02: Status Change API & Approval Workflow Summary

**Four new endpoints for status transitions and approval workflow, commission zeroing for Ran->Dead/Declined, dashboard filtering to RAN-only, hasPendingStatusChange flag on GET /sales**

## Performance

- **Duration:** 3 min (172s)
- **Started:** 2026-03-15T16:53:57Z
- **Completed:** 2026-03-15T16:56:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added handleCommissionZeroing function that zeros open period entries and applies clawback adjustments for finalized periods
- Added PATCH /sales/:id/status with full transition logic: Dead/Declined->Ran creates change request, Ran->Dead/Declined zeroes immediately, Dead<->Declined is free
- Added GET /status-change-requests with status filter and sale/requester includes
- Added POST /status-change-requests/:id/approve with Prisma transaction (update request + sale + recalculate commission)
- Added POST /status-change-requests/:id/reject (sale stays at original status)
- Updated sales-board/summary, sales-board/detailed, and owner/summary to filter to status=RAN only
- Added hasPendingStatusChange boolean to GET /sales response using filtered _count

## Task Commits

Each task was committed atomically:

1. **Task 1: Status change endpoint and commission zeroing** - `f37adb2` (feat)
2. **Task 2: Approval/rejection endpoints, dashboard query filters, and hasPendingStatusChange** - `96571c4` (feat)

## Files Created/Modified
- `apps/ops-api/src/services/payroll.ts` - Added handleCommissionZeroing export function
- `apps/ops-api/src/routes/index.ts` - Added 4 new endpoints, updated 3 dashboard queries, added hasPendingStatusChange to GET /sales, added statusChangeRequest cleanup to sale delete

## Decisions Made
- handleCommissionZeroing follows existing clawback pattern (ZEROED_OUT for OPEN periods, CLAWBACK_APPLIED for finalized/paid)
- Pending change requests auto-cancelled when Ran->Dead/Declined applied (prevents orphaned pending requests)
- StatusChangeRequest deleteMany added to sale delete transaction for explicit cleanup (in addition to DB cascade)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added statusChangeRequest cleanup to sale delete transaction**
- **Found during:** Task 1
- **Issue:** Sale delete transaction didn't clean up StatusChangeRequests (would rely only on DB cascade)
- **Fix:** Added `prisma.statusChangeRequest.deleteMany({ where: { saleId } })` to the delete transaction
- **Files modified:** apps/ops-api/src/routes/index.ts
- **Commit:** f37adb2

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All status change API endpoints operational
- Approval workflow ready for payroll dashboard integration (Plan 03)
- Dashboard queries filtered to RAN-only for accurate leaderboards and KPIs
- hasPendingStatusChange flag ready for manager dashboard "Pending Ran" badge (Plan 04)

## Self-Check: PASSED

All 2 modified files verified present. All 2 commit hashes verified in git log. Key exports (handleCommissionZeroing) and endpoints (status-change-requests, hasPendingStatusChange) confirmed in source.

---
*Phase: 10-sale-status-payroll-logic*
*Completed: 2026-03-15*
