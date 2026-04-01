---
phase: 21-route-file-splitting
plan: 01
subsystem: ops-api
tags: [refactor, tech-debt, route-splitting]
dependency_graph:
  requires: []
  provides: [modular-route-files, shared-helpers]
  affects: [ops-api]
tech_stack:
  added: []
  patterns: [domain-module-routing, barrel-index]
key_files:
  created:
    - apps/ops-api/src/routes/helpers.ts
    - apps/ops-api/src/routes/auth.ts
    - apps/ops-api/src/routes/users.ts
    - apps/ops-api/src/routes/agents.ts
    - apps/ops-api/src/routes/products.ts
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-api/src/routes/payroll.ts
    - apps/ops-api/src/routes/service.ts
    - apps/ops-api/src/routes/webhooks.ts
    - apps/ops-api/src/routes/call-audits.ts
    - apps/ops-api/src/routes/change-requests.ts
    - apps/ops-api/src/routes/call-logs.ts
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-api/src/routes/cs-reps.ts
    - apps/ops-api/src/routes/pending-terms.ts
    - apps/ops-api/src/routes/alerts.ts
    - apps/ops-api/src/routes/ai-budget.ts
    - apps/ops-api/src/routes/admin.ts
  modified:
    - apps/ops-api/src/routes/index.ts
decisions:
  - "No path prefixes on router.use() -- preserves existing /api mount in app entry point"
  - "Inline Zod schemas stay with their handlers -- not extracted to shared file"
  - "DEFAULT_BONUS_CATEGORIES and DEFAULT_AI_AUDIT_PROMPT constants stay in their domain files"
metrics:
  duration: "12 minutes"
  completed: "2026-03-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 18
  files_modified: 1
requirements:
  - SPLIT-01
  - SPLIT-02
---

# Phase 21 Plan 01: Route File Splitting Summary

Split 2750-line route monolith into 17 focused domain modules with shared helpers barrel, zero behavior change.

## What Was Done

### Task 1: Extract shared helpers to helpers.ts
- Created `apps/ops-api/src/routes/helpers.ts` with three named exports: `zodErr`, `asyncHandler`, `dateRange`
- Verbatim copies from the top of the original monolith (lines 20-92)
- Commit: `6e38de4`

### Task 2: Split all domain routes and rewrite barrel index
- Created 17 domain files, each with `Router()` + handlers + `export default router`
- Rewrote `index.ts` from 2750 lines to a 40-line barrel with 17 `router.use()` calls
- All handler code copied verbatim -- zero refactoring, zero renaming
- Each domain file imports only what it actually uses
- Commit: `d039410`

## Domain File Breakdown

| File | Handlers | Lines |
|------|----------|-------|
| auth.ts | /auth/login, /auth/logout, /auth/change-password, /auth/refresh, /session/me | ~60 |
| users.ts | /users CRUD | ~65 |
| agents.ts | /agents CRUD, /lead-sources CRUD | ~105 |
| products.ts | /products CRUD, /state-availability | ~150 |
| sales.ts | /sales CRUD, /sales/preview, /sales/:id/status, commission, tracker, owner summary, reporting, sales-board | ~530 |
| payroll.ts | /payroll/periods, /payroll/entries, /payroll/mark-paid, /clawbacks | ~210 |
| service.ts | /service-agents, /payroll/service-entries, /settings/service-bonus-categories | ~170 |
| webhooks.ts | /webhooks/convoso | ~95 |
| call-audits.ts | /call-recordings, /call-audits, /call-counts, /settings/ai-audit-prompt, /settings/audit-duration | ~200 |
| change-requests.ts | /status-change-requests, /sale-edit-requests | ~175 |
| call-logs.ts | /call-logs, /call-logs/kpi | ~140 |
| chargebacks.ts | /chargebacks CRUD, /chargebacks/resolve, /chargebacks/weekly-total, /chargebacks/totals | ~170 |
| cs-reps.ts | /reps/*, /cs-rep-roster CRUD | ~85 |
| pending-terms.ts | /pending-terms CRUD, /pending-terms/resolve | ~130 |
| alerts.ts | /alerts, /alerts/:id/approve, /alerts/:id/clear, /alerts/agent-periods | ~40 |
| ai-budget.ts | /ai/usage-stats, /ai/auto-score, /ai/budget | ~35 |
| admin.ts | /agent-kpis, /permissions, /storage-stats | ~115 |

## Verification Results

- 19 files in `apps/ops-api/src/routes/` (helpers + 17 domain + barrel index)
- Barrel index.ts: 40 lines, 17 `router.use()` calls
- All domain files have `export default router` as last statement
- Only `helpers.ts` lacks default export (correct -- it uses named exports)
- TypeScript compiles with same pre-existing errors as before (TS7016 for missing @types, TS6059 for rootDir, TS2353 for PayrollEntry `period` include -- all present in original monolith)
- App entry point (`apps/ops-api/src/index.ts`) unchanged -- still imports from `./routes`
- No ops-api-specific tests exist (plan referenced "6 existing service tests" but those are root Morgan service tests, unaffected)

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED
