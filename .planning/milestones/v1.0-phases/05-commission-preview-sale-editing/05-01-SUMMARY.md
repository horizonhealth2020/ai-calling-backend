---
phase: 05-commission-preview-sale-editing
plan: 01
subsystem: ops-api
tags: [commission-preview, sale-editing, approval-workflow, prisma-schema]

requires:
  - phase: 03-commission-engine-fees-arrears
    provides: calculateCommission, getSundayWeekRange, upsertPayrollEntryForSale
  - phase: 10-sale-status-payroll-logic
    provides: StatusChangeRequest pattern, ChangeRequestStatus enum
provides:
  - SaleEditRequest model with JSON diff storage and approval workflow
  - POST /api/sales/preview endpoint for commission calculation without DB writes
  - Role-aware PATCH /api/sales/:id (MANAGER creates request, PAYROLL/SUPER_ADMIN applies directly)
  - Sale edit request CRUD with approve/reject endpoints
  - handleSaleEditApproval for finalized period adjustments
affects: [ops-api, payroll-dashboard, manager-dashboard]

tech-stack:
  added: []
  patterns:
    - "JSON field diff storage for edit requests: { field: { old, new } }"
    - "Role-branched PATCH endpoint (MANAGER vs PAYROLL/SUPER_ADMIN)"

key-files:
  created:
    - prisma/migrations/20260315_sale_edit_requests/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/routes/index.ts
    - apps/ops-api/src/services/payroll.ts

key-decisions:
  - "SaleEditRequest mirrors StatusChangeRequest pattern with JSON changes field for arbitrary field diffs"
  - "MANAGER PATCH creates edit request; PAYROLL/SUPER_ADMIN applies directly in transaction"
  - "409 conflict returned when pending StatusChangeRequest or SaleEditRequest exists on MANAGER edit"
  - "handleSaleEditApproval handles finalized period adjustments with CLAWBACK_APPLIED pattern"
  - "Preview endpoint builds mock SaleWithProduct and calls calculateCommission directly (no DB writes)"

patterns-established:
  - "Role-branched mutation endpoints"
  - "JSON diff-based edit request workflow"

requirements-completed: [SALE-05, SALE-06]

duration: 207s
completed: 2026-03-15
---

# Phase 5 Plan 1: Commission Preview & Sale Edit Backend Summary

**Backend API for commission preview and role-aware sale editing with SaleEditRequest approval workflow, JSON field diffs, and finalized period handling**

## Performance

- **Duration:** ~207s
- **Tasks:** 2/2 completed
- **Files modified:** 4 (schema, migration, routes, payroll service)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | f14627d | SaleEditRequest schema, migration, preview endpoint, handleSaleEditApproval |
| 2 | a098ab9 | Extended PATCH with role branching, sale-edit-request CRUD, approve/reject |

## What Was Built

### Task 1: Schema + Migration + Preview + handleSaleEditApproval
- **SaleEditRequest model** in Prisma schema with `changes Json` field, `ChangeRequestStatus`, sale/requester/reviewer relations
- **Migration SQL** for `sale_edit_requests` table with indexes and FK constraints
- **POST /api/sales/preview** endpoint that accepts product/financial fields, builds mock SaleWithProduct, calls `calculateCommission()` directly, returns commission amount with period info and breakdown
- **handleSaleEditApproval** exported from payroll.ts -- handles finalized period adjustments by clawing back old entry and recalculating via upsertPayrollEntryForSale

### Task 2: Extended PATCH + CRUD + Approve/Reject
- **PATCH /api/sales/:id** extended to accept all sale fields (saleDate, agentId, productId, addonProductIds, paymentType, etc.) with role branching:
  - PAYROLL/SUPER_ADMIN: apply changes directly in transaction, recalculate commission
  - MANAGER: build JSON diff, create SaleEditRequest, return 409 if pending requests exist
- **GET /api/sales/:id** returns full sale with addons and pending request flags
- **GET /api/sale-edit-requests** with status filter for payroll approval queue
- **POST /api/sale-edit-requests/:id/approve** applies field changes and addon updates in transaction, handles finalized periods
- **POST /api/sale-edit-requests/:id/reject** marks request rejected with reviewer info
- **GET /api/sales** now includes `hasPendingEditRequest` flag
- **Sale delete** transaction updated to clean up saleEditRequests

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `npx prisma validate` passes
- All route patterns present in routes/index.ts
- handleSaleEditApproval exported from payroll.ts

## Self-Check: PASSED

All 5 files found. Both commits (f14627d, a098ab9) verified in git log.
