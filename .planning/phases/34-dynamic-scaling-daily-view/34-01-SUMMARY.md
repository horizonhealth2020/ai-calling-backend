---
phase: 34-dynamic-scaling-daily-view
plan: 01
subsystem: ui
tags: [react, css, typography, sales-board, tv-readability, daily-view]

# Dependency graph
requires: []
provides:
  - TV-readable DailyView with enlarged fonts and promoted contrast on podium cards and rest-of-agents
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Padding reduction to absorb font growth within unchanged container dimensions"
    - "textTertiary to textSecondary contrast promotion for TV distance readability"

key-files:
  created: []
  modified:
    - apps/sales-board/app/page.tsx

key-decisions:
  - "Podium card nameSize increased to 22/20/18 for ranks 1/2/3 while keeping container dimensions unchanged"
  - "All textTertiary and textMuted colors in DailyView promoted to textSecondary for TV contrast"
  - "Vertical padding reduced (spacing[5] to spacing[3]) to absorb larger fonts without overflow"
  - "Platform base number fonts increased from 11px to 13px"

patterns-established:
  - "Font enlargement paired with padding reduction to maintain layout density"

requirements-completed: [TYPO-02, SCAL-01, SCAL-03]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 34 Plan 01: DailyView TV Readability Summary

**Podium card and rest-of-agents fonts enlarged for 10-15ft TV readability with textSecondary contrast promotion across all DailyView elements**

## Performance

- **Duration:** 3 min
- **Completed:** 2026-03-31
- **Tasks:** 3 of 3 (checkpoint approved)
- **Files modified:** 1

## Accomplishments
- Podium card name fonts increased: 1st place 17->22px, 2nd 15->20px, 3rd 14->18px
- Podium card count fonts increased: 2nd place 28->32px, 3rd 26->30px (1st kept at 36px)
- Podium rank labels increased from 10px to 13px, premium from 12px to 14px
- Podium padding reduced from spacing[5]/spacing[4] to spacing[3]/spacing[3] to absorb growth
- Platform base number fonts increased from 11px to 13px
- Rest-of-agents name fonts increased from 14px to 18px, counts from 28px to 32px, premiums from 12px to 14px
- Rank badges increased from 11px to 13px
- Section labels ("Top Performers", "All Agents") increased from 11px to 13px
- Day/Week toggle increased from 12px to 14px
- All textTertiary and textMuted colors in DailyView promoted to textSecondary (#94a3b8)
- Podium card dimensions (width/height) remain unchanged
- 15 agents fit on DailyView at 1080p without scrolling
- Visual checkpoint approved

## Task Commits

Each task was committed atomically:

1. **Task 1: Enlarge podium card fonts, promote contrast, reduce padding** - `83f7fd5` (feat)
2. **Task 2: Enlarge rest-of-agents fonts, labels, toggle, promote contrast** - `90b105a` (feat)
3. **Task 3: Visual verification on TV or browser** - checkpoint approved

## Files Created/Modified
- `apps/sales-board/app/page.tsx` - All DailyView font size increases, contrast promotions, and padding reductions

## Decisions Made
- Kept 1st place countSize at 36px (already large enough for TV)
- Promoted all textTertiary and textMuted to textSecondary for consistent TV-distance contrast
- Reduced internal padding rather than changing container dimensions to preserve layout

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 34 fully complete -- DailyView TV readability delivered and visually verified
- Combined with Phase 33 (WeeklyView + KPI cards), the entire sales board is now optimized for wall-mounted TV viewing at 10-15 feet

---
*Phase: 34-dynamic-scaling-daily-view*
*Completed: 2026-03-31*

## Self-Check: PASSED
- apps/sales-board/app/page.tsx: FOUND
- Commit 83f7fd5: FOUND
- Commit 90b105a: FOUND
- Checkpoint Task 3: APPROVED
