# Phase 39: ACA Product Configuration - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Make ACA PL products editable with configurable commission in the Products tab. ACA_PL enum and flatCommission field already exist in Prisma schema. Products API and dashboard UI currently exclude ACA_PL type.

</domain>

<decisions>
## Implementation Decisions

### ACA PL card layout
- **D-01:** ACA PL product card shows only flat commission amount (dollar amount per member) — no premium threshold, no percentage-based commission fields, no bundled/standalone split
- **D-02:** Existing commission fields (commissionBelow, commissionAbove, bundledCommission, standaloneCommission, premiumThreshold, enrollFeeThreshold) are irrelevant for ACA PL and should not appear on the card

### Create vs edit scope
- **D-03:** Edit only — staff can modify existing ACA PL products but cannot create new ones from the Products tab. ACA PL products are created via the sales flow. The "Add Product" form should not offer ACA_PL as a type option.

### Grouping in Products tab
- **D-04:** ACA PL products displayed as their own separate group in the Products tab, visually distinct from CORE/ADDON/AD&D groups

### Claude's Discretion
- ACA PL group heading style and placement (top, bottom, or alongside other groups)
- Card color/accent for ACA PL type (info-blue already used for ACA badges in payroll cards per prior decisions)
- Input field styling for flat commission amount
- Whether to show member count context or just the dollar amount

</decisions>

<specifics>
## Specific Ideas

No specific requirements — standard approach matching existing product card patterns with simplified fields for ACA PL.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above and REQUIREMENTS.md (ACA-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PayrollProducts.tsx` (645 lines): Existing product card/list component — extend with ACA_PL support
- `ProductCard` component: Card layout with edit mode, save/delete — reuse pattern for ACA variant
- `@ops/ui` Badge, Button, Card, EmptyState: Shared UI components already imported

### Established Patterns
- Product type colors: `CORE: C.primary400, ADDON: C.accentTeal, AD_D: C.warning` — add ACA_PL color
- ACA badge uses info-blue color in payroll cards (prior decision from STATE.md)
- Product state uses `useState` with string-ified numeric fields for form editing
- Inline `React.CSSProperties` — no Tailwind

### Integration Points
- **API routes** (`apps/ops-api/src/routes/products.ts`):
  - GET `/products` — already returns all products (including ACA_PL from DB), no type filter
  - POST `/products` — type enum `z.enum(["CORE", "ADDON", "AD_D"])` — do NOT add ACA_PL (D-03: edit only)
  - PATCH `/products/:id` — type enum same exclusion — but must add `flatCommission` to the update schema
- **Prisma schema**: `flatCommission Decimal? @db.Decimal(12, 2)` already exists on Product model
- **Commission logic** (`apps/ops-api/src/services/payroll.ts`): ACA_PL flat commission uses early return before percentage logic — already implemented

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 39-aca-product-configuration*
*Context gathered: 2026-04-01*
