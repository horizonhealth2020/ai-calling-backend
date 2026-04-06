---
phase: 42-aca-product-fix
plan: 01
subsystem: payroll-products, commission-engine
tags: [aca, products-tab, bundle-requirement, commission]
dependency_graph:
  requires: []
  provides: [aca-product-visibility, aca-bundle-documentation]
  affects: [payroll-products-tab, commission-calculation]
tech_stack:
  added: []
  patterns: [empty-state-messaging]
key_files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx
    - apps/ops-api/src/services/payroll.ts
decisions:
  - ACA PL empty state shows informational message rather than hiding section entirely
  - ACA bundle auto-satisfaction logic verified correct -- no code changes needed, only documentation
metrics:
  duration: 89s
  completed: 2026-04-06
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 42 Plan 01: ACA Product Visibility and Bundle Auto-Satisfaction Summary

ACA PL section in Products tab shows informational empty state when no ACA products exist; bundle requirement auto-satisfaction via acaCoveringSaleId verified correct and documented with D-03 decision reference.

## What Was Done

### Task 1: ACA PL product visibility in Products tab
Modified `PayrollProducts.tsx` to render an informational empty state for the ACA PL group when no ACA products exist in the database. Previously, the group was hidden entirely (`return null`) when empty. Now, for the ACA_PL type specifically, a styled message reads "ACA PL products appear here after ACA sales are entered." This matches the product lifecycle where ACA PL products are created through the sales flow, not manually.

**Commit:** e3073da

### Task 2: ACA bundle requirement auto-satisfaction verification
Verified the full `resolveBundleRequirement` flow:
1. Core product with `requiredBundleAddonId` configured triggers bundle check
2. `saleId` parameter correctly passed from `upsertPayrollEntryForSale`
3. ACA covering sale lookup uses `where: { acaCoveringSaleId: saleId, product: { type: "ACA_PL" }, status: "RAN" }`
4. When found, returns `halvingReason: null` -- full bundled commission applied
5. Sale creation in `sales.ts` correctly sets `acaCoveringSaleId` and triggers parent sale payroll recalc

Updated the existing D-13 comment to D-03 (Phase 42) with expanded documentation explaining the positioning constraint and bypass behavior.

**Commit:** 36b26a0

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | e3073da | feat(42-01): add ACA PL empty state message in Products tab |
| 2 | 36b26a0 | docs(42-01): document ACA bundle auto-satisfaction logic in resolveBundleRequirement |
