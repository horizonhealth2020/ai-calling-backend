# Domain Pitfalls

**Domain:** JWT auth redirect loop fix + phone number display in existing ops platform
**Researched:** 2026-03-30
**Confidence:** HIGH (based on direct codebase analysis with line-level tracing)

## Critical Pitfalls

Mistakes that cause the fix to fail, create new bugs, or break production for all users.

### Pitfall 1: Redirect Loop From Stale Token Without Expiry Check

**What goes wrong:** The login page `useEffect` (line 234-250 of `app/page.tsx`) finds a token in localStorage via `getToken()`, decodes roles, and redirects to the dashboard. The middleware then checks the cookie, finds it expired or missing, and redirects back to `/`. The login page fires the useEffect again, finds the same stale localStorage token, redirects to dashboard, middleware bounces back -- infinite loop.

**Why it happens:** The login page checks `if (stored)` and `if (roles.length > 0)` but never checks token expiry. The `decodeRolesFromToken` function (line 8-18 of `lib/auth.ts`) only decodes roles, it does not check the `exp` claim. An expired token still has valid roles, so the redirect fires every time.

**Consequences:** 3 users currently locked out. Browser tab burns CPU in redirect loop. Users cannot log in without manually clearing localStorage via DevTools -- something non-technical users cannot do.

**Prevention:**
1. Before redirecting in the login page useEffect, decode the token payload and check `exp * 1000 > Date.now()`. If expired, call `clearToken()` and stay on the login page.
2. The `@ops/auth/client` package already has `decodeTokenPayload` which returns `exp`. Use it directly rather than duplicating logic.
3. Add a `isTokenExpired(token: string): boolean` utility to `@ops/auth/client` for reuse.

**Detection:** Users report "page keeps refreshing" or "can't log in." Network tab shows rapid 302 redirects between `/` and `/manager` (or other dashboard path).

### Pitfall 2: Fixing Client Without Fixing Middleware Creates a Different Failure Mode

**What goes wrong:** Developer fixes the login page to check expiry and clear stale tokens, but the middleware (line 6-55 of `middleware.ts`) still has no expiry check. A user with a valid cookie containing an expired JWT hits a dashboard route. Middleware decodes the JWT payload (line 24-31) to extract roles but never checks the `exp` field. It trusts any syntactically valid JWT. User lands on the dashboard, but every `authFetch` API call fails with 401 because `ops-api` does real JWT verification via `jsonwebtoken.verify()`.

**Why it happens:** The middleware was designed as a lightweight role check with the comment "Real auth is enforced by ops-api on every API call" (line 22). This is fine for authorization, but without expiry checking, the middleware allows expired sessions to render the dashboard chrome before all data fetches fail.

**Consequences:** User lands on dashboard but sees empty data, broken API calls, or gets silently logged out when `ensureTokenFresh` (line 52-93 of `client.ts`) clears the expired token. Confusing UX where the page loads but nothing works.

**Prevention:**
1. In middleware, after decoding the JWT payload, check `payload.exp * 1000 > Date.now()`. If expired, delete the cookie and redirect to `/`.
2. Edge Runtime supports `Date.now()` and `atob` -- no Node.js-only APIs needed. This is safe.
3. Add a small buffer (e.g., 30 seconds) to avoid race conditions where the token expires between middleware check and API call.

**Detection:** Dashboard loads with empty KPI cards, 401 errors in browser console on all `authFetch` calls.

### Pitfall 3: Cookie Deletion in Middleware Uses Wrong Attributes

**What goes wrong:** When middleware detects an expired token and tries to clear the cookie, the `Set-Cookie` header must match the exact `domain` and `path` used when the cookie was set. If they don't match, the browser ignores the deletion and the stale cookie persists.

**Why it happens:** The cookie is set in middleware (line 44-50) with `path: "/"`, `secure: true`, `sameSite: "lax"`, no explicit domain. But in production, the `buildSessionCookie` in `@ops/auth` (line 30-38 of `index.ts`) sets `domain: process.env.AUTH_COOKIE_DOMAIN`. If the login flow sets the cookie via the API (which uses `buildSessionCookie` with a domain) but middleware tries to clear a cookie without specifying that domain, the browser ignores the deletion.

**Consequences:** Expired cookie cannot be cleared by middleware. User gets stuck even after the fix is deployed.

**Prevention:**
1. When clearing the cookie in middleware, use `response.cookies.delete("ops_session", { path: "/" })` -- Next.js handles matching.
2. Alternatively, set `maxAge: 0` with the same `path`, `secure`, `sameSite`, and `domain` values used during creation.
3. Test cookie deletion on Railway production domain, not just localhost where domain is absent.

**Detection:** After deploying the fix, check if the `ops_session` cookie persists after it should have been cleared. Examine Application > Cookies panel in DevTools.

### Pitfall 4: Phone Number Column Added to Schema But Poller Not Updated

**What goes wrong:** Developer adds a `leadPhone` field to the `ConvosoCallLog` model in `schema.prisma` and creates a migration. The poller (line 99-127 of `convosoKpiPoller.ts`) maps Convoso response fields to the `callLogRecords` object but explicitly picks only `user_id`, `recording`, `call_length`, `call_date`, and `start_time` fields. If the phone field is added to the model but the poller's mapping isn't updated, every new record also has NULL for phone.

**Why it happens:** The schema change and the data ingestion code are in different files (`schema.prisma` vs `convosoKpiPoller.ts`). It is easy to update one and forget the other.

**Consequences:** Phone column exists but is always empty. Feature appears broken even though the schema change worked. Historical records also have no phone data.

**Prevention:**
1. Update the poller `callLogRecords` mapping to capture the phone number field from the Convoso response in the SAME commit as the schema change.
2. Verify which Convoso response field contains the phone number. Based on common Convoso API patterns, it is likely `phone_number`, `lead_phone`, or `number`. Log a sample raw Convoso response to confirm before coding.
3. For historical backfill, accept that pre-migration records won't have phone numbers. The poller's backfill logic (line 158-224) only updates `recordingUrl` and `callDurationSeconds` -- extending it to also backfill phone numbers on re-fetch is possible but low priority.

**Detection:** After deployment, check `SELECT lead_phone FROM convoso_call_logs WHERE lead_phone IS NOT NULL LIMIT 5` -- if empty after new polls have run, the field mapping is wrong.

## Moderate Pitfalls

### Pitfall 5: Edge Runtime Breakage From Node.js Imports

**What goes wrong:** While adding expiry checking to middleware, a developer imports `jsonwebtoken` or `@ops/auth` (server-side) to reuse `verifySessionToken`. The middleware crashes because `jsonwebtoken` uses Node.js `crypto` internals that are not available in Edge Runtime.

**Why it happens:** The existing middleware already avoids this (line 21-22: "Edge Runtime can't access secrets"), but the temptation to "properly verify" the JWT is strong when you're already touching the middleware for the expiry fix.

**Prevention:** Keep `atob` with the URL-safe replacement for JWT decoding. Only decode and check `exp`, never call `jwt.verify()` in middleware. Add a comment: `// Edge Runtime: jwt.verify() unavailable, expiry check only`.

### Pitfall 6: Race Condition Between localStorage Clear and Cookie Clear

**What goes wrong:** The login page clears localStorage (`clearToken()`), but the cookie persists until the next server request. If the user navigates to a dashboard route between clearing localStorage and the cookie being cleared, middleware sees the cookie and lets them through, but client-side `getToken()` returns null so `authFetch` sends no Bearer token.

**Prevention:**
1. When clearing the expired token on the login page, both localStorage AND cookie should be cleared. Use a logout API call or set `document.cookie` to expire `ops_session` client-side. However, the cookie is `httpOnly: true` (line 45 of middleware.ts), so `document.cookie` cannot clear it.
2. The correct approach: redirect to `/` (login page) via `window.location.href` after clearing localStorage. The middleware matcher (line 57-59) doesn't cover `/`, so no cookie check fires. The stale cookie will be overwritten on next successful login.

### Pitfall 7: Phone Number Display Leaking PII to Unauthorized Roles

**What goes wrong:** Phone numbers are added to API responses for call audit or agent sales endpoints. All roles that can view those endpoints now see phone numbers, even if some roles (e.g., CUSTOMER_SERVICE) shouldn't have access to lead contact info.

**Prevention:**
1. Review which roles access the affected endpoints.
2. Phone numbers should only be visible to MANAGER, OWNER_VIEW, and SUPER_ADMIN roles.
3. If the endpoint is shared across roles, conditionally strip phone numbers from the response based on the requesting user's role.

### Pitfall 8: Adding leadPhone to Sale Model Creates Denormalization

**What goes wrong:** Developer adds a `leadPhone` column directly to the `Sale` model, duplicating data already available through Convoso call data. Now there are two sources of truth. If Convoso data is corrected, the Sale record has stale data.

**Why it happens:** It seems simpler to put phone on Sale directly than to join through ConvosoCallLog. The Sale model already has `convosoLeadId` and `recordingUrl` fields (line 211-214 of schema) suggesting some Convoso data is already denormalized.

**Prevention:**
1. Store phone number ONLY on `ConvosoCallLog` (it originates from Convoso, not from sale entry).
2. For the agent sales view, join through the existing relationship chain: Sale has `leadSourceId` and `convosoLeadId`. The ConvosoCallLog has `leadSourceId` and `agentId`. A direct FK from Sale to ConvosoCallLog would be cleanest if a reliable mapping exists (e.g., matching by agent + timestamp proximity).
3. If the join is too complex and phone on Sale is pragmatically necessary, document it as intentional denormalization and populate it from Convoso data during sale entry, not as a separate migration.

### Pitfall 9: Prisma Explicit Select Statements Miss New Field

**What goes wrong:** Adding `leadPhone String? @map("lead_phone")` to ConvosoCallLog is a safe additive migration. But if any existing Prisma queries use `select: { field1: true, field2: true }` with an explicit field list, the new field is excluded by default. The API endpoint returns data without the phone field, and the frontend shows blank.

**Prevention:**
1. After adding the schema field, search for all `prisma.convosoCallLog.findMany` (and `findFirst`, etc.) calls. If they use explicit `select`, add `leadPhone: true` to each one.
2. If they use no `select` (return all fields), the new field is included automatically.
3. Grep for `convosoCallLog` across the routes directory to find all query sites.

## Minor Pitfalls

### Pitfall 10: Login Page Flash Before Redirect

**What goes wrong:** After fixing the expiry check, the login page briefly renders (form visible) before the useEffect fires and redirects a user with a valid token. This creates a visual flash.

**Prevention:** Add a `checking` state that starts as `true`, render a loading spinner while checking the token, and only show the login form when `checking` is `false` and no valid token was found.

### Pitfall 11: Convoso Phone Number Format Inconsistency

**What goes wrong:** Convoso may return phone numbers in different formats: `+15551234567`, `5551234567`, `(555) 123-4567`. Displaying raw values creates an inconsistent UI.

**Prevention:** Store the raw value in the database. Format only at display time with a simple utility: strip to digits, then format as `(XXX) XXX-XXXX` for US numbers. Add the formatter to `@ops/utils` for consistency.

### Pitfall 12: Middleware Matcher Doesn't Cover All Protected Routes

**What goes wrong:** The middleware matcher (line 57-59) covers `/manager/:path*`, `/payroll/:path*`, `/owner/:path*`, `/cs/:path*`. If new dashboard routes are added outside these prefixes, they bypass middleware entirely. Not a current issue, but worth noting for awareness.

**Prevention:** If adding new top-level routes, update the matcher array.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Auth redirect loop fix | Pitfall 1 (stale token redirect) + Pitfall 2 (middleware gap) | Fix BOTH client and middleware in same phase; test with expired token in both localStorage AND cookie |
| Auth redirect loop fix | Pitfall 3 (cookie domain mismatch) | Test cookie clearing on Railway production domain, not just localhost |
| Auth redirect loop fix | Pitfall 5 (Edge Runtime breakage) | Never import `jsonwebtoken` in middleware; use `atob` + `exp` check only |
| Auth redirect loop fix | Pitfall 6 (race condition) | Accept stale cookie gets overwritten on next login; don't try to clear httpOnly cookie from client |
| Phone number: schema | Pitfall 4 (poller not updated) | Update schema + poller mapping in same commit; verify Convoso field name first |
| Phone number: schema | Pitfall 8 (denormalization) | Store on ConvosoCallLog only; join to Sale through existing fields or new FK |
| Phone number: schema | Pitfall 9 (select statements) | Grep for all `convosoCallLog` queries and add new field to explicit selects |
| Phone number: display | Pitfall 7 (PII leakage) | Review role access on affected endpoints before adding phone to response |
| Phone number: display | Pitfall 11 (format inconsistency) | Normalize at display time with shared formatter in @ops/utils |
| Database migration | Make new column nullable (`String?`) so migration is additive ALTER TABLE only |

## Sources

- Direct codebase analysis with line references:
  - `apps/ops-dashboard/middleware.ts` (Edge Runtime JWT decoding, cookie setting, matcher config)
  - `apps/ops-dashboard/app/page.tsx` (login page useEffect redirect logic)
  - `apps/ops-dashboard/lib/auth.ts` (decodeRolesFromToken -- no expiry check)
  - `packages/auth/src/client.ts` (captureTokenFromUrl, getToken, clearToken, decodeTokenPayload, ensureTokenFresh)
  - `packages/auth/src/index.ts` (buildSessionCookie with AUTH_COOKIE_DOMAIN, signSessionToken with 12h expiry)
  - `apps/ops-api/src/workers/convosoKpiPoller.ts` (Convoso data mapping, field extraction)
  - `prisma/schema.prisma` (ConvosoCallLog model line 473, Sale model line 189)

---
*Pitfalls research for: v1.9 Auth Stability & Phone Number Display*
*Researched: 2026-03-30*
