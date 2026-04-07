---
phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca
plan: 04
subsystem: payroll/sales
tags: [api, ui, payroll, aca, commission, bundled]
one_liner: "Payroll row editor now swaps \\$ → # members for ACA_PL, creates a real ACA covering child sale inside a transaction, and recomputes the parent's PayrollEntry so Phase 46 acaBundledCommission rates activate on bundled ADDON/AD&D"

# Dependency graph
requires:
  - phase: 42
    provides: "ACA covering child-sale model (Sale.acaCoveringSaleId self-relation, inverse acaCoveredSales)"
  - phase: 46
    provides: "acaBundledCommission rate preference on ADDON/AD_D in calculatePerProductCommission"
provides:
  - "Transaction-aware upsertPayrollEntryForSale(saleId, tx?) + resolveBundleRequirement(..., tx?)"
  - "services/sales.ts helpers: createAcaChildSale / removeAcaChildSale (both tx-aware)"
  - "PATCH /sales/:id acaChild field (object=create/update, null=remove, undefined=no-op)"
  - "WeekSection.tsx EditableSaleRow: \\# members input on ACA_PL + removable acaChild slot + canonical hoist flow"
affects: [47-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composable tx-aware payroll helpers: functions that touch prisma expose `tx?: PrismaTx` and use `(tx ?? prisma)` internally so callers can bundle multi-step cascades (child-create + parent recalc + audit log) in a single \\$transaction for atomic audit-vs-payout consistency"
    - "Canonical ACA-row hoist flow: UI keeps ACA_PL selectable in the normal addon dropdown for familiarity, then the save handler HOISTS ACA_PL rows out of addons[] and sends them as a single top-level canonical `acaChild` field — backend never sees ACA_PL inside addons[]"
    - "Newly-picked-wins conflict resolution with console.warn observability for dual-source UI state slots"

key-files:
  created:
    - apps/ops-api/src/services/sales.ts
  modified:
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
    - apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx

key-decisions:
  - "Extended upsertPayrollEntryForSale + resolveBundleRequirement to accept optional PrismaTx (per plan's REQUIRED-NO-FALLBACK constraint) so ACA attach/detach + parent recalc + audit all run in one atomic transaction — a crashed recalc cannot leave a committed child with stale parent payout"
  - "Single upsertPayrollEntryForSale(parentId) call IS the sibling recalc (confirmed via research drift correction): PayrollEntry is one row per (period, sale) aggregating all products through calculatePerProductCommission, which already walks the isAcaBundled branch via the acaCoveredSales inverse relation"
  - "FK direction HARDCODED in the helper: acaCoveringSaleId lives on the CHILD, set at child.create time. The parent is NEVER mutated to carry acaCoveringSaleId — grep confirms zero `parent.acaCoveringSaleId` writes (the plan's RESEARCH drift correction)"
  - "Canonical ACA-row hoist: save handler filters addonItems into ACA vs non-ACA, sends only non-ACA via addons[] and the single last-picked ACA row via a top-level acaChild field. Guarantees backend never sees ACA_PL inside addons[] and eliminates double-send"
  - "Newly-picked addon-row wins over existing acaChild seed on conflict, with console.warn for observability — matches D-17 UX (user editing the addon dropdown is a stronger signal than an unchanged seed)"
  - "Surfaced productId + childSaleId on entry.acaAttached via the PayrollPeriods.tsx fold pass so EditableSaleRow can seed the acaChild slot without a second API round-trip"

patterns-established:
  - "PrismaTx type exported from services/payroll.ts as the single source for Prisma.TransactionClient aliasing across service modules"
  - "Three-state payload union for optional cascade fields: undefined=no-change, null=remove, object=create/replace — matches REST PATCH semantics for nested-entity mutations"
  - "Cascade delete helpers clear PayrollEntry/saleAddon/clawback/*Request rows in order before deleting the Sale row to avoid FK failures (mirrors the DELETE /sales/:id pattern)"

requirements-completed: [D-12, D-13, D-14, D-15, D-16, D-17]

# Metrics
duration: ~18min
completed: 2026-04-07
---

# Phase 47 Plan 04: ACA in Payroll Row Editor Summary

**Fixes the exact user defect: "when I try to add ACA product it requires dollar amount instead of number of members and once I added the add-ons and AD&D stayed payable as standalone instead of bundled." The payroll edit dropdown now swaps \$ → # members when ACA_PL is selected, saves create a real ACA covering child sale inside a transaction, and Phase 46's `acaBundledCommission` rates activate automatically on bundled ADDON/AD&D via a single parent `upsertPayrollEntryForSale` call.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 2
- **Files created:** 1 (`apps/ops-api/src/services/sales.ts`)
- **Files modified:** 5

## Accomplishments

- `services/sales.ts` created with `createAcaChildSale` and `removeAcaChildSale` helpers, both accepting a `Prisma.TransactionClient` so callers can bundle with parent recalc
- `upsertPayrollEntryForSale(saleId, tx?)` and `resolveBundleRequirement(..., tx?)` extended to accept an optional transaction client — internal lookups route through `(tx ?? prisma)` so existing call sites are untouched
- `PATCH /sales/:id` privileged branch accepts a new `acaChild` zod field (validated via `zodErr`) and handles attach/update/remove inside a single `prisma.$transaction` alongside sale update, saleAddon replacement, and old-agent payroll cleanup
- Parent `upsertPayrollEntryForSale(parentId, tx)` runs inside the same transaction after each ACA mutation — D-14 (sibling/bundled rates) and D-15 (`resolveBundleRequirement`) satisfied automatically because the helper already re-walks the sale
- `logAudit` writes `edit_sale_aca_attached` / `edit_sale_aca_removed` / `edit_sale_aca_updated` entries inside the same transaction for D-16 atomic audit-vs-payout consistency
- `WeekSection.tsx` EditableSaleRow detects ACA_PL products in the addon dropdown and swaps the `Premium ($)` input for a `# members` integer input (min=1, step=1)
- Added a dedicated ACA child slot (blue-highlighted row with carrier select + member count + X button) seeded from `entry.acaAttached` for D-17 removal UX
- Save handler implements the canonical hoist flow: walks `addonItems`, filters ACA_PL rows out, and sends `acaChild` as the single top-level field to the backend (never inside `addons[]`)
- Newly-picked ACA_PL addon row wins over existing acaChild seed with `console.warn("[ACA] Newly-picked ACA_PL addon row replacing existing acaChild seed")` for observability
- Extended `Entry.acaAttached` + the PayrollPeriods.tsx fold pass to surface `productId` + `childSaleId` so the edit slot can seed without extra API calls
- Both builds green: `cd apps/ops-api && npx tsc --noEmit` shows zero new errors in touched files (pre-existing bcryptjs/jsonwebtoken/rootDir noise is out of scope), `npm run build --workspace=apps/ops-dashboard` compiles in 3.0s with all 11 routes generated

## Task Commits

1. **Task 1: Extract createAcaChildSale helper + extend PATCH /sales/:id with acaChild handling** — `abf976c` (feat)
2. **Task 2: WeekSection.tsx ACA # members + removable ACA child row + canonical hoist flow** — `dbef5db` (feat)

## Files Created/Modified

- `apps/ops-api/src/services/sales.ts` (NEW) — `createAcaChildSale(tx, parentSaleId, { productId, memberCount, userId })` and `removeAcaChildSale(tx, parentSaleId, childSaleId)`. Child sale created with `acaCoveringSaleId: parent.id` (FK on CHILD pointing at PARENT — the research-verified drift correction). `premium: 0` because ACA_PL payout is computed from `product.flatCommission × memberCount` in `calculateCommission`. Removal helper cascades PayrollEntry + saleAddon + clawback + *Request rows before deleting the Sale row.
- `apps/ops-api/src/services/payroll.ts` — Added `export type PrismaTx = Prisma.TransactionClient`. `resolveBundleRequirement(..., tx?)` and `upsertPayrollEntryForSale(saleId, tx?)` now accept an optional tx and use `const db = tx ?? prisma` internally. All existing call sites remain backwards-compatible.
- `apps/ops-api/src/routes/sales.ts` — Imported `createAcaChildSale` + `removeAcaChildSale`. Extended `editSchema` with `acaChild: z.union([z.null(), z.object({ productId, memberCount: z.number().int().min(1) })]).optional()`. Moved `upsertPayrollEntryForSale` INSIDE the existing `prisma.$transaction` (previously called after it). Added ACA attach/update/remove branch that threads `tx` through both helpers and `logAudit` for atomic audit parity. zodErr wrapping preserved throughout.
- `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` — `Entry.acaAttached` gained `productId?` + `childSaleId?` fields so the edit slot can seed.
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — Fold-pass that merges ACA child entries into their parent now populates `productId` + `childSaleId` on `acaAttached`.
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` — (1) addon row rendering detects ACA_PL and swaps `Premium ($)` → `# members` integer input with min=1, step=1, aria-label="Member count"; (2) new blue-highlighted ACA child slot below the addon rows with carrier select + member count + aria-label="Remove ACA child" X button; (3) save handler walks addonItems, splits ACA_PL rows out, and sends a canonical `acaChild` top-level field to PATCH /sales/:id with three-state semantics (undefined / null / object); (4) cancel handler resets `acaChild` alongside `addonItems` to keep edit state coherent.

## Decisions Made

- **Transaction atomicity over fallback convenience:** Per the plan's "REQUIRED — NO FALLBACK" constraint, `upsertPayrollEntryForSale` was extended to accept `tx?` instead of relying on a post-transaction call. This eliminates the window where a committed child-create could leave an audit row pointing at a sale with stale payout if the recalc crashed.
- **Single parent recalc = sibling recalc:** The research drift correction ("PayrollEntry is ONE row per (period, sale) with rolled-up commission") means one `upsertPayrollEntryForSale(parentId, tx)` call IS D-14's "recalculate sibling ADDON/AD_D entries" — there are no per-product sibling entries to iterate. `calculatePerProductCommission`'s `isAcaBundled` branch already walks `acaCoveredSales` and picks up `acaBundledCommission` rates automatically.
- **Canonical hoist over dual UI:** ACA_PL stays selectable in the addon dropdown (for discoverability and to match the user's muscle memory from "I tried to add ACA product"), but the save handler hoists ACA_PL rows out of `addons[]` so the backend only ever sees one source of truth (`acaChild`). Zero risk of double-send.
- **Newly-picked wins + warn:** Dual-source state (addonItems ACA row + acaChild slot seed) is resolved by "newly-picked addon row wins" with a console.warn for observability. This matches the UX expectation that a user actively editing the addon dropdown is signaling intent to replace.
- **Entry.acaAttached enrichment over new API endpoint:** Surfaced `productId` + `childSaleId` via the existing PayrollPeriods fold pass instead of adding a dedicated lookup — zero extra network round-trips on edit open.

## Deviations from Plan

None — plan executed exactly as written. No Rule 1-3 auto-fixes, no Rule 4 architectural escalations. The "REQUIRED — NO FALLBACK" tx-signature extension was called out explicitly in the plan and implemented as the FIRST sub-step of Task 1.

## Issues Encountered

- Pre-existing TypeScript errors in the ops-api workspace (bcryptjs/jsonwebtoken/cookie types, rootDir warnings from @ops/auth, @ops/types) are unchanged and out of scope — grep confirms zero new errors in the files touched by this plan. Same pattern documented in 47-03's self-check.

## User Setup Required

None. Manual verification flow:
1. Open http://localhost:3000/payroll on a period with an ACA-attached sale.
2. Click edit on a non-ACA sale → add an ACA_PL row from the addon dropdown → verify the premium input becomes `# members` → enter 3 → save.
3. Refresh: verify the sale's payout increased by `flatCommission × 3` AND any ADDON/AD&D rates on the same sale are now using `acaBundledCommission` (check via the pay card total).
4. Edit the same sale: the ACA child row should now render with an X button. Click X → save → verify ADDON/AD&D rates revert to standalone.
5. Inspect `app_audit_log`: rows with action `edit_sale_aca_attached` and `edit_sale_aca_removed` should exist tied to the parent sale.

## Next Phase Readiness

- 47-04 complete. Plan 47-05 (cross-period chargeback negative row with orange/yellow highlights) remains independent and can proceed.
- The tx-aware helper pattern established here (`createAcaChildSale(tx, ...)`, `upsertPayrollEntryForSale(saleId, tx?)`) is reusable by 47-05 when inserting the cross-period negative PayrollEntry row — it can bundle the insert + audit log in a single transaction.

## Self-Check: PASSED

Verified via filesystem + git:
- FOUND: `apps/ops-api/src/services/sales.ts`
- `grep "createAcaChildSale\|removeAcaChildSale"` → 2 matches in services/sales.ts, 3 matches in routes/sales.ts
- `grep "acaCoveringSaleId: parent.id"` → 1 match in services/sales.ts (FK direction verified)
- `grep "parent.acaCoveringSaleId"` → 0 matches (wrong direction definitively excluded)
- `grep "edit_sale_aca_attached\|edit_sale_aca_removed"` → 2 matches in routes/sales.ts
- `grep "acaChild"` → 14 matches in routes/sales.ts (schema + attach + update + remove branches)
- `grep "upsertPayrollEntryForSale.*tx"` → 1 match in services/payroll.ts (signature accepts tx)
- `grep "ACA_PL"` → 10 matches in WeekSection.tsx
- `grep "acaChild"` → 19 matches in WeekSection.tsx (state + seed + render + hoist + payload)
- `grep "# members\|memberCount"` → 12 matches in WeekSection.tsx
- `grep "Remove ACA"` → 2 matches in WeekSection.tsx
- `grep "console.warn.*ACA"` → 1 match in WeekSection.tsx
- `cd apps/ops-api && npx tsc --noEmit` → zero errors in touched files (pre-existing unrelated errors only)
- `npm run build --workspace=apps/ops-dashboard` → exit 0, compiled in 3.0s, 11/11 static pages
- FOUND commits: `abf976c`, `dbef5db`

---
*Phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca*
*Completed: 2026-04-07*
