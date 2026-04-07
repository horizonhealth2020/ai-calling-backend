---
phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca
reviewed: 2026-04-07T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - apps/ops-api/src/routes/chargebacks.ts
  - apps/ops-api/src/routes/payroll.ts
  - apps/ops-api/src/routes/sales.ts
  - apps/ops-api/src/services/alerts.ts
  - apps/ops-api/src/services/payroll.ts
  - apps/ops-api/src/services/sales.ts
  - apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx
  - apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx
  - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
  - apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx
  - apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts
  - prisma/schema.prisma
findings:
  critical: 2
  warning: 9
  info: 8
  total: 19
status: issues_found
---

# Phase 47: Code Review Report

**Reviewed:** 2026-04-07
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 47 bundles sale-entry, payroll-UI, chargeback-fix, and standalone-ACA work. Overall the code is well-structured: most mutations are correctly wrapped in `$transaction`, Zod validation is consistent and goes through `zodErr()`, `asyncHandler` wraps every route, audit logging is comprehensive, and the UI respects the inline `React.CSSProperties` convention. The ACA parent/child relation discipline (FK on child only, `acaCoveredSales` inverse read path) is applied consistently across routes, services, and the dashboard.

The most important concerns are around **data integrity of the cross-period chargeback flow**: (1) a non-deterministic `payrollEntries[0]` pick in `applyChargebackToEntry` can route repeated clawbacks to a prior cross-period row instead of the original sale, and (2) the three chargeback entry points disagree about whether the clawback amount is `payoutAmount` or `netAmount`, which means batch-matched chargebacks contaminate the clawback with unrelated bonus/fronted/hold values from the target period. There is also a null-deref crash path in `POST /sales/aca` when no active lead source exists, and several non-atomic status transitions that can leave sale status out of sync with payroll entries.

The new UNMATCHED/MULTIPLE alert flow and the manual sale picker on the payroll dashboard are solid and well-commented, with reasonable dedupe guards. The 46-06 observability logging around empty alert payloads is a good addition.

## Critical Issues

### CR-01: Non-deterministic `payrollEntries[0]` selection in cross-period chargeback helper

**File:** `apps/ops-api/src/services/payroll.ts:458`
**Issue:** `applyChargebackToEntry` picks `sale.payrollEntries[0]` as the "original entry" without an ordering guarantee. The caller passes whatever ordering Prisma returned (typically insertion order, but not contractual). A sale that already has a `CLAWBACK_CROSS_PERIOD` row from a prior clawback may present the cross-period negative row at index 0 instead of the true original sale entry. This has two follow-on consequences:

1. If that cross-period row happens to live in an OPEN period (the original clawback's target), the code takes the "IN-PERIOD (OPEN) — zero original row in place" branch on **line 467**, overwrites the CLAWBACK's `-chargebackAmount` with `payoutAmount: 0, netAmount: 0, status: "ZEROED_OUT_IN_PERIOD"`, and the new chargeback silently erases the prior clawback. No audit trail of the lost amount.
2. If the cross-period row lives in a LOCKED period, the code treats it as "originalPeriod is LOCKED" and inserts yet another cross-period row against the oldest OPEN period, double-counting relative to the true original sale entry.

Because `routes/chargebacks.ts:208` includes `payrollEntries: true` with no `orderBy`, and `routes/payroll.ts:218` / `services/alerts.ts:53` also rely on `payrollEntries[0]`, this is exercised on every chargeback path.

**Fix:** Select the "original entry" deterministically by filtering for the OPEN period's entry first, then falling back to the oldest `createdAt` non-CLAWBACK row. Explicitly exclude rows whose status is `CLAWBACK_CROSS_PERIOD` or `ZEROED_OUT_IN_PERIOD` from being treated as the "original":

```ts
const nonClawbackEntries = sale.payrollEntries.filter(
  e => e.status !== "CLAWBACK_CROSS_PERIOD" && e.status !== "ZEROED_OUT_IN_PERIOD"
);
const originalEntry = nonClawbackEntries[0];
// If none remain, the sale was already fully clawbacked — throw or short-circuit
if (!originalEntry) {
  throw new Error(`Sale ${sale.id} has no non-clawback payroll entry to apply chargeback to`);
}
```

Also add `orderBy: { createdAt: "asc" }` on every `payrollEntries: true` include in `routes/chargebacks.ts:208`, `routes/payroll.ts` `saleInclude`, and `services/alerts.ts:53`.

### CR-02: Null-dereference crash in `POST /sales/aca` when no active lead source exists

**File:** `apps/ops-api/src/routes/sales.ts:167`
**Issue:** The handler writes `leadSourceId: (await prisma.leadSource.findFirst({ where: { active: true }, ... }))!.id`. The non-null assertion (`!`) crashes the process with a TypeError if no active lead source is configured. Unlike the `POST /sales` flow which requires `leadSourceId` in the request body, the ACA flow silently picks "any active lead source", so a fresh environment or a paused roster can take the server down via a single ACA submission.

**Fix:** Replace the non-null assertion with an explicit lookup + 400 response, or accept `leadSourceId` from the request body:

```ts
const defaultLeadSource = await prisma.leadSource.findFirst({
  where: { active: true },
  orderBy: { createdAt: "asc" },
});
if (!defaultLeadSource) {
  return res.status(400).json({ error: "No active lead source configured. Create one before entering ACA sales." });
}
// ... leadSourceId: defaultLeadSource.id
```

## Warnings

### WR-01: Batch chargeback uses `netAmount` for clawback amount, contaminating with unrelated bonus/fronted/hold

**File:** `apps/ops-api/src/routes/chargebacks.ts:219`
**Issue:** `const chargebackAmount = referenceEntry ? Number(referenceEntry.netAmount) : ...`. `netAmount = payoutAmount + adjustmentAmount + bonusAmount + frontedAmount - holdAmount` (per `routes/payroll.ts:372` and `services/payroll.ts:390`). Using `netAmount` as the clawback amount pulls in bonus/fronted/hold values that belong to the agent's overall period adjustments, not to this sale's commission. The clawback should be the sale's own commission = `payoutAmount`.

Compare to `services/alerts.ts:186` which correctly uses `payoutAmount` for the alert-approve path. The single-clawback path in `routes/payroll.ts:230` makes the same mistake (`Number(referenceEntry.netAmount)`), so the three entry points disagree. This is also the value passed into `applyChargebackToEntry`, so the cross-period negative row's amount is wrong.

**Fix:** In both `routes/chargebacks.ts:219` and `routes/payroll.ts:230`, use `payoutAmount`:

```ts
const chargebackAmount = referenceEntry
  ? Number(referenceEntry.payoutAmount)
  : Math.abs(Number(cb.chargebackAmount));
```

### WR-02: `handleCommissionZeroing` runs outside the `Sale.update` transaction

**File:** `apps/ops-api/src/routes/sales.ts:713-718`, `apps/ops-api/src/services/payroll.ts:311`
**Issue:** On a `RAN → DEAD/DECLINED` status change, the route updates `sales.status` and then calls `handleCommissionZeroing(sale.id)`, which issues independent `prisma.payrollEntry.update` calls against the module-level client. If the second step throws (DB connection blip, locked row), the sale ends up `DEAD` but the payroll entries still carry commission. No reconciliation exists.

**Fix:** Wrap the sale update + zeroing in a single `prisma.$transaction(async (tx) => { ... })` and refactor `handleCommissionZeroing` to accept an optional `tx: PrismaTx` (mirroring `upsertPayrollEntryForSale`). The same fix applies to `POST /sales` at `sales.ts:39-54` where `upsertPayrollEntryForSale` runs outside the sale-create path — if the payroll upsert fails, the client gets `201` but the sale has no payroll entry.

### WR-03: `mark-paid` does not exclude `ZEROED_OUT_IN_PERIOD` or `CLAWBACK_CROSS_PERIOD`

**File:** `apps/ops-api/src/routes/payroll.ts:112-115`
**Issue:** `updateMany` guards `status: { not: "ZEROED_OUT" }` but does not exclude the new `ZEROED_OUT_IN_PERIOD` or `CLAWBACK_CROSS_PERIOD` statuses introduced for the cross-period chargeback flow. A bulk "Mark Paid" for a week will flip those rows to `PAID`, losing the visual distinction (yellow/orange highlight) and their logical semantics (already-resolved chargebacks).

**Fix:** Broaden the exclusion list:

```ts
where: {
  id: { in: entryIds },
  status: { notIn: ["ZEROED_OUT", "ZEROED_OUT_IN_PERIOD", "CLAWBACK_CROSS_PERIOD"] },
},
```

Also verify whether `mark-unpaid` (`payroll.ts:169`) should skip these same statuses so paying a period twice cannot regenerate lost state.

### WR-04: Batch chargeback review UI displays premium-based total but server writes `netAmount`-based clawback

**File:** `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx:437, 452, 696`
**Issue:** `toggleProduct` and `selectSale` compute `autoAmount = products.reduce((sum, p) => sum + p.premium, 0)` and display it as the chargeback amount. The summary bar at line 696 sums `Math.abs(Number(r.chargebackAmount))`. However the server ignores this value entirely on the MATCHED path — `routes/chargebacks.ts:219` uses `referenceEntry.netAmount` instead. Payroll staff see one total and commit a different one. For UNMATCHED/MULTIPLE rows where no auto-match runs, the UI-supplied premium-sum is what lands on the chargeback row, which is also wrong (premium ≠ commission).

**Fix:** Either (1) have the UI sum the matched sale's `commission` values from `/api/clawbacks/lookup` (which already returns per-product commission), or (2) display the amount as "Estimated — server will compute final clawback from payroll entry" and drop the per-row amount input. The current state is user-hostile because the review screen's total cannot be reconciled with the audit log.

### WR-05: `ACA child` link not validated in `POST /sales/aca`

**File:** `apps/ops-api/src/routes/sales.ts:171`
**Issue:** The handler accepts `acaCoveringSaleId: parsed.acaCoveringSaleId ?? null` and writes it directly without verifying (a) the parent exists, (b) the parent belongs to the same agent, (c) the parent is still in a valid status. This allows orphan FKs if the parent was deleted between form load and submit, cross-agent ACA linkages, or attaching an ACA child to a DEAD parent. PATCH `/sales/:id` validates this properly; the POST path should too.

**Fix:** After parsing, if `parsed.acaCoveringSaleId` is present:

```ts
const parent = await prisma.sale.findUnique({
  where: { id: parsed.acaCoveringSaleId },
  select: { id: true, agentId: true, status: true },
});
if (!parent) return res.status(404).json({ error: "Covering parent sale not found" });
if (parent.agentId !== parsed.agentId) {
  return res.status(400).json({ error: "ACA child agent must match parent sale agent" });
}
```

### WR-06: Alert approve deduped using member-based `OR` clause can false-positive across batches

**File:** `apps/ops-api/src/services/alerts.ts:158-167`
**Issue:** The dedupe guard looks for an existing clawback with `matchedBy: "member_id" / "member_name"` AND `matchedValue: alert.chargeback?.memberId ?? alert.chargeback?.memberCompany ?? "__none__"`. This correctly catches the auto-match-then-approve path, but when the same member has two legitimate chargebacks (e.g., two separate billing cycles), approving the second alert silently returns the first's clawback and marks the alert `APPROVED` without creating a new clawback. The comment at 152-157 acknowledges tightening was needed; the current version still doesn't constrain on `createdAt >= alert.createdAt` or `NOT clawback.id IN (prior alerts)`.

**Fix:** Constrain the dedupe to clawbacks created AFTER the alert's source chargeback's `createdAt`, OR track `chargebackSubmissionId` on `Clawback` directly and match on that single FK. The latter is cleaner:

```prisma
model Clawback {
  // ...
  chargebackSubmissionId String? @map("chargeback_submission_id")
  chargebackSubmission   ChargebackSubmission? @relation(fields: [chargebackSubmissionId], references: [id])
}
```

Then dedupe becomes a single `findFirst({ where: { chargebackSubmissionId: alert.chargebackSubmissionId } })`.

### WR-07: `ManagerEntry` success toast fires even when bundled ACA creation fails

**File:** `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:460-484`
**Issue:** After the main sale POST returns `2xx`, the code sets "Sale submitted successfully" then conditionally POSTs the bundled ACA child inside a `try/catch` that only `console.error`s on failure. The user sees success while the ACA bundle is silently missing — the very bug pattern CLAUDE.md warns about under "Dashboard error handlers must show status codes."

**Fix:** If the ACA bundle fails, surface it as a warning toast (not error, because the core sale succeeded) and include the status code:

```ts
if (!resp.ok) {
  const err = await resp.json().catch(() => ({}));
  setMsg({
    text: `Sale saved, but ACA bundle failed (${resp.status}): ${err.error ?? "unknown"}. Add the ACA entry manually.`,
    type: "error",
  });
}
```

### WR-08: `calculatePerProductCommission` early-return is logically dead when no products supplied

**File:** `apps/ops-api/src/services/payroll.ts:521-525`
**Issue:** The docstring says "If productIds includes all products or is empty, returns the full payout amount." The implementation:

```ts
if (productIds.length === 0 || productIds.length >= allProductIds.size) {
  const allIncluded = productIds.every(id => allProductIds.has(id));
  if (allIncluded && productIds.length >= allProductIds.size) {
    return fullPayoutAmount;
  }
}
```

When `productIds.length === 0`, the outer `if` is true, the inner `allIncluded` is vacuously `true`, but `0 >= allProductIds.size` is only true when the sale has zero products (impossible). So the empty-list case falls through and produces `totalCommission = 0`, contradicting the docstring. Callers in `routes/payroll.ts:225-231` guard on `productIds.length > 0` before calling, so this is latent, but the next caller will hit it.

**Fix:** Simplify the guard:

```ts
if (productIds.length === 0) return fullPayoutAmount;
const allIncluded = allProductIds.size > 0
  && productIds.length >= allProductIds.size
  && productIds.every(id => allProductIds.has(id));
if (allIncluded) return fullPayoutAmount;
```

### WR-09: Eager `GET /api/sales` on every keystroke in sale picker

**File:** `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:1002-1018`
**Issue:** The UNMATCHED alert picker fires `authFetch(`${API}/api/sales`)` (no query params, no pagination) on every `onChange` once the query length ≥ 2, then client-side filters the full sales list. This is both a correctness issue (no debounce → race conditions where stale responses overwrite newer ones; the last-to-arrive response wins, which may be the older query) and a fragility issue (table size scales unbounded). There is no `AbortController` to cancel in-flight requests.

**Fix:** Add a 300ms debounce and an `AbortController` ref keyed by `alert.id`. Prefer a server-side search endpoint (`GET /api/sales?memberSearch=...`) over client-side filtering of the entire table. Given Phase 47's scope this can be Phase 48 work, but at minimum add the abort-on-change guard now.

## Info

### IN-01: `let alertErrors` should be `const`

**File:** `apps/ops-api/src/routes/chargebacks.ts:318`
**Issue:** `let alertErrors: string[] = [];` is never reassigned. Use `const`.

### IN-02: Duplicate `findMany` inside chargeback transaction

**File:** `apps/ops-api/src/routes/chargebacks.ts:195-198`
**Issue:** `refreshedChargebacks` re-reads the same `batchId` rows that were just written + updated in the loop above. An in-memory map of `{ id, matchStatus, matchedSaleId }` carried through the loop would avoid the second round-trip and remove a subtle ordering assumption (the re-read is not ordered by insert index).

### IN-03: `any[]` in PayrollChargebacks preview mapping

**File:** `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx:388-391`
**Issue:** `const previews: any[] = data.previews;` and the subsequent `.map((p: any, i: number) => ...)` lose type safety. Define a `PreviewResponse` type matching the server's return shape.

### IN-04: `window.alert` instead of toast in mark-unpaid error path

**File:** `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:716`
**Issue:** `alert(err.error || ...)` is inconsistent with the rest of the file, which uses `toast("error", ...)`. Replace for consistency.

### IN-05: `POST /sales/:id/approve-commission` silently defaults to `true` on bad input

**File:** `apps/ops-api/src/routes/sales.ts:737-738`
**Issue:** `const approved = parsed.success ? parsed.data.approved : true;` should return 400 on malformed input rather than silently coercing to `approved=true`. This path is only reachable by roles with PAYROLL or SUPER_ADMIN so abuse risk is low, but the pattern masks client bugs.

### IN-06: `matchedBy` on `Clawback` is a free-form string, not an enum

**File:** `prisma/schema.prisma:396`
**Issue:** `matchedBy String` accepts any value. The dedupe logic in `services/alerts.ts:158-167` depends on the exact literals `"member_id"`, `"member_name"`, `"chargeback_alert"`. A typo in any call site (e.g., `"memberId"`) would silently skip dedupe. Convert to a Prisma enum in the next migration.

### IN-07: `useRef<ReturnType<typeof setTimeout>>()` without initial value

**File:** `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:253, 286-287`
**Issue:** `useRef<...>()` infers `MutableRefObject<... | undefined>` (strictly allowed under React 19 but previously required explicit `undefined`). Initialise to `null` or `undefined` explicitly for clarity:

```ts
const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

### IN-08: Semantic mismatch: variable `acaCarrier` holds a product id, not a carrier name

**File:** `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:271, 461`
**Issue:** `const [acaCarrier, setAcaCarrier] = useState("");` is used at line 461 as `products.find(p => p.id === acaCarrier && p.type === "ACA_PL")` — so the state holds a product id despite being named "carrier". Rename to `acaProductId` to avoid confusion for future maintainers (and mirror `acaStandaloneCarrier` which has the same issue).

---

_Reviewed: 2026-04-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
