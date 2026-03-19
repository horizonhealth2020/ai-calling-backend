# Technology Stack

**Project:** v1.3 Dashboard Consolidation & Uniform Date Ranges
**Researched:** 2026-03-19

## Executive Summary

This milestone requires **zero new npm dependencies**. The existing stack already contains every library needed for consolidation and date range filtering. The work is architectural (merging 5 Next.js apps into 1) and component-level (extending the existing `DateRangeFilter` with KPI-specific presets), not a technology adoption exercise.

The key decision is creating a new unified Next.js app (`apps/unified-dashboard`) that absorbs auth-portal, manager-dashboard, payroll-dashboard, owner-dashboard, and cs-dashboard -- while sales-board remains standalone.

## Recommended Stack (Changes Only)

### No New Dependencies Required

The unified app uses the exact same dependency set as the existing dashboards:

| Technology | Version | Already In Use | Role in v1.3 |
|------------|---------|----------------|---------------|
| Next.js | 15.3.9 | Yes (all apps) | Single unified app with App Router |
| React | 18.3.1 | Yes (all apps) | Component rendering |
| @ops/ui (PageShell) | internal | Yes | Sidebar nav with role-gated items |
| @ops/ui (DateRangeFilter) | internal | Yes (CSV exports) | Extended for KPI sections |
| @ops/ui (TabNav) | internal | Yes (CS dashboard) | Sub-tab navigation within sections |
| @ops/auth/client | internal | Yes | Token capture, authFetch, role decoding |
| @ops/socket | internal | Yes | Real-time updates (unchanged) |
| @ops/utils | internal | Yes | formatDollar, formatDate |
| @ops/types | internal | Yes | AppRole, SessionUser types |
| Luxon | 3.4.4 | Yes (root) | Date range calculation (week boundaries, 30-day) |
| lucide-react | 0.577.0 | Yes | Icons for nav items |
| socket.io-client | 4.8.3 | Yes | WebSocket connection |

### What NOT to Add

| Library | Why Tempting | Why Wrong |
|---------|-------------|-----------|
| next-auth / auth.js | "Proper" auth for Next.js | Auth already handled via @ops/auth with JWT + localStorage. Adding next-auth would require rewriting the entire auth flow for zero user-facing benefit. |
| react-router | Client-side routing for tabs | Next.js App Router already handles this. Use file-system routes for top-level sections, `useState` for sub-tabs. |
| react-datepicker / date-fns | Date picker component | `DateRangeFilter` already exists in @ops/ui with native HTML date inputs. It works, matches the design system, and needs only preset changes. |
| zustand / jotai | State management for shared date range | React Context is sufficient for a single date range value shared across KPI sections within one page. |
| tailwindcss | Faster styling | Violates project constraint. All styling is inline React.CSSProperties. |
| @tanstack/react-query | Data fetching with caching | Each dashboard page already manages its own fetch + state pattern with authFetch. Adding react-query for one milestone is churn. |
| next/navigation middleware | Auth guards | A layout-level `useEffect` with `getToken()` already works across all dashboards. Server-side middleware would require `edge` runtime and cookie-based auth -- a full rewrite of the auth strategy. |

## Architecture Decisions for Stack

### 1. New App: `apps/unified-dashboard`

**Why a new app instead of expanding auth-portal:**
- Auth-portal has a fundamentally different structure (login form + landing page, no PageShell sidebar)
- Starting fresh avoids breaking the existing apps during migration
- Can run both old and new in parallel during transition
- Clean `next.config.js` inheriting the same pattern as other dashboards

**Package.json -- superset of all dashboard dependencies:**
```json
{
  "name": "@ops/unified-dashboard",
  "dependencies": {
    "@ops/auth": "*",
    "@ops/socket": "*",
    "@ops/ui": "*",
    "@ops/utils": "*",
    "lucide-react": "^0.577.0",
    "next": "15.3.9",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "socket.io-client": "^4.8.3"
  }
}
```

### 2. Role-Gated Navigation via PageShell

The existing `PageShell` component already supports:
- `navItems: NavItem[]` -- sidebar navigation items with icon, label, key, badge
- `activeNav: string` -- which item is selected
- `onNavChange: (key: string) => void` -- callback for tab switching
- Desktop sidebar (240px fixed) + mobile bottom nav (< 1024px breakpoint)

**No new component needed.** The unified app's dashboard layout reads the user's roles from the JWT (via `@ops/auth/client` `getToken()` + manual base64 decode, already patterned in `ensureTokenFresh`) and filters `navItems` to only show role-permitted sections.

**Role-to-tab mapping:**

| Role | Visible Tabs |
|------|-------------|
| SUPER_ADMIN | Manager, Payroll, Owner, CS (all) |
| MANAGER | Manager |
| PAYROLL | Payroll |
| OWNER_VIEW | Owner |
| CUSTOMER_SERVICE | CS |

### 3. Date Range Picker Enhancement

The existing `DateRangeFilter` uses presets: `7d`, `30d`, `month`, `custom`.

**v1.3 requires:** `Current Week`, `Last Week`, `30 Days`, `Custom`.

This is a preset change + Luxon-powered date calculation. The `DateRangeFilterValue` interface (`{ preset: string; from?: string; to?: string }`) already supports this -- just change the preset keys.

**Approach:** Add a new variant or prop to `DateRangeFilter` for KPI presets rather than modifying the existing CSV export presets. Both use cases coexist:

```typescript
// New KPI presets (add alongside existing export presets)
const KPI_PRESETS = [
  { key: "current-week", label: "Current Week" },
  { key: "last-week", label: "Last Week" },
  { key: "30d", label: "30 Days" },
  { key: "custom", label: "Custom" },
];
```

**Date calculation uses Luxon (already in root package.json):**
- Current Week: `DateTime.now().setZone('America/New_York').startOf('week')` to `.endOf('week')` -- Sun-Sat, matching existing payroll week logic
- Last Week: Same, minus 7 days
- 30 Days: `DateTime.now().minus({ days: 30 })` to now
- Custom: User-selected `from`/`to` dates

**API integration:** The `dateRange()` helper in `ops-api/src/routes/index.ts` already accepts query params. Each KPI fetch just passes `from` and `to` ISO strings. No API changes needed if the existing `dateRange()` helper already supports custom dates (added in v1.2).

### 4. Login Flow Change

**Current flow:** Login (auth-portal:3011) -> Landing page -> Opens dashboard in new browser tab (different port/app)

**New flow:** Login page (unified-dashboard:3020) -> JWT decoded -> Client-side redirect to `/dashboard` -> App reads roles from token, renders default tab

The unified app absorbs the login page directly. The auth-portal landing page with its multi-dashboard card grid is no longer needed -- the role-gated sidebar replaces it entirely.

**Token handling stays identical:** `captureTokenFromUrl()` on mount, `localStorage` storage, `authFetch()` for API calls.

### 5. Next.js App Router Structure

```
apps/unified-dashboard/
  app/
    layout.tsx              -- ThemeProvider, global inline styles, font
    page.tsx                -- Login page (absorbed from auth-portal)
    api/
      login/route.ts        -- Proxy to ops-api (from auth-portal)
      verify/route.ts       -- Token verification
      change-password/route.ts
    dashboard/
      layout.tsx            -- Auth guard + PageShell with role-gated nav
      page.tsx              -- Redirect to default tab based on role
      manager/page.tsx      -- Manager dashboard content (from manager-dashboard/app/page.tsx)
      payroll/page.tsx      -- Payroll dashboard content
      owner/page.tsx        -- Owner dashboard content
      cs/page.tsx           -- CS dashboard content
    access-denied/page.tsx  -- Unauthorized access page
  next.config.js            -- Same transpilePackages pattern
```

**Why file-system routing for top-level sections (not useState):**
- Browser back/forward navigation between sections
- Direct URL sharing (`/dashboard/payroll`)
- Code splitting per section (each page.tsx is a separate chunk)
- Auth guard in `dashboard/layout.tsx` protects all sections uniformly
- Role checking can happen at the layout level before rendering any section

**Within each section**, existing sub-tab navigation (e.g., manager's entry/tracker/sales/audits/config tabs) remains as `useState`-driven, exactly as today. No change to the inner page logic.

### 6. Auth Guard Pattern

The `dashboard/layout.tsx` will:
1. Call `captureTokenFromUrl()` on mount
2. Decode the JWT to extract roles
3. If no token, redirect to `/` (login)
4. If token but no roles for current route, redirect to `/access-denied`
5. Pass roles via React Context to child pages for conditional rendering

This matches how each dashboard currently guards itself, just centralized in one layout.

## Existing Components Reused Without Changes

| Component | Source | Reuse |
|-----------|--------|-------|
| `PageShell` | @ops/ui | Wraps entire dashboard with sidebar nav |
| `TabNav` | @ops/ui | Sub-tabs within each section (e.g., CS submissions/tracking) |
| `DateRangeFilter` | @ops/ui | Extended with KPI presets via new `presets` prop |
| `Card`, `Button`, `Input`, `Select` | @ops/ui | All form elements |
| `AnimatedNumber`, `Badge`, `StatCard` | @ops/ui | KPI display |
| `ToastProvider` | @ops/ui | Notifications |
| `SkeletonCard` | @ops/ui | Loading states |
| `EmptyState` | @ops/ui | No-data states |
| `authFetch`, `captureTokenFromUrl`, `getToken`, `clearToken` | @ops/auth/client | Auth flow |
| `useSocket` | @ops/socket | Real-time updates |
| `formatDollar`, `formatDate` | @ops/utils | Display formatting |

## Components Needing Modification

| Component | Change | Scope |
|-----------|--------|-------|
| `DateRangeFilter` | Add `presets` prop to allow custom preset arrays (currently hardcoded). Default to existing `7d/30d/month/custom` for backward compatibility. | @ops/ui -- minor, backward-compatible |
| `PageShell` | No changes needed. NavItem array is already dynamic. | None |
| `@ops/types` | No changes needed. `AppRole` and `SessionUser` already cover all roles. | None |

## Port Assignment

| App | Port | Status |
|-----|------|--------|
| unified-dashboard | 3020 | NEW -- replaces auth(3011) + manager(3019) + payroll(3012) + owner(3026) + cs(3014) |
| sales-board | 3013 | UNCHANGED -- remains standalone |
| ops-api | 8080 | UNCHANGED |

The old dashboard apps remain in the repo but are no longer deployed after v1.3 is validated.

## Deployment Impact

### Railway
- **Reduction:** 6 services (5 dashboards + auth-portal) down to 2 (unified-dashboard + sales-board) + 1 API
- Same build/start pattern: `next build && next start`
- `NEXT_PUBLIC_OPS_API_URL` still baked at build time
- `ALLOWED_ORIGINS` in ops-api needs the unified dashboard URL; old dashboard URLs can be removed post-migration

### Docker
- Same `Dockerfile.nextjs` with `APP_NAME=unified-dashboard`
- Removes 4-5 service definitions from `docker-compose.yml`
- Significant resource reduction (4 fewer Node.js processes)

### CORS
- ops-api `ALLOWED_ORIGINS` needs new unified dashboard origin added
- Old origins can be kept during parallel-running transition, then removed

## Installation

```bash
# No new packages to install -- all deps already in workspace
# Just create the app directory and package.json, then:
npm install  # Workspace linking picks up the new app automatically
```

Add to root `package.json` scripts:
```json
{
  "dashboard:dev": "npm --prefix apps/unified-dashboard run dev"
}
```

## Confidence Assessment

| Decision | Confidence | Rationale |
|----------|------------|-----------|
| No new dependencies | HIGH | Inspected all existing packages, component code, and feature requirements |
| PageShell for nav | HIGH | Already supports navItems, activeNav, onNavChange -- inspected source |
| DateRangeFilter extension | HIGH | Component exists with flexible interface, only presets change |
| App Router file routing for sections | HIGH | Standard Next.js 15 pattern, each dashboard is a single page.tsx today |
| Luxon for date calc | HIGH | Already used for payroll week boundaries (America/New_York, Sun-Sat) |
| Port 3020 | MEDIUM | Arbitrary -- any unused port works, avoids conflicts with existing 3011-3026 range |
| No next-auth | HIGH | Existing JWT + localStorage pattern is simple and working; migration cost far exceeds benefit |

## Sources

- Inspected: `packages/ui/src/index.tsx` -- PageShell with NavItem interface, sidebar/bottom nav patterns
- Inspected: `packages/ui/src/components/DateRangeFilter.tsx` -- existing presets (`7d`, `30d`, `month`, `custom`) and `DateRangeFilterValue` interface
- Inspected: `packages/ui/src/components/TabNav.tsx` -- sub-tab component with indicator animation
- Inspected: `packages/auth/src/client.ts` -- token management, JWT decode, authFetch with auto-refresh
- Inspected: `packages/types/src/index.ts` -- AppRole enum (7 roles), SessionUser type
- Inspected: `apps/auth-portal/app/api/login/route.ts` -- login flow, SUPER_ADMIN role expansion, redirect with session_token
- Inspected: `apps/auth-portal/app/landing/page.tsx` -- role-based dashboard routing via DASHBOARD_MAP, token passing
- Inspected: `apps/manager-dashboard/next.config.js` -- transpilePackages pattern, conditional standalone output
- Inspected: `apps/manager-dashboard/app/page.tsx` -- Tab type, existing imports showing full dependency surface
- Inspected: `apps/ops-api/src/middleware/auth.ts` -- requireAuth + requireRole with SUPER_ADMIN bypass
- Inspected: All dashboard `package.json` files -- confirmed identical dependency patterns

---
*Research completed: 2026-03-19*
