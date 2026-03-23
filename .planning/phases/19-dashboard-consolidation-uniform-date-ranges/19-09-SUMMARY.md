---
phase: 19-dashboard-consolidation-uniform-date-ranges
plan: 09
subsystem: premium-aggregation
tags: [bugfix, addon-premium, kpi, real-time]
dependency_graph:
  requires: []
  provides: [addon-inclusive-premium-kpis]
  affects: [owner-overview, manager-tracker, manager-sales, sales-board-summary, reporting-periods]
tech_stack:
  added: []
  patterns: [findMany-with-manual-reduce-for-addon-sums, sale_addons-LEFT-JOIN-in-raw-SQL]
key_files:
  created: []
  modified:
    - apps/ops-api/src/routes/index.ts
    - apps/ops-dashboard/app/(dashboard)/manager/page.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx
decisions:
  - Replaced prisma.sale.aggregate with findMany + manual reduce for /owner/summary to include addon premiums
  - Replaced prisma.sale.groupBy with findMany + manual grouping for /sales-board/summary to include addon premiums
  - Used COUNT(DISTINCT s.id) in monthly SQL to avoid row inflation from LEFT JOIN sale_addons
metrics:
  duration: 176s
  completed: "2026-03-23T16:50:12Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 4
---

# Phase 19 Plan 09: Fix Premium Calculations to Include Addon Premiums

Addon premiums now included in all 5 API endpoints and 3 client-side socket/aggregation paths, closing UAT Gap 1.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Fix API endpoint premium aggregation to include addons | a6f94fa | 5 API endpoints updated: /tracker/summary, /owner/summary, /sales, /sales-board/summary, /reporting/periods |
| 2 | Fix client-side premium aggregation and real-time patches | fb609fb | 3 client files: manager/page.tsx socket handler, ManagerSales.tsx per-agent reduce, OwnerOverview.tsx socket handler |

## Changes Made

### Task 1: API Endpoint Premium Aggregation

**5 endpoints fixed:**

1. `/tracker/summary` - Added `addons: { select: { premium: true } }` to Prisma include; premium reduce now sums core + addon premiums.

2. `/owner/summary` - Replaced `prisma.sale.aggregate({ _sum: { premium } })` with `prisma.sale.findMany` + manual reduce that includes addon premiums. This was necessary because aggregate cannot join related tables.

3. `/sales` - Added `addons` to the include clause so client-side components can access `sale.addons` for per-sale premium totals.

4. `/sales-board/summary` - Replaced `prisma.sale.groupBy` (which cannot include relations) with `findMany` + manual grouping that computes `totalPrem` including addon reduce.

5. `/reporting/periods` - Weekly view: added addons to sale select and premium reduce. Monthly view: added `LEFT JOIN sale_addons` to raw SQL with `COUNT(DISTINCT s.id)` to prevent row inflation.

### Task 2: Client-side Premium Aggregation

**3 files fixed:**

1. `manager/page.tsx` - Socket `sale:changed` handler computes `addonPrem` and `totalPrem` before `setTracker`, using computed total in both existing-agent update and new-agent push.

2. `manager/ManagerSales.tsx` - Per-agent `premiumTotal` reduce now includes `addons?.reduce` for addon premiums (leveraging addons now returned from `/sales` endpoint).

3. `owner/OwnerOverview.tsx` - Socket handler computes `addonPrem` and `totalPrem`, using the computed total in `setSummary` and both branches of `setTracker`.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

TypeScript compilation verified for both `apps/ops-api` and `apps/ops-dashboard`. Only pre-existing type declaration errors (bcryptjs, jsonwebtoken, cookie) remain - no new errors introduced.
