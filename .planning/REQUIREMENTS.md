# Requirements: Ops Platform -- Payroll & Usability Overhaul

**Defined:** 2026-03-14
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Sales Entry

- [x] **SALE-01**: Sale creation completes without errors (fix 500 internal server error)
- [x] **SALE-02**: User can select multiple products per sale from products created in payroll
- [x] **SALE-03**: User can select payment type (CC/ACH) per sale (Check/Other deferred — user decision)
- [x] **SALE-04**: User can enter enrollment fee per sale (threshold display deferred to Phase 5 commission preview)
- [ ] **SALE-05**: User sees live commission preview as products are selected before submission
- [ ] **SALE-06**: User can edit a submitted sale with full commission and period recalculation

### Commission Engine

- [x] **COMM-01**: Core products earn full commission rate when bundled with Compass VAB product
- [x] **COMM-02**: Core products earn half commission rate when not bundled with Compass VAB
- [x] **COMM-03**: Compass VAB bundle detection uses product flag (not string matching on name)
- [x] **COMM-04**: Add-on products match core product commission rate when bundled with core
- [x] **COMM-05**: Add-on products follow threshold rules when standalone (below threshold = half)
- [x] **COMM-06**: AD&D products earn half commission from set rate when standalone
- [x] **COMM-07**: AD&D products earn full commission when bundled with core product
- [x] **COMM-08**: Enrollment fee below product threshold triggers half commission
- [x] **COMM-09**: Enrollment fee of exactly $125 triggers $10 bonus
- [x] **COMM-10**: ACH sales are assigned to pay period two weeks out (extra week arrears)
- [x] **COMM-11**: Commission calculations use consistent rounding (2 decimal places)

### Payroll Management

- [x] **PAYR-01**: Sales are assigned to the following Sun-Sat pay period (one week in arrears)
- [ ] **PAYR-02**: Payroll cards display per agent per period with correct commission totals
- [ ] **PAYR-03**: Payroll cards are scrollable when content exceeds viewport
- [ ] **PAYR-04**: Payroll periods follow status workflow: Pending -> Ready -> Finalized
- [ ] **PAYR-05**: Finalized periods reject new writes (entries or modifications)
- [ ] **PAYR-06**: Payroll data can be exported as CSV
- [ ] **PAYR-07**: Net amount formula is consistent: payout + adjustment + bonus - fronted

### Dashboard Cascade

- [ ] **CASC-01**: Sale entry appears on agent tracker in manager dashboard in real-time
- [ ] **CASC-02**: Sale entry appears on sales board leaderboard in real-time
- [ ] **CASC-03**: Sale entry updates the correct agent's payroll card in payroll dashboard
- [ ] **CASC-04**: Sale entry updates KPI metrics on owner dashboard

### Reporting

- [ ] **REPT-01**: Per-agent sales count and total commission earned are visible
- [ ] **REPT-02**: Per-agent cost-per-sale is tracked and displayed
- [ ] **REPT-03**: Weekly and monthly period summary totals are available
- [ ] **REPT-04**: Export-ready payroll reports can be generated
- [ ] **REPT-05**: Owner dashboard shows trend KPIs (vs prior week/month)

### UI/UX

- [ ] **UIUX-01**: All forms have proper input validation with clear error messages
- [ ] **UIUX-02**: Form layouts are consistent and polished across all dashboards
- [ ] **UIUX-03**: UI/UX changes follow ui-ux-pro-max design guidance

### Sale Status & Approval Workflow

- [x] **STATUS-01**: SaleStatus enum replaced with RAN/DECLINED/DEAD; existing sales migrated to RAN
- [x] **STATUS-02**: StatusChangeRequest model exists with correct relations and migration SQL
- [x] **STATUS-03**: Only RAN sales generate non-zero commission; DECLINED/DEAD create $0 payroll entries
- [x] **STATUS-04**: Dead/Declined to Ran creates a change request instead of applying immediately
- [x] **STATUS-05**: Ran to Dead/Declined zeroes commission immediately with finalized period handling
- [x] **STATUS-06**: Payroll/SuperAdmin can approve a change request, triggering commission recalculation
- [x] **STATUS-07**: Payroll/SuperAdmin can reject a change request, reverting to original status
- [x] **STATUS-08**: Sales board and owner KPIs only count RAN sales
- [x] **STATUS-09**: Sales entry form has required status dropdown (blank default, Ran/Declined/Dead)
- [x] **STATUS-10**: Agent sales tab has editable status dropdown with approval workflow confirmation
- [x] **STATUS-11**: StatusBadge shows correct colors: Ran=green, Declined=red, Dead=gray, Pending Ran=amber
- [x] **STATUS-12**: Payroll dashboard shows pending approval requests inside agent payroll cards
- [x] **STATUS-13**: Period totals exclude $0 entries from Dead/Declined sales
- [x] **STATUS-14**: Payroll can approve/reject change requests from within payroll cards

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Sales Entry
- **SALE-V2-01**: Bulk sale import from CSV
- **SALE-V2-02**: Commission dispute workflow with audit trail

### Reporting
- **REPT-V2-01**: Agent performance scoring (composite metric)
- **REPT-V2-02**: Custom date range selection for reports

### AI Features
- **AIFR-V2-01**: Enhanced AI call audit analysis
- **AIFR-V2-02**: Automated call quality scoring

## Out of Scope

| Feature | Reason |
|---------|--------|
| Morgan voice service changes | Separate workload, not part of this initiative |
| Mobile native app | Web-first, responsive is sufficient |
| Custom report builder | Predefined reports cover the use case |
| Automated payroll provider integration | Manual export acceptable for v1 |
| Commission plan designer (drag-and-drop) | Current product/rate model is sufficient |
| Multi-tenant support | Single organization tool |
| Agent self-service portal | Agents view via sales board only |
| Automated clawback triggers | Manual clawback workflow is safer |
| Real-time chat | Not needed for operations workflow |
| Client-side commission calculation | Must be server-authoritative for payroll accuracy |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SALE-01 | Phase 1 | Complete |
| SALE-02 | Phase 4 | Pending |
| SALE-03 | Phase 4 | Pending |
| SALE-04 | Phase 4 | Pending |
| SALE-05 | Phase 5 | Pending |
| SALE-06 | Phase 5 | Pending |
| COMM-01 | Phase 2 | Complete |
| COMM-02 | Phase 2 | Complete |
| COMM-03 | Phase 2 | Complete |
| COMM-04 | Phase 2 | Complete |
| COMM-05 | Phase 2 | Complete |
| COMM-06 | Phase 2 | Complete |
| COMM-07 | Phase 2 | Complete |
| COMM-08 | Phase 3 | Complete |
| COMM-09 | Phase 3 | Complete |
| COMM-10 | Phase 3 | Complete |
| COMM-11 | Phase 2 | Complete |
| PAYR-01 | Phase 3 | Complete |
| PAYR-02 | Phase 7 | Pending |
| PAYR-03 | Phase 7 | Pending |
| PAYR-04 | Phase 7 | Pending |
| PAYR-05 | Phase 7 | Pending |
| PAYR-06 | Phase 7 | Pending |
| PAYR-07 | Phase 7 | Pending |
| CASC-01 | Phase 6 | Pending |
| CASC-02 | Phase 6 | Pending |
| CASC-03 | Phase 6 | Pending |
| CASC-04 | Phase 6 | Pending |
| REPT-01 | Phase 8 | Pending |
| REPT-02 | Phase 8 | Pending |
| REPT-03 | Phase 8 | Pending |
| REPT-04 | Phase 8 | Pending |
| REPT-05 | Phase 8 | Pending |
| UIUX-01 | Phase 9 | Pending |
| UIUX-02 | Phase 9 | Pending |
| UIUX-03 | Phase 9 | Pending |
| STATUS-01 | Phase 10 | Complete |
| STATUS-02 | Phase 10 | Complete |
| STATUS-03 | Phase 10 | Complete |
| STATUS-04 | Phase 10 | Complete |
| STATUS-05 | Phase 10 | Complete |
| STATUS-06 | Phase 10 | Complete |
| STATUS-07 | Phase 10 | Complete |
| STATUS-08 | Phase 10 | Complete |
| STATUS-09 | Phase 10 | Complete |
| STATUS-10 | Phase 10 | Complete |
| STATUS-11 | Phase 10 | Complete |
| STATUS-12 | Phase 10 | Complete |
| STATUS-13 | Phase 10 | Complete |
| STATUS-14 | Phase 10 | Complete |

**Coverage:**
- v1 requirements: 50 total
- Mapped to phases: 50
- Unmapped: 0

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-15 after Phase 10 planning*
