# ai-calling-backend

## What This Is

A sales operations platform with role-based dashboards for managers, payroll staff, owners, customer service, and agents. A sale entered on the manager dashboard cascades correctly across all dashboards — agent tracker, sales board, payroll cards, and owner KPIs — with accurate commission calculations, real-time updates, and a complete payroll management workflow. Customer service staff manage chargebacks and pending terms through paste-to-parse submission workflows. Owners monitor agent KPIs, manage permissions, and configure AI call auditing.

## Core Value

A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## Current State

| Attribute | Value |
|-----------|-------|
| Type | Application |
| Version | 3.0 |
| Status | Production |
| Last Updated | 2026-04-15 |
| Milestones shipped | 22 (v1.0 through v3.0) |
| Total phases | 76 |
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

**v2.8 — Hardening & Bulk Operations (2026-04-13)**
- [x] Data integrity scripts — orphan cleanup + audit backfill
- [x] Jest integration tests — 15 type fixes, chargeback flow tests, 144 passing tests
- [x] In-memory cache layer — 5 endpoints cached, 12 invalidation points
- [x] Batch commission approval with multi-select UI on payroll tab
- [x] CSV export on owner command center + owner trends tab
- [x] TypeScript implicit any elimination — 127 type errors fixed across 16 files

**v2.9 — CS Accountability & Outreach Tracking (2026-04-14)**
- [x] ContactAttempt data model (CALL/EMAIL/TEXT logging per chargeback/pending term) — Phase 65
- [x] Resolution outcome enrichment (SAVED/CANCELLED/NO_CONTACT) — Phase 65
- [x] Outreach logging UI (attempt timeline, Log Call/Email/Text buttons) — Phase 66
- [x] 48-hour stale alerts on CS agent dashboard — Phase 67
- [x] CS analytics upgrade: per-type leaderboards, attempt-count correlation chart, gate bypass rollup — Phase 68
- [x] Save rate correlation by attempt count (validates 3-call gate policy) — Phase 68

**v2.9.1 — CS Analytics Refinement & Hygiene (2026-04-14)**
- [x] Resolver credit (assistSaves) for cross-rep SAVED outcomes — Phase 69
- [x] Bypass rollup re-keyed to resolver (override-click accountability) — Phase 69
- [x] auditQueue.test.ts expectations aligned to shipped service (31/31 passing) — Phase 70
- [x] Production clawback cleanup dry-run — 0 orphans found, DB already clean — Phase 70
- [x] Audit-log backfill script archived as not needed — Phase 70

**v2.9.2 — Parser & Payroll Hotfix (2026-04-14)**
- [x] Receipt parser ACH detection via Method-line fallback (routing# / Bank / Checking / Savings) for blank-Type receipts — Phase 71
- [x] Net formula corrected: fronted excluded (was double-paying mid-week advances) — Phase 71
- [x] computeNetAmount pure helper extracted; carryover.ts aligned to same source of truth — Phase 71
- [x] 7-case regression test locking the net formula — Phase 71

**v3.0 — Mobile-Friendly Dashboards (2026-04-15)**
- [x] Responsive foundation: breakpoint tokens (mobileMax/tabletMin/tabletMax/desktopMin/wideMin) + mediaQuery exports in @ops/ui — Phase 72
- [x] SSR/hydration-safe responsive hooks (useBreakpoint, useIsMobile, useHasMounted) — Phase 72
- [x] Accessible MobileDrawer primitive: focus trap, focus restoration, scroll-lock correctness, prefers-reduced-motion, required ariaLabel — Phase 72
- [x] Extended responsive.css utilities (.touch-target, .bottom-sheet-base, .mobile-text-base/lg, .stack-mobile-md) — Phase 72
- [x] Dashboard nav refactored to hamburger+drawer on mobile; desktop hover-collapse preserved — Phase 72
- [x] Manager dashboard mobile: ManagerEntry stacked form + safe-area submit + mobile mini Commission Preview, ManagerSales card-per-sale via .responsive-table + data-label, ManagerTracker card-per-agent, LeadTimingHeatmap horizontal-scroll + textual swipe hint — Phase 73
- [x] .responsive-table-no-label escape valve (4-line CSS addition) for action cells + colspan rows — Phase 73
- [x] Payroll dashboard mobile: AgentSidebar→MobileDrawer (conditional mount-gate), WeekSection + AgentCard responsive-table + data-label, touch-target inputs — Phase 74
- [x] Owner dashboard mobile: OwnerOverview + OwnerTrends + OwnerKPIs + OwnerScoring retrofit (attribute-only), OwnerOverview dual-responsive coexistence (compact state + CSS classes), OwnerConfig + OwnerUsers deferred as admin-only — Phase 75
- [x] CS dashboard mobile: CSTracking dual tables + expanded Work workspace (3 inner flex rows stacked, gate-override DOM order preserved above Save, inline safe-area submit), CSMyQueue StaleOverviewCard, CSSubmissions both review tables, CSResolvedLog, CSAnalytics leaderboards + wide-leaderboard useIsMobile-gated swipe hint, zero CS mutation-logic/Recharts/sr-only modifications (AC-4 structural guarantee via git-diff +/- parity) — Phase 76

### Active (In Progress)

None. v3.0 milestone shipped.

### Planned (Next)
None.

**v2.7 — Analytics & Command Center (2026-04-10)**
- [x] fontSize standardization (97 remaining values → tokens)
- [x] Manager tracker upgrade (call quality tiers, KPI sparklines, longest call, conversion eligibility)
- [x] Owner command center (today's pulse, stat cards, leaderboard, activity feed)
- [x] Owner trends tab (Recharts: revenue trends, agent KPI trends, lead source effectiveness, call quality distribution)
- [x] CS analytics tab (rep performance, chargeback patterns, pending term categories, drill-down, CSV export)

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
| Fronted additive in net formula | Fronted is cash advance (positive), not deduction | Reversed in Phase 71 (2026-04-14) |
| Fronted EXCLUDED from net formula | Fronted is a mid-week cash advance — already in agent's pocket; additive double-paid. Net = payout + adj + bonus - hold. Fronted still drives next-period hold via carryover.ts on lock | Active |
| computeNetAmount single source of truth | Any file computing agent net imports from services/payroll — prevents duplicate inline formulas drifting (bug discovered when carryover.ts had its own copy) | Active |
| Parser Method-line ACH fallback | When receipt "Type:" line is blank, inspect "Method:" line for routing# or Bank/Checking/Savings keywords | Active |
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
| Polymorphic FK for ContactAttempt | One table, two nullable FKs — simpler than two tables or polymorphic pattern | Active |
| Resolution gate: 3 CALL attempts | Only CALL type counts; EMAIL/TEXT supplementary; pre-v2.9 bypass | Active |
| Assignee-credit attribution (not resolver-credit) | Accountability belongs to assigned rep regardless of who resolves | Active |
| V2.9 cutoff split for outreach metrics | Pre-2026-04-13 records excluded from attempt-based metrics, included in outcome-based | Active |
| Unknown assignees surface under "(unassigned/unknown)" | Attribution gaps must be visible to owners, never silently dropped | Active |
| 366d max range cap on analytics endpoints | Prevents unbounded aggregation scans; 400 on over-range | Active |
| Safe-default analytics error contract | Sub-query failures return empty arrays/zero counts, never null | Active |
| Attribution model EXTENDED — assignee-credit preserved + resolver-credit added | Both accountability (who owns workload) and production (who actually saves) need to be visible | Active |
| assistSaves follows OUTCOME cutoff semantics | Pre-v2.9 cross-rep SAVEDs count as assist — matches saved/cancelled rule | Active |
| Bypass overrides credited to resolver, not assignee | Whoever clicks the override button owns that choice | Active |
| Data-integrity signals surface, not hidden — "(unresolved)" + "(owner/admin override)" buckets | Edge cases must be visible to owners, never silently formatted | Active |
| Breakpoint tokens use explicit Max/Min suffixes (mobileMax, tabletMin, desktopMin...) | Ambiguous `mobile`/`desktop` keys mixing max-width and min-width semantics would be misread by downstream mobile phases — audit-driven correction | Active |
| Responsive hooks expose `mounted` flag; consumers MUST gate viewport-dependent JSX on it | Prevents React hydration mismatch when SSR markup (desktop default) differs from client first render on mobile devices | Active |
| Dialog components in @ops/ui require `ariaLabel` at the TypeScript type level | Every dialog must be named — optional accessibility props silently regress. Compile-time enforcement is the only guardrail that scales | Active |
| Mobile responsiveness via @ops/ui primitives + inline CSSProperties + responsive.css utilities | No Tailwind, no per-app CSS files. responsive.css is the one exception (design-system package) — classes are opt-in via className | Active |
| Always inspect parent display mode before applying responsive utility classes | `.grid-mobile-1` is a no-op on `display: flex` parents; `.stack-mobile` is a no-op on `display: grid` parents. Audit-discovered bug in ManagerEntry where `.stack-mobile` had been silently failing | Active |
| Project-wide horizontal-scroll affordance: textual hint "← swipe to see all hours →" | Decided in Phase 73; reusable across Phases 75 (Owner) and 76 (CS) for any wide data grid that can't sensibly stack | Active |
| When key info lives in stacked-below sidebar on mobile, mirror it inline above primary CTA | Phase 73 ManagerEntry mini Commission Preview pattern — managers must see halvingReason warning before tapping Submit; right-column sidebar stacks below submit on mobile | Active |
| `.responsive-table-no-label` for action cells + colspan rows | Cells containing buttons or full-width edit forms must escape per-field card formatting; added in Phase 73 as the one narrow exception to "no new responsive.css selectors" | Active |
| Submit buttons on mobile: INLINE + safe-area padding, NOT sticky/fixed | Sticky submit on iOS Safari occludes the focused input when the soft keyboard opens. Inline + `paddingBottom: max(env(safe-area-inset-bottom), 16px)` is the project standard | Active |
| Before adding stack-mobile-md to a workspace container, VERIFY it isn't already flexDirection:column | Discovered Phase 76: CSTracking expanded workspace outer div was already column-stacked. Adding stack-mobile-md would be a no-op; real stacking work is on inner flex rows (pill rows, button footers) | Active |
| "Visible before CTA on mobile" is a VERIFY-and-ASSERT claim, not a relocation edit | Phase 76: gate-override block at CSTracking:1125/1417 already renders above Save Resolution footer at 1146/1438. PRECONDITION confirms DOM order; no JSX reorder. Misframing as a "lift" inflates risk | Active |
| Mutation-logic preservation proven via git-diff +/- parity grep | Phase 76 pattern: counting `+count == -count` for handler call signatures (e.g., handleResolveCb) proves className-only additions, no body changes. Structural argument beats inspection | Active |

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
*Last updated: 2026-04-15 after Phase 76 (v3.0 CS Mobile — closes v3.0 Mobile-Friendly Dashboards milestone; 5/5 phases shipped across 72 Foundation → 73 Manager → 74 Payroll → 75 Owner → 76 CS)*
