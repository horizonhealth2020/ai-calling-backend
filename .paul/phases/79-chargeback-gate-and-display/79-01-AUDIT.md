# Enterprise Plan Audit Report

**Plan:** `.paul/phases/79-chargeback-gate-and-display/79-01-PLAN.md`
**Audited:** 2026-04-16
**Verdict:** Conditionally acceptable → enterprise-ready after applied upgrades

---

## 1. Executive Verdict

**Conditionally acceptable.** The plan correctly identifies the five root-cause bugs with line-level code citations, proposes a sensible 3-task split (server gate → display sign/color → net math), and preserves backward-compatibility through additive utilities (`formatDollarSigned` alongside `formatDollar`) and untouched critical paths (`applyChargebackToEntry`, `computeNetAmount`). I would NOT sign my name to this plan as-originally-written because it has three enterprise-defensibility gaps: (a) no data-state reconciliation for the PENDING alerts currently in prod that were created under the pre-fix behavior (they have pre-existing clawbacks — CLEARING them silently leaves the agent docked), (b) no audit-trail enrichment documenting the new deferred-clawback state for SOC-style reviewers, and (c) no verification step confirming the Socket.IO cascade still propagates the post-approval paycard mutation to connected dashboards. All three are addressable without plan redesign — they are added below.

After applying the 1 must-have + 6 strongly-recommended upgrades, verdict upgrades to **enterprise-ready**. Would sign off for production deploy on a payroll-accuracy-critical system.

## 2. What Is Solid

- **Server-side gate strategy (Task 1)** is architecturally clean: single-line conditional (`if (source !== "CS")`) wrapping the existing clawback-creation block. No change to `applyChargebackToEntry` semantics, no change to the alert-approval flow (`alerts.ts:approveAlert`), no schema migration. Minimal blast radius.
- **Preserving `formatDollar` and introducing `formatDollarSigned`** (Task 2) is the correct choice — swapping the existing utility would regress ~40 unrelated call sites where absolute-value display is intentional (e.g., hold-amount rendered without a minus because "hold" is a positive-magnitude field stored as a signed value). Additive utility is audit-friendly.
- **Single source of truth for row tints** (CLAWBACK_CROSS_PERIOD aligning with CLAWBACK_APPLIED's `semanticColors.statusDead`) avoids hardcoded hex drift.
- **Forward-only discipline** is explicit in boundaries — no retroactive recompute of historical `PayrollEntry.netAmount`. This matches Phase 71/78 precedent and keeps blast radius bounded.
- **Preservation of Phase 47 WR-06 dedupe guard** is called out correctly: the `createdAt: { gte: cbCreatedAt }` constraint in `alerts.ts:173-203` is the invariant that prevents approval-path silent-dedupe bugs under the new gate.
- **Boundaries section** explicitly protects `applyChargebackToEntry`, `computeNetAmount`, and `formatDollar` — the three highest-risk contracts in the codebase being edited.
- **AC-3 regression guard** for source="PAYROLL" is a strong positive assertion; without it, a well-meaning refactor could break payroll-direct behavior silently.

## 3. Enterprise Gaps Identified

### 3.1 Pre-fix PENDING alerts leave "dirty" state (release-blocking data-state hazard)

Under the current (pre-fix) code path, every CS batch POST creates a PayrollAlert **and** creates a Clawback + applies paycard mutation immediately. Any PENDING PayrollAlerts currently in production already have an associated pre-fix Clawback and a mutated paycard.

After the new gate ships:
- **APPROVING** such a legacy alert → `alerts.ts:approveAlert` dedupe guard finds the pre-existing Clawback (matchedBy='member_id' or 'member_name'), no-ops the Clawback create and `applyChargebackToEntry` call, flips the alert to APPROVED. Net effect: no double mutation. **Safe.**
- **CLEARING** such a legacy alert → `alerts.ts:clearAlert` only updates the alert status. It does NOT reverse the Clawback. The agent paycard stays docked despite the "rejection" action. **Not safe** — admin intent diverges from financial outcome.

This is a real-money correctness issue and will recur indefinitely for any PENDING alert in prod at deploy time. Must be surfaced with a pre-deploy SQL query + admin-policy documentation.

### 3.2 Missing audit-trail enrichment for deferred-clawback state

Today the `logAudit` call at `chargebacks.ts:432-435` records batch-level metadata (`count`, `source`) but does not distinguish between "clawbacks applied inline (PAYROLL source)" and "clawbacks deferred to approval (CS source, new behavior)". For SOC-2-style post-incident reconstruction, a reviewer asking "how many clawbacks were pending approval at time T?" must run a database join instead of reading the audit log. Adding `matchedCount` and `deferredClawbackCount` fields to the audit payload closes this gap at zero architectural cost.

### 3.3 Socket.IO cascade verification omitted from UAT

The alert-approval path at `alerts.ts:255-262` fires `emitClawbackCreated` and `emitAlertResolved`. These events are the mechanism by which a connected payroll dashboard refreshes without manual reload. The plan's UAT steps verify the approval action in a single tab but do not confirm cross-tab/dashboard propagation. In a shared-workstation environment (common for ops teams), two payroll staff may be viewing the same agent card — a stale render on tab B after approval on tab A is a real user complaint vector, and is exactly the kind of regression that slips through single-tab UAT.

### 3.4 Test-helper reuse convention not specified

Task 1 adds 3 integration tests to `chargeback-flow.test.ts`. The file already has fixtures (inferred from its Phase 61 origin), but the plan does not instruct the implementer to inspect and reuse them. Without this guidance, a plausible outcome is that the implementer inlines seed data for the new cases — creating a second fixture pattern that drifts from the existing one over time. This is a long-term maintenance hazard for a high-value test file.

### 3.5 WR-06 invariant not flagged as load-bearing

The new CS gate makes `alerts.ts:173-203` dedupe the ONLY path that prevents approval-time double-clawbacks. The Phase 47 WR-06 constraint (`createdAt: { gte: cbCreatedAt }` on lines 181 + 186) is what makes the dedupe correct — without it, approving a fresh CS alert could false-positive match against an unrelated-but-coincident member_id clawback from a different batch. The plan mentions keeping the dedupe "as defense-in-depth" but does not name WR-06 specifically. A future refactor that "simplifies" the dedupe by dropping the createdAt bound would silently break the new gate's correctness.

### 3.6 Print-view subtotal parity unaddressed

Task 3 fixes print `agentNet` but does not audit the print HTML template for a separate "Subtotal" cell. If such a cell exists and uses `agentGross` alone, it will diverge from the on-screen subtotal (now `agentGross + entryAdj`). Print/screen divergence on a payroll document is the kind of defect that causes payroll disputes.

### 3.7 Frontend/server net-formula-mirror convention not in boundaries

The plan fixes four frontend net-computation sites to match `computeNetAmount` (Phase 78 server-side). But it does not codify "frontend math must mirror server math" as a boundary. Without this constraint, a well-meaning future change that tweaks only the frontend formula (for a "UX preview" purpose) could silently drift from the server — and the server value is what actually pays agents. This is the exact class of bug that Phase 78-03 caught (WeekSection liveNet + PATCH /payroll/entries/:id had drifted to Phase 71 despite Phase 71 being reversed server-side).

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| M1 | Pre-fix PENDING alerts have "dirty" paycard state; CLEAR action doesn't reverse the pre-applied clawback | `<verification>` — new "PRE-DEPLOY DATA-STATE CHECK" section | Added SQL query enumerating PENDING alerts with associated pre-fix clawbacks; admin policy documented (APPROVE is safe, CLEAR requires manual Clawback reversal); shipping evidence requirement added to SUMMARY; boundary clause added stating no retroactive cleanup in this phase |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| S1 | `logAudit` doesn't record deferred-clawback state for SOC-style review | Task 1 action + verify | Mandate extension of existing logAudit to include `matchedCount` and `deferredClawbackCount`; added grep verification |
| S2 | Socket.IO cascade not verified in UAT (cross-tab stale render risk) | `<verification>` UAT checklist | Added two-tab cascade verification step with reference to `alerts.ts:255-262` emit calls |
| S3 | Test-helper reuse convention not specified | Task 1 action | Added PRECONDITION requiring inspection of existing `chargeback-flow.test.ts` fixtures and reuse over inline seed code |
| S4 | Phase 47 WR-06 dedupe constraint is now load-bearing but not flagged by name | Task 1 action + verify | Added explicit WR-06 invariant note naming lines 181+186; added grep verification that `createdAt: { gte: cbCreatedAt }` survives |
| S5 | Print-view subtotal parity not audited alongside net fix | Task 3 action + verify | Added explicit inspection step for print HTML template; decision-log requirement for whether a separate Subtotal cell exists; print/screen parity verify |
| S6 | Frontend/server net-formula mirror not codified as boundary | `<boundaries>` SCOPE LIMITS | Added clause: frontend math mirrors server `computeNetAmount` exactly; divergence is a correctness bug, never an intentional approximation |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| D1 | Accessibility — CLAWBACK_CROSS_PERIOD row distinguished primarily by color (red) may be less discernible for users with red-green color blindness | Internal ops tool with a small, known user population. Row has secondary structural signal (`borderLeft: 3px solid red`) and text signal (leading minus from Task 2). WCAG audit for the full dashboard is out of scope for this phase; can be revisited as a standalone accessibility sweep. |
| D2 | Decimal precision audit for summing many `adjustmentAmount` values | `Decimal(12,2)` with typical payroll batch sizes (≤100 rows) sums to values well within JS Number safe-integer range. Precision risk is theoretical, not operational. |
| D3 | New frontend unit-test file for net-formula math | Structural verification via grep audit + manual UAT is sufficient given the server-side `payroll-net-formula.test.ts` (Phase 78-02, 9-case suite) locks the canonical formula and the frontend is explicitly constrained (by boundary S6) to mirror it. Adding a new client-side test file is nice-to-have but doesn't meaningfully reduce risk given the tight mirror constraint. |

## 5. Audit & Compliance Readiness

**Defensible audit evidence:**
- ✅ Post-upgrade: AppAuditLog records batch-level deferred-clawback state (`matchedCount`, `deferredClawbackCount`), enabling point-in-time reconstruction of "how many chargebacks were pending approval at T?"
- ✅ PayrollAlert state transitions (PENDING → APPROVED / CLEARED) logged via `alerts.ts:approveAlert` + `clearAlert` to `PayrollAlert.*` table (existing behavior, unchanged).
- ✅ Clawback creation via `alerts.ts` emits socket events + logAudit at line 263 — existing behavior, unchanged.
- ⚠️ Pre-deploy dirty-alert reconciliation evidence (SQL query + row count + reviewed-by) must be captured in SUMMARY.md per post-upgrade verification requirement.

**Silent-failure prevention:**
- ✅ Post-upgrade: dedupe-guard invariant (WR-06) is explicitly named and grep-verified, preventing accidental removal during future refactor.
- ✅ Plan preserves `alerts.ts:approveAlert` dedupe as defense-in-depth even though the new gate makes silent-duplicate-clawback impossible under the happy path.
- ✅ Regression guard AC-3 explicitly asserts source="PAYROLL" behavior unchanged — silent behavior change to the payroll-direct path is blocked.

**Post-incident reconstruction:**
- ✅ Batch → chargeback → alert → clawback → paycard mutation chain is fully traceable via existing IDs (batchId, chargebackSubmissionId, alertId, clawbackId, payrollEntryId). No new opaque state introduced.
- ⚠️ For the pre-deploy "dirty alert" class specifically, reconstruction requires cross-referencing `alert.createdAt` vs `clawback.createdAt` with matchedBy='member_id'/'member_name' pattern (the documented SQL query captures this).

**Ownership and accountability:**
- ✅ Who: CS user submits (`chargeback.submittedBy`), payroll user approves (`alert.approvedBy`).
- ✅ When: all timestamps preserved (`submittedAt`, `approvedAt`, `clawback.createdAt`, `PayrollEntry.createdAt` for cross-period rows).
- ✅ Why: `bypassReason` captured when gate override used (existing Phase 66/67 behavior, unaffected).

Post-upgrade, this plan clears SOC 2 CC7.2 (change management) and CC7.4 (incident response) review for the scope it covers.

## 6. Final Release Bar

**What must be true before this plan ships:**

1. All 3 tasks complete with verify steps passing.
2. Pre-deploy SQL query executed against prod; any returned rows documented in 79-01-SUMMARY.md; payroll team briefed that CLEARING a pre-fix-dirty alert does NOT reverse the paycard mutation and requires manual Clawback reversal.
3. Manual UAT including the Socket.IO cross-tab cascade verification passes.
4. Grep audit confirms zero Phase 71 `+ fronted` residue in apps/ops-dashboard.
5. Grep audit confirms WR-06 `createdAt: { gte: cbCreatedAt }` constraint intact post-refactor.
6. `chargeback-flow.test.ts` passes with 3 new/updated CS-gate cases.
7. Victoria Checkal numeric check passes: Net header shows "$603.07", Commission column shows "-$76.04", row is red-tinted.

**Risks remaining if shipped as-is (post-upgrade):**

- Admins who CLEAR a pre-fix-dirty alert without manual Clawback reversal — **MITIGATED** by documented pre-deploy briefing; residual risk is behavioral (admin must follow policy), not technical.
- Future refactor weakening WR-06 — **MITIGATED** by explicit boundary note + grep verification; residual risk is low with the invariant named in code comments.
- Frontend math drift from server formula — **MITIGATED** by boundary S6 + Phase 78-03 precedent showing this drift is detectable via audit.

**Sign-off statement:**

After the upgrades above are applied to PLAN.md, I would sign my name to shipping this phase to production on a payroll-accuracy-critical system. The phase correctly addresses the reported production bugs, preserves the existing audit trail, and introduces no new silent-failure modes.

---

**Summary:** Applied 1 must-have + 6 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
*Auditor role: senior principal engineer + compliance reviewer*
