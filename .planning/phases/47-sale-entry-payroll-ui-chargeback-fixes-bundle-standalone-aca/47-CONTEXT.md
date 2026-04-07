# Phase 47: Sale entry, payroll UI, chargeback fixes bundle — Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Five targeted fixes spanning manager sale entry, payroll dashboard layout, chargeback lookup UI, payroll row editing, and cross-period chargeback handling:

1. **Standalone ACA skips main sale form validation** — the standalone ACA collapsible section submits independently; main sale form fields (payment method, core product, etc.) no longer block standalone ACA submission.
2. **Payroll period spacing prioritizes pay cards** — shrink the period header and overall UI chrome so pay cards (the main focus for payroll verification) dominate >1/3 of the screen instead of being pushed below the fold. Ref: `image.png` at repo root.
3. **Single Chargeback Lookup (Chargebacks tab) shows agent/member/amount/net deduction** — the "Single Chargeback Lookup" card in `PayrollChargebacks.tsx` currently shows only product chips after lookup. Add agent name, member name, sale amount, and a live net-deduction preview that updates as the user toggles product selection.
4. **Payroll row edit — ACA product uses member count; bundled addons/AD&D auto-recalculate** — when user picks an ACA_PL product in the payroll edit addon dropdown, swap the $ input for a member-count input, create a proper ACA covering child sale with `acaCoveringSaleId`, and recalculate existing sibling ADDON/AD&D payroll entries to pick up Phase 46 `acaBundledCommission` rates.
5. **Closed-period chargebacks appear as a negative row in the oldest OPEN period** — instead of zeroing the original sale's commission in the closed period, insert a new visually-matching payroll row in the oldest OPEN period (payroll runs 1 week in arrears so 2–3 open periods can overlap) with a negative commission amount and an orange highlight. In-period (still-open) chargeback zeroing stays, but the zeroed row is highlighted yellow.

**Out of scope:** Redesigning the chargeback model, restructuring payroll period logic, changing socket transport, or modifying the Phase 46 `Chargebacks (N)` alert badge.

</domain>

<decisions>
## Implementation Decisions

### Sub-feature 1: Standalone ACA form skip

- **D-01:** The standalone ACA collapsible section in `ManagerEntry.tsx` submits independently of the main sale form. Main sale form fields (payment method, core product, etc.) no longer block standalone ACA submission — validation and required-field logic must not fire for the main form when the standalone ACA path is used.
- **D-02:** Standalone ACA submission requires exactly these four fields: **agent**, **member name**, **ACA carrier (product)**, **member count**. No others.
- **D-03:** Existing standalone ACA state (`acaStandaloneAgent`, `acaStandaloneMemberName`, `acaStandaloneCarrier`, `acaStandaloneMemberCount`) stays as-is; only the submit gate changes.

### Sub-feature 2: Payroll period spacing prioritizes pay cards

- **D-04:** Shrink the top padding/spacing AND overall UI chrome above pay cards in `PayrollPeriods.tsx` so pay cards become the dominant element (>1/3 of screen per user feedback).
- **D-05:** KPIs stay visible but compressed — smaller font sizes, tighter padding, and/or single-line layout for the period summary ticker.
- **D-06:** Must remain visible regardless of shrink strategy:
  - Date range header (e.g., `04-20-2026 → 04-19-2026`)
  - Net Payout total (primary period KPI)
  - Period action buttons (Lock/Unlock/Export/Print)
  - Phase 46 `Chargebacks (N)` badge
- **D-07:** Reference screenshot: `image.png` at repo root shows current spacing problem — agent list on left, period summary ticker consuming ~30% vertical, first pay card (Malik) pushed down. Target: pay cards visible immediately below date range without scrolling at 1080p.

### Sub-feature 3: Single Chargeback Lookup (Chargebacks tab) — info surfacing

- **D-08:** The Single Chargeback Lookup result card in `PayrollChargebacks.tsx` (section starts at `SECTION_HEADING "Single Chargeback Lookup"` ~line 882, result rendering ~line 925) must display after a successful lookup:
  - Agent name (from matched sale)
  - Member name (from matched sale)
  - Sale amount (sale total or per-product, whichever matches existing data model)
  - Products on sale with selection checkboxes (**existing** — unchanged)
  - **Net chargeback amount that will be deducted from the agent** — live-updates as user toggles product selection in the existing product checklist
- **D-09:** Net deduction calculation = sum of each selected product's commission value × applicable chargeback rate (same formula the clawback service uses server-side). Frontend computes this live from response data; backend MAY compute a canonical value and return it so frontend math matches server math.
- **D-10:** Backend: `GET /api/clawbacks/lookup` (currently returns `lookupResult` with `products`) must also return `agent.name`, `memberName`, `amount`, and per-product commission data. Verify the existing endpoint; extend if missing.
- **D-11:** Layout inside the result card is Claude's discretion — match the existing `PayrollChargebacks.tsx` visual pattern (same typography, card style, color palette).

### Sub-feature 4: Payroll row edit — ACA product uses member count

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

### Sub-feature 5: Closed-period chargebacks → negative row in oldest OPEN period

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Manager sale entry
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` §lines 274–277, 816–893 — standalone ACA state + submit handler; Sub-feature 1 gates the main-form validation around this block

### Payroll period UI
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — period header + KPI ticker layout; Sub-feature 2 shrinks the top chrome here
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` §`printAgentCards` ~line 697 — print HTML; Sub-feature 5 needs orange highlighting parity on print cards
- `image.png` at repo root — reference screenshot showing current spacing problem for Sub-feature 2

### Payroll row editing
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` §`EditableSaleRow` (line 83, addon dropdown ~line 204–234) — the $ → member-count swap (D-12) and ACA-in-edit flow
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` §lines 248–279 — payroll card ACA badge rendering (already handled in Phase 46; reference only)

### Chargebacks UI
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx` §"Single Chargeback Lookup" (~line 879–1010) — result card for Sub-feature 3; lookup handler at `lookupSale()` ~line 502
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx` §`lookupResult` state ~line 292–296 — shape extension point for D-10

### Commission + bundle logic
- `apps/ops-api/src/services/payroll.ts` §`calculateCommission` (line 103) — Sub-feature 4 sibling recalc (D-14) calls this after ACA attachment
- `apps/ops-api/src/services/payroll.ts` §`resolveBundleRequirement` (line 218) — Sub-feature 4 re-runs for bundle satisfaction (D-15)
- `apps/ops-api/src/services/payroll.ts` §`upsertPayrollEntryForSale` — the function that should be re-invoked on sibling entries during D-14 recalc

### Chargeback pipeline
- `apps/ops-api/src/routes/chargebacks.ts` — chargeback creation routes; Sub-feature 5 inserts the closed-period branch here
- `apps/ops-api/src/services/alerts.ts` — alert + clawback pipeline; may need awareness of cross-period flag so the row renders correctly
- `apps/ops-api/src/routes/clawbacks.ts` (or wherever `/api/clawbacks/lookup` lives) — Sub-feature 3 extends response (D-10)

### Payroll period status + schema
- `prisma/schema.prisma` §`PayrollPeriod` — `status` enum (PAID/CLOSED/OPEN) for D-18/D-19 "oldest open" resolution
- `prisma/schema.prisma` §`PayrollEntry` — `adjustmentAmount` already supports negatives (per CLAUDE.md "adjustmentAmount allows negatives"); D-20 uses this directly
- `prisma/schema.prisma` §`Sale.acaCoveringSaleId` self-relation — Phase 42 primitive reused by D-13

### Phase 46 references (carried forward)
- Phase 46 D-04: `acaBundledCommission` rate activates for ADDON/AD&D when parent has `acaCoveringSaleId` — Sub-feature 4 D-14 triggers this
- Phase 46 D-12: `Chargebacks (N)` badge format — NOT the same thing as Sub-feature 3; that is about the payroll alert badge in period header, Sub-feature 3 is about the Single Chargeback Lookup card in the Chargebacks tab

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`authFetch()`** from `@ops/auth/client` — standard for the D-10 augmented lookup call
- **`Badge` component** used for `entry.acaAttached` chip on `WeekSection.tsx:275` — reuse for any new status chips
- **`C.warning` / theme color tokens** — already used for orange on fronted amounts (per STATE.md) — reuse for D-21 row highlight
- **`calculateCommission`, `upsertPayrollEntryForSale`, `resolveBundleRequirement`** in `services/payroll.ts` — Sub-feature 4 recalc reuses these
- **Phase 42 ACA child-sale creation flow** — Sub-feature 4 D-13 should mirror the same code path used for standalone ACA creation

### Established Patterns
- **Inline React.CSSProperties** for all styling (no Tailwind, per CLAUDE.md) — all new rendering in this phase follows this pattern
- **`prisma.$transaction`** wrapping multi-row updates — D-14 sibling recalc and D-13 covering-sale creation should be transactional
- **Audit log via `logAudit()`** — Sub-feature 4 D-16 and Sub-feature 5 cross-period insertion both write audit entries
- **Zod wrapped with `zodErr()`** — any new API validation follows this (per CLAUDE.md)
- **`adjustmentAmount` already allows negatives** — D-20 cross-period negative row uses this field directly without a schema change

### Integration Points
- Sub-feature 2 (spacing) is a **pure frontend** change in `PayrollPeriods.tsx`; no API changes
- Sub-feature 1 (standalone ACA form) is **pure frontend** in `ManagerEntry.tsx`; no API changes (the existing `/api/sales` endpoint already accepts the standalone ACA payload)
- Sub-feature 3 (lookup UI) is **frontend + one endpoint extension** (`/api/clawbacks/lookup` response shape)
- Sub-feature 4 (payroll row edit ACA) is **frontend + backend** — editor change + sale edit endpoint must handle the ACA branch + recalc cascade
- Sub-feature 5 (cross-period chargeback) is **primarily backend** in `chargebacks.ts` + `alerts.ts` + `payroll.ts`, with a small frontend change for row highlight in `WeekSection.tsx` + `PayrollPeriods.tsx` (print card)

</code_context>

<specifics>
## Specific Ideas

- Sub-feature 2: target user's explicit feedback — "payroll cards take up less than 1/3 the screen the KPIs are necessary but we can reduce taking up so much of the screen when payroll entries are the main focus"
- Sub-feature 3: user explicitly asked for "NET CHARGEBACK THAT WILL BE DEDUCTED FROM THE AGENT" as a displayed value — live, reactive to product selection
- Sub-feature 4: user's reproduction — "when I try to add ACA product it requires dollar amount instead of number of members and once I added the add-ons and AD&D stayed payable as standalone instead of bundled" — this is the exact defect to fix
- Sub-feature 5: user confirmed "TARGET THE OLDEST OPEN PAYROLL PERIOD WE PAY 1 WEEK IN ARREARS SO AGENTS CAN SOMETIMES HAVE 2 OR 3 OPEN PAY PERIODS" — oldest open, not current
- Sub-feature 5: user confirmed two distinct highlights — **orange for cross-period (CLOSED → OPEN)**, **yellow for in-period zeroed** — both apply to print cards too

</specifics>

<deferred>
## Deferred Ideas

- Retroactive recalculation of pre-deploy payroll entries (deferred — D-24)
- Redesigning the Phase 46 `Chargebacks (N)` alert badge (out of scope — user clarified Sub-feature 3 is about the Chargebacks tab lookup, not the alert badge)
- New tables for tracking cross-period chargeback provenance (deferred — existing `PayrollEntry.adjustmentAmount` + `sale` FK is sufficient for D-20)

</deferred>

---

*Phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca*
*Context gathered: 2026-04-07*
