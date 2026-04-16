# Phase 78: Payroll Polish + Fronted Fix — Context

## Goals

Close the remaining v3.1 gaps: payroll card polish, fronted formula correction, a production
bug cluster in the sale edit modal, and a week-level payroll note box.

## Scope (8 items)

### A — Unapprove commission while OPEN
Restore the unapprove-commission button on payroll entries. Currently hidden regardless of
period status. Should only be available when the period is OPEN. Locked, Finalized, or
paid-guarded entries stay locked — no unapprove.

### B — CS payroll card cosmetics
CS service payroll card: rep name bold, positioned at top-center. "Total" label and total
amount colored green. Match the visual weight/hierarchy managers see on agent cards.

### C — Agent card sort by memberId ASC
Agent card sale entries (WeekSection rows) should sort by Sale.memberId ascending (string sort).
Currently sort order is undefined / by createdAt.
Note: field is `memberId String? @map("member_id")` on Sale — NOT memberCount (ACA family size).

### D — ACH print row green highlight
Print view: ACH payment rows should show green highlight to match the on-screen display.
Currently green only renders on screen, not in print CSS.

### E — Fronted formula correction (reverses Phase 71)
New formula: `Net = payout + adjustment + bonus - hold - fronted`
Phase 71 shipped: fronted EXCLUDED (net = payout + adj + bonus - hold), with
carryover.ts carrying fronted as hold on period lock.
This phase: fronted is a same-week deduction, NOT deferred to next period.
- Update `computeNetAmount` in payroll.ts (single source of truth)
- Remove `carryover.ts` fronted→hold logic on period lock (becomes dead code — delete)
- Rewrite `payroll-net-formula.test.ts` (7-case suite from Phase 71) to lock new formula
- Forward-only: existing payroll entries stay as computed. No retro recalc.
- Existing fronted amounts on current OPEN periods: NOT recalculated. Only new
  upsertPayrollEntryForSale calls going forward apply the new formula.

### F — Payroll week note box
One note per agent-period. Positioned to the right of net amount on the payroll card.
- Schema: add `notes String?` to `AgentPeriodAdjustment` model (one migration, nullable,
  additive — no backfill needed)
- UI: textarea/input inline in the week card, PATCH to update on blur or explicit save
- Print: invisible (CSS `display:none` on print) when empty, visible when text present
- Inline CSSProperties only, dark glassmorphism theme

### G — Sale edit: addon premium inputs missing
The sale edit modal (agent sales tab) has ADD-ON PRODUCTS checkboxes but no premium
input fields for checked addons. When a user checks an addon, there is no way to enter its
premium — it submits with null/0.

Fix: add per-addon premium number inputs in the edit modal for each checked addon, matching
the entry form pattern. On change, call upsertPayrollEntryForSale to recalculate commission
with updated addon premiums + correct product bundling rules (ACA bundled rate when
AD&D/addon added to ACA sale).

Commission recalc must account for:
- ACA bundled commission rate when addons are present
- Per-product commission via calculatePerProductCommission
- Full upsertPayrollEntryForSale round-trip after save (not just field update)

### H — Sale edit: [object Object] diff + manager string error
The CHANGES section in the edit modal shows:
`addonPremiums: {object Object} → [object Object]`

Root cause: addonPremiums is a `Record<string, number>` object being coerced via template
literal or string concatenation instead of JSON.stringify.

Two bugs from same root:
1. CHANGES display bug — fix by JSON.stringify on both sides of the diff
2. Manager string error on save — addonPremiums likely serializes incorrectly in the
   PATCH payload or fails Zod validation. Fix serialization and verify route schema accepts
   `Record<string, number>`.

G and H are the same code area — fix together.

## Constraints

- **Forward-only everywhere** — Phase 71 formula stays for all historical entries; fronted
  fix and note box are additive; sale edit fix doesn't alter past entries
- **Period-lifecycle guards preserved** — unapprove only while OPEN; no bypass
- **computeNetAmount is single source of truth** — update the helper; don't add inline formulas
- **Inline React.CSSProperties only** — no Tailwind, no new CSS files
- **carryover.ts fronted→hold logic** — remove entirely once formula ships; it's dead code
- **MANAGER role** — confirm edit route is accessible to MANAGER role (string error may
  also be a role-gate issue, not just serialization)

## Key Findings from Assumptions (pre-validated)

- **memberId confirmed** — item C sorts by `Sale.memberId` (string, ascending). NOT memberCount.
- **carryover.ts approach** — remove the single `carryHold += Number(adj.frontedAmount)` line (carryover.ts:79). Keep the file structure; `executeCarryover`/`reverseCarryover` stay but become no-ops for fronted. Leave explanatory comment.
- **SaleEditRequest shape** — `change-requests.ts` reads `changes.addonPremiums?.new` expecting `{ old, new }` shape. `ManagerSales.tsx` sends `{ addonPremiums: value }` (new-value-only). This mismatch likely causes the manager string error. Fix: align the shape on submission, or fix approval handler to handle both shapes.
- **addonPremiums display bug** — CHANGES display coerces objects via template literals. Fix: `JSON.stringify(val)` in the diff renderer.
- **Unapprove button** — currently in WeekSection gated by `isApproved` (entry has halvingReason + commissionApproved) but NOT gated by period status. Fix: add `period.status === "OPEN"` guard before rendering it.
- **Commission recalc after edit** — `upsertPayrollEntryForSale` is called at change-requests.ts approval time. Verify it receives updated addon data before recalculating.

## Open Questions for Planning

1. Does the sale edit flow go through `SaleEditRequest` approval (async) or direct PATCH?
   Need to confirm where upsertPayrollEntryForSale is called after an approved edit.
2. Is the manager string error a Zod validation error (`zodErr` response) or a JS runtime
   error in the frontend? Clarify by reading the edit route + frontend handler.
3. For item C (memberNumber sort): is `memberNumber` a field on Sale or on a related model?
   Verify field name before planning the sort.

## Files Likely Touched

| File | Why |
|------|-----|
| `apps/ops-api/src/services/payroll.ts` | computeNetAmount formula update |
| `apps/ops-api/src/services/carryover.ts` | Remove fronted→hold logic |
| `apps/ops-api/src/services/__tests__/payroll-net-formula.test.ts` | Rewrite 7 cases |
| `apps/ops-api/src/routes/payroll.ts` (or sales.ts) | Unapprove gate + sale edit fix |
| `prisma/schema.prisma` | AgentPeriodAdjustment.notes |
| `prisma/migrations/...` | notes column migration |
| `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` | Unapprove button |
| `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx` or WeekSection | Note box, memberId sort |
| `apps/ops-dashboard/app/(dashboard)/payroll/CSPayrollCard.tsx` | CS card cosmetics |
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` (edit modal) | Addon premiums + diff fix |

## Prior Phase Context

Phase 77 shipped: User.csRepRosterId FK, composite-key dedupe on CB+PT submissions,
stale-summary DB-lookup. 184 tests passing. No open blockers.

Phase 71 shipped: Net formula = payout + adj + bonus - hold (fronted excluded).
computeNetAmount is the single source of truth. This phase reverses that fronted decision.
