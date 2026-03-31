---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Sales Board TV Readability
status: active
last_updated: "2026-03-31"
last_activity: 2026-03-31
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Ops Platform -- Payroll & Usability Overhaul

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-31)

**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations -- agents get paid right, managers can track performance, owners see real KPIs.
**Current focus:** v2.0 Sales Board TV Readability

## Current Position

Phase: 33 - Core TV Readability (not started)
Plan: --
Status: Roadmap created, ready for phase planning
Last activity: 2026-03-31 -- Roadmap created with 2 phases (33-34)

```
[==                  ] 0/2 phases | 0/0 plans
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Milestones shipped | 10 (v1.0 through v1.9) |
| Total phases | 32 complete |
| Total plans | 94 complete |
| Total requirements | 224 shipped |
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
*Last session: 2026-03-31 -- Roadmap created*
*Last updated: 2026-03-31*
