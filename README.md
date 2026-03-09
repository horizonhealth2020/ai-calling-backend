# INS Internal Operations Platform (Railway Monorepo)

This repository now supports **two independent workloads in one Railway project**:
1. Existing Morgan voice service (unchanged, root `index.js`).
2. New INS operations platform as isolated services under `/apps`.

> ⚠️ **Railway safety rule:** Morgan is a standalone service. Do **not** point Morgan at a monorepo root that installs all `/apps` dependencies. Keep Morgan deployed from repo root (`.`) only.

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

Ops services (independent app folders):
```bash
cd apps/ops-api && npm install
cd ../auth-portal && npm install
cd ../manager-dashboard && npm install
cd ../payroll-dashboard && npm install
cd ../owner-dashboard && npm install
cd ../sales-board && npm install
```

Optional helper scripts from root (after each app has dependencies installed):
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

Use **separate Railway services with explicit root directories**:

| Service | Root directory | Build command | Start command |
|---|---|---|---|
| `morgan-voice` | `.` | `npm ci` | `npm start` |
| `ops-api` | `apps/ops-api` | `npm install && npm run build` | `npm run start` |
| `auth-portal` | `apps/auth-portal` | `npm install && npm run build` | `npm run start` |
| `manager-dashboard` | `apps/manager-dashboard` | `npm install && npm run build` | `npm run start` |
| `payroll-dashboard` | `apps/payroll-dashboard` | `npm install && npm run build` | `npm run start` |
| `owner-dashboard` | `apps/owner-dashboard` | `npm install && npm run build` | `npm run start` |
| `sales-board` | `apps/sales-board` | `npm install && npm run build` | `npm run start` |

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

