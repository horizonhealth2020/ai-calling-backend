---
status: testing
phase: 15-resolution-polish
source: [15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md]
started: 2026-03-18T17:30:00Z
updated: 2026-03-18T17:30:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running ops-api server and CS dashboard dev server. Run `npm run db:migrate` then start both servers (`npm run ops:dev` and the cs-dashboard dev server). Server boots without errors, migration completes, and hitting `GET /chargebacks/totals` returns JSON with totalRecovered field.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running ops-api server and CS dashboard dev server. Run `npm run db:migrate` then start both servers. Server boots without errors, migration completes, and hitting GET /chargebacks/totals returns JSON with totalRecovered field.
result: [pending]

### 2. Resolve a Chargeback
expected: On the CS Dashboard Tracking tab, click "Resolve" on any chargeback row. An expandable panel opens below the row with a resolution type selector (Recovered / Closed) and a note textarea. Select a type, enter a note, click "Save Resolution". The row dims (opacity), shows a resolution badge, displays resolved_by name, resolved_at timestamp, and the resolution note. A success toast appears.
result: [pending]

### 3. Unresolve a Chargeback
expected: On a resolved (dimmed) chargeback row, click "Unresolve". The row immediately restores to full opacity, the resolution badge and metadata disappear, and a success toast confirms the action. No confirmation dialog appears (lightweight action).
result: [pending]

### 4. Resolve a Pending Term
expected: On the pending terms tracking table, click "Resolve" on any row. Expandable panel opens with type selector (Saved / Cancelled) and note textarea. Save resolution. Row dims with badge and metadata displayed. Success toast appears.
result: [pending]

### 5. Status Pill Toggle - Chargebacks
expected: Above the chargeback tracking table, a pill toggle shows Open / Resolved / All. Default is "Open" (only unresolved records shown). Click "Resolved" — only resolved (dimmed) records show. Click "All" — both resolved and unresolved records show. Click "Open" — back to unresolved only.
result: [pending]

### 6. KPI Counters Independent of Status Filter
expected: Note the KPI counter values (Total Chargebacks, Total Recovered, etc.) at the top. Toggle the status pills between Open, Resolved, and All. The KPI counter values do NOT change — they always reflect the full dataset regardless of filter.
result: [pending]

### 7. Total Recovered KPI Value
expected: The Total Recovered KPI card shows a dollar amount calculated from chargebacks with resolutionType="recovered" only (not "closed"). If you resolve a chargeback as "Recovered" and refresh, the Total Recovered value increases by that chargeback's amount.
result: [pending]

### 8. CS Role - Tracking Tab Only
expected: Log in as a CUSTOMER_SERVICE user. Only the "Tracking" tab is visible in the navigation. The "Submissions" tab is hidden. Navigating directly to a submissions route does not show submissions content.
result: [pending]

### 9. CS Role - No Delete or Export
expected: As a CUSTOMER_SERVICE user on the Tracking tab, the delete button and CSV export button are not visible. Only Resolve/Unresolve actions are available on each row.
result: [pending]

### 10. Owner/Admin - Both Tabs
expected: Log in as an OWNER_VIEW or SUPER_ADMIN user. Both "Submissions" and "Tracking" tabs are visible and accessible. Delete and export buttons are present.
result: [pending]

### 11. Pending Terms Flat Table
expected: The pending terms tracking table displays all records in a flat list (no agent grouping/collapsible sections). Each row is directly visible without expanding any group.
result: [pending]

### 12. Dollar Formatting Consistency
expected: Across all dashboards (CS, Manager, Payroll, Sales Board, Owner), all dollar amounts display with a $ prefix, comma thousands separators, and exactly 2 decimal places (e.g., $1,234.56). Check at least 2 different dashboards.
result: [pending]

### 13. Date Formatting Consistency
expected: Across all dashboards, dates display in M/D/YYYY format (e.g., 3/18/2026, not 03/18/2026 or March 18, 2026). Check at least 2 different dashboards.
result: [pending]

## Summary

total: 13
passed: 0
issues: 0
pending: 13
skipped: 0

## Gaps

[none yet]
