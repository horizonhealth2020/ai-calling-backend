# Phase 36: Fix Manager Sales Entry Parsing Error and Payroll UI Issues - Research

**Researched:** 2026-03-31
**Domain:** Receipt parsing, payroll UI sorting, flat-commission product type
**Confidence:** HIGH

## Summary

This phase addresses three distinct fixes in the existing codebase: (1) a regex bug in `matchProduct()` where word-boundary anchors (`\b`) fail on product names containing `$` and `,` characters like "American Financial - Critical Illness $5,000", (2) unstable row ordering in payroll agent pay cards that reorder when amounts change because entries sort by gross premium descending, and (3) a new ACA PL product type that pays flat dollar commission per member count rather than percentage-based commission.

The codebase is well-structured with clear separation: receipt parsing and product matching live in `ManagerEntry.tsx`, payroll display in `PayrollPeriods.tsx`, commission calculation in `apps/ops-api/src/services/payroll.ts`, and the data model in `prisma/schema.prisma`. All three fixes touch different subsystems with minimal overlap, making them safe to implement in parallel.

**Primary recommendation:** Fix the regex bug first (smallest change, highest user impact), then the sort fix (pure UI, no schema change), then ACA PL (requires schema migration + API + UI changes).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** The `matchProduct()` function in `ManagerEntry.tsx` fails when product names contain `$` and `,` characters. The regex word-boundary matching breaks on these special characters. Fix the matching logic to handle dollar amounts in product names.
- **D-02:** DB product names match receipt names exactly: "American Financial - Critical Illness $5,000", "American Financial - Critical Illness $10,000", etc. All are type `AD_D`.
- **D-03:** The parser correctly strips "- Add-on" from the parsed name. The issue is solely in `matchProduct()` failing to match the cleaned name against the DB product name due to special character handling.
- **D-04:** No other known receipt parsing failures -- scope fix to dollar-amount/special-character handling in `matchProduct()`.
- **D-05:** Within agent pay cards in `PayrollPeriods.tsx`, sort entries by member ID ascending (lowest to highest) instead of current gross premium descending.
- **D-06:** Entries without a member ID sort to the top of the list (before ID-sorted entries).
- **D-07:** Sort change applies only to agent pay cards -- CSV exports and other views keep their existing sort order.
- **D-08:** ACA PL is a new product category that pays a flat dollar amount per member on the plan (not percentage-based). Multiple members can be on one plan, so commission = flatAmount * memberCount.
- **D-09:** Add a `flatCommission` field to the Product model to store the per-member flat amount. This is the default, but allow override per sale if needed.
- **D-10:** ACA is a category with multiple insurance carriers underneath -- the carrier name must be enterable per sale.
- **D-11:** Two entry modes for ACA: (a) Add to existing sale via checkbox with carrier + member count fields, (b) Standalone ACA entry with minimal form: agent, member name, carrier, member count.
- **D-12:** ACA PL entries do NOT count toward agent sales counts and do NOT appear on the sales board.
- **D-13:** When ACA PL is the core product on a sale with addons, it auto-fulfills the bundle requirement -- addons earn full commission (no halving for missing required addon).

### Claude's Discretion
- How to display ACA entries in payroll agent pay cards (same card vs separate section)
- Exact UI layout of the ACA checkbox and carrier/member-count fields on the sale entry form
- Whether ACA standalone entry is a separate form section or a mode toggle on the existing form
- Database migration approach for `flatCommission` field and `memberCount` on sale/payroll entry
- How to exclude ACA from sales board queries and agent sales counts (filter by product type or flag)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Architecture Patterns

### Fix 1: matchProduct() Regex Bug

**Root cause analysis (HIGH confidence):**

The `matchProduct()` function at `ManagerEntry.tsx:211-232` uses `\b` (word boundary) anchors in regex matching. The `\b` anchor in JavaScript regex sits between a word character (`\w` = `[a-zA-Z0-9_]`) and a non-word character. The `$` in "$5,000" is a non-word character, and so is `,`. This means:

- Product name: `"american financial - critical illness $5,000"`
- After escaping special chars: `"american financial \\- critical illness \\$5\\,000"`
- The `\b` before `a` works fine (start of string boundary)
- The `\b` after `0` (end: `000\b`) works because `0` is a word char and string ends
- BUT: the escaped `$` creates `\$` which matches literal `$`. The `\b` before `\$` expects a transition from word to non-word. Since ` ` (space) before `$` is already non-word, and `$` is non-word, there is no word boundary there.

The real issue: `\b` anchors at string start/end fail when the product name starts or ends with non-word characters. The `\b...\b` pattern can fail to match even when the full string IS an exact substring.

**Fix pattern:**
Replace `\b` word-boundary anchors with explicit start/end-of-string or whitespace-aware boundaries. Since `matchProduct` is doing containment checks (is product name A found within parsed name B, or vice versa), the simplest reliable approach is:

```typescript
function matchProduct(name: string, products: Product[]): Product | undefined {
  const lower = name.toLowerCase().trim();
  // 1. Exact match (already works)
  const exact = products.find(p => p.name.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Containment match: one string contains the other
  //    Use includes() instead of regex \b to avoid special-character issues
  const contains = products.filter(p => {
    const pn = p.name.toLowerCase();
    return pn.includes(lower) || lower.includes(pn);
  });
  if (contains.length > 0) return contains.sort((a, b) => b.name.length - a.name.length)[0];

  return undefined;
}
```

However, the original code used word boundaries to prevent short names (e.g., "AME") from matching inside longer words (e.g., "AmeriCare"). A safer approach is to replace `\b` with a boundary that tolerates special characters:

```typescript
// Use (?:^|[\s,;|(])  and  (?:$|[\s,;|)])  instead of \b
// Or simpler: use includes() but require a minimum match length ratio
const containsWithGuard = products.filter(p => {
  const pn = p.name.toLowerCase();
  // Only match if the shorter string is at least 60% the length of the longer
  const ratio = Math.min(pn.length, lower.length) / Math.max(pn.length, lower.length);
  return ratio > 0.5 && (pn.includes(lower) || lower.includes(pn));
});
```

**Recommendation:** Use `includes()` with length-ratio guard instead of regex word boundaries. This handles `$`, `,`, and any other special characters without regex escaping issues.

### Fix 2: Payroll Entry Sort Order

**Current behavior (verified from code):**

At `PayrollPeriods.tsx:1470-1474`, entries are grouped into a `Map<string, Entry[]>` per agent. The insertion order comes from the API response (no explicit sort). At line 1574, `visibleEntries` is just `entries.slice(0, COLLAPSED_LIMIT)` -- no sort applied within the card.

The CONTEXT.md says the sort at line 1676-1681 needs to change, but that code sorts **agent cards** by gross premium descending, not entries within cards. The actual fix needs to sort entries **within** each agent's array before or inside `AgentPayCard`.

**Fix location:** Either:
1. Sort entries in the `byAgent` Map population (lines 1470-1474) -- sort each agent's array after building
2. Sort `entries` at the top of `AgentPayCard` component (line 567 area)

**Recommended approach:** Sort inside `AgentPayCard` at the point where `visibleEntries` is computed, so the sort is co-located with the display:

```typescript
// Inside AgentPayCard, after line 567
const sortedEntries = [...entries].sort((a, b) => {
  const aId = a.sale?.memberId;
  const bId = b.sale?.memberId;
  // Entries without member ID sort to top
  if (!aId && !bId) return 0;
  if (!aId) return -1;
  if (!bId) return 1;
  // Numeric sort by member ID
  return Number(aId) - Number(bId);
});
const visibleEntries = showAllEntries ? sortedEntries : sortedEntries.slice(0, COLLAPSED_LIMIT);
```

The `SaleInfo` type (line 17-23) already has `memberId?: string`, and entries have `sale?.memberId` available (confirmed at line 183, 256).

### Fix 3: ACA PL Product Type -- Schema Changes

**New ProductType enum value:**

Add `ACA_PL` to the `ProductType` enum in `prisma/schema.prisma:53-57`:
```prisma
enum ProductType {
  CORE
  ADDON
  AD_D
  ACA_PL
}
```

**New fields on Product model:**
```prisma
flatCommission   Decimal?    @map("flat_commission") @db.Decimal(12, 2)
```

**New fields on Sale model:**
```prisma
memberCount      Int?        @map("member_count")
acaCarrier       String?     @map("aca_carrier")
parentSaleId     String?     @map("parent_sale_id")
```

Wait -- reviewing D-11 more carefully: "Add to existing sale" means the ACA entry ties to the same sale. This could mean:
- Option A: ACA is added as a SaleAddon on the existing sale
- Option B: ACA is a separate Sale record linked to the parent sale

Given D-08 says commission = flatAmount * memberCount, and this is fundamentally different from addon commission (percentage-based), **Option B is cleaner**: create a separate Sale record with `productType=ACA_PL` that can optionally reference a parent sale. The `memberCount` lives on this Sale.

**Recommended schema additions:**

On **Sale** model:
```prisma
memberCount      Int?        @map("member_count")
```

On **Product** model:
```prisma
flatCommission   Decimal?    @map("flat_commission") @db.Decimal(12, 2)
```

The `carrier` field already exists on Sale, so ACA carrier can use the existing field.

For the "add to existing sale" mode, the ACA sale just needs to know which sale it's providing bundle coverage for. Add:
```prisma
// On Sale model
acaCoveringSaleId  String?  @map("aca_covering_sale_id")
```

This lets the bundle logic check: "does this sale have an ACA_PL sale covering it?" to auto-fulfill bundle requirements (D-13).

### Fix 3: ACA PL -- Commission Engine Changes

**Current commission engine** (`payroll.ts:103-198`) is entirely percentage-based. The flat commission path needs to be added:

```typescript
// In calculateCommission, before the existing hasCoreInSale logic:
if (sale.product.type === "ACA_PL") {
  const flatAmount = Number(sale.product.flatCommission ?? 0);
  const count = sale.memberCount ?? 1;
  return { commission: Math.round(flatAmount * count * 100) / 100, halvingReason: null };
}
```

**Bundle auto-fulfillment (D-13):** When a sale has an ACA_PL product covering it, the bundle requirement check should treat it as fulfilled. In `upsertPayrollEntryForSale`, before calling `resolveBundleRequirement`, check if an ACA_PL sale covers this sale.

### Fix 3: ACA PL -- Sales Board Exclusion

The sales board query at `apps/ops-api/src/routes/sales.ts:779-782` currently fetches all RAN sales for the week. To exclude ACA:

```typescript
const sales = await prisma.sale.findMany({
  where: {
    status: 'RAN',
    saleDate: { gte: monday, lt: sunday },
    product: { type: { not: 'ACA_PL' } },  // Exclude ACA from board
  },
  select: { agentId: true, saleDate: true, premium: true, addons: { select: { premium: true } } },
});
```

For agent sales counts (D-12), the same filter applies wherever counts are aggregated.

### Fix 3: ACA PL -- UI Entry Modes

**Mode 1: ACA checkbox on existing sale form**

In `ManagerEntry.tsx`, add to the form state:
```typescript
includeAca: false,
acaCarrier: "",
acaMemberCount: "1",
```

When `includeAca` is checked, show carrier dropdown/input and member count field. On submit, create the regular sale FIRST, then create a second ACA_PL sale linked via `acaCoveringSaleId`.

**Mode 2: Standalone ACA entry**

A separate section or toggle that shows a minimal form: agent, member name, carrier, member count. No premium, no lead source, no enrollment fee. The API needs to handle ACA_PL sales with relaxed validation (no premium required, no effectiveDate required, etc.).

**Recommendation for discretionary items:**
- Display ACA entries in the **same agent pay card** but with a visual indicator (e.g., "ACA" badge) -- keeps payroll view unified
- ACA checkbox: right-aligned toggle in the form, conditionally showing carrier + member count inline fields
- Standalone ACA: separate collapsible section below the main entry form, with a clear "ACA-Only Entry" header
- Migration: single migration adding `flatCommission` to Product, `memberCount` to Sale, `ACA_PL` to ProductType enum
- Exclusion: filter by `product.type !== 'ACA_PL'` in sales board queries and count aggregations

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Regex special char escaping | Custom escape function | `String.includes()` with length guard | Regex word boundaries are fundamentally broken for non-word chars like `$` |
| Commission branching | Separate commission functions | Single `calculateCommission` with type check at top | Keeps one entry point for all commission logic |
| Prisma enum migration | Manual SQL ALTER TYPE | `prisma migrate dev` | Prisma handles PostgreSQL enum extension correctly |

## Common Pitfalls

### Pitfall 1: Prisma Enum Migration on PostgreSQL
**What goes wrong:** Adding a value to a PostgreSQL enum requires `ALTER TYPE ... ADD VALUE` which cannot run inside a transaction. Prisma handles this automatically in migrations but can fail if you try to manually wrap it.
**How to avoid:** Let `prisma migrate dev` generate the migration. Do NOT manually edit the migration SQL unless absolutely necessary. If using `prisma migrate deploy` in production, ensure the migration runs outside a transaction block.

### Pitfall 2: Word Boundary Regex on Special Characters
**What goes wrong:** `\b` in JavaScript regex only detects transitions between `\w` ([a-zA-Z0-9_]) and `\W`. Characters like `$`, `,`, `-`, `.` are all `\W`, so `\b` between two `\W` characters (e.g., space and `$`) does not fire.
**How to avoid:** Use `String.includes()` or `String.indexOf()` for substring containment checks involving product names with special characters.

### Pitfall 3: Sort Stability with Undefined Member IDs
**What goes wrong:** If `memberId` is undefined/null for some entries and the sort comparator doesn't handle it consistently, entries jump around on re-render.
**How to avoid:** Always handle the null/undefined case first in the comparator. Use a deterministic tiebreaker (e.g., entry ID) when member IDs are equal or both missing.

### Pitfall 4: ACA Sale Validation Differs from Regular Sales
**What goes wrong:** The existing POST /sales Zod schema requires `premium`, `effectiveDate`, `leadSourceId`, `productId`. ACA standalone entries need none of these (only agent, memberName, carrier, memberCount).
**How to avoid:** Either create a separate API endpoint (POST /sales/aca) or make the existing schema conditional based on a `type` field. Separate endpoint is cleaner -- avoids complex conditional validation.

### Pitfall 5: Socket.IO Emission for ACA Sales
**What goes wrong:** The `emitSaleChanged` event after sale creation broadcasts to all dashboards including the sales board. If ACA sales trigger this, the sales board will briefly show them before filtering.
**How to avoid:** Include product type in the socket event payload so the sales board client can filter, OR skip emission for ACA_PL sales to the sales board channel.

## Code Examples

### matchProduct Fix
```typescript
// Source: ManagerEntry.tsx:211-232 (current buggy code)
// Current: uses \b word boundaries that break on $ and ,
// Fix: replace with includes() + length ratio guard

function matchProduct(name: string, products: Product[]): Product | undefined {
  const lower = name.toLowerCase().trim();
  // 1. Exact match
  const exact = products.find(p => p.name.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Containment with length guard (prevents "AME" matching "AmeriCare")
  const subs = products.filter(p => {
    const pn = p.name.toLowerCase();
    const shorter = Math.min(pn.length, lower.length);
    const longer = Math.max(pn.length, lower.length);
    return shorter / longer > 0.5 && (pn.includes(lower) || lower.includes(pn));
  });
  if (subs.length > 0) return subs.sort((a, b) => b.name.length - a.name.length)[0];

  return undefined;
}
```

### Entry Sort Within Agent Pay Card
```typescript
// Source: PayrollPeriods.tsx AgentPayCard component
// Sort entries by member ID ascending, nulls first

const sortedEntries = useMemo(() => {
  return [...entries].sort((a, b) => {
    const aId = a.sale?.memberId;
    const bId = b.sale?.memberId;
    if (!aId && !bId) return 0;
    if (!aId) return -1;
    if (!bId) return 1;
    const aNum = parseInt(aId, 10);
    const bNum = parseInt(bId, 10);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return aId.localeCompare(bId);
  });
}, [entries]);
```

### Flat Commission Calculation
```typescript
// Source: payroll.ts calculateCommission
// Add at the top of calculateCommission, before existing logic

if (sale.product.type === "ACA_PL") {
  const flatAmount = Number(sale.product.flatCommission ?? 0);
  const count = sale.memberCount ?? 1;
  return {
    commission: Math.round(flatAmount * count * 100) / 100,
    halvingReason: null,
  };
}
```

### Sales Board Exclusion
```typescript
// Source: apps/ops-api/src/routes/sales.ts:779
// Add product type filter to exclude ACA_PL

const sales = await prisma.sale.findMany({
  where: {
    status: 'RAN',
    saleDate: { gte: monday, lt: sunday },
    product: { type: { not: 'ACA_PL' } },
  },
  select: { agentId: true, saleDate: true, premium: true, addons: { select: { premium: true } } },
});
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (Morgan service only) |
| Config file | `apps/morgan/jest.config.js` |
| Quick run command | `npm test -- helpers.test.js` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map

Note: Tests exist only for Morgan service. The ops-api and ops-dashboard have no test infrastructure. All verification for this phase is manual or through the existing app UI.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | matchProduct handles $ and , in product names | manual-only | N/A -- frontend component, no test infra | N/A |
| D-05 | Payroll entries sort by member ID asc within cards | manual-only | N/A -- React component, no test infra | N/A |
| D-06 | Entries without member ID sort to top | manual-only | N/A -- React component, no test infra | N/A |
| D-08 | ACA PL flat commission = flatAmount * memberCount | manual-only | N/A -- could unit test calculateCommission but no jest config for ops-api | N/A |
| D-09 | flatCommission field on Product model | manual-only | `npm run db:migrate` succeeds | N/A |
| D-12 | ACA excluded from sales board | manual-only | N/A -- API route, no test infra | N/A |
| D-13 | ACA auto-fulfills bundle requirement | manual-only | N/A -- payroll service, no test infra | N/A |

### Sampling Rate
- **Per task commit:** Manual verification via running app (`npm run ops:dev` + `npm run dashboard:dev`)
- **Per wave merge:** Full manual walkthrough of all three fixes
- **Phase gate:** Verify receipt parsing, payroll sort, ACA entry/commission/exclusion

### Wave 0 Gaps
None -- no test infrastructure exists for ops-api or ops-dashboard. Adding test infra is out of scope for this phase.

## Open Questions

1. **ACA Sale Schema: Separate endpoint or shared?**
   - What we know: Existing POST /sales requires fields ACA doesn't need (premium, effectiveDate, leadSourceId)
   - What's unclear: Whether to extend the existing endpoint with conditional validation or create POST /sales/aca
   - Recommendation: Create separate POST /sales/aca endpoint -- cleaner validation, easier to maintain

2. **ACA "Add to existing sale" linking mechanism**
   - What we know: D-11 says ACA ties to the same sale and fulfills bundle requirements
   - What's unclear: Whether this should be a foreign key (`acaCoveringSaleId`) on the parent sale, or the ACA sale points to the parent
   - Recommendation: ACA sale has `acaCoveringSaleId` pointing to the parent sale it covers. The bundle check queries for covering ACA sales.

3. **Member count on PayrollEntry or only on Sale?**
   - What we know: Commission = flatAmount * memberCount, stored per sale
   - What's unclear: Whether payroll entry needs to store memberCount separately (for display in pay cards)
   - Recommendation: Store `memberCount` on Sale only. The payroll entry's `payoutAmount` already reflects the calculated commission. Display can join to Sale for the count.

## Sources

### Primary (HIGH confidence)
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:211-232` -- matchProduct() source code with regex bug
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:1470-1474, 528-574` -- entry grouping and AgentPayCard display
- `apps/ops-api/src/services/payroll.ts:103-198` -- calculateCommission engine
- `apps/ops-api/src/routes/sales.ts:13-132, 779-782` -- sale creation and sales board query
- `prisma/schema.prisma:53-57, 128-162, 189-233, 299-322` -- ProductType enum, Product/Sale/PayrollEntry models

### Secondary (MEDIUM confidence)
- JavaScript `\b` regex behavior with special characters -- verified against MDN RegExp documentation behavior

## Metadata

**Confidence breakdown:**
- matchProduct fix: HIGH -- root cause verified in source code, regex behavior well-understood
- Payroll sort fix: HIGH -- code path traced, fix is straightforward
- ACA PL product type: MEDIUM -- schema design involves architectural choices with tradeoffs, multiple valid approaches

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable codebase, no external dependency changes)
