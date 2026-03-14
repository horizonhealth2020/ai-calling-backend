---
status: complete
phase: 02-commission-engine-core
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md]
started: 2026-03-14T23:00:00Z
updated: 2026-03-14T23:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Run `npm run test:ops` from the repo root. Jest finds and executes the commission test suite. No configuration errors, no module resolution failures. All 17 tests pass.
result: pass

### 2. isBundleQualifier Migration Exists
expected: A migration file exists at `prisma/migrations/20260315000000_add_bundle_qualifier/migration.sql` containing ALTER TABLE to add the isBundleQualifier column and UPDATE statements to flag existing Compass VAB products.
result: pass

### 3. Bundle Aggregation Logic
expected: In `apps/ops-api/src/services/payroll.ts`, the `calculateCommission()` function sums core product + regular addon premiums into a single bundle total, applies one threshold check, and uses one commission rate — rather than calculating per-product. AD&D addons are calculated separately with their own rates.
result: issue
reported: "manager board sales entry only allows me to add 1 product at a time. i can not bundle to test"
severity: major

### 4. Addon Premium Sourcing Fix
expected: Each addon uses its own `SaleAddon.premium` value for commission calculation, NOT the parent `sale.premium`. Verify in the commission test output that addon-specific premiums are used correctly.
result: skipped
reason: Cannot test — blocked by same sales entry limitation (no bundle/addon support in UI)

### 5. Halving Without Bundle Qualifier
expected: When no product in the sale has `isBundleQualifier: true`, the total commission (bundle + AD&D) is halved. The test suite includes tests for this behavior (COMM-05, COMM-06).
result: pass

### 6. Premium in Enrollment Fee Column (User-Reported)
expected: Premium values should appear in the premium/commission columns, not in the enrollment fee column in payroll.
result: issue
reported: "PREMIUM IS BEING TOTALED IN ENROLLMENT FEE COLUMN IN PAYROLL"
severity: major

## Summary

total: 6
passed: 3
issues: 2
pending: 0
skipped: 1

## Gaps

- truth: "Sales entry supports bundling multiple products (core + addons) in a single sale"
  status: failed
  reason: "User reported: manager board sales entry only allows me to add 1 product at a time. i can not bundle to test"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Premium values appear in correct payroll columns, not in the enrollment fee column"
  status: failed
  reason: "User reported: PREMIUM IS BEING TOTALED IN ENROLLMENT FEE COLUMN IN PAYROLL"
  severity: major
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
