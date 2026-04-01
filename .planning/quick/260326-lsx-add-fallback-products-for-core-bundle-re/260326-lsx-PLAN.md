---
phase: quick
plan: 260326-lsx
type: execute
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - apps/ops-api/src/services/payroll.ts
  - apps/ops-api/src/routes/products.ts
  - apps/ops-api/src/routes/sales.ts
  - apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx
autonomous: true
requirements: [FALLBACK-MULTI]

must_haves:
  truths:
    - "A core product can have multiple fallback addons configured (not just one)"
    - "Bundle resolution treats ANY matching fallback as qualifying (no order/priority)"
    - "Existing single fallbackBundleAddonId data is migrated to the new join table"
    - "UI allows selecting/deselecting multiple fallback addons via checkboxes"
    - "State coverage indicator accounts for all fallback addons combined"
  artifacts:
    - path: "prisma/schema.prisma"
      provides: "CoreProductFallback join table model"
      contains: "model CoreProductFallback"
    - path: "apps/ops-api/src/services/payroll.ts"
      provides: "Multi-fallback bundle resolution"
      contains: "fallbackAddons"
    - path: "apps/ops-api/src/routes/products.ts"
      provides: "Array-based fallback CRUD in product endpoints"
    - path: "apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx"
      provides: "Multi-select fallback addon UI"
  key_links:
    - from: "apps/ops-api/src/services/payroll.ts"
      to: "prisma.coreProductFallback"
      via: "findMany query for fallback product IDs"
      pattern: "coreProductFallback"
    - from: "apps/ops-api/src/routes/products.ts"
      to: "prisma.coreProductFallback"
      via: "createMany/deleteMany for fallback management"
      pattern: "coreProductFallback"
---

<objective>
Replace the single `fallbackBundleAddonId` FK on Product with a many-to-many `CoreProductFallback` join table, so core products can have multiple fallback addons where ANY qualifying fallback satisfies the bundle requirement.

Purpose: Compass VAB is the primary required addon, but in states where it is unavailable, multiple alternative products can serve as fallbacks. The current single-FK design only allows one fallback.

Output: Migration, updated API, updated bundle resolution logic, updated dashboard UI with multi-select fallback checkboxes.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@prisma/schema.prisma (Product model lines 128-161, see fallbackBundleAddonId at line 142)
@apps/ops-api/src/services/payroll.ts (resolveBundleRequirement at lines 207-240)
@apps/ops-api/src/routes/products.ts (full file — GET/POST/PATCH/DELETE endpoints)
@apps/ops-api/src/routes/sales.ts (line 154 — fallbackBundleAddon include in preview)
@apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx (Product type, edit form, display logic)

<interfaces>
<!-- Key types and contracts the executor needs -->

From prisma/schema.prisma (Product model, lines 128-161):
```prisma
model Product {
  id                   String      @id @default(cuid())
  name                 String      @unique
  // ... commission fields ...
  requiredBundleAddonId  String?  @map("required_bundle_addon_id")
  fallbackBundleAddonId  String?  @map("fallback_bundle_addon_id")  // TO BE REMOVED
  requiredBundleAddon    Product? @relation("RequiredBundleAddon", fields: [requiredBundleAddonId], references: [id])
  fallbackBundleAddon    Product? @relation("FallbackBundleAddon", fields: [fallbackBundleAddonId], references: [id])
  coreProductsRequiring  Product[] @relation("RequiredBundleAddon")
  coreProductsFallback   Product[] @relation("FallbackBundleAddon")  // TO BE REMOVED
  // ...
}
```

From apps/ops-api/src/services/payroll.ts (line 207):
```typescript
export async function resolveBundleRequirement(
  coreProduct: { requiredBundleAddonId: string | null; fallbackBundleAddonId: string | null; requiredBundleAddon?: { name: string } | null; fallbackBundleAddon?: { name: string } | null },
  memberState: string,
  saleAddonProductIds: string[]
): Promise<BundleRequirementContext>
```

From PayrollProducts.tsx (line 20-30):
```typescript
type Product = {
  id: string; name: string; active: boolean; type: ProductType;
  // ...
  requiredBundleAddonId?: string | null;
  fallbackBundleAddonId?: string | null;           // BECOMES fallbackAddonIds: string[]
  requiredBundleAddon?: { id: string; name: string } | null;
  fallbackBundleAddon?: { id: string; name: string } | null;  // BECOMES fallbackAddons: { id: string; name: string }[]
  stateAvailability?: { stateCode: string }[];
};
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Schema migration + API updates for multi-fallback</name>
  <files>prisma/schema.prisma, apps/ops-api/src/services/payroll.ts, apps/ops-api/src/routes/products.ts, apps/ops-api/src/routes/sales.ts</files>
  <action>
**1. Prisma schema changes (prisma/schema.prisma):**

Add a new join table model:
```prisma
model CoreProductFallback {
  id              String   @id @default(cuid())
  coreProductId   String   @map("core_product_id")
  fallbackProductId String @map("fallback_product_id")
  createdAt       DateTime @default(now()) @map("created_at")

  coreProduct     Product  @relation("CoreFallbacks", fields: [coreProductId], references: [id], onDelete: Cascade)
  fallbackProduct Product  @relation("FallbackFor", fields: [fallbackProductId], references: [id], onDelete: Cascade)

  @@unique([coreProductId, fallbackProductId])
  @@map("core_product_fallbacks")
}
```

On the Product model:
- KEEP `fallbackBundleAddonId` and `fallbackBundleAddon` and `coreProductsFallback` for now (remove after data migration confirms clean). Actually, remove them in the same migration since we will migrate data in the migration SQL.
- ADD two new relation fields:
  ```prisma
  fallbackAddons     CoreProductFallback[] @relation("CoreFallbacks")
  fallbackForCores   CoreProductFallback[] @relation("FallbackFor")
  ```
- REMOVE: `fallbackBundleAddonId`, `fallbackBundleAddon`, `coreProductsFallback`

**2. Create migration with data transfer:**

Run `npx prisma migrate dev --name add-multi-fallback-addons --create-only` to generate the migration SQL, then EDIT the generated SQL to insert data migration BETWEEN the create-table and drop-column steps:

```sql
-- CreateTable for core_product_fallbacks first
CREATE TABLE "core_product_fallbacks" (...);

-- Migrate existing single fallback data
INSERT INTO "core_product_fallbacks" ("id", "core_product_id", "fallback_product_id", "created_at")
SELECT gen_random_uuid()::text, "id", "fallback_bundle_addon_id", NOW()
FROM "products"
WHERE "fallback_bundle_addon_id" IS NOT NULL;

-- Then drop the old column
ALTER TABLE "products" DROP COLUMN "fallback_bundle_addon_id";
```

Then run `npx prisma migrate deploy` and `npx prisma generate`.

**3. Update resolveBundleRequirement (apps/ops-api/src/services/payroll.ts lines 207-240):**

Change the function signature to accept the new shape:
```typescript
export async function resolveBundleRequirement(
  coreProduct: {
    requiredBundleAddonId: string | null;
    requiredBundleAddon?: { name: string } | null;
    fallbackAddons?: { fallbackProduct: { id: string; name: string } }[];
  },
  memberState: string,
  saleAddonProductIds: string[]
): Promise<BundleRequirementContext>
```

Replace the single-fallback check (lines 223-232) with iteration over `coreProduct.fallbackAddons`:
```typescript
const fallbacks = coreProduct.fallbackAddons ?? [];
for (const fb of fallbacks) {
  const fbAvail = await prisma.productStateAvailability.findUnique({
    where: { productId_stateCode: { productId: fb.fallbackProduct.id, stateCode: memberState } }
  });
  const fbInSale = saleAddonProductIds.includes(fb.fallbackProduct.id);
  if (fbAvail && fbInSale) {
    return { requiredAddonAvailable: false, fallbackAddonAvailable: true, halvingReason: null };
  }
}
```

**4. Update product API endpoints (apps/ops-api/src/routes/products.ts):**

In ALL product queries that currently include `fallbackBundleAddon`, replace with:
```typescript
fallbackAddons: { select: { fallbackProduct: { select: { id: true, name: true } } } },
```

For POST and PATCH endpoints:
- Replace `fallbackBundleAddonId: z.string().nullable().optional()` with `fallbackAddonIds: z.array(z.string()).optional()`
- In POST handler: after creating product, if `fallbackAddonIds` provided, create join table rows via `prisma.coreProductFallback.createMany`
- In PATCH handler: if `fallbackAddonIds` is provided in the request body, delete existing join rows and recreate (replace strategy):
  ```typescript
  if (parsed.data.fallbackAddonIds !== undefined) {
    await prisma.coreProductFallback.deleteMany({ where: { coreProductId: pp.data.id } });
    if (parsed.data.fallbackAddonIds.length > 0) {
      await prisma.coreProductFallback.createMany({
        data: parsed.data.fallbackAddonIds.map(fid => ({ coreProductId: pp.data.id, fallbackProductId: fid })),
      });
    }
  }
  ```
  Remove `fallbackAddonIds` from `parsed.data` before passing to `prisma.product.update` (since it is not a Product column).

For DELETE handler (line 102): replace `prisma.product.updateMany({ where: { fallbackBundleAddonId: ... } })` with `prisma.coreProductFallback.deleteMany({ where: { fallbackProductId: pp.data.id } })`.

**5. Update sales.ts (line 154):**

Replace `fallbackBundleAddon: true` with:
```typescript
fallbackAddons: { select: { fallbackProduct: { select: { id: true, name: true } } } },
```
  </action>
  <verify>
    <automated>cd C:/Users/javer/Documents/Repositories/ai-calling-backend && npx prisma generate && npx tsc --noEmit -p apps/ops-api/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - CoreProductFallback join table exists in schema with migration applied
    - Existing fallbackBundleAddonId data migrated to join table
    - fallbackBundleAddonId column removed from products table
    - resolveBundleRequirement iterates multiple fallbacks
    - Product API accepts/returns array of fallback addon IDs
    - TypeScript compiles without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Dashboard UI multi-select fallback addons</name>
  <files>apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx</files>
  <action>
**1. Update Product type (line 20-30):**

Replace:
```typescript
fallbackBundleAddonId?: string | null;
fallbackBundleAddon?: { id: string; name: string } | null;
```
With:
```typescript
fallbackAddons?: { fallbackProduct: { id: string; name: string } }[];
```

**2. Update edit form state (line 63):**

Replace:
```typescript
fallbackBundleAddonId: product.fallbackBundleAddonId ?? null as string | null,
```
With:
```typescript
fallbackAddonIds: (product.fallbackAddons ?? []).map(fa => fa.fallbackProduct.id),
```

**3. Update handleSave (line 102):**

Replace:
```typescript
saveData.fallbackBundleAddonId = d.fallbackBundleAddonId || null;
```
With:
```typescript
saveData.fallbackAddonIds = d.fallbackAddonIds;
```

**4. Replace single fallback dropdown (lines 314-324) with multi-select checkboxes:**

Replace the single `<select>` for "Fallback Addon" with a checkbox list of available addons (same filter: type ADDON or AD_D, active, not self, not the required addon). Use the same styling pattern as the state availability checkboxes already in the file (lines 356-369).

Layout: Keep "Required Addon for Full Commission" as a 1-column select on top. Below it, add a "Fallback Addons" section with a scrollable checkbox grid (2 columns, max-height 150px). Each checkbox toggles an ID in the `d.fallbackAddonIds` array.

```tsx
<div style={{ marginTop: S[2] }}>
  <label style={LBL}>Fallback Addons (any qualifies)</label>
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, maxHeight: 150, overflowY: "auto", marginTop: 4 }}>
    {allProducts.filter(p => (p.type === "ADDON" || p.type === "AD_D") && p.id !== product.id && p.active && p.id !== d.requiredBundleAddonId).map(p => (
      <label key={p.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: C.textSecondary, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={d.fallbackAddonIds.includes(p.id)}
          onChange={e => {
            if (e.target.checked) setD(x => ({ ...x, fallbackAddonIds: [...x.fallbackAddonIds, p.id] }));
            else setD(x => ({ ...x, fallbackAddonIds: x.fallbackAddonIds.filter(id => id !== p.id) }));
          }}
        />
        {p.name}
      </label>
    ))}
  </div>
</div>
```

**5. Update read-only display (lines 170-194):**

Replace single fallback display logic. At line 172, change:
```typescript
const fallbackAddon = product.fallbackBundleAddonId ? allProducts.find(...) : null;
```
To:
```typescript
const fallbackAddons = (product.fallbackAddons ?? []).map(fa => fa.fallbackProduct);
```

Update the coverage set calculation (line 175):
```typescript
if (requiredAddon?.stateAvailability) requiredAddon.stateAvailability.forEach(s => coveredStates.add(s.stateCode));
for (const fb of fallbackAddons) {
  const fbProduct = allProducts.find(p => p.id === fb.id);
  if (fbProduct?.stateAvailability) fbProduct.stateAvailability.forEach(s => coveredStates.add(s.stateCode));
}
```

Update the display text (line 181):
```typescript
{fallbackAddons.length > 0 ? ` / fallbacks: ${fallbackAddons.map(f => f.name).join(", ")}` : ""}
```

**6. Change the bundle requirements section grid from "1fr 1fr" (line 302) to "1fr" since fallback is now a checkbox list below the required addon select, not a side-by-side dropdown.**
  </action>
  <verify>
    <automated>cd C:/Users/javer/Documents/Repositories/ai-calling-backend && npx tsc --noEmit -p apps/ops-dashboard/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - Product type uses fallbackAddons array instead of single fallbackBundleAddon
    - Edit form shows checkbox list for selecting multiple fallback addons
    - Read-only view lists all fallback addon names
    - State coverage indicator accounts for all fallback addons
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. `npx prisma generate` succeeds
2. `npx tsc --noEmit` passes for both ops-api and ops-dashboard
3. Start ops-api (`npm run ops:dev`) and verify GET /api/products returns `fallbackAddons` array
4. In the dashboard, edit a CORE product and confirm the fallback checkboxes appear
5. Select multiple fallback addons, save, reload -- selections persist
6. Verify state coverage badge counts states from all selected fallback addons
</verification>

<success_criteria>
- CoreProductFallback join table exists and old fallbackBundleAddonId column is removed
- Existing fallback data migrated to join table
- resolveBundleRequirement checks ALL fallback addons (any match = pass)
- Product API accepts fallbackAddonIds as an array on POST/PATCH
- Dashboard UI allows multi-select via checkboxes
- State coverage indicator reflects all fallback addon states combined
</success_criteria>

<output>
After completion, create `.planning/quick/260326-lsx-add-fallback-products-for-core-bundle-re/260326-lsx-SUMMARY.md`
</output>
