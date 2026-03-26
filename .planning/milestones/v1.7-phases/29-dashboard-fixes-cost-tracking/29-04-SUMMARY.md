---
phase: 29-dashboard-fixes-cost-tracking
plan: "04"
subsystem: ops-dashboard
tags: [gap-closure, ui, lead-spend, cost-tracking]
dependency_graph:
  requires: [29-02]
  provides: [DATA-03, DATA-04, DATA-05]
  affects: [manager-tracker, owner-overview]
tech_stack:
  added: []
  patterns: [three-state-display-logic]
key_files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx
decisions: []
metrics:
  duration: 1min
  completed: "2026-03-25T21:34:00Z"
---

# Phase 29 Plan 04: Lead Spend Column Gap Closure Summary

Added "Lead Spend" column to both ManagerTracker and OwnerOverview tables, rendering totalLeadCost with three-state display logic independent of Cost / Sale.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Lead Spend column to ManagerTracker table | 5c6ebc3 | ManagerTracker.tsx |
| 2 | Add Lead Spend column to OwnerOverview leaderboard table | b01b0f2 | OwnerOverview.tsx |

## What Changed

### ManagerTracker.tsx
- Added "Lead Spend" header between "Premium Total" and "Cost / Sale" (7 columns total)
- New cell renders row.totalLeadCost with three-state logic: em-dash (not configured), $0.00 (configured but zero), dollar amount (has calls)
- Updated empty state colSpan from 6 to 7

### OwnerOverview.tsx
- Added "Lead Spend" header between "Avg / Sale" and "Cost / Sale" (8 columns total)
- New cell renders row.totalLeadCost with identical three-state logic
- Updated empty state colSpan from 7 to 8

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compiles without new errors (pre-existing TS7016 in packages/auth is out of scope)
- Both files contain "Lead Spend" in table headers
- Both files render totalLeadCost with three-state display logic
- Both files have correct colSpan values matching column count
- Existing Cost / Sale column logic remains unchanged in both files

## Self-Check: PASSED
