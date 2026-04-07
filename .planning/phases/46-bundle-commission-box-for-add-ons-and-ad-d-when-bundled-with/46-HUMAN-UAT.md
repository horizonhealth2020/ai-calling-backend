---
status: partial
phase: 46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with
source: [46-01-SUMMARY.md, 46-02-PLAN.md, 46-03-PLAN.md, 46-04-PLAN.md, 46-05-PLAN.md]
started: 2026-04-07
updated: 2026-04-07
---

## Current Test

[testing paused — 1 issue outstanding (Test 1 round 2)]

## Tests

### 1. (46-02) CS chargeback alert pipeline — end-to-end
expected: Submitting a chargeback from the CS dashboard surfaces a `payrollAlert` row that appears in the payroll dashboard alert area within seconds (Socket.IO `alert:created`). Approving it does NOT double-claw the agent (existing batch-created clawbacks are detected and the alert short-circuits to APPROVED).
result: issue
reported: "SUBMITTED CS CHARGEBACK NO ALERT IN PAYROLL"
severity: major
round: 2
notes: |
  Round 1 fix (GAP-46-UAT-01, commits 6c8e0f9 + c3e7b06) added observability
  (alertCount/alertAttempted/alertFailed in 201 response, structured warn/error
  logs, defensive try/catch around emitAlertCreated). Round 2 re-test still
  shows no alert surfacing in payroll dashboard after a live CS submission.
  The observability hooks should now reveal WHY (empty alertPayloads vs. per-cb
  error vs. emit failure vs. frontend not rendering). Need to inspect server
  logs and the 201 response body from the failed submission.

### 2. (46-02) Payroll-side chargeback should NOT create alert (DESIGN CORRECTION)
expected: Submitting a chargeback directly from `PayrollChargebacks.tsx` should DIRECTLY process the clawback against the agent and NOT create a payrollAlert. Payroll is the team that would have approved the alert anyway, so the alert step is redundant for payroll-originated submissions. Plan 46-02 had this inverted — the fix wired createAlertFromChargeback into the shared handler for ALL submissions, which is wrong for the payroll path.
result: pass
round: 2
notes: "Verified after GAP-46-UAT-02 (commits 8381728 + e252854) — source-aware gating works."

### 3. (46-03) Collapsed Chargebacks (N) badge — multi-alert period
expected: Navigate to a payroll period with 3+ open chargebacks. Header shows a single `Chargebacks (3)` button (collapsed by default — table is NOT visible). Click the button → table expands inline (NOT a modal popup) showing each chargeback with agent/customer/amount/date/actions.
result: pass
round: 2
notes: "Verified after GAP-46-UAT-03 (commit 6216312) — container always renders, badge collapse intact."

### 4. (46-03) Single-alert period — N=1 collapse behavior
expected: Period with exactly 1 chargeback shows `Chargebacks (1)` button, default collapsed (does NOT auto-expand).
result: pass
round: 2

### 5. (46-03) Zero-alert period
expected: Period with 0 chargebacks shows NO badge and NO container at all (the `borderLeft danger` block is hidden entirely).
result: pass
round: 2
notes: "Empty-state container with 'No chargebacks' label confirmed acceptable."

### 6. (46-03) Approve action while expanded
expected: Click `Approve Alert` from inside the expanded panel → the period selection dropdown appears, oldest open period is pre-selected, approve still works end-to-end and the alert disappears from the list.
result: pass
round: 2

### 7. (46-04) Print view ACA chip parity
expected: Open the payroll period print view via the printer icon. For an entry with `acaAttached` set (e.g., Sammy Machado's ACA-bundled core sale), the Core column shows the ACA chip inline (matching what `WeekSection.tsx:272-279` shows on screen — product name + payout amount). Standalone ACA_PL entries (e.g. Bernice King) also render with product name in Core column + ACA marker.
result: pass
round: 2
notes: |
  Verified after GAP-46-UAT-04 (commit 60de89f) — bucketKey ACA_PL→CORE remap +
  acaStandaloneHtml chip injection. Both folded (Sammy Machado) and standalone
  (Bernice King) ACA cases now render uniformly in print view.

### 8. (46-05) Single-click ACA cascade delete
expected: Sammy Machado's AD&D core sale with an attached ACA child. Click delete ONCE on the parent. Both rows disappear without a second click. Refresh — both stay deleted. Inspect the most recent `app_audit_log` DELETE Sale row → `metadata.cascadedChildSaleIds` is present and contains the ACA child's ID.
result: pass

### 9. (46-05) Non-ACA delete regression
expected: Delete a non-ACA-bundled sale → works as before. `metadata.cascadedChildSaleIds` is `[]` (empty array, not omitted). No crash.
result: pass

### 10. (46-05) Sale-with-clawbacks delete regression
expected: Delete a sale that has clawbacks + payroll entries but no ACA child → existing parent cleanup path is unchanged, transaction commits successfully.
result: pass

### 11. (46-01) ACA Bundle Commission input visibility
expected: Open Products tab → edit an ADDON product → see the `ACA Bundle Commission (%)` input alongside Bundled / Standalone / Enroll Fee. Edit an AD&D product → same. Edit a CORE product → field is NOT shown. Edit an ACA_PL product → field is NOT shown.
result: pass

### 12. (46-01) ACA bundle rate calculation
expected: Set an ADDON's `acaBundledCommission` to 50%. Create a sale that triggers ACA bundling (sale has `acaCoveringSaleId` set). Run payroll calculation → the ADDON commission equals `addon_premium * 0.50` (the new ACA rate), not the old `bundledCommission` rate. Clear the field (set to null) → recalculate → falls back to the original `bundledCommission`.
result: pass
notes: |
  Required two post-phase gap fixes to pass:
  - GAP-46-01 (commit 95ad3b8): standalone branch + per-product calc were missing
  - GAP-46-02 (commit 005d2d5): inverted relation direction — acaCoveringSaleId is on
    the ACA PL child, not the AD&D parent. Detection had to flip to acaCoveredSales.
  ACA TEST 2 confirmed: Complete Care AD&D $139.98 + linked ACA child + Blue Cross Blue
  Shield $10 → $107.99 commission = $139.98 × 0.70 + $10 × ~standalone rate.

### 13. (46-01) Display row ACA Bundle marker
expected: After setting an ADDON's `acaBundledCommission`, the product list row in the Products tab shows `· ACA Bundle: 50%` after the existing Bundled/Standalone markers. CORE products do NOT show this marker even if the value is somehow set on them.
result: pass

## Summary

total: 13
passed: 11
issues: 1
pending: 0
skipped: 0
blocked: 0
round2: tests 1-7 re-tested after gap fixes; only test 1 still failing

## Gaps

- truth: "Submitting a chargeback from the CS dashboard surfaces a payrollAlert row in the payroll dashboard alert area"
  status: failed
  round: 2
  reason: "Round 2 re-test: User reported 'SUBMITTED CS CHARGEBACK NO ALERT IN PAYROLL'. GAP-46-UAT-01 (commits 6c8e0f9 + c3e7b06) added observability (alertCount in 201 response, structured warn/error logs, defensive emit try/catch) but the underlying root cause remains — alerts still don't surface in the payroll dashboard after a live CS submission."
  severity: major
  test: 1
  root_cause: |
    DIAGNOSED (round 2 debugger): The CS chargeback submission requires each chargeback's
    memberId to exactly match exactly one Sale.memberId in the DB. When the auto-match
    produces UNMATCHED or MULTIPLE (typo, formatting, leading zeros, member with multiple
    sales), the guard at chargebacks.ts:203-204 calls `continue` and the row is skipped.
    alertPayloads stays empty, the console.warn fires server-side only (invisible to CS),
    createAlertFromChargeback is never called, and no payrollAlert row is written.

    The downstream pipeline is verified correct: createAlertFromChargeback unconditionally
    inserts (alerts.ts:6-29), payroll dashboard fetches on mount AND has socket listener
    on "alert:created" that calls fetchAlerts (page.tsx:142-219), getPendingAlerts has
    no hidden filters (alerts.ts:31-37). The bug is upstream silent match failure with
    zero CS-side feedback.

    User chose Option B: durable fix — allow CS to submit alerts for UNMATCHED/MULTIPLE
    rows too, carrying raw memberId/memberName. Payroll handles manual sale-picking in
    the approve UI.
  artifacts:
    - path: "apps/ops-api/src/routes/chargebacks.ts"
      issue: "MATCHED gate at lines 203-204 silently drops UNMATCHED/MULTIPLE rows from alertPayloads"
    - path: "apps/ops-api/src/services/alerts.ts"
      issue: "createAlertFromChargeback assumes a matched saleId exists — must handle null saleId for unmatched alerts"
    - path: "apps/ops-api/src/services/alerts.ts"
      issue: "approveAlert needs a manual sale-picker path for alerts with no matchedSaleId"
    - path: "apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx"
      issue: "Alert UI must render unmatched chargeback alerts with member info + manual sale picker in approve action"
    - path: "apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx"
      issue: "(supporting) 201 response handler at 597-603 should surface alertAttempted/alertFailed for transparency"
  missing:
    - "Push UNMATCHED/MULTIPLE rows into alertPayloads with null saleId"
    - "createAlertFromChargeback: support null saleId — store member_id/member_name as fallback identity"
    - "approveAlert: when alert has no matchedSaleId, require caller to provide a target saleId (manual pick)"
    - "Payroll dashboard chargeback container: render unmatched alerts with manual-pick affordance"
    - "Schema/migration: payrollAlert may need a nullable saleId column if it isn't already"
  debug_session: ""

- truth: "Payroll-side chargeback submissions should DIRECTLY process clawback without creating an alert (design correction)"
  status: closed
  round: 2
  closed_by: "GAP-46-UAT-02 / Plan 46-07 — commits 8381728 (server source gating), e252854 (UI submitters). Verified by user in round 2 re-test."
  reason: "User reported: THE PAYROLL CHARGEBACK SUBMISSION SHOULDNT CREATE ALERT IT SHOULD PROCESS THE CLAWBACK AGAINST THE AGENT ONCE SUBMITTED"
  severity: major
  test: 2
  root_cause: "Plan 46-02 had the design inverted. Alerts are a CS→payroll review queue, not a universal pre-clawback step. Both UI paths (CSSubmissions.tsx and PayrollChargebacks.tsx) hit the same POST /api/chargebacks handler and the fix added createAlertFromChargeback for ALL of them. Need to differentiate: CS path → create alert; payroll path → direct clawback only."
  artifacts:
    - path: "apps/ops-api/src/routes/chargebacks.ts"
      issue: "createAlertFromChargeback fires unconditionally; needs source-aware gate"
  missing:
    - "Source field on POST /api/chargebacks request body (e.g. source: 'CS' | 'PAYROLL')"
    - "Conditional createAlertFromChargeback call — only when source === 'CS'"
    - "Update CSSubmissions.tsx to send source: 'CS' in the body"
    - "Update PayrollChargebacks.tsx to send source: 'PAYROLL' in the body (or omit and default server-side)"
  debug_session: ""

- truth: "Payroll dashboard shows a chargeback area when chargebacks have been submitted"
  status: closed
  round: 2
  closed_by: "GAP-46-UAT-03 / Plan 46-08 — commit 6216312. Container now always renders with empty-state. Verified by user in round 2."
  reason: "User reported: THERE ARE CHARGEBACKS THAT HAVE BEEN SUBMITTED I SEE NO TABLE OR ALERTS IN PAYROLL"
  severity: major
  test: 3
  root_cause: "Two compounding issues: (1) Test 1 — payrollAlert rows aren't being created when CS chargebacks are submitted, so alerts.length is always 0. (2) Plan 46-03 hides the entire chargeback container when alerts.length === 0 (per the plan's empty-state spec). Combined, the user sees nothing even though the source data exists in the chargebackSubmission table."
  artifacts:
    - path: "apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx"
      issue: "{alerts.length > 0 && (...)} wrapping the chargeback container hides empty-state feedback"
  missing:
    - "Always show the chargeback container header (or at least an empty-state badge) so the user can tell whether the area is empty or whether something is broken"
    - "Underlying fix from Test 1 — actually create alerts when CS chargebacks are submitted"
  debug_session: ""

- truth: "Standalone ACA PL sales render uniformly with bundled ACA in the print view"
  status: closed
  round: 2
  closed_by: "GAP-46-UAT-04 / Plan 46-09 — commit 60de89f. bucketKey ACA_PL→CORE remap + acaStandaloneHtml chip injection. Verified by user in round 2."
  reason: "User reported: IT WORKS PROPERLY WHEN BUNDLED ACA SUBMITTED BUT STANDALONE ACA SUBMISSION ISNT UNIFORM HERES AN EXAMPLE BERNICE KING IS THE EXAMPLE"
  severity: major
  test: 7
  root_cause: "Phase 46-04's chip injection only handles entries with acaAttached set (folded ACA). Entries whose product.type === 'ACA_PL' (Bernice King's standalone ACA sale) have no Core/Add-On/AD&D product, so they render with all-dash columns in print. The print view's existing column bucket logic at PayrollPeriods.tsx printAgentCards has no case for ACA_PL as a primary product."
  artifacts:
    - path: "apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx"
      issue: "printAgentCards bucket logic doesn't render ACA_PL as a primary product on its own row"
  missing:
    - "Render ACA_PL product chip in either the Core column or a dedicated ACA column for entries where product.type === 'ACA_PL' AND acaAttached is null (standalone ACA case)"
    - "Match the screen-side rendering pattern from Phase 45 GAP-45-07 which already solved this for the screen view"
  debug_session: ""
