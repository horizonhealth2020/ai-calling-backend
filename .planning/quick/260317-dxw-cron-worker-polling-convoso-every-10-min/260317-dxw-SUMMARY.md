---
phase: quick
plan: 260317-dxw
subsystem: ops-api
tags: [convoso, cron, kpi, polling, worker]
dependency_graph:
  requires: [convosoCallLogs service, Agent model, LeadSource model]
  provides: [AgentCallKpi table, convosoKpiPoller worker]
  affects: [ops-api startup, Prisma schema]
tech_stack:
  added: [setInterval-based cron worker]
  patterns: [fire-and-forget startup, sequential API polling, bulk createMany]
key_files:
  created:
    - apps/ops-api/src/workers/convosoKpiPoller.ts
    - prisma/migrations/20260317_add_agent_call_kpi/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/index.ts
    - apps/ops-api/.env.example
decisions:
  - Sequential lead source polling to avoid Convoso rate limiting
  - Prisma generate run to update client types for new model
metrics:
  duration: 169s
  completed: "2026-03-17T14:08:36Z"
  tasks: 2
  files: 5
---

# Quick Task 260317-dxw: Cron Worker Polling Convoso Every 10 Min

setInterval-based worker inside ops-api that polls Convoso every 10 minutes per active lead source, builds per-agent KPI summaries, and persists snapshots to AgentCallKpi table for historical tracking.

## Task Completion

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Add AgentCallKpi model and migration | fb15131 | prisma/schema.prisma, migration.sql, .env.example |
| 2 | Create cron worker and wire to server | 2083caa | convosoKpiPoller.ts, index.ts |

## What Was Built

### AgentCallKpi Model
- New Prisma model storing per-agent KPI snapshots per lead source
- Fields: totalCalls, avgCallLength, callsByTier (JSON), costPerSale, totalLeadCost, longestCall, conversionEligible, snapshotDate
- Composite index on (agentId, leadSourceId, snapshotDate) for efficient querying
- Foreign keys to agents and lead_sources tables
- Manual migration SQL ready for deploy

### Convoso KPI Poller Worker
- `startConvosoKpiPoller()` called after server.listen in ops-api
- Runs `runPollCycle()` immediately on boot, then every 10 minutes via setInterval
- Each cycle fetches all active lead sources with non-null listId
- Builds agent map from active agents (email -> id/name)
- Polls lead sources sequentially to avoid Convoso API rate limiting
- Uses existing `fetchConvosoCallLogs`, `enrichWithTiers`, `buildKpiSummary` from convosoCallLogs service
- Bulk inserts via `prisma.agentCallKpi.createMany` for efficiency
- Per-lead-source error isolation: one failing source does not stop others
- Silently disabled (no crash) when CONVOSO_AUTH_TOKEN is not set
- Structured JSON logging for all events (start, skip, error, complete)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client types needed regeneration**
- **Found during:** Task 2 verification
- **Issue:** `prisma.agentCallKpi` not recognized by TypeScript because generated client was stale
- **Fix:** Ran `prisma generate` to update client types
- **Files modified:** node_modules/@prisma/client (generated, not committed)

## Decisions Made

1. Sequential lead source polling chosen over Promise.all to respect Convoso API rate limits
2. Ran `prisma generate` during build to resolve type errors (generated files are not committed)
