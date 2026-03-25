# Phase 28: Type Safety Audit - Research

**Researched:** 2026-03-25
**Domain:** TypeScript strict type safety, `any` elimination, return type annotations
**Confidence:** HIGH

## Summary

The codebase has TypeScript strict mode enabled (`tsconfig.base.json`) but has approximately 183 explicit `any` type annotations across application code (87 in ops-api, 92 in ops-dashboard, 4 in packages). The `any` occurrences fall into well-defined categories: catch block error parameters (~40), inline callback parameters lacking type aliases (~50 in CSTracking.tsx alone), Prisma JSON field casts (~12), dynamic Prisma where clause builders (~5), Express `req.user` access via `as any` cast (~4), and miscellaneous data-shape shortcuts. Test files are excluded per D-02.

The shared packages (`@ops/auth`, `@ops/types`, `@ops/utils`, `@ops/ui`, `@ops/db`, `@ops/socket`) have minimal `any` usage (4 total across auth/client.ts and socket/useSocket.ts) but several exported functions lack explicit return type annotations. The package audit is straightforward since the packages are small and well-scoped.

**Primary recommendation:** Organize the audit by `any` category (catch blocks, callback params, Prisma casts, dynamic objects) rather than by file, since each category has a single mechanical fix pattern. Handle package export annotations as a separate focused task.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Fix `any` in application code only -- route handlers, services, dashboard components, and packages.
- **D-02:** Exclude test files (`__tests__/`, `*.test.ts`) and mock files from the audit.
- **D-03:** Allow `any` in Express error handler signature (`err: any` in global error handler) and `catch (err)` blocks where the error type is genuinely unknown. These are acceptable exceptions.
- **D-04:** Third-party type gaps (where no `@types/*` package exists) are excluded per success criteria.
- **D-05:** Keep types where they are -- API returns objects inline, dashboard defines local inline types. No new shared response type infrastructure in `@ops/types`.
- **D-06:** Audit route handlers and dashboard components to verify response shapes match. Fix mismatches where found (extra fields, missing fields, wrong types).
- **D-07:** This is a verification-and-fix pass, not a structural refactor. Minimize changes to working code.
- **D-08:** Every exported function in `@ops/auth`, `@ops/types`, `@ops/utils`, `@ops/ui`, and `@ops/db` gets an explicit return type annotation on its signature.
- **D-09:** No JSDoc additions -- just type annotations. This is a stabilization milestone.
- **D-10:** Fix the 4 existing `any` occurrences in packages (`@ops/auth/client` has 2, `@ops/socket` has 2) with proper types.

### Claude's Discretion
- How to organize the audit (by app, by type of `any`, or by file)
- What specific types to use when replacing `any` (e.g., `unknown`, specific interfaces, union types)
- Grouping of changes into plans and commits
- Whether to use `unknown` or specific types for catch blocks that need narrowing

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TS-01 | No `any` types in application code (excluding third-party type gaps) | Categorized all 183 `any` occurrences into 10 fix patterns; each has a mechanical replacement strategy |
| TS-02 | API response types match actual response shapes | Route handlers return Prisma query results (type-inferred); dashboard uses inline types that must be verified against actual API responses |
| TS-03 | Shared package exports have explicit type annotations | Audited all 5 packages + @ops/socket; identified functions needing return type annotations |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | (project version) | Type system | Already configured with `strict: true` in tsconfig.base.json |
| Prisma | (project version) | Generated types for DB models and input types | Provides `Prisma.XxxWhereInput`, `Prisma.JsonValue`, `Prisma.InputJsonValue` for replacing `any` in query builders |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@prisma/client` | (project version) | Type exports | Use `Prisma` namespace for where-clause types, JSON field types |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `unknown` for catch blocks | Specific error types | `unknown` is correct per TS best practice; use `instanceof Error` narrowing when accessing `.message` |
| `Prisma.JsonValue` for JSON fields | Custom interfaces | Prisma's own types ensure DB compatibility; custom types risk drift |

## Architecture Patterns

### `any` Categories and Fix Patterns

#### Category 1: Catch Block Error Parameters (~40 occurrences)
**Pattern:** `catch (e: any) { ... e.message ... }`
**Fix:** Replace with `catch (e: unknown)` and narrow with `e instanceof Error ? e.message : "unknown error"`
**Exception per D-03:** The global error handler in `apps/ops-api/src/index.ts:40` keeps `err: any` (Express error handler signature convention).
**Files:** agents.ts (5), products.ts (2), users.ts (1), call-logs.ts (2), convosoKpiPoller.ts (2), auditQueue.ts (2), auth/client.ts (1), PayrollService.tsx (4), PayrollProducts.tsx (4), PayrollPeriods.tsx (7), PayrollChargebacks.tsx (1), ManagerConfig.tsx (7), ManagerSales.tsx (5), ManagerEntry.tsx (2), login/route.ts (1), change-password/route.ts (1)

#### Category 2: Inline Callback Params -- CSTracking.tsx (~42 occurrences)
**Pattern:** `.filter((cb: any) => cb.someField)` and `.map((cb: any) => ...)`
**Fix:** Define a `Chargeback` type and `PendingTerm` type at the top of CSTracking.tsx. The component already uses these shapes consistently -- just formalize them.
**Key shapes needed:**
- `Chargeback`: id, resolvedAt, postedDate, chargebackAmount, product, memberCompany, memberAgentCompany, agentName
- `PendingTerm`: id, resolvedAt, agentName, state, product, holdReason, sale (with saleDate, premium)

#### Category 3: Prisma JSON Field Casts (~12 occurrences)
**Pattern:** `result.issues as any` for storing JSON arrays in Prisma JSON fields
**Fix:** Use `result.issues as Prisma.InputJsonValue` for write operations, and define typed interfaces for read operations with explicit casting from `Prisma.JsonValue`.
**Files:** callAudit.ts (8 -- issues, wins, missedOpportunities, suggestedCoaching x2), convosoKpiPoller.ts (1 -- callsByTier)

#### Category 4: Dynamic Prisma Where Clauses (~5 occurrences)
**Pattern:** `const where: any = { ... }; if (condition) where.field = value;`
**Fix:** Use `Prisma.XxxWhereInput` types. E.g., `const where: Prisma.ConvosoCallWhereInput = { ... }`
**Files:** ai-budget.ts (1), call-audits.ts (3), sales.ts (1)

#### Category 5: `(req as any).user` Access (~4 occurrences)
**Pattern:** `(req as any).user.id` or `(req as any).user!.id`
**Fix:** Use `req.user!.id` directly. The Express `Request` interface is already augmented globally in `middleware/auth.ts` with `user?: { id: string; roles: AppRole[]; ... }`. These routes are behind `requireAuth` middleware so `req.user` is guaranteed populated.
**Files:** alerts.ts (2), chargebacks.ts (1), pending-terms.ts (1)

#### Category 6: Dynamic Object Building (~5 occurrences)
**Pattern:** `const updateData: any = { ...fields }` or `const data: any = { ...rest }`
**Fix:** Use Prisma input types: `Prisma.SaleUpdateInput`, `Prisma.UserUpdateInput`, etc.
**Files:** sales.ts (1 -- updateData), users.ts (1 -- data), change-requests.ts (1 -- saleUpdateData), sales.ts:177 (`as any` on object literal)

#### Category 7: `user.roles as any` Prisma-to-AppRole Cast (~2 occurrences)
**Pattern:** `signSessionToken({ ...user, roles: user.roles as any })`
**Fix:** Prisma stores roles as `string[]`. Cast to `AppRole[]`: `roles: user.roles as AppRole[]`
**Files:** auth.ts (2)

#### Category 8: Addon Premium Reduce Pattern (~10 occurrences)
**Pattern:** `(s as any).addons?.reduce((sum: number, a: any) => sum + Number(a.premium ?? 0), 0)`
**Fix:** Define an `AddonWithPremium` type: `{ premium: number | null; product: { id: string; name: string; type: string } }`. Add it where the Prisma include specifies addons.
**Files:** sales.ts (7), OwnerOverview.tsx (1), ManagerSales.tsx (1), page.tsx (1)

#### Category 9: Function Return/Param Types (~5 occurrences)
**Pattern:** `function extractConvosoResults(response: any): any[]`, `Promise<any>`, `emitAuditComplete(audit: any)`
**Fix:** Define interfaces for Convoso API response shape, audit result type, etc.
**Files:** convosoKpiPoller.ts (1), call-logs.ts (1), convosoCallLogs.ts (1), socket.ts (1), helpers.ts (1 -- `Promise<any>` return)

#### Category 10: Dashboard Inline Type Gaps (~8 occurrences)
**Pattern:** `entries: any[]`, `alerts: any[]`, `useState<any>(null)`, `socket: any`
**Fix:** Define local type aliases for data shapes already known from API responses.
**Files:** PayrollService.tsx (1), PayrollPeriods.tsx (2), page.tsx (2), OwnerConfig.tsx (5), ManagerAudits.tsx (1)

### Anti-Patterns to Avoid
- **Over-typing catch blocks:** Don't create custom error type hierarchies. Just use `unknown` + `instanceof Error` narrowing.
- **Creating shared response types in @ops/types:** D-05 explicitly forbids this. Keep inline types where they are.
- **Changing runtime behavior:** D-07 says minimize changes. Type annotations only -- no logic changes.
- **Removing `as any` on Prisma JSON writes without using `Prisma.InputJsonValue`:** The Prisma client expects `InputJsonValue` for JSON columns; raw objects may fail type checks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prisma where clause types | Custom `WhereFilter` interfaces | `Prisma.XxxWhereInput` generated types | Prisma generates exact types for every model's where clauses |
| Prisma JSON field types | Custom JSON type aliases | `Prisma.JsonValue` / `Prisma.InputJsonValue` | Matches exactly what Prisma expects for JSON columns |
| Express Request user type | Custom Request interface | Global declaration in `middleware/auth.ts` (already exists) | The augmentation already covers `req.user` |
| Error narrowing utility | Custom `isError()` helper | Inline `e instanceof Error` | Standard TS pattern, no utility needed for this scope |

## Common Pitfalls

### Pitfall 1: Breaking Prisma JSON Writes
**What goes wrong:** Replacing `as any` with a typed interface on Prisma JSON column writes causes type errors because Prisma expects `Prisma.InputJsonValue`.
**Why it happens:** Custom interfaces are not assignable to `InputJsonValue`.
**How to avoid:** For Prisma `.create()` / `.update()` JSON fields, cast to `Prisma.InputJsonValue` or `value as unknown as Prisma.InputJsonValue`. For reads, cast `jsonField as unknown as MyInterface`.
**Warning signs:** TypeScript errors about types not being assignable to `JsonValue`.

### Pitfall 2: catch (e: unknown) Without Narrowing
**What goes wrong:** Replacing `catch (e: any)` with `catch (e: unknown)` but then accessing `e.message` directly causes TS errors.
**Why it happens:** `unknown` requires narrowing before property access.
**How to avoid:** Always use `e instanceof Error ? e.message : String(e)` pattern consistently.
**Warning signs:** TypeScript error "Object is of type 'unknown'" on catch block body.

### Pitfall 3: Prisma Query Results Missing Include Fields
**What goes wrong:** Adding type annotations to variables holding Prisma query results, but the type doesn't include relations loaded via `include`.
**Why it happens:** Prisma's base model type doesn't include relations -- you need `Prisma.XxxGetPayload<{ include: ... }>`.
**How to avoid:** Use `Prisma.SaleGetPayload<{ include: { addons: { include: { product: true } } } }>` for queries with includes.
**Warning signs:** "Property 'addons' does not exist on type 'Sale'" errors.

### Pitfall 4: Forgetting D-03 Exceptions
**What goes wrong:** Zealously removing ALL `any` annotations including the allowed exceptions.
**Why it happens:** Not checking the exception list.
**How to avoid:** Keep `any` in: (1) global error handler `err: any` in `index.ts:40`, (2) catch blocks where error type is genuinely unknown and only logged (per D-03 discretion).
**Warning signs:** Unnecessary code churn in error handler.

### Pitfall 5: `req.user` Non-Null Assertion
**What goes wrong:** Using `req.user.id` without `!` on routes protected by `requireAuth`.
**Why it happens:** The global declaration marks `user` as optional (`user?:`) because not all routes require auth.
**How to avoid:** Use `req.user!.id` on auth-protected routes. The middleware guarantees it exists.
**Warning signs:** TypeScript error "Object is possibly 'undefined'".

## Code Examples

### Catch Block Fix Pattern
```typescript
// BEFORE
} catch (e: any) {
  res.status(500).json({ error: e.message ?? "Internal error" });
}

// AFTER
} catch (e: unknown) {
  const message = e instanceof Error ? e.message : "Internal error";
  res.status(500).json({ error: message });
}
```

### Prisma Where Clause Fix
```typescript
// BEFORE
const where: any = { agentId: { not: null } };
if (from) where.createdAt = { gte: new Date(from) };

// AFTER
import { Prisma } from "@prisma/client";
const where: Prisma.ConvosoCallWhereInput = { agentId: { not: null } };
if (from) where.createdAt = { gte: new Date(from) };
```

### Prisma JSON Field Cast
```typescript
// BEFORE (write)
issues: result.issues as any,

// AFTER (write)
issues: result.issues as Prisma.InputJsonValue,

// BEFORE (read)
const data = record.issues; // JsonValue

// AFTER (read) -- only if you need typed access
const data = record.issues as unknown as string[];
```

### Express req.user Fix
```typescript
// BEFORE
const alert = await approveAlert(pp.data.id, periodId, (req as any).user.id);

// AFTER
const alert = await approveAlert(pp.data.id, periodId, req.user!.id);
```

### Callback Parameter Type Fix (CSTracking pattern)
```typescript
// BEFORE
result = result.filter((cb: any) => !cb.resolvedAt);

// AFTER -- define type at top of file
type Chargeback = {
  id: string;
  resolvedAt: string | null;
  postedDate: string | null;
  chargebackAmount: string | null;
  product: string | null;
  memberCompany: string | null;
  memberAgentCompany: string | null;
  agentName: string | null;
  // ... other fields used in the component
};

// Then use typed state
const [chargebacks, setChargebacks] = useState<Chargeback[]>([]);
result = result.filter((cb) => !cb.resolvedAt); // no annotation needed -- inferred from array type
```

### Package Export Return Type Annotation
```typescript
// BEFORE
export const signSessionToken = (user: SessionUser) => {
  return jwt.sign(user, getSecret(), { expiresIn: "12h" });
};

// AFTER
export const signSessionToken = (user: SessionUser): string => {
  return jwt.sign(user, getSecret(), { expiresIn: "12h" });
};
```

### Socket Handler Type Fix
```typescript
// BEFORE
additionalHandlers?: Record<string, (data: any) => void>,

// AFTER
additionalHandlers?: Record<string, (data: unknown) => void>,
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `catch (e: any)` | `catch (e: unknown)` | TypeScript 4.0+ (useUnknownInCatchVariables) | Strict mode already enables this; existing `any` annotations override it |
| `as any` for JSON fields | `Prisma.InputJsonValue` / `Prisma.JsonValue` | Prisma 3.x+ | Proper type safety for JSON columns |
| Custom Request augmentation | Global declaration merging | Express 4.x standard | Already implemented in middleware/auth.ts |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.x with ts-jest |
| Config file | `apps/ops-api/jest.config.ts` (ops-api), `apps/morgan/jest.config.js` (Morgan) |
| Quick run command | `npm run test:ops -- --testPathPattern="<pattern>" --bail` |
| Full suite command | `npm run test:ops` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TS-01 | No `any` in application code | grep-based verification | `grep -rn ": any\b\|as any" apps/ packages/ --include="*.ts" --include="*.tsx" --exclude-dir=__tests__ --exclude-dir=node_modules \| grep -v "err: any" \| wc -l` should return 0 | N/A -- grep command |
| TS-02 | API response shapes match types | manual review | Compare route handler returns with dashboard inline types | manual-only -- requires human review of shape alignment |
| TS-03 | Package exports have explicit return types | grep-based verification | Check each package export for `: ReturnType` annotation presence | N/A -- grep command |

### Sampling Rate
- **Per task commit:** `npm run test:ops -- --bail` (ensure no regressions from type changes)
- **Per wave merge:** `npm run test:ops` + `npm test` (full Morgan suite)
- **Phase gate:** Zero `any` grep hits (excluding allowed exceptions) + full test suite green

### Wave 0 Gaps
None -- existing test infrastructure covers regression detection. This phase's primary validation is grep-based `any` counting, not new test files.

## Open Questions

1. **Addon type from Prisma includes**
   - What we know: Multiple files access `sale.addons` with premium/product fields via Prisma includes
   - What's unclear: Whether a shared type alias for this common include pattern would reduce duplication
   - Recommendation: Define inline types per D-05 (no shared types). Each file defines its own `SaleWithAddons` alias matching its specific Prisma include.

2. **`asyncHandler` return type**
   - What we know: `helpers.ts:15` has `Promise<any>` in the handler signature
   - What's unclear: Whether `Promise<void>` is sufficient (Express handlers don't use the return value)
   - Recommendation: Use `Promise<void>` since Express route handlers return void to Express.

3. **ConvosoCallLogs response shape**
   - What we know: `fetchConvosoCallLogs` returns `Promise<any>` -- the Convoso API response structure
   - What's unclear: Exact shape of Convoso API responses (third-party API)
   - Recommendation: Define a minimal interface based on actual usage patterns in the codebase, or use `Promise<unknown>` with narrowing at call sites.

## Sources

### Primary (HIGH confidence)
- Codebase analysis -- direct grep of all `any` occurrences across apps/ and packages/
- `tsconfig.base.json` -- confirmed `strict: true` enabled
- `middleware/auth.ts` -- confirmed Express Request augmentation exists
- Prisma schema and generated client types -- available via `@prisma/client`

### Secondary (MEDIUM confidence)
- TypeScript handbook on `unknown` vs `any` -- standard TS guidance
- Prisma documentation on `JsonValue` / `InputJsonValue` types -- well-established patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries needed, all fixes use existing TypeScript and Prisma features
- Architecture: HIGH -- patterns are mechanical and well-defined; 10 categories cover all 183 occurrences
- Pitfalls: HIGH -- based on direct codebase analysis of actual `any` usage patterns

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- TypeScript type system patterns don't change frequently)
