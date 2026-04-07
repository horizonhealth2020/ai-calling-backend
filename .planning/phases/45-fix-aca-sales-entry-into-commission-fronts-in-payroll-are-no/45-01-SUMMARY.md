---
phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no
plan: 01
subsystem: payroll-display
tags: [bugfix, aca, payroll, display, dashboard, print]
requires:
  - prisma.Sale.acaCoveringSaleId (existing self-relation)
  - existing PayrollEntry rows persisted by upsertPayrollEntryForSale
provides:
  - unified ACA row rendering on payroll dashboard
  - unified ACA row rendering in payroll print/CSV export
  - acaCoveringSaleId surfaced in /api/payroll/periods response
affects:
  - apps/ops-api/src/routes/payroll.ts
  - apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts
  - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
  - apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx
  - apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx
tech-stack:
  added: []
  patterns:
    - client-side fold pass over period.entries keyed by sale.id
    - acaAttached marker on parent Entry to drive badge rendering
key-files:
  created: []
  modified:
    - apps/ops-api/src/routes/payroll.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx
decisions:
  - Display-only fix: zero schema/data migration; both PayrollEntry rows remain in DB and are merged client-side
  - Fold lives in PayrollPeriods useMemo and is duplicated in PayrollExports.exportDetailedCSV (each consumer folds its own copy of period.entries)
  - Parent payoutAmount and netAmount both incremented by child payout so downstream gross/net sums remain identical to pre-fold totals
  - acaAttached marker is the single source of truth for the ACA badge on a non-ACA parent row; original ACA_PL standalone path still renders the badge for true ACA-only sales
metrics:
  duration: ~12 minutes
  completed: 2026-04-07
---

# Phase 45 Plan 01: Fix ACA Sales Entry Display in Payroll Summary

ACA-attached sales now render as a single unified row per member on both the payroll dashboard and the printed/CSV export, with the ACA badge surfaced on the parent row and the verbose `$X.XX x N members = $Y` breakdown text removed entirely.

## What Changed

The bug was purely in the rendering layer. Both PayrollEntry rows (parent + ACA child) are persisted correctly by `upsertPayrollEntryForSale`, but the dashboard rendered them as two visually disconnected cards and the ACA card displayed a verbose multi-member commission string. This plan surfaces the existing `Sale.acaCoveringSaleId` self-relation through the API and folds the child rows into their parents on the client.

## Tasks Executed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Manual repro diagnostic — confirm display-only bug | RESOLVED via human-verify gate (no code) | none |
| 2 | Surface acaCoveringSaleId in API response and Entry type | DONE | abbbc41 |
| 3 | Fold ACA entries into parents and render unified row (dashboard + print) | DONE | d38467d |

### Task 1 (gate)
The previous executor agent paused at this checkpoint. The user verified via the Payroll dashboard screenshot that for `ACA Repro Test` two separate cards rendered (Row A: ACA child with verbose `$10.00 × 1 members = $10.00` text and ACA badge; Row B: parent Complete Care with the regular flat commission). Both sales and both PayrollEntry rows existed in the DB. User response: `display-only confirmed`. No commit was made because this was a diagnostic gate, not a code task.

### Task 2 (`abbbc41`)
- `apps/ops-api/src/routes/payroll.ts` — added `acaCoveringSaleId: true` to the sale select inside the `GET /payroll/periods` include.
- `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` — added `acaCoveringSaleId?: string | null` to `SaleInfo` and a new optional `acaAttached` block on `Entry` containing `memberCount`, `flatCommission`, and `payoutAmount`. The `acaAttached` field is populated client-side in Task 3, never by the API.

### Task 3 (`d38467d`)
**3a — PayrollPeriods.tsx:** Inside the `agentData` useMemo, before the per-period agent grouping, a fold pre-pass walks `p.entries` and:
1. Builds a `parentBySaleId` map of all non-ACA-child entries.
2. For each entry whose `sale.acaCoveringSaleId` matches a known parent: clones the parent (object spread, no in-place mutation) with `payoutAmount` and `netAmount` both incremented by the child's payout, attaches an `acaAttached` marker, and replaces the parent in the working list. The child entry is dropped.
3. The downstream `byAgent` grouping iterates `foldedEntries` in place of `p.entries`. Sums computed downstream remain identical to pre-fold totals because the child's payout was moved into the parent rather than discarded.

**3b — WeekSection.tsx:**
- Line 249 badge condition changed from `entry.sale?.product?.type === "ACA_PL"` to `(entry.sale?.product?.type === "ACA_PL" || entry.acaAttached)` so the ACA badge appears on parent rows that absorbed an ACA child as well as on standalone ACA sales.
- Lines 296–304 verbose ACA commission branch deleted entirely. The commission cell now always renders a single flat dollar amount via `formatDollar(Number(entry.payoutAmount))`.

**3c — PayrollExports.tsx:**
- Local `SaleInfo` type extended with `acaCoveringSaleId`, `memberCount`, and `product.flatCommission` to mirror the dashboard type.
- Inside `exportDetailedCSV`, the same fold pre-pass from 3a is applied to each period before entries are pushed into the `tagged` array, so the print output matches the dashboard exactly.
- The `byType` initializer at L192 now includes an `ACA_PL: []` bucket, and ACA product names are appended to the Core column with an `(ACA)` suffix so they print alongside the parent core product.

## Deviations from Plan

None — the plan was executed exactly as specified. Task 1 was resolved by the prior agent's checkpoint and required no code commit.

### Out-of-Scope TypeScript Errors (Deferred)

`npx tsc --noEmit` in both `apps/ops-api` and `apps/ops-dashboard` reports pre-existing errors that are unrelated to this plan and existed on `main` before Task 2:

- ops-api: missing `@types/bcryptjs`, `@types/jsonwebtoken`, `@types/cookie`; Prisma client not regenerated against current schema (`agentAdjustments`, `clawbackProduct`, `agentPeriodAdjustment`, `carryoverExecuted`, `acaCoveringSaleId` all missing on the in-tree client); `rootDir` complaints about workspace `@ops/auth` and `@ops/types` imports.
- ops-dashboard: a `Product[]` type clash in `app/(dashboard)/payroll/page.tsx` (two unrelated `ProductType` declarations); `middleware.ts` cookie API mismatch; same `@ops/auth` declaration warnings.

None of these reference the files modified in this plan. They are logged here per the SCOPE BOUNDARY rule and will need a separate `npm install` + `npx prisma generate` + dedicated cleanup plan to resolve. Spot-grep on the modified files confirms no new errors were introduced.

## Acceptance Criteria

- `grep -n "acaCoveringSaleId" apps/ops-api/src/routes/payroll.ts` — 1 match inside the sale select.
- `grep -n "acaCoveringSaleId" apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` — 1 match on `SaleInfo`.
- `grep -n "acaAttached" apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` — 1 match on `Entry`.
- `grep -n "acaAttached" apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — 1 match (fold pass).
- `grep -n "acaAttached" apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` — 1 match (badge condition).
- `grep -n "x {entry.sale.memberCount} members" apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` — 0 matches (verbose text removed).
- `grep -n "ACA_PL" apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` — 3 matches inside exportDetailedCSV.

## Manual Smoke Test (recommended after merge)

1. Submit a manager sale with Complete Care Max + Compass Care Navigator+ addon + ACA checkbox + member count = 2.
2. Open the Payroll dashboard for the agent's current week.
3. Confirm a single row renders with: core product badge, addon badge, ACA badge, and commission = parent payout + (ACA flat × 2), displayed as a single flat dollar amount with no `x N members =` text.
4. Print/export the week and confirm the Core column lists `Complete Care Max, Blue Cross Blue Shield (ACA)` (or whichever ACA carrier was selected) on a single row.

## Self-Check: PASSED

- File `apps/ops-api/src/routes/payroll.ts` — FOUND, contains `acaCoveringSaleId: true`.
- File `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` — FOUND, contains `acaCoveringSaleId` and `acaAttached`.
- File `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — FOUND, contains `acaAttached` fold.
- File `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` — FOUND, badge condition updated, verbose branch deleted.
- File `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` — FOUND, byType has `ACA_PL`, fold pass added.
- Commit `abbbc41` — FOUND in `git log`.
- Commit `d38467d` — FOUND in `git log`.
