---
phase: 57-owner-command-center
plan: 01
subsystem: api
tags: [express, prisma, aggregation, audit-log, owner-dashboard]

requires:
  - phase: 56-manager-tracker-upgrade
    provides: Call quality metrics pattern (callsByTier, avgCallLength)

provides:
  - GET /api/command-center — aggregated hero + stat cards + leaderboard
  - GET /api/activity-feed — enriched audit log events for activity feed

affects: [57-02-owner-command-center, 57-03-owner-command-center]

key-files:
  modified:
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-api/src/routes/admin.ts

key-decisions:
  - "Inline Prisma queries vs extracting shared tracker function — inline for now, refactor after UI validates shape"
  - "Activity feed enriches from entity tables (Sale/CB/PT) since AppAuditLog metadata is inconsistent"
  - "Commission owed Friday = arrears period net (payout + adjustment + bonus + fronted - hold) + service entries"
  - "Chargeback trending = this week count vs last week count"

duration: 15min
completed: 2026-04-10T00:00:00Z
---

# Phase 57 Plan 01: Command Center API Endpoints Summary

**Created two new API endpoints: /api/command-center (aggregated metrics in one call) and /api/activity-feed (enriched audit log events). Both restricted to OWNER_VIEW + SUPER_ADMIN.**

## AC Result

| Criterion | Status |
|-----------|--------|
| AC-1: /api/command-center returns aggregated metrics | Pass |
| AC-2: Period selection support | Pass |
| AC-3: /api/activity-feed returns filtered events | Pass |

## Files Changed

| File | Change |
|------|--------|
| `apps/ops-api/src/routes/sales.ts` | Added /api/command-center — hero, statCards, leaderboard |
| `apps/ops-api/src/routes/admin.ts` | Added /api/activity-feed — filtered, enriched audit events |

---
*Completed: 2026-04-10*
