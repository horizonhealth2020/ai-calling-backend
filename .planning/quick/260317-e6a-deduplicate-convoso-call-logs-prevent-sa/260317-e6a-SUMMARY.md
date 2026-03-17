---
phase: quick
plan: 260317-e6a
subsystem: convoso-kpi
tags: [deduplication, poller, convoso, kpi]
dependency_graph:
  requires: [convoso-call-logs-service, agent-call-kpi-table]
  provides: [processed-convoso-calls-tracking, deduplicated-kpi-polling]
  affects: [convosoKpiPoller]
tech_stack:
  added: []
  patterns: [batch-dedup-with-tracking-table, 30-day-ttl-cleanup]
key_files:
  created:
    - prisma/manual-migrations/add_processed_convoso_call.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/workers/convosoKpiPoller.ts
decisions:
  - No FK to LeadSource on ProcessedConvosoCall (minimal coupling, convosoCallId is source of truth)
  - 30-day TTL for cleanup (balances storage vs dedup window)
  - skipDuplicates on createMany for race condition safety
metrics:
  duration: 109s
  completed: "2026-03-17T14:18:01Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Quick Task 260317-e6a: Deduplicate Convoso Call Logs Summary

ProcessedConvosoCall tracking table with unique constraint on convosoCallId, dedup filtering in KPI poller before aggregation, and automatic 30-day cleanup of tracking records.

## Task Results

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Add ProcessedConvosoCall model and migration | eaf2e26 | Done |
| 2 | Deduplicate poller and add 30-day cleanup | b422e4b | Done |

## What Was Built

### ProcessedConvosoCall Model
- New Prisma model with `convosoCallId` unique constraint
- `leadSourceId` optional field for debugging context
- `processedAt` indexed for efficient 30-day cleanup queries
- Manual migration SQL ready for deployment

### Deduplicated KPI Poller
- Before KPI aggregation, queries existing processed call IDs in a single batch
- Filters raw Convoso results to only new (unprocessed) calls
- Returns early with 0 if all calls already processed
- After successful `agentCallKpi.createMany`, batch-inserts new call IDs with `skipDuplicates: true`
- Structured JSON logging for dedup stats (totalFetched, alreadyProcessed, newCalls)

### 30-Day Cleanup
- Runs at end of each poll cycle after all lead sources processed
- Deletes ProcessedConvosoCall records older than 30 days
- Error handling isolates cleanup failures from poll cycle
- Logs cleanup count when records deleted

## Deviations from Plan

None - plan executed exactly as written.

## Verification

1. Prisma schema validates successfully
2. No TypeScript errors in changed files (pre-existing errors in other files unrelated)
3. Manual migration SQL file exists with correct DDL
4. Poller uses `prisma.processedConvosoCall` for dedup, tracking, and cleanup

## Self-Check: PASSED
