# Architecture

**Analysis Date:** 2026-03-24

## Pattern Overview

**Overall:** Monorepo with two independent workloads sharing a PostgreSQL database

**Key Characteristics:**
- npm workspaces monorepo with `apps/*` and `packages/*`
- Two fully independent workloads: legacy Morgan voice service (root) and Ops Platform (apps/)
- Express.js REST API backend with multiple Next.js 15 frontend apps
- Shared packages provide auth, DB client, types, UI components, and utilities
- Real-time updates via Socket.IO from API to dashboards
- Role-based access control with JWT authentication

## Workloads

**Workload 1: Morgan Voice Service (Legacy)**
- Purpose: AI outbound calling system using Vapi voice platform
- Entry point: `index.js` (root)
- Supporting files: `voiceGateway.js`, `morganToggle.js`, `timeUtils.js`, `rateLimitState.js`
- Runtime: Node.js with CommonJS (`require()`)
- Integrations: Convoso (lead source/webhooks), Vapi (voice AI calls)
- Independently deployable, does not depend on Ops Platform packages
- Manages a queue of outbound calls with 3 concurrent slots (one per Twilio number)

**Workload 2: Ops Platform**
- Purpose: Sales operations suite (sales tracking, payroll, commissions, audits, customer service)
- Backend: `apps/ops-api/` (Express.js + TypeScript)
- Frontends: `apps/ops-dashboard/` (unified Next.js 15 app with role-based tabs)
- Additional frontends: `apps/sales-board/` (public leaderboard)
- Shared code: `packages/` (auth, db, types, ui, utils, socket)

## Layers

**API Layer (ops-api):**
- Purpose: REST API serving all frontend apps
- Location: `apps/ops-api/src/`
- Entry point: `apps/ops-api/src/index.ts`
- Routes: `apps/ops-api/src/routes/` (modular route files imported by `index.ts`)
- Route files: `auth.ts`, `users.ts`, `agents.ts`, `products.ts`, `sales.ts`, `payroll.ts`, `service.ts`, `webhooks.ts`, `call-audits.ts`, `change-requests.ts`, `call-logs.ts`, `chargebacks.ts`, `cs-reps.ts`, `pending-terms.ts`, `alerts.ts`, `ai-budget.ts`, `admin.ts`, `archive.ts`
- Helpers: `apps/ops-api/src/routes/helpers.ts` (shared route utilities like `asyncHandler`, `zodErr`)
- Depends on: `@ops/db`, `@ops/auth`, `@ops/types`, `@ops/utils`
- Used by: All frontend apps via HTTP + Socket.IO

**Middleware Layer:**
- Purpose: Authentication and authorization
- Location: `apps/ops-api/src/middleware/auth.ts`
- Contains: `requireAuth` (JWT validation from header or cookie) and `requireRole(...roles)` (RBAC check)
- SUPER_ADMIN bypasses all role checks

**Service Layer:**
- Purpose: Business logic, separated from route handlers
- Location: `apps/ops-api/src/services/`
- Key services:
  - `payroll.ts` - Commission calculation, payroll entry management, week range logic
  - `audit.ts` - Audit log persistence to `app_audit_log` table
  - `auditQueue.ts` - Queue management for audit processing
  - `callAudit.ts` - Call audit processing logic
  - `convosoCallLogs.ts` - Convoso API integration, KPI enrichment
  - `alerts.ts` - Payroll alert management
  - `archive.ts` - Data archival logic
  - `reporting.ts` - Report generation
  - `repSync.ts` - Rep synchronization
  - `agentKpiAggregator.ts` - Agent KPI aggregation from call data
- Depends on: `@ops/db` (Prisma client)

**Worker Layer:**
- Purpose: Background polling jobs
- Location: `apps/ops-api/src/workers/`
- Contains: `convosoKpiPoller.ts` - Polls Convoso API every 10 minutes per active lead source, builds per-agent KPI snapshots
- Started on server boot from `index.ts`
- Silently disabled when `CONVOSO_AUTH_TOKEN` is not set

**Real-Time Layer (Socket.IO):**
- Purpose: Push updates from API to connected dashboard clients
- Location: `apps/ops-api/src/socket.ts`
- Events emitted: `sale:changed`, `cs:changed`, `alert:created`, `alert:resolved`, `service-payroll:changed`, `clawback:created`, `new_audit`, `audit_status`, `processing_started`, `processing_failed`
- Client hook: `packages/socket/src/useSocket.ts` (React hook for dashboards)

**Frontend Layer (Unified Dashboard):**
- Purpose: Role-based dashboard with tab navigation
- Location: `apps/ops-dashboard/`
- Uses Next.js 15 App Router with route groups: `app/(dashboard)/`
- Tab sections by role:
  - `app/(dashboard)/manager/` - Sales entry, agent tracker, call audits, config
  - `app/(dashboard)/payroll/` - Periods, chargebacks, exports, products, service staff
  - `app/(dashboard)/owner/` - KPIs, overview, config, scoring, user management
  - `app/(dashboard)/cs/` - Customer service submissions and tracking
- Auth: `app/api/login/`, `app/api/verify/`, `app/api/change-password/` (Next.js API routes)
- Shared lib: `apps/ops-dashboard/lib/` (`auth.ts`, `roles.ts`, `DateRangeContext.tsx`, `SocketProvider.tsx`)
- Depends on: `@ops/auth/client`, `@ops/ui`, `@ops/types`, `@ops/socket`

**Frontend Layer (Sales Board):**
- Purpose: Public-facing sales leaderboard (no auth required for board endpoints)
- Location: `apps/sales-board/`
- Minimal Next.js 15 app

**Shared Packages Layer:**
- Purpose: Code reuse across all apps
- Location: `packages/`
- Path aliases defined in `tsconfig.base.json`

**Data Layer:**
- Purpose: PostgreSQL database via Prisma ORM
- Schema: `prisma/schema.prisma` (650 lines, 25+ models)
- Migrations: `prisma/migrations/`
- Seed: `prisma/seed.ts`
- Client singleton: `packages/db/src/client.ts`

## Data Flow

**Sale Entry Flow:**
1. Manager enters sale via `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx`
2. `authFetch()` POSTs to `ops-api` `/api/sales` route
3. Route handler validates with Zod, calls `payroll.ts` -> `upsertPayrollEntryForSale()`
4. Commission calculated using product rules, enrollment fee logic, bundle requirements
5. PayrollEntry created/updated, linked to auto-created PayrollPeriod (Sunday-Saturday week)
6. `emitSaleChanged()` pushes real-time update via Socket.IO
7. `logAudit()` writes to `app_audit_log`
8. All connected dashboards receive update

**Authentication Flow:**
1. User logs in via `apps/ops-dashboard/app/api/login/` Next.js API route
2. Server validates credentials, calls `signSessionToken()` from `@ops/auth`
3. JWT (12h expiry) returned; client stores in localStorage as `ops_session_token`
4. `captureTokenFromUrl()` handles redirect-based token passing between apps
5. `authFetch()` injects Bearer header on every API call, auto-refreshes within 15min of expiry
6. API middleware `requireAuth` validates token, `requireRole` checks RBAC

**Convoso KPI Flow:**
1. `convosoKpiPoller.ts` worker runs on 10-minute cron
2. Polls Convoso API for call logs per active lead source
3. Enriches with tier-based metrics via `agentKpiAggregator.ts`
4. Persists `AgentCallKpi` snapshots to database
5. Dashboard reads KPIs via API endpoints

**Chargeback/Pending Term Flow:**
1. CS rep pastes raw data in `CSSubmissions.tsx`
2. API parses, creates `ChargebackSubmission` or `PendingTerm` records with batch ID
3. System auto-matches chargebacks to sales by member ID
4. Creates `PayrollAlert` records for payroll review
5. `emitCSChanged()` notifies connected clients
6. Payroll team resolves alerts, optionally creating `Clawback` entries

**Commission Calculation (Net Amount):**
- Formula: `payout + adjustment + bonus - fronted`
- `adjustmentAmount` allows negative values (for chargebacks deducting from current week)
- Enrollment fee logic: >= $125 adds $10 bonus; < $99 halves commission (unless approved)
- Bundle requirements check state availability of required/fallback addon products

## Key Abstractions

**PayrollPeriod:**
- Purpose: Weekly payroll bucket (Sunday-Saturday, Eastern time)
- Auto-created when a sale falls in an untracked week
- Statuses: OPEN -> LOCKED -> FINALIZED
- Examples: `prisma/schema.prisma` (PayrollPeriod model), `apps/ops-api/src/services/payroll.ts`

**asyncHandler:**
- Purpose: Wraps async Express route handlers to forward errors to global error handler
- Location: `apps/ops-api/src/routes/helpers.ts`
- Pattern: Every route handler uses `asyncHandler(async (req, res) => { ... })`

**authFetch:**
- Purpose: Browser-side fetch wrapper with auth token injection, 30s timeout, auto-refresh
- Location: `packages/auth/src/client.ts`
- Pattern: All dashboard API calls use `authFetch(url, opts)` instead of `fetch()`

**zodErr:**
- Purpose: Wraps Zod validation errors into `{ error, details }` format dashboards expect
- Location: `apps/ops-api/src/routes/helpers.ts`
- Pattern: All request validation uses `zodErr(parsed.error)` on failure

## Entry Points

**Morgan Voice Service:**
- Location: `index.js`
- Triggers: Convoso webhook, cron schedule
- Responsibilities: Queue management, outbound call dispatch via Vapi API

**Ops API:**
- Location: `apps/ops-api/src/index.ts`
- Triggers: HTTP requests, Socket.IO connections
- Responsibilities: REST API, real-time events, background KPI polling
- Mounts routes at `/api`, health check at `/health`

**Ops Dashboard:**
- Location: `apps/ops-dashboard/app/layout.tsx`
- Triggers: Browser navigation
- Responsibilities: Role-based tab navigation, auth flow, date range context

**Sales Board:**
- Location: `apps/sales-board/app/page.tsx`
- Triggers: Browser navigation
- Responsibilities: Public leaderboard display

## Error Handling

**Strategy:** Layered error handling with global catch-all

**Patterns:**
- Route handlers wrapped in `asyncHandler()` to catch unhandled promise rejections
- Global Express error handler in `apps/ops-api/src/index.ts` returns `{ error: message }` JSON
- Zod validation errors normalized via `zodErr()` helper
- `logAudit()` silently catches its own errors (audit never breaks the request)
- Client-side: `authFetch()` throws on timeout (30s AbortController), dashboards display `Request failed (${res.status})`

## Cross-Cutting Concerns

**Logging:**
- API: `@ops/utils` provides `logEvent()` and `logError()` (structured JSON to stdout/stderr)
- Morgan service: Custom logger with LOG_LEVEL support (error/warn/info/debug)
- Audit trail: `logAudit()` writes sensitive operations to `app_audit_log` table

**Validation:**
- Zod schemas in route handlers
- `.min(0)` on financial amounts, `.min(0).max(100)` on percentages
- Exception: `adjustmentAmount` allows negatives for chargebacks

**Authentication:**
- JWT via `@ops/auth` package (server-side sign/verify)
- `@ops/auth/client` for browser-side token management
- Cookie-based session with `AUTH_COOKIE_DOMAIN` for cross-subdomain sharing
- Middleware chain: `requireAuth` -> `requireRole(...roles)`

**Real-Time Updates:**
- Socket.IO server in `apps/ops-api/src/socket.ts`
- Client hook in `packages/socket/src/useSocket.ts`
- `SocketProvider` context in `apps/ops-dashboard/lib/SocketProvider.tsx`

---

*Architecture analysis: 2026-03-24*
