---
status: diagnosed
trigger: "Investigate why creating a sale without paymentType fails but shows NO validation error to the user"
created: 2026-03-14T00:00:00Z
updated: 2026-03-14T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED - Frontend disables submit button when paymentType empty but provides no validation feedback message
test: Read form code and error display logic
expecting: Missing validation message for required paymentType
next_action: Report diagnosis

## Symptoms

expected: Validation error displayed when paymentType missing
actual: Request fails silently with no error shown - button grayed out with no explanation
errors: None shown to user
reproduction: Open sale entry form, fill all fields except paymentType, observe grayed-out button with no message
started: After Phase 03 made paymentType required

## Eliminated

- hypothesis: API not using zodErr() wrapper
  evidence: Line 299 of routes/index.ts uses zodErr(result.error) correctly
  timestamp: 2026-03-14

- hypothesis: Frontend not reading error from response
  evidence: Line 762-763 reads err.error and sets msg state correctly
  timestamp: 2026-03-14

- hypothesis: authFetch swallowing the error
  evidence: authFetch is a thin wrapper, returns raw Response, does not intercept non-ok responses
  timestamp: 2026-03-14

- hypothesis: msg state not displayed in UI
  evidence: Lines 865-882 display msg with proper error styling inside entry tab
  timestamp: 2026-03-14

## Evidence

- timestamp: 2026-03-14
  checked: apps/ops-api/src/routes/index.ts lines 279-320
  found: Sale creation Zod schema has paymentType: z.enum(["CC", "ACH"]) (required, no .optional()). zodErr() used on line 299.
  implication: API correctly validates and returns proper 400 error

- timestamp: 2026-03-14
  checked: apps/manager-dashboard/app/page.tsx lines 636-637
  found: paymentType initialized as "" in blankForm()
  implication: Default state is empty string, which is falsy

- timestamp: 2026-03-14
  checked: apps/manager-dashboard/app/page.tsx line 749
  found: paymentType sent as `form.paymentType || undefined` - empty string converts to undefined, stripped by JSON.stringify
  implication: If somehow submitted with empty paymentType, API would receive no paymentType field

- timestamp: 2026-03-14
  checked: apps/manager-dashboard/app/page.tsx lines 1008-1009
  found: Submit button has `disabled={!form.paymentType || submitting}` - button is disabled when paymentType is empty
  implication: Form CANNOT be submitted when paymentType is empty - no request is ever made

- timestamp: 2026-03-14
  checked: apps/manager-dashboard/app/page.tsx lines 962-999
  found: Payment type uses radio buttons (CC/ACH) with no way to deselect once selected. No validation message shown when unselected.
  implication: User sees grayed-out button but NO text explaining why

- timestamp: 2026-03-14
  checked: Error display logic lines 865-882
  found: msg state only set inside submitSale() which never runs when button is disabled
  implication: Error display mechanism exists but is never triggered in this scenario

## Resolution

root_cause: The submit button is disabled when paymentType is empty (line 1009) but there is NO inline validation message or visual indicator telling the user WHY submission is blocked. The button is simply grayed out (opacity 0.6) with no explanation. The error display mechanism (msg state) only activates when a request is made and fails, but the disabled button prevents the request from being made in the first place.
fix:
verification:
files_changed: []
