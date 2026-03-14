---
status: testing
phase: 01-sales-entry-fix
source: 01-01-SUMMARY.md
started: 2026-03-14T21:00:00Z
updated: 2026-03-14T21:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Sale Creation Without 500 Error
expected: |
  Fill out the sale form on the manager dashboard (agent, product, date, member name, premium). Click submit. You should receive a green success message — no 500 error, no red error bar.
awaiting: user response

## Tests

### 1. Sale Creation Without 500 Error
expected: Fill out the sale form on the manager dashboard (agent, product, date, member name, premium). Click submit. You should receive a green success message — no 500 error, no red error bar.
result: [pending]

### 2. Sale Persisted with Correct Fields
expected: After creating a sale, refresh the page. The sale should appear in the sales list with the correct agent name, product, date, and premium amount.
result: [pending]

### 3. memberState Persisted
expected: Create a sale with the Member State field set to "FL". After submission, the sale is saved. Query the database or check that the FL exemption logic can read the value (no error on commission calculation).
result: [pending]

### 4. Error Message Display
expected: Try to submit a sale with missing required fields (e.g., no agent selected). A red alert bar should appear above the form showing a friendly error message with the HTTP status code (e.g., "Request failed (400): ..."). The error should persist until you fix the issue and resubmit. The form data should NOT be cleared.
result: [pending]

### 5. Success Message and Auto-Dismiss
expected: Submit a valid sale. A green success bar with a checkmark icon should appear above the form. The form should clear to blank. After approximately 5 seconds, the green bar should automatically disappear.
result: [pending]

### 6. Sales List Auto-Refresh
expected: After successfully submitting a sale, the sales list below the form should update to include the new sale without needing to manually refresh the page.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
