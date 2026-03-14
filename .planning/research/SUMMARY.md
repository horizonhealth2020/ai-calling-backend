# Project Research Summary

**Project:** Ops Platform — Payroll & Usability Overhaul
**Domain:** Internal sales operations platform (commission management, payroll, real-time dashboards)
**Researched:** 2026-03-14
**Confidence:** HIGH

## Executive Summary

This is a sales operations platform overhaul focused on fixing a broken commission and payroll pipeline, then layering usability improvements on top. The platform is a Next.js 15 monorepo with an Express API, Prisma/PostgreSQL, and Socket.IO — a mature, sufficient stack that requires zero new dependencies. The recommended approach is to fix correctness issues first (sale creation crashes, wrong period assignment, fragile commission logic) before addressing any UI or feature work. Attempting to build new features on a broken data pipeline will compound defects and make testing impossible.

The most important finding across all research dimensions is that the platform has 6 critical bugs that must be resolved before any other work proceeds. The most severe is a `memberState` reference in `payroll.ts` that causes a 500 error on every sale creation attempt — meaning the core action of the entire platform is completely broken today. Fixing this single bug unblocks all downstream testing, commission validation, payroll verification, and dashboard cascade work.

The primary risk is complexity accumulation in the commission engine: bundle detection via string matching, per-addon premium ambiguity, and inconsistent net-amount formulas across create/update paths all create a system that silently produces wrong pay. The mitigation strategy is to extract commission logic into pure, tested functions before wiring any UI on top of it.

## Key Findings

### Recommended Stack

The existing stack is fully sufficient — no new packages are needed. Every requirement maps cleanly to an already-installed library. See `.planning/research/STACK.md` for the full assessment.

**Core technologies:**
- Express 4.19.2: REST API layer — no change needed
- Prisma 5.20.0 + PostgreSQL 15+: data persistence — schema changes needed, not ORM changes
- Next.js 15 / React 18: all five frontend dashboards — no version changes
- Socket.IO 4.8.3: real-time events — extend existing, do not replace
- Zod 3.23.8: request validation — already in use, enforce consistently
- Luxon 3.4.4: date/period arithmetic — already installed but underused; use for arrears period logic
- Recharts 3.8.0: charting for KPI dashboards — already in place

**What not to add:** decimal.js, React Hook Form, react-window, Redux/Zustand, TanStack Query, Tailwind — all are explicitly out of scope given codebase conventions and data scale.

### Expected Features

See `.planning/research/FEATURES.md` for the full feature table with complexity and dependency mapping.

**Must have (table stakes):**
- Sale creation without errors — unblocks the entire platform
- Multi-product selection per sale with per-product commission rules
- Commission engine: bundle detection, arrears period assignment, enrollment fee rules, ACH delay
- Payroll period workflow: Pending → Ready → Finalized with export
- Dashboard cascade: sale creation updates manager tracker, sales board, payroll cards, and owner KPIs in real time
- Scrollable payroll cards (currently breaks with many agents)
- Form validation with visible error display

**Should have (differentiators):**
- Live commission preview as products are selected (before submit)
- Trend KPIs on owner dashboard (vs prior week/month)
- Agent performance scoring beyond raw counts
- Bulk sale import from CSV

**Defer to v2+:**
- Commission dispute workflow (high complexity, low urgency)
- Automated payroll provider integration
- Mobile native app
- Custom report builder
- Agent self-service portal
- Automated clawback triggers

### Architecture Approach

The architecture follows a clean hub-and-spoke model: `ops-api` is the authoritative hub for all financial writes, dashboards are spokes that read via HTTP and receive real-time notifications via Socket.IO. The key architectural principle is that commission calculation must be server-authoritative — the API calculates and persists, the UI only displays previews. The current architecture violates several of its own design intent through the bugs enumerated below. The fix strategy preserves the existing component boundaries while making the data flow actually correct. See `.planning/research/ARCHITECTURE.md` for the full target data flow.

**Major components:**
1. Payroll Service (`payroll.ts`) — commission calculation, period assignment; must be refactored into pure functions before UI work
2. Socket.IO Layer — currently only emits audit events; needs `sale:created`, `payroll:updated`, `kpi:refresh` events added
3. Manager Dashboard — primary sale entry point; needs multi-product form with commission preview
4. Payroll Dashboard — period management and exports; needs scrollable cards and finalized-period write guards
5. Owner Dashboard — KPI aggregation; needs standardized date ranges and Socket.IO refresh
6. Product model — needs `isBundleQualifier` boolean flag to replace string-matching bundle detection

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for all 15 pitfalls with phase assignments.

1. **Sale creation 500 (`memberState` missing)** — Fix first. Every POST to `/api/sales` crashes. Either add the field via migration or remove the dead reference. Nothing else can be tested until this is resolved.
2. **Week-in-arrears not implemented** — `getSundayWeekRange` maps to the current week, not the following week. Rewrite with +1 week offset (standard) and +2 weeks for ACH. Unit-test with boundary dates.
3. **Floating-point commission rounding** — Prisma Decimal cast to Number before arithmetic accumulates drift. Apply `Math.round(value * 100) / 100` at each calculation step, not just at display.
4. **String-matching bundle detection** — `product.name.includes("Compass VAB")` breaks silently on rename. Add `isBundleQualifier: Boolean` to the Product schema and check the flag.
5. **Net amount desync (create vs update)** — Extract a single `calculateNetAmount(payout, adjustment, bonus, fronted)` function used by both create and update paths to prevent formula drift.

## Implications for Roadmap

The feature dependency chain is unambiguous and dictates phase order: sale creation must work before commission accuracy can be verified, which must be verified before payroll period assignment can be trusted, which must be trusted before dashboard cascade can be meaningful, which must be working before reporting is useful.

### Phase 1: Fix the Pipeline (Critical Bugs)

**Rationale:** Six critical bugs make the platform non-functional for its core purpose. No other work has value until sale creation succeeds and commissions are calculated correctly. This phase has no user-facing UI scope — it is pure correctness work.
**Delivers:** A working sale creation flow with accurate commissions and correct period assignment.
**Addresses:** Features 1–14 (sales entry + commission engine prerequisites)
**Avoids:** P1 (sale 500), P2 (arrears logic), P3 (rounding), P4 (string matching), P5 (addon premium), P6 (net amount desync), P7 (UTC/timezone), P14 (fallback silencing errors)
**Schema changes required:** Add `memberState` or remove reference; add `isBundleQualifier` to Product; clarify SaleAddon premium (per-product or shared)

### Phase 2: Wire the Cascade (Real-Time Dashboard Updates)

**Rationale:** Once commissions and periods are correct, Socket.IO events can be added without risk of broadcasting wrong data. This phase makes the data flow observable across all dashboards.
**Delivers:** Sale creation updates manager tracker, payroll cards, sales board leaderboard, and owner KPIs in real time — no manual refresh needed.
**Addresses:** Features 20–23 (dashboard cascade)
**Avoids:** P8 (sale edits skip recalculation), P9 (no socket events for sale CRUD)
**Stack used:** Socket.IO room-based broadcasting — extend existing, no new library

### Phase 3: Payroll UX (Period Workflow + Export)

**Rationale:** With correct data flowing, payroll dashboard usability can be addressed: scrollable cards, period status transitions, finalized-period write guards, and CSV export.
**Delivers:** Payroll team can manage full period lifecycle without workarounds, export finalized payroll to CSV.
**Addresses:** Features 15–19 (period management, scrollable cards, export)
**Avoids:** P10 (multi-product double-submit), P11 (writes to finalized periods)
**Stack used:** Server-side CSV generation (string concatenation or `papaparse` — decide based on whether import is also needed)

### Phase 4: Multi-Product Sale Form (Manager Dashboard)

**Rationale:** The multi-product form is the most complex UI work and depends on a stable commission engine (Phase 1) and working cascade (Phase 2). Building it earlier would require rebuilding against a moving target.
**Delivers:** Managers can enter sales with multiple products, see live commission preview before submission, and select payment type with correct arrears implications.
**Addresses:** Features 2–6 (multi-product, payment type, commission preview, sale edit)
**Avoids:** P10 (double-submit idempotency)
**Stack used:** `useReducer` with typed actions for form state; commission preview via API call, not client-side calculation

### Phase 5: Reporting + Owner KPIs

**Rationale:** Reporting is only trustworthy once Phases 1–4 produce correct data. This phase surfaces aggregated data for decision-making.
**Delivers:** Per-agent commission totals, cost-per-sale, weekly/monthly period summaries, owner trend KPIs.
**Addresses:** Features 24–27 (reporting), Feature 4 (trend KPIs) from differentiators
**Avoids:** P12 (clawback period targeting for ACH), P15 (date range mixing in owner dashboard)
**Stack used:** Luxon for standardized date range queries across routes

### Phase 6: Polish + Performance

**Rationale:** Final pass on form UX, error messages, validation consistency, and query performance once all features are stable.
**Delivers:** Production-quality UI with consistent error handling and performant queries under load.
**Addresses:** Features 28–29 (form validation, responsive layouts), leaderboard indexing
**Avoids:** P13 (leaderboard query performance at scale)

### Phase Ordering Rationale

- Phase 1 before everything: the 500 error on sale creation makes ALL other work untestable. This is non-negotiable.
- Phase 2 before Phase 3 and 4: socket events should broadcast correct data; adding them before the commission engine is fixed would require re-testing cascade behavior after Phase 1 fixes.
- Phase 3 before Phase 4: period finalization guards must exist before the multi-product form can submit sales that target specific periods.
- Phase 5 after Phase 3: reports over finalized periods require finalization to work correctly.
- Phase 6 last: polish is meaningless on broken functionality.

### Research Flags

Phases that have well-documented patterns (no additional research needed during planning):
- **Phase 2:** Socket.IO room-based broadcasting is standard; emit-then-refetch pattern is well established.
- **Phase 3:** Server-side CSV export and status machine (Pending → Ready → Finalized) are standard patterns.
- **Phase 6:** Query indexing and form polish are routine.

Phases that may benefit from deeper research during planning:
- **Phase 1:** The SaleAddon premium ambiguity (P5) requires a business decision before the schema can be finalized. Clarify whether products on a sale share one premium or have per-product premiums. This is a requirements gap, not a technical gap.
- **Phase 4:** The multi-product commission preview requires careful API design (preview endpoint vs. client-side approximation). The anti-feature list explicitly prohibits client-side calculation — confirm that a preview API endpoint with debounced calls is the accepted UX pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack fully mapped to requirements; no external sources needed — codebase is the source of truth |
| Features | MEDIUM-HIGH | Feature list derived from business rules in codebase + commission spec; SaleAddon premium business rule is an open question |
| Architecture | HIGH | Bugs identified by direct code inspection; target flows are unambiguous derivations from requirements |
| Pitfalls | HIGH | All critical pitfalls confirmed by reading actual code — not speculative; phase assignments match dependency chain |

**Overall confidence:** HIGH

### Gaps to Address

- **SaleAddon premium model:** Do all products on a sale share one `sale.premium`, or does each product have its own? This is an unresolved business requirement that affects the schema and commission engine. Resolve in Phase 1 planning before writing any schema migration.
- **CSV vs Excel export:** CSV recommended (universal payroll import compatibility). If Excel is required, add `exceljs` server-side only. Confirm with stakeholders before Phase 3.
- **Luxon timezone convention:** UTC vs local timezone must be standardized explicitly. Recommend UTC throughout with Luxon. Document the decision in code before Phase 1 arrears fix lands.
- **Commission preview endpoint design:** Whether to add a `POST /api/sales/preview` endpoint or compute server-side on the existing create route (dry-run mode) should be decided before Phase 4 begins.

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection (`apps/ops-api/src/services/payroll.ts`) — commission engine bugs, period assignment, net amount formula
- Codebase direct inspection (`apps/ops-api/src/routes/index.ts`) — route structure, Zod schemas, middleware chain
- Codebase direct inspection (`prisma/schema.prisma`) — model fields, relations, missing `memberState`
- Codebase direct inspection (`apps/ops-api/src/socket.ts`) — current socket event coverage
- `CLAUDE.md` — architecture conventions, stack constraints, known gotchas

### Secondary (MEDIUM confidence)
- Commission business rules inferred from existing code patterns and product naming conventions
- Feature phasing derived from dependency chain analysis across FEATURES.md and ARCHITECTURE.md

### Tertiary (LOW confidence)
- SaleAddon premium semantics — inferred from current code behavior, not confirmed against business specification; needs stakeholder validation

---
*Research completed: 2026-03-14*
*Ready for roadmap: yes*
