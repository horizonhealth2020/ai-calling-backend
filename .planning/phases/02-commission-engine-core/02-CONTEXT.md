# Phase 2: Commission Engine Core - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Product type bundle logic calculates correct commission rates. Covers COMM-01 through COMM-07 and COMM-11. Enrollment fee rules (COMM-08, COMM-09) and period assignment (PAYR-01, COMM-10) belong to Phase 3. No UI changes — this is backend commission calculation only.

</domain>

<decisions>
## Implementation Decisions

### Bundle qualifier flag
- Add `isBundleQualifier` Boolean field to Product model (default false)
- Only Compass VAB will have this flag set to true — single product qualifier
- Auto-flag existing Compass VAB product(s) via data migration (match by name, set flag)
- Commission engine replaces string matching (`n.includes("compass") && n.includes("vab")`) with `product.isBundleQualifier` check
- Remove FL (Florida) memberState exemption from the Compass VAB rule entirely
- Existing `commissionApproved` field on Sale serves as the manual override to waive half-commission

### Bundle commission calculation (core + add-ons)
- When a sale has a core product, sum all premiums (core + non-qualifier add-ons) into a combined total
- Compass VAB premium is excluded from the combined total (it's a qualifier, not a contributor)
- Compare combined premium total against core product's `premiumThreshold`
- Apply core product's `commissionAbove` or `commissionBelow` rate to the combined total
- One calculation per bundle, not per-product
- One PayrollEntry per sale (not per product)

### Compass VAB halving rule
- If a sale has a core product but NO bundle qualifier (isBundleQualifier product), entire sale commission is halved
- "Entire sale" means core+addon bundle commission AND AD&D commission — everything
- Exception: if `sale.commissionApproved` is true, skip the halving (manual override)
- FL exemption removed — all states follow the same rule

### AD&D commission
- AD&D calculated separately from the core+addon bundle — its own rate × its own premium
- When bundled with core: use `product.bundledCommission` × AD&D premium
- When standalone (no core in sale): use `product.standaloneCommission` × AD&D premium
- Database fields only — no hardcoded fallback defaults (70%/35% removed)
- If bundledCommission or standaloneCommission is null, commission is $0 (forces correct product configuration)
- Compass VAB halving applies to AD&D portion too (consistent with "entire sale" decision)

### Standalone add-on commission
- When an add-on is sold without a core product: `product.standaloneCommission` × addon premium
- No threshold logic for standalone add-ons (threshold only applies to core-bundled sales)

### Commission rounding (COMM-11)
- Round final total to 2 decimal places
- Claude's discretion on per-step vs final rounding approach

### Claude's Discretion
- Rounding strategy (per-step vs final-only)
- Test structure and organization
- Migration file naming and structure
- Error handling for edge cases (null premiums, missing products)

</decisions>

<specifics>
## Specific Ideas

- The `commissionApproved` field already exists on Sale — reuse it as the manual override for half-commission waiver instead of building a new approval mechanism
- Bundle detection must work with the existing SaleAddon relationship (sale.addons includes product)
- Compass VAB's premium should NOT be added to the combined premium total — it qualifies the bundle but doesn't contribute to commission calculation

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `payroll.ts` (apps/ops-api/src/services/payroll.ts): Full commission engine — `calculateCommission()`, `calcProductCommission()`, `applyEnrollmentFee()`, `upsertPayrollEntryForSale()`
- `commissionApproved` field on Sale model: Already exists, currently used in enrollment fee logic, can be reused for VAB override
- Product model fields: `bundledCommission`, `standaloneCommission`, `commissionAbove`, `commissionBelow`, `premiumThreshold` all exist

### Established Patterns
- Commission calc is synchronous pure function (`calculateCommission`) called by async `upsertPayrollEntryForSale`
- Product types use `ProductType` enum: CORE, ADDON, AD_D
- Decimal fields use Prisma `@db.Decimal(12, 2)` or `@db.Decimal(5, 2)` for rates
- Sale includes addons via `sale.addons` with `{ include: { product: true } }`

### Integration Points
- `upsertPayrollEntryForSale(saleId)` is called after sale creation in routes — entry point for commission calc
- `getSundayWeekRange()` maps sale date to current week (Phase 3 will fix to arrears) — don't modify in this phase
- `applyEnrollmentFee()` handles COMM-08/09 — Phase 3 scope, don't modify core logic here

</code_context>

<deferred>
## Deferred Ideas

- Payroll dashboard "Approve" button to waive half-commission qualifiers and grant full commission — new UI capability, belongs in a future phase (could be Phase 7 with payroll management or a separate phase)

</deferred>

---

*Phase: 02-commission-engine-core*
*Context gathered: 2026-03-14*
