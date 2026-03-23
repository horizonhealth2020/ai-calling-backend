# Ops Platform — Payroll & Usability Overhaul

## What This Is

A sales operations platform with role-based dashboards for managers, payroll staff, owners, customer service, and agents. A sale entered on the manager dashboard cascades correctly across all dashboards — agent tracker, sales board, payroll cards, and owner KPIs — with accurate commission calculations, real-time updates, and a complete payroll management workflow. Customer service staff manage chargebacks and pending terms through paste-to-parse submission workflows and rich tracking views. Owners monitor agent KPIs, manage permissions, and configure AI call auditing.

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
- ✓ Custom date range picker on all CSV exports across all dashboards — v1.2
- ✓ AI auto-scoring of call transcripts with editable system prompt and budget controls — v1.2
- ✓ Chargeback alert pipeline from CS to payroll with approve/clear actions — v1.2
- ✓ Agent KPI tables with 30-day rolling chargeback and pending term metrics — v1.2
- ✓ Real-time Socket.IO for CS submissions — v1.2
- ✓ Payroll bidirectional paid/unpaid toggle with period status toggle (Open ↔ Closed) — v1.2
- ✓ Sale row edit button in payroll with inline product/premium editing — v1.2
- ✓ Commission bundling: isBundleQualifier addons fold into core rate — v1.2
- ✓ Paste-to-parse auto-fill with total premium display (core + addons) — v1.2
- ✓ Service agent sync between payroll and CS with round-robin assignment — v1.2
- ✓ Permission override matrix in owner dashboard — v1.2
- ✓ Sales board leaderboard with day/week toggle and addon-inclusive premium — v1.2
- ✓ Unified dashboard app consolidating 5 standalone apps into single Next.js app — v1.3
- ✓ Role-gated tab navigation (Manager, Payroll, Owner, CS) with SUPER_ADMIN seeing all — v1.3
- ✓ Login lands directly on user's default tab based on role — v1.3
- ✓ Uniform date range filtering (Current Week / Last Week / 30 Days / Custom) on all KPI sections — v1.3
- ✓ Shared Socket.IO provider at layout level — no reconnection on tab switches — v1.3
- ✓ Docker consolidated from 5 dashboard containers to 1 — v1.3
- ✓ Addon premium aggregation in all KPI endpoints and client socket patches — v1.3
- ✓ Sales board CORS fix and error logging — v1.3
- ✓ State-aware bundle commission: configurable required/fallback addon per state, half commission when unmet — v1.4
- ✓ Bundle requirement config UI in payroll Products tab (primary product, state availability, fallback) — v1.4
- ✓ Client state field on sales entry form with US state dropdown — v1.4
- ✓ Commission engine dual-path: state-aware bundle check + legacy isBundleQualifier — v1.4
- ✓ Halving reason display on payroll entries — v1.4
- ✓ Role dashboard selector 400ms collapse delay fix — v1.4

### Active

<!-- No active requirements — v1.4 complete -->

### Out of Scope

- Morgan voice service changes — separate workload, not part of this initiative
- Mobile app — web-first, desktop is primary use case for internal ops
- Real-time chat — not needed for operations workflow
- Custom report builder — predefined reports + date range covers the use case
- Client-side commission calculation — must be server-authoritative for payroll accuracy
- Data archival with restore capability — beyond simple CSV export (deferred from v1.2)
- AI scoring dashboard with trend analysis — deferred from v1.2
- Chargeback → payroll clawback auto-creation — beyond alerts (deferred from v1.2)

## Current Milestone: v1.4 State-Aware Bundle Requirements (Complete)

**Goal:** Make bundle commission requirements configurable per state with primary/fallback addon logic, plus UI and data fixes.

**Status:** Complete — Phase 20 shipped 2026-03-23

## Current State

**Shipped:** v1.0 MVP (2026-03-17) + v1.1 Customer Service (2026-03-18) + v1.2 Platform Polish (2026-03-19) + v1.3 Dashboard Consolidation (2026-03-23) + v1.4 State-Aware Bundles (2026-03-23)
**Total:** 20 phases, 69 plans, 147 requirements across 10 days
**LOC:** ~124,000 TypeScript/TSX

The platform is fully operational with a unified dashboard app, 1 standalone sales board, 1 API, and shared @ops/* packages:
- **Unified ops-dashboard** — single Next.js app with role-gated tabs (Manager, Payroll, Owner, CS), shared Socket.IO, uniform date range filtering on all KPIs
- **Sales board** — standalone leaderboard with day/week toggle, real-time WebSocket updates
- **ops-api** — Express REST API with auth, RBAC, sales, payroll, clawbacks, exports, AI scoring
- **@ops/* packages** — shared auth, db, types, ui (PageShell, DateRangeFilter, design tokens), utils

**Known areas for future work:**
- Bulk sale import from CSV
- AI scoring dashboard with trend analysis
- Chargeback → payroll clawback auto-creation
- Data archival with restore capability
- Route file splitting (tech debt)

## Context

Shipped 4 milestones in 10 days (19 phases, 64 plans). Tech stack: Next.js 15, Express, Prisma, PostgreSQL, Socket.IO. Monorepo with unified dashboard, sales board, 1 API, and shared @ops/* packages.

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
| Bundle qualifier addons fold into core rate | Simplifies commission calc — single rate for bundled premium | ✓ Good |
| Net only on agent card header | Individual rows show commission; net with bonus/fronted/hold at agent level | ✓ Good |
| AI prompt auto-seeds default on first access | No seed dependency — prompt available immediately | ✓ Good |
| Period status toggle (Open ↔ Closed) | Simple pill click to close periods, red highlight when agents unpaid | ✓ Good |
| Convoso polling over webhooks | More reliable than webhooks for call log integration | ✓ Good |
| Parse auto-fills form directly | No preview step needed — user edits fields after parse | ✓ Good |
| Unified dashboard consolidation | 5 standalone apps → 1 app with role-gated tabs | ✓ Good |
| Layout-level Socket.IO provider | Single connection shared across all tabs — no reconnect on switch | ✓ Good |
| Uniform date range via React context | Date range persists across tab switches, 4 presets match payroll week | ✓ Good |
| Sub-component extraction during migration | Each dashboard tab split into named components for debuggability | ✓ Good |
| Sales board stays standalone | No auth required, public leaderboard — different access model | ✓ Good |

---
*Last updated: 2026-03-23 after v1.4 milestone complete*
