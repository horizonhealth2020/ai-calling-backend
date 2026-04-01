# Requirements: Ops Platform v2.1

**Defined:** 2026-04-01
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v2.1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Quick Fixes

- [x] **FIX-01**: User can set bonus/fronted/hold values to zero without validation error
- [x] **FIX-02**: Fronted amount displays as positive on pay cards (money advanced to agent)
- [x] **FIX-03**: Net column removed from print card sale rows (commission is the per-row amount)
- [x] **FIX-04**: Addon names display cleanly on pay cards with shortened names that fit without jumbling
- [x] **FIX-05**: Half-commission approved deals show "Approved" pill on print view; non-approved show halving reason (e.g., "Waived Fee", "Missing Add-on")

### ACA Product

- [x] **ACA-01**: ACA PL product is editable in the Products tab with configurable commission amount

### Approval & Display Fixes

- [x] **FIX-06**: Approve/Unapprove button based on halvingReason (not enrollment fee threshold)
- [x] **FIX-07**: Print view pills (Approved/Half commission) positioned left of commission amount for column alignment
- [x] **FIX-08**: Approved sales show green Approved pill in print view (fix missing pill bug)
- [x] **NET-01**: Net formula changed to Commission + Bonus + Fronted - Hold (fronted is cash advance, positive on current check)

### Carryover System

- [x] **CARRY-01**: Bonus/fronted/hold stored at agent+period level (new AgentPeriodAdjustment table) — not on individual sale entries
- [x] **CARRY-02**: Fronted amount from current period auto-carries as hold in next period on lock (cash advance repayment)
- [x] **CARRY-03**: If net goes negative (hold > income), unpaid portion carries as hold in next period
- [x] **CARRY-04**: Carryover amounts are editable after auto-population (payroll can adjust as agents pay down)
- [ ] **CARRY-05**: Bonus label shows "Hold Payout" when sourced from carryover; hold label shows source. Labels editable inline.
- [x] **CARRY-06**: Carryover is idempotent — locking/unlocking a period does not create duplicate carryover entries
- [x] **CARRY-07**: Carryover adds to existing values in next period (does not overwrite)
- [ ] **CARRY-08**: Agent cards appear even with zero sales if carryover exists (shows negative net if applicable)
- [ ] **CARRY-09**: Subtle "Carried from prev week" text below inputs when values are from carryover

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
| FIX-03 | Phase 38 | Complete |
| FIX-04 | Phase 38 | Complete |
| FIX-05 | Phase 38 | Complete |
| ACA-01 | Phase 39 | Complete |
| FIX-06 | Phase 40 | Complete |
| FIX-07 | Phase 40 | Complete |
| FIX-08 | Phase 40 | Complete |
| NET-01 | Phase 40 | Complete |
| CARRY-01 | Phase 40 | Complete |
| CARRY-02 | Phase 40 | Complete |
| CARRY-03 | Phase 40 | Complete |
| CARRY-04 | Phase 40 | Complete |
| CARRY-05 | Phase 40 | Pending |
| CARRY-06 | Phase 40 | Complete |
| CARRY-07 | Phase 40 | Complete |
| CARRY-08 | Phase 40 | Pending |
| CARRY-09 | Phase 40 | Pending |
| CARD-01 | Phase 41 | Pending |
| CARD-02 | Phase 41 | Pending |

**Coverage:**
- v2.1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 after roadmap creation*
