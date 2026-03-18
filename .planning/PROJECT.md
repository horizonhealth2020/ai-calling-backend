# Ops Platform — Payroll & Usability Overhaul

## What This Is

A sales operations platform with role-based dashboards for managers, payroll staff, owners, customer service, and agents. A sale entered on the manager dashboard cascades correctly across all dashboards — agent tracker, sales board, payroll cards, and owner KPIs — with accurate commission calculations, real-time updates, and a complete payroll management workflow. Customer service staff manage chargebacks and pending terms through paste-to-parse submission workflows and rich tracking views.

## Core Value

A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ JWT authentication with role-based access control (7 roles) — existing + v1.1
- ✓ Auth portal with login, password change, role-based redirect — existing
- ✓ Prisma/PostgreSQL data layer with migrations — existing
- ✓ Docker and Railway deployment — existing
- ✓ Sales entry completes without errors — v1.0
- ✓ Multi-product sales with payment type selection — v1.0
- ✓ Commission engine: bundle rules, fee thresholds, AD&D, enrollment bonus — v1.0
- ✓ Week-in-arrears payroll with ACH extra week delay — v1.0
- ✓ Live commission preview before submission — v1.0
- ✓ Sale editing with full commission and period recalculation — v1.0
- ✓ Real-time dashboard cascade via Socket.IO — v1.0
- ✓ Payroll period lifecycle (Pending → Ready → Finalized) with paid-agent guards — v1.0
- ✓ Agent pay cards with collapsible entries and CSV export — v1.0
- ✓ Sale status workflow: Ran/Declined/Dead with approval queue — v1.0
- ✓ Reporting: per-agent metrics, period summaries, trend KPIs, CSV export — v1.0
- ✓ Shared @ops/ui design system with form validation across all dashboards — v1.0
- ✓ Audit logging for sensitive operations — existing
- ✓ Customer Service dashboard with chargeback and pending terms parsers — v1.1
- ✓ Chargeback and pending terms tracking tables with KPI counters, filters, CSV export — v1.1
- ✓ Resolution workflow with resolve/unresolve, status filtering, live KPI updates — v1.1
- ✓ Role-gated tab access: Submissions (SUPER_ADMIN/OWNER_VIEW only), Tracking (+ CUSTOMER_SERVICE) — v1.1
- ✓ Auth permission tightening: positive canManageCS allowlist, SUPER_ADMIN sees all dashboard cards — v1.1
- ✓ Shared formatDollar/formatDate utilities in @ops/utils across all 6 dashboards — v1.1

### Active

<!-- No active requirements — planning next milestone -->

## Current State

**Shipped:** v1.0 MVP (2026-03-17) + v1.1 Customer Service (2026-03-18)
**Total:** 17 phases, 46 plans, 90 requirements across 5 days

The platform is fully operational with 6 dashboards, 1 API, and shared @ops/* packages:
- **Manager dashboard** — sales entry, agent tracker, call audits, config management
- **Payroll dashboard** — payroll periods, commission approval, service staff, clawbacks, exports
- **Sales board** — read-only sales leaderboard
- **Owner dashboard** — KPI summary and operational overview
- **Auth portal** — login UX + role-based redirect
- **CS dashboard** — chargeback/pending terms submission and tracking

### Out of Scope

- Morgan voice service changes — separate workload, not part of this initiative
- Mobile app — web-first, desktop is primary use case for internal ops
- Real-time chat — not needed for operations workflow
- Custom report builder — predefined reports cover the use case
- Client-side commission calculation — must be server-authoritative for payroll accuracy
- Chargeback → payroll integration — v1.1 is standalone tracking; wire later
- Pending terms → agent KPI influence — decoupled for now; extensible schema allows future wiring

## Context

Shipped v1.0 MVP in 4 days (10 phases, 31 plans) and v1.1 Customer Service in 2 days (7 phases, 15 plans). Tech stack: Next.js 15, Express, Prisma, PostgreSQL, Socket.IO. Monorepo with 6 dashboards, 1 API, and shared @ops/* packages.

**Known areas for future work:**
- Bulk sale import from CSV
- Custom date range selection for reports
- Enhanced AI call audit analysis
- Automated call quality scoring
- Wire chargebacks to payroll clawback workflow
- Wire pending terms to agent KPI metrics
- Real-time Socket.IO updates on new CS submissions

## Constraints

- **Tech stack**: Next.js 15, Express, Prisma, PostgreSQL, Socket.IO
- **Styling**: Inline React.CSSProperties with dark glassmorphism theme — no Tailwind, no CSS files
- **Architecture**: Monorepo workspace structure with @ops/* shared packages
- **Deployment**: Compatible with both Railway and Docker

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix sales entry first | Everything downstream depends on working sales flow | ✓ Good |
| Multi-product sales | Products are created in payroll, each sale can include multiple products | ✓ Good |
| Product-based commission tiers | Commission rates determined by product type and bundling rules | ✓ Good |
| Sun-Sat pay weeks with arrears | Industry standard for this business; ACH gets extra week delay | ✓ Good |
| Full overhaul scope | Fix bugs + polish UI + add reporting — not just a patch job | ✓ Good |
| isBundleQualifier flag | Replaced string-matching bundle detection with product flag | ✓ Good |
| Luxon for timezone handling | America/New_York for day-of-week, UTC midnight for storage | ✓ Good |
| Commission gate in upsert, not calc | Keeps calculateCommission pure; status gating in payroll entry creation | ✓ Good |
| Socket.IO for real-time cascade | Replaced polling with event-driven updates across all dashboards | ✓ Good |
| Shared @ops/ui design system | Migrated all dashboards to shared components with design tokens | ✓ Good |
| Submit-only form validation | Per-field inline errors on submit, not on-blur or real-time | ✓ Good |
| CS dashboard as 6th app | Separate Next.js app following existing dashboard pattern | ✓ Good |
| Paste-to-parse submission workflow | Raw text pasted, client-side parser, editable preview before submit | ✓ Good |
| Flat tracking tables (no agent grouping) | Simpler UX, agent data stored but filtered behind-the-scenes | ✓ Good |
| canManageCS positive allowlist | Replaced negative isCSOnly check with explicit role list | ✓ Good |
| Shared formatDollar/formatDate in @ops/utils | Extracted from dashboards to shared package for consistency | ✓ Good |

---
*Last updated: 2026-03-18 after v1.1 milestone completion*
