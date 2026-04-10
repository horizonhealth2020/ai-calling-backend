---
phase: 56-manager-tracker-upgrade
plan: 01
type: execute
autonomous: false
duration: 20min
completed: 2026-04-10T00:00:00Z
---

# Phase 56 Plan 01: Manager Tracker Upgrade Summary

**Extended /call-counts API with per-agent call quality metrics and added 3 new columns to the manager tracker: Avg Call (m:ss), Longest Call (m:ss), and inline Call Quality tier bar.**

## AC Result

| Criterion | Status |
|-----------|--------|
| AC-1: /call-counts returns tier breakdown | Pass |
| AC-2: Avg Call Length column (m:ss) | Pass |
| AC-3: Longest Call column (m:ss) | Pass |
| AC-4: Call Quality bar with tier colors | Pass |

## Files Changed

| File | Change |
|------|--------|
| `apps/ops-api/src/routes/call-audits.ts` | Extended /call-counts with agentMetrics (tier breakdown, avg/longest call) |
| `apps/ops-dashboard/.../manager/ManagerTracker.tsx` | 3 new columns, CallQualityBar component, updated fetch for new response shape |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| agentMetrics keyed by agentName | Tracker joins by name, not ID (audit finding) |
| Column order: Avg Call, Longest, Quality, Calls, Sales | User requested calls next to sales after quality bar |
| Live calls excluded from tier bar | Null duration — not meaningful for quality assessment |

## Deviations

Column reorder during checkpoint — user requested Calls moved to right of Quality bar, next to Sales.

---
*Completed: 2026-04-10*
