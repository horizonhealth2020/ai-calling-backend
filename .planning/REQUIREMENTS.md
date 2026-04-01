# Requirements: Ops Platform v2.1

**Defined:** 2026-04-01
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v2.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Quick Fixes

- [x] **FIX-01**: User can set bonus/fronted/hold values to zero without validation error
- [x] **FIX-02**: Fronted amount displays as positive on pay cards (money advanced to agent)
- [ ] **FIX-03**: Net column removed from print card sale rows (commission is the per-row amount)
- [ ] **FIX-04**: Addon names display cleanly on pay cards with shortened names that fit without jumbling
- [ ] **FIX-05**: Half-commission approved deals show "Approved" pill on print view; non-approved show halving reason (e.g., "Waived Fee", "Missing Add-on")

### ACA Product

- [ ] **ACA-01**: ACA PL product is editable in the Products tab with configurable commission amount

### Carryover System

- [ ] **CARRY-01**: Bonus/fronted/hold amounts live at agent level only — not deducted from individual sale rows
- [ ] **CARRY-02**: Fronted amount from current period auto-populates as hold in the next period on lock
- [ ] **CARRY-03**: Hold amount from current period auto-populates as bonus in the next period on lock
- [ ] **CARRY-04**: Carryover amounts are editable after auto-population (payroll can adjust as agents pay down)
- [ ] **CARRY-05**: Bonus box label is editable — shows "Hold Payout" when sourced from carryover, "Bonus" otherwise
- [ ] **CARRY-06**: Carryover is idempotent — locking/unlocking a period does not create duplicate carryover entries

### Payroll Card Restructure

- [ ] **CARD-01**: Payroll view shows agent-level collapsible cards (one card per agent)
- [ ] **CARD-02**: Inside each agent card, week-by-week entries are separated for payroll processing

## v2.2+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### Carryover Extensions

- **CARRY-07**: Carryover reversal automation (cascading audit on period unlock)
- **CARRY-08**: Carryover chain tracking with linked-list provenance across periods

## Out of Scope

| Feature | Reason |
|---------|--------|
| Custom print templates | Internal tool — template literal pattern is sufficient |
| Client-side commission calculation | Must be server-authoritative for payroll accuracy |
| Mobile payroll view | Desktop is primary use case for internal ops |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 38 | Complete |
| FIX-02 | Phase 38 | Complete |
| FIX-03 | Phase 38 | Pending |
| FIX-04 | Phase 38 | Pending |
| FIX-05 | Phase 38 | Pending |
| ACA-01 | Phase 39 | Pending |
| CARRY-01 | Phase 40 | Pending |
| CARRY-02 | Phase 40 | Pending |
| CARRY-03 | Phase 40 | Pending |
| CARRY-04 | Phase 40 | Pending |
| CARRY-05 | Phase 40 | Pending |
| CARRY-06 | Phase 40 | Pending |
| CARD-01 | Phase 41 | Pending |
| CARD-02 | Phase 41 | Pending |

**Coverage:**
- v2.1 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after roadmap creation*
