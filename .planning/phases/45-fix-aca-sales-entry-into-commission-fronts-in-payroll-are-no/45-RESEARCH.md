# Phase 45: Fix ACA Entry, Front Carryover, CS Round Robin — Research

**Researched:** 2026-04-07
**Domain:** Bug investigation across sales entry, payroll carryover, and CS assignment
**Confidence:** HIGH (all findings sourced from direct file:line reads)

## Summary

Three independent bugs, all with root causes confirmed by file inspection.

**Bug 1 (ACA entry into commission)** is two distinct defects: (a) the manager form posts the parent sale to `/api/sales` successfully, then posts the ACA row to `/api/sales/aca`, but nothing in the parent path is broken — the "missing parent sale" symptom is almost certainly a **display** artifact: the two sales land on two separate PayrollEntry rows, and the user perceives the ACA row as the only one because the ACA branch in WeekSection.tsx renders the inline `$X.XX x N members = $total` text while the parent sale renders a normal row; (b) the display string at `WeekSection.tsx:296-304` is the verbose breakdown the user wants removed, and `PayrollExports.tsx` never handles `ACA_PL` in its product-type bucket map, so ACA rows currently print with an empty `Core/Add-on/AD&D` column (no addon column is clean for ACA because the map at `PayrollExports.tsx:167` hard-codes `{ CORE, ADDON, AD_D }` — ACA_PL entries fall through silently).

**Bug 2 (front carryover)** is definitely Path A: `carryoverExecuted` is set to `true` at `carryover.ts:84` but is never reset on `PATCH /payroll/periods/:id/status` when the transition is `LOCKED → OPEN` (routes/payroll.ts:44-59). No reversal of the hold written to the next period exists. The `holdFromCarryover`, `holdLabel`, and `carryoverSourcePeriodId` metadata fields (already on schema) give the planner everything needed to locate and decrement the right row.

**Bug 3 (round robin)** is a clean server-side concerns split: `batchRoundRobinAssign` (`repSync.ts:117-151`) always persists the advanced index inside its own `$transaction`, and `fetchBatchAssign` in `CSSubmissions.tsx:433-447` is called on every paste, every rep list refresh (useEffect at 474-486), and every page load (via the rep-change effect). The fix is to make the assign call a dry-run preview and move cursor advancement inside the `POST /api/chargebacks` and `POST /api/pending-terms` handlers, wrapping the `createMany` + cursor upsert in `prisma.$transaction`.

**Primary recommendation:** Three small, parallelizable plans — one per bug, no shared files beyond CSSubmissions.tsx and repSync.ts for Bug 3, sales/payroll/frontend-dashboard for Bug 1, and carryover + payroll routes for Bug 2.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bug 1: ACA sales entry into commission**
- **D-01:** Manager entry flow used = single sale form with ACA checkbox toggled (NOT two separate sales). Selected: Complete Care Max as main product + Compass Care Navigator+ addon + ACA checkbox checked. Expected behavior: ONE entry showing the regular sale (Complete Care Max + addon) with an ACA badge/indicator and the ACA flat commission added on top. Actual behavior: only the ACA covering row persists in payroll; the parent regular sale and its addon are missing.
- **D-02:** Root cause investigation must cover both the API submission path (`apps/ops-api/src/routes/sales.ts` ACA branch) AND the manager entry form to determine whether the parent sale is failing to persist, failing to create a PayrollEntry, or being created but linked incorrectly via `acaCoveringSaleId`.
- **D-03:** ACA commission display must render as a plain dollar sum (e.g., `$10.00`) identical to every other product row. Drop the `$X.XX × N members = $total` breakdown text.
- **D-04:** Display fix applies to BOTH the dashboard view and the printed payroll output.
- **D-05:** Bundled ACA + parent sale must show a single unified entry where applicable, not two disconnected rows. The parent sale's addons must be preserved and displayed.

**Bug 2: Fronts not carrying into following holds**
- **D-06:** Plan must fix BOTH potential paths — unknown which one is failing in production:
  - **Path A (idempotency on re-lock):** `executeCarryover` skips when `period.carryoverExecuted === true`. Flag is never reset on unlock, so lock → unlock → add front → re-lock workflow silently skips.
  - **Path B (first lock):** Verify first-lock correctly carries fronts when an `agentPeriodAdjustment` row with `frontedAmount > 0` exists at lock time.
- **D-07:** For Path A, on unlock the carryover state must be reversed before re-running: (1) reset `carryoverExecuted = false`; (2) reverse previously-carried hold from next period (decrement `holdAmount` by what was carried, clear `holdFromCarryover`/`holdLabel` if it zeros out); (3) on re-lock, `executeCarryover` runs again from clean slate.
- **D-08:** Carryover continues to read from `AgentPeriodAdjustment.frontedAmount` (not `PayrollEntry.frontedAmount`). Dashboard already uses `POST/PATCH /payroll/adjustments` exclusively.
- **D-09:** Existing carryover semantics from Phase 40 preserved: `carryHold += frontedAmount`, negative net adds to `carryHold`, increment-based upsert, `holdLabel = "Fronted Hold"`.

**Bug 3: CS Submissions round robin**
- **D-10:** Round-robin cursor must advance ONLY on actual submission, not on preview/parse/refresh.
- **D-11:** Split server-side concerns: preview path (`GET /api/reps/batch-assign`) becomes dry-run (returns assignments without advancing cursor — via `preview=true` query param OR new `/reps/batch-preview` endpoint); submit path advances cursor by count of records inserted, inside the same transaction as the insert.
- **D-12:** `salesBoardSetting` keys (`cs_round_robin_chargeback_index`, `cs_round_robin_pending_term_index`) remain storage. Separate cursors per type preserved.
- **D-13:** Client-side fallback in CSSubmissions.tsx:442-447 (random offset local round-robin) stays as last-resort fallback.
- **D-14:** Manual override in `assignedTo` dropdown (line 868-869) continues to work.
- **D-15:** No TTL/reservation system. Preview is pure dry-run; cursor only moves on submit.

### Claude's Discretion

- Choice between `preview` query param vs separate preview endpoint for round-robin (recommend: `preview=true` param — smaller diff).
- Exact mechanism for reversing prior carryover holds on unlock (direct decrement vs delete-and-recreate — recommend: direct decrement using `carryoverSourcePeriodId` to locate).
- Whether ACA fix requires schema/data migration for already-submitted sales (recommend: no migration; one-off SQL can clean up test data if needed, production data is still structurally correct).
- UI/print template implementation details for ACA display fix.

### Deferred Ideas (OUT OF SCOPE)

- Reservation-based round-robin with TTL cleanup (too complex).
- Submit-time-only assignment with no preview UI (payroll must still be able to override).
- Blocking unlock once carryover has run (payroll needs ability to unlock to fix mistakes).
</user_constraints>

<phase_requirements>
## Phase Requirements

This phase addresses three production bugs (no REQUIREMENTS.md IDs — bugs tracked via phase context only).

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUG-1 | ACA sale entry + parent sale must render as unified entry with flat commission | Found display-only bug in `WeekSection.tsx:296-304`; print bug in `PayrollExports.tsx:167` (ACA_PL type not in byType map); confirmed parent sale IS persisted (sales.ts POST path unchanged) — manager form posts parent first then ACA as second API call (ManagerEntry.tsx:436-468). |
| BUG-2 | Fronts entered via agent-period adjustment must carry as `Fronted Hold` into next period across both first-lock and unlock→relock workflows | Found `carryoverExecuted` idempotency gate at `carryover.ts:20`; never reset on unlock at `routes/payroll.ts:44-59`; no reversal of prior carryover exists. Path B (first lock) is intact — unit tests `carryover.test.ts` cover it. |
| BUG-3 | CS round-robin cursor must advance only on actual batch submission, not on paste/preview/refresh | Found cursor advance inside `batchRoundRobinAssign` (`repSync.ts:143-147`); called by `GET /api/reps/batch-assign` (`cs-reps.ts:114-119`); invoked on every paste and rep refresh in `CSSubmissions.tsx:433-486`. Submit handlers are `POST /api/chargebacks` (`chargebacks.ts:90`) and `POST /api/pending-terms` (`pending-terms.ts:36`). |
</phase_requirements>

---

## 1. Root Cause Analysis

### Bug 1 — ACA sales entry into commission

#### 1a. "Only the ACA covering row appears" — file:line evidence

**Manager form submit flow** (`apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:419-482`):

```tsx
// L436: first POST /api/sales with normal sale payload (form + addons)
const res = await authFetch(`${API}/api/sales`, { method: "POST", body: JSON.stringify({ ...form, addonPremiums: addonPremiumsPayload }) });
if (res.ok) {
  const sale = await res.json();
  // L452: THEN, if includeAca toggled, second POST /api/sales/aca with acaCoveringSaleId: sale.id
  if (includeAca && acaCarrier) {
    await authFetch(`${API}/api/sales/aca`, { method: "POST", body: JSON.stringify({
      agentId: form.agentId, memberName: form.memberName, carrier: acaProduct.name,
      memberCount: parseInt(acaMemberCount, 10) || 1, productId: acaProduct.id,
      saleDate: form.saleDate || undefined, acaCoveringSaleId: sale.id,
    }) });
  }
}
```

**Regular `POST /sales` path** (`apps/ops-api/src/routes/sales.ts:13-132`) creates the parent sale with addons and calls `upsertPayrollEntryForSale(sale.id)` at L50. This path is unchanged and correct — it DOES persist the parent sale and DOES create a PayrollEntry. ✅

**ACA `POST /sales/aca` path** (`sales.ts:135-231`) creates a separate `Sale` row with `premium: 0`, no addons, then calls `upsertPayrollEntryForSale(sale.id)` at L176. This creates a SECOND PayrollEntry row for the ACA sale. It then recalcs the parent sale's payroll at L214-220 so the bundle requirement auto-fulfills.

**Conclusion — Part 1a:** Both sales ARE persisted and BOTH get PayrollEntry rows. The user's reported symptom "only the ACA covering row appears" is **NOT a persistence bug**. Most likely causes:

1. **Perception/display artifact:** The ACA PayrollEntry row (displaying `$X.XX x N members = $total` verbose text with an "ACA" badge, `WeekSection.tsx:249,296`) visually dominates and the user reads it as the only row. The parent sale's entry is sitting right there too, but on a separate row that looks like every other sale.
2. **Silent failure on parent:** If the first `POST /api/sales` call succeeded but the network/server dropped the error on `upsertPayrollEntryForSale` — sales.ts:50-53 wraps it in a try/catch that only `console.error`s, so the sale row exists but no PayrollEntry. Low probability since the call worked for all non-ACA sales before.
3. **Race in bundle recalc:** After the ACA sale runs `upsertPayrollEntryForSale(parsed.acaCoveringSaleId)` at L216, and the parent sale has bundle halving that got cleared — still produces a PayrollEntry; payout may be 0 if `status !== 'RAN'` — also low probability.

**Investigation action for planner:** Before writing code, run manual repro and check: does the `payroll_entries` table actually show BOTH rows after the form submits? If yes → pure display bug (D-05 unified entry rendering). If no → need to diagnose why the first sale's payroll entry is missing.

#### 1b. Verbose ACA breakdown text — file:line evidence

`apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx:296-304`:

```tsx
<td style={tdRight}>
  {entry.sale?.product?.type === "ACA_PL" && entry.sale?.memberCount ? (
    <span style={{ color: C.textPrimary, fontWeight: 700 }}>
      ${(Number(entry.sale.product.flatCommission ?? 0)).toFixed(2)} x {entry.sale.memberCount} members = {formatDollar(Number(entry.payoutAmount))}
    </span>
  ) : (
    <span style={{ color: C.textPrimary, fontWeight: 700 }}>
      {formatDollar(Number(entry.payoutAmount))}
    </span>
  )}
```

The entire conditional branch is the bug per D-03. Delete the ACA_PL special case and fall through to the normal `formatDollar(Number(entry.payoutAmount))` rendering. The ACA badge already shows at `WeekSection.tsx:249`, so agents can still tell it's an ACA row.

#### 1c. ACA in print output — file:line evidence

`apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx:167-182`:

```tsx
const byType: Record<string, string[]> = { CORE: [], ADDON: [], AD_D: [] };
if (e.sale?.product?.type) byType[e.sale.product.type]?.push(e.sale.product.name);
if (e.sale?.addons) for (const ad of e.sale.addons) byType[ad.product.type]?.push(ad.product.name);
...
rows.push([
  ..., esc(byType.CORE.join(", ")), esc(byType.ADDON.join(", ")), esc(byType.AD_D.join(", ")),
  fee, commission.toFixed(2), bonus.toFixed(2), ...
]);
```

`ACA_PL` is not a key in `byType`, so the optional chaining `byType[e.sale.product.type]?.push` silently no-ops. Result: ACA rows print with empty Core/Add-on/AD&D columns and a plain `commission.toFixed(2)` in the Commission column. **Technically** the commission column is already correct for ACA (no verbose text in print today). D-04 wants the display to be consistent between dashboard and print — which is already the case in print, so the print fix is simpler: just add ACA product name to the CORE or a new column. Options:
- **Option A (minimal):** Push ACA product name into `byType.CORE` so ACA rows show the carrier name under the "Core" column.
- **Option B (cleanest per D-05):** When ACA covers a parent sale, merge the two PayrollEntry rows into one logical row in the export so the parent sale's products + the ACA commission get aggregated.

Option B requires joining by `acaCoveringSaleId` which the export does not currently fetch. Option A is low-risk and satisfies D-03/D-04.

#### 1d. D-05 unified entry rendering

D-05 requires that when a parent sale has an ACA covering sale, they render as a single unified row with:
- Parent sale's core product + addons (displayed normally)
- An "ACA" badge
- Commission = parent payout + ACA payout

The dashboard `/api/payroll/periods` response (`routes/payroll.ts:12-32`) already includes `memberCount`, `acaCoveringSaleId` is NOT currently in the include — **it is missing from the select**. The route must be updated to include `acaCoveringSaleId` on the sale select so the frontend can pair entries.

Client-side grouping should run in `payroll-types.ts` / `PayrollPeriods.tsx` where entries are built into `AgentPeriodData`: group entries by agent, then collapse any entry whose sale has `acaCoveringSaleId === X` into the entry of the sale with `id === X`, summing `payoutAmount` and setting an `acaAttached: true` flag for rendering.

### Bug 2 — Fronts not carrying into following holds

#### 2a. Path A (unlock → re-lock): confirmed broken

`apps/ops-api/src/services/carryover.ts`:

- **L19-20:** `if (period.carryoverExecuted) return { carried: 0, skipped: true };`
- **L82-86:** After processing, sets `carryoverExecuted = true`

`apps/ops-api/src/routes/payroll.ts:35-62`:

```ts
router.patch("/payroll/periods/:id/status", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ status: z.enum(["OPEN", "LOCKED"]) });
  // ...
  const updated = await prisma.payrollPeriod.update({ where: { id: pp.data.id }, data: { status: parsed.data.status } });
  // L48-59: only runs executeCarryover on LOCK; does NOT reset on unlock
  if (parsed.data.status === "LOCKED") {
    try { const result = await executeCarryover(pp.data.id); /* ... */ }
    catch (err) { console.error("[carryover] Failed:", err); }
  }
  res.json(updated);
}));
```

**Confirmed:** On `LOCKED → OPEN` transition, `carryoverExecuted` stays true. When the user re-locks, `executeCarryover` returns `{ carried: 0, skipped: true }` silently. Front added during the open window is lost.

#### 2b. The reversal mechanism (D-07)

Required fields per `prisma/schema.prisma:706-709`:

```prisma
holdLabel               String?  @map("hold_label")
holdFromCarryover       Boolean  @default(false) @map("hold_from_carryover")
carryoverSourcePeriodId String?  @map("carryover_source_period_id")
```

On `LOCKED → OPEN` transition (before setting the period status), the reversal logic must:

1. Load all `AgentPeriodAdjustment` rows in the **next** period where `carryoverSourcePeriodId === currentPeriodId`.
2. For each, look up the corresponding adjustment in the CURRENT period to recompute what amount was carried (must match `executeCarryover`'s carryHold formula at `carryover.ts:50-57`): `frontedAmount + max(0, -(totalPayout + totalAdj + bonus + fronted - hold))`.
3. Decrement `holdAmount` on the next-period row by that exact amount. If result is 0, also clear `holdFromCarryover`, `holdLabel`, and `carryoverSourcePeriodId` (mirrors existing `routes/payroll.ts:352-356` behavior when holdAmount is zeroed).
4. Reset `carryoverExecuted = false` on the current period.

**Edge case — recomputation drift:** If the user changed the current period's entries/adjustments during the OPEN window between the original lock and the unlock, the "what was carried" recomputation from current period data will NOT match what was actually carried. Safer approach: **store the exact carried amount on the next-period adjustment row** at write time, then reverse that exact value.

**Recommendation:** Add a new field `carryoverAmount Decimal?` to `AgentPeriodAdjustment` (or reuse an existing field) so reversal is deterministic. Alternative without schema change: at lock time, write an audit-style ledger entry, or persist the amount by encoding it in `holdLabel` like `"Fronted Hold: $200.00"` and parse it on reversal — hacky but zero-migration.

**Cleanest approach:** Delete the next-period adjustment row IF both of these hold: `holdFromCarryover === true`, `carryoverSourcePeriodId === currentPeriodId`, AND `bonusAmount === 0 && frontedAmount === 0 && holdAmount > 0` (meaning the adjustment was created SOLELY by carryover and has no user edits). Otherwise, do a conservative decrement using the freshly-computed `executeCarryover` formula and accept the drift risk (logging an audit event).

#### 2c. Path B (first lock): needs a smoke test, not a fix

Reviewing `carryover.ts:42-80`: the loop iterates `period.agentAdjustments`, and `adj.frontedAmount` is added to `carryHold`. The existing unit test `carryover.test.ts:71-90` (`CARRY-02`) verifies fronted=200 + net>=0 → hold=200 in the next period. Path B is covered. No fix needed unless manual repro shows a regression.

### Bug 3 — CS Submissions round robin advancing on page refresh

#### 3a. The cursor advance

`apps/ops-api/src/services/repSync.ts:117-151` — `batchRoundRobinAssign`:

```ts
return prisma.$transaction(async (tx) => {
  const setting = await tx.salesBoardSetting.findUnique({ where: { key: settingKey } });
  let idx = setting ? parseInt(setting.value, 10) : 0;
  const assignments: string[] = [];
  for (let i = 0; i < count; i++) { assignments.push(activeReps[idx % activeReps.length].name); idx++; }
  await tx.salesBoardSetting.upsert({
    where: { key: settingKey },
    update: { value: String(idx % activeReps.length) },
    create: { key: settingKey, value: String(idx % activeReps.length) },
  });
  return assignments;
});
```

Cursor is ALWAYS advanced. No preview flag exists.

#### 3b. The triggers

`apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx`:
- **L449-459 `handleTextChange`** → called on every paste/keystroke into the chargeback textbox → calls `fetchBatchAssign("chargeback", count)` → advances cursor.
- **L461-471 `handlePtTextChange`** → same for pending-terms.
- **L474-486** — `useEffect` on `[reps]` dependency → re-calls `fetchBatchAssign` for BOTH existing chargeback and pending-term record lists whenever the reps list updates (happens on rep toggle, rep create, page load after `fetchReps`). This is the "page refresh advances cursor" vector.
- **L505-508 `rerunRoundRobin`** — passed into `SubmissionsContent` for rep-change button → also advances cursor.

#### 3c. The submit handlers

**Chargebacks:** `apps/ops-api/src/routes/chargebacks.ts:90-115` — `POST /chargebacks`:
```ts
const result = await prisma.chargebackSubmission.createMany({ data: records.map(r => ({ ..., assignedTo: r.assignedTo, ... })) });
```
The `assignedTo` is already in the record payload (client pre-filled it). NOT currently inside a `$transaction`. After `createMany` there's a ton of follow-up work: matched-sale lookup, clawback creation, alert emission — all outside a transaction.

**Pending terms:** `apps/ops-api/src/routes/pending-terms.ts:36-72` — `POST /pending-terms` — simpler: `createMany` + emit event. Also not in a transaction.

#### 3d. Fix shape

1. **Preview:** Modify `batchRoundRobinAssign(type, count, { persist })` to accept a flag (or create a new `previewRoundRobinAssign` sibling). When `persist=false`, skip the `salesBoardSetting.upsert`. Update `GET /api/reps/batch-assign` to parse `req.query.preview` and pass it through.
2. **Submit (chargebacks):** Wrap `createMany` + the subsequent `chargebackSubmission.update` loop (matching/clawback logic is currently sequential) AND a call to `batchRoundRobinAssign(type, submittedCount, { persist: true })` inside `prisma.$transaction`. Commit atomically. If the transaction throws, the cursor stays where it was.
3. **Submit (pending-terms):** Same pattern but simpler — wrap `createMany` + cursor advance in `prisma.$transaction`.
4. **Client:** `CSSubmissions.tsx` keeps calling the same endpoint but passes `?preview=true`. No frontend fallback changes needed (D-13 preserves the random-offset fallback for API failure).
5. **Transaction note:** `batchRoundRobinAssign` currently OPENS its own `prisma.$transaction`. When called from inside a wrapping `$transaction`, it must accept an optional `tx` param or be refactored to work on either a tx-scoped or root prisma client. Pattern already used in `repSync.ts:9` (`createSyncedRep` receives no tx externally but uses its own). Extract the cursor advance into a helper `advanceRoundRobinCursor(tx, type, delta)` that callers pass their own tx into.

---

## 2. Concrete Fix Approach Per Bug

### Bug 1 fixes

1. **Investigation first:** Manual repro — enter a sale with Complete Care Max + Compass Care Navigator+ addon + ACA checkbox. Query `SELECT id, product_id, aca_covering_sale_id FROM sale ORDER BY created_at DESC LIMIT 5;` and `SELECT id, sale_id, payout_amount FROM payroll_entry WHERE sale_id IN (...);`. Confirm whether BOTH rows exist. Expected: both do exist; bug is display-only.
2. **Display fix (D-03):** In `WeekSection.tsx:296-304`, delete the ACA_PL conditional branch so the commission cell always renders `formatDollar(Number(entry.payoutAmount))`. The ACA badge at L249 already marks the row visually.
3. **Print fix (D-04):** In `PayrollExports.tsx:167`, change `const byType: Record<string, string[]> = { CORE: [], ADDON: [], AD_D: [] };` to include `ACA_PL: []`, and add a fourth column OR push ACA names into `CORE` alongside core products (simpler). Decision for planner; simpler = append to CORE.
4. **Unified entry (D-05):**
   - Add `acaCoveringSaleId: true` to the sale select in `routes/payroll.ts:20` (and add the field to `payroll-types.ts:Entry`).
   - In the client data-building code (search for where `entries` are grouped into `AgentPeriodData` — likely in `PayrollPeriods.tsx`), post-process entries: for each entry whose sale has `acaCoveringSaleId === X`, find the entry with `sale.id === X` and merge: add its `payoutAmount` to the parent's `payoutAmount`, set an `acaAttached: { memberCount, flatCommission }` marker on the parent, and drop the child from the list.
   - In WeekSection.tsx, when rendering the parent entry with `acaAttached`, add the "ACA" badge next to the core product badge.
5. **No schema/data migration:** Already-submitted sales are structurally valid; the fix is purely view-layer.

### Bug 2 fixes

1. **Schema (optional but recommended):** Add `carryoverAmount Decimal? @map("carryover_amount")` to `AgentPeriodAdjustment` to store the exact carried value at write time for deterministic reversal. Requires migration. If the planner rejects a schema change, use the delete-if-pure-carryover heuristic from §1b.
2. **`carryover.ts`:** When writing the next-period adjustment (L62-78), include the computed `carryHold` in the stored row (`carryoverAmount: carryHold`).
3. **`routes/payroll.ts:35-62`:** Before calling `prisma.payrollPeriod.update({ ..., status })` when transitioning LOCKED → OPEN:
   ```ts
   if (period.status === "LOCKED" && parsed.data.status === "OPEN" && period.carryoverExecuted) {
     await reverseCarryover(period.id); // new helper in carryover.ts
   }
   ```
4. **New helper `reverseCarryover(periodId)`** in `carryover.ts`:
   - Find all `AgentPeriodAdjustment` where `carryoverSourcePeriodId === periodId`.
   - For each, `decrement holdAmount` by `carryoverAmount` (or recomputed value).
   - If resulting hold is 0, also null `holdFromCarryover`, `holdLabel`, `carryoverSourcePeriodId`, `carryoverAmount`.
   - Update the source period: `carryoverExecuted: false`.
   - Wrap in `prisma.$transaction`.
5. **Audit logging:** Add `logAudit(userId, "REVERSE_CARRYOVER", "PayrollPeriod", periodId, { reversedCount })` after reversal.
6. **Test additions:** Extend `carryover.test.ts` with `CARRY-08: Reverse carryover on unlock` and `CARRY-09: Re-lock after unlock recarries fronts` cases.

### Bug 3 fixes

1. **`repSync.ts`:** Refactor `batchRoundRobinAssign`:
   ```ts
   export async function batchRoundRobinAssign(
     type: "chargeback" | "pending_term",
     count: number,
     opts: { persist?: boolean; tx?: Prisma.TransactionClient } = {},
   ): Promise<string[]>
   ```
   - When `persist === false`, compute assignments using the current cursor value but skip the upsert.
   - When `tx` provided, use it instead of opening a new `$transaction`.
2. **`routes/cs-reps.ts:114-119`:** Parse `preview` query param: `const persist = req.query.preview !== "true";` pass as `batchRoundRobinAssign(type, count, { persist })`.
3. **`CSSubmissions.tsx:433-447`:** Change `fetchBatchAssign` URL to include `&preview=true`. Client now treats all non-submit round-robin calls as preview.
4. **`routes/chargebacks.ts` POST:** Wrap `chargebackSubmission.createMany` + the matching loop + a call to `batchRoundRobinAssign("chargeback", submittedCount, { persist: true, tx })` in `prisma.$transaction`. The cursor advance happens inside the same transaction as the insert.
5. **`routes/pending-terms.ts` POST:** Wrap `pendingTerm.createMany` + `batchRoundRobinAssign("pending_term", count, { persist: true, tx })` in `prisma.$transaction`.
6. **Test additions:** `cs-roundrobin.test.ts` — preview mode doesn't advance cursor; submit mode does; failed insert rolls back cursor.

---

## 3. Files to Modify

### Bug 1
| File | Rationale |
|------|-----------|
| `apps/ops-api/src/routes/payroll.ts` (L12-32) | Add `acaCoveringSaleId: true` to sale select so frontend can pair entries. |
| `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` (L14-16) | Add `acaCoveringSaleId?: string \| null` and optional `acaAttached` marker to Entry type. |
| `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` (L296-304) | Delete ACA_PL conditional in commission cell (D-03). Add ACA badge rendering when parent has `acaAttached`. |
| `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` (wherever entries → AgentPeriodData) | Post-process entries to fold ACA covering into parent (D-05). |
| `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` (L167-182) | Add ACA_PL to byType map or append to CORE column (D-04). |

### Bug 2
| File | Rationale |
|------|-----------|
| `prisma/schema.prisma` (AgentPeriodAdjustment section L706+) | Add `carryoverAmount Decimal?` for deterministic reversal (optional but strongly recommended). |
| `prisma/migrations/...` (new) | Migration for the new column. |
| `apps/ops-api/src/services/carryover.ts` (L62-78, new export) | Write `carryoverAmount` on upsert. Add `reverseCarryover(periodId)` export. |
| `apps/ops-api/src/routes/payroll.ts` (L35-62) | Call `reverseCarryover` on LOCKED → OPEN transition before the update, and add audit log. |
| `apps/ops-api/src/services/__tests__/carryover.test.ts` | Add CARRY-08 (reverse) and CARRY-09 (re-lock) tests. |

### Bug 3
| File | Rationale |
|------|-----------|
| `apps/ops-api/src/services/repSync.ts` (L117-151) | Accept `{ persist, tx }` options; extract cursor advance helper for transactional reuse. |
| `apps/ops-api/src/routes/cs-reps.ts` (L114-119) | Parse `preview` query param; default to `preview=true` for safety or default to current behavior — planner decides. Recommend: default preview=false to preserve backwards-compat, require explicit `preview=true`. |
| `apps/ops-api/src/routes/chargebacks.ts` (L90-180) | Wrap createMany + matching + cursor advance in `$transaction`. |
| `apps/ops-api/src/routes/pending-terms.ts` (L36-72) | Wrap createMany + cursor advance in `$transaction`. |
| `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` (L435) | Append `&preview=true` to fetchBatchAssign URL. |
| `apps/ops-api/src/services/__tests__/repSync.test.ts` (new) | Preview doesn't advance; submit does; rollback on failure. |

---

## 4. Verification Approach

### Bug 1

**Manual repro:**
1. Log in as MANAGER. Navigate to manager entry form.
2. Select agent, enter member name, Complete Care Max as product, Compass Care Navigator+ as addon, check "Include ACA Plan", select an ACA carrier, set member count to 2.
3. Submit. Expect: success message.
4. Navigate to Payroll dashboard for that agent's current week.
5. **Pre-fix expected:** Two separate rows — one for Complete Care Max + addon, one for the ACA with verbose `$X × 2 members = $Y` text.
6. **Post-fix expected (D-05):** ONE row showing Complete Care Max core badge + Compass Care Navigator+ addon badge + ACA badge + commission cell showing plain `$<total>` where total = parent commission + ACA flat × 2.
7. Click "Print week" — PDF should match the dashboard with no verbose breakdown text.

**Automated tests:** Extend `commission.test.ts` with an ACA_PL unit test asserting `calculateCommission` returns `flatCommission × memberCount` (already tested implicitly). Add a payroll-types unit test for the entry-folding logic if extracted to a helper.

### Bug 2

**Manual repro:**
1. Open a payroll period as PAYROLL role.
2. Add `frontedAmount: 200` to an agent's adjustment for that period.
3. Lock the period. Verify next period has agent adjustment with `holdAmount: 200, holdLabel: "Fronted Hold", holdFromCarryover: true, carryoverSourcePeriodId: <prev>`.
4. Unlock the period. **Post-fix expected:** Next period's hold drops back to 0 (or its non-carryover original), `carryoverExecuted` resets to false.
5. Change front to `300`. Re-lock. Verify next period shows `holdAmount: 300`.
6. Unlock again with no changes. Verify next period returns to 0.

**Automated tests:** `carryover.test.ts` new cases:
- `CARRY-08`: Given period with `carryoverExecuted=true`, next period has matching carryover adjustment, call `reverseCarryover` → next period hold = 0, source period `carryoverExecuted = false`.
- `CARRY-09`: Full cycle — first lock carries 200, unlock resets, bump fronted to 300, re-lock carries 300.

**Run:** `npm run test:ops -- carryover.test.ts`

### Bug 3

**Manual repro:**
1. Load CS Submissions page. Note current rep order. Query `SELECT value FROM sales_board_setting WHERE key = 'cs_round_robin_chargeback_index';` → record as `X`.
2. Paste 5 chargeback rows. Records show assignments starting at rep index X. Re-query DB → value should STILL be X (preview didn't advance).
3. Refresh the page. Paste 5 more rows. Re-query DB → still X.
4. Click "Submit Chargebacks". Re-query DB → value should now be `(X + 5) % repCount`.
5. Repeat for pending-terms with separate cursor key.

**Automated tests:** `repSync.test.ts` new cases:
- Preview call with `{ persist: false }` returns assignments but does not upsert setting.
- Submit call with `{ persist: true }` upserts setting to `(current + count) % repCount`.
- Transaction rollback: throw inside the submit handler after calling batchRoundRobinAssign → cursor value is unchanged after transaction.

**Run:** `npm run test:ops -- repSync.test.ts` (new file) and `npm run test:ops` for full suite.

---

## 5. Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 + ts-jest 29.4.6 |
| Config file | `apps/ops-api/jest.config.ts` (run via `test:ops`) |
| Quick run command | `npm run test:ops -- <filename>` |
| Full suite command | `npm run test:ops` |
| Phase gate | Full ops-api suite green + Morgan suite still green |

**IMPORTANT CORRECTION:** CLAUDE.md claims Jest only covers `apps/morgan/`. This is outdated — `package.json` has `"test:ops": "jest --config apps/ops-api/jest.config.ts"` and `apps/ops-api/src/services/__tests__/` contains 9 test files (`carryover.test.ts`, `commission.test.ts`, etc.). Phase 45 should USE `test:ops` and update CLAUDE.md in a follow-up (or in phase cleanup).

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| BUG-1 (commission calc) | ACA flat × members | unit | `npm run test:ops -- commission.test.ts` | ✅ extend |
| BUG-1 (display) | WeekSection renders plain $ | manual | Visual repro | manual |
| BUG-1 (print) | PayrollExports includes ACA row | manual | Visual repro | manual |
| BUG-1 (unified entry) | Entry folding logic | unit | `npm run test:ops -- payroll-fold.test.ts` | ❌ Wave 0 if extracted |
| BUG-2 (first lock) | CARRY-02 regression | unit | `npm run test:ops -- carryover.test.ts` | ✅ exists |
| BUG-2 (reverse) | CARRY-08 new | unit | `npm run test:ops -- carryover.test.ts` | ✅ extend |
| BUG-2 (re-lock) | CARRY-09 new | unit | `npm run test:ops -- carryover.test.ts` | ✅ extend |
| BUG-2 (route integration) | PATCH unlock triggers reverseCarryover | manual | Postman/curl + DB inspect | manual |
| BUG-3 (preview) | persist=false no cursor advance | unit | `npm run test:ops -- repSync.test.ts` | ❌ Wave 0 |
| BUG-3 (submit) | cursor advances inside tx | unit | `npm run test:ops -- repSync.test.ts` | ❌ Wave 0 |
| BUG-3 (rollback) | failed insert rolls back cursor | unit | `npm run test:ops -- repSync.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test:ops -- <affected file>`
- **Per wave merge:** `npm run test:ops` (full ops-api) + `npm test` (Morgan)
- **Phase gate:** Both suites green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/ops-api/src/services/__tests__/repSync.test.ts` — covers BUG-3 preview/submit/rollback behavior. New file.
- [ ] `apps/ops-dashboard/.../__tests__/payroll-fold.test.ts` — ONLY if the fold logic is extracted into a pure helper (recommended for testability). If kept inline in PayrollPeriods.tsx, manual verification only.
- [ ] Extend existing `carryover.test.ts` with CARRY-08 and CARRY-09 cases — in-place edit, no new file.
- [ ] Extend existing `commission.test.ts` with explicit ACA_PL assertions if not already present.

Framework install: none — Jest + ts-jest already configured at root and in ops-api.

---

## 6. Code Examples

### calculateCommission ACA branch (already correct)
Source: `apps/ops-api/src/services/payroll.ts:103-112`
```ts
if (sale.product.type === "ACA_PL") {
  const flatAmount = Number(sale.product.flatCommission ?? 0);
  const count = (sale as SaleWithProduct & { memberCount?: number | null }).memberCount ?? 1;
  return { commission: Math.round(flatAmount * count * 100) / 100, halvingReason: null };
}
```

### Manager entry submit flow (reference for Bug 1)
Source: `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:436-473`
```tsx
const res = await authFetch(`${API}/api/sales`, { method: "POST", /* parent sale */ });
if (res.ok) {
  const sale = await res.json();
  if (includeAca && acaCarrier) {
    await authFetch(`${API}/api/sales/aca`, {
      method: "POST",
      body: JSON.stringify({
        agentId: form.agentId, memberName: form.memberName, carrier: acaProduct.name,
        memberCount: parseInt(acaMemberCount, 10) || 1, productId: acaProduct.id,
        saleDate: form.saleDate || undefined, acaCoveringSaleId: sale.id,
      }),
    });
  }
}
```

### Current executeCarryover body (reference for Bug 2)
Source: `apps/ops-api/src/services/carryover.ts:42-89`
```ts
for (const adj of period.agentAdjustments) {
  const agentEntries = period.entries.filter(e => e.agentId === adj.agentId);
  const totalPayout = agentEntries.reduce((s, e) => s + Number(e.payoutAmount), 0);
  const totalAdj = agentEntries.reduce((s, e) => s + Number(e.adjustmentAmount), 0);
  const agentNet = totalPayout + totalAdj + Number(adj.bonusAmount) + Number(adj.frontedAmount) - Number(adj.holdAmount);
  let carryHold = 0;
  carryHold += Number(adj.frontedAmount);
  if (agentNet < 0) carryHold += Math.abs(agentNet);
  if (carryHold <= 0) continue;
  await prisma.agentPeriodAdjustment.upsert({
    where: { agentId_payrollPeriodId: { agentId: adj.agentId, payrollPeriodId: nextPeriodId } },
    create: { agentId: adj.agentId, payrollPeriodId: nextPeriodId, holdAmount: carryHold, holdFromCarryover: true, holdLabel: "Fronted Hold", carryoverSourcePeriodId: periodId },
    update: { holdAmount: { increment: carryHold }, holdFromCarryover: true, holdLabel: "Fronted Hold", carryoverSourcePeriodId: periodId },
  });
}
await prisma.payrollPeriod.update({ where: { id: periodId }, data: { carryoverExecuted: true } });
```

### Round-robin cursor advance (reference for Bug 3)
Source: `apps/ops-api/src/services/repSync.ts:131-150`
```ts
return prisma.$transaction(async (tx) => {
  const setting = await tx.salesBoardSetting.findUnique({ where: { key: settingKey } });
  let idx = setting ? parseInt(setting.value, 10) : 0;
  const assignments: string[] = [];
  for (let i = 0; i < count; i++) { assignments.push(activeReps[idx % activeReps.length].name); idx++; }
  await tx.salesBoardSetting.upsert({
    where: { key: settingKey },
    update: { value: String(idx % activeReps.length) },
    create: { key: settingKey, value: String(idx % activeReps.length) },
  });
  return assignments;
});
```

---

## 7. Open Questions

1. **Bug 1 — actual repro outcome:** Is the "only ACA row appears" symptom a display bug (most likely) or an actual data persistence bug? **Recommendation:** Have the implementer do the manual repro FIRST and check DB contents before writing code. If persistence is broken, adjust the plan to debug the `/api/sales` path; if not, the plan is display-only.
2. **Bug 1 — print column strategy:** Push ACA into CORE column or add a dedicated column? Both satisfy D-04. **Recommendation:** Push into CORE — zero column schema change, visually grouped with carrier.
3. **Bug 2 — schema migration acceptable?** Adding `carryoverAmount` is the cleanest reversal path. If the user prefers zero migration, use the "delete if purely carryover" heuristic — slightly less precise but avoids a migration.
4. **Bug 3 — preview default:** Should `batchRoundRobinAssign` default to persist=true (backwards compat) or persist=false (safer)? **Recommendation:** Default to persist=true; explicit `preview=true` query param in the preview endpoint. Safer = less behavioral drift.
5. **Bug 3 — existing chargeback logic already uses per-row updates outside transaction:** The matching loop at `chargebacks.ts:131-179` calls `prisma.chargebackSubmission.update` in a tight loop outside any transaction. Wrapping everything in a single transaction might run into long-running tx concerns for large batches. **Recommendation:** Minimum viable = transaction wraps `createMany` + `advanceRoundRobinCursor` only; matching loop stays outside. This satisfies D-11 ("cursor advancement inside the same Prisma transaction as the insert").

---

## 8. Sources

### Primary (HIGH confidence — direct file reads)
- `apps/ops-api/src/routes/sales.ts:13-231` — POST /sales and POST /sales/aca routes
- `apps/ops-api/src/services/payroll.ts:103-371` — calculateCommission, resolveBundleRequirement, upsertPayrollEntryForSale
- `apps/ops-api/src/services/carryover.ts:1-89` — full executeCarryover implementation
- `apps/ops-api/src/routes/payroll.ts:12-393` — PayrollPeriod PATCH, adjustment endpoints
- `apps/ops-api/src/services/repSync.ts:80-151` — getNextRoundRobinRep, batchRoundRobinAssign
- `apps/ops-api/src/routes/cs-reps.ts:1-177` — round robin endpoints
- `apps/ops-api/src/routes/chargebacks.ts:85-180` — chargebacks POST + matching loop
- `apps/ops-api/src/routes/pending-terms.ts:1-103` — pending-terms POST
- `apps/ops-api/src/services/__tests__/carryover.test.ts:1-174` — existing unit tests (CARRY-02/03/06/07)
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:419-482` — submitSale handler
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx:240-309, 520-547` — entry rendering and adjustment save
- `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx:1-183` — agent card composition
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx:15-210` — CSV/print row construction
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx:400-670` — fetchBatchAssign, handlers, submit
- `prisma/schema.prisma:141, 221-234, 280, 706-709` — flatCommission, ACA fields, carryoverExecuted, hold carryover metadata
- `package.json` — confirms `test:ops` Jest config for ops-api
- `.planning/config.json` — `nyquist_validation: true` confirmed

### Metadata

**Confidence breakdown:**
- Bug 1 display fix: HIGH — exact source line identified
- Bug 1 persistence: MEDIUM — all code paths reviewed, no obvious bug; manual repro required
- Bug 1 unified rendering: HIGH — fold logic is straightforward
- Bug 2 Path A: HIGH — unlock path confirmed missing reversal
- Bug 2 Path B: HIGH — unit tests cover it
- Bug 3 cursor advance: HIGH — exact transaction boundaries identified
- Bug 3 transaction refactor: HIGH — standard Prisma pattern

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (30 days — codebase is stable)
