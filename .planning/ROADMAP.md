# Roadmap: v2.0 Sales Board TV Readability

**Milestone:** v2.0
**Phases:** 2 (Phase 33-34, continuing from v1.9)
**Granularity:** Fine
**Coverage:** 11/11 requirements mapped

## Phases

- [ ] **Phase 33: Core TV Readability** - Increase font sizes, promote contrast, and prevent overflow on WeeklyView and KPI cards
- [ ] **Phase 34: Dynamic Scaling & Daily View** - Add agent-count-based font scaling and enlarge DailyView/podium for TV readability

## Phase Details

### Phase 33: Core TV Readability
**Goal**: The weekly breakdown table and KPI stat cards are readable from across a sales office on a wall-mounted 1080p TV
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: TYPO-01, TYPO-03, TYPO-04, TYPO-05, OVFL-01, OVFL-02, SCAL-04
**Success Criteria** (what must be TRUE):
  1. A person standing 10-15 feet from a 1080p TV can read agent names, daily sale counts, premium amounts, and totals on the weekly breakdown view without squinting
  2. The team total row at the bottom is the most prominent row on the screen -- visually larger than individual agent rows
  3. KPI stat card numbers at the top of the board are legible from across the room
  4. An agent named "Christopher Rodriguez" does not cause horizontal scrolling -- the name truncates with ellipsis
  5. A premium value of $12,345 displays fully within its cell without overflow
**Plans:** 2 plans

Plans:
- [x] 33-01-PLAN.md -- WeeklyView table font sizes, padding, contrast, and overflow
- [ ] 33-02-PLAN.md -- KPI stat card font sizes, padding, and stats-to-tab gap

### Phase 34: Dynamic Scaling & Daily View
**Goal**: The sales board automatically adjusts font sizes based on agent count and the daily/podium leaderboard view is TV-readable
**Depends on**: Phase 33 (base font sizes must be established before scaling logic)
**Requirements**: TYPO-02, SCAL-01, SCAL-02, SCAL-03
**Success Criteria** (what must be TRUE):
  1. With 9 agents on screen, fonts are noticeably larger than with 15 agents -- the board uses available space
  2. With exactly 15 agents, the weekly breakdown view fits on a 1080p screen without scrolling and the team total row is visible
  3. With exactly 15 agents, the daily/podium leaderboard view fits on a 1080p screen without scrolling
  4. Agent names, podium numbers, and premium amounts on the daily view are readable from 10-15 feet on a 1080p TV
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 33. Core TV Readability | 1/2 | Executing | - |
| 34. Dynamic Scaling & Daily View | 0/0 | Not started | - |

---
*Roadmap created: 2026-03-31*
*Last updated: 2026-03-31 -- Plan 33-01 complete*
