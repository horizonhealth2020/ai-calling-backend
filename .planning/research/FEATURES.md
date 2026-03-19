# Feature Landscape

**Domain:** Dashboard consolidation (multi-app to single app) with uniform date range filtering
**Researched:** 2026-03-19
**Context:** Existing 5 dashboard apps + 1 standalone sales board, all Next.js 15, merging into single unified app

## Table Stakes

Features users expect from a consolidated dashboard. Missing = feels broken or confusing.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Role-gated tab navigation | Users currently see only their dashboard; consolidation must preserve this isolation | Medium | @ops/types AppRole, existing PageShell navItems pattern | Each role maps to a tab. SUPER_ADMIN sees all tabs. CS role sees CS tab only. Tab visibility is the new access control boundary. |
| Login lands on correct default tab | Current auth-portal redirects to the right app URL; unified app must replicate this with tab selection | Low | Auth login route, role-to-tab mapping | Replace URL redirect with in-app tab routing. Role priority order: SUPER_ADMIN > MANAGER > PAYROLL > OWNER_VIEW > CUSTOMER_SERVICE |
| Preserved feature parity per tab | Every feature in every current dashboard must work identically in its tab | High | All existing page.tsx files (~11k LOC across 4 dashboards) | This is the bulk of the work. Each dashboard page becomes a tab component. No features can regress. |
| Shared auth state across tabs | Token capture and authFetch must work once for the entire app, not per-tab | Low | @ops/auth/client captureTokenFromUrl, existing pattern | Already solved -- single app means single token capture in root layout. Simpler than current cross-domain token passing. |
| URL-based tab routing | Users expect browser back/forward to work with tabs, and direct links to specific tabs | Medium | Next.js App Router | Use path segments (e.g., /manager, /payroll, /owner, /cs) or searchParams. Path segments are better for bookmarkability. |
| Date range picker on all KPI sections | PROJECT.md explicitly requires uniform date range filtering across all KPI counters | Medium | Existing DateRangeFilter component in @ops/ui, existing dateRange() server utility | Component exists but is only used for CSV exports currently. Need to wire it to KPI data fetches. |
| Current Week preset in date picker | PROJECT.md specifies "Current Week / Last Week / 30 Days / Custom" -- existing component has "Last 7 days / Last 30 days / This month / Custom" | Low | DateRangeFilter component update | Presets need updating: add "Current Week" (Sun-Sat) and "Last Week", keep "30 Days" and "Custom". Drop "This month" and "Last 7 days". |
| Date range persists across tab switches | Picking a date range on one tab should carry to other tabs | Low | Shared React state in parent, or URL searchParams | Lift dateRange state to app-level. All tabs receive same range. Natural UX for "show me everything from last week". |
| Sales board remains standalone | PROJECT.md explicitly states sales board is unchanged | None | No work needed | Do NOT consolidate sales-board app. It has no auth requirement. |

## Differentiators

Features that improve the experience beyond what separate apps provided. Not strictly required but high value for effort.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| Cross-tab KPI summary header | A top-level KPI bar showing aggregated numbers across all user-visible dashboards | Medium | API endpoints for summary stats | Currently each dashboard loads its own KPIs independently. A unified header showing "Total Sales / Total Payroll / Open Chargebacks" gives instant cross-functional context. |
| Tab badges with live counts | Show notification badges on tabs (e.g., "3" on Payroll for pending approvals, "5" on CS for unresolved chargebacks) | Low | Existing Socket.IO events, PageShell already supports badge prop on NavItem | PageShell NavItem type already has `badge?: number`. Wire Socket.IO events to tab badge counts. Low effort, high polish. |
| Keyboard shortcuts for tab switching | Ctrl+1/2/3/4 to jump between tabs | Low | Client-side keydown listener | Power users managing multiple areas will appreciate fast switching. 20 lines of code. |
| Deep link support with date range in URL | URLs like /payroll?range=week preserve both tab and date context for sharing | Low | Already using searchParams pattern | Enables "here's what I'm looking at" sharing between team members. |
| Unified loading skeleton | Single skeleton pattern while any tab's data loads, rather than per-dashboard loading states | Low | Existing SkeletonCard component in @ops/ui | Smoother perceived performance when switching tabs. |

## Anti-Features

Features to explicitly NOT build during this milestone.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Multi-tab visible simultaneously (split view) | Adds massive complexity for minimal value; internal ops tool, not a trading dashboard | One tab at a time with fast switching |
| Custom dashboard layout / drag-and-drop widgets | Over-engineering for a team of < 20 users; every role has well-defined needs | Fixed layout per tab, optimized for each role's workflow |
| Tab customization / ordering preferences | Premature personalization; roles define what you see | Fixed tab order based on role hierarchy |
| Merge sales board into unified app | PROJECT.md explicitly excludes it; sales board is public-facing (no auth) | Keep as standalone app at port 3013 |
| Real-time date range auto-refresh | Socket.IO already handles real-time sale events; adding polling for date-filtered KPIs adds complexity without clear value | Manual refresh or re-select date range to update; Socket.IO continues to handle live sale cascade |
| Date range on individual table rows | Tables already have their own filters (status, agent, etc.); mixing date range into row-level filters creates UX confusion | Date range applies to KPI counters/cards only; table data uses its existing filter patterns |
| Global search across all tabs | Nice to have but not part of this milestone; each tab has its own search/filter patterns | Keep existing per-tab search and filter mechanisms |
| Merge auth-portal completely | Auth-portal still handles login form, password change, access-denied pages; these should move but keep as separate concern within unified app | Login page is a route in the unified app (/login), not a tab |

## Feature Dependencies

```
DateRangeFilter component update (new presets)
  --> Wire to KPI fetches on Manager tab
  --> Wire to KPI fetches on Payroll tab
  --> Wire to KPI fetches on Owner tab
  --> Wire to KPI fetches on CS tab

Auth consolidation (single token capture)
  --> Role-gated tab navigation
  --> Login-to-default-tab routing

PageShell adaptation (app-level tabs vs per-dashboard tabs)
  --> Each dashboard becomes a tab component
  --> Sub-tabs within each dashboard tab remain unchanged
       (e.g., Manager keeps entry/tracker/sales/audits/config)
       (e.g., CS keeps submissions/tracking)

API dateRange() utility (already exists, lines 33-82 in routes/index.ts)
  --> KPI endpoints need to accept range/from/to query params
  --> Currently only CSV export endpoints use date params
  --> KPI-producing endpoints need updates to accept optional date range
```

## MVP Recommendation

### Phase 1: Unified App Shell + Auth (do first)

1. **New unified-dashboard Next.js app** with role-gated tab navigation
2. **Auth consolidation** -- login route returns tab selection instead of external URL redirect
3. **Move each dashboard page.tsx into a tab component** (mechanical migration, no feature changes)
4. **Retire auth-portal landing page** (replaced by tab navigation)

Rationale: This is the structural change. Everything else depends on having one app with working tab switching. The risk is regression in ~11k LOC of existing functionality across 4 dashboard page.tsx files (manager: 2702 LOC, payroll: 3030 LOC, owner: 1957 LOC, CS: 2377 LOC).

### Phase 2: Uniform Date Range (do second)

1. **Update DateRangeFilter presets** to Current Week / Last Week / 30 Days / Custom
2. **Lift date range state to app level** so it persists across tabs
3. **Wire date range to KPI fetches** on each tab (CS tracker, manager tracker, owner overview, payroll)
4. **Update API KPI endpoints** to accept optional range/from/to query params (reuse existing `dateRange()` utility)

Rationale: Date range depends on having a single app (phase 1) because the "persists across tabs" behavior requires shared state. Lower risk than phase 1 -- adding query params to existing fetches.

### Defer to Post-MVP

- Cross-tab KPI summary header (nice but not in PROJECT.md requirements)
- Tab badges with live counts (low effort, can add during polish)
- Keyboard shortcuts (trivial, add anytime)
- Deep link with date range in URL (add once core flow works)

## Key Complexity Notes

### Dashboard Consolidation is Mostly Mechanical but Large

Each dashboard is a single massive page.tsx (700-3000 lines). The consolidation pattern is:
1. Create `components/ManagerTab.tsx`, `components/PayrollTab.tsx`, etc.
2. Move page content into each component
3. Share auth state (token, user roles) from parent
4. Share Socket.IO connection from parent
5. Share date range state from parent

The risk is not technical complexity -- it is **regression risk** across ~11k lines of working code. Each tab must be tested thoroughly after migration.

### Two-Level Tab Navigation

The unified app needs two levels of navigation:
1. **App-level tabs**: Manager | Payroll | Owner | CS (role-gated by user roles)
2. **Dashboard-level sub-tabs**: Within Manager tab, sub-tabs for Entry | Tracker | Sales | Audits | Config; within CS, sub-tabs for Submissions | Tracking

PageShell already supports navItems with activeNav. Recommendation: use PageShell for app-level tabs, then a secondary tab bar component within each dashboard tab for sub-navigation. Do NOT nest two PageShells.

### Date Range on KPIs Requires API Changes

Current state of date range support:
- **CSV export endpoints**: Already accept `range`, `from`, `to` query params via `dateRange()` utility
- **KPI/stats endpoints**: Do NOT currently accept date params (return current/all-time data)
- **Agent KPI endpoint** (`/api/agent-kpis`): Hardcoded 30-day window via `getAgentRetentionKpis()`
- **Tracker endpoints**: Return all data, client groups/filters

Each KPI-producing endpoint needs to accept optional date range params. The `dateRange()` utility already exists (lines 33-82 in routes/index.ts) and handles: today, week (Sun-Sat), 7d, 30d, month, and custom from/to. Just need to add the "last week" range option.

### Auth Simplification

Consolidation actually **simplifies** auth significantly:
- **Eliminates** cross-domain token passing via URL params between separate apps
- **Eliminates** DASHBOARD_MAP with per-role external URLs in auth-portal landing page
- **Eliminates** 5 separate `NEXT_PUBLIC_OPS_API_URL` configurations
- **Eliminates** auth-portal as separate deployment (login becomes a route in unified app)
- Login API returns JWT, client stores it, tabs check roles in-memory
- RBAC moves from "which app can you access" to "which tabs do you see"

### Existing DateRangeFilter Component

The `DateRangeFilter` in `@ops/ui` (packages/ui/src/components/DateRangeFilter.tsx) currently has:
- Presets: "Last 7 days", "Last 30 days", "This month", "Custom"
- Custom mode with from/to date inputs
- Value type: `{ preset: string; from?: string; to?: string }`

Needs updating for v1.3:
- New presets: "Current Week" (Sun-Sat containing today), "Last Week" (prior Sun-Sat), "30 Days", "Custom"
- The API `dateRange()` function already handles "week" (current Sun-Sat window) -- need to add "last_week"
- Consider adding preset key mapping so DateRangeFilter value maps directly to API query param

### Deployment Impact

Consolidating 5 apps into 1 means:
- **Railway**: 5 fewer services to deploy and monitor (auth-portal, manager, payroll, owner, CS all become one)
- **Docker**: Fewer containers, simpler docker-compose
- **CORS**: Single origin instead of 5 separate origins in ALLOWED_ORIGINS
- **Ports**: Free up 3011, 3012, 3019, 3026; unified app gets one port
- **Environment**: One NEXT_PUBLIC_OPS_API_URL instead of five

## Sources

- Codebase analysis: apps/auth-portal, apps/manager-dashboard, apps/payroll-dashboard, apps/owner-dashboard, apps/cs-dashboard
- packages/ui/src/components/DateRangeFilter.tsx -- existing date range component (97 lines, presets defined lines 50-55)
- packages/ui/src/index.tsx -- PageShell with NavItem interface (badge support exists)
- packages/types/src/index.ts -- AppRole type with 7 roles
- apps/ops-api/src/routes/index.ts -- dateRange() utility (lines 33-82), handles week/7d/30d/month/custom
- apps/auth-portal/app/landing/page.tsx -- DASHBOARD_MAP with role-to-URL mapping (to be replaced)
- apps/auth-portal/app/api/login/route.ts -- current auth flow with cross-domain redirect
- apps/manager-dashboard/app/page.tsx -- Tab type and PageShell usage pattern (line 70: 5 sub-tabs)
- apps/cs-dashboard/app/page.tsx -- role-gated tab pattern with canManageCS (line 505-523)
- .planning/PROJECT.md -- v1.3 milestone requirements
