---
phase: 58-owner-trends-tab
plan: 01
subsystem: ui, api
tags: [recharts, trends, charts, owner-dashboard, aggregation, prisma]

requires:
  - phase: 57-owner-command-center
    provides: Command Center tab patterns (stat cards, DateRangeFilter, leaderboard, activity feed)
provides:
  - Owner Trends tab with 4 Recharts analytical charts
  - /api/owner/trends aggregation endpoint (revenue, agent KPI, lead source, call quality)
  - Recharts dependency in ops-dashboard
affects: [59-cs-analytics-tab]

tech-stack:
  added: [recharts@3.8.1]
  patterns: [Recharts dark-themed charts with custom tooltip, per-section empty states, partial failure resilient aggregation]

key-files:
  created:
    - apps/ops-api/src/services/trendAggregator.ts
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerTrends.tsx
  modified:
    - apps/ops-api/src/routes/admin.ts
    - apps/ops-dashboard/app/(dashboard)/owner/page.tsx
    - apps/ops-dashboard/package.json

key-decisions:
  - "Recharts over inline SVG sparklines for real analytical charts with axes, tooltips, legends"
  - "Partial failure resilience: each sub-query catches independently, returns empty array on failure"
  - "saleDate for revenue grouping (business date), not createdAt (entry date)"
  - "Agent KPI 'All Agents' aggregate as default view with per-agent dropdown selector"

patterns-established:
  - "DarkTooltip component: reusable custom Recharts tooltip matching glassmorphism theme"
  - "trendAggregator service pattern: parallel sub-queries with individual error handling"
  - "safeDivide helper: guards division-by-zero returning 0"
  - "parseCallsByTier: validates JSON shape before accessing tier keys"

duration: ~25min
completed: 2026-04-10T00:00:00Z
---

# Phase 58 Plan 01: Owner Trends Tab Summary

**Recharts-powered Trends tab replacing static KPIs — 4 analytical charts (revenue trends, agent KPI trends, lead source effectiveness, call quality distribution) with real axes, tooltips, legends, and per-section empty states.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~25min |
| Completed | 2026-04-10 |
| Tasks | 2 completed (2/2 PASS) |
| Files modified | 5 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Trends API returns time-series data | Pass | 4 arrays: revenueTrend, agentKpiTrend, leadSourceEffectiveness, callQualityTrend |
| AC-1b: API handles missing/sparse data | Pass | Empty arrays returned, no 500 errors, Decimal null → 0 |
| AC-1c: API rejects unauthorized requests | Pass | requireAuth + requireRole("OWNER_VIEW", "SUPER_ADMIN"), 400 on missing range |
| AC-2: Revenue trend chart | Pass | ComposedChart with Area (premium), Line (commission), Bar (chargebacks) |
| AC-3: Agent KPI chart with selector | Pass | LineChart with 3 lines, agent dropdown, dual YAxis, "All Agents" aggregate |
| AC-4: Lead source effectiveness | Pass | BarChart with conversionRate + costPerSale, dual YAxis, sorted by rate |
| AC-5: Call quality distribution | Pass | Stacked AreaChart with 4 tiers (short/contacted/engaged/deep) |
| AC-6: Tab integration | Pass | "Trends" tab with TrendingUp icon, #trends hash routing, subtitle updated |

## Accomplishments

- Replaced flat chargeback/pending term table with 4 Recharts analytical charts owners can use for trend analysis
- Built resilient aggregation service with partial failure handling and division-by-zero guards
- Integrated Recharts into the monorepo with zero SSR issues (standard import works with "use client")
- Enterprise audit applied 8 findings (Decimal serialization, div-by-zero, saleDate vs createdAt, JSON validation)

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `apps/ops-api/src/services/trendAggregator.ts` | Created | Aggregation service: 4 sub-queries for trend data with partial failure resilience |
| `apps/ops-api/src/routes/admin.ts` | Modified | Added GET /api/owner/trends endpoint with auth + date range validation |
| `apps/ops-dashboard/app/(dashboard)/owner/OwnerTrends.tsx` | Created | 4-chart Trends component with Recharts, dark tooltip, agent selector, empty states |
| `apps/ops-dashboard/app/(dashboard)/owner/page.tsx` | Modified | Tab rename: kpis → trends, TrendingUp icon, subtitle, hash routing |
| `apps/ops-dashboard/package.json` | Modified | Added recharts@3.8.1 dependency |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Recharts v3.8.1 over custom SVG | Real charts need axes, tooltips, legends — sparklines don't tell a story | New dependency in ops-dashboard (148kB page size) |
| Partial failure per sub-query | One failing query shouldn't break the whole trends page | Empty sections shown instead of full error |
| saleDate not createdAt for revenue | Business date matters for trend accuracy (backdated entries) | Consistent with command center patterns |
| All Agents aggregate as default | More useful first view than picking one agent | Aggregates avgCallLength and closeRate as mean |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Minimal |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** Essential fix, no scope creep

### Auto-fixed Issues

**1. TypeScript implicit `any` on Prisma groupBy callbacks**
- **Found during:** Task 1 (trendAggregator.ts)
- **Issue:** Prisma groupBy return types inferred as `any` causing TS errors with explicit Map typing
- **Fix:** Added explicit `Map<string, T>` type annotations and `(param: any)` eslint-suppressed callbacks matching existing codebase patterns
- **Verification:** `npx tsc --noEmit` — only pre-existing @ops/db resolution errors remain

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Prisma groupBy returns `any` typed results | Used explicit Map generics + eslint-disable comments (matches existing codebase pattern) |

## Next Phase Readiness

**Ready:**
- Recharts library available for CS Analytics tab (Phase 59) if needed
- trendAggregator pattern established for additional aggregation endpoints
- DarkTooltip component reusable across future chart sections

**Concerns:**
- Owner page bundle increased to 148kB (from ~90kB) due to Recharts — acceptable for internal ops tool
- No server-side caching on trends endpoint (deferred from audit, acceptable at 18-agent scale)

**Blockers:**
- None

---
*Phase: 58-owner-trends-tab, Plan: 01*
*Completed: 2026-04-10*
