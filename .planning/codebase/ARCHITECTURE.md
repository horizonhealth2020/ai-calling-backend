# Architecture

**Analysis Date:** 2026-03-17

## Pattern Overview

**Overall:** Dual-workload monorepo — a legacy AI calling service at the root plus a modern multi-app Ops Platform under `apps/` and `packages/`.

**Key Characteristics:**
- The Ops Platform follows a thin-route, service-layer backend pattern: all business logic lives in `apps/ops-api/src/services/`, with `apps/ops-api/src/routes/index.ts` acting as the sole routing surface
- Frontend apps are role-gated Next.js 15 dashboards that talk exclusively to `ops-api` via `authFetch()` from `@ops/auth/client`
- Shared code is distributed through internal npm workspace packages (`@ops/*`) — no code duplication across apps
- Real-time updates flow from ops-api to dashboards over Socket.IO; `sale:changed`, `audit_status`, and `new_audit` events are the main channels

## Layers

**Shared Packages Layer:**
- Purpose: Provide types, auth utilities, database client, UI tokens, and socket hooks consumed by every app
- Location: `packages/`
- Contains: `@ops/auth` (JWT signing/cookie), `@ops/auth/client` (browser token management), `@ops/db` (Prisma singleton), `@ops/types` (AppRole, SessionUser), `@ops/ui` (design tokens, PageShell), `@ops/utils` (logEvent, logError), `@ops/socket` (useSocket hook, SaleChangedPayload types)
- Depends on: External libraries (jsonwebtoken, prisma, socket.io-client)
- Used by: All apps in `apps/`

**API Layer (ops-api):**
- Purpose: Single Express REST API serving all dashboards; handles auth, RBAC, all CRUD, payroll calculation, audit queue, and Convoso KPI polling
- Location: `apps/ops-api/src/`
- Contains: `index.ts` (entry, Express bootstrap, Socket.IO init, cron start), `routes/index.ts` (flat route file — all endpoints), `middleware/auth.ts` (requireAuth, requireRole), `services/` (payroll, audit, callAudit, auditQueue, reporting, convosoCallLogs), `socket.ts` (io singleton + emit helpers), `workers/convosoKpiPoller.ts` (10-min cron)
- Depends on: `@ops/db`, `@ops/auth`, `@ops/types`, Zod, bcryptjs, Anthropic SDK, OpenAI SDK
- Used by: All Next.js dashboard apps and the auth-portal

**Auth Portal Layer:**
- Purpose: Single login UX; proxies credentials to ops-api, receives JWT token, appends it to redirect URL for dashboard apps to capture
- Location: `apps/auth-portal/`
- Contains: `app/api/login/route.ts` (Next.js API route — proxies to ops-api), `app/landing/page.tsx` (role-based dashboard picker), `app/api/verify/`, `app/api/change-password/`
- Depends on: `@ops/auth/client`, `@ops/ui`
- Used by: End users; redirects them out to role-appropriate dashboard

**Dashboard Apps Layer:**
- Purpose: Role-specific single-page dashboards; all read/write through `authFetch()` calls to ops-api
- Location: `apps/manager-dashboard/`, `apps/payroll-dashboard/`, `apps/owner-dashboard/`, `apps/sales-board/`
- Contains: Each has `app/layout.tsx`, `app/page.tsx`, `app/error.tsx`, `app/not-found.tsx`; manager-dashboard is the most complex (sales entry, agent tracker, call audits)
- Depends on: `@ops/auth/client`, `@ops/ui`, `@ops/socket`, `@ops/types`
- Used by: Authenticated users per their assigned roles

**Legacy Voice Service Layer:**
- Purpose: AI outbound calling system (Morgan); receives Convoso webhooks, triggers Vapi calls via voiceGateway
- Location: Root — `index.js`, `voiceGateway.js`, `morganToggle.js`, `timeUtils.js`, `rateLimitState.js`
- Contains: Express server with Morgan queue (max 3 concurrent), business-hours guard, cron scheduling, Vapi 429 backoff
- Depends on: node-fetch, axios, node-cron, express (CommonJS, not TypeScript)
- Used by: Convoso webhook callbacks (inbound HTTP); fully independent of Ops Platform

## Data Flow

**Login and Token Delivery:**
1. User submits credentials on auth-portal login page
2. `app/api/login/route.ts` (Next.js API route) forwards POST to `ops-api /api/auth/login`
3. ops-api validates credentials, signs 12h JWT via `@ops/auth`, sets httpOnly session cookie, returns token in JSON body
4. auth-portal appends `?session_token=<token>&roles=<roles>` to redirect URL pointing to `app/landing`
5. Landing page calls `captureTokenFromUrl()` from `@ops/auth/client` — stores token in localStorage, strips it from URL
6. User selects a dashboard; landing page opens it in a new tab with `?session_token=<token>` appended
7. Dashboard's first render calls `captureTokenFromUrl()` and stores the token

**Authenticated API Request:**
1. Dashboard component calls `authFetch(url, opts)` from `@ops/auth/client`
2. `authFetch` checks token expiry; if within 15 min of expiry, silently refreshes via `GET /api/auth/refresh`
3. Bearer token injected into `Authorization` header; 30s timeout via AbortController
4. ops-api `requireAuth` middleware extracts token from header (or cookie fallback), calls `verifySessionToken`
5. If role check needed, `requireRole(...roles)` runs next — SUPER_ADMIN bypasses all checks
6. Handler executes, calls Prisma, returns JSON

**Sale Creation and Payroll Update:**
1. Manager POSTs to `POST /api/sales`
2. Route handler validates with Zod, creates Sale record in Prisma
3. Calls `upsertPayrollEntryForSale()` from `services/payroll.ts` — computes commission, creates/updates PayrollEntry for the relevant Sunday week
4. Calls `logAudit()` from `services/audit.ts` — writes to `app_audit_log`
5. Calls `emitSaleChanged()` from `socket.ts` — broadcasts `sale:changed` event over Socket.IO to all connected dashboard clients

**Call Audit Flow:**
1. Route handler enqueues job via `enqueueAuditJob(callLogId)` from `services/auditQueue.ts`
2. Queue manages max 3 concurrent jobs; emits `processing_started` via Socket.IO
3. `services/callAudit.ts` fetches recording, sends transcript to Anthropic Claude (structured tool call), optionally cross-checks with OpenAI
4. On completion, persists CallAudit record and emits `new_audit` via Socket.IO

**Convoso KPI Polling:**
1. On server start, `startConvosoKpiPoller()` is called from `workers/convosoKpiPoller.ts`
2. Runs on a 10-minute cron; disabled silently when `CONVOSO_AUTH_TOKEN` is not set
3. For each active lead source with a `listId`, calls Convoso API via `services/convosoCallLogs.ts`
4. Enriches call logs with tiers, builds per-agent KPI summaries, upserts `AgentCallKpi` rows

**State Management:**
- Server state is authoritative (Postgres via Prisma); dashboards are stateless between page loads
- Real-time state propagation uses Socket.IO broadcasts from ops-api — clients listen with `useSocket` hook from `@ops/socket`
- Client auth state lives in `localStorage` under key `ops_session_token`

## Key Abstractions

**asyncHandler:**
- Purpose: Wraps every async Express route handler to forward thrown errors to the global error handler
- Examples: `apps/ops-api/src/routes/index.ts` line 27
- Pattern: `(fn) => (req, res, next) => fn(req, res, next).catch(next)`

**zodErr:**
- Purpose: Normalizes Zod validation errors so every error response always has an `error` key that dashboards can display
- Examples: `apps/ops-api/src/routes/index.ts` line 18
- Pattern: Returns `{ error: string, details: ZodFlattenedError }`

**upsertPayrollEntryForSale:**
- Purpose: Single function that calculates commission and idempotently creates or updates the PayrollEntry for a sale's week; called on every sale create/edit
- Examples: `apps/ops-api/src/services/payroll.ts`
- Pattern: Accepts a SaleWithProduct, computes commission via `calculateCommission()`, upserts by `(agentId, periodId)` composite

**logAudit:**
- Purpose: Fire-and-forget audit trail writer; never throws so it never breaks the calling request
- Examples: `apps/ops-api/src/services/audit.ts`
- Pattern: Silent catch — logs console error on failure, swallows the exception

**requireAuth / requireRole:**
- Purpose: Express middleware chain enforcing authentication then role-based access; SUPER_ADMIN bypasses role checks
- Examples: `apps/ops-api/src/middleware/auth.ts`
- Pattern: Token from `Authorization: Bearer` header, falls back to `ops_session` cookie

**authFetch:**
- Purpose: Drop-in replacement for browser `fetch` that injects Bearer token, handles 30s timeout, and auto-refreshes near-expiry tokens
- Examples: `packages/auth/src/client.ts`
- Pattern: Deduplicated concurrent refresh via a module-level promise

## Entry Points

**ops-api:**
- Location: `apps/ops-api/src/index.ts`
- Triggers: `npm run ops:dev` or `node dist/index.js` in production
- Responsibilities: Validates required env vars (fails fast), mounts Express middleware (json, cookieParser, CORS), registers `/api` routes, creates HTTP server, attaches Socket.IO, starts Convoso KPI poller cron

**All Next.js apps:**
- Location: `apps/{app-name}/app/layout.tsx` and `apps/{app-name}/app/page.tsx`
- Triggers: `next dev` or `next start`
- Responsibilities: Each app is independently deployable; layout sets up font/theme; page renders the dashboard UI and calls `captureTokenFromUrl()` on mount

**Legacy Morgan service:**
- Location: `index.js`
- Triggers: `npm start` (root package.json)
- Responsibilities: Starts Express on port from env, registers Convoso webhook endpoint, manages Morgan outbound call queue with 3 concurrent slots and per-phone-number-id slot tracking

## Error Handling

**Strategy:** Centralized — async errors propagate to a single Express error handler registered in `apps/ops-api/src/index.ts`

**Patterns:**
- All route handlers use `asyncHandler()` wrapper — uncaught errors reach the global handler automatically
- Global handler reads `err.statusCode` or `err.status` (defaults to 500), exposes `err.message` only when `err.expose` is truthy
- Zod validation failures return 400 with `zodErr()` output (never raw Zod structure)
- Prisma unique constraint violations (`P2002`) caught inline and returned as 409 with descriptive `error` key
- `logAudit()` is wrapped in try/catch and never propagates — audit failure is logged but does not break the request
- Frontend `authFetch()` re-throws AbortError as "Request timed out after 30 seconds" for display

## Cross-Cutting Concerns

**Logging:**
- ops-api: `console.error` for unhandled errors; `@ops/utils` exports `logEvent` and `logError` for structured JSON logging in services
- Legacy Morgan: Custom leveled logger using LOG_LEVEL env var (`error`, `warn`, `info`, `debug`)
- Audit trail: All sensitive mutations call `logAudit()` → `app_audit_log` table

**Validation:**
- All API request bodies parsed with inline Zod schemas immediately inside route handlers
- Financial amounts: `.min(0)` on all except `adjustmentAmount` (allows negatives for chargebacks)
- Commission percentages: `.min(0).max(100)`
- All Zod errors normalized through `zodErr()` before sending response

**Authentication:**
- JWT (12h expiry) signed with `AUTH_JWT_SECRET` via `@ops/auth`
- Delivered via URL param on redirect, stored in localStorage as `ops_session_token`
- Also set as httpOnly cookie `ops_session` for server-to-server scenarios
- Cookie domain shared across subdomains via `AUTH_COOKIE_DOMAIN` env var

---

*Architecture analysis: 2026-03-17*
