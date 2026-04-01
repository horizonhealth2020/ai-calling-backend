# Phase 27: Error Handling & Robustness - Research

**Researched:** 2026-03-25
**Domain:** Express.js error handling, Zod validation, Prisma error handling, Socket.IO resilience
**Confidence:** HIGH

## Summary

Phase 27 hardens the ops-api so that bad input, connection failures, and edge cases return clean JSON errors instead of crashes or raw error leaks. The codebase already has strong foundations: `asyncHandler()` and `zodErr()` in `routes/helpers.ts`, a global Express error handler in `index.ts`, and consistent patterns across most route files. The work is primarily an audit-and-fill exercise -- finding gaps where these patterns were not applied consistently.

The main gaps identified are: (1) `archive.ts` duplicates `zodErr` and `asyncHandler` locally instead of importing from helpers, (2) `change-requests.ts` does not import `zodErr` and has no Zod validation on query params like `status`, (3) several GET routes read `req.query` values (date ranges, filters, pagination) without Zod validation -- using raw type casts like `as string` instead, (4) `req.params.id` is used extensively without validation that it's a valid format, (5) Socket.IO emit calls in route files and service files lack try/catch wrappers (except `change-requests.ts` which already has one), and (6) no Prisma error handling for connection/timeout failures anywhere.

**Primary recommendation:** Audit all 17 route files systematically. Create a shared `prismaHandler()` wrapper for database error handling, add Zod schemas for query params and route params, and wrap all Socket.IO emit calls with try/catch.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Keep current minimal `{ error: "message" }` format. No changes to error shape -- dashboards already parse `err.error` and this is a stabilization milestone.
- **D-02:** Validation errors continue to return `{ error: "message", details: {...} }` via `zodErr()`.
- **D-03:** Wrap Prisma calls that could fail on connection/timeout with try/catch. Return `{ error: "Database temporarily unavailable" }` with 503 status.
- **D-04:** No retry logic -- just clean error responses. Log the raw Prisma error server-side for debugging.
- **D-05:** Ensure no raw Prisma error messages ever leak to API clients.
- **D-06:** Full Zod coverage -- every route that reads from `req.body`, `req.params`, or `req.query` must go through a Zod schema before use. No raw property access on unvalidated request data.
- **D-07:** Includes query params (date ranges, pagination, filters). Bad query values should return 400 with a clear validation error, not silently pass through.
- **D-08:** All Zod errors must use `zodErr()` wrapper (per CLAUDE.md convention).
- **D-09:** Wrap both event handlers in `index.ts` AND service-side emit utility functions with try/catch.
- **D-10:** If an emit fails, log the error but never crash the request that triggered it. Socket.IO is fire-and-forget from the request's perspective.

### Claude's Discretion
- How to organize the audit (by route file, by requirement, or by error type)
- Whether to create a shared Prisma error wrapper utility or inline try/catch per call
- Grouping of changes into plans and commits

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EH-01 | All async route handlers have proper error boundaries (no unhandled rejections) | All 17 route files already use `asyncHandler()`. `archive.ts` has local copy -- should import from helpers. Global error handler in `index.ts` catches forwarded errors. `auth.ts` logout route is sync (not async) so does not need wrapping. |
| EH-02 | API endpoints validate all required inputs with Zod (no raw `req.body` access) | Body validation is good across most routes. Major gaps: query params (`req.query.range`, `req.query.status`, `req.query.all`, `req.query.groupBy`, etc.) and route params (`req.params.id`, `req.params.agentId`) are used raw without Zod validation in most GET routes and param-based routes. |
| EH-03 | Database queries handle connection/timeout errors gracefully | Currently zero Prisma error handling for connection/timeout. Need shared utility or per-route wrapping. Prisma throws `PrismaClientKnownRequestError`, `PrismaClientUnknownRequestError`, and connection-related errors. |
| EH-04 | Socket.IO event handlers have try/catch wrappers | Socket.IO connection/disconnect handlers in `index.ts` are simple log statements but should have try/catch. All 8 emit functions in `socket.ts` currently do bare `io?.emit()` without try/catch. Service files calling these also lack wrappers (except `change-requests.ts` line 93). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | already installed | Request validation | Already used across all route files |
| express | already installed | HTTP framework | Core framework with asyncHandler pattern |
| @prisma/client | ^5.20.0 | Database client | Already used, error types needed for handling |
| socket.io | already installed | Real-time events | Already used, needs error wrapping |

### Supporting
No new libraries needed. This phase uses existing dependencies only.

## Architecture Patterns

### Recommended Approach: Shared Utility for Prisma Error Handling

Create a `handlePrismaError()` utility in `routes/helpers.ts` that catches Prisma-specific errors and returns appropriate HTTP responses.

**Pattern:**
```typescript
// In routes/helpers.ts
import { Prisma } from "@prisma/client";

export function handlePrismaError(err: unknown, res: Response): Response {
  console.error("Database error:", err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // P2025 = Record not found
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Record not found" });
    }
    // P2002 = Unique constraint violation
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Record already exists" });
    }
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError ||
    (err instanceof Prisma.PrismaClientKnownRequestError && err.code.startsWith("P1"))
  ) {
    return res.status(503).json({ error: "Database temporarily unavailable" });
  }

  // Unknown database error -- don't leak details
  return res.status(500).json({ error: "Internal server error" });
}
```

**Recommendation:** Use a shared utility rather than inline try/catch per call. This centralizes the error-to-response mapping and ensures consistent behavior. The utility should be used in the global error handler and can also be called directly in routes that want more granular control.

### Recommended Approach: Zod Schemas for Common Query Params

Create reusable Zod schemas for common query patterns used across many routes.

**Pattern:**
```typescript
// In routes/helpers.ts

/** Schema for date range query params used by many routes */
export const dateRangeQuerySchema = z.object({
  range: z.enum(["today", "week", "last_week", "7d", "30d", "month"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).optional();

/** Schema for id route param */
export const idParamSchema = z.object({
  id: z.string().min(1),
});

/** Schema for status filter query param */
export const statusQuerySchema = z.object({
  status: z.string().optional().default("PENDING"),
});
```

### Recommended Approach: Socket.IO Emit Wrapping

Wrap the emit functions in `socket.ts` with try/catch so callers never need to worry about it.

**Pattern:**
```typescript
// In socket.ts -- wrap each emit function
export function emitSaleChanged(payload: SaleChangedPayload) {
  try {
    io?.emit("sale:changed", payload);
  } catch (err) {
    console.error("Socket.IO emit error (sale:changed):", err);
  }
}
```

This is cleaner than wrapping every call site. Since D-10 says Socket.IO is fire-and-forget, the emit functions themselves should absorb errors.

### Anti-Patterns to Avoid
- **Inline try/catch around every Prisma call:** Creates massive duplication. Use the global error handler + Prisma-aware error mapping instead.
- **Validating `req.params.id` format (e.g., UUID regex):** Prisma will return P2025 (not found) for invalid IDs. Just validate it's a non-empty string.
- **Changing error response shapes:** D-01 locks the current `{ error: "message" }` format. Do not add `code`, `type`, or other fields.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prisma error codes | Custom error code mapping | `Prisma.PrismaClientKnownRequestError` with `.code` | Prisma already exports typed error classes with error codes (P2025, P2002, P1xxx) |
| Zod error formatting | Custom validation error formatter | `zodErr()` from helpers.ts | Already exists and is used everywhere |
| Async handler wrapping | Manual try/catch in every route | `asyncHandler()` from helpers.ts | Already exists and is used everywhere |

## Common Pitfalls

### Pitfall 1: Prisma Error Leaking in Global Handler
**What goes wrong:** The global error handler in `index.ts` uses `err.message` when `err.expose` is true. Prisma errors may have `.expose` set or the message may contain internal details.
**Why it happens:** The global handler was designed for HTTP errors, not database errors.
**How to avoid:** Add Prisma-specific handling to the global error handler before the generic response. Check if the error is a Prisma type and return 503/generic message instead of forwarding `err.message`.
**Warning signs:** API returns messages containing "prisma", table names, or SQL fragments.

### Pitfall 2: Archive.ts Local Duplicates
**What goes wrong:** `archive.ts` defines its own `zodErr()` and `asyncHandler()` locally instead of importing from `./helpers`.
**Why it happens:** File was likely created independently or copied from a template.
**How to avoid:** Replace local definitions with imports from `./helpers`. Verify behavior is identical (it is -- same implementation).

### Pitfall 3: Query Param Type Casting
**What goes wrong:** Routes use `req.query.range as string` which passes TypeScript but does not validate at runtime. A missing param becomes `undefined`, an array param (e.g., `?range=a&range=b`) becomes `string[]`.
**Why it happens:** Express query params are typed as `string | QueryString.ParsedQs | string[] | QueryString.ParsedQs[] | undefined`. Casting hides this.
**How to avoid:** Always parse through Zod first. `z.string().optional()` handles the `undefined` case. For params that could be arrays, Zod will reject invalid types.

### Pitfall 4: Socket.IO Emit in Service Files
**What goes wrong:** Service files (`alerts.ts`, `auditQueue.ts`, `callAudit.ts`) call emit functions that could throw. If the Socket.IO server is in a bad state, the entire service operation fails.
**Why it happens:** Emit calls were added assuming Socket.IO always works.
**How to avoid:** Wrap emit functions at the source (`socket.ts`) so all callers are protected automatically. This is safer than wrapping at every call site.

### Pitfall 5: Transaction Errors vs. Regular Query Errors
**What goes wrong:** `prisma.$transaction()` throws different errors than regular queries (e.g., transaction timeout, serialization failures). These need the same handling.
**Why it happens:** Transaction-specific error codes (like P2034) are less commonly known.
**How to avoid:** The shared Prisma error handler should cover all Prisma error classes, not just `PrismaClientKnownRequestError`.

## Code Examples

### Current asyncHandler Pattern (already in codebase)
```typescript
// Source: apps/ops-api/src/routes/helpers.ts
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);
```

### Current zodErr Pattern (already in codebase)
```typescript
// Source: apps/ops-api/src/routes/helpers.ts
export function zodErr(ze: z.ZodError) {
  const flat = ze.flatten();
  const msg = flat.formErrors[0]
    || Object.values(flat.fieldErrors).flat()[0]
    || "Validation failed";
  return { error: msg, details: flat };
}
```

### Current Global Error Handler (already in codebase)
```typescript
// Source: apps/ops-api/src/index.ts lines 38-46
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  if (!res.headersSent) {
    const status = typeof err.statusCode === "number" ? err.statusCode : typeof err.status === "number" ? err.status : 500;
    const message = err.expose && err.message ? err.message : "Internal server error";
    res.status(status).json({ error: message });
  }
});
```

### Socket.IO Event Handlers Needing Wrapping
```typescript
// Source: apps/ops-api/src/index.ts lines 58-63
io.on("connection", (socket) => {
  console.log(`[socket.io] Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[socket.io] Client disconnected: ${socket.id}`);
  });
});
```

## Audit Inventory

### Route Files (17 files, ~113 route handlers)

| File | Handlers | asyncHandler | Zod Body | Zod Query/Params Gaps | Socket.IO Emits |
|------|----------|-------------|----------|----------------------|-----------------|
| admin.ts | 4 | all | yes (PUT) | `req.query.range/from/to` raw cast | none |
| agents.ts | 9 | all | yes (POST/PUT) | `req.query.all`, `req.query.permanent`, `req.params.id` raw | none |
| ai-budget.ts | 4 | all | yes (PUT) | `req.query.range/from/to` raw cast | none |
| alerts.ts | 4 | all | yes (POST) | `req.params.id`, `req.params.agentId` raw | none |
| archive.ts | 4 | local copy | yes (POST) | `req.query.cutoffDays` raw parseInt | none |
| auth.ts | 5 | all (logout sync) | yes | none | none |
| call-audits.ts | 14 | all | yes (PATCH) | `req.query.range/from/to/agentId` raw cast, `req.params.id` raw | none |
| call-logs.ts | 2 | all | partial (queue_id/list_id only) | `req.query.min_call_length`, `max_call_length`, `tier` raw | none |
| change-requests.ts | 6 | all | none needed (no body writes) | `req.query.status` raw cast, `req.params.id` raw | emitSaleChanged (already wrapped) |
| chargebacks.ts | 7 | all | yes | `req.query.range/from/to` raw cast, `req.params.id` raw | emitCSChanged (unwrapped) |
| cs-reps.ts | 8 | all | yes | `req.params.id` raw | none |
| payroll.ts | 7 | all | yes | `req.params.id` raw | none |
| pending-terms.ts | 5 | all | yes | `req.query.range/from/to/groupBy` raw, `req.params.id` raw | emitCSChanged (unwrapped) |
| products.ts | 7 | all | yes | `req.query.all`, `req.query.permanent`, `req.params.id` raw | none |
| sales.ts | 14 | all | yes | `req.query.range/from/to/view` raw cast, `req.params.id` raw | emitSaleChanged (unwrapped in some spots) |
| service.ts | 8 | all | yes | `req.params.id` raw | emitServicePayrollChanged (unwrapped) |
| users.ts | 4 | all | yes | `req.params.id` raw | none |
| webhooks.ts | 1 | all | yes | `req.query.api_key` raw (auth, not data) | none |

### Socket.IO Emit Functions (8 in socket.ts)
All 8 functions do bare `io?.emit()` without try/catch:
- `emitAuditStarted`, `emitAuditStatus`, `emitAuditComplete`, `emitAuditFailed`
- `emitSaleChanged`, `emitCSChanged`, `emitAlertCreated`, `emitAlertResolved`
- `emitServicePayrollChanged`, `emitClawbackCreated`

### Service Files Calling Emit Functions
- `services/callAudit.ts` -- calls `emitAuditStatus`, `emitAuditComplete`
- `services/auditQueue.ts` -- calls `emitAuditStarted`, `emitAuditStatus`, `emitAuditFailed`
- `services/alerts.ts` -- calls `emitAlertCreated`, `emitAlertResolved`, `emitClawbackCreated`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual try/catch per route | `asyncHandler()` wrapper | Already in codebase | All routes already use this pattern |
| Raw `error.flatten()` | `zodErr()` wrapper | Already in codebase | Consistent `{ error, details }` shape |
| No query param validation | Zod schemas for query/params | This phase | Prevents type confusion and invalid filter values |

## Open Questions

1. **Whether to enhance the global error handler or add per-route Prisma handling**
   - What we know: The global error handler catches errors forwarded by `asyncHandler()`. Adding Prisma-aware logic there covers all routes automatically.
   - What's unclear: Some routes may want to handle specific Prisma errors differently (e.g., unique constraint on user creation vs. generic 500).
   - Recommendation: Add Prisma handling to the global error handler for connection/timeout errors (P1xxx). Let P2025 (not found) and P2002 (unique) be handled there too with generic responses. Routes that already have specific handling (like `call-logs.ts` catching Convoso errors) keep their local handling.

2. **`archive.ts` local zodErr/asyncHandler -- replace or leave?**
   - What we know: The implementations are identical to `helpers.ts`.
   - Recommendation: Replace with imports from `./helpers` for consistency and to avoid divergence.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (configured for Morgan service only) |
| Config file | `apps/morgan/jest.config.js` (ops-api has no Jest config) |
| Quick run command | `npm test` (Morgan tests only) |
| Full suite command | `npm test` (Morgan tests only) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EH-01 | All async handlers wrapped with asyncHandler | manual-only | Code audit -- grep for `router.(get\|post\|put\|patch\|delete)` without `asyncHandler` | N/A |
| EH-02 | All inputs validated with Zod | manual-only | Code audit -- grep for raw `req.body.`, `req.params.`, `req.query.` access | N/A |
| EH-03 | Database errors return clean responses | manual-only | Would need integration test with DB connection drop -- not practical in current test setup | N/A |
| EH-04 | Socket.IO handlers have try/catch | manual-only | Code audit -- verify try/catch in socket.ts emit functions and index.ts handlers | N/A |

**Justification for manual-only:** ops-api has no test infrastructure (no Jest config, no test runner). All ops-api tests are in `services/__tests__/` under the Morgan jest config. Error handling validation is best done via code audit (grep patterns) since the changes are structural, not behavioral. The success criteria are verifiable by code inspection.

### Sampling Rate
- **Per task commit:** Code review via grep patterns to confirm no raw access remains
- **Per wave merge:** `npm run build` in ops-api to confirm no TypeScript errors
- **Phase gate:** Full grep audit confirming zero raw `req.body./req.params./req.query.` access outside Zod-parsed contexts

### Wave 0 Gaps
None -- this phase is code audit and modification, not new feature development. No test infrastructure changes needed.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all 17 route files, `helpers.ts`, `socket.ts`, `index.ts`
- Prisma error handling documentation (Prisma error reference for error codes P1xxx, P2xxx)
- Express.js error handling middleware pattern (already implemented in codebase)

### Secondary (MEDIUM confidence)
- Prisma error class hierarchy (`PrismaClientKnownRequestError`, `PrismaClientInitializationError`, `PrismaClientRustPanicError`, `PrismaClientUnknownRequestError`) -- based on Prisma v5.x documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new dependencies
- Architecture: HIGH - patterns already established in codebase, just need gap-filling
- Pitfalls: HIGH - identified through direct code inspection of every route file
- Audit inventory: HIGH - complete file-by-file analysis performed

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable codebase, no external dependency changes expected)
