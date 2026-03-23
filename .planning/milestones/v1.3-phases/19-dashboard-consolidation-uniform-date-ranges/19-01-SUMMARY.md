---
phase: 19-dashboard-consolidation-uniform-date-ranges
plan: 01
subsystem: dashboard, auth, socket
tags: [unified-dashboard, app-shell, login, rbac, tabs, socket, date-range-context]

requires:
  - phase: none
    provides: existing @ops/auth, @ops/ui, @ops/socket, @ops/types packages
provides:
  - Unified ops-dashboard Next.js app shell at port 3011
  - Login page with email/password form and auto-redirect
  - Auth middleware protecting /manager, /payroll, /owner, /cs routes
  - Role-gated pill tab bar navigation in dashboard layout
  - SocketProvider for layout-level Socket.IO connection
  - DateRangeContext for shared date range state
  - roles.ts with TAB_CONFIG, TAB_ROLES, getTabsForRoles, getDefaultTab
affects: [19-02, 19-03, 19-04, 19-05, 19-06, 19-07, 19-08]

tech-stack:
  added: ["@ops/ops-dashboard (Next.js 15 app)"]
  patterns: [role-gated-tab-navigation, layout-level-context-providers, middleware-token-to-cookie-capture]

key-files:
  created:
    - apps/ops-dashboard/package.json
    - apps/ops-dashboard/next.config.js
    - apps/ops-dashboard/tsconfig.json
    - apps/ops-dashboard/lib/roles.ts
    - apps/ops-dashboard/lib/auth.ts
    - apps/ops-dashboard/lib/DateRangeContext.tsx
    - apps/ops-dashboard/lib/SocketProvider.tsx
    - apps/ops-dashboard/app/layout.tsx
    - apps/ops-dashboard/app/page.tsx
    - apps/ops-dashboard/app/api/login/route.ts
    - apps/ops-dashboard/app/api/verify/route.ts
    - apps/ops-dashboard/app/api/change-password/route.ts
    - apps/ops-dashboard/app/(dashboard)/layout.tsx
    - apps/ops-dashboard/middleware.ts
    - apps/ops-dashboard/public/favicon.svg
  modified:
    - package.json

key-decisions:
  - "Same-origin login: /api/login returns relative redirect path instead of cross-domain URL"
  - "Middleware uses verifySessionToken directly instead of HTTP verify call (same-origin)"
  - "Token-to-cookie capture in middleware for clean URLs after redirect"
  - "Single-role users see logout bar but no tab navigation (tabs.length > 1 check)"
  - "tsconfig needs explicit baseUrl and full path aliases for Next.js webpack resolution"

patterns-established:
  - "Role-gated tab navigation: getTabsForRoles filters TAB_CONFIG by user roles"
  - "Layout-level context providers: SocketProvider and DateRangeProvider wrap all dashboard routes"
  - "Middleware positive matcher pattern for protected routes"

requirements-completed: [SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05]

duration: 4min
completed: 2026-03-19
---

# Phase 19 Plan 01: Unified Dashboard App Shell Summary

Unified Next.js 15 app shell replacing 5 separate dashboards with role-gated tab navigation, Socket.IO context provider, and shared DateRangeContext at port 3011.

## What Was Built

### Task 1: App Boilerplate and Lib Files (8240510)
- Created `@ops/ops-dashboard` package with all shared package dependencies
- Added `next.config.js` with transpilePackages and NEXT_OUTPUT_STANDALONE conditional
- Created `roles.ts` with TAB_CONFIG mapping 4 dashboard tabs to required roles, SUPER_ADMIN access to all
- Created `auth.ts` with `decodeRolesFromToken` for client-side JWT payload extraction
- Created `DateRangeContext.tsx` with shared date range state (default: week preset)
- Created `SocketProvider.tsx` with layout-level Socket.IO context and 10s disconnect timer
- Added `dashboard:dev` script to root package.json

### Task 2: Login, API Routes, Middleware, and Dashboard Layout (6524030)
- Created root layout with Horizon Operations metadata, ThemeProvider, and favicon
- Created login page adapted from auth-portal with captureTokenFromUrl auto-redirect
- Created `/api/login` route that proxies to ops-api and returns role-based relative redirect
- Created `/api/verify` and `/api/change-password` proxy routes (same as auth-portal)
- Created middleware with positive matcher for /manager, /payroll, /owner, /cs routes
- Middleware captures session_token from URL into cookie and redirects to clean URL
- Created dashboard layout with role-gated pill tab bar, SocketProvider, DateRangeProvider
- Active tab uses teal primary color; inactive tabs are tertiary text
- Logout button and disconnect banner included in dashboard layout
- Created favicon.svg with H + heartbeat crossbar design

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed tsconfig.json path resolution for Next.js**
- **Found during:** Task 2 (build verification)
- **Issue:** `@/*` path alias not resolving because tsconfig.base.json sets `baseUrl: "."` at monorepo root, overriding the app-level paths
- **Fix:** Added explicit `baseUrl: "."` and full `@ops/*` path aliases in app tsconfig, plus `allowJs`, `noEmit`, `incremental`, `lib`, `isolatedModules`, and `plugins` matching manager-dashboard pattern
- **Files modified:** apps/ops-dashboard/tsconfig.json
- **Commit:** 6524030

## Verification

- `npx next build` succeeds with all routes compiled
- All 15 files created as specified
- Root package.json contains `dashboard:dev` script
- Build output confirms middleware (50.7 kB) and static login page

## Self-Check: PASSED
