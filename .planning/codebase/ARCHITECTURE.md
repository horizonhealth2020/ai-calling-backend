# Architecture

**Analysis Date:** 2026-03-23

## Pattern Overview

**Overall:** Monorepo with two independent workloads — a legacy Node.js voice service at root and a multi-app Ops Platform under `apps/` and `packages/`.

**Key Characteristics:**
- The Ops Platform follows a layered REST + WebSocket architecture: Next.js frontends talk to a single Express API (`ops-api`) via `authFetch()`, and receive real-time updates via Socket.IO.
- All business logic lives exclusively in `apps/ops-api/src/services/`. Routes in `apps/ops-api/src/routes/index.ts` are a single flat file that imports from services and calls them inside `asyncHandler()` wrappers.
- Shared code (auth, db, types, UI, utils, socket) lives in `packages/` as `@ops/*` workspace packages, consumed by all apps via TypeScript path aliases.
- The legacy Morgan voice service (`index.js`, `voiceGateway.js`) is fully isolated from the Ops Platform — it shares no code and has its own `package.json` dependencies at root.

## Layers

**Legacy Voice Service (root):**
- Purpose: Convoso webhook receiver that triggers outbound AI calls via Vapi
- Location: `index.js`, `voiceGateway.js`, `morganToggle.js`, `rateLimitState.js`, `timeUtils.js`
- Contains: Express routes, Convoso/Vapi API calls, Morgan outbound queue logic, cron jobs
- Depends on: nothing in `apps/` or `packages/`
- Used by: Convoso webhooks (external)

**API Layer (`ops-api`):**
- Purpose: Single Express REST API serving all Ops Platform dashboards
- Location: `apps/ops-api/src/`
- Contains: Entry point, routes, middleware, services, workers, socket emitters
- Depends on: `@ops/auth`, `@ops/db`, `@ops/types`, `@ops/utils`
- Used by: All frontend apps (`ops-dashboard`, `sales-board`)

**Frontend Apps:**
- Purpose: Role-gated Next.js dashboards (Manager, Payroll, Owner, CS) and a public sales board
- Location: `apps/ops-dashboard/`, `apps/sales-board/`
- Contains: Next.js App Router pages, tab-based sub-views, Next.js API routes (login proxy), context providers
- Depends on: `@ops/auth/client`, `@ops/ui`, `@ops/types`, `@ops/utils`, `@ops/socket`
- Used by: End users via browser

**Shared Packages:**
- Purpose: Reusable logic and components shared across all apps
- Location: `packages/auth/`, `packages/db/`, `packages/types/`, `packages/ui/`, `packages/utils/`, `packages/socket/`
- Contains: JWT signing/verification, Prisma client singleton, role types, design system components, logging helpers, Socket.IO hook
- Depends on: nothing in `apps/`
- Used by: both `ops-api` and all frontends

## Data Flow

**Authentication Flow:**

1. User submits credentials on `ops-dashboard` login page (`apps/ops-dashboard/app/page.tsx`)
2. Form POSTs to Next.js API route `/api/login` (`apps/ops-dashboard/app/api/login/route.ts`)
3. Route proxies request to `ops-api` at `POST /api/auth/login`
4. `ops-api` verifies password with bcrypt, calls `signSessionToken()` from `@ops/auth`, returns `{ token, roles }`
5. Login route builds redirect URL with `?session_token=<jwt>` and returns it to the browser
6. Browser navigates to dashboard path (e.g., `/manager?session_token=<jwt>`)
7. Next.js middleware (`apps/ops-dashboard/middleware.ts`) intercepts, verifies token via `@ops/auth`, sets `ops_session` cookie, allows through
8. Client-side `captureTokenFromUrl()` strips token from URL and stores it in `localStorage` as `ops_session_token`

**Sales API Request Flow:**

1. Dashboard component calls `authFetch(url, opts)` from `@ops/auth/client`
2. `authFetch` injects `Authorization: Bearer <token>` header; checks token freshness and auto-refreshes if within 15 minutes of expiry
3. Request hits `ops-api` at `apps/ops-api/src/routes/index.ts` handler
4. `requireAuth` middleware (`apps/ops-api/src/middleware/auth.ts`) verifies Bearer token or cookie
5. `requireRole(...roles)` checks role — SUPER_ADMIN bypasses all checks
6. Route handler calls the relevant service function (e.g., `upsertPayrollEntryForSale()`)
7. Service interacts with PostgreSQL via Prisma (`@ops/db`)
8. Sensitive operations call `logAudit()` → writes to `app_audit_log` table
9. After mutation, `emitSaleChanged()` (or related emit) broadcasts via Socket.IO to all connected dashboards

**Real-time Update Flow:**

1. `ops-api` mutates data and calls an emit helper in `apps/ops-api/src/socket.ts`
2. Socket.IO server broadcasts the event (e.g., `sale:changed`, `cs:changed`, `alert:created`) to all clients
3. `ops-dashboard` uses `SocketProvider` context (`apps/ops-dashboard/lib/SocketProvider.tsx`) — wraps the entire dashboard layout
4. `sales-board` uses `useSocket` hook from `@ops/socket` (`packages/socket/src/useSocket.ts`)
5. Dashboard components receive the event payload and update local React state directly — no full refetch

**Background Polling Flow (Convoso KPI):**

1. `startConvosoKpiPoller()` is called at server boot in `apps/ops-api/src/index.ts`
2. Every 10 minutes, `runPollCycle()` fetches all active lead sources from Prisma
3. For each lead source, calls Convoso API via `fetchConvosoCallLogs()` in `apps/ops-api/src/services/convosoCallLogs.ts`
4. New call IDs are deduplicated against `ProcessedConvosoCall` table
5. KPI summaries are computed via `buildKpiSummary()` and persisted to `AgentCallKpi` table
6. Processed call IDs are recorded; records older than 30 days are pruned

**State Management:**

- Server state: All authoritative data in PostgreSQL accessed via Prisma
- Real-time state: Socket.IO events push mutation payloads to clients; clients merge into local React `useState`
- Date range state: `DateRangeProvider` context (`apps/ops-dashboard/lib/DateRangeContext.tsx`) provides a shared filter value across all tabs in a dashboard session
- Auth token: Stored in `localStorage` under key `ops_session_token`; also mirrored as `ops_session` HttpOnly cookie for server-side middleware access

## Key Abstractions

**`asyncHandler`:**
- Purpose: Wraps every async Express route handler so promise rejections forward to the global error handler
- Examples: `apps/ops-api/src/routes/index.ts` (defined inline, used on every route)
- Pattern: `router.post("/path", asyncHandler(async (req, res) => { ... }))`

**`requireAuth` + `requireRole`:**
- Purpose: Express middleware chain that validates JWT and enforces RBAC
- Examples: `apps/ops-api/src/middleware/auth.ts`
- Pattern: Applied as `requireAuth, requireRole("MANAGER", "PAYROLL")` before route handlers; SUPER_ADMIN bypasses `requireRole`

**`authFetch`:**
- Purpose: Browser-side fetch wrapper that auto-injects Bearer token, handles 30s timeout, and auto-refreshes tokens near expiry
- Examples: `packages/auth/src/client.ts`
- Pattern: All dashboard API calls use `authFetch(url, opts)` instead of raw `fetch`

**`zodErr`:**
- Purpose: Normalizes Zod validation errors into `{ error: string, details: object }` so all dashboards can display `err.error`
- Examples: `apps/ops-api/src/routes/index.ts` (defined inline)
- Pattern: `const parsed = schema.safeParse(req.body); if (!parsed.success) return res.status(400).json(zodErr(parsed.error));`

**`upsertPayrollEntryForSale`:**
- Purpose: Core commission engine — auto-creates or updates a `PayrollEntry` record whenever a sale is created/edited
- Examples: `apps/ops-api/src/services/payroll.ts`
- Pattern: Called by route handlers after any sale mutation; handles week range, commission calculation, enrollment fees, and bonuses

**`logAudit`:**
- Purpose: Fire-and-forget audit trail — writes actor, action, entity, and metadata to `app_audit_log`; never throws
- Examples: `apps/ops-api/src/services/audit.ts`
- Pattern: `await logAudit(req.user.id, "CREATE", "Sale", sale.id, { ... })`

**`@ops/ui` Design Tokens:**
- Purpose: Single source of truth for colors, spacing, radius, typography, shadows — all CSS custom properties from `theme.css`
- Examples: `packages/ui/src/tokens.ts`
- Pattern: Import `{ colors, spacing, radius }` from `@ops/ui` and use in inline `React.CSSProperties` style objects

## Entry Points

**ops-api Server:**
- Location: `apps/ops-api/src/index.ts`
- Triggers: `npm run ops:dev` or `node dist/index.js` in production
- Responsibilities: Creates Express app, attaches CORS/cookie middleware, mounts `/api` routes, creates HTTP server, attaches Socket.IO, starts Convoso KPI poller

**ops-dashboard Next.js App:**
- Location: `apps/ops-dashboard/app/layout.tsx` (root), `apps/ops-dashboard/app/page.tsx` (login)
- Triggers: `npm run dashboard:dev` or `next start`
- Responsibilities: Root layout wraps everything in theme; login page handles credential submission and token capture; `(dashboard)/layout.tsx` wraps authenticated views with `SocketProvider` and `DateRangeProvider`

**Next.js Middleware (ops-dashboard):**
- Location: `apps/ops-dashboard/middleware.ts`
- Triggers: Every request matching `/manager/*`, `/payroll/*`, `/owner/*`, `/cs/*`
- Responsibilities: Verifies JWT from cookie/header/URL param, enforces role-based route access, sets session cookie when token arrives via URL

**sales-board Next.js App:**
- Location: `apps/sales-board/app/page.tsx`
- Triggers: `npm run salesboard:dev` or `next start`
- Responsibilities: Public leaderboard, no auth required; connects to Socket.IO for live sale updates

**Morgan Voice Service:**
- Location: `index.js`
- Triggers: `npm start` (root package)
- Responsibilities: Receives Convoso webhooks, queues outbound Vapi calls, enforces concurrent call limits, runs cron-based cleanup

## Error Handling

**Strategy:** Errors propagate upward to a central Express error handler in `ops-api`. Frontends always check `err.error` from the response body. Status codes are surfaced verbatim.

**Patterns:**
- All async route handlers wrapped in `asyncHandler()` — no try/catch in routes
- Global error handler in `apps/ops-api/src/index.ts` catches all forwarded errors, responds with `{ error: message }` and appropriate HTTP status
- Zod validation errors go through `zodErr()` — always produce `{ error: string, details: {...} }`
- `logAudit()` catches its own failures silently — audit logging never breaks a request
- Frontend fallback: `` `Request failed (${res.status})` `` used as the catch-all error display string

## Cross-Cutting Concerns

**Logging:** Structured JSON via `logEvent` / `logError` from `@ops/utils` (`packages/utils/src/index.ts`). Workers use `console.log(JSON.stringify({event, ...}))` directly. All log records include `ts: new Date().toISOString()`.

**Validation:** Zod schemas defined inline in `apps/ops-api/src/routes/index.ts`. Financial amounts use `.min(0)` except `adjustmentAmount` which allows negatives. Percentages use `.min(0).max(100)`. All errors normalized via `zodErr()`.

**Authentication:** JWT signed with `AUTH_JWT_SECRET` (12h expiry). Accepted via `Authorization: Bearer`, `ops_session` HttpOnly cookie, or `?session_token` URL param. Server package (`@ops/auth`) handles signing/verification. Client package (`@ops/auth/client`) handles storage, injection, and auto-refresh.

---

*Architecture analysis: 2026-03-23*
