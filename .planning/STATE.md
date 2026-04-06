---
gsd_state_version: 1.0
milestone: v2.1
milestone_name: milestone
status: planning
last_updated: "2026-04-06T14:38:27.708Z"
last_activity: 2026-04-06
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

# Project State: Ops Platform -- Payroll & Usability Overhaul

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-06)

**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations -- agents get paid right, managers can track performance, owners see real KPIs.
**Current focus:** v2.1 Phase 38 -- Dashboard & Payroll Quick Fixes

## Current Position

Phase: 39
Plan: Not started
Status: Roadmap created, awaiting phase planning
Last activity: 2026-04-06

```
[....................] 0/4 phases
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Milestones shipped | 11 (v1.0 through v2.0) |
| Total phases | 37 complete |
| Total plans | 113 complete |
| Total requirements | 225+ shipped |
| Timeline | 18 days (2026-03-14 to 2026-03-31) |

## Accumulated Context

### Decisions

- Sales board is displayed on a TV for the whole office to view from a distance
- Agent count fluctuates (9 today, could be 15) -- all must fit on screen
- Each cell has plenty of whitespace -- increase fonts within existing cell dimensions
- Per-dashboard local useState replaces global DateRangeProvider for independent date range state
- Manager Tracker Today column removed (redundant with Today date range preset)
- Used includes() with length ratio guard instead of regex word boundaries for product name matching
- useMemo-based stable sort by member ID ascending in payroll agent pay cards
- ACA_PL flat commission uses early return before percentage logic to avoid bundle/enrollment fee interference
- Self-relation on Sale model links ACA covering sales to parent sales
- ACA auto-fulfill checks acaCoveringSaleId in resolveBundleRequirement before state availability checks
- Exponential backoff delays for audit retry: 1min, 5min, 15min with max 3 retries
- Audit failures categorized: recording_unavailable, transcription_timeout, claude_api_error, unknown
- 40% premium + 60% cost efficiency composite score for agent ranking
- Prisma ID-based cursor pagination over date-based cursor for reliability with duplicate timestamps

### Roadmap Evolution

- v2.1 roadmap created with 4 phases (38-41) covering 15 requirements

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
*v2.1 milestone started: 2026-04-06*
*Last updated: 2026-04-06 -- Roadmap created*
