---
phase: 33-core-tv-readability
plan: 01
subsystem: sales-board
tags: [tv-readability, typography, ui, weekly-view]
dependency_graph:
  requires: []
  provides: [tv-readable-weekly-table]
  affects: [apps/sales-board]
tech_stack:
  added: []
  patterns: [inline-css-properties, spacing-tokens, text-overflow-ellipsis]
key_files:
  created: []
  modified:
    - apps/sales-board/app/page.tsx
decisions:
  - Agent names fontSize 24px for TV readability at 10-15 feet
  - Daily counts fontSize 24px, daily premiums fontSize 14px
  - Premium column fontSize 24px, headers fontSize 14px
  - Vertical padding reduced from 14px to 12px (spacing[3]) to compensate for larger fonts
  - textTertiary promoted to textSecondary for contrast in lit office
  - Agent name overflow protected with ellipsis at maxWidth 160px
metrics:
  duration: ~3m
  completed: 2026-03-31
  tasks_completed: 2
  tasks_total: 2
requirements:
  - TYPO-01
  - TYPO-03
  - TYPO-05
  - OVFL-01
  - OVFL-02
  - SCAL-04
---

# Phase 33 Plan 01: WeeklyView TV Readability Summary

TV-readable weekly breakdown table with fonts scaled to 24px for agent names, counts, and premiums; padding reduced to 12px vertical; textTertiary promoted to textSecondary; agent name ellipsis overflow at 160px maxWidth.

## Changes Made

### Task 1: Increase WeeklyView table font sizes and reduce padding

**Commit:** c9ea40a

Applied all typography, padding, contrast, and overflow changes to the WeeklyView function in `apps/sales-board/app/page.tsx`:

- **TH style:** fontSize 15 to 14, padding 14px to 12px vertical
- **Agent name td:** fontSize 18 to 24, padding 14px to spacing[3] (12px) vertical
- **Agent name span:** Added overflow:hidden, textOverflow:ellipsis, whiteSpace:nowrap, maxWidth:160, display:inline-block
- **Daily cell td:** Padding 14px to spacing[3] (12px) vertical
- **Daily count span:** fontSize 20 to 24
- **Daily premium span:** fontSize 12 to 14, color textTertiary to textSecondary
- **Total column td:** Padding 14px to spacing[3] (12px) vertical (fontSize 24 unchanged)
- **Premium column td:** fontSize 15 to 24, padding 14px to spacing[3] vertical
- **Team total label td:** Padding spacing[4] to spacing[3] vertical
- **Team total daily td:** Padding spacing[4] to spacing[3] vertical
- **Team total daily count:** fontSize 20 to 24
- **Team total daily premium:** fontSize 12 to 14
- **Team total grand total td:** Padding spacing[4] to spacing[3] vertical (fontSize 28 unchanged)
- **Team total grand premium td:** fontSize 16 to 24, padding spacing[4] to spacing[3] vertical

### Task 2: Verify WeeklyView TV readability (checkpoint)

Human verification checkpoint -- approved by user. Visual confirmation that the weekly breakdown table is readable on a 1080p display at TV distance.

## Deviations from Plan

None -- plan executed exactly as written.

## Verification Results

- Build passes (next build apps/sales-board exits 0)
- No textTertiary references remain in WeeklyView region
- Multiple fontSize: 24 instances present throughout WeeklyView
- textOverflow: "ellipsis" present on agent name span
- Human visual verification approved

## Self-Check: PASSED
