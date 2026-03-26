---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: Lead Source Timing Analytics
status: Roadmap created — ready for planning
last_updated: "2026-03-26"
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Ops Platform -- Payroll & Usability Overhaul

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations -- agents get paid right, managers can track performance, owners see real KPIs.
**Current focus:** v1.8 Lead Source Timing Analytics -- Phase 30 ready for planning

## Current Position

Phase: 30 - Lead Source Timing Analytics
Plan: --
Status: Roadmap created, awaiting plan-phase
Last activity: 2026-03-26 -- Roadmap created for v1.8

```
v1.8 Lead Source Timing Analytics
[                                        ] 0% (0/1 phases)
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Milestones shipped | 8 (v1.0 through v1.7) |
| Total phases | 29 complete + 1 planned |
| Total plans | 86 complete |
| Total requirements | 189 shipped + 25 v1.8 |
| Timeline | 12 days shipped (2026-03-14 to 2026-03-26) |
| Phase 29 P01 | 4min | 2 tasks | 3 files |
| Phase 29 P02 | 4min | 2 tasks | 5 files |
| Phase 29 P03 | 3min | 2 tasks | 3 files |
| Phase 29 P04 | 1min | 2 tasks | 2 files |

## Accumulated Context

### Key Decisions (v1.8)

| Decision | Rationale |
|----------|-----------|
| Single phase for all 25 requirements | User directive -- feature is cohesive enough to deliver as one unit; avoids artificial splits |
| Phase 30 continues from v1.7 Phase 29 | Maintains global phase numbering across milestones |

### Key Decisions (v1.7)

| Decision | Rationale |
|----------|-----------|
| Quick fixes before data flow | Independent low-risk changes ship first; reduces codebase noise before higher-risk poller work |
| Convoso data flow before cost display | Hard dependency -- cost display queries ConvosoCallLog which must be populated first |
| Manager products read-only (not removed) | Research confirmed managers use products for reference; read-only preserves visibility |
| CS Resolved Log independent of data flow | No shared dependencies; sequential ordering is for simplicity, not necessity |
| Used PendingTerm not PendingTermSubmission | Prisma schema model name is PendingTerm; accessor is prisma.pendingTerm |
| ConvosoCallLog writes use newRaw before buffer | All calls logged regardless of duration; buffer only affects KPI aggregation |
| tracker/summary wrapped as { agents, convosoConfigured } | Breaking API change handled by updating all 3 frontend consumers |
| Removed ProductRow component entirely | Cleaner than disabling buttons; dead code removal preferred |
| Inline IIFE for addon total in table cell | Matches card-level summation pattern already in ManagerSales |

### Open Questions

- Convoso API field names and units (seconds vs minutes for call_length) -- must be verified against live response during Phase 30
- Sale hour precision: Sale.saleDate may lack hour-level precision -- data audit needed before writing aggregation queries
- Timezone for heatmap hours: America/Los_Angeles (Convoso source) vs America/New_York (business ops) -- confirm which timezone managers think in

### Blockers

None currently.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260326-lsx | Add fallback products for core bundle requirements in payroll dashboard | 2026-03-26 | ee186ff | [260326-lsx-add-fallback-products-for-core-bundle-re](./quick/260326-lsx-add-fallback-products-for-core-bundle-re/) |
| 260326-maj | Increase role dashboard dropdown auto-minimize delay to 2 seconds | 2026-03-26 | 25b24c2 | [260326-maj-increase-role-dashboard-dropdown-auto-mi](./quick/260326-maj-increase-role-dashboard-dropdown-auto-mi/) |

---
*State initialized: 2026-03-14*
*Last session: Roadmap created for v1.8 Lead Source Timing Analytics*
*Last updated: 2026-03-26*
