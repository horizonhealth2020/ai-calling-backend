# Feature Landscape: v1.9 Auth Stability & Phone Number Display

**Domain:** Auth bug fix + data display enhancement
**Researched:** 2026-03-30
**Overall confidence:** HIGH

## Table Stakes

Features that must ship together for the milestone to be complete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Middleware expiry check | Defense-in-depth: expired tokens should be rejected at the edge, not just at the API | Low | 3-5 lines in existing middleware.ts |
| Login page stale token cleanup | Root cause of the redirect loop for 3 production users | Low | Add expiry check before auto-redirect in useEffect |
| Cookie deletion on expired token | Middleware must clear the cookie, not just redirect (or the cookie persists and loops) | Low | `response.cookies.delete()` in the redirect path |
| Lead phone column in call audit table | Users need to see which number was called for audit context | Low | Add column to existing table component |
| Lead phone column in agent sales rows | Sales context needs phone number for follow-up | Low | Add column to existing table component |
| Prisma migration for leadPhone | Phone data needs persistent storage, not just pass-through | Low | Single nullable String column |
| Poller phone capture | Existing data pipeline must extract phone from Convoso response | Low | Map `phone_number` field in poller record builder |

## Differentiators

Not expected for this milestone but would add value if trivial.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Phone number click-to-copy | Quick copy for agents who need to callback | Low | onClick handler with `navigator.clipboard` |

## Anti-Features

Features to explicitly NOT build in v1.9.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full JWT verification in Edge Runtime | Edge Runtime cannot access server secrets securely; adds `jose` library for marginal gain since API already verifies | Check `exp` claim only (timestamp comparison). API remains the auth authority. |
| Token refresh in middleware | Middleware is Edge Runtime (no DB, no secret access). Refresh belongs in the client. | Client-side `ensureTokenFresh()` already handles this in `@ops/auth/client` |
| Phone number formatting/masking | Adds complexity, may hide digits agents need | Display raw number from Convoso as-is |
| Phone number search/filter | Scope creep -- not part of this milestone | Defer to future milestone if requested |
| Backfill phone numbers for existing call logs | Depends on Convoso API data retention window; uncertain value | New calls will have phone numbers going forward |

## Feature Dependencies

```
Prisma migration (leadPhone column) --> Poller phone capture --> Dashboard phone columns
Middleware expiry check + Cookie deletion (same code path, atomic change)
Login page stale token cleanup (independent, parallel with above)
```

## MVP Recommendation

All 7 table-stakes features are low complexity and tightly scoped. Ship all in one milestone. No deferral needed.

Suggested order:
1. Auth fixes first (middleware + login page) -- unblocks 3 affected production users immediately
2. Schema migration + poller update -- starts capturing phone data for new calls
3. Dashboard column additions -- displays the captured data
