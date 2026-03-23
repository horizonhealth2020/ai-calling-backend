# Architecture Patterns: State-Aware Bundle Commission

**Domain:** State-aware commission engine enhancement for existing Ops Platform
**Researched:** 2026-03-23
**Confidence:** HIGH (all recommendations based on direct codebase analysis)

## Current Architecture (Relevant Components)

### Commission Data Flow Today

```
Sales Entry Form (ManagerEntry.tsx)
  |
  | POST /api/sales  { productId, addonProductIds, addonPremiums, memberState, ... }
  |
  v
routes/index.ts  -- validates with Zod, creates Sale + SaleAddon rows
  |
  | upsertPayrollEntryForSale(saleId)
  |
  v
services/payroll.ts
  |-- calculateCommission(sale)  <-- PURE function, no DB access
  |     |-- classifies products (CORE, ADDON, AD_D)
  |     |-- checks isBundleQualifier flag on products
  |     |-- if no qualifier && !commissionApproved: halves commission
  |     |-- applies enrollment fee rules
  |
  |-- upsertPayrollEntryForSale()  <-- creates/updates PayrollEntry
  v
PayrollEntry row with payoutAmount = commission result
```

### Key Observations

1. **`calculateCommission` is pure.** It receives a `SaleWithProduct` object (sale + product + addons with products) and returns a number. No DB queries inside. This is by design (see PROJECT.md: "Commission gate in upsert, not calc").

2. **`memberState` already exists on Sale model** as `String? @map("member_state") @db.VarChar(2)`. The field is already captured in the sales entry form and saved to the database. It is NOT currently passed to `calculateCommission`.

3. **`isBundleQualifier` is a boolean on Product.** Currently, the commission engine checks if ANY product in the sale has `isBundleQualifier = true`. If none do and sale has a core product, commission is halved (unless `commissionApproved`).

4. **The preview endpoint mirrors the calc logic** in `POST /sales/preview`. It constructs a mock sale object and calls `calculateCommission`. Any changes to the calc must also flow through preview.

5. **Product CRUD is simple PATCH/POST** on `/api/products`. The Product model has commission-related fields but NO state-awareness fields today.

---

## Recommended Architecture for State-Aware Bundles

### Design Principle: Configuration-Driven, Not Code-Driven

The business rule is: "In state X, the required bundle addon is product Y. If Y is unavailable in that state, fall back to product Z. If neither is present, half commission."

This should be **data in the database**, not conditionals in code. The commission engine should read configuration rows, not hardcode state-to-product mappings.

### New Component: BundleRequirement Model

```
BundleRequirement (NEW TABLE)

  id            String   @id @default(cuid())
  coreProductId String   -- which core product this rule is for
  state         String?  @db.VarChar(2)  -- null = default rule
  primaryAddonId   String  -- required addon in this state
  fallbackAddonId  String? -- if primary unavailable
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([coreProductId, state])  -- one rule per core+state
  @@map("bundle_requirements")

Relations:
  coreProduct    Product  @relation("BundleReqCore", ...)
  primaryAddon   Product  @relation("BundleReqPrimary", ...)
  fallbackAddon  Product? @relation("BundleReqFallback", ...)
```

### New Component: ProductStateAvailability Model

```
ProductStateAvailability (NEW TABLE)

  id         String   @id @default(cuid())
  productId  String
  state      String   @db.VarChar(2)
  available  Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([productId, state])
  @@map("product_state_availability")
```

**Why two tables instead of JSON on Product?** Three reasons:
1. Queryable -- "which products are available in FL?" is a single indexed query.
2. Auditable -- changes tracked via updatedAt, compatible with audit logging pattern.
3. Relational integrity -- foreign keys ensure referenced products exist.

### Modified Component: calculateCommission

The current function signature is:

```typescript
export const calculateCommission = (sale: SaleWithProduct): number
```

The new signature adds bundle requirement context:

```typescript
type BundleRequirementContext = {
  primaryAddonId: string | null;
  fallbackAddonId: string | null;
} | null;

export const calculateCommission = (
  sale: SaleWithProduct,
  bundleReq?: BundleRequirementContext
): number
```

**Critical: Keep it pure.** The function does NOT query the database. The caller (upsertPayrollEntryForSale or preview endpoint) resolves the bundle requirement and passes it in. This preserves the existing design principle.

### Modified Logic Flow

The existing halving logic (lines 160-164 of payroll.ts):

```typescript
// CURRENT: Binary check -- any isBundleQualifier product present?
if (!qualifierExists && !sale.commissionApproved) {
  totalCommission /= 2;
}
```

Becomes:

```typescript
// NEW: State-aware check
if (hasCoreInSale && !sale.commissionApproved) {
  if (bundleReq) {
    // A bundle requirement exists for this core+state combination
    const addonIds = allEntries.map(e => e.product.id);
    const hasPrimary = bundleReq.primaryAddonId
      && addonIds.includes(bundleReq.primaryAddonId);
    const hasFallback = bundleReq.fallbackAddonId
      && addonIds.includes(bundleReq.fallbackAddonId);
    if (!hasPrimary && !hasFallback) {
      totalCommission /= 2;
    }
  } else {
    // No bundle requirement configured -- fall back to existing isBundleQualifier logic
    if (!qualifierExists) {
      totalCommission /= 2;
    }
  }
}
```

**Backward compatibility:** When no `BundleRequirement` row exists for a core product + state, the old `isBundleQualifier` logic applies. This means existing products work without any migration changes.

### Modified Component: upsertPayrollEntryForSale

Currently fetches sale with product and addons. Must now also resolve the bundle requirement:

```typescript
export const upsertPayrollEntryForSale = async (saleId: string) => {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { product: true, addons: { include: { product: true } } },
  });
  if (!sale) throw new Error("Sale not found");

  // NEW: Resolve bundle requirement for this sale's core product + member state
  const bundleReq = await resolveBundleRequirement(
    sale.product.type === 'CORE' ? sale.product.id : null,
    sale.memberState
  );

  const payoutAmount = sale.status === 'RAN'
    ? calculateCommission(sale, bundleReq)
    : 0;
  // ... rest unchanged
};
```

### New Service Function: resolveBundleRequirement

```typescript
export async function resolveBundleRequirement(
  coreProductId: string | null,
  memberState: string | null | undefined
): Promise<BundleRequirementContext | null> {
  if (!coreProductId) return null;

  // Try state-specific rule first, then default (state=null)
  const req = await prisma.bundleRequirement.findFirst({
    where: {
      coreProductId,
      active: true,
      state: memberState ?? null,
    },
  });

  // Fall back to default rule if no state-specific one
  const rule = req ?? await prisma.bundleRequirement.findFirst({
    where: { coreProductId, active: true, state: null },
  });

  if (!rule) return null;

  // Check state availability of primary addon
  let primaryAvailable = true;
  if (memberState && rule.primaryAddonId) {
    const avail = await prisma.productStateAvailability.findUnique({
      where: {
        productId_state: {
          productId: rule.primaryAddonId,
          state: memberState,
        },
      },
    });
    if (avail && !avail.available) primaryAvailable = false;
  }

  return {
    primaryAddonId: primaryAvailable ? rule.primaryAddonId : null,
    fallbackAddonId: rule.fallbackAddonId,
  };
}
```

---

## Component Boundaries

| Component | Responsibility | Changes Required |
|-----------|---------------|-----------------|
| `prisma/schema.prisma` | Data model | ADD BundleRequirement + ProductStateAvailability models, ADD relations to Product |
| `services/payroll.ts` | Commission calculation | MODIFY calculateCommission signature + halving logic, ADD resolveBundleRequirement function |
| `routes/index.ts` | API endpoints | ADD CRUD routes for bundle requirements + state availability, MODIFY preview endpoint to pass bundleReq |
| `PayrollProducts.tsx` | Product config UI | ADD bundle requirement config section (per-product), ADD state availability toggles |
| `ManagerEntry.tsx` | Sales entry form | MODIFY preview call to include memberState, MODIFY commission preview display to show bundle status |

### What Does NOT Change

| Component | Why Unchanged |
|-----------|--------------|
| `Sale` model | `memberState` field already exists |
| `Product` model | `isBundleQualifier` stays as fallback; no schema change needed |
| `SaleAddon` model | Unchanged -- addons still recorded the same way |
| `PayrollEntry` model | Commission result stored the same way |
| Socket.IO events | Same `sale:changed` payload -- commission is just a different number |
| Auth/RBAC middleware | Same role gates (PAYROLL/SUPER_ADMIN for config, MANAGER for entry) |
| Export/CSV logic | Reads payoutAmount from PayrollEntry -- unchanged |

---

## Data Flow: New State-Aware Commission Path

```
1. Manager enters sale with memberState = "FL"
   |
2. POST /api/sales -- saves Sale with memberState="FL"
   |
3. upsertPayrollEntryForSale(saleId)
   |
   |-- Fetches sale (with product, addons)
   |-- sale.product.type === "CORE" && sale.memberState === "FL"
   |
   |-- resolveBundleRequirement("core-product-id", "FL")
   |     |-- Query: BundleRequirement WHERE coreProductId=X AND state="FL"
   |     |-- Found? Check if primaryAddon is available in FL
   |     |     |-- ProductStateAvailability WHERE productId=primaryAddon AND state="FL"
   |     |     |-- Available: return { primaryAddonId: Y, fallbackAddonId: Z }
   |     |     |-- Unavailable: return { primaryAddonId: null, fallbackAddonId: Z }
   |     |-- Not found? Try state=null (default rule)
   |     |-- No rule at all? return null (old isBundleQualifier logic applies)
   |
   |-- calculateCommission(sale, bundleReq)
   |     |-- Checks if sale addons include primaryAddonId or fallbackAddonId
   |     |-- Present: full commission
   |     |-- Neither present && !commissionApproved: half commission
   |
4. PayrollEntry created with calculated payoutAmount
```

---

## API Routes (New)

### Bundle Requirements CRUD

```
GET    /api/bundle-requirements              -- list all (filterable by coreProductId)
GET    /api/bundle-requirements/:id          -- single
POST   /api/bundle-requirements              -- create
PATCH  /api/bundle-requirements/:id          -- update
DELETE /api/bundle-requirements/:id          -- soft-delete (set active=false)
```

Access: `requireRole("PAYROLL", "SUPER_ADMIN")` -- same as product CRUD.

### State Availability CRUD

```
GET    /api/products/:id/state-availability  -- list states for a product
PUT    /api/products/:id/state-availability  -- bulk upsert states
```

Access: `requireRole("PAYROLL", "SUPER_ADMIN")`.

**Why PUT for bulk upsert?** State availability is toggle-based (50 states). Individual POST/DELETE per state would be 50 API calls. A single PUT with `{ states: { FL: true, CA: false, NY: true } }` is one call.

### Preview Endpoint Enhancement

The existing `POST /api/sales/preview` must also resolve bundle requirements to show accurate commission:

```typescript
// ADD to preview endpoint:
const bundleReq = await resolveBundleRequirement(
  product.type === 'CORE' ? product.id : null,
  parsed.data.memberState  // NEW field in preview schema
);
const commission = calculateCommission(mockSale, bundleReq);

// ADD to response breakdown:
bundleRequirement: bundleReq ? {
  primaryAddonId: bundleReq.primaryAddonId,
  fallbackAddonId: bundleReq.fallbackAddonId,
  satisfied: /* check if addon present */,
} : null,
```

---

## UI Architecture: Config in PayrollProducts

### Approach: Expandable Section Per Product

Do NOT create a separate tab or page. Bundle requirements are per-product configuration. Add a collapsible "Bundle Requirements" section inside each `ProductCard` component when the product type is CORE.

```
+-----------------------------------------------------+
| Health Insurance Core                    [Core] Active |
| Below $250: 30%  Above $250: 40%                      |
|                                                        |
| v Bundle Requirements                                  |
| +----------------------------------------------------+ |
| | Default Rule:                                      | |
| |   Primary Addon: [Compass VAB v]                   | |
| |   Fallback Addon: [None v]                         | |
| |                                                    | |
| | State Overrides:            [+ Add State Override] | |
| |   FL: Primary = Compass VAB, Fallback = Dental Plus| |
| |   CA: Primary = Dental Plus, Fallback = None       | |
| +----------------------------------------------------+ |
|                                                        |
| v State Availability (for this addon product)          |
| +----------------------------------------------------+ |
| | Available in all states except:                    | |
| |   [ ] FL  [ ] CA  [x] NY  [ ] TX  ...             | |
| | (Only shown for ADDON/AD_D products)               | |
| +----------------------------------------------------+ |
+--------------------------------------------------------+
```

**Bundle Requirements section** appears only on CORE products.
**State Availability section** appears only on ADDON/AD_D products.

This separation makes logical sense: core products define "what addon is required," addon products define "where I am available."

### Commission Preview Enhancement

In `ManagerEntry.tsx`, the preview panel currently shows:

```
Bundle: Compass VAB included / No qualifier -- half rate applied / Standalone
```

Enhance to show state-aware info:

```
Bundle: Required addon (Compass VAB) included -- full rate
Bundle: Required addon unavailable in FL -- fallback (Dental Plus) included
Bundle: No required addon present -- half rate applied
```

The preview response already returns a `breakdown` object. Extend it with `bundleRequirement` details.

---

## Patterns to Follow

### Pattern 1: Configuration Resolution with Fallback Chain

**What:** State-specific rule -> default rule -> legacy isBundleQualifier flag.
**When:** Any time bundle requirement is checked.
**Why:** Zero-migration deployment. Existing products work without bundle requirement rows because the `isBundleQualifier` fallback is preserved.

```typescript
// Resolution priority:
// 1. BundleRequirement WHERE coreProductId=X AND state="FL"
// 2. BundleRequirement WHERE coreProductId=X AND state IS NULL
// 3. Fall back to isBundleQualifier boolean (existing behavior)
```

### Pattern 2: Pure Calc + Resolved Context

**What:** Keep `calculateCommission` pure. Resolve all DB-dependent context in the caller.
**When:** Any commission calculation path (sale creation, sale edit, preview, commission recalc).
**Why:** Matches existing architecture decision. Makes testing straightforward -- pass different context objects to test different scenarios.

### Pattern 3: Bulk State Operations

**What:** PUT endpoint that accepts all 50 states at once rather than individual toggle endpoints.
**When:** State availability configuration.
**Why:** The UI will render a grid of 50 state checkboxes. On save, send the entire map. Server upserts all rows in a transaction.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Hardcoding State-Product Mappings

**What:** `if (state === 'FL') requiredAddon = 'compass-vab'`
**Why bad:** Every new state or product change requires a code deploy. The whole point of this feature is configurability.
**Instead:** Database-driven BundleRequirement rows.

### Anti-Pattern 2: Making calculateCommission Async

**What:** Adding `await prisma.bundleRequirement.findFirst(...)` inside calculateCommission.
**Why bad:** Breaks the pure-function design. The function is called from both the upsert flow and the preview endpoint. Making it async changes all callers and makes testing harder.
**Instead:** Resolve bundle requirement context before calling calculateCommission.

### Anti-Pattern 3: Separate Config Page for Bundle Rules

**What:** Creating a new "Bundle Rules" tab or standalone config page.
**Why bad:** Bundle requirements are per-product configuration. A separate page creates navigation overhead and disconnects the rule from its product context.
**Instead:** Inline collapsible section within the existing ProductCard component.

### Anti-Pattern 4: Storing State Availability as JSON on Product

**What:** `stateAvailability Json? @map("state_availability")` on the Product model.
**Why bad:** Not queryable ("which products are available in FL?"), no relational integrity, harder to audit changes.
**Instead:** Separate ProductStateAvailability table with proper indices.

---

## Migration Strategy

### Database Migration

Single Prisma migration adding two tables. No existing table modifications required.

```sql
CREATE TABLE "bundle_requirements" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT cuid(),
  "core_product_id" TEXT NOT NULL REFERENCES "products"("id"),
  "state" VARCHAR(2),
  "primary_addon_id" TEXT NOT NULL REFERENCES "products"("id"),
  "fallback_addon_id" TEXT REFERENCES "products"("id"),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "bundle_requirements_core_product_id_state_key"
    UNIQUE("core_product_id", "state")
);

CREATE TABLE "product_state_availability" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT cuid(),
  "product_id" TEXT NOT NULL REFERENCES "products"("id"),
  "state" VARCHAR(2) NOT NULL,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "product_state_availability_product_id_state_key"
    UNIQUE("product_id", "state")
);
```

**Zero-downtime:** Adding new tables does not affect existing queries. The fallback chain ensures existing sales calculate correctly before any BundleRequirement rows are created.

### Seed Data

No seed data required. Bundle requirements are configured by payroll staff through the UI. The system works without any rows (falls back to isBundleQualifier).

---

## Suggested Build Order

Build order follows the dependency graph -- each phase builds on the previous.

### Phase 1: Data Model + Service Layer (Backend Foundation)

**What:** Prisma schema changes, migration, `resolveBundleRequirement` function, modify `calculateCommission`.

**Deliverables:**
- Add BundleRequirement and ProductStateAvailability to schema.prisma
- Create and run migration
- Add `resolveBundleRequirement()` to services/payroll.ts
- Modify `calculateCommission()` to accept optional `BundleRequirementContext`
- Modify `upsertPayrollEntryForSale()` to call resolveBundleRequirement
- Unit tests for calculateCommission with various bundleReq contexts

**Why first:** Everything else depends on the data model and calc logic being correct. This is the foundation.

**Risk:** LOW -- additive schema change, backward-compatible calc modification.

### Phase 2: API Routes + Preview Enhancement (Backend Complete)

**What:** CRUD endpoints for bundle requirements and state availability, preview endpoint enhancement.

**Deliverables:**
- GET/POST/PATCH/DELETE /api/bundle-requirements routes
- GET/PUT /api/products/:id/state-availability routes
- Add memberState to preview schema, resolve bundleReq in preview
- Add bundleRequirement info to preview response breakdown
- Zod validation schemas for all new endpoints

**Why second:** API must exist before UI can call it. Preview enhancement enables accurate commission display during entry.

**Risk:** LOW -- follows existing route patterns exactly.

### Phase 3: Config UI in PayrollProducts (Admin Interface)

**What:** Bundle requirement config in ProductCard, state availability toggles.

**Deliverables:**
- Collapsible "Bundle Requirements" section on CORE product cards
- Default rule + state override management
- Collapsible "State Availability" section on ADDON/AD_D product cards
- State grid with checkboxes (default: available everywhere)

**Why third:** Config UI must work before testing end-to-end flow. Payroll staff need to set up rules before commission calc can be verified.

**Risk:** MEDIUM -- UI complexity with state grid (50 states). Keep it simple: checkbox grid, not a fancy map.

### Phase 4: Sales Entry Integration + Polish (End-to-End)

**What:** Commission preview enhancement in ManagerEntry, memberState-aware preview display.

**Deliverables:**
- Enhanced commission preview panel showing bundle requirement status
- memberState field included in preview API call
- Preview breakdown shows which addon satisfies requirement (or explains half-rate reason)
- Validation: warn if required addon not selected for the member's state

**Why last:** This is the user-facing polish. The backend and config must be solid first.

**Risk:** LOW -- mostly display changes to existing preview panel.

### Parallel: Housekeeping (No Dependencies)

- Role dashboard selector delay fix
- Remove seed agents from database seed

These have no dependency on the bundle commission work and can be done in any phase.

---

## Scalability Considerations

| Concern | Current Scale | At Growth |
|---------|--------------|-----------|
| BundleRequirement rows | ~5-10 (few core products x few state overrides) | Still small -- max ~250 (5 cores x 50 states) |
| ProductStateAvailability rows | ~50-250 (few addons x 50 states) | Still small -- max ~500 |
| Commission calc latency | 0ms (pure function) | +1-2ms for resolveBundleRequirement DB query |
| Config UI load | Single product list fetch | +2 queries (bundle reqs + state avail) -- consider eager loading with products |

**Verdict:** Scale is not a concern. This is configuration data with a hard ceiling of a few hundred rows.

---

## Sources

- Direct codebase analysis of:
  - `prisma/schema.prisma` -- existing Product, Sale, SaleAddon models
  - `apps/ops-api/src/services/payroll.ts` -- calculateCommission, upsertPayrollEntryForSale
  - `apps/ops-api/src/routes/index.ts` -- sale creation, preview, product CRUD routes
  - `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` -- product config UI
  - `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` -- sales entry form
  - `.planning/PROJECT.md` -- project context, design decisions, constraints
