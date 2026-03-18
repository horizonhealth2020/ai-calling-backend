---
phase: 15-resolution-polish
plan: 04
subsystem: cs-dashboard, owner-dashboard, auth-portal
tags: [bug-fix, gap-closure, uat]
dependency_graph:
  requires: []
  provides: [total-recovered-kpi-auto-update, td-style-constant, customer-service-role-ui]
  affects: [cs-dashboard, owner-dashboard, auth-portal]
tech_stack:
  added: []
  patterns: [totals-refetch-after-mutation]
key_files:
  created: []
  modified:
    - apps/cs-dashboard/app/page.tsx
    - apps/owner-dashboard/app/page.tsx
    - apps/auth-portal/.env.example
decisions:
  - TD constant wraps baseTdStyle matching existing CARD/LBL pattern
  - CUSTOMER_SERVICE amber color #f59e0b matches auth-portal DASHBOARD_MAP
metrics:
  duration: 84s
  completed: 2026-03-18
---

# Phase 15 Plan 04: UAT Gap Closure Summary

Fix two UAT-reported bugs: Total Recovered KPI not auto-updating after resolve/unresolve, and CUSTOMER_SERVICE login/edit crashes due to missing TD constant and env var.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Add totals re-fetch to resolve/unresolve handlers | 4b2b418 | apps/cs-dashboard/app/page.tsx |
| 2 | Fix TD constant, CUSTOMER_SERVICE role, CS_DASHBOARD_URL env | 4165fe6 | apps/owner-dashboard/app/page.tsx, apps/auth-portal/.env.example |

## What Was Done

### Task 1: Total Recovered KPI Auto-Update
Added `chargebacks/totals` re-fetch calls after successful PATCH in both `handleResolveCb` and `handleUnresolveCb` handlers. Follows the exact pattern already used in `handleDeleteCb`. The KPI now updates immediately without requiring a page refresh.

### Task 2: Owner Dashboard and Auth Portal Fixes
- Added missing `TD` style constant wrapping `baseTdStyle` (already imported) -- fixes ReferenceError when expanding user edit row
- Added `CUSTOMER_SERVICE` to `ROLES` array so it appears in role checkboxes
- Added `CUSTOMER_SERVICE: "#f59e0b"` to `ROLE_COLORS` for amber badge color
- Added `CS_DASHBOARD_URL=http://localhost:3014` to auth-portal `.env.example`

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

1. `chargebacks/totals` appears 4 times in cs-dashboard (load + delete + resolve + unresolve)
2. `const TD` defined once with `baseTdStyle` spread
3. `CUSTOMER_SERVICE` appears in both ROLES array and ROLE_COLORS map
4. `CS_DASHBOARD_URL=http://localhost:3014` present in auth-portal .env.example
