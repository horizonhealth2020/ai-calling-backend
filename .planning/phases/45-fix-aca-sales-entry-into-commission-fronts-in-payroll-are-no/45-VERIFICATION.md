---
phase: 45-fix-aca-sales-entry-into-commission-fronts-in-payroll-are-no
verified: 2026-04-07T00:00:00Z
status: human_needed
score: 14/14 must-haves verified (3 truths require human smoke test)
human_verification:
  - test: "ACA unified row renders on payroll dashboard"
    expected: "Submit Complete Care Max + addon + ACA checkbox (memberCount=2). Payroll dashboard shows ONE row with core badge + addon badge + ACA badge, commission as flat dollar (no 'x N members =' text)"
    why_human: "Visual rendering across React Query state, useMemo fold, badge styling — cannot grep verify behavior end-to-end"
  - test: "Lock -> unlock -> edit front -> re-lock carryover cycle"
    expected: "Lock period with frontedAmount=200 → next period Fronted Hold=200. Unlock → next period Fronted Hold=0, app_audit_log shows REVERSE_CARRYOVER. Edit front to 300, re-lock → next period Fronted Hold=300"
    why_human: "Migration applies at deploy time (no live DB in session); requires real Postgres + UI workflow to confirm end-to-end"
  - test: "CS round-robin cursor stability under paste/refresh"
    expected: "Query cs_round_robin_chargeback_index value. Paste 5 rows in CS Submissions, refresh, paste again — value unchanged. Submit batch of 5 → value increases by exactly 5 (mod repCount)"
    why_human: "Requires real DB + UI interaction to confirm preview vs commit split end-to-end"
---

# Phase 45: Fix ACA Sales Entry / Carryover / Round-Robin Verification Report

**Phase Goal:** Fix three independent bugs — (1) ACA payroll display verbose breakdown + disconnected rows; (2) fronted hold lost on unlock/re-lock; (3) CS round-robin cursor advancing on paste/refresh.

**Verified:** 2026-04-07
**Status:** human_needed (all automated checks pass; 3 manual smoke tests required for end-to-end behavioral confirmation)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

#### Plan 01 — BUGFIX-45-ACA

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1.1 | Manager submits parent + ACA → ONE unified row with core+addon+ACA badges | ? HUMAN | Fold logic at PayrollPeriods.tsx:151, badge condition WeekSection.tsx:249 verified — but visual render needs human |
| 1.2 | ACA commission cell shows plain dollar, never `$X.XX x N members =` | VERIFIED | Verbose branch removed: grep for `members =` and `entry.sale.memberCount} members` returns 0 matches in WeekSection.tsx |
| 1.3 | Printed payroll matches dashboard ACA display | VERIFIED | PayrollExports.tsx fold at L130, byType has ACA_PL bucket L192, names appended to CORE with `(ACA)` suffix L197 |
| 1.4 | Already-submitted ACA sales render correctly with no migration | VERIFIED | Display-only fix: API surfaces existing `acaCoveringSaleId` field; client folds existing rows; no schema/data migration in plan 01 |

#### Plan 02 — BUGFIX-45-CARRYOVER

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 2.1 | First-lock path carries fronted into next period as Fronted Hold | VERIFIED | executeCarryover unchanged in this plan; existing CARRY-01..CARRY-07 still pass per SUMMARY |
| 2.2 | Unlock reverses carryover and resets `carryoverExecuted=false` | VERIFIED | reverseCarryover at carryover.ts:101; resets source period at end of tx; CARRY-08 test asserts |
| 2.3 | Re-lock after unlock+edit carries NEW amount (no stale hold) | VERIFIED | CARRY-09 test exercises full cycle and asserts hold=300 after edit |
| 2.4 | carryoverAmount stored on each next-period adjustment for deterministic reversal | VERIFIED | schema.prisma:710 has field; carryover.ts:71,78 writes on create+update |
| 2.5 | reverseCarryover audit-logged | VERIFIED | routes/payroll.ts:49 calls `logAudit(..., "REVERSE_CARRYOVER", ...)` |

#### Plan 03 — BUGFIX-45-ROUNDROBIN

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 3.1 | Pasting/refreshing CS page does NOT advance round-robin cursor | VERIFIED | repSync.ts:155 wraps upsert in `if (persist)`; CSSubmissions.tsx:438 sends `&preview=true`; RR-01 test asserts |
| 3.2 | Submit chargeback batch advances cursor inside same tx as createMany | VERIFIED | chargebacks.ts:100 `prisma.$transaction`, L244 `batchRoundRobinAssign(..., { persist: true, tx })` |
| 3.3 | Submit pending-term batch advances cursor inside same tx as createMany | VERIFIED | pending-terms.ts:45 `prisma.$transaction`, L75 `batchRoundRobinAssign(..., { persist: true, tx })` |
| 3.4 | Tx failure rolls back cursor | VERIFIED | RR-03 test simulates throw inside tx and asserts cursor unchanged |
| 3.5 | Manual override in assignedTo dropdown still flows through | VERIFIED | Submit handlers POST records with their own assignedTo values; preview-only batch-assign call cannot interfere |
| 3.6 | Client-side random-offset fallback at L442-447 still runs only on API failure | VERIFIED | CSSubmissions.tsx:444 logs `batch-assign API failed ... using local fallback` — fallback path preserved |

**Score:** 14/14 truths verified (3 flagged for human smoke confirmation of end-to-end behavior)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `apps/ops-api/src/routes/payroll.ts` (Plan 01) | acaCoveringSaleId in sale select | VERIFIED | L20 contains `acaCoveringSaleId: true` inside the GET /payroll/periods include |
| `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` | acaCoveringSaleId on SaleInfo, acaAttached on Entry | VERIFIED | L15 acaCoveringSaleId, L23 acaAttached |
| `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` | Client-side fold pass | VERIFIED | acaAttached set at L151 inside useMemo |
| `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` | Badge updated, verbose branch removed | VERIFIED | L249 badge condition extended to `acaAttached`; grep for `members =` returns 0 matches |
| `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` | ACA_PL bucket, fold, CORE append | VERIFIED | L20 type, L130 fold, L192 byType, L196-197 CORE append |
| `prisma/schema.prisma` (Plan 02) | carryoverAmount on AgentPeriodAdjustment | VERIFIED | L710 `carryoverAmount Decimal? @map("carryover_amount") @db.Decimal(12, 2)` |
| `prisma/migrations/20260407000000_add_carryover_amount_to_agent_period_adjustment/migration.sql` | ALTER TABLE add column | VERIFIED | Single statement: `ALTER TABLE "agent_period_adjustments" ADD COLUMN "carryover_amount" DECIMAL(12,2);` matches schema field exactly |
| `apps/ops-api/src/services/carryover.ts` | executeCarryover writes carryoverAmount; reverseCarryover export | VERIFIED | L71 create payload, L78 update increment, L101 `export async function reverseCarryover` |
| `apps/ops-api/src/routes/payroll.ts` (Plan 02) | LOCKED→OPEN calls reverseCarryover | VERIFIED | L6 import, L48 call, L49 audit log; L65 executeCarryover preserved on lock path |
| `apps/ops-api/src/services/__tests__/carryover.test.ts` | CARRY-08/09/10 | VERIFIED | All three describes present; reverseCarryover imported L1; SUMMARY confirms 10/10 jest pass |
| `apps/ops-api/src/services/repSync.ts` (Plan 03) | persist/tx options | VERIFIED | L125-130 signature with `{ persist?, tx? }`, L136 run helper, L155 persist guard |
| `apps/ops-api/src/routes/cs-reps.ts` | preview query parsing | VERIFIED | L119-121 parses preview, calls with `persist: !preview`, returns `{ assignments, preview }` |
| `apps/ops-api/src/routes/chargebacks.ts` | $transaction wraps createMany + cursor advance | VERIFIED | L100 `prisma.$transaction`, L244 `batchRoundRobinAssign(..., { persist: true, tx })` |
| `apps/ops-api/src/routes/pending-terms.ts` | $transaction wraps createMany + cursor advance | VERIFIED | L45 `prisma.$transaction`, L75 `batchRoundRobinAssign(..., { persist: true, tx })` |
| `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` | preview=true in fetchBatchAssign | VERIFIED | L438 URL contains `&preview=true`; only one `batch-assign` call site in file |
| `apps/ops-api/src/services/__tests__/repSync.test.ts` | RR-01..RR-04 with persist coverage | VERIFIED | All four describes present, persist used in seed/snapshot pattern, reverseCarryover-style mock harness |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| PayrollPeriods.tsx fold | WeekSection.tsx badge | acaAttached marker | WIRED | L151 sets acaAttached on cloned parent; WeekSection L249 reads same field |
| routes/payroll.ts select | payroll-types.ts SaleInfo | acaCoveringSaleId field | WIRED | API selects field at L20; type declares it at L15 |
| routes/payroll.ts PATCH status | carryover.ts reverseCarryover | direct import + LOCKED→OPEN call | WIRED | L6 import, L48 call inside guarded transition branch |
| carryover.ts executeCarryover | AgentPeriodAdjustment.carryoverAmount | prisma upsert writes computed carryHold | WIRED | L71 (create) and L78 (update increment) match decision in SUMMARY |
| chargebacks.ts POST | repSync.ts batchRoundRobinAssign | tx-scoped call with `{ persist: true, tx }` | WIRED | L244 inside L100 transaction block |
| pending-terms.ts POST | repSync.ts batchRoundRobinAssign | tx-scoped call with `{ persist: true, tx }` | WIRED | L75 inside L45 transaction block |
| CSSubmissions.tsx fetchBatchAssign | routes/cs-reps.ts GET batch-assign | URL query `?preview=true` | WIRED | L438 client URL → L119 server preview parse |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| BUGFIX-45-ACA | 45-01-PLAN | Fix verbose ACA payroll rendering + visual fold of parent/child rows | SATISFIED | All Plan 01 truths and artifacts verified in code |
| BUGFIX-45-CARRYOVER | 45-02-PLAN | Fronts carry through unlock→edit→re-lock cycle | SATISFIED | Plan 02 reverseCarryover wired, schema migrated, tests pass per SUMMARY |
| BUGFIX-45-ROUNDROBIN | 45-03-PLAN | Round-robin cursor only advances on actual submit | SATISFIED | Plan 03 preview/commit split, tx wrapping, RR-01..RR-04 pass per SUMMARY |

Note: These requirement IDs are not present in REQUIREMENTS.md per phase context (treated as non-blocking traceability noise). The PLAN must_haves serve as the contract.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |

None — no TODO/FIXME/placeholder comments introduced; no empty handler bodies; no verbose text remnants. The deferred pre-existing TypeScript errors documented in 45-01-SUMMARY (`@types/bcryptjs`, stale Prisma client on workspace, `rootDir` warnings) are out-of-scope for phase 45 and explicitly logged per the SCOPE BOUNDARY rule.

### Human Verification Required

#### 1. ACA unified row renders correctly on payroll dashboard

**Test:** Submit a manager sale: Complete Care Max + Compass Care Navigator+ addon + ACA checkbox + memberCount=2. Open Payroll dashboard for the agent's current week.
**Expected:** Single row with core badge, addon badge, ACA badge, commission = (parent payout) + (ACA flat × 2), shown as a single flat dollar with no `x N members =` text. Print/CSV export shows ACA carrier name in CORE column with `(ACA)` suffix.
**Why human:** Visual rendering across React Query state, useMemo fold, badge styling — grep can confirm code structure but not behavioral correctness end-to-end.

#### 2. Carryover lock/unlock/edit/re-lock cycle

**Test:** With agent-period adjustment frontedAmount=200, lock period. Verify next period shows Fronted Hold=200. Unlock the source period. Verify Fronted Hold=0 and `app_audit_log` has REVERSE_CARRYOVER row. Edit frontedAmount to 300, re-lock. Verify next period now shows Fronted Hold=300.
**Expected:** Final state: source period has carryoverExecuted=true again; next period has hold=300, carryoverAmount=300; no stale 200 contribution.
**Why human:** Migration applies via `prisma migrate deploy` at Railway deploy time (no live DB in session). Behavioral end-to-end requires real Postgres + UI workflow.

#### 3. CS round-robin cursor stability

**Test:** Query `SELECT value FROM sales_board_setting WHERE key='cs_round_robin_chargeback_index'`. Open CS Submissions, paste 5 chargeback rows, refresh page, paste 5 more. Re-query value (should be unchanged). Submit a batch of 5. Re-query value.
**Expected:** Value unchanged through paste/refresh; after submit, value increases by exactly 5 (mod active rep count).
**Why human:** Requires real DB + UI interaction to confirm preview vs commit split end-to-end.

### Gaps Summary

No automated gaps found. All 14 must-haves are verified at code level (artifacts exist, are substantive, and are wired correctly across the file boundaries). Three observable truths are flagged for human smoke testing because they require:

1. Real DB migration application (carryover column),
2. Live UI rendering (ACA fold + badge),
3. Real cursor persistence behavior under paste/submit cycles.

Test coverage in jest is strong (CARRY-08/09/10 + RR-01..RR-04 all pass per SUMMARY documentation). The manual smoke tests are confirmation gates, not gap closures.

---

_Verified: 2026-04-07_
_Verifier: Claude (gsd-verifier)_
