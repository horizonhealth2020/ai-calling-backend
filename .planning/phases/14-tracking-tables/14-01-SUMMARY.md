---
phase: 14-tracking-tables
plan: 01
subsystem: cs-dashboard-tracking
tags: [kpi, chargeback-table, search, filters, sort, csv-export]
dependency_graph:
  requires: [chargebackSubmission model, pending-terms endpoints]
  provides: [GET /api/chargebacks/totals, KPI counter bar, sortable chargeback table, role-gated CSV export]
  affects: [cs-dashboard tracking tab]
tech_stack:
  added: []
  patterns: [SortHeader component, useMemo filter pipeline, collapsible filter panel]
key_files:
  created: []
  modified:
    - apps/ops-api/src/routes/index.ts
    - apps/cs-dashboard/app/page.tsx
decisions:
  - KPI counters use global totals from /api/chargebacks/totals, never affected by search/filters
  - SortHeader extracted as reusable component for column sorting
  - Filter and search pipeline implemented client-side with useMemo for 200-record cap dataset
  - Pending terms placeholder preserved for Plan 02 implementation
metrics:
  duration: 194s
  completed: "2026-03-18T14:19:33Z"
---

# Phase 14 Plan 01: Chargeback KPI Bar & Tracking Table Summary

Global chargeback totals API endpoint with 4-counter KPI bar, shared search, collapsible 7-field filter panel, sortable 8-column chargeback table with always-red amounts, and role-gated CSV export.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Add GET /api/chargebacks/totals endpoint | 7a8839f | apps/ops-api/src/routes/index.ts |
| 2 | Replace TrackingTab with KPI bar, search/filter, sortable table | e42bd73 | apps/cs-dashboard/app/page.tsx |

## Implementation Details

### Task 1: Chargebacks Totals Endpoint
- Added `GET /chargebacks/totals` after existing `/chargebacks/weekly-total`
- Uses `prisma.chargebackSubmission.aggregate` with NO where clause (global totals)
- Returns `totalChargebacks` (absolute value via `Math.abs(Number())`), `totalRecovered` (hardcoded 0), `recordCount`
- Protected by `requireAuth` middleware

### Task 2: TrackingTab Replacement
- **KPI Bar:** 4-column grid with AnimatedNumber counters (Total Chargebacks red, Total Recovered green, Net Exposure conditional, Records neutral)
- **Search:** Shared search box filtering chargebacks by payeeName, memberAgentCompany, memberId, memberAgentId
- **Filters:** Collapsible panel with 7 fields: date range (from/to), product, member company, member agent company, amount range (min/max)
- **Table:** 8 sortable data columns + delete via SortHeader component, default sort submittedAt desc
- **Export:** CSV button conditionally rendered for SUPER_ADMIN and OWNER_VIEW roles
- **Delete:** Refreshes global totals after successful deletion
- Added `useMemo` to React imports, `baseLabelStyle`/`radius` to @ops/ui imports, new lucide icons (ChevronUp, ChevronDown, Search, Filter, Download)

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. SortHeader extracted as standalone function component above TrackingTab for reuse in Plan 02
2. Pending terms placeholder shows record count when data exists, directing to Plan 02 for full table

## Self-Check: PASSED

- [x] apps/ops-api/src/routes/index.ts exists
- [x] apps/cs-dashboard/app/page.tsx exists
- [x] Commit 7a8839f found (Task 1)
- [x] Commit e42bd73 found (Task 2)
