---
phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca
plan: 01
subsystem: ui

tags: [react, nextjs, manager-entry, aca, form-validation]

# Dependency graph
requires:
  - phase: 36
    provides: ACA_PL flat-commission product type and standalone ACA submission flow
  - phase: 42
    provides: ACA child-sale creation and acaCoveringSaleId self-relation
provides:
  - Standalone ACA submit path that bypasses main sale form validation
  - Belt-and-suspenders submitSale guard against future nested-button regressions
affects: [47-02, 47-03, 47-04, 47-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Always set type=\"button\" on @ops/ui Button when rendered inside a <form> for non-submit actions"
    - "Defensive submitSale early-return guards against phantom bubble-up form submissions"

key-files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx

key-decisions:
  - "Fix scoped to one-character Button type fix + defensive guard rather than restructuring the form DOM (lower risk, no layout regression)"
  - "Guard uses 'main form empty AND standalone ACA in use' heuristic so it never blocks a real main-form submission"
  - "acaStandaloneMemberCount default value '1' treated as not-in-use to avoid false positives"

patterns-established:
  - "@ops/ui Button discipline: explicit type=\"button\" required inside any <form> wrapper"
  - "Defensive submit handlers: empty-main + populated-secondary section = no-op early return"

requirements-completed: [D-01, D-02, D-03]

# Metrics
duration: 2min
completed: 2026-04-07
---

# Phase 47 Plan 01: Standalone ACA Form Validation Bypass Summary

**Standalone ACA collapsible submit no longer triggers main sale form's required-field validation by adding type="button" to the Submit ACA Entry Button plus a belt-and-suspenders early-return guard in submitSale**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-07T21:10:01Z
- **Completed:** 2026-04-07T21:11:16Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Standalone ACA submission now succeeds with only the 4 required fields (agent, member name, ACA carrier, member count) — no main-form fields needed
- Main sale submission flow unchanged — full regression safety
- Defensive guard added to submitSale() prevents future nested-button regressions even if the ACA block is restructured
- ops-dashboard build passes (12.0s compile, all 11 routes generated)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix standalone ACA Button type and add submitSale guard** - `46a1260` (fix)

## Files Created/Modified
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` — Added `type="button"` to standalone ACA Submit Button (line 870); added early-return guard at top of `submitSale` (lines 421-427) that bails out when main form is empty and standalone ACA fields have data

## Decisions Made
- **One-character primary fix over DOM restructure:** Research (47-RESEARCH.md drift note #2) confirmed root cause is the Button defaulting to `type="submit"` inside the parent `<form>`. Adding `type="button"` is the minimum-risk fix; moving the ACA block out of the form was deferred to avoid layout regressions.
- **Guard heuristic uses `acaStandaloneMemberCount !== "1"`:** The state default is `"1"`, so treating any non-default value as "in use" prevents false positives where a user opens the ACA section, types nothing, and submits the main form normally.
- **Guard uses `form.memberName.trim()`:** Whitespace-only is treated as empty to match how the existing main-form validation already trims at line 426.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Sub-feature 1 complete; the four other sub-features (47-02 payroll spacing, 47-03 single chargeback lookup info, 47-04 ACA in payroll edit, 47-05 cross-period chargeback) remain independent and can proceed in any order.
- No blockers.

## Self-Check: PASSED

Verified:
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` exists and contains both `type="button"` on the standalone ACA Button and the `mainFormEmpty`/`standaloneAcaInUse` guard in `submitSale`
- Commit `46a1260` exists in `git log`
- `npm run build --workspace=apps/ops-dashboard` exits 0

---
*Phase: 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca*
*Completed: 2026-04-07*
