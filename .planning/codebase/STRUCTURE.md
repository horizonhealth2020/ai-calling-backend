# Codebase Structure

**Analysis Date:** 2026-03-24

## Directory Layout

```
ai-calling-backend/
├── apps/
│   ├── ops-api/                    # Express.js REST API (port 8080)
│   │   ├── src/
│   │   │   ├── index.ts            # Server entry point
│   │   │   ├── socket.ts           # Socket.IO event emitters
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts         # requireAuth, requireRole
│   │   │   ├── routes/
│   │   │   │   ├── index.ts        # Route aggregator
│   │   │   │   ├── helpers.ts      # asyncHandler, zodErr
│   │   │   │   ├── auth.ts
│   │   │   │   ├── sales.ts
│   │   │   │   ├── payroll.ts
│   │   │   │   ├── agents.ts
│   │   │   │   ├── products.ts
│   │   │   │   ├── users.ts
│   │   │   │   ├── service.ts
│   │   │   │   ├── chargebacks.ts
│   │   │   │   ├── call-audits.ts
│   │   │   │   ├── call-logs.ts
│   │   │   │   ├── change-requests.ts
│   │   │   │   ├── cs-reps.ts
│   │   │   │   ├── pending-terms.ts
│   │   │   │   ├── alerts.ts
│   │   │   │   ├── ai-budget.ts
│   │   │   │   ├── admin.ts
│   │   │   │   ├── archive.ts
│   │   │   │   └── webhooks.ts
│   │   │   ├── services/
│   │   │   │   ├── payroll.ts       # Commission calc, upsertPayrollEntryForSale
│   │   │   │   ├── audit.ts         # logAudit -> app_audit_log
│   │   │   │   ├── auditQueue.ts    # Audit processing queue
│   │   │   │   ├── callAudit.ts     # Call audit processing
│   │   │   │   ├── convosoCallLogs.ts # Convoso API client
│   │   │   │   ├── agentKpiAggregator.ts # KPI aggregation
│   │   │   │   ├── alerts.ts        # Payroll alert management
│   │   │   │   ├── archive.ts       # Data archival
│   │   │   │   ├── reporting.ts     # Report generation
│   │   │   │   └── repSync.ts       # Rep sync logic
│   │   │   └── workers/
│   │   │       └── convosoKpiPoller.ts # Cron: Convoso KPI polling
│   │   ├── jest.config.ts
│   │   └── package.json
│   ├── ops-dashboard/              # Unified Next.js 15 dashboard
│   │   ├── app/
│   │   │   ├── layout.tsx          # Root layout
│   │   │   ├── page.tsx            # Landing/redirect
│   │   │   ├── api/                # Next.js API routes
│   │   │   │   ├── login/
│   │   │   │   ├── verify/
│   │   │   │   └── change-password/
│   │   │   └── (dashboard)/        # Route group with tab nav
│   │   │       ├── layout.tsx      # Tab navigation, auth guard
│   │   │       ├── manager/        # Manager role tab
│   │   │       │   ├── page.tsx
│   │   │       │   ├── ManagerEntry.tsx
│   │   │       │   ├── ManagerSales.tsx
│   │   │       │   ├── ManagerTracker.tsx
│   │   │       │   ├── ManagerAudits.tsx
│   │   │       │   └── ManagerConfig.tsx
│   │   │       ├── payroll/        # Payroll role tab
│   │   │       │   ├── page.tsx
│   │   │       │   ├── PayrollPeriods.tsx
│   │   │       │   ├── PayrollChargebacks.tsx
│   │   │       │   ├── PayrollExports.tsx
│   │   │       │   ├── PayrollProducts.tsx
│   │   │       │   └── PayrollService.tsx
│   │   │       ├── owner/          # Owner role tab
│   │   │       │   ├── page.tsx
│   │   │       │   ├── OwnerKPIs.tsx
│   │   │       │   ├── OwnerOverview.tsx
│   │   │       │   ├── OwnerConfig.tsx
│   │   │       │   ├── OwnerScoring.tsx
│   │   │       │   └── OwnerUsers.tsx
│   │   │       └── cs/             # Customer Service role tab
│   │   │           ├── page.tsx
│   │   │           ├── CSSubmissions.tsx
│   │   │           └── CSTracking.tsx
│   │   ├── lib/
│   │   │   ├── auth.ts            # decodeRolesFromToken
│   │   │   ├── roles.ts           # getTabsForRoles, TabConfig
│   │   │   ├── DateRangeContext.tsx # Date range state provider
│   │   │   └── SocketProvider.tsx  # Socket.IO context provider
│   │   ├── middleware.ts           # Next.js middleware
│   │   ├── next.config.js
│   │   └── package.json
│   └── sales-board/                # Public sales leaderboard (Next.js 15)
│       ├── app/
│       │   ├── layout.tsx
│       │   ├── page.tsx
│       │   ├── error.tsx
│       │   └── not-found.tsx
│       ├── next.config.js
│       └── package.json
├── packages/
│   ├── auth/                       # @ops/auth - JWT auth
│   │   └── src/
│   │       ├── index.ts            # Server: sign/verify JWT, session cookies
│   │       └── client.ts           # Browser: captureTokenFromUrl, authFetch, getToken
│   ├── db/                         # @ops/db - Prisma client
│   │   └── src/
│   │       └── client.ts           # PrismaClient singleton
│   ├── types/                      # @ops/types - Shared types
│   │   └── src/
│   │       ├── index.ts            # AppRole, SessionUser
│   │       └── us-states.ts        # US_STATES, StateCode
│   ├── ui/                         # @ops/ui - Shared UI components
│   │   └── src/
│   │       ├── index.tsx           # Main exports
│   │       ├── tokens.ts           # Design tokens (colors, spacing, radius, typography, motion)
│   │       ├── ThemeProvider.tsx    # Theme context
│   │       ├── ThemeToggle.tsx     # Theme toggle component
│   │       ├── theme.css           # Theme CSS
│   │       ├── animations.css      # Animation styles
│   │       ├── responsive.css      # Responsive styles
│   │       └── components/
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
│   ├── socket/                     # @ops/socket - Socket.IO client hook
│   │   └── src/
│   │       ├── index.ts            # Re-exports
│   │       ├── useSocket.ts        # React hook for Socket.IO
│   │       └── types.ts            # SaleChangedPayload, event types
│   └── utils/                      # @ops/utils - Shared utilities
│       └── src/
│           └── index.ts            # logEvent, logError, formatDollar, formatDate
├── prisma/
│   ├── schema.prisma               # Database schema (25+ models)
│   ├── migrations/                 # Prisma migration files
│   ├── manual-migrations/          # Manual SQL migrations
│   └── seed.ts                     # Database seeder
├── index.js                        # Morgan voice service entry point
├── voiceGateway.js                 # Vapi outbound call logic
├── morganToggle.js                 # Morgan enable/disable toggle
├── timeUtils.js                    # Business hours checker
├── rateLimitState.js               # Vapi 429 rate limit tracking
├── __tests__/                      # Morgan service tests (Jest)
├── package.json                    # Root package.json (workspaces)
├── tsconfig.base.json              # Shared TS config with path aliases
├── docker-compose.yml              # Full stack Docker orchestration
├── Dockerfile.nextjs               # Shared Dockerfile for Next.js apps
├── railway.toml                    # Railway deployment config
├── nixpacks.toml                   # Nixpacks build config
└── jest.config.js                  # Root Jest config (Morgan tests)
```

## App Descriptions

| Directory | Purpose | Entry Point |
|-----------|---------|-------------|
| `apps/ops-api/` | Express.js REST API - auth, RBAC, sales, payroll, commissions, chargebacks, audits, exports | `apps/ops-api/src/index.ts` |
| `apps/ops-dashboard/` | Unified Next.js 15 dashboard with role-based tabs (manager, payroll, owner, CS) | `apps/ops-dashboard/app/layout.tsx` |
| `apps/sales-board/` | Public sales leaderboard, no auth required | `apps/sales-board/app/page.tsx` |
| Root (`index.js`) | Morgan AI voice service - Convoso webhook receiver, Vapi outbound caller | `index.js` |

## Shared Packages

| Package | Import Path | Purpose | Key Exports |
|---------|-------------|---------|-------------|
| `packages/auth/` | `@ops/auth` | Server-side JWT auth | `signSessionToken()`, `verifySessionToken()`, `buildSessionCookie()`, `buildLogoutCookie()`, `SESSION_COOKIE` |
| `packages/auth/` | `@ops/auth/client` | Browser-side auth | `captureTokenFromUrl()`, `authFetch()`, `getToken()`, `clearToken()`, `decodeTokenPayload()` |
| `packages/db/` | `@ops/db` | Prisma client singleton | `prisma` |
| `packages/types/` | `@ops/types` | Shared TypeScript types | `AppRole`, `SessionUser`, `US_STATES`, `StateCode` |
| `packages/ui/` | `@ops/ui` | Shared UI components and design tokens | `Card`, `Button`, `Input`, `Select`, `Badge`, `Toast`, `TabNav`, `StatCard`, `Skeleton`, `EmptyState`, `AnimatedNumber`, `DateRangeFilter`, `ProgressRing`, `Tooltip`, `colors`, `spacing`, `radius`, `typography`, `motion` |
| `packages/socket/` | `@ops/socket` | Socket.IO React integration | `useSocket()`, `SaleChangedPayload`, `DISCONNECT_BANNER`, `HIGHLIGHT_GLOW` |
| `packages/utils/` | `@ops/utils` | Logging and formatting | `logEvent()`, `logError()`, `formatDollar()`, `formatNegDollar()`, `formatDate()` |

## Key Files

| File | Purpose |
|------|---------|
| `package.json` | Root workspace config; defines workspaces `apps/*` and `packages/*` |
| `tsconfig.base.json` | Shared TypeScript config with `@ops/*` path aliases |
| `prisma/schema.prisma` | Full database schema (User, Agent, Sale, Product, PayrollPeriod, PayrollEntry, Clawback, ChargebackSubmission, PendingTerm, etc.) |
| `prisma/seed.ts` | Database seeder (default password: `ChangeMe123!`) |
| `apps/ops-api/src/routes/helpers.ts` | `asyncHandler()`, `zodErr()` and shared route utilities |
| `apps/ops-api/src/middleware/auth.ts` | `requireAuth` and `requireRole` middleware |
| `apps/ops-api/src/services/payroll.ts` | Commission calculation engine, `upsertPayrollEntryForSale()`, week range logic |
| `apps/ops-api/src/services/audit.ts` | `logAudit()` - audit trail writer |
| `apps/ops-api/src/socket.ts` | Socket.IO event emitter functions |
| `apps/ops-api/src/workers/convosoKpiPoller.ts` | Background Convoso KPI polling worker |
| `apps/ops-dashboard/lib/roles.ts` | Role-to-tab mapping for dashboard navigation |
| `apps/ops-dashboard/lib/auth.ts` | Client-side role decoding from JWT |
| `apps/ops-dashboard/lib/SocketProvider.tsx` | Socket.IO React context provider |
| `apps/ops-dashboard/app/(dashboard)/layout.tsx` | Dashboard shell with tab navigation and auth guard |
| `docker-compose.yml` | Full stack orchestration (postgres + ops-api + all frontends) |
| `Dockerfile.nextjs` | Shared multi-stage Dockerfile for all Next.js apps (uses `APP_NAME` build arg) |

## Naming Conventions

**Files:**
- Route files: kebab-case (`call-audits.ts`, `change-requests.ts`, `cs-reps.ts`)
- Service files: camelCase (`payroll.ts`, `callAudit.ts`, `agentKpiAggregator.ts`)
- React components: PascalCase (`ManagerEntry.tsx`, `PayrollChargebacks.tsx`, `CSTracking.tsx`)
- Next.js pages: `page.tsx` (App Router convention)

**Directories:**
- Apps: kebab-case (`ops-api`, `ops-dashboard`, `sales-board`)
- Packages: lowercase single-word (`auth`, `db`, `types`, `ui`, `utils`, `socket`)
- Route groups: parenthesized (`(dashboard)`)

## Where to Add New Code

**New API Route:**
1. Create route file: `apps/ops-api/src/routes/{feature}.ts`
2. Register in: `apps/ops-api/src/routes/index.ts` (import and `router.use()`)
3. Use `asyncHandler()` for all handlers, `zodErr()` for validation errors
4. Add `requireAuth` and `requireRole()` middleware as needed

**New Service (Business Logic):**
- Create: `apps/ops-api/src/services/{feature}.ts`
- Import `prisma` from `@ops/db`
- Export functions consumed by route handlers

**New Dashboard Tab/Section:**
- Create directory: `apps/ops-dashboard/app/(dashboard)/{section}/`
- Add `page.tsx` as the entry point
- Add component files as `{Section}{Feature}.tsx` (PascalCase)
- Register tab in: `apps/ops-dashboard/lib/roles.ts`

**New Dashboard Component (within existing section):**
- Add to: `apps/ops-dashboard/app/(dashboard)/{section}/{ComponentName}.tsx`
- Use inline `React.CSSProperties` objects (no Tailwind, no CSS modules)
- Import design tokens from `@ops/ui` (`colors`, `spacing`, `radius`, `typography`, `motion`)

**New Shared UI Component:**
- Create: `packages/ui/src/components/{ComponentName}.tsx`
- Export from: `packages/ui/src/components/index.ts`
- Re-export from: `packages/ui/src/index.tsx`

**New Shared Type:**
- Add to: `packages/types/src/index.ts`

**New Shared Utility:**
- Add to: `packages/utils/src/index.ts`

**New Database Model:**
1. Add model to: `prisma/schema.prisma`
2. Run: `npm run db:migrate` (creates migration)
3. Update seed if needed: `prisma/seed.ts`

**New Socket.IO Event:**
- Add emitter function: `apps/ops-api/src/socket.ts`
- Add type to: `packages/socket/src/types.ts`
- Handle in dashboard via `useSocket()` hook from `@ops/socket`

**New Background Worker:**
- Create: `apps/ops-api/src/workers/{worker}.ts`
- Start from: `apps/ops-api/src/index.ts` (call on server boot)

## Special Directories

**`prisma/migrations/`:**
- Purpose: Prisma-managed database migration files
- Generated: Yes (by `prisma migrate dev`)
- Committed: Yes

**`prisma/manual-migrations/`:**
- Purpose: Hand-written SQL for migrations Prisma cannot generate
- Generated: No
- Committed: Yes

**`__tests__/`:**
- Purpose: Jest tests for the root Morgan voice service
- Generated: No
- Committed: Yes

**`apps/ops-api/src/services/__tests__/`:**
- Purpose: Jest tests for ops-api services
- Generated: No
- Committed: Yes

**`node_modules/`:**
- Purpose: npm dependencies (hoisted by workspaces)
- Generated: Yes
- Committed: No

---

*Structure analysis: 2026-03-24*
