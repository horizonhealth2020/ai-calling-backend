---
phase: 39-aca-product-configuration
plan: 01
subsystem: products-api, payroll-dashboard
tags: [feature, aca, products, ui]
dependency_graph:
  requires: []
  provides: [aca-pl-product-edit, flat-commission-api]
  affects: [payroll-products-tab]
tech_stack:
  added: []
  patterns: [conditional-save-fields, disabled-type-selector]
key_files:
  modified:
    - apps/ops-api/src/routes/products.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx
decisions:
  - ACA PL products use info-blue color (C.info) consistent with ACA badges in payroll cards
  - Type selector disabled for ACA_PL products to prevent type changes
  - Save handler sends only flatCommission for ACA_PL, no percentage fields
  - ACA PL group rendered last in product grid (after AD&D)
metrics:
  duration: 116s
  completed: "2026-04-01T16:14:58Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
requirements: [ACA-01]
---

# Phase 39 Plan 01: ACA Product Configuration Summary

PATCH /products/:id accepts flatCommission field; Products tab shows ACA PL products in own group with simplified flat-commission-only edit form and disabled type selector.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Add flatCommission to PATCH /products/:id Zod schema | d325681 | Added flatCommission: z.number().min(0).nullable().optional() to PATCH schema only |
| 2 | Extend PayrollProducts.tsx with ACA PL product support | 9ae53d9 | Added ACA_PL to ProductType, TYPE_LABELS, TYPE_COLORS; flat commission view/edit; disabled type selector; conditional save handler; ACA PL group in grid |

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- flatCommission in PATCH schema: 1 match (line 68)
- ACA_PL in POST schema: 0 matches (correct)
- ACA_PL in products.ts type enums: 0 matches (correct)
- ACA_PL in PayrollProducts.tsx: 10 matches
- flatCommission in PayrollProducts.tsx: 7 matches
- C.info in PayrollProducts.tsx: 1 match
- disabled={product.type in PayrollProducts.tsx: 1 match
- "per member" in PayrollProducts.tsx: 2 matches
- Add Product form: no ACA_PL option (correct)
