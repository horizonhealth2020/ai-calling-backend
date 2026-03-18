---
phase: 18-platform-polish-integration
plan: 07
subsystem: api, ui
tags: [agent-kpis, permissions, storage-monitoring, holddate-grouping, owner-dashboard]

requires:
  - phase: 18-platform-polish-integration/01
    provides: PermissionOverride model, ChargebackSubmission, PendingTerm models
provides:
  - Agent KPI aggregation service with 30-day rolling window
  - Permission CRUD API with role defaults and overrides
  - Storage stats API with configurable threshold and plan limit
  - Pending terms holdDate grouping for CS dashboard
  - Owner dashboard KPI tab with sortable agent table
  - Owner dashboard permission matrix with batch save
  - Storage alert banner with dismiss
affects: [owner-dashboard, cs-dashboard, permissions, agent-metrics]

tech-stack:
  added: []
  patterns: [kpi-aggregation, permission-override-matrix, storage-monitoring]

key-files:
  created:
    - apps/ops-api/src/services/agentKpiAggregator.ts
  modified:
    - apps/ops-api/src/routes/index.ts
    - apps/owner-dashboard/app/page.tsx

key-decisions:
  - "Agent matching uses case-insensitive name comparison between Agent.name and ChargebackSubmission.memberAgentId"
  - "Permission overrides use upsert pattern with compound unique key (userId, permission)"
  - "Storage plan limit defaults to 1 GB with 80% alert threshold, both configurable via SalesBoardSetting"
  - "KPIs tab added as separate nav section rather than embedding in dashboard"

patterns-established:
  - "Permission matrix: role defaults with per-user overrides stored in PermissionOverride table"
  - "KPI aggregation: groupBy queries with case-insensitive matching for fuzzy agent-to-record linking"

requirements-completed: [CS-02, CS-03, EXPORT-03, REP-04]

duration: 10min
completed: 2026-03-18
---

# Phase 18 Plan 07: Owner Dashboard KPIs, Permissions & Storage Summary

**Agent KPI aggregation with 30-day chargeback/pending term metrics, permission override matrix, storage monitoring, and holdDate-grouped pending terms**

## Performance

| Metric | Value |
|--------|-------|
| Tasks completed | 2/2 |
| Duration | ~10 min |
| Files created | 1 |
| Files modified | 2 |

## Task Results

### Task 1: Agent KPI aggregator + permissions CRUD + storage stats + holdDate grouping routes
- **Commit:** 41a21f8
- Created `agentKpiAggregator.ts` with `getAgentRetentionKpis()` -- 30-day rolling window, groupBy queries for chargebacks and pending terms, case-insensitive agent name matching
- Added `GET /agent-kpis` route with OWNER_VIEW/SUPER_ADMIN access
- Added `GET /permissions` with role defaults (7 configurable permissions across 7 roles) and override detection
- Added `PUT /permissions` with Zod validation and batch upsert
- Added `GET /storage-stats` with `pg_database_size` query, configurable threshold and plan limit from SalesBoardSetting
- Updated `GET /pending-terms` to support `?groupBy=holdDate` query param for CS-03

### Task 2: Owner dashboard -- KPI table, permission table, storage alert
- **Commit:** 940707f
- Added StorageAlert banner at top of content area with dismiss, showing DB usage percentage and size
- Added "KPIs" nav tab with AgentKPITable component: 3 summary StatCards (chargebacks, chargeback total, pending terms) + sortable agent table
- Added PermissionTable in Users section: checkbox matrix with 7 permission columns, teal dot for overrides, batch "Save Permissions" button
- Hard-coded "Payroll Access" and "User Creation" rows with lock icon (SUPER_ADMIN only, non-interactive)
- Types: AgentKpi, KpiData, PermUser, PermData, StorageStats

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed logAudit call signature**
- **Found during:** Task 1
- **Issue:** Plan showed `logAudit({ action, userId, details })` object pattern but actual function uses positional args `(actorUserId, action, entityType, entityId?, metadata?)`
- **Fix:** Changed to `logAudit(userId, "permissions_updated", "PermissionOverride", undefined, { count: overrides.length })`
- **Files modified:** apps/ops-api/src/routes/index.ts

**2. [Rule 1 - Bug] Fixed STORAGE_ALERT style for missing CSS variable**
- **Found during:** Task 2
- **Issue:** `var(--warning-bg)` CSS variable may not exist in all contexts
- **Fix:** Used `rgba(234, 179, 8, 0.08)` inline color with fallback `colors.warning ?? "#eab308"`
- **Files modified:** apps/owner-dashboard/app/page.tsx

## Verification

- `cd apps/ops-api && npx tsc --noEmit` -- passes (no new errors; pre-existing type declaration warnings only)
- `cd apps/owner-dashboard && npx tsc --noEmit` -- passes clean
- agentKpiAggregator.ts exports `getAgentRetentionKpis` with 30-day rolling window
- Routes: `/agent-kpis`, `/permissions` (GET/PUT), `/storage-stats`, `/pending-terms?groupBy=holdDate` all present
- CONFIGURABLE_PERMISSIONS has all 7 create actions
- ROLE_DEFAULTS defines defaults for all roles including CUSTOMER_SERVICE
- Owner dashboard has PERM_LABELS, StorageAlert, AgentKPITable, PermissionTable
