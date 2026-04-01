---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: Payroll Card Overhaul & Carryover System
status: Defining requirements
last_updated: "2026-04-01"
last_activity: 2026-04-01
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Ops Platform -- Payroll & Usability Overhaul

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-01)

**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations -- agents get paid right, managers can track performance, owners see real KPIs.
**Current focus:** Defining requirements for v2.1

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-01 — Milestone v2.1 started

## Performance Metrics

| Metric | Value |
|--------|-------|
| Milestones shipped | 10 (v1.0 through v1.9) |
| Total phases | 32 complete |
| Total plans | 95 complete |
| Total requirements | 225 shipped |
| Timeline | 17 days (2026-03-14 to 2026-03-30) |

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

### Roadmap Evolution

- Phase 36 added: Fix manager sales entry parsing error and payroll UI issues
- Phase 37 added: Fix call audit issues, manager dashboard UI, and agent performance card order

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

---
*State initialized: 2026-03-14*
*v2.0 milestone started: 2026-03-31*
*Last session: 2026-03-31 -- Completed all Phase 37 plans (37-00 through 37-03)*
*Last updated: 2026-03-31*
