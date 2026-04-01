---
phase: 24-chargeback-automation-data-archival
plan: 01
subsystem: data-layer
tags: [prisma, migration, schema, socket.io, chargeback]
dependency_graph:
  requires: []
  provides: [matchedSaleId-field, matchStatus-field, archive-tables, emitClawbackCreated]
  affects: [chargebacks.ts, alerts.ts, archive-service]
tech_stack:
  added: []
  patterns: [prisma-raw-sql-archive, socket-emit-pattern]
key_files:
  created:
    - prisma/migrations/20260324000000_chargeback_matching_and_archive/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/socket.ts
decisions:
  - Single migration file for matching fields + all 3 archive tables
  - Archive tables use no FK constraints (data snapshots only)
  - ClawbackCreatedPayload follows AlertCreatedPayload pattern
metrics:
  duration: 141s
  completed: 2026-03-24
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 24 Plan 01: Schema & Socket Foundation Summary

Prisma schema extended with matchedSaleId FK and matchStatus on ChargebackSubmission, migration creates 3 archive tables (call_audits_archive, convoso_call_logs_archive, app_audit_log_archive) with archived_at/archive_batch_id columns, and emitClawbackCreated socket emitter added.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Add matching fields to Prisma schema and create migration | 02dcf1f | Done |
| 2 | Add emitClawbackCreated to socket.ts | f05efd2 | Done |

## What Was Built

### Task 1: Schema + Migration
- Added `matchedSaleId` (String?, FK to Sale) and `matchStatus` (String?) fields to ChargebackSubmission model
- Added `matchedChargebacks` back-relation on Sale model
- Created migration with ALTER TABLE for chargeback_submissions and CREATE TABLE for 3 archive tables
- Archive tables mirror main table columns but drop all FK constraints
- Each archive table has `archived_at TIMESTAMPTZ` and `archive_batch_id TEXT NOT NULL` columns
- Indexes on `archive_batch_id` and `created_at` for each archive table
- `npx prisma validate` passes, `npx prisma generate` updates client types

### Task 2: Socket Emitter
- Added `ClawbackCreatedPayload` interface with clawbackId, saleId, agentName?, amount fields
- Added `emitClawbackCreated()` function emitting "clawback:created" event
- Follows exact same pattern as existing `emitAlertCreated()`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx prisma validate` exits 0
- grep confirms matchedSaleId, matchStatus, matchedSale, matchedChargebacks in schema
- Migration SQL contains all 3 CREATE TABLE statements and ALTER TABLE for matching fields
- grep confirms emitClawbackCreated export, ClawbackCreatedPayload interface, "clawback:created" event name

## Self-Check: PASSED

All files exist, all commits verified.
