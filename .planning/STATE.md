---
gsd_state_version: 1.0
milestone: v1.3
milestone_name: Dashboard Consolidation & Uniform Date Ranges
status: active
stopped_at: null
last_updated: "2026-03-19T18:00:00.000Z"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Ops Platform -- Payroll & Usability Overhaul

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations -- agents get paid right, managers can track performance, owners see real KPIs.
**Current focus:** v1.3 — Dashboard Consolidation & Uniform Date Ranges

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-03-19 — Milestone v1.3 started

## Performance Metrics

| Metric | Value |
|--------|-------|
| Milestones shipped | 3 (v1.0, v1.1, v1.2) |
| Total phases | 18 (all complete) |
| Total plans | 54 (46 prior + 8 Phase 18) |
| Total requirements | 114 (50 v1.0 + 40 v1.1 + 24 v1.2) |
| Timeline | 6 days (2026-03-14 → 2026-03-19) |

## Accumulated Context

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260317-dgz | Convoso call log API integration with KPI tiers and per-agent aggregates | 2026-03-17 | 6c8ef4e | [260317-dgz-convoso-call-log-api-integration-with-kp](./quick/260317-dgz-convoso-call-log-api-integration-with-kp/) |
| 260317-dqd | Wire Convoso call logs to Agent model with cost-per-sale and CallAudit auto-tag | 2026-03-17 | ba7b111 | [260317-dqd-wire-convoso-call-logs-to-agent-model-an](./quick/260317-dqd-wire-convoso-call-logs-to-agent-model-an/) |
| 260317-dxw | Cron worker polling Convoso every 10 min for per-agent KPI snapshots | 2026-03-17 | 2083caa | [260317-dxw-cron-worker-polling-convoso-every-10-min](./quick/260317-dxw-cron-worker-polling-convoso-every-10-min/) |
| 260317-e6a | Deduplicate Convoso call log processing to prevent KPI inflation | 2026-03-17 | b422e4b | [260317-e6a-deduplicate-convoso-call-logs-prevent-sa](./quick/260317-e6a-deduplicate-convoso-call-logs-prevent-sa/) |

### Key Decisions (v1.2)

| Decision | Rationale |
|----------|-----------|
| Single phase for all 24 requirements | User requested consolidation -- all v1.2 work is integration/polish, not new architecture |
| Phase 18 numbering | Continues from v1.1 Phase 17 |
| Parse flow auto-fills form directly, user edits fields after | Simpler UX — no extra confirm step needed |
| Status mapping defaults to RAN for unrecognized values | Safer than failing with invalid enum errors |
| Core product never auto-selected unless parsed | Explicit matching only -- no assumptions |
| Enrollment threshold is 125 not 124 | Matched actual server logic in applyEnrollmentFee |
| Bonus/fronted/hold removed from sale rows, kept on agent card header | Agent card header provides aggregate editing; sale rows show only commission and net |
| DB polling replaces in-memory queue for audit jobs | Crash resilience -- jobs persist across server restarts |
| Default daily AI budget cap of $10 | Prevents runaway AI costs without configuration |
| Alert pipeline uses informational-only approach with manual approve/clear | P2 research flag: never auto-deduct from payroll |
| Rep sync uses prisma.$transaction for atomic dual-table creation | Ensures CsRepRoster and ServiceAgent stay in sync |
| Round robin index persisted in SalesBoardSetting | Reuses existing key-value table, survives server restarts |
| Agent KPI matching uses case-insensitive name comparison | ChargebackSubmission.memberAgentId is free-text, matched by name |
| Permission overrides use upsert with compound unique key | Clean override pattern: role defaults + per-user overrides |
| Storage plan limit defaults 1 GB with 80% alert threshold | Configurable via SalesBoardSetting without code changes |
| Bundle qualifier addons fold into core commission rate | Simplifies commission calc -- bundle premium uses single rate |
| Net column removed from sale rows, kept on agent card header | Avoids confusion between per-sale and aggregate net |
| AI system prompt auto-seeds default on first access | Prevents errors when no prompt exists in database |

### Research Flags (from SUMMARY.md)

- **P1 (Critical):** AI scoring queue needs DB-backed persistence, not in-memory array -- design before implementing AI-03
- **P2 (Critical):** Chargeback-to-payroll matching must be informational-only with manual approval -- never auto-deduct
- **P4 (High):** Bidirectional payroll toggle must restrict un-pay to OPEN periods only
- **P5 (High):** Service agent sync must resolve identity split before building round robin (REP-01 before REP-03)

### Open Questions

- (none currently)

### Blockers

None currently.

## Session Continuity

**Last session:** 2026-03-19
**Stopped at:** Milestone v1.3 initialization
**Next action:** Define requirements → create roadmap

---
*State initialized: 2026-03-14*
*Last updated: 2026-03-19*
