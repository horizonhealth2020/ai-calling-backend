# Roadmap: v2.0 Sales Board TV Readability

**Milestone:** v2.0
**Phases:** 3 (Phase 33-35, continuing from v1.9)
**Granularity:** Fine
**Coverage:** 11/11 requirements mapped

## Phases

- [x] **Phase 33: Core TV Readability** - Increase font sizes, promote contrast, and prevent overflow on WeeklyView and KPI cards
- [ ] **Phase 34: Dynamic Scaling & Daily View** - Add agent-count-based font scaling and enlarge DailyView/podium for TV readability

## Phase Details

### Phase 33: Core TV Readability
**Goal**: The weekly breakdown table and KPI stat cards are readable from across a sales office on a wall-mounted 1080p TV
**Depends on**: Nothing (first phase of v2.0)
**Requirements**: TYPO-01, TYPO-03, TYPO-04, TYPO-05, OVFL-01, OVFL-02, SCAL-02, SCAL-04
**Success Criteria** (what must be TRUE):
  1. A person standing 10-15 feet from a 1080p TV can read agent names, daily sale counts, premium amounts, and totals on the weekly breakdown view without squinting
  2. The team total row at the bottom is the most prominent row on the screen -- visually larger than individual agent rows
  3. KPI stat card numbers at the top of the board are legible from across the room
  4. An agent named "Christopher Rodriguez" does not cause horizontal scrolling -- the name truncates with ellipsis
  5. A premium value of $12,345 displays fully within its cell without overflow
**Plans:** 2/2 plans complete

Plans:
- [x] 33-01-PLAN.md -- WeeklyView table font sizes, padding, contrast, and overflow
- [x] 33-02-PLAN.md -- KPI stat card font sizes, padding, and stats-to-tab gap

### Phase 34: Dynamic Scaling & Daily View
**Goal**: The daily/podium leaderboard view is TV-readable with enlarged fonts and promoted contrast, using browser zoom for agent-count scaling
**Depends on**: Phase 33 (base font sizes must be established before scaling logic)
**Requirements**: TYPO-02, SCAL-01, SCAL-03
**Success Criteria** (what must be TRUE):
  1. With 9 agents on screen, fonts are noticeably larger than with 15 agents -- the board uses available space
  2. With exactly 15 agents, the daily/podium leaderboard view fits on a 1080p screen without scrolling
  3. Agent names, podium numbers, and premium amounts on the daily view are readable from 10-15 feet on a 1080p TV
**Plans:** 1 plan

Plans:
- [ ] 34-01-PLAN.md -- DailyView podium and rest-of-agents font enlargement, contrast promotion, padding reduction

### Phase 35: Fix KPI polling issues and manager dashboard features
**Goal:** Fix Convoso KPI poller timezone bug, add "Today" date range preset, scope date ranges per dashboard, remove redundant Today column from Manager Tracker, and fix CS round robin assignment fairness
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-08, D-09, D-10, D-11
**Depends on:** Phase 34
**Plans:** 3/3 plans complete

Plans:
- [ ] 35-01-PLAN.md -- KPI poller timezone fix and "Today" KPI preset addition
- [x] 35-02-PLAN.md -- Per-dashboard date range scoping, Today column removal, Owner KPIs default
- [ ] 35-03-PLAN.md -- CS round robin fairness fix

### Phase 36: Fix Manager Sales Entry Parsing Error and Payroll UI Issues
**Goal:** Fix receipt parser product matching that breaks on dollar signs/commas, and stabilize payroll agent pay card row ordering
**Requirements**: D-01, D-02, D-03, D-04, D-05, D-06, D-07
**Depends on:** Phase 35
**Plans:** 1/3 plans complete

Plans:
- [x] 36-01-PLAN.md -- Fix matchProduct() regex and payroll entry sort order
- [ ] 36-02-PLAN.md
- [ ] 36-03-PLAN.md

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 33. Core TV Readability | 2/2 | Complete    | 2026-03-31 |
| 34. Dynamic Scaling & Daily View | 0/1 | In progress | - |
| 35. Fix KPI Polling & Manager Dashboard | 1/3 | Complete    | 2026-03-31 |
| 36. Fix Manager Sales Entry & Payroll UI | 1/3 | In progress | - |

---
*Roadmap created: 2026-03-31*
*Last updated: 2026-03-31 -- Phase 36 Plan 01 complete*
