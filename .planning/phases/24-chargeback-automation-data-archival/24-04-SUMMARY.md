---
phase: 24-chargeback-automation-data-archival
plan: 04
subsystem: dashboard-ui
tags: [chargeback-match-status, data-archive, owner-config, cs-tracking]
dependency_graph:
  requires: [chargeback-auto-matching, archive-service, archive-routes]
  provides: [match-status-badges, archive-management-ui]
  affects: [CSTracking.tsx, OwnerConfig.tsx]
tech_stack:
  added: []
  patterns: [inline-styled-spans, fetch-preview-before-confirm, batch-history-table]
key_files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx
    - apps/ops-dashboard/app/(dashboard)/owner/OwnerConfig.tsx
decisions:
  - Used inline styled spans instead of Badge component for match status indicators (lightweight, consistent with table patterns)
  - DataArchiveSection extracted as separate component to keep OwnerConfig manageable
  - Archive preview fetched on button click, then confirm state shown inline (D-10)
metrics:
  duration: 138s
  completed: 2026-03-24
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 2
---

# Phase 24 Plan 04: Dashboard UI - Match Badges & Archive Management Summary

Match status badge column in chargeback tracking table (green/amber/red indicators) plus Data Archive management section in owner Config tab with stats, preview-count confirmation, and batch restore.

## Task Results

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Add match status badge column to CSTracking chargeback table | 3a6df2e | Done |
| 2 | Add Data Archive section to OwnerConfig | 5e7a277 | Done |

## What Was Built

### Task 1: Match Status Badge Column
- Added "Match" SortHeader column between "Assigned To" and "Submitted" in chargeback table
- Colored inline span indicators: green "Matched" (colors.success), amber "Review" for MULTIPLE (colors.warning), red "No Match" for UNMATCHED (colors.danger), gray "--" for null
- Updated cbColCount from 9 to 10 for expanded row colSpan
- Added "Match Status" column to CSV export with matchStatus value

### Task 2: Data Archive Section in Owner Config
- DataArchiveSection component with stats cards showing row counts and date ranges per archive table
- Archive controls: number input for days (default 90, D-08), "Archive All Tables" button
- Inline confirmation flow (D-10): button click fetches GET /archive/preview for real record count, then shows "This will archive {N} records older than {days} days." with Confirm/Cancel
- POST /archive sends cutoffDays and table list, shows success toast with archived count
- Batch history table with Batch ID (truncated to 8 chars), Table, Date, Records, Restore button
- Restore button calls POST /archive/restore with loading state per batch
- All styling uses inline React.CSSProperties with existing CARD, colors, typography, radius constants

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- matchStatus in CSTracking.tsx: 5 matches (header, 3 status checks, CSV)
- colors.success/warning/danger used for Matched/Review/No Match states
- cbColCount = 10 (was 9)
- "Match Status" in CSV export: 1 match
- archive/stats, archive/preview, archive/restore all present in OwnerConfig.tsx
- archiveDays, archiveConfirm, archivePreviewCounts state variables present
- toLocaleString used in confirmation text
- handleRestore defined and used in batch history
- Database icon imported from lucide-react
- No "modal" or "type to confirm" in OwnerConfig.tsx (D-10: inline only)

## Self-Check: PASSED

All files exist, all commits verified.
