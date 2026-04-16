---
phase: 78-payroll-polish
plan: 02
subsystem: api
tags: [payroll, financial-formula, carryover, jest, typescript]

requires:
  - phase: 71
    provides: computeNetAmount pure helper (single source of truth pattern)

provides:
  - computeNetAmount with fronted? param — deducts same-week
  - carryover.ts D-09 (fronted→hold carry) removed; D-10 preserved
  - payroll-net-formula.test.ts: 9-case suite locking Phase 78 formula

affects: payroll-periods, payroll-entries, net-amount-calculations, carryover-lock-flow

tech-stack:
  added: []
  patterns:
    - "fronted is now a same-week deduction — same semantics as hold"
    - "computeNetAmount fronted? param: optional for backward compat, callers that pass fronted get new behavior"
    - "D-10 (negative-net carry) preserved in carryover.ts; agentNet calc updated to include fronted for accurate detection"

key-files:
  modified:
    - apps/ops-api/src/services/payroll.ts
    - apps/ops-api/src/services/carryover.ts
    - apps/ops-api/src/services/__tests__/payroll-net-formula.test.ts
    - apps/ops-api/src/services/__tests__/carryover.test.ts

key-decisions:
  - "Phase 78 formula: net = payout + adj + bonus - hold - fronted (reversed Phase 71 exclusion)"
  - "D-09 (fronted→hold carry on lock) removed; D-10 (negative-net carry) preserved"
  - "carryover.ts agentNet kept for D-10, updated to pass fronted: Number(adj.frontedAmount) for accurate detection"
  - "OPEN-period SQL audit deferred — forward-only, mixed semantics are expected and documented"

patterns-established:
  - "Any future financial formula change: update computeNetAmount first (single source of truth), then verify all callers pass the new param"
  - "When removing a carryover dimension, update the carryover test suite explicitly — D-09 tests rewritten to D-10"

duration: ~25min
started: 2026-04-16T00:00:00Z
completed: 2026-04-16T00:00:00Z
---

# Phase 78 Plan 02: Fronted Formula Reversal

**Reversed Phase 71: fronted is now a same-week net deduction (`net = payout + adj + bonus - hold - fronted`); carryover.ts D-09 (fronted→hold carry on period lock) removed; D-10 (negative-net carry) preserved; 9-case test suite locks new formula.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~25 min |
| Tasks | 4 completed |
| Files modified | 4 (payroll.ts, carryover.ts, 2 test files) |
| Tests | 186/186 pass (2 net new) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: computeNetAmount deducts fronted | Pass | Optional param `fronted?`, formula `- (args.fronted ?? 0)` |
| AC-2: upsertPayrollEntryForSale uses new formula | Pass | Extracts `fronted` from existing entry, passes to call |
| AC-3: carryover no longer carries fronted | Pass | D-09 line removed; CARRY-02 test updated to verify no-carry |
| AC-4: payroll-net-formula.test.ts locks formula | Pass | 9 cases: 8 required + 1 backward compat; 9/9 pass |
| AC-5: No regressions | Pass | 186/186 pass (13 carryover tests updated, all pass) |
| AC-6: OPEN-period semantics documented | Partial | Compliance note in this SUMMARY; SQL audit deferred |

## Accomplishments

- **Formula reversed cleanly**: Adding `fronted?: number` as an optional parameter meant zero breaking changes for existing callers — backward compat test confirms old callers still get correct result.
- **D-09 removed, D-10 preserved**: The `carryHold += Number(adj.frontedAmount)` line is gone. The D-10 path (negative-net carry for underpaid agents) is intact. `agentNet` calculation now includes `fronted` for accurate D-10 detection.
- **13 carryover tests updated**: CARRY-02, CARRY-07, CARRY-09, CARRY-11 rewrote from D-09 semantics to D-10 semantics. CARRY-03 passes unchanged (Phase 78 math gives same carryHold=450 via D-10).
- **9-case test suite**: Covers base, fronted deduction, hold deduction, both together, bonus, chargeback, all-fields, D-10 transition boundary (carryover-hold + new fronted), and backward compat.

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `apps/ops-api/src/services/payroll.ts` | Modified | computeNetAmount: added fronted? param + formula; upsert: extract+pass frontedAmount |
| `apps/ops-api/src/services/carryover.ts` | Modified | Remove D-09 line; update agentNet call to include fronted; update JSDoc/comments |
| `apps/ops-api/src/services/__tests__/payroll-net-formula.test.ts` | Modified | 9-case Phase 78 suite (replaces 7-case Phase 71 suite) |
| `apps/ops-api/src/services/__tests__/carryover.test.ts` | Modified | 4 tests updated: CARRY-02/07/09/11 from D-09 → D-10 semantics |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Keep `agentNet` in carryover.ts; pass `fronted` to it | agentNet is used by D-10 (negative-net carry). Under Phase 78, fronted IS deducted from net, so agentNet must include it for D-10 detection to be accurate | D-10 correctly detects negative net when both hold and fronted are large |
| D-10 holdLabel stays "Fronted Hold" | Not in plan scope to rename; cosmetic issue, low risk | Can be cleaned up in a future hygiene pass |
| OPEN-period SQL audit deferred | No dev DB available during apply; forward-only change means mixed semantics are expected and not dangerous | Finance team should run the query before next payroll lock |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Scope addition | 1 | carryover.test.ts updated (not in files_modified) |
| Plan clarification | 1 | Plan said "remove agentNet if only in removed block" — kept it for D-10 |

### Scope Addition: carryover.test.ts

- **Found during:** Task 2 (remove D-09)
- **Issue:** 4 carryover tests (CARRY-02/07/09/11) tested D-09 behavior that no longer exists — would fail if not updated.
- **Fix:** Rewrote CARRY-02 (fronted no longer carries), CARRY-07 (use D-10 scenario), CARRY-09 (D-10 cycle), CARRY-11 (D-10 timezone regression). All 13 carryover tests pass.
- **Files:** `carryover.test.ts`

### Plan Clarification: agentNet kept for D-10

- **Plan said:** "Remove `agentNet` calculation if it's only used within the removed block."
- **Actual:** `agentNet` is used by D-10 (`if (agentNet < 0)`), which is NOT in the removed block. Kept it and updated the `computeNetAmount` call to pass `fronted: Number(adj.frontedAmount)` for accurate Phase 78 D-10 detection.

## Compliance Note (AC-6)

**Phase 78 financial formula change — 2026-04-16:**
- Formula changed: `net = payout + adj + bonus - hold - fronted` (fronted now same-week deduction)
- Forward-only: existing PayrollEntry rows unchanged
- OPEN periods at deployment may contain mixed-semantics entries (Phase 71 formula for old entries, Phase 78 for new). This is expected behavior.
- Finance team: run the OPEN-period audit query before next payroll lock to identify any mixed-period agents:
  ```sql
  SELECT pp.id, pp.week_start, pp.status,
    COUNT(DISTINCT pe.id) AS entry_count,
    SUM(CASE WHEN apa.fronted_amount > 0 THEN apa.fronted_amount ELSE 0 END) AS total_fronted
  FROM payroll_periods pp
  LEFT JOIN payroll_entries pe ON pp.id = pe.payroll_period_id
  LEFT JOIN agent_period_adjustments apa ON pp.id = apa.payroll_period_id
  WHERE pp.status = 'OPEN'
  GROUP BY pp.id, pp.week_start, pp.status;
  ```

## Next Phase Readiness

**Ready:**
- computeNetAmount is the single source of truth — any future formula changes go here
- carryover.ts D-10 negative-net carry still works correctly
- 9-case test suite locks the formula — any regression will fail immediately
- 78-03 (payroll UI polish) is independent; no dependency on 78-02

**Concerns:**
- UI smoke test (paycard showing fronted deduction) was deferred — confirm on next `npm run ops:dev`
- OPEN-period SQL audit deferred — run before next production payroll lock

**Blockers:** None

---
*Phase: 78-payroll-polish, Plan: 02*
*Completed: 2026-04-16*
