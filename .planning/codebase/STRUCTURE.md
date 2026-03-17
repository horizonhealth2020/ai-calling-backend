# Codebase Structure

**Analysis Date:** 2026-03-17

## Directory Layout

```
ai-calling-backend/               # Monorepo root
├── index.js                      # Legacy Morgan voice service entry point
├── voiceGateway.js               # Vapi outbound call abstraction
├── morganToggle.js               # Enable/disable Morgan at runtime
├── timeUtils.js                  # Business-hours guard
├── rateLimitState.js             # Vapi 429 backoff state
├── package.json                  # Root workspace manifest + scripts
├── tsconfig.base.json            # Shared TS compiler options + @ops/* path aliases
├── jest.config.js                # Jest config for root __tests__
├── docker-compose.yml            # Full stack: postgres + ops-api + 5 frontends
├── Dockerfile.nextjs             # Shared Next.js image (parameterized by APP_NAME)
├── prisma/
│   ├── schema.prisma             # Single schema for all Ops Platform models
│   ├── seed.ts                   # Database seeder (default password: ChangeMe123!)
│   ├── migrations/               # Named migration directories (SQL files)
│   └── manual-migrations/        # Ad-hoc SQL run outside Prisma migrate
├── packages/
│   ├── auth/src/
│   │   ├── index.ts              # Server-side JWT sign/verify + cookie builders (@ops/auth)
│   │   └── client.ts            # Browser token management + authFetch (@ops/auth/client)
│   ├── db/src/                   # Prisma client singleton (@ops/db)
│   ├── types/src/index.ts        # AppRole type + SessionUser type (@ops/types)
│   ├── utils/src/index.ts        # logEvent, logError structured logging (@ops/utils)
│   ├── socket/src/
│   │   ├── index.ts              # useSocket hook export (@ops/socket)
│   │   ├── useSocket.ts          # React hook wrapping socket.io-client
│   │   └── types.ts              # SaleChangedPayload, SaleChangedType, event constants
│   └── ui/src/
│       ├── tokens.ts             # Design tokens (colors, spacing, radius, shadows, typography)
│       ├── theme.css             # CSS custom properties for dark/light theme
│       ├── animations.css        # Keyframe animations (fade-in-up, scale-in, stagger-*)
│       ├── responsive.css        # Breakpoint utilities
│       ├── ThemeProvider.tsx     # Context provider for theme switching
│       ├── ThemeToggle.tsx       # Toggle button component
│       ├── index.tsx             # Package barrel export
│       └── components/           # Shared React components (PageShell, etc.)
├── apps/
│   ├── ops-api/
│   │   ├── src/
│   │   │   ├── index.ts          # Server entry: Express bootstrap, Socket.IO, cron start
│   │   │   ├── socket.ts         # Socket.IO singleton + emit helpers
│   │   │   ├── routes/
│   │   │   │   └── index.ts      # ALL API routes in one flat file (~1500+ lines)
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts       # requireAuth, requireRole middleware
│   │   │   ├── services/
│   │   │   │   ├── payroll.ts    # Commission calc, payroll upsert, week-range helpers
│   │   │   │   ├── audit.ts      # logAudit() — writes to app_audit_log
│   │   │   │   ├── callAudit.ts  # AI call scoring (Anthropic Claude + OpenAI)
│   │   │   │   ├── auditQueue.ts # In-memory queue, max 3 concurrent audit jobs
│   │   │   │   ├── reporting.ts  # Pure functions: computeTrend, shiftRange, buildPeriodSummary
│   │   │   │   └── convosoCallLogs.ts  # Convoso API client + KPI helpers
│   │   │   └── workers/
│   │   │       └── convosoKpiPoller.ts # 10-min cron: poll Convoso → upsert AgentCallKpi
│   │   ├── Dockerfile            # ops-api specific Docker image
│   │   ├── jest.config.ts        # Jest config for services/__tests__
│   │   └── package.json
│   ├── auth-portal/
│   │   ├── app/
│   │   │   ├── api/login/route.ts        # Proxies to ops-api, returns redirect URL with token
│   │   │   ├── api/verify/route.ts       # Token verification endpoint
│   │   │   ├── api/change-password/route.ts
│   │   │   ├── landing/page.tsx          # Role-based dashboard picker (post-login)
│   │   │   ├── access-denied/page.tsx
│   │   │   ├── unauthorized/page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── not-found.tsx
│   │   └── lib/                          # Auth-portal-specific helpers
│   ├── manager-dashboard/
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx                  # Main dashboard (sales entry, agents, audits, config)
│   │       ├── error.tsx
│   │       └── not-found.tsx
│   ├── payroll-dashboard/
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx                  # Payroll periods, commissions, clawbacks, exports
│   │       ├── error.tsx
│   │       └── not-found.tsx
│   ├── owner-dashboard/
│   │   └── app/
│   │       ├── layout.tsx
│   │       ├── page.tsx                  # KPI summary, agent performance overview
│   │       ├── error.tsx
│   │       └── not-found.tsx
│   └── sales-board/
│       └── app/
│           ├── layout.tsx
│           ├── page.tsx                  # Read-only public leaderboard
│           ├── page.backup.tsx           # Backup of previous version
│           ├── error.tsx
│           └── not-found.tsx
├── __tests__/                    # Jest tests for root Morgan service
└── .planning/                    # GSD planning artifacts (not deployed)
    ├── codebase/                 # Codebase map documents (this file's home)
    ├── milestones/               # Phase plans and acceptance criteria
    ├── quick/                    # Quick-fix planning docs
    └── research/                 # Domain research notes
```

## Directory Purposes

**`packages/`:**
- Purpose: Internal workspace packages shared across all apps — never deployed independently
- Contains: auth utilities, Prisma client, types, logging, UI tokens/components, Socket.IO hook
- Key files: `packages/auth/src/index.ts`, `packages/auth/src/client.ts`, `packages/types/src/index.ts`, `packages/ui/src/tokens.ts`

**`apps/ops-api/src/routes/`:**
- Purpose: All HTTP endpoints in a single flat file — no sub-routers
- Contains: One file `index.ts` covering auth, users, agents, sales, products, lead sources, payroll, clawbacks, service agents, call audits, reporting, Convoso KPI endpoints
- Key files: `apps/ops-api/src/routes/index.ts`

**`apps/ops-api/src/services/`:**
- Purpose: All business logic — the only place database writes happen (besides routes themselves for simple CRUD)
- Contains: Commission calculation, audit logging, AI call scoring, in-memory job queue, Convoso API integration, reporting helpers
- Key files: `apps/ops-api/src/services/payroll.ts`, `apps/ops-api/src/services/callAudit.ts`, `apps/ops-api/src/services/auditQueue.ts`

**`apps/ops-api/src/workers/`:**
- Purpose: Long-running background tasks started at server boot
- Contains: `convosoKpiPoller.ts` — the only cron worker
- Key files: `apps/ops-api/src/workers/convosoKpiPoller.ts`

**`prisma/migrations/`:**
- Purpose: Ordered migration history applied by `prisma migrate deploy`
- Contains: One directory per migration, named `YYYYMMDD_description/migration.sql`
- Generated: Yes (by `prisma migrate dev`)
- Committed: Yes

**`prisma/manual-migrations/`:**
- Purpose: One-off SQL scripts run outside Prisma migrate (data backfills, emergency fixes)
- Generated: No — authored manually
- Committed: Yes

**`.planning/`:**
- Purpose: GSD planning artifacts — phase plans, codebase maps, research docs
- Generated: By GSD commands (`/gsd:map-codebase`, `/gsd:plan-phase`, etc.)
- Committed: Yes (planning history is tracked)

## Key File Locations

**Entry Points:**
- `apps/ops-api/src/index.ts`: ops-api server bootstrap
- `index.js`: Legacy Morgan voice service entry
- `apps/auth-portal/app/api/login/route.ts`: Login flow initiation
- Each dashboard's `apps/{name}/app/page.tsx`: Dashboard render root

**Configuration:**
- `tsconfig.base.json`: Shared TypeScript config + `@ops/*` path aliases
- `apps/ops-api/.env.example`: All ops-api env vars (reference)
- `.env.example`: Root env vars including Docker Compose postgres credentials
- `docker-compose.yml`: Full stack orchestration
- `Dockerfile.nextjs`: Shared Next.js image (uses `APP_NAME` build arg)
- `prisma/schema.prisma`: Single source of truth for all database models

**Core Logic:**
- `apps/ops-api/src/routes/index.ts`: All API endpoints
- `apps/ops-api/src/services/payroll.ts`: Commission engine
- `apps/ops-api/src/services/callAudit.ts`: AI scoring with Anthropic Claude
- `apps/ops-api/src/middleware/auth.ts`: Auth + RBAC middleware
- `packages/auth/src/client.ts`: `authFetch` — used by every dashboard

**Testing:**
- `__tests__/`: Morgan service tests (Jest, root config `jest.config.js`)
- `apps/ops-api/src/services/__tests__/`: ops-api service unit tests
- `apps/ops-api/src/services/__tests__/__mocks__/`: Manual mocks for Prisma and external clients

## Naming Conventions

**Files:**
- TypeScript source: `camelCase.ts` (services, middleware, workers)
- React components: `PascalCase.tsx` (Next.js pages are `page.tsx`, layouts are `layout.tsx`)
- Next.js API routes: `route.ts` (App Router convention)
- Legacy JS: `camelCase.js`

**Directories:**
- App Router pages: lowercase with hyphens (`access-denied/`, `change-password/`)
- Service files: flat lowercase (`services/payroll.ts`, not `services/Payroll/index.ts`)
- Package names: `@ops/kebab-case` mapping to `packages/kebab-case/`

**Variables and Constants:**
- Style constant objects in UI files: `UPPER_SNAKE_CASE` (e.g., `const INP: React.CSSProperties`, `const CARD`, `const BTN`)
- Environment constants: `UPPER_SNAKE_CASE`
- TypeScript types/interfaces: `PascalCase`
- Enum values: `UPPER_SNAKE_CASE` (e.g., `SUPER_ADMIN`, `OWNER_VIEW`)

## Where to Add New Code

**New API endpoint:**
- Add route handler inline to `apps/ops-api/src/routes/index.ts`
- Define Zod schema inside the handler (pattern: `const schema = z.object({...})`)
- Wrap with `asyncHandler()`
- Add `requireAuth` and `requireRole()` as needed
- Call `logAudit()` for any sensitive mutation

**New business logic (non-trivial computation):**
- Create or extend a file in `apps/ops-api/src/services/`
- Keep functions pure where possible (see `services/reporting.ts` pattern — no DB dependency, directly testable)
- Call from route handler after validation

**New background worker:**
- Create `apps/ops-api/src/workers/yourWorker.ts`
- Export a `startYourWorker()` function
- Call it from `apps/ops-api/src/index.ts` after `server.listen()`

**New shared type:**
- Add to `packages/types/src/index.ts`
- Import with `import type { MyType } from "@ops/types"`

**New UI component (shared):**
- Add to `packages/ui/src/components/`
- Export from `packages/ui/src/index.tsx`
- Use design tokens from `packages/ui/src/tokens.ts` (never hardcode colors)

**New Next.js page in an existing dashboard:**
- Create `apps/{dashboard}/app/{page-name}/page.tsx`
- Use inline `React.CSSProperties` with constant objects (no Tailwind, no CSS modules)
- Reference design tokens via `import { colors, spacing } from "@ops/ui"`
- Make API calls via `authFetch()` from `@ops/auth/client`

**New database model:**
- Add to `prisma/schema.prisma`
- Run `npm run db:migrate` to create migration
- The migration directory is auto-generated under `prisma/migrations/`

**New dashboard app:**
- Create `apps/{name}/` with `package.json`, `next.config.js`, `app/layout.tsx`, `app/page.tsx`
- Add `transpilePackages: ["@ops/auth", "@ops/types", "@ops/ui", "@ops/socket"]` to `next.config.js`
- Add dev script to root `package.json`
- Add port to `ALLOWED_ORIGINS` in ops-api CORS config

## Special Directories

**`apps/ops-api/src/services/__tests__/__mocks__/`:**
- Purpose: Manual Jest mocks for `@ops/db` (Prisma) and external API clients
- Generated: No — hand-authored
- Committed: Yes

**`apps/*/.next/`:**
- Purpose: Next.js build output
- Generated: Yes (by `next build`)
- Committed: No (gitignored)

**`.planning/codebase/`:**
- Purpose: Codebase map documents generated by `/gsd:map-codebase`
- Generated: By GSD agent
- Committed: Yes

---

*Structure analysis: 2026-03-17*
