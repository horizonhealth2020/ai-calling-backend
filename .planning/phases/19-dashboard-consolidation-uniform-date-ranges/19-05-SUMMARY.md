---
phase: 19-dashboard-consolidation-uniform-date-ranges
plan: 05
subsystem: payroll-dashboard, ops-dashboard
tags: [payroll, dashboard-migration, sub-tabs, socket, shared-state]

requires:
  - phase: 19-01
    provides: ops-dashboard app shell, PageShell, SocketProvider, DateRangeContext
  - phase: 19-02
    provides: auth middleware, token handling
provides:
  - Payroll tab at /payroll with 5 sub-tabs in unified ops-dashboard
  - PayrollPeriods component with full period management, alerts, print, mark paid/unpaid
  - PayrollChargebacks component with chargeback form
  - PayrollExports component with CSV summary and detailed export
  - PayrollProducts component with full product CRUD
  - PayrollService component with service agents, bonus categories, weekly payroll entry
affects: [19-07]

tech-stack:
  added: []
  patterns: [orchestrator-shared-state, sub-tab-prop-drilling, socket-event-subscription-at-orchestrator]

key-files:
  created:
    - apps/ops-dashboard/app/(dashboard)/payroll/page.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollService.tsx
  modified: []

key-decisions:
  - "Shared state at orchestrator level: periods, products, agents, alerts loaded once and passed as props"
  - "Socket events handled in orchestrator, not individual sub-tabs, to avoid duplicate listeners"
  - "ToastProvider wraps PayrollInner, not individual sub-tabs, for unified toast notifications"
  - "PayrollPeriods accepts state setters (setPeriods, setPendingRequests) for direct mutation from sub-tab handlers"

metrics:
  duration: ~12 minutes
  completed: "2026-03-19T19:25:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 0
---

# Phase 19 Plan 05: Payroll Dashboard Migration Summary

Migrated the 3,030-line payroll dashboard into the unified ops-dashboard with 5 sub-tab components and a shared-state orchestrator using SocketProvider context.

## Completed Tasks

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Extract Payroll sub-tab components | ea32ff5 | PayrollPeriods.tsx, PayrollChargebacks.tsx, PayrollExports.tsx, PayrollProducts.tsx, PayrollService.tsx |
| 2 | Create Payroll page orchestrator | 749f5fd | payroll/page.tsx |

## Implementation Details

### Task 1: Sub-tab Extraction

Extracted all 5 sub-tabs from `apps/payroll-dashboard/app/page.tsx` into individual component files:

- **PayrollPeriods** (~1,400 lines): The largest sub-tab containing period listing, chargeback alerts table, expandable agent pay cards with editable sale rows, print functionality (agent cards + service cards), mark paid/unpaid, status change/edit request approval panels. Includes EditableSaleRow, AgentPayCard, and StatMini helper components.

- **PayrollChargebacks** (~100 lines): Standalone chargeback form with member ID/name matching and API submission.

- **PayrollExports** (~170 lines): CSV export with date range filter. Supports both summary CSV (period-level) and detailed CSV (entry-level with agent subtotals).

- **PayrollProducts** (~320 lines): Full product CRUD -- add, edit, delete with ProductCard component. Commission configuration per product type (CORE threshold-based, ADDON/AD_D bundled/standalone).

- **PayrollService** (~360 lines): Service agents management, bonus categories configuration, weekly payroll entry table with per-category inputs and live total calculation.

### Task 2: Orchestrator

The orchestrator (`page.tsx`, ~330 lines) manages:

1. **Shared state**: periods, products, serviceAgents, bonusCategories, allAgents, pendingRequests, pendingEditRequests, alerts -- all loaded once in a single Promise.all on mount
2. **Socket subscriptions**: sale:changed (patches periods state directly), alert:created/resolved, reconnect triggers full refresh
3. **Nav badge**: Approval count badge on Periods nav item
4. **Conditional rendering**: Only the active sub-tab is rendered, avoiding unnecessary DOM overhead

## Deviations from Plan

None -- plan executed exactly as written.

## Decisions Made

1. **Shared state at orchestrator level**: Rather than having each sub-tab fetch its own data, periods/products/agents/alerts are loaded once and passed as props. This prevents redundant API calls when switching tabs.

2. **Socket at orchestrator level**: Socket event handlers live in the orchestrator with useEffect cleanup, not in individual sub-tabs. This avoids duplicate event listeners when tabs are mounted/unmounted.

3. **State setters passed as props**: Sub-tabs like PayrollPeriods receive setPeriods, setPendingRequests etc. so they can directly update shared state after their API calls (e.g., after approving a change request).

4. **ToastProvider at page level**: Wraps the entire PayrollInner component, making useToast available to all sub-tabs without requiring each to bring its own provider.
