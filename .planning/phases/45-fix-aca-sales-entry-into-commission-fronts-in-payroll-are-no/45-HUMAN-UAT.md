---
status: partial
phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no
source: [45-VERIFICATION.md]
started: 2026-04-07T00:00:00Z
updated: 2026-04-07T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. ACA unified row renders on payroll dashboard
expected: Submit Complete Care Max + addon + ACA checkbox (memberCount=2). Payroll dashboard shows ONE row with core badge + addon badge + ACA badge, commission as flat dollar (no `x N members =` text).
result: [pending]

### 2. Lock → unlock → edit front → re-lock carryover cycle
expected: Lock period with frontedAmount=200 → next period Fronted Hold=200. Unlock → next period Fronted Hold=0, app_audit_log shows REVERSE_CARRYOVER. Edit front to 300, re-lock → next period Fronted Hold=300.
result: [pending]

### 3. CS round-robin cursor stability under paste/refresh
expected: Query `cs_round_robin_chargeback_index` value. Paste 5 rows in CS Submissions, refresh, paste again — value unchanged. Submit batch of 5 → value increases by exactly 5 (mod repCount).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
