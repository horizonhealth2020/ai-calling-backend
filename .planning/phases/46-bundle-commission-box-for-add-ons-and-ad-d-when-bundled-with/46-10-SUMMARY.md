---
phase: 46
plan: 10
gap_closure: true
requirements: [GAP-46-UAT-05]
status: complete
commits:
  - 5c10485 feat(46-10) server — widen alert pipeline + manual sale-pick + atomic approveAlert
  - be89824 feat(46-10) payroll UI — manual sale-picker for UNMATCHED alerts
  - c05cf1c feat(46-10) CS submit toast — surface alert pipeline outcome
files_modified:
  - apps/ops-api/src/routes/chargebacks.ts
  - apps/ops-api/src/services/alerts.ts
  - apps/ops-api/src/routes/alerts.ts
  - apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts
  - apps/ops-dashboard/app/(dashboard)/payroll/page.tsx
  - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
  - apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx
schema_clean: true
no_new_migrations: true
---

# Phase 46 Plan 10: GAP-46-UAT-05 Manual Sale-Picker Fix — Summary

Close the last UAT-round-2 gap on Phase 46. CS chargebacks whose `matchStatus` was UNMATCHED or MULTIPLE were silently dropped at `chargebacks.ts:204` (`if (cb.matchStatus !== "MATCHED" || !cb.matchedSaleId) continue;`). Rounds 1+2 of UAT confirmed this is the dominant production failure mode (typos, formatting drift, leading-zero memberIds, members with multiple active sales). User chose **Option B (durable fix)**: widen the alert pipeline to accept UNMATCHED/MULTIPLE, carry raw identity, and let payroll manually pick a sale at approve-time. No schema migration — `PayrollAlert.chargebackSubmissionId → ChargebackSubmission.matchedSaleId` is already nullable.

## Task 1 — Server: alert pipeline widening + manual-pick approve + atomic transaction

Commit: `5c10485`

### `apps/ops-api/src/routes/chargebacks.ts`

Split the `alertPayloadsLocal` build loop into two branches:

```diff
 for (const cb of refreshedChargebacks) {
-  if (cb.matchStatus !== "MATCHED" || !cb.matchedSaleId) continue;
-
-  const sale = await tx.sale.findUnique({
-    where: { id: cb.matchedSaleId },
-    include: { payrollEntries: true, product: true, addons: { include: { product: true } }, agent: true },
-  });
-  if (!sale) continue;
-  // ... clawback creation + payrollEntry update ...
-  alertPayloadsLocal.push({
-    chargebackId: cb.id,
-    agentName: sale.agent?.name,
-    memberName: sale.memberName ?? undefined,
-    amount: chargebackAmount,
-  });
+  if (cb.matchStatus === "MATCHED" && cb.matchedSaleId) {
+    // ── EXISTING MATCHED PATH (unchanged behavior) ──
+    const sale = await tx.sale.findUnique({
+      where: { id: cb.matchedSaleId },
+      include: { payrollEntries: true, product: true, addons: { include: { product: true } }, agent: true },
+    });
+    if (!sale) continue;
+    // ... existing clawback creation + payrollEntry update (unchanged) ...
+    alertPayloadsLocal.push({
+      chargebackId: cb.id,
+      agentName: sale.agent?.name,
+      memberName: sale.memberName ?? undefined,
+      amount: chargebackAmount,
+    });
+  } else {
+    // ── GAP-46-UAT-05 (46-10): UNMATCHED / MULTIPLE — queue an alert for manual review ──
+    // No clawback is created here; payroll will pick a sale during approve and the
+    // existing approveAlert flow will create the clawback at that point.
+    alertPayloadsLocal.push({
+      chargebackId: cb.id,
+      agentName: cb.payeeName ?? cb.memberAgentCompany ?? undefined,
+      memberName: cb.memberCompany ?? cb.memberId ?? undefined,
+      amount: Math.abs(Number(cb.chargebackAmount)),
+    });
+  }
 }
```

Appended a one-line GAP-46-UAT-05 note to the diagnosis comment block above the post-commit alert dispatch wrapper. **Preserved unchanged:** the `selectedSaleIdByMemberId` pre-loop block, the auto-match update loop, the `if (source === "CS")` 46-07 source gate, and the 46-06 observability (`alertSuccessCount`/`alertErrors`/empty-payloads warn).

### `apps/ops-api/src/services/alerts.ts`

**Signature change:**

```diff
-export async function approveAlert(alertId: string, periodId: string | undefined, userId: string) {
+export async function approveAlert(
+  alertId: string,
+  periodId: string | undefined,
+  userId: string,
+  manualSaleId?: string,
+) {
```

**Manual-pick branch + atomicity wrapper (EDITS 2 + 4).** The entire mutation path is now wrapped in `prisma.$transaction(async (tx) => { ... }, { timeout: 15000 })`. The initial `payrollAlert.findUnique` read + `findOldestOpenPeriodForAgent` auto-select stay outside the transaction to minimize lock duration. Inside the transaction:

1. When `alert.chargeback.matchedSaleId` is null, `manualSaleId` is required.
2. Verify the picked sale exists via `tx.sale.findUnique({ id: manualSaleId, include: { payrollEntries, agent } })`.
3. Persist the link via `tx.chargebackSubmission.update({ matchedSaleId: manualSaleId, matchStatus: "MATCHED" })`.
4. Re-read the alert with `tx.payrollAlert.findUnique` (populated chargeback include) and mutate the local `alert.chargeback` so the rest of the function is unchanged.
5. If period auto-select was deferred (no agent known until pick), do it now using the picked sale's agent.
6. Every `prisma.*` call downstream (`tx.payrollPeriod.findUnique`, `tx.clawback.findFirst`, `tx.payrollAlert.update`, `tx.clawback.create`) is now `tx.*`.
7. Side-effects (`emitAlertResolved`, `emitClawbackCreated`) stay inside the transaction callback so they only fire on commit; `logAudit` stays on the module-level `prisma`.

**Dedupe tightening (EDIT 5):**

```diff
 const existingClawback = await tx.clawback.findFirst({
   where: {
     saleId,
     OR: [
       { matchedBy: "chargeback_alert", matchedValue: alert.chargebackSubmissionId },
-      { matchedBy: { in: ["member_id", "member_name"] } },
+      { matchedBy: "member_id",   matchedValue: alert.chargeback?.memberId ?? "__none__" },
+      { matchedBy: "member_name", matchedValue: alert.chargeback?.memberCompany ?? "__none__" },
     ],
   },
 });
```

Constrains the broad branch on `matchedValue` so dedupe cannot false-positive across unrelated prior batches against the same Sale. The `__none__` sentinel guards null memberId/memberCompany from accidentally matching empty-string `matchedValue`. Verified against `chargebacks.ts:229-230` which writes `matchedBy: cb.memberId ? "member_id" : "member_name"` with `matchedValue: cb.memberId || cb.memberCompany || ""`.

### `apps/ops-api/src/routes/alerts.ts`

```diff
-  const parsed = z.object({ periodId: z.string().min(1).optional() }).safeParse(req.body);
+  const parsed = z.object({
+    periodId: z.string().min(1).optional(),
+    saleId: z.string().min(1).optional(), // GAP-46-UAT-05 (46-10): manual sale pick for unmatched alerts
+  }).safeParse(req.body);
   if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
-  const { periodId } = parsed.data;
-  const alert = await approveAlert(pp.data.id, periodId, req.user!.id);
+  const { periodId, saleId } = parsed.data;
+  const alert = await approveAlert(pp.data.id, periodId, req.user!.id, saleId);
```

## Task 2 — Payroll dashboard: Alert type widening + manual sale-picker UI

Commit: `be89824`

### `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts`

```diff
 export type Alert = {
   id: string;
   agentId: string | null;
   agentName: string | null;
   customerName: string | null;
   amount: number | null;
   createdAt: string;
+  // GAP-46-UAT-05 (46-10): identity + match status from the chargeback include
+  chargebackSubmissionId: string;
+  chargeback?: {
+    id: string;
+    matchStatus: "MATCHED" | "MULTIPLE" | "UNMATCHED" | null;
+    matchedSaleId: string | null;
+    memberId: string | null;
+    memberCompany: string | null;
+    payeeName: string | null;
+    memberAgentCompany: string | null;
+  } | null;
 };
```

### `apps/ops-dashboard/app/(dashboard)/payroll/page.tsx`

Dropped the duplicate local `Alert` type and replaced it with `import type { Alert } from "./payroll-types"`. This unblocks the tsc alignment between `page.tsx` and the `PayrollPeriods` prop signature (previously two separate nominal types with the same name).

### `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx`

**New state (after existing `showChargebacks`):**

```ts
type PickerSale = {
  id: string;
  memberName: string | null;
  memberId: string | null;
  agent: { name: string };
  product: { name: string } | null;
  saleDate: string;
};
const [salePickerQuery, setSalePickerQuery] = useState<Record<string, string>>({});
const [salePickerResults, setSalePickerResults] = useState<Record<string, PickerSale[]>>({});
const [pickedSaleId, setPickedSaleId] = useState<Record<string, string>>({});
const [salePickerLoading, setSalePickerLoading] = useState<Record<string, boolean>>({});
```

**`handleApproveAlert` signature (line ~495):**

```diff
-async function handleApproveAlert(alertId: string, periodId: string) {
+async function handleApproveAlert(alertId: string, periodId: string, manualSaleId?: string) {
+  const body: { periodId: string; saleId?: string } = { periodId };
+  if (manualSaleId) body.saleId = manualSaleId;
   const res = await authFetch(`${API}/api/alerts/${alertId}/approve`, {
     method: "POST",
     headers: { "Content-Type": "application/json" },
-    body: JSON.stringify({ periodId }),
+    body: JSON.stringify(body),
   });
   if (res.ok) {
     setAlerts(prev => prev.filter(a => a.id !== alertId));
     setApprovingAlertId(null);
+    setPickedSaleId(prev => { const next = { ...prev }; delete next[alertId]; return next; });
+    setSalePickerQuery(prev => { const next = { ...prev }; delete next[alertId]; return next; });
+    setSalePickerResults(prev => { const next = { ...prev }; delete next[alertId]; return next; });
     ...
   }
 }
```

**Alert row UI (lines ~918-1100):**

1. Compute `isUnmatched = !alert.chargeback?.matchedSaleId` and `memberLabel = alert.chargeback?.memberId ?? alert.chargeback?.memberCompany ?? "—"`.
2. Customer cell: fall back to `alert.chargeback?.memberCompany`, append inline red `Unmatched` badge + `Member: <id>` sub-line when `isUnmatched`.
3. Actions cell (`approvingAlertId === alert.id` branch): two-step UI.
   - **Step 1 (unmatched && !pickedSaleId):** renders a manual sale picker — input (`autoFocus`, pre-seeded with raw memberId), debounce-less `/api/sales` fetch, client-side filter by `memberId`/`memberName` substring (max 20 results), result list of buttons showing member name · id + agent · product · saleDate. Clicking a result sets `pickedSaleId[alert.id]` and immediately fetches `/api/payroll/periods` to populate the period dropdown for Step 2.
   - **Step 2 (matched OR post-pick):** renders the existing period dropdown + Approve button, with `disabled={!selectedAlertPeriod[alert.id] || (isUnmatched && !pickedSaleId[alert.id])}`. A "Sale picked ✓" hint appears when unmatched + pickedSaleId is set. Approve forwards `pickedSaleId[alert.id]` to `handleApproveAlert`.
   - **Cancel buttons** in both steps clear `approvingAlertId`, `pickedSaleId`, `salePickerQuery`, `salePickerResults` for the alertId.
4. Not-approving state: the Approve Alert button now pre-seeds `salePickerQuery[alert.id] = alert.chargeback?.memberId ?? ""` and returns early (skipping the periods fetch) when the row is unmatched; the picker step gates the period fetch.

All styling is inline `React.CSSProperties` reusing the already-in-scope `C` (colors), `R` (radius), `inputStyle`, and `Button` from `@ops/ui`. No Tailwind, no globals.css. Matched alerts continue to go straight to the period dropdown — no picker step. The 46-08 empty-state container and 46-03 collapsed `Chargebacks (N)` badge toggle are untouched.

## Task 3 — CS dashboard: submit toast surfaces alert pipeline outcome

Commit: `c05cf1c`

### `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx`

```diff
 if (res.status === 201) {
-  const data = await res.json();
+  const data = await res.json() as {
+    count: number;
+    alertCount?: number;
+    alertAttempted?: number;
+    alertFailed?: number;
+  };
   onRawTextClear();
-  toast("success", `${data.count} chargebacks submitted`);
+  // GAP-46-UAT-05 (46-10): surface alert pipeline outcome so CS sees when
+  // their submission queued alerts (matched or manual-review) and when any
+  // failed to write. Silent on the happy "0 alerts" path to avoid noise.
+  const attempted = data.alertAttempted ?? 0;
+  const failed = data.alertFailed ?? 0;
+  const succeeded = data.alertCount ?? 0;
+  let msg = `${data.count} chargebacks submitted`;
+  if (attempted > 0) {
+    if (failed > 0) {
+      msg += ` · ${succeeded}/${attempted} alerts queued (${failed} failed)`;
+    } else {
+      msg += ` · ${succeeded} alert${succeeded === 1 ? "" : "s"} queued for payroll review`;
+    }
+  }
+  toast(failed > 0 ? "error" : "success", msg);
 } else {
   toast("error", `Failed to submit (${res.status})`);
 }
```

`onRawTextClear()` still runs on 201. Request body (`source: "CS"`) is unchanged.

## Verification

### `npx tsc -p apps/ops-api/tsconfig.json --noEmit`

Filtered to edited files (`alerts.ts`, `chargebacks.ts`): **zero new errors**.

The tsc run surfaces only pre-existing environment-level errors on `main` (verified via `git stash` comparison against clean tree before any edits):
- `auth.ts` bcryptjs/jsonwebtoken missing `@types/*` declarations
- `packages/auth/src/index.ts` jsonwebtoken / cookie declaration files
- `packages/types/src/index.ts` rootDir cross-package resolution
- `packages/types/src/us-states.ts` rootDir violation

None of these reference any file touched by this plan and all are present on commit `1b68f68` before the first 46-10 edit.

### `cd apps/ops-dashboard && npx tsc --noEmit`

Filtered to 46-10 edited files: **zero new errors**.

Pre-existing errors confirmed via `git stash` comparison:
- `middleware.ts` `ResponseCookie` signature mismatch (Next.js type upgrade)
- `payroll/page.tsx(322,56)` `React.Dispatch<SetStateAction<Product[]>>` two-different-nominal-types error — verified identical before/after (this file's `Product` type is still locally defined; plan scope only touched the `Alert` type alignment)
- `packages/auth/src/index.ts` jsonwebtoken / cookie declarations

The initial run *did* surface one new error after Task 2 — `page.tsx(305,11)` `chargebackSubmissionId` missing in local `Alert` type — which was fixed in the same commit by importing `Alert` from `payroll-types` instead of re-declaring it. After the fix the only remaining dashboard errors are the three pre-existing ones above.

### Schema clean

```
$ git diff prisma/schema.prisma
(empty)

$ git status prisma/migrations
nothing to commit, working tree clean
```

No migration files were added; no changes to `prisma/schema.prisma`. The `ChargebackSubmission.matchedSaleId` column was already nullable and `PayrollAlert` has no direct `saleId` column — the fix is entirely application-layer.

### Grep verifications (from plan `<verify>` blocks)

Task 1:
- `GAP-46-UAT-05` in `chargebacks.ts` — OK
- `manualSaleId` in `alerts.ts` — OK
- `saleId: z.string` in `routes/alerts.ts` — OK
- `matchedBy.*chargeback_alert` in `alerts.ts` — OK (dedupe branch preserved)
- `prisma\.\$transaction` in `alerts.ts` — OK
- `matchedBy: "member_id", matchedValue` in `alerts.ts` — OK (tightened dedupe)

Task 2:
- `GAP-46-UAT-05` in `PayrollPeriods.tsx` — OK
- `pickedSaleId` in `PayrollPeriods.tsx` — OK
- `matchStatus` in `payroll-types.ts` — OK
- `No chargebacks` in `PayrollPeriods.tsx` — OK (46-08 empty-state preserved)
- `setShowChargebacks` in `PayrollPeriods.tsx` — OK (46-03 toggle preserved)

Task 3:
- `alertAttempted` in `CSSubmissions.tsx` — OK
- `source: "CS"` in `CSSubmissions.tsx` — OK (46-07 gate preserved)
- `queued for payroll review` in `CSSubmissions.tsx` — OK

## Deviations from Plan

**None that change behavior.** One in-scope correction:

- **Task 2 — `payroll/page.tsx` Alert type alignment.** The plan listed only `payroll-types.ts` and `PayrollPeriods.tsx` as files to modify. However, `payroll/page.tsx` defined its own local `type Alert = { ... }` without `chargebackSubmissionId`, and passed `alerts` / `setAlerts` down to `<PayrollPeriods />`. After widening the prop type in `payroll-types.ts`, tsc flagged the prop passthrough as a type mismatch (two nominal `Alert` types in different files). Resolution: deleted the duplicate local type in `page.tsx` and imported `Alert` from `./payroll-types`. This is a Rule 3 auto-fix (blocking tsc error directly caused by the Task 2 widening). Committed together with the rest of Task 2 (`be89824`).

No other deviations. No architectural changes. No schema changes. No Tailwind introduced. Inline `React.CSSProperties` throughout.

## Manual Test — Ready for Human UAT Round 3

I cannot run a live end-to-end UAT from this environment. The exact reproduction script for GAP-46-UAT-05 closure, matching `<success_criteria>` in the plan:

1. **UNMATCHED happy path**
   - Start ops-api (`npm run ops:dev`), ops-dashboard (`npm run dashboard:dev`), login as a CS user.
   - On the CS Submissions page, paste a chargeback row for a member whose `memberId` does NOT match any existing sale (e.g., typo `"12345"` when the real sale has `"012345"`).
   - Submit. Expected: toast reads `1 chargebacks submitted · 1 alert queued for payroll review` (variant "success").
   - Switch to a PAYROLL-role user, open the payroll dashboard. Expected: the `Chargebacks (1)` container expands to show a row with:
     - Red `Unmatched` badge next to the customer name
     - `Member: 12345` sub-line
     - `Approve Alert` / `Clear Alert` buttons
   - Click `Approve Alert`. Expected: a sale picker input appears, pre-seeded with `12345`.
   - Clear the input, type `012345`. Expected: results dropdown shows the real sale (member name · id, agent, product, date).
   - Click the result. Expected: "Sale picked ✓" appears and the oldest-open period dropdown renders with the Approve button now enabled.
   - Click `Approve`. Expected: alert disappears, toast reads "Alert approved and clawback created".
   - **Server verification:** `chargebackSubmission.matchedSaleId` is now set to the picked sale's id, `matchStatus` is `"MATCHED"`, a `clawback` row exists against the picked sale's agent with `matchedBy: "chargeback_alert"`, and the `payrollAlert` row is `APPROVED`.

2. **MATCHED regression**
   - Paste a chargeback for a member with exactly one existing sale on the correct `memberId`.
   - Submit. Toast: `1 chargebacks submitted · 1 alert queued for payroll review`.
   - Payroll dashboard: the row renders without the `Unmatched` badge. Click `Approve Alert` — goes straight to the period dropdown (no picker step). Approve works as before.

3. **PAYROLL-source bypass regression (GAP-46-UAT-02)**
   - As PAYROLL user, submit a chargeback via the payroll chargebacks tab (same endpoint, different `source`). Expected: no `payrollAlert` row is created; the clawback hits the oldest open period directly.

4. **Dedupe tightening regression**
   - Setup: create Sale X in the DB. Run a batch chargeback for `cb-OLD` with memberId `"MEM-OLD"` that matches Sale X — this creates a clawback with `matchedBy: "member_id"`, `matchedValue: "MEM-OLD"`.
   - Now submit `cb-NEW` with a different memberId `"MEM-NEW"` that does NOT match any sale (UNMATCHED). In the payroll picker, manually pick Sale X for cb-NEW.
   - Expected: approveAlert creates a NEW clawback for cb-NEW (`matchedBy: "chargeback_alert"`, `matchedValue: cb-NEW.id`). The dedupe block does NOT false-positive against the pre-existing cb-OLD clawback because the tightened `matchedValue` constraint ties the OR branch to `alert.chargeback.memberId === "MEM-NEW"` which is different from the cb-OLD clawback's `matchedValue: "MEM-OLD"`.

5. **Atomicity regression**
   - If you have a way to force a downstream failure inside `approveAlert` (e.g., temporarily break `clawback.create` in a dev branch), confirm that `chargebackSubmission.matchedSaleId` is rolled back to NULL and `matchStatus` is rolled back to `UNMATCHED` — the manual pick does not persist when the transaction fails.

**All four prior gap fixes (GAP-46-UAT-01..04) should remain green:** observability logs (46-06), source-aware gating (46-07), empty-state container (46-08), ACA_PL print chip (46-09). None of these were modified in this plan.

## Self-Check: PASSED

- `apps/ops-api/src/routes/chargebacks.ts` — edited, committed in `5c10485`. Grep `GAP-46-UAT-05` present.
- `apps/ops-api/src/services/alerts.ts` — edited, committed in `5c10485`. Grep `manualSaleId`, `prisma.$transaction`, tightened dedupe present.
- `apps/ops-api/src/routes/alerts.ts` — edited, committed in `5c10485`. Grep `saleId: z.string` present.
- `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` — edited, committed in `be89824`. Grep `matchStatus` present.
- `apps/ops-dashboard/app/(dashboard)/payroll/page.tsx` — edited (duplicate Alert type removed, import added), committed in `be89824`.
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — edited, committed in `be89824`. Grep `pickedSaleId`, `Unmatched`, `Pick the sale this chargeback belongs to` present.
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` — edited, committed in `c05cf1c`. Grep `alertAttempted`, `queued for payroll review`, `source: "CS"` all present.
- Commits `5c10485`, `be89824`, `c05cf1c` all exist in `git log` on `main`.
- `git diff prisma/schema.prisma` is empty.
- `git status prisma/migrations` is clean.
