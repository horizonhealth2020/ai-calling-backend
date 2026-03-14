# Technology Stack

**Analysis Date:** 2026-03-14

## Languages

**Primary:**
- TypeScript 5.6.2 - Used in all backend (Express API) and Next.js frontend applications
- JavaScript (Node.js) - Legacy Morgan voice service at root (`index.js`, `voiceGateway.js`)

**Secondary:**
- Python - Unused (found in skills/ui-ux-pro-max but not part of core stack)

## Runtime

**Environment:**
- Node.js 20.x (specified in `package.json` engines)

**Package Manager:**
- npm 10.8.2 (pinned in `package.json`)
- Workspace support (monorepo with `workspaces` property)
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core Backend:**
- Express 4.19.2 - REST API server in `apps/ops-api` running on port 8080
- Socket.io 4.8.3 - Real-time WebSocket communication for audit status updates
- Prisma 5.20.0 - ORM and database client in `packages/db`

**Core Frontend:**
- Next.js 15.3.9 - Used in all dashboard applications:
  - `auth-portal` (port 3011) - Login UI with role-based routing
  - `manager-dashboard` (port 3019) - Sales entry and audits
  - `payroll-dashboard` (port 3012) - Commission and payroll management
  - `owner-dashboard` (port 3026) - KPI dashboard
  - `sales-board` (port 3013) - Read-only leaderboard
- React 18.3.1 - UI library for all Next.js applications
- React DOM 18.3.1 - React rendering for Next.js apps

**Testing:**
- Jest 29.7.0 - Test runner (configured for root Morgan service only)

**Build/Dev:**
- tsx 4.19.1 - TypeScript execution for development (in `apps/ops-api`)
- TypeScript 5.6.2 - Compiler for all TypeScript applications

## Key Dependencies

**Critical - Authentication & Authorization:**
- jsonwebtoken 9.0.2 (`packages/auth`) - JWT signing and verification for session tokens (12h expiry)
- cookie 0.6.0 (`packages/auth`) - Cookie serialization for httpOnly session cookies
- bcryptjs 2.4.3 (`apps/ops-api`) - Password hashing for user authentication

**Critical - Database:**
- @prisma/client 5.20.0 - Prisma client for PostgreSQL queries
- prisma 5.20.0 - Prisma CLI for migrations and schema management

**Infrastructure - API:**
- cors 2.8.5 - CORS middleware for cross-origin requests from frontend dashboards
- cookie-parser 1.4.6 - Cookie parsing middleware for session handling

**Data Validation:**
- zod 3.23.8 - Schema validation for API requests and responses with structured error formatting

**AI/LLM Integration:**
- @anthropic-ai/sdk 0.78.0 (`apps/ops-api`) - Claude API for call audit analysis with structured tool calling
- openai 4.73.0 (`apps/ops-api`) - OpenAI API for Whisper transcription (fallback/alternative to Claude)

**Voice/Calling:**
- socket.io-client 4.8.3 (`apps/manager-dashboard`) - WebSocket client for real-time updates

**Utilities:**
- axios 1.7.7 - HTTP client for external API calls (Convoso, Vapi)
- node-fetch 2.6.11 - Fetch API polyfill for Node.js (used in Morgan service)
- node-cron 3.0.3 - Cron job scheduling (used in Morgan service)
- luxon 3.4.4 - Date/time utilities
- lucide-react 0.577.0 - Icon library for UI
- recharts 3.8.0 - Charting library for dashboards

## Configuration

**Environment:**
- Environment variables loaded from `.env` files (never committed)
- Required vars: `DATABASE_URL`, `AUTH_JWT_SECRET`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`
- Optional vars for integrations: `CONVOSO_AUTH_TOKEN`, `VAPI_API_KEY`, `WHISPER_API_URL`
- CORS origins configurable via `ALLOWED_ORIGINS` (default: localhost ports 3011, 3012, 3013, 3019, 3026)

**Build:**
- `tsconfig.base.json` - Base TypeScript configuration for monorepo with path aliases:
  - `@ops/db` → `packages/db/src`
  - `@ops/auth` → `packages/auth/src`
  - `@ops/auth/client` → `packages/auth/src/client`
  - `@ops/types` → `packages/types/src`
  - `@ops/utils` → `packages/utils/src`
  - `@ops/ui` → `packages/ui/src`
- Individual `tsconfig.json` files in each app/package for project-specific settings
- Next.js 15 using `transpilePackages` for shared `@ops/*` imports

## Database

**Provider:** PostgreSQL
- Connection via `DATABASE_URL` environment variable (Prisma datasource)
- Prisma schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/` (deployed via `prisma migrate deploy`)
- Seed script: `prisma/seed.ts` (default test password: `ChangeMe123!`)
- Client singleton exported from `packages/db/src/client.ts`

**Key Tables:**
- User, Agent, Sale, Product, LeadSource
- PayrollPeriod, PayrollEntry, Clawback, ServiceAgent, ServicePayrollEntry
- AppAuditLog (for sensitive operation tracking)
- ConvosoCallLog (third-party CRM integration)
- CallAudit (AI-analyzed call transcripts)

## Platform Requirements

**Development:**
- Node.js 20.x
- npm 10.8.2
- PostgreSQL 15 (for local development or Docker)
- Docker/Docker Compose (for full-stack local environment)

**Production:**
- Node.js 20.x runtime
- PostgreSQL 15+ database
- Deployment targets: Railway (per README.md), Docker container orchestration
- Standalone Next.js output mode (conditional: only when `NEXT_OUTPUT_STANDALONE=true`)

## Build & Deployment

**Docker:**
- `Dockerfile.nextjs` - Multi-app Next.js builder with `APP_NAME` build arg
- `docker-compose.yml` - Full stack: postgres + ops-api + 5 frontend apps
- Postgres healthcheck required before API/app startup (prevent connection errors during migration)

**Railway (Production):**
- Per-service build/start commands defined in README.md
- Root directory must be blank for workspace apps
- Next.js uses `next build && next start` (standalone output only in Docker)

**Environment Variable Handling:**
- `NEXT_PUBLIC_*` prefixed variables baked at build time (not runtime)
- Must pass as Docker build `args` or build-time `ARG`/`ENV`
- `NEXT_PUBLIC_OPS_API_URL` must be browser-reachable URL (not internal hostname)

---

*Stack analysis: 2026-03-14*
