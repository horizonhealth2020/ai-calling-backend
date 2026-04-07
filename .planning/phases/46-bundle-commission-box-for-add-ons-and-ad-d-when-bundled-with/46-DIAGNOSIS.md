# 46-DIAGNOSIS: CS chargeback alert surfacing gap

## Trace: CS submission -> payroll alert

1. **CS entry point:** `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx:592` -- submits to `POST /api/chargebacks` with body `{ records, rawPaste, batchId }`.

2. **Server route:** `apps/ops-api/src/routes/chargebacks.ts:91` -- handler `router.post("/chargebacks", ...)`.
   - Does it call `createAlertFromChargeback` (or equivalent)? **NO**. Grep `createAlertFromChargeback` across `apps/` returns ONE result: the function definition in `alerts.ts:6`. There are zero call sites anywhere in the codebase.
   - Does it emit `alerts_batch_created` socket event? **NO**. Grep `alerts_batch_created` across the entire repo returns only planning/research notes (Phase 44 PITFALLS.md, 46-CONTEXT.md, 46-02-PLAN.md). The event was specified in Phase 44 research but **never implemented**. `apps/ops-api/src/socket.ts:101-105` only defines `emitAlertCreated` (single-item, event name `"alert:created"`).
   - What it DOES do: `chargebacks.ts:100-247` runs a transaction that (a) `createMany` chargeback rows, (b) auto-matches by `memberId`, (c) creates `Clawback` rows directly with `matchedBy: "member_id"` (line 221) on the agent's oldest OPEN payroll period, (d) updates the target `PayrollEntry` to `CLAWBACK_APPLIED` or `ZEROED_OUT`. **No `payrollAlert` row is ever created.**

3. **Alert creation (orphaned):** `apps/ops-api/src/services/alerts.ts:6-22` -- function `createAlertFromChargeback`.
   - This is the only function in the codebase that inserts into `payrollAlert` (line 12: `prisma.payrollAlert.create`) and emits `emitAlertCreated` (line 20).
   - It is **dead code**: no caller in `apps/`, only its own definition turns up in grep.

4. **Payroll-side fetch:** `apps/ops-dashboard/app/(dashboard)/payroll/page.tsx:143` -- `GET ${API}/api/alerts`.
   - Server route: `apps/ops-api/src/routes/alerts.ts:11` -- `router.get("/alerts", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), ...)` -> `getPendingAlerts()`.
   - Server filter: `apps/ops-api/src/services/alerts.ts:25-29` -- `prisma.payrollAlert.findMany({ where: { status: "PENDING" }, include: { chargeback: true }, orderBy: { createdAt: "desc" } })`. **No source/origin filter** -- the gap is NOT here.
   - Socket subscription: `payroll/page.tsx:218` -- `socket.on("alert:created", onAlertCreated)`.
   - The payroll dashboard is wired correctly: it fetches `payrollAlert` rows and listens for `"alert:created"`. It would render any alert that exists. **The problem is upstream: no row is ever inserted.**

## Comparison: payroll-originated chargeback (claimed working path)

The plan's premise is that payroll-originated chargebacks DO surface in the alert area while CS-originated ones do NOT. **Tracing the code shows this premise is incorrect.** Both paths share the exact same backend:

- Payroll entry point: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx:478` -- `POST /api/chargebacks` with `{ records: submitRecords, rawPaste: rawText, batchId }`.
- CS entry point: `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx:592` -- `POST /api/chargebacks` with `{ records, rawPaste: rawText, batchId }`.

Both UIs hit the same handler at `chargebacks.ts:91`. There is no branch in the server handler that distinguishes "submitted by payroll" from "submitted by CS". Therefore, **NEITHER path creates a `payrollAlert` row.** The asymmetry the user perceives is a UI artifact:

- A payroll user submitting via `PayrollChargebacks.tsx` immediately sees the chargeback inline in the same UI's submitted-chargebacks list and the corresponding payroll period rows flip to `CLAWBACK_APPLIED` / `ZEROED_OUT`. They mistakenly call this "the alert area working".
- A payroll user looking for chargebacks submitted via CS only checks the dedicated alert badge in `PayrollPeriods.tsx` (driven by `GET /api/alerts`). That badge is empty for both paths, but the user only notices it for the CS path because they didn't see the submission happen.

## Root cause

**(a) Alert record never created.** `chargebacks.ts:91` (`POST /api/chargebacks`) creates `chargebackSubmission` rows and `Clawback` rows directly, but **never invokes `createAlertFromChargeback`**. There is no code path in `apps/` that ever inserts into `payrollAlert`. The alert pipeline (`alerts.ts:6-22`, `socket.ts:101`, `alerts.ts:25` query, `payroll/page.tsx:143` fetch + `218` socket listener) is fully wired downstream of an event that no one ever fires.

Cite: `apps/ops-api/src/routes/chargebacks.ts:91-260` -- the entire POST handler contains zero references to `payrollAlert`, `createAlertFromChargeback`, `emitAlertCreated`, or `alerts_batch_created`.

```ts
// chargebacks.ts:217 -- only insertion that occurs is into Clawback, not PayrollAlert:
const clawback = await tx.clawback.create({
  data: {
    saleId: sale.id,
    agentId: sale.agentId,
    matchedBy: cb.memberId ? "member_id" : "member_name",
    ...
  },
});
```

Note also that the assumption "Phase 44 introduced `alerts_batch_created`" is **wrong** -- the event was specified in Phase 44 research/pitfalls but never implemented in `socket.ts`. Only the per-item `emitAlertCreated` exists.

## Minimal fix

**File:** `apps/ops-api/src/routes/chargebacks.ts`
**Function:** `router.post("/chargebacks", ...)` (line 91)
**Location:** Inside the `for (const cb of refreshedChargebacks)` loop at line 195, after a chargeback is determined to be `MATCHED` and its `Clawback` row is created (after line 240), and before `auditPayloads.push`.

**Change:** For each matched chargeback that produces a clawback, also insert a `payrollAlert` row so the chargeback surfaces in the payroll dashboard alert area. Because the existing handler immediately creates the clawback (does not wait for human approval), the alert row should be inserted with `status: "APPROVED"` and the existing approval fields populated, AND `getPendingAlerts()` query in `alerts.ts:25` must be relaxed so the payroll alert area shows recently-handled alerts -- NOT just `PENDING`.

After thinking this through more carefully, the cleanest minimal fix that preserves the existing approve/clear semantics and the `chargeback_alert` dedupe guard is:

1. **In `chargebacks.ts` post-transaction (after line 247, before audit log writes):** for each entry in a new `alertPayloads` array collected inside the transaction (sale + agent name + member name + amount), call `createAlertFromChargeback(cb.id, agentName, memberName, amount)`. This inserts a `payrollAlert` row in `PENDING` state and emits `alert:created`. The payroll dashboard already listens to that event and refetches.

2. **Dedupe-safety guard:** Because the batch handler already creates the `Clawback` directly, an unwary payroll user could click "Approve" on the new alert and create a SECOND clawback. To prevent this, add a one-line check at the top of `approveAlert` in `alerts.ts:32`: if a clawback already exists for the alert's `chargebackSubmissionId.matchedSaleId` with `matchedBy IN ("member_id","member_name","chargeback_alert")`, skip clawback creation and just mark the alert APPROVED. (This is a tiny extension of the existing dedupe at lines 70-79.)

3. **No changes to `alerts.ts:6-22`** -- `createAlertFromChargeback` already exists and is correct.
4. **No socket transport change** -- continue using `emitAlertCreated` / `"alert:created"`. (The plan's reference to `alerts_batch_created` is based on a false assumption -- that event was never implemented. Per D-07 we are told NOT to change the socket transport, so we leave the existing `"alert:created"` event as-is.)

**Concrete diff sketch (Task 2):**

```ts
// chargebacks.ts -- inside the matched-chargeback loop, alongside the clawback create:
const matchedSale = sale; // already loaded above with agent include? -- need to add agent: true to include
const alertPayload = {
  chargebackId: cb.id,
  agentName: matchedSale.agent?.name,
  memberName: matchedSale.memberName,
  amount: chargebackAmount,
};
alertPayloadsToEmit.push(alertPayload);

// Then AFTER tx commit, post-commit side effects block:
for (const p of alertPayloadsToEmit) {
  await createAlertFromChargeback(p.chargebackId, p.agentName, p.memberName, p.amount);
}
```

And in `chargebacks.ts:200`, extend the existing `include` to load the agent: `include: { payrollEntries: true, product: true, addons: { include: { product: true } }, agent: true }`.

And in `alerts.ts:approveAlert`, extend the dedupe guard at lines 70-79 to also catch `matchedBy: "member_id"` and `matchedBy: "member_name"` clawbacks on the same `saleId`:

```ts
const existingClawback = await prisma.clawback.findFirst({
  where: {
    saleId,
    OR: [
      { matchedBy: "chargeback_alert", matchedValue: alert.chargebackSubmissionId },
      { matchedBy: { in: ["member_id", "member_name"] } }, // batch-created clawback
    ],
  },
});
if (existingClawback) {
  // Don't double-clawback. Just mark the alert APPROVED so it leaves the pending queue.
  return prisma.payrollAlert.update({
    where: { id: alertId },
    data: { status: "APPROVED", approvedPeriodId: resolvedPeriodId, approvedBy: userId, approvedAt: new Date() },
  });
}
```

## Impact surface

Task 2 will need to touch exactly 2 files:
1. `apps/ops-api/src/routes/chargebacks.ts` -- import `createAlertFromChargeback` from `../services/alerts`; add the agent include to the sale lookup; collect `alertPayloadsToEmit` inside the tx; emit them post-commit.
2. `apps/ops-api/src/services/alerts.ts` -- extend the dedupe guard in `approveAlert` to also match `matchedBy IN ("member_id","member_name")` on the same `saleId`, and convert the existing throw into a graceful "already-clawed-back, just mark approved" path.

**No changes to:**
- `prisma/schema.prisma` (no new column, no migration)
- `apps/ops-api/src/socket.ts` (continue using `emitAlertCreated`)
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx` (UI is fine; it's the chargeback creation form, not the alert area)
- `apps/ops-dashboard/app/(dashboard)/payroll/page.tsx` (already fetches `/api/alerts` and listens to `"alert:created"`)
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` (CS UI is fine; same endpoint)

**Note on plan premise:** The PLAN.md framing assumes payroll-originated chargebacks DO surface alerts and CS-originated ones DO NOT, with the gap being a CS-specific bug. The code-level evidence shows BOTH paths skip alert creation -- this is not a CS regression but a never-implemented feature in the shared `chargebacks.ts` POST handler. The fix is the same minimal change either way (wire `createAlertFromChargeback` into the shared handler), but the framing is worth flagging for human verification at Task 3 -- the regression check ("payroll path still works") is moot because the payroll path was never producing alerts to begin with. After the fix, BOTH paths will produce alerts, which is the intended end state.
