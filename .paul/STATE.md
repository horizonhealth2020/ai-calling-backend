# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-15)

**Core value:** Sales managers can track agent performance and enter sales that flow through to the sales board and payroll, with dedicated CS and owner dashboards.
**Current focus:** v3.2 Chargeback Correctness — Phase 79 ready to plan (approval gate + paycard display)

## Current Position

Milestone: v3.2 Chargeback Correctness — LOOP COMPLETE (phase 79 only)
Phase: 79 of 79 (Chargeback Approval Gate + Paycard Display) — Complete
Plan: 79-01 complete
Status: Loop closed. Phase 79 complete. Milestone v3.2 ready for transition (PROJECT.md evolve + git commit + tag) pending manual UAT + pre-deploy SQL query.
Last activity: 2026-04-16 — UNIFY of 79-01 complete. SUMMARY.md written. 186/186 tests pass. 1 deviation + 1 auto-fix + 1 deferred item logged.

Progress:
- v3.2 Chargeback Correctness: [██████████] 100% (pending UAT + ceremony)
- Phase 79: [██████████] 100% ✓

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ✓     [Loop complete — phase 79 done; milestone v3.2 ready for transition]
```

## Accumulated Context

### Decisions
- 2026-04-16: Phase 78-03 — ACH print: print-color-adjust: exact required on BOTH tr and td; browser strips tr background without it.
- 2026-04-16: Phase 78-03 — CS print restructured to per-agent cards; agent name right-aligned on same line as "Customer Service Payroll" header.
- 2026-04-16: Phase 78-03 — liveNet formula in WeekSection + PATCH /payroll/entries/:id both had Phase 71 formula (fronted additive); both fixed to Phase 78 (fronted deducts).
- 2026-04-16: Phase 78-03 — baseInputStyle not imported in WeekSection; SMALL_INP is the correct compact style constant.
- 2026-04-16: Phase 78-02 — REVERSED Phase 71 fronted formula. New formula: `net = payout + adj + bonus - hold - fronted`. D-09 (carryover.ts fronted→hold carry on lock) removed. D-10 (negative-net carry) preserved. agentNet in carryover.ts updated to include fronted for accurate D-10 detection.
- 2026-04-16: Phase 78-02 — carryover.ts agentNet kept (plan said "remove if only in removed block" but D-10 still uses it). computeNetAmount call updated to pass `fronted: Number(adj.frontedAmount)` so D-10 reflects Phase 78 net semantics.
- 2026-04-16: Phase 78-01 — String error root cause: HTML `<input type="number">` stores strings; Zod `z.number()` rejects them. Fix: `parseFloat()` coercion in `saveEdit()` before PATCH. Server-side sales.ts + change-requests.ts were already correct (`{ old, new }` wrapping + `.new` reads); zero server changes needed.
- 2026-04-16: Phase 78-01 — Addon premium input wrapper: `<div>` not `<label>` around addon row, so clicking the premium input doesn't toggle the checkbox (HTML label click-through).
- 2026-04-16: Phase 77 — No member-collapse existed in tracking list; CSTracking filteredChargebacks/filteredPending and GET routes already show each submission as its own row. AC-1 was pre-satisfied.
- 2026-04-16: Phase 77 — Soft dedupe uses composite key (memberCompany/memberName + memberId + date) queried by memberId IN [...] inside the transaction. Null-memberId records without a matching memberId query skip dedup (edge case; accepted). TOCTOU: concurrent POSTs at human paste-pace accepted without DB index.
- 2026-04-16: Phase 77 — stale-summary resolves rep name via DB lookup (prisma.user.findUnique at request time), not JWT payload. JWT is signed at login and won't carry csRepRosterId until session refresh.
- 2026-04-16: Phase 77 — Round-robin cursor advance guarded: only advances if `created.count > 0` (skips if all submitted records were dupes).
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
- 2026-04-16: Phase 79-01 — CS chargeback approval gate: POST /chargebacks only creates Clawback + applies paycard mutation for source !== "CS". CS-source defers to alerts.ts:approveAlert. WR-06 dedupe guard (createdAt >= cbCreatedAt on member_id/member_name branches) preserved as defense-in-depth.
- 2026-04-16: Phase 79-01 — formatDollarSigned() added to packages/utils as ADDITIVE utility (formatDollar unchanged to protect 40+ call sites). Leading-minus format for values that can legitimately be negative (chargeback cross-period rows, adjustments).
- 2026-04-16: Phase 79-01 — Frontend net math boundary: all 5 sites (WeekSection liveNet, WeekSection subtotal, PayrollPeriods per-agent pd, PayrollPeriods sidebar, PayrollPeriods print) now mirror server `computeNetAmount` at payroll.ts:28-36 exactly. Phase 71 `+ fronted` residue eliminated. entryAdj (sum of entry-level adjustmentAmount) threaded through AgentPeriodData type → AgentCard prop → WeekSection consumers.
- 2026-04-16: Phase 79-01 — CLAWBACK_CROSS_PERIOD row tint changed to `colorAlpha(semanticColors.statusDead, 0.08)` (red, matching CLAWBACK_APPLIED). ZEROED_OUT_IN_PERIOD stays yellow (in-period state still visually distinct from cross-period).
- 2026-04-16: Phase 79-01 — logAudit on ChargebackSubmission extended with matchedCount + deferredClawbackCount for SOC-style reconstruction of pending-approval state.
- 2026-04-16: Phase 79-01 — AgentPeriodData type extended with entryAdj field (payroll-types.ts) — audit-added deviation, not in plan files_modified. Required for TypeScript strict-mode enforcement of the new pd.entryAdj field.

### Deferred Issues
- 2026-04-15 (Phase 75): AC-4 `npx tsc --noEmit` not executed locally — tsc binary absent from apps/ops-dashboard/node_modules. Edits are attribute-only (className + data-label) + one comment, so new TS errors are structurally impossible. Confirm on next `npm run dashboard:dev`.
- 2026-04-15 (Phase 76): AC-4 `npx tsc --noEmit` not executed locally — same tsc-absent condition as Phase 75. Edits in CSTracking/CSMyQueue/CSResolvedLog/CSSubmissions are attribute-only; CSAnalytics adds useIsMobile import + hook + conditional JSX. Confirm on next `npm run dashboard:dev`.
- 2026-04-16 (Phase 78-02): OPEN-period SQL audit — run before next production payroll lock to identify agents with mixed Phase 71/78 semantics in OPEN periods.
- ~~2026-04-15 (Phase 76): CSMyQueue deviation — closed~~ **CLOSED**
- ~~2026-04-15 (Phase 71 fix): halvingReason bug fixed~~ **CLOSED**
- 2026-04-16 (Phase 78-03): AgentPeriodAdjustment.notes migration confirmed applied; notes feature functional.
- 2026-04-16 (Phase 79-01): **79-DEFER-01 — Handler-level integration tests for POST /chargebacks approval gate.** Plan required 3 new tests in chargeback-flow.test.ts (CS submission → alert-only, CS approval → clawback, PAYROLL source → inline). Existing test infrastructure is unit-only (Prisma mocks via @ops/db, no supertest + test DB). Test-infra upgrade judged scope-creep vs the 3-fix plan. Compensating controls: 4 structural grep audits pass, plan UAT mandates explicit assertions, 14 existing applyChargebackToEntry helper tests still pass. Future chargeback-flow changes should evaluate whether to unblock this before shipping similar gate logic.
- 2026-04-16 (Phase 79-01): Pre-deploy SQL query for pre-fix PENDING PayrollAlerts with associated pre-fix Clawbacks — must run against prod BEFORE shipping + brief payroll team on CLEAR-vs-APPROVE policy for dirty alerts. Query in 79-01-PLAN.md Verification section.
- 2026-04-16 (Phase 79-01): Manual UAT outstanding — Victoria Checkal numeric check ($603.07 / -$76.04), Socket.IO cross-tab cascade, CS-submit-no-paycard-change verification.

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
- 2026-04-16: Enterprise audit on 78-03-PLAN.md. Applied 3+2. Deferred 3. Verdict: conditionally acceptable → enterprise-ready after upgrades (server-side unapprove gate added to sales.ts, PATCH→POST composite-key notes endpoint, explicit notes select in GET payroll/periods, sales.ts added to files_modified).
- 2026-04-16: Enterprise audit on 78-02-PLAN.md. Applied 4+2. Deferred 2. Verdict: conditionally acceptable → enterprise-ready after upgrades (AC-6 OPEN-period mixed semantics, call-site inventory, carryover.ts JSDoc Phase 78 update, Case 8 transition boundary test, Task 4 OPEN-period audit query + compliance note).
- 2026-04-16: Enterprise audit on 78-01-PLAN.md. Applied 3+2. Deferred 1. Verdict: conditionally acceptable → enterprise-ready after upgrades (numeric string coercion root cause added as parallel string-error investigation, { old, new } wrapping made server-authoritative, commission baseline/delta verification concretized, CHANGES display line range added, addonProductIds initialization guard added).
- 2026-04-16: Enterprise audit on 77-01-PLAN.md. Applied 3+2. Deferred 1. Verdict: conditionally acceptable → enterprise-ready after upgrades (@unique on csRepRosterId for Prisma 1:1 migration, stale-summary filter pivoted to DB lookup vs JWT read, AC-6 rewritten to match Option A post-submit, /api/cs-reps PRECONDITION added, TOCTOU accepted-risk documented).
- 2026-04-16: Enterprise audit on 79-01-PLAN.md. Applied 1+6. Deferred 3. Verdict: conditionally acceptable → enterprise-ready after upgrades (pre-deploy SQL check for pre-fix dirty PENDING alerts + admin CLEAR-vs-APPROVE policy, logAudit extended with matchedCount/deferredClawbackCount, Socket.IO cross-tab cascade UAT, chargeback-flow.test.ts fixture-reuse precondition, Phase 47 WR-06 dedupe invariant named + grep-verified, print-view subtotal parity check, frontend-mirrors-server net-formula boundary codified).

### Git State
Last commit: 78685af — chore(paul): v3.1 milestone ceremony
Previous: bcfbc68 — chore(paul): close phase 78 — payroll polish + fronted fix
Previous: 5af1e55 — feat(77): cs fixes
Tag: v3.1 created
Branch: main
Feature branches merged: none

### Blockers/Concerns
None.

## Session Continuity

Last session: 2026-04-16
Stopped at: Phase 79 UNIFY complete. Loop closed. Milestone v3.2 ready for ceremony.
Next action: Manual UAT + pre-deploy SQL query → `/paul:complete-milestone` (evolve PROJECT.md, update ROADMAP milestone status, git commit + tag v3.2) — OR if UAT defers, pause here and run ceremony later.
Resume file: .paul/phases/79-chargeback-gate-and-display/79-01-SUMMARY.md
Deviations from 79-01 plan (full detail in 79-01-SUMMARY.md):
- Auto-fix: AgentPeriodData type extended in payroll-types.ts (not in plan files_modified) — required for tsc clean.
- Scope reduction (79-DEFER-01): 3 handler-level integration tests NOT added; test-infra is unit-only. Compensated by grep audits + UAT + unchanged unit tests.
Uncommitted files (awaiting user authorization per Claude Code global rule):
- apps/ops-api/src/routes/chargebacks.ts
- packages/utils/src/index.ts
- apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx
- apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
- apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx
- apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts
- .paul/* (STATE, ROADMAP, paul.json, phase 79 artifacts, phase 80 SKIPPED stub, MILESTONES.md pending ceremony)
Resume file: .paul/phases/79-chargeback-gate-and-display/79-01-PLAN.md
Git strategy: main clean after v3.1 ceremony push (tag v3.1); v3.2 starts clean
Resume context:
- v3.2 Chargeback Correctness — 1 phase (Phase 79). Phase 80 MyQueue Rep Linkage SKIPPED — Phase 77 already shipped the OwnerUsers role-edit dropdown; admin will manually link the 3 active CS users (Alex, Ally, Jasmin all have csRepRosterId=NULL per prod SQL).
- Phase 79 — 5 atomic fixes, all code-cited HIGH confidence:
  (1) chargebacks.ts:258-310 — gate Clawback + applyChargebackToEntry on `source !== "CS"` so CS-submitted chargebacks only hit paycard at alert approval (not at submission)
  (2) packages/utils/src/index.ts — introduce formatDollarSigned() (leading minus); swap at WeekSection.tsx:412 for clawback rows
  (3) PayrollPeriods.tsx:326-333,427-432 + WeekSection.tsx:968,1047 — thread per-entry adjustmentAmount into agent subtotal + liveNet (print at :892 already correct)
  (4) PayrollPeriods.tsx:432,892 — replace `+ fronted` (Phase 71) with `- fronted` (Phase 78) to match WeekSection liveNet
  (5) WeekSection.tsx:141 — CLAWBACK_CROSS_PERIOD row tint → RED (semanticColors.statusDead alpha-08); ZEROED_OUT_IN_PERIOD stays yellow
- User decisions locked: cross-period row = red, in-period row = yellow, negative format = leading minus `-$76.04`
- Constraints: forward-only (no retroactive paycard recompute); no schema changes; preserve source="PAYROLL" immediate-apply path; additive formatDollarSigned (don't regress 40+ formatDollar call sites)
- Discovery artifacts for the skipped Phase 80 preserved at .paul/phases/80-myqueue-rep-linkage/DISCOVERY.md — can revive if admin-linkage workflow proves insufficient
- Remaining deferred from v3.1: OPEN-period SQL audit (fronted formula mixed semantics) — run before next payroll lock as standalone ops task, not scoped into v3.2
- User-provided ground truth: image.png at repo root showing Victoria Checkal row $76.04 without minus, peach tint, not deducted from $679.11 net

---
*STATE.md — Updated after every significant action*
