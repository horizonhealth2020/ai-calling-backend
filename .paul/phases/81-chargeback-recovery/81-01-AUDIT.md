# Enterprise Plan Audit Report

**Plan:** .paul/phases/81-chargeback-recovery/81-01-PLAN.md
**Audited:** 2026-04-17
**Auditor role:** Senior principal engineer + compliance reviewer
**Verdict:** Conditionally acceptable → **enterprise-ready after applied upgrades**

---

## 1. Executive Verdict

**Would I approve this plan for production if I were accountable? — Only after the 14 findings below were applied. Now: yes.**

The plan's *architecture* is sound: it mirrors the Phase 79 approval-gate pattern in reverse, treats the Clawback lifecycle symmetrically, and respects the project's single-source-of-truth principle (`computeNetAmount` / `upsertPayrollEntryForSale`). The scope is correctly narrow — one phase, one plan, three tasks, one schema migration, forward-only.

However, as drafted the plan had five release-blocking gaps: (a) pre-clawback entry status was guessed rather than re-derived from the authoritative upsert path; (b) the CS-resolve handler performed two mutations outside a transaction boundary; (c) an orphan-pending-submission workflow hole allowed payroll to approve a Clawback CS had already marked recovered; (d) Clawback FK back-relations were hedged rather than enumerated; (e) no race-idempotency on `POST /alerts/:id/approve` for RECOVERY, leaving concurrent approvers prone to HTTP 500.

All five are now addressed in the plan. Nine additional strongly-recommended upgrades (observability, socket payload enrichment, cross-period state-verify, null-safe type branching, rollback documentation, explicit grep verification, role-gate explicitness, plus the P-1 factual resolution and Clawback-FK re-enumeration as preconditions) were applied. Three items deferred with explicit rationale.

The pre-existing `"recovered"` vs `"SAVED"` test-fixture discrepancy discovered during the audit is flagged in P-6 as a separate ticket; it does NOT block this plan (no production source compares `resolutionType === "SAVED"`).

---

## 2. What Is Solid (Do Not Change)

- **Mirroring Phase 79 in reverse.** The alert → payroll-approve → mutation pattern is the project's established payroll-control primitive; using it for reversal keeps accountability in one place (payroll is the source of truth for paycard mutations, whether forward or reverse). Don't invent a new pattern.
- **Hard-delete Clawback vs soft-delete (REVERSED status).** Audit trail lives in `logAudit` + the PayrollAlert row, not a zombie Clawback row. Hard-delete avoids query-layer "WHERE status != 'REVERSED'" drift across every reader of the Clawback table.
- **OPEN-period gate at the Clawback's `appliedPayrollPeriod`, not at some "current" period.** Correct — reversal must target the period the negative row actually lives in. Catches the only safe window; anything else requires manual payroll-admin intervention.
- **Forward-only semantics.** Consistent with Phases 71/78/79; no retro reconciliation of historical clawbacks. Keeps the blast radius bounded.
- **Boundaries section explicitly preserves Phase 79 invariants** (formatDollarSigned additive, frontend-mirrors-server, CLAWBACK_CROSS_PERIOD red tint, print-color-adjust). This continuity discipline is the reason previous milestones haven't silently regressed.
- **Scope boundary on CS analytics** (P-5). Correctly out of scope; this plan does not attempt to fix adjacent observability gaps.

---

## 3. Enterprise Gaps Identified

### Gap A — Pre-clawback entry status restoration guessed, not re-derived
Task 1 originally said "status set back to pre-clawback value (e.g. APPROVED or whatever the sibling non-clawback peer entries for this sale/period carry; default to `RAN`-equivalent if unambiguous)". This is the plan's single highest-risk sentence — get it wrong, the agent is paid under the wrong commission-gating state, or the payroll state machine breaks. The pre-clawback status is not stored anywhere, so reconstructing it from siblings is a heuristic with edge cases (sale status changed between submission and recovery, product-type changes, etc.). **Severity: Must-have.** Fix applied (M-1): for in_period reversal, delete the ZEROED row and call `upsertPayrollEntryForSale(saleId, tx)` — the authoritative path that originally created the entry.

### Gap B — PATCH /chargebacks/:id/resolve mutations outside a transaction
As drafted, `prisma.chargebackSubmission.update()` committed before `createRecoveryAlert()` ran. A failure in the alert creation (unique-index race, Prisma client timeout) would leave the submission marked `resolutionType = "recovered"` with no corresponding RECOVERY alert — silently violating the workflow. **Severity: Must-have.** Fix applied (M-2): wrap the entire "recovered" branch in `prisma.$transaction`; make `createRecoveryAlert` accept a transaction client.

### Gap C — Orphan PENDING SUBMISSION alert workflow hole
CS marks a chargeback recovered *before* payroll has approved the original SUBMISSION alert → no Clawback exists yet → AC-2 (original) said "don't create a recovery alert, don't touch the submission alert." Result: payroll could later approve the orphaned SUBMISSION alert, creating a Clawback for a chargeback CS has already said was recovered. The agent gets docked for money that was recovered. **Severity: Must-have.** Fix applied (M-3): when CS resolves `"recovered"` AND a PENDING SUBMISSION alert exists for the same chargeback, auto-CLEAR the submission alert inside the same transaction with a distinct audit entry.

### Gap D — Clawback FK back-relations hedged, not enumerated
Original AC-3 carried the phrase "DELETE or null out the Clawback FK from any audit-linked rows (verify during apply)". That hedge is not acceptable on a plan that depends on `tx.clawback.delete` succeeding. A single unseen child model breaks the reversal in production. **Severity: Must-have.** Fix applied (M-4 / P-7): enumerated the Clawback FK graph via grep — only `ClawbackProduct` has a forward FK (handled with `deleteMany`); `Sale.clawbacks`, `Agent.clawbacks`, and `PayrollPeriod.clawbacks` are inverse back-relations that don't block delete. Precondition P-7 mandates re-running the same grep at apply-time to catch any post-plan-write additions.

### Gap E — No race-idempotency on POST /alerts/:id/approve for RECOVERY
Two payroll users click Approve simultaneously on the same RECOVERY alert. The existing SUBMISSION branch has the WR-06 dedupe guard covering its race. The new RECOVERY branch had nothing — second tx would find a deleted Clawback and bubble up as HTTP 500. **Severity: Must-have.** Fix applied (M-5): re-read the alert inside the transaction; if it's already APPROVED, return the APPROVED state as idempotent success. Catch `"Clawback not found"` from reverseClawback and treat as race-loser when the alert is APPROVED.

### Gap F — Pre-existing `"recovered"` vs `"SAVED"` mismatch not documented
Grep revealed route Zod stores `"recovered"` (lowercase) but csAnalyticsAggregator test fixtures use `"SAVED"` (uppercase). NO production source comparison against `"SAVED"` was found — but the divergence between fixtures and storage is a test-integrity smell. **Severity: Strongly recommended** (not release-blocking for this plan; release-blocking for analytics confidence). Fix applied (SR-1 / P-6): precondition documents the discrepancy, requires apply-time grep to confirm no production comparison against `"SAVED"`, and defers the fix to a separate ticket if production comparison is found.

### Gap G — Role gate on RECOVERY approval implicit
POST /alerts/:id/approve requires `PAYROLL` or `SUPER_ADMIN` (routes/alerts.ts:17). Inherited by the new branch silently. A future contributor refactoring the routes could accidentally widen access. **Severity: Strongly recommended.** Fix applied (SR-2): AC-3 Given clause now explicitly pins the role gate.

### Gap H — Socket payload references a deleted entity
`emitClawbackReversed({ clawbackId, ... })` — the clawbackId is now a dangling reference. Any consumer naive enough to `GET /clawbacks/:id` on receipt gets 404. **Severity: Strongly recommended.** Fix applied (SR-3): payload enriched with `agentId`, `periodId`, `mode` so dashboards can refetch scoped data without fetching the deleted Clawback.

### Gap I — Type branch not null-safe against in-flight migrations
Prisma client cache staleness or mid-deploy client version drift could see `alert.type === null` even though the DB column has DEFAULT 'SUBMISSION'. **Severity: Strongly recommended.** Fix applied (SR-4): `const alertType = alert.type ?? "SUBMISSION"` before branching.

### Gap J — No observability on recovery-alert backlog
If payroll ignores recovery alerts, there's no signal. Phase 79 set the precedent: logAudit with counts for SOC reconstruction. **Severity: Strongly recommended.** Fix applied (SR-5): `createRecoveryAlert` returns + logAudit captures `agentPendingRecoveryAlerts` count.

### Gap K — Cross-period entry modification detection missing
If payroll manually edits a `CLAWBACK_CROSS_PERIOD` row's payoutAmount (e.g. partial adjustment) between submission and recovery, the plan's DELETE silently destroys the edit. **Severity: Strongly recommended.** Fix applied (SR-6): pre-delete state verification — compare `entry.payoutAmount === -clawback.amount` and `entry.status === "CLAWBACK_CROSS_PERIOD"` inside the tx. Mismatch → 400 "Entry modified post-clawback; manual reconciliation required."

### Gap L — Socket emit room-targeting unspecified
`emitClawbackReversed` must hit the same rooms/channels as `emitClawbackCreated` for existing dashboard listeners to receive it. **Severity: Strongly recommended.** Fix applied (SR-7): Task 1 action explicitly mirrors the `io.emit` pattern at socket.ts:144.

### Gap M — AC-6 structural guarantee vague about commands
"Git-diff +/- parity grep" is descriptive but not executable. **Severity: Strongly recommended.** Fix applied (SR-8): explicit grep battery codified in AC-6 and in each task's `<verify>` block.

### Gap N — Migration rollback not documented
Additive migrations are typically safe, but the rollback path isn't spelled out, so an on-call engineer under pressure has to derive it. **Severity: Strongly recommended.** Fix applied (SR-9): rollback SQL documented in Task 1.

---

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| M-1 | Pre-clawback entry status guessed; financial correctness at risk | Task 1 action (in_period path), AC-3, objective/output, boundaries, success_criteria | In_period reversal now `tx.payrollEntry.delete` + `upsertPayrollEntryForSale(saleId, tx)` — re-derives status/payout/net via authoritative path. `upsertPayrollEntryForSale` body listed in DO NOT CHANGE boundary. |
| M-2 | CS resolve handler performs mutations outside tx; partial-commit risk | Task 2 action (full route rewrite), AC-1, objective/output | PATCH /chargebacks/:id/resolve handler wrapped in `prisma.$transaction`; `createRecoveryAlert` signature changed to accept `Prisma.TransactionClient | PrismaClient`. AC-1 amended with atomic-rollback clause. |
| M-3 | Orphan PENDING SUBMISSION alert workflow hole | AC-2 rewritten, Task 2 action adds auto-clear branch, verification checklist | When CS resolves `"recovered"` and no Clawback exists but a PENDING SUBMISSION alert does → submission alert auto-CLEARED in same tx with `submission_alert_auto_cleared_on_recovery` audit entry. |
| M-4 | Clawback FK back-relations hedged, not enumerated | Precondition P-7 added; Task 1 action restructured; AC-6 + verify grep commands; boundaries | Enumeration of Clawback FK graph: only ClawbackProduct is a forward-FK child (handled); Sale/Agent/PayrollPeriod are inverse-only. P-7 mandates re-grep at apply-time. |
| M-5 | No race-idempotency on concurrent RECOVERY approves | AC-4 amended with concurrent-approve clause; Task 2 action adds intra-tx re-read + catch | `approveAlert` RECOVERY branch re-reads alert INSIDE tx; if status already APPROVED, returns idempotent success. Catches `"Clawback not found"` from reverseClawback and treats as race-loser. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| SR-1 | `"recovered"` vs `"SAVED"` pre-existing test/production mismatch | Precondition P-6 added; boundaries SCOPE LIMITS | Documents discrepancy, requires apply-time grep, defers to separate ticket if production comparison surfaces. |
| SR-2 | Role gate implicit on RECOVERY approval | AC-3 Given clause | Explicitly pins "caller with PAYROLL or SUPER_ADMIN role". Task 2 action also notes inheritance from routes/alerts.ts:17. |
| SR-3 | Socket payload references deleted clawback | Task 1 action (socket event shape); AC-3 payload spec; Task 3 listener action | `emitClawbackReversed` payload now `{ clawbackId, saleId, agentId, agentName, periodId, amount, mode }`. Task 3 listener uses agentId + periodId for scoped refetch, NOT clawback re-fetch. |
| SR-4 | Null-safe type branching | Task 2 action (approveAlert branch) | `const alertType = alert.type ?? "SUBMISSION"` guard before branch comparison. |
| SR-5 | No observability on recovery-alert pileup | `createRecoveryAlert` signature; AC-1 logAudit metadata; Task 1 action; Task 2 action | `createRecoveryAlert` returns `{ alert, pendingRecoveryAlertsForAgent }`; logAudit metadata includes that count per recovery creation. |
| SR-6 | No state-verify before deleting cross-period row | AC-3 cross_period branch; Task 1 action; Task 1 test case 3; verification checklist | Pre-delete tolerance check (0.01) on payoutAmount + status match → 400 "Entry modified post-clawback; manual reconciliation required" on mismatch. Test case added. |
| SR-7 | Socket room-targeting unspecified | Task 1 action (socket.ts section) | Explicit instruction to mirror `emitClawbackCreated` pattern at socket.ts:144 (global `io?.emit`). |
| SR-8 | AC-6 grep commands not executable | AC-6 full rewrite; Task 1 verify; Task 2 verify; verification checklist | Six explicit `grep -c` commands codified with expected counts. Also P-7 re-grep for Clawback FK. |
| SR-9 | Migration rollback not documented | Task 1 action (migration section) | Rollback SQL spelled out: DROP COLUMN clawback_id, DROP COLUMN type; safe because both are nullable/defaulted. |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| D-1 | End-to-end integration test: CS-resolve → recovery-alert creation → approve → reversal, through a real Express + Prisma test DB | Existing test infra is Prisma-mock unit only (same condition as closed Phase 79 DEFER-01). Compensating controls: 10 unit tests on reverseClawback/createRecoveryAlert (Task 1), structural grep battery, 6-step manual UAT. Test-infra upgrade (supertest + test DB) would double the scope of this plan and has been judged scope-creep previously. Revisit if third chargeback-flow plan accumulates. |
| D-2 | CS-side "pending payroll approval" indicator on the resolved chargeback row | Nice-to-have; CS already sees the submission resolve. The workflow doesn't require CS to track downstream payroll approval — they've handed off. Add as separate Tier-2 UI ticket if CS managers request visibility. |
| D-3 | Print-view treatment for paycards with pending RECOVERY alerts (e.g. "pending reversal — $X" footnote) | Recovery alerts are transient action-state, not paycard data. Restored entries print correctly post-approval. Phase 79 pattern (scope-print-explicitly) is honored here: this plan scopes print-out and lets next print reflect reality. Re-evaluate only if payroll reports printing during the window between CS-recover and payroll-approve is confusing. |

---

## 5. Audit & Compliance Readiness

**Defensible audit evidence:**
- Every state change carries a typed `logAudit` entry with structured metadata: `chargeback_recovery_alert_created`, `submission_alert_auto_cleared_on_recovery`, `chargeback_resolved_recovered_no_clawback`, `alert_approved_recovery`, `alert_approve_rejected_recovery_locked_period`.
- `alert_approved_recovery` captures `clawbackId`, `reversalMode`, `affectedEntryId`, `newEntryId` (when in-period rebirth via upsert), `periodId` — sufficient for post-hoc reconstruction of any reversal.
- SOC-style question "how many chargebacks were reversed in period X?" is answerable by querying the audit log for `alert_approved_recovery` within the period.

**Silent failure prevention:**
- Atomic tx on both CS-resolve path (M-2) and approveAlert path ensures no partial commits.
- Race detection (M-5) prevents both double-reversal (financial risk) and HTTP 500 (UX risk) under concurrent approval.
- Cross-period state-verify (SR-6) catches manual-edit drift before destroying work.
- `no_matching_clawback_and_no_pending_submission` audit entry ensures even "do nothing" paths are logged.

**Post-incident reconstruction:**
- Clawback is hard-deleted but Clawback.amount is captured in the `alert_approved_recovery` logAudit metadata via the payload. Reconstructing "agent X was docked $Y on date Z and recovered on date W" requires joining the submission, the two alert rows (SUBMISSION + RECOVERY), and the two audit entries (alert_approved + alert_approved_recovery). This is acceptable.
- The PayrollAlert row itself is preserved post-approval (status=APPROVED), so the approval trail persists after Clawback deletion.

**Ownership:**
- CS owns "recovered" resolution (identity captured via `resolvedBy` on ChargebackSubmission + `clearedBy` on auto-cleared submission alert).
- Payroll/SUPER_ADMIN owns reversal approval (identity via `approvedBy` on PayrollAlert).
- Both are route-level `requireRole` enforced.

**Would fail a real audit:** No remaining blockers after applied upgrades. Pre-existing P-6 discrepancy is flagged and scoped out; that's appropriate (don't expand scope to catch unrelated bugs).

---

## 6. Final Release Bar

**What must be true before this plan ships:**
- All 3 tasks complete, all 10 unit tests pass, `npx prisma migrate status` clean, `npx tsc --noEmit` clean.
- Full manual UAT battery completed (7 scenarios in `<verification>`): atomic CS-resolve, orphan-submission auto-clear, in_period reversal via upsert, cross_period reversal after state-verify, LOCKED 400, concurrent-approve idempotent, manual-edit mismatch 400.
- AC-6 grep battery passes (all counts match pre-diff baseline for preserved invariants).
- P-7 re-grep confirms no new Clawback children introduced post-plan-write.
- Socket.IO cascade verified in two-browser test.
- Pre-deploy: query production for any PENDING PayrollAlert rows referencing chargebacks where `resolutionType = "recovered"` has already been written — these represent data in a state this plan didn't anticipate; brief payroll to CLEAR or escalate.

**Remaining risks if shipped as-is (with upgrades applied):**
- **Low:** The `upsertPayrollEntryForSale` single-source-of-truth assumption trusts Phase 79 / Phase 78's correctness for the restore path. If Phase 78 has a latent bug in a Sale-state corner case, reversal will inherit it. Mitigation: 10 unit test cases include the happy path via mock, and manual UAT confirms on real seeded data.
- **Low-Medium:** Pre-existing `"recovered"` vs `"SAVED"` discrepancy (P-6). If production aggregator *does* compare uppercase, analytics will not count recoveries. Not a payroll-correctness risk (payroll uses route/DB values directly). Mitigation: apply-time grep catches it; defer to separate ticket if found.
- **Low:** Hard-delete Clawback loses immutable Clawback row. Audit trail via logAudit + PayrollAlert is sufficient for SOC reconstruction but requires joining three tables. Mitigation: acceptable per project's existing conventions (Phase 79 discussed this).

**Sign-off:** With the 5 must-have and 9 strongly-recommended upgrades applied, I would sign my name to this plan. The remaining risks are identified, bounded, and have named mitigations.

---

**Summary:** Applied **5 must-have** + **9 strongly-recommended** upgrades. Deferred **3** items with explicit rationale.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
