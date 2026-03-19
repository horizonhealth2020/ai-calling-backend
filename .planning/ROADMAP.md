# Roadmap: Ops Platform — Payroll & Usability Overhaul

## Milestones

- ✅ **v1.0 MVP** — Phases 1-10 (shipped 2026-03-17)
- ✅ **v1.1 Customer Service** — Phases 11-17 (shipped 2026-03-18)
- ✅ **v1.2 Platform Polish & Integration** — Phase 18 (shipped 2026-03-19)
- [ ] **v1.3 Dashboard Consolidation & Uniform Date Ranges** — Phase 19

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

### v1.3 Dashboard Consolidation & Uniform Date Ranges

- [ ] **Phase 19: Dashboard Consolidation & Uniform Date Ranges** — Unified app with role-gated tabs, all 4 dashboard migrations, uniform date range on all KPIs, deployment cleanup

## Phase Details

### Phase 19: Dashboard Consolidation & Uniform Date Ranges
**Goal**: Consolidate all internal dashboards into a single unified app with role-gated tabs, uniform date range filtering on all KPIs, and cleaned-up deployment
**Depends on**: Nothing (first phase of v1.3)
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05, MIG-01, MIG-02, MIG-03, MIG-04, DR-01, DR-02, DR-03, DR-04, DR-05, DR-06, DEPLOY-01, DEPLOY-02, DEPLOY-03, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. User navigates to unified app URL and sees login form (no separate auth-portal)
  2. After login, user lands on default tab based on role
  3. Unauthenticated users accessing any dashboard route are redirected to login
  4. User sees only the tabs their role permits; SUPER_ADMIN sees all four tabs
  5. Tab switching does not cause Socket.IO disconnect/reconnect (shared layout-level connection)
  6. Tab navigation uses URL-based routing (browser back/forward works)
  7. CS tab displays all sub-tabs with identical functionality to standalone app
  8. Owner tab displays all sub-tabs with identical functionality to standalone app
  9. Payroll tab displays all sub-tabs with identical functionality to standalone app
  10. Manager tab displays all sub-tabs with identical functionality to standalone app
  11. DateRangeFilter offers four presets (Current Week, Last Week, 30 Days, Custom) on all KPI sections
  12. Date range updates KPI counters on all four dashboard tabs
  13. Date range selection persists across tab switches
  14. CSV export date range pickers use same uniform presets
  15. CORS config updated for unified app origin
  16. Docker runs one unified container instead of five
  17. Old standalone dashboard app directories removed
  18. Sales board remains standalone and fully functional
**Plans:** 8 plans

Plans:
- [ ] 19-01-PLAN.md — App shell foundation (login, middleware, tab bar, SocketProvider, DateRangeContext)
- [ ] 19-02-PLAN.md — Shared package updates (DateRangeFilter presets, decodeTokenPayload export, last_week)
- [ ] 19-03-PLAN.md — CS dashboard migration (2 sub-tabs)
- [ ] 19-04-PLAN.md — Owner dashboard migration (4 sub-tabs)
- [ ] 19-05-PLAN.md — Payroll dashboard migration (5 sub-tabs)
- [ ] 19-06-PLAN.md — Manager dashboard migration (5 sub-tabs)
- [ ] 19-07-PLAN.md — Date range API wiring + CSV export presets
- [ ] 19-08-PLAN.md — Deployment cleanup (CORS, Docker, remove old apps, verify)

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
| 19. Dashboard Consolidation & Uniform Date Ranges | v1.3 | 0/8 | Not started | - |

---
*Roadmap created: 2026-03-14*
*v1.1 shipped: 2026-03-18*
*v1.2 shipped: 2026-03-19*
*v1.3 roadmap added: 2026-03-19*
