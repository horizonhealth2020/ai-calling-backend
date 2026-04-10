# ai-calling-backend

## What This Is

A sales operations platform with role-based dashboards for managers, payroll staff, owners, customer service, and agents. A sale entered on the manager dashboard cascades correctly across all dashboards — agent tracker, sales board, payroll cards, and owner KPIs — with accurate commission calculations, real-time updates, and a complete payroll management workflow. Customer service staff manage chargebacks and pending terms through paste-to-parse submission workflows. Owners monitor agent KPIs, manage permissions, and configure AI call auditing.

## Core Value

A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application |
| Version | 2.7.0 |
| Status | Production |
| Last Updated | 2026-04-09 |
| Milestones shipped | 16 (v1.0 through v2.6) |
| Total phases | 54 |
| LOC | ~135,000 TypeScript/TSX |
| Timeline | 2026-03-14 to present |

**Production URLs:** (Railway deployed)
- ops-api: 8080
- ops-dashboard: 3000
- sales-board: 3013
- morgan: 3001

## Requirements

### Core Features

- Sales entry & tracking — managers enter sales, visible on leaderboard and payroll
- Payroll management — commission calculation, weekly payroll periods, adjustments, easy chargeback editing
- Chargeback & cancel tracking — CS dashboard for monitoring chargebacks and cancellations
- Owner dashboard — sales room overview, KPI tracking, historical data for trend analysis
- Agent performance — track individual agent metrics across all 18 agents

### Validated (Shipped)

**v1.0 — MVP (2026-03-17)**
- [x] Sales entry with multi-product, payment type, commission preview
- [x] Commission engine: bundle rules, fee thresholds, AD&D, enrollment bonus
- [x] Week-in-arrears payroll with ACH extra week delay
- [x] Real-time dashboard cascade via Socket.IO
- [x] Payroll period lifecycle (Open → Locked → Finalized) with paid-agent guards
- [x] Agent pay cards with collapsible entries and CSV export
- [x] Sale status workflow: Ran/Declined/Dead with approval queue
- [x] Shared @ops/ui design system with form validation

**v1.1 — Customer Service (2026-03-18)**
- [x] CS dashboard with chargeback and pending terms parsers
- [x] Resolution workflow with resolve/unresolve, status filtering, live KPI updates
- [x] Role-gated tab access with canManageCS allowlist

**v1.2 — Platform Polish (2026-03-19)**
- [x] Custom date range picker on all CSV exports
- [x] AI auto-scoring of call transcripts with editable system prompt and budget controls
- [x] Chargeback alert pipeline from CS to payroll with approve/clear actions
- [x] Commission bundling: isBundleQualifier addons fold into core rate
- [x] Permission override matrix in owner dashboard
- [x] Sales board leaderboard with day/week toggle and addon-inclusive premium

**v1.3 — Unified Dashboard (2026-03-23)**
- [x] 5 standalone apps consolidated into single Next.js app with role-gated tabs
- [x] Shared Socket.IO provider at layout level — no reconnection on tab switches

**v1.4 — State-Aware Bundles (2026-03-23)**
- [x] State-aware bundle commission: configurable required/fallback addon per state
- [x] Client state field on sales entry form

**v1.5 — Route Splitting & Owner Dashboard (2026-03-24)**
- [x] Route file splitting into 17 focused domain modules
- [x] AI scoring dashboard with aggregate KPIs, per-agent breakdown, weekly trends
- [x] Chargeback auto-matching to sales with MATCHED/MULTIPLE/UNMATCHED status
- [x] Data archival for 3 high-volume log tables

**v1.6 — Cleanup & Hardening (2026-03-25)**
- [x] Morgan voice service relocated to apps/morgan/
- [x] Error handling hardened: asyncHandler, Zod validation on all inputs
- [x] Type safety audit: zero `any` in application code

**v1.7 — Convoso Integration (2026-03-26)**
- [x] Convoso KPI poller writes call records to ConvosoCallLog table with dedup
- [x] Cost per sale and lead spend display in Manager Tracker and Owner Dashboard

**v1.8 — Lead Timing Analytics (2026-03-30)**
- [x] Luxon-based DST-correct Convoso timestamp parsing
- [x] Source x Hour heatmap with diverging color scale
- [x] Best Source Right Now recommendation card
- [x] Inline SVG sparklines for 7-day close rate trends

**v1.9 — Auth & Phone (2026-03-30)**
- [x] JWT expiry check in Edge middleware
- [x] Lead phone number capture from Convoso API

**v2.0 — Sales Board & Parser (2026-03-31)**
- [x] Sales board TV-readable font sizes for 9-15 agents
- [x] ACA PL flat-commission product type with bundled/standalone entry
- [x] Self-healing audit queue with orphan recovery and exponential backoff

**v2.1 — Payroll Overhaul (2026-04-01)**
- [x] AgentPeriodAdjustment table for agent+period scoped financials
- [x] Idempotent carryover service: fronted auto-carries as hold on period lock
- [x] Agent-first payroll hierarchy with AgentCard/WeekSection components
- [x] Net formula corrected: Commission + Bonus + Fronted - Hold

**v2.2 — Chargeback Batch & Cross-Period (2026-04-09)**
- [x] Chargeback batch parser with pre-submit review table
- [x] Cross-period chargebacks: locked-period sales get negative entry in oldest OPEN period
- [x] ACA payroll row editor with Member Count and transactional bundled-rate recalc
- [x] Server-authoritative per-product commission in chargeback lookup

**v2.3 — Parser & Payroll Fixes (2026-04-09)**
- [x] Receipt parser addon detection for "Add on" (no hyphen) variants
- [x] ACH payroll row green highlighting
- [x] Standalone ACA sale date field

**v2.4 — Payroll & Chargeback Fixes (2026-04-09)**
- [x] Cross-period chargeback net deduction reflected in agent totals (on-screen + print)
- [x] Print view status colors: ACH green, CLAWBACK_APPLIED red (matching on-screen)
- [x] Simple chargeback batch parser (policy ID + member name tab-separated format)

**v2.5 — Professional Polish (2026-04-10)**
- [x] Distinct disabled states on Button/Input/Select (flat inset bg, ARIA attrs)
- [x] ConfirmModal component (dark glassmorphism, WCAG focus trap, unique ARIA IDs)
- [x] All window.confirm() replaced with themed ConfirmModal (14 confirmation points)
- [x] Toast error feedback on all API failures (zero silent catches)
- [x] Debounced search inputs (CS tracking, payroll agent sidebar)
- [x] Form error clearing on all ManagerEntry fields
- [x] Semantic color token system (30 aliases + colorAlpha helper)
- [x] Responsive KPI grids (auto-fit minmax across all dashboards)
- [x] Touch-friendly sidebar navigation
- [x] 324 hardcoded visual values migrated to design tokens

**v2.6 — Payroll Accuracy & Product Colors (2026-04-10)**
- [x] Payroll sidebar commission fix — date-based period selection instead of most-recent
- [x] Product type color coding — ACA=purple, Core=blue, Add-ons=green, AD&D=amber

### Active (In Progress)
- v2.7 Analytics & Command Center — owner command center, manager tracker upgrade, CS analytics, owner trends, fontSize cleanup

### Planned (Next)
None.

### Removed
- Bulk sale import from CSV — no longer needed

### Out of Scope
- Morgan voice service behavior changes — file relocation only
- Mobile app — web-first, desktop is primary use case for internal ops
- Real-time chat — not needed for operations workflow
- Custom report builder — predefined reports + date range covers the use case
- Client-side commission calculation — must be server-authoritative for payroll accuracy

## Target Users

**Primary:** Sales managers and payroll staff
- Enter sales, track agent performance, manage weekly commissions
- 18 agents currently, fluctuates between 9-15+

**Secondary:** Owner/SUPER_ADMIN
- KPI overview, permission management, AI audit configuration
- Sales board displayed on TV for office-wide visibility

**Tertiary:** Customer Service
- Chargeback and pending term submission and tracking
- Resolution workflow with status filtering

## Constraints

### Technical Constraints
- Convoso API dependency for call logs, lead source tracking, agent performance, call recordings
- Vapi API dependency for AI intake calls
- Railway deployment — standalone output must remain conditional (Docker only)
- NEXT_PUBLIC_* vars baked at build time — cannot be set at runtime
- Fixed port assignments: ops-api:8080, ops-dashboard:3000, sales-board:3013, morgan:3001
- Inline React.CSSProperties only — no Tailwind, no CSS files
- Monorepo workspace structure with @ops/* shared packages

### Business Constraints
- Team of 18 agents to track (fluctuates 9-15+)
- Weekly payroll cycles with commission accuracy requirements
- Chargebacks must be trackable and editable without disrupting paid periods
- Sales board must be TV-readable at 10-15ft distance

## Key Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| Express + Next.js 15 monorepo | Shared packages across dashboards, single DB | Active |
| Inline CSSProperties (no Tailwind) | Dark glassmorphism theme, consistent styling | Active |
| JWT auth with RBAC (7 roles) | Role-based access across dashboards, SUPER_ADMIN bypass | Active |
| Railway + Docker deployment | Railway for prod, Docker for local | Active |
| Luxon for timezone handling | America/New_York for day-of-week, UTC midnight for storage | Active |
| Socket.IO for real-time cascade | Event-driven updates across all dashboards | Active |
| Commission gate in upsert, not calc | Keeps calculateCommission pure; status gating in payroll entry | Active |
| isBundleQualifier flag | Product flag over string-matching for bundle detection | Active |
| Paste-to-parse submission workflow | Client-side parser, no API round-trip for parse | Active |
| Submit-only form validation | Per-field inline errors on submit, not on-blur | Active |
| Agent-first payroll hierarchy | AgentCard/WeekSection components, agent-level adjustments | Active |
| Idempotent carryover via flag | carryoverExecuted prevents duplication on lock/unlock cycles | Active |
| Fronted additive in net formula | Fronted is cash advance (positive), not deduction | Active |
| halvingReason-driven approval | Approval based on halvingReason presence, not enrollment threshold | Active |
| Convoso polling over webhooks | More reliable than webhooks for call log integration | Active |
| Inline SVG sparklines for compact metrics | Sparklines for manager tracker trends, no heavy library needed | Active |
| Recharts for analytical charts | Owner Trends tab needs real axes, tooltips, legends — sparklines insufficient | Active |
| ACA flat commission early return | Avoids bundle/enrollment fee interference in calc path | Active |
| Cross-period chargeback helper | Shared applyChargebackToEntry for single, batch, and alert paths | Active |
| Store exact carryoverAmount | Eliminates drift when fronts edited between lock and unlock | Active |
| Disabled state: flat inset bg + muted text | Visually distinct from enabled (not just opacity) | Active |
| ConfirmModal: inline z-index, no portal | Internal ops tool — z-index 10000 sufficient | Active |
| ARIA error linking via {id}-error pattern | aria-invalid + aria-describedby on Input/Select | Active |
| Button forwardRef | Enables ref-based focus management (ConfirmModal) | Active |

## Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Agent tracking coverage | All 18 agents tracked | All 18 tracked | Achieved |
| Payroll accuracy | Accurate weekly payroll with easy editing | Commission engine + carryover + cross-period | Achieved |
| Chargeback/commission tracking | Smooth management with editable entries | Batch parser + alert pipeline + cross-period | Achieved |
| Owner KPI visibility | Daily KPIs + historical data | KPI dashboard + lead timing + AI scoring | Achieved |

## Tech Stack / Tools

| Layer | Technology | Notes |
|-------|------------|-------|
| API | Express.js | REST API with async handlers, Zod validation, 17 route modules |
| Frontend | Next.js 15 | Unified dashboard (ops) + standalone sales board |
| Database | PostgreSQL + Prisma | 30+ models, 47 migrations |
| Auth | JWT + RBAC | 7 roles, SUPER_ADMIN bypass, permission overrides |
| Real-time | Socket.IO | Layout-level provider, no reconnect on tab switch |
| Voice | Morgan (Convoso + Vapi) | Call logs, AI intake, call recordings |
| Timezone | Luxon | America/New_York for display, UTC midnight for storage |
| AI | Claude API | Call audit scoring with editable prompt and budget controls |
| Deployment | Railway + Docker Compose | Railway for prod, Docker for local |
| Styling | Inline React.CSSProperties | Dark glassmorphism theme with design tokens |

## Lessons Learned (from 13 milestones)

1. Fix the critical path first — everything downstream is blocked until it works
2. Commission calculation is the highest-risk code — TDD pure functions pay off immediately
3. Gap closure cycles are cheap and effective — ship fast and fix gaps
4. UAT-driven iterative fixes are more efficient than upfront specification for UI/UX
5. Component extraction should happen proactively before files hit 2000+ lines
6. Financial sign conventions must be explicit — "positive fronted" is counterintuitive
7. Idempotency flags are the simplest correct solution for lock/unlock cycles
8. Auto-seeding defaults on first access eliminates "missing data" bugs
9. Timezone handling is best solved once with a proper library (Luxon)

---
*Created: 2026-04-09*
*Migrated from .planning/PROJECT.md (GSD framework) on 2026-04-09*
