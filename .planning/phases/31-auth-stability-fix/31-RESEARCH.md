# Phase 31: Auth Stability Fix - Research

**Researched:** 2026-03-30
**Domain:** JWT auth redirect loop fix in Next.js Edge Runtime middleware + client-side login page
**Confidence:** HIGH

## Summary

This phase fixes a production bug where 3 users (nickd, jasmin, juan.a) are stuck in an infinite redirect loop because neither the login page nor the Next.js middleware checks the JWT `exp` claim before redirecting. The fix requires changes to exactly 2 files: `apps/ops-dashboard/middleware.ts` (add expiry check + cookie deletion) and `apps/ops-dashboard/app/page.tsx` (add expiry check + loading state). No new libraries, no database changes, no API changes.

The root cause is well-understood from prior research (`.planning/research/ARCHITECTURE.md` and `.planning/research/PITFALLS.md`). An expired JWT still contains valid `roles`, so both the login page useEffect and the middleware allow the user through. The login page redirects to a dashboard route, middleware lets the request through (roles look fine), the page renders but all API calls fail (ops-api does real JWT verification), and eventually the user ends up back at login where the cycle repeats.

**Primary recommendation:** Fix both middleware and login page together in one atomic change. The middleware adds expiry checking and cookie deletion; the login page adds expiry checking, token clearing, and a loading state to prevent flash.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Auto-clear expired tokens on visit -- no manual action needed from affected users. The fix detects and clears expired tokens automatically. Users just refresh and see the login form.
- **D-02:** No server-side session clearing or user notification required.
- **D-03:** Add a `checking` loading state to the login page. Show a loading indicator while useEffect checks for existing tokens. Only render the login form after token check completes. Prevents the brief form flash for returning users with valid tokens.
- **D-04:** Fix BOTH client and middleware together -- fixing only one creates a different failure mode (Pitfall 2 from research).
- **D-05:** Middleware must delete the `ops_session` cookie when redirecting for expired token -- a redirect alone does not clear cookies.
- **D-06:** Use `atob` + `Date.now()` for expiry check in middleware -- NEVER import `jsonwebtoken` in Edge Runtime (Pitfall 5).
- **D-07:** Reuse existing `decodeTokenPayload()` from `@ops/auth/client` on the login page -- no new utilities needed.

### Claude's Discretion
- Loading indicator design during token check (spinner, blank page, or skeleton)
- Exact placement of expiry check relative to existing middleware logic
- Whether to add a small buffer (e.g., 30 seconds) to the expiry check for clock skew

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | Middleware checks JWT `exp` claim and rejects expired tokens before role check | Middleware file analyzed (line 27-28 payload decode). Insert `exp` check after decode, before role check. Use `payload.exp * 1000 < Date.now()`. Edge Runtime safe via `atob`. |
| AUTH-02 | Middleware deletes `ops_session` cookie when redirecting due to expired token | Use `NextResponse.redirect()` + `response.cookies.delete("ops_session", { path: "/" })`. Cookie is httpOnly so only middleware/server can clear it. Must match `path: "/"` used during creation. |
| AUTH-03 | Login page clears expired localStorage token before attempting auto-redirect | Import `decodeTokenPayload` from `@ops/auth/client`, check `exp * 1000 < Date.now()`, call `clearToken()` if expired. Add `checking` state to prevent form flash. |
</phase_requirements>

## Standard Stack

### Core (already in use -- no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15 | App framework, Edge Runtime middleware | Already deployed; middleware.ts runs in Edge Runtime |
| React | 18+ | Login page component | Already deployed; useEffect for token check |
| @ops/auth/client | local | `decodeTokenPayload`, `getToken`, `clearToken`, `captureTokenFromUrl` | Already exists with all needed utilities |

### Supporting
None -- this fix uses only existing code and browser APIs (`atob`, `Date.now()`, `JSON.parse`).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `atob` + manual decode | `jose` library (Edge-compatible JWT) | Over-engineered; we only need `exp` field, not full verification. Edge Runtime cannot verify signatures anyway (no access to `AUTH_JWT_SECRET`). |
| Loading state in useEffect | Next.js `loading.tsx` | `loading.tsx` is for route transitions, not for client-side token checks on the root page. |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Files Modified
```
apps/ops-dashboard/
  middleware.ts          # Add exp check after payload decode (line ~28), cookie delete on expired
  app/page.tsx           # Add checking state, exp check in useEffect before redirect
```

### Pattern 1: Edge Runtime JWT Expiry Check
**What:** Decode JWT payload using `atob` + base64url replacement, then compare `exp * 1000` to `Date.now()`. Never import `jsonwebtoken` or any Node.js crypto in Edge Runtime.
**When to use:** Any middleware-level auth check in Next.js dashboard.
**Example:**
```typescript
// Source: existing pattern in middleware.ts line 25-29, extended with exp check
const parts = token.split(".");
if (parts.length === 3) {
  const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
  // NEW: check expiry before role check
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete("ops_session", { path: "/" });
    return response;
  }
  roles = payload.roles ?? [];
}
```

### Pattern 2: Cookie Deletion in Middleware Redirect
**What:** When redirecting due to expired token, create the redirect response first, then delete the cookie on the response object before returning it.
**When to use:** Any middleware redirect that should also clear auth state.
**Example:**
```typescript
// Source: Next.js middleware cookies API
const response = NextResponse.redirect(new URL("/", request.url));
response.cookies.delete("ops_session", { path: "/" });
return response;
```

### Pattern 3: Client-Side Loading Gate
**What:** Use a `checking` boolean state that starts `true`, perform token validation in useEffect, then set `checking` to `false`. Render a loading indicator (or nothing) while `checking` is true.
**When to use:** Login pages that auto-redirect valid users.
**Example:**
```typescript
// Source: Decision D-03 from CONTEXT.md
const [checking, setChecking] = useState(true);

useEffect(() => {
  const token = captureTokenFromUrl();
  const toCheck = token || getToken();
  if (toCheck) {
    const payload = decodeTokenPayload(toCheck);
    if (payload?.exp && typeof payload.exp === "number" && payload.exp * 1000 > Date.now()) {
      const roles = decodeRolesFromToken(toCheck);
      if (roles.length > 0) {
        window.location.href = getDefaultTab(roles);
        return; // keep checking=true while redirect happens
      }
    } else if (toCheck) {
      clearToken(); // expired or malformed -- clear it
    }
  }
  setChecking(false);
}, []);

if (checking) return <LoadingIndicator />;
```

### Anti-Patterns to Avoid
- **Importing `jsonwebtoken` in middleware:** Edge Runtime crashes. Use `atob` decode only. (Pitfall 5)
- **Fixing only client OR only middleware:** Creates a different failure mode where one side lets expired tokens through. (Pitfall 2)
- **Redirecting without clearing the cookie:** The redirect alone does not remove the stale cookie, so the loop continues. (Pitfall 3)
- **Clearing httpOnly cookie from client JavaScript:** `document.cookie` cannot access httpOnly cookies. Only middleware or server can delete `ops_session`. (Pitfall 6)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT payload decoding | Custom decoder | `decodeTokenPayload()` from `@ops/auth/client` (login page) or existing `atob` pattern (middleware) | Already exists, tested, handles base64url edge cases |
| Token expiry check utility | New `isTokenExpired()` function | Inline `payload.exp * 1000 < Date.now()` check | Only 2 call sites; a utility adds indirection for no reuse benefit |
| Token clearing | Custom localStorage + cookie clearing | `clearToken()` from `@ops/auth/client` (localStorage) + `response.cookies.delete()` (cookie in middleware) | Existing functions handle each storage correctly |

**Key insight:** Every utility needed for this fix already exists in `@ops/auth/client`. The bug is not missing functionality -- it is missing calls to that functionality.

## Common Pitfalls

### Pitfall 1: Cookie Domain Mismatch on Deletion
**What goes wrong:** Middleware deletes cookie without matching the `domain` attribute used when the cookie was set. Browser ignores the deletion.
**Why it happens:** In production, `buildSessionCookie` in `@ops/auth` sets `domain: process.env.AUTH_COOKIE_DOMAIN`. The middleware sets cookies without an explicit domain. If the login flow set the cookie via the API (with domain) but middleware tries to clear it without domain, deletion fails.
**How to avoid:** Use `response.cookies.delete("ops_session", { path: "/" })` which is the Next.js standard way. Test on production domain. The middleware-set cookie (line 44-50) does NOT set an explicit domain, so the deletion with `path: "/"` should match for middleware-set cookies. For API-set cookies (with `AUTH_COOKIE_DOMAIN`), the stale cookie will be overwritten on next successful login.
**Warning signs:** After deploying fix, users still report redirect loops. Check Application > Cookies in DevTools for duplicate `ops_session` cookies with different domains.

### Pitfall 2: Clock Skew Between Server and Client
**What goes wrong:** Server signs JWT with `exp` based on its clock. Client/middleware checks `Date.now()` against `exp`. If clocks differ by more than a few seconds, tokens may be rejected early or accepted late.
**Why it happens:** Distributed systems inherently have clock skew.
**How to avoid:** Optional 30-second buffer on the check: `payload.exp * 1000 + 30000 < Date.now()` (treat token as expired only 30 seconds after `exp`). This is Claude's discretion per CONTEXT.md.
**Warning signs:** Users report being logged out slightly before 12h mark.

### Pitfall 3: Login Page Flash During Token Check
**What goes wrong:** Without a loading gate, the login form renders for a fraction of a second before the useEffect fires and redirects a valid user.
**Why it happens:** React renders the component body synchronously, then runs useEffect after paint.
**How to avoid:** Decision D-03 requires a `checking` loading state. Start with `checking = true`, only render the form when `checking = false`. Show a minimal loading indicator during the check.
**Warning signs:** Valid users see a brief flash of the login form on every page visit.

## Code Examples

### Middleware: Complete Expiry Check (AUTH-01 + AUTH-02)
```typescript
// Source: middleware.ts -- insert exp check after payload decode, before role check
// After line 28 (existing: payload = JSON.parse(atob(...)))

// Check token expiry (Edge Runtime: decode only, no jwt.verify)
if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(AUTH_COOKIE_NAME, { path: "/" });
  return response;
}
```

### Login Page: Expiry-Aware useEffect (AUTH-03)
```typescript
// Source: page.tsx -- replace existing useEffect (lines 234-250)
import { captureTokenFromUrl, getToken, clearToken, decodeTokenPayload } from "@ops/auth/client";

const [checking, setChecking] = useState(true);

useEffect(() => {
  const token = captureTokenFromUrl();
  const stored = token || getToken();

  if (stored) {
    const payload = decodeTokenPayload(stored);
    const isExpired = !payload?.exp || typeof payload.exp !== "number" || payload.exp * 1000 <= Date.now();

    if (isExpired) {
      clearToken();
    } else {
      const roles = decodeRolesFromToken(stored);
      if (roles.length > 0) {
        window.location.href = getDefaultTab(roles);
        return; // stay in checking state during redirect
      }
    }
  }
  setChecking(false);
}, []);
```

### Loading Gate in Render
```typescript
// Source: Decision D-03 -- loading indicator during token check
if (checking) {
  return (
    <main style={BG}>
      <div style={BG_MESH} aria-hidden="true" />
      <div style={{ ...CARD, display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
        {/* Simple spinner or skeleton -- Claude's discretion */}
      </div>
    </main>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Trust middleware role check only | Middleware checks both roles AND expiry | This fix | Prevents expired tokens from rendering dashboard |
| Login page trusts any stored token | Login page validates expiry before redirect | This fix | Prevents redirect loop for expired tokens |
| No loading state on login page | Loading gate during token check | This fix | Eliminates form flash for returning users |

**Deprecated/outdated:**
- `decodeRolesFromToken()` in `apps/ops-dashboard/lib/auth.ts` only checks roles, not expiry. It remains usable but should always be called AFTER an expiry check.

## Open Questions

1. **Clock skew buffer**
   - What we know: JWT tokens are signed with 12h expiry by ops-api. Middleware and client both use `Date.now()` for comparison.
   - What's unclear: Whether Railway infra has significant clock skew between API server and client browsers.
   - Recommendation: Add a 30-second buffer (Claude's discretion). Minimal risk, prevents edge case logouts.

2. **Duplicate cookies with different domains**
   - What we know: Middleware sets cookies without explicit domain. `buildSessionCookie` sets domain via `AUTH_COOKIE_DOMAIN`. These could create two separate cookies.
   - What's unclear: Whether any users have cookies set by both paths.
   - Recommendation: Middleware deletion will clear middleware-set cookies. API-set cookies with a domain will be overwritten on next login. Monitor after deployment.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (configured for apps/morgan only) |
| Config file | `apps/morgan/jest.config.js` (no config for ops-dashboard) |
| Quick run command | `npm test` (runs Morgan tests only) |
| Full suite command | `npm test` (same -- only Morgan) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Middleware rejects expired JWT before role check | manual-only | N/A -- Edge Runtime middleware cannot be unit tested without Next.js test harness | No test infra for ops-dashboard |
| AUTH-02 | Middleware deletes ops_session cookie on expired redirect | manual-only | N/A -- same as above | No test infra |
| AUTH-03 | Login page clears expired localStorage token before redirect | manual-only | N/A -- React component with browser APIs (localStorage, window.location) requires JSDOM + component testing setup | No test infra |

**Manual test protocol (all 3 requirements):**
1. Log in to get a valid session
2. Wait for token expiry (or manually edit JWT `exp` in localStorage/cookie to a past timestamp using DevTools)
3. Navigate to a dashboard route (e.g., `/manager`)
4. Verify: redirected to `/` exactly once, no loop
5. Verify: `ops_session` cookie is gone from Application > Cookies
6. Verify: `ops_session_token` is gone from Application > Local Storage
7. Verify: login form renders without flash
8. Log in again -- verify normal access resumes

### Sampling Rate
- **Per task commit:** Manual browser test with expired token
- **Per wave merge:** Full manual protocol above
- **Phase gate:** All 4 success criteria verified manually before `/gsd:verify-work`

### Wave 0 Gaps
None required -- no automated test infrastructure exists for ops-dashboard, and setting one up is out of scope for a 2-file bug fix. Manual testing is sufficient for this phase.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `apps/ops-dashboard/middleware.ts` (59 lines, full file read)
- Direct code inspection of `apps/ops-dashboard/app/page.tsx` (525 lines, full file read)
- Direct code inspection of `packages/auth/src/client.ts` (117 lines, full file read)
- Direct code inspection of `packages/auth/src/index.ts` (50 lines, full file read)
- Direct code inspection of `apps/ops-dashboard/lib/auth.ts` (18 lines, full file read)
- Direct code inspection of `apps/ops-dashboard/lib/roles.ts` (34 lines, full file read)
- `.planning/research/PITFALLS.md` -- 12 pitfalls catalogued with line-level tracing
- `.planning/research/ARCHITECTURE.md` -- Full auth redirect data flow analysis

### Secondary (MEDIUM confidence)
- Next.js middleware cookies API (`response.cookies.delete`) -- consistent with Next.js 15 Edge Runtime API

### Tertiary (LOW confidence)
- None -- all findings verified from source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all existing code inspected
- Architecture: HIGH -- exact line numbers identified, data flow traced end-to-end
- Pitfalls: HIGH -- root cause confirmed by reading all 5 files involved in the redirect loop

**Research date:** 2026-03-30
**Valid until:** Indefinite (fixes production bug in existing codebase, no external dependency drift)
