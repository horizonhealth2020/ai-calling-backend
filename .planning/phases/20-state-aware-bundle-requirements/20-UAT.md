---
status: testing
phase: 20-state-aware-bundle-requirements
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md, 20-04-SUMMARY.md, 20-05-SUMMARY.md]
started: "2026-03-23T20:30:00Z"
updated: "2026-03-23T20:30:00Z"
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server/service. Run `npm install` from monorepo root, then `npm run db:migrate` to apply the new bundle_requirements migration. Start the API with `npm run ops:dev`. Server boots without errors on port 8080. Hit `GET /api/products` — returns 200 with product data including `requiredBundleAddon`, `fallbackBundleAddon`, and `stateAvailability` fields.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Run `npm install` from monorepo root, then `npm run db:migrate` to apply the new bundle_requirements migration. Start the API with `npm run ops:dev`. Server boots without errors on port 8080. Hit `GET /api/products` — returns 200 with product data including `requiredBundleAddon`, `fallbackBundleAddon`, and `stateAvailability` fields.
result: [pending]

### 2. US State Dropdown on Sales Entry
expected: Open manager dashboard sales entry form. The "Member State" field should be a dropdown (not free-text input) with 51 options in "XX - State Name" format (e.g., "FL - Florida"). Default shows "Select state...". Selecting a state sets the 2-char code as the value.
result: [pending]

### 3. Commission Preview with State
expected: On sales entry, select a CORE product that has a requiredBundleAddon configured. Select a US state. Click preview. The preview response should show the commission amount and a `halvingReason` if the required addon is missing or unavailable in that state. If the required addon IS included in the sale, halvingReason should be null and commission should be full.
result: [pending]

### 4. Bundle Requirements Config on CORE Products
expected: Open payroll Products tab. Click edit on a CORE product. A collapsible "Bundle Requirements" section should appear. It contains a "Required Addon for Full Commission" dropdown (lists active ADDON/AD_D products) and a "Fallback Addon" dropdown (excludes the selected required addon). Saving persists the selection.
result: [pending]

### 5. State Availability Config on ADDON Products
expected: Open payroll Products tab. Click edit on an ADDON or AD_D product. A collapsible "State Availability" section appears showing "N/51" in the header. Contains a search box, Select All/Clear All buttons, and a grid of 51 US state checkboxes. Checking states and saving persists them. Re-opening the card shows the saved states checked.
result: [pending]

### 6. Completeness Indicator on CORE Products
expected: After configuring a CORE product with a required addon (Test 4), view the CORE product card in non-edit mode. If the required addon doesn't cover all 51 states, a warning like "X states uncovered" should appear. If it covers all states, "All states covered" should show instead.
result: [pending]

### 7. Halving Reason on Payroll Entries
expected: After a sale is submitted where the commission was halved (required addon missing/unavailable for that state), open the payroll dashboard. Expand a payroll period containing that sale. The entry should show an italic amber warning text below the payout amount indicating the halving reason (e.g., "Required addon not included" or "Required addon not available in XX").
result: [pending]

### 8. Role Selector Collapse Delay
expected: On any dashboard, hover over the role selector navigation. Move the mouse away from it. The role selector should NOT collapse immediately — there should be a ~400ms delay before it closes. Moving the mouse back within that window should cancel the collapse.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

[none yet]
