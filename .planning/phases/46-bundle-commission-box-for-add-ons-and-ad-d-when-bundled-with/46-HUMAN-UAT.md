---
status: partial
phase: 46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with
source: [46-02-PLAN.md, 46-03-PLAN.md, 46-04-PLAN.md, 46-05-PLAN.md]
started: 2026-04-07
updated: 2026-04-07
---

## Current Test

[awaiting human testing]

## Tests

### 1. (46-02) CS chargeback alert pipeline — end-to-end
expected: Submitting a chargeback from the CS dashboard surfaces a `payrollAlert` row that appears in the payroll dashboard alert area within seconds (Socket.IO `alert:created`). Approving it does NOT double-claw the agent (existing batch-created clawbacks are detected and the alert short-circuits to APPROVED).
result: [pending]

### 2. (46-02) Payroll-side chargeback alert (NEW behavior)
expected: Submitting a chargeback directly from `PayrollChargebacks.tsx` ALSO produces a `payrollAlert`. This is NEW behavior — the plan originally framed this as a regression check but the diagnosis revealed the payroll-side path was never producing alerts either. Verify it now works rather than verify it's unchanged.
result: [pending]

### 3. (46-03) Collapsed Chargebacks (N) badge — multi-alert period
expected: Navigate to a payroll period with 3+ open chargebacks. Header shows a single `Chargebacks (3)` button (collapsed by default — table is NOT visible). Click the button → table expands inline (NOT a modal popup) showing each chargeback with agent/customer/amount/date/actions.
result: [pending]

### 4. (46-03) Single-alert period — N=1 collapse behavior
expected: Period with exactly 1 chargeback shows `Chargebacks (1)` button, default collapsed (does NOT auto-expand).
result: [pending]

### 5. (46-03) Zero-alert period
expected: Period with 0 chargebacks shows NO badge and NO container at all (the `borderLeft danger` block is hidden entirely).
result: [pending]

### 6. (46-03) Approve action while expanded
expected: Click `Approve Alert` from inside the expanded panel → the period selection dropdown appears, oldest open period is pre-selected, approve still works end-to-end and the alert disappears from the list.
result: [pending]

### 7. (46-04) Print view ACA chip parity
expected: Open the payroll period print view via the printer icon. For an entry with `acaAttached` set (e.g., Sammy Machado's ACA-bundled core sale), the Core column shows the ACA chip inline (matching what `WeekSection.tsx:272-279` shows on screen — product name + payout amount).
result: [pending]

### 8. (46-05) Single-click ACA cascade delete
expected: Sammy Machado's AD&D core sale with an attached ACA child. Click delete ONCE on the parent. Both rows disappear without a second click. Refresh — both stay deleted. Inspect the most recent `app_audit_log` DELETE Sale row → `metadata.cascadedChildSaleIds` is present and contains the ACA child's ID.
result: [pending]

### 9. (46-05) Non-ACA delete regression
expected: Delete a non-ACA-bundled sale → works as before. `metadata.cascadedChildSaleIds` is `[]` (empty array, not omitted). No crash.
result: [pending]

### 10. (46-05) Sale-with-clawbacks delete regression
expected: Delete a sale that has clawbacks + payroll entries but no ACA child → existing parent cleanup path is unchanged, transaction commits successfully.
result: [pending]

### 11. (46-01) ACA Bundle Commission input visibility
expected: Open Products tab → edit an ADDON product → see the `ACA Bundle Commission (%)` input alongside Bundled / Standalone / Enroll Fee. Edit an AD&D product → same. Edit a CORE product → field is NOT shown. Edit an ACA_PL product → field is NOT shown.
result: [pending]

### 12. (46-01) ACA bundle rate calculation
expected: Set an ADDON's `acaBundledCommission` to 50%. Create a sale that triggers ACA bundling (sale has `acaCoveringSaleId` set). Run payroll calculation → the ADDON commission equals `addon_premium * 0.50` (the new ACA rate), not the old `bundledCommission` rate. Clear the field (set to null) → recalculate → falls back to the original `bundledCommission`.
result: [pending]

### 13. (46-01) Display row ACA Bundle marker
expected: After setting an ADDON's `acaBundledCommission`, the product list row in the Products tab shows `· ACA Bundle: 50%` after the existing Bundled/Standalone markers. CORE products do NOT show this marker even if the value is somehow set on them.
result: [pending]

## Summary

total: 13
passed: 0
issues: 0
pending: 13
skipped: 0
blocked: 0

## Gaps
