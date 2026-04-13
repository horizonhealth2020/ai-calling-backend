# Enterprise Plan Audit Report

**Plan:** .paul/phases/66-outreach-logging-ui/66-01-PLAN.md
**Audited:** 2026-04-13
**Verdict:** Enterprise-ready (after upgrades applied)

---

## 1. Executive Verdict

Conditionally acceptable pre-audit; **enterprise-ready after 1 must-have + 3 strongly-recommended upgrades applied**.

The plan correctly decomposes a complex UI + API change into two focused tasks with a human-verify checkpoint. The gate bypass mechanism is well-designed with audit trails. The main risk was a data integrity issue in the resolve handler's optimistic update pattern, which would have shown resolved state to the user even when the API rejected it. This has been fixed.

## 2. What Is Solid

- **Gate bypass architecture**: Soft gate with mandatory justification + audit logging is the right pattern. Hard blocks frustrate users; silent overrides evade accountability. This threads the needle.
- **bypassReason min 10 chars**: Prevents trivial "ok" bypass notes. Forces actual justification.
- **Pre-v2.9 bypass carried forward**: The plan correctly carries the 0-total-attempts bypass logic to the UI, preventing false gate UI on legacy records.
- **Checkpoint placement**: Single human-verify at the end covers the visual/interactive concerns without checkpoint fatigue.
- **Boundary discipline**: Schema locked, other tabs protected, stale alerts deferred to Phase 67. Clean scope.
- **Existing patterns reused**: Pill buttons, expand/collapse, toast feedback, inline CSSProperties — no novel UI patterns introduced.

## 3. Enterprise Gaps Identified

### Gap 1: Optimistic Update on Gate-Blocked Resolve (CRITICAL)
The existing resolve handlers (chargebacks.ts:405-415, pending-terms.ts:454-464) apply optimistic state updates BEFORE the API call. If the gate returns 400, the user sees a momentarily-resolved card that snaps back. Worse: if the rollback catch fails silently, the UI shows resolved state that the server doesn't have.

### Gap 2: N+1 Attempt Fetch on Page Load
The plan originally said "for each unresolved record, fetch GET /api/contact-attempts" on data load. A CS page with 50+ open records would fire 50+ individual API calls on every page load. This is a performance and server load issue.

### Gap 3: AC-2 Missing Pending Term Bypass Parity
AC-2 only specified chargeback bypass behavior. The pending-terms resolve endpoint has identical gate logic but no AC covering its bypass path. Auditors need both paths explicitly tested.

### Gap 4: Error Message Parsing on 400
The existing resolve handlers catch errors with empty catch blocks and toast generic "Failed to resolve" messages. The gate 400 response contains a specific error message ("3 call attempts required before closing. Current: 1/3") that should be surfaced to the user.

### Gap 5: Real-Time Badge Staleness
When another agent logs an attempt on a shared record, the badge won't update until the card is re-expanded. Acceptable for now since CS agents work assigned records individually.

### Gap 6: bypassReason Not Persisted on Record
The bypass reason is only in the audit log, not on the ChargebackSubmission/PendingTerm record itself. This means viewing a resolved record doesn't show why the gate was bypassed — you have to query the audit log.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Optimistic update on gate-blocked resolve causes UI/server state divergence | Task 2 action: resolve handlers section | Added conditional optimistic update: only optimistically update when gate won't block (callCount >= 3 or recovered/saved). When gate might block, wait for API response before updating. Parse 400 body for error message. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | N+1 attempt fetch on page load | Task 2 action: fetch attempt counts section | Changed from eager fetch-all to lazy fetch on expand. Badges show "—" until card expanded. Eliminates N+1. |
| 2 | AC-2 missing pending term bypass | Acceptance criteria AC-2 | Added pending term bypass Given/When/Then to AC-2 |
| 3 | 400 error message not surfaced | Acceptance criteria + Task 2 action | Added AC-2b for error display. Strengthened resolve handler instructions to parse res.json().error field. |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Real-time badge staleness | CS agents work assigned records individually. Stale badges from other agents' actions are low-impact. Phase 67 (stale alerts) may introduce refresh triggers that naturally solve this. |

~~2. bypassReason not persisted on record~~ — **PROMOTED to plan by user request.** bypassReason column added to ChargebackSubmission and PendingTerm schema. Needed for CS analytics per-rep drill-down reporting.

## 5. Audit & Compliance Readiness

**Audit trail**: Strong. RESOLUTION_GATE_BYPASSED audit log captures agent ID, bypass reason, and attempt count at time of bypass. This supports post-incident reconstruction ("who bypassed the gate and why?").

**Silent failure prevention**: The optimistic update fix (must-have #1) was the main silent failure risk. Previously, a gate-blocked resolve would flash as resolved then revert — or worse, stay resolved in the UI. Now the UI waits for confirmation on gated paths.

**Ownership and accountability**: Each contact attempt is linked to the agent who logged it. Each bypass is audit-logged with the bypassing agent's ID. Clear ownership chain.

**Defensibility**: An auditor can reconstruct: (1) how many attempts were made, (2) who made them, (3) whether the gate was satisfied or bypassed, (4) why it was bypassed. This is sufficient for SOC 2 / compliance review.

## 6. Final Release Bar

**What must be true before ship:**
- Optimistic update conditional logic correctly implemented (must-have #1)
- Gate bypass audit trail confirmed working end-to-end
- No N+1 on page load

**Remaining risks if shipped:**
- Badge shows "—" until first expand (acceptable — low-friction UX tradeoff)
- bypassReason only in audit log, not queryable from the record (acceptable — audit log is the source of truth for compliance)

**Sign-off:** After the applied upgrades, I would approve this plan for production. The gate bypass mechanism is well-designed, the audit trail is complete, and the optimistic update fix prevents the most dangerous data integrity issue.

---

**Summary:** Applied 1 must-have + 3 strongly-recommended upgrades. Deferred 1 item. 1 deferred item promoted to plan by user (bypassReason on record).
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
