# ai-calling-backend

## What This Is

A sales operations platform with role-based dashboards for managers, payroll, customer service, and owners — tracking sales, commissions, chargebacks, and agent performance in real time.

## Core Value

Sales managers can track agent performance and enter sales that flow through to the sales board and payroll, with dedicated dashboards for customer service (cancel/chargeback tracking), and owners (sales room overview and KPI tracking).

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application |
| Version | 2.3.0 |
| Status | Production |
| Last Updated | 2026-04-09 |

## Requirements

### Core Features

- Sales entry & tracking — managers enter sales, visible on leaderboard and payroll
- Payroll management — commission calculation, weekly payroll periods, adjustments, easy chargeback editing
- Chargeback & cancel tracking — CS dashboard for monitoring chargebacks and cancellations
- Owner dashboard — sales room overview, KPI tracking, historical data for trend analysis
- Agent performance — track individual agent metrics across all 18 agents

### Validated (Shipped)
- [x] Receipt parser addon detection for "Add on" variants — v2.3
- [x] ACH payroll row green highlighting — v2.3
- [x] Standalone ACA sale date field — v2.3

### Active (In Progress)
None yet.

### Planned (Next)
- To be defined during /paul:plan

### Out of Scope
- To be defined during /paul:plan

## Constraints

### Technical Constraints
- Convoso API dependency for pulling call logs, lead source tracking, agent performance data, and call recordings for AI audit
- Vapi API dependency for AI intake calls
- Railway deployment — standalone output must remain conditional (Docker only)
- NEXT_PUBLIC_* vars baked at build time — cannot be set at runtime
- Fixed port assignments: ops-api:8080, ops-dashboard:3000, sales-board:3013, morgan:3001

### Business Constraints
- Team of 18 agents to track
- Weekly payroll cycles with commission accuracy requirements
- Chargebacks must be trackable and editable without disrupting paid periods

## Key Decisions

| Decision | Rationale | Date | Status |
|----------|-----------|------|--------|
| Express + Next.js 15 monorepo | Shared packages across dashboards, single DB | Pre-init | Active |
| Inline CSSProperties (no Tailwind) | Dark glassmorphism theme, consistent styling | Pre-init | Active |
| JWT auth with RBAC | Role-based access across dashboards | Pre-init | Active |
| Railway for deployment | Team familiarity, easy per-service scaling | Pre-init | Active |

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Agent tracking coverage | All 18 agents tracked | - | Not started |
| Payroll accuracy | Accurate weekly payroll with easy editing | - | Not started |
| Chargeback/commission tracking | Smooth management with editable entries | - | Not started |
| Owner KPI visibility | Daily KPIs + historical data without asking managers | - | Not started |

## Tech Stack / Tools

| Layer | Technology | Notes |
|-------|------------|-------|
| API | Express.js | REST API with async handlers, Zod validation |
| Frontend | Next.js 15 | Multiple dashboards (ops, sales-board) |
| Database | PostgreSQL + Prisma | Migrations, seeding, singleton client |
| Auth | JWT + RBAC | 6 roles, SUPER_ADMIN bypass |
| Voice | Morgan (Convoso + Vapi) | Call logs, AI intake, call recordings |
| Deployment | Railway + Docker Compose | Railway for prod, Docker for local |
| Styling | Inline React.CSSProperties | Dark glassmorphism theme |

---
*Created: 2026-04-09*
