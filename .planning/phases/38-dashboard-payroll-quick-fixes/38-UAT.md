---
status: testing
phase: 38-dashboard-payroll-quick-fixes
source: [38-01-SUMMARY.md, 38-02-SUMMARY.md]
started: 2026-04-06T15:00:00Z
updated: 2026-04-06T15:00:00Z
---

## Current Test

number: 1
name: Audit tab shows recent audits after quiet period
expected: |
  Open Manager dashboard → Audits tab. Even if no calls happened in the last 24 hours, the audit list should show the most recent 30 audits (not be empty). Scroll down and you should see up to 30 entries on initial load.
awaiting: user response

## Tests

### 1. Audit tab shows recent audits after quiet period
expected: Open Manager dashboard → Audits tab. Even if no calls happened in the last 24 hours, the audit list should show the most recent 30 audits (not be empty). Scroll down and you should see up to 30 entries on initial load.
result: [pending]

### 2. Per-agent audit filter shows recent audits
expected: On the Audits tab, select a specific agent from the filter dropdown. The list should show up to 30 audits for that agent regardless of when they occurred — not limited to the last 24 hours.
result: [pending]

### 3. Sparkline trend lines render with data
expected: Open Manager dashboard → Performance Tracker. The 7-day sparkline charts next to each lead source should show solid polyline data (colored lines with actual data points), not dashed "no data" placeholder lines.
result: [pending]

### 4. Analytics section starts expanded
expected: Open Manager dashboard → scroll to "Lead Source Timing Analytics" section. It should already be expanded (visible charts/heatmap) without needing to click the header to expand it.
result: [pending]

### 5. Enrollment fee $0 parsed correctly from receipt
expected: On Manager Sale Entry, paste a receipt that contains "Enrollment $0.00". After parsing, the Enrollment Fee field should show "0.00" (not be empty). The half-commission badge should appear in the commission preview, and the Approve/Submit button should be visible.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
