# Phase 44: Chargeback Batch Review - Research

**Researched:** 2026-04-06
**Domain:** Chargeback preview/review workflow -- Express API + React dashboard
**Confidence:** HIGH

## Summary

This phase adds a review step between paste/parse and submission in the existing CSSubmissions component. The core work is: (1) a new `POST /api/chargebacks/preview` API endpoint that matches parsed chargeback records to sales by memberId and returns match details with product information, and (2) a review table UI that displays match status, allows product selection for partial chargebacks, inline editing, row removal with undo, and batch submission.

The existing codebase already has all foundational pieces: the chargeback parser, the matching logic (memberId lookup in chargebacks.ts lines 68-97), the submission endpoint, the Badge component, ToastProvider/useToast, and the inline-editable table pattern. The phase is primarily a feature composition exercise using existing patterns, not greenfield development.

**Primary recommendation:** Build the preview endpoint by extracting matching logic from the existing POST /chargebacks handler into a shared function, then add the review table as a new state step in CSSubmissions.tsx between parse and submit.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** New `POST /api/chargebacks/preview` endpoint that receives parsed records, runs the same memberId matching logic as the existing submit endpoint, and returns match status + matched sale details (agent name, products with id/name/type/premium, member info, chargeback amount) without creating any database records.
- **D-02:** Frontend calls the preview endpoint after paste/parse completes. The review table is populated from the preview response, not from the raw parsed data alone.
- **D-03:** For MULTIPLE match status (several sales match one memberId), the review table shows all candidate sales. User selects which sale the chargeback applies to, promoting the entry to MATCHED status in the review state.
- **D-04:** All-visible flat rows -- every field visible in a wide table row with no expansion/collapse. Products shown inline. Horizontal scrolling if needed for many columns.
- **D-05:** Each row displays: match status badge (MATCHED green / MULTIPLE yellow / UNMATCHED red), member name, member ID, agent name, chargeback amount, product checkboxes, rep assignment dropdown, and remove button.
- **D-06:** Validation summary bar above the review table shows colored count badges (X Matched, Y Multiple, Z Unmatched) plus total chargeback dollar amount. Clicking a badge filters the table to show only entries with that status.
- **D-07:** For matched entries, sale products appear as inline checkboxes directly in the flat row. Each checkbox shows product name + premium amount.
- **D-08:** Toggling a product checkbox auto-recalculates the row's chargeback amount to reflect only the selected products' premiums. User can still manually override the amount field after auto-calculation.
- **D-09:** Amount, rep assignment (dropdown), and product checkboxes are always interactive -- no click-to-edit toggle. Matches the existing CSSubmissions pattern where fields are directly editable in the table.
- **D-10:** X button removes the row instantly. A toast notification appears with an "Undo" option for a few seconds. No confirmation modal.

### Claude's Discretion
- Exact column widths and table responsive behavior
- Loading/spinner state while preview API is processing
- How MULTIPLE match candidate sales are visually presented (dropdown, inline list, etc.)
- Toast duration and animation for undo on row removal
- Whether summary bar filter is toggle (click again to clear) or radio-style

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CB-01 | User can paste multiple chargebacks and parse all entries at once | Existing `parseChargebackText()` function handles this; keep current paste/parse flow |
| CB-02 | User sees a review table of all parsed entries before submitting | New review table state between parse and submit; populated from preview API response |
| CB-03 | Each review row shows matched agent name, member name, member ID, and match status | Preview API returns Sale with agent relation; match status badges use existing CSTracking color pattern |
| CB-04 | Each matched review row shows sale products with checkboxes for partial chargeback selection | Preview API includes Sale products (via product + addons relations); checkboxes with product name + premium |
| CB-05 | User can edit amount, rep assignment, and product selection per entry | Always-interactive fields per D-09; existing updateRecord pattern from CSSubmissions |
| CB-06 | User can remove individual entries from the batch before submitting | X button with undo toast per D-10; useToast already available |
| CB-07 | Validation summary bar shows counts by match status above the review table | Badge component from @ops/ui; filter-on-click behavior per D-06 |
| CB-08 | CS reps are auto-assigned via round-robin in the review table | Existing `fetchBatchAssign()` function; call after preview response |
| CB-09 | User submits entire reviewed batch with a single "Submit Batch" action | Modified submit sends user-reviewed data to existing POST /chargebacks endpoint |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | existing | Preview API endpoint | Already used for all ops-api routes |
| React | existing (Next.js 15) | Review table UI | Already used for ops-dashboard |
| Prisma | existing | Sale/Product lookup for preview | Already configured with all needed models |
| Zod | existing | Request validation for preview endpoint | All API routes use Zod + zodErr() |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/ui (Badge) | existing | Match status badges, summary bar badges | For MATCHED/MULTIPLE/UNMATCHED display |
| @ops/ui (ToastProvider/useToast) | existing | Undo toast on row removal | Already imported in CSSubmissions |
| @ops/auth/client (authFetch) | existing | Preview API call | All frontend API calls use authFetch |
| lucide-react (X) | existing | Row remove button | Already imported in CSSubmissions |
| socket.io (emitCSChanged) | existing | Real-time update after batch submit | Already used in POST /chargebacks |

### Alternatives Considered
None -- all components exist in the project stack.

## Architecture Patterns

### Recommended Project Structure
```
apps/ops-api/src/routes/chargebacks.ts    # Add POST /chargebacks/preview route
apps/ops-api/src/services/chargebacks.ts  # NEW: Extract matching logic into shared service
apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx  # Add review table step
```

### Pattern 1: Preview API with No Side Effects
**What:** The preview endpoint runs matching logic against the database but creates zero records. It returns enriched data (match status, sale details, products) that the frontend uses to populate the review table.
**When to use:** When users need to see and edit data before committing.
**Example:**
```typescript
// POST /api/chargebacks/preview
// Input: { records: ParsedRow[] }
// Output: { previews: PreviewResult[] }
// where PreviewResult = {
//   ...ParsedRow,
//   matchStatus: "MATCHED" | "MULTIPLE" | "UNMATCHED",
//   matchedSales: Array<{
//     id: string,
//     memberName: string,
//     agentName: string,
//     products: Array<{ id: string, name: string, type: string, premium: number }>,
//   }>,
//   selectedSaleId: string | null,  // auto-set for single match
// }
```

### Pattern 2: Extract Matching Logic into Service Function
**What:** The memberId matching logic currently inline in POST /chargebacks (lines 67-97) should be extracted into a reusable function in a new `services/chargebacks.ts` file. Both the preview and submit endpoints use this shared function.
**When to use:** When the same business logic is needed in multiple routes.
**Example:**
```typescript
// services/chargebacks.ts
export async function matchChargebacksToSales(memberIds: string[]) {
  // Single IN query for all memberIds (avoids N+1)
  const sales = await prisma.sale.findMany({
    where: { memberId: { in: memberIds.filter(Boolean) } },
    include: {
      agent: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, type: true, premium: true } },
      addons: { include: { product: { select: { id: true, name: true, type: true, premium: true } } } },
    },
  });
  // Group by memberId for O(1) lookup
  const salesByMemberId = new Map<string, typeof sales>();
  for (const sale of sales) {
    const key = sale.memberId || "";
    if (!salesByMemberId.has(key)) salesByMemberId.set(key, []);
    salesByMemberId.get(key)!.push(sale);
  }
  return salesByMemberId;
}
```

### Pattern 3: Review Table as State Step in CSSubmissions
**What:** Add a `reviewRecords` state (PreviewResult[]) that is populated after the preview API call. When `reviewRecords` is non-empty, render the review table instead of the current preview table. On submit, send the reviewed data. On clear, reset back to paste mode.
**When to use:** Inserting a review step into an existing flow.
**Example:**
```typescript
// State progression:
// 1. rawText empty, reviewRecords empty -> show paste area
// 2. rawText filled, reviewRecords empty -> parse + call preview API -> loading state
// 3. reviewRecords filled -> show review table with summary bar
// 4. submit -> POST /chargebacks with reviewed data -> clear all state
```

### Pattern 4: Product Checkbox with Auto-Recalculation (D-07, D-08)
**What:** Each matched row shows product checkboxes. Toggling recalculates the chargeback amount. A manual override flag prevents auto-recalculation after user edits the amount field directly.
**When to use:** When product selection drives a calculated value but user can override.
**Example:**
```typescript
interface ReviewRow {
  // ... other fields
  products: Array<{ id: string; name: string; premium: number; selected: boolean }>;
  chargebackAmount: number;
  amountManuallyOverridden: boolean;
}

function toggleProduct(rowIdx: number, productId: string) {
  setReviewRecords(prev => prev.map((row, i) => {
    if (i !== rowIdx) return row;
    const products = row.products.map(p =>
      p.id === productId ? { ...p, selected: !p.selected } : p
    );
    const autoAmount = products.filter(p => p.selected).reduce((sum, p) => sum + p.premium, 0);
    return {
      ...row,
      products,
      chargebackAmount: row.amountManuallyOverridden ? row.chargebackAmount : -autoAmount,
    };
  }));
}
```

### Anti-Patterns to Avoid
- **Running consolidateByMember() before review table:** STATE.md explicitly notes this pitfall. Present ParsedRow[] unconsolidated to the preview API so each line maps to one review row.
- **N+1 queries in match loop:** The existing POST /chargebacks does individual `prisma.sale.findMany` per chargeback (line 69). The preview endpoint MUST batch all memberIds into a single IN query.
- **Creating DB records in preview:** Preview must be purely read-only. No createMany, no alerts, no socket emissions.
- **Emitting socket events per-item on batch submit:** Emit one `cs:changed` event for the entire batch, not per-chargeback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Match status badges | Custom styled spans | `Badge` from `@ops/ui` with `colors.success/warning/danger` | Consistent sizing, border-radius, font weight |
| Toast notifications | Custom notification system | `useToast()` from `@ops/ui` | Already used in CSSubmissions, supports undo action |
| Table styling | Custom CSS | `baseThStyle` + `baseTdStyle` from `@ops/ui` | Consistent dark theme table appearance |
| Input styling | Custom input styles | `baseInputStyle` / `COMPACT_INPUT` pattern | Already defined in CSSubmissions |
| API calls | fetch() | `authFetch()` from `@ops/auth/client` | Handles Bearer token, 30s timeout, auto-refresh |
| Dollar formatting | Manual toFixed | `formatDollar()` from `@ops/utils` | Consistent currency display |

## Common Pitfalls

### Pitfall 1: N+1 Queries in Preview Matching
**What goes wrong:** Looping through each parsed record and running individual `prisma.sale.findMany({ where: { memberId } })` queries.
**Why it happens:** Copying the existing POST /chargebacks pattern which does exactly this (lines 68-97).
**How to avoid:** Collect all unique memberIds, run a single `findMany({ where: { memberId: { in: memberIds } } })`, group results by memberId in a Map.
**Warning signs:** Preview API takes > 1 second for 20+ records.

### Pitfall 2: Clawback Dedupe on Batch Submit
**What goes wrong:** A batch can contain multiple chargebacks for the same sale (same memberId). Each creates a clawback, potentially double-clawing the same sale.
**Why it happens:** The existing clawback dedupe check (alerts.ts line 70) checks per-chargeback, not across the batch.
**How to avoid:** Either (a) group by matchedSaleId in the submit handler and combine amounts, or (b) add a batch-level dedupe check before creating clawbacks. STATE.md explicitly flags this.
**Warning signs:** Same sale appears multiple times in the review table with different chargebacks.

### Pitfall 3: Losing Parsed Data on Preview API Failure
**What goes wrong:** User pastes data, frontend clears rawText before preview API responds, API fails, user loses their paste.
**Why it happens:** Premature state clearing.
**How to avoid:** Only transition to review state on successful preview response. Keep rawText and parsed data until review is confirmed.
**Warning signs:** User has to re-paste after a network error.

### Pitfall 4: Product Premium as Decimal
**What goes wrong:** Prisma returns `Decimal` objects (from `@db.Decimal(12,2)`), not JavaScript numbers. Arithmetic operations fail or produce incorrect results.
**Why it happens:** Prisma's Decimal type is a string-like object.
**How to avoid:** Always `Number(product.premium)` when doing math. The API response serializer should convert Decimals to numbers before sending to frontend.
**Warning signs:** NaN in chargeback amount calculations, or string concatenation instead of addition.

### Pitfall 5: MULTIPLE Match Sale Selection State
**What goes wrong:** User selects a sale for a MULTIPLE-match entry, but the selection doesn't persist or doesn't update the matchStatus to MATCHED in the review state.
**Why it happens:** Missing state update when user picks from candidate sales.
**How to avoid:** On sale selection, update both `selectedSaleId` and `matchStatus` to "MATCHED" in the review row state. Also populate the products from the selected sale.
**Warning signs:** Summary bar still shows MULTIPLE count after user resolves all ambiguities.

## Code Examples

### Preview API Endpoint
```typescript
// Source: Derived from existing chargebacks.ts pattern
const previewSchema = z.object({
  records: z.array(z.object({
    memberId: z.string().nullable(),
    memberCompany: z.string().nullable(),
    chargebackAmount: z.number(),
    // ... other ParsedRow fields
  })),
});

router.post("/chargebacks/preview", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { records } = parsed.data;
  const memberIds = records.map(r => r.memberId).filter(Boolean) as string[];

  const salesByMemberId = await matchChargebacksToSales(memberIds);

  const previews = records.map(record => {
    const matchingSales = record.memberId ? (salesByMemberId.get(record.memberId) || []) : [];
    let matchStatus: "MATCHED" | "MULTIPLE" | "UNMATCHED";
    if (matchingSales.length === 1) matchStatus = "MATCHED";
    else if (matchingSales.length > 1) matchStatus = "MULTIPLE";
    else matchStatus = "UNMATCHED";

    return {
      ...record,
      matchStatus,
      matchedSales: matchingSales.map(sale => ({
        id: sale.id,
        memberName: sale.memberName,
        agentName: sale.agent.name,
        agentId: sale.agentId,
        products: [
          { id: sale.product.id, name: sale.product.name, type: sale.product.type, premium: Number(sale.premium) },
          ...sale.addons.map(a => ({
            id: a.product.id, name: a.product.name, type: a.product.type, premium: Number(a.premium ?? 0),
          })),
        ],
      })),
      selectedSaleId: matchingSales.length === 1 ? matchingSales[0].id : null,
    };
  });

  return res.json({ previews });
}));
```

### Summary Bar Component
```typescript
// Source: CSTracking.tsx match status badge pattern + Badge from @ops/ui
const SUMMARY_BAR: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  padding: `${spacing[3]}px ${spacing[6]}px`,
  borderBottom: `1px solid ${colors.borderSubtle}`,
};

function SummaryBar({ records, filter, onFilterChange }: {
  records: ReviewRow[];
  filter: string | null;
  onFilterChange: (status: string | null) => void;
}) {
  const counts = { MATCHED: 0, MULTIPLE: 0, UNMATCHED: 0 };
  let totalAmount = 0;
  for (const r of records) {
    counts[r.matchStatus]++;
    totalAmount += Math.abs(r.chargebackAmount);
  }

  const handleClick = (status: string) => {
    onFilterChange(filter === status ? null : status);  // toggle filter
  };

  return (
    <div style={SUMMARY_BAR}>
      <Badge color={colors.success} onClick={() => handleClick("MATCHED")}
        variant={filter === "MATCHED" ? "solid" : "subtle"}>
        {counts.MATCHED} Matched
      </Badge>
      <Badge color={colors.warning} onClick={() => handleClick("MULTIPLE")}
        variant={filter === "MULTIPLE" ? "solid" : "subtle"}>
        {counts.MULTIPLE} Multiple
      </Badge>
      <Badge color={colors.danger} onClick={() => handleClick("UNMATCHED")}
        variant={filter === "UNMATCHED" ? "solid" : "subtle"}>
        {counts.UNMATCHED} Unmatched
      </Badge>
      <span style={{ marginLeft: "auto", color: colors.danger, fontWeight: typography.weights.bold }}>
        Total: {formatDollar(totalAmount)}
      </span>
    </div>
  );
}
```

### Row Removal with Undo Toast
```typescript
// Source: @ops/ui ToastProvider pattern, already used in CSSubmissions
function removeRow(idx: number) {
  const removed = reviewRecords[idx];
  setReviewRecords(prev => prev.filter((_, i) => i !== idx));
  toast("info", `Removed ${removed.memberCompany || removed.memberId || "entry"}`, {
    action: {
      label: "Undo",
      onClick: () => setReviewRecords(prev => {
        const next = [...prev];
        next.splice(idx, 0, removed);
        return next;
      }),
    },
    duration: 5000,
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parse + immediate submit | Parse + preview + review + submit | Phase 44 | User can verify matches before creating DB records |
| Per-chargeback matching after DB insert | Batch preview matching before DB insert | Phase 44 | Reduces incorrect chargeback submissions |
| N+1 sale lookups per chargeback | Single IN query for all memberIds | Phase 44 | Performance improvement for large batches |

## Open Questions

1. **Toast action API for undo**
   - What we know: `useToast()` exists and is used in CSSubmissions. It takes `(type, message)`.
   - What's unclear: Whether the toast supports an `action` prop with onClick handler for undo.
   - Recommendation: Check the ToastProvider implementation. If it doesn't support actions, extend it minimally or use a timed state-based undo (keep removed row in a ref for N seconds, restore on click).

2. **Badge onClick support**
   - What we know: Badge component exists in @ops/ui with `color`, `variant`, `size`, `dot` props.
   - What's unclear: Whether Badge supports an `onClick` prop for the filter behavior.
   - Recommendation: Either add onClick to Badge or wrap in a clickable `<button>` element for the summary bar. The Badge itself is just a styled span.

3. **Batch submit with user-edited matchedSaleId**
   - What we know: Current POST /chargebacks does matching after insert. The new flow has matching done upfront in preview.
   - What's unclear: Whether to modify POST /chargebacks to accept pre-matched saleIds, or keep the existing post-insert matching.
   - Recommendation: Extend the existing POST /chargebacks to accept optional `matchedSaleId` and `selectedProducts` per record. If provided, skip the automatic matching logic and use user-provided values.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing) |
| Config file | `jest.config.js` (Morgan service tests) |
| Quick run command | `npm test -- chargebacks.test.js` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CB-01 | Paste multiple chargebacks parsed at once | unit | Existing parser tests (if any) | Verify |
| CB-02 | Review table shown before submit | manual-only | Visual verification | N/A |
| CB-03 | Review row shows agent, member, match status | unit | `npm test -- chargebacks-preview.test.js` | Wave 0 |
| CB-04 | Matched row shows product checkboxes | manual-only | Visual verification | N/A |
| CB-05 | Edit amount, rep, product selection | manual-only | Visual verification | N/A |
| CB-06 | Remove individual entries | manual-only | Visual verification | N/A |
| CB-07 | Summary bar with status counts | unit | `npm test -- chargebacks-preview.test.js` | Wave 0 |
| CB-08 | Round-robin auto-assignment | unit | Existing batch-assign tests | Verify |
| CB-09 | Batch submit creates all chargebacks | unit | `npm test -- chargebacks-preview.test.js` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test -- chargebacks`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] `apps/ops-api/src/services/__tests__/chargebacks-preview.test.ts` -- covers preview matching logic (CB-03, CB-07, CB-09)
- [ ] Verify existing parser test coverage for CB-01
- [ ] Note: Most requirements (CB-02, CB-04, CB-05, CB-06) are UI-only and require manual visual verification

## Sources

### Primary (HIGH confidence)
- `apps/ops-api/src/routes/chargebacks.ts` -- existing matching logic, schema, route structure
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` -- existing parser, table, submit flow
- `apps/ops-api/src/services/alerts.ts` -- clawback creation, dedupe logic
- `prisma/schema.prisma` -- ChargebackSubmission, Sale, Product, SaleAddon, Clawback, ClawbackProduct models
- `apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx` -- match status badge styling pattern
- `packages/ui/src/components/Badge.tsx` -- Badge component API
- `.planning/STATE.md` -- accumulated decisions and pitfall notes

### Secondary (MEDIUM confidence)
- `.planning/phases/44-chargeback-batch-review/44-CONTEXT.md` -- user decisions and canonical refs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, zero new dependencies
- Architecture: HIGH -- pattern directly extends existing CSSubmissions flow with well-documented decisions
- Pitfalls: HIGH -- STATE.md explicitly flags the key pitfalls (N+1, dedupe, consolidation)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- internal project, no external dependency changes)
