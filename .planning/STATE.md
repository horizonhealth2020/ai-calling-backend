---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: State-Aware Bundle Requirements
status: Defining requirements
stopped_at: null
last_updated: "2026-03-23"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Ops Platform -- Payroll & Usability Overhaul

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations -- agents get paid right, managers can track performance, owners see real KPIs.
**Current focus:** Defining requirements for v1.4

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-23 — Milestone v1.4 started

## Performance Metrics

| Metric | Value |
|--------|-------|
| Milestones shipped | 4 (v1.0, v1.1, v1.2, v1.3) |
| Total phases | 19 (all complete) |
| Total plans | 64 (all complete) |
| Total requirements | 133 |
| Timeline | 10 days shipped (2026-03-14 to 2026-03-23) |

## Accumulated Context

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260317-dgz | Convoso call log API integration with KPI tiers and per-agent aggregates | 2026-03-17 | 6c8ef4e | [260317-dgz-convoso-call-log-api-integration-with-kp](./quick/260317-dgz-convoso-call-log-api-integration-with-kp/) |
| 260317-dqd | Wire Convoso call logs to Agent model with cost-per-sale and CallAudit auto-tag | 2026-03-17 | ba7b111 | [260317-dqd-wire-convoso-call-logs-to-agent-model-an](./quick/260317-dqd-wire-convoso-call-logs-to-agent-model-an/) |
| 260317-dxw | Cron worker polling Convoso every 10 min for per-agent KPI snapshots | 2026-03-17 | 2083caa | [260317-dxw-cron-worker-polling-convoso-every-10-min](./quick/260317-dxw-cron-worker-polling-convoso-every-10-min/) |
| 260317-e6a | Deduplicate Convoso call log processing to prevent KPI inflation | 2026-03-17 | b422e4b | [260317-e6a-deduplicate-convoso-call-logs-prevent-sa](./quick/260317-e6a-deduplicate-convoso-call-logs-prevent-sa/) |

### Key Decisions (v1.3)

| Decision | Rationale |
|----------|-----------|
| Single consolidated phase (Phase 19) | User requested all work in one long-running phase |
| Route-segment-per-dashboard | Prevents monster file anti-pattern; enables per-route code splitting |
| SocketProvider in shared layout | Avoids connect/disconnect churn on tab switches |
| DateRangeContext in shared layout | Persists date range selection across tab navigation |
| Same-origin login in unified dashboard | /api/login returns relative redirect instead of cross-domain URL |
| Middleware verifies tokens directly | verifySessionToken called in middleware instead of HTTP verify call |
| tsconfig needs explicit baseUrl for Next.js | Monorepo base tsconfig baseUrl overrides app-level paths without explicit override |
| Self-contained sub-tab components for Owner | Each sub-tab manages own state/fetching; no shared state in orchestrator |
| Socket events via prop instead of useSocket | Unified app uses SocketProvider context; sub-tabs bind events on socket prop |
| Payroll orchestrator owns shared state | Periods, products, agents, alerts loaded once at orchestrator level; sub-tabs receive as props |
| Manager orchestrator owns shared state | agents, products, leadSources fetched once in page.tsx; passed as props to all 5 sub-tabs |
| Socket sale:changed at page level for Manager | Patches tracker and salesList simultaneously for cross-tab real-time updates |
| Replaced OwnerOverview RangePicker with DateRangeFilter | Uniform KPI_PRESETS across all dashboards |
| getAgentRetentionKpis accepts optional dateWindow | Backward compatible -- defaults to 30-day rolling window |

### Open Questions

- (none currently)

### Blockers

None currently.

---
*State initialized: 2026-03-14*
*Last updated: 2026-03-23*
