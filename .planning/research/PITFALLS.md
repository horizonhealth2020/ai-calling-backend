# Domain Pitfalls

**Domain:** Dashboard Consolidation & Uniform Date Ranges (v1.3) — Merging 5 Next.js apps into 1 unified app with role-gated tabs and adding uniform date range filtering to all KPI sections
**Researched:** 2026-03-19
**Applies to:** Major architectural change to an existing 6-dashboard + Express API + PostgreSQL/Prisma platform

## Critical Pitfalls

### P1: Monster Page File — All Dashboards Merged Into One Component Tree

**What goes wrong:** The 4 dashboard page files total ~10,000 lines of TSX (manager: 2702, payroll: 3030, CS: 2377, owner: 1957). Plus auth-portal at 502 lines. The temptation is to create a single `page.tsx` with a tab state variable that conditionally renders the right dashboard content. This produces a 10,000+ line file that is impossible to maintain, slow to compile, and loads all code for all roles on initial page load regardless of which tab is active.

**Why it happens:** Each existing dashboard is a single `page.tsx` with inline types, style constants, helper functions, and the main component. Copy-pasting these into tabs within one file is the path of least resistance.

**Consequences:**
- Next.js dev server becomes noticeably slow (HMR recompiles the entire mega-file on any change)
- Browser downloads JavaScript for all 4 dashboards even when user only has access to one tab
- Initial load time degrades significantly — the current per-app bundle only contains that dashboard's code
- Style constant names will collide (every dashboard has `const CARD`, `const BTN`, `const HEADER`, etc.)
- Type name collisions across dashboards (`Tab`, `Entry`, `Product` are defined differently in each)

**Prevention:**
- Each dashboard becomes its own directory under `app/` with lazy-loaded components: `app/(dashboard)/manager/page.tsx`, `app/(dashboard)/payroll/page.tsx`, etc.
- Use Next.js route groups `(dashboard)` with a shared layout that provides the tab navigation shell
- Each page keeps its own types, styles, and state — no merging of component internals
- The tab navigation is in the shared layout; the tab content is in separate route segments
- This means the URL changes with the tab (`/manager`, `/payroll`, `/owner`, `/cs`) which is actually better for bookmarking and refresh behavior
- Use `next/dynamic` with `ssr: false` if any dashboard component is particularly heavy

**Detection:** After consolidation, check the compiled JS bundle sizes per route. If `/manager` downloads payroll code, the splitting failed.

**Phase:** This is THE foundational decision. Must be settled before any code is written. Getting this wrong means rewriting the entire consolidation.

---

### P2: Auth Flow Rewrite — URL Token Passing Breaks When Apps Merge

**What goes wrong:** The current auth flow works like this:
1. User logs in at auth-portal (`localhost:3011`)
2. Auth-portal's `/api/login` route calls ops-api, gets a JWT
3. Auth-portal redirects to landing page with `?session_token=TOKEN&roles=ROLE1,ROLE2`
4. Landing page calls `captureTokenFromUrl()` which stores token in localStorage
5. Landing page shows dashboard cards, each links to a different origin with `?session_token=TOKEN`
6. Each dashboard calls `captureTokenFromUrl()` on load to grab the token from URL

When all dashboards merge into one app, step 5-6 becomes unnecessary (no cross-origin redirect needed). But the login flow still needs to work. The auth-portal's `/api/login` and `/api/verify` route handlers are Next.js API routes that proxy to ops-api. If these are naively merged, the login page and the dashboard share the same Next.js app, but the middleware (`middleware.ts`) that protects dashboard routes must NOT protect the login page.

**Why it happens:** The auth-portal was designed as a separate app specifically because it needed different middleware rules than the dashboards. Merging it in requires rethinking which routes are public vs protected.

**Consequences:**
- If middleware protects `/`, users can't reach the login page (infinite redirect loop)
- If middleware is removed entirely, all dashboard routes are unprotected
- The `DASHBOARD_MAP` in landing page references external URLs (`MANAGER_DASHBOARD_URL`, `PAYROLL_DASHBOARD_URL`) that no longer exist
- The `AUTH_PORTAL_URL` env var that other dashboards used for token verification becomes self-referential
- `captureTokenFromUrl()` still works but the cross-origin token passing via URL params is no longer needed (and is a security concern — tokens in URLs get logged)

**Prevention:**
- The unified app login is at `/login` (public route)
- Login success stores token in localStorage via `captureTokenFromUrl()` and redirects to the user's default tab route (e.g., `/manager`)
- Next.js middleware matcher protects `/manager/:path*`, `/payroll/:path*`, `/owner/:path*`, `/cs/:path*` but NOT `/login`, `/api/login`, `/api/verify`, `/api/change-password`
- Remove all external dashboard URL env vars (`MANAGER_DASHBOARD_URL`, etc.) — tabs are internal routes now
- Remove the landing page entirely — login redirects directly to the appropriate tab based on role
- Keep `captureTokenFromUrl()` for backward compatibility but the primary flow is: login -> store token -> redirect to route

**Detection:** Log in as each role type and verify you land on the correct tab. Try accessing `/manager` without a token and verify redirect to `/login`. Try accessing `/login` with a valid token and verify no redirect loop.

**Phase:** Must be designed and implemented as the very first step. Every other feature depends on auth working correctly in the unified app.

---

### P3: CORS and Socket.IO Origin Whitelist — Stale Origins Cause Silent Failures

**What goes wrong:** The ops-api CORS whitelist currently contains 5 origins:
```
http://localhost:3011,http://localhost:3012,http://localhost:3013,http://localhost:3019,http://localhost:3026
```
The Socket.IO server uses the same whitelist. After consolidation, the unified app runs on a single port (e.g., 3000 or 3011). The old origins for individual dashboards no longer exist. If the CORS whitelist is not updated, the unified app's requests to ops-api are rejected with CORS errors. Socket.IO connections fail silently (the `useSocket` hook shows the disconnect banner after 10 seconds but doesn't explain why).

**Why it happens:** CORS configuration is in ops-api's `index.ts` as an env var default, in `docker-compose.yml` as a service environment variable, and potentially in Railway service variables. All three must be updated.

**Consequences:**
- All API calls from the unified app fail with CORS errors in the browser console
- Socket.IO real-time updates stop working across all dashboards
- The disconnect banner shows permanently but gives no useful diagnostic
- If only the dev default is updated but not Docker/Railway, it works locally but breaks in production

**Prevention:**
- Update the `ALLOWED_ORIGINS` default in `apps/ops-api/src/index.ts` to include the unified app's origin
- Update `docker-compose.yml` `ALLOWED_ORIGINS` to remove old dashboard origins and add the unified app origin
- Keep the sales-board origin (`localhost:3013`) since it remains standalone
- The unified app needs exactly ONE origin in the whitelist (plus sales-board)
- Add a startup log line in ops-api that prints the allowed origins so misconfiguration is immediately visible
- Consider: if the unified app proxies API calls through Next.js API routes (server-to-server), CORS doesn't apply — but the current architecture uses direct browser-to-API calls via `authFetch()`

**Detection:** Open browser DevTools Network tab after deploying the unified app. Any red CORS error is immediately visible.

**Phase:** Must be done simultaneously with deployment configuration. Cannot be deferred.

---

### P4: Style Constant Name Collisions When Merging Dashboard Code

**What goes wrong:** Every dashboard defines local style constants with generic names. For example:
- Manager dashboard: `const CARD`, `const BTN`, `const HEADER`, `const FIELD`, `const INPUT_WRAP`
- Payroll dashboard: `const CARD`, `const BTN`, `const HEADER` (different values)
- CS dashboard: `const CARD`, `const BTN` (different values again)
- Owner dashboard: `const CARD` (different values)

If components from different dashboards are ever imported into the same scope (e.g., a shared layout component), these constants shadow each other. Even if they are in separate files, IDE auto-import can grab the wrong one.

**Why it happens:** The inline CSSProperties pattern uses short, generic names because each file was historically isolated. There was never a naming conflict because each app was its own Next.js process.

**Consequences:**
- Subtle visual bugs: wrong padding, wrong colors, wrong border radius on components that "look almost right"
- Extremely hard to debug because the style values are close but not identical across dashboards
- If a shared component (like the tab navigation shell) imports a `CARD` constant, it gets whichever file's `CARD` the bundler resolves

**Prevention:**
- Since each dashboard becomes its own route/page file under separate directories, the local constants stay local — this is inherently handled by the route-segment-per-dashboard approach from P1
- For the shared layout/navigation shell, prefix shared style constants clearly: `const NAV_TAB`, `const NAV_SHELL`, `const NAV_INDICATOR`
- Do NOT create a "merged styles" file that combines all dashboard styles — keep them scoped to their files
- If extracting shared styles, put them in `@ops/ui` with explicit, non-colliding names

**Detection:** After consolidation, visually compare each dashboard tab against the current standalone version. Any spacing, color, or layout difference indicates a style collision.

**Phase:** Addressed implicitly by the file structure decision in P1. But must be explicitly verified during UI testing.

---

### P5: Deployment Topology Change — Docker and Railway Both Need Reconfiguration

**What goes wrong:** Currently there are 6 Docker services (5 frontends + API) and correspondingly 6 Railway services. After consolidation, there should be 3 services: unified-dashboard, sales-board, ops-api. If the old services are not removed and the new unified service is not added, Docker Compose builds stale containers and Railway runs (and bills for) phantom services.

**Why it happens:** Deployment configuration is easy to forget because it's not tested during local development (where `npm run dev` just starts one app).

**Consequences:**
- Docker: old containers start on old ports, consuming resources but serving nothing (or worse, serving stale code that conflicts with the unified app)
- Railway: 5 frontend services billed at $5/month each when only 2 are needed, plus the old services may still be accessible at their old URLs
- The `Dockerfile.nextjs` with `APP_NAME` build arg needs to reference the new unified app name
- The auth-portal Docker service passes `MANAGER_DASHBOARD_URL`, `PAYROLL_DASHBOARD_URL`, etc. as environment variables — these no longer exist in the unified app

**Prevention:**
- Update `docker-compose.yml` in the same PR as the consolidation:
  - Remove `auth-portal`, `manager-dashboard`, `payroll-dashboard`, `owner-dashboard`, `cs-dashboard` services
  - Add `unified-dashboard` service with `APP_NAME: unified-dashboard` (or whatever the new app directory is named)
  - Keep `sales-board` and `ops-api` unchanged
- Update Railway configuration (document in PR description):
  - Remove old frontend services
  - Create new unified dashboard service
  - Update `ALLOWED_ORIGINS` on the ops-api service
- Update the `Dockerfile.nextjs` if the new app name doesn't match the expected `apps/${APP_NAME}` path pattern
- Remove dashboard URL env vars from all configurations

**Detection:** Run `docker-compose up` after consolidation and verify exactly 3 services start (postgres + ops-api + unified-dashboard + sales-board = 4 containers). Check Railway dashboard for orphaned services.

**Phase:** Must be part of the consolidation PR. Not a follow-up task.

## Moderate Pitfalls

### P6: Role-Gated Tab Visibility Mismatch Between Client and Server

**What goes wrong:** The tab navigation must show/hide tabs based on the user's roles. The user's roles come from the JWT token (decoded client-side or via middleware). If the client-side role check uses different logic than the server-side `requireRole()` middleware, a user might see a tab they can't actually use (API calls return 403) or not see a tab they should have access to.

**Why it happens:** The current `ROLE_ACCESS` map in `auth-portal/lib/auth.ts` uses lowercase role names (`"owner"`, `"super_admin"`) while the `@ops/types` `AppRole` enum uses uppercase (`"SUPER_ADMIN"`, `"OWNER_VIEW"`, `"MANAGER"`). The auth-portal middleware was a separate implementation that doesn't use the shared types.

**Consequences:**
- User sees a tab, clicks it, and every API call returns 403 — broken experience
- SUPER_ADMIN bypasses all server-side role checks but the client-side tab filter might not show all tabs if the mapping is wrong
- Roles like `CUSTOMER_SERVICE` vs `CS` vs `CUSTOMER_SERVICE` — any inconsistency means a role falls through the cracks

**Prevention:**
- Define the tab-to-role mapping once in a shared constant (e.g., in `@ops/types` or a new `@ops/auth/roles.ts`):
  ```typescript
  export const TAB_ROLES = {
    manager: ["MANAGER", "SUPER_ADMIN"],
    payroll: ["PAYROLL", "SUPER_ADMIN"],
    owner: ["OWNER_VIEW", "SUPER_ADMIN"],
    cs: ["CUSTOMER_SERVICE", "SUPER_ADMIN"],
  } as const;
  ```
- Both the tab navigation component and the Next.js middleware use this same constant
- SUPER_ADMIN always sees all tabs (already the pattern on the server side)
- Decode the JWT client-side to get roles — the `@ops/auth/client` package already stores the token, just needs a `getRoles()` helper that decodes it

**Detection:** Log in as each role type (MANAGER, PAYROLL, OWNER_VIEW, CUSTOMER_SERVICE, SUPER_ADMIN) and verify the correct tabs appear and all API calls within each tab succeed.

**Phase:** Must be implemented alongside the tab navigation component. Test with every role.

---

### P7: Multiple Socket.IO Connections — One Per Dashboard Instead of One Per App

**What goes wrong:** Each current dashboard page calls `useSocket(API, onSaleChanged)` which creates a new Socket.IO connection on mount. In the unified app, if the user navigates between tabs (route segments), each tab mount creates a new connection and each tab unmount disconnects. This means:
- Switching from Manager to Payroll tab: disconnect + reconnect (visible disconnect banner flashes)
- If tabs are rendered simultaneously (unlikely but possible with prefetching): multiple connections from one browser

**Why it happens:** The `useSocket` hook creates the connection in a `useEffect` with `[apiUrl]` as the dependency. Each page component that uses it gets its own connection lifecycle tied to mount/unmount.

**Consequences:**
- Brief disconnect banner flash on every tab switch (10-second timer in `useSocket` before showing, but if switch takes >10s on slow network, it shows)
- Server sees rapid connect/disconnect churn in logs
- If a sale event fires during the ~100ms between disconnect and reconnect, the dashboard misses it
- The `onReconnect` callback triggers a full data refresh — so every tab switch causes an unnecessary full refresh

**Prevention:**
- Lift the Socket.IO connection to the shared layout component, not the individual tab pages
- Create a `SocketProvider` context that wraps all tabs and maintains a single persistent connection
- Individual tabs subscribe to specific events via context (e.g., `useSocketEvent("sale:changed", handler)`) without owning the connection lifecycle
- The connection persists across tab switches — only created once on app mount, destroyed on app unmount (page close/navigate away)
- This is a small refactor of `@ops/socket` to add a provider pattern alongside the existing hook

**Detection:** Switch between tabs rapidly while watching the server logs. If you see connect/disconnect pairs, the connection is not shared.

**Phase:** Should be done during the unified layout creation phase, before individual dashboards are wired in.

---

### P8: Date Range Filter State Not Preserved Across Tab Switches

**What goes wrong:** The user sets a custom date range (e.g., "Last 30 days") on the Manager tab, switches to Payroll tab, and the date range resets to default. They then switch back to Manager and the date range resets again. Each tab manages its own `DateRangeFilterValue` state, and React unmounts the component on tab switch, losing the state.

**Why it happens:** If tabs are implemented as separate Next.js route segments (which they should be per P1), navigating between routes unmounts the previous page component and mounts the new one. Local `useState` is lost on unmount.

**Consequences:**
- User frustration: they set a date range, switch tabs to compare data, and have to re-set it
- The "uniform" date range requirement implies the same date range should apply across all tabs, but without shared state, each tab is independent
- If date ranges are independent per tab (acceptable alternative), users still lose their selection when switching away and back

**Prevention:**
- Decision required: should the date range be **global** (same across all tabs) or **per-tab** (independent but preserved)?
  - **Global** (recommended for "uniform" requirement): Store date range in a React context provider in the shared layout. All tabs read from the same context. Changing the date range on any tab changes it for all tabs.
  - **Per-tab**: Store date range in URL search params (`?range=30d&from=2026-03-01&to=2026-03-19`). URL params survive navigation because they're part of the route. Each tab has its own params.
- Either way, do NOT rely on `useState` alone — it will be lost on tab switch
- The global approach is simpler and matches the "uniform" language in the requirements
- If global: the `DateRangeFilter` component should be in the shared layout (above the tabs), not in each tab's content

**Detection:** Set a custom date range, switch tabs, switch back. If the range reset, state preservation failed.

**Phase:** Must be decided during the uniform date range picker implementation. Affects where the component lives in the component tree.

---

### P9: Next.js Middleware Matcher Conflict With API Routes

**What goes wrong:** The auth-portal currently has a Next.js middleware that intercepts requests and verifies tokens. The matcher is:
```typescript
export const config = {
  matcher: ["/owner/:path*", "/payroll/:path*", "/manager/:path*"],
};
```
In the unified app, the login API routes (`/api/login`, `/api/verify`, `/api/change-password`) must be accessible without authentication. If the middleware matcher is too broad (e.g., `/((?!api|_next|login).*)`) it can accidentally intercept API routes or static assets, causing login to break.

**Why it happens:** Middleware matchers in Next.js are regex-based and it's easy to accidentally match too much or too little. The existing auth-portal middleware was simple because it only had 3 protected path prefixes.

**Consequences:**
- Login page loads but `/api/login` POST returns 401 (middleware intercepts it and finds no token)
- Static assets (fonts, images) blocked by middleware, causing visual breakage
- `_next/` prefetch requests blocked, breaking client-side navigation

**Prevention:**
- Use an explicit positive matcher that lists only the protected route prefixes:
  ```typescript
  export const config = {
    matcher: ["/manager/:path*", "/payroll/:path*", "/owner/:path*", "/cs/:path*"],
  };
  ```
- Do NOT use a negative matcher (exclude everything except...) — it's fragile and hard to reason about
- The `/login`, `/api/*`, `/_next/*`, and `/` (root) routes are implicitly unprotected because they're not in the matcher
- Test the middleware by accessing every route type: login page, API routes, dashboard routes (with and without token), static assets

**Detection:** After implementing middleware, open browser DevTools and check for any unexpected 401/307 responses on page load.

**Phase:** Part of the auth flow rewrite (P2). Test immediately after implementing.

---

### P10: Sales Board Isolation — Accidentally Breaking the Standalone App

**What goes wrong:** The sales board remains standalone (per requirements), but it shares `@ops/ui`, `@ops/auth`, `@ops/socket`, and `@ops/utils` packages with the dashboards being consolidated. If the consolidation modifies shared packages (e.g., adding a `SocketProvider` for P7, or changing `captureTokenFromUrl` behavior), the sales board breaks even though it's not being touched.

**Why it happens:** Shared packages serve both the unified app and the standalone sales board. Changes to shared code have cross-cutting impact.

**Consequences:**
- Sales board stops connecting to Socket.IO (if the `useSocket` hook API changes)
- Sales board auth breaks (if `captureTokenFromUrl` changes)
- Sales board build fails (if new dependencies are added to shared packages that aren't in sales-board's `transpilePackages`)

**Prevention:**
- Any changes to `@ops/socket`, `@ops/auth/client`, `@ops/ui`, or `@ops/utils` must be backward-compatible
- If adding a `SocketProvider` pattern, keep the existing `useSocket` hook working as-is — the provider is additive, not a replacement
- After consolidation changes, explicitly test the sales board: `npm run salesboard:dev` and verify it loads, displays data, and receives real-time updates
- Add sales-board verification to the testing checklist for every PR in the consolidation work

**Detection:** Run the sales board after every shared package change.

**Phase:** Ongoing throughout all consolidation phases. Add to PR checklist.

## Minor Pitfalls

### P11: Duplicate `transpilePackages` and Config Consolidation

**What goes wrong:** Each current app has its own `next.config.js` with slightly different `transpilePackages` arrays. Auth-portal transpiles `["@ops/ui", "@ops/auth"]`. Manager transpiles `["@ops/ui", "@ops/auth", "@ops/socket", "@ops/utils"]`. The unified app needs the union of all packages: `["@ops/ui", "@ops/auth", "@ops/socket", "@ops/utils"]`. If any package is missing from `transpilePackages`, builds fail with cryptic "Cannot use import statement outside a module" errors.

**Prevention:**
- The unified app's `next.config.js` must include ALL shared packages: `@ops/ui`, `@ops/auth`, `@ops/socket`, `@ops/utils`
- Copy the most complete config (manager or payroll dashboard) as the starting point
- Keep the conditional `output: "standalone"` pattern for Docker compatibility

**Phase:** First step of creating the unified app. Quick to get right, annoying to debug if missed.

---

### P12: Package.json Workspace Configuration for New App

**What goes wrong:** The monorepo uses npm workspaces. Each app has its own `package.json` with `workspace:*` dependencies. The new unified app needs a `package.json` that includes all dependencies from all 5 merged apps. Missing a dependency causes runtime errors that only appear when navigating to a specific tab (e.g., the CS tab uses `lucide-react` icons that the other tabs don't).

**Prevention:**
- Merge all `dependencies` from auth-portal, manager, payroll, owner, and CS dashboard `package.json` files
- Run `npm install` from monorepo root after creating the new app
- Test all tabs, not just the first one that loads

**Phase:** Part of initial app scaffolding.

---

### P13: Loss of Independent Deployability and Rollback Granularity

**What goes wrong:** Currently, if the payroll dashboard has a bug, only the payroll service needs to be redeployed/rolled back. After consolidation, any bug in any dashboard requires redeploying the entire unified app, which affects all users across all roles.

**Prevention:**
- Accept this tradeoff explicitly — it's inherent to consolidation
- Ensure comprehensive testing of all tabs before deploying
- Consider feature flags for new date range functionality so it can be disabled per-tab if issues arise
- Keep the ability to quickly revert to the previous multi-app architecture by not deleting the old app directories until the unified app is stable in production (tag the last multi-app commit)

**Phase:** Deployment planning. No code change needed, just awareness and process.

---

### P14: Metadata and Title Per Tab

**What goes wrong:** Each current app has its own `<title>` via Next.js `metadata` export (e.g., "Manager Dashboard", "Payroll Dashboard"). In the unified app with route segments, each route can export its own metadata. But if this is missed, all tabs show "Unified Dashboard" or whatever the root layout sets, making it hard for users to identify which tab they're on from their browser tab bar.

**Prevention:**
- Each route segment (`/manager/page.tsx`, `/payroll/page.tsx`, etc.) must export its own `metadata`:
  ```typescript
  export const metadata: Metadata = { title: "Manager Dashboard" };
  ```
- This is a Next.js App Router feature that works automatically with route segments

**Phase:** During tab/route creation. Easy to overlook, quick to fix.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| App scaffolding & file structure | P1 (monster file), P11 (transpilePackages), P12 (dependencies) | Route-segment-per-dashboard, union of all transpile packages, merge all deps |
| Auth flow rewrite | P2 (token passing breaks), P9 (middleware matcher) | Positive matcher for protected routes, remove external URL env vars, test every role |
| Deployment config | P3 (CORS origins), P5 (Docker/Railway topology) | Update all 3 config locations, remove old services, single unified origin |
| Tab navigation & layout | P4 (style collisions), P6 (role mismatch), P7 (socket connections), P14 (metadata) | Scoped styles per route, shared role constant, SocketProvider context, per-route metadata |
| Uniform date range | P8 (state lost on tab switch) | Global context in shared layout OR URL search params |
| Throughout consolidation | P10 (sales board regression), P13 (rollback granularity) | Test sales-board after every shared package change, tag pre-consolidation commit |

## Sources

- Direct codebase analysis of all 6 app directories, shared packages, Docker/Railway configuration
- Auth flow traced through: `auth-portal/app/api/login/route.ts` -> `auth-portal/app/landing/page.tsx` -> `@ops/auth/client.ts` `captureTokenFromUrl()`
- CORS configuration in `apps/ops-api/src/index.ts` line 23 and `docker-compose.yml` line 34
- Socket.IO connection lifecycle in `packages/socket/src/useSocket.ts`
- Style constant patterns observed across all dashboard `page.tsx` files
- Next.js App Router middleware documentation (HIGH confidence — well-established pattern)
- Existing middleware in `apps/auth-portal/middleware.ts` with route matcher pattern

---
*Research completed: 2026-03-19*
