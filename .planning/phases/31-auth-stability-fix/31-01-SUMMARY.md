---
phase: 31-auth-stability-fix
plan: 01
subsystem: auth
tags: [jwt, edge-runtime, middleware, nextjs, cookie, localStorage]

# Dependency graph
requires: []
provides:
  - JWT expiry check in Edge Runtime middleware before role extraction
  - Cookie cleanup on expired/malformed token redirect
  - Client-side expired token detection and localStorage cleanup
  - Loading gate on login page to prevent form flash during token check
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Edge-safe JWT expiry check using atob + Date.now (no jsonwebtoken import)"
    - "Cookie deletion on redirect response via NextResponse.cookies.delete"
    - "Loading gate pattern: useState(true) -> check -> setChecking(false) before render"

key-files:
  created: []
  modified:
    - apps/ops-dashboard/middleware.ts
    - apps/ops-dashboard/app/page.tsx

key-decisions:
  - "No clock-skew buffer on exp check -- 12h token lifetime makes sub-minute skew irrelevant"
  - "Minimal Loading... text instead of spinner component -- consistent with existing theme, no new dependency"
  - "Cookie deletion uses path: / to match the path used when cookie is set"

patterns-established:
  - "JWT expiry check pattern: payload.exp * 1000 < Date.now() for Edge Runtime"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 8min
completed: 2026-03-30
---

# Phase 31 Plan 01: Auth Stability Fix Summary

**JWT expiry checks added to Edge middleware and login page, fixing infinite redirect loop for users with expired tokens**

## Performance

- **Duration:** ~8 min (execution across two sessions with human verification checkpoint)
- **Started:** 2026-03-30
- **Completed:** 2026-03-30
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 2

## Accomplishments
- Fixed production redirect loop affecting 3 users with expired JWT tokens
- Middleware now checks JWT exp claim before role extraction and deletes stale cookie on redirect
- Login page detects expired localStorage tokens, clears them, and shows loading gate during check
- Malformed tokens (failing JSON.parse) also trigger cookie cleanup in middleware catch block

## Task Commits

Each task was committed atomically:

1. **Task 1: Add JWT expiry check and cookie deletion to middleware** - `7dd11d4` (fix)
2. **Task 2: Add expiry check and loading gate to login page** - `853e348` (fix)
3. **Task 3: Verify auth fix end-to-end** - Human verification checkpoint (approved by user)

## Files Created/Modified
- `apps/ops-dashboard/middleware.ts` - Added JWT exp check after payload decode, cookie deletion on expired/malformed tokens
- `apps/ops-dashboard/app/page.tsx` - Added decodeTokenPayload + clearToken imports, checking state, expiry check in useEffect, loading gate JSX

## Decisions Made
- No clock-skew buffer on expiry check (12h token lifetime makes this unnecessary)
- Minimal "Loading..." text for loading gate rather than a spinner component (no new dependencies)
- Cookie deletion uses `path: "/"` to match the path used when setting the cookie

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Auth stability fix is complete and production-ready
- Phase 32 (Phone Number Data Pipeline) can proceed independently
- No blockers or concerns

## Self-Check: PASSED

- FOUND: apps/ops-dashboard/middleware.ts
- FOUND: apps/ops-dashboard/app/page.tsx
- FOUND: commit 7dd11d4 (Task 1)
- FOUND: commit 853e348 (Task 2)

---
*Phase: 31-auth-stability-fix*
*Completed: 2026-03-30*
