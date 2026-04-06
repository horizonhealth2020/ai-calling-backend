# Roadmap: Ops Platform

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-10 (shipped 2026-03-17)
- ✅ **v1.1 Customer Service** -- Phases 11-17 (shipped 2026-03-18)
- ✅ **v1.2 Platform Polish** -- Phase 18 (shipped 2026-03-19)
- ✅ **v1.3 Dashboard Consolidation** -- Phase 19 (shipped 2026-03-23)
- ✅ **v1.4 State-Aware Bundle** -- Phase 20 (shipped 2026-03-23)
- ✅ **v1.5 Platform Cleanup** -- Phases 21-24 (shipped 2026-03-24)
- ✅ **v1.6 Pre-Launch Stabilization** -- Phases 25-28 (shipped 2026-03-25)
- ✅ **v1.7 Dashboard Fixes & Cost Tracking** -- Phase 29 (shipped 2026-03-26)
- ✅ **v1.8 Lead Source Timing Analytics** -- Phase 30 (shipped 2026-03-30)
- ✅ **v1.9 Auth Stability & Phone Number Display** -- Phases 31-32 (shipped 2026-03-30)
- ✅ **v2.0 Sales Board TV Readability & Manager Dashboard** -- Phases 33-37 (shipped 2026-03-31)
- ✅ **v2.1 Payroll Card Overhaul & Carryover System** -- Phases 38-41 (shipped 2026-04-01)
- [ ] **v2.2 Chargeback Batch Review & Payroll Agent Tabs** -- Phases 42-44

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-10) -- SHIPPED 2026-03-17</summary>

See: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>✅ v1.1 Customer Service (Phases 11-17) -- SHIPPED 2026-03-18</summary>

See: `.planning/milestones/v1.1-ROADMAP.md`

</details>

<details>
<summary>✅ v1.2 Platform Polish (Phase 18) -- SHIPPED 2026-03-19</summary>

See: `.planning/milestones/v1.2-ROADMAP.md`

</details>

<details>
<summary>✅ v1.3 Dashboard Consolidation (Phase 19) -- SHIPPED 2026-03-23</summary>

See: `.planning/milestones/v1.3-ROADMAP.md`

</details>

<details>
<summary>✅ v1.5 Platform Cleanup (Phases 21-24) -- SHIPPED 2026-03-24</summary>

See: `.planning/milestones/v1.5-ROADMAP.md`

</details>

<details>
<summary>✅ v1.6 Pre-Launch Stabilization (Phases 25-28) -- SHIPPED 2026-03-25</summary>

See: `.planning/milestones/v1.6-ROADMAP.md`

</details>

<details>
<summary>✅ v1.7 Dashboard Fixes & Cost Tracking (Phase 29) -- SHIPPED 2026-03-26</summary>

See: `.planning/milestones/v1.7-ROADMAP.md`

</details>

<details>
<summary>✅ v1.8 Lead Source Timing Analytics (Phase 30) -- SHIPPED 2026-03-30</summary>

See: `.planning/milestones/v1.8-ROADMAP.md`

</details>

<details>
<summary>✅ v1.9 Auth Stability & Phone Number Display (Phases 31-32) -- SHIPPED 2026-03-30</summary>

See: `.planning/milestones/v1.9-ROADMAP.md`

</details>

<details>
<summary>✅ v2.0 Sales Board TV Readability & Manager Dashboard (Phases 33-37) -- SHIPPED 2026-03-31</summary>

See: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>✅ v2.1 Payroll Card Overhaul & Carryover System (Phases 38-41) -- SHIPPED 2026-04-01</summary>

See: `.planning/milestones/v2.1-ROADMAP.md`

</details>

### v2.2 Chargeback Batch Review & Payroll Agent Tabs (Phases 42-44)

See: `.planning/milestones/v2.2-ROADMAP.md`

- [x] **Phase 42: ACA Product Fix** -- Fix ACA product visibility in Products tab, editable flat commission, bundle requirement satisfaction (completed 2026-04-06)
- [x] **Phase 43: Payroll Agent Tab Navigation** -- Left sidebar with agent list replacing scrollable cards, paginated pay periods per agent (completed 2026-04-06)
- [ ] **Phase 44: Chargeback Batch Review** -- Multi-entry paste parsing with pre-submit review table, match preview, and bulk submission

### Phase 43: Payroll Agent Tab Navigation
**Goal**: Payroll staff can navigate between agents via a sidebar and view paginated pay periods per agent instead of scrolling through all cards
**Depends on**: Nothing (pure UI refactor, zero API changes, all data already available in existing agentData Map)
**Requirements**: PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06
**Success Criteria** (what must be TRUE):
  1. Payroll Periods tab shows a left sidebar listing all agents sorted by current earnings
  2. Clicking an agent name in the sidebar loads that agent's pay periods in the main content area
  3. Only the last 4 pay periods display by default for the selected agent (most recent first)
  4. A "Load More" button at the bottom loads older pay periods for the selected agent
  5. Each agent name in the sidebar shows a paid/unpaid/partial status badge
  6. Sidebar includes a search input that filters agents by name
**Plans**: 2 plans
Plans:
- [x] 43-01-PLAN.md — Create AgentSidebar component with search, badges, CS section
- [x] 43-02-PLAN.md — Refactor PayrollPeriods layout with sidebar+content split and agent selection

### Phase 44: Chargeback Batch Review
**Goal**: CS staff can paste multiple chargebacks, review all parsed entries with match status and product details, edit or remove entries, and submit the entire batch in one action
**Depends on**: Phase 43 (independent feature, but sequenced after to isolate correctness-critical chargeback changes)
**Requirements**: CB-01, CB-02, CB-03, CB-04, CB-05, CB-06, CB-07, CB-08, CB-09
**Success Criteria** (what must be TRUE):
  1. User pastes multiple chargeback entries and all are parsed into individual rows in a review table
  2. Each review row displays matched agent name, member name, member ID, and match status badge
  3. Matched entries show sale products with checkboxes allowing partial chargeback selection
  4. User can edit amount, rep assignment, and product selection per row, and can remove individual rows
  5. A validation summary bar above the review table shows counts by match status
  6. Submitting the batch creates all chargebacks and associated clawbacks in a single action
**Plans**: 2 plans
Plans:
- [ ] 44-01-PLAN.md — Preview API endpoint and Toast action button support
- [ ] 44-02-PLAN.md — Review table UI with summary bar, product checkboxes, editing, and batch submit

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1-10 | v1.0 | 31/31 | Complete | 2026-03-17 |
| 11-17 | v1.1 | 15/15 | Complete | 2026-03-18 |
| 18 | v1.2 | 8/8 | Complete | 2026-03-19 |
| 19 | v1.3 | 10/10 | Complete | 2026-03-23 |
| 20 | v1.4 | 3/3 | Complete | 2026-03-23 |
| 21-24 | v1.5 | 8/8 | Complete | 2026-03-24 |
| 25-28 | v1.6 | 10/10 | Complete | 2026-03-25 |
| 29 | v1.7 | 4/4 | Complete | 2026-03-26 |
| 30 | v1.8 | 5/5 | Complete | 2026-03-30 |
| 31-32 | v1.9 | 3/3 | Complete | 2026-03-30 |
| 33-37 | v2.0 | 13/13 | Complete | 2026-03-31 |
| 38-41 | v2.1 | 7/7 | Complete | 2026-04-01 |
| 42 | v2.2 | 1/1 | Complete    | 2026-04-06 |
| 43 | v2.2 | 2/2 | Complete    | 2026-04-06 |
| 44 | v2.2 | 0/2 | Not started | - |

---
*Roadmap created: 2026-03-14*
*Last updated: 2026-04-06 -- Phase 44 planned (2 plans)*
