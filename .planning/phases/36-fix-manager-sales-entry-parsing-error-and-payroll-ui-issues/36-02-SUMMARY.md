---
phase: 36-fix-manager-sales-entry-parsing-error-and-payroll-ui-issues
plan: 02
subsystem: ops-api
tags: [aca-pl, commission-engine, schema-migration, api-endpoint, sales-board]
dependency_graph:
  requires: []
  provides: [aca-pl-product-type, flat-commission-calculation, aca-api-endpoint, sales-board-exclusion]
  affects: [payroll-commission, sales-board, manager-tracker]
tech_stack:
  added: []
  patterns: [flat-commission-path, self-referencing-relation, product-type-exclusion-filter]
key_files:
  created:
    - prisma/migrations/20260331000000_add_aca_pl_product_type/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-api/src/services/__tests__/commission.test.ts
    - apps/ops-api/src/services/__tests__/status-commission.test.ts
decisions:
  - ACA_PL flat commission uses early return before percentage logic to avoid bundle/enrollment fee interference
  - Self-relation on Sale model links ACA covering sales to parent sales
  - ACA auto-fulfill checks acaCoveringSaleId in resolveBundleRequirement before state availability checks
  - Tracker sales counts exclude ACA_PL via product type filter on include where clauses
metrics:
  duration: 5m
  completed: "2026-03-31T17:59:30Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 6
  files_created: 1
---

# Phase 36 Plan 02: ACA PL Product Type and Flat Commission Summary

ACA_PL product type with flat dollar-per-member commission, dedicated relaxed-validation API endpoint, self-referencing sale covering relation for bundle auto-fulfill, and sales board/tracker exclusion filters.

## Task Results

### Task 1: Schema migration -- add ACA_PL enum, flatCommission, memberCount, acaCoveringSaleId
- **Commit:** ed9eaea
- **Files:** prisma/schema.prisma, prisma/migrations/20260331000000_add_aca_pl_product_type/migration.sql
- **Result:** Added ACA_PL to ProductType enum, flatCommission Decimal field on Product, memberCount Int and acaCoveringSaleId String on Sale, plus self-relation (AcaCovering) for sale covering linkage. Migration SQL handles ALTER TYPE ADD VALUE and ALTER TABLE for all new columns and foreign key.

### Task 2: Commission engine flat-amount path, bundle auto-fulfill, ACA API endpoint, and sales board exclusion
- **Commit:** 8878267
- **Files:** apps/ops-api/src/services/payroll.ts, apps/ops-api/src/routes/sales.ts, apps/ops-api/src/services/__tests__/commission.test.ts, apps/ops-api/src/services/__tests__/status-commission.test.ts
- **Result:**
  - calculateCommission early-returns for ACA_PL with flatAmount * memberCount (bypasses all percentage logic)
  - resolveBundleRequirement accepts optional saleId param, checks for ACA covering sale to auto-fulfill bundle requirement
  - POST /sales/aca endpoint with relaxed Zod schema (no premium/effectiveDate/leadSourceId required), product type verification, payroll upsert, socket emit, and covered sale payroll recalculation
  - Sales board summary and detailed queries filter out ACA_PL via product type exclusion
  - Tracker summary excludes ACA_PL from both main and today sales counts
  - Test mock products updated with flatCommission: null field

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed logAudit call signature in ACA endpoint**
- **Found during:** Task 2
- **Issue:** Plan used object-style `logAudit({ action, userId, details })` but actual signature uses positional parameters `logAudit(actorUserId, action, entityType, entityId, metadata)`
- **Fix:** Changed to positional argument style matching existing codebase pattern
- **Files modified:** apps/ops-api/src/routes/sales.ts
- **Commit:** 8878267

**2. [Rule 1 - Bug] Fixed test mock Product types missing flatCommission**
- **Found during:** Task 2
- **Issue:** Adding flatCommission to Prisma schema made the field required in Product type, but test mocks did not include it
- **Fix:** Added `flatCommission: null` to makeProduct helper in both test files
- **Files modified:** apps/ops-api/src/services/__tests__/commission.test.ts, apps/ops-api/src/services/__tests__/status-commission.test.ts
- **Commit:** 8878267

## Verification

- Prisma validate: PASSED
- Prisma generate: PASSED
- TypeScript compilation: PASSED (no new errors in changed files; pre-existing bcryptjs/rootDir warnings unchanged)

## Self-Check: PASSED

All files exist. All commits verified.
