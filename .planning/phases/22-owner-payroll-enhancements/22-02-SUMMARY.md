---
phase: 22-owner-payroll-enhancements
plan: 02
subsystem: payroll-exports
tags: [csv-export, agent-grouping, print-cards, service-staff]
dependency_graph:
  requires: []
  provides: [agent-first-csv-export, service-staff-csv-section]
  affects: [PayrollExports.tsx]
tech_stack:
  added: []
  patterns: [Map-based-grouping, tagged-entry-pattern]
key_files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx
decisions:
  - Agent-first grouping with per-agent-per-week blocks (D-04)
  - Alphabetical agents, chronological weeks within each (D-05)
  - Header + sales + subtotal per block (D-06)
  - Service staff trailing section with own columns (D-08, D-09)
metrics:
  duration: 79s
  completed: 2026-03-24T17:17:41Z
  tasks_completed: 1
  tasks_total: 1
  files_modified: 1
---

# Phase 22 Plan 02: Detailed CSV Export - Agent-First Print Card Layout Summary

Agent-first CSV grouping with header/subtotal blocks per agent-week and trailing service staff section with separate column headers.

## What Was Done

### Task 1: Refactor exportDetailedCSV to agent-first print card layout
**Commit:** `4d0da32`

Replaced the period-first export logic with agent-first grouping:

- Entries collected across all filtered periods and tagged with period metadata
- Grouped by agent name using Map, sorted alphabetically
- Within each agent, grouped by period (weekStart), sorted chronologically
- Each agent-week block: header row (agent name + date range), individual sale rows, subtotal row
- Blank separator row between agents
- New trailing SERVICE STAFF section with "=== SERVICE STAFF ===" separator
- Service staff column headers: Week Start, Week End, Service Agent, Base Pay, Bonus, Deductions, Fronted, Total Pay
- Service entries grouped by agent then period, same pattern as commission agents
- Summary CSV export (`exportCSV`) left completely unchanged

## Deviations from Plan

None - plan executed exactly as written.

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| EXPORT-01 | Complete | Agent-first grouped pay card blocks matching print card layout |
| EXPORT-02 | Complete | Header row + sale rows + subtotal row per agent-week block |
| EXPORT-03 | Complete | Array-of-arrays with single join, handles 100+ agents / 1000+ sales |

## Self-Check: PASSED
