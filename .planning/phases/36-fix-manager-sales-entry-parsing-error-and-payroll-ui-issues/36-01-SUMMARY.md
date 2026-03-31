---
phase: 36-fix-manager-sales-entry-parsing-error-and-payroll-ui-issues
plan: 01
subsystem: ops-dashboard
tags: [bugfix, parser, payroll, ui]
dependency_graph:
  requires: []
  provides: [matchProduct-includes-matching, stable-entry-sort]
  affects: [manager-sales-entry, payroll-agent-cards]
tech_stack:
  added: []
  patterns: [includes-containment-with-length-guard, useMemo-stable-sort]
key_files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
decisions:
  - "Used includes() with length ratio guard (>0.5) instead of regex word boundaries for product matching"
  - "Used useMemo for stable sort to avoid re-sorting on every render"
  - "Nulls-first sort order so entries without member ID appear at top of agent pay cards"
metrics:
  duration: 116s
  completed: "2026-03-31T17:56:15Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 36 Plan 01: Fix Product Name Matching and Payroll Entry Sort Summary

Fixed regex-based product matching that broke on dollar signs and commas, and added stable member-ID sort to payroll agent pay cards.

## Task Results

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix matchProduct() to handle dollar signs and commas | fb8e6ea | ManagerEntry.tsx |
| 2 | Sort payroll agent pay card entries by member ID ascending | f746b21 | PayrollPeriods.tsx |

## Changes Made

### Task 1: matchProduct() Fix
Replaced the entire regex-based matching approach (using `\b` word boundaries that fail on `$` and `,` characters) with `String.includes()` containment checks. Added a length ratio guard (`shorter / longer > 0.5`) to prevent short product names from false-matching against longer ones. Products like "American Financial - Critical Illness $5,000" now match correctly.

### Task 2: Payroll Entry Stable Sort
Added a `useMemo`-based sort in the `AgentPayCard` component that orders entries by member ID ascending. Entries without a member ID sort to the top. Uses numeric comparison when both IDs are numbers, with string `localeCompare` fallback. This prevents row reordering when entry amounts are edited (since member IDs are immutable).

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation passes for both files (pre-existing errors in middleware.ts and packages/auth unrelated)
- No `\b` regex patterns remain in matchProduct()
- `sortedEntries` computed via `useMemo` with member ID sort
- `visibleEntries` references `sortedEntries` not `entries`
- Agent card-level sort (by gross premium descending) not modified

## Self-Check: PASSED

All files exist, all commits verified.
