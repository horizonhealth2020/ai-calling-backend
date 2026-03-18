---
phase: 18-platform-polish-integration
plan: 04
subsystem: alerts-pipeline
tags: [chargeback, payroll-alert, socket-io, real-time]
dependency_graph:
  requires: [18-01]
  provides: [alert-service, alert-routes, cs-socket-refresh]
  affects: [payroll-dashboard, cs-dashboard, ops-api]
tech_stack:
  added: []
  patterns: [socket-io-additional-handlers, alert-lifecycle]
key_files:
  created:
    - apps/ops-api/src/services/alerts.ts
  modified:
    - apps/ops-api/src/routes/index.ts
    - apps/payroll-dashboard/app/page.tsx
    - apps/cs-dashboard/app/page.tsx
    - apps/cs-dashboard/package.json
    - apps/cs-dashboard/next.config.js
decisions:
  - Used createMany + post-query by batchId to create alerts (createMany does not return individual records)
  - Alert table uses open periods from any agent or all periods as fallback when agentId is null
  - CS dashboard auto-refreshes all data on cs:changed (simple refetch pattern vs granular patching)
metrics:
  duration: 7m
  completed: "2026-03-18T21:57:00Z"
  tasks_completed: 2
  tasks_total: 2
requirements:
  - CS-01
  - CS-04
---

# Phase 18 Plan 04: Chargeback Alert Pipeline Summary

Chargeback-to-payroll alert pipeline with Socket.IO real-time updates across CS and payroll dashboards.

## What Was Built

### Task 1: Alert service + API routes + CS Socket.IO emission (4ad0780)

**Alert Service** (`apps/ops-api/src/services/alerts.ts`):
- `createAlertFromChargeback()` -- creates PayrollAlert record and emits `alert:created` via Socket.IO
- `getPendingAlerts()` -- fetches PENDING alerts with chargeback include
- `approveAlert()` -- validates period is OPEN, creates Clawback, updates alert to APPROVED, emits `alert:resolved`, logs audit
- `clearAlert()` -- updates alert to CLEARED, emits `alert:resolved`, logs audit

**API Routes** added to `routes/index.ts`:
- `GET /alerts` -- pending payroll alerts (PAYROLL, SUPER_ADMIN)
- `POST /alerts/:id/approve` -- approve with periodId, creates clawback (PAYROLL, SUPER_ADMIN)
- `POST /alerts/:id/clear` -- dismiss alert permanently (PAYROLL, SUPER_ADMIN)
- `GET /alerts/agent-periods/:agentId` -- unpaid open periods for approve dropdown (PAYROLL, SUPER_ADMIN)

**Chargeback/Pending Term Wiring**:
- POST /chargebacks now creates PayrollAlert for each chargeback with amount + emits `cs:changed`
- POST /pending-terms now emits `cs:changed`
- PATCH /chargebacks/:id/resolve and /pending-terms/:id/resolve emit `cs:changed`

### Task 2: PayrollAlertTable + CS dashboard Socket.IO (be9b518)

**Payroll Dashboard** (`apps/payroll-dashboard/app/page.tsx`):
- Chargeback alert table rendered above payroll period cards
- Red left border accent with "Chargeback Alerts" header and badge pill count
- Table: Agent Name, Customer, Amount, Date Submitted, Actions
- Approve button opens period dropdown (fetched from `/alerts/agent-periods/:agentId`)
- Clear button with confirmation dialog
- Socket.IO `alert:created` handler re-fetches alerts and highlights new rows
- Socket.IO `alert:resolved` handler removes alert from state
- Empty state: "No pending alerts. Chargeback alerts will appear here when submitted from the CS dashboard."

**CS Dashboard** (`apps/cs-dashboard/app/page.tsx`):
- Added `@ops/socket` dependency and transpile config
- `useSocket` with `cs:changed` handler triggers `fetchData()` for auto-refresh
- Disconnect banner displayed when connection is lost

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Toast argument order**
- **Found during:** Task 2 TypeScript check
- **Issue:** Toast function signature is `toast(type, message)` not `toast(message, type)`
- **Fix:** Reversed argument order in all 4 toast calls
- **Files modified:** apps/payroll-dashboard/app/page.tsx

**2. [Rule 1 - Bug] Missing bgCard color token**
- **Found during:** Task 2 TypeScript check
- **Issue:** `C.bgCard` does not exist in design tokens
- **Fix:** Changed to `C.bgSurface`
- **Files modified:** apps/payroll-dashboard/app/page.tsx

**3. [Rule 3 - Blocking] Missing @ops/socket in CS dashboard**
- **Found during:** Task 2
- **Issue:** CS dashboard did not have @ops/socket as dependency or in transpilePackages
- **Fix:** Added to package.json and next.config.js
- **Files modified:** apps/cs-dashboard/package.json, apps/cs-dashboard/next.config.js

## Verification

- `cd apps/ops-api && npx tsc --noEmit` -- passes (pre-existing errors only, none from new code)
- `cd apps/payroll-dashboard && npx tsc --noEmit` -- passes clean
- `cd apps/cs-dashboard && npx tsc --noEmit` -- passes clean
