# Requirements: Ops Platform

**Defined:** 2026-04-06
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v2.2 Requirements

Requirements for milestone v2.2: Chargeback Batch Review & Payroll Agent Tabs.

### Chargeback Batch Review

- [ ] **CB-01**: User can paste multiple chargebacks and parse all entries at once
- [ ] **CB-02**: User sees a review table of all parsed entries before submitting
- [ ] **CB-03**: Each review row shows matched agent name, member name, member ID, and match status (MATCHED/MULTIPLE/UNMATCHED)
- [ ] **CB-04**: Each matched review row shows sale products with checkboxes for partial chargeback selection
- [ ] **CB-05**: User can edit amount, rep assignment, and product selection per entry in the review table
- [ ] **CB-06**: User can remove individual entries from the batch before submitting
- [ ] **CB-07**: Validation summary bar shows counts by match status above the review table
- [ ] **CB-08**: CS reps are auto-assigned via round-robin in the review table
- [ ] **CB-09**: User submits entire reviewed batch with a single "Submit Batch" action

### ACA Product Fix

- [ ] **ACA-01**: ACA product appears in the Products tab and is editable with flat commission rate
- [ ] **ACA-02**: ACA product satisfies the full commission bundle requirement for addons

### Payroll Agent Tabs

- [ ] **PAY-01**: Payroll Periods tab has a left sidebar listing all agents with current earnings sort
- [ ] **PAY-02**: Clicking an agent in sidebar shows that agent's pay periods in the main content area
- [ ] **PAY-03**: Agent display shows last 4 pay periods by default (most recent first)
- [ ] **PAY-04**: "Load More" button at bottom fetches older pay periods for the selected agent
- [ ] **PAY-05**: Sidebar shows paid/unpaid/partial status badges next to each agent name
- [ ] **PAY-06**: Sidebar includes search/filter to find agents by name

## Future Requirements

None deferred — all scoped features are in v2.2.

## Out of Scope

| Feature | Reason |
|---------|--------|
| CSV/file upload for chargebacks | Users copy-paste from carrier portal; paste-only matches workflow |
| Multi-step wizard for batch submit | Two states (paste + review) is sufficient; wizard adds friction |
| Drag-and-drop agent reordering | Automatic sort by earnings matches existing pattern |
| Agent sidebar as separate routes | Agent selection is component state, not URL routes |
| Infinite scroll for periods | Explicit "Load More" better for payroll period boundaries |
| Server-side period pagination | Client-side slice sufficient for current data volume; optimize later |
| Batch undo after submit | Per-chargeback delete endpoint covers corrections |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ACA-01 | Phase 42 | Pending |
| ACA-02 | Phase 42 | Pending |
| PAY-01 | Phase 43 | Pending |
| PAY-02 | Phase 43 | Pending |
| PAY-03 | Phase 43 | Pending |
| PAY-04 | Phase 43 | Pending |
| PAY-05 | Phase 43 | Pending |
| PAY-06 | Phase 43 | Pending |
| CB-01 | Phase 44 | Pending |
| CB-02 | Phase 44 | Pending |
| CB-03 | Phase 44 | Pending |
| CB-04 | Phase 44 | Pending |
| CB-05 | Phase 44 | Pending |
| CB-06 | Phase 44 | Pending |
| CB-07 | Phase 44 | Pending |
| CB-08 | Phase 44 | Pending |
| CB-09 | Phase 44 | Pending |

**Coverage:**
- v2.2 requirements: 17 total
- Mapped to phases: 17
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after roadmap creation (traceability updated)*
