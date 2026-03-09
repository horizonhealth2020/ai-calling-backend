# INS Internal Operations Platform (Railway Monorepo)

This repository now supports **two independent workloads in one Railway project**:
1. Existing Morgan voice service (unchanged, root `index.js`).
2. New INS operations platform as isolated services under `/apps`.

> ⚠️ **Railway safety rule:** Morgan is a standalone service and must stay deployable independently. Keep Morgan service settings and runtime env unchanged.

## Monorepo layout

```text
.
├── apps/
│   ├── ops-api
│   ├── auth-portal
│   ├── manager-dashboard
│   ├── payroll-dashboard
│   ├── owner-dashboard
│   └── sales-board
├── packages/
│   ├── auth
│   ├── db
│   ├── types
│   ├── ui
│   └── utils
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docs/
├── index.js (Morgan service)
└── package.json
```

## Service responsibilities

- **ops-api**: auth, session endpoints, RBAC, business logic, payroll/clawbacks, exports API.
- **auth-portal**: shared login UX + role redirect landing.
- **manager-dashboard**: Sales Entry, Tracker, Call Audits, General Config.
- **payroll-dashboard**: Payroll Weeks, Payout Config, Payroll Config, Clawbacks, Exports.
- **owner-dashboard**: KPI and cross-domain operational view.
- **sales-board**: read-only monitor view.

## Shared auth/session across subdomains

- Cookie name: `ops_session`.
- JWT issued by `ops-api` using `AUTH_JWT_SECRET`.
- Cookie domain set via `AUTH_COOKIE_DOMAIN` (e.g. `.yourdomain.com`) so all subdomains can read/write session cookie.
- All protected apps must call `/api/session/me` and enforce role-level access.
- Logout clears cookie with same domain/path.

## Environment variables

### ops-api
- `DATABASE_URL`
- `PORT`
- `AUTH_JWT_SECRET`
- `AUTH_COOKIE_DOMAIN`
- `AUTH_PORTAL_URL`

### auth-portal
- `NEXT_PUBLIC_OPS_API_URL`
- `MANAGER_DASHBOARD_URL`
- `PAYROLL_DASHBOARD_URL`
- `OWNER_DASHBOARD_URL`

### manager/payroll/owner/sales-board
- `NEXT_PUBLIC_OPS_API_URL`
- optional `AUTH_PORTAL_URL`

## Local development

Morgan (root service):
```bash
npm ci
npm start
```

Ops workspace services (install from monorepo root so workspace links resolve):
```bash
npm install
```

Optional helper scripts from root (after root install):
```bash
npm run db:migrate
npm run db:seed
npm run ops:dev
npm run auth:dev
npm run manager:dev
npm run payroll:dev
npm run owner:dev
npm run salesboard:dev
```

## Railway deployment plan (same project, separate services)

Use **separate Railway services**. Because this is an npm workspaces monorepo, each service should install from repo root and run commands for its workspace:

| Service | Root directory | Build command | Start command |
|---|---|---|---|
| `ai-calling-backend` (Morgan) | `.` | `npm ci --workspaces=false` | `npm start` |
| `ops-api` | `.` | `npm ci && npm run build -w @ops/ops-api` | `npm run start -w @ops/ops-api` |
| `auth-portal` | `.` | `npm ci && npm run build -w @ops/auth-portal` | `npm run start -w @ops/auth-portal` |
| `manager-dashboard` | `.` | `npm ci && npm run build -w @ops/manager-dashboard` | `npm run start -w @ops/manager-dashboard` |
| `payroll-dashboard` | `.` | `npm ci && npm run build -w @ops/payroll-dashboard` | `npm run start -w @ops/payroll-dashboard` |
| `owner-dashboard` | `.` | `npm ci && npm run build -w @ops/owner-dashboard` | `npm run start -w @ops/owner-dashboard` |
| `sales-board` | `.` | `npm ci && npm run build -w @ops/sales-board` | `npm run start -w @ops/sales-board` |

If you prefer Railway "Root Directory" per service, the root can be `apps/<service>` **only** when internal workspace packages are not required. For services that depend on `@ops/*`, keep Root Directory as `.` and use `-w <workspace-name>` commands as above.

Recommended watch paths:
- Morgan: `/index.js`, `/voiceGateway.js`, `/morganToggle.js`, `/timeUtils.js`, `/rateLimitState.js`, `/package.json`, `/package-lock.json`
- `ops-api`: `apps/ops-api/**`, `packages/**`, `prisma/**`
- all dashboards + auth portal: corresponding `apps/<service>/**` + `packages/**`

## Railway private networking notes

- Use Railway internal URL for `ops-api` between internal services.
- Frontend public domains call public URL or proxied domain.
- Keep inter-service auth on private network where feasible for admin actions.

## Manual Railway + DNS follow-up

1. Create/add domains:
   - `auth.<domain>`
   - `manager.<domain>`
   - `payroll.<domain>`
   - `owner.<domain>`
   - `salesboard.<domain>`
2. Set `AUTH_COOKIE_DOMAIN=. <domain>` (without space) for all auth/session-aware services.
3. Provision Railway Postgres and share `DATABASE_URL` to `ops-api`.
4. Run migrations + seed on `ops-api`.
5. Configure role users and rotate seeded passwords immediately.
6. Keep Morgan deploy settings untouched to avoid cross-impact.
