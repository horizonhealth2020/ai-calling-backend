---
phase: 12-chargeback-parser
plan: 01
subsystem: api-schema
tags: [prisma, migration, express, api, chargebacks, rep-roster]
dependency_graph:
  requires: [ChargebackSubmission-model]
  provides: [CsRepRoster-model, assigned_to-field, chargeback-api, rep-roster-api]
  affects: [ops-api, cs-dashboard]
tech_stack:
  added: []
  patterns: [createMany-bulk-insert, aggregate-query, on-access-pruning]
key_files:
  created:
    - prisma/migrations/20260317_add_cs_rep_roster/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/routes/index.ts
decisions:
  - "assignedTo is nullable String (no FK to CsRepRoster -- uses name-based assignment for flexibility)"
  - "Weekly total uses getSundayWeekRange for consistent Sun-Sat week boundaries"
  - "Inactive rep pruning runs on-access (GET /cs-rep-roster) after 30 days"
metrics:
  duration: 140s
  completed: "2026-03-17T17:41:33Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 12 Plan 01: Chargeback API & Rep Roster Backend Summary

CsRepRoster model and assigned_to field added to Prisma schema with migration SQL, plus 6 API endpoints for submitting chargebacks, fetching weekly totals, and full CRUD on rep roster.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Add assigned_to field and CsRepRoster model to Prisma schema with migration | 7bb65bc | Done |
| 2 | Implement 6 API endpoints for chargebacks and rep roster | 3a656f9 | Done |

## What Was Built

### Task 1: Schema & Migration
- Added `assignedTo String? @map("assigned_to")` to ChargebackSubmission model
- Created `CsRepRoster` model with id, name, active, timestamps mapped to `cs_rep_roster`
- Migration SQL: ALTER TABLE adds `assigned_to` column, CREATE TABLE for `cs_rep_roster`
- Prisma validate passes

### Task 2: API Endpoints
- **POST /api/chargebacks** -- Bulk submit chargeback records with Zod validation, requires SUPER_ADMIN or OWNER_VIEW role, uses createMany for batch insert
- **GET /api/chargebacks/weekly-total** -- Aggregate sum of chargeback_amount and count for current Sun-Sat window using getSundayWeekRange
- **GET /api/cs-rep-roster** -- List all reps with on-access pruning of inactive reps older than 30 days
- **POST /api/cs-rep-roster** -- Create rep with name validation (1-100 chars)
- **PATCH /api/cs-rep-roster/:id** -- Toggle rep active status
- **DELETE /api/cs-rep-roster/:id** -- Remove rep, returns 204

All endpoints use asyncHandler, Zod validation with zodErr, and requireAuth middleware.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client regeneration required**
- **Found during:** Task 2 verification
- **Issue:** TypeScript could not find `chargebackSubmission` and `csRepRoster` on PrismaClient because client was generated before schema changes
- **Fix:** Ran `npx prisma generate` to regenerate client with new models
- **Files modified:** node_modules/@prisma/client (generated, not committed)

## Self-Check: PASSED
