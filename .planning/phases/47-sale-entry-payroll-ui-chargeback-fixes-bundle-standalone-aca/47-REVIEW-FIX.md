---
phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca
fixed_at: 2026-04-07T00:00:00Z
review_path: .planning/phases/47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca/47-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 47: Code Review Fix Report

**Fixed at:** 2026-04-07
**Source review:** 47-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope (Critical + Warning): 11
- Fixed: 11
- Skipped: 0
- Info findings (out of scope): 8

## Fixed Issues

### CR-01: Non-deterministic `payrollEntries[0]` selection in cross-period chargeback helper

**Files modified:** `apps/ops-api/src/services/payroll.ts`, `apps/ops-api/src/services/alerts.ts`, `apps/ops-api/src/routes/chargebacks.ts`, `apps/ops-api/src/routes/payroll.ts`
**Commit:** `1a653c3`
**Applied fix:** `applyChargebackToEntry` now filters `sale.payrollEntries` down to rows whose status is NOT `CLAWBACK_APPLIED`, `ZEROED_OUT_IN_PERIOD`, or `CLAWBACK_CROSS_PERIOD`, then sorts by `createdAt asc` and picks the oldest live entry. If no eligible row exists the helper throws a clear error rather than mutating a stale clawback row. All three callers (`routes/chargebacks.ts`, `routes/payroll.ts`, `services/alerts.ts`) were updated to include `orderBy: { createdAt: "asc" }` on every `payrollEntries: true` include so Prisma gives the helper a deterministic base ordering even before the filter runs, and each caller now derives its own `referenceEntry` from a non-clawback filtered list.

### CR-02: Null-dereference crash in `POST /sales/aca` when no active lead source exists

**Files modified:** `apps/ops-api/src/routes/sales.ts`
**Commit:** `f38fa65`
**Applied fix:** Replaced the `(await prisma.leadSource.findFirst(...))!.id` non-null assertion with an explicit lookup into a local `defaultLeadSource` variable followed by a `400` response carrying a clear error message (`"No active lead source configured. Create one before entering ACA sales."`). The sale insert uses `defaultLeadSource.id` and no longer risks a TypeError crash on a fresh environment or paused roster.

### WR-01: Batch chargeback uses `netAmount` for clawback amount, contaminating with unrelated bonus/fronted/hold

**Files modified:** `apps/ops-api/src/routes/chargebacks.ts`, `apps/ops-api/src/routes/payroll.ts`
**Commit:** `1a653c3`
**Applied fix:** Both the batch chargeback path (`routes/chargebacks.ts:219`) and the single-clawback path (`routes/payroll.ts:230`) now use `Number(referenceEntry.payoutAmount)` instead of `netAmount`. This canonicalizes on the sale's own commission across all three chargeback entry points (batch, single, alert-approve — the last was already correct). The clawback amount is no longer contaminated by bonus/fronted/hold from the target period.

### WR-02: `handleCommissionZeroing` runs outside the `Sale.update` transaction

**Files modified:** `apps/ops-api/src/services/payroll.ts`, `apps/ops-api/src/routes/sales.ts`
**Commits:** `1a653c3` (service change), `f38fa65` (route change)
**Applied fix:** `handleCommissionZeroing(saleId, tx?)` now accepts an optional `PrismaTx`, mirroring `upsertPayrollEntryForSale`. The `RAN → DEAD/DECLINED` branch in `PATCH /sales/:id/status` wraps `statusChangeRequest.updateMany` + `sale.update` + `handleCommissionZeroing` in a single `prisma.$transaction`, passing `tx` into the helper so all mutations commit or roll back atomically. The `POST /sales` handler likewise wraps `sale.create` + `upsertPayrollEntryForSale` in a `$transaction` so a payroll upsert failure rolls back the sale insert.

### WR-03: `mark-paid` does not exclude `ZEROED_OUT_IN_PERIOD` or `CLAWBACK_CROSS_PERIOD`

**Files modified:** `apps/ops-api/src/routes/payroll.ts`
**Commit:** `1a653c3`
**Applied fix:** The `POST /payroll/mark-paid` `updateMany` `where` clause now uses `status: { notIn: ["ZEROED_OUT", "ZEROED_OUT_IN_PERIOD", "CLAWBACK_CROSS_PERIOD"] }`, preserving the visual distinction (yellow/orange) and logical semantics of already-resolved cross-period chargebacks when payroll bulk-marks a week paid.

### WR-04: Batch chargeback review UI displayed premium-based total but server wrote `netAmount`-based clawback

**Files modified:** `apps/ops-api/src/services/chargebacks.ts`, `apps/ops-api/src/routes/chargebacks.ts`, `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx`
**Commit:** `541be27` (plus the `routes/chargebacks.ts` server-side pieces in `1a653c3`/`541be27`)
**Applied fix:** `matchChargebacksToSales` now includes full `product`, `addons.product`, `payrollEntries` (oldest-first), and `acaCoveredSales` so the `POST /chargebacks/preview` endpoint can compute per-product commission via `calculatePerProductCommission` using the same `payoutAmount` basis the server uses when it writes the clawback. The preview response now returns `products[].commission` and `matchedSales[].fullCommission` in addition to premium. On the dashboard, `ReviewProduct` / `MatchedSaleInfo` gained a `commission` field, and `toggleProduct` / `selectSale` now sum `commission` (not `premium`) when computing `autoAmount`. The review screen's total now reconciles with the value the server will commit.

### WR-05: `ACA child` link not validated in `POST /sales/aca`

**Files modified:** `apps/ops-api/src/routes/sales.ts`
**Commit:** `f38fa65`
**Applied fix:** If `parsed.acaCoveringSaleId` is present, the handler fetches the parent sale (`select: { id, agentId, status }`) and returns `404` if missing, `400` if the parent's `agentId !== parsed.agentId`, and `400` if the parent is `DEAD` or `DECLINED`. This brings the POST path up to parity with the existing PATCH validation and prevents orphan FKs, cross-agent ACA linkages, and attaching ACA children to dead parents.

### WR-06: Alert approve deduped using member-based `OR` clause can false-positive across batches

**Files modified:** `apps/ops-api/src/services/alerts.ts`
**Commit:** `1a653c3`
**Applied fix:** The `existingClawback` dedupe query in `approveAlert` now constrains the `member_id` and `member_name` branches with `createdAt: { gte: cbCreatedAt }`, where `cbCreatedAt` is the alert's source chargeback's `createdAt`. The `chargeback_alert` branch (keyed on `chargebackSubmissionId` — a unique FK) is left unconstrained because it cannot false-positive. This ensures two legitimate chargebacks for the same member in different batches each produce their own clawback row. Schema-level switch to `chargebackSubmissionId` FK on `Clawback` remains open as the cleaner long-term fix (Phase 48).

### WR-07: `ManagerEntry` success toast fires even when bundled ACA creation fails

**Files modified:** `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx`
**Commit:** `8a4bc73`
**Applied fix:** The bundled ACA POST now captures `acaRes` and, on `!acaRes.ok`, stores an `acaBundleError` string that includes the HTTP status and the server's `err.error` field. A network exception also populates `acaBundleError`. After the ACA branch, the toast is set to the error string (type `"error"`) instead of the generic "Sale submitted successfully" when the bundle failed, so users always see when the ACA child is missing and are prompted to add it manually.

### WR-08: `calculatePerProductCommission` early-return is logically dead when no products supplied

**Files modified:** `apps/ops-api/src/services/payroll.ts`
**Commit:** `1a653c3`
**Applied fix:** Replaced the double-conditional guard with a clean two-step check: `if (productIds.length === 0) return fullPayoutAmount;` followed by `const allIncluded = allProductIds.size > 0 && productIds.length >= allProductIds.size && productIds.every(id => allProductIds.has(id));` and `if (allIncluded) return fullPayoutAmount;`. The docstring's empty-list contract is now actually honored.

### WR-09: Eager `GET /api/sales` on every keystroke in sale picker

**Files modified:** `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx`
**Commit:** `dcaeb91`
**Applied fix:** Added two per-alert refs — `salePickerTimersRef` (debounce timer) and `salePickerAbortRef` (in-flight `AbortController`) — keyed by `alert.id`. The `onChange` handler is now synchronous and schedules the fetch with a 300 ms `setTimeout`, clearing any prior timer and aborting any prior request for the same alert first. The fetch passes the controller's signal to `authFetch`, checks `ctrl.signal.aborted` before applying results, and filters `AbortError`s out of the catch branch. Stale responses can no longer overwrite newer results, and typing no longer fires one request per keystroke.

## Skipped Issues

None — all in-scope findings were successfully fixed.

## Out-of-Scope (Info — not fixed this iteration)

IN-01 through IN-08 were excluded per `fix_scope: critical_warning`. They remain documented in `47-REVIEW.md` for a future follow-up.

## Build Verification

### `npm run build --workspace=apps/ops-api`

- `prisma generate`: OK.
- `tsc -p tsconfig.json`: exits non-zero with 7 errors, **ALL pre-existing** in files this phase did not touch:
  - `src/routes/auth.ts` (bcryptjs types, cross-rootDir `@ops/auth` import)
  - `src/routes/users.ts` (bcryptjs types)
  - `packages/auth/src/index.ts` (jsonwebtoken, cookie types, cross-rootDir `@ops/types` import)
  - `packages/types/src/index.ts` (cross-rootDir `us-states.ts`)
- A filtered check `grep -E "(services/payroll|services/alerts|services/chargebacks|routes/chargebacks|routes/payroll|routes/sales)" tsc.log` returned **zero** matches — none of the Phase-47 fix files emitted a TypeScript error. These API build errors are a pre-existing tsconfig rootDir / missing `@types/*` dev-dependencies regression and are out of scope for this review-fix pass.

### `npm run build --workspace=apps/ops-dashboard`

- `next build`: **PASS** (`✓ Compiled successfully in 3.0s`). All 11 static pages generated, including `/payroll` (37.8 kB, 148 kB First Load JS) and `/manager` (24.9 kB, 141 kB). The dashboard fixes to `ManagerEntry.tsx`, `PayrollChargebacks.tsx`, and `PayrollPeriods.tsx` all compile cleanly.

## Commit Summary

| Commit    | Findings                          | Files                                                                 |
| --------- | --------------------------------- | --------------------------------------------------------------------- |
| `1a653c3` | CR-01, WR-01, WR-02*, WR-03, WR-06, WR-08 | `services/payroll.ts`, `services/alerts.ts`, `routes/chargebacks.ts`, `routes/payroll.ts` |
| `f38fa65` | CR-02, WR-02*, WR-05              | `routes/sales.ts`                                                    |
| `541be27` | WR-04                             | `services/chargebacks.ts`, `PayrollChargebacks.tsx`                   |
| `8a4bc73` | WR-07                             | `ManagerEntry.tsx`                                                    |
| `dcaeb91` | WR-09                             | `PayrollPeriods.tsx`                                                  |

`*` WR-02 spans two commits because the service signature change (`handleCommissionZeroing(tx?)`) lives in the payroll service while the `$transaction` wrappers live in `routes/sales.ts`.

---

_Fixed: 2026-04-07_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
