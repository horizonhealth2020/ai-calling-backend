# Phase 27: Error Handling & Robustness - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden the ops-api so bad input, connection failures, and edge cases return clean JSON errors — never crashes, never raw error leaks. No new features, no behavior changes beyond error responses.

</domain>

<decisions>
## Implementation Decisions

### Error Response Format
- **D-01:** Keep current minimal `{ error: "message" }` format. No changes to error shape — dashboards already parse `err.error` and this is a stabilization milestone.
- **D-02:** Validation errors continue to return `{ error: "message", details: {...} }` via `zodErr()`.

### Database Error Handling
- **D-03:** Wrap Prisma calls that could fail on connection/timeout with try/catch. Return `{ error: "Database temporarily unavailable" }` with 503 status.
- **D-04:** No retry logic — just clean error responses. Log the raw Prisma error server-side for debugging.
- **D-05:** Ensure no raw Prisma error messages ever leak to API clients.

### Validation Coverage
- **D-06:** Full Zod coverage — every route that reads from `req.body`, `req.params`, or `req.query` must go through a Zod schema before use. No raw property access on unvalidated request data.
- **D-07:** Includes query params (date ranges, pagination, filters). Bad query values should return 400 with a clear validation error, not silently pass through.
- **D-08:** All Zod errors must use `zodErr()` wrapper (per CLAUDE.md convention).

### Socket.IO Error Handling
- **D-09:** Wrap both event handlers in `index.ts` AND service-side emit utility functions with try/catch.
- **D-10:** If an emit fails, log the error but never crash the request that triggered it. Socket.IO is fire-and-forget from the request's perspective.

### Claude's Discretion
- How to organize the audit (by route file, by requirement, or by error type)
- Whether to create a shared Prisma error wrapper utility or inline try/catch per call
- Grouping of changes into plans and commits

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Error Handling Patterns
- `apps/ops-api/src/routes/helpers.ts` — `asyncHandler()` and `zodErr()` definitions, the foundation all routes use
- `apps/ops-api/src/index.ts` — Global Express error handler (lines 38-45) and Socket.IO setup (lines 58-63)

### Route Files (audit scope)
- `apps/ops-api/src/routes/*.ts` — 17 route files that need asyncHandler and Zod validation audit

### Requirements
- `.planning/REQUIREMENTS.md` — EH-01 through EH-04 acceptance criteria

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `asyncHandler()` in `routes/helpers.ts` — wraps async handlers to forward errors to Express error handler. Already used in 19 files.
- `zodErr()` in `routes/helpers.ts` — formats Zod errors with `{ error, details }` shape. Already used in 18 files.
- Global error handler in `index.ts` — catches all forwarded errors, returns `{ error: "message" }` with appropriate status code.

### Established Patterns
- Every route file imports `asyncHandler` and `zodErr` from `./helpers`
- Zod schemas declared inline at handler scope or module-level when reused
- `const parsed = schema.safeParse(req.body)` followed by `if (!parsed.success) return res.status(400).json(zodErr(parsed.error))`

### Integration Points
- Socket.IO emit utilities in service files (`emitSaleChanged`, `emitCSChanged`) — need try/catch wrappers
- Socket.IO event handlers in `apps/ops-api/src/index.ts` — connection/disconnect handlers
- All 17 route files under `apps/ops-api/src/routes/` — audit targets for asyncHandler and Zod coverage

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 27-error-handling-robustness*
*Context gathered: 2026-03-25*
