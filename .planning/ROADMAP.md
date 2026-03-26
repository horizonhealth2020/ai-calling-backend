# Roadmap: Ops Platform — Payroll & Usability Overhaul

## Milestones

- ✅ **v1.0 MVP** — Phases 1-10 (shipped 2026-03-17)
- ✅ **v1.1 Customer Service** — Phases 11-17 (shipped 2026-03-18)
- ✅ **v1.2 Platform Polish & Integration** — Phase 18 (shipped 2026-03-19)
- ✅ **v1.3 Dashboard Consolidation & Uniform Date Ranges** — Phase 19 (shipped 2026-03-23)
- ✅ **v1.4 State-Aware Bundle Requirements** — Phase 20 (shipped 2026-03-23)
- ✅ **v1.5 Platform Cleanup & Remaining Features** — Phases 21-24 (shipped 2026-03-24)
- ✅ **v1.6 Pre-Launch Stabilization** — Phases 25-28 (shipped 2026-03-25)
- ✅ **v1.7 Dashboard Fixes & Cost Tracking** — Phase 29 (shipped 2026-03-26)
- [ ] **v1.8 Lead Source Timing Analytics** — Phase 30

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

<details>
<summary>✅ v1.5 Platform Cleanup & Remaining Features (Phases 21-24) — SHIPPED 2026-03-24</summary>

- [x] Phase 21: Route File Splitting (1/1 plan) — completed 2026-03-24
- [x] Phase 22: Owner & Payroll Enhancements (2/2 plans) — completed 2026-03-24
- [x] Phase 23: AI Scoring Dashboard (1/1 plan) — completed 2026-03-24
- [x] Phase 24: Chargeback Automation & Data Archival (4/4 plans) — completed 2026-03-24

</details>

<details>
<summary>✅ v1.6 Pre-Launch Stabilization (Phases 25-28) — SHIPPED 2026-03-25</summary>

- [x] Phase 25: File Structure Cleanup (2/2 plans) — completed 2026-03-25
- [x] Phase 26: Dead Code Removal (2/2 plans) — completed 2026-03-25
- [x] Phase 27: Error Handling & Robustness (2/2 plans) — completed 2026-03-25
- [x] Phase 28: Type Safety Audit (4/4 plans) — completed 2026-03-25

</details>

<details>
<summary>✅ v1.7 Dashboard Fixes & Cost Tracking (Phase 29) — SHIPPED 2026-03-26</summary>

- [x] Phase 29: Dashboard Fixes & Cost Tracking (4/4 plans) — completed 2026-03-25

</details>

### v1.8 Lead Source Timing Analytics

- [ ] **Phase 30: Lead Source Timing Analytics** - Data layer fixes, aggregation API endpoints, heatmap/sparklines/recommendation UI, dashboard integration, and commission fix

## Phase Details

### Phase 30: Lead Source Timing Analytics
**Goal**: Managers and owners can see which lead sources convert best at what times, enabling data-driven call routing decisions
**Depends on**: Phase 29 (Convoso call log data, lead source configuration)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, DATA-08, HEAT-01, HEAT-02, HEAT-03, HEAT-04, HEAT-05, REC-01, REC-02, REC-03, SPARK-01, SPARK-02, DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, COMM-01, COMM-02
**Success Criteria** (what must be TRUE):
  1. Manager can view a source-by-hour heatmap on the Performance Tracker tab showing close rates with diverging color scale, toggle between day-of-week and week-of-month views, filter by independent date range (Last Week / 30 Days / 60 Days / 90 Days / Custom), hover for tooltips with exact rate/count, and see low-sample cells visually de-emphasized
  2. Manager can see a "Best Source Right Now" recommendation card displaying the top lead source for the current hour with close rate, call count, trend arrow, and a "Not enough data" fallback when sample size is insufficient
  3. Manager can view a sparklines table showing 7-day close rate trends per lead source per daypart (morning/afternoon/evening), rendered as inline SVG polylines with no external charting library
  4. Owner dashboard displays the same timing analytics section, accessible to MANAGER, OWNER_VIEW, and SUPER_ADMIN roles, with the Agent Tracker tab renamed to Performance Tracker and a Today column added to agent performance cards
  5. Fallback bundle addon commission correctly applies full commission only in states where the primary required addon is unavailable, and half commission in states where the primary addon IS available
**Plans**: 5 plans
Plans:
- [x] 30-01-PLAN.md -- Data layer fixes: Convoso DST/business-hours bugs, commission fallback guard, DB indexes
- [x] 30-02-PLAN.md -- Dashboard polish: rename tab to Performance Tracker, add Today column
- [x] 30-03-PLAN.md -- Lead timing API: heatmap, sparklines, recommendation endpoints
- [ ] 30-04-PLAN.md -- UI components: heatmap grid, best source card, sparklines table, section wrapper
- [ ] 30-05-PLAN.md -- Dashboard integration: wire analytics section into Manager and Owner dashboards

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
| 21. Route File Splitting | v1.5 | 1/1 | Complete | 2026-03-24 |
| 22. Owner & Payroll Enhancements | v1.5 | 2/2 | Complete | 2026-03-24 |
| 23. AI Scoring Dashboard | v1.5 | 1/1 | Complete | 2026-03-24 |
| 24. Chargeback Automation & Data Archival | v1.5 | 4/4 | Complete | 2026-03-24 |
| 25. File Structure Cleanup | v1.6 | 2/2 | Complete | 2026-03-25 |
| 26. Dead Code Removal | v1.6 | 2/2 | Complete | 2026-03-25 |
| 27. Error Handling & Robustness | v1.6 | 2/2 | Complete | 2026-03-25 |
| 28. Type Safety Audit | v1.6 | 4/4 | Complete | 2026-03-25 |
| 29. Dashboard Fixes & Cost Tracking | v1.7 | 4/4 | Complete | 2026-03-25 |
| 30. Lead Source Timing Analytics | v1.8 | 3/5 | In Progress | - |

---
*Roadmap created: 2026-03-14*
*v1.0 shipped: 2026-03-17*
*v1.1 shipped: 2026-03-18*
*v1.2 shipped: 2026-03-19*
*v1.3 shipped: 2026-03-23*
*v1.4 shipped: 2026-03-23*
*v1.5 shipped: 2026-03-24*
*v1.6 shipped: 2026-03-25*
*v1.7 shipped: 2026-03-26*
*v1.8 roadmap created: 2026-03-26*
