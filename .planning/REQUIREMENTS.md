# Requirements: Ops Platform

**Defined:** 2026-04-06
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v2.1 Requirements

Requirements for milestone v2.1: Chargeback Processing, Payroll Layout & Dashboard Polish.

### Chargeback Processing

- [ ] **CB-01**: User can upload a CSV file containing multiple chargebacks
- [ ] **CB-02**: System parses CSV and displays pre-submit review table with matched agent, products, and chargeback amount per row
- [ ] **CB-03**: User can select/edit product assignment per chargeback in review before submitting
- [ ] **CB-04**: Batch chargeback submission processes all-or-nothing within a transaction

### ACA Product

- [ ] **ACA-01**: User can edit ACA product in payroll Products tab with flat commission per member amount
- [ ] **ACA-02**: ACA product satisfies addon bundle requirements — addon sold with ACA gets full commission
- [ ] **ACA-03**: ACA sale entry form is fully functional for submitting ACA sales with member count

### Payroll Layout

- [ ] **PAY-01**: Payroll displays all agents in a left sidebar regardless of selected period
- [ ] **PAY-02**: Selecting an agent shows their last 4 pay cards with a "load more" button for older weeks
- [ ] **PAY-03**: Weekly summary for all agents remains visible regardless of which agent is selected
- [ ] **PAY-04**: Sales with no enrollment fee default to $0, showing half-commission badge and approve button correctly

### Dashboard Polish

- [ ] **DASH-01**: Call audit tab shows last 30 audits (rolling window) instead of last 24 hours
- [ ] **DASH-02**: Per-agent audit filter also uses rolling 30-audit window
- [ ] **DASH-03**: Lead source and timing analytics sections start expanded by default
- [ ] **DASH-04**: 7-day trend sparklines display data correctly

## Future Requirements

None deferred — all scoped features are in v2.1.

## Out of Scope

| Feature | Reason |
|---------|--------|
| CSV format auto-detection | Single known carrier format; defer if multiple formats emerge |
| Payroll period-first view toggle | Full replacement with agent-first view; no need for both |
| ACA flat commission snapshotting | Warning dialog sufficient for v2.1; historical rate locking deferred |
| Chargeback email notifications | Not requested; existing alert pipeline covers CS-to-payroll flow |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CB-01 | Phase 39 | Pending |
| CB-02 | Phase 39 | Pending |
| CB-03 | Phase 39 | Pending |
| CB-04 | Phase 39 | Pending |
| ACA-01 | Phase 40 | Pending |
| ACA-02 | Phase 40 | Pending |
| ACA-03 | Phase 40 | Pending |
| PAY-01 | Phase 41 | Pending |
| PAY-02 | Phase 41 | Pending |
| PAY-03 | Phase 41 | Pending |
| PAY-04 | Phase 38 | Pending |
| DASH-01 | Phase 38 | Pending |
| DASH-02 | Phase 38 | Pending |
| DASH-03 | Phase 38 | Pending |
| DASH-04 | Phase 38 | Pending |

**Coverage:**
- v2.1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after roadmap creation -- all requirements mapped to phases*
