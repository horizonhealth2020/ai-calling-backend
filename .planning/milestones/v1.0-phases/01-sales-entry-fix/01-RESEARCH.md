# Phase 1: Sales Entry Fix - Research

**Researched:** 2026-03-14
**Domain:** Prisma schema sync, Express API bug fix, React form UX
**Confidence:** HIGH

## Summary

The 500 error on sale creation has a clear root cause: the `memberState` column was added to the database via migration (`20260312_add_member_state`) but was **never added to the Prisma schema** (`prisma/schema.prisma`). The POST `/api/sales` route validates `memberState` via Zod, destructures it into `saleData`, and spreads it into `prisma.sale.create()`. Since the Prisma client has no knowledge of this field, it throws a runtime error for any request that includes `memberState` (even empty string would be stripped, but the field's absence from the generated types means the Prisma client rejects the unknown key).

Additionally, the `SaleAddon` model needs a `premium` field (Decimal, optional) per the context decisions, and the frontend error/success feedback needs improvement from the current basic `msg` pattern to a more robust inline alert with auto-dismiss.

**Primary recommendation:** Add `memberState` to the Prisma Sale model, add `premium` to SaleAddon model, regenerate the client, and improve the form feedback UX. This is a schema-sync + UX fix, not new feature development.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Add `memberState` column to Sale model (String, optional, max 2 chars)
- No migration backfill -- existing sales stay null
- Blank/null memberState = no FL exemption (standard commission rules apply)
- Field remains optional in the form -- no new friction for managers
- Add `premium` field to SaleAddon model (Decimal, optional)
- Null premium on an addon = skip commission calculation for that addon (no $0 payroll entries)
- Premium field is optional in the form -- managers can add addons without entering a premium
- Errors display inline above the form as a red alert bar -- form stays visible so input isn't lost
- Error format: friendly message + HTTP status code (e.g., "Failed to create sale (400): Member name is required") -- matches existing dashboard pattern
- Success: green success bar inline + form clears to blank + auto-dismiss after 5s
- Sales list auto-refreshes after successful creation (re-fetch weekly sales)

### Claude's Discretion
- Exact styling of success/error alert bars (follow existing dark glassmorphism theme)
- Auto-dismiss timing details
- Prisma migration file structure

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SALE-01 | Sale creation completes without errors (fix 500 internal server error) | Root cause identified: `memberState` missing from Prisma schema. Fix is adding field to schema.prisma and regenerating client. SaleAddon `premium` field also needed for schema correctness. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | (installed) | ORM / schema / migrations | Already used throughout; schema.prisma is single source of truth |
| Zod | (installed) | Request validation | Already used in all API routes |
| Express | 4.x | API framework | Already used for ops-api |
| React (Next.js 15) | 15.x | Frontend framework | Already used for manager-dashboard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/auth/client | workspace | `authFetch()` for API calls | Already used in submitSale |
| lucide-react | 0.577.0 | Icons (CheckCircle, AlertCircle) | Already imported in manager-dashboard |

### Alternatives Considered
None -- this phase uses only existing stack. No new dependencies needed.

## Architecture Patterns

### Root Cause Analysis

**The Bug:** `POST /api/sales` returns 500 Internal Server Error

**Call chain:**
1. Manager submits sale form -> `submitSale()` in `page.tsx` (line 732)
2. `authFetch()` POST to `/api/sales` with body including `memberState`
3. Route handler (routes/index.ts line 279) validates with Zod schema that includes `memberState` (line 294)
4. Destructures: `const { addonProductIds, ...saleData } = parsed` (line 300)
5. `prisma.sale.create({ data: { ...saleData, ... } })` (line 301-311)
6. **CRASH**: Prisma client does not know about `memberState` field -- it exists in the DB but not in schema.prisma
7. Even if step 6 passed, `upsertPayrollEntryForSale(sale.id)` (line 312) calls `calculateCommission()` which accesses `sale.memberState` (payroll.ts line 110) -- this would be `undefined` since Prisma doesn't select it

**Evidence:**
- `prisma/schema.prisma` Sale model (lines 131-168): NO `memberState` field
- `prisma/migrations/20260312_add_member_state/migration.sql`: Column EXISTS in DB as `member_state VARCHAR(2)`
- `payroll.ts` line 110: `sale.memberState?.toUpperCase() === "FL"` -- references a field the Prisma types don't expose

### Fix Pattern: Schema Sync

```
schema.prisma (add field) -> prisma migrate dev -> prisma generate -> TypeScript types update -> Prisma client knows the field
```

Since the column already exists in the database, we need a migration that is either:
1. A no-op migration (Prisma detects column already exists via `prisma migrate dev --create-only` then editing)
2. Or use `prisma db pull` then adjust

**Recommended approach:** Add the field to schema.prisma and run `prisma migrate dev`. Prisma will detect the column already exists and create an empty migration or skip the ALTER. If it tries to add a column that exists, we can use `--create-only` and edit the SQL.

### Pattern 1: Prisma Schema Field Addition
**What:** Add missing fields to schema.prisma that already exist in the database
**When to use:** When migrations were applied manually or out of sync with schema

```prisma
model Sale {
  // ... existing fields ...
  memberState     String?   @map("member_state") @db.VarChar(2)
  // ... rest of model ...
}

model SaleAddon {
  // ... existing fields ...
  premium   Decimal?  @db.Decimal(12, 2)
  // ... rest of model ...
}
```

### Pattern 2: Inline Alert with Auto-Dismiss
**What:** Success/error feedback that auto-dismisses
**When to use:** Form submission feedback

The current code (page.tsx lines 1132-1149) already has an inline alert bar with conditional coloring based on `msg.startsWith("Sale")`. The improvements needed:
- Move alert to ABOVE the form (currently below submit button)
- Change success detection logic (currently checks `msg.startsWith("Sale")` which is fragile)
- Add auto-dismiss via `setTimeout` for success messages
- Ensure form clears on success (already happens via `clearReceipt()` on line 748)

### Pattern 3: Existing Error Display Convention
**What:** The manager dashboard already has an error/success display pattern

```typescript
// Current pattern (page.tsx line 753):
setMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);

// Success (page.tsx line 747):
setMsg("Sale submitted successfully");

// Display logic (line 1142): checks msg.startsWith("Sale") for green vs red
// This is fragile -- "Sale deleted" also starts with "Sale" and shows green
```

**Recommended improvement:** Use a message type state instead of string prefix detection:
```typescript
const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
```

### Anti-Patterns to Avoid
- **Do NOT create a new migration for memberState column** if it already exists in DB -- this will cause `ALTER TABLE ADD COLUMN` to fail with "column already exists"
- **Do NOT hardcode `output: "standalone"` in next.config.js** -- per CLAUDE.md, this breaks Railway
- **Do NOT change the Zod schema for the route** -- it already correctly validates `memberState` as optional string max 2 chars

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema migration | Manual SQL ALTER | `prisma migrate dev` | Prisma tracks migration state; manual SQL creates drift |
| Form validation | Client-side validation logic | Zod on server + display server errors | Server is authoritative per project requirements |
| Auto-dismiss timer | Manual interval tracking | `setTimeout` + cleanup in `useEffect` | Simple, standard React pattern |

## Common Pitfalls

### Pitfall 1: Prisma Migration Conflict with Existing Column
**What goes wrong:** Running `prisma migrate dev` when the column already exists in the database but not in the schema
**Why it happens:** The migration `20260312_add_member_state` already added `member_state` to the DB. If Prisma generates a new migration with `ALTER TABLE ADD COLUMN`, it will fail.
**How to avoid:** Use `prisma migrate dev --create-only` to generate the migration SQL, then inspect it. If it contains an `ALTER TABLE ADD COLUMN member_state`, either:
  - Remove that line (since column exists) and keep only the SaleAddon premium addition
  - Or use `prisma db pull` first to sync the schema with DB state, then adjust
**Warning signs:** Migration fails with "column member_state already exists"

### Pitfall 2: Spread Operator Including Unwanted Fields
**What goes wrong:** `const { addonProductIds, ...saleData } = parsed` spreads ALL validated fields into `prisma.sale.create()`. If any field in the Zod schema doesn't match a Prisma model field, it causes a runtime error.
**Why it happens:** The Zod schema validates the HTTP request body, but the spread assumes 1:1 mapping to Prisma fields.
**How to avoid:** After adding `memberState` to the Prisma schema, the spread will work correctly. But be aware: `paymentType` in Zod is `"CC" | "ACH"` while in Prisma it's `String?` -- this works but is worth noting.
**Warning signs:** Prisma error "Unknown arg `fieldName` in data.fieldName"

### Pitfall 3: Message Type Detection by String Prefix
**What goes wrong:** Current code checks `msg.startsWith("Sale")` to determine if message is success or error. "Sale deleted" shows as success (green), but "Error: ..." shows as error (red). This is fragile.
**Why it happens:** Quick implementation without a proper message type system.
**How to avoid:** Use a typed message state: `{ text: string; type: "success" | "error" } | null`
**Warning signs:** Wrong color on messages, confusing UX

### Pitfall 4: Auto-Dismiss Timer Leak
**What goes wrong:** Setting a timeout to auto-dismiss a success message, but the component unmounts before the timeout fires, causing a React state update on unmounted component.
**Why it happens:** No cleanup of the timeout.
**How to avoid:** Store timeout ID in a ref and clear it on unmount or when a new message is set.
**Warning signs:** React console warning about state update on unmounted component

### Pitfall 5: SaleAddon Premium in Commission Calculation
**What goes wrong:** Adding `premium` to SaleAddon but not updating the commission calculation to use it
**Why it happens:** `calcProductCommission()` in payroll.ts currently uses the SALE's premium for addon commission too (line 102: `calcProductCommission(addon.product, premium, ...)`)
**How to avoid:** Per the context decision, null premium on an addon = skip commission calculation. The commission engine rework is Phase 2 -- for now, just add the schema field. Do NOT change `calculateCommission()` logic in this phase.
**Warning signs:** Addon premiums being used in calculations before Phase 2 engine rework

## Code Examples

### Current POST /api/sales Route (routes/index.ts lines 279-314)
```typescript
router.post("/sales", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    saleDate: z.string(),
    agentId: z.string(),
    memberName: z.string(),
    memberId: z.string().optional(),
    carrier: z.string(),
    productId: z.string(),
    premium: z.number().min(0),
    effectiveDate: z.string(),
    leadSourceId: z.string(),
    enrollmentFee: z.number().min(0).nullable().optional(),
    addonProductIds: z.array(z.string()).default([]),
    status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"]).default("SUBMITTED"),
    paymentType: z.enum(["CC", "ACH"]).optional(),
    memberState: z.string().max(2).optional(),  // <-- Already validated
    notes: z.string().optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json(zodErr(result.error));
  const parsed = result.data;
  const { addonProductIds, ...saleData } = parsed;
  // saleData includes memberState -- but Prisma doesn't know about it!
  const sale = await prisma.sale.create({
    data: {
      ...saleData,
      saleDate: new Date(parsed.saleDate),
      effectiveDate: new Date(parsed.effectiveDate),
      enteredByUserId: req.user!.id,
      addons: addonProductIds.length > 0 ? {
        create: addonProductIds.map(productId => ({ productId })),
      } : undefined,
    },
  });
  await upsertPayrollEntryForSale(sale.id);
  res.status(201).json(sale);
}));
```

### Schema Fix (what needs to change in schema.prisma)
```prisma
model Sale {
  // After line 156 (callDateTime field), add:
  memberState     String?   @map("member_state") @db.VarChar(2)
}

model SaleAddon {
  // After productId field, add:
  premium   Decimal?  @db.Decimal(12, 2)
}
```

### Frontend Success/Error Pattern (improved)
```typescript
// State: typed message instead of raw string
const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
const msgTimerRef = useRef<ReturnType<typeof setTimeout>>();

// In submitSale success handler:
setMsg({ text: "Sale submitted successfully", type: "success" });
clearReceipt(); // already clears form
// Auto-dismiss after 5s
clearTimeout(msgTimerRef.current);
msgTimerRef.current = setTimeout(() => setMsg(null), 5000);

// In submitSale error handler:
setMsg({ text: `Failed to create sale (${res.status}): ${err.error ?? "Unknown error"}`, type: "error" });

// Display (move above form):
{msg && (
  <div style={{
    padding: "12px 16px",
    borderRadius: radius.xl,
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: msg.type === "success" ? colors.successBg : colors.dangerBg,
    border: `1px solid ${msg.type === "success" ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
    color: msg.type === "success" ? colors.success : colors.danger,
  }}>
    {msg.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
    {msg.text}
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual SQL migration | `prisma migrate dev` | Prisma 2+ | Schema and DB stay in sync |
| String prefix for msg type | Typed message state | React best practice | Reliable success/error detection |

**Deprecated/outdated:**
- The existing `msg.startsWith("Sale")` pattern for detecting success should be replaced with a typed approach

## Open Questions

1. **Prisma migration behavior with existing column**
   - What we know: `member_state` column already exists in DB from migration `20260312_add_member_state`
   - What's unclear: Whether `prisma migrate dev` will try to re-add the column or detect it exists
   - Recommendation: Use `--create-only` flag, inspect generated SQL, remove duplicate ALTER if present. Alternatively, since the migration `20260312_add_member_state` already exists in the migrations folder and was presumably applied, Prisma may just need the schema field added and `prisma generate` run (no new migration needed for memberState, only for SaleAddon premium).

2. **SaleAddon premium column in existing migration history**
   - What we know: No existing migration adds `premium` to `sale_addons` table
   - What's unclear: Nothing -- this is a new column
   - Recommendation: A single new migration adds `premium` to `sale_addons`. If memberState also needs a new migration (see Q1), combine them.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root-level, covers Morgan service only) |
| Config file | Root `package.json` (`"test": "jest"`) |
| Quick run command | `npm test -- --testPathPattern=helpers` |
| Full suite command | `npm test` |

Note: There are NO tests for the ops-api routes or the manager-dashboard. Existing Jest tests (`__tests__/`) cover only the Morgan voice service (helpers, integration, queue, etc.).

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SALE-01 | Sale creation completes without 500 error | integration | `npm test -- --testPathPattern=sale-creation` | No -- Wave 0 |
| SALE-01 | memberState persisted in database | unit | `npm test -- --testPathPattern=sale-creation` | No -- Wave 0 |
| SALE-01 | Sale appears in sales list after creation | manual-only | Manual browser test (Next.js page) | N/A |

### Sampling Rate
- **Per task commit:** `npm test` (existing tests still pass -- regression check)
- **Per wave merge:** `npm test` + manual verification of sale creation flow
- **Phase gate:** Full suite green + manual sale creation test

### Wave 0 Gaps
- [ ] `__tests__/sale-creation.test.js` -- integration test for POST /api/sales with memberState field; requires mocking Prisma client or test database
- [ ] Test infrastructure for ops-api routes does not exist -- would need Express supertest setup or similar
- [ ] No frontend test infrastructure for manager-dashboard

Note: Given this is a bug fix phase with a small scope (schema sync + UX improvement), the practical validation path is: (1) ensure existing tests pass, (2) verify the fix manually by creating a sale. Setting up a full integration test harness for ops-api is valuable but may be better scoped as a cross-cutting concern rather than Phase 1 work.

## Sources

### Primary (HIGH confidence)
- `prisma/schema.prisma` -- Sale model lacks `memberState`, SaleAddon lacks `premium`
- `prisma/migrations/20260312_add_member_state/migration.sql` -- Column exists in DB
- `apps/ops-api/src/routes/index.ts` lines 279-314 -- POST /api/sales route with spread operator
- `apps/ops-api/src/services/payroll.ts` line 110 -- `sale.memberState?.toUpperCase() === "FL"` reference
- `apps/manager-dashboard/app/page.tsx` lines 628-760 -- Form state, submitSale, message display

### Secondary (MEDIUM confidence)
- Prisma migration behavior with pre-existing columns -- based on Prisma documentation knowledge

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new deps
- Architecture: HIGH -- root cause identified with line-level precision, fix is mechanical
- Pitfalls: HIGH -- migration conflict is the only real risk, well-understood mitigation

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable -- schema fix, not library-dependent)
