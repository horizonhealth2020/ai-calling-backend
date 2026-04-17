# Project State

## Project Reference

See: .paul/PROJECT.md (updated 2026-04-15)

**Core value:** Sales managers can track agent performance and enter sales that flow through to the sales board and payroll, with dedicated CS and owner dashboards.
**Current focus:** v3.3 Chargeback Recovery — enable CS-driven chargeback reversal via payroll-approved alert

## Current Position

Milestone: v3.3 Chargeback Recovery
Phase: 81 of 81 (Chargeback Recovery Alert + Reversal) — APPLY complete
Plan: 81-01 applied
Status: APPLY complete — 198/198 tests pass; structural grep guards green; ready for UAT/UNIFY
Last activity: 2026-04-17 — All 3 tasks executed. Task 1: schema migration `20260417000001_add_payroll_alert_type_and_clawback_fk` (additive: `type` DEFAULT 'SUBMISSION' + `clawbackId` nullable FK with ON DELETE SET NULL); `emitClawbackReversed` in socket.ts; `reverseClawback(tx, id, {upsertFn?})` helper in payroll.ts with DI for testability; `createRecoveryAlert(client, ...)` in alerts.ts; 12 unit tests covering in_period/cross_period/state-mismatch/LOCKED/FINALIZED/missing-clawback/race-loser/idempotent-create. Task 2: `PATCH /chargebacks/:id/resolve` wrapped in `prisma.$transaction`; RECOVERY branch in `approveAlert` with pre-tx OPEN-period check + intra-tx alert re-read for race idempotency + catch of "Clawback not found" from reverseClawback; null-safe type branching via `(alert.type ?? "SUBMISSION")`. Task 3 (one deviation from plan): recovery banner rendered as new adjacent "Recoveries (N)" section in PayrollPeriods.tsx (NOT per-AgentCard) — plan's parenthetical in AC-5 allowed either approach; global section chosen for UX consistency with existing Chargebacks banner. Alert type in payroll-types.ts extended with `type` + `clawbackId`. `clawback:reversed` Socket.IO listener in page.tsx triggers `refreshPeriods()` (does NOT fetch the deleted Clawback). Structural grep battery all green: `tx.clawback.create(` = 1, `applyChargebackToEntry(` = 1, `emitClawbackCreated(` = 1 in alerts.ts (SUBMISSION path byte-identical); `reverseClawback(` = 1, `emitClawbackReversed(` = 1 (RECOVERY path added once). P-7 re-grep confirmed no new Clawback FK children post-plan-write (only expected new PayrollAlert.clawback inverse). Cannot run manual UAT in this session (requires live DB + browser); deferred to Verify phase.

Progress:
- v3.3 Chargeback Recovery: [████████░░] 80% (APPLY complete, UAT + UNIFY pending)
- Phase 81: [████████░░] 80%

## Loop Position

Current loop state:
```
PLAN ──▶ APPLY ──▶ UNIFY
  ✓        ✓        ○     [APPLY complete; ready for UAT/UNIFY]
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
- 2026-04-16: Phase 79-01 POST-UAT — Victoria Checkal numeric check PASSED ($603.07 net, -$76.04 row, red tint on screen). Print card row highlights reported broken — two gaps found: (a) `.row-cross-period` CSS still orange (Phase 79 screen-scoped edit missed the print-window CSS), (b) no print-color-adjust: exact on any row class (Phase 78-03 known pattern unapplied to this print path). Fix shipped as commit f7ee226 `fix(payroll): print card row highlight colors` — all 4 row classes (cross-period, in-period-zero, clawback-applied, ach) now have print-color-adjust: exact on BOTH tr and td. Cross-period red aligned to CLAWBACK_APPLIED #fee2e2/#ef4444. UAT re-verification pending.

### Deferred Issues
- 2026-04-15 (Phase 75): AC-4 `npx tsc --noEmit` not executed locally — tsc binary absent from apps/ops-dashboard/node_modules. Edits are attribute-only (className + data-label) + one comment, so new TS errors are structurally impossible. Confirm on next `npm run dashboard:dev`.
- 2026-04-15 (Phase 76): AC-4 `npx tsc --noEmit` not executed locally — same tsc-absent condition as Phase 75. Edits in CSTracking/CSMyQueue/CSResolvedLog/CSSubmissions are attribute-only; CSAnalytics adds useIsMobile import + hook + conditional JSX. Confirm on next `npm run dashboard:dev`.
- ~~2026-04-16 (Phase 78-02): OPEN-period SQL audit — run before next production payroll lock to identify agents with mixed Phase 71/78 semantics in OPEN periods.~~ **CLOSED 2026-04-17 — handled.**
- ~~2026-04-15 (Phase 76): CSMyQueue deviation — closed~~ **CLOSED**
- ~~2026-04-15 (Phase 71 fix): halvingReason bug fixed~~ **CLOSED**
- 2026-04-16 (Phase 78-03): AgentPeriodAdjustment.notes migration confirmed applied; notes feature functional.
- ~~2026-04-16 (Phase 79-01): **79-DEFER-01 — Handler-level integration tests for POST /chargebacks approval gate.** Plan required 3 new tests in chargeback-flow.test.ts (CS submission → alert-only, CS approval → clawback, PAYROLL source → inline). Existing test infrastructure is unit-only (Prisma mocks via @ops/db, no supertest + test DB). Test-infra upgrade judged scope-creep vs the 3-fix plan. Compensating controls: 4 structural grep audits pass, plan UAT mandates explicit assertions, 14 existing applyChargebackToEntry helper tests still pass. Future chargeback-flow changes should evaluate whether to unblock this before shipping similar gate logic.~~ **CLOSED 2026-04-17 — accepted; compensating controls (grep + UAT + unit tests) deemed sufficient.**
- ~~2026-04-16 (Phase 79-01): Pre-deploy SQL query for pre-fix PENDING PayrollAlerts with associated pre-fix Clawbacks — must run against prod BEFORE shipping + brief payroll team on CLEAR-vs-APPROVE policy for dirty alerts. Query in 79-01-PLAN.md Verification section.~~ **CLOSED 2026-04-17 — handled.**
- ~~2026-04-16 (Phase 79-01): Manual UAT outstanding — Victoria Checkal numeric check ($603.07 / -$76.04), Socket.IO cross-tab cascade, CS-submit-no-paycard-change verification.~~ **CLOSED 2026-04-17 — UAT passed; includes screen + print parity after 2 same-day post-UAT patches (f7ee226 row highlight colors + 526e5f4 print row net for clawback statuses).**
- ~~Phase 80 (SKIPPED) operator checklist: admin-link Alex + Ally + Jasmin to their CsRepRoster entries via OwnerUsers role-edit dropdown.~~ **CLOSED 2026-04-17 — admin linked all 3 CS users; MyQueue + stale alerts now resolve correctly via DB-lookup FK.**

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
- 2026-04-17: Enterprise audit on 81-01-PLAN.md. Applied 5+9. Deferred 3. Verdict: conditionally acceptable → enterprise-ready after upgrades (in-period reversal via upsertPayrollEntryForSale single-source-of-truth not guessed status, tx-wrapped CS resolve handler, orphan PENDING SUBMISSION auto-clear on CS recovery, Clawback FK back-relation enumeration P-7, race-idempotent concurrent RECOVERY approve M-5, cross-period pre-delete state-verify SR-6, socket payload enriched with agentId+periodId+mode SR-3, null-safe type branching SR-4, observability via agentPendingRecoveryAlerts logAudit metadata SR-5, migration rollback SQL documented SR-9, AC-6 grep battery codified SR-8, role-gate made explicit SR-2, P-1 "recovered" vs "SAVED" discrepancy resolved as out-of-scope per P-6).

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

Last session: 2026-04-17
Stopped at: Plan 81-01 APPLY complete (198/198 tests pass; 1 deviation on Task 3 banner placement — global section vs per-AgentCard, justified by plan's parenthetical)
Next action: `/paul:verify` (manual UAT of recovery flow) OR `/paul:unify .paul/phases/81-chargeback-recovery/81-01-PLAN.md` (reconcile + close loop)
Resume file: .paul/phases/81-chargeback-recovery/81-01-PLAN.md
Git strategy: main in sync with origin after v3.2 ceremony push; tag v3.2 created; v3.3 work will branch from main per GIT rules

---
*STATE.md — Updated after every significant action*
