# Phase 39: ACA Product Configuration - Research

**Researched:** 2026-04-01
**Domain:** Dashboard UI + API route extension for ACA PL product editing
**Confidence:** HIGH

## Summary

This phase requires extending the existing Products tab to display and edit ACA PL products. The implementation is straightforward because all the infrastructure already exists: the `ACA_PL` enum value is in the Prisma schema, the `flatCommission` field exists on the Product model, the GET `/products` endpoint already returns ACA PL products from the database, and the commission calculation logic in `payroll.ts` already handles ACA PL flat commission with an early return.

The work is purely additive: (1) add `flatCommission` to the PATCH `/products/:id` Zod schema so the API accepts it, (2) extend the `PayrollProducts.tsx` component to recognize `ACA_PL` as a product type, render a simplified card showing only flat commission, and group ACA PL products separately from CORE/ADDON/AD_D products.

**Primary recommendation:** Follow the existing ProductCard pattern but with a minimal edit form -- only `flatCommission` and `notes` fields. Use `colors.info` for the ACA PL type color to match the existing info-blue ACA badge convention.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: ACA PL product card shows only flat commission amount (dollar amount per member) -- no premium threshold, no percentage-based commission fields, no bundled/standalone split
- D-02: Existing commission fields (commissionBelow, commissionAbove, bundledCommission, standaloneCommission, premiumThreshold, enrollFeeThreshold) are irrelevant for ACA PL and should not appear on the card
- D-03: Edit only -- staff can modify existing ACA PL products but cannot create new ones from the Products tab. ACA PL products are created via the sales flow. The "Add Product" form should not offer ACA_PL as a type option.
- D-04: ACA PL products displayed as their own separate group in the Products tab, visually distinct from CORE/ADDON/AD_D groups

### Claude's Discretion
- ACA PL group heading style and placement (top, bottom, or alongside other groups)
- Card color/accent for ACA PL type (info-blue already used for ACA badges in payroll cards per prior decisions)
- Input field styling for flat commission amount
- Whether to show member count context or just the dollar amount

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ACA-01 | ACA PL product is editable in the Products tab with configurable commission amount | API PATCH schema needs `flatCommission` added; UI needs ACA_PL type in ProductCard with simplified fields; grouping logic needs ACA_PL section |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 (Next.js 15) | UI components | Already used by ops-dashboard |
| Zod | current | API request validation | Already used in products.ts routes |
| Prisma | current | Database ORM | Already used, Product model has flatCommission field |
| @ops/ui | internal | Badge, Button, Card, colors, spacing | Already imported in PayrollProducts.tsx |

No new dependencies required. This phase uses only existing libraries.

## Architecture Patterns

### Files to Modify

```
apps/
  ops-api/src/routes/products.ts      # Add flatCommission to PATCH schema
  ops-dashboard/app/(dashboard)/payroll/
    PayrollProducts.tsx                # Extend with ACA_PL support
```

### Pattern 1: Type-Conditional Card Layout (existing pattern)
**What:** The ProductCard component already renders different field sets based on `product.type`. CORE shows premium threshold and commission above/below. ADDON/AD_D shows bundled/standalone commission.
**When to use:** ACA_PL needs its own conditional branch showing only flatCommission.
**Example:**
```typescript
// Existing pattern in PayrollProducts.tsx (lines 152-164)
{product.type === "CORE" && (
  // ...core-specific display fields
)}
{(product.type === "ADDON" || product.type === "AD_D") && (
  // ...addon-specific display fields
)}
// NEW: Add ACA_PL branch
{product.type === "ACA_PL" && (
  // flat commission display only
)}
```

### Pattern 2: Type Group Rendering (existing pattern)
**What:** Products are grouped by type and rendered in sections with a colored heading bar.
**When to use:** ACA_PL needs its own group section.
**Example:**
```typescript
// Existing pattern at line 601
{(["CORE", "ADDON", "AD_D"] as ProductType[]).map(type => {
  // ... renders group header and cards
})}
// Extend ProductType to include "ACA_PL" and add to the array
```

### Pattern 3: String-ified Numeric State (existing pattern)
**What:** Edit form state stores numeric fields as strings for controlled inputs, converting to numbers on save.
**When to use:** The flatCommission edit field.
**Example:**
```typescript
// Existing pattern (line 53-63)
const [d, setD] = useState({
  // ...
  flatCommission: String(product.flatCommission ?? ""),
});
// On save (line 88-98):
flatCommission: d.flatCommission ? Number(d.flatCommission) : null,
```

### Anti-Patterns to Avoid
- **Adding ACA_PL to the "Add Product" type dropdown:** D-03 explicitly forbids this. ACA PL products are created via the sales flow only.
- **Sending percentage commission fields for ACA PL products:** The save handler must only send `flatCommission` (and `name`, `notes`, `active`) for ACA_PL type -- not premiumThreshold, commissionBelow, etc.
- **Adding ACA_PL to the POST schema:** Only PATCH needs flatCommission. The POST route deliberately excludes ACA_PL from the type enum.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Product type colors | New color system | Extend existing `TYPE_COLORS` record | Consistency with CORE/ADDON/AD_D pattern |
| Product type labels | Custom label logic | Extend existing `TYPE_LABELS` record | Same pattern, one-line addition |
| Form validation | Client-side validation lib | Existing Zod schema on API side | Server-authoritative validation per CLAUDE.md |

## Common Pitfalls

### Pitfall 1: TypeScript Type Narrowing
**What goes wrong:** The `ProductType` type is currently `"CORE" | "ADDON" | "AD_D"`. Adding `"ACA_PL"` requires updating every `Record<ProductType, ...>` and conditional branch.
**Why it happens:** TypeScript will error on incomplete records if the type is extended.
**How to avoid:** Update the `ProductType` type alias, `TYPE_LABELS`, and `TYPE_COLORS` records simultaneously. The compiler will flag any missed spots.
**Warning signs:** TypeScript errors about missing property `ACA_PL` in type.

### Pitfall 2: Product Type in Edit Form
**What goes wrong:** The edit form currently has a type dropdown that lets users change product type between CORE/ADDON/AD_D. An ACA_PL product should NOT be changeable to another type (or vice versa).
**Why it happens:** The type selector is rendered for all products in edit mode.
**How to avoid:** For ACA_PL products, either hide the type selector or make it read-only/disabled.

### Pitfall 3: Decimal Precision for flatCommission
**What goes wrong:** The Prisma schema defines `flatCommission` as `Decimal(12,2)`. The API receives a JavaScript number and Prisma converts it. But Prisma returns Decimal objects that serialize as strings in JSON.
**Why it happens:** Prisma Decimal fields return `Prisma.Decimal` objects.
**How to avoid:** When reading from the API response, the value comes as a string or number depending on serialization. Use `Number()` to normalize on the frontend, same pattern used for other decimal fields.

### Pitfall 4: Zod .min(0) on flatCommission
**What goes wrong:** Flat commission should always be non-negative (dollar amount per member).
**Why it happens:** Easy to forget validation bounds when adding new fields.
**How to avoid:** Add `.min(0)` to the Zod schema for flatCommission in the PATCH route, matching the pattern of other financial amounts.

## Code Examples

### API: Add flatCommission to PATCH schema
```typescript
// In apps/ops-api/src/routes/products.ts, PATCH route schema (line 58-71)
// Add alongside existing fields:
flatCommission: z.number().min(0).nullable().optional(),
```

### UI: Product type extension
```typescript
// Extend the type alias
type ProductType = "CORE" | "ADDON" | "AD_D" | "ACA_PL";

// Extend label and color records
const TYPE_LABELS: Record<ProductType, string> = {
  CORE: "Core", ADDON: "Add-on", AD_D: "AD&D", ACA_PL: "ACA PL",
};

const TYPE_COLORS: Record<ProductType, string> = {
  CORE: C.primary400, ADDON: C.accentTeal, AD_D: C.warning, ACA_PL: C.info,
};
```

### UI: Product type in Product interface
```typescript
type Product = {
  id: string; name: string; active: boolean; type: ProductType;
  // ... existing fields ...
  flatCommission?: number | null;  // ADD THIS
};
```

### UI: ACA_PL display in view mode
```typescript
{product.type === "ACA_PL" && (
  <>
    {product.flatCommission != null && (
      <span>
        Flat Commission: <strong style={{ color: C.textSecondary }}>
          ${Number(product.flatCommission).toFixed(2)}
        </strong> per member
      </span>
    )}
  </>
)}
```

### UI: ACA_PL edit form (simplified)
```typescript
{d.type === "ACA_PL" && (
  <div>
    <label style={LBL}>Flat Commission ($ per member)</label>
    <input
      className="input-focus"
      style={inputStyle}
      type="number"
      step="0.01"
      min="0"
      value={d.flatCommission}
      placeholder="e.g. 25.00"
      onChange={e => setD(x => ({ ...x, flatCommission: e.target.value }))}
    />
  </div>
)}
```

### UI: Group rendering with ACA_PL
```typescript
// Extend the type iteration to include ACA_PL
{(["CORE", "ADDON", "AD_D", "ACA_PL"] as ProductType[]).map(type => {
  // existing group rendering logic handles the rest
})}
```

### UI: Save handler for ACA_PL
```typescript
// In handleSave, add ACA_PL-specific save data:
const saveData: Record<string, unknown> = {
  name: d.name, active: d.active, notes: d.notes || undefined,
};
if (d.type === "ACA_PL") {
  saveData.flatCommission = d.flatCommission ? Number(d.flatCommission) : null;
} else {
  // existing logic for CORE/ADDON/AD_D fields
  saveData.type = d.type as ProductType;
  // ...
}
```

## State of the Art

No technology changes relevant to this phase. All patterns are stable and already in use.

## Open Questions

1. **Should the ACA PL card show member count context?**
   - What we know: The `flatCommission` is a dollar amount per member. The Products tab is for configuration, not reporting.
   - What's unclear: Whether showing "currently X members across Y sales" would be useful context.
   - Recommendation: Show only the configurable flat commission amount. Member count is contextual to individual sales, not product configuration. This is a Claude's Discretion item -- recommend keeping it simple (just the dollar amount).

2. **ACA PL group placement in the list**
   - What we know: Current order is CORE, ADDON, AD_D. ACA PL is a distinct product category.
   - Recommendation: Place ACA PL group last (after AD&D) since it's the newest and least frequently edited product type. This keeps the familiar layout stable for daily users.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (Morgan service only -- no API/UI test infrastructure) |
| Config file | `apps/morgan/jest.config.js` (Morgan only), `apps/ops-api/jest.config.ts` (exists but not wired to root) |
| Quick run command | `npm test` (Morgan only) |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ACA-01 | PATCH /products/:id accepts flatCommission field | manual-only | N/A -- no API integration test harness wired up | N/A |
| ACA-01 | ACA PL products appear in Products tab grouped separately | manual-only | N/A -- no UI test harness | N/A |
| ACA-01 | User can edit flat commission and save | manual-only | N/A -- no E2E test harness | N/A |

**Justification for manual-only:** The ops-api has a Jest config file but no test scripts wired to root `npm test`. The ops-dashboard has no test infrastructure at all. Setting up test infrastructure is out of scope for this phase. Manual verification via browser is the established pattern for this project.

### Sampling Rate
- **Per task commit:** Manual browser verification (edit an ACA PL product, save, confirm persistence)
- **Per wave merge:** Full manual walkthrough of Products tab
- **Phase gate:** Verify ACA PL products visible, editable, and saveable

### Wave 0 Gaps
None -- manual testing only. No test infrastructure to set up for this phase.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `apps/ops-api/src/routes/products.ts` -- full route file read
- Direct code inspection of `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` -- full component read
- Prisma schema inspection -- confirmed `ACA_PL` enum and `flatCommission` field exist
- CONTEXT.md decisions -- locked implementation approach

### Secondary (MEDIUM confidence)
- STATE.md accumulated decisions -- ACA badge info-blue color convention
- Phase 36 documentation -- ACA PL implementation history and patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all libraries already in use
- Architecture: HIGH - direct code inspection, extending proven patterns
- Pitfalls: HIGH - identified from actual code structure and TypeScript constraints

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable internal codebase, no external dependencies)
