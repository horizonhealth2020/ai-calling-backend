---
phase: 46
plan: 3
plan_id: 46-03
subsystem: ops-dashboard / payroll alerts
tags: [chargeback, alerts, ui, payroll, collapse]
dependency_graph:
  requires:
    - 46-02 (alerts pipeline must work for the badge count to be meaningful)
  provides:
    - Collapsed Chargebacks (N) badge in payroll period header
    - Inline expand panel reusing existing approve / clear handlers
  affects:
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
tech_stack:
  added: []
  patterns:
    - "useState boolean toggle for inline collapse/expand (no modal)"
key_files:
  created:
    - .planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-03-SUMMARY.md
  modified:
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
decisions:
  - "Plan said file was PayrollChargebacks.tsx but the alerts UI actually lives in PayrollPeriods.tsx — corrected during execution"
  - "ProductChipRow extraction skipped: current Alert payload has only flat agentName/customerName/amount fields with no joined sale/product data. Adding chips would require a server-side payload extension that is out of this plan's scope (it would need POST /api/alerts to include sale.product/sale.addons)"
  - "Action button mismatch: plan said approve/dismiss/clawback (3 buttons); existing UI has only Approve Alert and Clear Alert (2 buttons). Existing handlers were preserved as-is — no new buttons invented"
  - "Default collapsed (per D-12): showChargebacks defaults to false even when N === 1"
metrics:
  duration: ~10m
  completed: 2026-04-07
  tasks_completed: 1 of 2
  checkpoint_pending: human-verify (Task 2)
---

# Phase 46 Plan 03: Minimized Chargeback Alert Badge

The previously always-visible chargeback alert table is now collapsed into a single `Chargebacks (N)` button that expands the table inline on click. The whole section is hidden when there are no alerts.

## Tasks Completed

### Task 1: Collapsed badge + inline expand
**Commit:** `b433893`
**Files:** `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx`

- Added `const [showChargebacks, setShowChargebacks] = useState(false)` next to the existing alert state
- Replaced the always-visible `Chargeback Alerts` label + count chip with a styled button reading `Chargebacks (N) (click to expand|collapse)`
- Wrapped the existing alert table in `{showChargebacks && (...)}` so the full table renders inline below the button only when expanded
- Removed the empty-state copy ("No pending alerts...") since the entire section is now hidden when `alerts.length === 0`
- Existing approve / clear handlers, period-selection logic, Socket.IO subscription, and highlight glow all preserved unchanged

## Verification

- `grep -q 'Chargebacks (' apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` → match
- `grep -q 'showChargebacks' apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` → match
- No Tailwind / className utility classes introduced
- Inline `React.CSSProperties` only

## Deviations from Plan

1. **File path correction**: plan referenced `PayrollChargebacks.tsx`, actual file is `PayrollPeriods.tsx` (PayrollChargebacks is the chargeback creation form on a separate tab)
2. **No ProductChipRow extraction**: alert payload has no joined sale/product data, so chips would require server-side work outside this plan's scope. Documented for follow-up if needed
3. **Two action buttons not three**: existing UI has Approve Alert and Clear Alert; the plan's "approve/dismiss/clawback" three-button shape doesn't match the current data model. Existing handlers preserved as-is

## Task 2: Human verification — DEFERRED CHECKPOINT

Verification steps:
1. Period with 3+ open chargebacks → header shows single `Chargebacks (3)` button, table is collapsed
2. Click button → table expands inline (NOT a modal)
3. Period with 1 chargeback → button reads `Chargebacks (1)`, default collapsed
4. Period with 0 chargebacks → no badge or container shown at all
5. Approve a chargeback while expanded → action still works end-to-end
6. CS-submitted chargeback (via 46-02 fix) → count includes it after Socket.IO push

## Self-Check: PASSED (Task 1 done; Task 2 deferred per checkpoint protocol)
