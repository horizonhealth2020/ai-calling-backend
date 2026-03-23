# Requirements: Ops Platform — State-Aware Bundle Requirements

**Defined:** 2026-03-23
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v1.4 Requirements

Requirements for milestone v1.4. Each maps to roadmap phases.

### Bundle Commission

- [ ] **BUNDLE-01**: Admin can designate a primary required addon for full commission on a CORE product
- [ ] **BUNDLE-02**: Admin can set state availability for addon products (which US states they can be sold in)
- [ ] **BUNDLE-03**: Admin can set fallback addon(s) for states where primary addon is unavailable
- [ ] **BUNDLE-04**: Admin can configure multiple fallback tiers per state
- [ ] **BUNDLE-05**: Commission engine resolves required addon by client state (primary → fallback → legacy isBundleQualifier)
- [ ] **BUNDLE-06**: Half commission applied when required addon missing, with reason stored
- [ ] **BUNDLE-07**: Payroll entry displays halving reason when commission was reduced
- [ ] **BUNDLE-08**: Existing sales without memberState continue working via legacy fallback

### Config UI

- [ ] **CFG-01**: CORE product cards show bundle requirement section (required addon selector, fallback selector)
- [ ] **CFG-02**: ADDON product cards show state availability multi-select
- [ ] **CFG-03**: Completeness indicator shows states without bundle coverage

### Sales Entry

- [ ] **SALE-01**: Sales entry form includes client state dropdown (US states)

### Housekeeping

- [ ] **FIX-01**: Role dashboard selector has configurable delay before collapsing
- [ ] **FIX-02**: Seed agents (Amy, Bob, Cara, David, Elena) removed from database seed

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Bundle Commission (Deferred)

- **BUNDLE-F01**: Retroactive recalculation of existing sales when bundle config changes
- **BUNDLE-F02**: Admin "recalculate" button for bulk commission updates
- **BUNDLE-F03**: Config change audit logging to app_audit_log

### Sales Entry (Deferred)

- **SALE-F01**: Commission preview shows bundle qualification status by state
- **SALE-F02**: Addon suggestion based on selected client state

## Out of Scope

| Feature | Reason |
|---------|--------|
| State-specific commission rates (different rate per state) | Only bundle requirement varies by state, not the rate itself |
| Product licensing/compliance validation | Beyond commission logic — regulatory concern |
| Automatic state detection from client address | Manual entry sufficient for now |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUNDLE-01 | — | Pending |
| BUNDLE-02 | — | Pending |
| BUNDLE-03 | — | Pending |
| BUNDLE-04 | — | Pending |
| BUNDLE-05 | — | Pending |
| BUNDLE-06 | — | Pending |
| BUNDLE-07 | — | Pending |
| BUNDLE-08 | — | Pending |
| CFG-01 | — | Pending |
| CFG-02 | — | Pending |
| CFG-03 | — | Pending |
| SALE-01 | — | Pending |
| FIX-01 | — | Pending |
| FIX-02 | — | Pending |

**Coverage:**
- v1.4 requirements: 14 total
- Mapped to phases: 0
- Unmapped: 14 ⚠️

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 after initial definition*
