---
phase: 20-state-aware-bundle-requirements
plan: "03"
subsystem: api-routes
tags: [express, zod, prisma, api, bundle-requirements, state-availability]
dependency_graph:
  requires: [ProductStateAvailability, Product-FK-fields]
  provides: [bundle-requirement-api, state-availability-api, product-relations-api]
  affects: [config-ui, commission-preview]
tech_stack:
  added: []
  patterns: [transactional-bulk-replace, relation-includes]
key_files:
  created: []
  modified:
    - apps/ops-api/src/routes/index.ts
decisions:
  - GET /products includes requiredBundleAddon, fallbackBundleAddon, stateAvailability relations (config UI needs this data)
  - State availability PUT uses transactional deleteMany + createMany (idempotent bulk replace)
  - GET state-availability returns flat array of state codes (not objects) for simpler client consumption
metrics:
  duration: 97s
  completed: "2026-03-23T19:50:00Z"
  tasks: 1
  files: 1
---

# Phase 20 Plan 03: Bundle Requirement & State Availability API Routes Summary

Extended product CRUD with bundle FK fields and added GET/PUT state-availability endpoints with Zod validation and transactional bulk replace.

## What Was Done

### Task 1: Extend product PATCH/POST/GET with bundle fields, add state-availability endpoints

- **GET /products** updated to include `requiredBundleAddon` (id, name), `fallbackBundleAddon` (id, name), and `stateAvailability` (stateCode) relations
- **POST /products** Zod schema extended with `requiredBundleAddonId: z.string().nullable().optional()` and `fallbackBundleAddonId: z.string().nullable().optional()`
- **PATCH /products/:id** Zod schema extended with same two bundle FK fields
- **GET /products/:id/state-availability** added: returns sorted array of 2-char state codes for a product, uses `requireAuth`
- **PUT /products/:id/state-availability** added: validates `stateCodes` array with `z.string().length(2).regex(/^[A-Z]{2}$/)`, max 51 entries, verifies product exists (404 if not), uses `prisma.$transaction` with `deleteMany` + `createMany` for idempotent bulk replace, returns sorted state codes array
- PUT endpoint gated with `requireRole("PAYROLL", "SUPER_ADMIN")`
- TypeScript compiles (no new errors from changes)
- All 90 tests pass (no regressions)
- **Commit:** `bbd2243`

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. **Flat state code array return** -- GET and PUT state-availability return `["AL", "AK", ...]` instead of objects, matching plan spec and simplifying client consumption
2. **Product existence check before transaction** -- PUT validates product exists before attempting state availability replacement to provide clear 404 error

## Self-Check: PASSED

- [x] `apps/ops-api/src/routes/index.ts` PATCH /products/:id Zod schema contains `requiredBundleAddonId: z.string().nullable().optional()`
- [x] `apps/ops-api/src/routes/index.ts` PATCH /products/:id Zod schema contains `fallbackBundleAddonId: z.string().nullable().optional()`
- [x] `apps/ops-api/src/routes/index.ts` GET /products includes `requiredBundleAddon:` in findMany include
- [x] `apps/ops-api/src/routes/index.ts` GET /products includes `stateAvailability:` in findMany include
- [x] `apps/ops-api/src/routes/index.ts` contains `router.get("/products/:id/state-availability"`
- [x] `apps/ops-api/src/routes/index.ts` contains `router.put("/products/:id/state-availability"`
- [x] PUT endpoint contains `prisma.$transaction([` with deleteMany + createMany
- [x] PUT endpoint Zod schema contains `z.string().length(2).regex(/^[A-Z]{2}$/)`
- [x] PUT endpoint checks product exists before transaction (404 if missing)
- [x] PUT endpoint uses `requireRole("PAYROLL", "SUPER_ADMIN")`
- [x] Commit `bbd2243` exists
