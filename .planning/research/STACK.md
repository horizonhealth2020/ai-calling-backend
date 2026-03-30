# Technology Stack: v1.9 Auth Stability & Phone Number Display

**Project:** Ops Platform v1.9
**Researched:** 2026-03-30
**Confidence:** HIGH

## Decision: No New Dependencies Required

**Recommendation: This milestone requires zero new libraries.** Both features (auth redirect loop fix and phone number display) are pure application logic changes using the existing stack. Adding dependencies would be overengineering.

## What Exists (Relevant to v1.9)

### Auth Stack (No Changes Needed)

| Technology | Version | Role in v1.9 |
|------------|---------|---------------|
| jsonwebtoken | (via @ops/auth) | Server-side JWT sign/verify -- already handles expiry correctly |
| Next.js Middleware | 15.3.9 | Edge Runtime route guard -- **needs expiry check added** |
| @ops/auth/client | workspace | Browser token management -- **already clears expired tokens** (line 62) |

### Database Stack (Schema Change Only)

| Technology | Version | Role in v1.9 |
|------------|---------|---------------|
| Prisma | (via @ops/db) | Schema migration to add `leadPhone` column |
| PostgreSQL | existing | Storage for phone number data |

### Convoso Integration (Poller Change Only)

| Technology | Version | Role in v1.9 |
|------------|---------|---------------|
| axios | ^1.7.7 | HTTP client for Convoso API -- no changes needed |
| luxon | ^3.4.4 | Timezone-aware timestamp parsing -- no changes needed |

## Why No New Libraries

### Auth Fix: Pure Logic, Not Missing Capability

The redirect loop happens because of a logic gap, not a missing library:

1. **Next.js middleware** (Edge Runtime) decodes JWT base64 to read roles but does NOT check the `exp` claim. An expired token has valid base64, so middleware sees roles and allows access.
2. **ops-api** correctly rejects the expired token via `jsonwebtoken.verify()`.
3. **Client** clears the rejected token and redirects to login page (`/`).
4. **Login page** `useEffect` finds no localStorage token, shows login form. But the **cookie** still has the expired token.
5. **Next visit to a dashboard route**: middleware reads expired cookie, finds roles, allows through. Cycle repeats.

**Fix requires:** Adding `exp` timestamp check in middleware (3 lines of code) + clearing stale localStorage on login page mount. The `atob` + `JSON.parse` already in middleware gives access to `payload.exp`. No crypto library needed because Edge Runtime cannot verify signatures anyway (no access to `AUTH_JWT_SECRET`); the real auth is API-side.

### Phone Number: Schema + Poller Mapping

The Convoso API already returns `phone_number` in call log responses (confirmed: it's listed in `CALL_LOG_PASS_THROUGH_PARAMS` at `call-logs.ts:19`). The poller simply doesn't map it to the database.

**Fix requires:**
1. Prisma migration: add `leadPhone String? @map("lead_phone")` to `ConvosoCallLog` model
2. Poller: map `r.phone_number` or `r.number_dialed` to `leadPhone` in the `callLogRecords` builder
3. Dashboard: add column to call audit and agent sales table components

## Alternatives Considered (and Rejected)

| What | Why Not |
|------|---------|
| `jose` library for Edge Runtime JWT verification | Overkill. We only need to check `exp` (a timestamp comparison), not verify the signature. Signature verification happens at the API layer. Adding `jose` just to decode what `atob` already decodes is unnecessary. |
| `js-cookie` for cookie management | Next.js `cookies()` API and `response.cookies.set/delete` handle everything needed. |
| Phone number formatting library (e.g., `libphonenumber-js`) | Phone numbers come from Convoso already formatted. Display as-is. If formatting is later needed, it's a 10-line utility, not a 200KB library. |
| Separate auth middleware package | The expiry check is 3 lines added to existing `middleware.ts`. Extracting to a package adds indirection for no benefit. |

## Implementation Points (No Install Steps)

### Middleware Expiry Check (Edge Runtime Compatible)

The existing middleware already does `JSON.parse(atob(parts[1]))` to get `payload`. Adding expiry check:

```typescript
// After decoding payload (already exists at middleware.ts:27)
const now = Math.floor(Date.now() / 1000);
if (typeof payload.exp === "number" && payload.exp < now) {
  // Expired token: clear cookie and redirect to login
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
```

This runs in Edge Runtime with zero external dependencies -- just `Date.now()` and integer comparison.

### Login Page Stale Token Cleanup

The `useEffect` on the login page should clear expired tokens before checking for auto-redirect:

```typescript
// In the existing useEffect, before checking stored token
const stored = getToken();
if (stored) {
  const payload = decodeTokenPayload(stored);
  if (payload?.exp && typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    clearToken();
    return; // Show login form, don't redirect
  }
  // ... existing redirect logic
}
```

`decodeTokenPayload` and `clearToken` are already exported from `@ops/auth/client`.

### Prisma Schema Addition

```prisma
model ConvosoCallLog {
  // ... existing fields ...
  leadPhone           String?  @map("lead_phone")
}
```

Migration: `npx prisma migrate dev --name add-lead-phone-to-call-log`

### Poller Phone Capture

In `convosoKpiPoller.ts`, add to the `callLogRecords` mapping (around line 103):

```typescript
leadPhone: (() => {
  const phone = r.phone_number ?? r.number_dialed;
  return phone ? String(phone) : null;
})(),
```

## Existing Dependencies Sufficient

| Capability Needed | Already Have | Version |
|-------------------|-------------|---------|
| JWT decode in Edge Runtime | Native `atob` + `JSON.parse` | Built-in |
| JWT verify on API | `jsonwebtoken` via @ops/auth | Already working |
| Token lifecycle (client) | `@ops/auth/client` | Already has `clearToken`, `decodeTokenPayload` |
| Cookie management (middleware) | `NextResponse.cookies` | Next.js 15.3.9 |
| Schema migration | Prisma CLI | Already configured |
| Convoso HTTP calls | `axios` | ^1.7.7 |
| Dashboard table columns | React inline styles | Existing pattern |

## Sources

- Middleware code reviewed: `apps/ops-dashboard/middleware.ts` (60 lines, full Edge Runtime route guard)
- Auth client reviewed: `packages/auth/src/client.ts` (117 lines, already handles expired tokens client-side)
- Auth server reviewed: `packages/auth/src/index.ts` (50 lines, `jsonwebtoken` verification)
- Login page reviewed: `apps/ops-dashboard/app/page.tsx` (auto-redirect logic in useEffect)
- Convoso poller reviewed: `apps/ops-api/src/workers/convosoKpiPoller.ts` (call log record mapping)
- Prisma schema reviewed: `prisma/schema.prisma` (ConvosoCallLog model at line 473)
- Call logs route reviewed: `apps/ops-api/src/routes/call-logs.ts` (confirms `phone_number` is a known Convoso field)
