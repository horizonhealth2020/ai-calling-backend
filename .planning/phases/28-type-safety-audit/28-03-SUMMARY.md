---
phase: 28-type-safety-audit
plan: 03
subsystem: ops-api
tags: [gap-closure, error-handling, dead-code]
dependency_graph:
  requires: []
  provides: [EH-04, DC-02]
  affects: [ops-api]
tech_stack:
  added: []
  patterns: [try-catch-fire-and-forget]
key_files:
  created: []
  modified:
    - apps/ops-api/src/socket.ts
    - apps/ops-api/src/routes/helpers.ts
decisions:
  - Preserved all Phase 28 type annotations while restoring try/catch wrappers
  - Confirmed handlePrismaError has zero consumers before removal
metrics:
  duration: 2m
  completed: "2026-03-25T17:49:00Z"
---

# Phase 28 Plan 03: Gap Closure - Socket.IO Try/Catch and Orphaned Export Summary

Restored try/catch wrappers to all 10 Socket.IO emit functions (EH-04 regression from worktree merge) and removed orphaned handlePrismaError export with its unused Prisma import (DC-02).

## Task Results

| Task | Name | Status | Commit | Key Files |
|------|------|--------|--------|-----------|
| 1 | Restore try/catch wrappers in all 10 Socket.IO emit functions | Done | f73548a | apps/ops-api/src/socket.ts |
| 2 | Remove orphaned handlePrismaError export from helpers.ts | Done | b8d849f | apps/ops-api/src/routes/helpers.ts |

## Changes Made

### Task 1: Socket.IO try/catch restoration

Added try/catch blocks around all 10 `io?.emit()` calls in socket.ts. Each catch block logs the error with `console.error` identifying the event name, then swallows the error (fire-and-forget pattern per D-10 decision). All Phase 28 type annotations (typed payloads, interfaces, Record<string, unknown>) preserved exactly.

Functions wrapped: emitAuditStarted, emitAuditStatus, emitAuditComplete, emitAuditFailed, emitSaleChanged, emitCSChanged, emitAlertCreated, emitAlertResolved, emitServicePayrollChanged, emitClawbackCreated.

### Task 2: handlePrismaError removal

Removed the `handlePrismaError` function (27 lines) and its `import { Prisma } from "@prisma/client"` line. Confirmed zero consumers across the entire codebase before removal. All other exports (zodErr, asyncHandler, isPrismaError, dateRange, dateRangeQuerySchema, idParamSchema, booleanQueryParam) remain intact.

## Verification Results

- `grep -c "catch" apps/ops-api/src/socket.ts` = 10 (PASS)
- `grep -c "io?.emit" apps/ops-api/src/socket.ts` = 10 (PASS)
- `grep -c "console.error" apps/ops-api/src/socket.ts` = 10 (PASS)
- `grep "handlePrismaError" apps/ops-api/src/routes/helpers.ts` = 0 matches (PASS)
- `grep 'from "@prisma/client"' apps/ops-api/src/routes/helpers.ts` = 0 matches (PASS)
- Pre-existing tsc errors unchanged; no new type errors introduced

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. Preserved all Phase 28 type annotations while adding try/catch -- no type changes needed
2. Confirmed handlePrismaError had zero consumers before removal (grep across full codebase)
