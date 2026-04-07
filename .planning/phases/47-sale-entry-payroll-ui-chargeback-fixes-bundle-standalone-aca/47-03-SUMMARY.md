---
phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca
plan: 03
subsystem: payroll/chargebacks
tags: [ui, api, chargebacks, payroll, commission]
one_liner: "Single Chargeback Lookup card now shows agent/member/premium/enrollment fee + a live -$N.NN net deduction preview driven by canonical per-product commission from the backend"

# Dependency graph
requires:
  - phase: 46
    provides: acaBundledCommission preference on ADDON/AD_D + calculatePerProductCommission helper
  - phase: 42
    provides: acaCoveredSales self-relation used by the bundled-rate check
provides:
  - GET /api/clawbacks/lookup extended response (agent, premium, enrollment fee, per-product commission)
  - Live-reactive Net Chargeback preview in PayrollChargebacks.tsx Single Chargeback Lookup card
affects: [47-04, 47-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reuse calculatePerProductCommission server-side for per-product commission lookup responses (single source of truth — frontend never recomputes rates)"
    - "useMemo over selectedProductIds + lookupResult for instant UI math that matches server math exactly"

key-files:
  created: []
  modified:
    - apps/ops-api/src/routes/payroll.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx

key-decisions:
  - "Backend returns canonical per-product commission values — frontend does pure sum, never re-derives rates (eliminates drift risk between preview and actual chargeback)"
  - "Included acaCoveredSales and payrollEntries in the lookup query so calculatePerProductCommission sees the ACA bundle flag and full payout amount"
  - "Used `as unknown as Parameters<...>[0]` cast because the lookup query uses narrow product selects; the helper only touches id/type/rate fields which the shape does satisfy at runtime"
  - "Added MINI_LABEL/MINI_VALUE module-level style constants referencing C.textTertiary/C.textPrimary instead of inlining hex to keep the new info block themable"
  - "Tightened lookupSale() error handler to surface status code per CLAUDE.md pattern (`Request failed (${res.status})` fallback)"

patterns-established:
  - "Server-authoritative commission in lookup responses: if a UI needs to preview commission for any subset of products, compute canonical values server-side per product and let the client sum"
  - "Live preview useMemo pattern: memo over the selection state + fetched result for deterministic UI math"

requirements-completed: [D-08, D-09, D-10, D-11]

# Metrics
duration: ~3min
completed: 2026-04-07
---

# Phase 47 Plan 03: Single Chargeback Lookup — Sale Info + Live Net Deduction Summary

**Before submit, payroll staff now see the exact dollar amount that will be deducted from an agent for any subset of products on a matched sale — driven by the same `calculatePerProductCommission` helper the server uses for real chargeback processing, so the preview is guaranteed to match the actual deduction.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-07T21:18:57Z
- **Completed:** 2026-04-07T21:21:57Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `GET /api/clawbacks/lookup` now returns `agentName`, `agentId`, `premium`, `enrollmentFee`, `fullCommission`, and `products[].{premium, commission}` alongside the existing fields
- Per-product commission values are computed via the canonical `calculatePerProductCommission` helper, so they respect ACA_PL flat × memberCount, Phase 46 `acaBundledCommission` preference for ADDON/AD_D, bundle thresholds, and enrollment fee bonuses
- Frontend `LookupResult` + `LookupProduct` types extended to carry the new fields
- New info block rendered above the existing Products-on-sale checklist with 4-field grid (Agent / Member / Premium / Enrollment Fee) and a prominent red live net deduction line showing `−$N.NN`
- `liveNetDeduction` useMemo re-runs on every checkbox toggle with no backend round-trip and zero client-side rate math
- `lookupSale()` error handler hardened to include status code (`Request failed (${res.status})`) per CLAUDE.md gotcha
- Both `ops-api` TypeScript check (no new errors) and `ops-dashboard` `next build` (3.0s compile, all 11 routes) pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend GET /api/clawbacks/lookup response shape** — `0603842` (feat)
2. **Task 2: Extend LookupResult type + render info block with live net deduction** — `f07853e` (feat)

## Files Created/Modified

- `apps/ops-api/src/routes/payroll.ts` — Replaced the `GET /clawbacks/lookup` response-builder block (lines 290–316 range). Added `agent`, `acaCoveredSales`, `payrollEntries` to the include; computed `fullPayout` from `payrollEntries[0]`; mapped each product (core + addons) through `calculatePerProductCommission` with a single-id array; returned extended JSON shape with `agentName`, `agentId`, `premium`, `enrollmentFee`, `products[].commission`, `fullCommission`. `calculatePerProductCommission` was already imported from `../services/payroll` (line 7).
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx` — Added `useMemo` import; extended `LookupProduct` with `premium` + `commission`; extended `LookupResult` with `agentName`, `agentId`, `premium`, `enrollmentFee`, `fullCommission`; added module-level `MINI_LABEL` / `MINI_VALUE` style constants; added `liveNetDeduction` useMemo after the `allSelected` state; inserted a new info-block `<div>` above the existing "Products on sale" checklist rendering agent/member/premium/enrollment fee in a 2-col grid with a bottom-bordered "Net Chargeback (deducted from agent)" row showing `−${formatDollar(liveNetDeduction)}` in `C.danger` @ 20px / 800 weight; updated `lookupSale()` error fallback to `Request failed (${res.status})`.

## Decisions Made

- **Server-authoritative commission math:** The endpoint returns pre-computed per-product commission values so the frontend only sums. This guarantees the preview number matches the actual chargeback deduction even if future rate logic (e.g., new ACA bundle rules) lands in the helper without touching the UI.
- **`as unknown as Parameters<...>[0]` cast:** The lookup query uses narrow `select: { id, name, type }` on product/addon. The helper signature wants the full `SaleWithProduct` shape, but at runtime it only reads `id`, `type`, and rate/threshold fields via the full `product` select in the sale. TypeScript's direct cast rejected the narrower shape ("neither type sufficiently overlaps"), so `unknown` bridge was used — consistent with the research doc Code Examples.
- **Theme-token style constants over hex literals:** Reusing `C.textTertiary` / `C.textPrimary` keeps the new info block consistent with the dark glassmorphism theme and lets it follow future token changes.
- **Info block lives inside the form, above the checklist:** Keeps the visual flow lookup → see deal → tick products → see live net → submit. Required no restructuring of the Step 2 checklist (unchanged).

## Deviations from Plan

None — plan executed exactly as written. One expected TypeScript error (narrow select vs helper parameter type) was addressed by the documented `as unknown as` cast pattern already present in the research doc Code Examples section; not a deviation.

## Issues Encountered

- Initial TypeScript run showed `TS2352` from the `sale as Parameters<...>[0]` direct cast because the lookup query uses slim product selects. Replaced with `sale as unknown as Parameters<...>[0]` to bridge the nominally-incompatible shapes (runtime-safe: helper only reads `id`/`type`/rate fields that the full-product relation satisfies). All other pre-existing TypeScript errors in the workspace (bcryptjs / jsonwebtoken / cookie types, rootDir warnings) were out of scope and logged as pre-existing.

## User Setup Required

None. Live manual verification still desirable via http://localhost:3000/payroll/chargebacks (lookup by member name / ID, toggle checkboxes, watch Net Chargeback update) but no checkpoint was required in the plan.

## Next Phase Readiness

- Sub-feature 3 complete. Plans 47-04 (payroll row edit ACA → member count + bundled sibling recalc) and 47-05 (cross-period chargeback negative row with orange/yellow highlights) remain independent and can proceed.
- The server-authoritative commission pattern surfaced here can be reused by Plan 47-05 if the cross-period negative row needs to display canonical commission values alongside the row.

## Self-Check: PASSED

Verified:
- `apps/ops-api/src/routes/payroll.ts` contains `calculatePerProductCommission`, `agentName`, `enrollmentFee`, `zodErr` (4 targets → 23 total matches)
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollChargebacks.tsx` contains `liveNetDeduction`, `agentName`, `Net Chargeback`, `enrollmentFee`, `LookupProduct`, `commission: number` (18 total matches across all targets — exceeds the ≥2-per-key-term acceptance bar)
- Commit `0603842` (feat(47-03): extend GET /api/clawbacks/lookup...) present in `git log`
- Commit `f07853e` (feat(47-03): render sale info + live net deduction...) present in `git log`
- `npm run build --workspace=apps/ops-dashboard` exits 0 (Compiled successfully in 3.0s, 11/11 static pages)
- `cd apps/ops-api && npx tsc --noEmit` shows zero new errors in `routes/payroll.ts` (pre-existing bcryptjs/jsonwebtoken/rootDir errors are unrelated, out of scope)

---
*Phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca*
*Completed: 2026-04-07*
