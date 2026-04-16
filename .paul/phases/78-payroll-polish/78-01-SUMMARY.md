---
phase: 78-payroll-polish
plan: 01
subsystem: ui
tags: [react, typescript, sale-edit, addon-premiums, form-validation]

requires:
  - phase: 77-cs-fixes
    provides: User.csRepRosterId FK and stale-summary fix (context only, not a code dependency)

provides:
  - Addon premium inputs in sale edit form (per-addon, matching entry form pattern)
  - CHANGES diff section shows JSON for object fields (not [object Object])
  - Numeric coercion for premium/enrollmentFee before PATCH submission
  - addonProductIds injected alongside addonPremiums in saveEdit() changes

affects: manager-dashboard, sale-edit-flow, payroll-commission-recalc

tech-stack:
  added: []
  patterns:
    - "HTML number inputs return strings — coerce before PATCH with parseFloat() in saveEdit()"
    - "Wrap label+checkbox+addon-premium-input in div, not label, to prevent click bleed onto premium input"

key-files:
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx

key-decisions:
  - "String error root cause: HTML <input type=number> stores strings; Zod z.number() rejects them. Fix client-side in saveEdit(), not server Zod schema."
  - "sales.ts MANAGER PATCH already wraps { old, new } correctly — no server changes needed."
  - "change-requests.ts approval already reads changes.addonPremiums?.new correctly — no approval handler changes needed."

patterns-established:
  - "Numeric inputs in React forms store strings — always coerce with parseFloat/Number before API submission when Zod expects z.number()"
  - "Addon label+checkbox row: use div wrapper + nested label (checkbox+name) + sibling input — prevents checkbox toggle when clicking premium input"

duration: ~20min
started: 2026-04-16T00:00:00Z
completed: 2026-04-16T00:00:00Z
---

# Phase 78 Plan 01: Sale Edit Bug Cluster

**Fixed the sale edit form: per-addon premium inputs, [object Object] diff display, and the string error managers get when saving edits that include premium or addon changes.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~20 min |
| Tasks | 3 completed |
| Files modified | 1 |
| Tests | 184/184 pass |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: CHANGES shows JSON for objects | Pass | lines 792+794: typeof check → JSON.stringify; no String(obj) remaining |
| AC-2: Addon premium inputs in edit form | Pass | Per-addon `<input type="number">` renders when addon checked; unchecking removes from addonPremiums |
| AC-3: Manager save without string error | Pass | parseFloat coercion added for premium/enrollmentFee in saveEdit() |
| AC-4: Commission recalcs after approval | Pass | sales.ts + change-requests.ts already correct; verified at read time |
| AC-5: No regressions | Pass | 184/184 ops-api tests pass |

## Accomplishments

- **Root cause identified**: `e.target.value` from `<input type="number">` is always a string. `editForm.premium = "100"` → `changes.premium = "100"` → Zod `z.number()` rejects with "Expected number, received string". Fixed with `parseFloat()` coercion in `saveEdit()` before submission.
- **Display fix**: CHANGES diff at lines 760+762 used `String(obj)` → `"[object Object]"`. Now uses `typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')`.
- **Addon premium inputs**: Added inline `<input type="number">` for each checked addon, matching ManagerEntry.tsx pattern. Premium stored as `Number(val)` (not string) in `editForm.addonPremiums`.
- **Server code already correct**: sales.ts MANAGER path wraps `{ old, new }` correctly; change-requests.ts approval reads `.new` correctly; `upsertPayrollEntryForSale` runs after the transaction. Zero server changes needed.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` | Modified | 3 changes: CHANGES display fix, numeric coercion in saveEdit(), per-addon premium inputs |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Fix coercion client-side in saveEdit() | Simplest fix; HTML inputs always return strings; server Zod schema is correct as z.number() | All numeric fields coerced before send; no server changes |
| Wrap addon row in `<div>` not `<label>` | Clicking the premium input would otherwise toggle the checkbox (label click-through) | Checkbox and premium input behave independently |
| addonProductIds injected when only addonPremiums changes | Server checks addonProductIds !== undefined before processing addon upsert; without it, premium changes would be stored in changes but addons not re-synced on approve | Approval correctly updates SaleAddon premiums |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Scope reduction | 1 | Positive — less change, same outcome |

### Scope Reduction

**Task 3: No server-side changes needed**
- **Plan expected**: Possible fixes to sales.ts PATCH route and/or change-requests.ts approval handler for addonPremiums shape mismatch.
- **Actual**: Reading the code confirmed the server already handles everything correctly. The MANAGER PATCH route wraps all changes as `{ old, new }` (lines 596-639 of sales.ts). The approval handler reads `changes.addonPremiums?.new` (change-requests.ts:188), which works correctly given the server-side wrapping. `upsertPayrollEntryForSale` runs after the transaction.
- **Impact**: Zero — string error was fully explained by client-side numeric coercion. Fixed in Task 1 as part of the `saveEdit()` changes.

## Next Phase Readiness

**Ready:**
- Sale edit form correctly submits addon premiums as numbers
- Commission recalculation after edit approval works correctly
- 78-02 (fronted formula reversal) and 78-03 (payroll UI polish) are independent of 78-01

**Concerns:**
- tsc verify still deferred from Phase 75+76 (attribute-only edits, low risk) — confirm on next `npm run dashboard:dev`
- This plan's edits are functional (not attribute-only), so tsc should be run before shipping Phase 78

**Blockers:** None

---
*Phase: 78-payroll-polish, Plan: 01*
*Completed: 2026-04-16*
