# Requirements: Ops Platform — v1.2 Platform Polish & Integration

**Defined:** 2026-03-18
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v1.2 Requirements

Requirements for v1.2 milestone. All mapped to a single phase.

### Exports & Reporting

- [ ] **EXPORT-01**: User can select date range (from/to) on any CSV export across all dashboards
- [ ] **EXPORT-02**: User can choose relative presets (Last 7 days, Last 30 days, This month) alongside custom range
- [ ] **EXPORT-03**: System alerts when database storage is near capacity with option to download CSVs and clear old data

### AI & Call Auditing

- [ ] **AI-01**: System prompt is visible and editable in owner dashboard AI tab
- [ ] **AI-02**: Fix "INP not defined" error on owner dashboard AI config
- [ ] **AI-03**: AI auto-scores call transcripts from Convoso with budget controls

### Chargeback & Pending Terms Integration

- [ ] **CS-01**: Chargebacks create alerts displayed in a table above the current open week in payroll dashboard with approve/clear actions
- [ ] **CS-02**: Pending terms + chargebacks within 30 days wired to new agent KPI tables
- [ ] **CS-03**: Pending terms tracker shows holder date records aggregated per date (replaces "due within 7 days")
- [ ] **CS-04**: Real-time Socket.IO auto-refreshes CS tracking tables on new submissions

### Payroll UX

- [x] **PAY-01**: Paid/unpaid toggle works bidirectionally (on and off)
- [x] **PAY-02**: Edit button on each sale record in payroll view
- [x] **PAY-03**: Bonus, fronted, and hold fields removed from sale rows — only on agent card header
- [x] **PAY-04**: "+10" indicator next to enrollment fee amount when qualifying for $124 enrollment bonus

### Manager Dashboard

- [x] **MGR-01**: Commission column removed from agent tracker
- [x] **MGR-02**: Paste-to-parse sale entry — paste sale confirmation text, auto-fills form fields
- [x] **MGR-03**: Fix "invalid enum APPROVED" error — map parsed sale status to correct enum values
- [x] **MGR-04**: Core product auto-selected by default unless explicitly parsed otherwise
- [x] **MGR-05**: Lead source field moved to top of form next to agent selector
- [x] **MGR-06**: State field correctly populated from parsed address data

### Rep & Permission Management

- [ ] **REP-01**: Service agents synced between payroll and CS dashboard
- [ ] **REP-02**: CS reps creatable from either CS or payroll dashboard (requires OWNER_VIEW or PAYROLL role)
- [ ] **REP-03**: Round robin checklist in reps for pending term and chargeback assignment
- [ ] **REP-04**: Customizable permission table in owner dashboard users section for all create actions

## Future Requirements

### Deferred from v1.2

- **STORE-01**: Data archival with restore capability (beyond simple clearance)
- **AI-04**: AI scoring dashboard with trend analysis and team comparisons
- **CS-05**: Chargeback → payroll clawback auto-creation (beyond alerts)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Morgan voice service changes | Separate workload |
| Mobile app | Web-first for internal ops |
| Custom report builder | Predefined reports + date range covers use case |
| Client-side commission calculation | Must be server-authoritative |
| Route file splitting | Tech debt for v1.3 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXPORT-01 | Phase 18 | Pending |
| EXPORT-02 | Phase 18 | Pending |
| EXPORT-03 | Phase 18 | Pending |
| AI-01 | Phase 18 | Pending |
| AI-02 | Phase 18 | Pending |
| AI-03 | Phase 18 | Pending |
| CS-01 | Phase 18 | Pending |
| CS-02 | Phase 18 | Pending |
| CS-03 | Phase 18 | Pending |
| CS-04 | Phase 18 | Pending |
| PAY-01 | Phase 18 | Complete |
| PAY-02 | Phase 18 | Complete |
| PAY-03 | Phase 18 | Complete |
| PAY-04 | Phase 18 | Complete |
| MGR-01 | Phase 18 | Complete |
| MGR-02 | Phase 18 | Complete |
| MGR-03 | Phase 18 | Complete |
| MGR-04 | Phase 18 | Complete |
| MGR-05 | Phase 18 | Complete |
| MGR-06 | Phase 18 | Complete |
| REP-01 | Phase 18 | Pending |
| REP-02 | Phase 18 | Pending |
| REP-03 | Phase 18 | Pending |
| REP-04 | Phase 18 | Pending |

**Coverage:**
- v1.2 requirements: 24 total
- Mapped to phases: 24
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after initial definition*
