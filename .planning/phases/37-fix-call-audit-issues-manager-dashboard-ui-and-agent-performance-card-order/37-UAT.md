---
status: testing
phase: 37-fix-call-audit-issues-manager-dashboard-ui-and-agent-performance-card-order
source: [37-01-SUMMARY.md, 37-02-SUMMARY.md, 37-03-SUMMARY.md]
started: 2026-03-31T20:30:00Z
updated: 2026-03-31T20:30:00Z
---

## Current Test

number: 1
name: Performance Tracker Composite Ranking
expected: |
  Open Manager dashboard → Performance Tracker tab. Agents should be ranked by composite score (40% premium + 60% cost efficiency), NOT by raw sales count. An agent with fewer sales but higher premium and lower cost-per-sale should rank above a high-volume low-premium agent.
awaiting: user response

## Tests

### 1. Performance Tracker Composite Ranking
expected: Open Manager dashboard → Performance Tracker tab. Agents should be ranked by composite score (40% premium + 60% cost efficiency), NOT by raw sales count. An agent with fewer sales but higher premium and lower cost-per-sale should rank above a high-volume low-premium agent.
result: [pending]

### 2. Audit List Date+Time Display
expected: Open Manager dashboard → Audits tab. Each audit row should show date AND time (e.g., "3/31/2026 2:15 PM"), not just a date.
result: [pending]

### 3. Audit List Default 24h View
expected: On initial load, the Audits tab should only show audits from the last 24 hours, not the full history.
result: [pending]

### 4. Audit Agent Filter
expected: A dropdown filter appears in the Audits tab with agent names. Selecting an agent narrows the list to only that agent's audits. Selecting "All Agents" shows all.
result: [pending]

### 5. Audit Load More Pagination
expected: If more than 25 audits exist, a "Load More Audits" button appears at the bottom. Clicking it appends older audits below the existing ones without replacing them.
result: [pending]

### 6. ACA Panel in Right Column
expected: In Manager Entry, the ACA section appears in the right column just below the commission preview panel. It has a checkbox "Include ACA Plan" and a Bundled/Standalone toggle.
result: issue
reported: "fail i want it just to the right of commission preview"
severity: major

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "ACA panel should appear directly below commission preview in right column"
  status: failed
  reason: "User reported: fail i want it just to the right of commission preview — currently at bottom of right column after addons"
  severity: major
  test: 6
  artifacts: ["apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx"]
  missing: []
