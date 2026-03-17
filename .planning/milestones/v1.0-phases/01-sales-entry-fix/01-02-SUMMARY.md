---
phase: 01-sales-entry-fix
plan: 02
subsystem: api
tags: [express, prisma, zod, sales, payroll]

requires:
  - phase: 01-sales-entry-fix/01
    provides: "memberState field on Sale model, SaleAddon premium migration"
provides:
  - "Sale creation resilient to duplicate addon IDs"
  - "Payroll calculation errors are non-fatal during sale creation"
  - "Sale and effective dates stored at noon UTC to prevent timezone day-shift"
affects: [commission-engine, payroll-dashboard, manager-dashboard]

tech-stack:
  added: []
  patterns:
    - "Deduplicate array inputs with Set before Prisma nested create"
    - "Non-critical side-effects wrapped in try/catch after primary write"
    - "Noon-UTC date storage to prevent timezone day-shift"

key-files:
  created: []
  modified:
    - apps/ops-api/src/routes/index.ts

key-decisions:
  - "Noon UTC (T12:00:00) chosen for date storage to maximize timezone buffer in both directions"
  - "Payroll errors logged to console.error rather than structured logger for simplicity"

patterns-established:
  - "Dedup pattern: [...new Set(array)] before nested Prisma creates with unique constraints"
  - "Non-fatal side-effect pattern: try/catch after primary DB write, log error, continue response"

requirements-completed: [SALE-01]

duration: 1min
completed: 2026-03-14
---

# Phase 1 Plan 2: Sale Creation API Fix Summary

**Deduplicated addon IDs via Set, wrapped payroll upsert in try/catch, and appended T12:00:00 to sale/effective dates to prevent timezone day-shift**

## Performance

- **Duration:** 39s
- **Started:** 2026-03-14T21:39:28Z
- **Completed:** 2026-03-14T21:40:07Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Sale creation no longer fails with 500 when duplicate addonProductIds are submitted
- Payroll calculation errors are caught and logged, allowing the sale to persist
- Sale and effective dates stored at noon UTC, preventing timezone-induced day-shift on display

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix sale creation API -- dedup addons, wrap payroll, fix date** - `7a64524` (fix)

## Files Created/Modified
- `apps/ops-api/src/routes/index.ts` - POST /api/sales handler: dedup addons, try/catch payroll, noon-UTC dates

## Decisions Made
- Used T12:00:00 noon UTC for both saleDate and effectiveDate for consistency (matches existing manager-dashboard pattern)
- console.error used for payroll failure logging to keep the fix minimal and non-invasive

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript compilation errors (missing @types/bcryptjs, rootDir issues) unrelated to changes -- ignored as out of scope

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sale creation API is now resilient to the three identified failure modes
- Ready for commission engine work (Phase 2) which depends on reliable sale creation

---
*Phase: 01-sales-entry-fix*
*Completed: 2026-03-14*
