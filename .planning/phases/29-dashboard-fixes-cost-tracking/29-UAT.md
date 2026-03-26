---
status: testing
phase: 29-dashboard-fixes-cost-tracking
source: [29-01-SUMMARY.md, 29-02-SUMMARY.md, 29-03-SUMMARY.md, 29-04-SUMMARY.md]
started: 2026-03-25T21:40:00Z
updated: 2026-03-25T21:40:00Z
---

## Current Test

number: 1
name: Premium Column Shows Core + Addon
expected: |
  In the Manager dashboard, Agent Sales tab, each sale row's Premium column shows the total premium (core product + all addon premiums combined), not just the core product premium alone.
awaiting: user response

## Tests

### 1. Premium Column Shows Core + Addon
expected: In the Manager dashboard, Agent Sales tab, each sale row's Premium column shows the total premium (core product + all addon premiums combined), not just the core product premium alone.
result: [pending]

### 2. Lead Source Create Form Has Buffer Field
expected: In Manager Config, when adding a new lead source, the form includes a "Buffer (s)" number input field alongside Name, CRM List ID, and Cost Per Lead. Saving a new lead source with a buffer value persists it to the database.
result: [pending]

### 3. Lead Source POST API Accepts Buffer
expected: Creating a lead source via the API (POST /api/lead-sources) accepts a callBufferSeconds integer field. Omitting it defaults to 0.
result: [pending]

### 4. Products Section Is Read-Only
expected: In Manager Config, the Products section shows a table with Product Name, Type, Commission Rate, and Bundle Config columns. There are no Add, Edit, or Delete buttons — the section is purely informational.
result: [pending]

### 5. Convoso Poller Writes ConvosoCallLog Records
expected: When Convoso polling is enabled and runs a cycle, individual call records appear in the ConvosoCallLog database table (not just AgentCallKpi snapshots). Running multiple cycles does not create duplicate records.
result: [pending]

### 6. Cost Per Sale Shows in Manager Tracker
expected: In Manager Tracker tab, each agent row shows a "Lead Spend" column (total lead cost from Convoso calls) and a "Cost / Sale" column. When Convoso is not configured, both show "—". When configured but no data, Lead Spend shows "$0.00" and Cost/Sale shows "—".
result: [pending]

### 7. Cost Per Sale Shows in Owner Dashboard
expected: In Owner Dashboard agent leaderboard, each agent row shows "Lead Spend" and "Cost / Sale" columns with the same three-state display logic as the Manager Tracker.
result: [pending]

### 8. CS Resolved Log Tab Visible to Owners
expected: In the CS dashboard, OWNER_VIEW and SUPER_ADMIN users see a "Resolved Log" tab. CUSTOMER_SERVICE users do NOT see this tab.
result: [pending]

### 9. Resolved Log Shows Chargebacks and Pending Terms
expected: The Resolved Log tab displays a unified table showing all resolved chargebacks and pending terms. Each row shows Type (badge), Agent, Member, Resolution Date, Resolved By, Resolution Note, and Original Amount. Sorted by resolution date (most recent first).
result: [pending]

### 10. Resolved Log Filters Work
expected: The Resolved Log has filter controls: Type dropdown (All Types / Chargebacks / Pending Terms), date range picker, and agent search. Selecting filters narrows the displayed results accordingly.
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps

[none yet]
