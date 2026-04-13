---
phase: 64-polish-exports
plan: 02
subsystem: api
tags: [typescript, type-safety, ops-api]

requires:
  - phase: 61-api-test-coverage
    provides: Test safety net for verifying no regressions
provides:
  - Zero implicit any in ops-api source files
  - 127 type errors eliminated
affects: []

tech-stack:
  added: []
  patterns: [PrismaTx-for-transaction-callbacks, typeof-array-element-for-callbacks]

key-files:
  created: []
  modified:
    - apps/ops-api/src/routes/sales.ts
    - apps/ops-api/src/routes/payroll.ts
    - apps/ops-api/src/routes/change-requests.ts
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-api/src/routes/call-audits.ts
    - apps/ops-api/src/routes/call-logs.ts
    - apps/ops-api/src/routes/lead-timing.ts
    - apps/ops-api/src/routes/ai-budget.ts
    - apps/ops-api/src/routes/products.ts
    - apps/ops-api/src/routes/cs-reps.ts
    - apps/ops-api/src/routes/admin.ts
    - apps/ops-api/src/routes/pending-terms.ts
    - apps/ops-api/src/services/agentKpiAggregator.ts
    - apps/ops-api/src/services/auditQueue.ts
    - apps/ops-api/src/services/alerts.ts
    - apps/ops-api/src/workers/convosoKpiPoller.ts

key-decisions:
  - "PrismaTx (Prisma.TransactionClient) for all transaction callback parameters"
  - "(typeof array)[number] pattern for callback parameters on Prisma query results"
  - "Explicit Map generic types to resolve property access on {} defaults"

patterns-established:
  - "PrismaTx import for transaction callbacks across all route files"
  - "(typeof queryResult)[number] for array element typing in callbacks"

duration: ~15min
started: 2026-04-13
completed: 2026-04-13
---

# Phase 64 Plan 02: TypeScript any Cleanup Summary

**Eliminated all 112 implicit `any` parameters and 14 related type errors across 16 ops-api files — total errors reduced from 166 to 39.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Started | 2026-04-13 |
| Completed | 2026-04-13 |
| Tasks | 1 completed |
| Files modified | 16 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: All implicit any eliminated | Pass | 112 → 0 TS7006/TS7031 errors |
| AC-2: Related type errors resolved | Pass | 14 → 0 TS2322/TS2339 errors |
| AC-3: No regressions | Pass | 90/90 tests passing, total errors 166 → 39 |

## Accomplishments

- 127 type errors eliminated across 16 files (112 implicit any + 14 type mismatch + 1 binding)
- All `$transaction` callbacks typed with `PrismaTx`
- All array method callbacks (map/filter/reduce/find/some) typed
- Map constructors explicitly typed to resolve property access on `{}` defaults
- Zero runtime behavior changes — annotation-only
- Zero `as any` casts added

## Files Created/Modified

| File | Change | Fixes |
|------|--------|-------|
| routes/sales.ts | Modified | 61 annotations (tx, callbacks, Map types, destructuring) |
| services/agentKpiAggregator.ts | Modified | 9 annotations (agent, callbacks, reduce) |
| routes/payroll.ts | Modified | 8 annotations (tx, entry filters, addon maps) |
| services/auditQueue.ts | Modified | 7 annotations (Map types, filter/map callbacks) |
| routes/change-requests.ts | Modified | 5 annotations (tx, addon/entry maps) |
| routes/chargebacks.ts | Modified | 4 annotations (tx, entry filters, clawback map) |
| routes/call-audits.ts | Modified | 7 annotations (agent maps, leadSource Map type) |
| workers/convosoKpiPoller.ts | Modified | 3 annotations (existing map, agent callbacks) |
| routes/lead-timing.ts | Modified | 3 annotations (leadSource callbacks) |
| routes/ai-budget.ts | Modified | 3 annotations (agent group callbacks) |
| routes/products.ts | Modified | 2 annotations (entry callbacks) |
| routes/cs-reps.ts | Modified | 2 annotations (chargeback/term callbacks) |
| routes/call-logs.ts | Modified | 3 annotations (agent Map type, callbacks) |
| routes/admin.ts | Modified | 5 annotations (user/role maps, Map types) |
| services/alerts.ts | Modified | 1 annotation (tx) |
| routes/pending-terms.ts | Modified | 1 annotation (tx) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| `PrismaTx` for all tx params | Already exported from payroll.ts, consistent across codebase | All transaction callbacks now typed uniformly |
| `(typeof array)[number]` for callbacks | Derives element type from the actual query result, stays in sync | No manual interface maintenance needed |
| Explicit Map generics | Resolves `{}` default inference that caused TS2339 | Property access on Map values now type-safe |

## Deviations from Plan

None — plan executed exactly as written.

## Remaining Errors (Out of Scope)

39 remaining errors are all:
- TS2307: Cannot find module `@ops/db` (monorepo workspace resolution)
- TS6059: File not under rootDir (monorepo workspace config)
- TS7016: Missing declaration file for `bcryptjs` (@types package needed)

These are infrastructure/config issues, not application code issues.

## Next Phase Readiness

**Ready:**
- Phase 64 complete — both plans shipped
- v2.8 milestone ready for completion

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 64-polish-exports, Plan: 02*
*Completed: 2026-04-13*
