---
phase: 40-agent-level-adjustments-carryover-system
plan: 02
subsystem: payroll
tags: [carryover, service, crud, idempotent, tdd]
dependency_graph:
  requires: [AgentPeriodAdjustment-table, carryoverExecuted-flag]
  provides: [executeCarryover-function, adjustment-crud-endpoints, carryover-on-lock]
  affects: [payroll-routes, payroll-periods-api]
tech_stack:
  added: []
  patterns: [idempotent-carryover, increment-upsert, tdd-red-green]
key_files:
  created:
    - apps/ops-api/src/services/carryover.ts
    - apps/ops-api/src/services/__tests__/carryover.test.ts
  modified:
    - apps/ops-api/src/routes/payroll.ts
decisions:
  - "Carryover executes on period lock with try/catch to avoid failing the lock operation"
  - "Carryover uses increment-based upsert to add to existing hold values"
  - "POST /payroll/adjustments uses upsert on agentId+payrollPeriodId compound key"
metrics:
  duration: 3m 41s
  completed: 2026-04-01
---

# Phase 40 Plan 02: Carryover Service + Adjustment CRUD Summary

Carryover service with idempotent period lock execution and three CRUD endpoints for agent period adjustments.

## What Was Built

### Task 1: Carryover service with tests (TDD)
**Commit:** `4ad107b`

Created `executeCarryover` function that runs on period lock:
- Loads period with agentAdjustments and entries
- Skips if `carryoverExecuted` is already true (CARRY-06 idempotency)
- Calculates next period via `getSundayWeekRange` and auto-creates it
- For each agent adjustment: carries fronted as hold (D-09), carries negative net as hold (D-10)
- Uses `prisma.agentPeriodAdjustment.upsert` with `increment` to add to existing values (CARRY-07)
- Marks period as `carryoverExecuted: true` after completion

6 unit tests covering:
- CARRY-02: Fronted auto-carries as hold (200 fronted creates 200 hold in next period)
- CARRY-03: Negative net carries on top of fronted (fronted=100, net=-250, carry=350)
- CARRY-06: Idempotent skip when carryoverExecuted=true
- CARRY-07: Increment-based update (adds, does not overwrite)
- No carryover when fronted=0 and net >= 0
- No carryover when period has no adjustments

### Task 2: Wire carryover into period lock + adjustment CRUD
**Commit:** `0f3bd0b`

Period lock integration:
- `executeCarryover` called when status changes to LOCKED
- Wrapped in try/catch so lock operation succeeds even if carryover fails
- Audit log entry created with carried count and skipped flag

Three new endpoints:
- `GET /payroll/adjustments/:periodId` -- fetch all adjustments for a period
- `PATCH /payroll/adjustments/:id` -- edit adjustment values (CARRY-04: bonusAmount, frontedAmount, holdAmount, bonusLabel, holdLabel)
- `POST /payroll/adjustments` -- create/upsert adjustment for agent+period using compound key

GET /payroll/periods now includes `agentAdjustments` with agent name in response.

## Deviations from Plan

None -- plan executed exactly as written.

## Out-of-Scope Issues Found

Pre-existing test failure in `commission.test.ts` ("commissionApproved bypasses state halving" expects halvingReason to be null when commissionApproved=true, but Plan 01 changed behavior to always preserve halvingReason). This test needs updating to reflect the new behavior from Plan 01.

## Requirements Addressed

| Requirement | Status |
|-------------|--------|
| CARRY-02 | Fronted auto-carries as hold -- implemented and tested |
| CARRY-03 | Negative net carries as hold -- implemented and tested |
| CARRY-04 | Carryover amounts editable via PATCH endpoint -- implemented |
| CARRY-06 | Carryover idempotent via carryoverExecuted flag -- implemented and tested |
| CARRY-07 | Carryover adds to existing values via increment -- implemented and tested |
