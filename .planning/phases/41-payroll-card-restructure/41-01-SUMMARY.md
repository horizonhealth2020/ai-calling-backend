---
phase: 41-payroll-card-restructure
plan: 01
subsystem: ops-dashboard/payroll
tags: [ui-restructure, component-extraction, agent-first]
dependency_graph:
  requires: []
  provides: [agent-first-payroll-view, payroll-types-module, week-section-component, agent-card-component]
  affects: [payroll-view, print-template]
tech_stack:
  added: []
  patterns: [agent-first-data-regrouping, component-extraction, shared-types-module]
key_files:
  created:
    - apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx
  modified:
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
decisions:
  - Agent-first data regrouping via useMemo Map keyed by agent name
  - EditableLabel, CarryoverHint, EditableSaleRow moved into WeekSection.tsx (closest to usage)
  - CS section rendered per-period outside agent cards (prevents mixing hierarchies)
  - ACA_PL added to ProductType union for consistency across codebase
  - Week date range added to print template header for per-week print output
metrics:
  duration_seconds: 1248
  completed: "2026-04-01T19:59:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 1
---

# Phase 41 Plan 01: Payroll Card Restructure Summary

Agent-first payroll hierarchy with AgentCard/WeekSection components extracted from monolithic PayrollPeriods.tsx, shared types module, and per-week print template

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Extract shared types, constants, and helpers | 5002d2b | payroll-types.ts with 14 types, 12 style constants, 2 helpers |
| 2 | Create WeekSection/AgentCard, rewrite main render | a19cd78 | 3 new files, agent-first useMemo regrouping, per-week print |

## What Changed

### payroll-types.ts (new, 207 lines)
Shared module containing all type definitions (Entry, Period, AgentAdjustment, Product, etc.), new agent-first types (AgentPeriodData, AgentData), style constants (SMALL_INP, STATUS_BADGE, HEADER_LBL, etc.), and helper functions (isActiveEntry, fmtDate).

### WeekSection.tsx (new, 903 lines)
Per-week collapsible section extracted from the old AgentPayCard. Contains:
- EditableLabel, CarryoverHint, EditableSaleRow (moved from PayrollPeriods.tsx)
- Week header with date range, status badge toggle, Print Week button, Paid/Unpaid button
- Financial strip with Commission, Bonus/Fronted/Hold inputs, Net
- Sale table showing all entries (no COLLAPSED_LIMIT)
- Selected week visual indicator (3px accentTeal left border)
- Pending approvals section

### AgentCard.tsx (new, 183 lines)
Top-level collapsible agent card wrapping multiple WeekSections:
- Agent header with name, Top Earner badge, sale count, read-only financial summary of selected week
- Iterates periods sorted by weekStart descending, renders WeekSection per period
- All-paid opacity reduction (0.7)

### PayrollPeriods.tsx (rewritten, 836 lines, down from 2042)
Main orchestrator with agent-first data regrouping:
- `agentData` useMemo builds Map<string, AgentData> from periods
- `expandedAgents` (Set), `expandedWeeks` (Map<string, Set>), `selectedWeek` (Map<string, string>)
- Last 2 weeks expanded by default (D-14), all agents start expanded
- Agents sorted by gross desc, top 3 with net > 0 get Top Earner badge
- CS section rendered per-period outside agent cards
- Print template updated with week date range below agent name

## Decisions Made

1. **Component location**: EditableLabel, CarryoverHint, EditableSaleRow moved into WeekSection.tsx rather than kept separate -- they are tightly coupled with the week section rendering
2. **CS section outside agent cards**: Customer Service entries remain period-grouped and render after all agent cards, preventing hierarchy mixing
3. **ACA_PL ProductType**: Added to union type for consistency (was missing but used in codebase)
4. **Print template**: Week date range added below agent name header for D-20 compliance

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added ACA_PL to ProductType union**
- **Found during:** Task 1
- **Issue:** ProductType was missing "ACA_PL" variant that exists in PayrollProducts.tsx and ManagerEntry.tsx
- **Fix:** Added "ACA_PL" to the ProductType union in payroll-types.ts
- **Files modified:** payroll-types.ts
- **Commit:** 5002d2b

## Locked Decisions Honored

All 20 decisions (D-01 through D-20) from 41-CONTEXT.md implemented:
- D-01: Agent cards are top-level collapsible containers
- D-02: Period/week sections inside with commission strip and inputs
- D-03: All agents shown (seeded from allAgents)
- D-04/05/06: Agent header with read-only financial summary of selected week
- D-07: No Print/Paid buttons in agent header
- D-08/09: Week sections with date range, status, financial strip, print, paid
- D-10/11: Editable bonus/hold labels with carryover hints per-week
- D-12: Mark Paid styling unchanged
- D-13: All entries shown (no show more/less)
- D-14: Last 2 weeks expanded by default
- D-15: Any week toggleable
- D-16: Agent cards collapsible
- D-17/18: Table layout preserved, Agent column stays
- D-19: Print button per-week
- D-20: Print output matches new layout with week date range

## Verification

- TypeScript compilation: passes (only pre-existing errors in middleware.ts, page.tsx, packages/auth)
- File decomposition: PayrollPeriods.tsx 836 lines (target was 800-1000, was 2042)
- No single file exceeds 1200 lines (largest is WeekSection.tsx at 903)
- All handler functions preserved in PayrollPeriods.tsx
- CS section renders correctly per-period

## Self-Check: PASSED

- FOUND: payroll-types.ts
- FOUND: WeekSection.tsx
- FOUND: AgentCard.tsx
- FOUND: 41-01-SUMMARY.md
- FOUND: commit 5002d2b
- FOUND: commit a19cd78
