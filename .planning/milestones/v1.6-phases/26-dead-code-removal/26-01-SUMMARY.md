---
phase: 26-dead-code-removal
plan: 01
subsystem: monorepo-wide
tags: [dead-code, imports, cleanup, refactor]
dependency_graph:
  requires: []
  provides: [clean-imports, no-dead-locals]
  affects: [ops-api, ops-dashboard, sales-board, packages]
tech_stack:
  added: []
  patterns: [tsc-noUnusedLocals-verification]
key_files:
  created: []
  modified:
    - apps/ops-api/src/routes/change-requests.ts
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollService.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/page.tsx
    - packages/socket/src/useSocket.ts
    - packages/ui/src/components/Input.tsx
    - packages/ui/src/components/Select.tsx
decisions:
  - Unused state getters replaced with [, setter] destructuring pattern
  - Dead helper function highlightEntry and related unused state removed
  - Unused LBL style constant removed (was alias for baseLabelStyle)
metrics:
  duration: ~10 minutes
  completed: 2026-03-25
---

# Phase 26 Plan 01: Unused Imports & Commented-Out Code Removal Summary

Removed all unused imports, dead local variables, and dead functions across 17 files in ops-api, ops-dashboard, and shared packages. Audit of commented-out code found zero instances -- the codebase was already clean.

## Task Results

### Task 1: Remove unused imports across all TypeScript and JavaScript files

**Commit:** 4acdaca

**ops-api (2 files):**
- `change-requests.ts`: Removed unused `z` (zod) and `zodErr` imports
- `sales.ts`: Removed unused `computeTrend` import

**ops-dashboard (12 files):**
- `CSSubmissions.tsx`: Removed unused `baseCardStyle`, `baseLabelStyle`, `radius`
- `ManagerAudits.tsx`: Removed unused `motion`
- `ManagerEntry.tsx`: Removed unused `useCallback`, `Card`, `baseButtonStyle`, `DateRangeFilterValue`
- `ManagerSales.tsx`: Removed unused `useCallback`, `typography`, `Save`, `X`; fixed unused `editPreviewLoading` state getter
- `ManagerTracker.tsx`: Removed unused `useCallback`, `typography`, `motion`; fixed unused `callCountsLoaded` state getter
- `OwnerOverview.tsx`: Removed unused `formatDollar`
- `payroll/page.tsx`: Removed unused `useRef`, `captureTokenFromUrl`, `useToast`/`toast`
- `PayrollChargebacks.tsx`: Removed unused `useToast`
- `PayrollExports.tsx`: Fixed unused `exporting` state getter
- `PayrollPeriods.tsx`: Removed 19 unused imports (PageShell, SkeletonCard, DateRangeFilter, useCallback, useRef, FormEvent, SaleChangedPayload, DateRangeFilterValue, baseLabelStyle, 8 lucide-react icons); removed dead state vars (bonus, fronted, hold); removed dead `isZeroed` var; removed dead `highlightEntry` function; removed unused `LBL` style constant; removed unused `bonusTotal`/`deductionTotal` vars
- `PayrollProducts.tsx`: Removed unused `useToast`, `X`
- `PayrollService.tsx`: Removed unused `useToast`

**Shared packages (3 files):**
- `packages/ui/src/components/Input.tsx`: Removed unused `radius`
- `packages/ui/src/components/Select.tsx`: Removed unused `radius`
- `packages/socket/src/useSocket.ts`: Removed unused `handler` destructured variable

**Morgan (0 changes):** All CommonJS requires are actively used.

### Task 2: Remove commented-out code blocks across all source files

**No changes required.** Systematic grep-based audit across all source files found zero instances of commented-out code blocks. All existing comments are explanatory (section headers, JSDoc, "why" comments, TODO markers).

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `npm test`: 90 tests passed (7 suites)
- `npm run test:ops`: 77 tests passed (6 suites)
- `cd apps/ops-api && npx tsc --noEmit --noUnusedLocals | grep "declared but"`: zero results
- `cd apps/ops-dashboard && npx tsc --noEmit --noUnusedLocals | grep "declared but"`: zero results
- `cd apps/sales-board && npx tsc --noEmit --noUnusedLocals | grep "declared but"`: zero results (only packages/ui cross-refs, also clean)

## Requirements Satisfied

- **DC-01:** No unused imports exist across any app or package
- **DC-03:** No commented-out code blocks remain (explanatory comments preserved)
