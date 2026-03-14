---
status: diagnosed
phase: 01-sales-entry-fix
source: 01-01-SUMMARY.md
started: 2026-03-14T21:00:00Z
updated: 2026-03-14T21:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sale Creation Without 500 Error
expected: Fill out the sale form on the manager dashboard (agent, product, date, member name, premium). Click submit. You should receive a green success message — no 500 error, no red error bar.
result: issue
reported: "internal server error"
severity: blocker

### 2. Sale Persisted with Correct Fields
expected: After creating a sale, refresh the page. The sale should appear in the sales list with the correct agent name, product, date, and premium amount.
result: issue
reported: "sale entry failed"
severity: blocker

### 3. memberState Persisted
expected: Create a sale with the Member State field set to "FL". After submission, the sale is saved. Query the database or check that the FL exemption logic can read the value (no error on commission calculation).
result: issue
reported: "fail"
severity: blocker

### 4. Error Message Display
expected: Try to submit a sale with missing required fields (e.g., no agent selected). A red alert bar should appear above the form showing a friendly error message with the HTTP status code. The error should persist until you fix the issue and resubmit. The form data should NOT be cleared.
result: issue
reported: "agent is always selected. the drop down does not start with a clear form."
severity: minor

### 5. Success Message and Auto-Dismiss
expected: Submit a valid sale. A green success bar with a checkmark icon should appear above the form. The form should clear to blank. After approximately 5 seconds, the green bar should automatically disappear.
result: issue
reported: "sale submitted succesful but agent name in sales tracker does not match agent in drop down menu for sale entry"
severity: major

### 6. Sales List Auto-Refresh
expected: After successfully submitting a sale, the sales list below the form should update to include the new sale without needing to manually refresh the page.
result: issue
reported: "yes but wrong date. today is 3/13/2026 submit date show 3/13/2026 in tracker"
severity: major

## Summary

total: 6
passed: 0
issues: 6
pending: 0
skipped: 0

## Gaps

- truth: "Sale creation completes without 500 error"
  status: failed
  reason: "User reported: internal server error"
  severity: blocker
  test: 1
  root_cause: "Migration 20260314_add_sale_addon_premium not deployed to database. Prisma client expects premium column on sale_addons but DB doesn't have it. Also: duplicate addonProductIds from receipt parsing can violate @@unique constraint, and upsertPayrollEntryForSale has no try/catch so any commission calc failure kills the request."
  artifacts:
    - path: "prisma/migrations/20260314_add_sale_addon_premium/migration.sql"
      issue: "Migration not applied to running database"
    - path: "apps/ops-api/src/routes/index.ts"
      issue: "Lines 307-309: no deduplication of addonProductIds; line 312: no try/catch on upsertPayrollEntryForSale"
    - path: "apps/ops-api/src/services/payroll.ts"
      issue: "Lines 128-131: include addons query fails if premium column missing"
  missing:
    - "Apply migration: npx prisma migrate deploy"
    - "Deduplicate addonProductIds before creating SaleAddons"
    - "Wrap upsertPayrollEntryForSale in try/catch to prevent sale creation failure from payroll errors"

- truth: "Sale is persisted in database with correct fields"
  status: failed
  reason: "User reported: sale entry failed"
  severity: blocker
  test: 2
  root_cause: "Same root cause as Test 1 — sale creation fails at upsertPayrollEntryForSale due to missing migration or addon dedup issue."
  artifacts: []
  missing: []

- truth: "memberState persisted and FL exemption logic works"
  status: failed
  reason: "User reported: fail"
  severity: blocker
  test: 3
  root_cause: "Depends on sale creation succeeding (Test 1). memberState field IS on the Prisma schema and wired correctly — the failure is upstream."
  artifacts: []
  missing: []

- truth: "Agent dropdown starts with no selection, allowing validation error test"
  status: failed
  reason: "User reported: agent is always selected. the drop down does not start with a clear form."
  severity: minor
  test: 4
  root_cause: "Default agentId set to agents[0].id on fetch (line 674). No placeholder option in <select> (lines 883-892). Form always has a pre-selected agent."
  artifacts:
    - path: "apps/manager-dashboard/app/page.tsx"
      issue: "Line 674: setForm({ agentId: a[0]?.id }) — pre-selects first agent. Lines 883-892: no placeholder <option>."
  missing:
    - "Add placeholder <option value=''>Select agent...</option>"
    - "Initialize agentId to empty string instead of first agent ID"

- truth: "Agent name in sales tracker matches agent selected in form"
  status: failed
  reason: "User reported: sale submitted succesful but agent name in sales tracker does not match agent in drop down menu for sale entry"
  severity: major
  test: 5
  root_cause: "Default agentId comes from unfiltered agent list (includes inactive agents, line 674: a[0]?.id from ?all=true fetch) but dropdown only shows active agents (line 889: agents.filter(a => a.active !== false)). If agents[0] is inactive, form.agentId holds inactive agent's ID while dropdown visually shows first active agent. No placeholder option makes the mismatch invisible."
  artifacts:
    - path: "apps/manager-dashboard/app/page.tsx"
      issue: "Line 667: fetches with ?all=true (inactive included). Line 674: default from unfiltered list. Line 889: dropdown filters to active only."
  missing:
    - "Filter agents to active-only before setting default agentId"
    - "Add placeholder <option> so user must explicitly select"
    - "Or: use same active filter consistently for both default and dropdown"

- truth: "Sale date in tracker matches the date entered in the form"
  status: failed
  reason: "User reported: yes but wrong date. today is 3/13/2026 submit date show 3/13/2026 in tracker"
  severity: major
  test: 6
  root_cause: "UTC timezone shift on date display. API stores saleDate as UTC midnight (new Date('2026-03-13') = 2026-03-13T00:00:00Z). Display uses new Date(s.saleDate).toLocaleDateString() which in US timezones shifts to previous day. Line 1251 already has a T12:00:00 workaround for day-of-week filter but line 1323 display does not."
  artifacts:
    - path: "apps/ops-api/src/routes/index.ts"
      issue: "Line 304: new Date(parsed.saleDate) creates UTC midnight from date-only string"
    - path: "apps/manager-dashboard/app/page.tsx"
      issue: "Line 1323: new Date(s.saleDate).toLocaleDateString() shifts day in western timezones"
  missing:
    - "Fix display: use toLocaleDateString(undefined, { timeZone: 'UTC' }) or extract date portion from ISO string"
    - "Fix API: append T12:00:00 to saleDate before creating Date object (matches existing pattern at line 1251)"
