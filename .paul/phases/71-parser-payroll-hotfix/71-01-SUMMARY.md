---
phase: 71-parser-payroll-hotfix
plan: 01
subsystem: payroll
tags: [parser, payroll, net-formula, carryover, ach-detection, regression-test]

requires:
  - phase: 44-47 (v2.2)
    provides: applyChargebackToEntry, carryover-to-hold semantics
  - phase: 48 (v2.3)
    provides: receipt parser structure (ManagerEntry.tsx)

provides:
  - Line-scoped payment-type detection with Method-line ACH fallback
  - Exported computeNetAmount pure helper (payroll.ts)
  - Corrected net formula: payout + adjustment + bonus - hold (fronted EXCLUDED)
  - Regression test suite locking the formula (payroll-net-formula.test.ts)

affects: [future payroll work, any new receipt parser changes, reporting/analytics that read netAmount]

tech-stack:
  added: []
  patterns:
    - "Extract pure math helpers for regression-testable formulas (computeNetAmount pattern)"
    - "Line-scoped regex parsing over flattened-string regex when section boundaries matter"

key-files:
  created:
    - apps/ops-api/src/services/__tests__/payroll-net-formula.test.ts
  modified:
    - apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/services/carryover.ts
    - apps/ops-api/src/services/__tests__/carryover.test.ts
    - apps/ops-api/src/services/__tests__/payroll-guard.test.ts

key-decisions:
  - "Parser: line-scoped detection (find Payment header, then scan next 6 lines for Type: / Method:) replaces flattened-string regex that cross-matched Method as a payment type"
  - "Method-line ACH fallback: 9-digit routing number, or 'Bank'/'Checking'/'Savings' standalone words"
  - "Net formula REVERSED: fronted excluded from net (was additive since v2.1). Reason: fronted is a mid-week cash advance, already in agent's pocket"
  - "frontedAmount column preserved on entries — carryover.ts still reads it to generate next-period hold on lock"
  - "Scope extension approved mid-APPLY: carryover.ts:65 had duplicate net formula that also needed the fix (otherwise carryover under-carries prior-hold + new-fronted scenarios)"
  - "Forward-only fix: no retro recalc of historical/locked paycards"

patterns-established:
  - "computeNetAmount(): pure helper pattern for regression-testable financial formulas"
  - "Any file that computes agent net must import computeNetAmount from services/payroll — duplicate inline formulas are a bug source"

duration: ~35min
started: 2026-04-14T18:30:00Z
completed: 2026-04-14T19:05:00Z
---

# Phase 71 Plan 01: Parser ACH Detection + Fronted Net Formula Fix Summary

**Two production P0 hotfixes shipped: (1) receipt parser now detects ACH from blank-Type receipts via Method-line inspection, fixing a silent CC misclassification; (2) fronted amounts no longer inflate current-week paycards — reverses the v2.1 "fronted additive" decision across both payroll.ts and carryover.ts.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~35 min |
| Started | 2026-04-14T18:30:00Z |
| Completed | 2026-04-14T19:05:00Z |
| Tasks | 3 planned + 1 scope-extended = 4 executed |
| Files modified | 5 modified, 1 created |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Parser detects ACH from blank-Type receipt | Pass | Method-line fallback matches routing number `071926197` on Teresa Henneberg receipt → paymentType="ACH" |
| AC-2: Parser detects ACH from normal BANK receipts | Pass | `knownTypeMatch` on Type line value "BANK" → ACH |
| AC-3: Parser detects CC for card receipts | Pass | "CARD"/"CC"/"CREDIT" → CC via same path |
| AC-4: Net formula excludes fronted | Pass | 7/7 regression cases green in payroll-net-formula.test.ts |
| AC-5: Existing carryover flow unchanged (semantically) | Pass | D-09 fronted→hold still fires; D-10 negative-net detection now uses corrected agentNet (CARRY-03 expectation updated 350→450 to reflect the true owed amount) |

## Accomplishments

- **Eliminated a silent financial misroute**: previously, any receipt with a blank Payment Type line had paymentType parsed as "METHOD" (the next word token), which fell through to "CC", which would have shifted the sale into the wrong payroll week (ACH adds +1 week). Now correctly detected.
- **Fixed $100-class leak in carryover under prior-hold + mid-week-front scenarios**: the old formula caused carryover's negative-net detection to under-count by the fronted amount. Discovered mid-APPLY — scope extension kept carryover.ts and payroll.ts formula-consistent.
- **Created regression-testable pure helper** (`computeNetAmount`): future formula changes are now lockable via unit test without DB setup.

## Task Commits

Atomic commits were NOT made per task in this execution (single user approval covered the full plan). A single phase commit will be made during transition.

| Task | Type | Description |
|------|------|-------------|
| Task 1: Parser fix | fix(71) | Line-scoped Type detection + Method-line ACH fallback in ManagerEntry.tsx |
| Task 2: Net formula | fix(71) | Removed `+ fronted` from net; extracted computeNetAmount pure helper |
| Task 2b: Carryover scope extension | fix(71) | carryover.ts:65 aligned to computeNetAmount (user-approved boundary lift) |
| Task 3: Regression test | test(71) | New payroll-net-formula.test.ts with 7 cases |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` | Modified | Line-scoped payment-type detection; Method-line ACH fallback (routing#, Bank/Checking/Savings) |
| `apps/ops-api/src/services/payroll.ts` | Modified | Exported `computeNetAmount` pure helper; net formula no longer adds fronted |
| `apps/ops-api/src/services/carryover.ts` | Modified | Imports and uses `computeNetAmount` for agentNet; aligns D-10 negative-net detection with new formula |
| `apps/ops-api/src/services/__tests__/carryover.test.ts` | Modified | CARRY-03 expectation updated 350→450 (old value was itself leaking $100 under the corrected math) |
| `apps/ops-api/src/services/__tests__/payroll-guard.test.ts` | Modified | Doc-only net-formula consistency test updated to new formula (112 instead of 132) |
| `apps/ops-api/src/services/__tests__/payroll-net-formula.test.ts` | Created | 7 regression cases locking the new formula (A–G: baseline, fronted exclusion, bonus, chargeback, hold, combined, negative net) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Reverse v2.1 "Fronted additive in net formula" | User confirmed fronted is mid-week cash advance (already paid out) — additive double-pays | Paycards no longer inflated by fronted; carryover correctly creates next-period hold |
| Forward-only (Option A) — no retro recalc | User-approved; avoids disturbing locked/paid periods | Existing historical entries keep old net values until next upsert touches them |
| Scope extension (Option A, mid-APPLY) to update carryover.ts | Same formula existed in two places; partial fix would leak in prior-hold + new-fronted scenarios | Full formula consistency between paycard display and carryover accounting |
| Extract `computeNetAmount` helper | Two call sites now share one source of truth; future changes lockable by test | No more duplicate inline formulas; pattern to follow for future financial math |
| Method-line ACH signals: routing# OR "Bank"/"Checking"/"Savings" | Covers the three formats seen in Convoso receipts without false-positive risk on typical address lines | Receipt parser tolerant to blank Type lines |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | Stale doc test in payroll-guard.test.ts updated to new formula |
| Scope additions | 1 | carryover.ts + CARRY-03 test — user-approved before executing |
| Deferred | 1 | Pre-existing commission.test.ts failure (unrelated to Phase 71) |

**Total impact:** Scope extension was user-approved and strictly correctness-preserving — not scope creep. The stale doc test update was a 4-line fix ensuring test comments don't lie about the system. No scope creep.

### Auto-fixed Issues

**1. [Testing] Stale formula documentation in payroll-guard.test.ts**
- **Found during:** Task 3 verification (full test suite run)
- **Issue:** Pure-arithmetic test `"computes payout + adjustment + bonus + fronted - hold correctly"` asserted `132` — documentation of the OLD formula. Would mislead future readers but didn't actually verify any service behavior.
- **Fix:** Updated test body and name to the new formula; asserts `112` instead. Added comment pointing to payroll-net-formula.test.ts as the authoritative regression suite.
- **Files:** apps/ops-api/src/services/__tests__/payroll-guard.test.ts
- **Verification:** `npx jest payroll-guard` → 5/5 pass including the updated case.

### Scope Additions (user-approved)

**1. [Payroll] carryover.ts duplicate net formula**
- **Found during:** Task 2 qualify (grep for other `frontedAmount` references)
- **Issue:** `carryover.ts:65` computed `agentNet` with `+ fronted` for D-10 negative-net detection. Leaving it meant prior-hold + new-fronted scenarios would under-carry (example: prior hold=200, new fronted=100, no sales → correct owe=300, old formula carried 200, leaking $100).
- **Fix:** Imported `computeNetAmount` from payroll.ts; replaced inline formula with helper call. Updated CARRY-03 test expectation (350→450) with explanatory comment — the old value was itself the leak, not the new truth.
- **Files:** carryover.ts, carryover.test.ts
- **Verification:** Full carryover test suite (10 cases) pass; CARRY-09 lock→unlock→re-lock scenario still green.
- **User approval:** Option A explicitly selected before change was made.

### Deferred Items

- **commission.test.ts: `commissionApproved bypasses state halving`** — fails on clean `main` branch (verified via `git stash`). Expected `halvingReason` to be `null` but received `"Half commission - missing Compass VAB"`. Unrelated to Phase 71 (no commission.ts changes made). Deferred to a future phase as a standalone bug investigation.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Duplicate net formula discovered in carryover.ts mid-APPLY (boundary conflict) | Stopped, classified as SPEC issue, escalated to user with 3 options (extend / keep / re-plan). User chose A (extend). Boundary lifted and documented. |
| Bash shell state doesn't persist `cd` between tool calls on Windows | Switched to absolute paths for all subsequent commands. |

## Next Phase Readiness

**Ready:**
- v2.9.2 milestone ready to close (Phase 71 is the only phase).
- Paycards will reflect accurate net on next payroll mutation.
- New `computeNetAmount` helper available for any future formula work.
- Receipt parser robust against blank-Type receipts going forward.

**Concerns:**
- Historical/locked paycards that had non-zero fronted will retain their old (inflated) netAmount. If reporting/analytics sums these, totals will include the pre-fix values. No recalc requested — documented here for awareness.
- Pre-existing `commission.test.ts` failure should be triaged in a follow-up phase.
- PROJECT.md "Key Decisions" table still lists "Fronted additive in net formula | Active" — needs updating during transition to "Reversed in Phase 71 (fronted excluded)".

**Blockers:**
- None.

---
*Phase: 71-parser-payroll-hotfix, Plan: 01*
*Completed: 2026-04-14*
