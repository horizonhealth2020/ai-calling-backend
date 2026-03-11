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

All Next.js apps are v15, use `output: "standalone"` for Docker builds, and `transpilePackages` for shared `@ops/*` imports.

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
- Request validation via Zod schemas (`.min(0)` on financial amounts, `.min(0).max(100)` on commission percentages). **Exception:** `adjustmentAmount` allows negative values (chargebacks).
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

- **Railway**: See `README.md` for per-service build/start commands. Root directory must be blank (unset) for workspace apps.
- **Docker**: `docker-compose.yml` orchestrates postgres + all services. Next.js apps use `Dockerfile.nextjs` with `APP_NAME` build arg.
