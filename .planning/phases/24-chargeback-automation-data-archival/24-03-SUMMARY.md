---
phase: 24-chargeback-automation-data-archival
plan: 03
subsystem: data-archival
tags: [archive, raw-sql, express, batch-processing]
dependency_graph:
  requires: [matchedSaleId-field, archive-tables]
  provides: [archive-service, archive-routes, preview-endpoint, restore-endpoint, stats-endpoint]
  affects: [owner-dashboard-config-ui]
tech_stack:
  added: []
  patterns: [raw-sql-batch-archive, separate-route-file]
key_files:
  created:
    - apps/ops-api/src/services/archive.ts
    - apps/ops-api/src/routes/archive.ts
  modified:
    - apps/ops-api/src/routes/index.ts
decisions:
  - Defined explicit column lists per table for safe restore (no SELECT *)
  - zodErr and asyncHandler duplicated in archive routes (index.ts defines them locally, no shared export)
  - Archive routes registered as first sub-router via router.use(archiveRoutes) in index.ts
metrics:
  duration: 280s
  completed: 2026-03-24
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 24 Plan 03: Archive Service & Routes Summary

Archive service with batched raw SQL operations (5000-row chunks) for archiving call_audits, convoso_call_logs, and app_audit_log, plus four Express endpoints for preview/archive/restore/stats with SUPER_ADMIN/OWNER_VIEW protection.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Create archive service with batch operations | 1db71fd | Done |
| 2 | Create archive routes and register in index | d67ab4b | Done |

## What Was Built

### Task 1: Archive Service
- `previewArchive(cutoffDate)` returns eligible row counts per table without modifying data
- `archiveRecords(cutoffDate, tables, userId)` moves rows via INSERT...SELECT + DELETE in BATCH_SIZE=5000 chunks
- FK safety: nulls `call_audit_id` on `convoso_call_logs` before archiving `call_audits`
- `restoreBatch(batchId, userId)` copies rows from archive back to main tables by batch ID
- `getArchiveStats()` returns row counts, date ranges, and up to 20 recent batches per table
- Both archive and restore operations log via `logAudit()` for audit trail
- Explicit column lists per table avoid SELECT * fragility during restore

### Task 2: Archive Routes
- `GET /archive/preview` with `cutoffDays` query param (default 90) for dry-run counts
- `POST /archive` with Zod-validated `{ cutoffDays, tables }` body to trigger archival
- `POST /archive/restore` with `{ batchId }` to restore a batch
- `GET /archive/stats` for archive table statistics and batch history
- All four routes gated by `requireAuth` + `requireRole("SUPER_ADMIN", "OWNER_VIEW")`
- Routes registered in index.ts as sub-router

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] No shared helpers.ts export file**
- **Found during:** Task 2
- **Issue:** Plan references `import { zodErr, asyncHandler } from "./helpers"` but helpers.ts does not exist; these functions are defined inline in index.ts
- **Fix:** Duplicated zodErr and asyncHandler definitions in archive.ts route file (same pattern as index.ts)
- **Files modified:** apps/ops-api/src/routes/archive.ts

## Verification Results

- `npx tsc --noEmit` passes for ops-api (no archive-specific errors)
- All 4 exported functions confirmed in archive service
- BATCH_SIZE = 5000 confirmed
- FK safety (call_audit_id = NULL) confirmed
- All 4 routes confirmed with SUPER_ADMIN/OWNER_VIEW role check
- Default cutoffDays = 90 confirmed (D-08)
- archiveRoutes import + router.use confirmed in index.ts

## Self-Check: PASSED

All files exist, all commits verified.
