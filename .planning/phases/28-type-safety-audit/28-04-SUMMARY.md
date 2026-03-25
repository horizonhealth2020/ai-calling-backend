---
phase: 28-type-safety-audit
plan: 04
subsystem: ops-api
tags: [gap-closure, input-validation, zod]
dependency_graph:
  requires: []
  provides: [EH-02]
  affects: [ops-api]
tech_stack:
  added: []
  patterns: [idParamSchema, dateRangeQuerySchema, booleanQueryParam, safeParse-guard]
key_files:
  created: []
  modified:
    - apps/ops-api/src/routes/agents.ts
    - apps/ops-api/src/routes/products.ts
    - apps/ops-api/src/routes/users.ts
    - apps/ops-api/src/routes/alerts.ts
    - apps/ops-api/src/routes/ai-budget.ts
    - apps/ops-api/src/routes/call-audits.ts
    - apps/ops-api/src/routes/sales.ts
decisions:
  - Preserved all Phase 28 type annotations while adding Zod validation
  - Used dateRangeQuerySchema.extend() for call-audits agentId query param
  - Added view query validation on reporting/periods endpoint
metrics:
  duration: 7m
  completed: "2026-03-25T17:58:00Z"
---

# Phase 28 Plan 04: Gap Closure - Zod Query/Param Validation Restoration Summary

Restored Zod query/param validation on all 7 route files affected by Phase 28 worktree merge regression (EH-02). Every route that reads req.params.id now validates through idParamSchema, every date range query validates through dateRangeQuerySchema, and every boolean query param validates through booleanQueryParam.

## Task Results

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Restore Zod validation in agents, products, users, alerts | df44be6 | agents.ts, products.ts, users.ts, alerts.ts |
| 2 | Restore Zod validation in ai-budget, call-audits, sales | 0d990fe | ai-budget.ts, call-audits.ts, sales.ts |

## Changes Made

### Task 1: agents.ts, products.ts, users.ts, alerts.ts

- **agents.ts**: Added idParamSchema to 5 handlers (DELETE, PATCH x2, PATCH reactivate, DELETE lead-sources, PATCH lead-sources). Replaced `req.query.all === "true"` with booleanQueryParam. Replaced `req.query.permanent === "true"` with booleanQueryParam.
- **products.ts**: Added idParamSchema to 5 handlers (PATCH, DELETE, PATCH reactivate, GET state-availability, PUT state-availability). Replaced `req.query.all === "true"` and `req.query.permanent === "true"` with booleanQueryParam.
- **users.ts**: Added idParamSchema to 2 handlers (PATCH, DELETE).
- **alerts.ts**: Added idParamSchema to 2 handlers (POST approve, POST clear). Added agentId param validation to GET agent-periods.

### Task 2: ai-budget.ts, call-audits.ts, sales.ts

- **ai-budget.ts**: Replaced `req.query.range as string` unsafe cast with dateRangeQuerySchema validation on GET /ai/scoring-stats.
- **call-audits.ts**: Replaced 3 unsafe date casts with dateRangeQuerySchema (GET /call-recordings, GET /call-audits, GET /call-counts). Added idParamSchema to 3 handlers (GET, PATCH, POST re-audit). Extended dateRangeQuerySchema with agentId for GET /call-audits.
- **sales.ts**: Replaced 3 unsafe date casts with dateRangeQuerySchema (GET /sales, GET /tracker/summary, GET /owner/summary). Added idParamSchema to 7 handlers (GET, PATCH, DELETE, PATCH status, PATCH approve-commission, PATCH unapprove-commission, DELETE). Added view query validation on GET /reporting/periods.

## Verification Results

- Zero `req.query.x as string` casts across all 7 files
- Zero bare `req.query.all === "true"` comparisons
- idParamSchema imported and used in all 6 applicable files (29 total usages)
- dateRangeQuerySchema imported and used in all 3 applicable files (10 total usages)
- TypeScript compiles clean (no new errors; pre-existing third-party declaration gaps unchanged)
- All 90 tests pass

## Deviations from Plan

None - plan executed exactly as written.
