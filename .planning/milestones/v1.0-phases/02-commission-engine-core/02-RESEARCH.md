# Phase 2: Commission Engine Core - Research

**Researched:** 2026-03-14
**Domain:** Commission calculation logic (TypeScript / Prisma / Express)
**Confidence:** HIGH

## Summary

Phase 2 rewrites the commission engine in `apps/ops-api/src/services/payroll.ts` to correctly implement bundle-based commission rules. The existing code already has the right structure -- `calculateCommission()` as a pure synchronous function called by `upsertPayrollEntryForSale()` -- but the calculation logic has several bugs and uses string matching for Compass VAB detection.

The changes are entirely backend: add `isBundleQualifier` to the Product model, rewrite `calculateCommission()` and `calcProductCommission()`, remove FL exemption, remove hardcoded fallback rates, and ensure 2-decimal rounding. No new libraries are needed. The existing Prisma schema already has all required fields (`bundledCommission`, `standaloneCommission`, `commissionAbove`, `commissionBelow`, `premiumThreshold`) except `isBundleQualifier`.

**Primary recommendation:** Rewrite the `calculateCommission()` function as a new implementation rather than patching the existing one. The bundle aggregation logic (combine core + non-qualifier addon premiums, single threshold check) is fundamentally different from the current per-product approach.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add `isBundleQualifier` Boolean field to Product model (default false)
- Only Compass VAB will have this flag set to true -- single product qualifier
- Auto-flag existing Compass VAB product(s) via data migration (match by name, set flag)
- Commission engine replaces string matching with `product.isBundleQualifier` check
- Remove FL (Florida) memberState exemption from the Compass VAB rule entirely
- Existing `commissionApproved` field on Sale serves as the manual override to waive half-commission
- When a sale has a core product, sum all premiums (core + non-qualifier add-ons) into a combined total
- Compass VAB premium is excluded from the combined total (it's a qualifier, not a contributor)
- Compare combined premium total against core product's `premiumThreshold`
- Apply core product's `commissionAbove` or `commissionBelow` rate to the combined total
- One calculation per bundle, not per-product
- One PayrollEntry per sale (not per product)
- If a sale has a core product but NO bundle qualifier (isBundleQualifier product), entire sale commission is halved
- "Entire sale" means core+addon bundle commission AND AD&D commission -- everything
- Exception: if `sale.commissionApproved` is true, skip the halving (manual override)
- FL exemption removed -- all states follow the same rule
- AD&D calculated separately from the core+addon bundle -- its own rate x its own premium
- When bundled with core: use `product.bundledCommission` x AD&D premium
- When standalone (no core in sale): use `product.standaloneCommission` x AD&D premium
- Database fields only -- no hardcoded fallback defaults (70%/35% removed)
- If bundledCommission or standaloneCommission is null, commission is $0 (forces correct product configuration)
- Compass VAB halving applies to AD&D portion too (consistent with "entire sale" decision)
- When an add-on is sold without a core product: `product.standaloneCommission` x addon premium
- No threshold logic for standalone add-ons (threshold only applies to core-bundled sales)
- Round final total to 2 decimal places

### Claude's Discretion
- Rounding strategy (per-step vs final-only)
- Test structure and organization
- Migration file naming and structure
- Error handling for edge cases (null premiums, missing products)

### Deferred Ideas (OUT OF SCOPE)
- Payroll dashboard "Approve" button to waive half-commission qualifiers and grant full commission -- belongs in a future phase
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| COMM-01 | Core products earn full commission rate when bundled with Compass VAB product | Bundle detection via `isBundleQualifier` flag; combined premium threshold check |
| COMM-02 | Core products earn half commission rate when not bundled with Compass VAB | Halving rule applies to entire sale commission when no `isBundleQualifier` product present |
| COMM-03 | Compass VAB bundle detection uses product flag (not string matching on name) | New `isBundleQualifier` Boolean on Product model + data migration |
| COMM-04 | Add-on products match core product commission rate when bundled with core | Addon premiums summed into combined total, core rate applied to combined total |
| COMM-05 | Add-on products follow threshold rules when standalone (below threshold = half) | Standalone addon uses `product.standaloneCommission` x addon premium (no threshold) |
| COMM-06 | AD&D products earn half commission from set rate when standalone | `product.standaloneCommission` x AD&D premium; null = $0 |
| COMM-07 | AD&D products earn full commission when bundled with core product | `product.bundledCommission` x AD&D premium; null = $0 |
| COMM-11 | Commission calculations use consistent rounding (2 decimal places) | Final rounding to 2 decimal places on total commission |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | (existing) | ORM, migration, schema | Already in project, handles Decimal fields correctly |
| TypeScript | (existing) | Type safety for commission logic | Already configured in monorepo |
| Jest | (existing) | Test runner | Already configured at repo root, extend for commission tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @prisma/client | (existing) | Database queries | Fetching sale + addons + products |

### No New Dependencies
This phase requires zero new npm packages. Everything needed exists in the current stack.

## Architecture Patterns

### Current File Structure (no changes to structure)
```
apps/ops-api/src/
  services/
    payroll.ts          # Commission engine lives here -- REWRITE internals
prisma/
  schema.prisma         # Add isBundleQualifier to Product
  migrations/
    YYYYMMDD_add_bundle_qualifier/  # New migration
```

### Test Location (new)
```
apps/ops-api/src/services/
  __tests__/
    commission.test.ts   # Pure function tests -- no DB needed
```

### Pattern 1: Pure Function Commission Calculation
**What:** `calculateCommission()` remains a pure synchronous function that takes a sale object with products and returns a number. No database calls inside.
**When to use:** Always -- this is the existing pattern and it enables easy unit testing.
**Example:**
```typescript
// The function signature stays the same
export const calculateCommission = (sale: SaleWithProduct): number => {
  // 1. Classify products in sale
  // 2. Calculate core+addon bundle commission (if core exists)
  // 3. Calculate AD&D commission separately
  // 4. Calculate standalone addon commission (if no core)
  // 5. Apply Compass VAB halving rule
  // 6. Round to 2 decimal places
  // 7. Return total
};
```

### Pattern 2: Bundle Aggregation (NEW -- replaces per-product calc)
**What:** When a core product exists, sum core premium + non-qualifier addon premiums into one total, apply single threshold check against core product's threshold, apply single rate.
**Example:**
```typescript
// Identify products by role
const coreProduct = allProducts.find(p => p.type === "CORE") ?? null;
const bundleQualifier = allProducts.find(p => p.isBundleQualifier) ?? null;
const addDs = allProducts.filter(p => p.type === "AD_D");
const regularAddons = allProducts.filter(p =>
  p.type === "ADDON" && !p.isBundleQualifier
);

if (coreProduct) {
  // Combined premium = core premium + regular addon premiums (exclude qualifier)
  const combinedPremium = corePremium + sumOfRegularAddonPremiums;
  const rate = combinedPremium >= threshold ? commissionAbove : commissionBelow;
  let bundleCommission = combinedPremium * (rate / 100);

  // AD&D separate calc
  let addDCommission = addDPremium * (bundledCommission / 100);

  // Halving if no qualifier
  if (!bundleQualifier && !sale.commissionApproved) {
    bundleCommission /= 2;
    addDCommission /= 2;
  }

  return round2(bundleCommission + addDCommission);
}
```

### Pattern 3: Premium Sourcing
**What:** Each product's premium comes from its own source -- the core product premium from `sale.premium`, addon premiums from `saleAddon.premium`.
**Critical bug in current code:** The current `calculateCommission` passes `premium` (sale.premium) for ALL addon calculations. This means addons currently use the core product's premium, not their own. The `SaleAddon.premium` field was just added (migration `20260314_add_sale_addon_premium`) but is not yet used in calculation code.
**Fix:**
```typescript
// Core premium from sale.premium
const corePremium = coreProduct ? Number(sale.premium) : 0;

// Addon premiums from their SaleAddon records
for (const addon of addons) {
  const addonPremium = Number(addon.premium ?? 0);
  // Use addonPremium for this addon's contribution
}
```

### Anti-Patterns to Avoid
- **String matching for product identification:** Current code does `n.includes("compass") && n.includes("vab")`. Use the `isBundleQualifier` flag instead.
- **Hardcoded fallback rates:** Current code has `?? 70` and `?? 35` for AD&D rates. Use database values only; null means $0.
- **Per-product commission calculation for bundled sales:** The new logic aggregates premiums first, then applies one rate. Do NOT calculate core and addon commissions separately then sum them.
- **Floating-point arithmetic without rounding:** Always round the final result to 2 decimal places.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Decimal rounding | Custom rounding logic | `Math.round(value * 100) / 100` | Standard JS rounding pattern for 2 decimal places; sufficient for commission amounts |
| Schema migration | Manual SQL for isBundleQualifier | `prisma migrate dev` | Maintains migration history, generates types |
| Data migration (Compass VAB flag) | Separate script | SQL in migration file or seed update | Single source of truth for data state |

**Key insight:** This phase is a logic rewrite, not an infrastructure change. The plumbing (Prisma, payroll entry upsert, sale creation flow) stays identical. Only the calculation inside `calculateCommission()` changes.

## Common Pitfalls

### Pitfall 1: Addon Premium Sourcing Bug
**What goes wrong:** Using `sale.premium` for addon calculations instead of `addon.premium` from SaleAddon.
**Why it happens:** The current code does this -- passes `premium` (sale.premium) to `calcProductCommission()` for every addon. Easy to carry forward.
**How to avoid:** Each addon's premium must come from its own `SaleAddon.premium` field. The core product's premium comes from `sale.premium`.
**Warning signs:** All addons producing the same commission amount regardless of their actual premium.

### Pitfall 2: Compass VAB Premium Leaking Into Bundle Total
**What goes wrong:** Including the Compass VAB product's premium in the combined total, inflating the commission.
**Why it happens:** Easy to sum ALL addon premiums without filtering out the qualifier.
**How to avoid:** Explicitly filter: `addons.filter(a => !a.product.isBundleQualifier)` when summing premiums.
**Warning signs:** Commission amounts higher than expected when Compass VAB is present.

### Pitfall 3: Halving Applied Before AD&D Calculation
**What goes wrong:** Halving only the bundle commission but not the AD&D portion.
**Why it happens:** The decision says "entire sale" but it's easy to apply halving only to the core+addon subtotal.
**How to avoid:** Calculate bundle commission AND AD&D commission first, then apply halving to the sum (or to each component).
**Warning signs:** AD&D portion is always full rate even when Compass VAB is missing.

### Pitfall 4: Null Commission Rates Treated as Zero vs Error
**What goes wrong:** Silently producing $0 commission when product configuration is missing.
**Why it happens:** The decision says null = $0, which is correct behavior, but makes misconfigured products invisible.
**How to avoid:** Log a warning when null rates are encountered (helps ops team detect misconfigured products), but still return $0 per the decision.
**Warning signs:** Agents reporting $0 commissions on sales that should have earned money.

### Pitfall 5: Enrollment Fee Logic Interference
**What goes wrong:** Modifying `applyEnrollmentFee()` during this phase and breaking Phase 3 scope.
**Why it happens:** It's tempting to "fix" enrollment fee logic while rewriting commission calc.
**How to avoid:** Leave `applyEnrollmentFee()` exactly as-is. Phase 3 owns COMM-08 and COMM-09.
**Warning signs:** Changes to enrollment fee thresholds or bonus amounts in the diff.

### Pitfall 6: Breaking the upsertPayrollEntryForSale Flow
**What goes wrong:** Changing the signature or return type of `calculateCommission()`, breaking the upsert.
**Why it happens:** Desire to return more structured data (breakdown by product, etc).
**How to avoid:** Keep `calculateCommission()` returning a single `number`. If breakdown is needed later, add a separate function.
**Warning signs:** TypeScript errors in `upsertPayrollEntryForSale`.

## Code Examples

### Complete Commission Calculation Flow (Recommended Implementation)
```typescript
type SaleWithProduct = Sale & {
  product: Product;
  addons: (SaleAddon & { product: Product })[]
};

export const calculateCommission = (sale: SaleWithProduct): number => {
  const allProducts = [
    { product: sale.product, premium: Number(sale.premium) },
    ...sale.addons.map(a => ({ product: a.product, premium: Number(a.premium ?? 0) }))
  ];

  const coreEntry = allProducts.find(e => e.product.type === "CORE");
  const qualifierExists = allProducts.some(e => e.product.isBundleQualifier);
  const hasCoreInSale = !!coreEntry;

  let totalCommission = 0;

  if (hasCoreInSale) {
    // --- CORE + ADDON BUNDLE ---
    // Sum premiums: core + non-qualifier addons
    const bundlePremium = allProducts
      .filter(e => (e.product.type === "CORE" || e.product.type === "ADDON") && !e.product.isBundleQualifier)
      .reduce((sum, e) => sum + e.premium, 0);

    const threshold = Number(coreEntry.product.premiumThreshold ?? 0);
    const rate = bundlePremium >= threshold
      ? Number(coreEntry.product.commissionAbove ?? 0)
      : Number(coreEntry.product.commissionBelow ?? 0);
    totalCommission += bundlePremium * (rate / 100);

    // --- AD&D (separate, bundled rate) ---
    for (const entry of allProducts.filter(e => e.product.type === "AD_D")) {
      const addDRate = Number(entry.product.bundledCommission ?? 0);
      totalCommission += entry.premium * (addDRate / 100);
    }

    // --- COMPASS VAB HALVING ---
    if (!qualifierExists && !sale.commissionApproved) {
      totalCommission /= 2;
    }
  } else {
    // --- STANDALONE (no core) ---
    for (const entry of allProducts) {
      if (entry.product.type === "AD_D") {
        const rate = Number(entry.product.standaloneCommission ?? 0);
        totalCommission += entry.premium * (rate / 100);
      } else if (entry.product.type === "ADDON") {
        const rate = Number(entry.product.standaloneCommission ?? 0);
        totalCommission += entry.premium * (rate / 100);
      }
    }
  }

  // Apply enrollment fee rules (Phase 3 scope -- leave as-is)
  const { finalCommission, enrollmentBonus } = applyEnrollmentFee(
    totalCommission,
    sale.enrollmentFee !== null ? Number(sale.enrollmentFee) : null,
    sale.commissionApproved,
    hasCoreInSale,
    sale.product,
  );

  return Math.round((finalCommission + enrollmentBonus) * 100) / 100;
};
```

### Prisma Schema Addition
```prisma
model Product {
  // ... existing fields ...
  isBundleQualifier  Boolean  @default(false) @map("is_bundle_qualifier")
  // ... rest of fields ...
}
```

### Data Migration SQL
```sql
-- Add isBundleQualifier column
ALTER TABLE "products" ADD COLUMN "is_bundle_qualifier" BOOLEAN NOT NULL DEFAULT false;

-- Flag existing Compass VAB product(s)
UPDATE "products" SET "is_bundle_qualifier" = true
WHERE LOWER("name") LIKE '%compass%' AND LOWER("name") LIKE '%vab%';
```

### Test Example (Pure Function, No DB)
```typescript
import { calculateCommission } from '../payroll';

// Helper to build test sale objects
const makeSale = (overrides: Partial<SaleWithProduct> = {}): SaleWithProduct => ({
  id: 'test-sale',
  premium: new Decimal(100),
  commissionApproved: false,
  enrollmentFee: null,
  memberState: null,
  product: makeProduct({ type: 'CORE', commissionAbove: 50, commissionBelow: 25, premiumThreshold: 50 }),
  addons: [],
  ...overrides,
} as SaleWithProduct);

describe('calculateCommission', () => {
  it('core with Compass VAB earns full rate', () => {
    const sale = makeSale({
      addons: [makeAddon({ isBundleQualifier: true, premium: 10 })],
    });
    expect(calculateCommission(sale)).toBe(50); // 100 * 50%
  });

  it('core without Compass VAB earns half rate', () => {
    const sale = makeSale();
    expect(calculateCommission(sale)).toBe(25); // (100 * 50%) / 2
  });
});
```

## State of the Art

| Old Approach (Current Code) | New Approach (Phase 2) | Impact |
|------------------------------|------------------------|--------|
| String matching for Compass VAB | `isBundleQualifier` product flag | Robust, name-change-proof detection |
| Per-product commission calc | Bundle aggregation (combined premium) | Correct commission for multi-product sales |
| Hardcoded AD&D rates (70%/35%) | Database-only rates, null = $0 | Configurable, forces correct product setup |
| FL exemption for halving rule | No exemptions -- all states same | Simpler logic, consistent behavior |
| No rounding | `Math.round(val * 100) / 100` | Prevents floating-point drift in payroll |
| `sale.premium` used for all products | `addon.premium` from SaleAddon | Correct per-product premium attribution |

## Rounding Strategy Recommendation (Claude's Discretion)

**Recommendation: Round only the final total, not intermediate steps.**

Rationale:
- Intermediate rounding can cause penny discrepancies when multiple products are involved (rounding errors accumulate)
- Final-only rounding matches how financial systems typically work
- The commission amounts involved (tens to hundreds of dollars) don't have precision issues with JavaScript's IEEE 754 doubles until amounts exceed ~$9 trillion
- Single `Math.round(total * 100) / 100` at the end of `calculateCommission()` is sufficient

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing, configured at repo root) |
| Config file | `jest.config.js` at repo root |
| Quick run command | `npx jest --testPathPattern commission` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMM-01 | Core + VAB = full rate | unit | `npx jest commission.test --testNamePattern "full rate"` | Wave 0 |
| COMM-02 | Core without VAB = half rate | unit | `npx jest commission.test --testNamePattern "half rate"` | Wave 0 |
| COMM-03 | Flag-based detection, not string | unit | `npx jest commission.test --testNamePattern "isBundleQualifier"` | Wave 0 |
| COMM-04 | Addon matches core rate when bundled | unit | `npx jest commission.test --testNamePattern "addon bundled"` | Wave 0 |
| COMM-05 | Standalone addon uses standalone rate | unit | `npx jest commission.test --testNamePattern "standalone addon"` | Wave 0 |
| COMM-06 | AD&D standalone = standaloneCommission | unit | `npx jest commission.test --testNamePattern "AD.D standalone"` | Wave 0 |
| COMM-07 | AD&D bundled = bundledCommission | unit | `npx jest commission.test --testNamePattern "AD.D bundled"` | Wave 0 |
| COMM-11 | Result rounded to 2 decimal places | unit | `npx jest commission.test --testNamePattern "rounding"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx jest --testPathPattern commission`
- **Per wave merge:** `npm test`
- **Phase gate:** All commission tests pass + full suite green

### Wave 0 Gaps
- [ ] `apps/ops-api/src/services/__tests__/commission.test.ts` -- covers COMM-01 through COMM-07, COMM-11
- [ ] Jest config may need `transform` for TypeScript (`.ts` files) -- current config only matches `.test.js`. Need `ts-jest` or adjust config.
- [ ] Test helpers for building mock Sale/Product/SaleAddon objects with correct types

### Test Infrastructure Note
The existing Jest config is JavaScript-only (matches `*.test.js`). The commission engine is TypeScript. Options:
1. **Use `ts-jest`** -- add `ts-jest` as devDependency, configure `transform` in jest.config.js
2. **Write tests in JS with JSDoc types** -- avoids config change but loses type safety
3. **Create separate jest config for ops-api** -- `apps/ops-api/jest.config.ts`

**Recommendation:** Option 3 -- create `apps/ops-api/jest.config.ts` with `ts-jest` transform. This keeps the root config for Morgan voice tests and adds proper TypeScript test support for the ops platform. Add a script to root `package.json`: `"test:ops": "jest --config apps/ops-api/jest.config.ts"`.

## Open Questions

1. **SaleAddon premium population**
   - What we know: The `premium` field exists on SaleAddon (added in migration `20260314`), it's optional (`Decimal?`)
   - What's unclear: Whether existing SaleAddon records have premium values populated or are all null
   - Recommendation: The commission engine should treat null addon premium as 0 (already decided). Existing data will calculate correctly for future sales; historical recalculation is out of scope.

2. **commissionApproved scope**
   - What we know: The field exists on Sale, currently used in enrollment fee logic
   - What's unclear: Whether setting `commissionApproved = true` should also bypass enrollment fee halving (current behavior) or only bypass Compass VAB halving (new behavior)
   - Recommendation: Keep existing enrollment fee behavior unchanged (Phase 3 scope). Add Compass VAB halving bypass. The field does double duty -- both are "approve full commission" overrides.

## Sources

### Primary (HIGH confidence)
- `apps/ops-api/src/services/payroll.ts` -- current commission engine source code (read directly)
- `prisma/schema.prisma` -- current data model (read directly)
- `.planning/phases/02-commission-engine-core/02-CONTEXT.md` -- locked user decisions

### Secondary (MEDIUM confidence)
- `prisma/migrations/` -- migration history confirming field additions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing infrastructure
- Architecture: HIGH -- rewriting pure function with clear inputs/outputs, well-understood pattern
- Pitfalls: HIGH -- identified from direct code reading, concrete bugs found (addon premium sourcing)
- Validation: MEDIUM -- Jest TS support needs setup, test patterns are straightforward

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable domain, no external dependencies)
