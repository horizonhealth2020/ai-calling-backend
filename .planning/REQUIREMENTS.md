# Requirements: Ops Platform

**Defined:** 2026-03-19
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v1.3 Requirements

Requirements for Dashboard Consolidation & Uniform Date Ranges. Each maps to roadmap phases.

### App Shell

- [ ] **SHELL-01**: User sees a single unified dashboard app with top-level tab navigation
- [ ] **SHELL-02**: Tab visibility is gated by user's role (MANAGER sees Manager, PAYROLL sees Payroll, etc.)
- [ ] **SHELL-03**: SUPER_ADMIN sees all tabs (Manager, Payroll, Owner, CS)
- [ ] **SHELL-04**: User logs in and lands directly on their default tab based on role
- [ ] **SHELL-05**: Socket.IO connection is shared at layout level — no reconnection when switching tabs

### Dashboard Migration

- [ ] **MIG-01**: CS dashboard migrated with all sub-tabs and features identical to standalone app
- [ ] **MIG-02**: Owner dashboard migrated with all sub-tabs and features identical to standalone app
- [ ] **MIG-03**: Payroll dashboard migrated with all sub-tabs and features identical to standalone app
- [ ] **MIG-04**: Manager dashboard migrated with all sub-tabs and features identical to standalone app

### Date Range

- [ ] **DR-01**: Uniform DateRangeFilter component with 4 presets: Current Week, Last Week, 30 Days, Custom
- [ ] **DR-02**: Date range filtering applied to CS tracker KPI counters
- [ ] **DR-03**: Date range filtering applied to Manager tracker KPI counters
- [ ] **DR-04**: Date range filtering applied to Owner performance overview KPI counters
- [ ] **DR-05**: Date range filtering applied to Payroll dashboard KPI counters
- [ ] **DR-06**: All existing CSV export date range pickers use the same uniform presets

### Deployment

- [ ] **DEPLOY-01**: CORS config updated for single unified app origin (ops-api, docker-compose, Railway)
- [ ] **DEPLOY-02**: Docker configuration updated for unified app (replaces 5 separate containers)
- [ ] **DEPLOY-03**: Old standalone dashboard app directories removed after migration verified
- [ ] **DEPLOY-04**: Sales board remains standalone and fully functional

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Data Management

- **DATA-01**: Bulk sale import from CSV
- **DATA-02**: Data archival with restore capability

### Analytics

- **ANLYT-01**: AI scoring dashboard with trend analysis
- **ANLYT-02**: Chargeback → payroll clawback auto-creation

### Tech Debt

- **DEBT-01**: Route file splitting (ops-api routes/index.ts)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| New features or functionality | Pure consolidation — everything must work identically after migration |
| Morgan voice service changes | Separate workload, not part of this initiative |
| Sales board consolidation | Stays standalone (public, no auth required) |
| Mobile app | Web-first, desktop is primary use case for internal ops |
| API layer changes beyond date range params | ops-api stays as-is except adding date range to KPI endpoints |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SHELL-01 | — | Pending |
| SHELL-02 | — | Pending |
| SHELL-03 | — | Pending |
| SHELL-04 | — | Pending |
| SHELL-05 | — | Pending |
| MIG-01 | — | Pending |
| MIG-02 | — | Pending |
| MIG-03 | — | Pending |
| MIG-04 | — | Pending |
| DR-01 | — | Pending |
| DR-02 | — | Pending |
| DR-03 | — | Pending |
| DR-04 | — | Pending |
| DR-05 | — | Pending |
| DR-06 | — | Pending |
| DEPLOY-01 | — | Pending |
| DEPLOY-02 | — | Pending |
| DEPLOY-03 | — | Pending |
| DEPLOY-04 | — | Pending |

**Coverage:**
- v1.3 requirements: 19 total
- Mapped to phases: 0
- Unmapped: 19 ⚠️

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after initial definition*
