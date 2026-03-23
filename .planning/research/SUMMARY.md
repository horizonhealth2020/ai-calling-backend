# Project Research Summary

**Project:** State-Aware Bundle Commission Requirements (v1.4)
**Domain:** Commission engine enhancement for insurance/health sales operations platform
**Researched:** 2026-03-23
**Confidence:** HIGH

## Executive Summary

This milestone adds state-aware bundle commission logic to a working Ops Platform commission engine. The system already captures `memberState` on the `Sale` model and has bundle qualifier halving logic in `calculateCommission` — the required foundations exist. The core work is: (1) two new tables (`BundleRequirement` and `ProductStateAvailability`) to make addon requirements configurable per state, (2) a modified commission engine that resolves which addon qualifies for a given core product and client state before calculating payout, and (3) config UI in the existing `PayrollProducts` tab plus enhanced commission preview in `ManagerEntry`. No new dependencies are needed — the entire feature is implementable with Prisma, Zod, Express, React, and Socket.IO already in the stack.

The recommended implementation follows the existing architecture principle of keeping `calculateCommission` pure: DB lookups are resolved by the caller (`upsertPayrollEntryForSale` and the preview endpoint), and a resolved `BundleRequirementContext` object is passed into the function. A three-level fallback chain — state-specific rule, default rule, legacy `isBundleQualifier` boolean — ensures zero breaking changes to existing sales and graceful degradation before any config rows are entered. This is a configuration-driven approach: state-to-product mappings live in the database, not in code conditionals.

The primary risks are financial correctness risks, not engineering complexity. The commission preview must be updated in lockstep with the engine or agents will see different amounts than they receive. Existing sales with null `memberState` must explicitly fall through to legacy logic or every recalculation event halves their commission. The new state-based halving path must replace — not stack on top of — the existing `isBundleQualifier` path for products that have a `BundleRequirement` configured. All three of these are design decisions that must be locked before any code is written.

## Key Findings

### Recommended Stack

No new dependencies are required. Every technology needed is already present in the monorepo workspace. See [STACK.md](.planning/research/STACK.md) for the full component-by-component analysis.

**Core technologies (changes only):**
- **Prisma 5.20**: New `BundleRequirement` and `ProductStateAvailability` models — per-row state records with `@@unique([coreProductId, state])`, named relations to handle three Product foreign keys in one table
- **Zod 3.23**: Validation schemas for new bundle requirement and state availability endpoints — same `zodErr()` pattern used throughout ops-api; add 2-letter uppercase regex to existing `memberState` validation
- **Express 4.19**: CRUD routes for bundle requirements, state availability bulk PUT — same `asyncHandler` + `requireRole(PAYROLL, SUPER_ADMIN)` pattern as existing product routes
- **React / Next.js 15**: Config UI added to existing `PayrollProducts.tsx` — inline CSSProperties, `authFetch`, `@ops/ui` tokens matching existing card patterns
- **Socket.IO 4.8**: `config-changed` event emitted when bundle requirements or state availability is updated so connected clients can refresh product data
- **`US_STATES` constant in `@ops/types`**: 50 states + DC as a hardcoded array — avoids an external library for static fixed data; shared between API Zod validation and dashboard dropdowns

**What NOT to add:** Any state/province library, form library, UI component library, separate rules engine service, Redis, multi-select library, or geography library. Each is overkill for the problem size.

### Expected Features

See [FEATURES.md](.planning/research/FEATURES.md) for full feature table with complexity ratings and dependency mapping.

**Must have (table stakes):**
- Client state field wired into commission logic — `memberState` exists on `Sale`, parser extracts it, form has a free-text input; needs to feed into `calculateCommission`
- State availability per addon product — `ProductStateAvailability` join table, toggle UI per product per state
- Primary bundle requirement per core product — `BundleRequirement` model defining which addon is required for full commission in a given state
- Fallback bundle requirement for unavailable states — fallback addon field so agents in restricted states are not unfairly penalized with a half-rate when the primary simply cannot be sold there
- Commission engine state-aware qualification — `calculateCommission` checks primary then fallback addon given client state
- Commission preview reflects state logic — preview endpoint accepts `memberState` and shows state-aware messaging (which addon qualifies, or why half-rate applies)
- Products tab config UI — bundle requirement and state availability sections in existing `PayrollProducts` product cards
- Validation on sale submission — warn or reject if required addon is unavailable in the client's state

**Should have (differentiators):**
- Auto-suggest qualifying addons by state in the sales entry form — highlight or filter addons that apply for the selected client state; reduces agent errors at entry time
- Commission audit trail with state reasoning — store "Full: Better addon (FL fallback for Compass VAB)" reasoning for dispute resolution

**Defer to v2+:**
- State availability bulk matrix editor (all products x all states in one grid) — nice for initial data entry but not blocking
- Effective-dated state availability — tracking when products became available per state adds major complexity; current need is present state only
- Multi-fallback chains — single primary + single fallback covers stated business requirements
- Per-agent state licensing management — a different concern from product availability; out of scope

### Architecture Approach

The architecture is a minimal additive extension of the existing pattern with two new database tables and targeted modifications to three existing files. A new `resolveBundleRequirement()` service function handles all DB lookups and returns a simple context object. `calculateCommission` receives that context as an optional second parameter and remains a pure synchronous function. Config UI is embedded inline as collapsible sections on existing `ProductCard` components (CORE products get a bundle requirement section; ADDON products get a state availability section) rather than a new tab or page. Preview endpoint mirrors engine changes in lockstep. See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for the full data flow diagrams, migration SQL, and build order.

**Major components:**
1. `BundleRequirement` table — maps a core product to required primary addon, optional fallback, and the client state the mapping applies to (`state = null` = default rule for all other states)
2. `ProductStateAvailability` table — maps addon products to states where they are available; drives `resolveBundleRequirement` decision to route to primary or fallback
3. `resolveBundleRequirement()` service function — three-level resolution: state-specific rule -> default rule -> null (triggers legacy `isBundleQualifier` fallback)
4. Modified `calculateCommission(sale, bundleReq?)` — when context provided, checks primary then fallback addon; when null, uses existing `qualifierExists` logic unchanged; backward compatible for all legacy sales
5. Config UI in `PayrollProducts.tsx` — collapsible sections on product cards, checkbox grid for state availability, primary/fallback addon dropdowns for bundle requirements
6. CRUD API routes — `GET/POST/PATCH/DELETE /api/bundle-requirements`, `GET/PUT /api/products/:id/state-availability`

**What does NOT change:** `Sale` model, `Product.isBundleQualifier` flag (stays as fallback), `SaleAddon` model, `PayrollEntry` model, Socket.IO event payloads, auth/RBAC middleware, export/CSV logic.

### Critical Pitfalls

See [PITFALLS.md](.planning/research/PITFALLS.md) for all 14 pitfalls with phase assignments, specific line references, and detection strategies.

1. **Commission preview diverges from engine (P1)** — The `/sales/preview` endpoint builds `mockSale as any` without `memberState`. When state-aware logic is added, preview and actual payout will differ. Fix: add `memberState` to the preview Zod schema, pass it through to the mock, and change both the engine and preview in the same PR. Write a test asserting preview output equals engine output for the same inputs across multiple states.

2. **Legacy sales with null memberState get wrong commission on recalculation (P2)** — `memberState` is nullable; existing sales have it as null. If new logic treats null as "no addon available in this state," every recalculation halves legacy payout. Fix: `memberState === null` must explicitly skip state-aware logic and fall through to the existing `qualifierExists` boolean. Run all 20+ existing commission tests unchanged as a gate before any engine change ships.

3. **Double halving when old and new conditions both fire (P3)** — Two independent halving `if` blocks produce 25% commission instead of 50%. Fix: the state-aware path must replace the `isBundleQualifier` path when a `BundleRequirement` is configured for the core product. One halving check fires per sale. Resolve as a business rule in design, not during coding.

4. **Empty config table in production (P4)** — Deploying the engine before any `BundleRequirement` rows exist causes unpredictable commission behavior. Fix: the fallback chain ensures existing `isBundleQualifier` logic applies when no rows exist, making empty config safe. Config UI and initial data entry must be in place before enabling state-aware logic in production for active products.

5. **Sale edit flow incorrect clawback when memberState changes (P5)** — `handleSaleEditApproval()` recalculates commission after field updates. If `memberState` is read before being written to the DB, the clawback delta is computed against the old state. Fix: confirm field-update-before-recalculate ordering handles `memberState`; audit log must capture state changes; test A->B and B->A state transitions against clawback amounts.

## Implications for Roadmap

The dependency graph is clear and the phase order is not negotiable: business rules locked before schema, schema before engine, engine before API, API before UI, UI before end-to-end validation. The fallback chain design enables safe production deployment at any intermediate phase because unconfigured products continue to use existing `isBundleQualifier` logic.

### Phase 1: Business Rule Decisions and Schema Foundation

**Rationale:** Three decisions must be locked before any code: (1) `commissionApproved = true` bypasses state-based halving (consistent with current bypass of all other halving), (2) state-aware path replaces `isBundleQualifier` path for products with a `BundleRequirement` row — no double halving, (3) `memberState === null` falls through to legacy logic unchanged. Wrong answers to any of these produce incorrect payroll numbers at scale. Schema migration and the `resolveBundleRequirement` service function follow immediately after.
**Delivers:** Locked business rules documented in plan; Prisma schema with `BundleRequirement` and `ProductStateAvailability`; migration; `resolveBundleRequirement()` in `services/payroll.ts`; modified `calculateCommission()` with `BundleRequirementContext` parameter; all 20+ existing commission tests passing unchanged; new tests for state-aware scenarios (primary present, fallback used, neither present, null state)
**Addresses:** Primary bundle requirement model, fallback bundle requirement model, state availability model, backward compatibility for all legacy data
**Avoids:** P2 (null state regression), P3 (double halving), P4 (empty config safety via fallback chain), P14 (FL exemption re-introduction — existing test kept as canary)

### Phase 2: API Routes and Preview Enhancement

**Rationale:** The UI cannot function without the API, and commission preview accuracy is a user trust issue that cannot lag behind the engine. Both belong in the same phase.
**Delivers:** `GET/POST/PATCH/DELETE /api/bundle-requirements` routes; `GET/PUT /api/products/:id/state-availability` routes; `memberState` added to preview Zod schema; `resolveBundleRequirement` called in preview endpoint; bundle requirement breakdown added to preview response; `US_STATES` constant in `@ops/types`
**Uses:** Existing `asyncHandler`, `zodErr()`, `requireRole(PAYROLL, SUPER_ADMIN)` patterns; bulk PUT for state availability saves 50 individual calls
**Avoids:** P1 (preview divergence — must update preview in same phase as engine change), P6 (preview performance — extend product query via Prisma `include` to avoid extra round-trips), P11 (invalid state codes — add 2-letter uppercase regex validation)

### Phase 3: Config UI in PayrollProducts

**Rationale:** Payroll admins must be able to configure bundle requirements before any end-to-end commission flow can be tested or verified. This is the operational setup phase.
**Delivers:** Collapsible "Bundle Requirements" section on CORE product cards (default rule + per-state overrides); collapsible "State Availability" section on ADDON/AD_D product cards (50-state checkbox grid); config completeness indicator ("X of Y states configured"); `config-changed` Socket.IO event emitted on save
**Implements:** Config UI architecture component, inline per-product sections, bulk state PUT integration
**Avoids:** P4 (completeness indicator surfaces gaps), P8 (fallback confusion — UI shows which addon qualifies per state), P9 (stale client config — Socket.IO event triggers refresh on connected dashboards)

### Phase 4: Sales Entry Integration and End-to-End Validation

**Rationale:** With schema, engine, API, and config UI in place, this phase closes the agent-facing loop and validates the complete data flow. It is intentionally last because all upstream pieces must be solid before UX polish is meaningful.
**Delivers:** Enhanced commission preview panel with state-aware messaging ("Required addon unavailable in FL — fallback (Dental Plus) included" / "No required addon present — half rate applied"); addon checklist auto-highlights qualifying addons for the entered client state; `memberState` field made prominent with dropdown (using `US_STATES`); `memberState` added to CSV export columns; validation warning when required addon not selected for the client's state; full clawback flow tested for state A -> B and B -> A transitions
**Avoids:** P1 (final verification that preview matches engine across states), P5 (edit flow clawback with state change validated), P8 (agents see which addon qualifies and why), P10 (CSV export missing state context), P12 (paste parser state extraction validated with multi-address samples)

### Parallel: Housekeeping (No Dependencies)

Role dashboard selector delay fix and removal of seed agents have zero dependency on bundle commission work. Can be completed alongside any phase.

### Phase Ordering Rationale

- Phase 1 before Phase 2: `resolveBundleRequirement()` must exist before the API can call it; all existing tests must pass before any code ships to confirm backward compatibility
- Phase 2 before Phase 3: API must exist before config UI can save data; preview must be correct before agent-facing polish can be built
- Phase 3 before Phase 4: Config must be populated before end-to-end flows can be verified and before addon suggestion UI is meaningful
- The fallback chain enables deploying Phase 1 and Phase 2 to production before Phase 3 config is fully populated — unconfigured products degrade to current behavior with no incorrect payouts, giving a safe incremental rollout path

### Research Flags

Phases with standard patterns (skip `/gsd:research-phase`):
- **Phase 2:** CRUD route patterns are identical to existing product routes — no novel API integration needed
- **Phase 3:** UI patterns follow existing `PayrollProducts` CRUD card structure exactly; 50-state checkbox grid is a simple `Array.map` over `US_STATES`
- **Phase 4:** Preview endpoint extension follows existing breakdown pattern; CSV export follows existing export query patterns

Phases that need a design decision before planning begins (not research — stakeholder input):
- **Phase 1:** P3 (double halving business rule) and P7 (`commissionApproved` scope for state-based halving) are product decisions, not engineering unknowns. Both must be answered before Phase 1 is planned.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All decisions verified by direct inspection of package.json, schema.prisma, and payroll.ts. No new packages required. |
| Features | HIGH | Derived from direct codebase reading of existing commission logic, form fields, and schema. Feature inventory cross-referenced against PROJECT.md v1.4 requirements. |
| Architecture | HIGH | All recommendations based on direct codebase analysis with specific line references. Fallback chain design is provably backward-compatible. Pure function constraint verified against current design. |
| Pitfalls | HIGH | All 14 pitfalls derived from direct code inspection with specific line numbers. Five critical pitfalls trace to concrete code paths that will produce incorrect payroll numbers without mitigation. |

**Overall confidence:** HIGH

### Gaps to Address

- **Schema approach divergence between research files**: STACK.md recommends `String[]` on `BundleRequirement` (one row per core product with an array of states), while ARCHITECTURE.md recommends `state VARCHAR(2)` per row (one row per core product + state, `@@unique([coreProductId, state])`). ARCHITECTURE.md's per-row approach is more queryable, auditable, and consistent with PostgreSQL relational patterns. Roadmapper should resolve this in requirements before Phase 1 is planned. Recommendation: use ARCHITECTURE.md's per-row approach.

- **Business rule: double halving (P3)**: Does configuring a `BundleRequirement` for a product retire the `isBundleQualifier` check for that product, or can both fire independently? Requires stakeholder answer before Phase 1. Research recommendation: state-aware path replaces legacy path for products with a configured `BundleRequirement` row.

- **Business rule: commissionApproved scope (P7)**: Does `commissionApproved = true` bypass the new state-based halving check? Research recommendation: yes, consistent with current behavior where it bypasses all other halving. Confirm with stakeholders before Phase 1.

- **Initial config data scope**: Which states are currently active in the business? Seed data for `BundleRequirement` and `ProductStateAvailability` should be scoped to active states, not all 50. This is a data gathering task for payroll staff, not an engineering task.

## Sources

### Primary (HIGH confidence — direct codebase inspection)

- `prisma/schema.prisma` — Product model, Sale.memberState field (line 176), ProductType enum, existing relations
- `apps/ops-api/src/services/payroll.ts` — `calculateCommission` bundle qualifier halving (line 162), `upsertPayrollEntryForSale`, `handleSaleEditApproval`
- `apps/ops-api/src/routes/index.ts` — preview endpoint (lines 440-496), sale creation (lines 320-437), memberState validation (lines 335, 562)
- `apps/ops-api/src/services/__tests__/commission.test.ts` — 20+ test cases including FL exemption removed test (lines 372-388), test helper defaults (lines 44-73)
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` — CRUD card pattern, authFetch usage, inline styles
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` — paste parser (lines 195-199), addon checklist, preview trigger
- `apps/ops-api/package.json` — Prisma ^5.20.0, Zod ^3.23.8, Express ^4.19.2, Socket.IO ^4.8.3
- `.planning/PROJECT.md` — v1.4 requirements, design decisions, constraints

### Secondary (MEDIUM confidence)

- [KFF: Regulation of Private Health Insurance](https://www.kff.org/patient-consumer-protections/health-policy-101-the-regulation-of-private-health-insurance/) — state-by-state product approval requirements in insurance domain
- [AgencyBloc: Agency Management for Health & Life Insurance](https://www.agencybloc.com/) — commission tracking patterns in insurance platforms
- [EvolveNXT: Health Insurance Commission Software](https://evolvenxt.com/solutions-2020/health-insurance-carriers/) — commission management platform patterns

---
*Research completed: 2026-03-23*
*Ready for roadmap: yes*
