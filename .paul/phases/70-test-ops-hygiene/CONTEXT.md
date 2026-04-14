# Phase 70 — Test & Ops Hygiene

**Milestone:** v2.9.1 CS Analytics Refinement & Hygiene (closing)
**Depends on:** Phase 69 complete
**Created:** 2026-04-14

---

## What we're actually accomplishing

Close two lingering items from v2.8/v2.9 that have been tracked in STATE.md's deferred issues list. Both are small, concrete, and self-contained. This is a cleanup phase, not a feature phase.

## The three concerns

### 1. Fix the 3 failing `auditQueue.test.ts` tests

**Status:** Pre-existing failures since Phase 61, tracked as deferred.
**Why it matters:** CI test signal is polluted. Every `npm run test:ops` run shows "3 failed" which trains the team to ignore failures rather than investigate. New failures could hide in the noise.
**Root cause:** The Jest mock for `@ops/db` is incomplete — missing methods like `prisma.convosoCallLog.updateMany` that the `auditQueue.ts` service calls. When tests invoke the service, Jest throws `TypeError: db_1.prisma.convosoCallLog.updateMany is not a function` instead of running the test logic.
**Fix:** Add the missing Prisma method stubs to the test file's mock. Straightforward.

### 2. Run the orphaned clawback cleanup script against production

**Status:** Script built in Phase 60, never executed.
**User concern:** Cares about cleaning up stale clawback data that accumulated from the broken chargeback-delete flow before Phase 60 fixed it.
**What the script does:** Scans `Clawback` records with no matching `ChargebackSubmission`, logs full pre-deletion state, deletes them + associated zeroed `PayrollEntry` records in an atomic transaction.
**Safety addition needed before running:** The script currently has no dry-run mode. Running it blind against production is the kind of destructive action that gets checked by this plan. We add a `--dry-run` flag first, user previews the output, then runs for real.
**Execution:** Unavoidably a human-action step — Claude cannot touch the production DB. User opens a terminal and runs the commands.

### 3. Archive the audit-log backfill script as not needed

**Status:** Script built in Phase 60, not needed per user feedback.
**Why:** Production has only been live ~2 weeks. Activity feed has organically populated from real events in that window. Backfill would add historical data that managers don't need and weren't asking for.
**Action:** Move `prisma/scripts/backfill-audit-log.ts` to `prisma/scripts/archive/` with a short README noting why it's archived. Keeps the work record preserved without cluttering active ops.

## Scope Limits

- **No new features.** Test fix + data cleanup + file archival only.
- **No production DB writes by Claude** — the actual cleanup execution is a user-performed checkpoint.
- **No schema changes.** Read the data, delete bad rows, done.
- **No changes to the `AppAuditLog` backfill script's code** — it's correct, just not needed. Archive preserves the work.

## Open Questions (for planning)

1. Dry-run output format — just console logging of record IDs + counts? Or write to a file for posterity? Lean toward both: console summary + JSON file with full details for audit defensibility.
2. Should the archive README include instructions for un-archiving? Probably yes, minimal — "if orphan issues recur, review the pattern here; scripts can be revived from archive."
3. Test mock fix scope — only add what `auditQueue.test.ts` needs, or preemptively fill out other missing Prisma methods? Lean toward **only what's needed** — overreach invites scope creep.

## Success Criteria

- `npm run test:ops` reports 0 failures (171/171 passing, up from 168/171)
- Cleanup script has a working `--dry-run` flag that reports counts + record details without mutating
- User has a clean record of what was deleted (console + JSON log file)
- `backfill-audit-log.ts` moved to `prisma/scripts/archive/` with a short README
- STATE.md deferred-issues list is empty or only contains genuinely new items

## Out of Scope

- Running the cleanup against any non-production environment (only prod matters — that's where the stale data lives)
- Rebuilding the cleanup script from scratch (it works; only adding dry-run)
- Audit log backfill execution (archived as not needed)
- Any analytics / reporting changes (that was v2.9.1 phases 68-69)
- Broader Jest test mock overhaul (only fix what's blocking)

## Recommended Skills

- `jest` — for the test mock fix
- `prisma` / `postgresql` — for cleanup script dry-run addition (already invoked in Phase 60)
- `backend-dev-guidelines` — for the standalone Prisma script pattern (established in Phase 60)

---
*Ready for `/paul:plan 70` — consume this file for plan structure.*
