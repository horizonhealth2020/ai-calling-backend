# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-13)

**Core value:** Sales managers can track agent performance and enter sales that flow through to the sales board and payroll, with dedicated CS and owner dashboards.
**Current focus:** v2.9.2 shipped (Phase 71) — ready for git commit and next milestone scoping

## Current Position

Milestone: v2.9.2 Parser & Payroll Hotfix — Phase 71 complete, awaiting transition
Phase: 71 of 71 (Parser ACH Detection + Fronted Net Formula Fix) — Complete
Plan: 71-01 complete (SUMMARY written)
Status: UNIFY complete — ready for transition (PROJECT.md / ROADMAP.md / git commit)
Last activity: 2026-04-14 — Created .paul/phases/71-parser-payroll-hotfix/71-01-SUMMARY.md

Progress:
- Milestone v2.9.2: [██████████] 100% (pending transition)
- Phase 71: [██████████] 100%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop closed — phase ready for transition]
```

## Accumulated Context

### Decisions
- 2026-04-14: Phase 71 — REVERSED v2.1 "Fronted additive in net formula" decision. Net formula is now `payout + adjustment + bonus - hold` (fronted EXCLUDED). Rationale: fronted is a mid-week cash advance already given to the agent; additive formula was double-paying.
- 2026-04-14: Phase 71 — computeNetAmount extracted as exported pure helper in payroll.ts; any file computing agent net must import it (no duplicate inline formulas). Pattern to follow for future financial math.
- 2026-04-14: Phase 71 — Receipt parser detects ACH via Method-line fallback when Type: line is blank. Signals: 9-digit routing number, or "Bank"/"Checking"/"Savings" standalone word.
- 2026-04-14: Phase 71 forward-only fix — no retro recalc of historical/locked paycards. Future upserts will naturally apply the new formula.
- 2026-04-14: Attribution model EXTENDED in Phase 69 — assignee-credit preserved; resolver-credit added alongside via assistSaves column
- 2026-04-14: assistSaves follows OUTCOME cutoff (pre-v2.9 cross-rep SAVED records count as assist)
- 2026-04-14: Bypass overrides credited to resolver (whoever clicked override), not assignee
- 2026-04-14: "(unresolved)" bypass bucket surfaces data-integrity signal, not silently handled
- 2026-04-14: Sort tiebreaker updated — saveRate desc, (saved + assistSaves) desc, assigned desc
- 2026-04-14: Assignee-credit attribution locked (not resolver-credit) — accountability belongs to assigned rep
- 2026-04-14: 366-day max range cap on /cs/analytics/outreach — prevents unbounded scans
- 2026-04-14: V29_CUTOFF split — pre-v2.9 records excluded from attempt metrics, included in outcome metrics
- 2026-04-14: Unknown assignees surface under "(unassigned/unknown)" row — never silently dropped
- 2026-04-14: Safe-default error contract for analytics — empty arrays/zero counts on sub-query failure, never null
- 2026-04-13: Pre-v2.9 records excluded from stale (requires ≥1 contact attempt)
- 2026-04-13: My Queue for CUSTOMER_SERVICE only (not owner/admin)
- 2026-04-13: CB staleness resets on attempt; PT staleness only clears on resolution
- 2026-04-13: UTC midnight baseline for 48-hour stale deadline
- 2026-04-13: Gate override always visible when < 3 calls
- 2026-04-13: bypassReason persisted on record for CS analytics drill-down

### Deferred Issues
- 2026-04-14 (Phase 71): `commission.test.ts: calculateCommission > state-aware bundle commission > commissionApproved bypasses state halving` fails on clean `main` — expected `halvingReason` to be `null`, received `"Half commission - missing Compass VAB"`. Unrelated to Phase 71 changes (no commission.ts modifications). Needs standalone triage in a future phase.
- All v2.8 deferred items closed in Phase 70 (2026-04-14): auditQueue test expectations aligned with shipped service behavior (31/31 passing); clawback cleanup dry-run against production found 0 orphans (DB already clean, no --execute needed); audit-log backfill script archived to prisma/scripts/archive/ as not needed (production feed organically populated in ~2 weeks).

### Audit Log
- 2026-04-13: Enterprise audit on 60-01-PLAN.md. Applied 3+3. Verdict: enterprise-ready.
- 2026-04-13: Enterprise audit on 61-01-PLAN.md. Applied 1+3. Verdict: enterprise-ready.
- 2026-04-13: Enterprise audit on 62-01-PLAN.md. Applied 2+2. Verdict: enterprise-ready.
- 2026-04-13: Enterprise audit on 63-01-PLAN.md. Applied 2+2. Verdict: enterprise-ready.
- 2026-04-13: Enterprise audit on 64-01-PLAN.md. Applied 1+1. Verdict: enterprise-ready.
- 2026-04-13: Enterprise audit on 64-02-PLAN.md. Applied 0+1. Verdict: enterprise-ready.
- 2026-04-13: Enterprise audit on 65-01-PLAN.md. Applied 1+2. Verdict: enterprise-ready.
- 2026-04-13: Enterprise audit on 66-01-PLAN.md. Applied 1+3. Verdict: enterprise-ready.
- 2026-04-13: Enterprise audit on 67-01-PLAN.md. Applied 1+3. Verdict: enterprise-ready.
- 2026-04-14: Enterprise audit on 68-01-PLAN.md. Applied 3+6. Verdict: enterprise-ready.
- 2026-04-14: Enterprise audit on 69-01-PLAN.md. Applied 3+2. Verdict: enterprise-ready.
- 2026-04-14: Enterprise audit on 70-01-PLAN.md. Applied 2+2. Verdict: enterprise-ready.

### Git State
Last commit: d1e4ae4 — feat(70): test & ops hygiene — close all v2.8 deferred items (v2.9.1 shipped)
Previous: bc84e01 — feat(69): resolver credit in outreach analytics
Previous: d20cb28 — feat(68): CS Analytics Upgrade (v2.9 complete)
Branch: main
Feature branches merged: none

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-04-14
Stopped at: Plan 71-01 UNIFY complete, transition pending
Next action: Execute transition — update PROJECT.md (reverse fronted-additive decision), mark ROADMAP v2.9.2 shipped, git commit Phase 71, then scope next milestone
Resume file: .paul/phases/71-parser-payroll-hotfix/71-01-SUMMARY.md
Resume context:
- v2.9.2 Parser & Payroll Hotfix milestone = Phase 71 only; phase now complete
- Two production bugs fixed: receipt parser ACH detection (blank-Type receipts), payroll net formula (fronted excluded)
- Scope extension approved and applied: carryover.ts:65 aligned to new formula (prevents $100-class leak in prior-hold + new-front scenarios)
- computeNetAmount pure helper now single source of truth for net math
- Regression-locked via new payroll-net-formula.test.ts (7 cases)
- Pre-existing commission.test.ts failure logged as deferred issue
- PROJECT.md still shows "Fronted additive" decision as Active — needs transition update

---
*STATE.md — Updated after every significant action*
