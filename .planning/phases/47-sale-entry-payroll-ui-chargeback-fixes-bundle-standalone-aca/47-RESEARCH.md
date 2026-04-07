# Phase 47: Sale entry, payroll UI, chargeback fixes bundle — Research

**Researched:** 2026-04-07
**Domain:** ops-dashboard frontend + ops-api backend (sales, payroll, chargebacks)
**Confidence:** HIGH (codebase-grounded; no external library research needed)

## Summary

Phase 47 bundles 5 targeted defects across manager sale entry, payroll period layout, chargeback lookup UI, payroll row editing, and cross-period chargeback handling. All five are fixes to existing flows — no new libraries, no schema changes required (D-20's cross-period row piggybacks on the existing `@@unique([payrollPeriodId, saleId])` constraint). The phase is scoped primarily to five files (`ManagerEntry.tsx`, `PayrollPeriods.tsx`, `PayrollChargebacks.tsx`, `WeekSection.tsx`, `apps/ops-api/src/routes/payroll.ts`) plus shared service helpers in `payroll.ts`.

Research verified every assumption against source. Several **CONTEXT.md statements need correction or refinement**, surfaced as `⚠ CONTEXT DRIFT` notes below — the planner must honor the corrected reality.

**Primary recommendation:** Frame each sub-feature as an isolated surgical fix reusing existing helpers (`upsertPayrollEntryForSale`, `findOldestOpenPeriodForAgent`, `calculatePerProductCommission`). Budget one plan per sub-feature (5 plans) with a shared Wave 0 plan for any cross-cutting utilities.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Sub-feature 1: Standalone ACA form skip**
- **D-01:** The standalone ACA collapsible section in `ManagerEntry.tsx` submits independently of the main sale form. Main sale form fields (payment method, core product, etc.) no longer block standalone ACA submission — validation and required-field logic must not fire for the main form when the standalone ACA path is used.
- **D-02:** Standalone ACA submission requires exactly these four fields: **agent**, **member name**, **ACA carrier (product)**, **member count**. No others.
- **D-03:** Existing standalone ACA state (`acaStandaloneAgent`, `acaStandaloneMemberName`, `acaStandaloneCarrier`, `acaStandaloneMemberCount`) stays as-is; only the submit gate changes.

**Sub-feature 2: Payroll period spacing prioritizes pay cards**
- **D-04:** Shrink the top padding/spacing AND overall UI chrome above pay cards in `PayrollPeriods.tsx` so pay cards become the dominant element (>1/3 of screen per user feedback).
- **D-05:** KPIs stay visible but compressed — smaller font sizes, tighter padding, and/or single-line layout for the period summary ticker.
- **D-06:** Must remain visible regardless of shrink strategy:
  - Date range header (e.g., `04-20-2026 → 04-19-2026`)
  - Net Payout total (primary period KPI)
  - Period action buttons (Lock/Unlock/Export/Print)
  - Phase 46 `Chargebacks (N)` badge
- **D-07:** Reference screenshot: `image.png` at repo root shows current spacing problem — agent list on left, period summary ticker consuming ~30% vertical, first pay card (Malik) pushed down. Target: pay cards visible immediately below date range without scrolling at 1080p.

**Sub-feature 3: Single Chargeback Lookup (Chargebacks tab) — info surfacing**
- **D-08:** The Single Chargeback Lookup result card in `PayrollChargebacks.tsx` (section starts at `SECTION_HEADING "Single Chargeback Lookup"` ~line 882, result rendering ~line 925) must display after a successful lookup:
  - Agent name (from matched sale)
  - Member name (from matched sale)
  - Sale amount (sale total or per-product, whichever matches existing data model)
  - Products on sale with selection checkboxes (**existing** — unchanged)
  - **Net chargeback amount that will be deducted from the agent** — live-updates as user toggles product selection in the existing product checklist
- **D-09:** Net deduction calculation = sum of each selected product's commission value × applicable chargeback rate (same formula the clawback service uses server-side). Frontend computes this live from response data; backend MAY compute a canonical value and return it so frontend math matches server math.
- **D-10:** Backend: `GET /api/clawbacks/lookup` (currently returns `lookupResult` with `products`) must also return `agent.name`, `memberName`, `amount`, and per-product commission data. Verify the existing endpoint; extend if missing.
- **D-11:** Layout inside the result card is Claude's discretion — match the existing `PayrollChargebacks.tsx` visual pattern (same typography, card style, color palette).

**Sub-feature 4: Payroll row edit — ACA product uses member count**
- **D-12:** In `WeekSection.tsx` `EditableSaleRow` (line 83), the addon dropdown currently filters `products.filter(p => p.active && p.type !== "CORE")` which allows ACA_PL products as "addons". Keep ACA_PL selectable in the dropdown, but when the selected product's `type === "ACA_PL"`, replace the Premium ($) number input with a **Member Count (#) input** (integer, min 1, default 1). Label visibly: "# members" or similar.
- **D-13:** On save, when an ACA_PL addon row is present, the backend must:
  - (a) Create an **ACA covering child sale** (not a SaleAddon row) using the same model/flow as Phase 42's standalone ACA path (product = ACA_PL carrier, memberCount = user input, agent = parent sale's agent)
  - (b) Set the parent sale's `acaCoveringSaleId` to the new child sale's id
  - (c) Compute the child sale's ACA_PL payoutAmount = `product.acaRate × memberCount` (the same flat formula used for standalone ACA entries)
  - (d) Create the child's PayrollEntry in the same period as the parent
- **D-14:** After linking `acaCoveringSaleId`, the server must **recalculate existing sibling PayrollEntries** belonging to the parent sale for `ADDON` and `AD_D` product types — call `calculateCommission` again so Phase 46 `acaBundledCommission` (D-04 of Phase 46) activates in preference to the standalone rate. Upsert updated `payoutAmount` on those entries.
- **D-15:** Parent bundle requirement satisfaction (`resolveBundleRequirement`) must also re-run for the parent sale to ensure bundle status holds after ACA attachment.
- **D-16:** Audit log records the cascade: `{ parentSaleId, createdAcaChildSaleId, recalculatedEntryIds: [...], before: [...], after: [...] }`.
- **D-17:** Removing the ACA child sale via the edit path (user deletes the ACA row from the edit view) must reverse the cascade: unset `acaCoveringSaleId`, recalc siblings back to standalone rates, and delete the child sale + child payroll entry. Audit log records the reversal.

**Sub-feature 5: Closed-period chargebacks → negative row in oldest OPEN period**
- **D-18:** When a chargeback targets a sale whose payroll period status is `PAID` or `CLOSED`, the chargeback pipeline must NOT retroactively modify the original payroll entry. Instead, insert a new PayrollEntry row in the **oldest OPEN** payroll period for the same agent.
- **D-19:** "Oldest OPEN" = the PayrollPeriod with earliest `startDate` where `status !== "PAID"` and `status !== "CLOSED"`. Payroll runs 1 week in arrears so 2–3 open periods can overlap at once — always target the oldest, not the current.
- **D-20:** Shape of the cross-period negative row:
  - Use the existing `PayrollEntry` model — no new tables
  - `adjustmentAmount` = `-(original commission amount being charged back)` (already allows negatives per CLAUDE.md)
  - `payoutAmount` = `0`
  - `sale` = the original closed-period sale (so the row shows the same member/product info)
  - `agent` = original agent
- **D-21:** Visual treatment — cross-period (CLOSED → OPEN) chargeback row: **orange highlight** (use existing warning/orange color from the theme, e.g., `C.warning`). Same orange highlight applied on the print card (`printAgentCards` in `PayrollPeriods.tsx`).
- **D-22:** Visual treatment — same-period (OPEN period zeroed in place) chargeback row: **yellow highlight** (distinct from orange) so managers can tell at a glance whether a zeroed row is cross-period or in-period. Print card respects this too.
- **D-23:** The in-period (still-open) chargeback behavior — zeroing the original row in place — stays. Phase 47 only CHANGES the closed-period path and ADDS the yellow visual marker to the existing in-period path.
- **D-24:** No retroactive migration — only applies to chargebacks processed after deploy.

### Claude's Discretion

- Exact pixel values for header/ticker font reduction and padding shrink in D-04/D-05 (test at 1080p against `image.png`)
- Exact orange/yellow color tokens used for row highlights in D-21/D-22 (pick from existing `C.warning` / similar tokens in the theme)
- Internal helper extraction for the edit-row ACA branch (D-12)
- Endpoint shape for the lookup augmentation (D-10) — extend existing vs. add new
- Whether D-14 recalc runs inline in the edit endpoint or queued via a post-commit hook
- Layout of the Single Chargeback Lookup info section (D-11)

### Deferred Ideas (OUT OF SCOPE)

- Retroactive recalculation of pre-deploy payroll entries (deferred — D-24)
- Redesigning the Phase 46 `Chargebacks (N)` alert badge (out of scope — user clarified Sub-feature 3 is about the Chargebacks tab lookup, not the alert badge)
- New tables for tracking cross-period chargeback provenance (deferred — existing `PayrollEntry.adjustmentAmount` + `sale` FK is sufficient for D-20)
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 47 has no formally-mapped `REQ-IDs` in REQUIREMENTS.md (roadmap marks v2.2 as 100% complete; Phase 47 is a post-v2.2 bundle tracked via STATE.md "Roadmap Evolution"). Use the decision IDs (D-01 through D-24) as requirement IDs for plan traceability.

| ID Group | Maps To | Research Support |
|----------|---------|------------------|
| D-01 … D-03 | Sub-feature 1 — standalone ACA submit gate | `ManagerEntry.tsx:419-493` + `:861` — root cause identified (Button missing `type="button"`) |
| D-04 … D-07 | Sub-feature 2 — payroll period spacing | `PayrollPeriods.tsx:884-1191` — chargeback banner + StatMini grid identified as shrink targets |
| D-08 … D-11 | Sub-feature 3 — lookup info surfacing | `PayrollChargebacks.tsx:80, 292-296, 502-536, 879-1017` + `routes/payroll.ts:290-316` — endpoint shape + frontend state mapped |
| D-12 … D-17 | Sub-feature 4 — ACA in payroll edit | `WeekSection.tsx:83-355` + `routes/sales.ts:135-231, 362-521` + `services/payroll.ts:330-397` — covering sale flow reusable |
| D-18 … D-24 | Sub-feature 5 — cross-period CB | `routes/payroll.ts:187-288` + `routes/chargebacks.ts:194-265` + `services/payroll.ts:300-413` — TWO code paths need the fix |
</phase_requirements>

## Context Drift — Corrections the Planner Must Honor

Research uncovered several discrepancies between CONTEXT.md and actual source. The planner MUST treat the corrected facts below as authoritative.

| # | CONTEXT.md said | Reality | Impact |
|---|-----------------|---------|--------|
| 1 | `PayrollPeriod.status` enum values are `OPEN / CLOSED / PAID` (D-18, D-19) | Enum is `OPEN / LOCKED / FINALIZED` (`schema.prisma:20-24`). PayrollEntry has its own separate enum `PENDING / READY / PAID / ZEROED_OUT / CLAWBACK_APPLIED` (`:26-32`) | D-19's "oldest open" predicate translates to `status === "OPEN"` (single check), NOT `status !== "PAID" && status !== "CLOSED"`. Plans must use the correct enum. |
| 2 | Sub-feature 1 root cause is "main form validation blocks standalone ACA" | Actual root cause: the `<Button>` at `ManagerEntry.tsx:861` omits `type="button"`. HTML buttons inside a `<form>` default to `type="submit"`, so clicking "Submit ACA Entry" fires the form's `onSubmit={submitSale}`. Main-form `required` attrs + JS validation in `submitSale` (lines 422-429) block the intended standalone flow BEFORE the standalone `onClick` handler runs. | **Fix is a one-character change**: add `type="button"` to the `<Button>` at 861. Plus optionally move the standalone ACA collapsible block OUT of the `<form>` element (line 515) for a belt-and-suspenders fix. |
| 3 | D-14: "recalculate existing sibling PayrollEntries for ADDON and AD_D product types" — implying one entry per product | `PayrollEntry` is keyed by `(payrollPeriodId, saleId)` — ONE entry per sale containing the **rolled-up** commission for all products (`schema.prisma:331`). The parent's addons/AD&D are already aggregated into a single `payoutAmount`. `calculateCommission` re-runs across ALL products in one call. | "Sibling recalc" = a single call to `upsertPayrollEntryForSale(parentSaleId)`. There are no separate per-product entries to update. This also means D-14 is idempotent by construction. |
| 4 | D-10: endpoint returns `products` array — planner may assume it also returns agent/member/amount already | `routes/payroll.ts:291-316` `GET /clawbacks/lookup` returns ONLY `{ saleId, memberName, memberId, products: [{id, name, type}] }`. No `agent`, no `premium`, no per-product commission. Endpoint MUST be extended. Frontend type `LookupResult` at `PayrollChargebacks.tsx:80` also needs extension. | Both backend + frontend type + render code change. |
| 5 | Sub-feature 5 has ONE code path to fix | There are TWO chargeback code paths that share the same bug: (a) `routes/payroll.ts:187-288` `POST /clawbacks` (single manual chargeback from PayrollChargebacks.tsx lookup UI), and (b) `routes/chargebacks.ts:194-265` batch chargeback path. Both use `sale.payrollEntries.find(e => e.payrollPeriodId === targetPeriodId) ?? sale.payrollEntries[0]` which silently falls back to the closed-period entry when no matching open-period entry exists. Both need the cross-period insert logic. The `approveAlert` path in `services/alerts.ts:39-225` is a THIRD path but it does NOT currently mutate any PayrollEntry — it only creates a Clawback row and marks it MATCHED. The planner must decide whether to also add the cross-period insert there (recommended: yes, for consistency). | Sub-feature 5 scope is larger than CONTEXT.md implies — 2 or 3 code paths, not 1. |
| 6 | Sub-feature 5: "apply yellow highlight to in-period zeroed rows" | Existing in-period zeroed rows set `PayrollEntryStatus = ZEROED_OUT`. The UI at `WeekSection.tsx:122-128` currently only highlights `CLAWBACK_APPLIED` (red). `ZEROED_OUT` rows have no special highlight today. So "yellow" is a NEW highlight for an existing status, not a modification of an existing highlight. | Trivial additional UI rule. |
| 7 | D-17: "Removing the ACA child sale via the edit path" | The `WeekSection.tsx` edit row currently does not surface ACA child sales at all — the ACA badge appears via `entry.acaAttached` (line 273-280) but is NOT part of the `addonItems` state (line 109-111 builds `addonItems` from `entry.sale.addons` only, which are `SaleAddon` rows, not ACA child sales). The user CANNOT currently remove the ACA child via the edit UI. D-17 reversal requires ALSO surfacing the ACA child in the edit view so it has an X button. | D-17 is a bigger UI change than implied — needs to render the ACA child as a removable row in the edit grid. |

## Standard Stack (existing monorepo — no new deps)

| Area | Tool | Version | Where |
|------|------|---------|-------|
| UI primitives | `@ops/ui` (Button, Badge, Card, Input, etc.) | workspace:* | `packages/ui` |
| Styling | Inline `React.CSSProperties`, `colors`/`spacing`/`radius` from `@ops/ui` | — | (no Tailwind per CLAUDE.md) |
| Fetch | `authFetch` from `@ops/auth/client` | workspace:* | injects Bearer token |
| API validation | `zod` + `zodErr()` helper | — | `apps/ops-api/src/routes/helpers.ts` |
| DB | `@prisma/client` singleton from `@ops/db` | 5.20.0 | `packages/db` |
| Audit | `logAudit()` from `apps/ops-api/src/services/audit.ts` | — | writes to `app_audit_log` |
| Commission math | `calculateCommission`, `calculatePerProductCommission`, `upsertPayrollEntryForSale`, `resolveBundleRequirement`, `findOldestOpenPeriodForAgent` | — | `apps/ops-api/src/services/payroll.ts` |

**Installation:** None. Zero new dependencies.

## Architecture — Per Sub-feature

### Sub-feature 1: Standalone ACA submit gate

**Root cause (verified):** `ManagerEntry.tsx:861` `<Button variant="primary" onClick={...}>` is missing `type="button"`. The `Button` component at `packages/ui/src/components/Button.tsx:99` renders a plain `<button>` with `{...rest}` spread — no default `type` override. HTML default for buttons inside a `<form>` is `type="submit"`. Result: clicking "Submit ACA Entry" bubbles up as a form submit event and triggers `submitSale` at line 419, which enforces main-form validation on agent/product/status/memberName/premium (lines 422-427) AND browser-native `required` attrs (lines 536, 544, 560, 564, 567, 577, 585) fire even earlier.

**Fix shape:**
1. Add `type="button"` to the `<Button>` at `ManagerEntry.tsx:861`.
2. OPTIONAL (recommended): move the ACA collapsible `<div>` out of the `<form>` element to prevent any future regression where another nested button inherits `type="submit"`. (Currently the ACA block sits inside the form at lines 721-908.)
3. Confirm the standalone `onClick` handler's existing 4-field validation (lines 864-868) already enforces D-02 — it does.

**File:** `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` (frontend only, ~1 line + optional restructure)

### Sub-feature 2: Payroll period spacing

**Current layout** (`PayrollPeriods.tsx`):
1. Lines 884-1173 — chargeback alerts banner card. Container: `padding: S[4]` (16px), `borderRadius: R["2xl"]` (24px), `borderLeft: 4px solid danger`. When `alerts.length === 0`, shows a one-line "No chargebacks" empty state; when > 0, shows a collapsed button + expandable table. **Shrink target:** reduce container padding to `S[3]` (12px), ensure empty state is a single compact row.
2. Lines 1175-1191 — "Current week summary strip":
   - Outer `marginBottom: S[5]` (20px)
   - Date-range header: `fontSize: 12`, `marginBottom: S[2]` (8px)
   - Grid: `repeat(6, 1fr)` gap `S[3]` (12px), 6 `StatMini` cards
3. `StatMini` (lines 46-67): `padding: "14px 16px"`, `gap: 4`, label `fontSize: 10`, value rendered via `<AnimatedNumber>` (default font size unknown — needs to be passed down or overridden).
4. Lines 1193-1282 — actual `AgentCard` / pay card container.

**Shrink strategy (D-04/D-05/D-06 compliant):**
- `StatMini` padding → `"8px 12px"`, gap → `2`.
- Summary strip `marginBottom` → `S[3]` (12px).
- Date header `marginBottom` → 4px instead of `S[2]`.
- Chargeback banner `padding` → `S[3]` when empty, `S[4]` only when expanded.
- Do NOT remove any D-06 elements (date range, net payout, lock/unlock/export/print buttons, Chargebacks(N) badge).
- Consider forcing 6-col grid on mobile to preserve pay card vertical real estate (current `grid-mobile-1` class stacks to 1 col — keep that, but desktop stays 6-col).

**File:** `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` (frontend only; pure CSS tweaks). Also `StatMini` if the component's font sizes need shrinking.

### Sub-feature 3: Single Chargeback Lookup — info surfacing

**Backend endpoint** (`routes/payroll.ts:291-316`):
```ts
// CURRENT (limited):
res.json({ saleId, memberName, memberId, products: [{id, name, type}] });

// REQUIRED extension (D-08, D-10):
{
  saleId,
  memberName,
  memberId,
  agentName,           // from sale.agent.name
  agentId,             // for audit
  premium,             // Number(sale.premium) — core sale total
  enrollmentFee,       // Number(sale.enrollmentFee) — affects bonus
  products: [
    {
      id,
      name,
      type,
      premium,         // per-product premium (sale.premium for core, addon.premium for addons)
      commission,      // canonical server-computed commission for THIS product via calculatePerProductCommission([id], fullPayout)
    }
  ],
  fullCommission,      // optional — total payout for all products, = sum of per-product commissions
}
```

**Key insight:** there is no separate "chargeback rate" in this codebase. The chargeback amount equals the **commission originally paid** for the selected products. `calculatePerProductCommission` (`services/payroll.ts:419-540`) is the canonical formula — it handles ACA_PL flat × memberCount, core × rate, addon bundled/standalone rates (Phase 46 `acaBundledCommission` preference), and the $10 enrollment bonus when `enrollmentFee >= 125` and core is selected. The endpoint should call this per-product for EACH product and return the array, so the frontend can sum selections locally without re-implementing the math.

**Frontend type extension** (`PayrollChargebacks.tsx:80`):
```ts
type LookupProduct = { id: string; name: string; type: string; premium: number; commission: number };
type LookupResult = {
  saleId: string;
  memberName: string;
  memberId: string | null;
  agentName: string;
  premium: number;
  enrollmentFee: number | null;
  products: LookupProduct[];
};
```

**Frontend render** (insert block at `PayrollChargebacks.tsx:925` ABOVE "Products on sale" header):
- Agent name + member name (two rows or two-col grid)
- Sale premium + enrollment fee
- **Live net deduction** computed via `useMemo(() => selectedProductIds.reduce((sum, id) => sum + (lookupResult.products.find(p => p.id === id)?.commission ?? 0), 0), [selectedProductIds, lookupResult])` — re-renders automatically as user toggles checkboxes at lines 945-978.

**Files:**
- Backend: `apps/ops-api/src/routes/payroll.ts` (extend `/clawbacks/lookup`)
- Frontend: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx` (type + render)

### Sub-feature 4: ACA in payroll row edit

**Frontend (D-12):** `WeekSection.tsx:204-234` is the addon dropdown loop. Current filter `products.filter(p => p.active && p.type !== "CORE")` already allows ACA_PL in the dropdown. Add:
- When the selected addon row's `productId` resolves to a product with `type === "ACA_PL"`, swap the `<input type="number" placeholder="Premium">` (line 218-224) for a `<input type="number" min={1} step={1} placeholder="# members">` with a visible label.
- Track the value in the same `addonItems[idx].premium` slot (rename conceptually to "value" — the backend will interpret as memberCount when the product is ACA_PL).
- **D-17 surface:** ALSO render `entry.acaAttached` (line 273-280) as an editable row in the edit grid with an X button to remove it. Currently the ACA badge is display-only — user cannot delete it via the edit flow. The edit state needs a new slot: `acaChild: { productId, memberCount } | null`.

**Backend (D-13/D-14/D-15/D-16):** extend `PATCH /api/sales/:id` privileged path (`routes/sales.ts:362-435`, specifically the `isPrivileged` branch at 391-435). After the existing `$transaction` that updates the sale and replaces `saleAddon` rows, add:
1. If payload contains an `acaChild` block (new field on the PATCH schema):
   - In the same transaction, create an ACA child sale via the same logic as `POST /sales/aca` (`routes/sales.ts:135-231`) — `premium: 0`, `memberCount`, `productId` (ACA_PL), `agentId` = parent's agent, `memberName` = parent's member name, `saleDate` = parent's sale date. **Important**: this logic should be extracted into a shared service `createAcaChildSale(parentSaleId, { productId, memberCount, userId }, tx)` so both manager entry (`POST /sales/aca`) and payroll edit (`PATCH /sales/:id`) call the same code path.
   - Update the parent sale to set `acaCoveringSaleId` → new child sale id. ⚠ **Schema check:** `acaCoveringSaleId` is set on the CHILD (points UP at the parent), NOT on the parent — verified via `services/payroll.ts:452` comment: *"the acaCoveringSaleId self-relation is set on the CHILD ACA PL sale, pointing UP at this parent"*. CONTEXT.md D-13(b) has the direction reversed. **Correct:** child sale's `acaCoveringSaleId = parentSaleId`. Parent sees it via inverse relation `acaCoveredSales`.
2. Call `upsertPayrollEntryForSale(parentSaleId)` to recalc the parent's PayrollEntry. This single call IS the "sibling recalc" (CONTEXT DRIFT #3 above): since PayrollEntry is one row per (period, sale) with payout aggregated across all products, recomputing the parent entry automatically picks up Phase 46 `acaBundledCommission` via `calculatePerProductCommission`'s `isAcaBundled` branch (line 452). No explicit per-product iteration needed.
3. Call `upsertPayrollEntryForSale(childSaleId)` to create the child's PayrollEntry.
4. `logAudit("edit_sale_aca_attached", "Sale", parentSaleId, { childSaleId, before, after })`.

**D-15 (`resolveBundleRequirement` re-run):** `upsertPayrollEntryForSale` already calls `resolveBundleRequirement` at `services/payroll.ts:354` — no extra work needed.

**D-17 reversal:** When the edit payload signals deletion of the ACA child (e.g. `acaChild: null` explicitly sent after having existed), in the same transaction:
1. Delete the child's PayrollEntry.
2. Delete the child Sale row.
3. Set parent's `acaCoveringSaleId` — **wait, parent doesn't have this field**. Correction: the CHILD has `acaCoveringSaleId` pointing at parent. Deletion of the child naturally breaks the link; no parent mutation needed for unset.
4. Call `upsertPayrollEntryForSale(parentSaleId)` — addons/AD&D revert to standalone rates automatically because `isAcaBundled` will be false after the child is gone.
5. `logAudit("edit_sale_aca_removed", "Sale", parentSaleId, { ... })`.

**Files:**
- Frontend: `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` (lines 83-355)
- Backend: `apps/ops-api/src/routes/sales.ts` (extend PATCH schema + privileged branch)
- Backend service (new helper): `apps/ops-api/src/services/sales.ts` or inline in `routes/sales.ts` — `createAcaChildSale(...)` extraction

### Sub-feature 5: Cross-period chargebacks as negative row

**Affected code paths** (CONTEXT DRIFT #5 — THREE, not one):
1. `apps/ops-api/src/routes/payroll.ts:187-288` — `POST /api/clawbacks` (single chargeback from Lookup UI) — **MAIN PATH**
2. `apps/ops-api/src/routes/chargebacks.ts:194-265` — batch chargeback matched path — **SECONDARY PATH**
3. `apps/ops-api/src/services/alerts.ts:39-225` — `approveAlert` — currently does NOT mutate any PayrollEntry (only creates a Clawback row). Decide: add the cross-period insert here too for parity, or leave alone. Recommend: YES, add, otherwise alerts-approved chargebacks silently bypass the visible payroll deduction UX.

**Current bug (paths 1 and 2):**
```ts
// routes/payroll.ts:224-225 (and near-identical in chargebacks.ts:218-220)
const targetEntry = targetPeriodId
  ? sale.payrollEntries.find(e => e.payrollPeriodId === targetPeriodId) ?? sale.payrollEntries[0]
  : sale.payrollEntries[0];
```
When the sale's only PayrollEntry is in a `LOCKED` or `FINALIZED` period (i.e. not in the oldest-open period for the agent), the `.find(...)` returns undefined and `??` falls back to the original closed-period entry, then mutates it. This is the bug D-18 describes.

**Fix shape:**
```ts
// Replace the targetEntry lookup with branched logic:
const oldestOpenPeriodId = await findOldestOpenPeriodForAgent(sale.agentId);
const existingEntryInOpen = oldestOpenPeriodId
  ? sale.payrollEntries.find(e => e.payrollPeriodId === oldestOpenPeriodId)
  : null;
const originalEntry = sale.payrollEntries[0]; // the entry in the sale's original period
const originalPeriod = originalEntry
  ? await prisma.payrollPeriod.findUnique({ where: { id: originalEntry.payrollPeriodId } })
  : null;

const originalIsOpen = originalPeriod?.status === "OPEN";

if (originalIsOpen && originalEntry) {
  // IN-PERIOD PATH (D-23): zero the original entry in place + mark YELLOW provenance
  await prisma.payrollEntry.update({
    where: { id: originalEntry.id },
    data: {
      payoutAmount: 0,
      netAmount: 0,
      status: "ZEROED_OUT",
      halvingReason: "chargeback_in_period", // D-22 YELLOW marker
    },
  });
} else if (oldestOpenPeriodId) {
  // CROSS-PERIOD PATH (D-18, D-20, D-21): insert NEW negative row in oldest OPEN period
  const chargebackAmount = /* compute via calculatePerProductCommission */;
  await prisma.payrollEntry.create({
    data: {
      payrollPeriodId: oldestOpenPeriodId,
      saleId: sale.id,
      agentId: sale.agentId,
      payoutAmount: 0,
      adjustmentAmount: -chargebackAmount,
      netAmount: -chargebackAmount,
      status: "CLAWBACK_APPLIED",
      halvingReason: "chargeback_cross_period", // D-21 ORANGE marker
    },
  });
} else {
  // No open period exists for this agent — fall back to existing behavior or error
}
```

**⚠ Uniqueness constraint check:** `PayrollEntry` has `@@unique([payrollPeriodId, saleId])` (`schema.prisma:331`). The cross-period insert creates a NEW entry for the same `saleId` but in a DIFFERENT `payrollPeriodId` — the tuple is unique, so the insert is safe. ✅

**⚠ `findOldestOpenPeriodForAgent` gotcha:** current implementation at `services/payroll.ts:403-413` requires `entries: { some: { agentId } }` — it only returns a period where the agent ALREADY has an entry. For a cross-period chargeback, the oldest open period may NOT yet have an entry for this agent. **Action:** either (a) relax the `entries.some.agentId` filter to just `status: "OPEN"` + pick the first by `weekStart`, or (b) add a separate helper `findOldestOpenPeriod()` that doesn't filter on agent. Recommendation: add a new helper to avoid breaking the existing callers in `alerts.ts` that rely on the agent-scoped behavior for different use cases.

**Provenance tagging (D-21/D-22 highlights):** CONTEXT.md asks for orange vs yellow highlights. Options:
1. **Reuse `halvingReason` string field** (recommended) — no schema change. Write `"chargeback_cross_period"` or `"chargeback_in_period"` as sentinel values. Frontend switches row color based on this + `entry.status`. Downside: `halvingReason` is currently used only for halving explanations; repurposing it risks confusion.
2. **Add a `notes` or `provenance` column to `PayrollEntry`** — Prisma migration required.
3. **Add two new enum values** `ZEROED_OUT_IN_PERIOD` and `CLAWBACK_CROSS_PERIOD` to `PayrollEntryStatus` — Prisma migration required, cleaner.

**Recommendation:** Option 3 (new enum values) is cleanest and most semantic. Minor migration cost. All existing `ZEROED_OUT` checks can be widened with a helper `isZeroed(status) = status === "ZEROED_OUT" || status === "ZEROED_OUT_IN_PERIOD"`. The planner should decide.

**Frontend highlight rules** (`WeekSection.tsx:122-128`):
```ts
const rowBg: React.CSSProperties =
  entry.status === "CLAWBACK_APPLIED"                       // Sub-feature 5 cross-period (ORANGE)
  ? { backgroundColor: "rgba(251,146,60,0.10)", borderLeft: "3px solid rgba(251,146,60,0.6)" }  // C.warning orange
  : entry.status === "ZEROED_OUT"                           // Sub-feature 5 in-period (YELLOW)
  ? { backgroundColor: "rgba(234,179,8,0.10)", borderLeft: "3px solid rgba(234,179,8,0.6)" }
  : /* existing declined/needsApproval rules unchanged */;
```
NOTE: current code highlights `CLAWBACK_APPLIED` in RED (`rgba(239,68,68,0.08)`). Sub-feature 5 REPLACES that with ORANGE. Confirm with user if the red-chargeback color must also move to orange or if a third state is desired.

**Print card parity** (`PayrollPeriods.tsx:697-776`): the `printAgentCards` function builds HTML. Add CSS classes `.row-cross-period { background: #fed7aa; border-left: 3px solid #f97316; }` and `.row-in-period-zero { background: #fef3c7; border-left: 3px solid #eab308; }` and emit the appropriate class on each `<tr>` based on `entry.status`.

**Files:**
- Backend: `apps/ops-api/src/routes/payroll.ts` (POST /clawbacks)
- Backend: `apps/ops-api/src/routes/chargebacks.ts` (batch path)
- Backend: `apps/ops-api/src/services/alerts.ts` (approveAlert path — optional but recommended)
- Backend: `apps/ops-api/src/services/payroll.ts` (add `findOldestOpenPeriod()` helper; shared cross-period insert function)
- (Optional) `prisma/schema.prisma` — add new enum values
- Frontend: `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` (row highlight)
- Frontend: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` (print card CSS)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Chargeback amount math | Custom multiplication loop | `calculatePerProductCommission(sale, productIds, fullPayout)` at `services/payroll.ts:419` | Already handles ACA_PL flat, bundled rates, Phase 46 `acaBundledCommission` preference, enrollment bonus, AD_D — and is verified against Phase 45/46 acceptance |
| ACA child sale creation | Duplicate the `POST /sales/aca` body | Extract to `createAcaChildSale(parentSaleId, data, tx)` shared helper and call from both the manager entry route and the new Sub-feature 4 payroll edit path | DRY — Phase 42 logic must stay in ONE place; regression-prone to fork |
| Payroll entry upsert | Raw `prisma.payrollEntry.update` | `upsertPayrollEntryForSale(saleId)` at `services/payroll.ts:330` | Handles period lookup/creation, bonus/fronted/hold preservation, payment-type week shift — trivially idempotent |
| "Oldest open period" resolution | `prisma.payrollPeriod.findMany().sort(...)` | Existing `findOldestOpenPeriodForAgent` at `services/payroll.ts:403` + a new `findOldestOpenPeriod()` variant for the cross-period case where the agent may not yet have an entry | Tested by 260401-nu5 quick task |
| Zod error responses | Raw `parsed.error.flatten()` | `zodErr(parsed.error)` wrapper | CLAUDE.md gotcha — dashboards expect `{ error, details }` shape |

**Key insight:** all five sub-features are fixable by calling existing helpers. No new math, no new primitives. The risk is in MISUSING the helpers or forgetting to call them in both affected code paths (especially Sub-feature 5's triple-path problem).

## Common Pitfalls

### Pitfall 1: Button default type inside forms
**What goes wrong:** HTML `<button>` elements inside a `<form>` default to `type="submit"`. The custom `@ops/ui` `Button` component spreads `{...rest}` onto the raw `<button>` without forcing a default type. Any `<Button onClick={...}>` without explicit `type="button"` triggers form submission on click.
**Why it happens:** W3C spec, not a bug in the codebase.
**How to avoid:** always pass `type="button"` on non-submit buttons inside forms. Consider adding `type="button"` as the DEFAULT in `@ops/ui` Button and requiring opt-in for submit — this would prevent regressions across the codebase.
**Warning signs:** ANY click inside an enclosing `<form>` triggering main-form validation errors.

### Pitfall 2: CONTEXT.md enum names
**What goes wrong:** CONTEXT.md D-18/D-19 uses `PAID` and `CLOSED` as payroll period statuses. Actual Prisma enum is `OPEN / LOCKED / FINALIZED`.
**How to avoid:** grep `schema.prisma` for every enum name before writing predicates. "Closed period" in CONTEXT.md = `status !== "OPEN"` = `status IN ("LOCKED", "FINALIZED")`.
**Warning signs:** TypeScript error `"PAID" is not assignable to PayrollPeriodStatus` during implementation.

### Pitfall 3: `findOldestOpenPeriodForAgent` only returns periods where agent already has an entry
**What goes wrong:** For cross-period chargebacks (Sub-feature 5), the oldest open period may be "fresh" with no entries yet for this agent. The existing helper's `entries: { some: { agentId } }` filter returns `null`, and the chargeback falls through to the closed-period fallback.
**How to avoid:** add a new helper `findOldestOpenPeriod()` that just filters `status: OPEN` and picks the earliest `weekStart`. Call the new helper in Sub-feature 5's insert path.
**Warning signs:** cross-period chargebacks silently no-op and mutate closed-period entries (current behavior).

### Pitfall 4: ACA covering direction
**What goes wrong:** The `acaCoveringSaleId` self-relation is set on the CHILD (pointing at the parent), NOT on the parent. CONTEXT.md D-13(b) reverses this.
**How to avoid:** verified at `services/payroll.ts:452` comment + `schema.prisma` `Sale.acaCoveringSaleId`. The parent uses the inverse relation `acaCoveredSales`. When creating the child, set `child.acaCoveringSaleId = parentId`. The parent is never mutated.
**Warning signs:** Prisma migration errors or `null` FK on parent.

### Pitfall 5: PayrollEntry aggregation
**What goes wrong:** Assuming D-14's "recalculate sibling entries for ADDON and AD_D" means iterating per-product. Reality: `PayrollEntry` has `@@unique([payrollPeriodId, saleId])` — ONE row per sale aggregating all products.
**How to avoid:** single `upsertPayrollEntryForSale(parentSaleId)` call covers everything. `calculateCommission` internally walks all products.
**Warning signs:** "duplicate payroll entry for sale" Prisma errors.

### Pitfall 6: NEXT_PUBLIC_* baked at build time, inline CSS only
**What goes wrong:** Standard CLAUDE.md gotchas (Tailwind, standalone output, zodErr).
**How to avoid:** use `React.CSSProperties` const objects, not `className`. Wrap zod errors in `zodErr()`. Do not touch `next.config.js`.

### Pitfall 7: `halvingReason` repurposing vs new enum
**What goes wrong:** Using `halvingReason` as a provenance tag for Sub-feature 5 can collide with actual halving explanations (e.g. `"ACH_penalty"`, `"commission_not_approved"`).
**How to avoid:** prefer adding two new `PayrollEntryStatus` enum values (`ZEROED_OUT_IN_PERIOD`, `CLAWBACK_CROSS_PERIOD`) via a Prisma migration. This is the cleanest signal for both backend filters and frontend highlighting.
**Warning signs:** a halving-reason lookup returning `"chargeback_cross_period"` and confusing a commission approval flow.

## Code Examples

### Example: Extending `GET /clawbacks/lookup` (Sub-feature 3)

```ts
// apps/ops-api/src/routes/payroll.ts — replace lines 291-316
router.get("/clawbacks/lookup", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed = z.object({
    memberId: z.string().optional(),
    memberName: z.string().optional(),
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { memberId, memberName } = parsed.data;
  if (!memberId && !memberName) return res.status(400).json({ error: "Provide memberId or memberName" });

  const where = memberId ? { memberId } : { memberName };
  const sale = await prisma.sale.findFirst({
    where,
    include: {
      agent: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, type: true } },
      addons: { include: { product: { select: { id: true, name: true, type: true } } } },
      acaCoveredSales: { where: { product: { type: "ACA_PL" } }, select: { id: true } },
      payrollEntries: { select: { payoutAmount: true } },
    },
  });
  if (!sale) return res.status(404).json({ error: "No matching sale found" });

  const fullPayout = sale.payrollEntries[0] ? Number(sale.payrollEntries[0].payoutAmount) : 0;
  const allProducts = [
    { id: sale.product.id, name: sale.product.name, type: sale.product.type, premium: Number(sale.premium) },
    ...sale.addons.map(a => ({
      id: a.product.id,
      name: a.product.name,
      type: a.product.type,
      premium: Number(a.premium ?? 0),
    })),
  ];

  // Compute per-product commission using the canonical helper
  const productsWithCommission = allProducts.map(p => ({
    ...p,
    commission: calculatePerProductCommission(
      sale as Parameters<typeof calculatePerProductCommission>[0],
      [p.id],
      fullPayout,
    ),
  }));

  res.json({
    saleId: sale.id,
    memberName: sale.memberName,
    memberId: sale.memberId,
    agentName: sale.agent.name,
    agentId: sale.agent.id,
    premium: Number(sale.premium),
    enrollmentFee: sale.enrollmentFee != null ? Number(sale.enrollmentFee) : null,
    products: productsWithCommission,
    fullCommission: fullPayout,
  });
}));
```

### Example: Live NET deduction preview (Sub-feature 3 frontend)

```tsx
// apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx — near the result card
const liveNetDeduction = useMemo(() => {
  if (!lookupResult) return 0;
  return lookupResult.products
    .filter(p => selectedProductIds.includes(p.id))
    .reduce((sum, p) => sum + p.commission, 0);
}, [selectedProductIds, lookupResult]);

// In the result card JSX, above the "Products on sale" header:
{lookupResult && (
  <div style={{ display: "grid", gap: S[2], marginBottom: S[4], padding: S[3], background: C.bgSurfaceRaised, borderRadius: R.md }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S[3] }}>
      <div><div style={MINI_LABEL}>Agent</div><div style={MINI_VALUE}>{lookupResult.agentName}</div></div>
      <div><div style={MINI_LABEL}>Member</div><div style={MINI_VALUE}>{lookupResult.memberName}</div></div>
      <div><div style={MINI_LABEL}>Premium</div><div style={MINI_VALUE}>{formatDollar(lookupResult.premium)}</div></div>
      <div><div style={MINI_LABEL}>Enrollment Fee</div><div style={MINI_VALUE}>{lookupResult.enrollmentFee != null ? formatDollar(lookupResult.enrollmentFee) : "—"}</div></div>
    </div>
    <div style={{ marginTop: S[2], paddingTop: S[2], borderTop: `1px solid ${C.borderSubtle}` }}>
      <div style={MINI_LABEL}>Net Chargeback (deducted from agent)</div>
      <div style={{ ...MINI_VALUE, fontSize: 20, color: C.danger, fontWeight: 800 }}>
        −{formatDollar(liveNetDeduction)}
      </div>
    </div>
  </div>
)}
```

### Example: Cross-period chargeback insert (Sub-feature 5)

```ts
// apps/ops-api/src/services/payroll.ts — add new helper
export async function findOldestOpenPeriod(): Promise<{ id: string; weekStart: Date; weekEnd: Date } | null> {
  const period = await prisma.payrollPeriod.findFirst({
    where: { status: "OPEN" },
    orderBy: { weekStart: "asc" },
    select: { id: true, weekStart: true, weekEnd: true },
  });
  return period;
}

// Shared cross-period insert (used by both routes/payroll.ts and routes/chargebacks.ts)
export async function applyChargebackToEntry(
  tx: Prisma.TransactionClient,
  sale: SaleWithEntries,
  chargebackAmount: number,
): Promise<{ mode: "in_period" | "cross_period"; entryId: string }> {
  const originalEntry = sale.payrollEntries[0]; // sale's existing entry
  const originalPeriod = originalEntry
    ? await tx.payrollPeriod.findUnique({ where: { id: originalEntry.payrollPeriodId } })
    : null;

  if (originalPeriod?.status === "OPEN" && originalEntry) {
    // IN-PERIOD: zero out original entry
    const updated = await tx.payrollEntry.update({
      where: { id: originalEntry.id },
      data: {
        payoutAmount: 0,
        netAmount: 0,
        status: "ZEROED_OUT_IN_PERIOD", // new enum value (YELLOW)
      },
    });
    return { mode: "in_period", entryId: updated.id };
  }

  // CROSS-PERIOD: find oldest open period (not agent-scoped) and insert negative row
  const oldestOpen = await tx.payrollPeriod.findFirst({
    where: { status: "OPEN" },
    orderBy: { weekStart: "asc" },
  });
  if (!oldestOpen) throw new Error("No OPEN payroll period exists");

  const created = await tx.payrollEntry.create({
    data: {
      payrollPeriodId: oldestOpen.id,
      saleId: sale.id,
      agentId: sale.agentId,
      payoutAmount: 0,
      adjustmentAmount: -chargebackAmount,
      netAmount: -chargebackAmount,
      status: "CLAWBACK_CROSS_PERIOD", // new enum value (ORANGE)
    },
  });
  return { mode: "cross_period", entryId: created.id };
}
```

## State of the Art

No external library shifts apply. This phase is defect-fix work inside an existing codebase. Confidence HIGH that the relevant APIs (Prisma 5, Next 15, Express, Zod) are unchanged and the codebase's existing patterns remain current.

## Open Questions

1. **New enum values vs `halvingReason` tagging for Sub-feature 5 provenance?**
   - What we know: clean option is a Prisma migration adding `ZEROED_OUT_IN_PERIOD` and `CLAWBACK_CROSS_PERIOD` to `PayrollEntryStatus`.
   - What's unclear: user's preference. CONTEXT.md does not specify.
   - Recommendation: planner picks the enum option; document in PLAN.md. Migration is cheap (1 file).

2. **Should `approveAlert` (services/alerts.ts) also adopt the cross-period insert?**
   - What we know: currently the alerts path creates a Clawback row but does NOT deduct from any PayrollEntry. The user-visible payroll deduction happens ONLY for the direct POST /clawbacks and batch POST /chargebacks paths.
   - What's unclear: whether alerts-approved chargebacks are currently expected to deduct, or intentionally decoupled (maybe a separate settlement job runs later).
   - Recommendation: leave alerts path alone for this phase (D-23 does not mention it). Document as a follow-up quick task.

3. **Existing `CLAWBACK_APPLIED` red highlight — keep or replace with orange?**
   - What we know: `WeekSection.tsx:122` currently applies red to `CLAWBACK_APPLIED`. Sub-feature 5 introduces ORANGE for cross-period CBs.
   - What's unclear: whether any existing `CLAWBACK_APPLIED` rows in the wild should also turn orange or stay red.
   - Recommendation: rename the highlight (red → orange) for `CLAWBACK_APPLIED` as part of Sub-feature 5. If user pushes back, revert and use the new `CLAWBACK_CROSS_PERIOD` enum exclusively.

4. **Phase 47 requirement IDs** — none exist in REQUIREMENTS.md. Use D-IDs for traceability in PLAN.md.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (configured only for `apps/morgan/`) — **no test infrastructure for ops-api or ops-dashboard** |
| Config file | `apps/morgan/package.json` — Morgan tests only |
| Quick run command | `npm test` (runs Morgan suite — not applicable to this phase) |
| Full suite command | `npm test -- --coverage` (Morgan only) |

**⚠ Gap:** there is no test infrastructure for `apps/ops-api` or `apps/ops-dashboard`. Phase 47 either (a) proposes Wave 0 test scaffolding (expensive), or (b) relies on manual verification + type-checking (`tsc`) + dev-server smoke tests.

### Phase Requirements → Test Map

| Decision ID | Behavior | Test Type | Automated Command | Wave 0 Gap? |
|-------------|----------|-----------|-------------------|-------------|
| D-01 | Standalone ACA submit bypasses main-form validation | manual-only | Open `/manager`, expand "Include ACA → Standalone", fill 4 fields, click submit WITH main form empty | Manual |
| D-02 | Standalone ACA requires exactly 4 fields | manual-only | Try submitting with each field empty, verify error | Manual |
| D-04-07 | Pay card dominates >1/3 of screen at 1080p | manual visual | Open `/payroll/periods` at 1080p, measure pay card top | Manual (or Playwright snapshot — Wave 0 gap) |
| D-08-10 | Lookup returns agent + member + net deduction | integration | `curl -H "Authorization: Bearer $TOKEN" "$API/api/clawbacks/lookup?memberId=XYZ"` + JSON schema check | Shell smoke — acceptable |
| D-09 | Live NET recomputes on toggle | manual | Toggle checkboxes in lookup card, observe NET change | Manual |
| D-12 | ACA_PL addon swaps $ input for # members input | manual | Open payroll row edit, add ACA_PL addon, verify input label | Manual |
| D-13-17 | ACA attach creates child sale + recalcs parent + bundle recognition | integration | After edit: query parent's `acaCoveredSales`, check PayrollEntry `payoutAmount` reflects bundled rate | Manual DB check (Wave 0 gap: integration test harness) |
| D-18-21 | Closed-period CB inserts new row in oldest OPEN | integration | Seed a CB against a sale in a LOCKED period, POST /clawbacks, query new PayrollEntry row by `(saleId, oldestOpenPeriodId)` | Manual DB check (Wave 0 gap: integration test harness) |
| D-22 | Yellow highlight for in-period zeroed | manual visual | View a ZEROED_OUT_IN_PERIOD row in payroll | Manual |
| D-23 | In-period zeroing still works | integration | CB against sale in OPEN period → existing entry zeroed | Manual DB check |

### Sampling Rate
- **Per task commit:** `npx tsc -p apps/ops-api/tsconfig.json --noEmit && npx tsc -p apps/ops-dashboard/tsconfig.json --noEmit` — type safety gate
- **Per wave merge:** dev-server smoke test — `npm run ops:dev` + `npm run dashboard:dev`, click through each sub-feature flow manually
- **Phase gate:** seed DB with fixture covering each scenario (sale in OPEN / LOCKED / FINALIZED period, ACA parent, bundled addon sale), run all 5 sub-features end-to-end manually before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No Jest/Vitest/Playwright harness for `apps/ops-api` — phase proceeds with manual verification + tsc. **Do NOT add a full test harness in this phase** — out of scope per CONTEXT.md deferred list (implicit).
- [ ] Seed fixture for Sub-feature 5 testing: need at least one sale in a `LOCKED` period with a related PayrollEntry, plus an `OPEN` period for the same agent. Can be seeded via `prisma/seed.ts` or a one-off dev script under `.planning/phases/47-*/scripts/`.
- [ ] tsc quick command for the whole monorepo: `npm run -ws build --if-present` or parallel tsc calls.

*Validation strategy: **type-safe compilation + manual functional verification** with a dev-fixture for Sub-feature 5. No automated test additions this phase.*

## Sources

### Primary (HIGH confidence — codebase-read, verbatim line refs)

- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` lines 1-30, 260-305, 419-493, 720-910 — submit handler, standalone ACA handler, Button usage
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` lines 1-67, 720-775, 884-1200 — layout, chargeback banner, summary strip, print card
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx` lines 70-85, 290-330, 500-557, 879-1017 — lookup state, handler, result card
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` lines 83-400 — EditableSaleRow, addon grid, save handler
- `apps/ops-api/src/routes/sales.ts` lines 130-230, 360-522 — POST /sales/aca, PATCH /sales/:id
- `apps/ops-api/src/routes/payroll.ts` lines 180-320 — POST /clawbacks, GET /clawbacks/lookup
- `apps/ops-api/src/routes/chargebacks.ts` lines 1-60, 180-300 — batch chargeback path
- `apps/ops-api/src/services/payroll.ts` lines 300-540 — handleCommissionZeroing, upsertPayrollEntryForSale, findOldestOpenPeriodForAgent, calculatePerProductCommission
- `apps/ops-api/src/services/alerts.ts` lines 39-245 — approveAlert transaction
- `prisma/schema.prisma` lines 20-58, 274-346 — enums, PayrollPeriod, PayrollEntry, SaleAddon
- `packages/ui/src/components/Button.tsx` lines 80-110 — Button component default type verification
- `CLAUDE.md` — project conventions, adjustmentAmount negative allowance, zodErr, inline styles, no standalone
- `.planning/STATE.md` — Phase 42/45/46 decision history
- `.planning/phases/47-*/47-CONTEXT.md` — locked decisions D-01 to D-24

### Secondary (MEDIUM confidence)

- `image.png` at repo root — visual reference for Sub-feature 2 spacing

### Tertiary (LOW confidence)

- None. All assertions verified in source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing monorepo, no new libs, verified at Button.tsx/CLAUDE.md
- Architecture patterns: HIGH — all helpers and their signatures verified at services/payroll.ts
- Root-cause of Sub-feature 1: HIGH — single mechanical cause (Button default type), verified in Button.tsx source
- Sub-feature 5 scope: HIGH — both routes and alerts path traced, bug reproduced via code reading
- CONTEXT DRIFT corrections: HIGH — every correction is grounded in a line number

**Research date:** 2026-04-07
**Valid until:** stable for ~30 days (no dependency churn expected)

## RESEARCH COMPLETE

**Phase:** 47 — Sale entry, payroll UI, chargeback fixes bundle

**Confidence:** HIGH

### Key Findings

1. **Sub-feature 1 is a one-character fix.** The standalone ACA Button at `ManagerEntry.tsx:861` is missing `type="button"` and defaults to `type="submit"` inside the enclosing `<form>`. Adding `type="button"` resolves the issue. Optional follow-up: add default `type="button"` to `@ops/ui` Button to prevent future regressions.

2. **CONTEXT.md has 7 drift items** the planner must honor (enum names `OPEN/LOCKED/FINALIZED` not `OPEN/CLOSED/PAID`; `acaCoveringSaleId` direction is on the child not parent; PayrollEntry is aggregated not per-product; lookup endpoint returns only products; Sub-feature 5 has 2-3 code paths not 1; Sub-feature 5 yellow is a NEW highlight not a modified existing one; D-17 requires surfacing the ACA child in the edit UI which currently doesn't exist).

3. **`PayrollEntry.@@unique([payrollPeriodId, saleId])`** makes D-20's cross-period insert trivially safe — same saleId + different periodId is a unique tuple. No schema changes required for the row shape itself.

4. **`findOldestOpenPeriodForAgent` has a hidden filter** (`entries.some.agentId`) that prevents it from finding fresh periods where the agent has no existing entry. Sub-feature 5 needs a new helper `findOldestOpenPeriod()` without the agent scope.

5. **Sub-feature 4 "sibling recalc" is actually one call** to `upsertPayrollEntryForSale(parentSaleId)` — PayrollEntry is rolled-up per-sale, not per-product. `calculateCommission` internally iterates products and picks up `isAcaBundled` via the inverse relation `acaCoveredSales`. Idempotent by construction.

6. **Three possible tagging strategies for Sub-feature 5 orange/yellow highlights**: (a) reuse `halvingReason` string (collision risk), (b) add `notes` column (migration), (c) add two new `PayrollEntryStatus` enum values (migration, cleanest). Recommendation: option (c).

### File Created

`C:\Users\javer\Documents\Repositories\ai-calling-backend\.planning\phases\47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca\47-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Sub-feature 1 root cause + fix | HIGH | Mechanical HTML/DOM behavior, verified in Button.tsx source |
| Sub-feature 2 shrink targets | HIGH | Layout read line-by-line, padding/font values captured |
| Sub-feature 3 endpoint extension | HIGH | Current endpoint response shape captured verbatim, helper formula verified |
| Sub-feature 4 cascade plan | HIGH | PayrollEntry unique constraint + upsert idempotency verified |
| Sub-feature 5 scope (3 paths) | HIGH | Each path read; shared bug pattern identified; helper gap surfaced |
| Enum name corrections | HIGH | Verified at schema.prisma:20-32 |
| `acaCoveringSaleId` direction | HIGH | Verified at services/payroll.ts:452 comment + schema |

### Open Questions

1. Enum migration vs `halvingReason` tagging for Sub-feature 5 provenance (recommend enum migration)
2. Should `approveAlert` also adopt cross-period insert? (recommend: leave alone, out of CONTEXT.md scope)
3. Rename existing `CLAWBACK_APPLIED` red → orange, or introduce new status? (planner decides with user)
4. No formal requirement IDs — use D-01…D-24 as traceability keys

### Ready for Planning

Research complete. Planner can now create PLAN.md files for all 5 sub-features. Recommend one plan per sub-feature (5 plans). Sub-feature 5 is the highest-risk and should be planned with explicit Wave 0 consideration for the enum migration decision.
