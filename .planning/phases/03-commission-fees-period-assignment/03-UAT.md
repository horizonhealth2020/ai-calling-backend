---
status: testing
phase: 03-commission-fees-period-assignment
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-03-14T12:00:00Z
updated: 2026-03-14T12:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server. Run `npm run db:migrate` then `npm run ops:dev`. Server boots without errors, migration (backfill payment_type) completes, and hitting GET http://localhost:8080 or a health endpoint returns a response (not a connection error).
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Run `npm run db:migrate` then `npm run ops:dev`. Server boots without errors, migration (backfill payment_type) completes, and hitting a basic endpoint returns a response.
result: [pending]

### 2. Sale Creation Requires Payment Type
expected: In the manager dashboard (or via API), attempt to create a sale WITHOUT providing a paymentType. The request should fail with a validation error indicating paymentType is required. Previously this field was optional.
result: [pending]

### 3. CC Sale Period Assignment
expected: Create a sale with paymentType = CC. The sale's payroll entry should be assigned to the current week's period (Sunday-to-Saturday containing the sale date). No +1 week shift.
result: [pending]

### 4. ACH Sale Period Assignment
expected: Create a sale with paymentType = ACH. The sale's payroll entry should be assigned to NEXT week's period (+1 week shift from the current week). This is the new ACH shift behavior.
result: [pending]

### 5. Enrollment Fee Threshold Commission Halving
expected: Create a sale where the enrollment fee is below the product's threshold (default $99). The agent's commission should be halved. If enrollment fee is at or above the threshold, commission remains full.
result: [pending]

### 6. Enrollment Fee Bonus ($125+)
expected: Create a sale with an enrollment fee of $125 or more. A $10 bonus should be added to the agent's payroll entry. Below $125, no bonus is added.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
