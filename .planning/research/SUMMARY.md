# Project Research Summary

**Project:** v1.3 Dashboard Consolidation & Uniform Date Ranges
**Domain:** Multi-app to single-app Next.js consolidation with role-gated navigation
**Researched:** 2026-03-19
**Confidence:** HIGH

## Executive Summary

This milestone consolidates five separate Next.js dashboard apps (auth-portal, manager-dashboard, payroll-dashboard, owner-dashboard, cs-dashboard) into a single unified Next.js app (`apps/dashboard`). The approach is well-understood: use Next.js App Router route groups to create one auth boundary with separate route segments per role-gated tab. The consolidation is predominantly mechanical — ~10,568 lines of existing TSX move from five `page.tsx` files into five route segments — but the migration carries meaningful regression risk across all role types. No new npm dependencies are required.

The recommended architecture replaces the current fragile cross-origin token-passing pattern (auth-portal opens dashboards in new tabs via URL query params) with a single same-origin app. Login becomes `/` in the unified app, the dashboard shell sits at `/(dashboard)/layout.tsx` with role-gated sidebar navigation, and each dashboard occupies its own route: `/manager`, `/payroll`, `/owner`, `/cs`. The sales board stays standalone at port 3013. This eliminates five dashboard-URL environment variables, reduces CORS origins from five to two, and cuts Railway services from seven to three.

The primary risks are architectural, not technological. The monster-file anti-pattern (merging all dashboards into a single component) must be rejected up front by committing to route-segment-per-dashboard. Auth middleware must use a positive matcher to protect only dashboard routes without intercepting login or API routes. Socket.IO connections should be lifted to a shared layout-level provider to avoid connect/disconnect churn on tab switches. Date range state must be managed in a context provider in the shared layout rather than local state in each tab page, or selections will reset on every tab switch.

## Key Findings

### Recommended Stack

No new dependencies are required. The unified app uses the exact same dependency surface as the existing dashboards: Next.js 15.3.9, React 18.3.1, and the internal `@ops/*` packages. The `DateRangeFilter` component in `@ops/ui` already exists (added in v1.2 for CSV exports) and needs only a new `presets` prop to support the KPI-specific preset set (Current Week / Last Week / 30 Days / Custom). Luxon is already present in the root package for date calculation using the existing `America/New_York` Sun-Sat week boundary logic. See [STACK.md](.planning/research/STACK.md) for the full component-by-component analysis.

**Core technologies (no changes):**
- Next.js 15.3.9 App Router: Single unified app with route groups and file-based code splitting per dashboard — already in use across all apps
- `@ops/ui` PageShell + TabNav: Role-gated top-level sidebar; sub-tab navigation within each dashboard page — no changes to PageShell required
- `@ops/auth/client`: Token capture, `authFetch`, JWT decode for roles — needs `decodeTokenPayload` exported publicly, otherwise unchanged
- `@ops/socket` `useSocket` hook: Lifted to layout-level `SocketProvider` to maintain one connection across tab switches
- `DateRangeFilter` (`@ops/ui`): Minor extension with a `presets` prop; backward-compatible; KPI preset keys map to the existing `dateRange()` server utility
- Luxon 3.4.4: Already used for payroll week boundaries; reused for Current Week / Last Week date range calculation

**What NOT to add:** next-auth, react-router, react-datepicker, zustand, Tailwind, react-query. All impose full rewrites of working patterns for zero user-facing benefit at this milestone.

### Expected Features

See [FEATURES.md](.planning/research/FEATURES.md) for the full feature table with complexity ratings and dependency mapping.

**Must have (table stakes):**
- Role-gated tab navigation — users currently see only their dashboard; consolidation must preserve this isolation with no visible regression
- Login lands on correct default tab — replaces current cross-origin URL redirect with same-origin route navigation
- Preserved feature parity per tab — every feature in every current dashboard works identically in its tab (~11k LOC across four dashboards)
- Shared auth state across tabs — single token capture in root layout; simpler than current cross-domain token passing
- URL-based tab routing — browser back/forward and direct links to `/manager`, `/payroll`, `/owner`, `/cs`
- Date range picker on all KPI sections — `DateRangeFilter` wired to KPI data fetches, not just CSV exports
- Current Week / Last Week presets — replaces "Last 7 days / This month" presets in `DateRangeFilter`
- Date range persists across tab switches — lifted to shared layout context, not local page state
- Sales board remains standalone — explicitly excluded from consolidation per PROJECT.md

**Should have (differentiators, post-MVP):**
- Tab badges with live counts — PageShell `NavItem` already has `badge?: number`; wire to Socket.IO events; low effort, high polish
- Cross-tab KPI summary header — aggregated numbers across all role-visible dashboards in a top-level bar
- Deep link support with date range in URL — `?range=week` search param for sharing specific views
- Keyboard shortcuts for tab switching — Ctrl+1/2/3/4; approximately 20 lines of code

**Defer to v2+:**
- Multi-tab split view
- Custom dashboard layout or drag-and-drop widgets
- Tab customization and ordering preferences
- Global search across all tabs
- Real-time date range auto-refresh

### Architecture Approach

The unified app uses a Next.js route group `(dashboard)` to establish an auth boundary in `layout.tsx` without adding a URL segment. Each dashboard becomes its own page route (`/manager`, `/payroll`, `/owner`, `/cs`), enabling automatic code splitting so a MANAGER user never downloads payroll code. Login lives at `/` (the root page). The auth middleware uses a positive matcher covering only the four dashboard route prefixes. The login API routes (`/api/login`, `/api/verify`, `/api/change-password`) are copied from auth-portal and remain public. Role-to-tab mapping is defined once in `lib/roles.ts` and consumed by both the middleware and the layout navigation to prevent client/server mismatch. See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for the full data flow, migration phase breakdown, and deployment comparison table.

**Major components:**
1. `app/page.tsx` (login) — login form, same-origin; posts to `/api/login` which redirects to `/{default-tab}?session_token=TOKEN`
2. `middleware.ts` — protects `/manager/*`, `/payroll/*`, `/owner/*`, `/cs/*` with positive matcher; redirects to `/` if JWT missing or invalid
3. `app/(dashboard)/layout.tsx` (DashboardShell) — role-gated sidebar via PageShell; hosts `SocketProvider` context and `DateRangeContext` for shared state across tabs
4. `app/(dashboard)/[tab]/page.tsx` (four routes) — each dashboard's existing page content, stripped of its outer `PageShell` and `captureTokenFromUrl()` call; sub-tabs remain `useState`-driven as today
5. `lib/roles.ts` — single source of truth for role-to-tab mapping (`getTabsForRoles`, `getDefaultTab`)
6. Updated `DateRangeFilter` (`@ops/ui`) — new `presets` prop with backward-compatible default; KPI preset keys for all dashboard tabs

### Critical Pitfalls

See [PITFALLS.md](.planning/research/PITFALLS.md) for all 14 pitfalls with phase assignments and detection strategies.

1. **Monster file with no code splitting (P1)** — putting all four dashboards in one `page.tsx` with a tab state variable produces a 10,000+ line file with constant name collisions (`CARD`, `BTN`, `HEADER` defined differently in all four dashboards) and zero per-route code splitting. Prevention: commit to route-segment-per-dashboard before writing any code; this is the foundational structural decision.

2. **Auth middleware intercepting login or API routes (P2, P9)** — a negative matcher or overly broad matcher causes infinite redirect loops on the login page and 401s on `POST /api/login`. Prevention: use an explicit positive matcher listing only `/manager/:path*`, `/payroll/:path*`, `/owner/:path*`, `/cs/:path*`.

3. **Stale CORS origins after consolidation (P3)** — the ops-api `ALLOWED_ORIGINS` currently contains five dashboard origins; if not updated the unified app's `authFetch` calls and Socket.IO connections fail silently. Must be updated in `apps/ops-api/src/index.ts`, `docker-compose.yml`, and Railway env vars simultaneously with deployment.

4. **Socket.IO connect/disconnect churn on tab switches (P7)** — each current dashboard owns its own `useSocket` connection; in the unified app, route navigation causes mount/unmount cycles that disconnect and reconnect the socket on every tab switch. Prevention: lift `useSocket` to a `SocketProvider` in the shared layout; individual tabs subscribe to events via context.

5. **Date range state lost on tab navigation (P8)** — local `useState` in each tab page is destroyed when navigating to another route. Prevention: store `DateRangeFilterValue` in a React context provider in `(dashboard)/layout.tsx` so it persists across tab switches. This also satisfies the "uniform date range" requirement since all tabs share the same selection.

## Implications for Roadmap

Based on combined research, the migration has clear sequential dependencies. Phases 1-2 create the foundation that everything else depends on. Phases 3-6 are independent of each other but follow CS-first as the simplest validation pass. Phase 7 is additive on top of working tab content. Phase 8 is cleanup only after production confirmation.

### Phase 1: App Shell, Login, and Auth Middleware

**Rationale:** Every other phase depends on a working unified app with a functional login flow and auth boundary. This must come first.
**Delivers:** New `apps/dashboard` Next.js app, login at `/`, API routes copied from auth-portal, middleware protecting dashboard routes, redirect to default tab after login, `lib/roles.ts` with `getTabsForRoles` and `getDefaultTab`.
**Addresses:** Table stakes for role-gated navigation and shared auth state; P2 (auth flow rewrite) and P9 (middleware matcher conflict).
**Avoids:** P11 (missing transpilePackages — use union of all dashboard configs), P12 (missing workspace deps — merge all dashboard package.json deps).

### Phase 2: Dashboard Shell and Role-Gated Navigation

**Rationale:** The `(dashboard)/layout.tsx` with PageShell sidebar, role-to-tab mapping, `SocketProvider`, and `DateRangeContext` must exist before any dashboard content is migrated.
**Delivers:** Working tab navigation between placeholder pages; role filtering confirmed for all five role types (MANAGER, PAYROLL, OWNER_VIEW, CUSTOMER_SERVICE, SUPER_ADMIN); single Socket.IO connection persisting across tab switches; `DateRangeContext` available to all tab pages.
**Addresses:** Two-level navigation architecture, shared Socket.IO connection, shared date range state.
**Avoids:** P6 (role mismatch between client and server — single `TAB_ROLES` constant used by both middleware and layout), P7 (socket connection churn — `SocketProvider` created once in layout), P8 (date range reset on tab switch — `DateRangeContext` in layout).

### Phase 3: CS Dashboard Migration (pattern validation)

**Rationale:** CS is the simplest dashboard (2,377 lines, 2 sub-tabs) and is the lowest-risk way to validate the migration pattern before tackling larger dashboards.
**Delivers:** CS tab fully functional with submissions and tracking sub-tabs; Socket.IO real-time updates confirmed; migration playbook proven for phases 4-6.
**Addresses:** Feature parity for CUSTOMER_SERVICE role.
**Avoids:** P4 (style collisions — confirmed scoped by route file), P10 (sales board regression — run `npm run salesboard:dev` after any shared package change).

### Phase 4: Owner Dashboard Migration

**Rationale:** Second simplest (1,957 lines, 4 sub-tabs). Validates role-dependent sub-tab visibility (SUPER_ADMIN sees Users sub-tab).
**Delivers:** Owner tab fully functional including SUPER_ADMIN-gated Users sub-tab.
**Addresses:** Feature parity for OWNER_VIEW role.

### Phase 5: Payroll Dashboard Migration

**Rationale:** Third in complexity (3,030 lines, 5 sub-tabs). Validates sub-tab badge counts wired to approval state.
**Delivers:** Payroll tab fully functional including chargebacks, exports, service, and products sub-tabs.
**Addresses:** Feature parity for PAYROLL role.

### Phase 6: Manager Dashboard Migration

**Rationale:** Most complex (2,702 lines, 5 sub-tabs with deeply shared state for agents, products, and lead sources loaded once and shared across sub-tabs). Saved for last to apply learnings from phases 3-5.
**Delivers:** Manager tab fully functional including entry, tracker, sales, audits, and config sub-tabs.
**Addresses:** Feature parity for MANAGER role; highest regression risk of all migrations.

### Phase 7: Uniform Date Range Filtering

**Rationale:** Depends on having all four dashboard tabs migrated (phases 3-6) because it wires `DateRangeFilter` to KPI fetches in each tab. The shared `DateRangeContext` from Phase 2 is already in place, so this phase is purely about updating component presets and wiring KPI API calls.
**Delivers:** `DateRangeFilter` extended with `presets` prop (Current Week / Last Week / 30 Days / Custom); `dateRange()` utility extended with `last_week` case; KPI endpoints updated to accept optional `range`/`from`/`to` query params; date range selection persists across all tab switches.
**Addresses:** Uniform date range filtering requirement; `DateRangeFilter` backward compatibility for sales-board.
**Avoids:** P8 already solved by Phase 2 context; avoids introducing per-tab `useState` for date range.

### Phase 8: Deployment Cleanup

**Rationale:** Old apps must remain functional during migration validation. Only remove them once the unified app is confirmed stable in production.
**Delivers:** Updated `docker-compose.yml` (remove five old services, add unified dashboard), updated `ALLOWED_ORIGINS` in ops-api, Railway services reduced from 7 to 3, cross-service env vars removed (`MANAGER_DASHBOARD_URL`, `PAYROLL_DASHBOARD_URL`, `OWNER_DASHBOARD_URL`, `CS_DASHBOARD_URL`, `AUTH_PORTAL_URL`), old app directories deleted.
**Addresses:** Deployment topology simplification, CORS cleanup, Railway billing reduction.
**Avoids:** P3 (stale CORS origins — update all three config locations), P5 (Docker/Railway topology drift — done in same PR as go-live confirmation).

### Phase Ordering Rationale

- Phases 1-2 are strictly sequential prerequisites; no other phase can proceed without them.
- Phases 3-6 can run in any order but CS-first (simplest) validates the migration pattern before investing in larger dashboards.
- Phase 7 must follow all content migrations because it modifies KPI fetches in all four tabs and needs each tab's fetch logic present.
- Phase 8 must be last; old apps serve as the rollback target until the unified app is production-confirmed. Tag the last multi-app commit before Phase 1 begins.
- The `dateRange()` server utility already handles `week`, `7d`, `30d`, `month`, and `custom`. Only a `last_week` case is missing — one additional switch branch.

### Research Flags

Phases that need a brief planning check before implementation:
- **Phase 7 (Uniform Date Range):** Each KPI-producing endpoint in `ops-api/src/routes/index.ts` needs an audit to confirm which are currently date-range-blind before wiring the filter. FEATURES.md identified `/api/agent-kpis` as hardcoded 30-day via `getAgentRetentionKpis()`. Other KPI endpoints need the same verification before the work is scoped.
- **Phase 2 (SocketProvider):** Confirm the existing `useSocket` hook in `@ops/socket` stays backward-compatible for sales-board before adding the provider pattern. Any change to the hook API breaks the standalone sales board.

Phases with standard patterns (skip research-phase):
- **Phases 1 and 3-6:** App scaffolding and dashboard migration follow well-established Next.js App Router patterns. Auth-portal login routes are being copied, not rewritten. Each dashboard migration follows a repeatable three-step playbook (remove `captureTokenFromUrl`, replace outer `PageShell` with `SubTabBar`, keep internal state unchanged).
- **Phase 8:** Docker and Railway configuration changes are mechanical; no design unknowns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All decisions based on direct codebase inspection of all 5 apps and shared packages. Zero ambiguity on dependencies — no new packages required. |
| Features | HIGH | Requirements come from `PROJECT.md` plus direct codebase analysis. Feature inventory is complete. Anti-features are explicit. Line counts per dashboard verified. |
| Architecture | HIGH | Route group pattern is well-established Next.js 13+. All component interfaces (PageShell NavItem, DateRangeFilter, useSocket, authFetch) confirmed via source inspection. |
| Pitfalls | HIGH | All 14 pitfalls derived from direct code inspection of auth flow, CORS config, Socket.IO lifecycle, and style patterns — not speculative. Detection strategies reference specific files and line numbers. |

**Overall confidence:** HIGH

### Gaps to Address

- **KPI endpoint date-range audit (Phase 7 planning):** Before wiring `DateRangeFilter` to KPI fetches, each KPI-producing endpoint in `ops-api/src/routes/index.ts` needs to be catalogued for current date scope (hardcoded vs. accepts params vs. needs update). `/api/agent-kpis` is flagged as hardcoded 30-day; others are unknown.
- **`last_week` range case in server `dateRange()` utility:** The utility handles `week` (current Sun-Sat) but not `last_week`. One additional case needed before Phase 7 KPI wiring. Confirm Sunday start aligns with existing payroll week logic.
- **`decodeTokenPayload` export status in `@ops/auth/client`:** The function exists but may be private. Confirm it is or can be exported before the dashboard layout depends on it for client-side role decoding.
- **Rollback plan:** Tag the last multi-app commit before Phase 1 begins. Do not delete old app directories until Phase 8 post-production confirmation. Keep old Railway services running in parallel during the transition window.

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `packages/ui/src/index.tsx` — PageShell NavItem interface, sidebar/bottom nav patterns, badge support
- `packages/ui/src/components/DateRangeFilter.tsx` — existing presets, `DateRangeFilterValue` interface (97 lines; presets at lines 50-55)
- `packages/ui/src/components/TabNav.tsx` — sub-tab component API
- `packages/auth/src/client.ts` — token management, JWT decode, authFetch with auto-refresh
- `packages/types/src/index.ts` — AppRole enum (7 roles), SessionUser type
- `packages/socket/src/useSocket.ts` — Socket.IO connection lifecycle, mount/unmount behavior
- `apps/auth-portal/app/api/login/route.ts` — login flow, SUPER_ADMIN role expansion, cross-origin redirect with session_token
- `apps/auth-portal/app/landing/page.tsx` — DASHBOARD_MAP with role-to-URL mapping (to be replaced)
- `apps/auth-portal/middleware.ts` — existing route matcher pattern
- `apps/manager-dashboard/app/page.tsx` — Tab type, PageShell usage, 5 sub-tabs, shared state pattern
- `apps/cs-dashboard/app/page.tsx` — role-gated tab visibility (`canManageCS`, lines 505-523)
- `apps/ops-api/src/routes/index.ts` — `dateRange()` utility (lines 33-82), existing range handling
- `apps/ops-api/src/middleware/auth.ts` — `requireAuth`, `requireRole`, SUPER_ADMIN bypass
- `apps/ops-api/src/index.ts` — CORS configuration and ALLOWED_ORIGINS
- `docker-compose.yml` — service topology, ALLOWED_ORIGINS env

### Secondary (HIGH confidence — established framework patterns)

- Next.js App Router route groups documentation — `(dashboard)` group pattern, route-based code splitting, middleware matcher syntax (well-established since Next.js 13)
- Next.js 15 `metadata` export per route segment — standard pattern for per-tab browser titles

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
