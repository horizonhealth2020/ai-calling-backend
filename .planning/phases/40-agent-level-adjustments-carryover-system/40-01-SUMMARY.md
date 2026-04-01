---
phase: 40-agent-level-adjustments-carryover-system
plan: 01
subsystem: payroll
tags: [schema, migration, net-formula, approval-logic, print-view]
dependency_graph:
  requires: []
  provides: [AgentPeriodAdjustment-table, carryoverExecuted-flag, fixed-net-formula, halvingReason-preservation]
  affects: [payroll-service, payroll-routes, payroll-dashboard]
tech_stack:
  added: []
  patterns: [agent-period-adjustment-aggregation, reason-preservation-pattern]
key_files:
  created:
    - prisma/migrations/20260401000000_add_agent_period_adjustments/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/routes/payroll.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
    - apps/ops-api/src/services/__tests__/payroll-guard.test.ts
decisions:
  - "halvingReason always preserved regardless of commissionApproved; halving only applied when NOT approved"
  - "Fronted becomes additive in net formula (Commission + Bonus + Fronted - Hold)"
  - "Approval buttons driven by halvingReason presence, not enrollment fee threshold"
  - "Print pills positioned left of commission amount for column alignment"
metrics:
  duration: 5m 21s
  completed: 2026-04-01
---

# Phase 40 Plan 01: Schema + Bug Fixes Summary

AgentPeriodAdjustment table with unique agent+period constraint, data migration from entry-level values, net formula corrected to + fronted in 4 locations, halvingReason preserved after approval, approval buttons use halvingReason logic, print pills left of commission.

## Tasks Completed

### Task 1: Create AgentPeriodAdjustment schema + migration + data migration
- **Commit:** a92f9c0
- Added `AgentPeriodAdjustment` model with `@@unique([agentId, payrollPeriodId])` and `@@map("agent_period_adjustments")`
- Added `carryoverExecuted` boolean flag to `PayrollPeriod` for idempotent carryover
- Added reverse relations: `periodAdjustments` on Agent, `agentAdjustments` on PayrollPeriod
- Migration creates table, aggregates existing entry-level bonus/fronted/hold into new table, zeros out entry-level fields
- Prisma client regenerated

### Task 2: Fix net formula, halvingReason preservation, approval logic, and print pills
- **Commit:** 64c1b3b
- **Net formula (4 locations):** Changed `- fronted` to `+ fronted` in payroll service upsert, route PATCH handler, dashboard liveNet calc, and test
- **halvingReason preservation:** Removed `!sale.commissionApproved` guard from bundle check and enrollment fee reason-setting; halving now gated at final calculation line
- **Approval buttons:** Switched from `fee < 99` to `!!entry.halvingReason` for both entry-level and period-level filters
- **Print pills:** Moved `commFlagHtml` before `$amount` in template; changed `.pill` CSS from `margin-top: 2px` to `margin-right: 4px`
- **Test updated:** Net formula test expects 132 (100+10+5+20-3) instead of 92

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npx prisma validate` exits 0
- `npm run test:ops -- --testPathPattern=payroll-guard --bail` exits 0 (5/5 tests pass)
- Net formula confirmed: `bonus + fronted - hold` in payroll.ts
- Approval logic confirmed: `!!entry.halvingReason && !entry.sale?.commissionApproved` for needsApproval
- Print pills confirmed: `${commFlagHtml}$${Number(e.payoutAmount)` (pill before amount)

## Self-Check: PASSED

All 6 modified/created files verified on disk. Both commits (a92f9c0, 64c1b3b) verified in git log.
