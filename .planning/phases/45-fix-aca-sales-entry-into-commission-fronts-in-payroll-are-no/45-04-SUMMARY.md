---
phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no
plan: 04
subsystem: payroll
tags: [react, typescript, payroll, aca, dashboard, csv-export]

requires:
  - phase: 45
    provides: "45-01 ACA fold + acaAttached marker; 45-01 added local Entry/SaleInfo ACA fields"
provides:
  - "Order-independent two-pass ACA fold in PayrollPeriods.tsx agentData useMemo"
  - "Order-independent two-pass ACA fold in PayrollExports.tsx exportDetailedCSV"
  - "Local Entry type in PayrollExports.tsx now declares optional acaAttached field"
  - "Defensive orphan emission so ACA child rows without a matching parent are not silently dropped"
affects: [payroll-dashboard, payroll-csv-export, aca-commissions, weeksection-badge]

tech-stack:
  added: []
  patterns:
    - "Two-pass collect-then-emit fold pattern (order-independent merge)"

key-files:
  created: []
  modified:
    - "apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx"
    - "apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx"

key-decisions:
  - "Replaced findIndex-based merge with two-pass index then emit, eliminating order dependency"
  - "Added defensive orphan loop so ACA children without a parent in the same period still surface as standalone rows (preserves pre-fold behavior for orphans)"
  - "Added optional acaAttached field to PayrollExports.tsx local Entry type rather than importing from payroll-types.ts to keep that file self-contained per its existing structure"

patterns-established:
  - "Two-pass fold: when one record must be merged into another and ordering is not guaranteed, build a child-by-parent index first, then emit parents with child contributions baked in. Avoids re-scanning the output array with findIndex."

requirements-completed: [BUGFIX-45-ACA]

duration: 8min
completed: 2026-04-07
---

# Phase 45 Plan 04: Order-Independent ACA Fold Summary

**Rewrote the ACA covering-entry fold in PayrollPeriods.tsx and PayrollExports.tsx as a two-pass index-then-emit so the ACA child commission is summed into the parent row regardless of API row ordering.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-07
- **Completed:** 2026-04-07
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments
- Closed GAP-45-04: ACA child payout is no longer silently dropped when the child entry precedes its parent in `p.entries`.
- PayrollExports.tsx exportDetailedCSV now mirrors the dashboard's commission math exactly, so print/CSV totals stay in sync with the on-screen folded row.
- Added a defensive orphan emission pass: if an ACA child references a parent saleId that does not exist in the current period, the child is surfaced as a standalone row instead of being silently swallowed.

## Task Commits

1. **Task 1 + Task 2 (single logical commit):** order-independent two-pass ACA fold in both payroll views — `94234e0` (fix)

_Both tasks were committed together because they apply the same verbatim fold to two files in the same code path; splitting would have created an intermediate state where dashboard and CSV diverged._

## Files Created/Modified
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — Replaced the L132-L165 one-pass fold inside `agentData` useMemo with the two-pass index/emit/orphan pattern. Variable name `foldedEntries` and downstream `for (const e of foldedEntries)` consumer at L168 unchanged.
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` — Replaced the corresponding fold inside `exportDetailedCSV` (was L127-L152). Renamed the loop variable `p` -> `period` to match the plan's referenced variable name and avoid shadowing. Also added an optional `acaAttached?` field to the file-local `Entry` type so the merged marker has a place to live (the local type previously omitted it; the type was already independent of payroll-types.ts).

## Verification

- `cd apps/ops-dashboard && npx tsc --noEmit` — no errors reported in `PayrollPeriods.tsx` or `PayrollExports.tsx`.
- Acceptance criteria grep checks:

  | Criterion | Expected | Got |
  | --- | --- | --- |
  | PayrollPeriods.tsx `acaChildrenByParentId` count | ≥4 | 5 |
  | PayrollPeriods.tsx `GAP-45-04` count | 1 | 1 |
  | PayrollPeriods.tsx `parentBySaleId` count | 0 | 0 |
  | PayrollPeriods.tsx `foldedEntries.findIndex` count | 0 | 0 |
  | PayrollPeriods.tsx `acaAttached` count | ≥1 | 1 |
  | PayrollExports.tsx `acaChildrenByParentId` count | ≥4 | 5 |
  | PayrollExports.tsx `GAP-45-04` count | 1 | 1 |
  | PayrollExports.tsx `parentBySaleId` count | 0 | 0 |
  | PayrollExports.tsx `foldedEntries.findIndex` count | 0 | 0 |
  | PayrollExports.tsx `ACA_PL` count (byType buckets preserved) | ≥3 | 3 |

  All acceptance criteria pass cleanly.

## Deviations from Plan

### Auto-fixed Issues

None.

### Plan Adaptations

1. **Loop variable rename in PayrollExports.tsx (Task 2).** The plan instructed to use `period.entries` but the existing code used `for (const p of filtered)`. I renamed the loop variable from `p` to `period` so the verbatim plan code block (which references `period.entries`) drops in unchanged. No semantic difference; this is the same variable rename the plan implicitly required.
2. **Added `acaAttached?` to PayrollExports.tsx local Entry type.** The plan explicitly authorized this addition if missing ("If the local Entry type in PayrollExports.tsx does NOT yet have an `acaAttached` field declared, add it..."). It was missing, so I added it as an optional field. The downstream `byType.CORE.push(...byType.ACA_PL.map(...))` block from 45-01 is preserved.

## Authentication Gates

None encountered.

## Deferred Issues

None.

## Manual UAT Required (per plan verification block)

- Submit Complete Care Max + addon + ACA checkbox + memberCount=2; on the payroll dashboard the folded row's commission must equal `(parent payoutAmount + ACA flat × memberCount)`.
- Cross-check via SQL: `SELECT pe.payout_amount FROM payroll_entry pe JOIN sale s ON s.id=pe.sale_id WHERE s.member_name='ACA Repro Test';` — sum of the two PayrollEntry rows must match the dashboard cell.
- Print/CSV the same period and confirm the Core column shows both products on one line and the commission column matches the dashboard.

## Self-Check: PASSED

- Modified files exist and contain the new fold (verified via grep counts above).
- Commit `94234e0` exists in git log.
- No tsc errors in either modified file.
