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

## Gaps Discovered Post-Phase

Two gaps surfaced during user verification of the deployed phase. Both are fixed; this section documents the corrections so the SUMMARY is consistent with the actual production behavior.

### GAP-46-01: Standalone branch + per-product calc not patched
**Fix commit:** `95ad3b8` — `fix(46): GAP-46-01 apply ACA bundle rate to standalone branch + per-product calc`

Phase 46-01 Task 2 only patched the `hasCoreInSale` branch of `calculateCommission`. Two paths were missed:

1. `calculateCommission` standalone branch (no CORE in sale): AD&D-only or ADDON-only sales bundled with an ACA PL fell through to `standaloneCommission`, ignoring `acaBundledCommission` entirely. User hit this — a Complete Care AD&D sale was calculating at 35% standalone instead of 70% ACA bundle.
2. `calculatePerProductCommission` (used by per-product chargeback / clawback flows) had no `isAcaBundled` awareness in either branch.

Both functions now apply the ACA bundle rate to ADDON-with-rate and AD&D entries in **both** branches. ADDONs with `bundledCommission === null` still fold into bundlePremium under the core rate (intentional per plan).

### GAP-46-02: Inverted relationship direction
**Fix commit:** `005d2d5` — `fix(46): GAP-46-02 detect ACA bundling via inverse acaCoveredSales relation`

After GAP-46-01 shipped, the calculation **still** returned the standalone rate. Root cause: the entire Phase 46-01 premise had the Phase 42 self-relation backwards.

The Phase 42 relation works like this:
- The **CHILD ACA PL sale** has `acaCoveringSaleId` set, pointing UP at the AD&D/ADDON parent sale
- The **PARENT AD&D/ADDON sale**'s `acaCoveringSaleId` is NULL — it finds its ACA child(ren) via the inverse relation `acaCoveredSales`

`calculateCommission` is computing the parent AD&D sale's commission. `sale.acaCoveringSaleId` is `null` on the parent, so the original check `!!sale.acaCoveringSaleId` was **always false** for the AD&D — and the new bundle rate was never applied.

Confirmed via [apps/ops-dashboard/.../ManagerEntry.tsx:451-476](apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx#L451-L476) — the linked ACA child is created with `body.acaCoveringSaleId = sale.id` where `sale` is the AD&D parent (i.e., the child stores the parent's id).

**Fix:**
- `upsertPayrollEntryForSale` (services/payroll.ts): include `acaCoveredSales: { where: { product: { type: "ACA_PL" } }, select: { id: true } }` when fetching the sale
- `POST /clawbacks` (routes/payroll.ts): same include for the per-product commission path
- `calculateCommission` + `calculatePerProductCommission`: detect via `(sale.acaCoveredSales?.length ?? 0) > 0` instead of `acaCoveringSaleId`

After the deploy, ACA TEST 2 (Complete Care AD&D $139.98 with linked ACA PL child) correctly calculated to $97.99 instead of $48.99.

### Caveat: existing payroll entries don't auto-recalculate

`upsertPayrollEntryForSale` only fires when a sale is touched (created, edited, status changed, or its ACA child is created/edited). Sales that existed before the GAP-46-02 deploy keep their stored `payoutAmount` from the old (incorrect) calc until something triggers a recalc — either a manual edit-and-save on the sale, or a backfill script. Not handled in this phase.

## Self-Check: PASSED (with two post-phase gap fixes captured above)
