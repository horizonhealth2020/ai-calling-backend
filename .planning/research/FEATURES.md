# Feature Landscape

**Domain:** State-aware bundle commission requirements for insurance/health sales operations platform
**Researched:** 2026-03-23
**Context:** Adding state-aware bundle commission logic to existing Ops Platform (v1.4 milestone). Existing commission engine has `isBundleQualifier` flag, bundle aggregation, half-commission penalty, and `memberState` field on Sales.

## Table Stakes

Features users expect for state-aware bundle commission. Missing = commission accuracy breaks or config becomes unmanageable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Client state field on sales entry | Commission engine needs state to determine which addon qualifies. Already partially built -- `memberState` exists on Sale model as `VarChar(2)`, parser extracts from receipts, form has a free-text input. Needs to feed into commission logic. | Low | Field exists. Wire it into `calculateCommission`. |
| State availability per product | Not all insurance products can be sold in all states. Regulatory requirement -- selling unavailable products creates compliance risk. Agents need to know which addons apply for a given client state. | Medium | New DB model: `ProductStateAvailability` (productId, stateCode). Many-to-many relationship. |
| Primary bundle requirement per product | Core products need a "required addon for full commission" field. This is what the existing `isBundleQualifier` flag partially represents, but it is a boolean on each addon rather than a relationship from core product to required addon. Need to formalize: "For Compass Health, the required bundle addon is Compass VAB." | Medium | Add `requiredBundleProductId` on Product (self-referencing FK) or a separate `BundleRequirement` model. |
| Fallback bundle requirement for unavailable states | When primary addon is unavailable in the client's state, a fallback addon should qualify for full commission instead. Example: Compass VAB unavailable in FL, so Better addon qualifies instead. Without this, agents in those states always get half commission unfairly. | Medium | Add `fallbackBundleProductId` or extend the bundle requirement model with state-scoped overrides. |
| Commission engine uses client state for qualification | The core logic change: `calculateCommission` must check (1) does the sale include the required bundle addon? (2) if not, is there a fallback for this state? (3) does the sale include the fallback? Only then determine full vs. half commission. | Medium | Modify `calculateCommission` in `payroll.ts`. The function is currently pure (no DB calls) -- state availability lookup may need to be passed in or fetched beforehand. |
| Commission preview reflects state logic | The preview panel already shows "Compass VAB included" vs "No qualifier -- half rate applied". Must update to show state-aware messaging: "Better addon qualifies (FL fallback)" or "Required addon missing for TX -- half rate". | Low | Update preview endpoint and frontend display text. |
| Products tab: state availability config UI | Payroll admins need to configure which states each product is available in. Multi-select of US state codes per product. The existing `PayrollProducts.tsx` edit form needs a state availability section. | Medium | Add multi-select or chip-based state picker to product edit/create forms. |
| Products tab: bundle requirement config UI | Payroll admins need to set the primary required addon and fallback addon per core product, with visibility into which states trigger the fallback. | Medium | Add "Bundle Requirements" section to core product edit cards. Two dropdowns: primary addon, fallback addon. |
| Validation: prevent selling unavailable products | When a sale is submitted with addons unavailable in the client's state, the API should warn or reject. At minimum, commission preview should flag the issue. | Low | Server-side validation in POST /api/sales. Check addon availability against `memberState`. |

## Differentiators

Features that set the product apart. Not expected in a basic commission platform, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Auto-suggest qualifying addons by state | When agent enters client state on sales form, the addon checklist auto-highlights which addons qualify for full commission in that state (primary or fallback). Reduces errors. | Medium | Frontend-only: filter/sort addon list based on state availability data loaded at form init. |
| State availability bulk editor | Instead of editing one product at a time, show a matrix view: products (rows) x states (columns) with toggleable checkboxes. Faster for initial setup of 50-state availability. | High | Separate UI component. Nice but not needed for MVP. |
| Commission audit trail with state reasoning | Payroll entries show why full/half commission was applied: "Full: Better addon (FL fallback for Compass VAB)" vs just "Bundle qualifier present". Helps payroll staff verify accuracy. | Low | Store reasoning string on PayrollEntry or include in commission calculation metadata. |
| Effective-dated state availability | State availability changes over time (product launches/withdrawals). Track when a product became available or unavailable in a state, and use sale date to determine which rules applied. | High | Adds `effectiveDate`/`endDate` to availability records. Significant complexity. Defer. |
| Multi-fallback chain | Support multiple fallback products per state (e.g., if primary unavailable and first fallback also unavailable, try second fallback). | Medium | Overkill for current business rules. Single primary + single fallback covers the stated use case. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Client-side commission calculation | Commission must remain server-authoritative. Duplicating state-aware logic in the browser creates drift risk and potential for incorrect pay previews. | Keep `calculateCommission` server-side. Preview endpoint already exists -- extend it with state parameter. |
| Per-agent state licensing management | Tracking which agents are licensed in which states is a different concern from product availability. Mixing them creates unnecessary coupling. | Treat state availability as a product attribute, not an agent attribute. Agent licensing is out of scope. |
| Automatic state detection from address | Parsing state from member address adds unreliable complexity. The receipt parser already extracts state codes reasonably well. | Keep `memberState` as an explicit form field (already exists). Parser fills it; agent confirms. |
| State-specific commission rates | Different commission percentages per state would require a massive schema change and make the product config UI unwieldy. The current threshold-based rate system is sufficient. | Keep commission rates product-level. State only affects which addon qualifies for the bundle, not the rate itself. |
| Real-time regulatory compliance checking | Checking whether a product filing is currently approved with state DOI is well beyond the scope of an internal ops tool. | Trust that product state availability is manually maintained by admins who know the business. |

## Feature Dependencies

```
Client state field on sales entry (exists)
  -> Commission engine uses client state (requires state availability data)
     -> Commission preview reflects state logic (requires engine changes)

State availability per product (DB model)
  -> Products tab: state availability config UI (requires DB model)
  -> Validation: prevent selling unavailable products (requires DB model)
  -> Auto-suggest qualifying addons by state (requires DB model + frontend)

Primary bundle requirement per product (DB model)
  -> Fallback bundle requirement for unavailable states (extends primary)
     -> Commission engine uses client state (requires both primary + fallback + availability)
  -> Products tab: bundle requirement config UI (requires DB model)
```

**Critical path:** DB schema (state availability + bundle requirements) -> Commission engine -> Preview/UI

## MVP Recommendation

Prioritize in this order:

1. **DB schema: state availability + bundle requirements** -- Everything depends on this. Add `ProductStateAvailability` join table and `requiredBundleProductId`/`fallbackBundleProductId` fields on Product.

2. **Commission engine: state-aware qualification** -- Modify `calculateCommission` to accept state availability context. The function is currently pure (takes a `SaleWithProduct` object). Expand the input type to include availability data pre-fetched by the caller. Keeps the function testable and pure.

3. **Products tab: bundle requirement + state availability UI** -- Config must be manageable before going live. Core product cards need primary/fallback addon selectors. All products need state availability multi-select.

4. **Commission preview update** -- Update preview text to reflect state-aware qualification reasoning.

5. **Sales form: addon suggestion by state** -- Filter/highlight addons that qualify in the selected state. Low effort, high impact for agent accuracy.

**Defer:**
- State availability bulk editor: Nice for initial data entry but not blocking. Can set up via direct DB inserts or one-product-at-a-time UI.
- Effective-dated availability: Current business need is "which states is this product available in right now," not historical tracking.
- Multi-fallback chain: Single primary + single fallback covers the stated use case. No evidence of needing deeper chains.
- Commission audit trail with state reasoning: Helpful but not blocking. Can add later without schema changes.

## Existing Code Touchpoints

| Area | Current State | What Changes |
|------|--------------|--------------|
| `prisma/schema.prisma` | `Product` model has `isBundleQualifier` boolean. `Sale` has `memberState` varchar(2). | Add `ProductStateAvailability` model, add `requiredBundleProductId` and `fallbackBundleProductId` self-referencing FKs to `Product`. |
| `apps/ops-api/src/services/payroll.ts` | `calculateCommission` checks `qualifierExists` (boolean any-addon-has-flag). Does not consider state. | Accept state availability context as parameter. Check primary/fallback addon presence based on client state. |
| `apps/ops-dashboard/.../ManagerEntry.tsx` | `memberState` form field exists (free text, uppercase, 2 char). Addon checklist shows all active addons. | Optionally highlight/filter addons by state availability. Pass `memberState` to preview endpoint. |
| `apps/ops-dashboard/.../PayrollProducts.tsx` | Product cards with edit forms. No state availability or bundle requirement fields. | Add state availability multi-select and bundle requirement dropdowns to product edit/create forms. |
| `apps/ops-api/src/routes/index.ts` | Product CRUD routes. Sales preview endpoint. | Extend product routes to accept state availability. Extend preview to accept `memberState`. |
| Commission tests (`commission.test.ts`) | Tests for bundle qualifier halving, enrollment fee, standalone addon scenarios. | Add tests for state-aware qualification: primary present, fallback used, neither present, no state provided. |

## Schema Design Recommendation

**Recommended: Fields on Product + join table (simplest for stated requirements)**

```
Product {
  ...existing fields...
  requiredBundleProductId  String?  // FK to Product -- "which addon is required for full commission"
  fallbackBundleProductId  String?  // FK to Product -- "fallback addon when primary unavailable in state"
}

ProductStateAvailability {
  id         String   @id @default(cuid())
  productId  String   // FK to Product
  stateCode  String   @db.VarChar(2) // 2-letter US state code
  @@unique([productId, stateCode])
}
```

**Why this approach:** The milestone description says "primary bundle requirement (e.g., Compass VAB) with state availability" and "fallback bundle requirement for states where primary isn't available." This is a 1:1 relationship from core product to required addon and fallback addon. Self-referencing FKs on Product are clean and avoid over-engineering. A separate `BundleRequirement` model adds an extra table with no clear benefit unless requirements evolve to need multiple bundle requirement sets per core product.

## Commission Engine Logic Change

Current logic (line 162 in payroll.ts):
```typescript
if (!qualifierExists && !sale.commissionApproved) {
  totalCommission /= 2;
}
```

New logic (pseudocode):
```typescript
// Determine required addon based on state
const primaryAddonId = coreEntry?.product.requiredBundleProductId;
const fallbackAddonId = coreEntry?.product.fallbackBundleProductId;

let bundleSatisfied = false;

if (!primaryAddonId) {
  // No bundle requirement configured -- use legacy isBundleQualifier check
  bundleSatisfied = qualifierExists;
} else if (!sale.memberState) {
  // No state provided -- check if primary addon is present
  bundleSatisfied = allEntries.some(e => e.product.id === primaryAddonId);
} else {
  // State-aware check
  const primaryAvailable = stateAvailability[primaryAddonId]?.includes(sale.memberState) ?? true;
  if (primaryAvailable) {
    bundleSatisfied = allEntries.some(e => e.product.id === primaryAddonId);
  } else if (fallbackAddonId) {
    bundleSatisfied = allEntries.some(e => e.product.id === fallbackAddonId);
  }
}

if (!bundleSatisfied && !sale.commissionApproved) {
  totalCommission /= 2;
}
```

**Key design decision:** When `memberState` is null (legacy sales, or agent did not fill it in), fall back to the existing `isBundleQualifier` boolean logic. This ensures backward compatibility -- no existing sales break.

**Key design decision:** When no `requiredBundleProductId` is set on a core product, use the legacy `isBundleQualifier` check. This means the existing behavior is preserved until an admin explicitly configures bundle requirements for a product.

## Sources

- Codebase analysis: `prisma/schema.prisma`, `apps/ops-api/src/services/payroll.ts`, `apps/ops-dashboard/.../ManagerEntry.tsx`, `apps/ops-dashboard/.../PayrollProducts.tsx` -- HIGH confidence (direct code reading)
- Domain patterns: Insurance product state availability is a standard regulatory concern -- products must be filed and approved per state before sale. MEDIUM confidence (general insurance domain knowledge, verified against regulatory sources).
- [KFF: Regulation of Private Health Insurance](https://www.kff.org/patient-consumer-protections/health-policy-101-the-regulation-of-private-health-insurance/) -- State-by-state product approval requirements
- [AgencyBloc: Agency Management for Health & Life Insurance](https://www.agencybloc.com/) -- Commission tracking patterns in insurance platforms
- [EvolveNXT: Health Insurance Commission Software](https://evolvenxt.com/solutions-2020/health-insurance-carriers/) -- Commission management platform patterns
