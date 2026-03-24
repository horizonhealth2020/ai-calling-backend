# Requirements: v1.5 Platform Cleanup & Remaining Features

**Defined:** 2026-03-24
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v1.5 Requirements

### Tech Debt

- [ ] **SPLIT-01**: Route file split into domain modules with shared helpers extracted
- [ ] **SPLIT-02**: All existing endpoints function identically after split (zero behavior change)

### Owner Dashboard

- [ ] **OWNER-01**: Owner period summary shows CS payroll total next to commission total
- [ ] **OWNER-02**: CS payroll total updates via Socket.IO when service entries change

### Payroll Export

- [ ] **EXPORT-01**: Detailed CSV export produces agent-grouped sections matching print card layout
- [ ] **EXPORT-02**: Each agent section includes header row, sale rows, and subtotal row
- [ ] **EXPORT-03**: Export handles large datasets without browser memory issues

### AI Scoring

- [ ] **SCORE-01**: Owner dashboard has Scoring tab showing aggregate KPIs (avg score, total audits, score distribution)
- [ ] **SCORE-02**: Per-agent score breakdown table with sortable columns
- [ ] **SCORE-03**: Weekly trend data showing score changes over time
- [ ] **SCORE-04**: DateRangeFilter integration on scoring tab

### Chargeback Automation

- [ ] **CLAWBACK-01**: Fix approveAlert() to use correct sale reference (not memberId as saleId)
- [ ] **CLAWBACK-02**: Auto-match chargebacks to sales by memberId/memberName on submission
- [ ] **CLAWBACK-03**: Auto-create clawback record when chargeback is approved and sale is matched
- [ ] **CLAWBACK-04**: Unmatched chargebacks flagged for manual review
- [ ] **CLAWBACK-05**: Socket.IO event when clawback is auto-created

### Data Archival

- [ ] **ARCHIVE-01**: Admin can archive old call logs, audit logs, and KPI snapshots by date range
- [ ] **ARCHIVE-02**: Archived data moved to parallel archive tables (not soft-delete)
- [ ] **ARCHIVE-03**: Admin can restore archived data back to main tables
- [ ] **ARCHIVE-04**: Data management section in owner dashboard showing archive stats

## Future Requirements (Deferred)

- Bulk sale import from CSV
- Retroactive commission recalculation when bundle config changes
- Admin "recalculate" button for bulk commission updates
- Config change audit logging
- Commission preview shows bundle qualification status by state
- Addon suggestion based on selected client state

## Out of Scope

| Feature | Reason |
|---------|--------|
| Archival of core business tables (sales, payroll entries, products) | Core data must remain accessible; only high-volume logs archived |
| Mobile app | Web-first, desktop is primary use case |
| Custom report builder | Predefined reports + date range covers the use case |
| Bulk sale import from CSV | Deferred to future milestone |

## Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| SPLIT-01 | | pending |
| SPLIT-02 | | pending |
| OWNER-01 | | pending |
| OWNER-02 | | pending |
| EXPORT-01 | | pending |
| EXPORT-02 | | pending |
| EXPORT-03 | | pending |
| SCORE-01 | | pending |
| SCORE-02 | | pending |
| SCORE-03 | | pending |
| SCORE-04 | | pending |
| CLAWBACK-01 | | pending |
| CLAWBACK-02 | | pending |
| CLAWBACK-03 | | pending |
| CLAWBACK-04 | | pending |
| CLAWBACK-05 | | pending |
| ARCHIVE-01 | | pending |
| ARCHIVE-02 | | pending |
| ARCHIVE-03 | | pending |
| ARCHIVE-04 | | pending |

**Coverage:** 20 requirements, 0 mapped

---
*Created: 2026-03-24*
