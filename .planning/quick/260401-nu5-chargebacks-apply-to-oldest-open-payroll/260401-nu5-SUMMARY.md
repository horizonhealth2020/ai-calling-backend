---
phase: quick
plan: 260401-nu5
subsystem: payroll/chargebacks
tags: [chargeback, payroll, per-product, oldest-period]
dependency_graph:
  requires: []
  provides: [ClawbackProduct-table, oldest-period-targeting, per-product-chargebacks]
  affects: [payroll-periods-ui, chargeback-form, alert-approval]
tech_stack:
  added: []
  patterns: [per-product-commission-calculation, oldest-open-period-lookup]
key_files:
  created:
    - prisma/migrations/20260401100000_add_clawback_products/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/routes/payroll.ts
    - apps/ops-api/src/routes/alerts.ts
    - apps/ops-api/src/services/alerts.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
decisions:
  - ClawbackProduct join table tracks per-product chargeback amounts
  - Oldest OPEN period targeting uses payrollPeriod.findFirst with status OPEN ordered by weekStart ASC
  - Per-product commission uses same rate logic as calculateCommission but scoped to selected products
  - GET /clawbacks/lookup endpoint provides sale product data for UI without exposing full sale details
  - Alert approval pre-selects oldest period with separate Approve button (no auto-approve on change)
metrics:
  duration: 5m43s
  completed: 2026-04-01
  tasks: 3/3
  files: 9
---

# Quick Task 260401-nu5: Chargebacks Apply to Oldest Open Payroll Summary

Chargebacks target oldest OPEN payroll period with per-product partial chargeback support via ClawbackProduct join table and product selection UI

## What Changed

### Task 1: Schema + Backend (829f218)
- Added `ClawbackProduct` model linking clawbacks to specific products with per-product amounts
- Added `findOldestOpenPeriodForAgent()` helper -- finds first OPEN period with entries for agent, ordered by weekStart ASC
- Added `calculatePerProductCommission()` helper -- calculates commission contribution of selected products using same rate logic as main calculateCommission
- Updated `POST /clawbacks` to accept optional `productIds`, target oldest OPEN period, create ClawbackProduct records, and calculate partial amounts
- Added `GET /clawbacks/lookup` endpoint returning sale products for UI consumption
- Updated `approveAlert()` to auto-select oldest OPEN period when periodId is not provided
- Changed `GET /alerts/agent-periods/:agentId` ordering from DESC to ASC (oldest first)

### Task 2: UI Updates (0f4d0f3)
- Rewrote PayrollChargebacks as two-step form: lookup sale first, then show product checkboxes with type badges
- "All Products" toggle checked by default; individual product checkboxes with CORE/ADDON/AD_D/ACA_PL badges
- Updated alert approval: dropdown pre-selects oldest period, separate Approve button instead of auto-approve on select change
- Added "Oldest open period pre-selected" label above dropdown

### Task 3: Cards Expanded Default (40aae1b)
- Changed initial `expandedAgents` state from empty Set to `new Set(agentData.keys())`
- All agent payroll cards now default to expanded showing week section headers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added GET /clawbacks/lookup endpoint**
- **Found during:** Task 1/2
- **Issue:** Plan suggested checking if a sales lookup endpoint exists; none existed that returned product data suitable for the chargeback form
- **Fix:** Added dedicated `/clawbacks/lookup` endpoint in payroll routes returning saleId, memberName, memberId, and products array
- **Files modified:** apps/ops-api/src/routes/payroll.ts

## Self-Check: PASSED
