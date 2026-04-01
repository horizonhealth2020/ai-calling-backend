# Roadmap: Ops Platform v2.1 -- Payroll Card Overhaul & Carryover System

**Milestone:** v2.1
**Phases:** 4 (Phase 38-41)
**Granularity:** Fine
**Requirements:** 14
**Created:** 2026-04-01

## Phases

- [ ] **Phase 38: Quick Fixes** -- Fix display bugs and validation issues blocking daily payroll workflow
- [ ] **Phase 39: ACA Product Configuration** -- Make ACA PL products editable with configurable commission in Products tab
- [ ] **Phase 40: Agent-Level Adjustments + Carryover System** -- Move bonus/fronted/hold to agent level, add auto-carryover on period lock
- [ ] **Phase 41: Payroll Card Restructure** -- Agent-level collapsible cards with week-by-week entries and aligned print template

## Phase Details

### Phase 38: Quick Fixes
**Goal**: Payroll staff can process pay cards without display bugs or blocked inputs
**Depends on**: Nothing (all fixes are independent, no migration needed)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05
**Success Criteria** (what must be TRUE):
  1. User can set bonus, fronted, or hold to zero and save without validation error
  2. Fronted amount shows as a positive dollar value on pay cards (e.g., "$200.00" not "-$200.00")
  3. Print card sale rows show commission per row with no Net column
  4. Addon names on pay cards display as shortened labels that fit within their cells without overflow
  5. Half-commission deals show "Approved" pill when approved or the specific halving reason (e.g., "Waived Fee", "Missing Add-on") in print view
**Plans:** 2 plans
Plans:
- [ ] 38-01-PLAN.md -- Fix zero-value input validation and fronted positive orange display (FIX-01, FIX-02)
- [ ] 38-02-PLAN.md -- Fix print view: Net column removal, addon badge layout, half-commission indicators (FIX-03, FIX-04, FIX-05)

### Phase 39: ACA Product Configuration
**Goal**: Staff can view and configure ACA PL products and their flat commissions via the Products tab
**Depends on**: Nothing (independent of other phases, but sequenced before larger refactors to avoid merge conflicts)
**Requirements**: ACA-01
**Success Criteria** (what must be TRUE):
  1. ACA PL products appear in the Products tab list alongside other product types
  2. User can edit the flat commission amount for an ACA PL product and save successfully
**Plans**: TBD

### Phase 40: Agent-Level Adjustments + Carryover System
**Goal**: Bonus/fronted/hold live at agent level only, and fronted/hold amounts auto-carry to the next period on lock
**Depends on**: Phase 38 (zero-value fix and display corrections must be in place before restructuring inputs)
**Requirements**: CARRY-01, CARRY-02, CARRY-03, CARRY-04, CARRY-05, CARRY-06
**Success Criteria** (what must be TRUE):
  1. Bonus, fronted, and hold inputs appear only on the agent card header -- not on individual sale rows
  2. Locking a period auto-populates the next period: current fronted becomes next hold, current hold becomes next bonus
  3. Auto-populated carryover amounts are editable by payroll staff after population
  4. Bonus label shows "Hold Payout" when sourced from carryover and "Bonus" otherwise, and the label is manually editable
  5. Locking and unlocking a period multiple times does not create duplicate carryover entries
**Plans**: TBD

### Phase 41: Payroll Card Restructure
**Goal**: Payroll view uses agent-level collapsible cards with week-by-week sale grouping, and print template matches screen layout
**Depends on**: Phase 40 (agent-level adjustments and carryover data shape must be stable before rebuilding cards around them)
**Requirements**: CARD-01, CARD-02
**Success Criteria** (what must be TRUE):
  1. Each agent has a single collapsible card in the payroll view (one card per agent, not one per period)
  2. Inside each agent card, sales are grouped by week with visible week separators
  3. Print output matches the new screen layout -- agent cards with week-by-week entries, not the old flat list
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 38. Quick Fixes | 0/2 | Planned | - |
| 39. ACA Product Configuration | 0/? | Not started | - |
| 40. Agent-Level Adjustments + Carryover | 0/? | Not started | - |
| 41. Payroll Card Restructure | 0/? | Not started | - |

---
*Roadmap created: 2026-04-01*
*Last updated: 2026-04-01*
