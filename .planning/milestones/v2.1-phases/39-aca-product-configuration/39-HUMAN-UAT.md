---
status: partial
phase: 39-aca-product-configuration
source: [39-VERIFICATION.md]
started: 2026-04-01T17:00:00Z
updated: 2026-04-01T17:00:00Z
---

## Current Test

number: 1
name: ACA PL group appears in Products tab
expected: |
  A labelled section 'ACA PL Products' renders below the AD&D group, with the info-blue type badge and color bar on each card
awaiting: user response

## Tests

### 1. ACA PL group appears in Products tab
expected: A labelled section 'ACA PL Products' renders below the AD&D group, with the info-blue type badge and color bar on each card
result: [pending]

### 2. ACA PL edit form shows only flat commission
expected: A single 'Flat Commission ($ per member)' input is the only commission field visible; the Type selector is disabled and shows 'ACA PL'
result: [pending]

### 3. Flat commission edit persists after refresh
expected: The updated flat commission dollar amount persists after refresh (value round-trips through API and Prisma)
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
