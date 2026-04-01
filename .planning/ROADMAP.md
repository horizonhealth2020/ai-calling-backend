# Roadmap: Ops Platform v2.1 -- Payroll Card Overhaul & Carryover System

**Milestone:** v2.1
**Phases:** 4 (Phase 38-41)
**Granularity:** Fine
**Requirements:** 14
**Created:** 2026-04-01

## Phases

- [x] **Phase 38: Quick Fixes** -- Fix display bugs and validation issues blocking daily payroll workflow
- [x] **Phase 39: ACA Product Configuration** -- Make ACA PL products editable with configurable commission in Products tab
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
**Plans:** 2/2 plans complete
Plans:
- [x] 38-01-PLAN.md -- Fix zero-value input validation and fronted positive orange display (FIX-01, FIX-02)
- [x] 38-02-PLAN.md -- Fix print view: Net column removal, addon badge layout, half-commission indicators (FIX-03, FIX-04, FIX-05)

### Phase 39: ACA Product Configuration
**Goal**: Staff can view and configure ACA PL products and their flat commissions via the Products tab
**Depends on**: Nothing (independent of other phases, but sequenced before larger refactors to avoid merge conflicts)
**Requirements**: ACA-01
**Success Criteria** (what must be TRUE):
  1. ACA PL products appear in the Products tab list alongside other product types
  2. User can edit the flat commission amount for an ACA PL product and save successfully
**Plans:** 1/1 plans complete
Plans:
- [x] 39-01-PLAN.md -- Add flatCommission to API PATCH schema and extend Products tab UI with ACA PL support (ACA-01)

### Phase 40: Agent-Level Adjustments + Carryover System
**Goal**: Fix approval logic, correct net formula (fronted is positive), move adjustments to agent-level storage, and implement auto-carryover on period lock
**Depends on**: Phase 38 (zero-value fix and display corrections must be in place before restructuring inputs)
**Requirements**: FIX-06, FIX-07, FIX-08, NET-01, CARRY-01, CARRY-02, CARRY-03, CARRY-04, CARRY-05, CARRY-06, CARRY-07, CARRY-08, CARRY-09
**Success Criteria** (what must be TRUE):
  1. Approve/Unapprove buttons appear based on halvingReason, not enrollment fee threshold
  2. Print pills (Approved/Half commission) appear left of commission amount for column alignment
  3. Net formula is Commission + Bonus + Fronted - Hold (fronted is cash advance, added not subtracted)
  4. Bonus/fronted/hold stored at agent+period level (AgentPeriodAdjustment table)
  5. On period lock, fronted carries as hold in next period; negative net carries as hold
  6. Carryover amounts are editable and add to existing values (no overwrite)
  7. Bonus label shows "Hold Payout" when from carryover, editable inline
  8. Agent cards appear even with zero sales when carryover exists
  9. Carryover is idempotent — lock/unlock does not duplicate
**Plans:** 3 plans
Plans:
- [x] 40-01-PLAN.md -- Schema + migration + net formula fix + approval logic + print pills (CARRY-01, NET-01, FIX-06, FIX-07, FIX-08)
- [x] 40-02-PLAN.md -- Carryover service + tests + adjustment CRUD endpoints (CARRY-02, CARRY-03, CARRY-04, CARRY-06, CARRY-07)
- [ ] 40-03-PLAN.md -- Dashboard integration: EditableLabel, CarryoverHint, zero-sales cards (CARRY-05, CARRY-08, CARRY-09)

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
| 38. Quick Fixes | 2/2 | Complete    | 2026-04-01 |
| 39. ACA Product Configuration | 1/1 | Complete    | 2026-04-01 |
| 40. Agent-Level Adjustments + Carryover | 0/3 | Not started | - |
| 41. Payroll Card Restructure | 0/? | Not started | - |

---
*Roadmap created: 2026-04-01*
*Last updated: 2026-04-01*
