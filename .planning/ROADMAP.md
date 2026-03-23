# Roadmap: Ops Platform — Payroll & Usability Overhaul

## Milestones

- ✅ **v1.0 MVP** — Phases 1-10 (shipped 2026-03-17)
- ✅ **v1.1 Customer Service** — Phases 11-17 (shipped 2026-03-18)
- ✅ **v1.2 Platform Polish & Integration** — Phase 18 (shipped 2026-03-19)
- ✅ **v1.3 Dashboard Consolidation & Uniform Date Ranges** — Phase 19 (shipped 2026-03-23)
- [ ] **v1.4 State-Aware Bundle Requirements** — Phases 20-24

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

### v1.4 State-Aware Bundle Requirements (Phases 20-24)

- [ ] **Phase 20: Schema & Commission Engine** - New tables, resolution service, and state-aware commission logic with backward compatibility
- [ ] **Phase 21: API Routes & Halving Reason Display** - CRUD endpoints for bundle config, preview enhancement, and payroll halving reason visibility
- [ ] **Phase 22: Bundle Config UI** - Bundle requirement and state availability configuration embedded in PayrollProducts cards
- [ ] **Phase 23: Sales Entry Integration** - Client state dropdown on sales form with end-to-end commission flow validation
- [ ] **Phase 24: Housekeeping** - Role selector delay fix and seed agent removal

## Phase Details

### Phase 20: Schema & Commission Engine
**Goal**: Commission engine correctly resolves bundle requirements by client state with full backward compatibility for existing sales
**Depends on**: Nothing (first phase of v1.4)
**Requirements**: BUNDLE-01, BUNDLE-02, BUNDLE-03, BUNDLE-04, BUNDLE-05, BUNDLE-06, BUNDLE-08
**Success Criteria** (what must be TRUE):
  1. BundleRequirement and ProductStateAvailability tables exist with Prisma migration applied, supporting per-state rules, default rules, and multiple fallback tiers
  2. resolveBundleRequirement() returns correct primary addon, fallback addon, or null for any combination of core product and client state
  3. calculateCommission produces half commission with stored reason when required addon is missing for the client's state
  4. Existing sales with null memberState produce identical commission results as before (all 20+ existing tests pass unchanged)
  5. State-aware halving replaces legacy isBundleQualifier halving for products with a BundleRequirement configured -- no double halving possible
**Plans**: TBD

### Phase 21: API Routes & Halving Reason Display
**Goal**: Bundle configuration is manageable via API and commission halving reasons are visible in payroll
**Depends on**: Phase 20
**Requirements**: BUNDLE-07
**Success Criteria** (what must be TRUE):
  1. CRUD endpoints for bundle requirements and state availability accept valid data and reject invalid input with Zod errors
  2. Commission preview endpoint accepts memberState and returns state-aware bundle qualification breakdown
  3. Payroll entry rows display the halving reason when commission was reduced due to missing required addon
**Plans**: TBD

### Phase 22: Bundle Config UI
**Goal**: Payroll admins can configure bundle requirements and state availability through the existing Products tab
**Depends on**: Phase 21
**Requirements**: CFG-01, CFG-02, CFG-03
**Success Criteria** (what must be TRUE):
  1. CORE product cards show a bundle requirement section where admin can select required primary addon and fallback addon per state
  2. ADDON product cards show a state availability multi-select where admin can toggle which US states the product is available in
  3. Completeness indicator on CORE products shows how many states lack bundle coverage, surfacing configuration gaps
  4. Saving config changes emits a Socket.IO event so connected clients refresh product data without page reload
**Plans**: TBD

### Phase 23: Sales Entry Integration
**Goal**: Agents select client state during sales entry and the commission flow reflects state-aware bundle logic end-to-end
**Depends on**: Phase 22
**Requirements**: SALE-01
**Success Criteria** (what must be TRUE):
  1. Sales entry form includes a US state dropdown that populates memberState on the sale record
  2. Commission preview updates when client state is selected, showing which addon qualifies and whether full or half commission applies
  3. A sale submitted with a client state flows through to payroll with correct state-aware commission and visible halving reason if applicable
**Plans**: TBD

### Phase 24: Housekeeping
**Goal**: Fix UX annoyance with role selector and clean up test data from seed script
**Depends on**: Nothing (independent of Phases 20-23)
**Requirements**: FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. Role dashboard selector remains visible long enough to click without collapsing prematurely, with configurable delay
  2. Database seed script no longer creates Amy, Bob, Cara, David, or Elena as agents
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
| 20. Schema & Commission Engine | v1.4 | 0/? | Not started | - |
| 21. API Routes & Halving Reason Display | v1.4 | 0/? | Not started | - |
| 22. Bundle Config UI | v1.4 | 0/? | Not started | - |
| 23. Sales Entry Integration | v1.4 | 0/? | Not started | - |
| 24. Housekeeping | v1.4 | 0/? | Not started | - |

---
*Roadmap created: 2026-03-14*
*v1.1 shipped: 2026-03-18*
*v1.2 shipped: 2026-03-19*
*v1.3 shipped: 2026-03-23*
*v1.4 roadmap added: 2026-03-23*
