---
phase: 11-foundation-dashboard-shell
plan: 02
subsystem: ui
tags: [nextjs, react, pageshell, auth-portal, docker]

requires:
  - phase: none
    provides: n/a
provides:
  - cs-dashboard Next.js app shell at port 3014 with PageShell sidebar
  - Auth portal CUSTOMER_SERVICE routing via DASHBOARD_MAP
  - Docker service and CORS config for cs-dashboard
affects: [12-chargeback-parser, 13-pending-terms-parser, 17-polish]

tech-stack:
  added: []
  patterns: [cs-dashboard follows same scaffold as manager-dashboard minus socket.io]

key-files:
  created:
    - apps/cs-dashboard/package.json
    - apps/cs-dashboard/tsconfig.json
    - apps/cs-dashboard/next.config.js
    - apps/cs-dashboard/app/layout.tsx
    - apps/cs-dashboard/app/page.tsx
  modified:
    - apps/auth-portal/app/landing/page.tsx
    - apps/auth-portal/next.config.js
    - package.json
    - docker-compose.yml
    - .env.example
    - apps/ops-api/.env.example

key-decisions:
  - "Card component has no title prop -- added h3 heading manually inside Card"
  - "EmptyState uses title/description props (not heading/message as plan assumed)"

patterns-established:
  - "cs-dashboard scaffold pattern: same as manager-dashboard minus @ops/socket"

requirements-completed: [DASH-01, DASH-03]

duration: 3min
completed: 2026-03-17
---

# Phase 11 Plan 02: CS Dashboard Shell Summary

**Next.js cs-dashboard app at port 3014 with PageShell sidebar (Submissions/Tracking tabs), auth portal CUSTOMER_SERVICE routing, and Docker/CORS configuration**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-17T15:27:29Z
- **Completed:** 2026-03-17T15:30:17Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Scaffolded cs-dashboard Next.js app with PageShell, two tabs, and 4 Card sections with EmptyState placeholders
- Wired auth portal DASHBOARD_MAP with CUSTOMER_SERVICE entry (amber gradient, Headphones icon)
- Updated Docker, CORS, and env config to include cs-dashboard on port 3014

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold cs-dashboard Next.js app with PageShell and placeholder tabs** - `d4f70c3` (feat)
2. **Task 2: Wire auth portal DASHBOARD_MAP and update env/config files** - `51919f0` (feat)

## Files Created/Modified
- `apps/cs-dashboard/package.json` - Workspace package @ops/cs-dashboard with dev port 3014
- `apps/cs-dashboard/tsconfig.json` - TypeScript config extending tsconfig.base.json
- `apps/cs-dashboard/next.config.js` - Next.js config with transpilePackages and conditional standalone
- `apps/cs-dashboard/app/layout.tsx` - Root layout with Inter font and ThemeProvider
- `apps/cs-dashboard/app/page.tsx` - Main page with PageShell, tab state, Card/EmptyState placeholders
- `apps/auth-portal/app/landing/page.tsx` - Added CUSTOMER_SERVICE to DASHBOARD_MAP
- `apps/auth-portal/next.config.js` - Added CS_DASHBOARD_URL env var
- `package.json` - Added cs:dev script
- `docker-compose.yml` - Added cs-dashboard service, CS_DASHBOARD_URL to auth-portal, updated ALLOWED_ORIGINS
- `.env.example` - Added port 3014 to ALLOWED_ORIGINS
- `apps/ops-api/.env.example` - Added port 3014 to ALLOWED_ORIGINS

## Decisions Made
- Card component does not accept a `title` prop -- used manual h3 heading inside Card instead
- EmptyState component uses `title`/`description` props, not `heading`/`message` as plan template assumed -- adapted accordingly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted EmptyState props to match actual component API**
- **Found during:** Task 1 (page.tsx creation)
- **Issue:** Plan specified `heading` and `message` props but EmptyState uses `title` and `description`
- **Fix:** Used correct prop names `title` and `description`
- **Files modified:** apps/cs-dashboard/app/page.tsx
- **Verification:** next build passes
- **Committed in:** d4f70c3

**2. [Rule 1 - Bug] Added manual heading to Card since it lacks title prop**
- **Found during:** Task 1 (page.tsx creation)
- **Issue:** Plan used `<Card title="...">` but Card only accepts children, not a title prop
- **Fix:** Added h3 heading element inside Card with matching styles
- **Files modified:** apps/cs-dashboard/app/page.tsx
- **Verification:** next build passes
- **Committed in:** d4f70c3

---

**Total deviations:** 2 auto-fixed (2 bugs - API mismatch)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- cs-dashboard shell is ready for Phase 12 (chargeback parser) and Phase 13 (pending terms parser) to build features into
- Auth portal correctly routes CUSTOMER_SERVICE users to cs-dashboard
- All builds pass (cs-dashboard and auth-portal)

---
*Phase: 11-foundation-dashboard-shell*
*Completed: 2026-03-17*
