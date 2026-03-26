---
status: complete
phase: 29-dashboard-fixes-cost-tracking
source: [29-01-SUMMARY.md, 29-02-SUMMARY.md, 29-03-SUMMARY.md, 29-04-SUMMARY.md]
started: 2026-03-25T21:40:00Z
updated: 2026-03-25T21:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Premium Column Shows Core + Addon
expected: In the Manager dashboard, Agent Sales tab, each sale row's Premium column shows the total premium (core product + all addon premiums combined), not just the core product premium alone.
result: pass

### 2. Lead Source Create Form Has Buffer Field
expected: In Manager Config, when adding a new lead source, the form includes a "Buffer (s)" number input field alongside Name, CRM List ID, and Cost Per Lead. Saving a new lead source with a buffer value persists it to the database.
result: pass

### 3. Lead Source POST API Accepts Buffer
expected: Creating a lead source via the API (POST /api/lead-sources) accepts a callBufferSeconds integer field. Omitting it defaults to 0.
result: pass

### 4. Products Section Is Read-Only
expected: In Manager Config, the Products section shows a table with Product Name, Type, Commission Rate, and Bundle Config columns. There are no Add, Edit, or Delete buttons — the section is purely informational.
result: issue
reported: "Bundle Config column shows wrong data — always says 'Bundled with Good Health Distribution Partner' for every non-CORE product regardless of actual bundle config. Remove the Bundle Config column entirely."
severity: minor

### 5. Convoso Poller Writes ConvosoCallLog Records
expected: When Convoso polling is enabled and runs a cycle, individual call records appear in the ConvosoCallLog database table (not just AgentCallKpi snapshots). Running multiple cycles does not create duplicate records.
result: skipped
reason: No calls received since code change — table is empty but code is in place

### 6. Cost Per Sale Shows in Manager Tracker
expected: In Manager Tracker tab, each agent row shows a "Lead Spend" column (total lead cost from Convoso calls) and a "Cost / Sale" column. When Convoso is not configured, both show "—". When configured but no data, Lead Spend shows "$0.00" and Cost/Sale shows "—".
result: pass

### 7. Cost Per Sale Shows in Owner Dashboard
expected: In Owner Dashboard agent leaderboard, each agent row shows "Lead Spend" and "Cost / Sale" columns with the same three-state display logic as the Manager Tracker.
result: pass

### 8. CS Resolved Log Tab Visible to Owners
expected: In the CS dashboard, OWNER_VIEW and SUPER_ADMIN users see a "Resolved Log" tab. CUSTOMER_SERVICE users do NOT see this tab.
result: issue
reported: "Tab shows but 404 error on resolved log API. Frontend URL had wrong prefix (cs-reps/reps/ instead of reps/). Fixed in commit a98ec0a."
severity: major

### 9. Resolved Log Shows Chargebacks and Pending Terms
expected: The Resolved Log tab displays a unified table showing all resolved chargebacks and pending terms. Each row shows Type (badge), Agent, Member, Resolution Date, Resolved By, Resolution Note, and Original Amount. Sorted by resolution date (most recent first).
result: pass

### 10. Resolved Log Filters Work
expected: The Resolved Log has filter controls: Type dropdown (All Types / Chargebacks / Pending Terms), date range picker, and agent search. Selecting filters narrows the displayed results accordingly.
result: pass

## Summary

total: 10
passed: 7
issues: 2
pending: 0
skipped: 1
blocked: 0

## Gaps

- truth: "Products section should not have Bundle Config column"
  status: resolved
  reason: "User reported: Bundle Config column shows wrong data. Removed column entirely."
  severity: minor
  test: 4
- truth: "Resolved Log tab should load without 404"
  status: resolved
  reason: "User reported: 404 on resolved-log API. Frontend URL had wrong cs-reps prefix. Fixed in a98ec0a."
  severity: major
  test: 8
- truth: "Date range presets should filter resolved log results"
  status: resolved
  reason: "User reported: Last Week filter not working. Frontend not sending range param for presets. Fixed in 10dc088, refactored in d9a009b."
  severity: major
  test: 10
