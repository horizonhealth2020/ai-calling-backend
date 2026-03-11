# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install (from monorepo root — required for workspace:* links)
npm install

# Dev servers (each in separate terminal)
npm run ops:dev          # ops-api         → localhost:8080
npm run auth:dev         # auth-portal     → localhost:3011
npm run payroll:dev      # payroll-dashboard → localhost:3012
npm run salesboard:dev   # sales-board     → localhost:3013
npm run manager:dev      # manager-dashboard → localhost:3019
npm run owner:dev        # owner-dashboard → localhost:3026

# Database
npm run db:migrate       # prisma migrate deploy
npm run db:seed          # runs prisma/seed.ts (default password: ChangeMe123!)

# Tests (Jest — covers root Morgan service only)
npm test                         # run all
npm test -- helpers.test.js      # single file
npm test -- -t "test name"       # by name
npm run test:watch               # watch mode
npm run test:coverage            # with coverage

# Docker (full stack)
docker-compose up                # postgres + ops-api + all 5 frontends
```

## Architecture

This monorepo contains **two independent workloads**:

1. **Morgan voice service** — legacy AI calling system at repo root (`index.js`). Has its own dependencies and should remain independently deployable.
2. **Ops Platform** — sales operations suite under `apps/` and `packages/`.

### Apps

| App | Port | Purpose |
|-----|------|---------|
| `ops-api` | 8080 | Express.js REST API — auth, RBAC, sales, payroll, clawbacks, exports |
| `auth-portal` | 3011 | Login UX + role-based redirect to dashboards |
| `payroll-dashboard` | 3012 | Payroll periods, commission approval, service staff, clawbacks, exports |
| `sales-board` | 3013 | Read-only sales leaderboard (no auth required for board endpoints) |
| `manager-dashboard` | 3019 | Sales entry, agent tracker, call audits, config management |
| `owner-dashboard` | 3026 | KPI summary and operational overview |

All Next.js apps are v15 and use `transpilePackages` for shared `@ops/*` imports.

### Shared Packages (`packages/`)

- **@ops/auth** (`packages/auth/src/index.ts`) — Server-side JWT signing/verification, session cookie builders. Uses `AUTH_JWT_SECRET` env, 12h token expiry.
- **@ops/auth/client** (`packages/auth/src/client.ts`) — Browser-side auth: `captureTokenFromUrl()`, `authFetch()` (injects Bearer header, 30s timeout), auto-refresh when token is within 15min of expiry. Token stored in localStorage as `ops_session_token`.
- **@ops/db** — Prisma client singleton.
- **@ops/types** — `AppRole` enum (`SUPER_ADMIN`, `OWNER_VIEW`, `MANAGER`, `PAYROLL`, `SERVICE`, `ADMIN`), `SessionUser` type.
- **@ops/ui** — `PageShell` component with shared dark theme styling.
- **@ops/utils** — Structured JSON logging (`logEvent`, `logError`).

Path aliases are defined in `tsconfig.base.json` (e.g., `@ops/db` → `packages/db/src`).

## Auth & RBAC

- JWT passed via URL `session_token` param on redirect, then stored in localStorage.
- API calls use `authFetch()` which sets `Authorization: Bearer <token>`.
- Server middleware: `requireAuth` (validates token from header or cookie) → `requireRole(...roles)`.
- **SUPER_ADMIN bypasses all role checks** — this is intentional behavior in `apps/ops-api/src/middleware/auth.ts`.
- Cookie domain set via `AUTH_COOKIE_DOMAIN` env for cross-subdomain session sharing.

## Styling

All UI uses **inline React.CSSProperties** — no Tailwind, no globals.css. The design is a dark glassmorphism theme with gradient accents. When modifying UI, follow the existing pattern of constant objects (e.g., `const INP: React.CSSProperties = { ... }`, `const CARD`, `const BTN`).

## API Conventions (ops-api)

- Routes in `apps/ops-api/src/routes/index.ts`, single flat file.
- All async handlers wrapped with `asyncHandler()` to forward errors.
- Request validation via Zod schemas (`.min(0)` on financial amounts, `.min(0).max(100)` on commission percentages). **Exception:** `adjustmentAmount` allows negative values (chargebacks). All Zod errors are wrapped via `zodErr()` helper so responses always include an `error` key that dashboards can display.
- Sensitive operations call `logAudit()` from `apps/ops-api/src/services/audit.ts` → writes to `app_audit_log` table.
- Commission calculation in `apps/ops-api/src/services/payroll.ts` — `upsertPayrollEntryForSale()` auto-creates/updates payroll entries by week.
- Net amount formula: `payout + adjustment + bonus - fronted`.

## Database

- Prisma schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Seed: `prisma/seed.ts`
- Key models: User, Agent, Sale, Product, LeadSource, PayrollPeriod, PayrollEntry, Clawback, ServiceAgent, ServicePayrollEntry, AppAuditLog

## Environment Variables

See `apps/ops-api/.env.example` for API vars and root `.env.example` for all vars including Docker Compose postgres credentials. Critical vars:
- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_JWT_SECRET` — JWT signing secret (startup fails without it)
- `ALLOWED_ORIGINS` — comma-separated CORS whitelist
- `NEXT_PUBLIC_OPS_API_URL` — API URL for all frontend apps

## Deployment

- **Railway**: See `README.md` for per-service build/start commands. Root directory must be blank (unset) for workspace apps. Railway uses `next build && next start`.
- **Docker**: `docker-compose.yml` orchestrates postgres + all services. Next.js apps use `Dockerfile.nextjs` with `APP_NAME` build arg. Docker sets `NEXT_OUTPUT_STANDALONE=true` to enable standalone output.

## Known Gotchas

- **`output: "standalone"` breaks Railway.** Next.js `next start` is incompatible with `output: "standalone"`. The config is conditional: `process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined`. Only the Docker build sets this env var. **Never hardcode `output: "standalone"` in next.config.js** — it will crash all Railway services.
- **Zod errors must use `zodErr()` wrapper.** Raw `parsed.error.flatten()` returns `{ formErrors, fieldErrors }` with no `error` key. Dashboards check `err.error` for display. Always use `zodErr(parsed.error)` which returns `{ error: "message", details: {...} }`.
- **Dashboard error handlers must show status codes.** Use `` `Request failed (${res.status})` `` as the fallback, not a generic "Failed to add" string. This makes debugging possible when the API returns unexpected responses (e.g., 502 from Railway proxy when a service is down).
- **Port assignments are fixed.** auth-portal:3011, payroll:3012, sales-board:3013, manager:3019, owner:3026. These must match the `ALLOWED_ORIGINS` CORS whitelist in ops-api.
- **`adjustmentAmount` allows negatives.** Chargebacks deduct from the current week's payroll when the original sale's period was already marked paid. Do not add `.min(0)` to this field.
- **Dockerfile.nextjs CMD must use shell form.** Docker exec form (`CMD ["node", "..."]`) does not expand `${APP_NAME}`. Use shell form (`CMD node apps/${APP_NAME}/server.js`) and persist the build ARG as `ENV APP_NAME=${APP_NAME}` so it's available at runtime.
- **`NEXT_PUBLIC_*` vars are baked at build time.** Setting them in docker-compose `environment` (runtime) has no effect on Next.js. Pass them as build `args` in docker-compose and as `ARG`/`ENV` in the Dockerfile so they're present during `next build`.
- **`NEXT_PUBLIC_OPS_API_URL` must be a browser-reachable URL.** Internal Docker hostnames like `http://ops-api:8080` don't work — the browser can't resolve them. Use `http://localhost:8080` for local Docker or the actual public domain in production.
- **Postgres `depends_on` needs `condition: service_healthy`.** Plain `depends_on` only waits for the container to start, not for postgres to accept connections. Always pair with a `healthcheck` on the postgres service to prevent connection reset errors during migration.
