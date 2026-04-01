# Phase 20: State-Aware Bundle Requirements - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the complete state-aware bundle commission feature: schema changes, commission engine modification, API routes, config UI in payroll Products tab, client state dropdown on sales entry, and housekeeping fixes (role selector delay, seed agent removal). All 14 v1.4 requirements in one consolidated phase.

</domain>

<decisions>
## Implementation Decisions

### Data Model
- **D-01:** State availability uses a join table (`ProductStateAvailability`) with productId + stateCode rows. Standard relational, easy to query "which products are available in FL?"
- **D-02:** Bundle requirement config lives as fields on the Product model for CORE products — `requiredBundleAddonId` (FK to Product) and `fallbackBundleAddonId` (FK to Product). No separate BundleRequirement table.
- **D-03:** Per-state logic comes from the addon's state availability, not from the core product. The engine checks: is the core's required addon available in the client's state? If not, check the fallback addon's state availability.
- **D-04:** For multiple fallback tiers (BUNDLE-04), can chain additional fallback fields later. One fallback is sufficient for now.

### Commission Engine
- **D-05:** State-aware halving REPLACES the existing `isBundleQualifier` halving at `payroll.ts:162` — no double halving possible. For products with a `requiredBundleAddonId` configured, the state-aware path fires. Legacy `isBundleQualifier` check only fires when no bundle requirement is configured.
- **D-06:** `commissionApproved = true` bypasses state-based halving (consistent with existing behavior).
- **D-07:** `memberState === null` falls through to legacy `isBundleQualifier` logic — backward compatible.
- **D-08:** Three-tier fallback chain: (1) Check required addon availability in state → (2) Check fallback addon availability → (3) Legacy isBundleQualifier check.

### Commission Halving UX
- **D-09:** Halving reason stored as a new field on PayrollEntry (`halvingReason` — captures reason at time of calculation, survives config changes).
- **D-10:** Halving reason displays as inline text below the commission amount, e.g., "Half commission — Compass VAB not bundled (FL)".

### Config UI
- **D-11:** CORE product cards get a collapsible "Bundle Requirements" section within the existing card edit view — required addon selector and fallback addon selector.
- **D-12:** ADDON product cards get a "State Availability" section with a searchable multi-select dropdown for US states.
- **D-13:** Completeness indicator on CORE products shows which states lack bundle coverage.

### Sales Entry
- **D-14:** Client state dropdown added to sales entry form, populating the existing `memberState` field (VarChar(2), already in schema).

### Housekeeping
- **D-15:** Role dashboard selector delay increased/configurable to prevent premature collapse.
- **D-16:** Seed agents (Amy, Bob, Cara, David, Elena) removed from database seed script.

### Claude's Discretion
- US state list implementation (hardcoded constant vs fetched) — recommend hardcoded in @ops/types or @ops/utils
- Socket.IO event names for config changes
- Exact text format of halving reason strings
- Completeness indicator visual design

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Commission Engine
- `apps/ops-api/src/services/payroll.ts` — calculateCommission function (lines 94-188), the halving logic at line 162, and upsertPayrollEntryForSale
- `apps/ops-api/src/services/__tests__/commission.test.ts` — existing commission tests (must all pass unchanged)
- `apps/ops-api/src/services/__tests__/status-commission.test.ts` — status-related commission tests

### Schema
- `prisma/schema.prisma` — Product model, Sale model (memberState at line 176), PayrollEntry model

### API Routes
- `apps/ops-api/src/routes/index.ts` — existing product CRUD endpoints, preview endpoint

### Config UI
- PayrollProducts component in ops-dashboard — existing product card CRUD pattern

### Research
- `.planning/research/SUMMARY.md` — synthesized research findings
- `.planning/research/PITFALLS.md` — 14 pitfalls to avoid (especially P1: preview sync, P3: double halving, P4: empty config)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `calculateCommission` function (payroll.ts:94) — pure function, takes SaleWithProduct, returns number. Modification point for state-aware logic.
- `qualifierExists` check (payroll.ts:106) — `allEntries.some(e => e.product.isBundleQualifier)` — this is what gets replaced/extended.
- Product card CRUD pattern in PayrollProducts — collapsible edit cards with inline form fields.
- `memberState` field already on Sale model (VarChar(2)) — just needs UI dropdown.

### Established Patterns
- Commission logic is pure in `calculateCommission`, side effects in `upsertPayrollEntryForSale` caller.
- Product CRUD: Zod validation → asyncHandler route → Prisma query → Socket.IO emit.
- Inline React.CSSProperties with dark glassmorphism theme, constant objects (CARD, BTN, INP).
- PayrollEntry includes relation to Sale and Product for display.

### Integration Points
- `calculateCommission` needs to accept bundle requirement context (required addon, fallback, state availability)
- `upsertPayrollEntryForSale` needs to resolve bundle requirements and pass to calculateCommission, also store halvingReason
- Preview endpoint (`/sales/preview`) needs memberState parameter and state-aware logic
- Product API routes need new fields (requiredBundleAddonId, fallbackBundleAddonId)
- New ProductStateAvailability CRUD routes

</code_context>

<specifics>
## Specific Ideas

- Compass VAB is the current primary required addon, unavailable in Florida
- Better addon is the fallback for Florida
- The config should be easy to change — admin just picks different products in the dropdowns
- Keep it simple — requirement logic lives in payroll, halving highlighted with a reason

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-state-aware-bundle-requirements*
*Context gathered: 2026-03-23*
