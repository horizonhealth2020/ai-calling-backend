# Technology Stack

**Analysis Date:** 2026-03-23

## Languages

**Primary:**
- JavaScript (ES2022+) — Morgan voice service at repo root (`index.js`, `voiceGateway.js`, `morganToggle.js`, `timeUtils.js`, `rateLimitState.js`)
- TypeScript 5.6 — Ops Platform (`apps/ops-api/`, `apps/ops-dashboard/`, `apps/sales-board/`, all `packages/`)

**Secondary:**
- None

## Runtime

**Environment:**
- Node.js 20.x (enforced via `"engines": { "node": "20.x" }` in root `package.json`)

**Package Manager:**
- npm 10.8.2 (enforced via `"packageManager": "npm@10.8.2"` in root `package.json`)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- Express 4.19.x — `apps/ops-api` REST API (TypeScript, with `tsx` for dev)
- Express 4.18.x — Morgan voice service root `index.js` (CommonJS)
- Next.js 15.3.9 — `apps/ops-dashboard` (port 3011), `apps/sales-board` (port 3013)

**Realtime:**
- Socket.IO 4.8.3 (server: `apps/ops-api`, client: `apps/ops-dashboard`, `apps/sales-board`)
- socket.io-client 4.8.3 — consumed by Next.js apps via `@ops/socket` package

**Testing:**
- Jest 29.7 — root Morgan service tests in `__tests__/`
- ts-jest 29.4 — TypeScript support in Jest (via `apps/ops-api/jest.config.ts`)

**Build/Dev:**
- tsx 4.19 — TypeScript execution for `ops-api` without compile step
- TypeScript compiler — build target ES2022, module CommonJS

## Key Dependencies

**Critical:**
- `@prisma/client` 5.20 — ORM for all database access via `@ops/db` singleton
- `prisma` 5.20 — schema and migration tooling
- `jsonwebtoken` — JWT signing/verification in `packages/auth/src/index.ts` (12h expiry)
- `cookie` — session cookie serialization in `packages/auth/src/index.ts`
- `zod` 3.23 — request validation in `apps/ops-api/src/routes/`
- `bcryptjs` 2.4 — password hashing in `apps/ops-api`
- `socket.io` 4.8.3 — real-time events from API to dashboards
- `@anthropic-ai/sdk` 0.78 — Claude AI for call audit analysis in `apps/ops-api/src/services/callAudit.ts`
- `openai` 4.73 — OpenAI fallback/alternative in `apps/ops-api/src/services/callAudit.ts`

**Infrastructure:**
- `cors` 2.8.5 — CORS middleware on both Express services
- `cookie-parser` 1.4.6 — cookie parsing in `apps/ops-api`
- `node-cron` 3.0.3 — Morgan cron job (9:15 AM ET daily) in `index.js`
- `node-fetch` 2.6.11 — HTTP client for Morgan voice service (CommonJS)
- `axios` 1.7.7 — HTTP client for Convoso API calls in `index.js`
- `luxon` 3.4.4 — date/time utilities (root + type definitions)
- `lucide-react` 0.577 — icons in Next.js frontends
- `recharts` 3.8 — charts in Next.js frontends

## Shared Packages (`packages/`)

All consumed via workspace `*` version and `@ops/*` path aliases:

- **`@ops/auth`** (`packages/auth/src/index.ts`) — Server-side JWT, cookie builder/parser
- **`@ops/auth/client`** (`packages/auth/src/client.ts`) — Browser token capture, `authFetch()` with Bearer injection, auto-refresh within 15min of expiry, localStorage key `ops_session_token`
- **`@ops/db`** (`packages/db/src/client.ts`) — Prisma singleton, logs errors/warnings only
- **`@ops/types`** (`packages/types/src/`) — `AppRole` enum, `SessionUser` type
- **`@ops/ui`** (`packages/ui/src/`) — `PageShell` component, dark glassmorphism theme
- **`@ops/utils`** (`packages/utils/src/`) — `logEvent`, `logError` structured JSON logging
- **`@ops/socket`** (`packages/socket/src/`) — `useSocket` hook, `SaleChangedPayload` type, disconnect/highlight constants

## Configuration

**TypeScript:**
- Base config: `tsconfig.base.json` — strict mode, ES2022 target, CommonJS modules
- Path aliases: `@ops/db`, `@ops/auth`, `@ops/auth/client`, `@ops/types`, `@ops/utils`, `@ops/ui` mapped to `packages/*/src`
- Apps extend base config with their own `tsconfig.json`

**Next.js:**
- `transpilePackages` set for each app to include relevant `@ops/*` packages
- `output: "standalone"` conditional on `NEXT_OUTPUT_STANDALONE === "true"` (Docker-only; never hardcode)
- `NEXT_PUBLIC_OPS_API_URL` baked at build time via `next.config.js` `env` block

**Environment:**
- Root `.env.example` covers both workloads
- `apps/ops-api/.env.example` covers ops-api specific vars
- Required at startup (ops-api): `DATABASE_URL`, `AUTH_JWT_SECRET` — process exits on missing

**Build:**
- Docker: `Dockerfile.nextjs` with `APP_NAME` build arg, shell-form CMD
- Docker Compose: `docker-compose.yml` orchestrates postgres + ops-api + dashboards
- Railway: `railway.toml`, `nixpacks.toml` (both minimal — Railway uses `next build && next start`)

## Platform Requirements

**Development:**
- Node 20.x
- PostgreSQL (local or via Docker)
- npm workspaces (install from repo root)

**Production:**
- Railway (per-service deploys; root directory must be blank/unset for workspace apps)
- Docker Compose alternative (full stack with postgres healthcheck)

---

*Stack analysis: 2026-03-23*
