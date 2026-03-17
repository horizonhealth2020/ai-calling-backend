---
phase: quick
plan: 260317-dgz
subsystem: ops-api
tags: [convoso, call-logs, kpi, api-integration]
dependency_graph:
  requires: []
  provides: [convoso-call-log-api, call-length-tier-classification, agent-kpi-aggregation]
  affects: [ops-api-routes]
tech_stack:
  added: [convoso-api-v1]
  patterns: [tier-classification, kpi-aggregation, external-api-proxy]
key_files:
  created:
    - apps/ops-api/src/services/convosoCallLogs.ts
  modified:
    - apps/ops-api/src/routes/index.ts
    - apps/ops-api/.env.example
decisions:
  - /call-logs/kpi registered before /call-logs to prevent Express path collision
  - Null call_length classified as "live" tier (live/transferred calls have no measurable duration)
  - Records with null call_length excluded when min/max filters active (no measurable duration to filter on)
  - avg_call_length computed from non-null values only to avoid skewing by live calls
metrics:
  duration: 150s
  completed: "2026-03-17T13:47:17Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Quick Task 260317-dgz: Convoso Call Log API Integration with KPI Summary

Convoso call log proxy with five-tier call-length classification (live/short/contacted/engaged/deep) and per-agent KPI aggregation for performance screening.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create Convoso call log service module | a84f3af | convosoCallLogs.ts, .env.example |
| 2 | Add call-logs and call-logs/kpi routes | 1ec1e3f | routes/index.ts |

## What Was Built

### Service Module (convosoCallLogs.ts)
- **classifyTier**: Pure function mapping call_length seconds to five tiers (null=live, 0-29=short, 30-119=contacted, 120-299=engaged, 300+=deep)
- **fetchConvosoCallLogs**: Authenticated fetch to Convoso v1/log/retrieve API with Bearer token from CONVOSO_AUTH_TOKEN env
- **enrichWithTiers**: Maps raw call logs to enriched records with call_length_tier field
- **filterByCallLength / filterByTier**: Post-fetch filtering by duration range or tier name
- **buildKpiSummary**: Aggregates total calls, avg call length, live call count, tier breakdown, and per-agent KPIs (conversion_eligible, longest_call)

### API Endpoints
- **GET /api/call-logs**: Proxies to Convoso with queue_id + list_id (required), returns enriched results with tier tags. Supports optional min_call_length, max_call_length, tier filters.
- **GET /api/call-logs/kpi**: Same fetch + enrichment, plus full KPI response with summary object, per_agent array, and results.

Both endpoints use requireAuth middleware, Zod validation (400 on missing params), structured JSON logging, and proper error handling (500 for missing token, 502 for Convoso failures).

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- Tier classification: all boundary values verified (null, 0, 29, 30, 119, 120, 299, 300, 999)
- TypeScript compilation: no new errors introduced (pre-existing errors in bcryptjs types and Prisma includes unrelated to changes)
- .env.example updated with CONVOSO_AUTH_TOKEN placeholder
- Both routes protected by requireAuth middleware

## Self-Check: PASSED
