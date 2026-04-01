---
phase: 20-state-aware-bundle-requirements
plan: "01"
subsystem: schema
tags: [prisma, migration, types, schema]
dependency_graph:
  requires: []
  provides: [ProductStateAvailability, Product-FK-fields, PayrollEntry-halvingReason, US_STATES-constant]
  affects: [commission-engine, api-routes, config-ui, sales-entry]
tech_stack:
  added: []
  patterns: [self-referencing-FK, join-table-with-unique-constraint]
key_files:
  created:
    - prisma/migrations/20260323154234_bundle_requirements/migration.sql
    - packages/types/src/us-states.ts
  modified:
    - prisma/schema.prisma
    - packages/types/src/index.ts
decisions:
  - Manual migration SQL created (no live database for prisma migrate dev)
  - US_STATES placed in @ops/types (not @ops/utils) for type co-location
  - FIX-02 confirmed as no-op (no seed agents exist)
metrics:
  duration: 145s
  completed: "2026-03-23T19:44:00Z"
  tasks: 2
  files: 4
---

# Phase 20 Plan 01: Schema Migration + US States Constant Summary

Prisma schema extended with Product self-referencing FKs (requiredBundleAddonId, fallbackBundleAddonId), ProductStateAvailability join table with unique(productId, stateCode), PayrollEntry halvingReason field, and US_STATES constant with 51 entries exported from @ops/types.

## What Was Done

### Task 1: Prisma Schema Migration
- Added `requiredBundleAddonId` and `fallbackBundleAddonId` optional FK fields on Product model with self-referencing relations (`RequiredBundleAddon`, `FallbackBundleAddon`)
- Added reverse relations (`coreProductsRequiring`, `coreProductsFallback`) required by Prisma
- Added `stateAvailability` relation to ProductStateAvailability
- Created `ProductStateAvailability` model with `id`, `productId`, `stateCode` (VarChar(2)), `createdAt`, unique constraint on `[productId, stateCode]`, mapped to `product_state_availability`
- Added `halvingReason` nullable String to PayrollEntry model, mapped to `halving_reason`
- Created migration SQL with ALTER TABLE for products and payroll_entries, CREATE TABLE for product_state_availability, foreign keys, and unique index
- Prisma validate passes, client generated successfully
- **Commit:** `03926d1`

### Task 2: US_STATES Constant + FIX-02 Verification
- Created `packages/types/src/us-states.ts` with 51 entries (50 states + DC) as `const` assertion
- Exported `StateCode` type derived from the array literal types
- Added re-export from `packages/types/src/index.ts`
- Verified 51 entries via count
- **FIX-02 verified as no-op:** Searched entire codebase for "Amy", "Bob", "Cara", "David", "Elena" -- zero matches found. The seed script (`prisma/seed.ts`) only seeds 4 users (no agents).
- **Commit:** `1428479`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual migration SQL instead of prisma migrate dev**
- **Found during:** Task 1
- **Issue:** No running PostgreSQL database in this environment; `prisma migrate dev` requires a live connection
- **Fix:** Manually created the migration SQL file matching what Prisma would generate, with correct ALTER TABLE and CREATE TABLE statements
- **Files modified:** `prisma/migrations/20260323154234_bundle_requirements/migration.sql`
- **Impact:** Migration must be applied via `prisma migrate deploy` when database is available

## Decisions Made

1. **Manual migration SQL creation** -- No live database available; SQL written to match Prisma's expected output format
2. **US_STATES in @ops/types** -- Co-locates StateCode type with other shared types (AppRole, SessionUser)
3. **FIX-02 is a no-op** -- No seed agents to remove; codebase confirmed clean

## Self-Check: PASSED

- [x] `prisma/schema.prisma` contains `requiredBundleAddonId`
- [x] `prisma/schema.prisma` contains `fallbackBundleAddonId`
- [x] `prisma/schema.prisma` contains `model ProductStateAvailability`
- [x] `prisma/schema.prisma` contains `halvingReason`
- [x] Migration file exists at `prisma/migrations/20260323154234_bundle_requirements/migration.sql`
- [x] `packages/types/src/us-states.ts` exists with 51 entries
- [x] `packages/types/src/index.ts` re-exports US_STATES and StateCode
- [x] Commits `03926d1` and `1428479` exist
