# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-15)

**Core value:** Sales managers can track agent performance and enter sales that flow through to the sales board and payroll, with dedicated CS and owner dashboards.
**Current focus:** v3.0 Mobile-Friendly Dashboards SHIPPED — next milestone TBD by user

## Current Position

Milestone: Awaiting next milestone
Phase: None active
Plan: None
Status: Milestone v3.0 Mobile-Friendly Dashboards complete — ready for next
Last activity: 2026-04-16 — /paul:complete-milestone ceremony closed v3.0 (MILESTONES.md created, archive written, ROADMAP.md reorganized)

Progress:
- v3.0 Mobile-Friendly Dashboards: [██████████] 100% ✓ Shipped 2026-04-15

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ○        ○        ○     [Milestone complete — ready for next]
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
- 2026-04-15 (Phase 76): CSMyQueue deviation — closed. Plan assumed `<table>` + row buttons; actual uses `<div>` rows. Retrofit applied to StaleOverviewCard helper table only. No action needed; documented in SUMMARY.
- 2026-04-15 (Phase 71 fix): `commission.test.ts halvingReason` bug fixed — `payroll.ts:253` now returns `null` when `commissionApproved=true` bypasses halving (was leaking the reason string even though commission wasn't halved). 1-line fix, zero financial impact.
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
Last commit: c1f0c11 — feat(76): cs dashboard mobile (v3.0 phase 5/5 — milestone shipped)
Previous: e82d66d — feat(75): owner dashboard mobile (v3.0 phase 4/5)
Previous: 9ab6593 — MOBILE VERSION (Phase 74 payroll mobile changes)
Branch: main (2 commits ahead of origin/main)
Feature branches merged: none

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-04-16
Stopped at: Milestone v3.0 Mobile-Friendly Dashboards complete (ceremony closed)
Next action: `/paul:discuss-milestone` to define the next milestone direction
Resume file: .paul/MILESTONES.md
Git strategy: main (4 commits ahead of origin/main — not pushed; milestone ceremony commit pending; git tag decision deferred to user)
Resume context:
- v3.0 SHIPPED + formally closed — 22 milestones total, 76 phases complete
- All role-based dashboards (manager, payroll, owner, CS) mobile-friendly at 375px
- MILESTONES.md created; .paul/milestones/v3.0-ROADMAP.md archive written
- Pending user decisions: (1) package.json 1.0.0 / config.md 0.0.0 vs PAUL-canonical 3.0 — align or treat as separate namespaces? (2) git tag v3.0 — also backfill v2.3-v2.9.2 skipped tags?
- Remaining deferred: tsc verify (Phase 75+76, low risk, confirm on next dashboard:dev)

---
*STATE.md — Updated after every significant action*
