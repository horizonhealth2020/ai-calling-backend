---
status: complete
phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no
source: [45-VERIFICATION.md]
started: 2026-04-07T00:00:00Z
updated: 2026-04-07T17:00:00Z
---

## Current Test

[testing complete — round 2 all passed]

## Tests

### 1. ACA unified row renders on payroll dashboard
expected: Submit Complete Care Max + addon + ACA checkbox (memberCount=2). Payroll dashboard shows ONE row with core badge + addon badge + ACA badge, commission as flat dollar (no `x N members =` text).
result: pass
round_1: failed — fold dropped ACA child commission, leaving $48.99 instead of $58.99
round_2: pass — visible $58.99 on Malik's aca test row; ACA renders as its own product chip showing the child product name with $10
closed_by: 94234e0 (45-04 two-pass fold) + aeef119 (chip rendering) + 39e2d1d (chip uses real product name)

### 2. Lock → unlock → edit front → re-lock carryover cycle
expected: Lock period with frontedAmount=200 → next period Fronted Hold=200. Unlock → next period Fronted Hold=0, app_audit_log shows REVERSE_CARRYOVER. Edit front to 300, re-lock → next period Fronted Hold=300.
result: pass
round_1: failed — first-lock wrote hold to source period (N) instead of N+1 due to DST/UTC day-rollover boundary
round_2: pass — user confirmed "2 front pass"; CARRY-11 regression test green
closed_by: ae4c368 (weekStart + 7d12h offset) + 356d348 (CARRY-11 test)

### 3. CS round-robin cursor stability under paste/refresh
expected: Query `cs_round_robin_chargeback_index` value. Paste 5 rows in CS Submissions, refresh, paste again — value unchanged. Submit batch of 5 → value increases by exactly 5 (mod repCount).
result: pass
round_1: passed (no round 2 needed)

### 4. ACA unified row in agent sales tracking view
expected: Submit Complete Care Max + addon + ACA checkbox. Agent sales tracking view shows ONE entry for the parent sale, with ACA visible as a second product on the row.
result: pass
round_1: failed — view rendered two separate rows ("ACA test / Complete Care Max" and "ACA test / Blue Cross Blue Shield $0")
round_2: pass — single row, Product cell renders "Complete Care + {child product name}", "4 sales" badge unchanged
closed_by: 9a6cb62 (45-06 fold) + aeef119 (acaAttached marker + suffix) + 39e2d1d (real product name)

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

<!-- All gaps closed in round 2 (2026-04-07). See "closed_by" on each test above. -->

### GAP-45-01: ACA child commission lost during client-side fold
test: 1
plan: 45-01
status: failed
component: PayrollPeriods.tsx fold pre-pass
expected: Folded parent row's commission equals (parent commission + ACA child commission)
actual: Folded parent row shows only parent commission; ACA child's commission is dropped when its row is removed
hypothesis: The `useMemo` fold at PayrollPeriods.tsx:151 marks `acaAttached: true` on the parent and filters out the ACA child entry, but does not add the child's `payoutAmount` (or whichever commission field) to the parent's commission total before the filter
fix_direction: Inside the fold pre-pass, when attaching the ACA child to its parent, add the child's commission/payout amount to the parent's commission total (and possibly preserve a breakdown for tooltips). Also confirm WeekSection.tsx renders the merged total, not just `parent.payoutAmount`. Verify the same fix applies to PayrollExports.tsx.

### GAP-45-02: Carryover written to source period instead of next period
test: 2
plan: 45-02
status: failed
component: carryover.ts executeCarryover (or upstream "next period" lookup)
expected: Locking period N with FRONTED=200 creates an AgentPeriodAdjustment with FRONTED HOLD=200 on period N+1
actual: The hold appears on period N itself (same week), labeled "Carried from prev week" — first-lock Path B which research said was intact and tested
hypothesis: Either (a) Plan 45-02's changes to executeCarryover (carryoverAmount column write) introduced a regression in the period selection, or (b) the "next period" lookup was already broken in the user's environment and the existing CARRY-01..CARRY-07 tests don't catch it because they mock periods. The "Carried from prev week" label on the SAME period suggests the upsert is targeting the source period's adjustment row instead of the next period's row.
fix_direction: 
  1. Re-read carryover.ts executeCarryover and trace which period the upsert targets
  2. Check whether the test suite actually exercises the period-N+1 lookup with real period IDs vs mocks
  3. Add a regression test that exercises two real consecutive periods and asserts the hold lands on the later period
  4. Confirm reverseCarryover targets the correct period as well (this gap may also affect Test 2's full unlock/re-lock cycle)
  5. Verify the "Carried from prev week" label logic — it may itself be misleading and need a separate fix

### GAP-45-03: Agent sales tracking view shows ACA parent + child as two separate rows
test: 4
plan: 45-01
status: failed
component: Agent sales tracking list (manager/sales view, NOT covered by Plan 45-01 which only touched payroll surface)
expected: Agent sales tracking list folds the ACA covering child into the parent row, same way payroll fold does. "4 sales" badge should reflect logical sale count (3), not raw row count
actual: Two separate rows render — parent ("ACA test (686905239) / Complete Care Max / $139.98") and ACA child ("ACA test / Blue Cross Blue shield / $0.00") — and the agent header shows "4 sales" instead of 3
hypothesis: Plan 45-01 scope was limited to the payroll dashboard surface (PayrollPeriods.tsx, WeekSection.tsx, PayrollExports.tsx). The agent sales tracking view is rendered by a different component that fetches sales directly and was not updated. The same `acaCoveringSaleId` field is now surfaced by the API (per Plan 45-01 Task 2) so the data is available — only the client-side fold needs to be applied.
fix_direction:
  1. Locate the agent sales tracking component (likely apps/ops-dashboard/app/(dashboard)/manager/* or sales/*)
  2. Confirm the sales API endpoint it uses surfaces `acaCoveringSaleId` (extend the select if not — mirror the change from 45-01 Task 2 in routes/payroll.ts)
  3. Apply a parallel fold pre-pass: group ACA child sales under their parent by `acaCoveringSaleId`, drop the child row, optionally add an ACA badge or member-count indicator on the parent
  4. Update the "N sales" header count to reflect post-fold count
  5. Check whether any other surfaces (exports, reports, top earner badge math) consume the same sales list and need the same treatment

