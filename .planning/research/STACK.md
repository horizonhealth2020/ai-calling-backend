# Stack Research

**Domain:** State-aware bundle commission requirements for existing Ops Platform
**Researched:** 2026-03-23
**Confidence:** HIGH

## Key Finding: No New Libraries Required

This feature is entirely implementable with the existing stack. The codebase already has every technology needed:

- **Prisma 5.20** for schema modeling (new `BundleRequirement` table)
- **Zod 3.23** for API request validation
- **Express 4.19** for new CRUD routes
- **React** with inline CSSProperties for config UI
- **Socket.IO 4.8** for real-time propagation of config changes

The Sale model already has a `memberState` field (`@db.VarChar(2)`), so the client-state-on-sale requirement has a head start. The commission engine (`calculateCommission` in `services/payroll.ts`) already implements bundle qualifier halving logic -- it just needs to become state-aware instead of purely boolean.

## Recommended Stack (Changes Only)

### No New Dependencies Required

| Technology | Version | Already In Use | Role in v1.4 |
|------------|---------|----------------|---------------|
| Prisma | ^5.20.0 | Yes | New BundleRequirement model + migration |
| Zod | ^3.23.8 | Yes | Validate state codes, product IDs, bundle config payloads |
| Express | ^4.19.2 | Yes | CRUD endpoints for bundle requirement config |
| React (Next.js 15) | 15.x | Yes | Config UI in PayrollProducts tab area |
| Socket.IO | ^4.8.3 | Yes | Broadcast config changes to connected dashboards |
| PostgreSQL | - | Yes | Relational storage for state-product mapping |
| Luxon | ^3.4.4 | Yes | Already used in commission calc timezone handling |
| Lucide React | ^0.577.0 | Yes | Icons for config UI (Edit3, Plus, Trash2 pattern) |
| @ops/ui | workspace | Yes | Badge, Button, Card, EmptyState, design tokens |
| @ops/auth/client | workspace | Yes | authFetch for config API calls |

## What to Build (Not Install)

### 1. Prisma Schema: BundleRequirement Model

New table linking a core product to its required addon per state, with optional fallback.

```prisma
model BundleRequirement {
  id                String   @id @default(cuid())
  coreProductId     String   @map("core_product_id")
  primaryAddonId    String   @map("primary_addon_id")
  fallbackAddonId   String?  @map("fallback_addon_id")
  states            String[] // e.g. ["TX", "FL", "CA"] -- states where primary is available
  allStatesDefault  Boolean  @default(false) @map("all_states_default")
  active            Boolean  @default(true)
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  coreProduct    Product @relation("BundleReqCore", fields: [coreProductId], references: [id])
  primaryAddon   Product @relation("BundleReqPrimary", fields: [primaryAddonId], references: [id])
  fallbackAddon  Product? @relation("BundleReqFallback", fields: [fallbackAddonId], references: [id])

  @@unique([coreProductId])
  @@map("bundle_requirements")
}
```

**Why this shape:**
- **One row per core product** (`@@unique` on coreProductId) -- simple lookup during commission calc, no ambiguity
- **`String[]` for states** -- PostgreSQL native arrays, Prisma supports natively, avoids junction table overhead for a simple state list. Queryable with `@> ARRAY['TX']` under the hood via Prisma `has` filter
- **`allStatesDefault` flag** -- allows "available everywhere except..." pattern vs "available only in..." -- reduces config burden when a product is available in most states
- **`fallbackAddonId` nullable** -- some cores may not have a fallback (commission just halves when required addon missing)
- **Product relation** will need 3 new relation fields added to the existing Product model (`bundleReqAsCore`, `bundleReqAsPrimary`, `bundleReqAsFallback`)

### 2. Commission Engine Changes

Modify `calculateCommission` in `services/payroll.ts`:

Current logic (line 162):
```typescript
// Current: simple boolean check
if (!qualifierExists && !sale.commissionApproved) {
  totalCommission /= 2;
}
```

New logic:
```typescript
// New: state-aware check
// 1. Look up BundleRequirement for this sale's core product
// 2. If no requirement exists, fall back to current qualifierExists behavior
// 3. If requirement exists:
//    a. Check if memberState is in requirement's states (or allStatesDefault)
//    b. If state requires primary: check if primary addon is in sale's addons
//    c. If primary not found: check if fallback addon is present
//    d. If neither: halve commission
// 4. commissionApproved bypass stays intact (manual override)
```

**Critical:** Keep `calculateCommission` pure (no DB calls). Pass bundle requirements as a parameter, queried alongside the sale in `upsertPayrollEntryForSale`.

### 3. API Routes (in existing `routes/index.ts`)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/bundle-requirements` | List all with product names | requireAuth + requireRole(PAYROLL, SUPER_ADMIN) |
| POST | `/api/bundle-requirements` | Create new requirement | requireAuth + requireRole(PAYROLL, SUPER_ADMIN) |
| PUT | `/api/bundle-requirements/:id` | Update | requireAuth + requireRole(PAYROLL, SUPER_ADMIN) |
| DELETE | `/api/bundle-requirements/:id` | Soft delete (active=false) | requireAuth + requireRole(PAYROLL, SUPER_ADMIN) |

All validated with Zod schemas following existing `zodErr()` pattern.

### 4. Config UI

Extend `PayrollProducts.tsx` with a "Bundle Requirements" section below the product cards:

- Core product dropdown (filtered to type=CORE)
- Primary addon dropdown (filtered to type=ADDON)
- Fallback addon dropdown (optional, filtered to type=ADDON)
- State multi-select (checkboxes or tag-style input for US state codes)
- `allStatesDefault` toggle
- Standard CRUD card pattern matching existing PayrollProducts

### 5. Sales Entry Form Enhancement

`ManagerEntry.tsx` needs a state selector dropdown using a hardcoded US states constant. The `memberState` field already exists on the Sale model -- the form just needs the UI input.

## State Code Handling

**Use a hardcoded constant. Do not install a library.**

```typescript
export const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  // ... all 50 + DC
] as const;
```

**Why not a library:**
- US state codes are a fixed, well-known set (50 states + DC)
- A library adds a dependency for ~50 lines of static data
- The business may want to exclude territories or add custom entries
- Zod validation: `.refine(v => US_STATES.some(s => s.code === v))`

**Location:** Put in `@ops/utils` or `@ops/types` so it is shared between the API (Zod validation) and dashboard (dropdown options).

## What NOT to Add

| Avoid | Why | Do Instead |
|-------|-----|------------|
| State/province lookup library (us-states, country-state-city) | Static data, ~50 entries, zero maintenance burden | Hardcoded constant array in @ops/types |
| Form library (react-hook-form, formik) | Project uses controlled useState + onSubmit everywhere | Follow PayrollProducts pattern |
| UI component library (shadcn, MUI) | Project uses inline CSSProperties with @ops/ui tokens | Use existing @ops/ui + inline styles |
| Separate rules engine service | This is a simple lookup table, not a complex rules engine | Keep in existing ops-api |
| Redis/caching for bundle rules | Bundle requirements change rarely, <50 rows total | Direct Prisma query per commission calc |
| Multi-select component library (react-select) | Tempting for state picker, but adds bloat | Checkbox grid or simple tag-style input with inline styles |
| Geography/mapping library | No geospatial queries needed | Simple string matching on 2-letter codes |

## Alternatives Considered

| Recommended | Alternative | Why Not Alternative |
|-------------|-------------|---------------------|
| `String[]` for states in Prisma | Junction table (BundleRequirementState) | Overkill -- states are a flat list, not entities with attributes. Array is simpler to query, manage, and display. |
| Single BundleRequirement per core | Multiple rules per core (one per state) | Explodes row count (50x rows per product). Single row with array is simpler to query and config. |
| Modify existing `calculateCommission` | New separate state-aware function | Violates DRY. The function is the single source of truth. Extend, don't duplicate. |
| Config in PayrollProducts area | Separate "Bundle Rules" tab | Bundle requirements are product configuration. Keeping them near products avoids context switching. |
| Hardcoded US_STATES constant | Database table of states | States don't change. A DB table adds CRUD overhead for zero benefit. |

## Version Compatibility

All existing -- no compatibility concerns:

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Prisma ^5.20.0 | PostgreSQL String[] arrays | Native support via `String[]` type, `has`/`hasEvery` filters |
| Prisma ^5.20.0 | Three relations to same model | Requires named relations (`"BundleReqCore"`, etc.) |
| Zod ^3.23.8 | Express route validation | Same `zodErr()` pattern used throughout ops-api |

## Integration Points

### Commission Calculation Flow (modified)

```
Sale submitted with memberState
  -> upsertPayrollEntryForSale()
    -> query BundleRequirement for sale's core product (single Prisma include)
    -> calculateCommission(sale, bundleRequirement?)
      -> if bundleRequirement exists:
           check memberState against requirement.states / allStatesDefault
           check if primary or fallback addon present in sale.addons
           halve if neither present (unless commissionApproved)
         else:
           fall back to existing qualifierExists logic
```

### Config UI Data Flow

```
PayrollProducts tab -> "Bundle Requirements" section
  -> authFetch GET /api/bundle-requirements (includes product names)
  -> CRUD via authFetch POST/PUT/DELETE
  -> Socket.IO broadcast on change -> connected dashboards refresh product data
```

### Sales Entry Form

```
ManagerEntry.tsx -> new "Client State" dropdown
  -> US_STATES constant for options
  -> memberState submitted in sale payload
  -> API already accepts memberState on Sale model (field exists)
```

## Installation

```bash
# No new packages to install. Everything is already in the workspace.

# After schema change:
npx prisma migrate dev --name add-bundle-requirements

# No other setup needed.
```

## Confidence Assessment

| Decision | Confidence | Rationale |
|----------|------------|-----------|
| No new dependencies | HIGH | Inspected all package.json files, schema, and feature requirements against existing stack |
| String[] for states | HIGH | Prisma docs confirm PostgreSQL array support with has/hasEvery filters |
| Single BundleRequirement per core | HIGH | Business requirement is one required addon per core product -- 1:1 mapping |
| Hardcoded US_STATES | HIGH | Standard practice, avoids unnecessary dependency for static data |
| Modify calculateCommission | HIGH | Function is already the single source of truth, extending is cleaner than duplicating |
| memberState already on Sale | HIGH | Verified in prisma/schema.prisma line 176: `memberState String? @db.VarChar(2)` |

## Sources

- `prisma/schema.prisma` -- Verified Product model (lines 127-148), Sale.memberState field (line 176), ProductType enum, existing relations
- `apps/ops-api/src/services/payroll.ts` -- Verified calculateCommission bundle qualifier halving (line 162), SaleWithProduct type, upsertPayrollEntryForSale flow
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` -- Verified CRUD card pattern, authFetch usage, inline styles
- `apps/ops-api/package.json` -- Verified Prisma ^5.20.0, Zod ^3.23.8, Express ^4.19.2, Socket.IO ^4.8.3
- `package.json` (root) -- Verified Luxon ^3.4.4, workspace configuration

---
*Stack research for: State-aware bundle commission requirements*
*Researched: 2026-03-23*
