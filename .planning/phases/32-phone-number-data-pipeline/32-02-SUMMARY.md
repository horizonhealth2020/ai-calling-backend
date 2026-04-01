---
phase: 32-phone-number-data-pipeline
plan: 02
subsystem: dashboard-ui
tags: [react, phone-number, manager-dashboard, inline-editing]
dependency_graph:
  requires: [leadPhone-schema, leadPhone-poller, leadPhone-api]
  provides: [phone-column-audits, phone-column-sales, phone-edit-input]
  affects: [ManagerAudits, ManagerSales]
tech_stack:
  added: []
  patterns: [formatPhone-helper, auto-format-input]
key_files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx
decisions:
  - Phone column placed after Agent in audits table (per D-02)
  - Phone column placed after Lead Source in sales table (per D-03)
  - Edit form uses 4-column grid row for Carrier/Member Name/Member State/Phone
metrics:
  duration: 160s
  completed: 2026-03-30T15:39:41Z
---

# Phase 32 Plan 02: Dashboard Phone Column Display Summary

Phone columns added to ManagerAudits and ManagerSales tables with (XXX) XXX-XXXX formatting, em-dash fallback for missing data, and auto-formatting phone input on sales edit form.

## What Was Done

### Task 1: Phone Column in ManagerAudits Table
- Added `formatPhone` helper function for 10-digit and 11-digit (1+10) phone formatting
- Added `convosoCallLog` field to `CallAudit` type definition
- Inserted "Phone" header after "Agent" with `minWidth: 130`
- Added phone cell rendering using `a.convosoCallLog?.leadPhone` with `formatPhone` display
- Em-dash fallback for null/missing phone data using `colors.textMuted`
- Updated Score column `textAlign: "center"` index from 3 to 4
- Changed all `colSpan={6}` to `colSpan={7}` (expanded details + edit rows)

### Task 2: Phone Column and Edit Input in ManagerSales Table
- Added `formatPhone` helper (same implementation as audits)
- Added `leadPhone` field to `Sale` type definition
- Inserted "Phone" header after "Lead Source" with `minWidth: 130`
- Added phone cell rendering using `s.leadPhone` with `formatPhone` display
- Updated Premium column `textAlign: "right"` index from 5 to 6, Status center index from 6 to 7
- Changed `colSpan={9}` to `colSpan={10}` on edit expansion row
- Added `leadPhone: sale.leadPhone || ""` to `startEdit` original mapping
- Changed Carrier/Member Name/Member State row from 3-column to 4-column grid
- Added auto-formatting phone input: displays formatted via `formatPhone()`, stores raw digits via `onChange` stripping non-digits and capping at 10
- PATCH payload includes `leadPhone` automatically via existing diff-based `saveEdit` logic

## Deviations from Plan

None - plan executed exactly as written.

## Verification

- TypeScript compilation: zero errors in ManagerAudits.tsx and ManagerSales.tsx (pre-existing errors in unrelated files out of scope)
- No remaining `colSpan={6}` in ManagerAudits.tsx (all updated to 7)
- No remaining `colSpan={9}` in ManagerSales.tsx (all updated to 10)
- `formatPhone` present in both files
- `convosoCallLog?.leadPhone` present in ManagerAudits.tsx
- `s.leadPhone` present in ManagerSales.tsx
- Phone edit input with `placeholder="(555) 123-4567"` present in ManagerSales.tsx

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | e71f686 | Add Phone column to ManagerAudits table |
| 2 | 89e87ce | Add Phone column and edit input to ManagerSales table |

## Self-Check: PASSED

All 2 modified files verified present. Both commits (e71f686, 89e87ce) confirmed in git log.
