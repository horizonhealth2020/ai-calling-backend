---
phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no
plan: 02
subsystem: payroll-carryover
tags: [bugfix, payroll, carryover, unlock, audit]
requires:
  - prisma.PayrollPeriod.carryoverExecuted
  - prisma.AgentPeriodAdjustment.holdAmount / carryoverSourcePeriodId / holdFromCarryover
  - services/audit.logAudit
provides:
  - AgentPeriodAdjustment.carryoverAmount column (deterministic reversal)
  - services/carryover.reverseCarryover(sourcePeriodId) export
  - PATCH /payroll/periods/:id/status reverses carryover on LOCKED -> OPEN
  - REVERSE_CARRYOVER audit action
affects:
  - prisma/schema.prisma
  - prisma/migrations/20260407000000_add_carryover_amount_to_agent_period_adjustment/
  - apps/ops-api/src/services/carryover.ts
  - apps/ops-api/src/routes/payroll.ts
  - apps/ops-api/src/services/__tests__/carryover.test.ts
tech-stack:
  added: []
  patterns:
    - stored-amount reversal (no recomputation drift)
    - prisma $transaction for multi-row atomic rollback
    - per-row partial-vs-full reversal branch based on remaining holdAmount
key-files:
  created:
    - prisma/migrations/20260407000000_add_carryover_amount_to_agent_period_adjustment/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/services/carryover.ts
    - apps/ops-api/src/routes/payroll.ts
    - apps/ops-api/src/services/__tests__/carryover.test.ts
decisions:
  - Store exact carried amount on target row (carryoverAmount) instead of recomputing on reverse -- eliminates drift from front edits between lock and unlock
  - Increment carryoverAmount on update path mirrors holdAmount increment semantics (supports multiple source periods contributing into the same target row)
  - Partial reversal (other sources contributed) keeps holdFromCarryover/label but zeroes carryoverAmount, so next execute starts clean
  - reverseCarryover wrapped in prisma.$transaction so partial failure cannot leave next period with mismatched hold vs metadata
  - Migration created manually using project's timestamp naming convention since no running DB is available in this session (consistent with existing migrations in prisma/migrations/)
metrics:
  duration: ~18 minutes
  completed: 2026-04-07
  tasks: 3
  files_modified: 4
  files_created: 1
  tests_added: 4
---

# Phase 45 Plan 02: Fronted Hold Carryover Survives Unlock/Re-lock

Payroll can now unlock a locked period, edit fronted amounts, and re-lock without silently losing the carryover into the next period. Research confirmed the root cause: `carryoverExecuted` was never reset on unlock, so re-lock silently skipped `executeCarryover` (Path A). This plan adds deterministic reversal via a stored carried-amount column plus a new `reverseCarryover` helper wired into the PATCH status handler.

## What Changed

Three production changes and a test expansion. The bug had two interlocking problems: (1) no way to cleanly undo a prior carryover without recomputation drift, and (2) no reset of `carryoverExecuted` on unlock. Both fixed in the same transaction-protected path.

## Tasks Executed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Add `carryoverAmount` column and persist on execute | DONE | 40e344f |
| 2 | `reverseCarryover` + PATCH status handler wiring | DONE | b995f86 |
| 3 | CARRY-08 / CARRY-09 / CARRY-10 test cases | DONE | bf92165 |

### Task 1 (`40e344f`)

- `prisma/schema.prisma` -- added `carryoverAmount Decimal? @map("carryover_amount") @db.Decimal(12, 2)` to `AgentPeriodAdjustment`, grouped directly after `carryoverSourcePeriodId` to keep carryover-related fields together.
- `prisma/migrations/20260407000000_add_carryover_amount_to_agent_period_adjustment/migration.sql` -- single `ALTER TABLE "agent_period_adjustments" ADD COLUMN "carryover_amount" DECIMAL(12,2);` statement. Created manually following the project's existing timestamp naming convention (`20260401000000_*`, `20260331000000_*` etc.) since no live DB is available in this session. Migration will apply via `prisma migrate deploy` at deploy time (Railway runs this in `apps/ops-api/package.json` `start` script).
- `apps/ops-api/src/services/carryover.ts` -- inside `executeCarryover`'s upsert block, added `carryoverAmount: carryHold` on the `create` path and `carryoverAmount: { increment: carryHold }` on the `update` path (mirrors the existing `holdAmount` increment semantics so multi-source contributions accumulate correctly).
- `npx prisma generate` regenerated the Prisma Client against the new schema so the new field is available on the type.

### Task 2 (`b995f86`)

- `apps/ops-api/src/services/carryover.ts` -- added `export async function reverseCarryover(sourcePeriodId)`. Wrapped in `prisma.$transaction` so partial failures cannot leave the next period in an inconsistent state.
  - Early-returns `{ reversed: 0, rowsTouched: 0 }` when source period doesn't exist or `carryoverExecuted=false` (makes the helper safe to call unconditionally).
  - Queries all `AgentPeriodAdjustment` rows where `carryoverSourcePeriodId` matches and `holdFromCarryover=true`.
  - For each row: reads stored `carryoverAmount`, subtracts from `holdAmount`. If the new hold is zero, clears all carryover metadata (`holdFromCarryover`, `holdLabel`, `carryoverSourcePeriodId`, `carryoverAmount`). If non-zero (other sources contributed), keeps metadata but clears `carryoverAmount`.
  - Finally flips source period's `carryoverExecuted` back to `false` so re-lock re-executes cleanly.
- `apps/ops-api/src/routes/payroll.ts` -- imported `reverseCarryover` alongside `executeCarryover`. In the PATCH status handler, after the period fetch and before the status update, added a guard: if transitioning `LOCKED -> OPEN` AND `period.carryoverExecuted`, call `reverseCarryover` and write a `REVERSE_CARRYOVER` audit entry with `{ reversed, rowsTouched }`. On failure, returns HTTP 500 with a descriptive error (unlike the existing lock path which swallows errors, because a failed reverse would leave stale hold on the next period, which is worse than a failed lock). The existing LOCK branch (`executeCarryover` call) is untouched and still runs after the update.

### Task 3 (`bf92165`)

- Extended `apps/ops-api/src/services/__tests__/carryover.test.ts` mock wiring with a `$transaction` stub that invokes the callback with a tx proxy reusing the same mocks (no separate tx mock state).
- Added `agentPeriodAdjustment.findMany` and `.update` mocks plus resets in `beforeEach`.
- **CARRY-08 (two cases):** (a) reverse with 200 carryoverAmount and 200 hold -> row cleared, source reset. (b) no-op when source `carryoverExecuted=false` (verifies the early return).
- **CARRY-09:** Full lock -> unlock -> edit -> re-lock cycle. Verifies the regression path directly: first `executeCarryover` creates hold=200, carryoverAmount=200; `reverseCarryover` zeros it and resets the source; second `executeCarryover` (after fronted edited to 300) creates hold=300, carryoverAmount=300. This is the exact bug 45 scenario.
- **CARRY-10:** Partial reversal — row has `holdAmount=500` but `carryoverAmount=200` (300 from other sources). After reverse: `holdAmount=300`, `carryoverAmount=null`, metadata preserved.
- All 10 tests (6 existing + 4 new) pass under `npx jest --config apps/ops-api/jest.config.ts`.

## Deviations from Plan

### [Rule 3 - Blocking] Migration created manually, not via `prisma migrate dev`

- **Found during:** Task 1
- **Issue:** The plan called for `npx prisma migrate dev --name add_carryover_amount_... --create-only`, but `prisma migrate dev` requires a connected DB to shadow-diff the schema, and there is no live dev database available in this sequential-executor session.
- **Fix:** Created the migration file manually at `prisma/migrations/20260407000000_add_carryover_amount_to_agent_period_adjustment/migration.sql` following the project's existing timestamp naming convention (the last three migrations use manual `YYYYMMDD000000` prefixes, e.g. `20260401000000_add_agent_period_adjustments`). The SQL is the exact single-statement `ALTER TABLE` call the plan specified. `npx prisma generate` was run separately to update the client without needing a DB.
- **Impact:** None — migration will apply correctly via `prisma migrate deploy` at Railway deploy time (per `apps/ops-api/package.json` `start` script). No shadow DB drift risk since the change is additive/nullable.

### [Rule 3 - Blocking] Root `jest` cannot parse TS; used ops-api config directly

- **Found during:** Task 3 verification
- **Issue:** The plan's verify command was `cd apps/ops-api && npx jest src/services/__tests__/carryover.test.ts`, but the repo root has a Morgan JS jest config that doesn't include ts-jest — running from root failed with a Babel TS parse error.
- **Fix:** Ran `npx jest --config jest.config.ts src/services/__tests__/carryover.test.ts` from `apps/ops-api/` to use the local ts-jest config. This matches what CI would do for ops-api tests.
- **Impact:** None functional — all 10 tests pass cleanly. Documented so future executors know which config to use.

### No `tsc --noEmit` whole-project run

The plan's acceptance criteria asked for `cd apps/ops-api && npx tsc --noEmit` exit 0 on both tasks. A full project tsc was not run because the pre-existing 45-01 Self-Check already documented that `apps/ops-api` has many out-of-scope pre-existing errors (missing `@types/*`, Prisma client staleness against other fields, `rootDir` complaints on workspace imports). Spot checks via `grep` on `tsc` output filtered to the three files modified in this plan (`carryover.ts`, `routes/payroll.ts`) returned zero errors — no new TypeScript errors were introduced. Pre-existing errors remain deferred per the SCOPE BOUNDARY rule from 45-01 SUMMARY.

## Acceptance Criteria

- `grep -n "carryoverAmount" prisma/schema.prisma` — 1 match inside AgentPeriodAdjustment.
- `prisma/migrations/20260407000000_add_carryover_amount_to_agent_period_adjustment/migration.sql` — exists, contains `ADD COLUMN "carryover_amount"`.
- `grep -n "carryoverAmount" apps/ops-api/src/services/carryover.ts` — multiple matches (create payload, update increment, reverseCarryover row clear/partial paths).
- `grep -n "export async function reverseCarryover" apps/ops-api/src/services/carryover.ts` — 1 match.
- `grep -n "reverseCarryover" apps/ops-api/src/routes/payroll.ts` — 2 matches (import + call).
- `grep -n "REVERSE_CARRYOVER" apps/ops-api/src/routes/payroll.ts` — 1 match (audit action string).
- `grep -n "executeCarryover" apps/ops-api/src/routes/payroll.ts` — 2 matches (import + existing lock call, unchanged).
- `grep -c "CARRY-08\|CARRY-09\|CARRY-10" apps/ops-api/src/services/__tests__/carryover.test.ts` — all three present.
- `npx jest --config jest.config.ts src/services/__tests__/carryover.test.ts` (from apps/ops-api/) — 10/10 tests pass.

## Manual Smoke Test (recommended post-deploy)

1. Open payroll period with an agent-period adjustment `frontedAmount = 200`, lock it -> next period should show `Fronted Hold = 200` on that agent's adjustment.
2. Unlock the locked period -> next period's `Fronted Hold` drops to 0 (row cleared or decremented), `app_audit_log` shows a `REVERSE_CARRYOVER` entry.
3. Edit the source adjustment's `frontedAmount` to 300 and re-lock -> next period now shows `Fronted Hold = 300` (not 200, not 500).
4. Verify the source period has `carryoverExecuted = true` again after re-lock.

## Self-Check: PASSED

- File `prisma/schema.prisma` — contains `carryoverAmount` inside AgentPeriodAdjustment (verified in Edit diff).
- File `prisma/migrations/20260407000000_add_carryover_amount_to_agent_period_adjustment/migration.sql` — created (Write tool confirmed).
- File `apps/ops-api/src/services/carryover.ts` — contains `export async function reverseCarryover` and `carryoverAmount` in execute upsert (verified in Edit diffs).
- File `apps/ops-api/src/routes/payroll.ts` — contains `reverseCarryover` import + call, `REVERSE_CARRYOVER` audit string (verified in Edit diffs).
- File `apps/ops-api/src/services/__tests__/carryover.test.ts` — contains CARRY-08, CARRY-09, CARRY-10 describes (verified in Edit diff).
- Commit `40e344f` — created for Task 1 (git output confirmed).
- Commit `b995f86` — created for Task 2 (git output confirmed).
- Commit `bf92165` — created for Task 3 (git output confirmed).
- Jest suite: `10 passed, 10 total` (test runner output confirmed).
