# Ops Platform — Payroll & Usability Overhaul

## What This Is

A sales operations platform with role-based dashboards for managers, payroll staff, owners, and agents. A sale entered on the manager dashboard cascades correctly across all dashboards — agent tracker, sales board, payroll cards, and owner KPIs — with accurate commission calculations, real-time updates, and a complete payroll management workflow.

## Core Value

A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ JWT authentication with role-based access control (6 roles) — existing
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
- ✓ Resolution workflow with typed outcomes and status filtering — v1.1
- ✓ Role-gated tab access: Submissions (SUPER_ADMIN/OWNER_VIEW only), Tracking (+ CUSTOMER_SERVICE) — v1.1
- ✓ Auth permission tightening: positive canManageCS allowlist, SUPER_ADMIN sees all dashboard cards — v1.1

### Active

<!-- No active requirements — v1.1 complete -->

## Current Milestone: v1.1 Customer Service

**Goal:** Add a Customer Service dashboard for managing chargebacks and pending terms with paste-to-parse submission workflows and rich tracking views.

**Target features:**
- New role: customer_service (tracking-only access)
- Chargeback submission parser with batch support
- Pending Terms submission parser with batch support
- Chargeback tracking with KPI counters and filters
- Pending Terms tracking with hold-date urgency

### Out of Scope

- Morgan voice service changes — separate workload, not part of this initiative
- Mobile app — web-first, desktop is primary use case for internal ops
- Real-time chat — not needed for operations workflow
- Custom report builder — predefined reports cover the use case
- Client-side commission calculation — must be server-authoritative for payroll accuracy

## Context

Shipped v1.0 with 10 phases, 31 plans, 50 requirements across 4 days. Tech stack: Next.js 15, Express, Prisma, PostgreSQL, Socket.IO. Monorepo with 5 dashboards, 1 API, and shared @ops/* packages.

The platform is now fully operational: sales entry works end-to-end, commissions calculate correctly with all bundle/fee/arrears rules, dashboards cascade in real-time, payroll management has a complete lifecycle, and all UI uses a consistent shared design system.

**Known areas for future work:**
- Bulk sale import from CSV
- Custom date range selection for reports
- Enhanced AI call audit analysis
- Automated call quality scoring

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

---
*Last updated: 2026-03-18 after v1.1 Phase 17 completion — all tech debt resolved*
