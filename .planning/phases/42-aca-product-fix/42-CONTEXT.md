# Phase 42: ACA Product Fix - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix ACA product visibility in the Products tab so it can be viewed and edited with a flat commission rate. Ensure that ACA addon presence on a core sale auto-satisfies the bundle requirement so addons earn full bundled commission (not standalone/halved).

</domain>

<decisions>
## Implementation Decisions

### Products tab visibility
- **D-01:** ACA PL products do not appear at all in the Products tab — the root cause must be identified and fixed so they render in their own group (as Phase 39 intended)
- **D-02:** Once visible, the existing flat commission edit form from Phase 39 is expected to work — no separate editing fix anticipated

### Bundle requirement satisfaction
- **D-03:** Any ACA PL product sold alongside a core sale automatically satisfies that core product's bundle requirement — regardless of the core product's `requiredBundleAddonId` configuration
- **D-04:** When ACA satisfies the bundle, addons earn the full bundled commission rate (e.g., 70%), not the standalone rate (e.g., 35%) or halved amount
- **D-05:** The existing `acaCoveringSaleId` self-relation pattern on Sale is the mechanism — `resolveBundleRequirement` must check for any linked ACA PL sale and treat the bundle as satisfied if found

### Claude's Discretion
- Root cause investigation approach for the visibility bug
- Whether additional test coverage is needed for the ACA bundle path
- Any defensive checks needed if ACA product data is malformed

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ACA product configuration (Phase 39)
- `.planning/milestones/v2.1-phases/39-aca-product-configuration/39-CONTEXT.md` — Original ACA PL product card decisions (flat commission only, edit-only, own group, info-blue color)
- `.planning/milestones/v2.1-phases/39-aca-product-configuration/39-01-SUMMARY.md` — What was implemented in Phase 39

### Commission and bundle logic
- `apps/ops-api/src/services/payroll.ts` — `calculateCommission` (ACA_PL flat commission early return) and `resolveBundleRequirement` (acaCoveringSaleId check)
- `apps/ops-api/src/routes/products.ts` — Products CRUD API (GET returns all types, PATCH includes flatCommission)

### Products UI
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` — Product cards with ACA_PL group rendering, type colors, edit form

### Requirements
- `.planning/REQUIREMENTS.md` — ACA-01 (Products tab visibility + editable flat commission), ACA-02 (bundle requirement satisfaction)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PayrollProducts.tsx`: Already has ACA_PL type handling — type labels, colors (info-blue), edit form with flat commission field, group rendering loop
- `resolveBundleRequirement()`: Already checks `acaCoveringSaleId` to auto-fulfill bundles — needs verification that this path triggers correctly
- `calculateCommission()`: ACA_PL flat commission early return already implemented

### Established Patterns
- Product type colors: `CORE: C.primary400, ADDON: C.accentTeal, AD_D: C.warning, ACA_PL: C.info`
- ACA PL edit form: disabled type selector, single flat commission input field
- Bundle requirement: `requiredBundleAddon` + `fallbackAddons` + `acaCoveringSaleId` three-tier check

### Integration Points
- GET `/products` — returns all products including ACA_PL from DB (no type filter)
- PATCH `/products/:id` — update schema includes `flatCommission` field
- `resolveBundleRequirement` — called in `upsertPayrollEntryForSale` during commission calculation
- Manager entry form — ACA checkbox creates covering sale with `acaCoveringSaleId` link

</code_context>

<specifics>
## Specific Ideas

- Full bundled commission for addons when ACA is present — user gave concrete example: Complete Care + ACA = 70% bundled commission on addons, not 35% standalone
- ACA auto-satisfies bundle regardless of core product's requiredBundleAddonId configuration

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 42-aca-product-fix*
*Context gathered: 2026-04-06*
