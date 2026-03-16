---
phase: 06-dashboard-cascade
plan: 01
subsystem: api, ui
tags: [socket.io, websocket, real-time, react-hook, monorepo]

requires:
  - phase: 10-sale-status-payroll-logic
    provides: sale status workflow and payroll upsert logic
provides:
  - "@ops/socket shared package with useSocket hook and typed SaleChangedPayload"
  - "emitSaleChanged server helper emitting sale:changed events"
  - "Server emits on POST /api/sales (created) and status-change-request approve (status_changed)"
  - "All four dashboard apps configured to resolve @ops/socket imports"
affects: [06-dashboard-cascade plans 02-06, sales-board, payroll-dashboard, owner-dashboard, manager-dashboard]

tech-stack:
  added: ["@ops/socket workspace package"]
  patterns: ["Dynamic import socket.io-client for SSR safety", "useRef for stale closure prevention in socket callbacks", "10s disconnect delay before showing banner", "Non-fatal try/catch around socket emits in API routes"]

key-files:
  created:
    - packages/socket/package.json
    - packages/socket/src/types.ts
    - packages/socket/src/useSocket.ts
    - packages/socket/src/index.ts
  modified:
    - apps/ops-api/src/socket.ts
    - apps/ops-api/src/routes/index.ts
    - apps/manager-dashboard/package.json
    - apps/manager-dashboard/next.config.js
    - apps/sales-board/package.json
    - apps/sales-board/next.config.js
    - apps/payroll-dashboard/package.json
    - apps/payroll-dashboard/next.config.js
    - apps/owner-dashboard/package.json
    - apps/owner-dashboard/next.config.js

key-decisions:
  - "Server-side SaleChangedPayload duplicated in socket.ts (no React dependency on server)"
  - "workspace:* protocol replaced with * to match existing npm workspace convention"

patterns-established:
  - "useSocket hook pattern: dynamic import, ref-based callbacks, 10s disconnect timer"
  - "emitSaleChanged pattern: re-fetch sale with relations after mutation, emit with full payload"

requirements-completed: [CASC-01, CASC-02, CASC-03, CASC-04]

duration: 4min
completed: 2026-03-16
---

# Phase 06 Plan 01: Socket Foundation Summary

**Shared @ops/socket package with useSocket hook, typed SaleChangedPayload events, and server-side emitSaleChanged wired into sale creation and Dead/Declined-to-Ran approval routes**

## Performance

- **Duration:** 4 min (248s)
- **Started:** 2026-03-16T14:44:10Z
- **Completed:** 2026-03-16T14:48:18Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- Created @ops/socket shared package with typed SaleChangedPayload, useSocket React hook, and DISCONNECT_BANNER/HIGHLIGHT_GLOW style constants
- Added emitSaleChanged to server socket.ts, wired into POST /api/sales (type "created") and status-change-request approve (type "status_changed" for Dead/Declined->Ran only)
- Configured all four dashboard apps (manager, sales-board, payroll, owner) with @ops/socket dependency and transpilePackages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create @ops/socket shared package with useSocket hook and typed events** - `d028c88` (feat)
2. **Task 2: Add emitSaleChanged to server socket.ts and wire into routes** - `b90ad4d` (feat)

## Files Created/Modified
- `packages/socket/package.json` - @ops/socket package definition with peer deps
- `packages/socket/src/types.ts` - SaleChangedPayload, SaleChangedType, DISCONNECT_BANNER, HIGHLIGHT_GLOW
- `packages/socket/src/useSocket.ts` - React hook with dynamic import, disconnect tracking, reconnect callback
- `packages/socket/src/index.ts` - Re-exports from types and useSocket
- `apps/ops-api/src/socket.ts` - Added emitSaleChanged function and server-side types
- `apps/ops-api/src/routes/index.ts` - Emit calls in POST /api/sales and status-change-request approve
- `apps/*/package.json` - Added @ops/socket and socket.io-client dependencies
- `apps/*/next.config.js` - Added @ops/socket to transpilePackages

## Decisions Made
- Used `"*"` instead of `"workspace:*"` for @ops/socket dependency references to match existing npm workspace convention (workspace:* is pnpm/yarn only)
- Server-side SaleChangedPayload type duplicated in socket.ts rather than importing from @ops/socket to avoid React peer dependency on the server

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed workspace:* protocol to * for npm compatibility**
- **Found during:** Task 1 (npm install)
- **Issue:** Plan specified `"workspace:*"` for @ops/socket dependency, but npm workspaces use `"*"` (workspace: protocol is pnpm/yarn only)
- **Fix:** Changed all four dashboard package.json files from `"workspace:*"` to `"*"`
- **Files modified:** apps/manager-dashboard/package.json, apps/sales-board/package.json, apps/payroll-dashboard/package.json, apps/owner-dashboard/package.json
- **Verification:** npm install completed successfully
- **Committed in:** d028c88 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential fix for npm workspace compatibility. No scope creep.

## Issues Encountered
None beyond the workspace:* protocol fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- @ops/socket package ready for import in all dashboard apps
- useSocket hook ready for integration in Plans 02-05 (sales-board, payroll, owner, manager)
- emitSaleChanged firing on sale creation and approval, providing real-time data for all dashboards

---
*Phase: 06-dashboard-cascade*
*Completed: 2026-03-16*
