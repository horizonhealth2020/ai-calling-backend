---
phase: 29-dashboard-fixes-cost-tracking
plan: 02
subsystem: convoso-data-flow
tags: [convoso, poller, cost-tracking, dashboard]
dependency_graph:
  requires: []
  provides: [ConvosoCallLog-writes, convosoConfigured-flag]
  affects: [manager-tracker, owner-dashboard, kpi-poller]
tech_stack:
  added: []
  patterns: [conditional-display-states, api-response-wrapping]
key_files:
  created: []
  modified:
    - apps/ops-api/src/workers/convosoKpiPoller.ts
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/page.tsx
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx
decisions:
  - ConvosoCallLog writes use newRaw (post-dedup) array, placed before buffer filtering
  - tracker/summary response wrapped as { agents, convosoConfigured } object (breaking change handled)
  - Cost per sale uses three-state display: not configured (em-dash), no data (em-dash), has data (dollar amount)
metrics:
  duration: 4min
  completed: "2026-03-25T21:20:00Z"
  tasks: 2
  files: 5
---

# Phase 29 Plan 02: Convoso Data Flow & Cost Display Summary

ConvosoCallLog writes added to KPI poller using dedup-filtered newRaw array; tracker and owner APIs return convosoConfigured flag; dashboards differentiate not-configured vs no-data vs has-data states for cost columns.

## Tasks Completed

### Task 1: Add ConvosoCallLog writes to KPI poller and convosoConfigured flag to tracker API

- Added `prisma.convosoCallLog.createMany` call in `pollLeadSource` using the `newRaw` array (post-dedup via ProcessedConvosoCall), placed BEFORE buffer filtering so all calls are logged
- Defensive field mapping: `r.call_date` with fallback to `r.start_time` then `new Date()` for callTimestamp
- AgentCallKpi writes preserved untouched (per D-08)
- Added `convosoConfigured` boolean (`!!process.env.CONVOSO_AUTH_TOKEN`) to both `/tracker/summary` and `/owner/summary` responses
- Wrapped tracker/summary response from plain array to `{ agents: [...], convosoConfigured }` object
- Updated all three frontend consumers of tracker/summary: manager/page.tsx, ManagerTracker.tsx, OwnerOverview.tsx

**Commit:** eb9f287 (combined with 29-01 changes by concurrent agent)

### Task 2: Fix cost display logic in Manager Tracker and Owner Dashboard

- ManagerTracker.tsx: Added `convosoConfigured` state, extracted from tracker/summary response
- ManagerTracker.tsx: Cost per sale column uses three-state logic: em-dash when not configured, em-dash when no sales or no lead cost, dollar amount when data exists
- OwnerOverview.tsx: Added `convosoConfigured` state, extracted from tracker/summary response, passed to DashboardSection
- OwnerOverview.tsx: DashboardSection updated with `convosoConfigured` prop and same three-state cost display logic
- Both files use `\u2014` (em-dash) with `colors.textMuted` for placeholder states
- Both files use `colors.textPrimary` for actual dollar amounts

**Commit:** eb9f287 (combined with 29-01 changes by concurrent agent)

## Deviations from Plan

### Concurrent Agent Commit

Both tasks' changes were committed as part of commit eb9f287 by a concurrent agent executing plan 29-01. The 29-01 agent ran `git add` on all modified files in the working tree, which included this plan's changes. All changes are verified present and correct -- the commit message references 29-01 but contains all 29-02 work.

## Verification Results

1. TypeScript compiles without new errors for both ops-api and ops-dashboard (pre-existing declaration file warnings only)
2. convosoKpiPoller.ts writes to ConvosoCallLog using newRaw (deduped) array at line 83-101
3. tracker/summary (line 594-595) and owner/summary (line 631-632) APIs return convosoConfigured flag
4. ManagerTracker (line 198-202) and OwnerOverview (line 262-266) handle all cost display states correctly

## Self-Check: PASSED

All modified files exist and contain expected changes. Commit eb9f287 verified present in git log.
