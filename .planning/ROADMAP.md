# Roadmap: v2.1 Chargeback Processing, Payroll Layout & Dashboard Polish

**Milestone:** v2.1
**Phases:** 4 (Phase 38-41, continuing from v2.0)
**Granularity:** Fine
**Coverage:** 15/15 requirements mapped

## Phases

- [ ] **Phase 38: Dashboard & Payroll Quick Fixes** - Fix enrollment fee default, audit rolling window, analytics expanded state, and sparkline data
- [ ] **Phase 39: CSV Batch Chargeback Processing** - CSV upload with pre-submit review, row editing, and transactional batch submission
- [ ] **Phase 40: ACA Product Editing** - Editable flat commission, addon qualifier rules, and functional ACA sale entry
- [ ] **Phase 41: Payroll Agent Sidebar Redesign** - Agent-first sidebar navigation with per-agent historical pay cards and load more pagination

## Phase Details

### Phase 38: Dashboard & Payroll Quick Fixes
**Goal**: Audit, tracker, and payroll sections behave correctly and predictably without user workarounds
**Depends on**: Nothing (first phase of v2.1)
**Requirements**: PAY-04, DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. A sale submitted without an enrollment fee shows $0 fee, displays the half-commission badge correctly, and the approve button appears
  2. The call audit tab loads the last 30 audits regardless of when they occurred -- a quiet weekend still shows recent audits
  3. Per-agent audit filter returns the last 30 audits for that agent, not just the last 24 hours
  4. Lead source and timing analytics sections are visible immediately on page load without clicking to expand
  5. 7-day trend sparklines render polyline data matching the actual daily close rates for the past week
**Plans:** 2 plans
Plans:
- [ ] 38-01-PLAN.md -- API fixes: audit rolling window, sparkline date keys, frontend limit update
- [ ] 38-02-PLAN.md -- Frontend fixes: enrollment fee $0 parsing, analytics default-expand with lazy loading

### Phase 39: CSV Batch Chargeback Processing
**Goal**: CS staff can process carrier chargeback reports by uploading a CSV file instead of pasting individual entries
**Depends on**: Phase 38
**Requirements**: CB-01, CB-02, CB-03, CB-04
**Success Criteria** (what must be TRUE):
  1. User can select and upload a CSV file from the CS Submissions tab and see parsed rows appear in a review table
  2. Each row in the review table shows matched agent name, product assignment, and chargeback amount with MATCHED/MULTIPLE/UNMATCHED status badges
  3. User can change product assignment on any row before submitting the batch
  4. Submitting the batch either processes all chargebacks or fails entirely -- no partial submissions leave orphaned records
**Plans**: TBD

### Phase 40: ACA Product Editing
**Goal**: Payroll staff can configure ACA product commission rates and addon rules without developer intervention
**Depends on**: Phase 38
**Requirements**: ACA-01, ACA-02, ACA-03
**Success Criteria** (what must be TRUE):
  1. User can open the ACA product in the payroll Products tab and edit the flat commission per member amount with changes persisting on save
  2. An addon sold alongside an ACA product receives full commission (not halved) because ACA satisfies the bundle addon requirement
  3. The ACA sale entry form accepts member count, calculates total commission as flat rate times members, and submits successfully
**Plans**: TBD

### Phase 41: Payroll Agent Sidebar Redesign
**Goal**: Payroll staff can navigate directly to any agent and review their pay history without scrolling through all periods
**Depends on**: Phase 38
**Requirements**: PAY-01, PAY-02, PAY-03
**Success Criteria** (what must be TRUE):
  1. A left sidebar lists all agents regardless of which pay period is selected -- agents with zero entries for the current period still appear
  2. Clicking an agent in the sidebar shows their last 4 pay cards, and clicking "load more" fetches older weeks
  3. A weekly summary row showing totals for all agents remains visible at the top regardless of which agent is selected in the sidebar
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 38. Dashboard & Payroll Quick Fixes | 0/2 | Planned | - |
| 39. CSV Batch Chargeback Processing | 0/? | Not started | - |
| 40. ACA Product Editing | 0/? | Not started | - |
| 41. Payroll Agent Sidebar Redesign | 0/? | Not started | - |

---
*Roadmap created: 2026-04-06*
*Last updated: 2026-04-06*
