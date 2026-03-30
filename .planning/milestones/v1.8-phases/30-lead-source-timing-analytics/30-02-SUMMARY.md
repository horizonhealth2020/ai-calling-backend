---
phase: 30-lead-source-timing-analytics
plan: 02
subsystem: manager-dashboard
tags: [ui-rename, today-column, tracker-api]
dependency_graph:
  requires: []
  provides: [today-column-tracker, performance-tracker-tab]
  affects: [manager-dashboard, tracker-api]
tech_stack:
  added: []
  patterns: [today-scoped-query, inline-column-addition]
key_files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/page.tsx
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx
decisions:
  - Today column uses em-dash for zero-sales agents (consistent with existing Lead Spend/Cost patterns)
  - Socket handler for new agents defaults todaySalesCount=1 and todayPremium=totalPrem (since real-time sale is always today)
metrics:
  duration: 2min
  completed: "2026-03-26T22:18:00Z"
---

# Phase 30 Plan 02: Tab Rename and Today Column Summary

Renamed Agent Tracker tab to Performance Tracker and added Today column showing current-day sales count and premium per agent in tracker table.

## What Was Done

### Task 1: Rename tab and add Today column to tracker API and UI

**Commit:** `91d6784`

1. **Tab rename (page.tsx):** Changed NAV_ITEMS label from "Agent Tracker" to "Performance Tracker"
2. **API update (sales.ts):** Added today-scoped agent sales query to tracker/summary Promise.all, built todayMap, and added todaySalesCount/todayPremium to response
3. **UI update (ManagerTracker.tsx):** Added "Today" column header and cell showing "count ($premium)" or em-dash, updated TrackerEntry type, updated CSV export with Today Sales/Today Premium columns
4. **Socket handler fix (page.tsx):** Added todaySalesCount and todayPremium to new TrackerEntry objects created by real-time sale handler

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Socket handler missing today fields**
- **Found during:** Task 1, TypeScript verification
- **Issue:** The socket handler in page.tsx creates new TrackerEntry objects for agents not yet in the tracker list. After adding todaySalesCount/todayPremium to the type, these objects were missing the new required fields.
- **Fix:** Added todaySalesCount: 1 and todayPremium: totalPrem to the new object (a real-time sale is always "today")
- **Files modified:** apps/ops-dashboard/app/(dashboard)/manager/page.tsx
- **Commit:** 91d6784

## Verification

- TypeScript compiles clean (no new errors; pre-existing TS7016 for bcryptjs/jsonwebtoken/cookie unrelated)
- page.tsx contains "Performance Tracker" and does NOT contain "Agent Tracker"
- sales.ts tracker/summary response includes todaySalesCount and todayPremium
- ManagerTracker.tsx has Today column header and renders entry.todaySalesCount
- CSV export includes Today Sales and Today Premium columns
