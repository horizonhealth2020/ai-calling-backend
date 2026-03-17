# Technology Stack

**Analysis Date:** 2026-03-17

## Languages

**Primary:**
- TypeScript 5.6 - All Ops Platform code: `apps/ops-api/src/`, `apps/*/`, `packages/*/src/`
- JavaScript (CommonJS) - Morgan voice service at repo root: `index.js`, `voiceGateway.js`, `morganToggle.js`, `timeUtils.js`, `rateLimitState.js`

**Secondary:**
- SQL (PostgreSQL) - via Prisma migrations in `prisma/migrations/`

## Runtime

**Environment:**
- Node.js 20.x (enforced in root `package.json` `engines` field)

**Package Manager:**
- npm 10.8.2 (enforced via `packageManager` field in `package.json`)
- Lockfile: `package-lock.json` present at repo root

## Frameworks

**Core:**
- Express 4.19 - REST API server in `apps/ops-api/src/index.ts`
- Next.js 15.3.9 - All five frontend apps (`apps/auth-portal`, `apps/manager-dashboard`, `apps/payroll-dashboard`, `apps/owner-dashboard`, `apps/sales-board`)
- React 18.3.1 - UI layer for all Next.js apps
- Socket.IO 4.8.3 - Real-time events; server in `apps/ops-api/src/socket.ts`, client in `packages/socket/src/`

**Testing:**
- Jest 29.7 - Root-level Morgan service tests, config at `jest.config.js`
- ts-jest 29.4 - TypeScript transformation for Jest

**Build/Dev:**
- tsx 4.19 - Dev runner for ops-api TypeScript without compile step
- tsc - Production build for ops-api (`tsconfig.json` in `apps/ops-api/`)

## Key Dependencies

**Critical:**
- `@prisma/client` 5.20 - Database ORM, used via `@ops/db` singleton (`packages/db/src/client.ts`)
- `prisma` 5.20 - CLI for migrations and codegen (`apps/ops-api/`)
- `jsonwebtoken` 9.0 - JWT signing/verification in `packages/auth/src/index.ts`
- `zod` 3.23 - Request validation throughout `apps/ops-api/src/routes/index.ts`
- `bcryptjs` 2.4 - Password hashing in `apps/ops-api/`

**AI/ML:**
- `@anthropic-ai/sdk` 0.78 - Primary call auditing via Claude Sonnet (`apps/ops-api/src/services/callAudit.ts`)
- `openai` 4.73 - Fallback call auditing via GPT-4o-mini (`apps/ops-api/src/services/callAudit.ts`)

**Infrastructure:**
- `cookie-parser` 1.4 - Cookie handling in Express (`apps/ops-api/`)
- `cookie` 0.6 - Cookie serialization in `packages/auth/src/index.ts`
- `cors` 2.8 - CORS middleware in Express and Morgan service
- `axios` 1.7 - HTTP client in Morgan voice service (`index.js`)
- `node-fetch` 2.6 - HTTP client in Morgan voice service (`voiceGateway.js`)
- `node-cron` 3.0 - Cron scheduling in Morgan voice service (`index.js`)
- `luxon` 3.4 - Date/time handling in Morgan voice service
- `recharts` 3.8 - Chart components (root-level dependency, used in dashboards)
- `lucide-react` 0.577 - Icon library (root-level)

## Configuration

**TypeScript:**
- Base config: `tsconfig.base.json` — sets `target: ES2022`, `module: CommonJS`, `strict: true`
- Path aliases defined in `tsconfig.base.json`: `@ops/db`, `@ops/auth`, `@ops/auth/client`, `@ops/types`, `@ops/utils`, `@ops/ui`
- App-level tsconfigs extend the base

**Next.js:**
- Each app has its own `next.config.js`
- `output: "standalone"` conditionally enabled when `NEXT_OUTPUT_STANDALONE=true` (Docker only — never hardcode)
- All Next.js apps use `transpilePackages` for `@ops/*` shared package resolution

**Environment:**
- `DATABASE_URL` — PostgreSQL connection string (required; startup fails without it)
- `AUTH_JWT_SECRET` — JWT signing secret (required; startup fails without it)
- `ALLOWED_ORIGINS` — Comma-separated CORS whitelist
- `NEXT_PUBLIC_OPS_API_URL` — Browser-reachable API URL (baked at Next.js build time)
- `PORT` — API server port (defaults to 8080)
- `NODE_ENV` — Standard Node environment flag
- `AUTH_COOKIE_DOMAIN` — Domain for cross-subdomain session cookie sharing

**Build:**
- Docker: `Dockerfile.nextjs` (Next.js apps, shared), `apps/ops-api/Dockerfile` (API)
- Docker Compose: `docker-compose.yml` orchestrates postgres + all 6 services
- Railway: Per-service build/start commands in `README.md`; root directory must be blank

## Monorepo Structure

**Workspaces:**
- Root `package.json` declares workspaces: `apps/*` and `packages/*`
- `workspace:*` links connect `@ops/*` packages to apps

**Shared Packages:**
- `@ops/auth` (`packages/auth/`) — JWT + cookie utilities
- `@ops/db` (`packages/db/`) — Prisma client singleton
- `@ops/socket` (`packages/socket/`) — Socket.IO React hook + types
- `@ops/types` (`packages/types/`) — `AppRole` enum, `SessionUser` type
- `@ops/ui` (`packages/ui/`) — `PageShell` shared component
- `@ops/utils` (`packages/utils/`) — `logEvent`, `logError` JSON logger

## Platform Requirements

**Development:**
- Node.js 20.x
- npm 10.x
- PostgreSQL 15 (via Docker or local install)

**Production:**
- Railway (per-service deployment) or Docker Compose (full stack)
- PostgreSQL 15 (Railway managed DB or Docker volume `pgdata`)
- Node.js 20 Alpine (Docker base image)

---

*Stack analysis: 2026-03-17*
