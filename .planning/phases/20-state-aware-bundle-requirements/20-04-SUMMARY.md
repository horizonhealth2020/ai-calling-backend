---
phase: 20-state-aware-bundle-requirements
plan: "04"
subsystem: config-ui
tags: [react, ui, products, bundle-config, state-availability]
dependency_graph:
  requires: [ProductStateAvailability, Product-FK-fields, US_STATES-constant, state-availability-api, product-bundle-api]
  provides: [bundle-config-ui, state-availability-ui, completeness-indicator]
  affects: [payroll-products-tab]
tech_stack:
  added: []
  patterns: [collapsible-section, searchable-multi-select, completeness-indicator]
key_files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx
    - apps/ops-dashboard/next.config.js
    - apps/ops-api/src/routes/index.ts
decisions:
  - PATCH /products/:id now includes bundle relations in response to prevent UI state loss
  - Added @ops/types to ops-dashboard transpilePackages for US_STATES import
metrics:
  duration: 219s
  completed: "2026-03-23T20:10:00Z"
  tasks: 1
  files: 3
---

# Phase 20 Plan 04: Config UI for Bundle Requirements and State Availability Summary

Product card config UI with collapsible Bundle Requirements section (required/fallback addon selectors) for CORE products and collapsible State Availability section (searchable 51-state multi-select with Select All/Clear All) for ADDON/AD_D products, plus completeness indicator showing uncovered state count on CORE cards.

## What Was Done

### Task 1: Bundle Requirements + State Availability config UI sections

**Product type updated** to include `requiredBundleAddonId`, `fallbackBundleAddonId`, `requiredBundleAddon`, `fallbackBundleAddon`, and `stateAvailability` fields.

**CORE product cards (edit mode):**
- Collapsible "Bundle Requirements" section with Link2 icon
- "Required Addon for Full Commission" dropdown -- filters to active ADDON/AD_D products only
- "Fallback Addon" dropdown -- excludes the selected required addon
- Both fields save via existing PATCH /products/:id endpoint

**CORE product cards (display mode):**
- Completeness indicator when `requiredBundleAddonId` is set
- Shows bundle addon name(s) and "X states uncovered" warning span or "All states covered" success span
- Uses inline styled `<span>` elements (no Badge component)

**ADDON/AD_D product cards (edit mode):**
- Collapsible "State Availability (N/51)" section with MapPin icon
- Search input filters states by name or code
- Select All / Clear All buttons
- 4-column grid of checkboxes for all 51 US states
- Saves via PUT /products/:id/state-availability endpoint on card save

**ADDON/AD_D product cards (display mode):**
- "Available in N states" count below commission rates

**Parent component:** `allProducts` prop added to ProductCard and passed from parent map.

**Import:** `US_STATES` from `@ops/types`, plus `ChevronDown`, `ChevronUp`, `MapPin`, `Link2` from lucide-react.

- **Commit:** `2d0626b`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PATCH /products/:id missing bundle relations in response**
- **Found during:** Task 1
- **Issue:** The PATCH endpoint returned plain product without `requiredBundleAddon`, `fallbackBundleAddon`, `stateAvailability` includes. After saving, the UI would lose these fields in local state since `saveProduct` replaces the product with the API response.
- **Fix:** Added `include` clause to prisma.product.update in the PATCH handler matching the GET /products query
- **Files modified:** `apps/ops-api/src/routes/index.ts`
- **Commit:** `2d0626b`

**2. [Rule 3 - Blocking] @ops/types not in transpilePackages**
- **Found during:** Task 1
- **Issue:** `import { US_STATES } from "@ops/types"` would fail at build time without adding the package to Next.js transpilePackages
- **Fix:** Added `"@ops/types"` to `transpilePackages` in `apps/ops-dashboard/next.config.js`
- **Files modified:** `apps/ops-dashboard/next.config.js`
- **Commit:** `2d0626b`

## Decisions Made

1. **PATCH includes bundle relations** -- Matches GET /products response shape; prevents UI losing relation data after save
2. **@ops/types in transpilePackages** -- Required for US_STATES import to work with Next.js module resolution

## Self-Check: PASSED

- [x] PayrollProducts.tsx contains `requiredBundleAddonId` and `fallbackBundleAddonId` in Product type
- [x] PayrollProducts.tsx contains `import { US_STATES } from "@ops/types"`
- [x] PayrollProducts.tsx contains `Bundle Requirements` text
- [x] PayrollProducts.tsx contains `State Availability` text
- [x] PayrollProducts.tsx contains `Required Addon for Full Commission` label
- [x] PayrollProducts.tsx contains `Fallback Addon` label
- [x] PayrollProducts.tsx contains `stateSearch` state variable
- [x] PayrollProducts.tsx contains `Select All` and `Clear All` buttons
- [x] PayrollProducts.tsx contains `state-availability` in fetch URL
- [x] PayrollProducts.tsx contains `uncovered` in completeness indicator
- [x] Completeness indicator uses inline `<span>` with style objects (no Badge)
- [x] PayrollProducts.tsx contains `allProducts` prop on ProductCard
- [x] ops-dashboard builds without errors
- [x] Commit `2d0626b` exists
