# Phase 61: API Test Coverage — Context

**Created:** 2026-04-13
**Status:** Ready for /paul:plan

## Goals

1. Capture current working behavior in integration tests so regressions are caught before hitting production
2. Comprehensive coverage of highest-risk code paths — commission, chargebacks, payroll, sale status changes
3. Safety net for the v2.8 work ahead (caching, bulk ops) — tests validate correctness before and after changes

## Approach

- 2-plan phase:
  - **61-01:** Test infrastructure (Jest config, test DB, seed helpers) + commission engine tests
  - **61-02:** Chargeback flow tests + payroll/carryover tests + sale status change tests
- Integration tests hitting a real test database (not mocks)
- Tests runnable via `npm test` from existing Jest setup
- Test data created via seed helpers (not relying on production data)
- Each test suite isolated — setup/teardown per test so order doesn't matter

## Test Coverage Map

### 61-01: Commission Engine
- Bundle rules (core + addon bundle detection)
- Fee thresholds (enrollment fee impact on commission)
- ACA flat commission (early return path)
- AD&D commission calculation
- Payment type (ACH deferral impact on period selection)
- Commission approval/revoke flow

### 61-02: Chargeback + Payroll + Status
- Chargeback create (batch submit, matching)
- Chargeback apply in-period (zeros entry, ZEROED_OUT_IN_PERIOD status)
- Chargeback apply cross-period (negative entry in OPEN period, CLAWBACK_CROSS_PERIOD)
- Chargeback delete with cleanup (new fix from commit 27c5335)
- Payroll entry upsert (creates correct entry for sale)
- Payroll carryover on lock (fronted → hold)
- Cross-period negative entries (correct period selection)
- Sale status RAN→DEAD (commission zeroing)
- Sale status DEAD→RAN (approval workflow, commission restoration)

## Constraints

- Real test database, not mocks
- Extend existing Jest config (apps/morgan/ already has Jest)
- Seed helpers for creating test agents, products, sales, lead sources, payroll periods
- Each test suite isolated — setup/teardown per test
- No changes to production code — tests only

## Open Questions

None — scope is clear.

---

*This file persists across /clear so you can take a break if needed.*
