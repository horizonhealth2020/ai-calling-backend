---
phase: 37-fix-call-audit-issues-manager-dashboard-ui-and-agent-performance-card-order
plan: 02
subsystem: manager-dashboard
tags: [composite-score, ranking, performance-tracker]
dependency_graph:
  requires: [37-00]
  provides: [compositeScore-utility, composite-ranking]
  affects: [ManagerTracker]
tech_stack:
  added: []
  patterns: [min-max-normalization, weighted-composite-scoring]
key_files:
  created:
    - apps/ops-dashboard/lib/compositeScore.ts
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx
decisions:
  - "40% premium weight + 60% cost efficiency weight for composite score"
  - "Agents with zero sales get score -1 to rank last"
  - "Agents with no cost data (costPerSale === 0) get worst efficiency score (0), not best"
  - "Division-by-zero guarded with || 1 on range calculations"
metrics:
  duration: 81s
  completed: "2026-03-31T20:02:44Z"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 37 Plan 02: Composite Score Agent Ranking Summary

Weighted composite ranking (40% premium + 60% cost-per-sale efficiency) with min-max normalization replaces simple salesCount sort in Performance Tracker.

## What Was Done

### Task 1: Extract compositeScore utility and update ManagerTracker sort
**Commit:** 08aaaa5

Created `apps/ops-dashboard/lib/compositeScore.ts` as a pure, testable utility exporting `computeCompositeScores`. The function:
- Separates agents with sales from those without (no-sales get score -1)
- Min-max normalizes premium (higher = better) and cost-per-sale (lower = better, inverted)
- Weights: 40% premium score + 60% cost efficiency score
- Agents with costPerSale === 0 but having sales get worst efficiency (score 0), not best
- Division-by-zero protected with `|| 1` on range calculations

Updated `ManagerTracker.tsx` to import and use `computeCompositeScores` replacing the old `b.salesCount - a.salesCount` sort. Equal composite scores tie-break by salesCount descending.

## Decisions Made

1. **Extracted as standalone module** -- compositeScore.ts has zero React dependencies, making it testable with plain Jest
2. **Cost inversion scoring** -- lower cost-per-sale produces higher score (1 - normalized), matching business intent
3. **No-cost penalty** -- agents without Convoso cost data get worst efficiency rather than best, preventing artificial ranking inflation

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- compositeScore function is imported and used in ManagerTracker.tsx
- premScore * 0.4 and costScore * 0.6 weighting confirmed in compositeScore.ts
- Old salesCount-only sort pattern removed from ManagerTracker.tsx
- Division-by-zero guards present (|| 1)

## Self-Check: PASSED

- compositeScore.ts: FOUND
- Commit 08aaaa5: FOUND
