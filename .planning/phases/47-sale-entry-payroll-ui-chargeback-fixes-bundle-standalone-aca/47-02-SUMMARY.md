---
phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca
plan: 02
subsystem: ops-dashboard/payroll
tags: [ui, payroll, spacing, compression]
one_liner: "Compressed PayrollPeriods top chrome (StatMini + summary strip + chargeback banner) so pay cards dominate at 1080p without scrolling"
requires: []
provides:
  - Compressed StatMini padding (8px 12px) and tighter summary strip spacing
  - Pay cards visible above the fold on 1920x1080 per D-04/D-07
affects:
  - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
tech_stack_added: []
patterns:
  - Inline React.CSSProperties spacing adjustments using existing S[] tokens
key_files_created: []
key_files_modified:
  - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
decisions:
  - Kept all 6 StatMini cards (shrunk, not removed) to preserve D-06 visibility guarantees
  - Kept expanded chargeback banner at full S[4] padding; only empty state compressed to S[3] / R.lg
  - All D-06 elements (date range, Net Payout, Lock/Unlock/Export/Print, Chargebacks badge) retained
metrics:
  duration: ~10m
  tasks_completed: 2
  files_touched: 1
  completed_date: 2026-04-07
requirements_completed: [D-04, D-05, D-06, D-07]
---

# Phase 47 Plan 02: Payroll Periods Chrome Compression Summary

## Outcome

Shrunk the chrome (chargeback banner empty state + current-week summary strip + StatMini grid) at the top of `PayrollPeriods.tsx` so that agent pay cards become the dominant visual element at 1080p resolution, per user feedback on `image.png` and requirements D-04/D-05/D-06/D-07.

## Tasks

### Task 1 — Compress StatMini + summary strip + chargeback banner padding (commit f28c484)

Applied concrete value changes per plan:

- **StatMini (lines ~46-67):** padding `14px 16px` → `8px 12px`, gap `4` → `2`, label fontSize `10` → `9` with `letterSpacing: 0.4`, value fontSize reduced to ~18px.
- **Summary strip outer container:** `marginBottom: S[5]` → `S[3]`, header `marginBottom: S[2]` → `4`, grid gap `S[3]` → `S[2]`.
- **Chargeback banner empty state:** `padding: S[4]` → `S[3]`, `borderRadius: R["2xl"]` → `R.lg`. Expanded state left at S[4] (deliberate focus state).
- All 6 StatMini cards preserved, Chargebacks (N) badge preserved, Net Payout card preserved, action buttons untouched, AgentCard rendering untouched.

Build passed (`npm run build --workspace=apps/ops-dashboard`).

### Task 2 — Human verify spacing against image.png (approved)

User visually verified against image.png at 1920x1080 and responded "approved" — no adjustments requested. Pay cards now occupy dominant vertical real estate above the fold; all D-06 elements remain visible.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-3 auto-fixes needed, no Rule 4 architectural escalations.

## Verification

- [x] Build: `npm run build --workspace=apps/ops-dashboard` exits 0
- [x] StatMini still defined and all 6 usages remain
- [x] Chargebacks (N) badge still rendered
- [x] Net Payout card still rendered
- [x] Human checkpoint approved against image.png

## Self-Check: PASSED

- FOUND: apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx (modified)
- FOUND commit: f28c484 (fix(47-02): compress PayrollPeriods top chrome to prioritize pay cards)
