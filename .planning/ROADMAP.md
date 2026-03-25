# Roadmap: Ops Platform — Payroll & Usability Overhaul

## Milestones

- ✅ **v1.0 MVP** — Phases 1-10 (shipped 2026-03-17)
- ✅ **v1.1 Customer Service** — Phases 11-17 (shipped 2026-03-18)
- ✅ **v1.2 Platform Polish & Integration** — Phase 18 (shipped 2026-03-19)
- ✅ **v1.3 Dashboard Consolidation & Uniform Date Ranges** — Phase 19 (shipped 2026-03-23)
- ✅ **v1.4 State-Aware Bundle Requirements** — Phase 20 (shipped 2026-03-23)
- ✅ **v1.5 Platform Cleanup & Remaining Features** — Phases 21-24 (shipped 2026-03-24)
- ✅ **v1.6 Pre-Launch Stabilization** — Phases 25-28 (shipped 2026-03-25)
- [ ] **v1.7 Dashboard Fixes & Cost Tracking** — Phase 29

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

### v1.7 Dashboard Fixes & Cost Tracking

- [ ] **Phase 29: Dashboard Fixes & Cost Tracking** - Bug fixes, Convoso data flow repair, cost tracking display, CS resolved log

## Phase Details

### Phase 29: Dashboard Fixes & Cost Tracking
**Goal**: Fix premium display, lead source form, Convoso data flow, cost tracking visibility, manager config cleanup, and add CS resolved log audit trail
**Depends on**: Nothing
**Requirements**: FIX-01, FIX-02, FIX-03, CFG-01, CFG-02, DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, CS-01, CS-02, CS-03, CS-04
**Success Criteria** (what must be TRUE):
  1. Manager Agent Sales tab shows total premium (core + addon) per sale row, matching sales board and payroll totals
  2. Lead source create form includes a Buffer (seconds) field that persists to the database on save
  3. Lead source POST API accepts and validates callBufferSeconds via Zod schema
  4. Manager Config Products section displays product name, type, commission rates, and bundle config as read-only (no add/edit/delete controls)
  5. After a poll cycle completes, new call records appear in the ConvosoCallLog table with agent, timestamp, duration, and cost fields
  6. Running the poller multiple times does not create duplicate ConvosoCallLog records for the same call
  7. Manager Tracker tab shows cost per sale for each agent when Convoso polling is enabled
  8. Owner Dashboard agent leaderboard shows cost per sale for each agent
  9. Agents with calls but zero sales still appear in the tracker with their total lead spend displayed
  10. When no Convoso data exists, the display shows an appropriate empty state (not broken/blank)
  11. CS dashboard shows a Resolved Log tab visible only to OWNER_VIEW and SUPER_ADMIN roles (not CUSTOMER_SERVICE)
  12. Resolved Log lists all resolved chargebacks showing resolution date, who resolved it, and any notes
  13. Resolved Log lists all resolved pending terms showing resolution date, who resolved it, and any notes
  14. User can filter the resolved log by type (chargeback vs pending term), date range, and agent
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
| 21. Route File Splitting | v1.5 | 1/1 | Complete | 2026-03-24 |
| 22. Owner & Payroll Enhancements | v1.5 | 2/2 | Complete | 2026-03-24 |
| 23. AI Scoring Dashboard | v1.5 | 1/1 | Complete | 2026-03-24 |
| 24. Chargeback Automation & Data Archival | v1.5 | 4/4 | Complete | 2026-03-24 |
| 25. File Structure Cleanup | v1.6 | 2/2 | Complete | 2026-03-25 |
| 26. Dead Code Removal | v1.6 | 2/2 | Complete | 2026-03-25 |
| 27. Error Handling & Robustness | v1.6 | 2/2 | Complete | 2026-03-25 |
| 28. Type Safety Audit | v1.6 | 4/4 | Complete | 2026-03-25 |
| 29. Dashboard Fixes & Cost Tracking | v1.7 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-14*
*v1.0 shipped: 2026-03-17*
*v1.1 shipped: 2026-03-18*
*v1.2 shipped: 2026-03-19*
*v1.3 shipped: 2026-03-23*
*v1.4 shipped: 2026-03-23*
*v1.5 shipped: 2026-03-24*
*v1.6 shipped: 2026-03-25*
*v1.7 roadmap created: 2026-03-25*
