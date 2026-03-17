# Phase 11: Foundation & Dashboard Shell - Context

**Gathered:** 2026-03-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Database tables (chargeback_submissions, pending_terms) created with all specified fields, new CUSTOMER_SERVICE role added to AppRole enum and RBAC middleware, Customer Service dashboard app scaffolded as a Next.js app following existing patterns, and auth portal updated to redirect customer_service users to the CS dashboard.

</domain>

<decisions>
## Implementation Decisions

### Dashboard port & naming
- App directory: `apps/cs-dashboard`
- Port: 3014
- Add to ALLOWED_ORIGINS in ops-api CORS whitelist
- Add npm workspace script: `npm run cs:dev` → localhost:3014
- Follow exact same next.config.js pattern as other dashboards (transpilePackages, conditional standalone output)

### Tab navigation pattern
- Use PageShell sidebar nav (same pattern as manager/payroll/owner dashboards)
- Two nav items: "Submissions" and "Tracking"
- Submissions tab shows two separate Card sections (Chargebacks parser + Pending Terms parser) — not nested tabs
- Tracking tab shows two sections (Chargebacks tracking + Pending Terms tracking) on one scrollable page

### Role naming
- AppRole enum value: `CUSTOMER_SERVICE` (follows existing UPPER_SNAKE convention)
- Add to `packages/types/src/index.ts` AppRole type union
- Add CUSTOMER_SERVICE entry to DASHBOARD_MAP in auth-portal landing page
- URL pattern: `http://localhost:3014/landing?session_token=...`

### Claude's Discretion
- Prisma model naming convention (PascalCase per existing pattern)
- Migration SQL file naming
- Exact field types for decimal columns (follow existing Decimal(12,2) pattern)
- Docker and Railway configuration additions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing dashboard patterns
- `apps/manager-dashboard/app/page.tsx` — Reference for PageShell usage, tab navigation, inline styles
- `apps/manager-dashboard/next.config.js` — Reference for Next.js config pattern
- `apps/manager-dashboard/package.json` — Reference for workspace dependencies

### Auth & role system
- `packages/types/src/index.ts` — AppRole enum definition to extend
- `apps/ops-api/src/middleware/auth.ts` — RBAC middleware (requireAuth, requireRole)
- `apps/auth-portal/app/landing/page.tsx` — DASHBOARD_MAP for role → dashboard routing

### Shared components
- `packages/ui/src/index.tsx` — PageShell component and re-exports
- `packages/ui/src/tokens.ts` — Design tokens (colors, spacing, radius, etc.)
- `packages/ui/src/components/` — Button, Card, Input, Select, TabNav, etc.

### Database
- `prisma/schema.prisma` — Existing schema to extend with new models
- `prisma/migrations/` — Migration directory (manual SQL convention)

### Environment
- `.env.example` — Environment variables template
- `apps/ops-api/.env.example` — API env vars (ALLOWED_ORIGINS)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PageShell` component: sidebar nav with items, active state, mobile responsive — use as-is for CS dashboard
- `Card`, `Button`, `Input`, `Select` components from @ops/ui — use for form elements
- `authFetch` from `@ops/auth/client` — use for all API calls
- `captureTokenFromUrl` from `@ops/auth/client` — use for token capture on redirect
- `requireAuth`, `requireRole` middleware — use for route protection

### Established Patterns
- Each dashboard is a standalone Next.js app with `"use client"` page.tsx
- Style constants at module scope: `const CARD: React.CSSProperties = { ... }`
- Tab state managed via `useState<Tab>` with type union
- Data fetched via `Promise.all` in initial `useEffect`
- Manual migration SQL files in `prisma/migrations/YYYYMMDD_description/migration.sql`

### Integration Points
- `packages/types/src/index.ts` — add CUSTOMER_SERVICE to AppRole union type
- `apps/auth-portal/app/landing/page.tsx` — add CUSTOMER_SERVICE to DASHBOARD_MAP
- `apps/ops-api/src/middleware/auth.ts` — CUSTOMER_SERVICE automatically works (SUPER_ADMIN bypasses, role check is array inclusion)
- `package.json` root — add `cs:dev` script and workspace member
- `docker-compose.yml` — add cs-dashboard service
- `.env.example` / `apps/ops-api/.env.example` — add port 3014 to ALLOWED_ORIGINS

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions captured above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-foundation-dashboard-shell*
*Context gathered: 2026-03-17*
