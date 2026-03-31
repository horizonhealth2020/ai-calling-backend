---
phase: 37-fix-call-audit-issues-manager-dashboard-ui-and-agent-performance-card-order
plan: 03
subsystem: api, dashboard
tags: [pagination, cursor-based, audit-ui, agent-filter, timestamps, dual-ordering]

requires:
  - phase: 37-01
    provides: "formatDateTime helper in @ops/utils"
provides:
  - "Paginated GET /call-audits with cursor, limit, agentId params"
  - "GET /call-audits/agents endpoint for filter dropdown"
  - "Dual-field ordering: callDate desc + updatedAt desc (D-09)"
  - "Default 24h audit window on initial load"
  - "ManagerAudits UI with date+time, agent filter, Load More pagination"
affects: []

tech-stack:
  added: []
  patterns: ["cursor-based pagination with take limit+1 and nextCursor", "agent filter dropdown populated from distinct query"]

key-files:
  created: []
  modified:
    - "apps/ops-api/src/routes/call-audits.ts"
    - "apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx"
    - "packages/utils/src/index.ts"

key-decisions:
  - "Prisma ID-based cursor pagination over date-based cursor for reliability with duplicate timestamps"
  - "Default 24h window only on initial load (no cursor), removed when paginating"
  - "Agent list fetched once on mount via distinct query, not embedded in audit response"

patterns-established:
  - "Cursor-based pagination: take limit+1, return nextCursor as last item ID"

requirements-completed: [D-05, D-06, D-07, D-08, D-09]

duration: 17min
completed: 2026-03-31
---

# Phase 37 Plan 03: Audit List UI Overhaul Summary

**Paginated audit list with date+time display, agent filter dropdown, Load More pagination, default 24h view, and dual-field ordering (callDate + updatedAt) per D-09**

## Performance

- **Duration:** 17 min
- **Started:** 2026-03-31T20:14:00Z
- **Completed:** 2026-03-31T20:31:08Z
- **Tasks:** 2 auto + 1 checkpoint
- **Files modified:** 3

## Accomplishments

- Replaced flat unpaginated GET /call-audits with cursor-based pagination (limit+1 pattern, nextCursor in response)
- Added dual-field ordering: callDate desc then updatedAt desc (D-09 requirement)
- Default 24h window on initial load when no date range specified
- New GET /call-audits/agents endpoint returns distinct agents with audits for filter dropdown
- /call-audits/agents route placed BEFORE /call-audits/:id to avoid Express param collision
- Overhauled ManagerAudits.tsx: formatDateTime for date+time, agent filter select, Load More button
- Refresh button correctly destructures { audits, nextCursor } response shape (not bare array)
- Removed stale auditsLoaded state; selectedAgentId dependency triggers re-fetch

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added formatDateTime to @ops/utils**
- **Found during:** Task 1 pre-check
- **Issue:** Worktree branched before Plan 01 merged; formatDateTime helper missing from packages/utils/src/index.ts
- **Fix:** Added formatDateTime function matching Plan 01 output (identical implementation)
- **Files modified:** packages/utils/src/index.ts
- **Commit:** b95734e

**2. [Rule 1 - Bug] Used Prisma ID-based cursor instead of date-based cursor**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified date-based cursor (callDate ISO string), but audits with identical callDate timestamps would cause pagination to skip records
- **Fix:** Used Prisma native cursor pagination with record ID as cursor, which is unique and reliable
- **Files modified:** apps/ops-api/src/routes/call-audits.ts
- **Commit:** b95734e

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | b95734e | feat(37-03): add pagination, dual-field ordering, and agent filter to GET /call-audits |
| 2 | f57d6f8 | feat(37-03): overhaul ManagerAudits UI with timestamps, pagination, and agent filter |

## Self-Check: PASSED

All 3 modified files exist. Both commits (b95734e, f57d6f8) verified in git log.
