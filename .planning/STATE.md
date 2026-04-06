---
gsd_state_version: 1.0
milestone: v2.2
milestone_name: Chargeback Batch Review & Payroll Agent Tabs
status: executing
last_updated: "2026-04-06T16:57:43.329Z"
last_activity: 2026-04-06 -- Phase 42 planning complete
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 1
  completed_plans: 0
  percent: 0
---

# Project State: Ops Platform -- Payroll & Usability Overhaul

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-06)

**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations -- agents get paid right, managers can track performance, owners see real KPIs.
**Current focus:** v2.2 -- Chargeback Batch Review & Payroll Agent Tabs

## Current Position

Phase: 42 - ACA Product Fix (not started)
Plan: --
Status: Ready to execute
Last activity: 2026-04-06 -- Phase 42 planning complete

## Progress

```
v2.2: [..........] 0% (0/3 phases)
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Milestones shipped | 12 (v1.0 through v2.1) |
| Total phases | 41 complete, 3 remaining |
| Total plans | 120 complete, 0 remaining |
| Total requirements | 246+ shipped, 15 active |
| Timeline | 18 days (2026-03-14 to 2026-04-01) |

## Accumulated Context

### Decisions

- Sales board is displayed on a TV for the whole office to view from a distance
- Agent count fluctuates (9 today, could be 15) -- all must fit on screen
- Each cell has plenty of whitespace -- increase fonts within existing cell dimensions
- Current font sizes too small: daily premium 12px, agent names 18px, daily counts 20px
- All changes land in a single file: apps/sales-board/app/page.tsx
- Row height budget at 15 agents is ~49px per row -- reduce vertical padding from 14px to 11-12px to compensate for larger fonts
- Promote textTertiary to textSecondary for anything readable on a TV in a lit office
- KPI stat card numbers scaled from 30px to 36px base, conditional premium cards use 28/36
- Card padding reduced from 20px uniform to 12px/16px to absorb font growth without changing card size
- Team total row vertical padding further reduced from 12px to 8px per user feedback during visual verification
- Per-dashboard local useState replaces global DateRangeProvider for independent date range state
- Manager Tracker Today column removed (redundant with Today date range preset)
- Used includes() with length ratio guard instead of regex word boundaries for product name matching
- useMemo-based stable sort by member ID ascending in payroll agent pay cards
- ACA_PL flat commission uses early return before percentage logic to avoid bundle/enrollment fee interference
- Self-relation on Sale model links ACA covering sales to parent sales
- ACA auto-fulfill checks acaCoveringSaleId in resolveBundleRequirement before state availability checks
- ACA checkbox placed after payment type selector, before submit button in manager entry form
- Standalone ACA section uses collapsible pattern below main sale form
- ACA badge uses info-blue color to distinguish from regular product badges in payroll cards
- Flat commission displayed as "$X.XX x N members = $total" format
- Exponential backoff delays for audit retry: 1min, 5min, 15min with max 3 retries
- Recording retry extended to 20 (20min) for long calls where Convoso takes longer to process
- Audit failures categorized: recording_unavailable, transcription_timeout, claude_api_error, unknown
- [Phase 37]: 40% premium + 60% cost efficiency composite score for agent ranking
- Prisma ID-based cursor pagination over date-based cursor for reliability with duplicate timestamps
- Agent list fetched once on mount via distinct query for filter dropdown
- Fronted uses C.warning (orange) on both dashboard and print; min=0 prevents zero-value browser validation errors
- [Phase 40]: halvingReason always preserved regardless of commissionApproved; halving only applied when NOT approved
- [Phase 40]: Fronted becomes additive in net formula (Commission + Bonus + Fronted - Hold)
- [Phase 40]: Approval buttons driven by halvingReason presence, not enrollment fee threshold
- [Phase 40]: Print pills positioned left of commission amount for column alignment
- [Phase 40]: EditableLabel uses display:block so labels sit above inputs
- [Phase 40]: Carryover flags cleared on zero-value to prevent stale label indicators
- [Phase 41]: Agent-first payroll hierarchy with AgentCard/WeekSection component extraction
- [Phase 41]: Agent-first data regrouping via useMemo Map keyed by agent name
- [Phase 41]: CS section rendered per-period outside agent cards (prevents hierarchy mixing)
- [Phase 41]: ACA_PL added to ProductType union for consistency

### Roadmap Evolution

- Phase 36 added: Fix manager sales entry parsing error and payroll UI issues
- Phase 37 added: Fix call audit issues, manager dashboard UI, and agent performance card order
- v2.1 roadmap: 4 phases (38-41) covering 14 requirements
- v2.2 roadmap: 3 phases (42-44) covering 17 requirements

### Research Notes (v2.2)

- Payroll agent tabs: pure UI refactor, zero API changes -- use existing agentData Map and sortedAgents array
- Chargeback batch: needs GET /api/chargebacks/preview-match endpoint and batch transaction in POST handler
- Pitfall: N+1 queries in match loop -- batch with single IN clause
- Pitfall: Socket.IO emits per-item -- needs batch emission (alerts_batch_created event)
- Pitfall: consolidateByMember() must NOT run before review table -- present ParsedRow[] unconsolidated
- Pitfall: clawback dedupe checks per-chargeback, not per-sale -- batch can create double clawbacks on same sale
- Pitfall: agent tab state loss on socket update -- use useRef guard for selectedAgentId

### Open Questions

None currently.

### Blockers

None currently.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260326-lsx | Add fallback products for core bundle requirements in payroll dashboard | 2026-03-26 | ee186ff | [260326-lsx-add-fallback-products-for-core-bundle-re](./quick/260326-lsx-add-fallback-products-for-core-bundle-re/) |
| 260326-maj | Increase role dashboard dropdown auto-minimize delay to 2 seconds | 2026-03-26 | 25b24c2 | [260326-maj-increase-role-dashboard-dropdown-auto-mi](./quick/260326-maj-increase-role-dashboard-dropdown-auto-mi/) |
| 260330-irn | Add notes dropdown to agent sales and payroll views | 2026-03-30 | c305ca3 | [260330-irn-add-notes-dropdown-to-agent-sales-and-pa](./quick/260330-irn-add-notes-dropdown-to-agent-sales-and-pa/) |
| 260330-jfj | Add audio buffer validation to audit queue | 2026-03-30 | b67ad52 | [260330-jfj-add-audio-buffer-validation-to-audit-que](./quick/260330-jfj-add-audio-buffer-validation-to-audit-queue/) |
| 260401-n4p | Fix payroll card collapse on edit, approval badges, summary colors | 2026-04-01 | 2330e49 | [260401-n4p-fix-payroll-card-collapse-on-edit-restor](./quick/260401-n4p-fix-payroll-card-collapse-on-edit-restor/) |
| 260401-nu5 | Chargebacks target oldest OPEN period, per-product partial chargebacks | 2026-04-01 | 40aae1b | [260401-nu5-chargebacks-apply-to-oldest-open-payroll](./quick/260401-nu5-chargebacks-apply-to-oldest-open-payroll/) |

---
*State initialized: 2026-03-14*
*v2.2 milestone started 2026-04-06*
*Last updated: 2026-04-06 -- Roadmap created*
