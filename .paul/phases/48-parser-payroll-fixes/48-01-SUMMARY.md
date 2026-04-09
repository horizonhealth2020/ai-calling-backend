---
phase: 48-parser-payroll-fixes
plan: 01
subsystem: ui, api
tags: [receipt-parser, payroll, ach, aca, regex]

requires:
  - phase: 47
    provides: cross-period clawback row styling, ACA standalone form
provides:
  - Receipt parser handles "Add on" (no hyphen) addon detection
  - ACH payroll row green highlight
  - Standalone ACA sale date field
affects: []

tech-stack:
  added: []
  patterns:
    - "Row color priority cascade in WeekSection.tsx ternary chain"

key-files:
  created: []
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx
    - apps/ops-api/src/routes/payroll.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts
    - apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx

key-decisions:
  - "ACH green highlight priority: below clawback/status colors, above default transparent"
  - "isLate spread correctly overrides ACH green (late is higher priority signal)"

patterns-established:
  - "Addon detection regex uses Add[-\\s]?on to handle both hyphenated and space-separated variants"

duration: ~15min
completed: 2026-04-09T00:00:00Z
---

# Phase 48 Plan 01: Parser & Payroll Quick Fixes Summary

**Fixed receipt parser "Add on" addon misclassification, added ACH green payroll row highlight, and added sale date to standalone ACA entry form.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Completed | 2026-04-09 |
| Tasks | 3 completed |
| Files modified | 4 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Parser identifies "Add on" without hyphen as addon | Pass | Regex updated to `Add[-\s]?on`, cleanName strips both variants. TDK 3 correctly becomes core. |
| AC-2: ACH payroll rows show green highlight | Pass | paymentType added to API select, SaleInfo type, and WeekSection ternary chain. Priority ordering preserved. |
| AC-3: Standalone ACA entry includes sale date | Pass | Date state, input field, POST body inclusion, and reset on submit all implemented. API already accepted saleDate. |

## Accomplishments

- Receipt parser now handles "Add on" (space) in addition to "Add-on" (hyphen), fixing the Gap 5000 +HC2U misclassification bug where TDK 3 was lost as core product
- ACH sales are visually trackable in payroll with green left border + background, slotted correctly below clawback/status colors in the priority cascade
- Standalone ACA entries can now specify a sale date (defaults to today), ensuring they land in the correct payroll week

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` | Modified | Parser isAddon/cleanName regex + ACA standalone saleDate state/input/submit/reset |
| `apps/ops-api/src/routes/payroll.ts` | Modified | Added `paymentType: true` to GET /payroll/periods sale select |
| `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` | Modified | Added `paymentType?: string \| null` to SaleInfo type |
| `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` | Modified | Added ACH green row styling in rowBg ternary chain |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| ACH green below clawback/status in ternary | Clawback and status colors represent financial alerts — higher priority than payment type tracking | Row color cascade preserved, no visual conflicts |
| isLate spread overrides ACH green | Late arrival is a higher-priority signal than payment method | Consistent with existing override pattern at line 156 |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- All three production issues resolved
- Phase 48 complete — milestone v2.3 can be closed

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 48-parser-payroll-fixes, Plan: 01*
*Completed: 2026-04-09*
