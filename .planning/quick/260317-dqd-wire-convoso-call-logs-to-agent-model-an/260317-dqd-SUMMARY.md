---
phase: quick
plan: 260317-dqd
subsystem: ops-api
tags: [convoso, kpi, agent-matching, cost-metrics, call-audit]
dependency_graph:
  requires: [260317-dgz]
  provides: [agent-aware-kpi, cost-per-sale, call-audit-auto-tag]
  affects: [ops-api]
tech_stack:
  patterns: [agent-map-lookup, cost-per-lead-aggregation, post-creation-hook]
key_files:
  modified:
    - apps/ops-api/src/services/convosoCallLogs.ts
    - apps/ops-api/src/routes/index.ts
decisions:
  - "Agent matching uses email field (stores Convoso user_id) as lookup key"
  - "Cost metrics rounded to 2 decimal places at calculation time"
  - "CallAudit auto-tag uses 1-day window around saleDate for timezone tolerance"
  - "Unmatched user_ids separated into dedicated unmatched array (not mixed with per_agent)"
metrics:
  duration: 110s
  completed: "2026-03-17"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Quick Task 260317-dqd: Wire Convoso Call Logs to Agent Model Summary

Agent-matched KPI aggregation with cost-per-sale metrics from LeadSource.costPerLead, plus automatic CallAudit tagging on sale creation by agentId + date proximity.

## What Was Done

### Task 1: Extend KPI service and route with agent matching and cost-per-sale
**Commit:** 26345f7

- Extended `AgentKpi` interface with `agent_name`, `agent_id`, `cost_per_sale`, `total_lead_cost` fields
- Added `unmatched` array to `KpiResponse` for unrecognized Convoso user_ids
- Added `KpiBuildOptions` interface with optional `agentMap` and `costPerLead`
- Refactored `buildKpiSummary` to accept options, split per-agent into matched vs unmatched buckets
- Updated GET `/call-logs/kpi` route to fetch active agents and LeadSource from DB before KPI build
- Cost calculation: `total_lead_cost = total_calls * costPerLead`, `cost_per_sale = total_lead_cost / (engaged + deep count)`
- Fully backward compatible: calling without options produces same behavior as before

### Task 2: Auto-tag CallAudit on sale creation
**Commit:** ba7b111

- Added post-creation hook in POST `/sales` handler after socket emit block
- Primary match: `agentId` + `callDate` within +/- 1 day of `saleDate` + status in `["pending", "new"]`
- Secondary match: `recordingUrl` exact match (catches cross-agent audit records)
- Updates matched records to `status: "sale_matched"`
- Non-fatal: errors logged via `console.error` but do not block 201 response
- Follows existing pattern (same as payroll upsert error handling)

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation: all errors are pre-existing (bcryptjs types, rootDir, period include) - no new errors introduced
- AgentKpi includes all four new fields
- KpiResponse includes unmatched array
- buildKpiSummary backward compatible (works with and without options)
- POST /sales auto-tags CallAudit with non-fatal error handling
