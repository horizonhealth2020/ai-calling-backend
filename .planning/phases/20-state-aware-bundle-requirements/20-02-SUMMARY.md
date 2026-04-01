---
phase: 20-state-aware-bundle-requirements
plan: "02"
subsystem: commission-engine
tags: [payroll, commission, bundle-requirements, state-aware, tests]
dependency_graph:
  requires: [ProductStateAvailability, Product-FK-fields, PayrollEntry-halvingReason]
  provides: [BundleRequirementContext, resolveBundleRequirement, state-aware-calculateCommission, halvingReason-storage]
  affects: [preview-endpoint, payroll-entries, commission-display]
tech_stack:
  added: []
  patterns: [optional-parameter-backward-compat, context-object-pattern]
key_files:
  created: []
  modified:
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/services/__tests__/commission.test.ts
    - apps/ops-api/src/services/__tests__/status-commission.test.ts
    - apps/ops-api/src/routes/index.ts
decisions:
  - Fixed pre-existing test expectation mismatch (VAB premium was being included in bundlePremium since 3e3e6bc but tests expected old values)
  - handleSaleEditApproval delegates to upsertPayrollEntryForSale which already resolves bundle context
  - handleCommissionZeroing does not call calculateCommission (only zeros entries) so no changes needed
metrics:
  duration: 420s
  completed: "2026-03-23T19:55:00Z"
  tasks: 1
  files: 4
---

# Phase 20 Plan 02: Commission Engine State-Aware Bundle Logic Summary

State-aware bundle qualification added to commission engine: resolveBundleRequirement resolves primary/fallback addon availability by state, calculateCommission returns { commission, halvingReason } with optional BundleRequirementContext, upsertPayrollEntryForSale stores halvingReason, preview endpoint accepts memberState and returns halvingReason.

## What Was Done

### Task 1: Modify calculateCommission return type, add resolveBundleRequirement, update all callers (TDD)

**RED phase:**
- Updated makeProduct helper with requiredBundleAddonId and fallbackBundleAddonId fields
- Changed all existing test assertions from `calculateCommission(sale)` to `calculateCommission(sale).commission`
- Added 6 new state-aware test cases + 1 return type verification test
- Tests failed because calculateCommission still returned bare number
- **Commit:** `8587cc8`

**GREEN phase:**
- Added `BundleRequirementContext` type to payroll.ts (nullable object with requiredAddonAvailable, fallbackAddonAvailable, halvingReason)
- Changed `calculateCommission` signature to accept optional `bundleCtx` parameter and return `{ commission, halvingReason }` object
- Replaced halving logic with dual-path: state-aware path (when bundleCtx provided) or legacy isBundleQualifier path (when bundleCtx undefined/null)
- Added `resolveBundleRequirement` async function that queries ProductStateAvailability for primary/fallback addon resolution
- Updated `upsertPayrollEntryForSale` to include requiredBundleAddon/fallbackBundleAddon in product query, resolve bundleCtx, destructure result.commission, and write halvingReason to PayrollEntry
- Updated `handleSaleEditApproval` -- delegates to upsertPayrollEntryForSale which already handles context
- Updated `handleCommissionZeroing` -- does not call calculateCommission, no changes needed
- Updated preview endpoint: added memberState to schema, resolve bundleCtx when applicable, return halvingReason in response
- Updated status-commission.test.ts for new return type and Product fields
- Fixed pre-existing test expectation mismatch where VAB premium inclusion was changed but test values were not updated
- All 162 tests pass (90 root + 72 ops-api)
- **Commit:** `7fb705c`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing test expectation mismatch**
- **Found during:** Task 1 GREEN phase
- **Issue:** Commit 3e3e6bc changed bundlePremium filter to include isBundleQualifier addons, but test expected values were never updated. Tests could not compile since Plan 01 added new required Product fields, so this was never caught.
- **Fix:** Updated all test expectations to match actual bundlePremium calculation (e.g., COMM-01: 50 -> 55 because VAB premium 10 is now included)
- **Files modified:** `apps/ops-api/src/services/__tests__/commission.test.ts`
- **Commit:** `7fb705c`

**2. [Rule 2 - Missing] status-commission.test.ts needed updates**
- **Found during:** Task 1 GREEN phase
- **Issue:** status-commission.test.ts also calls calculateCommission and uses makeProduct without the new FK fields
- **Fix:** Added requiredBundleAddonId/fallbackBundleAddonId to makeProduct, updated gatedCommission helper and assertion to use .commission accessor
- **Files modified:** `apps/ops-api/src/services/__tests__/status-commission.test.ts`
- **Commit:** `7fb705c`

**3. [Rule 3 - Blocking] handleCommissionZeroing does not call calculateCommission**
- **Found during:** Task 1 analysis
- **Issue:** Plan Step 7 said to update handleCommissionZeroing to destructure result.commission. But this function only zeros out payroll entries -- it never calls calculateCommission.
- **Fix:** No changes needed to handleCommissionZeroing (plan instruction was based on incorrect assumption)
- **Files modified:** none

## Decisions Made

1. **Pre-existing VAB premium test expectations fixed** -- Tests were stale since commit 3e3e6bc; updated to match actual production behavior
2. **handleSaleEditApproval delegates to upsertPayrollEntryForSale** -- No direct calculateCommission call needed since upsert already resolves context
3. **handleCommissionZeroing left unchanged** -- Does not call calculateCommission; only zeros entries

## Self-Check: PASSED

- [x] `apps/ops-api/src/services/payroll.ts` contains `export type BundleRequirementContext`
- [x] `apps/ops-api/src/services/payroll.ts` contains `export async function resolveBundleRequirement`
- [x] `apps/ops-api/src/services/payroll.ts` calculateCommission signature contains `bundleCtx?: BundleRequirementContext`
- [x] `apps/ops-api/src/services/payroll.ts` calculateCommission returns `{ commission:` not just a number
- [x] `apps/ops-api/src/services/payroll.ts` contains `halvingReason = bundleCtx.halvingReason` inside state-aware halving block
- [x] `apps/ops-api/src/services/payroll.ts` upsertPayrollEntryForSale contains `resolveBundleRequirement`
- [x] `apps/ops-api/src/services/payroll.ts` upsertPayrollEntryForSale writes `halvingReason` to payrollEntry
- [x] `apps/ops-api/src/routes/index.ts` preview endpoint schema contains `memberState`
- [x] `apps/ops-api/src/routes/index.ts` preview endpoint uses `result.commission`
- [x] commission.test.ts contains state-aware tests (6 new test cases)
- [x] commission.test.ts all existing test assertions use `.commission` accessor
- [x] All 162 tests pass
- [x] Commits `8587cc8` and `7fb705c` exist
