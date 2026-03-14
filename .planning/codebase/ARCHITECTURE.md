# Architecture

**Analysis Date:** 2026-03-14

## Pattern Overview

**Overall:** Monorepo with two independent workloads: legacy Morgan voice service (Node.js/Express) at root, and modern Ops Platform (Next.js + Express microservices) under `apps/` and `packages/`. The Ops Platform follows a backend-for-frontend (BFF) pattern with a centralized Express API (`ops-api`) serving 5 role-based Next.js frontends through shared packages.

**Key Characteristics:**
- Monorepo workspace structure with npm workspaces (`apps/*`, `packages/*`)
- Backend API as Express.js microservice (`ops-api` on port 8080)
- Frontend as Next.js v15 apps using `transpilePackages` for shared imports
- Shared business logic in `@ops/*` packages (auth, db, types, ui, utils)
- Real-time sync via Socket.IO from `ops-api` to dashboards
- PostgreSQL with Prisma ORM and migrations
- JWT-based authentication with role-based access control (RBAC)

## Layers

**Morgan Voice Service (Legacy):**
- Purpose: AI calling system with Convoso/Vapi integration, queue management, rate limiting
- Location: `/index.js`, supporting modules in root (e.g., `voiceGateway.js`, `morganToggle.js`, `timeUtils.js`)
- Contains: Express webhook handlers, Vapi SDK calls, queue processors, outbound call logic
- Depends on: Convoso API, Vapi API, node-cron for job scheduling
- Used by: External Convoso webhooks

**Ops API (Express Backend):**
- Purpose: REST API for all operational dashboards — authentication, RBAC, sales, payroll, audits, clawbacks, exports
- Location: `apps/ops-api/src/`
- Contains: Route handlers (`routes/index.ts`), middleware (`middleware/auth.ts`), domain services (`services/payroll.ts`, `services/audit.ts`), Socket.IO setup
- Depends on: `@ops/auth`, `@ops/db`, `@ops/types`, Prisma, bcryptjs, Zod validation
- Used by: All 5 Next.js dashboards via HTTP and Socket.IO

**Auth Portal (Next.js Frontend):**
- Purpose: Login gateway with role-based dashboard redirects
- Location: `apps/auth-portal/app/`
- Contains: Login form, password change UI, redirect logic, API routes (`api/login`, `api/verify`, `api/change-password`)
- Depends on: `@ops/ui`, `@ops/auth/client`, ops-api
- Entry point: `app/page.tsx` (login form), `app/landing/page.tsx` (redirect logic)

**Manager Dashboard (Next.js Frontend):**
- Purpose: Sales entry, agent tracker, call audits, configuration management
- Location: `apps/manager-dashboard/app/`
- Contains: Role-based pages for MANAGER and ADMIN roles
- Depends on: `@ops/ui`, `@ops/auth/client`, ops-api
- Used by: Managers and admins

**Payroll Dashboard (Next.js Frontend):**
- Purpose: Payroll period management, commission approval, service staff, clawbacks, exports
- Location: `apps/payroll-dashboard/app/`
- Contains: Pages for payroll entry, clawback workflow
- Depends on: `@ops/ui`, `@ops/auth/client`, ops-api
- Used by: Payroll staff

**Owner Dashboard (Next.js Frontend):**
- Purpose: KPI summary and operational overview
- Location: `apps/owner-dashboard/app/`
- Contains: Read-only stats and charts (no data mutations)
- Depends on: `@ops/ui`, `@ops/auth/client`, ops-api
- Used by: Owners and executives

**Sales Board (Next.js Frontend):**
- Purpose: Public read-only sales leaderboard
- Location: `apps/sales-board/app/`
- Contains: Leaderboard display, no authentication required for board endpoints
- Depends on: `@ops/ui`, ops-api
- Used by: Public or internal reference

**Shared Packages:**
- **`@ops/auth`** (`packages/auth/src/index.ts`): Server-side JWT signing/verification, session cookie builders
- **`@ops/auth/client`** (`packages/auth/src/client.ts`): Browser-side auth client — token capture, auto-refresh, Bearer injection
- **`@ops/db`** (`packages/db/src/client.ts`): Prisma singleton client
- **`@ops/types`** (`packages/types/src/index.ts`): TypeScript types for AppRole enum and SessionUser
- **`@ops/ui`** (`packages/ui/src/`): React components and design tokens — dark glassmorphism theme, inline CSSProperties
- **`@ops/utils`** (`packages/utils/src/index.ts`): Structured JSON logging (`logEvent`, `logError`)

## Data Flow

**Authentication Flow:**

1. User submits email/password on auth-portal login page (`apps/auth-portal/app/page.tsx`)
2. Form posts to `POST /api/login` (Next.js route handler in `apps/auth-portal/app/api/login/route.ts`)
3. Route handler calls ops-api `POST /api/auth/login` with credentials
4. ops-api (`apps/ops-api/src/routes/index.ts`) validates password via bcrypt against User model
5. ops-api returns JWT token; auth-portal sets `ops_session` cookie (httpOnly)
6. Auth-portal redirects to appropriate dashboard based on user roles (via `app/landing/page.tsx` logic)
7. Dashboard makes authenticated requests via `authFetch()` client utility which injects `Authorization: Bearer <token>` header
8. Token stored in localStorage as `ops_session_token` for manual Bearer header injection
9. Client auto-refreshes token via `GET /api/auth/refresh` when within 15min of expiry

**Request Path (Example: Add Sale):**

1. Manager fills form on manager-dashboard
2. Dashboard calls `authFetch('POST', '/api/sales', { agentId, premium, ... })`
3. ops-api middleware (`requireAuth` → `requireRole('MANAGER', ...)`) validates session and role
4. Route handler validates input via Zod schema, returns `{ error: "msg" }` if invalid
5. Handler calls `upsertPayrollEntryForSale()` service to calculate commission and create/update PayrollEntry
6. ops-api emits Socket.IO event to broadcast updated data to all connected dashboards
7. Dashboard receives event via Socket.IO and updates local state
8. Handler returns response; dashboard displays via modal or page update

**Payroll Calculation Flow:**

1. Sale submitted and approved (status = APPROVED)
2. `apps/ops-api/src/services/payroll.ts` → `upsertPayrollEntryForSale()` is called
3. Determines week range (Sunday-Saturday UTC) via `getSundayWeekRange()`
4. Calculates commission: product type (CORE/AD_D/ADDON) → tiered rates based on premium and enrollment fee
5. Applies enrollment fee bonus rules ($125 → +$10, $99 → $0, <threshold → halve unless approved)
6. Updates or creates PayrollEntry with status PENDING
7. Payroll staff reviews in payroll-dashboard, approves (status = READY)
8. Finance finalizes PayrollPeriod (status = FINALIZED)
9. Clawbacks or chargebacks can deduct from current week via `adjustmentAmount` field (negative values)

**State Management:**

- No client-side state management library (Redux/Zustand). Each dashboard page manages local state via React `useState`
- Socket.IO broadcasts data mutations from ops-api to all connected clients in real-time
- Data sourced from Prisma query results serialized to JSON from ops-api responses
- Token refresh happens transparently via `authFetch()` which handles 401 responses and retries

## Key Abstractions

**Request Handler Pattern:**
- Purpose: Standardize async error handling and validation
- Pattern: `asyncHandler()` wrapper catches promise rejections; `zodErr()` formats Zod validation errors to include `error` key
- Location: `apps/ops-api/src/routes/index.ts` lines 14-25
- Example: `router.post("/auth/login", asyncHandler(async (req, res) => { ... }))`

**Middleware Chain:**
- Purpose: Verify identity and enforce role-based access control
- Pattern: `requireAuth` extracts token from Bearer header or cookie, verifies JWT, attaches `req.user`; `requireRole(...)` checks if user has required role (SUPER_ADMIN bypasses all checks)
- Location: `apps/ops-api/src/middleware/auth.ts`
- Usage: `router.get("/api/sales", requireAuth, requireRole("MANAGER"), handler)`

**Auth Token Transport:**
- Purpose: Enable same-origin and cross-origin authenticated requests
- Pattern: JWT stored in both httpOnly cookie (from login response) and localStorage (from URL param on redirect); client injects `Authorization: Bearer` header via `authFetch()`
- Location: `apps/auth-portal/app/api/login/route.ts` (set cookie), `@ops/auth/client.ts` (Bearer injection, auto-refresh)

**Payroll Service:**
- Purpose: Centralize complex commission calculation and payroll entry creation
- Pattern: `upsertPayrollEntryForSale()` accepts sale with products/addons, applies tiered rules, returns PayrollEntry
- Location: `apps/ops-api/src/services/payroll.ts`
- Rules: CORE (threshold-based rate), AD_D (70% bundled, 35% standalone), ADDON (0% bundled, 30% standalone), enrollment fee bonuses/halving

**Audit Service:**
- Purpose: Log sensitive operations (role changes, commission adjustments, password changes, clawbacks) to `app_audit_log` table
- Pattern: `logAudit(userId, action, entityType, entityId)` enqueues async write
- Location: `apps/ops-api/src/services/audit.ts`, `apps/ops-api/src/services/auditQueue.ts`

**Style Token System:**
- Purpose: Enforce consistent dark glassmorphism theme across all frontends without CSS files
- Pattern: Constant style objects (`const BG: React.CSSProperties = { ... }`) using tokens from `@ops/ui/tokens.ts` — `colors`, `spacing`, `radius`, `shadows`, `typography`, `motion`
- Location: Every page in all dashboards (e.g., `apps/auth-portal/app/page.tsx` lines 16-201)

## Entry Points

**Morgan Voice Service:**
- Location: `/index.js`
- Triggers: npm start (root monorepo); listens for Convoso webhooks at `/webhook/convoso`
- Responsibilities: Queue management, outbound call dispatch, rate limiting, Vapi integration

**Ops API:**
- Location: `apps/ops-api/src/index.ts`
- Triggers: npm run ops:dev (dev) or npm run start (production with migrations)
- Responsibilities: Validate environment (DATABASE_URL, AUTH_JWT_SECRET), start Express + Socket.IO on port 8080, register routes, error handling

**Auth Portal:**
- Location: `apps/auth-portal/app/page.tsx` (login form) and `app/landing/page.tsx` (redirect logic)
- Triggers: npm run auth:dev; browser navigates to localhost:3011
- Responsibilities: Accept credentials, verify with ops-api, set session cookie, redirect to appropriate dashboard

**Manager Dashboard:**
- Location: `apps/manager-dashboard/app/page.tsx`
- Triggers: npm run manager:dev; browser navigates to localhost:3019
- Responsibilities: Render role-gated pages for MANAGER/ADMIN roles

**Payroll Dashboard:**
- Location: `apps/payroll-dashboard/app/page.tsx`
- Triggers: npm run payroll:dev; browser navigates to localhost:3012
- Responsibilities: Render payroll UI for PAYROLL/ADMIN/SERVICE roles

**Owner Dashboard:**
- Location: `apps/owner-dashboard/app/page.tsx`
- Triggers: npm run owner:dev; browser navigates to localhost:3026
- Responsibilities: Render KPI dashboard for OWNER_VIEW role

**Sales Board:**
- Location: `apps/sales-board/app/page.tsx`
- Triggers: npm run salesboard:dev; browser navigates to localhost:3013
- Responsibilities: Render public leaderboard (no authentication required)

## Error Handling

**Strategy:** Express global error handler forwards all async errors to centralized handler. Client dashboards check response status and error field.

**Patterns:**
- Async route errors caught by `asyncHandler()` and forwarded to next handler → `app.use((err, req, res, next) => { ... })` returns 500 with "Internal server error"
- Validation errors caught by Zod, formatted via `zodErr()` to return `{ error: "message", details: {...} }`
- Middleware errors (auth, role check) return explicit 401/403 status codes
- Dashboard error handlers display response status code in message: `` `Request failed (${res.status})` `` (not generic "Failed" strings)

## Cross-Cutting Concerns

**Logging:** Structured JSON via `@ops/utils` — `logEvent(event, payload)` and `logError(event, payload)` output ISO timestamps and structured fields. Morgan service uses custom logger with LOG_LEVEL env var.

**Validation:** Zod schemas in ops-api routes enforce type safety and message consistency. No loose validation; all Zod errors wrapped via `zodErr()` helper. Financial amounts use `.min(0)`, commission percentages use `.min(0).max(100)`, exception: `adjustmentAmount` allows negative (chargebacks).

**Authentication:** JWT-based with 12h token expiry. Server issues token via `signSessionToken()` after password validation. Client stores in localStorage and httpOnly cookie. Middleware verifies token from Bearer header or cookie. SUPER_ADMIN role bypasses all role checks.

**Authorization:** Role-based access control via `requireRole(...roles)` middleware. 6 roles: SUPER_ADMIN, OWNER_VIEW, MANAGER, PAYROLL, SERVICE, ADMIN. Stored as array in User.roles, compared against required roles in middleware.

---

*Architecture analysis: 2026-03-14*
