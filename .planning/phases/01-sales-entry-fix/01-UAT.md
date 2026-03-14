---
status: testing
phase: 01-sales-entry-fix
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md, 01-03-SUMMARY.md
started: 2026-03-14T22:00:00Z
updated: 2026-03-14T22:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running ops-api and manager-dashboard servers. Run `npm run db:migrate` then start both services (`npm run ops:dev` and `npm run manager:dev`). The API server should boot on port 8080 without errors. The manager dashboard should compile and load on port 3019. Navigate to the manager dashboard — it should render the sales entry form.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running ops-api and manager-dashboard servers. Run `npm run db:migrate` then start both services (`npm run ops:dev` and `npm run manager:dev`). The API server should boot on port 8080 without errors. The manager dashboard should compile and load on port 3019. Navigate to the manager dashboard — it should render the sales entry form.
result: [pending]

### 2. Agent Dropdown Placeholder
expected: On the manager dashboard sales entry form, the Agent dropdown should start with "Select agent..." placeholder text. No agent should be pre-selected. You must explicitly choose an agent before submitting.
result: [pending]

### 3. Sale Creation Without Error
expected: Fill out the sale form on the manager dashboard — select an agent, product, enter a date, member name, and premium amount. Click submit. You should receive a green success message with a checkmark icon above the form. No 500 error, no red error bar.
result: [pending]

### 4. Sale Appears in Tracker with Correct Agent
expected: After creating a sale, the sales tracker below the form should show the new sale. The agent name displayed in the tracker should match the agent you selected in the dropdown.
result: [pending]

### 5. Sale Date Display Accuracy
expected: After creating a sale, check the date shown in the sales tracker. It should match the date you entered in the form — no off-by-one day shift. For example, if you entered 03/14/2026, the tracker should show 03/14/2026 (not 03/13/2026).
result: [pending]

### 6. Error Feedback on Invalid Submission
expected: Try to submit a sale with the agent dropdown still on "Select agent..." (no agent chosen). A red alert bar should appear above the form showing an error message with the HTTP status code. The form data should NOT be cleared.
result: [pending]

### 7. Success Auto-Dismiss
expected: Submit a valid sale. The green success bar should appear above the form. The form should clear to blank (agent back to placeholder, fields empty). After approximately 5 seconds, the green success bar should automatically disappear.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0

## Gaps

[none yet]
