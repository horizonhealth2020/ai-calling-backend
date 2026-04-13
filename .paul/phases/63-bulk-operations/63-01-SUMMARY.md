---
phase: 63-bulk-operations
plan: 01
subsystem: api, ui
tags: [express, zod, react, payroll, batch-operations]

requires:
  - phase: 62-caching-layer
    provides: invalidateAll() cache invalidation
provides:
  - POST /api/payroll/batch-approve-commission endpoint
  - Multi-select checkbox UI for commission approval on payroll tab
  - Floating action bar for batch commission approval
affects: [64-polish-exports]

tech-stack:
  added: []
  patterns: [batch-then-confirm, partial-failure-tracking]

key-files:
  created: []
  modified:
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx

key-decisions:
  - "Checkboxes only on entries needing approval, not all entries"
  - "No batch mark-paid — mark-paid is a per-week action"

patterns-established:
  - "Batch-then-confirm: checkboxes → floating bar → ConfirmModal → toast"
  - "Partial failure tracking: per-item try/catch with approved/failed response"

duration: ~25min
started: 2026-04-13
completed: 2026-04-13
---

# Phase 63 Plan 01: Batch Commission Approval Summary

**Batch commission approval API + multi-select checkboxes on payroll tab — select entries needing approval, one confirm, one toast.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~25min |
| Started | 2026-04-13 |
| Completed | 2026-04-13 |
| Tasks | 3 completed (2 auto + 1 checkpoint) |
| Files modified | 4 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Batch commission approval API | Pass | Endpoint with Zod, upsert per sale, single audit + invalidation |
| AC-1b: Validates saleIds exist | Pass | Pre-check with findMany, 400 on missing |
| AC-1c: Partial failure handling | Pass | Per-sale try/catch, response includes approved/failed counts |
| AC-2: Role-gated | Pass | PAYROLL + SUPER_ADMIN only |
| AC-3: Multi-select checkboxes | Pass (narrowed) | Checkboxes only on entries needing approval |
| AC-4: Select All per week | Pass (narrowed) | Toggles only approval-needing entries |
| AC-5: Batch approve via bar | Pass | ConfirmModal → toast → clear selection → refresh |
| AC-6: Batch mark-paid via bar | Removed | User clarified mark-paid is per-week, not per-entry |

## Accomplishments

- POST /api/payroll/batch-approve-commission with saleId validation, partial failure tracking, and audit logging
- Multi-select checkboxes on entries needing commission approval with Select All per week
- Floating action bar with "Approve Commission (N)" button, ConfirmModal confirmation, toast feedback
- Selection auto-clears on data refresh to prevent stale state

## Task Commits

| Task | Commit | Type | Description |
|------|--------|------|-------------|
| Task 1+2: API + UI | `394feb2` | feat | Batch approve endpoint + checkbox UI + floating bar |
| Checkpoint fix | `6cac2bc` | fix | Scoped selection to approval-only, removed batch mark-paid |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `apps/ops-api/src/routes/sales.ts` | Modified | Added POST /api/payroll/batch-approve-commission endpoint |
| `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` | Modified | Selection state, batch handlers, floating action bar |
| `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx` | Modified | Pass-through selection props to WeekSection |
| `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` | Modified | Checkbox column in table header + EditableSaleRow |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Checkboxes only on approval-needing entries | Mark-paid is per-week; checkboxes only serve commission approval | Cleaner UX — no confusing checkboxes on entries with no batch action |
| Removed batch mark-paid from floating bar | User feedback: mark-paid is always entire week, not individual entries | Floating bar is commission-approval-only |
| Partial failure tracking in batch endpoint | Audit requirement — payroll operations must report exact outcomes | Response includes approved/failed counts and failedIds |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Scope reduction | 1 | Batch mark-paid removed per user feedback |
| Scope narrowing | 1 | Checkboxes narrowed to approval-needing entries only |

**Total impact:** Cleaner scope — batch operations focused on the actual pain point (commission approval).

### Details

**1. Batch mark-paid removed from floating action bar**
- **Found during:** Checkpoint (human-verify)
- **Issue:** Plan included batch mark-paid, but user clarified mark-paid is always per-week
- **Resolution:** Removed batchMarkPaid handler and "Mark Paid (N)" button from floating bar
- **Commit:** `6cac2bc`

**2. Checkboxes narrowed to approval-needing entries**
- **Found during:** Checkpoint (human-verify)
- **Issue:** Checkboxes on all non-paid entries had no purpose without batch mark-paid
- **Resolution:** Checkboxes only render on entries with halvingReason && !commissionApproved
- **Commit:** `6cac2bc`

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Batch commission approval functional and user-verified
- Cache invalidation pattern (invalidateAll) continues to work with batch operations
- payroll-types.ts unchanged — no type changes needed

**Concerns:**
- None

**Blockers:**
- None — Phase 64 (Polish & Exports) can proceed

---
*Phase: 63-bulk-operations, Plan: 01*
*Completed: 2026-04-13*
