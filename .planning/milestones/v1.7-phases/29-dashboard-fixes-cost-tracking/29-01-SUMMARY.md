---
phase: 29-dashboard-fixes-cost-tracking
plan: 01
subsystem: ops-dashboard, ops-api
tags: [bugfix, ui, api, read-only]
dependency_graph:
  requires: []
  provides: [premium-addon-display, buffer-field-create, products-read-only]
  affects: [manager-sales-tab, manager-config-tab, lead-source-api]
tech_stack:
  added: []
  patterns: [inline-addon-summation, read-only-table-conversion]
key_files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerConfig.tsx
    - apps/ops-api/src/routes/agents.ts
decisions:
  - Computed addon total inline in JSX IIFE to match card-level pattern
  - Removed ProductRow component entirely rather than disabling edit buttons
  - Bundle Config column shows first CORE product name for ADDON/AD_D types
metrics:
  duration: 4min
  completed: "2026-03-25T21:19:14Z"
  tasks: 2
  files: 3
---

# Phase 29 Plan 01: Dashboard Fixes & Lead Source Buffer Summary

Fix premium display to include addons, add buffer field to lead source create form and API, convert products to read-only table.

## One-liner

Premium column sums core+addon per row, lead source create form includes buffer field with API support, products section converted to read-only reference table.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix premium display and lead source create form in dashboard | eb9f287 | ManagerSales.tsx, ManagerConfig.tsx |
| 2 | Add callBufferSeconds to lead source POST API schema | cb7f0b9 | agents.ts |

## Changes Made

### Task 1: Dashboard Fixes + Products Read-Only

**FIX-01 (ManagerSales.tsx):** Premium column now computes `rowTotal = Number(s.premium) + addonTotal` where `addonTotal` sums all addon premiums. Uses same cast pattern (`Sale & { addons?: ... }`) already used at card level (lines 388-392).

**FIX-02 (ManagerConfig.tsx):** Added `callBufferSeconds: "0"` to `newLS` state, added "BUFFER (S)" number input to create form, and added `callBufferSeconds: Number(newLS.callBufferSeconds) || 0` to POST body.

**CFG-01/CFG-02 (ManagerConfig.tsx):** Replaced interactive ProductRow-based section with a read-only `<table>` showing Product, Type (with color-coded Badge), Commission rate, and Bundle Config columns. Removed `ProductRow` component and `saveProduct` function. Added "No products configured." empty state.

### Task 2: API Schema Fix

Added `callBufferSeconds: z.number().int().min(0).optional()` to POST `/lead-sources` Zod schema, matching the existing PATCH schema.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused formatDollar import**
- **Found during:** Task 1
- **Issue:** After removing ProductRow, the `formatDollar` import from `@ops/utils` became unused
- **Fix:** Removed the import line
- **Files modified:** ManagerConfig.tsx
- **Commit:** eb9f287

## Verification

- TypeScript compilation: No new errors in either ops-dashboard or ops-api (pre-existing type declaration warnings in packages/auth remain unchanged)
- ManagerSales.tsx contains `addonTotal` and `rowTotal` variables
- ManagerConfig.tsx create form has buffer input with `type="number"` and `min="0"`
- ManagerConfig.tsx POST body includes `callBufferSeconds: Number(`
- ManagerConfig.tsx Products section uses `<table` with read-only display
- agents.ts POST schema contains `callBufferSeconds: z.number().int().min(0).optional()`

## Self-Check: PASSED

All files exist, all commits verified, all acceptance criteria met.
