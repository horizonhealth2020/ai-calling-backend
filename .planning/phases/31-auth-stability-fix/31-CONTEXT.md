# Phase 31: Auth Stability Fix - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix the production login redirect loop affecting 3 users (nickd, jasmin, juan.a). Users with expired tokens must be cleanly redirected to the login form instead of stuck in an infinite redirect loop. The root cause is that neither the login page useEffect nor the Next.js middleware checks the JWT `exp` claim before redirecting.

</domain>

<decisions>
## Implementation Decisions

### User recovery
- **D-01:** Auto-clear expired tokens on visit — no manual action needed from affected users. The fix detects and clears expired tokens automatically. Users just refresh and see the login form.
- **D-02:** No server-side session clearing or user notification required.

### Login page flash prevention
- **D-03:** Add a `checking` loading state to the login page. Show a loading indicator while useEffect checks for existing tokens. Only render the login form after token check completes. Prevents the brief form flash for returning users with valid tokens.

### Auth fix scope (from research)
- **D-04:** Fix BOTH client and middleware together — fixing only one creates a different failure mode (Pitfall 2 from research).
- **D-05:** Middleware must delete the `ops_session` cookie when redirecting for expired token — a redirect alone does not clear cookies.
- **D-06:** Use `atob` + `Date.now()` for expiry check in middleware — NEVER import `jsonwebtoken` in Edge Runtime (Pitfall 5).
- **D-07:** Reuse existing `decodeTokenPayload()` from `@ops/auth/client` on the login page — no new utilities needed.

### Claude's Discretion
- Loading indicator design during token check (spinner, blank page, or skeleton)
- Exact placement of expiry check relative to existing middleware logic
- Whether to add a small buffer (e.g., 30 seconds) to the expiry check for clock skew

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth client
- `packages/auth/src/client.ts` — Token lifecycle: captureTokenFromUrl, getToken, clearToken, decodeTokenPayload, ensureTokenFresh
- `packages/auth/src/index.ts` — Server-side: buildSessionCookie (cookie domain config), signSessionToken (12h expiry)

### Middleware
- `apps/ops-dashboard/middleware.ts` — Edge Runtime route guard, cookie reading, JWT decode without verification, cookie setting on session_token param

### Login page
- `apps/ops-dashboard/app/page.tsx` — Login page with useEffect auto-redirect logic (lines 234-250)
- `apps/ops-dashboard/lib/auth.ts` — decodeRolesFromToken (no expiry check)
- `apps/ops-dashboard/lib/roles.ts` — getDefaultTab, TAB_ROLES

### Research
- `.planning/research/PITFALLS.md` — 12 pitfalls, 3 critical (cookie deletion, client+middleware together, cookie domain mismatch)
- `.planning/research/ARCHITECTURE.md` — Auth redirect data flow diagrams, integration points, fix architecture

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `decodeTokenPayload()` from `@ops/auth/client` — already decodes JWT and returns `{ exp, roles, ... }`. Login page should use this instead of duplicating logic.
- `clearToken()` from `@ops/auth/client` — removes token from localStorage.
- `NextResponse.cookies.delete()` — available in Edge Runtime for cookie clearing in middleware.

### Established Patterns
- Middleware uses `atob` + `JSON.parse` for JWT decode (Edge Runtime compatible, no Node.js crypto).
- Login page imports from `@ops/auth/client` for token management.
- Cookie is set with `httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 43200` (12h).

### Integration Points
- `middleware.ts` line 27 — payload decode happens here, expiry check inserts after this line
- `page.tsx` line 234-250 — useEffect auto-redirect logic, expiry check wraps the existing stored token check
- Cookie is `httpOnly` — cannot be cleared from client JavaScript, only middleware can delete it

</code_context>

<specifics>
## Specific Ideas

No specific requirements — the fix is well-defined from research. Standard implementation of JWT expiry checking.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 31-auth-stability-fix*
*Context gathered: 2026-03-30*
