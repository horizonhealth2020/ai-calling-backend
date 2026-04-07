---
phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no
plan: 03
subsystem: cs-submissions
tags: [bugfix, round-robin, transactions, repSync]
requires: []
provides:
  - "batchRoundRobinAssign({ persist, tx }) preview/commit split"
  - "Transactional chargeback + pending-term submit with cursor advance"
  - "Client preview flag on /reps/batch-assign"
affects:
  - apps/ops-api/src/services/repSync.ts
  - apps/ops-api/src/routes/cs-reps.ts
  - apps/ops-api/src/routes/chargebacks.ts
  - apps/ops-api/src/routes/pending-terms.ts
  - apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx
tech-stack:
  added: []
  patterns:
    - "Optional Prisma.TransactionClient param for shared-tx helpers"
    - "Snapshot-and-rollback in unit tests for tx-failure simulation"
key-files:
  created:
    - apps/ops-api/src/services/__tests__/repSync.test.ts
  modified:
    - apps/ops-api/src/services/repSync.ts
    - apps/ops-api/src/routes/cs-reps.ts
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-api/src/routes/pending-terms.ts
    - apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx
decisions:
  - "preview=true query param chosen over a separate /reps/batch-preview endpoint (smaller diff, single source of truth)"
  - "Default persist=true preserves backwards compatibility for any non-CS callers"
  - "Chargeback POST tx uses 30s timeout to absorb the matching loop / clawback creation under load"
  - "Audit log writes for clawback creation moved post-commit (best-effort, not atomic) so log failures cannot roll back the customer-visible insert"
metrics:
  duration: "4m"
  tasks: 3
  files-modified: 5
  files-created: 1
  completed: "2026-04-07"
---

# Phase 45 Plan 03: CS Round Robin Cursor Fix Summary

JWT-auth-style preview/commit split for the CS round-robin cursor: client previews assignments without persistence, server advances the cursor only inside the chargeback/pending-term submit transactions so failed inserts roll back the cursor.

## What Shipped

- `batchRoundRobinAssign(type, count, { persist, tx })` — accepts a Prisma transaction client and a `persist` flag (default `true`). When `persist=false` it returns deterministic dry-run assignments and never touches `salesBoardSetting`.
- `GET /api/reps/batch-assign?preview=true` — client uses this for paste handlers, page-load reps fetch, and the rep-change `useEffect` so cursor never drifts.
- `POST /api/chargebacks` — `createMany` + member-id matching loop + clawback creation + cursor advance now run inside one `prisma.$transaction` (30s timeout). A thrown error anywhere rolls the cursor back.
- `POST /api/pending-terms` — same atomic `createMany` + cursor-advance pattern.
- `CSSubmissions.tsx fetchBatchAssign` — appends `&preview=true`. Random-offset client fallback (D-13) preserved for API-failure path.
- 4 unit tests in `repSync.test.ts` (RR-01..RR-04): preview no-op, commit advances, tx-failure rollback, preview determinism across calls.

## Tasks

| Task | Name                                                          | Commit  | Files                                            |
| ---- | ------------------------------------------------------------- | ------- | ------------------------------------------------ |
| 1    | Refactor batchRoundRobinAssign + cs-reps preview support      | 02839d7 | repSync.ts, cs-reps.ts                           |
| 2    | Wrap chargeback + pending-term submits in transactions        | 2f42bfe | chargebacks.ts, pending-terms.ts                 |
| 3    | Client preview flag + repSync tests                           | 9ad8ccc | CSSubmissions.tsx, repSync.test.ts               |

## Verification

- `cd apps/ops-api && npx tsc --noEmit` — zero new errors on changed files (pre-existing bcryptjs/rootDir errors are out of scope).
- `cd apps/ops-api && npx jest --config jest.config.ts src/services/__tests__/repSync.test.ts` — **4/4 PASS** (RR-01..RR-04).
- `cd apps/ops-dashboard && npx tsc --noEmit` — zero new errors on `CSSubmissions.tsx` (pre-existing payroll/middleware errors out of scope).

## Key Decisions

1. **Preview query param vs separate endpoint** — chose `?preview=true` (smaller diff, one route to maintain).
2. **Default `persist=true`** — backwards-compatible with any caller that doesn't pass opts.
3. **Audit log writes post-commit** — clawback audit entries are best-effort after the tx commits, so an audit failure cannot roll back a customer-visible insert.
4. **30s tx timeout on chargebacks POST** — research flagged the matching/clawback loop as potentially long-running; default 5s would timeout under load.
5. **Snapshot rollback in tests** — instead of wiring a real Prisma test DB, the mock `$transaction` snapshots `cursorStore`, lets the callback throw, and restores the snapshot — keeps tests fast and deterministic.

## Deviations from Plan

None. Plan executed exactly as written.

## Self-Check: PASSED

- FOUND: apps/ops-api/src/services/__tests__/repSync.test.ts
- FOUND: commit 02839d7 (task 1)
- FOUND: commit 2f42bfe (task 2)
- FOUND: commit 9ad8ccc (task 3)
- FOUND: `persist` references in repSync.ts (signature + upsert guard)
- FOUND: `Prisma.TransactionClient` import in repSync.ts
- FOUND: `preview` references in cs-reps.ts (query parse + response field)
- FOUND: `prisma.$transaction` + `batchRoundRobinAssign(..., { persist: true, tx })` in chargebacks.ts and pending-terms.ts
- FOUND: `preview=true` in CSSubmissions.tsx fetchBatchAssign
- FOUND: RR-01, RR-02, RR-03, RR-04 in repSync.test.ts (all PASS)
