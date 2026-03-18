---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Customer Service
status: completed
stopped_at: Completed 17-01-PLAN.md
last_updated: "2026-03-18T19:51:10.000Z"
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 15
  completed_plans: 15
---

---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Customer Service
status: in_progress
stopped_at: Phase 16 needs planning
last_updated: "2026-03-18T20:30:00.000Z"
last_activity: 2026-03-18 -- added Phase 16 gap closure from milestone audit
progress:
  total_phases: 6
  completed_phases: 5
  total_plans: 13
  completed_plans: 13
---

---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Customer Service
status: completed
stopped_at: Completed 15-03-PLAN.md
last_updated: "2026-03-18T16:25:21.224Z"
last_activity: 2026-03-18 -- completed 15-03 (CS Dashboard Resolution UX)
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 12
  completed_plans: 12
---

---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Customer Service
status: planning
stopped_at: Phase 15 plans verified
last_updated: "2026-03-18T15:54:24.535Z"
last_activity: 2026-03-18 -- completed 14-02 (Pending Terms Summary Bar, Grouped Table & CSV Export)
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 12
  completed_plans: 9
---

---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Customer Service
status: planning
stopped_at: Phase 14 UI-SPEC approved
last_updated: "2026-03-18T13:59:32.509Z"
last_activity: 2026-03-17 -- completed 13-02 (Pending Terms Parser UI)
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 7
  completed_plans: 7
---

---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Customer Service
status: planning
stopped_at: Completed 13-02-PLAN.md
last_updated: "2026-03-17T20:46:19.136Z"
last_activity: 2026-03-17 -- completed 13-02 (Pending Terms Parser UI)
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 7
  completed_plans: 7
---

---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Customer Service
status: planning
stopped_at: Phase 13 context gathered
last_updated: "2026-03-17T20:14:12.054Z"
last_activity: 2026-03-17 -- completed 12-02 (Chargeback Parser UI)
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
---

---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Customer Service
status: executing
stopped_at: Completed 12-02-PLAN.md
last_updated: "2026-03-17T17:48:22Z"
last_activity: 2026-03-17 -- completed 12-02 (Chargeback Parser UI)
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 4
  completed_plans: 4
---

---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Customer Service
status: Roadmap created, awaiting plan-phase
stopped_at: Phase 11 UI-SPEC approved
last_updated: "2026-03-17T15:16:25.468Z"
last_activity: 2026-03-17 -- v1.1 roadmap created
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Customer Service
status: planning
stopped_at: Roadmap created for v1.1 (7 phases, 40 requirements)
last_updated: "2026-03-17T15:00:00Z"
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Ops Platform -- Payroll & Usability Overhaul

## Project Reference

**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations -- agents get paid right, managers can track performance, owners see real KPIs.

**Current Focus:** Phase 17 — documentation-permission-cleanup (COMPLETED)

## Current Position

Phase: 17 (documentation-permission-cleanup) — COMPLETED
Plan: 1 of 1 (done)

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 15 |
| Plans total | 15 (Phase 11: 2, Phase 12: 3, Phase 13: 2, Phase 14: 2, Phase 15: 4, Phase 16: 1, Phase 17: 1) |
| Requirements done | 40/40 |
| Phases done | 7/7 |

## Accumulated Context

### Key Decisions

- assignedTo is nullable String (no FK to CsRepRoster -- name-based assignment for flexibility)
- Weekly chargeback total uses getSundayWeekRange for consistent Sun-Sat week boundaries
- Inactive rep pruning runs on-access (GET /cs-rep-roster) after 30 days
- All parser logic is client-side pure functions for instant preview without API round-trip
- AnimatedNumber with dollar prefix used for ticker instead of StatCard for custom danger-bg styling
- Round-robin assignment resets on every paste (session-scoped, not persisted)
- Created separate assignPtRoundRobin for pending terms to avoid modifying chargeback round-robin
- Shared rep roster sidebar serves both chargeback and pending terms parsers
- v1.1 phases start at 11 (continuing from v1.0 phase 10)
- Chargebacks and pending terms are decoupled from payroll (v2 integration)
- Phase 12 and 13 (parsers) can run in parallel -- both depend only on Phase 11
- Phase 14 (Tracking Tables) depends on 12+13 (both parsers must exist)
- Phase 15 (Resolution & Polish) depends on 14 (tracking tables must exist)
- KPI counters use global totals from /api/chargebacks/totals, never affected by search/filters
- SortHeader extracted as reusable component for column sorting across tracking tables
- Filter and search pipeline implemented client-side with useMemo for 200-record cap dataset
- Summary bar uses full unfiltered pendingTerms dataset for global counts (not filtered view)
- Group headers use Fragment with key for React reconciliation in grouped pending terms table
- Urgent count defined as nextBilling within 7 calendar days from today
- Shared formatDollar/formatNegDollar/formatDate in @ops/utils as single source of truth for all dashboards
- Owner dashboard KPI cards keep Intl.NumberFormat with 0 decimals (intentional whole-dollar display)
- Chargeback resolution types are "recovered" and "closed"
- Pending term resolution types are "saved" and "cancelled"
- Resolution endpoints require CUSTOMER_SERVICE, SUPER_ADMIN, or OWNER_VIEW roles
- Total Recovered KPI aggregates only chargebacks with resolutionType="recovered"
- userRoles fetch lifted to CSDashboard parent to avoid duplicate /api/session/me calls
- Default tab set to "tracking" for all users to prevent flash for CS-only users
- Single expandedRowId state shared between both tables (one panel open at a time)
- Status filter applied as first step in useMemo pipeline before other filters
- TrackingTab wrapped in ToastProvider via TrackingTabInner pattern
- TD constant wraps baseTdStyle matching existing CARD/LBL pattern in owner-dashboard
- CUSTOMER_SERVICE amber color #f59e0b matches auth-portal DASHBOARD_MAP
- Replaced isCSOnly negative check with canManageCS positive allowlist (SUPER_ADMIN or OWNER_VIEW)
- CUSTOMER_SERVICE added to SUPER_ADMIN effectiveRoles so CS dashboard card renders on landing page
- OWNER_VIEW landing card gap documented as intentional UX decision (not a bug)
- GET /cs-rep-roster kept open to all authenticated users for assignment dropdown access

### Roadmap Evolution

- v1.1 roadmap created with 7 phases covering 40 requirements

### Research Findings Applied

- holdDate uses @db.Date for DATE-only PostgreSQL type (no time component needed)
- holdDate conversion uses T00:00:00 suffix in API to prevent timezone shift on DATE column
- GET /pending-terms limited to 200 records matching chargeback pattern
- agentIdField mapped to agent_id_field to avoid FK naming confusion
- rawPaste is non-nullable (always required on paste submission)
- Card component has no title prop -- use h3 heading inside Card
- EmptyState uses title/description props (not heading/message)

### Open Questions

- (none currently)

### Blockers

None currently.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260317-dgz | Convoso call log API integration with KPI tiers and per-agent aggregates | 2026-03-17 | 6c8ef4e | [260317-dgz-convoso-call-log-api-integration-with-kp](./quick/260317-dgz-convoso-call-log-api-integration-with-kp/) |
| 260317-dqd | Wire Convoso call logs to Agent model with cost-per-sale and CallAudit auto-tag | 2026-03-17 | ba7b111 | [260317-dqd-wire-convoso-call-logs-to-agent-model-an](./quick/260317-dqd-wire-convoso-call-logs-to-agent-model-an/) |
| 260317-dxw | Cron worker polling Convoso every 10 min for per-agent KPI snapshots | 2026-03-17 | 2083caa | [260317-dxw-cron-worker-polling-convoso-every-10-min](./quick/260317-dxw-cron-worker-polling-convoso-every-10-min/) |
| 260317-e6a | Deduplicate Convoso call log processing to prevent KPI inflation | 2026-03-17 | b422e4b | [260317-e6a-deduplicate-convoso-call-logs-prevent-sa](./quick/260317-e6a-deduplicate-convoso-call-logs-prevent-sa/) |

### TODOs

- Execute Phase 12 plan 03 (Chargeback Parser verification)

## Session Continuity

**Last session:** 2026-03-18T19:51:10.000Z
**Stopped at:** Completed 17-01-PLAN.md
**Next action:** v1.1 milestone fully complete -- all 7 phases, 15 plans, 40 requirements done

---
*State initialized: 2026-03-14*
*Last updated: 2026-03-18*
