---
phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca
plan: 05
subsystem: payroll-chargebacks
tags: [chargebacks, payroll, cross-period, prisma, react, print-parity]
requirements: [D-18, D-19, D-20, D-21, D-22, D-23, D-24]
dependency-graph:
  requires:
    - "Phase 47-04: ACA payroll edit (sibling — orthogonal)"
    - "PayrollEntry @@unique([payrollPeriodId, saleId]) constraint"
  provides:
    - "applyChargebackToEntry shared helper for in-period vs cross-period chargeback application"
    - "findOldestOpenPeriod (agent-agnostic) helper"
    - "ZEROED_OUT_IN_PERIOD + CLAWBACK_CROSS_PERIOD enum values"
    - "Frontend row highlighting for chargeback states"
  affects:
    - "POST /api/clawbacks (single chargeback)"
    - "POST /api/chargebacks/submit (batch matched path)"
    - "approveAlert pipeline"
    - "Payroll dashboard pay cards (live)"
    - "printAgentCards (print parity)"
tech-stack:
  added: []
  patterns:
    - "Shared helper consumed by 3 transactional code paths"
    - "Enum-driven row highlight (CSS via inline React.CSSProperties + print CSS classes)"
key-files:
  created: []
  modified:
    - "prisma/schema.prisma"
    - "apps/ops-api/src/services/payroll.ts"
    - "apps/ops-api/src/routes/payroll.ts"
    - "apps/ops-api/src/routes/chargebacks.ts"
    - "apps/ops-api/src/services/alerts.ts"
    - "apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx"
    - "apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx"
decisions:
  - "Branch A taken: netAmount is a stored Decimal column on PayrollEntry (verified via grep at prisma/schema.prisma:321), so applyChargebackToEntry writes netAmount directly rather than relying on upsertPayrollEntryForSale aggregation"
  - "approveAlert in services/alerts.ts is wired in for parity (it previously did NOT mutate any PayrollEntry, so the legacy buggy lookup pattern never existed there — but the alert path now produces the cross-period negative row when the original sale lives in LOCKED/FINALIZED periods)"
  - "Single chargeback path (routes/payroll.ts) wraps clawback create + ClawbackProduct create + entry mutation in prisma.\$transaction so partial failure cannot orphan a clawback row"
  - "Legacy CLAWBACK_APPLIED red row highlight preserved in WeekSection.tsx for backward compatibility (D-24: no retroactive migration)"
metrics:
  duration: "~10m"
  completed: 2026-04-07
  tasks: 4
  files_modified: 7
---

# Phase 47 Plan 05: Closed-Period Chargebacks → Negative Row in Oldest OPEN Period Summary

Closed-period chargebacks now insert a new negative `PayrollEntry` row into the oldest OPEN period (orange highlight, status `CLAWBACK_CROSS_PERIOD`) instead of silently mutating the original locked/finalized entry; in-period chargebacks continue to zero in place but with the new `ZEROED_OUT_IN_PERIOD` status (yellow highlight) — both treatments are mirrored on the print agent cards.

## What Shipped

### Schema (Task 1)
- `PayrollEntryStatus` enum gained two values: `ZEROED_OUT_IN_PERIOD` and `CLAWBACK_CROSS_PERIOD`
- `npx prisma db push` applied to live DB; `npx prisma generate` regenerated client

### Shared helpers (Task 2)
- `findOldestOpenPeriod(tx?)` — agent-agnostic oldest OPEN period lookup, transaction-aware
- `applyChargebackToEntry(tx, sale, chargebackAmount)` — single source of truth for chargeback application:
  - In-period (OPEN): zero original entry (`payoutAmount: 0, netAmount: 0, status: ZEROED_OUT_IN_PERIOD`)
  - Cross-period (LOCKED/FINALIZED): insert new entry in oldest OPEN with `payoutAmount: 0, adjustmentAmount: -X, netAmount: -X, status: CLAWBACK_CROSS_PERIOD`
  - Throws when no OPEN period exists for cross-period inserts
- Existing `findOldestOpenPeriodForAgent` preserved (other call sites depend on it)

### Three call sites wired (Task 3)
1. **`routes/payroll.ts` POST `/clawbacks`** — wraps clawback create + ClawbackProduct create + entry mutation in `prisma.$transaction`; calls `applyChargebackToEntry`. The buggy `sale.payrollEntries.find(e => e.payrollPeriodId === targetPeriodId) ?? sale.payrollEntries[0]` lookup is gone.
2. **`routes/chargebacks.ts` batch matched path** — replaces the inline `prisma.payrollEntry.update` with `applyChargebackToEntry(tx, ...)` inside the existing batch transaction.
3. **`services/alerts.ts` `approveAlert`** — extends the existing clawback create flow with an `applyChargebackToEntry` call so alert-approved chargebacks also produce the cross-period negative row when the original sale lives in a closed period. (Pre-fix, `approveAlert` created a Clawback row but never mutated PayrollEntry — the bug was missing functionality, not the legacy lookup pattern.)

### Frontend highlights (Task 4)
- **`WeekSection.tsx`**: row background switches on `entry.status`:
  - `CLAWBACK_CROSS_PERIOD` → orange (`rgba(251,146,60,0.10)` + 3px orange left border)
  - `ZEROED_OUT_IN_PERIOD` → yellow (`rgba(234,179,8,0.10)` + 3px yellow left border)
  - `CLAWBACK_APPLIED` → red (legacy, preserved)
- **`PayrollPeriods.tsx printAgentCards`**: print-CSS classes `row-cross-period` (peach `#fed7aa` bg, orange `#f97316` border) and `row-in-period-zero` (cream `#fef3c7` bg, yellow `#eab308` border) emitted in the inlined `<style>` block, plus a `rowClass` switch attached to each `<tr>` in the entries map.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written. The single-chargeback path required wrapping the previously-loose mutations in a `prisma.$transaction` (which was an implicit Step A consequence rather than a deviation), and `approveAlert` was rewired even though it lacked the legacy buggy pattern (per the plan's mandatory parity requirement in Task 3 Step C).

### Branch decision (Task 2)
Per the plan's pre-task verification step, `netAmount` was confirmed as a stored Decimal column:

```
prisma/schema.prisma:321:  netAmount        Decimal            @map("net_amount") @db.Decimal(12, 2)
apps/ops-api/src/services/payroll.ts:321:        data: { payoutAmount: 0, netAmount: 0, status: 'ZEROED_OUT' },
apps/ops-api/src/services/payroll.ts:399:      netAmount: payoutAmount,
```

→ **Branch A** chosen: `applyChargebackToEntry` writes `netAmount` directly (no `upsertPayrollEntryForSale` re-aggregation needed).

## Verification Run

- `npx prisma db push` — exit 0, schema synced (12.48s)
- `npx prisma generate` — exit 0
- `cd apps/ops-api && npx tsc --noEmit` — no errors in any modified files (`routes/payroll.ts`, `routes/chargebacks.ts`, `services/alerts.ts`, `services/payroll.ts`); pre-existing project-wide rootDir/types errors unrelated to this plan
- `npm run build --workspace=apps/ops-dashboard` — exit 0, all 11 routes generated

## Commits

| Task | Commit  | Description                                                         |
| ---- | ------- | ------------------------------------------------------------------- |
| 1    | badd54b | Schema enum values + db push                                        |
| 2    | 5435af4 | findOldestOpenPeriod + applyChargebackToEntry helpers                |
| 3    | b451d7d | Wire helper into single, batch, and alert paths                     |
| 4    | 474c4c8 | WeekSection + PayrollPeriods print row highlights                   |

## Self-Check: PASSED

- Files modified verified: prisma/schema.prisma, apps/ops-api/src/services/payroll.ts, apps/ops-api/src/routes/payroll.ts, apps/ops-api/src/routes/chargebacks.ts, apps/ops-api/src/services/alerts.ts, apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx, apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx — all present in working tree
- Commits verified in git log: badd54b, 5435af4, b451d7d, 474c4c8 — all present
- Build artifacts verified: prisma generate, ops-api tsc (modified files clean), ops-dashboard build (exit 0)
