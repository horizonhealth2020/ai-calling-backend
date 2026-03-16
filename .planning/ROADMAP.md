# Roadmap: Ops Platform -- Payroll & Usability Overhaul

**Created:** 2026-03-14
**Granularity:** Fine
**Phases:** 10
**Coverage:** 36/36 v1 requirements mapped

## Phases

- [x] **Phase 1: Sales Entry Fix** - Unblock the platform by fixing the 500 error on sale creation
- [x] **Phase 2: Commission Engine Core** - Product type bundle logic calculates correct commission rates
- [x] **Phase 3: Commission Fees & Period Assignment** - Enrollment fee rules and week-in-arrears period mapping
- [x] **Phase 4: Multi-Product Sales Form** - Manager dashboard supports multiple products, payment type, and enrollment fee per sale
- [x] **Phase 5: Commission Preview & Sale Editing** - Live commission preview before submit and full recalculation on edit
- [x] **Phase 6: Dashboard Cascade** - Sale creation updates all dashboards in real-time via Socket.IO
- [ ] **Phase 7: Payroll Management** - Period workflow, scrollable cards, finalization guards, and CSV export
- [ ] **Phase 8: Reporting** - Agent performance metrics, period summaries, trend KPIs, and export-ready reports
- [ ] **Phase 9: UI/UX Polish** - Form validation, layout consistency, and design system alignment across all dashboards

## Phase Details

### Phase 1: Sales Entry Fix
**Goal**: A manager can create a sale without errors -- the core action of the platform works
**Depends on**: Nothing (first phase)
**Requirements**: SALE-01
**Success Criteria** (what must be TRUE):
  1. User submits a sale from the manager dashboard and receives a success response (no 500 error)
  2. The created sale is persisted in the database with correct agent, product, and date fields
  3. The sale appears in the sales list when the page is refreshed
**Plans:** 3 plans
Plans:
- [x] 01-01-PLAN.md -- Fix Prisma schema sync (memberState, SaleAddon premium) and improve form feedback UX
- [x] 01-02-PLAN.md -- Fix API: dedup addon IDs, wrap payroll in try/catch, noon-UTC dates
- [x] 01-03-PLAN.md -- Fix frontend: agent dropdown placeholder, active-only default, UTC date display

### Phase 2: Commission Engine Core
**Goal**: Commission rates are calculated correctly based on product type and bundle rules
**Depends on**: Phase 1 (sale creation must work to test commissions)
**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04, COMM-05, COMM-06, COMM-07, COMM-11
**Success Criteria** (what must be TRUE):
  1. A core product bundled with Compass VAB earns full commission rate; without Compass VAB it earns half
  2. Bundle detection uses a product flag (isBundleQualifier) not string matching on product name
  3. An add-on product bundled with a core product matches the core product commission rate; standalone add-ons follow threshold rules
  4. An AD&D product earns half commission standalone and full commission when bundled with a core product
  5. All commission amounts are rounded to exactly 2 decimal places with no floating-point drift
**Plans:** 4 plans
Plans:
- [x] 02-01-PLAN.md -- Add isBundleQualifier to Product model and set up TypeScript test infrastructure
- [x] 02-02-PLAN.md -- TDD rewrite of commission engine with bundle aggregation logic
- [x] 02-03-PLAN.md -- Fix payroll dashboard column misalignment (premium in enroll fee column)
- [x] 02-04-PLAN.md -- Add addon product picker to manager dashboard sales entry form

### Phase 3: Commission Fees & Period Assignment
**Goal**: Enrollment fee rules apply correctly and sales land in the right pay period based on arrears logic
**Depends on**: Phase 2 (commission engine core must be in place)
**Requirements**: COMM-08, COMM-09, COMM-10, PAYR-01
**Success Criteria** (what must be TRUE):
  1. An enrollment fee below the product threshold triggers half commission on that sale
  2. An enrollment fee of exactly $125 adds a $10 bonus to the payroll entry
  3. A sale entered on a given date is assigned to the following Sun-Sat pay period (one week in arrears)
  4. An ACH sale is assigned to the pay period two weeks out instead of one
**Plans:** 2 plans
Plans:
- [x] 03-01-PLAN.md -- Verify and test enrollment fee threshold (COMM-08) and $125 bonus (COMM-09) rules
- [x] 03-02-PLAN.md -- Refactor period assignment to Luxon Eastern timezone, add ACH +1 week shift, enforce paymentType

### Phase 4: Multi-Product Sales Form
**Goal**: Managers can enter a sale with multiple products, select payment type, and enter enrollment fee with threshold guidance
**Depends on**: Phase 2 (commission engine must handle multi-product bundles)
**Requirements**: SALE-02, SALE-03, SALE-04
**Success Criteria** (what must be TRUE):
  1. User can add multiple products to a single sale from the product list (products created in payroll)
  2. User can select a payment type (ACH, Check, or Other) for the sale
  3. User can enter an enrollment fee and sees the product threshold displayed alongside the input
  4. Submitting a multi-product sale creates correct payroll entries for each product
**Plans:** 2 plans
Plans:
- [x] 04-01-PLAN.md -- Dropdown defaults, product type filtering, addon sorting, carrier optional
- [x] 04-02-PLAN.md -- Field reorder, stagger animations, end-to-end verification

### Phase 5: Commission Preview & Sale Editing
**Goal**: Users see what commission a sale will generate before submitting, and can edit sales with full recalculation
**Depends on**: Phase 3 (fee rules and period assignment must be correct for preview accuracy), Phase 4 (multi-product form must exist)
**Requirements**: SALE-05, SALE-06
**Success Criteria** (what must be TRUE):
  1. As the user selects products and enters enrollment fee, a live commission preview updates showing the calculated commission per product and total
  2. User can open a previously submitted sale, modify products or details, and save -- commission and period are fully recalculated
  3. Commission preview matches the actual commission recorded after submission (server-authoritative calculation)
**Plans:** 3 plans
Plans:
- [x] 05-01-PLAN.md -- SaleEditRequest schema, preview endpoint, extended PATCH with role-based approval, sale-edit-request CRUD
- [x] 05-02-PLAN.md -- Manager dashboard commission preview panel and inline sale editing with live diff
- [x] 05-03-PLAN.md -- Payroll dashboard pending edit request approvals with field diff display

### Phase 6: Dashboard Cascade
**Goal**: A sale entered on the manager dashboard appears on all other dashboards in real-time without page refresh
**Depends on**: Phase 1 (sale creation must work), Phase 2 (commission must be correct before broadcasting)
**Requirements**: CASC-01, CASC-02, CASC-03, CASC-04
**Success Criteria** (what must be TRUE):
  1. After submitting a sale, the agent tracker on the manager dashboard updates to show the new sale without refresh
  2. After submitting a sale, the sales board leaderboard reflects the new sale without refresh
  3. After submitting a sale, the correct agent's payroll card in the payroll dashboard updates without refresh
  4. After submitting a sale, the owner dashboard KPI metrics update without refresh
**Plans:** 3 plans
Plans:
- [x] 06-01-PLAN.md -- Create @ops/socket shared package, server-side emitSaleChanged helper, and wire emits into sale creation and status-change approval routes
- [x] 06-02-PLAN.md -- Manager dashboard and sales board Socket.IO integration with real-time state patching and highlight
- [x] 06-03-PLAN.md -- Payroll dashboard and owner dashboard Socket.IO integration with real-time state patching and highlight

### Phase 7: Payroll Management
**Goal**: Payroll staff can manage pay periods through their full lifecycle, view agent cards with collapsible entries, enforce paid-agent guards on edits, and export payroll data as CSV
**Depends on**: Phase 3 (period assignment must be correct), Phase 6 (cascade must update payroll cards)
**Requirements**: PAYR-02, PAYR-03, PAYR-04, PAYR-05, PAYR-06, PAYR-07
**Success Criteria** (what must be TRUE):
  1. Payroll cards display per-agent per-period data with correct commission totals using the formula: payout + adjustment + bonus - fronted - hold
  2. Payroll cards collapse to 5 entries by default with "Show N more" expansion (no clipping or overflow)
  3. Per-agent paid status can be toggled (OPEN/PAID), with paid cards showing disabled inputs and hidden actions
  4. A paid agent's entries reject modifications via API (returns 400) and UI (inputs disabled)
  5. Payroll data can be exported as CSV for both open and paid periods
**Plans:** 2 plans
Plans:
- [x] 07-01-PLAN.md -- API paid-agent guard on entry edits with TDD test suite (PAYR-04, PAYR-05, PAYR-07)
- [x] 07-02-PLAN.md -- Collapsible entries, paid-card lockdown, late-entry indicator in AgentPayCard (PAYR-02, PAYR-03, PAYR-06)

### Phase 8: Reporting
**Goal**: Managers and owners can see agent performance metrics, period summaries, and trend data for decision-making
**Depends on**: Phase 7 (payroll periods must be finalized for accurate reporting)
**Requirements**: REPT-01, REPT-02, REPT-03, REPT-04, REPT-05
**Success Criteria** (what must be TRUE):
  1. Per-agent sales count and total commission earned are visible on the reporting view
  2. Per-agent cost-per-sale is calculated and displayed
  3. Weekly and monthly period summary totals are available
  4. Export-ready payroll reports can be generated and downloaded
  5. Owner dashboard displays trend KPIs comparing current period to prior week and prior month
**Plans**: TBD

### Phase 9: UI/UX Polish
**Goal**: All dashboards have consistent, validated forms and polished layouts following the design system
**Depends on**: Phase 4 (forms must exist before they can be polished), Phase 7 (payroll UI must be built)
**Requirements**: UIUX-01, UIUX-02, UIUX-03
**Success Criteria** (what must be TRUE):
  1. All forms across all dashboards show clear validation errors when inputs are invalid (no silent failures)
  2. Form layouts are visually consistent across manager, payroll, and owner dashboards (same spacing, input styles, button placement)
  3. UI changes follow the dark glassmorphism theme with inline CSSProperties per the ui-ux-pro-max design guidance
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Sales Entry Fix | 3/3 | Complete | 2026-03-14 |
| 2. Commission Engine Core | 4/4 | Complete | 2026-03-15 |
| 3. Commission Fees & Period Assignment | 2/2 | Complete | 2026-03-15 |
| 4. Multi-Product Sales Form | 2/2 | Complete | 2026-03-15 |
| 5. Commission Preview & Sale Editing | 3/3 | Complete | 2026-03-15 |
| 6. Dashboard Cascade | 3/3 | Complete | 2026-03-16 |
| 7. Payroll Management | 2/2 | Complete | 2026-03-16 |
| 8. Reporting | 0/? | Not started | - |
| 9. UI/UX Polish | 0/? | Not started | - |
| 10. Sale Status Payroll Logic | 6/6 | Complete | 2026-03-16 |

### Phase 10: Sale Status Payroll Logic

**Goal:** Sale status (Ran/Declined/Dead) drives commission calculation -- only Ran earns commission, status changes from Dead/Declined to Ran require approval through payroll
**Requirements**: STATUS-01, STATUS-02, STATUS-03, STATUS-04, STATUS-05, STATUS-06, STATUS-07, STATUS-08, STATUS-09, STATUS-10, STATUS-11, STATUS-12, STATUS-13, STATUS-14
**Depends on:** Phase 2 (commission engine), Phase 4 (sales form with status field)
**Success Criteria** (what must be TRUE):
  1. A sale with status "Ran" generates normal commission; "Declined" and "Dead" generate $0 commission payroll entries
  2. All three statuses (Ran, Declined, Dead) create payroll entries for reporting visibility
  3. Changing a sale status from Dead or Declined to Ran in the agent sales tab creates a "request for change" instead of applying immediately
  4. Payroll dashboard shows pending status change requests with an approve/reject workflow
  5. Only after payroll approves a Dead/Declined -> Ran change does commission recalculate
**Plans:** 6 plans

Plans:
- [x] 10-01-PLAN.md -- Schema migration (SaleStatus enum replacement, StatusChangeRequest model) and commission gating
- [x] 10-02-PLAN.md -- Status change API with approval workflow, commission zeroing, and dashboard query filters
- [x] 10-03-PLAN.md -- Manager dashboard status dropdown on sales form and editable status on agent sales tab
- [x] 10-04-PLAN.md -- Payroll dashboard pending approvals, approve/reject actions, and period total filtering
- [x] 10-05-PLAN.md -- Fix stale test helper and implement status-commission and status-change test suites
- [x] 10-06-PLAN.md -- Payroll UX: card header financial summary, row status shading, editable product/premium

---
*Roadmap created: 2026-03-14*
