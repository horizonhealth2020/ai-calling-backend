---
phase: 35-fix-kpi-polling-issues-and-manager-dashboard-features
plan: 03
subsystem: cs-dashboard
tags: [round-robin, fairness, client-fallback]
dependency_graph:
  requires: []
  provides: [fair-round-robin-fallback]
  affects: [cs-submissions]
tech_stack:
  added: []
  patterns: [random-offset-round-robin]
key_files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx
decisions:
  - Random offset in client fallback eliminates always-start-at-0 bias
  - Server-side repSync.ts left unchanged (already correct with Prisma transaction)
  - console.warn added for fallback observability
metrics:
  duration: 26s
  completed: 2026-03-31
---

# Phase 35 Plan 03: CS Round Robin Fairness Fix Summary

Random offset replaces biased index-0 start in client-side round robin fallback, with console.warn for observability when API fails.

## What Was Done

### Task 1: Fix client-side round robin fallback to use random offset instead of index 0
**Commit:** e690a3f

Changed the `fetchBatchAssign` fallback in `CSSubmissions.tsx` from always starting at index 0 to using `Math.floor(Math.random() * active.length)` as the offset. This ensures that when the batch-assign API is unreachable, each active rep has equal probability of being the starting assignment point.

Added `console.warn` before the fallback path so API failures are observable in browser dev tools.

**Files modified:**
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` -- random offset + console.warn

## Deviations from Plan

None -- plan executed exactly as written.

## Verification

- `Math.floor(Math.random() * active.length)` present in fetchBatchAssign function
- `active[(offset + i) % active.length]` replaced old `active[i % active.length]`
- `console.warn` with "batch-assign API failed" message present
- `authFetch` call to `/api/reps/batch-assign` preserved unchanged
- No changes to `apps/ops-api/src/services/repSync.ts`

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e690a3f | Fix client-side round robin fallback with random offset |
