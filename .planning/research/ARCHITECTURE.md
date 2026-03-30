# Architecture Patterns

**Domain:** Auth stability fix + phone number display for existing ops platform
**Researched:** 2026-03-30

## Current Architecture (Relevant Subset)

```
Browser (login page)                    Next.js Middleware (Edge)
  |                                       |
  | useEffect: captureTokenFromUrl()      | Reads ops_session cookie
  | checks localStorage token             | Decodes JWT (no verification)
  | decodeRolesFromToken()                | Checks roles vs TAB_ROLES
  | redirects to getDefaultTab()          | Redirects to / if no token
  |                                       |
  v                                       v
ops-dashboard pages  --- authFetch() ---> ops-api (Express)
                                            |
                                            | requireAuth middleware
                                            | verifySessionToken (full JWT verify)
                                            |
                                            v
                                         Prisma/PostgreSQL
```

```
Convoso API  <--- poller (10min) --- convosoKpiPoller.ts
  |                                       |
  | returns: phone_number,                | writes: ConvosoCallLog
  |   number_dialed, user_id,             |   (agentUser, listId, recordingUrl,
  |   call_date, recording, etc.          |    callDurationSeconds, callTimestamp,
  |                                       |    agentId, leadSourceId)
  |                                       |
  |                                       | NOTE: phone_number NOT currently stored
  v                                       v
ConvosoCallLog ----> CallAudit (1:1 via callAuditId)
                     Sale (no direct FK to ConvosoCallLog)
```

## Integration Point 1: Auth Redirect Loop Fix

### Root Cause

The login page (`app/page.tsx` lines 234-250) has a useEffect that checks for an existing localStorage token and auto-redirects:

```typescript
useEffect(() => {
  const token = captureTokenFromUrl();
  if (!token) {
    const stored = getToken();
    if (stored) {
      const roles = decodeRolesFromToken(stored);
      if (roles.length > 0) {
        window.location.href = getDefaultTab(roles);  // redirect to /owner, /manager, etc.
      }
    }
    return;
  }
  // ...
}, []);
```

The middleware (`middleware.ts` lines 6-54) runs on `/manager/:path*`, `/payroll/:path*`, `/owner/:path*`, `/cs/:path*`. It decodes the JWT but does NOT check `exp`:

```typescript
const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
roles = payload.roles ?? [];
// No expiry check here
```

**The loop:** When a token is expired:
1. User lands on login page `/`
2. useEffect finds token in localStorage, decodes roles (roles are present even in expired tokens)
3. Redirects to `/owner` (or similar)
4. Middleware finds expired cookie, decodes roles (no exp check), lets request through
5. Page loads, authFetch calls ensureTokenFresh, finds token expired, calls clearToken()
6. But the page already rendered. On next navigation or API call, no token exists
7. Actually -- the middleware may also redirect back to `/` if cookie is cleared. Or the user refreshes and the cookie is stale.

The specific production scenario: the `ops_session` cookie has a 12h maxAge matching the JWT. If the cookie outlives the JWT (clock skew, or cookie set slightly before JWT), middleware sees a token, decodes roles fine (roles don't expire), but all API calls fail because ops-api does full verification.

### Fix Architecture

Two changes needed, both defensive:

**Change A: Login page useEffect -- check token expiry before redirect**

| What | Where | Type |
|------|-------|------|
| Add expiry check | `apps/ops-dashboard/app/page.tsx` useEffect (line ~238) | MODIFY existing |
| Reuse decodeTokenPayload | Import from `@ops/auth/client` | USE existing |

The `@ops/auth/client` already exports `decodeTokenPayload()` which returns `{ exp, roles, ... }`. The login page currently imports `captureTokenFromUrl` and `getToken` from `@ops/auth/client` and `decodeRolesFromToken` from `@/lib/auth`.

**Implementation:** After getting the stored token, decode it with `decodeTokenPayload`, check `exp * 1000 < Date.now()`, and if expired call `clearToken()` instead of redirecting.

**Change B: Middleware -- add exp check for defense-in-depth**

| What | Where | Type |
|------|-------|------|
| Add exp check after decoding JWT payload | `apps/ops-dashboard/middleware.ts` (after line 28) | MODIFY existing |

The middleware already decodes the payload (line 27-28). Add: if `payload.exp * 1000 < Date.now()`, clear the cookie and redirect to `/`.

**Cookie clearing in middleware:** Edge Runtime supports `response.cookies.delete()`. Set maxAge to 0 on redirect.

### Component Boundaries

```
@ops/auth/client (NO CHANGES)
  - decodeTokenPayload() already handles exp extraction
  - ensureTokenFresh() already clears expired tokens
  - These work correctly; the bug is that login page doesn't use them

apps/ops-dashboard/app/page.tsx (MODIFY)
  - Import decodeTokenPayload from @ops/auth/client
  - Add isTokenExpired check in useEffect before redirect

apps/ops-dashboard/middleware.ts (MODIFY)
  - Add exp check after payload decode
  - Clear cookie on expired token redirect
```

### Data Flow (After Fix)

```
User hits /  (login page)
  |
  useEffect fires
  |
  captureTokenFromUrl() -- checks URL param, stores to localStorage
  |
  Has stored token?
  |-- No  --> show login form
  |-- Yes --> decodeTokenPayload(token)
              |
              Is exp * 1000 < Date.now()?
              |-- Yes --> clearToken(), show login form
              |-- No  --> decodeRolesFromToken() --> redirect to dashboard
                            |
                            Middleware intercepts
                            |
                            Decode payload, check exp
                            |-- Expired --> delete cookie, redirect to /
                            |-- Valid   --> check roles, proceed
```

## Integration Point 2: Phone Number in Call Audits

### Current State

- `ConvosoCallLog` model has NO phone field
- `CallAudit` model has NO phone field
- `CallAudit` has a 1:1 relation to `ConvosoCallLog` via `callAuditId`
- The Convoso API returns `phone_number` and `number_dialed` in raw response
- The poller (`convosoKpiPoller.ts` lines 99-127) maps specific fields but ignores phone data
- The call-audits API endpoint (line 41-46) does `include: { agent: { ... } }` but NOT `convosoCallLog`
- The list endpoint returns no phone; the detail endpoint (line 52-57) includes `convosoCallLog` with limited select

### Architecture Decision: Store phone on ConvosoCallLog

**Why ConvosoCallLog, not CallAudit:** The phone number comes from Convoso, not from the audit process. Storing it on the source record keeps the data model clean. CallAudit already has a 1:1 relation to ConvosoCallLog, so the join is trivial.

### Changes Required

| What | Where | Type |
|------|-------|------|
| Add `leadPhone` field to ConvosoCallLog | `prisma/schema.prisma` | MODIFY |
| Migration to add column | `prisma/migrations/` | NEW |
| Store phone_number in poller | `apps/ops-api/src/workers/convosoKpiPoller.ts` (line ~103) | MODIFY |
| Include convosoCallLog.leadPhone in call-audits list | `apps/ops-api/src/routes/call-audits.ts` (line ~41) | MODIFY |
| Add Phone column to ManagerAudits table | `apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx` | MODIFY |

### Schema Change

```prisma
model ConvosoCallLog {
  // ... existing fields ...
  leadPhone   String?  @map("lead_phone")    // NEW
  // ... rest unchanged ...
}
```

Single nullable field. No FK. No index needed (display only, not queried by).

### Data Flow

```
Convoso API response
  { phone_number: "5551234567", ... }
  |
  convosoKpiPoller.ts -- pollLeadSource()
  |  Extract: String(r.phone_number ?? r.number_dialed ?? "")
  |  Store as leadPhone in callLogRecords
  |
  ConvosoCallLog table (lead_phone column)
  |
  GET /api/call-audits
  |  include: { convosoCallLog: { select: { leadPhone: true } } }
  |  Flatten in response or let client traverse
  |
  ManagerAudits.tsx
  |  Add "Phone" column to table header
  |  Display a.convosoCallLog?.leadPhone ?? "--"
```

### API Response Shape Change

Current call-audits list response:
```json
{ "id": "...", "agentId": "...", "callDate": "...", "agent": { "id": "...", "name": "..." }, ... }
```

After change:
```json
{ "id": "...", "agentId": "...", "callDate": "...", "agent": { "id": "...", "name": "..." }, "convosoCallLog": { "leadPhone": "5551234567" }, ... }
```

The client TypeScript type `CallAudit` in ManagerAudits.tsx needs a new optional field:
```typescript
convosoCallLog?: { leadPhone?: string | null };
```

## Integration Point 3: Phone Number in Agent Sales

### Current State

- `Sale` model has `convosoLeadId` (string, nullable) but no phone field
- Sales are entered manually via the manager form, not created by the poller
- There is no direct FK from Sale to ConvosoCallLog
- The sales list API returns full agent, product, leadSource includes but no phone

### Architecture Decision: Add leadPhone directly to Sale

**Why on Sale, not via join:** Sales are manually entered. There is no reliable FK to ConvosoCallLog. The phone number would be entered during sale creation or populated from Convoso data at entry time. Adding it directly to Sale is simpler than creating a join that may not exist.

**Alternative considered and rejected:** Joining via `convosoLeadId` to find a matching ConvosoCallLog record. This is fragile because `convosoLeadId` is a Convoso-side ID, not a FK in the schema, and may not match any stored call log.

### Changes Required

| What | Where | Type |
|------|-------|------|
| Add `leadPhone` field to Sale | `prisma/schema.prisma` | MODIFY (same migration) |
| Include leadPhone in sales list response | `apps/ops-api/src/routes/sales.ts` (line ~214) | Already included (uses `include` not `select`) |
| Add Phone column to ManagerSales table | `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` | MODIFY |
| Optionally: add phone field to sale entry form | `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` | MODIFY (optional) |

### Schema Change

```prisma
model Sale {
  // ... existing fields ...
  leadPhone       String?  @map("lead_phone")    // NEW
  // ... rest unchanged ...
}
```

### Data Flow

```
Sale creation (ManagerEntry form)
  |  Optional: user enters phone number
  |  Or: auto-populated from Convoso data if available
  |
  POST /api/sales { ..., leadPhone: "5551234567" }
  |
  Sale table (lead_phone column)
  |
  GET /api/sales?range=week
  |  Already uses include (not select), so leadPhone auto-included
  |
  ManagerSales.tsx
  |  Add "Phone" column to table header and body
  |  Display s.leadPhone ?? "--"
```

**Note:** Since the sales list API uses `include` for relations but returns all scalar fields on the Sale model itself, the new `leadPhone` field will automatically appear in responses with no API route change needed. Only the Zod schema for POST/PATCH needs updating to accept the new field.

## Patterns to Follow

### Pattern 1: Nullable Schema Fields with No Default

**What:** New display-only fields on existing models should be nullable with no default, requiring zero data backfill.

**When:** Adding optional data columns to tables with existing rows.

**Why:** The ConvosoCallLog and Sale tables have existing data. Making the field nullable means the migration is non-destructive (no backfill needed), and the UI simply shows a dash for null values.

### Pattern 2: Edge Runtime JWT Decode Without Verification

**What:** The middleware decodes JWTs using base64 decode (not jsonwebtoken.verify) because Edge Runtime cannot access Node.js crypto or env secrets.

**When:** Any middleware-level auth check in the Next.js dashboard.

**Why:** Real verification happens on the API side. The middleware is a UX optimization (fast redirect), not a security boundary. The exp check follows the same pattern: decode and read `exp` from the payload, no crypto needed.

### Pattern 3: Prisma Include Propagation

**What:** When the API uses `include: { relation: true }` (not `select`), all scalar fields on the included model are returned. New scalar fields auto-propagate.

**When:** Adding fields to models that are already included in queries.

**Why:** Reduces the number of API route changes needed. The sales list query uses `include` for agent, product, leadSource, so adding `leadPhone` to Sale requires zero query changes.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing Derived Data on the Wrong Model

**What:** Putting the phone number from Convoso on CallAudit instead of ConvosoCallLog.

**Why bad:** CallAudit is the analysis/review record. ConvosoCallLog is the raw call data record. Phone is source data, not analysis data. Putting it on CallAudit breaks the conceptual model and would require duplicating data if multiple audits reference the same call.

### Anti-Pattern 2: Complex Cross-Table Joins for Display Data

**What:** Trying to join Sale to ConvosoCallLog via convosoLeadId to fetch phone numbers.

**Why bad:** `convosoLeadId` is not a FK, has no index, and may not match any ConvosoCallLog record. The join would be unreliable and slow.

**Instead:** Add leadPhone directly to Sale (simple, reliable, fast).

### Anti-Pattern 3: JWT Verification in Edge Runtime

**What:** Trying to use `jsonwebtoken.verify()` in Next.js middleware.

**Why bad:** Edge Runtime does not support Node.js `crypto` module. The `@ops/auth` package uses `jsonwebtoken` which depends on `crypto`. Importing it in middleware will crash.

**Instead:** Decode-only with base64, check `exp` field. Leave real verification to ops-api.

## Suggested Build Order

The build order considers dependencies between changes:

### Phase 1: Auth Fix (no dependencies, highest priority)

This is the production bug affecting 3 users. Zero database changes needed.

1. **Middleware exp check** -- `apps/ops-dashboard/middleware.ts`
   - Add `payload.exp` check after line 28
   - Clear cookie and redirect to `/` if expired
   - Standalone change, no other file depends on it

2. **Login page exp check** -- `apps/ops-dashboard/app/page.tsx`
   - Import `decodeTokenPayload` from `@ops/auth/client`
   - Add expiry check before redirect in useEffect
   - Call `clearToken()` if expired
   - Standalone change, no other file depends on it

These two can be done in parallel. Together they provide defense-in-depth: middleware catches stale cookies, login page catches stale localStorage.

### Phase 2: Schema + Poller (database, then backend)

3. **Prisma schema migration** -- Add `leadPhone` to both ConvosoCallLog and Sale
   - Single migration for both fields
   - Must run before any code changes that reference the new fields

4. **Poller update** -- `apps/ops-api/src/workers/convosoKpiPoller.ts`
   - Add `leadPhone: String(r.phone_number ?? r.number_dialed ?? "") || null` to callLogRecords mapping
   - Depends on migration (step 3)

### Phase 3: API + UI (backend then frontend)

5. **Call audits API** -- `apps/ops-api/src/routes/call-audits.ts`
   - Add `convosoCallLog: { select: { leadPhone: true } }` to the list endpoint include
   - Depends on migration (step 3)

6. **Sales API** -- `apps/ops-api/src/routes/sales.ts`
   - Add `leadPhone` to the POST/PATCH Zod schemas (optional string)
   - The GET already returns all scalar fields, so no query change needed
   - Depends on migration (step 3)

7. **ManagerAudits UI** -- Add Phone column
   - Update CallAudit type, add column to table
   - Depends on API change (step 5)

8. **ManagerSales UI** -- Add Phone column
   - Update Sale type, add column to table
   - Depends on migration (step 3, API auto-propagates)

### Dependency Graph

```
Phase 1 (auth fix):     [1: middleware] + [2: login page]  (parallel, no deps)
Phase 2 (schema):       [3: migration] --> [4: poller]
Phase 3 (display):      [3: migration] --> [5: audits API] --> [7: audits UI]
                         [3: migration] --> [6: sales API]  --> [8: sales UI]
```

## Files Modified vs Created

| File | Action | Lines Changed (est.) |
|------|--------|---------------------|
| `apps/ops-dashboard/middleware.ts` | MODIFY | +8 (exp check + cookie clear) |
| `apps/ops-dashboard/app/page.tsx` | MODIFY | +10 (import + exp check in useEffect) |
| `prisma/schema.prisma` | MODIFY | +2 (one field each on ConvosoCallLog and Sale) |
| `prisma/migrations/[timestamp]_add_lead_phone/` | NEW | ~4 lines SQL |
| `apps/ops-api/src/workers/convosoKpiPoller.ts` | MODIFY | +2 (extract and store phone) |
| `apps/ops-api/src/routes/call-audits.ts` | MODIFY | +1 (add to include) |
| `apps/ops-api/src/routes/sales.ts` | MODIFY | +1 (add to Zod schema) |
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx` | MODIFY | +8 (type + column) |
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` | MODIFY | +8 (type + column) |

**Total: 8 files modified, 1 directory created (migration). Estimated ~40 lines of changes.**

## Sources

- Direct code inspection of the repository (HIGH confidence)
- `@ops/auth/client` source: `packages/auth/src/client.ts`
- `@ops/auth` server source: `packages/auth/src/index.ts`
- Middleware: `apps/ops-dashboard/middleware.ts`
- Login page: `apps/ops-dashboard/app/page.tsx`
- Convoso poller: `apps/ops-api/src/workers/convosoKpiPoller.ts`
- Call audits API: `apps/ops-api/src/routes/call-audits.ts`
- Sales API: `apps/ops-api/src/routes/sales.ts`
- Prisma schema: `prisma/schema.prisma`
- Manager components: `apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx`, `ManagerSales.tsx`
