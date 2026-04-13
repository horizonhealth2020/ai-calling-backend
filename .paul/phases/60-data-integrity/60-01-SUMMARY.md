---
phase: 60-data-integrity
plan: 01
subsystem: database
tags: [prisma, data-cleanup, audit-log, one-time-scripts]

requires:
  - phase: none
    provides: n/a (first phase of v2.8)
provides:
  - Orphaned Clawback/PayrollEntry cleanup script
  - Activity feed audit log backfill script
affects: [61-api-test-coverage]

tech-stack:
  added: []
  patterns: [standalone PrismaClient scripts in prisma/scripts/]

key-files:
  created:
    - prisma/scripts/cleanup-orphaned-clawbacks.ts
    - prisma/scripts/backfill-audit-log.ts
  modified: []

key-decisions:
  - "Standalone PrismaClient instead of @ops/db import — workspace resolution doesn't work in tsx scripts"
  - "Commission recalculates lazily on next payroll action, not inline in cleanup script"
  - "Dedup keyed on entityType:entityId pair to prevent cross-type collisions"

patterns-established:
  - "One-time scripts live in prisma/scripts/ and use standalone PrismaClient"
  - "Backfilled audit entries use metadata.backfilled=true flag"

duration: ~10min
completed: 2026-04-13
---

# Phase 60 Plan 01: Data Integrity Scripts Summary

**Two one-time scripts: orphaned Clawback/PayrollEntry cleanup with atomic transactions and pre-deletion audit trail, plus activity feed backfill for historical Sales, Chargebacks, and PendingTerms.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~10min |
| Completed | 2026-04-13 |
| Tasks | 2 completed |
| Files created | 2 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Orphaned Clawback records deleted | Pass | Detects via matchedSaleId set, logs full JSON before deletion |
| AC-2: Orphaned PayrollEntries deleted + commission | Pass | Deletes in transaction, catches remaining orphans; lazy recalc on next payroll action |
| AC-3: Activity feed backfilled | Pass | Creates entries with original timestamps, entityType:entityId dedup |
| AC-4: Scripts are idempotent | Pass | Second run finds nothing / creates no duplicates |
| AC-5: Atomic per-clawback deletion | Pass | prisma.$transaction wraps ClawbackProduct + Clawback + PayrollEntry deletion |

## Accomplishments

- Orphan cleanup script finds Clawbacks with no ChargebackSubmission, deletes atomically with full pre-deletion logging
- Backfill script populates activity feed with historical Sale, ChargebackSubmission, and PendingTerm entries using original timestamps
- Both scripts idempotent, per-record error resilient, and disconnect in finally blocks

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `prisma/scripts/cleanup-orphaned-clawbacks.ts` | Created | Finds and removes orphaned Clawback + PayrollEntry records, logs full records before deletion |
| `prisma/scripts/backfill-audit-log.ts` | Created | Backfills AppAuditLog with historical Sale, ChargebackSubmission, PendingTerm entries |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Standalone PrismaClient (no @ops/db) | Workspace resolution fails in standalone tsx scripts | Pattern for all future prisma/scripts/ |
| Lazy commission recalc | Importing upsertPayrollEntryForSale would pull in @ops/db singleton; next payroll action recalculates automatically | No immediate commission fix — triggers on next payroll interaction per sale |
| entityType:entityId composite dedup | entity_id alone could theoretically collide across entity types | Prevents false dedup matches |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 0 | None |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** Plan executed as specified with audit-applied improvements.

## Issues Encountered

None.

## Next Phase Readiness

**Ready:**
- Scripts ready to run against production via `DATABASE_URL=... npx tsx prisma/scripts/<script>.ts`
- Pattern established for standalone scripts in prisma/scripts/

**Concerns:**
- Scripts haven't been run against production yet (no DB connection in dev) — user should run and verify output

**Blockers:**
- None

---
*Phase: 60-data-integrity, Plan: 01*
*Completed: 2026-04-13*
