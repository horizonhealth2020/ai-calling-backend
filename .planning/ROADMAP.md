# Roadmap: Ops Platform — Payroll & Usability Overhaul

## Milestones

- ✅ **v1.0 MVP** — Phases 1-10 (shipped 2026-03-17)
- ✅ **v1.1 Customer Service** — Phases 11-17 (shipped 2026-03-18)
- ✅ **v1.2 Platform Polish & Integration** — Phase 18 (shipped 2026-03-19)
- ✅ **v1.3 Dashboard Consolidation & Uniform Date Ranges** — Phase 19 (shipped 2026-03-23)
- [ ] **v1.4 State-Aware Bundle Requirements** — Phase 20

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

### v1.4 State-Aware Bundle Requirements (Phase 20)

- [ ] **Phase 20: State-Aware Bundle Requirements** - Schema, commission engine, API routes, config UI, sales entry integration, and housekeeping fixes

## Phase Details

### Phase 20: State-Aware Bundle Requirements
**Goal**: State-aware bundle commission with configurable primary/fallback addons per state, config UI in Products tab, client state on sales entry, and housekeeping fixes
**Depends on**: Nothing (first phase of v1.4)
**Requirements**: BUNDLE-01, BUNDLE-02, BUNDLE-03, BUNDLE-04, BUNDLE-05, BUNDLE-06, BUNDLE-07, BUNDLE-08, CFG-01, CFG-02, CFG-03, SALE-01, FIX-01, FIX-02
**Success Criteria** (what must be TRUE):
  1. BundleRequirement and ProductStateAvailability tables exist with Prisma migration applied, supporting per-state rules, default rules, and multiple fallback tiers
  2. resolveBundleRequirement() returns correct primary addon, fallback addon, or null for any combination of core product and client state
  3. calculateCommission produces half commission with stored reason when required addon is missing for the client's state
  4. Existing sales with null memberState produce identical commission results as before (all 20+ existing tests pass unchanged)
  5. State-aware halving replaces legacy isBundleQualifier halving for products with a BundleRequirement configured -- no double halving possible
  6. CRUD endpoints for bundle requirements and state availability with Zod validation
  7. Payroll entry rows display the halving reason when commission was reduced due to missing required addon
  8. CORE product cards show bundle requirement section (primary + fallback addon selectors per state)
  9. ADDON product cards show state availability multi-select (50 states + DC)
  10. Completeness indicator surfaces states without bundle coverage
  11. Sales entry form includes US state dropdown populating memberState
  12. Role dashboard selector has configurable delay before collapsing
  13. Database seed script no longer creates Amy, Bob, Cara, David, or Elena
**Plans:** 5 plans

Plans:
- [x] 20-01-PLAN.md -- Schema migration (Product FKs, ProductStateAvailability, PayrollEntry halvingReason) + US_STATES constant + FIX-02 verification
- [ ] 20-02-PLAN.md -- Commission engine (resolveBundleRequirement, modified calculateCommission, updated callers, new tests)
- [x] 20-03-PLAN.md -- API routes (product PATCH/GET extension, state-availability PUT/GET endpoints)
- [ ] 20-04-PLAN.md -- Config UI (CORE bundle requirement section, ADDON state availability section, completeness indicator)
- [x] 20-05-PLAN.md -- Sales entry state dropdown, payroll halving reason display, role selector delay fix

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

---
*Roadmap created: 2026-03-14*
*v1.1 shipped: 2026-03-18*
*v1.2 shipped: 2026-03-19*
*v1.3 shipped: 2026-03-23*
*v1.4 roadmap added: 2026-03-23*
