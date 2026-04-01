---
phase: 36-fix-manager-sales-entry-parsing-error-and-payroll-ui-issues
plan: 03
subsystem: ops-dashboard, ops-api
tags: [aca-pl, manager-entry, payroll-ui, checkbox, badge, flat-commission]
dependency_graph:
  requires: [36-02]
  provides: [aca-entry-ui, aca-payroll-badge]
  affects: [ManagerEntry.tsx, PayrollPeriods.tsx, payroll.ts]
tech_stack:
  added: []
  patterns: [checkbox-conditional-fields, collapsible-section, inline-badge]
key_files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
    - apps/ops-api/src/routes/payroll.ts
decisions:
  - ACA checkbox placed after payment type selector, before submit button
  - Standalone ACA section placed below the main sale form with border-top separator
  - ACA badge uses info-blue color to visually distinguish from regular product badges
  - Flat commission displayed as "$X.XX x N members = $total" format in payroll cards
metrics:
  duration: 6m
  completed: 2026-03-31
---

# Phase 36 Plan 03: ACA PL Entry UI and Payroll Badge Summary

ACA checkbox on sale entry form with conditional carrier/member count fields, collapsible standalone ACA-only entry section, and info-blue ACA badge with flat commission display in payroll agent pay cards.

## Tasks Completed

| # | Task | Commit | Key Changes |
|---|------|--------|-------------|
| 1 | Add ACA checkbox and standalone entry to ManagerEntry form | da56632 | ACA_PL in Product type, 5 style constants, 8 useState hooks, ACA checkbox with conditional fields, POST /sales/aca integration on form submit, collapsible ACA-Only Entry section with validation |
| 2 | Add ACA badge and flat commission display to payroll pay cards | 200a811 | SaleInfo type extended with memberCount and product.flatCommission, ACA_BADGE style constant, conditional ACA badge rendering, flat commission "$X.XX x N members = $total" display, payroll API updated to select memberCount and flatCommission |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added ACA_PL to Product type union in ManagerEntry.tsx**
- **Found during:** Task 1
- **Issue:** The local Product type only included "CORE" | "ADDON" | "AD_D" -- products.find(p => p.type === "ACA_PL") would never match
- **Fix:** Added "ACA_PL" to the type union
- **Files modified:** apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx
- **Commit:** da56632

**2. [Rule 2 - Missing functionality] Updated payroll entry update endpoint include**
- **Found during:** Task 2
- **Issue:** The PATCH /payroll/entries/:id endpoint also returns sale data but was missing memberCount and flatCommission fields
- **Fix:** Added memberCount to sale select and flatCommission to product select in the update endpoint response
- **Files modified:** apps/ops-api/src/routes/payroll.ts
- **Commit:** 200a811

## Verification

- TypeScript compilation passes for both ops-dashboard and ops-api (only pre-existing errors in middleware.ts and package declarations)
- ManagerEntry.tsx contains all required ACA style constants, state hooks, checkbox UI, standalone section, and POST /sales/aca calls
- PayrollPeriods.tsx contains ACA_BADGE, conditional rendering for ACA_PL type, and flat commission display format
- Payroll API route includes memberCount and flatCommission in query responses

## Self-Check: PASSED
