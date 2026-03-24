---
phase: 23-ai-scoring-dashboard
plan: 01
subsystem: owner-dashboard, ops-api
tags: [ai-scoring, dashboard, kpi, owner]
dependency_graph:
  requires: [ai-auto-score, call-audit-model]
  provides: [scoring-stats-endpoint, owner-scoring-tab]
  affects: [owner-dashboard]
tech_stack:
  added: []
  patterns: [prisma-groupBy, prisma-aggregate, ISO-week-grouping, score-color-thresholds]
key_files:
  created:
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerScoring.tsx
  modified:
    - apps/ops-api/src/routes/index.ts
    - apps/ops-dashboard/app/(dashboard)/owner/page.tsx
decisions:
  - Routes added to single routes/index.ts (no separate ai-budget.ts file exists)
  - Score color thresholds: 85+ green, 70+ teal, 50+ amber, below red
  - Distribution uses horizontal bars with percentage width
metrics:
  duration: 229s
  completed: 2026-03-24T17:49:23Z
---

# Phase 23 Plan 01: AI Scoring Dashboard Summary

**One-liner:** Owner dashboard Scoring tab with aggregate KPIs, color-coded agent table, score distribution bars, and weekly trend deltas from a new /ai/scoring-stats endpoint.

## What Was Built

### Task 1: GET /ai/scoring-stats endpoint
Added a new route to `apps/ops-api/src/routes/index.ts` that returns four data sections:
- **Aggregate KPIs** -- average score, total audits, min/max via Prisma aggregate
- **Score distribution** -- 4 parallel count queries for poor/fair/good/excellent buckets
- **Per-agent breakdown** -- groupBy agentId with resolved agent names
- **Weekly trends** -- ISO week grouping with delta from previous week

Role-gated to OWNER_VIEW and SUPER_ADMIN. Filters by date range via shared `dateRange()` helper.

### Task 2: OwnerScoring component and tab wiring
Created `apps/ops-dashboard/app/(dashboard)/owner/OwnerScoring.tsx` (303 lines) with:
- 3 StatCards: Average Score (color-coded by threshold), Total Audits, Score Range
- Score Distribution card with horizontal color-coded bars and percentages
- Sortable per-agent breakdown table (Agent Name, Avg Score, Audits columns)
- Weekly trends table with ChevronUp/ChevronDown delta indicators
- DateRangeFilter integration via shared DateRangeContext
- EmptyState and SkeletonTable loading states

Wired into `page.tsx` as a "Scoring" nav item with Target icon between KPIs and AI Config.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Routes file location mismatch**
- **Found during:** Task 1
- **Issue:** Plan referenced `apps/ops-api/src/routes/ai-budget.ts` as a separate file, but all routes live in `apps/ops-api/src/routes/index.ts`
- **Fix:** Added the endpoint to the existing monolithic routes file, following the same pattern as adjacent AI routes
- **Files modified:** apps/ops-api/src/routes/index.ts

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | b39fa73 | feat(23-01): add GET /ai/scoring-stats endpoint |
| 2 | b805df0 | feat(23-01): add Scoring tab to owner dashboard |

## Verification

- TypeScript compilation: pre-existing errors only (bcryptjs, jsonwebtoken, cookie type declarations), no new errors from this plan
- Endpoint uses correct role guard: requireRole("OWNER_VIEW", "SUPER_ADMIN")
- NULL aiScore filtering present in all queries
- DateRangeFilter connected via shared context
- EmptyState rendered when totalAudits === 0
- All acceptance criteria from plan satisfied

## Self-Check: PASSED

- OwnerScoring.tsx: FOUND (377 lines)
- Commit b39fa73: FOUND
- Commit b805df0: FOUND
