---
phase: 22-owner-payroll-enhancements
plan: 01
subsystem: owner-dashboard, ops-api
tags: [owner, payroll, socket-io, reporting]
dependency_graph:
  requires: []
  provides: [csPayrollTotal-api, service-payroll-socket-event, owner-service-payroll-column]
  affects: [owner-dashboard, reporting-periods-endpoint]
tech_stack:
  added: []
  patterns: [socket-event-driven-refresh, separate-aggregation-query]
key_files:
  created: []
  modified:
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-api/src/socket.ts
    - apps/ops-api/src/routes/service.ts
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx
decisions:
  - Separate monthly CS payroll query instead of modifying complex raw SQL join
  - Server-side refetch on socket event rather than optimistic client patching
  - Amber/warning color for Service Payroll column to distinguish from teal commission
metrics:
  duration: 2m
  completed: "2026-03-24T17:18:46Z"
---

# Phase 22 Plan 01: Owner Service Payroll Visibility Summary

CS (service staff) payroll totals surfaced on owner dashboard period summary table with real-time Socket.IO updates for both weekly and monthly views.

## What Was Done

### Task 1: Add csPayrollTotal to reporting/periods API and create Socket.IO emitter
**Commit:** `0357370`

- Extended weekly `/api/reporting/periods` to include `serviceEntries` in Prisma findMany and compute `csPayrollTotal` sum with `Number()` conversion for Prisma Decimal safety
- Added separate monthly CS payroll aggregation query (`service_payroll_entries JOIN payroll_periods`) merged into monthly response via Map lookup
- Exported `ServicePayrollChangedPayload` interface and `emitServicePayrollChanged` function from `socket.ts` emitting `service-payroll:changed` event
- Added import and emit calls in `service.ts` POST and PATCH handlers (emitted after HTTP response)

### Task 2: Add Service Payroll column and Socket.IO listener to owner dashboard
**Commit:** `6af6691`

- Added `csPayrollTotal: number` to `PeriodSummary` type
- Added "Service Payroll" column header and data cell with `colors.warning` (amber) styling
- Updated empty state `colSpan` from 5/4 to 6/5 for the new column
- Added `useEffect` Socket.IO listener for `service-payroll:changed` that refetches period data

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Separate monthly CS payroll query | Avoids modifying the complex existing raw SQL join which could introduce errors |
| Full refetch on socket event | csPayrollTotal is a server-computed aggregate; optimistic patching would require duplicating business logic |
| Amber/warning color for column | Visual distinction from teal commission column, consistent with existing warning color usage |

## Verification Results

All acceptance criteria verified via grep:
- `csPayrollTotal` appears in both weekly map callback and monthly merge in sales.ts
- `serviceEntries` with `select: { totalPay: true }` in findMany include
- `service_payroll_entries` in monthly raw SQL query
- `Number(se.totalPay)` confirms Decimal conversion
- `ServicePayrollChangedPayload` and `emitServicePayrollChanged` exported from socket.ts
- `emitServicePayrollChanged` called in both POST and PATCH handlers in service.ts
- `service-payroll:changed` event consistent between emitter and listener
- Service Payroll column header and data cell in OwnerOverview.tsx
- colSpan updated to 6/5

## Self-Check: PASSED
