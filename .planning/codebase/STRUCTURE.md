# Codebase Structure

**Analysis Date:** 2026-03-14

## Directory Layout

```
ai-calling-backend/
├── index.js                          # Morgan voice service entry point
├── package.json                      # Root monorepo configuration (npm workspaces)
├── tsconfig.base.json                # Base TypeScript config with path aliases
├── jest.config.js                    # Jest configuration for root tests
├── prisma/                           # Database schema and migrations
│   ├── schema.prisma                 # Prisma schema (User, Agent, Sale, Product, etc.)
│   ├── migrations/                   # Database migration files
│   └── seed.ts                       # Database seeding script (default password: ChangeMe123!)
├── apps/                             # Next.js and Express services
│   ├── ops-api/                      # Express REST API (port 8080)
│   │   ├── src/
│   │   │   ├── index.ts              # Server startup, middleware, error handler
│   │   │   ├── routes/
│   │   │   │   └── index.ts          # All API endpoints (auth, sales, payroll, etc.)
│   │   │   ├── middleware/
│   │   │   │   └── auth.ts           # JWT verification, role-based access control
│   │   │   ├── services/
│   │   │   │   ├── payroll.ts        # Commission calculation and payroll logic
│   │   │   │   ├── audit.ts          # Audit logging to database
│   │   │   │   ├── auditQueue.ts     # Async audit job queue
│   │   │   │   ├── callAudit.ts      # Call audit re-scoring logic
│   │   │   │   └── socket.ts         # Socket.IO setup and emitters
│   │   ├── package.json              # ops-api dependencies
│   │   ├── tsconfig.json             # TypeScript config
│   │   └── next.config.js            # (Note: Express app, not Next.js)
│   ├── auth-portal/                  # Next.js login portal (port 3011)
│   │   ├── app/
│   │   │   ├── page.tsx              # Login form
│   │   │   ├── layout.tsx            # Root layout with ThemeProvider
│   │   │   ├── landing/page.tsx      # Redirect logic based on role
│   │   │   ├── api/
│   │   │   │   ├── login/route.ts    # POST /api/login - validate and set cookie
│   │   │   │   ├── verify/route.ts   # Verify token from URL param
│   │   │   │   └── change-password/route.ts  # POST /api/change-password
│   │   │   ├── access-denied/page.tsx
│   │   │   ├── unauthorized/page.tsx
│   │   │   └── not-found.tsx
│   │   ├── next.config.js            # transpilePackages config
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── manager-dashboard/            # Next.js for MANAGER/ADMIN roles (port 3019)
│   │   ├── app/
│   │   │   ├── page.tsx              # Dashboard homepage
│   │   │   ├── layout.tsx            # Root layout with ThemeProvider
│   │   │   ├── error.tsx             # Next.js error boundary
│   │   │   ├── not-found.tsx
│   │   │   └── [other pages]
│   │   ├── next.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── payroll-dashboard/            # Next.js for PAYROLL/ADMIN/SERVICE roles (port 3012)
│   │   ├── app/
│   │   │   ├── page.tsx              # Payroll dashboard
│   │   │   ├── layout.tsx
│   │   │   └── [other pages]
│   │   ├── next.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── owner-dashboard/              # Next.js for OWNER_VIEW role (port 3026)
│   │   ├── app/
│   │   │   ├── page.tsx              # KPI summary
│   │   │   ├── layout.tsx
│   │   │   └── [other pages]
│   │   ├── next.config.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── sales-board/                  # Next.js public leaderboard (port 3013)
│       ├── app/
│       │   ├── page.tsx              # Leaderboard display
│       │   ├── layout.tsx
│       │   └── [other pages]
│       ├── next.config.js
│       ├── package.json
│       └── tsconfig.json
├── packages/                         # Shared TypeScript packages
│   ├── auth/                         # JWT and session management
│   │   ├── src/
│   │   │   ├── index.ts              # Server: signSessionToken, verifySessionToken, buildSessionCookie
│   │   │   └── client.ts             # Client: captureTokenFromUrl, authFetch, auto-refresh
│   │   └── package.json
│   ├── db/                           # Prisma client singleton
│   │   ├── src/
│   │   │   └── client.ts             # PrismaClient singleton instance
│   │   └── package.json
│   ├── types/                        # TypeScript type definitions
│   │   ├── src/
│   │   │   └── index.ts              # AppRole enum, SessionUser type
│   │   └── package.json
│   ├── ui/                           # React components and design system
│   │   ├── src/
│   │   │   ├── index.tsx             # PageShell component export
│   │   │   ├── ThemeProvider.tsx     # Theme context provider
│   │   │   ├── ThemeToggle.tsx       # Dark/light mode toggle
│   │   │   ├── tokens.ts             # Design tokens (colors, spacing, radius, shadows, typography, motion)
│   │   │   ├── theme.css             # Global CSS variables and animations
│   │   │   ├── animations.css        # Animation keyframes
│   │   │   ├── responsive.css        # Responsive utilities
│   │   │   └── components/
│   │   │       ├── index.ts          # Component exports (re-exports)
│   │   │       ├── Button.tsx        # Button component (baseButtonStyle)
│   │   │       ├── Card.tsx          # Card container
│   │   │       ├── Input.tsx         # Input field (baseInputStyle)
│   │   │       ├── Badge.tsx         # Badge component
│   │   │       ├── Toast.tsx         # Toast notifications
│   │   │       ├── Tooltip.tsx       # Tooltip component
│   │   │       ├── ProgressRing.tsx  # Circular progress indicator
│   │   │       ├── Skeleton.tsx      # Loading skeleton
│   │   │       ├── StatCard.tsx      # KPI stat card
│   │   │       ├── AnimatedNumber.tsx # Number transition animation
│   │   │       ├── TabNav.tsx        # Tab navigation
│   │   │       └── EmptyState.tsx    # Empty state placeholder
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── utils/                        # Utility functions
│       ├── src/
│       │   └── index.ts              # logEvent, logError (structured JSON)
│       └── package.json
├── __tests__/                        # Jest tests for Morgan service (root)
│   ├── helpers.test.js
│   ├── integration.test.js
│   ├── morganToggle.test.js
│   ├── queueProcessor.test.js
│   ├── rateLimitState.test.js
│   ├── timeUtils.test.js
│   └── voiceGateway.test.js
├── .env.example                      # Example env vars for all services
├── docker-compose.yml                # Docker orchestration (postgres + all services)
├── Dockerfile.nextjs                 # Multi-service Next.js Dockerfile
├── .github/workflows/                # CI/CD workflows
├── docs/                             # Documentation
└── .claude/                          # Claude Code configuration
```

## Directory Purposes

**Root (`/`):**
- Contains Morgan voice service entry point and monorepo configuration
- Dependencies: axios, express, cors, node-cron, node-fetch, recharts (shared across services)
- Workspaces defined in `package.json` link all `apps/*` and `packages/*` as workspace members

**`apps/ops-api/`:**
- REST API backend serving all dashboards
- Single-entry-point route file (`routes/index.ts`) with all endpoints
- Connects to PostgreSQL via Prisma
- Broadcasts updates via Socket.IO

**`apps/auth-portal/`, `apps/manager-dashboard/`, `apps/payroll-dashboard/`, `apps/owner-dashboard/`, `apps/sales-board/`:**
- Next.js v15 applications
- Each configured with `transpilePackages: ["@ops/ui", "@ops/auth"]` for shared imports
- Use `output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined` (conditional for Docker)
- App Router pattern: `app/` directory contains pages, layouts, routes

**`packages/auth/`:**
- Server-side: JWT signing/verification, cookie building
- Client-side: Token capture, Bearer injection, auto-refresh logic

**`packages/db/`:**
- Singleton Prisma client — ensures single database connection across app
- Imported as `import { prisma } from "@ops/db"`

**`packages/types/`:**
- Central type definitions — `AppRole`, `SessionUser`
- Shared across ops-api and all dashboards

**`packages/ui/`:**
- Design system and reusable components
- No Tailwind or utility CSS — all inline React.CSSProperties
- Exports `PageShell` component used in all dashboards
- Exports design tokens for consistent styling

**`packages/utils/`:**
- Structured logging functions for consistent log format across services

**`prisma/`:**
- Prisma schema defines all database tables (User, Agent, Sale, Product, PayrollPeriod, PayrollEntry, Clawback, ServiceAgent, ServicePayrollEntry, AppAuditLog, ConvosoCallLog, CallAudit)
- Migrations auto-generated via `prisma migrate dev`
- Seed script creates initial data including default user (password: ChangeMe123!)

**`__tests__/`:**
- Jest tests for Morgan service (voiceGateway, morganToggle, timeUtils, etc.)
- Run via `npm test` from root

## Key File Locations

**Entry Points:**
- `index.js`: Morgan voice service (npm start)
- `apps/ops-api/src/index.ts`: Ops API (npm run ops:dev)
- `apps/auth-portal/app/page.tsx`: Auth portal login form
- `apps/manager-dashboard/app/page.tsx`: Manager dashboard
- `apps/payroll-dashboard/app/page.tsx`: Payroll dashboard
- `apps/owner-dashboard/app/page.tsx`: Owner dashboard
- `apps/sales-board/app/page.tsx`: Sales board

**Configuration:**
- `package.json`: Root monorepo, workspace members, shared scripts
- `tsconfig.base.json`: Base TypeScript with path aliases (`@ops/*`)
- `apps/*/next.config.js`: Per-dashboard Next.js config (transpilePackages, NEXT_PUBLIC vars)
- `apps/ops-api/tsconfig.json`: Express app TypeScript config
- `prisma/schema.prisma`: Database schema
- `.env.example`: All environment variables (DATABASE_URL, AUTH_JWT_SECRET, ALLOWED_ORIGINS, etc.)

**Core Logic:**
- `apps/ops-api/src/routes/index.ts`: All API endpoints (auth, sales, payroll, audits, exports)
- `apps/ops-api/src/middleware/auth.ts`: JWT verification and role-based access control
- `apps/ops-api/src/services/payroll.ts`: Commission calculation and payroll entry creation
- `apps/ops-api/src/services/audit.ts`: Sensitive operation logging
- `apps/ops-api/src/socket.ts`: Socket.IO event broadcasting
- `packages/auth/src/index.ts`: Server-side token signing
- `packages/auth/src/client.ts`: Client-side token management and HTTP client

**Testing:**
- `__tests__/`: Jest tests for Morgan service
- `jest.config.js`: Root Jest configuration
- Run: `npm test`, `npm test:watch`, `npm run test:coverage`

## Naming Conventions

**Files:**
- TypeScript files: camelCase (e.g., `voiceGateway.ts`, `auditQueue.ts`, `callAudit.ts`)
- Next.js pages: kebab-case matching route segments (e.g., `access-denied/page.tsx`, `unauthorized/page.tsx`)
- Configuration files: lowercase with dots (e.g., `next.config.js`, `jest.config.js`, `tsconfig.json`)
- Utility/helper files: descriptive names (e.g., `timeUtils.js`, `rateLimitState.js`, `morganToggle.js`)

**Directories:**
- Services: `services/` (e.g., `services/payroll.ts`)
- Middleware: `middleware/` (e.g., `middleware/auth.ts`)
- Components: `components/` (e.g., `packages/ui/src/components/Button.tsx`)
- Routes: `routes/` for Express; `app/` for Next.js
- Database: `prisma/` for schema and migrations
- Tests: `__tests__/` for Jest
- Packages: lowercase with hyphens (`@ops/auth`, `@ops/db`, `@ops/types`, `@ops/ui`, `@ops/utils`)

**Variables and Functions:**
- Functions: camelCase (e.g., `signSessionToken`, `upsertPayrollEntryForSale`, `logAudit`)
- Constants: UPPER_SNAKE_CASE for configuration (e.g., `SESSION_COOKIE`, `MORGAN_MAX_CONCURRENT`)
- React style constants: UPPER_SNAKE_CASE (e.g., `const BG: React.CSSProperties = { ... }`)
- Types: PascalCase (e.g., `SessionUser`, `AppRole`, `SaleWithProduct`)

**Types:**
- Enums: PascalCase (e.g., `UserRole`, `PayrollPeriodStatus`, `SaleStatus`)
- Type aliases: PascalCase (e.g., `SessionUser`, `NavItem`, `PageShellProps`)
- Database models: PascalCase (Prisma convention)

## Where to Add New Code

**New API Endpoint:**
- Primary code: `apps/ops-api/src/routes/index.ts`
- Steps:
  1. Define Zod schema for request body (if not exists)
  2. Add route handler with `asyncHandler()` wrapper
  3. Call `requireAuth` and `requireRole(...)` middleware if needed
  4. Validate input via Zod, return `{ error: "msg" }` on failure
  5. Call service layer if complex logic
  6. Return JSON response
  7. If mutating data, call `logAudit()` if sensitive, emit Socket.IO event for real-time sync

**New Service/Business Logic:**
- Primary code: `apps/ops-api/src/services/[domain].ts`
- Create new file if domain doesn't exist (e.g., `services/export.ts` for export logic)
- Use `prisma` singleton from `@ops/db`
- Export pure functions that accept parameters and return results
- Keep side effects (logging, Socket.IO) in route handler, not service

**New Dashboard Page:**
- Primary code: `apps/[dashboard]/app/[path]/page.tsx` (e.g., `apps/manager-dashboard/app/sales/page.tsx`)
- Steps:
  1. Create page directory in `app/`
  2. Add `page.tsx` with `"use client"` directive
  3. Import `PageShell` from `@ops/ui`
  4. Import design tokens from `@ops/ui`
  5. Define inline style constants at top of file (e.g., `const CARD: React.CSSProperties = { ... }`)
  6. Use `authFetch()` for API calls (auto-refreshes token, injects Bearer header)
  7. Manage local state via `useState`, subscribe to Socket.IO for real-time updates
- Tests: No test files required (no Jest tests for Next.js pages currently)

**New Shared Component:**
- Primary code: `packages/ui/src/components/[ComponentName].tsx`
- Export from `packages/ui/src/components/index.ts`
- Also export from `packages/ui/src/index.tsx`
- Use design tokens from `packages/ui/src/tokens.ts`
- All styling via inline React.CSSProperties

**New Shared Type:**
- Primary code: `packages/types/src/index.ts`
- Export type with clear documentation
- Import in services and frontends

**New Utility Function:**
- Primary code: `packages/utils/src/index.ts`
- Export named function with clear purpose
- Keep functions pure (no side effects except logging)

**Database Schema Change:**
- Update `prisma/schema.prisma`
- Run `npm run db:migrate` from root (creates migration)
- Test locally with `npm run db:seed`
- If adding new role or enum: update `packages/types/src/index.ts` to match

## Special Directories

**`node_modules/`:**
- Package dependencies (auto-generated)
- Not committed to git
- Generated by `npm install` from root (installs all workspace members)

**`prisma/migrations/`:**
- Auto-generated by Prisma on schema changes
- Committed to git for reproducibility
- Applied in production via `npm run db:migrate` (wraps `prisma migrate deploy`)

**`apps/[app]/.next/`:**
- Build output for Next.js
- Generated by `npm run build` or `npm run dev`
- Not committed

**`.env` and `.env.*`:**
- Local environment variables (never committed)
- Use `.env.example` as template
- Required vars: `DATABASE_URL`, `AUTH_JWT_SECRET`, `ALLOWED_ORIGINS`, `NEXT_PUBLIC_OPS_API_URL`

**`.github/workflows/`:**
- CI/CD pipeline definitions
- GitHub Actions configuration

**`docs/`:**
- Project documentation
- README files, guides, architecture diagrams

**`.claude/`:**
- Claude Code configuration and agent definitions
- Not part of core application code

---

*Structure analysis: 2026-03-14*
