---
status: partial
phase: 39-aca-product-configuration
source: [39-VERIFICATION.md]
started: 2026-04-01T17:00:00Z
updated: 2026-04-01T17:00:00Z
---

## Current Test

[testing paused — 3 items outstanding, Railway not deploying]

## Tests

### 1. ACA PL group appears in Products tab
expected: A labelled section 'ACA PL Products' renders below the AD&D group, with the info-blue type badge and color bar on each card
result: blocked
blocked_by: server
reason: "Railway not deploying right now"

### 2. ACA PL edit form shows only flat commission
expected: A single 'Flat Commission ($ per member)' input is the only commission field visible; the Type selector is disabled and shows 'ACA PL'
result: blocked
blocked_by: server
reason: "Railway not deploying right now"

### 3. Flat commission edit persists after refresh
expected: The updated flat commission dollar amount persists after refresh (value round-trips through API and Prisma)
result: blocked
blocked_by: server
reason: "Railway not deploying right now"

## Summary

total: 3
passed: 0
issues: 0
pending: 0
skipped: 0
blocked: 3

## Gaps
