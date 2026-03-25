# Phase 27: Error Handling & Robustness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 27-error-handling-robustness
**Areas discussed:** Error response format, Database error handling strategy, Validation gap handling, Socket.IO error scope

---

## Error Response Format

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current minimal format | `{ error: "message" }` for all errors, `{ error, details }` for validation. Simple, already works with all dashboards. | ✓ |
| Standardize with status codes | Add `{ error: "message", statusCode: 400 }` so clients don't need to parse HTTP status separately. | |
| Rich error objects | Add error codes, request IDs, timestamps. More structured but heavier change with dashboard updates needed. | |

**User's choice:** Keep current minimal format
**Notes:** Dashboards already parse `err.error`. Stabilization milestone — no format changes needed.

---

## Database Error Handling Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Catch and return user-friendly messages | Wrap Prisma calls with try/catch, return 503 with "Database temporarily unavailable". No retry logic. | ✓ |
| Catch with retry | Same as above but add one automatic retry with short delay before returning 503. | |
| Keep current behavior | Global error handler already catches everything and returns 500 with "Internal server error". | |

**User's choice:** Catch and return user-friendly messages
**Notes:** Clean 503 responses help dashboards show meaningful feedback without retry complexity.

---

## Validation Gap Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Full coverage | Every route that reads req.body, req.params, or req.query must go through Zod. Includes query params. | ✓ |
| Body and params only | Validate req.body and req.params, leave req.query as-is since query params are optional/cosmetic. | |
| Gap-fill only | Only add Zod to routes that currently have zero validation. Don't touch partial routes. | |

**User's choice:** Full coverage
**Notes:** Matches EH-02 requirement ("no raw property access on unvalidated request data"). Query params can cause unexpected errors if malformed.

---

## Socket.IO Error Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Wrap event handlers and emit calls | Try/catch on both index.ts handlers AND service-side emit utilities. Emit failures logged, never crash requests. | ✓ |
| Event handlers only | Just wrap connection/disconnect handlers. Emits are fire-and-forget. | |
| Emit utilities only | Focus on emit helpers in services since those are called from route handlers. | |

**User's choice:** Wrap event handlers and emit calls
**Notes:** Covers both sides, ensures Socket.IO can never take down a request or crash the server.

---

## Claude's Discretion

- How to organize the audit (by route file, by requirement, or by error type)
- Whether to create a shared Prisma error wrapper utility or inline try/catch
- Grouping of changes into plans and commits

## Deferred Ideas

None — discussion stayed within phase scope
