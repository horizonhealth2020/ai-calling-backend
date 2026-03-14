---
phase: 02-commission-engine-core
plan: 01
subsystem: database, testing
tags: [prisma, jest, ts-jest, commission, bundle-qualifier]

# Dependency graph
requires:
  - phase: 01-sales-entry-fix
    provides: "SaleAddon premium field and corrected Sale model"
provides:
  - "isBundleQualifier Boolean flag on Product model"
  - "Migration SQL with data migration for Compass VAB products"
  - "TypeScript Jest configuration for ops-api"
  - "Commission test scaffold with makeSale/makeProduct/makeAddon helpers"
affects: [02-commission-engine-core, 03-fees-arrears]

# Tech tracking
tech-stack:
  added: [ts-jest, ts-node, "@types/jest"]
  patterns: [TypeScript Jest config with path mapping, mock factory helpers for Prisma types]

key-files:
  created:
    - prisma/migrations/20260315000000_add_bundle_qualifier/migration.sql
    - apps/ops-api/jest.config.ts
    - apps/ops-api/src/services/__tests__/commission.test.ts
  modified:
    - prisma/schema.prisma
    - package.json

key-decisions:
  - "ts-node added as devDependency for Jest TypeScript config file parsing"
  - "Jest config uses path.resolve(__dirname) for tsconfig path to avoid ts-jest relative resolution issues"
  - "Manual migration SQL (no prisma migrate dev) consistent with Phase 1 no-DATABASE_URL decision"

patterns-established:
  - "Test helpers: makeProduct(), makeAddon(), makeSale() factories for type-safe Prisma mocks"
  - "ops-api tests live in src/services/__tests__/ and run via npm run test:ops"

requirements-completed: [COMM-03]

# Metrics
duration: 2min
completed: 2026-03-14
---

# Phase 2 Plan 1: Bundle Qualifier Flag + Test Infrastructure Summary

**isBundleQualifier flag on Product model with Prisma migration and TypeScript Jest test scaffold for commission engine**

## Performance

- **Duration:** 2 min 27s
- **Started:** 2026-03-14T22:26:42Z
- **Completed:** 2026-03-14T22:29:09Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added isBundleQualifier Boolean field to Product model with data migration flagging Compass VAB products
- Set up TypeScript Jest configuration for ops-api with ts-jest transform and @ops/* path mapping
- Created commission test scaffold with type-safe mock factories (makeProduct, makeAddon, makeSale)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isBundleQualifier to Product model with data migration** - `bf5cfb4` (feat)
2. **Task 2: Set up TypeScript Jest config and commission test scaffold** - `cc6557b` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added isBundleQualifier Boolean field to Product model
- `prisma/migrations/20260315000000_add_bundle_qualifier/migration.sql` - ALTER TABLE + UPDATE for Compass VAB
- `apps/ops-api/jest.config.ts` - TypeScript Jest config with ts-jest and path mapping
- `apps/ops-api/src/services/__tests__/commission.test.ts` - Test scaffold with mock helpers
- `package.json` - Added test:ops script, ts-jest, @types/jest, ts-node devDependencies

## Decisions Made
- Added ts-node as devDependency because Jest requires it to parse TypeScript config files
- Used path.resolve(__dirname) in jest.config.ts for tsconfig path because ts-jest resolves paths relative to test files, not the config file
- Continued manual migration SQL pattern (no prisma migrate dev) consistent with Phase 1 decision

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed ts-node for Jest TypeScript config**
- **Found during:** Task 2 (Jest config setup)
- **Issue:** Jest requires ts-node to parse .ts config files; not included in plan's dependency list
- **Fix:** Installed ts-node as devDependency
- **Files modified:** package.json, package-lock.json
- **Verification:** npm run test:ops runs successfully
- **Committed in:** cc6557b (Task 2 commit)

**2. [Rule 1 - Bug] Fixed tsconfig path resolution in jest.config.ts**
- **Found during:** Task 2 (Jest config setup)
- **Issue:** ts-jest resolved relative tsconfig path from test file location, not config file location
- **Fix:** Used path.resolve(__dirname, '../../tsconfig.base.json') for absolute path
- **Files modified:** apps/ops-api/jest.config.ts
- **Verification:** npm run test:ops passes with 2 tests
- **Committed in:** cc6557b (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for test infrastructure to function. No scope creep.

## Issues Encountered
- DATABASE_URL env var not set in dev; used dummy URL for prisma validate/generate (consistent with Phase 1 approach)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- isBundleQualifier field available in Prisma types for commission engine rewrite (Plan 02)
- Test infrastructure ready with mock helpers matching all Prisma Product/Sale/SaleAddon fields
- Commission test file imports calculateCommission directly for unit testing

---
*Phase: 02-commission-engine-core*
*Completed: 2026-03-14*
