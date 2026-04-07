---
phase: 46
plan: 4
plan_id: 46-P04
subsystem: payroll-print
tags: [print, aca, payroll, ui-parity]
requires:
  - "entry.acaAttached field on payroll Entry type (Phase 45 GAP-45-07)"
provides:
  - "ACA chip parity between on-screen payroll card and print view"
affects:
  - "apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx (printAgentCards)"
tech-stack:
  added: []
  patterns:
    - "Inline HTML string interpolation inside printAgentCards (matches existing prod-block pattern)"
    - "Conditional chip render guarded by entry.acaAttached truthiness"
key-files:
  created: []
  modified:
    - "apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx"
decisions:
  - "Used .prod-aca class with teal border (#0891b2) + light bg (#e0f7fa) + dark text (#0c4a5f) — readable on color and B/W per D-14"
  - "Rendered chip via concat after printProd(byType.CORE) in the Core <td>, NOT via the bucket loop — per D-15"
  - "Included .prod-aca-amt span showing the ACA payout amount, mirroring WeekSection.tsx line 277 which shows the acaAttached.payoutAmount"
  - "Used productName ?? 'ACA' fallback to match WeekSection.tsx line 275"
metrics:
  duration: ~10min
  tasks_completed: 1
  tasks_total: 2
  files_modified: 1
  completed: 2026-04-07
---

# Phase 46 Plan 4: ACA Print Chip Parity Summary

Inline ACA chip emitted in the Core column of `printAgentCards` whenever `entry.acaAttached` is set, mirroring the on-screen payroll card render from WeekSection.tsx:272-279.

## What Changed

The print HTML generator `printAgentCards` in `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` previously rendered Core / Add-on / AD&D buckets but ignored the `entry.acaAttached` field that the on-screen `WeekSection` card uses to surface the ACA child sale as its own chip (introduced in Phase 45 GAP-45-07). Print and screen were out of parity for any payroll row whose AD&D / addon was bundled with an ACA sale.

Three additions inside `printAgentCards`:

1. **CSS classes** added to the inline `<style>` block (lines 728-729):
   - `.prod-aca` — teal/info chip (1px border `#0891b2`, bg `#e0f7fa`, text `#0c4a5f`, 10px bold) — distinct from `.prod-block` so the ACA piece reads visually separate, but border + dark text guarantees B/W print readability.
   - `.prod-aca-amt` — small dollar suffix mirroring `.prod-premium` for the ACA child payout amount.

2. **`acaChipHtml` builder** (lines 767-771): conditional template literal rendering the chip only when `e.acaAttached` is truthy. Uses `e.acaAttached.productName ?? "ACA"` and `e.acaAttached.payoutAmount` — same fields the on-screen render reads.

3. **Inline injection** (line 785): appended `${acaChipHtml}` directly after `${printProd(byType.CORE)}` inside the existing Core `<td>`. No new column, no bucket logic change.

## Plan Compliance

- D-13: ACA chip renders inline inside Core column ✅
- D-14: Print-friendly style mirrors prod-block dimensions, distinct color tone, readable on color + B/W ✅
- D-15: No new column, no bucket logic change (lines 758-784 region untouched) ✅
- D-16: Test target Sammy Machado 04-05 → 04-11 — pending Task 2 human verification

## Tasks Completed

| Task | Name                                              | Status   | Commit  |
| ---- | ------------------------------------------------- | -------- | ------- |
| 1    | Emit inline ACA chip inside Core column           | done     | e94460e |
| 2    | Human verification — Sammy Machado print chip     | deferred | —       |

## Deviations from Plan

None — plan executed exactly as written. The chip builder was extracted into an `acaChipHtml` constant rather than inlined directly into the `<td>` template literal so the conditional logic stays readable; this is a stylistic refinement only and matches the surrounding `commFlagHtml` / `enrollBonusHtml` pattern in the same function.

## Deferred Items

**Task 2 (checkpoint:human-verify)** — Sammy Machado week 04-05 → 04-11 print preview verification. This is a `checkpoint:human-verify` gate that requires running the dashboard, opening Sammy's agent card, clicking Print, and inspecting the print preview (color + B/W). It must be performed by a human after the wave is merged. Deferred to the wave's post-merge verification step per parallel-execution protocol.

## Verification

- `grep -q 'acaAttached' apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` → MATCH (lines 166, 768, 769, 770)
- `grep -q 'prod-aca' apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` → MATCH (lines 728, 729, 768, 770)
- `prod-aca` matches occur inside `printAgentCards` (lines 728-729 inside the inline `<style>` block; line 770 inside the `acaChipHtml` builder; line 785 injection point inside the Core `<td>`)
- Bucket loop region (lines 758-784) semantically unchanged — only added the local `acaChipHtml` constant and injected it into the existing Core `<td>`

## Self-Check: PASSED

- FOUND: apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx (modified, contains prod-aca + acaAttached)
- FOUND: commit e94460e in worktree-agent-abbb8976 branch
- FOUND: .planning/phases/46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with/46-04-SUMMARY.md (this file)
