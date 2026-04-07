# Phase 46: ACA Bundle Commission Rate, CS Chargeback Alert Surfacing, ACA Print Parity, ACA Cascade Delete - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Five targeted fixes spanning the payroll product config, payroll alerts UI, payroll print view, and payroll row deletion:

1. **ACA-bundle commission rate field on ADDON and AD&D products** — a third commission rate (alongside `standaloneCommission` and `bundledCommission`) that applies when the add-on / AD&D is bundled with an ACA sale, configured in the Products tab edit/create form and consumed by `calculateCommission`.
2. **CS-submitted chargebacks must surface in payroll alerts** — chargebacks created via the CS dashboard are not currently raising alerts in the payroll dashboard. Investigate root cause first, then fix.
3. **Minimize chargeback alerts in payroll with grouped count + drill-down** — replace per-chargeback noise with a single collapsed badge that expands to a per-chargeback list showing member name, agent name (from sales row), chargeback amount, and the same product selection chips already used in the chargeback form.
4. **ACA badge parity in print view** — the print HTML in `printAgentCards` does not render the `entry.acaAttached` chip that the payroll card shows. Add it as an inline chip inside the Core column.
5. **Single-action delete for ACA-bundled sales** — when deleting a payroll row whose sale has an attached ACA child sale, the parent delete leaves the ACA child orphaned, requiring a second delete click. Cascade the delete so one click removes both the parent sale and its ACA-covering child sale (and the child's payroll entry).

**Out of scope:** Restructuring the chargeback model, redesigning the Products tab beyond adding one rate field, or changing the existing payroll alert socket transport.
</domain>

<decisions>
## Implementation Decisions

### ACA-bundle commission rate (Sub-feature 1)

- **D-01:** Add a new optional decimal field `acaBundledCommission Decimal? @map("aca_bundled_commission") @db.Decimal(5,2)` on the `Product` model in `prisma/schema.prisma`. Generate a migration.
- **D-02:** The new rate field is exposed in the **existing product box** in the Products tab (`PayrollProducts.tsx`) — both the create form and the edit form — placed alongside the existing **Standalone Commission** and **Bundled Commission** inputs. Label: `ACA Bundle Commission (%)`.
- **D-03:** Field is shown / editable for `ADDON` and `AD_D` product types only. For `CORE` and `ACA_PL` products it should be omitted from the form. Display row should match the existing inline format used for Standalone / Bundled (e.g. `· ACA Bundle: 50%`).
- **D-04:** Commission calculation in [payroll.ts:103 `calculateCommission`](apps/ops-api/src/services/payroll.ts#L103): when an ADDON or AD&D entry belongs to a sale that has `acaCoveringSaleId` set (i.e., the sale was bundled with an ACA sale via the Phase 42 self-relation), use `acaBundledCommission` as the rate **in preference to** `bundledCommission` for that entry. If `acaBundledCommission` is null, fall back to existing behavior (`bundledCommission` for AD&D and addons-with-rate; folded into core bundle for addons-without-rate).
- **D-05:** No retroactive recalculation. Existing payroll entries are not regenerated; the new rate applies only to commission calculations performed after deploy.

### CS chargeback alert surfacing (Sub-feature 2)

- **D-06:** First task in this sub-feature is a **diagnostic trace**, not a fix. Trace the path: CS dashboard chargeback submission → `apps/ops-api/src/routes/chargebacks.ts` (or wherever CS submissions land) → `apps/ops-api/src/services/alerts.ts` → payroll dashboard alert fetch → render. Identify whether the gap is at: (a) alert creation, (b) socket emission, (c) payroll-side query filter, or (d) UI rendering.
- **D-07:** Once root cause is identified, fix it minimally — do not refactor the chargeback model or alerts system.
- **D-08:** Acceptance: a chargeback submitted in the CS dashboard for a member that matches a sale must produce a payroll alert visible to the agent who owns that sale, surfaced in the same alert area as currently-working payroll-originated chargebacks.

### Minimized chargeback alerts + lookup (Sub-feature 3)

- **D-09:** Collapse all current chargeback alerts under a single **`Chargebacks (N)` badge** placed in the payroll period header area where existing alerts currently stack.
- **D-10:** Clicking the badge expands an inline panel (not a modal). Each row in the panel shows:
  - Member name (from matched sale's `memberName`)
  - Agent name (from matched sale's `agent.name`)
  - Chargeback amount
  - Product selection chips — reuse the **exact same product selection UI** the chargeback creation form uses today (so the visual matches what users entered). Locate it in `PayrollChargebacks.tsx` and lift the chip rendering for reuse if needed.
- **D-11:** Each expanded row keeps its existing approve / dismiss / clawback action buttons — minimization is purely visual grouping, not action removal.
- **D-12:** If only 1 chargeback exists, the badge still uses the count format `Chargebacks (1)`; the expanded panel still applies (consistent UI). Do not auto-expand on count of 1.

### ACA print parity (Sub-feature 4)

- **D-13:** Modify `printAgentCards` in [PayrollPeriods.tsx:697](apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx#L697) so that for any entry where `entry.acaAttached` is set, the ACA chip renders **inline inside the Core column** alongside the core product chip — matching how the payroll card shows ACA next to the product (WeekSection.tsx:272-279).
- **D-14:** Use a print-friendly chip style mirroring the existing `.prod-block` / `.prod-name` classes plus a distinct ACA color tone (e.g., teal/info background) so it visually reads as ACA but does not break the existing column layout.
- **D-15:** Do not add a new ACA column. Do not modify the bucket logic for CORE/ADDON/AD_D — the ACA chip is rendered as an addition to the existing Core cell, not via the type buckets.
- **D-16:** Test target: print Sammy Machado's row from week 04-05 → 04-11; verify ACA chip is visible in the printed Core column.

### Single-action delete for ACA-bundled sales (Sub-feature 5)

- **D-17:** When `DELETE /sales/:id` is called on a parent sale that has any child sales linked via `acaCoveringSaleId`, the route must also delete those child ACA sales (and their `payrollEntry`, `clawback`, `saleAddon`, `statusChangeRequest`, `saleEditRequest` rows) inside the same `prisma.$transaction`. Currently the route at [sales.ts:523-539](apps/ops-api/src/routes/sales.ts#L523-L539) only deletes the parent, leaving the ACA child orphaned.
- **D-18:** Order of operations in the transaction: collect child sale IDs first (`prisma.sale.findMany({ where: { acaCoveringSaleId: saleId }, select: { id: true } })`), then deleteMany on each child's dependents, then delete the child sales, then proceed with the existing parent cleanup. All in one `prisma.$transaction` for atomicity.
- **D-19:** Audit log should record the cascaded child sale IDs alongside the parent (extend the `logAudit` payload — do not silently drop them).
- **D-20:** Acceptance: deleting Sammy Machado's AD&D core sale row that has an ACA chip in one click removes both rows; the payroll card should not require a second delete.

### Claude's Discretion

- Exact print chip color (must read clearly on black-and-white print but stay teal/info on color print)
- Exact placement of the new `ACA Bundle Commission (%)` input within the existing two-column layout in `PayrollProducts.tsx` (immediately after Standalone is fine)
- Internal helper extraction for the chargeback chip lookup row component
- Migration name and timestamp
- Whether the diagnostic trace (D-06) produces an inline finding or a separate `46-DIAGNOSIS.md` artifact — planner decides

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Commission calculation
- `apps/ops-api/src/services/payroll.ts` §`calculateCommission` (line 103) — bundle/standalone/AD&D commission logic; this is where `acaBundledCommission` must be wired in
- `apps/ops-api/src/services/payroll.ts` §`resolveBundleRequirement` (line 218) — how ACA satisfies bundle requirements (Phase 42 D-03 reference)

### Product config UI
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` — edit form (~line 305-313) and create form (~line 605-615) where Standalone / Bundled inputs already live; new ACA Bundle field goes alongside

### Payroll card vs. print
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` §lines 248-279 — ACA badge + acaAttached chip rendering pattern that print must mirror
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` §`printAgentCards` (line 697-795) — print HTML; bucket logic on lines 758-784 needs ACA inline chip

### Chargebacks
- `apps/ops-api/src/routes/chargebacks.ts` — chargeback creation routes (CS path is where the alert gap likely lives)
- `apps/ops-api/src/services/alerts.ts` — alert + clawback creation pipeline
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx` — current alert UI in payroll; product chip rendering to reuse
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` — CS submission entry point that must trigger alerts

### Sale deletion cascade
- `apps/ops-api/src/routes/sales.ts` §`DELETE /sales/:id` (lines 523-539) — current delete transaction; needs ACA child cascade
- `prisma/schema.prisma` §Sale `acaCoveringSaleId` self-relation — defines the parent → ACA child link added in Phase 42

### Schema
- `prisma/schema.prisma` §Product (lines 136-139) — where `acaBundledCommission` column gets added

### Prior phase context
- `.planning/phases/42-*-CONTEXT.md` — ACA self-relation and acaCoveringSaleId pattern
- `.planning/phases/45-*-CONTEXT.md` — ACA badge / acaAttached chip introduced in payroll card (GAP-45-07)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Inline product chip rendering** in `printAgentCards` (`prod-block` / `prod-name` / `prod-premium` CSS classes) — extend with an `aca` variant
- **`ACA_BADGE` style + `Badge` component** in WeekSection.tsx for the on-screen ACA chip — print should visually reference this so users see parity
- **Product chip UI in `PayrollChargebacks.tsx`** used in the chargeback form — lift for reuse in the collapsed alert lookup row
- **Existing `bundledCommission` / `standaloneCommission` form rows** in `PayrollProducts.tsx` — copy the same input pattern for `acaBundledCommission`
- **`acaCoveringSaleId` self-relation** on `Sale` (Phase 42) — already populated whenever an ADDON/AD&D sale is bundled with an ACA sale; calculation logic just needs to read it

### Established Patterns
- All product commission rate fields are `Decimal?` with `@db.Decimal(5,2)` and snake_case `@map`
- All product form inputs use `inputStyle` + `LBL` constants and are grouped two-per-row in the edit/create panels
- Print view uses inline `<style>` block with PX-based layout, not the dashboard's React.CSSProperties theme — do not import dashboard styles into the print HTML
- Payroll alerts already use a Socket.IO `alerts_batch_created` event (Phase 44) — confirm CS chargebacks emit through the same pipeline
- Chargeback dedupe is per-chargeback/sale (`matchedBy: "chargeback_alert"`) — do not regress this when adding the CS path

### Integration Points
- `prisma/schema.prisma` → migration → `@ops/db` regeneration → `payroll.ts` consumption
- Products tab form → POST/PATCH /api/products in `routes/index.ts` → must accept the new field
- CS chargeback route → `alerts.ts` `createChargebackAlert` (or equivalent) → payroll alert fetch
- `printAgentCards` is invoked from `AgentCard.tsx:167` via the `onPrintWeek` prop

</code_context>

<specifics>
## Specific Ideas

- "It should be in the existing product box in the product tabs for add-ons and AD&D, same place standalone commission and core product bundle commission are" — confirms field placement (D-02)
- "Single chargeback lookup in payroll should show member name and all information from sales row, agent name that it applies to, and chargeback amount with the same product selection for chargeback it currently has" — drives D-10 (reuse existing chargeback form chip UI)
- "ACA product badge not showing up in print the same way it shows in payroll card" — Sammy Machado week 04-05 → 04-11 is the visual test case (D-16)

</specifics>

<deferred>
## Deferred Ideas

- Restructuring chargeback approval workflow or redesigning `PayrollChargebacks.tsx` beyond minimization — out of scope, future phase if needed
- Retroactive recalculation of historical payroll entries against the new ACA bundle rate — explicitly excluded (D-05)
- Adding ACA as its own dedicated print column (option discussed but rejected in favor of inline chip)
- Migrating chargeback alerts off Socket.IO `alerts_batch_created` — out of scope

</deferred>

---

*Phase: 46-bundle-commission-box-for-add-ons-and-ad-d-when-bundled-with*
*Context gathered: 2026-04-07*
