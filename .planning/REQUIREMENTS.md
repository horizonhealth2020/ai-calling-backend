# Requirements: Ops Platform — Dashboard Fixes & Cost Tracking

**Defined:** 2026-03-25
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v1.7 Requirements

Requirements for milestone v1.7. Each maps to roadmap phases.

### Bug Fixes

- [ ] **FIX-01**: Manager Agent Sales tab displays total premium (core + addon) per row, not just core premium
- [ ] **FIX-02**: Lead source create form includes Buffer (seconds) field matching edit form
- [ ] **FIX-03**: Lead source POST API accepts callBufferSeconds in Zod schema

### Config Cleanup

- [ ] **CFG-01**: Manager Config Products section is read-only (no add/edit/delete buttons)
- [ ] **CFG-02**: Read-only Products view shows product name, type, commission rates, and bundle config

### Data Flow

- [ ] **DATA-01**: Convoso KPI poller writes individual call records to ConvosoCallLog table (not just AgentCallKpi snapshots)
- [ ] **DATA-02**: Poller deduplicates against existing ConvosoCallLog records to prevent duplicates across poll cycles
- [ ] **DATA-03**: Cost per sale displays correctly in Manager Tracker tab when Convoso polling is enabled
- [ ] **DATA-04**: Cost per sale displays correctly in Owner Dashboard agent leaderboard
- [ ] **DATA-05**: Agent lead spend shows in tracker even when agent has zero sales

### CS Audit Trail

- [ ] **CS-01**: CS dashboard has Resolved Log tab visible only to OWNER_VIEW and SUPER_ADMIN roles
- [ ] **CS-02**: Resolved Log displays all resolved chargebacks with resolution date, resolved-by user, and notes
- [ ] **CS-03**: Resolved Log displays all resolved pending terms with resolution date, resolved-by user, and notes
- [ ] **CS-04**: Resolved Log supports filtering by type (chargeback/pending term), date range, and agent

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Data Import

- **IMPORT-01**: Bulk sale import from CSV

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time Socket.IO on CS Resolved Log | Audit trail is static review, not live workflow |
| Convoso webhook changes | Poller-first approach; webhook dedup is separate concern |
| AgentCallKpi table deprecation | Keep as parallel snapshot for now; evaluate after poller fix ships |
| Products CRUD in Manager Config | Managers get read-only view; full CRUD stays in Payroll only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 29 | Pending |
| FIX-02 | Phase 29 | Pending |
| FIX-03 | Phase 29 | Pending |
| CFG-01 | Phase 29 | Pending |
| CFG-02 | Phase 29 | Pending |
| DATA-01 | Phase 29 | Pending |
| DATA-02 | Phase 29 | Pending |
| DATA-03 | Phase 29 | Pending |
| DATA-04 | Phase 29 | Pending |
| DATA-05 | Phase 29 | Pending |
| CS-01 | Phase 29 | Pending |
| CS-02 | Phase 29 | Pending |
| CS-03 | Phase 29 | Pending |
| CS-04 | Phase 29 | Pending |

**Coverage:**
- v1.7 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*
