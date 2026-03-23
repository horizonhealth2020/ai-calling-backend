# Codebase Structure

**Analysis Date:** 2026-03-23

## Directory Layout

```
ai-calling-backend/                  # Monorepo root
├── index.js                         # Morgan legacy voice service entry point
├── voiceGateway.js                  # Vapi outbound call abstraction
├── morganToggle.js                  # Feature flag for Morgan service
├── rateLimitState.js                # Vapi 429 backoff state
├── timeUtils.js                     # Business hours logic
├── package.json                     # Root workspace manifest + Morgan deps
├── tsconfig.base.json               # Shared TS config + @ops/* path aliases
├── jest.config.js                   # Jest config for root Morgan tests
├── docker-compose.yml               # Full-stack local Docker orchestration
├── Dockerfile.nextjs                # Shared Dockerfile for all Next.js apps
├── prisma/
│   ├── schema.prisma                # Single Prisma schema for Ops Platform
│   ├── migrations/                  # Prisma migration history
│   └── seed.ts                      # Database seed script
├── apps/
│   ├── ops-api/                     # Express REST API (port 8080)
│   │   └── src/
│   │       ├── index.ts             # Server entry: Express + Socket.IO + poller boot
│   │       ├── middleware/
│   │       │   └── auth.ts          # requireAuth + requireRole middleware
│   │       ├── routes/
│   │       │   └── index.ts         # All API routes (single flat file)
│   │       ├── services/
│   │       │   ├── payroll.ts       # Commission engine, payroll entry upsert
│   │       │   ├── audit.ts         # logAudit() — writes to app_audit_log
│   │       │   ├── auditQueue.ts    # AI call audit job queue
│   │       │   ├── callAudit.ts     # Call re-audit logic
│   │       │   ├── alerts.ts        # Payroll alert create/approve/clear
│   │       │   ├── reporting.ts     # Pure reporting helpers (computeTrend, shiftRange)
│   │       │   ├── convosoCallLogs.ts  # Convoso API fetch + KPI computation
│   │       │   ├── agentKpiAggregator.ts  # Agent retention KPI queries
│   │       │   └── repSync.ts       # CsRepRoster ↔ ServiceAgent sync
│   │       ├── socket.ts            # Socket.IO emit helpers (emitSaleChanged, etc.)
│   │       └── workers/
│   │           └── convosoKpiPoller.ts  # 10-minute cron poll for Convoso call data
│   ├── ops-dashboard/               # Unified dashboard (port 3026, replaces separate apps)
│   │   ├── app/
│   │   │   ├── layout.tsx           # Root layout (ThemeProvider, global CSS)
│   │   │   ├── page.tsx             # Login page + change-password form
│   │   │   ├── api/
│   │   │   │   ├── login/route.ts   # Proxies credentials to ops-api
│   │   │   │   ├── verify/route.ts  # Token verification endpoint
│   │   │   │   └── change-password/route.ts  # Password change proxy
│   │   │   └── (dashboard)/         # Route group — all authenticated views
│   │   │       ├── layout.tsx       # Dashboard shell: SocketProvider, DateRangeProvider, tab nav
│   │   │       ├── manager/         # Manager tab: sales entry, tracker, audits, config
│   │   │       │   ├── page.tsx     # Manager page host (tab switcher)
│   │   │       │   ├── ManagerEntry.tsx
│   │   │       │   ├── ManagerTracker.tsx
│   │   │       │   ├── ManagerSales.tsx
│   │   │       │   ├── ManagerAudits.tsx
│   │   │       │   └── ManagerConfig.tsx
│   │   │       ├── payroll/         # Payroll tab: periods, service staff, chargebacks, exports
│   │   │       │   ├── page.tsx
│   │   │       │   ├── PayrollPeriods.tsx
│   │   │       │   ├── PayrollService.tsx
│   │   │       │   ├── PayrollChargebacks.tsx
│   │   │       │   ├── PayrollProducts.tsx
│   │   │       │   └── PayrollExports.tsx
│   │   │       ├── owner/           # Owner tab: KPIs, overview, users, config
│   │   │       │   ├── page.tsx
│   │   │       │   ├── OwnerKPIs.tsx
│   │   │       │   ├── OwnerOverview.tsx
│   │   │       │   ├── OwnerUsers.tsx
│   │   │       │   └── OwnerConfig.tsx
│   │   │       └── cs/              # Customer Service tab: chargebacks, pending terms
│   │   │           ├── page.tsx
│   │   │           ├── CSSubmissions.tsx
│   │   │           └── CSTracking.tsx
│   │   ├── lib/
│   │   │   ├── auth.ts              # Client-side token decode helper (decodeRolesFromToken)
│   │   │   ├── roles.ts             # TAB_CONFIG, TAB_ROLES, getTabsForRoles, getDefaultTab
│   │   │   ├── SocketProvider.tsx   # Socket.IO context provider for dashboard layout
│   │   │   └── DateRangeContext.tsx # Shared date-range filter state (week/today/30d/custom)
│   │   └── middleware.ts            # Next.js edge middleware: JWT verify + role-based route guard
│   └── sales-board/                 # Public leaderboard (port 3013, no auth)
│       └── app/
│           ├── layout.tsx
│           └── page.tsx             # Live sales board using @ops/socket useSocket hook
├── packages/
│   ├── auth/
│   │   └── src/
│   │       ├── index.ts             # Server: signSessionToken, verifySessionToken, cookie builders
│   │       └── client.ts            # Browser: captureTokenFromUrl, authFetch, getToken, clearToken
│   ├── db/
│   │   └── src/
│   │       └── client.ts            # Prisma singleton (globalThis pattern)
│   ├── types/
│   │   └── src/
│   │       └── index.ts             # AppRole enum, SessionUser type
│   ├── ui/
│   │   └── src/
│   │       ├── tokens.ts            # Design tokens: colors, spacing, radius, typography, motion
│   │       ├── ThemeProvider.tsx    # Light/dark theme context + CSS variable injection
│   │       ├── ThemeToggle.tsx      # Theme toggle button component
│   │       ├── theme.css            # CSS custom properties for all design tokens
│   │       ├── animations.css       # Keyframe animations (fade, slide, scale)
│   │       ├── responsive.css       # Breakpoint utilities
│   │       ├── index.tsx            # Package barrel export
│   │       └── components/          # Shared UI components
│   │           ├── index.ts         # Component barrel export
│   │           ├── AnimatedNumber.tsx
│   │           ├── Badge.tsx
│   │           ├── Button.tsx
│   │           ├── Card.tsx
│   │           ├── DateRangeFilter.tsx
│   │           ├── EmptyState.tsx
│   │           ├── Input.tsx
│   │           ├── ProgressRing.tsx
│   │           ├── Select.tsx
│   │           ├── Skeleton.tsx
│   │           ├── StatCard.tsx
│   │           ├── TabNav.tsx
│   │           ├── Toast.tsx
│   │           └── Tooltip.tsx
│   ├── socket/
│   │   └── src/
│   │       ├── index.ts             # Package exports
│   │       ├── types.ts             # SaleChangedPayload, DISCONNECT_BANNER, HIGHLIGHT_GLOW
│   │       └── useSocket.ts         # React hook: connects to Socket.IO, handles sale:changed events
│   └── utils/
│       └── src/
│           └── index.ts             # logEvent, logError, formatDollar, formatDate
└── __tests__/                       # Jest tests for root Morgan voice service
    └── helpers.test.js
```

## Directory Purposes

**`apps/ops-api/src/routes/`:**
- Purpose: Single flat file (`index.ts`) containing all REST endpoints
- Contains: Every route handler for auth, sales, agents, products, payroll, chargebacks, audits, CS, reporting
- Key files: `apps/ops-api/src/routes/index.ts`

**`apps/ops-api/src/services/`:**
- Purpose: All business logic — no Express types, no direct response writing
- Contains: Commission calculation, payroll upsert, audit logging, call audit queue, alerts, reporting helpers, Convoso integration, rep sync
- Key files: `apps/ops-api/src/services/payroll.ts`, `apps/ops-api/src/services/audit.ts`

**`apps/ops-api/src/services/__tests__/`:**
- Purpose: Jest unit tests for service-layer logic
- Contains: Commission, payroll guard, period assignment, reporting, status change, status-commission tests
- Key files: `apps/ops-api/src/services/__tests__/commission.test.ts`

**`apps/ops-api/src/workers/`:**
- Purpose: Background processes started at server boot
- Contains: Convoso KPI polling cron (10-minute interval)
- Key files: `apps/ops-api/src/workers/convosoKpiPoller.ts`

**`apps/ops-dashboard/app/(dashboard)/`:**
- Purpose: All authenticated dashboard views grouped under the shared dashboard layout
- Contains: Four role-gated sections (manager, payroll, owner, cs), each with a page host and tab-component files
- Key files: `apps/ops-dashboard/app/(dashboard)/layout.tsx`

**`apps/ops-dashboard/lib/`:**
- Purpose: Dashboard-specific client utilities and context providers
- Contains: Auth token decoder, role-to-tab mapping, Socket.IO context, shared date range state
- Key files: `apps/ops-dashboard/lib/roles.ts`, `apps/ops-dashboard/lib/SocketProvider.tsx`

**`packages/ui/src/components/`:**
- Purpose: Shared React UI components used by all dashboard apps
- Contains: Atomic components (Button, Input, Card, Badge), data display (StatCard, AnimatedNumber, ProgressRing), navigation (TabNav, DateRangeFilter), feedback (Toast, Skeleton, EmptyState)

**`prisma/`:**
- Purpose: Database schema, migration history, and seed data for the entire Ops Platform
- Contains: Prisma schema with all models, migration SQL files, seed script
- Key files: `prisma/schema.prisma`, `prisma/seed.ts`

## Key File Locations

**Entry Points:**
- `apps/ops-api/src/index.ts`: ops-api Express server boot
- `apps/ops-dashboard/app/page.tsx`: Login page (root route)
- `apps/ops-dashboard/app/(dashboard)/layout.tsx`: Authenticated dashboard shell
- `apps/sales-board/app/page.tsx`: Public sales leaderboard
- `index.js`: Morgan legacy voice service

**Configuration:**
- `tsconfig.base.json`: Shared TypeScript config + `@ops/*` path aliases
- `prisma/schema.prisma`: Database models and enums
- `docker-compose.yml`: Local full-stack orchestration
- `apps/ops-dashboard/middleware.ts`: Next.js JWT/role route guard

**Core Logic:**
- `apps/ops-api/src/routes/index.ts`: All REST endpoints
- `apps/ops-api/src/services/payroll.ts`: Commission engine
- `apps/ops-api/src/middleware/auth.ts`: `requireAuth` + `requireRole`
- `apps/ops-api/src/socket.ts`: Socket.IO emit helpers
- `packages/auth/src/index.ts`: JWT sign/verify, cookie builders
- `packages/auth/src/client.ts`: `authFetch`, `captureTokenFromUrl`

**Testing:**
- `apps/ops-api/src/services/__tests__/`: Service unit tests
- `apps/ops-api/src/services/__tests__/__mocks__/ops-db.ts`: Prisma mock
- `__tests__/`: Root Morgan service tests

## Naming Conventions

**Files:**
- Services: camelCase (`payroll.ts`, `callAudit.ts`, `agentKpiAggregator.ts`)
- React components: PascalCase matching component name (`ManagerEntry.tsx`, `PayrollPeriods.tsx`)
- Next.js App Router: lowercase per convention (`page.tsx`, `layout.tsx`, `route.ts`)
- Test files: kebab-case with `.test.ts` suffix (`commission.test.ts`, `period-assignment.test.ts`)
- Config files: kebab-case (`jest.config.ts`, `tsconfig.base.json`)

**Directories:**
- App Router segments: lowercase (`manager/`, `payroll/`, `owner/`, `cs/`)
- Route groups: parenthesized lowercase (`(dashboard)/`)
- Service sub-groupings: lowercase (`services/`, `workers/`, `middleware/`)
- Packages: lowercase kebab with `@ops/` prefix in imports (`packages/auth/` → `@ops/auth`)

**React Component Style Objects:**
- Screaming-snake-case constant names: `const TAB_BAR: React.CSSProperties = { ... }`
- Common abbreviations: `BTN`, `INP`, `CARD`, `BG`, `WRAP`, `FIELD`

## Where to Add New Code

**New API Endpoint:**
- Add route handler to `apps/ops-api/src/routes/index.ts`
- Add business logic to a new or existing service in `apps/ops-api/src/services/`
- Wrap handler with `asyncHandler()`, validate with a Zod schema + `zodErr()`
- Apply `requireAuth, requireRole(...)` guards before the handler
- Call `logAudit()` for any create/update/delete operation

**New Dashboard Tab or Section:**
- Create a directory under `apps/ops-dashboard/app/(dashboard)/` (e.g., `reporting/`)
- Add `page.tsx` as the tab host; create sub-components as `ReportingXxx.tsx` siblings
- Register the tab in `apps/ops-dashboard/lib/roles.ts` (TAB_CONFIG + TAB_ROLES)
- Add route to `matcher` array in `apps/ops-dashboard/middleware.ts`

**New Shared UI Component:**
- Add component file to `packages/ui/src/components/`
- Export from `packages/ui/src/components/index.ts`
- Use `packages/ui/src/tokens.ts` design tokens for all styling via inline `React.CSSProperties`

**New Service:**
- Create `apps/ops-api/src/services/myService.ts`
- Import `prisma` from `@ops/db`; use `logAudit` from `./audit` for mutations
- Import and call from `apps/ops-api/src/routes/index.ts`

**New Worker/Cron:**
- Create `apps/ops-api/src/workers/myWorker.ts` with a `startMyWorker()` export
- Call `startMyWorker()` in `apps/ops-api/src/index.ts` after socket setup

**New Shared Type:**
- Add to `packages/types/src/index.ts`

**Database Schema Changes:**
- Edit `prisma/schema.prisma`
- Run `npm run db:migrate` to generate and apply migration

## Special Directories

**`.planning/`:**
- Purpose: GSD planning documents — phases, milestones, codebase analysis, quick tasks
- Generated: No (hand-authored)
- Committed: Yes

**`prisma/migrations/`:**
- Purpose: Auto-generated SQL migration files from `prisma migrate`
- Generated: Yes (by Prisma CLI)
- Committed: Yes

**`apps/ops-api/src/services/__tests__/__mocks__/`:**
- Purpose: Jest manual mocks for `@ops/db` package
- Generated: No
- Committed: Yes

**`.claude/`:**
- Purpose: Claude agent skills and configuration
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-23*
