---
phase: 14-tracking-tables
plan: 02
subsystem: cs-dashboard-tracking
tags: [pending-terms, summary-bar, grouped-table, filters, csv-export]
dependency_graph:
  requires: [14-01 chargeback KPI bar and table, pending-terms endpoints]
  provides: [pending terms summary bar, grouped-by-agent table, pending terms filters, combined CSV export]
  affects: [cs-dashboard tracking tab]
tech_stack:
  added: []
  patterns: [group-by-agent collapsible sections, ptSummary useMemo, filteredPending pipeline, Fragment keyed rendering]
key_files:
  created: []
  modified:
    - apps/cs-dashboard/app/page.tsx
decisions:
  - Summary bar uses full unfiltered pendingTerms dataset for global counts
  - Group headers use Fragment with key for proper React reconciliation
  - Hold reason categories rendered as uppercase pill/badge spans sorted by count descending
  - Urgent count defined as nextBilling within 7 calendar days from today
metrics:
  duration: 136s
  completed: "2026-03-18T14:24:53Z"
---

# Phase 14 Plan 02: Pending Terms Summary Bar, Grouped Table & CSV Export Summary

Pending terms summary bar with total/hold_reason category pills/urgent count, group-by-agent collapsible table with 7 color-coded columns, 6-field filter panel, and pending terms data wired into shared CSV export.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Add pending terms summary bar, grouped table, filters, and wire CSV export | be39bee | apps/cs-dashboard/app/page.tsx |

## Implementation Details

### Task 1: Full Pending Terms Implementation

- **Summary Bar:** Horizontal card with TOTAL PENDING count, hold_reason category pills (uppercase with count, sorted by frequency), and DUE WITHIN 7 DAYS urgent count in danger red
- **Filter Pipeline:** `filteredPending` useMemo searches memberName, memberId, agentName, agentIdField, phone; filters by agent, state, product, holdReason keyword, date ranges
- **Grouping:** `groupedPending` useMemo groups by agentName (fallback "Unassigned"), alphabetical group order with collapsible sections via Set<string> toggle
- **Table:** 7 visible columns (Member Name, Member ID, Phone, Product, Hold Date, Next Billing, Assigned To) + delete button. agentName/agentId never rendered as columns
- **Color Coding:** Hold Date in `colors.danger` (red), Next Billing in `colors.success` (green)
- **CSV Export:** Added `filteredPending.forEach` block appending pending terms rows after chargebacks section
- **Delete:** `handleDeletePt` with optimistic UI update removing record from state
- **Fragment:** Added `Fragment` to React imports for keyed fragment rendering in grouped table

## Deviations from Plan

None - plan executed exactly as written.

## Decisions Made

1. Summary bar uses full unfiltered `pendingTerms` array (not `filteredPending`) for global totals
2. Urgent count checks `nextBilling` is between today and 7 days out (inclusive on both ends)
3. Hold reason categories sorted by count descending (most common first)
4. Group headers default expanded (collapsed Set starts empty)

## Self-Check: PASSED

- [x] apps/cs-dashboard/app/page.tsx exists
- [x] Commit be39bee found (Task 1)
- [x] "TOTAL PENDING" label present in summary bar
- [x] "DUE WITHIN 7 DAYS" label present in summary bar
- [x] groupedPending useMemo implemented
- [x] toggleGroup function implemented
- [x] handleDeletePt function implemented
- [x] filteredPending.forEach wired into CSV export
- [x] Hold Date uses colors.danger
- [x] Next Billing uses colors.success
- [x] agentName never appears as a table column (0 matches with baseTdStyle)
- [x] Fragment imported from React
