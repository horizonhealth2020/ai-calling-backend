# Architecture Patterns: Dashboard Consolidation & Uniform Date Ranges

**Domain:** Multi-dashboard monorepo consolidation into single unified app
**Researched:** 2026-03-19
**Confidence:** HIGH (analysis based on direct codebase inspection of all 5 apps, shared packages, auth flow, and deployment configs)

## Current Architecture (Before)

```
Browser
  |
  auth-portal (:3011)     login -> /landing role picker -> opens dashboard in new tab
  |           \          \          \
  manager (:3019)  payroll (:3012)  owner (:3026)  cs (:3014)  sales-board (:3013)
  |           |          |          |               |
  +---------- authFetch (Bearer token) -----------+
  |                                                |
  ops-api (:8080) ------ CORS whitelist: 5 origins |
  |                                                |
  PostgreSQL                                       |
  |                                                |
  Socket.IO ------ 5 independent connections ------+
```

**5 separate Next.js apps** each with their own:
- `package.json`, `next.config.js`, `tsconfig.json`
- Single `app/page.tsx` (all UI in one file per app)
- `captureTokenFromUrl()` call on mount
- `PageShell` wrapper with sidebar nav for sub-tabs
- Independent Socket.IO connection

**Line counts:**
| App | Lines | Sub-tabs |
|-----|-------|----------|
| manager-dashboard | 2,702 | entry, tracker, sales, audits, config |
| payroll-dashboard | 3,030 | periods, chargebacks, exports, products, service |
| owner-dashboard | 1,957 | dashboard, kpis, config, users |
| cs-dashboard | 2,377 | submissions, tracking |
| auth-portal | 502 | login, change-password, landing |
| **Total** | **10,568** | |

### Current Auth Flow (Critical Path)

1. User visits `auth-portal:3011/` -- sees login form
2. Login form POSTs to `/api/login` (Next.js route handler)
3. Route handler proxies to `ops-api:8080/api/auth/login`
4. ops-api returns `{ token, roles }` -- JWT contains `{ id, email, name, roles }`
5. Route handler builds redirect: `/landing?session_token=TOKEN&roles=ROLE1,ROLE2`
6. Landing page reads roles from URL, shows dashboard cards with env-var URLs
7. User clicks card -- `window.open(DASHBOARD_URL?session_token=TOKEN, "_blank")`
8. Dashboard app runs `captureTokenFromUrl()` -- stores token in localStorage, cleans URL
9. All subsequent API calls use `authFetch()` which reads token from localStorage

**Key observation:** Each dashboard is a completely separate origin. Token passes via URL query param across origins. This is the fragile part that consolidation eliminates.

### Current Cross-Origin Dependencies

| Env Var | Set On | Value |
|---------|--------|-------|
| `MANAGER_DASHBOARD_URL` | auth-portal | `http://localhost:3019` |
| `PAYROLL_DASHBOARD_URL` | auth-portal | `http://localhost:3012` |
| `OWNER_DASHBOARD_URL` | auth-portal | `http://localhost:3026` |
| `CS_DASHBOARD_URL` | auth-portal | `http://localhost:3014` |
| `AUTH_PORTAL_URL` | auth-portal | `http://localhost:3011` |
| `ALLOWED_ORIGINS` | ops-api | All 5 dashboard origins |

**After consolidation:** All of these env vars become unnecessary. One origin, one CORS entry.

## Recommended Architecture (After)

### Single Unified App: `apps/dashboard`

```
Browser
  |
  dashboard (:3011)
  |  /              -- login page
  |  /manager       -- manager content
  |  /payroll       -- payroll content
  |  /owner         -- owner content
  |  /cs            -- CS content
  |
  +-- authFetch (Bearer token, same origin) --+
  |                                           |
  ops-api (:8080) -- CORS: 2 origins ---------+
  |                                           |
  PostgreSQL                                  |
  |                                           |
  Socket.IO -- 1 connection at a time --------+

  sales-board (:3013)  -- unchanged, standalone
```

### File Structure

```
apps/dashboard/
  app/
    layout.tsx                  -- root layout: html, body, font, metadata
    page.tsx                    -- login page (from auth-portal/app/page.tsx)
    api/
      login/route.ts            -- proxy to ops-api (from auth-portal)
      verify/route.ts           -- JWT verification (from auth-portal)
      change-password/route.ts  -- password change (from auth-portal)
    (dashboard)/                -- route group: no URL segment, just auth boundary
      layout.tsx                -- DashboardShell: role-gated top-level sidebar + user info
      manager/page.tsx          -- manager content (2,702 lines, keeps internal sub-tabs)
      payroll/page.tsx          -- payroll content (3,030 lines, keeps internal sub-tabs)
      owner/page.tsx            -- owner content (1,957 lines, keeps internal sub-tabs)
      cs/page.tsx               -- CS content (2,377 lines, keeps internal sub-tabs)
  lib/
    auth.ts                     -- JWT verification for middleware (from auth-portal/lib/auth.ts)
    roles.ts                    -- role-to-tab mapping, default tab resolution
  middleware.ts                 -- protect (dashboard)/* routes, redirect to / if unauthenticated
  next.config.js
  package.json
  tsconfig.json
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `app/page.tsx` (login) | Login form + change-password | `/api/login` route handler |
| `app/api/login/route.ts` | Proxy auth to ops-api, return redirect path | ops-api `/api/auth/login` |
| `middleware.ts` | Verify JWT on `/(dashboard)/*`, redirect to `/` if invalid | `/api/verify` |
| `(dashboard)/layout.tsx` | Top-level sidebar with role-gated tabs, user name display, logout | Reads JWT claims client-side |
| `(dashboard)/manager/page.tsx` | Manager tab: entry, tracker, sales, audits, config sub-tabs | ops-api via `authFetch`, Socket.IO |
| `(dashboard)/payroll/page.tsx` | Payroll tab: periods, chargebacks, exports, products, service sub-tabs | ops-api via `authFetch`, Socket.IO |
| `(dashboard)/owner/page.tsx` | Owner tab: dashboard, kpis, config, users sub-tabs | ops-api via `authFetch`, Socket.IO |
| `(dashboard)/cs/page.tsx` | CS tab: submissions, tracking sub-tabs | ops-api via `authFetch`, Socket.IO |

### Data Flow

**Login (simplified -- same origin):**
```
1. User visits /                        -- login page renders
2. User submits credentials
3. POST /api/login                      -- Next.js route handler
4.   -> ops-api /api/auth/login         -- validates credentials
5.   <- { token, roles }
6.   <- { redirect: "/manager?session_token=TOKEN" }  -- path, not URL
7. Browser navigates to /manager?session_token=TOKEN
8. middleware.ts verifies JWT            -- passes
9. (dashboard)/layout.tsx renders        -- decodes JWT for roles, shows nav
10. captureTokenFromUrl() stores token   -- cleans URL to /manager
11. manager/page.tsx renders content
```

**Tab navigation (client-side, no reload):**
```
1. User clicks "Payroll" in sidebar
2. Next.js Link navigates to /payroll   -- client-side transition
3. manager/page.tsx unmounts             -- Socket.IO disconnects
4. payroll/page.tsx mounts               -- Socket.IO connects
5. Token already in localStorage         -- authFetch works immediately
```

**Key improvement:** No cross-origin redirects. No `window.open`. No env vars for dashboard URLs. Token stays in localStorage on the same origin.

### Role-to-Tab Mapping

```typescript
// lib/roles.ts
import type { AppRole } from "@ops/types";

interface TabConfig {
  path: string;
  label: string;
  iconKey: string; // resolved to React element in layout
}

const TAB_CONFIG: TabConfig[] = [
  { path: "/manager", label: "Manager", iconKey: "users" },
  { path: "/payroll", label: "Payroll", iconKey: "dollar" },
  { path: "/owner",   label: "Owner",   iconKey: "chart" },
  { path: "/cs",      label: "Customer Service", iconKey: "headphones" },
];

const ROLE_TO_TABS: Record<string, string[]> = {
  MANAGER:          ["/manager"],
  PAYROLL:          ["/payroll"],
  OWNER_VIEW:       ["/owner"],
  CUSTOMER_SERVICE: ["/cs"],
  SUPER_ADMIN:      ["/manager", "/payroll", "/owner", "/cs"], // all tabs
};

export function getTabsForRoles(roles: string[]): TabConfig[] {
  const allowed = new Set<string>();
  for (const role of roles) {
    for (const path of ROLE_TO_TABS[role] ?? []) {
      allowed.add(path);
    }
  }
  return TAB_CONFIG.filter(t => allowed.has(t.path));
}

export function getDefaultTab(roles: string[]): string {
  // Priority: manager > payroll > owner > cs
  const tabs = getTabsForRoles(roles);
  return tabs[0]?.path ?? "/manager";
}
```

### Two-Level Navigation Architecture

**Top level (route-based, in layout.tsx):** Manager | Payroll | Owner | CS
- Implemented as Next.js `<Link>` navigation between routes
- Role-gated: only tabs the user has access to appear
- Persists across page transitions (layout does not remount)

**Sub level (state-based, in each page.tsx):** e.g., Entry | Tracker | Sales | Audits | Config
- Implemented with `useState` inside each page component (unchanged from today)
- Resets when navigating away and back (acceptable -- matches current behavior)

**PageShell modification:** The existing `PageShell` component renders a full sidebar with logo, title, and nav items. For the unified app:

**Recommended approach: Split PageShell into two components.**

1. **`DashboardShell`** (new, in `@ops/ui` or in `apps/dashboard`): Renders the outer sidebar with top-level role-gated tabs, user info, logout button. This is the `(dashboard)/layout.tsx`.

2. **`SubTabBar`** (new, extracted from PageShell): Renders a horizontal tab bar for in-page sub-navigation. Each dashboard page uses this for its internal tabs.

This avoids nested sidebars and gives a clean separation. The existing `PageShell` continues to work for sales-board (which remains standalone).

## Migration Path (Detailed)

### Phase 1: Create App Shell + Login

**New files:**
- `apps/dashboard/package.json` -- dependencies from auth-portal + any dashboard (union of all transpilePackages)
- `apps/dashboard/next.config.js` -- standard config with `transpilePackages: ["@ops/ui", "@ops/auth", "@ops/socket", "@ops/utils"]`
- `apps/dashboard/tsconfig.json` -- extends `../../tsconfig.base.json`
- `apps/dashboard/app/layout.tsx` -- root layout (html/body/metadata)
- `apps/dashboard/app/page.tsx` -- login page (copy from auth-portal)
- `apps/dashboard/app/api/login/route.ts` -- copy from auth-portal, change redirect from `/landing` to `/(dashboard)/[default-tab]`
- `apps/dashboard/app/api/verify/route.ts` -- copy from auth-portal
- `apps/dashboard/app/api/change-password/route.ts` -- copy from auth-portal

**Modified files:**
- `package.json` (root) -- add `"dashboard:dev": "npm run dev -w apps/dashboard"`

**Validation:** Login works, redirects to a placeholder dashboard page.

### Phase 2: Auth Middleware + Dashboard Layout

**New files:**
- `apps/dashboard/middleware.ts` -- protect `/(dashboard)/*` routes, redirect to `/` if no valid JWT
- `apps/dashboard/app/(dashboard)/layout.tsx` -- DashboardShell with role-gated top-level tabs
- `apps/dashboard/lib/auth.ts` -- JWT verification helpers (from auth-portal)
- `apps/dashboard/lib/roles.ts` -- role-to-tab mapping

**New in @ops/ui (or local):**
- `SubTabBar` component for in-page sub-navigation

**Validation:** Login redirects to correct default tab. Sidebar shows role-appropriate tabs. Clicking tabs navigates between routes. Unauthorized users see only their permitted tabs.

### Phase 3: Migrate CS Dashboard (simplest)

**New files:**
- `apps/dashboard/app/(dashboard)/cs/page.tsx` -- content from `apps/cs-dashboard/app/page.tsx`

**Changes to content:**
1. Remove `captureTokenFromUrl()` useEffect (layout handles it)
2. Replace outer `<PageShell>` with `<SubTabBar>` for submissions/tracking sub-tabs
3. Keep all internal state, fetch logic, Socket.IO connection unchanged
4. Role-based tab visibility (`canManageCS`) stays in the page (reads JWT roles)

**Validation:** CS tab works with submissions and tracking. Socket.IO real-time updates work.

### Phase 4: Migrate Owner Dashboard

**New files:**
- `apps/dashboard/app/(dashboard)/owner/page.tsx`

**Changes:** Same pattern as Phase 3. Owner has role-dependent sub-tabs (SUPER_ADMIN sees "Users" tab) -- this logic stays in the page.

### Phase 5: Migrate Payroll Dashboard

**New files:**
- `apps/dashboard/app/(dashboard)/payroll/page.tsx`

**Changes:** Same pattern. Payroll has badge counts on sub-tabs (approval needed) -- this stays in the page.

### Phase 6: Migrate Manager Dashboard

**New files:**
- `apps/dashboard/app/(dashboard)/manager/page.tsx`

**Changes:** Same pattern. Manager is the most complex with 5 sub-tabs and cross-tab shared state (agents, products, lead sources loaded once and used across tabs). All of this stays within the single page component.

### Phase 7: Uniform Date Range Picker

**Modified files:**
- Each migrated page.tsx -- add `DateRangeFilter` component to KPI sections
- `DateRangeFilter` already exists in `@ops/ui` (added in v1.2 for CSV exports)

**New behavior:** The `DateRangeFilter` component gets applied to KPI counters/cards, not just CSV exports. Each page manages its own date range state. Options: Current Week, Last Week, 30 Days, Custom.

The `DateRangeFilter` component and `DateRangeFilterValue` type already exist in `@ops/ui` -- they were added in v1.2. The work is wiring them to KPI fetch calls in each dashboard.

### Phase 8: Update Deployment + Remove Old Apps

**Modified files:**
- `docker-compose.yml` -- replace 5 dashboard services with 1, update ALLOWED_ORIGINS
- `.env.example` files -- remove dashboard URL vars
- ops-api `ALLOWED_ORIGINS` -- reduce to 2 origins

**Deleted:**
- `apps/auth-portal/` (entire directory)
- `apps/manager-dashboard/` (entire directory)
- `apps/payroll-dashboard/` (entire directory)
- `apps/owner-dashboard/` (entire directory)
- `apps/cs-dashboard/` (entire directory)

**Railway:** Delete 5 services, create 1 dashboard service.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Global State Manager for Auth
**What:** Adding Redux/Zustand/Context to share auth state across tabs.
**Why bad:** Over-engineered. Token is in localStorage; each page reads it via `getToken()`. The JWT contains roles. No synchronization needed.
**Instead:** Keep `localStorage` + `getToken()` / `authFetch()`. Decode JWT for roles where needed.

### Anti-Pattern 2: Single Mega Page
**What:** Putting all 4 dashboards into one giant page.tsx with top-level tab state.
**Why bad:** 10,000+ line file. No code splitting. Every tab's code loads on first visit.
**Instead:** Use Next.js file-based routing. Each dashboard is a separate route with automatic code splitting.

### Anti-Pattern 3: Converting Sub-Tabs to Nested Routes
**What:** Making manager/entry, manager/tracker, manager/sales into separate Next.js routes.
**Why bad:** Each dashboard page has deeply shared state (agents list, products, lead sources loaded once and used across all sub-tabs). Breaking into routes forces lifting all shared state into a layout, which is far more complex than the current useState approach.
**Instead:** Keep sub-tabs as React state within each page. Only top-level dashboard tabs use Next.js routing.

### Anti-Pattern 4: Keeping Auth-Portal Separate
**What:** Running auth-portal alongside the unified dashboard, redirecting between them.
**Why bad:** Cross-origin token passing via URL params is fragile. Adds CORS complexity. Defeats the purpose of consolidation.
**Instead:** Login is `app/page.tsx` in the unified app. Same origin throughout.

### Anti-Pattern 5: Dynamic Imports for Dashboard Pages
**What:** Using `next/dynamic` to lazy-load each dashboard page component.
**Why bad:** Next.js App Router already code-splits by route automatically. Dynamic imports add complexity and break the built-in splitting.
**Instead:** Let file-based routing handle code splitting naturally.

### Anti-Pattern 6: URL-Based Date Range State Across Top-Level Tabs
**What:** Persisting date range selection in URL search params so it survives navigation between /manager and /payroll.
**Why bad:** Different dashboards have different KPI sections with different date range semantics. A "Last Week" filter on payroll means payroll week; on manager it means sales week. Sharing creates confusion.
**Instead:** Each page manages its own date range state. Navigating away resets it (matches current behavior where each app was independent).

## New vs Modified vs Removed

### New Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `DashboardShell` | `apps/dashboard/app/(dashboard)/layout.tsx` | Role-gated sidebar with top-level tabs |
| `SubTabBar` | `@ops/ui` or `apps/dashboard/lib/` | Horizontal tab bar for in-page sub-navigation |
| `useUserRoles` | `apps/dashboard/lib/roles.ts` | Decode JWT to extract roles array |
| `getTabsForRoles` | `apps/dashboard/lib/roles.ts` | Map roles to permitted top-level tabs |
| `getDefaultTab` | `apps/dashboard/lib/roles.ts` | Determine post-login redirect path |

### Modified Components
| Component | Change |
|-----------|--------|
| `@ops/auth/client` | Export `decodeTokenPayload` (currently private function) |
| Each dashboard page.tsx | Remove `captureTokenFromUrl()`, remove outer `PageShell`, use `SubTabBar` for sub-tabs |
| `apps/dashboard/app/api/login/route.ts` | Redirect to `/{default-tab}?session_token=TOKEN` instead of `/landing?...&roles=...` |

### Removed
| Component | Replaced By |
|-----------|-------------|
| `auth-portal/app/landing/page.tsx` | Role-gated tabs in dashboard layout |
| `auth-portal/middleware.ts` | `dashboard/middleware.ts` |
| All 4 dashboard `next.config.js` | Single `apps/dashboard/next.config.js` |
| All 4 dashboard `package.json` | Single `apps/dashboard/package.json` |
| `MANAGER_DASHBOARD_URL` env var | Not needed (same origin) |
| `PAYROLL_DASHBOARD_URL` env var | Not needed |
| `OWNER_DASHBOARD_URL` env var | Not needed |
| `CS_DASHBOARD_URL` env var | Not needed |
| `AUTH_PORTAL_URL` env var | Not needed |

### Unchanged
| Component | Why |
|-----------|-----|
| `@ops/ui PageShell` | Still used by sales-board (standalone) |
| `@ops/auth` (server) | JWT signing/verification unchanged |
| `@ops/socket` | `useSocket` hook works identically per-page |
| `@ops/utils` | No changes |
| `@ops/types` | No changes (AppRole enum stays) |
| `ops-api` | No API changes. Only CORS origin list simplified. |
| `sales-board` | Remains standalone, unchanged |

## Deployment Impact

| Aspect | Before | After |
|--------|--------|-------|
| Next.js services | 6 (auth + 4 dashboards + sales-board) | 2 (dashboard + sales-board) |
| Docker containers | 8 (postgres + api + 6 Next.js) | 4 (postgres + api + 2 Next.js) |
| Railway services | 7 | 3 |
| CORS origins | 5-6 | 2 |
| Cross-service env vars | 5 dashboard URLs | 0 |
| Build time | 6 parallel Next.js builds | 2 builds (1 larger) |
| Runtime memory | ~6 Node.js processes | ~2 Node.js processes |
| Cold start surface | 6 independent cold starts | 2 cold starts |

### Docker Compose (After)

```yaml
dashboard:
  build:
    context: .
    dockerfile: Dockerfile.nextjs
    args:
      APP_NAME: dashboard
      NEXT_PUBLIC_OPS_API_URL: ${OPS_API_URL:-http://localhost:8080}
  restart: unless-stopped
  depends_on:
    - ops-api
  environment:
    AUTH_JWT_SECRET: ${AUTH_JWT_SECRET}
  ports:
    - "3011:3000"  # keep same port for minimal infra change

# Remove: auth-portal, manager-dashboard, payroll-dashboard, owner-dashboard, cs-dashboard
```

ops-api `ALLOWED_ORIGINS` changes to: `http://localhost:3011,http://localhost:3013`

## Build Order Summary

| Step | What | Validates | Depends On |
|------|------|-----------|------------|
| 1 | App shell + login page | Login works on single origin | Nothing |
| 2 | Middleware + dashboard layout + role nav | Auth boundary, tab navigation | Step 1 |
| 3 | Migrate CS dashboard | Migration pattern works | Step 2 |
| 4 | Migrate owner dashboard | Role-dependent sub-tabs work | Step 2 |
| 5 | Migrate payroll dashboard | Complex sub-tabs + badges work | Step 2 |
| 6 | Migrate manager dashboard | Full feature set works | Step 2 |
| 7 | Uniform date range on all KPI sections | Date filtering works per-page | Steps 3-6 |
| 8 | Deployment update + old app removal | Production-ready | Steps 1-7 |

**Ordering rationale:** Steps 1-2 create the foundation. Steps 3-6 are independent of each other (can be done in any order) but CS is simplest so it validates the pattern first. Step 7 can be done incrementally as each page is migrated. Step 8 is last because old apps remain functional until all pages are migrated.

## Sources

- Direct codebase analysis of all 5 dashboard apps, auth flow, shared packages, and deployment config
- Next.js App Router route groups documentation (HIGH confidence -- well-established pattern since Next.js 13)
- Existing `@ops/auth/client` token handling pattern (direct code inspection)
- Existing `@ops/ui` PageShell component API (direct code inspection)

---
*Research completed: 2026-03-19 -- v1.3 Dashboard Consolidation & Uniform Date Ranges*
