# Requirements: Ops Platform — Customer Service Dashboard

**Defined:** 2026-03-17
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations

## v1.1 Requirements

Requirements for Customer Service milestone. Each maps to roadmap phases.

### Role & Access

- [ ] **ROLE-01**: New customer_service role added to AppRole enum and RBAC middleware
- [ ] **ROLE-02**: customer_service can access Customer Service dashboard Tracking tab only
- [ ] **ROLE-03**: customer_service cannot access Submissions tab or any other dashboard
- [ ] **ROLE-04**: owner and super_admin can access both Submissions and Tracking tabs

### Database Schema

- [ ] **SCHEMA-01**: chargeback_submissions table with all specified fields (posted_date, type, payee_id, payee_name, payout_percent, chargeback_amount as negative decimal, total_amount, transaction_description, product, member_company, member_id, member_agent_company, member_agent_id, submitted_by FK, submitted_at, batch_id, raw_paste)
- [ ] **SCHEMA-02**: pending_terms table with all specified fields (agent_name, agent_id, member_id, member_name, city, state, phone, email, product, enroll_amount, monthly_amount, paid, created_date, first_billing, active_date, next_billing, hold_date as DATE only, hold_reason as TEXT only, inactive, last_transaction_type, smoker, batch_id, submitted_by FK, submitted_at, raw_paste)

### Chargeback Parser

- [ ] **CHBK-01**: User can paste raw chargeback text and parser extracts all specified fields
- [ ] **CHBK-02**: Parser extracts chargeback_amount from parenthesized dollar pattern as negative decimal
- [ ] **CHBK-03**: Parsed records shown as editable preview cards before submission
- [ ] **CHBK-04**: User can manually set posted_date via date picker and override type field
- [ ] **CHBK-05**: Bulk paste detects and parses multiple records, all sharing a batch_id
- [ ] **CHBK-06**: Confirmed records saved to chargeback_submissions with raw_paste, submitted_by, submitted_at

### Pending Terms Parser

- [ ] **TERM-01**: User can paste raw pending terms text and parser extracts all specified fields
- [ ] **TERM-02**: Parser correctly separates hold_date (date only) and hold_reason (text only) as two distinct fields
- [ ] **TERM-03**: Parsed records shown as editable preview cards before submission
- [ ] **TERM-04**: Bulk paste detects multiple records by agent name pattern, all sharing a batch_id
- [ ] **TERM-05**: Confirmed records saved to pending_terms with raw_paste, submitted_by, submitted_at
- [ ] **TERM-06**: Parser handles missing/malformed fields gracefully — blank values stored as null, never crash

### Chargeback Tracking

- [ ] **TRKC-01**: KPI counter bar shows Total Chargebacks (red), Total Recovered (green), Net Exposure (red/green), Records count — all animated count-up on load and filter change
- [ ] **TRKC-02**: Chargeback table displays all 15 specified columns with chargeback_amount always in red
- [ ] **TRKC-03**: Table filterable by date range, product, member company, member agent company, chargeback amount range
- [ ] **TRKC-04**: Table searchable by payee name, member agent company, member ID, member agent ID
- [ ] **TRKC-05**: Table sortable by any column
- [ ] **TRKC-06**: CSV export available to owner and super_admin only

### Pending Terms Tracking

- [ ] **TRKT-01**: Summary bar shows total pending records, count by hold_reason category, count of next_billing within 7 days (urgent/red)
- [ ] **TRKT-02**: Pending terms table displays all specified columns with correct color coding (next_billing green, active/first_billing blue, hold_date red, hold_reason red italic)
- [ ] **TRKT-03**: agent_name and agent_id stored in DB but never displayed as visible table columns
- [ ] **TRKT-04**: Table filterable by agent (behind-the-scenes), state, product, hold_reason keyword, date ranges
- [ ] **TRKT-05**: Table searchable by member name, member ID, agent name, agent ID, phone
- [ ] **TRKT-06**: Table supports group-by-agent with collapsible sections (agent name as group header only)
- [ ] **TRKT-07**: CSV export available to owner and super_admin only

### Resolution Workflow

- [ ] **RESV-01**: Customer service can mark a chargeback record as resolved with a resolution note
- [ ] **RESV-02**: Customer service can mark a pending term record as resolved with a resolution note
- [ ] **RESV-03**: Resolved records show resolved status, resolved_by, resolved_at, and resolution note
- [ ] **RESV-04**: Tracking tables can filter by status (open/resolved) with open as default view

### Dashboard & UI

- [ ] **DASH-01**: Customer Service dashboard app created following existing Next.js dashboard patterns
- [ ] **DASH-02**: Dashboard has two tabs: Submissions and Tracking with role-gated visibility
- [ ] **DASH-03**: Auth portal redirects customer_service role to Customer Service dashboard
- [ ] **DASH-04**: All counters, filters, and summaries update without page reload
- [ ] **DASH-05**: All dates displayed as M/D/YYYY, all dollar amounts formatted with commas and 2 decimal places

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Integration
- **INTG-V2-01**: Wire chargebacks to payroll clawback workflow
- **INTG-V2-02**: Wire pending terms to agent KPI metrics
- **INTG-V2-03**: Real-time Socket.IO updates on new submissions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Chargeback → payroll integration | v1.1 is standalone tracking; wire later |
| Pending terms → agent KPI influence | Decoupled for now; extensible schema allows future wiring |
| Automated chargeback detection | Manual paste-to-parse workflow for v1.1 |
| Email notifications on submissions | Not needed for internal CS workflow |
| Mobile-responsive CS dashboard | Desktop-only, consistent with v1.0 decision |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ROLE-01 | TBD | Pending |
| ROLE-02 | TBD | Pending |
| ROLE-03 | TBD | Pending |
| ROLE-04 | TBD | Pending |
| SCHEMA-01 | TBD | Pending |
| SCHEMA-02 | TBD | Pending |
| CHBK-01 | TBD | Pending |
| CHBK-02 | TBD | Pending |
| CHBK-03 | TBD | Pending |
| CHBK-04 | TBD | Pending |
| CHBK-05 | TBD | Pending |
| CHBK-06 | TBD | Pending |
| TERM-01 | TBD | Pending |
| TERM-02 | TBD | Pending |
| TERM-03 | TBD | Pending |
| TERM-04 | TBD | Pending |
| TERM-05 | TBD | Pending |
| TERM-06 | TBD | Pending |
| TRKC-01 | TBD | Pending |
| TRKC-02 | TBD | Pending |
| TRKC-03 | TBD | Pending |
| TRKC-04 | TBD | Pending |
| TRKC-05 | TBD | Pending |
| TRKC-06 | TBD | Pending |
| TRKT-01 | TBD | Pending |
| TRKT-02 | TBD | Pending |
| TRKT-03 | TBD | Pending |
| TRKT-04 | TBD | Pending |
| TRKT-05 | TBD | Pending |
| TRKT-06 | TBD | Pending |
| TRKT-07 | TBD | Pending |
| DASH-01 | TBD | Pending |
| DASH-02 | TBD | Pending |
| DASH-03 | TBD | Pending |
| DASH-04 | TBD | Pending |
| DASH-05 | TBD | Pending |
| RESV-01 | TBD | Pending |
| RESV-02 | TBD | Pending |
| RESV-03 | TBD | Pending |
| RESV-04 | TBD | Pending |

**Coverage:**
- v1.1 requirements: 40 total
- Mapped to phases: 0
- Unmapped: 36

---
*Requirements defined: 2026-03-17*
*Last updated: 2026-03-17 after initial definition*
