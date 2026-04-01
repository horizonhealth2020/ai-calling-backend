---
status: partial
phase: 41-payroll-card-restructure
source: [41-VERIFICATION.md]
started: 2026-04-01T20:35:00Z
updated: 2026-04-01T20:35:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Agent-first card rendering
expected: Each agent appears as a single collapsible card; no duplicate cards for the same agent across periods
result: [pending]

### 2. Week section content and inputs
expected: Each week is a distinct collapsible row inside the agent card; inputs are functional; sales are listed without a Show More button
result: [pending]

### 3. Collapse/expand interactions
expected: Agent header click collapses/expands all week sections; week header click collapses/expands only that week
result: [pending]

### 4. Last 2 weeks expansion default
expected: On initial render the two most recent weeks per agent are open; any third or older week is collapsed
result: [pending]

### 5. Per-week print output
expected: Print popup shows agent name header followed by 'Week of MM-DD-YYYY - MM-DD-YYYY' subtitle, then financial summary and sale table
result: [pending]

### 6. Agent header summary updates on week selection
expected: Commission and Net values in the agent header change to reflect the selected week's figures when clicking different week headers
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
