---
phase: 05-commission-preview-sale-editing
plan: 03
subsystem: ui
tags: [react, payroll, sale-edit-requests, approval-workflow, field-diff]

requires:
  - phase: 05-commission-preview-sale-editing
    provides: "Sale edit request API endpoints (Plan 01)"
provides:
  - "Pending sale edit request display in payroll dashboard with approve/reject workflow"
  - "Field-by-field diff rendering for edit requests"
  - "Badge-type distinction between status change and edit requests"
affects:
  - "apps/payroll-dashboard/app/page.tsx"

tech-stack:
  added: []
  patterns:
    - "Edit request rows with teal badge alongside status change rows with blue badge"
    - "Field diff rendering with old (line-through) and new (bold) values"
    - "Commission diff uses green for increase, red for decrease"

key-files:
  created: []
  modified:
    - "apps/payroll-dashboard/app/page.tsx"

key-decisions:
  - "Edit requests rendered in same amber Pending Approvals section as status changes, grouped by agentId"
  - "Teal badge for Edit Request, blue badge for Status Change to distinguish types visually"
  - "Combined count badge includes both request types"
  - "Finalized period approval shows window.confirm about adjustment entry creation"

patterns-established:
  - "Sale edit request approval follows same pattern as status change request approval"
  - "Badge-type distinction pattern for mixed request types in approval sections"

requirements-completed: [SALE-06]

duration: ~2min
completed: 2026-03-15
---

# Phase 5 Plan 03: Payroll Edit Request Approval Summary

**Sale edit request approval workflow in payroll dashboard with field diffs, approve/reject actions, finalized period confirmation, and badge-type distinction from status changes**

## Performance

- **Duration:** ~2 min
- **Tasks:** 1/1
- **Files modified:** 1

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `9d590f0` | Payroll dashboard sale edit request approval workflow |

## What Was Built

### SaleEditRequest Type and State
- Added `SaleEditRequest` type with `changes: Record<string, { old: any; new: any }>` for field diffs
- Added `pendingEditRequests`, `approvingEditId`, `rejectingEditId` state variables

### Data Fetching
- Parallel fetch of `/api/sale-edit-requests?status=PENDING` alongside status change requests in initial `Promise.all`
- Dedicated `refreshPendingEditRequests()` function for post-action refresh

### Approve/Reject Handlers
- `approveEditRequest(requestId, saleInFinalized?)` with `window.confirm` for finalized period edits
- `rejectEditRequest(requestId)` with confirmation dialog before rejecting
- Both handlers follow existing pattern: optimistic filter, error alert with status code, loading state

### Pending Approvals UI
- Edit requests rendered alongside status change requests in amber Pending Approvals section per agent
- Combined count badge shows total of both request types
- Teal "Edit Request" badge (`rgba(20,184,166,0.1)`) distinguishes from blue "Status Change" badge (`rgba(96,165,250,0.1)`)
- Field-by-field diff: old value with line-through, new value bolded, commission diffs color-coded (green increase, red decrease)
- "Approve Edit" button with `#059669` green background, "Reject Edit" with danger-tinted background

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
