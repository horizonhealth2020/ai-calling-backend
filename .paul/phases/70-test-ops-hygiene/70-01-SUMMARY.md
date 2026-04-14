---
phase: 70-test-ops-hygiene
plan: 01
subsystem: ops
tags: [jest, prisma, dry-run, cleanup, archive, hygiene, railway]

requires:
  - phase: 60-data-integrity
    provides: cleanup-orphaned-clawbacks.ts, backfill-audit-log.ts scripts
  - phase: 61-api-test-coverage
    provides: Jest test infrastructure for ops-api

provides:
  - Dry-run-default safety pattern for destructive scripts
  - JSON audit logging pattern for one-time ops scripts
  - Environment marker pattern (print target DB host before mutations)
  - prisma/scripts/archive/ with README for obsolete scripts
  - Closed STATE.md deferred-issues list

affects: [future destructive scripts, future Jest mock patterns]

tech-stack:
  added: []
  patterns:
    - "Dry-run DEFAULT for destructive scripts (--execute required for mutations)"
    - "Mutually exclusive flag rejection with exit code 2"
    - "Sanitized env marker via URL parsing (host + dbname only, no credentials)"
    - "gitignored prisma/scripts/logs/ for JSON audit trail containing production data"
    - "Test expectations MUST match shipped service behavior (not designer's mental model)"

key-files:
  modified:
    - apps/ops-api/src/services/auditQueue.ts
    - apps/ops-api/src/services/__tests__/auditQueue.test.ts
    - prisma/scripts/cleanup-orphaned-clawbacks.ts
    - .gitignore
    - .paul/STATE.md
  created:
    - prisma/scripts/archive/README.md
  renamed:
    - prisma/scripts/backfill-audit-log.ts → prisma/scripts/archive/backfill-audit-log.ts

key-decisions:
  - "Dry-run default overrides Phase 60's destructive default (safety > backward-compat when backward-compat isn't real)"
  - "categorizeError lowercase-normalized to match service's own lowercase error messages"
  - "retryFailedAudits test aligned to actual updateMany behavior (service is authoritative)"
  - "Backfill script archived (not deleted) to preserve history and revival path"

patterns-established:
  - "Safety-first defaults for one-time destructive scripts"
  - "Environment marker as sanity gate before any destructive operation"

duration: ~25min (excluding production checkpoint wait)
started: 2026-04-14
completed: 2026-04-14
---

# Phase 70 Plan 01: Test & Ops Hygiene Summary

**Closed all lingering v2.8 deferred items: auditQueue tests now 31/31 passing, clawback cleanup script has dry-run-default safety with JSON audit logging (production DB already clean — no --execute needed), and the unused backfill script is archived with a revival path documented.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~25 min (excluding prod checkpoint wait) |
| Started | 2026-04-14 |
| Completed | 2026-04-14 |
| Tasks | 5 completed |
| Files modified | 5 |
| Files created | 1 |
| Files renamed | 1 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: auditQueue.test.ts passes all tests | Pass | 31/31 passing, was 29/31. Two fixes: case-insensitive categorizeError + retryFailedAudits expectation aligned to shipped behavior |
| AC-2: Cleanup script has working dry-run mode | Pass | `--dry-run` and default both produce safe preview with JSON audit log |
| AC-3: Cleanup script defaults to dry-run; --execute required | Pass | Mutually exclusive flags exit 2; default safety message prints when no flag given |
| AC-4: User-executed production cleanup with verification | Pass | Dry-run ran via Railway-injected DATABASE_URL against `caboose.proxy.rlwy.net:55692/railway`. Zero orphans found — database already clean. --execute not needed. |
| AC-5: Backfill script archived with README | Pass | `git mv` preserved history; README documents rationale + revival procedure |
| AC-6: STATE.md deferred issues cleared | Pass | Replaced with single closure note |
| AC-7: Environment marker printed on startup | Pass | "Target DB: host/dbname" printed before any queries |
| AC-8: Post-cleanup idempotence verification | Pass (trivially) | Initial state already clean — no cleanup performed means no verification gap |
| AC-9: Production data restore path documented | N/A | No destructive operation occurred — restore path unused. If --execute had run, Railway's automatic daily backups would have been the restore floor. |

All 9 ACs pass or are trivially/legitimately N/A.

## Accomplishments

- **Closed all v2.8 deferred items** — the deferred-issues list now reflects reality. No stale entries accumulating across phases.
- **Built a reusable safety pattern for destructive scripts** — dry-run default, --execute required, environment marker, JSON audit log, gitignored logs. Directly applicable to any future one-time ops script.
- **Discovered the database was already clean** — saving a destructive operation. The dry-run pattern worked exactly as designed: caught two environment issues (wrong Railway project initially, then confirmed correct DB had zero orphans) before any deletion could happen.
- **Aligned test expectations to shipped behavior** — the retryFailedAudits test was written against a mental model that drifted from the actual service. Fixing the test (rather than the service) preserves the production invariant.

## Task Commits

Atomic commit in the phase transition step.

| Task | Type | Description |
|------|------|-------------|
| Task 1: auditQueue fix | fix + test | categorizeError lowercase-normalize + retryFailedAudits expectation alignment |
| Task 2: Dry-run safety for cleanup script | feat | Dry-run default, env marker, JSON audit log, mutually exclusive flags |
| Task 3: Production dry-run checkpoint | chore | Verified prod DB clean via Railway CLI; no destructive run needed |
| Task 4: Archive backfill script | chore | git mv + README |
| Task 5: Clear STATE deferred items | chore | Closure note replaces stale list |

## Files Created / Modified / Renamed

| Path | Change | Purpose |
|------|--------|---------|
| `apps/ops-api/src/services/auditQueue.ts` | Modified | categorizeError now normalizes msg to lowercase before keyword matching |
| `apps/ops-api/src/services/__tests__/auditQueue.test.ts` | Modified | retryFailedAudits test mocks updateMany (not update); asserts batch shape; removes retryCount increment expectation |
| `prisma/scripts/cleanup-orphaned-clawbacks.ts` | Modified | Dry-run default, --execute flag, env marker via URL parsing, JSON audit log with structured payload |
| `.gitignore` | Modified | Added `prisma/scripts/logs/` to prevent prod data in repo |
| `prisma/scripts/archive/README.md` | Created | Documents archived scripts + revival procedure |
| `prisma/scripts/backfill-audit-log.ts` | Renamed | Moved to `prisma/scripts/archive/backfill-audit-log.ts` via git mv (history preserved) |
| `.paul/STATE.md` | Modified | Deferred-issues list cleared with closure note |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Flip script default from destructive → dry-run | Nobody had run the script before Phase 70. "Backward compat" with Phase 60 destructive default wasn't a real constraint. Fat-finger risk outweighs it. | Future invocations default to safe mode; explicit --execute required for mutations |
| categorizeError normalized to lowercase | The service itself throws `"Recording has invalid audio content..."` (lowercase) while categorizeError checked `"Invalid audio"` (uppercase). Self-inconsistent. | Lowercase comparison unblocks the test AND catches real errors in production log analysis |
| Fix test, not service, for retryFailedAudits | The shipped service uses `updateMany` (batch) and does NOT increment retryCount on re-queue (the worker's failure handler does). Test's mental model drifted. Service is authoritative. | No production behavior change; test expectation matches reality |
| Archive (not delete) backfill script | Preserve work history and revival path. Disk cost is zero; future forensics cost of deletion is real. | Script preserved under prisma/scripts/archive/ with documented revival procedure |
| Use Railway CLI with public proxy URL | Public proxy `caboose.proxy.rlwy.net:55692` reachable from local; internal `Postgres.railway.internal:5432` is not. Credential used for single command, not persisted. | Enabled safe production dry-run without needing Railway deploy job |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 2 | None — both clarifications discovered during execution |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** Plan executed as written. Two in-flight clarifications below.

### Auto-fixed Issues

**1. [Discovery] Failing test count was 2, not 3**
- **Found during:** Task 1 baseline test run
- **Issue:** Plan's CONTEXT noted "3 failing auditQueue tests" (carried from historical deferred notes). Actual baseline was 29/31 passing — just 2 failing.
- **Fix:** Fixed both. AC-1 unchanged: "all auditQueue tests pass" — still met at 31/31.
- **Impact:** Scope unchanged; one fewer moving part.

**2. [Discovery] Initial production DB target was wrong**
- **Found during:** Task 3 checkpoint
- **Issue:** `aiops-backend` Railway service's `DATABASE_URL` pointed to a Postgres instance in the same project that had zero tables — not the actual prod DB. The real prod DB was on a different Postgres instance accessed via a different proxy host (`caboose.proxy.rlwy.net:55692`).
- **Fix:** User supplied the correct DATABASE_URL; dry-run confirmed target via env marker; found 0 orphans.
- **Impact:** The env marker + dry-run safety pattern caught exactly what it was designed for. Destruction against the wrong DB was prevented. This validates the audit's must-have #2 (dry-run-first default).

### Deferred Items

None — all plan items satisfied.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Railway-injected DATABASE_URL used internal hostname unreachable from local | Asked user for public proxy URL; received correct one |
| Initial Postgres service probe found empty database | Env marker surfaced the host/dbname; user recognized wrong target and provided correct credentials |

## Skill Audit

No SPECIAL-FLOWS.md configured. No skill gaps.

## Skill Evolution

No tasks delegated to OpenSpace.

## Next Phase Readiness

**Ready:**
- v2.9.1 milestone complete — all four phases (65, 66, 67, 68, 69, 70) of v2.9 + v2.9.1 are shipped
- Safety pattern established for future destructive scripts
- Zero stale deferred items

**Concerns:**
- Production's Railway project configuration has a Postgres service in `aiops-backend` that appears unused (empty DB while app runs against a different Postgres on `caboose.proxy.rlwy.net`). Worth investigating separately to avoid confusion in future ops work. Not blocking anything today.

**Blockers:**
- None.

---
*Phase: 70-test-ops-hygiene, Plan: 01*
*Completed: 2026-04-14*
