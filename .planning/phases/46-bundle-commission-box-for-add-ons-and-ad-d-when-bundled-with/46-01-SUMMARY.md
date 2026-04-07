---
phase: 46
plan: 1
plan_id: 46-01
subsystem: ops-api / ops-dashboard / prisma
tags: [commission, aca, bundled, payroll, products, schema]
dependency_graph:
  requires:
    - Phase 42 acaCoveringSaleId self-relation on Sale
  provides:
    - Distinct ACA-bundle commission rate for ADDON and AD_D products
    - Form input for the new rate in the Products tab (ADDON/AD_D only)
    - Server-side persistence + payroll calculator wire-up
  affects:
    - prisma/schema.prisma
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/routes/products.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx
tech_stack:
  added: []
  patterns:
    - "Per-entry rate preference: prefer acaBundledCommission when sale.acaCoveringSaleId is set, else fall back to bundledCommission"
key_files:
  created:
    - prisma/migrations/20260407000001_add_aca_bundled_commission/migration.sql
    - .planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-01-SUMMARY.md
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/services/__tests__/commission.test.ts
    - apps/ops-api/src/services/__tests__/status-commission.test.ts
    - apps/ops-api/src/routes/products.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx
decisions:
  - "Server accepts acaBundledCommission for any product type; the frontend gates visibility to ADDON/AD_D only"
  - "Plan referenced apps/ops-api/src/routes/index.ts but the actual product routes live in apps/ops-api/src/routes/products.ts — corrected during execution"
  - "Edit/create form grid switched from 1fr 1fr 1fr to 1fr 1fr to accommodate the 4th input as a 2x2 layout"
metrics:
  duration: ~30m (parallel + manual recovery)
  completed: 2026-04-07
  tasks_completed: 4 of 4
---

# Phase 46 Plan 01: ACA Bundle Commission Schema and Calc

Adds a third commission rate `acaBundledCommission` on ADDON and AD_D products. When a sale is bundled with an ACA PL sale (`sale.acaCoveringSaleId` set, from Phase 42), `calculateCommission` prefers this rate over `bundledCommission`. When null, behavior is unchanged.

## Tasks Completed

### Task 1: Schema migration + prisma generate (BLOCKING)
**Commits:** `92d09c7`
**Files:** `prisma/schema.prisma`, `prisma/migrations/20260407000001_add_aca_bundled_commission/migration.sql`

Added `acaBundledCommission Decimal? @map("aca_bundled_commission") @db.Decimal(5, 2)` to the `Product` model. Migration applied; `@prisma/client` regenerated.

### Task 2: Wire acaBundledCommission into calculateCommission
**Commit:** `f5e637c`
**Files:** `apps/ops-api/src/services/payroll.ts`, `apps/ops-api/src/services/__tests__/commission.test.ts`, `apps/ops-api/src/services/__tests__/status-commission.test.ts`

Added an `isAcaBundled` flag from `sale.acaCoveringSaleId` and updated both ADDON-with-rate and AD_D rate lookups to prefer `entry.product.acaBundledCommission` when set, falling back to `entry.product.bundledCommission` otherwise. Test fixtures updated with `acaBundledCommission: null` to satisfy the new shape.

### Task 3: Accept acaBundledCommission in POST/PATCH /api/products
**Commit:** `5184bf6`
**Files:** `apps/ops-api/src/routes/products.ts` (path correction — plan said `routes/index.ts`)

Added `acaBundledCommission: z.number().min(0).max(100).nullable().optional()` to both Zod schemas. The field flows through the existing `productData` / `updateData` spread. `zodErr()` wrapper preserved.

### Task 4: ACA Bundle Commission input in PayrollProducts UI (ADDON/AD_D only)
**Commit:** `79e4b4d`
**Files:** `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx`

- Added field to `Product` type
- Edit-form state and create-form state extended with `acaBundledCommission: string`
- New input rendered only when `type === "ADDON" || type === "AD_D"` (both edit + create forms)
- `handleSave` only sends the field for ADDON/AD_D — CORE/ACA_PL paths skip it
- Display row shows `· ACA Bundle: X%` when populated on ADDON/AD_D
- Grid switched from 3 cols to 2 cols (2x2) to fit the 4th input cleanly
- Inline `React.CSSProperties` only — no Tailwind

## Verification

- `grep -c 'acaBundledCommission' apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` → **10**
- Edit + create forms guard visibility on `ADDON|AD_D`
- `ACA Bundle:` display marker present
- No `className=` or Tailwind utilities introduced

## Deviations

- Plan path `routes/index.ts` corrected to actual location `routes/products.ts`
- 4-input layout changed from `1fr 1fr 1fr` (3 cols) to `1fr 1fr` (2x2 grid)
- Cleaned up redundant `acaBundledCommission: productData.acaBundledCommission` overrides on the prisma create/update calls — the spread already includes the field

## Self-Check: PASSED
