---
phase: 15-resolution-polish
plan: 01
subsystem: ops-api
tags: [resolution, chargebacks, pending-terms, api, prisma]
dependency_graph:
  requires: [14-01, 14-02]
  provides: [resolution-endpoints, resolution-schema]
  affects: [cs-dashboard, chargeback-tracking, pending-term-tracking]
tech_stack:
  added: []
  patterns: [resolve/unresolve PATCH pattern, Promise.all aggregation]
key_files:
  created:
    - prisma/migrations/20260318_add_resolution_fields/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/routes/index.ts
decisions:
  - Chargeback resolution types are "recovered" and "closed"
  - Pending term resolution types are "saved" and "cancelled"
  - Resolution endpoints require CUSTOMER_SERVICE, SUPER_ADMIN, or OWNER_VIEW roles
  - Total Recovered KPI aggregates only chargebacks with resolutionType="recovered"
metrics:
  duration: 206s
  completed: "2026-03-18T15:59:34Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 15 Plan 01: Resolution Backend Infrastructure Summary

Resolution fields on ChargebackSubmission and PendingTerm models with resolve/unresolve PATCH endpoints and live totalRecovered KPI aggregation.

## What Was Done

### Task 1: Add resolution fields to Prisma schema and run migration
- Added `resolvedAt`, `resolvedBy`, `resolutionNote`, `resolutionType` to ChargebackSubmission model
- Added same four fields to PendingTerm model
- Added `resolver` User relation on both models (ChargebackResolvedBy, PendingTermResolvedBy)
- Added `resolvedChargebacks` and `resolvedPendingTerms` reverse relations on User model
- Created migration SQL with foreign key constraints
- Commit: `3a92079`

### Task 2: Add resolve/unresolve API endpoints, update totals, fix ROLE_ENUM
- Added `CUSTOMER_SERVICE` to ROLE_ENUM Zod schema (enables role assignment via admin API)
- Added `PATCH /chargebacks/:id/resolve` -- accepts `resolutionType` (recovered|closed) and `resolutionNote`
- Added `PATCH /chargebacks/:id/unresolve` -- clears all four resolution fields to null
- Added `PATCH /pending-terms/:id/resolve` -- accepts `resolutionType` (saved|cancelled) and `resolutionNote`
- Added `PATCH /pending-terms/:id/unresolve` -- clears all four resolution fields to null
- Updated `GET /chargebacks/totals` to calculate `totalRecovered` from chargebacks where `resolutionType="recovered"`
- Updated `GET /chargebacks` and `GET /pending-terms` to include resolver name via Prisma include
- Commit: `20dc64f`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed recoveredResult._sum possibly undefined**
- **Found during:** Task 2
- **Issue:** TypeScript flagged `recoveredResult._sum.chargebackAmount` as possibly undefined
- **Fix:** Added optional chaining: `recoveredResult._sum?.chargebackAmount`
- **Files modified:** apps/ops-api/src/routes/index.ts
- **Commit:** 20dc64f

## Verification Results

- Prisma schema validates successfully (`npx prisma format` passes)
- Prisma client regenerated with new fields
- TypeScript compilation passes (only pre-existing errors remain: bcryptjs/jsonwebtoken types, PayrollEntry `period` include)
- All 4 PATCH endpoints present in routes file
- Totals endpoint uses `resolutionType: "recovered"` filter
- ROLE_ENUM includes CUSTOMER_SERVICE

## Self-Check: PASSED

- All key files exist on disk
- Both task commits verified: 3a92079, 20dc64f
