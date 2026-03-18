# Roadmap: Ops Platform — Payroll & Usability Overhaul

## Milestones

- ✅ **v1.0 MVP** — Phases 1-10 (shipped 2026-03-17)
- ✅ **v1.1 Customer Service** — Phases 11-17 (shipped 2026-03-18)
- [ ] **v1.2 Platform Polish & Integration** — Phase 18

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

### v1.2 Platform Polish & Integration

- [ ] **Phase 18: Platform Polish & Integration** - Wire chargebacks into payroll alerts, integrate agent KPIs, add AI auto-scoring, custom date range exports, and fix accumulated UX issues across all dashboards

## Phase Details

### Phase 18: Platform Polish & Integration
**Goal**: Platform systems are integrated end-to-end — chargebacks flow to payroll alerts, pending terms influence agent KPIs, AI scores calls automatically, and every dashboard exports with custom date ranges
**Depends on**: Phases 1-17 (v1.0 + v1.1 complete)
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03, AI-01, AI-02, AI-03, CS-01, CS-02, CS-03, CS-04, PAY-01, PAY-02, PAY-03, PAY-04, MGR-01, MGR-02, MGR-03, MGR-04, MGR-05, MGR-06, REP-01, REP-02, REP-03, REP-04
**Success Criteria** (what must be TRUE):
  1. User can select a custom date range (or preset) on any CSV export across all six dashboards and receive correctly filtered results
  2. Payroll staff see chargeback alerts with approve/clear actions without leaving the payroll dashboard, and alerts arrive in real-time via Socket.IO
  3. Owner can view, edit, and save the AI system prompt in the owner dashboard, and call transcripts are auto-scored with a configurable daily budget cap
  4. Manager and owner dashboards show per-agent chargeback count, dollar total, and pending term count — with chargebacks and pending terms within 30 days wired to new KPI tables
  5. All UX fixes are applied: paste-to-parse sale entry works end-to-end, payroll paid/unpaid toggle works both directions, "+10" indicator shows on qualifying enrollment fees, bonus/fronted/hold removed from sale rows, commission column removed from agent tracker, and service agents are synced between payroll and CS with round-robin assignment
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
| 18. Platform Polish & Integration | v1.2 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-14*
*v1.1 shipped: 2026-03-18*
*v1.2 roadmap added: 2026-03-18*
