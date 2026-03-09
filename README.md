# INS Internal Operations Platform (Railway Monorepo)

This repository now supports **two independent workloads in one Railway project**:
1. Existing Morgan voice service (unchanged, root `index.js`).
2. New INS operations platform as isolated services under `/apps`.

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

```bash
npm install
npm run db:migrate
npm run db:seed
npm run ops:dev
npm run auth:dev
npm run manager:dev
npm run payroll:dev
npm run owner:dev
npm run salesboard:dev
```

Morgan remains on:
```bash
npm start
```

## Railway deployment plan (same project, separate services)

Recommended Railway service names and roots:
- `morgan-voice` -> root `.` (existing)
- `ops-api` -> root `apps/ops-api`
- `auth-portal` -> root `apps/auth-portal`
- `manager-dashboard` -> root `apps/manager-dashboard`
- `payroll-dashboard` -> root `apps/payroll-dashboard`
- `owner-dashboard` -> root `apps/owner-dashboard`
- `sales-board` -> root `apps/sales-board`
- `ops-postgres` -> Railway Postgres plugin

Build/start commands:
- Node API: `npm install && npm run build` / `npm run start`
- Next apps: `npm install && npm run build` / `npm run start`

Watch paths (per service):
- `apps/<service>/**`
- `packages/**`
- `prisma/**` for `ops-api`

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

