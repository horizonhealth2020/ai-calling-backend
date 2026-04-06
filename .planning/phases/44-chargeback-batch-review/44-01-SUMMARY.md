---
phase: 44-chargeback-batch-review
plan: 01
subsystem: chargebacks
tags: [api, preview, toast, matching]
dependency_graph:
  requires: []
  provides: [chargeback-preview-endpoint, chargeback-matching-service, toast-action-button, selectedSaleId-support]
  affects: [ops-api, packages-ui]
tech_stack:
  added: []
  patterns: [batch-IN-query, backward-compatible-overloads]
key_files:
  created:
    - __tests__/chargebacks-preview.test.js
    - __tests__/chargebacks-batch.test.js
    - apps/ops-api/src/services/chargebacks.ts
  modified:
    - apps/ops-api/src/routes/chargebacks.ts
    - packages/ui/src/components/Toast.tsx
decisions:
  - Product model has no premium field; addon premium comes from SaleAddon.premium not Product.premium
  - ToastOptions uses union type (number | ToastOptions) for full backward compatibility
metrics:
  duration: 318s
  completed: "2026-04-06T19:27:40Z"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 44 Plan 01: Chargeback Preview API, Toast Actions & selectedSaleId Summary

Batch chargeback matching service with single IN query, preview endpoint returning match status and sale details, Toast action button support, and selectedSaleId forwarding on submit.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 0 | Wave 0 test stubs | 13327a8 | __tests__/chargebacks-preview.test.js, __tests__/chargebacks-batch.test.js |
| 1 | Preview endpoint, matching service, selectedSaleId | 5c01889 | apps/ops-api/src/services/chargebacks.ts, apps/ops-api/src/routes/chargebacks.ts |
| 2 | Toast action button support | fc4f6e1 | packages/ui/src/components/Toast.tsx |

## What Was Built

### matchChargebacksToSales Service
- Shared function in `apps/ops-api/src/services/chargebacks.ts`
- Single `prisma.sale.findMany({ where: { memberId: { in: uniqueIds } } })` -- no N+1
- Returns `Map<string, Sale[]>` keyed by memberId
- Includes agent, product, and addon relations

### POST /api/chargebacks/preview Endpoint
- Auth: requireAuth + requireRole("SUPER_ADMIN", "OWNER_VIEW")
- Input: Zod-validated array of parsed chargeback records
- Output: Each record enriched with matchStatus (MATCHED/MULTIPLE/UNMATCHED), matchedSales array with sale details, and auto-selected selectedSaleId for single matches
- Read-only: no database writes, no alerts, no socket emissions
- Registered BEFORE POST /chargebacks to ensure correct route matching

### selectedSaleId on POST /chargebacks
- Added `selectedSaleId: z.string().nullable().optional()` to chargebackSchema
- When provided, looks up sale directly by ID and uses it (D-03 resolution)
- Falls back to automatic memberId matching when selectedSaleId is null or sale not found

### Toast Action Button
- Added ToastAction interface: `{ label: string; onClick: () => void }`
- Toast callback accepts `number | ToastOptions` (backward compatible)
- Action button renders inline between message and close button
- Styled with toast type's color, auto-dismisses toast on click

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed premium from Product select**
- **Found during:** Task 1
- **Issue:** Plan specified `premium: true` in Product select, but Product model has no `premium` field (it has `premiumThreshold`, `commissionBelow`, etc.)
- **Fix:** Removed `premium` from Product select in service; addon premium uses `SaleAddon.premium` directly
- **Files modified:** apps/ops-api/src/services/chargebacks.ts, apps/ops-api/src/routes/chargebacks.ts
- **Commit:** 5c01889

**2. [Rule 1 - Bug] Fixed implicit any type on addon map parameter**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `sale.addons.map(a => ...)` had implicit any type error due to complex generic inference
- **Fix:** Added explicit `(a: any)` type annotation
- **Files modified:** apps/ops-api/src/routes/chargebacks.ts
- **Commit:** 5c01889

## Verification Results

- Test stubs: 2 suites, 12 todo tests, all passing (pending)
- TypeScript: No chargebacks-related compilation errors
- Preview route: registered before submit route (correct ordering)
- No DB writes in preview handler (no createMany, create, update calls)
- Toast backward compatible (options param is optional)

## Self-Check: PASSED

All 6 files verified present. All 3 commit hashes verified in git log.
