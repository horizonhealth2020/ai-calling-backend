---
phase: quick
plan: 260326-lsx
subsystem: products/bundle-resolution
tags: [prisma, api, dashboard, multi-fallback]
dependency_graph:
  requires: []
  provides: [CoreProductFallback join table, multi-fallback bundle resolution]
  affects: [payroll commission calculation, product management UI]
tech_stack:
  added: []
  patterns: [join table for many-to-many, checkbox multi-select UI]
key_files:
  created:
    - prisma/migrations/20260326_add_multi_fallback_addons/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/routes/products.ts
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-api/src/services/__tests__/commission.test.ts
    - apps/ops-api/src/services/__tests__/status-commission.test.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx
decisions:
  - "Join table with deleteMany+createMany replace strategy for PATCH (simpler than diff-based upsert)"
  - "CASCADE delete on join table FKs so product deletion auto-cleans fallback references"
metrics:
  duration: "4min 36s"
  completed: "2026-03-26"
  tasks: 2
  files: 8
---

# Quick Plan 260326-lsx: Multi-Fallback Addons for Core Bundle Resolution

CoreProductFallback join table replacing single fallbackBundleAddonId FK, enabling multiple fallback addons where any qualifying match satisfies the bundle requirement.

## Task Summary

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Schema migration + API updates | 3be6a9f | prisma/schema.prisma, migration.sql, payroll.ts, products.ts, sales.ts |
| 2 | Dashboard UI multi-select fallback addons | 42e1eae | PayrollProducts.tsx |

## What Changed

### Schema (prisma/schema.prisma)
- Added `CoreProductFallback` model (join table: `core_product_fallbacks`) with `coreProductId` + `fallbackProductId` unique constraint
- Removed `fallbackBundleAddonId` column and `FallbackBundleAddon` self-relation from Product
- Added `fallbackAddons` and `fallbackForCores` relation fields on Product

### Migration (20260326_add_multi_fallback_addons)
- Creates join table, migrates existing single-FK data, then drops old column -- all in one migration

### API (products.ts, sales.ts)
- GET /products now returns `fallbackAddons: [{ fallbackProduct: { id, name } }]` instead of `fallbackBundleAddon: { id, name }`
- POST/PATCH accept `fallbackAddonIds: string[]` -- PATCH uses delete+createMany replace strategy
- DELETE cleans up join table rows via `coreProductFallback.deleteMany` instead of nulling old FK

### Bundle Resolution (payroll.ts)
- `resolveBundleRequirement` iterates `fallbackAddons[]` array -- ANY match returns `fallbackAddonAvailable: true`
- `upsertPayrollEntryForSale` includes new `fallbackAddons` relation in product query

### Dashboard (PayrollProducts.tsx)
- Product type uses `fallbackAddons` array instead of single `fallbackBundleAddon`
- Edit form: single fallback dropdown replaced with checkbox grid (2-column, scrollable)
- Read-only view: displays comma-separated list of all fallback addon names
- State coverage badge: unions states from all fallback addons

### Tests
- Updated `makeProduct` helpers in commission.test.ts and status-commission.test.ts to remove `fallbackBundleAddonId`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated test mocks for new schema**
- **Found during:** Task 1
- **Issue:** Test helpers `makeProduct()` in commission.test.ts and status-commission.test.ts included `fallbackBundleAddonId` which no longer exists on the Prisma Product type
- **Fix:** Removed the field from both test mock factories
- **Files modified:** apps/ops-api/src/services/__tests__/commission.test.ts, apps/ops-api/src/services/__tests__/status-commission.test.ts
- **Commit:** 3be6a9f

## Verification

- `npx prisma generate` succeeds
- `npx tsc --noEmit -p apps/ops-api/tsconfig.json` -- no new errors (only pre-existing type declaration warnings)
- `npx tsc --noEmit -p apps/ops-dashboard/tsconfig.json` -- no new errors (only pre-existing type declaration warnings)

## Self-Check: PASSED

All 6 key files verified on disk. Both commits (3be6a9f, 42e1eae) confirmed in git log.
