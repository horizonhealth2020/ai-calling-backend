---
phase: 02-commission-engine-core
plan: 04
subsystem: manager-dashboard, ops-api
tags: [addon-ui, sales-entry, bundle-support]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [addon-product-selection-ui, per-addon-premium-storage]
  affects: [sales-entry-form, POST-sales-endpoint]
tech_stack:
  added: []
  patterns: [checkbox-addon-picker, per-addon-premium-inputs, right-column-layout]
key_files:
  created: []
  modified:
    - apps/manager-dashboard/app/page.tsx
    - apps/ops-api/src/routes/index.ts
decisions:
  - Addon premiums tracked as separate React state (Record<string, string>) rather than extending form object
  - AD_D products included as addon candidates alongside ADDON type
  - addonPremiums sent as Record<productId, number> to API, stored on SaleAddon.premium field
metrics:
  completed: "2026-03-14"
  tasks_completed: 3
  tasks_total: 3
requirements: [COMM-04, COMM-07]
---

# Phase 2 Plan 4: Addon Product Picker UI Summary

Addon product checkboxes with per-addon premium inputs added to manager dashboard sales entry form, with API storage of per-addon premiums on SaleAddon records.

## What Was Done

### Task 1: Add addon product picker and per-addon premium inputs (3c4c5c1)
- Filtered products by ADDON and AD_D types as checkbox candidates below core Product dropdown
- Added checkbox rows with product name, type badge, and premium input for each selected addon
- Tracked per-addon premiums in separate state, included in form submission payload
- Built addon premiums payload (Record<productId, number>) sent alongside addonProductIds

### Task 2: Update API to accept and store per-addon premiums (dc86e28)
- Added `addonPremiums: z.record(z.string(), z.number().min(0)).default({})` to POST /sales Zod schema
- Updated Prisma addon creation to pass `premium: addonPremiums[id] ?? null` per SaleAddon record

### Task 3: Human verification checkpoint (approved)
- User verified addon picker UI works correctly
- Post-checkpoint layout refinements: moved receipt parser and addon picker to right column (821c0d6), added Premium label below addon checkbox (a21885b)

## Deviations from Plan

### Post-checkpoint layout improvements
- **821c0d6**: Receipt parser and addon checkboxes moved to right column layout for better form organization
- **a21885b**: Premium label added below addon checkbox to match core product styling consistency

These were user-driven refinements after checkpoint approval, not deviations from plan logic.

## Verification

- Manager dashboard build: passed
- API TypeScript compilation: passed
- Addon checkboxes visible below Product dropdown: verified by user
- Per-addon premium inputs shown for selected addons: verified by user
- Sale submission with addons creates SaleAddon records with premiums: verified by user

## Commits

| Commit | Message |
|--------|---------|
| 3c4c5c1 | feat(02-04): add addon product picker UI to sales entry form |
| dc86e28 | feat(02-04): accept and store per-addon premiums in POST /sales |
| 821c0d6 | feat(02-04): move receipt parser and addon picker to right column layout |
| a21885b | fix(02-04): add Premium label below addon checkbox matching core product style |

## Self-Check: PASSED

All files and commits verified.
