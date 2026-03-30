---
phase: 30-lead-source-timing-analytics
plan: 03
subsystem: ops-api
tags: [lead-timing, heatmap, sparklines, recommendation, analytics-api]
dependency_graph:
  requires: [30-01]
  provides: [lead-timing-heatmap-api, lead-timing-sparklines-api, lead-timing-recommendation-api]
  affects: [ops-api-routes]
tech_stack:
  added: []
  patterns: [raw-sql-aggregation, timezone-aware-queries, bigint-safe-conversion, application-level-join]
key_files:
  created:
    - apps/ops-api/src/routes/lead-timing.ts
  modified:
    - apps/ops-api/src/routes/index.ts
decisions:
  - Application-level join for heatmap (separate call/sale queries joined in JS) avoids complex SQL JOINs and leverages existing indexes
  - Minimum sample threshold of 10 calls for recommendation to prevent noisy low-volume suggestions
  - Trend computed by comparing current period to prior period of same length for same hour/dow
metrics:
  duration: 2min
  completed: "2026-03-26T22:28:00Z"
---

# Phase 30 Plan 03: Lead Timing Analytics API Endpoints Summary

Three GET endpoints for lead source timing analytics: heatmap aggregation with dow/wom/moy grouping, sparklines with 7-day daypart close rates, and best-source recommendation with trend for current ET hour.

## What Was Done

### Task 1: Create heatmap, sparklines, and recommendation endpoints

**Commit:** `06013de`

1. **Heatmap endpoint (GET /api/lead-timing/heatmap):** Raw SQL aggregation on convoso_call_logs and sales tables with AT TIME ZONE 'America/New_York'. Supports groupBy toggle (dow/wom/moy) and date range filtering (7d/30d/60d/90d or custom from/to). Returns per-source array of cells with hour, groupVal, calls, sales, closeRate.
2. **Sparklines endpoint (GET /api/lead-timing/sparklines):** 7-day daily close rate per source per daypart (morning 8-11, afternoon 12-16, evening 17-20). HAVING clause filters out off-hours calls.
3. **Recommendation endpoint (GET /api/lead-timing/recommendation):** Uses Luxon DateTime for current ET hour/dow, queries historical close rates for that slot, ranks sources with >= 10 calls, computes trend by comparing to prior period same hour/dow.
4. **Shared helpers:** computeDateRange for flexible date params, toBigIntSafe for PostgreSQL bigint conversion, dateRangeSchema for Zod validation.

### Task 2: Register lead-timing routes in API router

**Commit:** `21fe145`

1. Added `import leadTimingRoutes from "./lead-timing"` to routes/index.ts
2. Added `router.use(leadTimingRoutes)` after archiveRoutes mount

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- TypeScript compiles clean (no new errors in lead-timing.ts; pre-existing errors in other files unrelated)
- lead-timing.ts contains all three route handlers: heatmap, sparklines, recommendation
- All SQL queries use AT TIME ZONE 'America/New_York'
- All endpoints use requireAuth + requireRole("MANAGER", "OWNER_VIEW")
- toBigIntSafe converts PostgreSQL bigint to Number before JSON serialization
- Heatmap supports dow/wom/moy groupBy with call counts per bucket
- Recommendation uses MIN_SAMPLE = 10, returns null when insufficient data
- Routes registered in index.ts

## Self-Check: PASSED
