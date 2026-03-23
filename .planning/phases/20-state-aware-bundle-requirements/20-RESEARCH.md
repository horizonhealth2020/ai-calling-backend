# Phase 20: State-Aware Bundle Requirements - Research

**Researched:** 2026-03-23
**Domain:** Commission engine enhancement with state-aware bundle qualification, config UI, and housekeeping
**Confidence:** HIGH

## Summary

This phase adds state-aware bundle commission logic to a working Ops Platform. The codebase already has all foundations: `memberState` on the Sale model (VarChar(2), nullable), `isBundleQualifier` halving at payroll.ts line 162, product CRUD in PayrollProducts.tsx with inline CSSProperties card pattern, and a preview endpoint at `/sales/preview`. The work is: (1) add two new fields to Product (`requiredBundleAddonId`, `fallbackBundleAddonId`) plus a `ProductStateAvailability` join table, (2) modify `calculateCommission` to accept bundle requirement context and apply state-aware halving with a `halvingReason` stored on PayrollEntry, (3) build config UI sections on existing product cards, (4) add a US state dropdown to sales entry, and (5) two housekeeping fixes.

No new dependencies are needed. The entire feature is implementable with Prisma, Zod, Express, React, and Socket.IO already in the stack. The critical constraint is backward compatibility: existing sales with `memberState: null` must produce identical commission results (all 20+ existing tests pass unchanged), and the state-aware halving path must replace -- not stack on -- the legacy `isBundleQualifier` check for products with a configured bundle requirement.

**Primary recommendation:** Implement in strict dependency order: schema migration first, then commission engine with tests, then API routes, then config UI, then sales entry integration. Each layer depends on the previous. Keep `calculateCommission` pure (no DB calls inside it) and pass resolved context from callers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** State availability uses a join table (`ProductStateAvailability`) with productId + stateCode rows
- **D-02:** Bundle requirement config lives as fields on the Product model for CORE products -- `requiredBundleAddonId` (FK to Product) and `fallbackBundleAddonId` (FK to Product). No separate BundleRequirement table.
- **D-03:** Per-state logic comes from the addon's state availability, not from the core product. The engine checks: is the core's required addon available in the client's state? If not, check the fallback addon's state availability.
- **D-04:** One fallback is sufficient for now; can chain additional fallback fields later.
- **D-05:** State-aware halving REPLACES the existing `isBundleQualifier` halving at payroll.ts:162 for products with `requiredBundleAddonId` configured. Legacy check only fires when no bundle requirement is configured.
- **D-06:** `commissionApproved = true` bypasses state-based halving (consistent with existing behavior).
- **D-07:** `memberState === null` falls through to legacy `isBundleQualifier` logic -- backward compatible.
- **D-08:** Three-tier fallback chain: (1) Check required addon availability in state -> (2) Check fallback addon availability -> (3) Legacy isBundleQualifier check.
- **D-09:** Halving reason stored as new field on PayrollEntry (`halvingReason`).
- **D-10:** Halving reason displays as inline text below commission amount.
- **D-11:** CORE product cards get collapsible "Bundle Requirements" section.
- **D-12:** ADDON product cards get "State Availability" section with searchable multi-select.
- **D-13:** Completeness indicator on CORE products shows states without bundle coverage.
- **D-14:** Client state dropdown added to sales entry form, populating existing `memberState` field.
- **D-15:** Role dashboard selector delay increased/configurable.
- **D-16:** Seed agents (Amy, Bob, Cara, David, Elena) removed from database seed script.

### Claude's Discretion
- US state list implementation (hardcoded constant vs fetched) -- recommend hardcoded in @ops/types or @ops/utils
- Socket.IO event names for config changes
- Exact text format of halving reason strings
- Completeness indicator visual design

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BUNDLE-01 | Admin can designate a primary required addon for full commission on a CORE product | Product model gets `requiredBundleAddonId` FK; PATCH /products/:id endpoint extended; CORE product card gets addon selector dropdown |
| BUNDLE-02 | Admin can set state availability for addon products | `ProductStateAvailability` join table; PUT /products/:id/state-availability bulk endpoint; ADDON card gets state multi-select |
| BUNDLE-03 | Admin can set fallback addon(s) for states where primary addon is unavailable | Product model gets `fallbackBundleAddonId` FK; same CORE product card bundle requirement section |
| BUNDLE-04 | Admin can configure multiple fallback tiers per state | D-04 locks single fallback for now; architecture supports chaining later |
| BUNDLE-05 | Commission engine resolves required addon by client state | `resolveBundleRequirement()` function queries ProductStateAvailability; three-tier fallback chain per D-08 |
| BUNDLE-06 | Half commission applied when required addon missing, with reason stored | Modified `calculateCommission` returns halvingReason; `upsertPayrollEntryForSale` stores it on PayrollEntry |
| BUNDLE-07 | Payroll entry displays halving reason when commission was reduced | PayrollPeriods.tsx reads `halvingReason` field and displays inline text below commission amount |
| BUNDLE-08 | Existing sales without memberState continue working via legacy fallback | D-07: null memberState skips state-aware path entirely; all 20+ existing tests pass unchanged |
| CFG-01 | CORE product cards show bundle requirement section | Collapsible section in ProductCard edit view with required addon and fallback addon selectors |
| CFG-02 | ADDON product cards show state availability multi-select | Searchable checkbox list of 51 entries (50 states + DC) in ProductCard edit view |
| CFG-03 | Completeness indicator shows states without bundle coverage | Badge/indicator on CORE product cards; compare configured states vs addon availability |
| SALE-01 | Sales entry form includes client state dropdown | Replace free-text input in ManagerEntry.tsx (line 495) with `<select>` using US_STATES constant |
| FIX-01 | Role dashboard selector has configurable delay before collapsing | DashboardInner in layout.tsx (line 73) uses `hovered` state with instant collapse; add setTimeout delay |
| FIX-02 | Seed agents removed from database seed | Seed script (prisma/seed.ts) has no agents -- already clean; verify no agent seeding exists elsewhere |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | ^5.20.0 | Schema migration for new fields and table | Already used for all DB operations; migration tooling in place |
| Zod | ^3.23.8 | Request validation for bundle config and state availability endpoints | `zodErr()` pattern established; Zod schemas on every route |
| Express | ^4.19.2 | CRUD routes for bundle requirements and state availability | `asyncHandler`, `requireRole` patterns in place |
| React | 18.x | Config UI sections in product cards, state dropdown | Inline CSSProperties with @ops/ui tokens |
| Next.js | 15.x | Dashboard pages hosting the config UI | `transpilePackages` for @ops/* imports |
| Socket.IO | ^4.8.3 | Real-time config change propagation | Already used for live updates across dashboards |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| luxon | (already installed) | Date handling in payroll period calculation | Only in existing getSundayWeekRange -- no new usage needed |
| bcryptjs | (already installed) | Password hashing in seed | Only in seed.ts -- no new usage |
| lucide-react | (already installed) | Icons for UI sections | For collapse/expand icons on bundle requirement sections |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hardcoded US_STATES constant | npm package (us-states, country-state-city) | Constant is 51 entries; a library is overkill for static data |
| Custom multi-select for states | react-select or similar | Adds a dependency; project uses inline styles exclusively; custom checkbox grid matches existing patterns |
| Separate BundleRequirement table | Fields on Product model | Decision D-02 locks Product fields approach -- simpler, fewer joins |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
prisma/
  schema.prisma                    # Add ProductStateAvailability model + Product FK fields
  migrations/YYYYMMDD_bundle_req/  # New migration
apps/ops-api/src/
  services/payroll.ts              # resolveBundleRequirement(), modified calculateCommission
  routes/index.ts                  # New bundle requirement + state availability routes
apps/ops-dashboard/app/(dashboard)/
  payroll/PayrollProducts.tsx      # Bundle Requirement section (CORE), State Availability section (ADDON)
  payroll/PayrollPeriods.tsx       # Display halvingReason on entries
  manager/ManagerEntry.tsx         # US state dropdown replacing free-text input
  layout.tsx                       # Configurable delay on role selector collapse
packages/types/ or packages/utils/
  us-states.ts                     # US_STATES constant (shared between API validation and UI)
```

### Pattern 1: Product Model Extension (D-02)
**What:** Add `requiredBundleAddonId` and `fallbackBundleAddonId` as optional FK fields on Product model, with self-referencing relations.
**When to use:** When configuring which addon is required for full commission on a CORE product.
**Example:**
```prisma
// In schema.prisma - Product model additions
model Product {
  // ... existing fields ...

  requiredBundleAddonId  String?  @map("required_bundle_addon_id")
  fallbackBundleAddonId  String?  @map("fallback_bundle_addon_id")

  requiredBundleAddon    Product? @relation("RequiredBundleAddon", fields: [requiredBundleAddonId], references: [id])
  fallbackBundleAddon    Product? @relation("FallbackBundleAddon", fields: [fallbackBundleAddonId], references: [id])

  // Reverse relations (required by Prisma)
  coreProductsRequiring  Product[] @relation("RequiredBundleAddon")
  coreProductsFallback   Product[] @relation("FallbackBundleAddon")

  stateAvailability      ProductStateAvailability[]
}
```

### Pattern 2: ProductStateAvailability Join Table (D-01)
**What:** Maps addon products to US states where they are available for sale.
**Example:**
```prisma
model ProductStateAvailability {
  id         String   @id @default(cuid())
  productId  String   @map("product_id")
  stateCode  String   @map("state_code") @db.VarChar(2)
  createdAt  DateTime @default(now()) @map("created_at")

  product    Product  @relation(fields: [productId], references: [id])

  @@unique([productId, stateCode])
  @@map("product_state_availability")
}
```

### Pattern 3: PayrollEntry halvingReason Field (D-09)
**What:** Stores the reason commission was halved at calculation time, surviving future config changes.
**Example:**
```prisma
model PayrollEntry {
  // ... existing fields ...
  halvingReason  String?  @map("halving_reason")
}
```

### Pattern 4: Commission Engine with Bundle Context
**What:** Keep `calculateCommission` pure. Add a `BundleRequirementContext` parameter. Callers resolve context via DB lookups before calling.
**When to use:** Every call to `calculateCommission` from `upsertPayrollEntryForSale` and the preview endpoint.
**Example:**
```typescript
// Types
type BundleRequirementContext = {
  requiredAddonAvailable: boolean;   // primary addon available in client's state
  fallbackAddonAvailable: boolean;   // fallback addon available in client's state
  halvingReason: string | null;      // reason text if halved, null if full
} | null; // null = no bundle requirement configured OR memberState is null

// Modified signature (backward compatible -- second param is optional)
export const calculateCommission = (
  sale: SaleWithProduct,
  bundleCtx?: BundleRequirementContext
): { commission: number; halvingReason: string | null } => {
  // ... existing logic ...

  // BUNDLE QUALIFIER HALVING (replaces line 162)
  if (bundleCtx !== undefined && bundleCtx !== null) {
    // State-aware path: check if required or fallback addon is present
    if (!bundleCtx.requiredAddonAvailable && !bundleCtx.fallbackAddonAvailable && !sale.commissionApproved) {
      totalCommission /= 2;
      // halvingReason comes from bundleCtx
    }
  } else {
    // Legacy path: original isBundleQualifier check
    if (!qualifierExists && !sale.commissionApproved) {
      totalCommission /= 2;
    }
  }
};
```

### Pattern 5: resolveBundleRequirement Service Function
**What:** Resolves bundle requirement context by querying Product and ProductStateAvailability.
**When to use:** Before calling calculateCommission, when memberState is non-null.
**Example:**
```typescript
export async function resolveBundleRequirement(
  coreProduct: Product & { requiredBundleAddon?: Product | null; fallbackBundleAddon?: Product | null },
  memberState: string | null,
  saleAddonProductIds: string[]
): Promise<BundleRequirementContext | null> {
  // No bundle requirement configured -- use legacy path
  if (!coreProduct.requiredBundleAddonId) return null;

  // memberState is null -- use legacy path (D-07)
  if (!memberState) return null;

  // Check if required addon is available in client's state
  const requiredAvail = await prisma.productStateAvailability.findUnique({
    where: { productId_stateCode: { productId: coreProduct.requiredBundleAddonId, stateCode: memberState } }
  });

  const requiredAddonInSale = saleAddonProductIds.includes(coreProduct.requiredBundleAddonId);

  if (requiredAvail && requiredAddonInSale) {
    return { requiredAddonAvailable: true, fallbackAddonAvailable: false, halvingReason: null };
  }

  // Check fallback
  if (coreProduct.fallbackBundleAddonId) {
    const fallbackAvail = await prisma.productStateAvailability.findUnique({
      where: { productId_stateCode: { productId: coreProduct.fallbackBundleAddonId, stateCode: memberState } }
    });
    const fallbackInSale = saleAddonProductIds.includes(coreProduct.fallbackBundleAddonId);

    if (fallbackAvail && fallbackInSale) {
      return { requiredAddonAvailable: false, fallbackAddonAvailable: true, halvingReason: null };
    }
  }

  // Neither available -- will halve
  const addonName = coreProduct.requiredBundleAddon?.name ?? "required addon";
  return {
    requiredAddonAvailable: false,
    fallbackAddonAvailable: false,
    halvingReason: `Half commission - ${addonName} not bundled (${memberState})`,
  };
}
```

### Pattern 6: State Availability Bulk PUT Endpoint
**What:** Replace all state availability entries for a product in a single request (idempotent).
**Example:**
```typescript
// PUT /api/products/:id/state-availability
// Body: { stateCodes: ["AL", "AK", "AZ", ...] }
router.put("/products/:id/state-availability", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    stateCodes: z.array(z.string().length(2).regex(/^[A-Z]{2}$/)).max(51),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  await prisma.$transaction([
    prisma.productStateAvailability.deleteMany({ where: { productId: req.params.id } }),
    prisma.productStateAvailability.createMany({
      data: parsed.data.stateCodes.map(sc => ({ productId: req.params.id, stateCode: sc })),
    }),
  ]);

  const result = await prisma.productStateAvailability.findMany({ where: { productId: req.params.id } });
  res.json(result);
}));
```

### Pattern 7: US States Constant
**What:** Hardcoded array of 50 states + DC, shared between API validation and UI dropdowns.
**Example:**
```typescript
// packages/types/src/us-states.ts or packages/utils/src/us-states.ts
export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  // ... all 50 states + DC
  { code: "DC", name: "District of Columbia" },
] as const;

export type StateCode = typeof US_STATES[number]["code"];
```

### Anti-Patterns to Avoid
- **Double halving:** Never have two independent `if` blocks that both halve `totalCommission`. The state-aware path replaces the legacy path, not adds to it.
- **DB calls inside calculateCommission:** Keep it pure. Resolve all context before calling it.
- **Hardcoding state logic in code:** All state-to-product mappings must live in the database, not in conditionals like `if (state === 'FL')`.
- **Modifying existing test expectations:** All 20+ existing commission tests must pass unchanged. If a test needs changing, that signals a regression.
- **Using `as any` for new mock objects:** The preview mock already uses `as any` (line 473); extend it properly instead of adding more type bypass.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| US state list | Manual array with typos | Hardcoded verified constant with TypeScript literal types | 51 entries, static, type-safe; no library needed |
| Bulk state update | Individual POST/DELETE per state | Single PUT with transaction (deleteMany + createMany) | 51 individual calls would be terrible UX and performance |
| Commission reason audit trail | Separate audit table | `halvingReason` field on PayrollEntry | Stored at calculation time, survives config changes, simple to query |
| Multi-select UI component | npm library (react-select) | Checkbox grid with search filter | Matches existing inline-style pattern; no external dependency |

**Key insight:** This phase is pure business logic + CRUD config. Every pattern already exists in the codebase. The complexity is in getting the financial logic right, not in novel engineering.

## Common Pitfalls

### Pitfall 1: Double Halving (P3 from research)
**What goes wrong:** Two independent halving blocks both fire, producing 25% commission instead of 50%.
**Why it happens:** New state-aware halving added as a separate `if` block alongside existing `isBundleQualifier` halving at line 162.
**How to avoid:** The state-aware path REPLACES the line 162 check when `requiredBundleAddonId` is configured (D-05). Implement as a single `if/else` block, not two sequential checks.
**Warning signs:** Any test where commission is less than 50% of base rate without explicit enrollment-fee halving.

### Pitfall 2: Legacy Sale Regression (P2 from research)
**What goes wrong:** Existing sales with `memberState: null` get incorrect commission on recalculation.
**Why it happens:** New logic treats null state as "no addon available" and halves commission.
**How to avoid:** `memberState === null` must explicitly return `null` from `resolveBundleRequirement()`, triggering legacy `qualifierExists` path (D-07). Gate everything on all 20+ existing tests passing unchanged.
**Warning signs:** Any existing test that needs modification is a regression signal.

### Pitfall 3: Preview Diverges from Engine (P1 from research)
**What goes wrong:** `/sales/preview` endpoint does not include `memberState` in its mock, showing different commission than actual calculation.
**Why it happens:** Preview mock at line 463-473 constructed without `memberState`. The Zod schema at line 441-451 does not accept it.
**How to avoid:** Add `memberState` to preview Zod schema and mock in the same change that modifies `calculateCommission`. Write a test verifying preview === engine for same inputs.
**Warning signs:** Any commit that changes `calculateCommission` without changing the preview endpoint.

### Pitfall 4: Empty Config on First Deploy (P4 from research)
**What goes wrong:** No `ProductStateAvailability` rows exist after migration; engine has no data to determine addon availability.
**Why it happens:** New tables are empty; no seed data for state availability.
**How to avoid:** Fallback chain ensures empty config falls through to legacy `isBundleQualifier` logic (unconfigured products degrade safely). Config UI must be built and populated before state-aware logic has business impact.
**Warning signs:** Log warning when `resolveBundleRequirement()` finds no config for a product that has `requiredBundleAddonId` set.

### Pitfall 5: Sale Edit Clawback with State Change (P5 from research)
**What goes wrong:** Editing `memberState` on an existing sale in a finalized period produces incorrect clawback amounts.
**Why it happens:** `handleSaleEditApproval()` computes old vs new payout delta. If `memberState` is written to DB before recalculation, it works. Wrong order = wrong delta.
**How to avoid:** Verify field-update-before-recalculate ordering handles `memberState`. Test the full flow: state A (full) -> state B (half), verify clawback = exact difference.
**Warning signs:** Audit log missing `memberState` in the changes record.

### Pitfall 6: calculateCommission Return Type Change
**What goes wrong:** Changing `calculateCommission` to return `{ commission: number; halvingReason: string | null }` instead of just `number` breaks all callers.
**Why it happens:** Function is called in multiple places: `upsertPayrollEntryForSale`, preview endpoint, and tests.
**How to avoid:** Either return an object and update all callers in the same change, or add a parallel function. Recommend returning an object and updating all three callers in one atomic change.
**Warning signs:** TypeScript errors at compile time will catch this if types are correct.

### Pitfall 7: Role Selector Instant Collapse (FIX-01)
**What goes wrong:** The role dashboard selector (layout.tsx line 73) collapses instantly when mouse leaves, making it hard to click tabs.
**Why it happens:** `expanded = hovered || !activeTab` -- collapse is immediate on `onMouseLeave`.
**How to avoid:** Add `setTimeout` with configurable delay (e.g., 300-500ms) before collapsing. Clear timeout on re-enter.
**Warning signs:** User reports of "tabs disappear before I can click them."

## Code Examples

### Existing Product CRUD Pattern (to follow for bundle config)
```typescript
// Source: apps/ops-api/src/routes/index.ts line 289-309
router.patch("/products/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    // ... existing fields ...
    requiredBundleAddonId: z.string().nullable().optional(),
    fallbackBundleAddonId: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const product = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(product);
}));
```

### Existing Product Card Edit Pattern (to follow for bundle UI)
```typescript
// Source: apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx line 37-218
// ProductCard component uses:
// - useState for edit mode toggle
// - inline CSSProperties (cardStyle, inputStyle, LBL)
// - conditional rendering by product.type (CORE vs ADDON/AD_D)
// - onSave callback to parent with PATCH request
// - d state object with string values for form fields
```

### Existing memberState Input (to replace with dropdown)
```typescript
// Source: apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx line 495
<input className="input-focus" style={baseInputStyle} value={form.memberState}
  maxLength={2} placeholder="e.g. FL"
  onChange={e => setForm(f => ({ ...f, memberState: e.target.value.toUpperCase() }))} />
// Replace with:
<select className="input-focus" style={{ ...baseInputStyle, height: 42 }}
  value={form.memberState}
  onChange={e => setForm(f => ({ ...f, memberState: e.target.value }))}>
  <option value="">Select state...</option>
  {US_STATES.map(s => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
</select>
```

### Existing Commission Halving (to modify)
```typescript
// Source: apps/ops-api/src/services/payroll.ts line 160-164
// CURRENT:
if (!qualifierExists && !sale.commissionApproved) {
  totalCommission /= 2;
}

// NEW (replaces above):
if (bundleCtx !== undefined && bundleCtx !== null) {
  // State-aware path: bundle requirement configured AND memberState is non-null
  if (!bundleCtx.requiredAddonAvailable && !bundleCtx.fallbackAddonAvailable && !sale.commissionApproved) {
    totalCommission /= 2;
    halvingReason = bundleCtx.halvingReason;
  }
} else {
  // Legacy path: no bundle requirement configured OR memberState is null
  if (!qualifierExists && !sale.commissionApproved) {
    totalCommission /= 2;
  }
}
```

### Role Selector Delay Fix
```typescript
// Source: apps/ops-dashboard/app/(dashboard)/layout.tsx line 61-73
// CURRENT:
const [hovered, setHovered] = useState(false);
const expanded = hovered || !activeTab;

// NEW:
const [hovered, setHovered] = useState(false);
const [delayedHovered, setDelayedHovered] = useState(false);
const collapseDelay = 400; // ms

useEffect(() => {
  if (hovered) {
    setDelayedHovered(true);
  } else {
    const timer = setTimeout(() => setDelayedHovered(false), collapseDelay);
    return () => clearTimeout(timer);
  }
}, [hovered]);

const expanded = delayedHovered || !activeTab;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FL state exemption in code | FL exemption removed; state-aware config in DB | v1.0 (removed), v1.4 (config-driven) | No hardcoded state logic; all state rules in database |
| `isBundleQualifier` boolean on Product | State-aware bundle requirement with per-addon state availability | v1.4 | Finer control over which addon qualifies per state |
| Free-text memberState input | US state dropdown with validation | v1.4 | Prevents invalid state codes; feeds commission logic |

**Deprecated/outdated:**
- `isBundleQualifier` field remains for backward compatibility but is superseded by `requiredBundleAddonId` for products that have bundle requirements configured

## Open Questions

1. **Seed agents to remove (FIX-02)**
   - What we know: The seed script (`prisma/seed.ts`) does NOT contain Amy, Bob, Cara, David, or Elena. It only seeds 4 users (Juan A, Nick D, Mike F, Payroll User).
   - What's unclear: These agents may have been removed in a previous phase, or may exist as Agent model records (not User records) seeded elsewhere. The seed script has no agent creation.
   - Recommendation: Check if there is another seed or migration that creates these agents. If they were already removed, FIX-02 is a no-op. Verify by searching for "Amy" / "Bob" / "Cara" in the codebase.

2. **calculateCommission return type change**
   - What we know: Currently returns `number`. Needs to also return `halvingReason`.
   - What's unclear: Whether to change the return type (breaking change to callers) or use a parallel approach.
   - Recommendation: Change return type to `{ commission: number; halvingReason: string | null }` and update all three callers (upsertPayrollEntryForSale, preview endpoint, tests) in the same commit. TypeScript will enforce all callers are updated.

3. **Products query needs to include bundle addon relations**
   - What we know: `GET /products` currently returns `prisma.product.findMany()` with no includes.
   - What's unclear: Whether to add `include: { requiredBundleAddon: true, fallbackBundleAddon: true, stateAvailability: true }` to all product queries or only specific ones.
   - Recommendation: Add includes to the product list endpoint since the config UI needs this data. Keep the existing Sale includes minimal (only need the IDs on the core product, not full addon objects).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (configured in repo root) |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test -- commission.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BUNDLE-01 | Admin designates required addon on CORE product | integration (API) | `npm test -- bundle-requirement.test` | No - Wave 0 |
| BUNDLE-02 | Admin sets state availability for addon | integration (API) | `npm test -- state-availability.test` | No - Wave 0 |
| BUNDLE-03 | Admin sets fallback addon | integration (API) | `npm test -- bundle-requirement.test` | No - Wave 0 |
| BUNDLE-04 | Multiple fallback tiers | unit | `npm test -- commission.test.ts` | Extend existing |
| BUNDLE-05 | Engine resolves required addon by state | unit | `npm test -- commission.test.ts` | No - Wave 0 |
| BUNDLE-06 | Half commission with reason when addon missing | unit | `npm test -- commission.test.ts` | No - Wave 0 |
| BUNDLE-07 | Payroll entry displays halving reason | manual | Visual inspection | N/A |
| BUNDLE-08 | Existing sales without memberState unchanged | unit | `npm test -- commission.test.ts` | Yes - existing 20+ tests |
| CFG-01 | CORE product cards show bundle requirement section | manual | Visual inspection | N/A |
| CFG-02 | ADDON product cards show state availability | manual | Visual inspection | N/A |
| CFG-03 | Completeness indicator | manual | Visual inspection | N/A |
| SALE-01 | Sales entry includes state dropdown | manual | Visual inspection | N/A |
| FIX-01 | Role selector configurable delay | manual | Visual inspection | N/A |
| FIX-02 | Seed agents removed | unit | `npm test -- seed` or manual DB check | N/A |

### Sampling Rate
- **Per task commit:** `npm test -- commission.test.ts` (fast, covers engine correctness)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before /gsd:verify-work

### Wave 0 Gaps
- [ ] New test cases in `commission.test.ts` for state-aware scenarios (BUNDLE-05, BUNDLE-06)
- [ ] `resolveBundleRequirement` unit tests (mocked Prisma)
- [ ] Backward compatibility gate: all existing 20+ tests pass with zero modifications
- [ ] State availability validation tests (BUNDLE-02)

## Sources

### Primary (HIGH confidence -- direct codebase inspection)
- `prisma/schema.prisma` -- Product model (line 127-148), Sale.memberState (line 176), PayrollEntry model (line 257-279)
- `apps/ops-api/src/services/payroll.ts` -- `calculateCommission` (line 94-188), halving at line 162, `upsertPayrollEntryForSale` (line 220-264)
- `apps/ops-api/src/services/__tests__/commission.test.ts` -- 20+ test cases, FL exemption test (line 372-388), test helpers (line 7-73)
- `apps/ops-api/src/routes/index.ts` -- product CRUD (line 263-315), preview endpoint (line 440-496), sale creation memberState validation (line 335)
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` -- ProductCard component (line 37-218), CRUD pattern, inline styles
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` -- memberState input (line 495), paste parser (line 196-199)
- `apps/ops-dashboard/app/(dashboard)/layout.tsx` -- role selector nav with hover state (line 61-159)
- `prisma/seed.ts` -- only seeds 4 users and AI audit prompt, no agents
- `.planning/research/SUMMARY.md` -- synthesized project research
- `.planning/research/PITFALLS.md` -- 14 identified pitfalls with mitigations

### Secondary (MEDIUM confidence)
- `.planning/phases/20-state-aware-bundle-requirements/20-CONTEXT.md` -- locked decisions from user discussion

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, verified via direct codebase inspection
- Architecture: HIGH -- patterns derived from existing code with specific line references
- Pitfalls: HIGH -- 14 pitfalls from research, cross-referenced against actual code paths
- Commission engine: HIGH -- `calculateCommission` is 95 lines of pure logic, fully understood

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain, no fast-moving external dependencies)
