---
status: passed
phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca
source: [47-VERIFICATION.md, 47-01-SUMMARY.md, 47-02-SUMMARY.md, 47-03-SUMMARY.md, 47-04-SUMMARY.md, 47-05-SUMMARY.md]
started: 2026-04-07T22:30:00Z
updated: 2026-04-07T22:30:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running ops-api and ops-dashboard processes. Start both fresh
  (`npm run ops:dev` + `npm run dashboard:dev`). ops-api boots on :8080 with
  no Prisma connection errors, Flask-style startup log clean, and
  http://localhost:3000/payroll loads without a 500 — the new enum values
  (ZEROED_OUT_IN_PERIOD, CLAWBACK_CROSS_PERIOD) are live in the DB.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running ops-api and ops-dashboard processes. Start both fresh (`npm run ops:dev` + `npm run dashboard:dev`). ops-api boots on :8080 with no Prisma connection errors, and http://localhost:3000/payroll loads without a 500 — the new enum values (ZEROED_OUT_IN_PERIOD, CLAWBACK_CROSS_PERIOD) are live in the DB.
result: passed

### 2. Standalone ACA submit bypasses main form validation
expected: Open /manager, leave the main sale form empty, fill the standalone ACA section (member count, rate, etc.), click "Submit ACA Entry". The form submits the ACA entry without any browser `required` validation popup from the main sale form. Filling the main sale form and submitting still works (no regression to regular sale flow).
result: passed

### 3. PayrollPeriods chrome compression visible at 1920x1080
expected: Open /payroll at 1920x1080. The first AgentCard's top edge is visible above the fold without scrolling. All 6 StatMini KPIs (including Net Payout) still visible. Chargebacks (N) badge, Lock/Unlock, Export, Print buttons still present.
result: passed

### 4. Chargeback lookup shows agent + live net deduction
expected: Open /payroll → Chargebacks tab → Single Chargeback Lookup. Look up a sale by policy/member. Result card shows agent name, member name, premium, enrollment fee, and per-product commission amounts. Toggling product checkboxes updates the Net Chargeback line in real time — no server round-trip per toggle. Final Net Chargeback matches what server will actually deduct.
result: passed (bug found: fullPayout=0 due to missing orderBy — fixed in bcc24ab; also fixed Enter-key auto-submit)

### 5. Payroll row editor: ACA_PL uses Member Count input
expected: Open /payroll → any week → edit a sale row. Add ACA_PL from the addon dropdown. The field swaps from Premium ($) to Member Count (#) — integer input. Save. Confirm a child sale was created linked to the parent, the parent's PayrollEntry was recomputed with ACA-bundled rates, and the edit grid now shows a removable ACA child row with an X button. Click X + save → child sale deleted, parent recomputed.
result: passed

### 6. Cross-period chargeback against LOCKED period
expected: Submit a chargeback against a sale whose PayrollEntry is in a LOCKED/FINALIZED period. A NEW PayrollEntry appears in the OLDEST OPEN period with status CLAWBACK_CROSS_PERIOD, payoutAmount=0, adjustmentAmount=-(amount), and an ORANGE row highlight in WeekSection. The original locked entry is untouched.
result: passed (commission amount bug found during test — product fields missing from lookup query, fixed in 4bc14cf)

### 7. In-period chargeback (open period)
expected: Submit a chargeback against a sale whose PayrollEntry is in an OPEN period. The original PayrollEntry is zeroed in place (payoutAmount=0) with status ZEROED_OUT_IN_PERIOD and a YELLOW row highlight appears in WeekSection. Legacy CLAWBACK_APPLIED red highlight still works for historical rows.
result: passed

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
