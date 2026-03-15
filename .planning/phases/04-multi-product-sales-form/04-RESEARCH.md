# Phase 4: Multi-Product Sales Form - Research

**Researched:** 2026-03-15
**Domain:** React form UX, field reordering, dropdown defaults, product type filtering
**Confidence:** HIGH

## Summary

Phase 4 is a frontend-focused phase with one backend fix. The manager dashboard sales form (`apps/manager-dashboard/app/page.tsx`) needs field reordering, blank default selections for Product and Lead Source dropdowns, carrier made optional, and addon picker filtering/sorting by product type. All multi-product infrastructure (addon checkboxes, addon premiums, payment type selector) already exists and works. The only backend change is making `carrier` optional in the POST /sales Zod schema.

The form is a single 1946-line file with inline React.CSSProperties. All changes are surgical edits to existing code -- no new components, no new API endpoints, no new state management. The risk is low because the form already handles multi-product sales; this phase improves the UX of that existing flow.

**Primary recommendation:** Make all changes in `apps/manager-dashboard/app/page.tsx` (field order, defaults, filtering) plus one line change in `apps/ops-api/src/routes/index.ts` (carrier optional). No new files needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Keep the flat 2-column grid layout (left: form fields, right: receipt parser + addon picker)
- No collapsible sections or tabs -- all fields visible at once, scroll if needed
- Core Product dropdown stays in left column; addon checkboxes stay in right column
- Field order reordered to: Agent|MemberName, MemberID|MemberState, SaleDate|EffectiveDate, Product|LeadSource, Carrier|Status, Premium|EnrollmentFee, Notes|(empty), PaymentType(full), Submit(full)
- Product dropdown: Start blank with "Select product..." placeholder
- Lead Source dropdown: Start blank with "Select lead source..." placeholder
- Carrier field: NOT required (remove `required` attribute)
- Addon picker: Only show ADDON and AD_D type products, sort ADDON first then AD_D, alphabetical within each
- Payment type: Keep CC and ACH only -- do NOT add Check/Other
- No enrollment fee threshold display -- Phase 5 commission preview will cover
- No product type badges or commission rate hints on the form

### Claude's Discretion
- Whether to add form validation for blank product/lead source (prevent submit without selection vs allow)
- Stagger animation class assignments for reordered fields
- Any minor styling adjustments needed for the new field order

### Deferred Ideas (OUT OF SCOPE)
- Check and Other payment types -- deferred again, not currently used by business
- Enrollment fee threshold display -- Phase 5 commission preview will cover this
- Product type badges on form -- Phase 5 or Phase 9
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SALE-02 | User can select multiple products per sale from products created in payroll | Already implemented via addon picker checkboxes (line 1115-1172). Phase 4 adds type filtering (ADDON/AD_D only) and sort order. Product dropdown needs blank default + CORE-only filter. |
| SALE-03 | User can select payment type (ACH/Check/Other) per sale | Already implemented as CC/ACH radio buttons (line 962-1004). User decision: keep CC/ACH only, no Check/Other. No changes needed. |
| SALE-04 | User can enter enrollment fee with product threshold displayed | Enrollment fee input already exists (line 949-952). User decision: no threshold display -- Phase 5 commission preview covers this. No changes needed. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x (Next.js 15) | UI components | Already in use, single-file form component |
| Next.js | 15 | App framework | Already in use for manager-dashboard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.x | API request validation | Backend carrier schema change |
| @ops/ui | local | PageShell, Badge, colors, spacing, radius | Existing design tokens |
| lucide-react | latest | Icons | Already imported |

### Alternatives Considered
None -- this phase uses only existing dependencies. No new libraries needed.

## Architecture Patterns

### Current Form Architecture (no changes to structure)
```
apps/manager-dashboard/app/page.tsx (1946 lines, single file)
  |- blankForm() returns initial state (line 632)
  |- useEffect sets initial dropdown values (line 665-678)
  |- submitSale() sends POST /api/sales (line 735)
  |- Left column: 2-col CSS grid with form fields (line 888-1024)
  |- Right column: Receipt parser + addon picker (line 1028-1172)
```

### Pattern 1: Blank Default Dropdowns
**What:** Product and Lead Source dropdowns must start with empty selection
**When to use:** This exact pattern already exists for the Agent dropdown
**Example:**
```typescript
// EXISTING pattern at line 896-897 (Agent dropdown):
<option value="" disabled>Select agent...</option>

// APPLY same pattern to Product dropdown (line 937-939):
// BEFORE:
{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
// AFTER:
<option value="" disabled>Select product...</option>
{products.filter(p => p.active !== false && p.type === "CORE").map(p => (
  <option key={p.id} value={p.id}>{p.name}</option>
))}

// APPLY same pattern to Lead Source dropdown (line 943-947):
// BEFORE: no blank option
// AFTER: add <option value="" disabled>Select lead source...</option>
```

### Pattern 2: Remove Auto-Selection in useEffect
**What:** Line 675 auto-selects first product and first lead source
**Current code:**
```typescript
setForm(f => ({ ...f, agentId: "", productId: p[0]?.id ?? "", leadSourceId: ls[0]?.id ?? "" }));
```
**Fix:** Change to keep both blank:
```typescript
setForm(f => ({ ...f, agentId: "", productId: "", leadSourceId: "" }));
```

### Pattern 3: Addon Picker Type Filtering and Sorting
**What:** Filter addon list to ADDON/AD_D types only, sort ADDON first then AD_D
**Current code (line 1117):**
```typescript
const addonProducts = products.filter(p => p.active && (p.type === "ADDON" || p.type === "AD_D") && p.id !== form.productId);
```
**Fix:** Already filters correctly for type. Add sort:
```typescript
const addonProducts = products
  .filter(p => p.active && (p.type === "ADDON" || p.type === "AD_D") && p.id !== form.productId)
  .sort((a, b) => {
    if (a.type !== b.type) return a.type === "ADDON" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
```

### Pattern 4: Field Reordering via JSX Order
**What:** Rearrange the `<div>` elements in the left column grid to match the new field order
**Current order (lines 889-960):** Agent, MemberName, MemberID, SaleDate, Status, Carrier, Premium, EffectiveDate, Product, LeadSource, EnrollmentFee, Notes, MemberState
**New order:** Agent, MemberName, MemberID, MemberState, SaleDate, EffectiveDate, Product, LeadSource, Carrier, Status, Premium, EnrollmentFee, Notes
**Method:** Cut and paste `<div>` blocks within the grid. Update stagger-N classes sequentially.

### Anti-Patterns to Avoid
- **Breaking the receipt parser integration:** The `handleParse()` function auto-fills `productId`, `addonProductIds`, `enrollmentFee`, `paymentType`. Do NOT change how these fields are set -- only change display order and defaults.
- **Hardcoding product IDs:** Always filter by `p.type === "CORE"` not by specific product names.
- **Removing the paymentType validation:** The submit button correctly disables when `!form.paymentType`. Keep this behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown blank state | Custom placeholder component | `<option value="" disabled>` | Native HTML pattern, already used for Agent dropdown |
| Product type sorting | Custom sort with numeric weights | `localeCompare` + type comparison | Two groups only, simple comparison works |

## Common Pitfalls

### Pitfall 1: Backend Carrier Validation Mismatch
**What goes wrong:** Frontend removes `required` from carrier, but backend still requires `carrier: z.string()` which rejects empty strings
**Why it happens:** Backend Zod schema at line 285 has `carrier: z.string()` with no `.optional()` -- empty string `""` passes `z.string()` but semantically the field is empty
**How to avoid:** Change backend schema to `carrier: z.string().optional()` AND send `carrier: form.carrier || undefined` from frontend (same pattern as `memberState` on line 750)
**Warning signs:** 400 errors when submitting with blank carrier

### Pitfall 2: Product Dropdown Allows Submit Without Selection
**What goes wrong:** User submits form with blank productId, API returns 400
**Why it happens:** Product dropdown starts blank but no validation prevents submit
**How to avoid:** Either add `required` to the select element OR add form-level validation before submit. Recommend: add `required` to the select (matches existing Agent pattern where submit fails without selection, but Agent is not marked required either -- the API enforces it)
**Warning signs:** 400 errors mentioning productId

### Pitfall 3: clearReceipt() Resets to First Product
**What goes wrong:** After clearing receipt, form resets `productId` back to first product
**Why it happens:** `clearReceipt()` at line 732 spreads `blankForm()` which has `productId: ""`, BUT could be overridden if there's additional logic
**How to avoid:** Verify `clearReceipt()` preserves the blank default. Current code at line 732 looks correct -- it spreads `blankForm()` but keeps `agentId`, `productId`, `leadSourceId` from current form. Since we want blank, we should NOT keep `productId` and `leadSourceId` from current form in the clear case.
**Warning signs:** Product dropdown snaps back to a selection after clearing receipt

### Pitfall 4: Stagger Animation Classes Go Out of Range
**What goes wrong:** CSS animations for `stagger-N` may not have styles defined for high N values
**Why it happens:** Moving 13+ fields in the grid, some stagger classes may not exist in the CSS
**How to avoid:** Check what stagger classes exist in `@ops/ui` or the global CSS. Cap stagger values at the maximum defined class.
**Warning signs:** Fields appear without entrance animation

## Code Examples

### Change 1: Remove Auto-Selection (line 675)
```typescript
// Source: apps/manager-dashboard/app/page.tsx line 675
// BEFORE:
setForm(f => ({ ...f, agentId: "", productId: p[0]?.id ?? "", leadSourceId: ls[0]?.id ?? "" }));
// AFTER:
setForm(f => ({ ...f, agentId: "", productId: "", leadSourceId: "" }));
```

### Change 2: Product Dropdown - CORE Only + Blank Default (line 935-939)
```typescript
// Source: apps/manager-dashboard/app/page.tsx lines 935-939
// BEFORE:
<select className="input-focus" style={{ ...INP }} value={form.productId}
  onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>
  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
</select>
// AFTER:
<select className="input-focus" style={{ ...INP }} value={form.productId} required
  onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>
  <option value="" disabled>Select product...</option>
  {products.filter(p => p.active !== false && p.type === "CORE").map(p => (
    <option key={p.id} value={p.id}>{p.name}</option>
  ))}
</select>
```

### Change 3: Lead Source Dropdown - Blank Default (line 941-947)
```typescript
// Source: apps/manager-dashboard/app/page.tsx lines 941-947
// Add before the map:
<option value="" disabled>Select lead source...</option>
```

### Change 4: Carrier Optional (line 925)
```typescript
// Source: apps/manager-dashboard/app/page.tsx line 925
// BEFORE:
<input className="input-focus" style={INP} value={form.carrier} required onChange={...} />
// AFTER:
<input className="input-focus" style={INP} value={form.carrier} placeholder="Optional" onChange={...} />
```

### Change 5: Backend Carrier Optional (routes/index.ts line 285)
```typescript
// Source: apps/ops-api/src/routes/index.ts line 285
// BEFORE:
carrier: z.string(),
// AFTER:
carrier: z.string().optional().default(""),
```

### Change 6: Frontend Send Carrier as Undefined When Empty (submitSale)
```typescript
// Source: apps/manager-dashboard/app/page.tsx line ~745
// In the JSON.stringify body, change carrier handling:
carrier: form.carrier || undefined,
```

### Change 7: Addon Sort Order (line 1117)
```typescript
// Source: apps/manager-dashboard/app/page.tsx line 1117
const addonProducts = products
  .filter(p => p.active && (p.type === "ADDON" || p.type === "AD_D") && p.id !== form.productId)
  .sort((a, b) => {
    if (a.type !== b.type) return a.type === "ADDON" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
```

## State of the Art

No technology changes relevant to this phase. All work uses existing React patterns and Zod validation already in the codebase.

## Open Questions

1. **Stagger animation class range**
   - What we know: Classes like `stagger-1` through `stagger-11` are used. Some fields use no stagger class at all (Notes, MemberState at lines 953-959).
   - What's unclear: Maximum stagger class defined in CSS
   - Recommendation: Keep stagger values 1-11, assign sequentially to reordered fields. If a field currently has no stagger, give it one.

2. **Form validation on blank product/lead source (Claude's discretion)**
   - What we know: API requires productId (z.string()), so blank will fail with 400
   - Recommendation: Add `required` to both select elements. This gives native browser validation (tooltip "Please select an item") matching the existing pattern where memberName and premium are required. The API is the backstop either way.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root Morgan service only) + ops-api Jest |
| Config file | `jest.config.js` (root), `apps/ops-api/jest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SALE-02 | Product dropdown shows CORE only, addon picker shows ADDON/AD_D | manual-only | Visual inspection in browser | N/A -- React component, no unit test infra for Next.js apps |
| SALE-03 | Payment type CC/ACH selection | manual-only | Already works, no changes this phase | N/A |
| SALE-04 | Enrollment fee input exists | manual-only | Already works, no changes this phase | N/A |

**Manual-only justification:** All three requirements are frontend UI changes in a Next.js app with no existing component test infrastructure. The manager-dashboard has no test framework configured. Adding React Testing Library / Vitest for 3 surgical JSX edits would be disproportionate overhead. Backend carrier change can be validated via existing ops-api test infra if desired.

### Sampling Rate
- **Per task commit:** Visual inspection -- load manager dashboard, verify form renders correctly
- **Per wave merge:** Submit a test sale with: blank carrier, selected product, selected lead source, addon products checked
- **Phase gate:** Full manual walkthrough of sales entry flow

### Wave 0 Gaps
None -- no test infrastructure changes needed. This phase is frontend-only UI rearrangement with one backend schema tweak. The existing ops-api Jest config can test the carrier schema change if a test is added, but it is not required given the simplicity.

## Sources

### Primary (HIGH confidence)
- `apps/manager-dashboard/app/page.tsx` -- direct code inspection of form structure, state, submit logic
- `apps/ops-api/src/routes/index.ts` -- direct code inspection of POST /sales Zod schema
- `04-CONTEXT.md` -- user decisions from discussion phase

### Secondary (MEDIUM confidence)
- None needed -- all findings are from direct code inspection

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing code
- Architecture: HIGH - direct code inspection, surgical edits to identified lines
- Pitfalls: HIGH - carrier backend mismatch identified through code inspection, all others from direct observation

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable -- no external dependency changes)
