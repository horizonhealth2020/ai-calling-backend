# Roadmap: Ops Platform — Payroll & Usability Overhaul

## Milestones

- ✅ **v1.0 MVP** — Phases 1-10 (shipped 2026-03-17)
- ✅ **v1.1 Customer Service** — Phases 11-17 (shipped 2026-03-18)
- ✅ **v1.2 Platform Polish & Integration** — Phase 18 (shipped 2026-03-19)
- ✅ **v1.3 Dashboard Consolidation & Uniform Date Ranges** — Phase 19 (shipped 2026-03-23)
- ✅ **v1.4 State-Aware Bundle Requirements** — Phase 20 (shipped 2026-03-23)
- [ ] **v1.5 Platform Cleanup & Remaining Features** — Phases 21-26

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-10) — SHIPPED 2026-03-17</summary>

- [x] Phase 1: Sales Entry Fix (3/3 plans) — completed 2026-03-14
- [x] Phase 2: Commission Engine Core (4/4 plans) — completed 2026-03-15
- [x] Phase 3: Commission Fees & Period Assignment (2/2 plans) — completed 2026-03-15
- [x] Phase 4: Multi-Product Sales Form (2/2 plans) — completed 2026-03-15
- [x] Phase 5: Commission Preview & Sale Editing (3/3 plans) — completed 2026-03-15
- [x] Phase 6: Dashboard Cascade (3/3 plans) — completed 2026-03-16
- [x] Phase 7: Payroll Management (2/2 plans) — completed 2026-03-16
- [x] Phase 8: Reporting (2/2 plans) — completed 2026-03-16
- [x] Phase 9: UI/UX Polish (4/4 plans) — completed 2026-03-17
- [x] Phase 10: Sale Status Payroll Logic (6/6 plans) — completed 2026-03-16

</details>

<details>
<summary>✅ v1.1 Customer Service (Phases 11-17) — SHIPPED 2026-03-18</summary>

- [x] Phase 11: Foundation & Dashboard Shell (2/2 plans) — completed 2026-03-17
- [x] Phase 12: Chargeback Parser (3/3 plans) — completed 2026-03-17
- [x] Phase 13: Pending Terms Parser (2/2 plans) — completed 2026-03-17
- [x] Phase 14: Tracking Tables (2/2 plans) — completed 2026-03-18
- [x] Phase 15: Resolution & Polish (4/4 plans) — completed 2026-03-18
- [x] Phase 16: Auth & Permission Tightening (1/1 plan) — completed 2026-03-18
- [x] Phase 17: Documentation & Permission Cleanup (1/1 plan) — completed 2026-03-18

</details>

<details>
<summary>✅ v1.2 Platform Polish & Integration (Phase 18) — SHIPPED 2026-03-19</summary>

- [x] Phase 18: Platform Polish & Integration (8/8 plans) — completed 2026-03-19

</details>

<details>
<summary>✅ v1.3 Dashboard Consolidation & Uniform Date Ranges (Phase 19) — SHIPPED 2026-03-23</summary>

- [x] Phase 19: Dashboard Consolidation & Uniform Date Ranges (10/10 plans) — completed 2026-03-23

</details>

<details>
<summary>✅ v1.4 State-Aware Bundle Requirements (Phase 20) — SHIPPED 2026-03-23</summary>

- [x] Phase 20: State-Aware Bundle Requirements (5/5 plans) — completed 2026-03-23

</details>

### v1.5 Platform Cleanup & Remaining Features (Phases 21-26)

- [ ] **Phase 21: Route File Splitting** - Split 2750-line monolith route file into domain modules with zero behavior change
- [ ] **Phase 22: CS Payroll on Owner Dashboard** - Surface service payroll totals in owner period summary with real-time updates
- [ ] **Phase 23: Payroll CSV Print Card Export** - Agent-grouped CSV export matching print card layout with header/subtotal rows
- [ ] **Phase 24: AI Scoring Dashboard** - Owner dashboard scoring tab with aggregate KPIs, per-agent breakdown, and weekly trends
- [ ] **Phase 25: Chargeback-to-Clawback Automation** - Fix approveAlert bug, auto-match chargebacks to sales, auto-create clawbacks
- [ ] **Phase 26: Data Archival with Restore** - Archive high-volume log tables by date range with admin restore capability

## Phase Details

### Phase 21: Route File Splitting
**Goal**: Every API route lives in a focused domain module so subsequent features target clean, small files
**Depends on**: Nothing (first phase of v1.5)
**Requirements**: SPLIT-01, SPLIT-02
**Success Criteria** (what must be TRUE):
  1. The route file is split into domain-specific modules (e.g., sales.ts, payroll.ts, reporting.ts) averaging 100-300 lines each
  2. Shared helpers (zodErr, asyncHandler, date range parsing) are extracted to a common helpers file
  3. Every existing API endpoint returns identical responses before and after the split (zero behavior change)
  4. All existing tests pass without modification
**Plans**: TBD

### Phase 22: CS Payroll on Owner Dashboard
**Goal**: Owners see complete financial picture including service staff payroll alongside commission totals
**Depends on**: Phase 21 (routes are split, owner endpoints in clean file)
**Requirements**: OWNER-01, OWNER-02
**Success Criteria** (what must be TRUE):
  1. Owner period summary endpoint returns a CS payroll total (sum of ServicePayrollEntry amounts) alongside the existing commission total
  2. Owner dashboard displays the CS payroll total as a KPI card in the period summary section
  3. When a service payroll entry is created or updated, the owner dashboard CS payroll total updates in real-time via Socket.IO without page refresh
**Plans**: TBD

### Phase 23: Payroll CSV Print Card Export
**Goal**: Payroll staff can export a CSV that mirrors the on-screen print card layout for agent pay verification
**Depends on**: Phase 21 (routes are split, export logic in clean file)
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03
**Success Criteria** (what must be TRUE):
  1. A new export option produces a CSV with rows grouped by agent, matching the print card visual layout
  2. Each agent section has a header row (agent name, totals), individual sale rows, and a subtotal row
  3. Export completes without browser hang or memory error for periods with 100+ agents and 1000+ sales
**Plans**: TBD

### Phase 24: AI Scoring Dashboard
**Goal**: Owners can monitor call audit quality trends and identify agents needing coaching from a dedicated scoring tab
**Depends on**: Phase 21 (routes are split, scoring endpoints in clean file)
**Requirements**: SCORE-01, SCORE-02, SCORE-03, SCORE-04
**Success Criteria** (what must be TRUE):
  1. Owner dashboard has a "Scoring" tab showing aggregate KPIs: average score, total audits scored, and score distribution breakdown
  2. Per-agent score breakdown table is visible with sortable columns (agent name, avg score, audit count, trend direction)
  3. Weekly trend data shows how scores change over time (at minimum a table with week-over-week values)
  4. DateRangeFilter on the scoring tab filters all KPIs and tables to the selected range
**Plans**: TBD

### Phase 25: Chargeback-to-Clawback Automation
**Goal**: Approved chargebacks automatically create clawback records against the correct sale, eliminating manual clawback entry
**Depends on**: Phase 21 (routes are split, alert/clawback logic in clean files)
**Requirements**: CLAWBACK-01, CLAWBACK-02, CLAWBACK-03, CLAWBACK-04, CLAWBACK-05
**Success Criteria** (what must be TRUE):
  1. approveAlert() creates clawback records referencing the correct sale (not using memberId as saleId)
  2. When a chargeback is submitted, the system auto-matches it to a sale by memberId or memberName and stores the match
  3. When a matched chargeback is approved, a clawback record is auto-created against the matched sale with correct amounts
  4. Chargebacks that cannot be auto-matched are visually flagged for manual review in the tracking table
  5. When a clawback is auto-created, a Socket.IO event notifies the payroll dashboard in real-time
**Plans**: TBD

### Phase 26: Data Archival with Restore
**Goal**: Admins can reduce database size by archiving old high-volume logs while retaining the ability to restore them
**Depends on**: Phase 25 (all features stable before data operations)
**Requirements**: ARCHIVE-01, ARCHIVE-02, ARCHIVE-03, ARCHIVE-04
**Success Criteria** (what must be TRUE):
  1. Admin can select a date range and archive call logs, audit logs, and KPI snapshots -- rows move from main tables to parallel archive tables
  2. Archived rows are physically removed from main tables (not soft-deleted), reducing query scan size
  3. Admin can select archived batches and restore them back to main tables with original data intact
  4. Owner dashboard has a data management section showing archive statistics (row counts, date ranges, last archive date)
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Sales Entry Fix | v1.0 | 3/3 | Complete | 2026-03-14 |
| 2. Commission Engine Core | v1.0 | 4/4 | Complete | 2026-03-15 |
| 3. Commission Fees & Period Assignment | v1.0 | 2/2 | Complete | 2026-03-15 |
| 4. Multi-Product Sales Form | v1.0 | 2/2 | Complete | 2026-03-15 |
| 5. Commission Preview & Sale Editing | v1.0 | 3/3 | Complete | 2026-03-15 |
| 6. Dashboard Cascade | v1.0 | 3/3 | Complete | 2026-03-16 |
| 7. Payroll Management | v1.0 | 2/2 | Complete | 2026-03-16 |
| 8. Reporting | v1.0 | 2/2 | Complete | 2026-03-16 |
| 9. UI/UX Polish | v1.0 | 4/4 | Complete | 2026-03-17 |
| 10. Sale Status Payroll Logic | v1.0 | 6/6 | Complete | 2026-03-16 |
| 11. Foundation & Dashboard Shell | v1.1 | 2/2 | Complete | 2026-03-17 |
| 12. Chargeback Parser | v1.1 | 3/3 | Complete | 2026-03-17 |
| 13. Pending Terms Parser | v1.1 | 2/2 | Complete | 2026-03-17 |
| 14. Tracking Tables | v1.1 | 2/2 | Complete | 2026-03-18 |
| 15. Resolution & Polish | v1.1 | 4/4 | Complete | 2026-03-18 |
| 16. Auth & Permission Tightening | v1.1 | 1/1 | Complete | 2026-03-18 |
| 17. Documentation & Permission Cleanup | v1.1 | 1/1 | Complete | 2026-03-18 |
| 18. Platform Polish & Integration | v1.2 | 8/8 | Complete | 2026-03-19 |
| 19. Dashboard Consolidation & Uniform Date Ranges | v1.3 | 10/10 | Complete | 2026-03-23 |
| 20. State-Aware Bundle Requirements | v1.4 | 5/5 | Complete | 2026-03-23 |
| 21. Route File Splitting | v1.5 | 0/? | Not started | - |
| 22. CS Payroll on Owner Dashboard | v1.5 | 0/? | Not started | - |
| 23. Payroll CSV Print Card Export | v1.5 | 0/? | Not started | - |
| 24. AI Scoring Dashboard | v1.5 | 0/? | Not started | - |
| 25. Chargeback-to-Clawback Automation | v1.5 | 0/? | Not started | - |
| 26. Data Archival with Restore | v1.5 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-14*
*v1.1 shipped: 2026-03-18*
*v1.2 shipped: 2026-03-19*
*v1.3 shipped: 2026-03-23*
*v1.4 shipped: 2026-03-23*
*v1.5 roadmap added: 2026-03-24*
