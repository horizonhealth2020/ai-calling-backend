---
phase: 33-core-tv-readability
plan: 02
subsystem: ui
tags: [react, css, typography, sales-board, tv-readability]

# Dependency graph
requires:
  - phase: 33-01
    provides: WeeklyView table TV readability changes
provides:
  - TV-readable KPI stat cards with increased font sizes and tightened spacing
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Proportional conditional font scaling for overflow protection on premium values"
    - "Padding reduction to absorb font growth without changing card dimensions"

key-files:
  created: []
  modified:
    - apps/sales-board/app/page.tsx

key-decisions:
  - "Base number fontSize 30->36 with proportional conditional scaling (28/36 vs previous 22/26 and 20/26)"
  - "Padding reduced from 20px uniform to 12px vertical / 16px horizontal to absorb font growth"
  - "Stats-to-tab gap tightened via spacing[2] instead of spacing[3] on both sides"
  - "Team total row vertical padding further reduced from spacing[3] (12px) to spacing[2] (8px) per user feedback during verification"

patterns-established:
  - "Conditional fontSize uses proportional scaling when increasing base sizes"

requirements-completed: [TYPO-04]

# Metrics
duration: 2min
completed: 2026-03-31
---

# Phase 33 Plan 02: KPI Stat Cards TV Readability Summary

**KPI stat card fonts increased to 36px numbers / 14px labels with padding reduction to preserve card dimensions**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-31T15:10:50Z
- **Completed:** 2026-03-31T15:13:19Z
- **Tasks:** 2 of 2 (checkpoint approved)
- **Files modified:** 1

## Accomplishments
- All 4 KPI stat card number font sizes increased from 30px to 36px base (premium cards use 28/36 conditional)
- All 4 KPI stat card label font sizes increased from 11px to 14px
- Card padding reduced from 20px uniform to 12px/16px to absorb font growth without changing card dimensions
- Stats-to-tab gap tightened on both sides (marginTop and marginBottom reduced)
- Team total row vertical padding further reduced from 12px to 8px per user feedback during visual verification
- Build passes cleanly
- Visual checkpoint approved at 1080p resolution

## Task Commits

Each task was committed atomically:

1. **Task 1: Increase KPI card fonts, reduce padding, tighten stats-to-tab gap** - `5b4ef5b` (feat)
2. **Task 2: Verify complete TV readability at 1080p** - checkpoint approved, team total row padding adjusted in `1ca333b`

## Files Created/Modified
- `apps/sales-board/app/page.tsx` - KPI stat card typography, padding, and spacing changes for TV readability

## Decisions Made
- Used proportional scaling for conditional premium font sizes (28/36 instead of simple matching) per UI-SPEC guidance
- Reduced padding asymmetrically (12px vertical, 16px horizontal) rather than uniform reduction

## Deviations from Plan

### User Feedback Adjustment

**[Rule 1 - Adjustment] Team total row vertical padding reduced further**
- **Found during:** Task 2 (visual verification checkpoint)
- **Issue:** User found team total row still had too much vertical padding at spacing[3] (12px)
- **Fix:** Reduced team total row cells from spacing[3] to spacing[2] (8px) vertical padding
- **Files modified:** apps/sales-board/app/page.tsx
- **Commit:** 1ca333b

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 33 fully complete -- both plans executed and visually verified at 1080p
- Sales board is now TV-readable: WeeklyView table (plan 01) and KPI stat cards (plan 02) both optimized for across-the-room viewing

---
*Phase: 33-core-tv-readability*
*Completed: 2026-03-31*

## Self-Check: PASSED
- apps/sales-board/app/page.tsx: FOUND
- Commit 5b4ef5b: FOUND
- Commit 1ca333b: FOUND
- Checkpoint Task 2: APPROVED
