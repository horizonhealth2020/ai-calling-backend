# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-15)

**Core value:** Sales managers can track agent performance and enter sales that flow through to the sales board and payroll, with dedicated CS and owner dashboards.
**Current focus:** v3.0 Mobile-Friendly Dashboards SHIPPED — next milestone TBD by user

## Current Position

Milestone: v3.0 Mobile-Friendly Dashboards
Phase: 76 of 76 (CS Mobile) — Planning
Plan: 76-01 shipped (SUMMARY written)
Status: Loop closed — Phase 76 complete, v3.0 milestone ready for transition (5/5 phases done)
Last activity: 2026-04-15 — UNIFY closed 76-01: CS dashboard mobile (5 files retrofit, zero mutation-logic/Recharts/sr-only modifications, AC-4 structurally verified)

Progress:
- Milestone v3.0: [██████████] 100% (5/5 phases complete — pending phase transition ceremony)
- Phase 76: [██████████] 100% Complete

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — v3.0 milestone ready for transition]
```

## Accumulated Context

### Decisions
- 2026-04-15: Phase 76 — Gate-override block (CSTracking:1125/1417) already renders above Save Resolution footer (1146/1438) in current JSX — VERIFY-and-ASSERT pattern (no lift needed). Audit caught plan over-claim; DOM-order precondition confirms on apply
- 2026-04-15: Phase 76 — Workspace outer div at CSTracking:1054/1346 already flexDirection:column — stack-mobile-md retargeted to 3 inner flex rows (Log Attempt pills, Resolution Type pills, Save/Discard footer). Audit-caught: would have been a no-op
- 2026-04-15: Phase 76 — Bottom-sheet component NOT needed — inline expanded-row pattern behaves natively as card-below-card when parent table uses `.responsive-table`. Resolved CONTEXT.md hedge
- 2026-04-15: Phase 76 — Wide outreach leaderboard (CSAnalytics:903) keeps minWidth:880 + horizontal scroll + swipe hint gated on useIsMobile+mounted. 11 columns card-ify to a >screen-height card — not worth stacking
- 2026-04-15: Phase 76 — useIsMobile hook call scoped to OutreachLeaderboard sub-component, not lifted to parent. Keeps hook consumer local
- 2026-04-15: Phase 76 — CSMyQueue main list is div-based (not `<table>`) with no row-level action buttons; retrofit applied only to StaleOverviewCard export helper table. Plan-vs-actual deviation logged
- 2026-04-15: Phase 76 — AC-4 structural guarantee via git-diff +/- parity grep: handler call signatures (handleResolveCb, handleResolvePt, handleLogAttempt) byte-identical between - and + lines; only className added. Structural pattern for future mutation-preservation phases
- 2026-04-15: Phase 75 — OwnerOverview `compact` state preserved alongside CSS classes (dual-responsive coexistence); documented inline
- 2026-04-15: Phase 75 — stack-mobile scoped to Agent KPI parent only; pure-title SECTION_HEADER divs left inline to prevent icon-above-text bug
- 2026-04-15: Phase 75 — Recharts component props untouched; ResponsiveContainer handles width, XAxis auto-hides overlapping labels
- 2026-04-15: Phase 75 — OwnerConfig + OwnerUsers deferred as admin-only (not mobile consumption surfaces)
- 2026-04-15: Phase 75 — sort controls NOT added to card mode; desktop power-user workflow
- 2026-04-15: Phase 74 — AgentSidebar conditionally unmounted on mobile (not CSS-hidden) to avoid double-mount and layout-collapse
- 2026-04-15: Phase 74 — MobileDrawer placed as sibling of LAYOUT div to avoid overflow:hidden clipping
- 2026-04-15: Phase 74 — Financial accuracy guaranteed structurally: git diff shows zero formatDollar/computeNetAmount/Number() modifications
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
- 2026-04-15 (Phase 75): AC-4 `npx tsc --noEmit` not executed locally — tsc binary absent from apps/ops-dashboard/node_modules. Edits are attribute-only (className + data-label) + one comment, so new TS errors are structurally impossible. Confirm on next `npm run dashboard:dev`.
- 2026-04-15 (Phase 76): AC-4 `npx tsc --noEmit` not executed locally — same tsc-absent condition as Phase 75. Edits in CSTracking/CSMyQueue/CSResolvedLog/CSSubmissions are attribute-only (className/data-label/inline style additions); CSAnalytics adds useIsMobile import + hook call + conditional JSX + empty fragment wrapper. TS risk on CSAnalytics is low (typed hook, standard JSX fragment). Confirm on next `npm run dashboard:dev`.
- 2026-04-15 (Phase 76): CSMyQueue minor deviation — plan assumed `<table>` + "Work" row buttons; actual implementation uses `<div>` rows with no row-level action buttons. Applied responsive-table + data-labels to the StaleOverviewCard export helper table only (the one actual `<table>` in the file, embedded in CSTracking for owner/admin). No skipped tasks; matches plan intent for table retrofit.
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
- 2026-04-14: Enterprise audit on 72-01-PLAN.md. Applied 5+5. Deferred 5. Verdict: conditionally acceptable → enterprise-ready after upgrades (hydration mismatch fix, focus trap, scroll-lock correctness, breakpoint renaming, hamburger a11y).
- 2026-04-14: Enterprise audit on 73-01-PLAN.md. Applied 5+5. Deferred 5. Verdict: conditionally acceptable → enterprise-ready after upgrades (sticky→inline submit for iOS keyboard safety, .responsive-table-no-label escape valve for inline edit + Actions cell, display-mode-aware container choice, exhaustive data-label list, Save/Cancel visual differentiation, scroll-affordance pattern decided, keyboard a11y AC added).
- 2026-04-14: Enterprise audit on 74-01-PLAN.md. Applied 4+2. Deferred 7. Verdict: conditionally acceptable → enterprise-ready (explicit sidebar mount-gate, WeekSection cell classification PRECONDITION, reading-first <th> discipline, structural net-accuracy argument via git diff + baseline triple, header status badge wrap-vs-stack inspection, pre-phase baseline capture step).
- 2026-04-15: Enterprise audit on 75-01-PLAN.md. Applied 0+3. Deferred 4. Verdict: enterprise-ready (SECTION_HEADER stack-mobile scope fix, AC-2 XAxis clause grounded to Recharts default, dual-responsive-system documentation comment).
- 2026-04-15: Enterprise audit on 76-01-PLAN.md. Applied 6+4. Deferred 4. Verdict: conditionally acceptable → enterprise-ready after upgrades (workspace stacking retargeted to inner rows not already-stacked outer, gate-override reframed as verify-not-lift, Task 3 step 6 deterministic rewrite, AC-6 keyboard a11y, responsive.css import precondition, exhaustive data-label enumeration for 2 CSTracking tables, Recharts grep scope widened, "Work" button + other touch-targets enumerated, baseline-triple, handler-level boundaries).

### Git State
Last commit: 9ab6593 — MOBILE VERSION (includes Phase 74 payroll mobile changes)
Previous: 785fa02 — feat(73): manager dashboard mobile (v3.0 phase 2/5)
Previous: ff16434 — feat(72): responsive foundation for v3.0 mobile-friendly dashboards
Branch: main
Feature branches merged: none

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-04-15
Stopped at: Phase 76 complete — v3.0 milestone ready for transition ceremony (commit + PROJECT.md evolution + ROADMAP close)
Next action: Run phase transition for Phase 76; then milestone v3.0 closure (or user direction)
Resume file: .paul/phases/76-cs-mobile/76-01-SUMMARY.md
Resume context:
- v3.0 milestone at 100% (5/5 phases): 72 ✓ 73 ✓ 74 ✓ 75 ✓ 76 ✓ — all role-based dashboards mobile-friendly at 375px
- Phase 76 shipped: 5 CS files retrofit (CSTracking, CSMyQueue, CSSubmissions, CSResolvedLog, CSAnalytics)
- AC-4 structural guarantee verified: handler call signatures preserved byte-identical in git-diff +/- parity; zero Recharts/sr-only modifications
- Deferred: tsc verify (tsc binary absent, same as Phase 75 — low risk on attribute-only + 1 hook import); CSMyQueue plan-vs-actual structural deviation
- Transition pending: commit Phase 76, evolve PROJECT.md (v3.0 Active → Shipped), mark Phase 76 + v3.0 milestone complete in ROADMAP.md

---
*STATE.md — Updated after every significant action*
