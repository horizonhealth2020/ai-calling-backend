---
phase: 02-commission-engine-core
plan: 02
subsystem: api, payroll
tags: [commission, bundle-aggregation, tdd, jest, typescript]

# Dependency graph
requires:
  - phase: 02-commission-engine-core
    plan: 01
    provides: "isBundleQualifier flag on Product model, Jest test infrastructure with mock helpers"
provides:
  - "Rewritten calculateCommission() with bundle aggregation logic"
  - "17 passing commission tests covering COMM-01, COMM-02, COMM-04-07, COMM-11"
  - "@ops/db mock for unit testing without PrismaClient connection"
affects: [03-fees-arrears, 05-commission-preview]

# Tech tracking
tech-stack:
  added: []
  patterns: [bundle aggregation over per-product calculation, isBundleQualifier flag-based detection, final-only rounding]

key-files:
  created:
    - apps/ops-api/src/services/__tests__/__mocks__/ops-db.ts
  modified:
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/services/__tests__/commission.test.ts
    - apps/ops-api/jest.config.ts

key-decisions:
  - "Final-only rounding (Math.round at end) -- avoids penny accumulation from intermediate rounding"
  - "Console.warn for null commission rates -- ops visibility without breaking calculation"
  - "Mock @ops/db module to avoid PrismaClient connection in pure function unit tests"

patterns-established:
  - "Bundle aggregation: sum core + regular addon premiums, single threshold check, single rate application"
  - "AD&D calculated separately from bundle with its own bundledCommission/standaloneCommission rate"
  - "Halving applies to entire sale (bundle + AD&D) when no qualifier present"

requirements-completed: [COMM-01, COMM-02, COMM-04, COMM-05, COMM-06, COMM-07, COMM-11]

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 2 Plan 2: Commission Engine Bundle Calculation Summary

**TDD rewrite of calculateCommission() with bundle aggregation replacing per-product calculation, isBundleQualifier flag replacing string matching, and removal of FL exemption and hardcoded fallback rates**

## Performance

- **Duration:** 4 min 0s
- **Started:** 2026-03-14T22:31:55Z
- **Completed:** 2026-03-14T22:35:55Z
- **Tasks:** 2 (RED + GREEN TDD phases)
- **Files modified:** 4

## Accomplishments
- Rewrote calculateCommission() with bundle aggregation: core + addon premiums summed, single threshold check, single rate applied
- Replaced string matching ("compass" + "vab") with isBundleQualifier product flag for bundle detection
- Removed FL memberState exemption, hardcoded AD&D rates (70%/35%), and hardcoded addon rate (30%)
- Fixed addon premium sourcing: each addon now uses its own SaleAddon.premium instead of sale.premium
- Added 2 decimal place rounding and null rate warnings
- 17 comprehensive tests covering all COMM requirements pass

## Task Commits

Each task was committed atomically:

1. **RED: Add failing commission tests** - `944aa4d` (test)
2. **GREEN: Rewrite calculateCommission with bundle aggregation** - `30e20d2` (feat)

_TDD cycle: RED (11 of 17 tests failing) -> GREEN (all 17 passing). Refactor phase skipped -- code already clean._

## Files Created/Modified
- `apps/ops-api/src/services/payroll.ts` - Rewritten calculateCommission() with bundle aggregation, deleted calcProductCommission()
- `apps/ops-api/src/services/__tests__/commission.test.ts` - 17 tests covering COMM-01, COMM-02, COMM-04-07, COMM-11, premium sourcing, VAB exclusion, FL removal, null rates
- `apps/ops-api/src/services/__tests__/__mocks__/ops-db.ts` - Mock @ops/db to avoid PrismaClient connection in unit tests
- `apps/ops-api/jest.config.ts` - Updated moduleNameMapper for @ops/db mock resolution

## Decisions Made
- Final-only rounding strategy: Math.round applied once at end of calculateCommission(), not on intermediate values, to avoid penny accumulation
- Console.warn for null commission rates: helps ops team detect misconfigured products without breaking calculation flow
- Created @ops/db mock file rather than inline jest.mock() -- reusable across future test files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed @ops/db module resolution for Jest**
- **Found during:** RED phase (test setup)
- **Issue:** Jest moduleNameMapper resolved @ops/db to packages/db/src/ directory (no index.ts), causing PrismaClient initialization failure
- **Fix:** Created mock module at __mocks__/ops-db.ts and updated jest.config.ts moduleNameMapper to point @ops/db to the mock
- **Files modified:** apps/ops-api/jest.config.ts, apps/ops-api/src/services/__tests__/__mocks__/ops-db.ts
- **Verification:** npm run test:ops runs without configuration errors
- **Committed in:** 944aa4d (RED phase commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Mock necessary for test isolation. No scope creep.

## Issues Encountered
None -- implementation followed the research document's recommended algorithm closely.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Commission engine fully tested and correct for all COMM requirements in scope
- applyEnrollmentFee() left untouched, ready for Phase 3 (COMM-08, COMM-09)
- upsertPayrollEntryForSale() left untouched, ready for Phase 3 (PAYR-01, COMM-10 arrears logic)
- @ops/db mock available for future ops-api test files

---
*Phase: 02-commission-engine-core*
*Completed: 2026-03-14*
