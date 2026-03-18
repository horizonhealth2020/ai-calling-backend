---
status: resolved
phase: 15-resolution-polish
source: [15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md]
started: 2026-03-18T17:30:00Z
updated: 2026-03-18T18:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running ops-api server and CS dashboard dev server. Run `npm run db:migrate` then start both servers. Server boots without errors, migration completes, and hitting GET /chargebacks/totals returns JSON with totalRecovered field.
result: pass

### 2. Resolve a Chargeback
expected: On the CS Dashboard Tracking tab, click "Resolve" on any chargeback row. An expandable panel opens below the row with a resolution type selector (Recovered / Closed) and a note textarea. Select a type, enter a note, click "Save Resolution". The row dims (opacity), shows a resolution badge, displays resolved_by name, resolved_at timestamp, and the resolution note. A success toast appears.
result: pass

### 3. Unresolve a Chargeback
expected: On a resolved (dimmed) chargeback row, click "Unresolve". The row immediately restores to full opacity, the resolution badge and metadata disappear, and a success toast confirms the action. No confirmation dialog appears (lightweight action).
result: pass

### 4. Resolve a Pending Term
expected: On the pending terms tracking table, click "Resolve" on any row. Expandable panel opens with type selector (Saved / Cancelled) and note textarea. Save resolution. Row dims with badge and metadata displayed. Success toast appears.
result: pass

### 5. Status Pill Toggle - Chargebacks
expected: Above the chargeback tracking table, a pill toggle shows Open / Resolved / All. Default is "Open" (only unresolved records shown). Click "Resolved" — only resolved (dimmed) records show. Click "All" — both resolved and unresolved records show. Click "Open" — back to unresolved only.
result: pass

### 6. KPI Counters Independent of Status Filter
expected: Note the KPI counter values (Total Chargebacks, Total Recovered, etc.) at the top. Toggle the status pills between Open, Resolved, and All. The KPI counter values do NOT change — they always reflect the full dataset regardless of filter.
result: pass

### 7. Total Recovered KPI Value
expected: The Total Recovered KPI card shows a dollar amount calculated from chargebacks with resolutionType="recovered" only (not "closed"). If you resolve a chargeback as "Recovered" and refresh, the Total Recovered value increases by that chargeback's amount.
result: issue
reported: "it does but why does it require a refresh when other kpi auto update"
severity: major

### 8. CS Role - Tracking Tab Only
expected: Log in as a CUSTOMER_SERVICE user. Only the "Tracking" tab is visible in the navigation. The "Submissions" tab is hidden. Navigating directly to a submissions route does not show submissions content.
result: issue
reported: "FAIL. created service user cant login went to edit user an got a td is not defined error"
severity: blocker

### 9. CS Role - No Delete or Export
expected: As a CUSTOMER_SERVICE user on the Tracking tab, the delete button and CSV export button are not visible. Only Resolve/Unresolve actions are available on each row.
result: skipped
reason: Blocked by Test 8 — CS login not working

### 10. Owner/Admin - Both Tabs
expected: Log in as an OWNER_VIEW or SUPER_ADMIN user. Both "Submissions" and "Tracking" tabs are visible and accessible. Delete and export buttons are present.
result: pass

### 11. Pending Terms Flat Table
expected: The pending terms tracking table displays all records in a flat list (no agent grouping/collapsible sections). Each row is directly visible without expanding any group.
result: pass

### 12. Dollar Formatting Consistency
expected: Across all dashboards (CS, Manager, Payroll, Sales Board, Owner), all dollar amounts display with a $ prefix, comma thousands separators, and exactly 2 decimal places (e.g., $1,234.56). Check at least 2 different dashboards.
result: pass

### 13. Date Formatting Consistency
expected: Across all dashboards, dates display in M/D/YYYY format (e.g., 3/18/2026, not 03/18/2026 or March 18, 2026). Check at least 2 different dashboards.
result: pass

## Summary

total: 13
passed: 10
issues: 2
pending: 0
skipped: 1

## Gaps

- truth: "Total Recovered KPI updates automatically after resolving a chargeback as Recovered, without requiring a page refresh"
  status: resolved
  reason: "User reported: it does but why does it require a refresh when other kpi auto update"
  severity: major
  test: 7
  root_cause: "handleResolveCb and handleUnresolveCb never re-fetch /api/chargebacks/totals after successful PATCH — handleDeleteCb does this but resolve/unresolve handlers were missing it"
  artifacts:
    - path: "apps/cs-dashboard/app/page.tsx"
      issue: "handleResolveCb missing totals re-fetch after successful resolve"
    - path: "apps/cs-dashboard/app/page.tsx"
      issue: "handleUnresolveCb missing totals re-fetch after successful unresolve"
  missing:
    - "Add totals re-fetch (authFetch + setTotals) after successful PATCH in handleResolveCb"
    - "Add totals re-fetch after successful PATCH in handleUnresolveCb"
- truth: "CUSTOMER_SERVICE user can log in and see only the Tracking tab"
  status: resolved
  reason: "User reported: FAIL. created service user cant login went to edit user an got a td is not defined error"
  severity: blocker
  test: 8
  root_cause: "Two bugs: (1) CS_DASHBOARD_URL env var missing from auth-portal config — login succeeds but dashboard card goes nowhere. (2) TD style constant referenced but never defined in owner-dashboard edit mode — throws ReferenceError when editing any user."
  artifacts:
    - path: "apps/auth-portal/app/landing/page.tsx"
      issue: "CS_DASHBOARD_URL defaults to empty string when env var not set"
    - path: "apps/owner-dashboard/app/page.tsx"
      issue: "TD style constant used in edit-mode td but never defined"
    - path: "apps/owner-dashboard/app/page.tsx"
      issue: "ROLES array and ROLE_COLORS missing CUSTOMER_SERVICE entry"
  missing:
    - "Add CS_DASHBOARD_URL to auth-portal .env.example"
    - "Add TD style constant to owner-dashboard"
    - "Add CUSTOMER_SERVICE to ROLES array and ROLE_COLORS map"
