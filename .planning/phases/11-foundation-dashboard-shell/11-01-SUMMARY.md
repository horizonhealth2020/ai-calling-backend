---
phase: 11-foundation-dashboard-shell
plan: 01
subsystem: database-schema
tags: [prisma, migration, roles, schema]
dependency_graph:
  requires: []
  provides: [ChargebackSubmission-model, PendingTerm-model, CUSTOMER_SERVICE-role]
  affects: [ops-api, packages-types, cs-dashboard]
tech_stack:
  added: []
  patterns: [prisma-model-mapping, relation-naming, date-only-column]
key_files:
  created:
    - prisma/migrations/20260317_add_cs_tables/migration.sql
  modified:
    - prisma/schema.prisma
    - packages/types/src/index.ts
decisions:
  - "holdDate uses @db.Date for DATE-only PostgreSQL type (no time component needed)"
  - "agentIdField mapped to agent_id_field to avoid FK naming confusion"
  - "rawPaste is non-nullable (always required on paste submission)"
metrics:
  duration: 95s
  completed: "2026-03-17T15:28:44Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 11 Plan 01: Schema & Role Foundation Summary

Prisma schema extended with ChargebackSubmission (18 data fields) and PendingTerm (22 data fields) models, CUSTOMER_SERVICE added to both UserRole enum and AppRole type, migration SQL created for both tables with FK constraints.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Add ChargebackSubmission and PendingTerm Prisma models with CUSTOMER_SERVICE role | 7adad23 | Done |
| 2 | Create migration SQL for new tables and role enum value | bf35c33 | Done |

## What Was Built

### Task 1: Prisma Models and Role Extension
- Added `CUSTOMER_SERVICE` to `UserRole` enum in `prisma/schema.prisma`
- Added `ChargebackSubmission` model with 18 data fields, submitter relation, mapped to `chargeback_submissions`
- Added `PendingTerm` model with 22 data fields, submitter relation, mapped to `pending_terms`
- Added `chargebackSubmissions` and `pendingTermSubmissions` relation fields to `User` model
- Updated `AppRole` type in `packages/types/src/index.ts` to include `"CUSTOMER_SERVICE"`
- `prisma validate` passes successfully

### Task 2: Migration SQL
- Created `prisma/migrations/20260317_add_cs_tables/migration.sql`
- `ALTER TYPE "UserRole" ADD VALUE 'CUSTOMER_SERVICE'`
- `CREATE TABLE "chargeback_submissions"` with all columns matching Prisma model
- `CREATE TABLE "pending_terms"` with `hold_date` as `DATE` type (not TIMESTAMP)
- Two FK constraints referencing `users(id)` following Prisma naming convention

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `prisma validate` exits with code 0
- Migration SQL file exists at correct path
- `packages/types/src/index.ts` includes CUSTOMER_SERVICE in AppRole
- Prisma schema UserRole enum includes CUSTOMER_SERVICE
- Both new models have all required columns per SCHEMA-01 and SCHEMA-02

## Self-Check: PASSED

All created files verified on disk. All commit hashes (7adad23, bf35c33) confirmed in git log.
