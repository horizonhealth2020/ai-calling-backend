# Phase 19: Dashboard Consolidation & Uniform Date Ranges - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Consolidate 5 separate Next.js dashboard apps (auth-portal, manager, payroll, owner, CS) into a single unified app (`apps/ops-dashboard`) with role-gated tab navigation, uniform date range filtering on all KPI sections, refreshed login UI, and deployment cleanup. Sales board stays standalone. Every existing feature must work identically after migration.

</domain>

<decisions>
## Implementation Decisions

### Tab Navigation
- Horizontal tab bar across the top with dashboard names (Manager, Payroll, Owner, CS)
- Pill tabs with accent underline — matches dark glassmorphism theme, teal accent for active tab
- Sub-tabs stay inside each page via existing PageShell sidebar pattern — two-level nav: tabs at top, sub-tabs in sidebar
- Tab switching uses URL-based routing: `/manager`, `/payroll`, `/owner`, `/cs` as Next.js route segments
- Browser back/forward works, direct links to routes work
- Hide tab bar for single-role users (only 1 dashboard) — cleaner UX
- SUPER_ADMIN sees all four tabs

### Login & Default Tab
- Login form lives at root page `/` of the unified app — no separate auth-portal
- After login, user redirects to default tab based on role:
  - SUPER_ADMIN → `/owner`
  - OWNER_VIEW → `/owner`
  - MANAGER → `/manager`
  - PAYROLL → `/payroll`
  - CUSTOMER_SERVICE → `/cs`
- Landing page (dashboard picker) eliminated — multi-role users switch via tab bar
- Login form design refreshed to match unified app feel
- Favicon: "H" with a heartbeat line through it
- HTML title tag: "Horizon Operations"
- Unauthenticated users accessing any dashboard route redirected to `/`

### Date Range
- Global date range — shared across all tabs via React context in layout
- Switching tabs preserves the selected date range
- Default preset on load: Current Week (Sun-Sat, matches payroll week cycle)
- Four presets: Current Week, Last Week, 30 Days, Custom
- Positioned above KPI cards within each tab's content area (not in the tab bar)
- Sun-Sat week definition matches existing `getSundayWeekRange()` in payroll.ts
- All CSV export date range pickers also use these same uniform presets

### File Organization
- Unified app name: `apps/ops-dashboard`
- Port: 3011 (reuses auth-portal port)
- Each dashboard becomes a Next.js route segment under `app/(dashboard)/`
- Sub-tab content extracted into component files during migration:
  ```
  app/(dashboard)/manager/
    page.tsx          (orchestrator — shared state, imports sub-components)
    ManagerEntry.tsx
    ManagerTracker.tsx
    ManagerSales.tsx
    ManagerAudits.tsx
    ManagerConfig.tsx
  ```
- Style constants (CARD, BTN, HEADER) scoped per component file — no collisions
- Functionality, responsiveness, and reliability prioritized over code elegance

### Socket.IO
- Shared Socket.IO provider in the layout — single connection for entire app
- No disconnect/reconnect when switching between dashboard tabs
- All existing real-time events (sale cascade, CS submissions, alerts) continue working

### Deployment
- CORS config updated: single unified app origin replaces 5 separate origins
- Docker: one unified container replaces 5 dashboard containers
- Old standalone app directories removed after migration verified
- Sales board remains standalone at port 3013

### Claude's Discretion
- Exact pill tab bar component implementation and hover states
- Favicon design details (SVG/PNG, exact heartbeat line style)
- Login form layout and animation details
- How to handle the transition: whether old apps are deleted immediately or kept briefly as fallback
- Socket.IO provider implementation details
- Sub-component extraction granularity (how much to split vs keep together)
- Route group structure (`(dashboard)` vs flat routes)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Auth Flow
- `apps/auth-portal/app/landing/page.tsx` — Current DASHBOARD_MAP, role-to-URL routing, window.open token passing pattern (to be replaced)
- `apps/auth-portal/app/api/login/route.ts` — Login API proxy, token response handling
- `packages/auth/src/client.ts` — captureTokenFromUrl(), getToken(), authFetch() — browser-side auth primitives

### Dashboard Pages (migration sources)
- `apps/manager-dashboard/app/page.tsx` (2,702 lines) — 5 sub-tabs: Entry, Tracker, Sales, Audits, Config
- `apps/payroll-dashboard/app/page.tsx` (3,030 lines) — 5 sub-tabs: Periods, Chargebacks, Exports, Service, Products
- `apps/owner-dashboard/app/page.tsx` (1,957 lines) — Sub-tabs: Overview, Agent KPIs, AI Config, Permissions, Users (SUPER_ADMIN)
- `apps/cs-dashboard/app/page.tsx` (2,377 lines) — 2 sub-tabs: Submissions, Tracking

### Shared UI & Components
- `packages/ui/src/index.tsx` — PageShell (NavItem interface, sidebar/bottom nav), Badge, AnimatedNumber, StatCard, TabNav
- `packages/ui/src/components/DateRangeFilter.tsx` — Existing component with presets 7d/30d/month/custom (needs preset update)
- `packages/ui/src/tokens.ts` — Design tokens (colors, spacing, radius, shadows, typography, motion)

### Socket.IO
- `packages/socket/src/useSocket.ts` — Client hook (needs layout-level provider pattern)
- `apps/ops-api/src/socket.ts` — Server-side emit helpers

### Deployment
- `docker-compose.yml` — Current 5-container dashboard setup (to be consolidated)
- `Dockerfile.nextjs` — Shared Next.js image with APP_NAME build arg
- `apps/ops-api/src/routes/index.ts` — CORS ALLOWED_ORIGINS configuration

### Payroll Week Logic
- `apps/ops-api/src/services/payroll.ts` — getSundayWeekRange() for Sun-Sat week boundaries

### Research
- `.planning/research/SUMMARY.md` — Key findings for v1.3
- `.planning/research/ARCHITECTURE.md` — Migration architecture details
- `.planning/research/PITFALLS.md` — 14 pitfalls specific to this consolidation

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PageShell` with `navItems`/`activeNav`/`onNavChange` — handles sub-tab sidebar navigation, can be nested inside route-level layout
- `DateRangeFilter` component — needs preset label updates (7d→current-week, 30d→30d, month→last-week, custom stays)
- `captureTokenFromUrl()` / `authFetch()` / `getToken()` — auth primitives, work as-is within same-origin app
- Design tokens in `@ops/ui` — colors, spacing, radius, shadows, typography, motion
- `getSundayWeekRange()` — Sun-Sat week boundary logic, reuse for Current Week preset

### Established Patterns
- Single `"use client"` page.tsx per dashboard with `useState` for sub-tab switching
- Module-level SCREAMING_SNAKE_CASE style constants (CARD, BTN, HEADER etc.)
- `const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? ""` at top of each page
- `useCallback` wrapping fetch functions with authFetch()
- Socket.IO: `useSocket` hook per page with event listeners in `useEffect`

### Integration Points
- New unified app `apps/ops-dashboard` with route groups for each dashboard
- Layout-level `SocketProvider` replaces per-page `useSocket` — single connection
- Layout-level `DateRangeContext` provides global date range state
- Tab bar component in `(dashboard)/layout.tsx` reads user roles from JWT
- CORS in ops-api needs just 1 origin (port 3011) instead of 5
- Docker needs 1 container for ops-dashboard instead of 5 separate ones

</code_context>

<specifics>
## Specific Ideas

- "H" favicon with heartbeat line across it — health/ops branding
- HTML title: "Horizon Operations"
- Login form design refreshed (not just ported) to match unified app feel
- Pill tabs with teal accent and subtle glow for active state
- Sub-components extracted during migration for better debuggability and long-term maintenance
- Single-role users don't see the tab bar at all — clean single-dashboard experience
- SUPER_ADMIN defaults to Owner tab (highest privilege view)
- Current Week preset defaults to Sun-Sat matching payroll week cycle

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-dashboard-consolidation-uniform-date-ranges*
*Context gathered: 2026-03-19*
