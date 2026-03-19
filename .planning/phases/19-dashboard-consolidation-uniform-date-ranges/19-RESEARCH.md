# Phase 19: Dashboard Consolidation & Uniform Date Ranges - Research

**Researched:** 2026-03-19
**Domain:** Multi-app Next.js consolidation with role-gated navigation + uniform date range filtering
**Confidence:** HIGH

## Summary

This phase consolidates five separate Next.js dashboard apps (auth-portal, manager-dashboard, payroll-dashboard, owner-dashboard, cs-dashboard) into a single unified Next.js app (`apps/ops-dashboard`) with role-gated tab navigation, uniform date range filtering across all KPI sections, and deployment cleanup. The sales board remains standalone.

The migration is predominantly mechanical -- ~10,568 lines of existing TSX move from five `page.tsx` files into route segments under a shared `(dashboard)` route group. No new npm packages are required. The architectural approach is well-established: Next.js App Router route groups for auth boundaries, file-based code splitting per dashboard route, React context for shared state (date range, Socket.IO connection). The primary risks are regression across role types, CORS misconfiguration, and auth flow rewrite errors.

The `DateRangeFilter` component already exists in `@ops/ui` (added in v1.2) and needs preset label updates. The server-side `dateRange()` utility in ops-api already supports `week`, `7d`, `30d`, `month`, and `custom` ranges. A `last_week` case is the only server addition needed. Several KPI endpoints already accept date range params; two key ones (`/agent-kpis`, `/chargebacks/weekly-total`) are currently hardcoded and need updates.

**Primary recommendation:** Use route-segment-per-dashboard architecture with `(dashboard)` route group. Migrate dashboards one at a time (CS first as simplest, Manager last as most complex). Wire date range filtering after all migrations complete.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Horizontal pill tab bar across the top with teal accent for active tab (dark glassmorphism theme)
- Sub-tabs stay inside each page via existing PageShell sidebar pattern -- two-level nav: tabs at top, sub-tabs in sidebar
- Tab switching uses URL-based routing: `/manager`, `/payroll`, `/owner`, `/cs` as Next.js route segments
- Hide tab bar for single-role users (only 1 dashboard)
- SUPER_ADMIN sees all four tabs
- Login form lives at root page `/` of the unified app -- no separate auth-portal
- After login, user redirects to default tab based on role: SUPER_ADMIN -> `/owner`, OWNER_VIEW -> `/owner`, MANAGER -> `/manager`, PAYROLL -> `/payroll`, CUSTOMER_SERVICE -> `/cs`
- Global date range shared across all tabs via React context in layout
- Default preset on load: Current Week (Sun-Sat, matches payroll week cycle)
- Four presets: Current Week, Last Week, 30 Days, Custom
- Date range positioned above KPI cards within each tab's content area (not in the tab bar)
- Unified app name: `apps/ops-dashboard`
- Port: 3011 (reuses auth-portal port)
- Each dashboard becomes a Next.js route segment under `app/(dashboard)/`
- Sub-tab content extracted into component files during migration
- Shared Socket.IO provider in the layout -- single connection for entire app
- Favicon: "H" with a heartbeat line through it
- HTML title tag: "Horizon Operations"
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

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SHELL-01 | Single unified dashboard app with top-level tab navigation | Route-segment-per-dashboard architecture with `(dashboard)/layout.tsx` hosting pill tab bar; file structure pattern verified |
| SHELL-02 | Tab visibility gated by user's role | `lib/roles.ts` with `TAB_ROLES` constant consumed by both middleware and layout; `AppRole` enum from `@ops/types` confirmed (`SUPER_ADMIN`, `OWNER_VIEW`, `MANAGER`, `PAYROLL`, `CUSTOMER_SERVICE`) |
| SHELL-03 | SUPER_ADMIN sees all tabs | SUPER_ADMIN mapped to all four tab paths in `TAB_ROLES`; existing `SUPER_ADMIN` bypass pattern in ops-api middleware confirmed |
| SHELL-04 | Login lands on default tab based on role | Login route handler returns redirect path based on `getDefaultTab(roles)`; mapping: SUPER_ADMIN/OWNER_VIEW -> `/owner`, MANAGER -> `/manager`, PAYROLL -> `/payroll`, CUSTOMER_SERVICE -> `/cs` |
| SHELL-05 | Socket.IO shared at layout level | `SocketProvider` context wrapping `(dashboard)/layout.tsx`; existing `useSocket` hook creates connection in `useEffect` -- refactor to provider pattern that maintains single connection across route transitions |
| MIG-01 | CS dashboard migrated with identical features | Source: `apps/cs-dashboard/app/page.tsx` (2,377 lines, 2 sub-tabs). Dependencies: `@ops/auth`, `@ops/socket`, `@ops/ui`, `@ops/utils`, `lucide-react`. Socket events: `cs:changed` |
| MIG-02 | Owner dashboard migrated with identical features | Source: `apps/owner-dashboard/app/page.tsx` (1,957 lines, 4 sub-tabs including SUPER_ADMIN-gated Users). Dependencies: `@ops/socket`, `@ops/ui`, `@ops/utils`, `socket.io-client` |
| MIG-03 | Payroll dashboard migrated with identical features | Source: `apps/payroll-dashboard/app/page.tsx` (3,030 lines, 5 sub-tabs). Dependencies: `@ops/socket`, `@ops/ui`, `@ops/utils`, `socket.io-client` |
| MIG-04 | Manager dashboard migrated with identical features | Source: `apps/manager-dashboard/app/page.tsx` (2,702 lines, 5 sub-tabs with deeply shared state). Dependencies: `@ops/socket`, `@ops/ui`, `@ops/utils`, `socket.io-client` |
| DR-01 | Uniform DateRangeFilter with 4 presets | Existing `DateRangeFilter` in `@ops/ui` has presets `7d/30d/month/custom`. Needs new `presets` prop to accept `current_week/last_week/30d/custom` while remaining backward-compatible for existing usages |
| DR-02 | Date range on CS tracker KPI counters | CS tracker shows chargeback/pending-term counts. Endpoints `/chargebacks` and `/pending-terms` need date range params added. `/chargebacks/weekly-total` is hardcoded to current week |
| DR-03 | Date range on Manager tracker KPI counters | `/tracker/summary` endpoint already accepts `dateRange()` params (confirmed at line 806 of routes/index.ts) |
| DR-04 | Date range on Owner performance overview KPIs | `/owner/summary` endpoint already accepts `dateRange()` params (confirmed at line 1186 of routes/index.ts) |
| DR-05 | Date range on Payroll dashboard KPIs | Payroll periods endpoint (`/payroll/periods`) does not currently accept date range params -- returns all periods. Needs date filter for KPI counters |
| DR-06 | CSV export date range pickers use uniform presets | Existing CSV export flows use `DateRangeFilter` component. Updating the component's presets prop will propagate to exports |
| DEPLOY-01 | CORS config updated for single unified app origin | `ALLOWED_ORIGINS` in: ops-api index.ts (line 34 default), docker-compose.yml (line 34 env), Railway env vars. Change from 6 origins to 2 (`localhost:3011`, `localhost:3013`) |
| DEPLOY-02 | Docker configuration for unified app | Replace 5 dashboard services + auth-portal with 1 `ops-dashboard` service. `APP_NAME: ops-dashboard`. Keep `sales-board` and `ops-api` |
| DEPLOY-03 | Old standalone app directories removed | Delete: `apps/auth-portal/`, `apps/manager-dashboard/`, `apps/payroll-dashboard/`, `apps/owner-dashboard/`, `apps/cs-dashboard/` |
| DEPLOY-04 | Sales board remains standalone and functional | `sales-board` at port 3013 unchanged. Must verify backward-compatibility of any `@ops/socket`, `@ops/ui`, `@ops/auth/client` changes |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.3.9 | App Router with route groups for unified app | Already in use across all 6 apps; route-based code splitting built in |
| React | 18.3.1 | UI framework | Current version across all apps |
| `@ops/ui` | workspace | PageShell, DateRangeFilter, TabNav, design tokens | Existing shared UI library; all components already built |
| `@ops/auth` | workspace | Server-side JWT sign/verify (`verifySessionToken`) | Confirmed: returns `SessionUser` with `{ id, email, name, roles }` |
| `@ops/auth/client` | workspace | Browser-side `captureTokenFromUrl()`, `authFetch()`, `getToken()`, `clearToken()` | No changes needed; `decodeTokenPayload` needs to be exported (currently private) |
| `@ops/socket` | workspace | `useSocket` hook for Socket.IO client | Needs additive `SocketProvider` pattern; existing hook must stay backward-compatible for sales-board |
| `@ops/types` | workspace | `AppRole` type, `SessionUser` type | Single source of truth for role strings |
| `@ops/utils` | workspace | Structured JSON logging | No changes needed |
| socket.io-client | ^4.8.3 | Socket.IO browser client | Already a dependency in all dashboard apps |
| lucide-react | ^0.577.0 | Icons | Used by cs-dashboard; needed in unified app |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Luxon | 3.4.4 | Date calculations for Current Week / Last Week presets | Already in root package; `getSundayWeekRange()` in payroll.ts uses it for Sun-Sat boundaries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React Context for date range | URL search params | URL params survive navigation but add complexity; Context is simpler and matches "uniform" requirement |
| React Context for Socket.IO | Per-page useSocket (current) | Per-page causes connect/disconnect churn on tab switch; Context maintains single connection |
| zustand/redux for shared state | React Context | Over-engineered; only two pieces of shared state (date range, socket) |

**Installation:**
```bash
# No new packages needed. Unified app package.json merges deps from all 5 apps:
# @ops/auth, @ops/socket, @ops/ui, @ops/utils (workspace:*)
# lucide-react, socket.io-client, next, react, react-dom
npm install
```

## Architecture Patterns

### Recommended Project Structure
```
apps/ops-dashboard/
  app/
    layout.tsx                  # Root layout: html, body, metadata ("Horizon Operations"), favicon
    page.tsx                    # Login page (migrated from auth-portal)
    api/
      login/route.ts            # Proxy to ops-api; redirect to /{default-tab}?session_token=TOKEN
      verify/route.ts           # JWT verification (from auth-portal)
      change-password/route.ts  # Password change (from auth-portal)
    (dashboard)/                # Route group: auth boundary, no URL segment
      layout.tsx                # DashboardShell: pill tab bar, SocketProvider, DateRangeContext
      manager/
        page.tsx                # Orchestrator with shared state
        ManagerEntry.tsx        # Sub-tab component
        ManagerTracker.tsx
        ManagerSales.tsx
        ManagerAudits.tsx
        ManagerConfig.tsx
      payroll/
        page.tsx
        PayrollPeriods.tsx
        PayrollChargebacks.tsx
        PayrollExports.tsx
        PayrollService.tsx
        PayrollProducts.tsx
      owner/
        page.tsx
        OwnerOverview.tsx
        OwnerKPIs.tsx
        OwnerConfig.tsx
        OwnerUsers.tsx          # SUPER_ADMIN only
      cs/
        page.tsx
        CSSubmissions.tsx
        CSTracking.tsx
  lib/
    roles.ts                    # TAB_ROLES, getTabsForRoles(), getDefaultTab()
    auth.ts                     # JWT verification helpers for middleware
    DateRangeContext.tsx         # React context for global date range state
    SocketProvider.tsx           # React context wrapping useSocket for shared connection
  middleware.ts                 # Protect (dashboard)/* routes only
  next.config.js
  package.json
  tsconfig.json
```

### Pattern 1: Route-Segment-Per-Dashboard with Shared Layout
**What:** Each dashboard is a separate Next.js route (`/manager`, `/payroll`, `/owner`, `/cs`) within a `(dashboard)` route group. The route group provides a shared layout with tab navigation, auth boundary, Socket.IO provider, and date range context.
**When to use:** Always -- this is the foundational structural decision.
**Example:**
```typescript
// app/(dashboard)/layout.tsx
"use client";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getTabsForRoles } from "@/lib/roles";
import { DateRangeProvider } from "@/lib/DateRangeContext";
import { SocketProvider } from "@/lib/SocketProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tabs = getTabsForRoles(userRoles); // decoded from JWT

  return (
    <SocketProvider apiUrl={process.env.NEXT_PUBLIC_OPS_API_URL ?? ""}>
      <DateRangeProvider>
        <div style={SHELL}>
          {tabs.length > 1 && (
            <nav style={TAB_BAR}>
              {tabs.map(tab => (
                <Link key={tab.path} href={tab.path}
                  style={pathname.startsWith(tab.path) ? ACTIVE_TAB : TAB}>
                  {tab.label}
                </Link>
              ))}
            </nav>
          )}
          {children}
        </div>
      </DateRangeProvider>
    </SocketProvider>
  );
}
```

### Pattern 2: Two-Level Navigation (Tabs + Sub-Tabs)
**What:** Top-level navigation uses Next.js `<Link>` between route segments (persistent across navigation). Sub-tab navigation uses `useState` within each page (resets when navigating away -- matches current behavior).
**When to use:** Every dashboard page.
**Example:**
```typescript
// app/(dashboard)/manager/page.tsx
"use client";
import { PageShell } from "@ops/ui";
import { useDateRange } from "@/lib/DateRangeContext";

export default function ManagerPage() {
  const [activeTab, setActiveTab] = useState("entry");
  const { dateRange } = useDateRange();

  return (
    <PageShell title="Manager" navItems={SUB_TABS} activeNav={activeTab} onNavChange={setActiveTab}>
      {activeTab === "entry" && <ManagerEntry />}
      {activeTab === "tracker" && <ManagerTracker dateRange={dateRange} />}
      {/* ... */}
    </PageShell>
  );
}
```

### Pattern 3: SocketProvider (Additive, Not Replacement)
**What:** A React context provider that creates a single Socket.IO connection at the layout level. Individual pages subscribe to events via context hooks. The existing `useSocket` hook stays unchanged for backward compatibility (sales-board uses it directly).
**When to use:** In `(dashboard)/layout.tsx`.
**Example:**
```typescript
// lib/SocketProvider.tsx
"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";

type SocketClient = import("socket.io-client").Socket;

interface SocketContextValue {
  socket: SocketClient | null;
  disconnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, disconnected: false });

export function SocketProvider({ apiUrl, children }: { apiUrl: string; children: React.ReactNode }) {
  const [disconnected, setDisconnected] = useState(false);
  const socketRef = useRef<SocketClient | null>(null);

  useEffect(() => {
    let mounted = true;
    import("socket.io-client").then(({ io }) => {
      if (!mounted) return;
      const socket = io(apiUrl, { transports: ["websocket", "polling"] });
      socketRef.current = socket;
      // ... connect/disconnect handlers
    });
    return () => { mounted = false; socketRef.current?.disconnect(); };
  }, [apiUrl]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, disconnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocketContext = () => useContext(SocketContext);
```

### Pattern 4: DateRangeContext with Uniform Presets
**What:** Global date range state shared across all tabs via React context in the dashboard layout. The `DateRangeFilter` component renders within each tab's content area but reads/writes from the shared context.
**When to use:** All KPI sections across all dashboard tabs.
**Example:**
```typescript
// lib/DateRangeContext.tsx
"use client";
import { createContext, useContext, useState } from "react";
import type { DateRangeFilterValue } from "@ops/ui";

const DateRangeContext = createContext<{
  value: DateRangeFilterValue;
  onChange: (v: DateRangeFilterValue) => void;
}>({ value: { preset: "week" }, onChange: () => {} });

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<DateRangeFilterValue>({ preset: "week" });
  return (
    <DateRangeContext.Provider value={{ value, onChange: setValue }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export const useDateRange = () => useContext(DateRangeContext);
```

### Pattern 5: Middleware with Positive Matcher
**What:** Next.js middleware that protects only dashboard routes using an explicit positive matcher. Login page, API routes, and static assets are implicitly unprotected.
**When to use:** `middleware.ts` in the app root.
**Example:**
```typescript
// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@ops/auth";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get("ops_session")?.value
    || request.headers.get("authorization")?.slice(7)
    || request.nextUrl.searchParams.get("session_token");

  if (!token) return NextResponse.redirect(new URL("/", request.url));

  const user = verifySessionToken(token);
  if (!user) return NextResponse.redirect(new URL("/", request.url));

  // Role check: verify user has access to the requested tab
  // Use TAB_ROLES from lib/roles.ts
  return NextResponse.next();
}

export const config = {
  matcher: ["/manager/:path*", "/payroll/:path*", "/owner/:path*", "/cs/:path*"],
};
```

### Anti-Patterns to Avoid
- **Monster page file:** NEVER merge all dashboards into one `page.tsx` with tab state. Use route-segment-per-dashboard.
- **Converting sub-tabs to nested routes:** Each dashboard has deeply shared state across sub-tabs (agents, products, lead sources loaded once). Breaking into routes forces complex state lifting. Keep sub-tabs as `useState` within each page.
- **Negative middleware matcher:** Using `/((?!api|_next|login).*)` is fragile. Use explicit positive matcher.
- **Global state manager:** No Redux/Zustand needed. Token is in localStorage (`getToken()`), date range in Context, socket in Context.
- **Dynamic imports for dashboard pages:** Next.js App Router already code-splits by route. `next/dynamic` adds complexity for zero benefit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT verification | Custom decode + verify | `verifySessionToken()` from `@ops/auth` | Already handles signing secret, expiry, type safety |
| Token management | Custom localStorage + header logic | `captureTokenFromUrl()`, `authFetch()`, `getToken()` from `@ops/auth/client` | Handles auto-refresh, timeout, URL cleanup |
| Date range calculation | Custom date math for week boundaries | `getSundayWeekRange()` from `payroll.ts` + server `dateRange()` utility | Already handles Sun-Sat boundaries, timezone, edge cases |
| Code splitting | `next/dynamic` or manual chunk splitting | Next.js file-based route splitting | Automatic per-route code splitting with route segments |
| Sub-tab navigation | Custom tab component | `PageShell` from `@ops/ui` | Already handles sidebar nav, mobile bottom nav, badges, active state |
| Date range UI | Custom date picker | `DateRangeFilter` from `@ops/ui` | Already has preset buttons, custom date inputs, design tokens |

**Key insight:** This project has an unusually complete set of existing shared components. The consolidation is 95% mechanical migration and 5% new glue code (SocketProvider, DateRangeContext, roles.ts, tab bar).

## Common Pitfalls

### Pitfall 1: Auth Middleware Intercepting Login/API Routes
**What goes wrong:** Middleware protects `/` (login page) or `/api/login`, causing infinite redirect loops or 401 on login attempts.
**Why it happens:** Overly broad middleware matcher or negative matcher that accidentally includes public routes.
**How to avoid:** Use explicit positive matcher: `["/manager/:path*", "/payroll/:path*", "/owner/:path*", "/cs/:path*"]`. Login at `/`, API routes at `/api/*`, and static assets are implicitly excluded.
**Warning signs:** Login page causes infinite redirect. POST to `/api/login` returns 401.

### Pitfall 2: CORS Origins Not Updated (3 Locations)
**What goes wrong:** Unified app at port 3011 makes `authFetch()` calls and Socket.IO connections to ops-api, which still has the old 6-origin CORS whitelist. Requests fail silently.
**Why it happens:** CORS is configured in THREE places: `apps/ops-api/src/index.ts` (default), `docker-compose.yml` (env), Railway env vars. Missing any one breaks a deployment target.
**How to avoid:** Update all three simultaneously. New value: `http://localhost:3011,http://localhost:3013` (unified app + sales board).
**Warning signs:** Red CORS errors in browser DevTools Network tab. Socket.IO disconnect banner appears permanently.

### Pitfall 3: Socket.IO Connect/Disconnect Churn on Tab Switches
**What goes wrong:** Each page's `useSocket` call creates a new connection on mount and disconnects on unmount. Switching tabs causes rapid connect/disconnect, brief disconnect banner flashes, and missed events.
**Why it happens:** `useSocket` hook creates connection in `useEffect` with cleanup that calls `socket.disconnect()`. Route navigation triggers unmount/mount cycle.
**How to avoid:** Create `SocketProvider` in `(dashboard)/layout.tsx` that maintains a single persistent connection. Pages subscribe to events via context, not by owning the connection.
**Warning signs:** Server logs show rapid connect/disconnect pairs. Disconnect banner flashes on tab switch.

### Pitfall 4: Date Range State Lost on Tab Navigation
**What goes wrong:** User sets "Last 30 Days" on Manager tab, switches to Payroll, switches back -- date range resets to default.
**Why it happens:** Local `useState` in each page is destroyed on route navigation (unmount).
**How to avoid:** Store date range in React context in `(dashboard)/layout.tsx`. All tabs read from the same context. Layout persists across route transitions.
**Warning signs:** Date range resets after any tab switch.

### Pitfall 5: Style Constant Name Collisions
**What goes wrong:** All dashboards define `const CARD`, `const BTN`, `const HEADER` with different values. If components from multiple dashboards end up in the same scope, wrong styles apply.
**Why it happens:** Each app was historically isolated; generic names never conflicted.
**How to avoid:** Route-segment-per-dashboard keeps constants scoped to their files. For the shared layout, use unique prefixes: `TAB_BAR`, `TAB_PILL`, `SHELL_HEADER`. Do NOT create a merged styles file.
**Warning signs:** Subtle visual differences compared to standalone dashboards.

### Pitfall 6: Role String Mismatch Between Client and Server
**What goes wrong:** Auth-portal's `ROLE_ACCESS` uses lowercase (`"owner"`, `"super_admin"`) while `@ops/types` uses uppercase (`"OWNER_VIEW"`, `"SUPER_ADMIN"`). Tab visibility and middleware check against different role formats.
**Why it happens:** Auth-portal was a separate implementation that didn't use shared types. The `verifyUser` endpoint returns `role: user.roles?.[0]?.toLowerCase()`.
**How to avoid:** Define `TAB_ROLES` once in `lib/roles.ts` using `AppRole` strings from `@ops/types` (uppercase). Both middleware and layout consume this single constant. The unified middleware should use `verifySessionToken` directly (returns `SessionUser` with typed `roles: AppRole[]`) instead of the auth-portal verify endpoint.
**Warning signs:** User sees a tab but API calls return 403. Or user doesn't see a tab they should have.

### Pitfall 7: Sales Board Regression from Shared Package Changes
**What goes wrong:** Adding `SocketProvider` to `@ops/socket` or modifying `DateRangeFilter` in `@ops/ui` breaks the standalone sales board.
**Why it happens:** Sales board depends on `@ops/ui` and `@ops/socket`. Any breaking change to shared packages affects it.
**How to avoid:** All shared package changes must be additive and backward-compatible. `SocketProvider` is a new export alongside existing `useSocket` (not a replacement). `DateRangeFilter` presets become configurable via prop with backward-compatible default. Test sales board after every shared package change: `npm run salesboard:dev`.
**Warning signs:** Sales board build fails or displays incorrectly after a shared package update.

### Pitfall 8: `decodeTokenPayload` Is Private in @ops/auth/client
**What goes wrong:** The dashboard layout needs to decode the JWT to extract user roles for tab visibility. `decodeTokenPayload` exists in `@ops/auth/client` but is not exported (it's a private function).
**Why it happens:** The function was originally written as an internal helper for `ensureTokenFresh()`.
**How to avoid:** Export `decodeTokenPayload` from `@ops/auth/client`. The function returns `{ exp?: number } | null` -- its return type needs to be widened to include `roles`, `name`, `email`, etc. (it already decodes the full payload, just has a narrow type annotation).
**Warning signs:** TypeScript error when trying to import `decodeTokenPayload`.

### Pitfall 9: Missing `transpilePackages` in Unified App Config
**What goes wrong:** Build fails with "Cannot use import statement outside a module" for shared packages.
**Why it happens:** Unified app `next.config.js` doesn't include all workspace packages. Different apps had different subsets.
**How to avoid:** Use the union of all transpile packages: `["@ops/ui", "@ops/auth", "@ops/socket", "@ops/utils"]`. Copy from manager-dashboard (most complete).
**Warning signs:** Cryptic ESM import errors during `next build`.

### Pitfall 10: Missing `last_week` Case in Server `dateRange()` Utility
**What goes wrong:** Client sends `?range=last_week` but server returns `undefined` (no matching case), so KPIs show unfiltered data.
**Why it happens:** Server `dateRange()` handles `today`, `week`, `7d`, `30d`, `month`, `custom` but NOT `last_week`.
**How to avoid:** Add a `last_week` case to `dateRange()` in `apps/ops-api/src/routes/index.ts` that computes the previous Sun-Sat week boundaries.
**Warning signs:** "Last Week" preset shows same data as "no filter".

## Code Examples

### Role-to-Tab Mapping (Single Source of Truth)
```typescript
// lib/roles.ts
// Source: AppRole from @ops/types, DASHBOARD_MAP from auth-portal/app/landing/page.tsx
import type { AppRole } from "@ops/types";

interface TabConfig {
  path: string;
  label: string;
}

export const TAB_CONFIG: TabConfig[] = [
  { path: "/manager", label: "Manager" },
  { path: "/payroll", label: "Payroll" },
  { path: "/owner", label: "Owner" },
  { path: "/cs", label: "Customer Service" },
];

export const TAB_ROLES: Record<string, AppRole[]> = {
  "/manager": ["MANAGER", "SUPER_ADMIN"],
  "/payroll": ["PAYROLL", "SUPER_ADMIN"],
  "/owner": ["OWNER_VIEW", "SUPER_ADMIN"],
  "/cs": ["CUSTOMER_SERVICE", "SUPER_ADMIN"],
};

export function getTabsForRoles(roles: AppRole[]): TabConfig[] {
  return TAB_CONFIG.filter(tab =>
    TAB_ROLES[tab.path]?.some(r => roles.includes(r))
  );
}

export function getDefaultTab(roles: AppRole[]): string {
  if (roles.includes("SUPER_ADMIN") || roles.includes("OWNER_VIEW")) return "/owner";
  if (roles.includes("MANAGER")) return "/manager";
  if (roles.includes("PAYROLL")) return "/payroll";
  if (roles.includes("CUSTOMER_SERVICE")) return "/cs";
  return "/owner";
}
```

### Login API Route (Simplified Same-Origin)
```typescript
// app/api/login/route.ts
// Source: adapted from apps/auth-portal/app/api/login/route.ts
export async function POST(req: Request) {
  const { email, password } = await req.json();
  const opsApiUrl = process.env.NEXT_PUBLIC_OPS_API_URL;
  if (!opsApiUrl) return Response.json({ error: "API URL not set" }, { status: 500 });

  const response = await fetch(`${opsApiUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) return Response.json({ error: "Invalid credentials" }, { status: 401 });

  const user = await response.json();
  const token = user.token ?? "";
  const roles = user.roles ?? [];

  // Compute default tab (same-origin redirect, not cross-origin)
  const defaultTab = getDefaultTab(roles);

  return Response.json({ redirect: `${defaultTab}?session_token=${token}` });
}
```

### DateRangeFilter Preset Extension
```typescript
// Updated DateRangeFilter with configurable presets
// Source: packages/ui/src/components/DateRangeFilter.tsx

export interface DateRangeFilterProps {
  value: DateRangeFilterValue;
  onChange: (value: DateRangeFilterValue) => void;
  presets?: Array<{ key: string; label: string }>; // NEW: configurable presets
}

const DEFAULT_PRESETS = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "custom", label: "Custom" },
];

const KPI_PRESETS = [
  { key: "week", label: "Current Week" },
  { key: "last_week", label: "Last Week" },
  { key: "30d", label: "30 Days" },
  { key: "custom", label: "Custom" },
];
```

### Server-Side `last_week` Addition
```typescript
// Add to dateRange() in apps/ops-api/src/routes/index.ts (after the "week" case at line 59)
if (range === "last_week") {
  const day = now.getDay();
  const thisSunday = new Date(todayStart);
  thisSunday.setDate(todayStart.getDate() - day);
  const lastSunday = new Date(thisSunday);
  lastSunday.setDate(thisSunday.getDate() - 7);
  return { gte: lastSunday, lt: thisSunday }; // previous Sun 00:00 to this Sun 00:00
}
```

## KPI Endpoint Date Range Audit

Critical finding: not all KPI endpoints currently accept date range params.

| Endpoint | Currently Accepts Date Range | Action Needed |
|----------|------------------------------|---------------|
| `GET /tracker/summary` | YES (line 806) | None -- already wired |
| `GET /owner/summary` | YES (line 1186) | None -- already wired |
| `GET /sales` | YES (line 491) | None -- already wired |
| `GET /payroll/entries` | YES (line 1446) | None -- already wired |
| `GET /agent-kpis` | NO (line 2444, hardcoded via `getAgentRetentionKpis()`) | Add optional date range params |
| `GET /chargebacks` | NO (line 2127, returns all) | Add optional date range filter on `createdAt` |
| `GET /chargebacks/weekly-total` | PARTIAL (line 2136, hardcoded current week) | Accept `range` param or use DateRangeFilter values |
| `GET /chargebacks/totals` | NO (line 2155) | Add optional date range filter |
| `GET /pending-terms` | NO (line 2316, returns all) | Add optional date range filter on `createdAt` |
| `GET /payroll/periods` | NO (line 861, returns all periods) | Payroll periods are inherently time-scoped by week; may not need date filter on the periods themselves, but KPI summary numbers need filtering |
| `GET /call-logs/kpi` | YES (likely via dateRange, needs confirmation) | Verify |
| `GET /sales-board/summary` | NO (line 1261) | Out of scope -- sales board stays as-is |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Cross-origin token via URL params | Same-origin localStorage + captureTokenFromUrl | This phase | Eliminates 5 dashboard URL env vars, simplifies auth |
| Per-app Socket.IO connections | Single SocketProvider at layout level | This phase | No connect/disconnect churn on tab switches |
| Per-app date range state | Global DateRangeContext in shared layout | This phase | Date range persists across tab switches |
| 5 Docker dashboard containers | 1 unified container | This phase | Reduces runtime from 6 Node.js processes to 2 |
| 6 CORS origins | 2 CORS origins | This phase | Simpler security surface |

## Open Questions

1. **`/agent-kpis` date range implementation**
   - What we know: `getAgentRetentionKpis()` is a service function with hardcoded 30-day window
   - What's unclear: Exact implementation -- whether it uses raw SQL or Prisma, how to parameterize the date range
   - Recommendation: Inspect the function during implementation; add optional `from`/`to` params

2. **Payroll KPI counters vs. period listing**
   - What we know: Payroll tab shows periods by week. The period list is inherently time-scoped.
   - What's unclear: Which specific KPI counters on the payroll tab should respond to the date range filter
   - Recommendation: Apply date range to summary counts (total sales, total commissions, total pending) but NOT to the period list itself

3. **`CUSTOMER_SERVICE` role in auth-portal SUPER_ADMIN expansion**
   - What we know: Login route handler expands SUPER_ADMIN to include `["SUPER_ADMIN", "MANAGER", "PAYROLL", "CUSTOMER_SERVICE"]` but NOT `OWNER_VIEW`
   - What's unclear: Whether SUPER_ADMIN should explicitly include OWNER_VIEW in the expansion (the server-side middleware bypasses role checks for SUPER_ADMIN anyway)
   - Recommendation: In the unified app, don't expand roles at login. Use `TAB_ROLES` which maps SUPER_ADMIN directly to all tabs. Server-side SUPER_ADMIN bypass handles API access.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 (root config covers Morgan service only) |
| Config file | `jest.config.js` (root) and `apps/ops-api/jest.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test && npm run test:ops` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-01 | Unified app renders with tab navigation | manual | Visual verification in browser | N/A |
| SHELL-02 | Tab visibility gated by role | manual | Login as each role type, verify visible tabs | N/A |
| SHELL-03 | SUPER_ADMIN sees all tabs | manual | Login as SUPER_ADMIN, verify all 4 tabs visible | N/A |
| SHELL-04 | Login lands on correct default tab | manual | Login as each role, verify redirect path | N/A |
| SHELL-05 | Socket.IO shared at layout level | manual | Switch tabs, verify no disconnect banner flash in server logs | N/A |
| MIG-01 | CS dashboard identical to standalone | manual | Side-by-side comparison of all CS features | N/A |
| MIG-02 | Owner dashboard identical to standalone | manual | Side-by-side comparison of all owner features | N/A |
| MIG-03 | Payroll dashboard identical to standalone | manual | Side-by-side comparison of all payroll features | N/A |
| MIG-04 | Manager dashboard identical to standalone | manual | Side-by-side comparison of all manager features | N/A |
| DR-01 | DateRangeFilter with 4 presets | manual | Verify 4 preset buttons render, custom shows date inputs | N/A |
| DR-02 | Date range on CS tracker KPIs | manual | Select date range, verify CS counters update | N/A |
| DR-03 | Date range on Manager tracker KPIs | manual | Select date range, verify Manager counters update | N/A |
| DR-04 | Date range on Owner overview KPIs | manual | Select date range, verify Owner counters update | N/A |
| DR-05 | Date range on Payroll KPIs | manual | Select date range, verify Payroll counters update | N/A |
| DR-06 | CSV exports use uniform presets | manual | Open CSV export, verify preset buttons match | N/A |
| DEPLOY-01 | CORS updated | unit | Verify ALLOWED_ORIGINS env in ops-api | N/A |
| DEPLOY-02 | Docker config updated | manual-only | `docker-compose up`, verify 4 containers (postgres, api, dashboard, sales-board) | N/A -- justification: Docker compose verification requires running containers |
| DEPLOY-03 | Old app directories removed | unit | Verify directories don't exist | N/A |
| DEPLOY-04 | Sales board remains functional | manual | `npm run salesboard:dev`, verify all features | N/A |

### Sampling Rate
- **Per task commit:** Visual verification of affected dashboard tab in browser (`npm run dashboard:dev`)
- **Per wave merge:** Test all role types (MANAGER, PAYROLL, OWNER_VIEW, CUSTOMER_SERVICE, SUPER_ADMIN) and sales board
- **Phase gate:** Full manual test of all 4 tabs, all sub-tabs, all KPI date range filtering, sales board, Docker build

### Wave 0 Gaps
- This phase is primarily UI migration with manual testing. No automated test files need creation for the dashboard frontend.
- The `dateRange()` utility addition (`last_week` case) could have a unit test added to `apps/ops-api` test suite.
- [ ] `apps/ops-api/__tests__/dateRange.test.ts` -- covers `last_week` range calculation

*(Existing test infrastructure covers ops-api backend. Frontend testing is manual-only for this project per established patterns.)*

## Sources

### Primary (HIGH confidence -- direct codebase inspection)
- `packages/ui/src/components/DateRangeFilter.tsx` -- existing presets, interface, 97 lines
- `packages/ui/src/index.tsx` -- PageShell component, NavItem interface, badge support
- `packages/auth/src/client.ts` -- `captureTokenFromUrl`, `authFetch`, `getToken`, `clearToken`, private `decodeTokenPayload`
- `packages/auth/src/index.ts` -- `verifySessionToken` returns `SessionUser` with typed roles
- `packages/types/src/index.ts` -- `AppRole` type (7 values), `SessionUser` type
- `packages/socket/src/useSocket.ts` -- connection lifecycle, mount/unmount cleanup, event subscription
- `apps/auth-portal/app/api/login/route.ts` -- login flow, SUPER_ADMIN expansion, redirect with session_token
- `apps/auth-portal/middleware.ts` -- positive matcher pattern for 3 routes
- `apps/auth-portal/lib/auth.ts` -- `ROLE_ACCESS` with lowercase role names (known mismatch), verify endpoint dependency
- `apps/ops-api/src/routes/index.ts` -- `dateRange()` utility (lines 34-82), KPI endpoint audit (tracker, owner, agent-kpis, chargebacks, pending-terms)
- `docker-compose.yml` -- 5 dashboard services + auth-portal, ALLOWED_ORIGINS default
- `.planning/research/SUMMARY.md` -- prior research findings
- `.planning/research/ARCHITECTURE.md` -- migration architecture details
- `.planning/research/PITFALLS.md` -- 14 pitfalls with phase assignments
- All 5 dashboard `package.json` files -- dependency union confirmed

### Secondary (HIGH confidence -- established framework patterns)
- Next.js App Router route groups -- well-established since Next.js 13
- Next.js middleware matcher syntax -- standard pattern
- React Context for cross-route state sharing -- standard React pattern

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all decisions based on direct codebase inspection, no new packages needed
- Architecture: HIGH -- route group pattern well-established; all component interfaces confirmed via source
- Pitfalls: HIGH -- all 10 pitfalls derived from direct code inspection of auth flow, CORS config, Socket.IO lifecycle, and style patterns
- KPI endpoint audit: HIGH -- every endpoint inspected directly in routes/index.ts with line numbers

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable -- no external dependency changes expected)
