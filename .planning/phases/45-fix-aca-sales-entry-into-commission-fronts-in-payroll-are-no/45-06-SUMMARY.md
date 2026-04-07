---
phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no
plan: 06
subsystem: ui
tags: [react, nextjs, typescript, aca, manager-dashboard]

# Dependency graph
requires:
  - phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no
    provides: "Two-pass ACA fold pattern established in PayrollPeriods.tsx (Plan 45-01) and ManagerSales parent plan (45-04)"
provides:
  - "ManagerSales.tsx two-pass ACA fold — one row per logical sale"
  - "Per-agent 'N sales' badge counts folded (logical) sales"
  - "Local Sale type includes acaCoveringSaleId"
affects: [manager-sales, reporting, payroll-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Client-side two-pass ACA fold applied to salesList before byAgent grouping (mirrors PayrollPeriods.tsx pattern)"

key-files:
  created: []
  modified:
    - "apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx"

key-decisions:
  - "Fold is client-side only — API already returns acaCoveringSaleId via prisma.sale.findMany include; no API change needed"
  - "Orphaned ACA children (no visible parent in window) still render as standalone rows to prevent silent payroll drop"
  - "Per-agent sales.length badge reads the folded array automatically — no JSX change required"

patterns-established:
  - "Two-pass ACA fold (index children by parent id → emit non-child rows → defensive orphan pass) is the canonical pattern for any new surface consuming /api/sales that displays per-sale rows"

requirements-completed: [BUGFIX-45-ACA]

# Metrics
duration: ~5min
completed: 2026-04-07
---

# Phase 45 Plan 06: ManagerSales ACA Fold Summary

**Two-pass ACA child fold applied to manager sales tracking view so managers see one logical row per sale and the per-agent 'N sales' badge reflects folded counts.**

## Performance

- **Duration:** ~5 min
- **Completed:** 2026-04-07
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Extended local `Sale` type in `ManagerSales.tsx` with `acaCoveringSaleId?: string | null`
- Added order-independent two-pass fold (index children → emit parents → defensive orphan pass) to `filtered` before `byAgent` grouping
- `byAgent` Map now iterates `foldedSales`, so per-agent `sales.length` badge automatically yields the logical (post-fold) count
- Preserved orphan-child safety: ACA children whose parent is absent from the current window still render

## Task Commits

1. **Task 1: Extend Sale type and apply two-pass fold** - `9a6cb62` (fix)

## Files Created/Modified
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` — Added `acaCoveringSaleId` to local Sale type; inserted GAP-45-06 two-pass fold block between `filtered` computation and `byAgent` grouping

## Decisions Made
- No API or schema change — `prisma.sale.findMany({ include: ... })` already surfaces `acaCoveringSaleId` scalar because `include` does not redefine scalar selection.
- No change to row render loop, per-agent header JSX, or `premiumTotal` reducer — the folded array replacement is sufficient.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Verification Results

- `grep -c acaCoveringSaleId` → 7 (plan requires ≥5) ✓
- `grep -c GAP-45-06` → 1 (plan requires 1) ✓
- `grep -c foldedSales` → 4 (plan requires ≥4) ✓
- `grep -c acaChildrenByParentId` → 4 (plan requires ≥4) ✓
- `npx tsc --noEmit` → no errors reported on ManagerSales.tsx ✓

## Acceptance Criteria

All acceptance criteria pass cleanly:
- Local Sale type now declares `acaCoveringSaleId`
- Two-pass fold pre-pass present and uses `filtered`
- `byAgent` loop iterates `foldedSales` exactly once
- No tsc errors in the modified file
- Per-agent 'N sales' badge reads `sales.length` on the folded array
- Orphaned ACA children still render defensively

## Out-of-Scope (Confirmed)

- `ManagerTracker.tsx` — does not render a per-agent sales list
- `sales-board` app — separate aggregated endpoint, not `/api/sales`
- Top-earner badge math, exports, reports — not present in this view

## Next Phase Readiness
- GAP-45-06 closed; BUGFIX-45-ACA fold pattern now applied to all consumer surfaces identified during phase 45 UAT
- Manual smoke test remains: open `/manager` Sales tab with the existing ACA test sale and confirm a single row / correct badge count

## Self-Check: PASSED

- File modified: `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` ✓
- Commit `9a6cb62` present in `git log` ✓
- All grep acceptance criteria satisfied ✓
- tsc shows no ManagerSales.tsx errors ✓

---
*Phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no*
*Completed: 2026-04-07*
