---
phase: 18-platform-polish-integration
plan: 03
subsystem: payroll
tags: [payroll, toggle, enrollment, ux]
dependency_graph:
  requires: []
  provides: [period-guard-mark-unpaid, enrollment-badge, clean-sale-rows]
  affects: [payroll-dashboard, ops-api]
tech_stack:
  added: []
  patterns: [period-status-guard, enrollment-constant-extraction]
key_files:
  created: []
  modified:
    - apps/ops-api/src/routes/index.ts
    - apps/ops-api/src/services/payroll.ts
    - apps/payroll-dashboard/app/page.tsx
decisions:
  - Enrollment threshold is 125 (not 124 as plan suggested) -- matched actual server logic
  - Bonus/fronted/hold removed from sale rows but kept editable on agent card header
metrics:
  duration: 5m
  completed: "2026-03-18T21:45:14Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 18 Plan 03: Payroll UX Fixes Summary

Bidirectional paid/unpaid toggle with OPEN-period guard, sale row cleanup removing bonus/fronted/hold columns, and +10 enrollment badge for qualifying fees.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | fbe9357 | feat(18-03): add period status guard on mark-unpaid route and extract enrollment constants |
| 2 | ceaf63d | feat(18-03): payroll dashboard bidirectional toggle, card cleanup, enrollment badge |

## Task Results

### Task 1: Period guard on mark-unpaid route + enrollment fee constant extraction

- Added period status check before allowing un-pay: queries payrollEntry and servicePayrollEntry for their payrollPeriod.status
- Returns 400 with descriptive error if any entry belongs to LOCKED or FINALIZED period
- Extracted `ENROLLMENT_BONUS_THRESHOLD = 125` and `ENROLLMENT_BONUS_AMOUNT = 10` as named exports from payroll.ts
- Updated `applyEnrollmentFee` to use the exported constants instead of magic numbers

### Task 2: Payroll dashboard UI changes

- **Bidirectional toggle (PAY-01):** When all entries are PAID and period is OPEN, button shows "Mark Unpaid". When period is LOCKED/FINALIZED, button is disabled with tooltip "Cannot unpay a closed period". Error responses from the API (period guard) are displayed via alert.
- **Edit button (PAY-02):** Already existed as Edit button in EditableSaleRow component -- no changes needed.
- **Card cleanup (PAY-03):** Removed Bonus, Fronted, and Hold columns from the sale row table. These fields remain editable on the agent card header as aggregate inputs. Subtotal row simplified to show Commission and Net only.
- **Enrollment badge (PAY-04):** Added `ENROLLMENT_BADGE` styled span showing "+10" next to enrollment fees >= $125. Uses `C.warningBg` and `C.warning` colors with pill styling (borderRadius 9999).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Enrollment threshold value corrected**
- **Found during:** Task 1
- **Issue:** Plan referenced $124 as enrollment bonus threshold, but actual server logic uses `fee >= 125` (i.e., $125+)
- **Fix:** Used 125 as the threshold to match existing server behavior
- **Files modified:** apps/ops-api/src/services/payroll.ts, apps/payroll-dashboard/app/page.tsx

**2. [Rule 3 - Blocking] Edit button already existed**
- **Found during:** Task 2
- **Issue:** Plan asked to add edit button per sale row, but EditableSaleRow already has a pencil Edit button wired to inline editing
- **Fix:** No changes needed -- functionality already complete
- **Files modified:** None

## Verification

- `cd apps/ops-api && npx tsc --noEmit` -- pre-existing errors only (bcryptjs types, rootDir), none from our changes
- `cd apps/payroll-dashboard && npx tsc --noEmit` -- passes clean
- mark-unpaid route has period status check for both payrollEntry and servicePayrollEntry
- Enrollment threshold consistent at 125 between API and frontend

## Self-Check: PASSED

All files exist. All commits verified.
