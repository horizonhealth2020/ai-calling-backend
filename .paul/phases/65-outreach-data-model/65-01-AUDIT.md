# Enterprise Plan Audit Report

**Plan:** .paul/phases/65-outreach-data-model/65-01-PLAN.md
**Audited:** 2026-04-13
**Verdict:** Enterprise-ready (after applying 1+2 upgrades)

---

## 1. Executive Verdict

Solid data model and API design. The polymorphic FK pattern is correct, server-side gate enforcement is the right call for accountability, and the additive-only migration approach is safe. Three gaps found: existing records getting trapped behind the new gate after unresolve, missing FK validation AC, and gate rejections not being audit-logged. All applied. Plan is enterprise-ready.

## 2. What Is Solid

- **Polymorphic FK (Option A)** — one table for both chargebacks and pending terms. Correct trade-off: simpler queries and analytics vs slightly weaker FK constraints. The polymorphic pattern is already used in this codebase.
- **Server-side gate enforcement** — the 3-call requirement is checked on the API, not just the UI. This is mandatory for an accountability feature — UI-only gates are trivially bypassed.
- **attemptNumber auto-calculated** — not client-submitted. Prevents manipulation and ensures consistency.
- **"saved"/"recovered" bypasses gate** — correct. Saving a customer is a win; don't penalize success.
- **Additive-only schema** — no existing columns modified, no data migration needed. Zero risk to production data.

## 3. Enterprise Gaps Identified

1. **Unresolve + re-resolve traps existing records:** Before v2.9, chargebacks/pending terms were resolved without any ContactAttempts. If someone unresolves a pre-v2.9 record (existing feature) and tries to re-resolve as "closed," the gate blocks with "0/3 calls." These records were legitimately resolved under the old rules and should not be trapped.

2. **No AC for polymorphic FK validation:** The task action says "validate exactly one of chargebackSubmissionId or pendingTermId" but there's no AC testing the error cases (both provided, neither provided). Without an explicit AC, the E/Q loop might miss this validation.

3. **Gate rejection not audit-logged:** When the gate blocks a resolution attempt, that's an accountability signal — an agent tried to close without doing outreach. This is exactly the kind of event managers want to see. Without logging, the failed attempt is invisible.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Pre-v2.9 records trapped by gate | AC (added AC-7), Task 2 action | Gate checks total attempt count first — if 0, skips gate (record never entered outreach workflow). Records with ≥1 attempt are subject to the 3-call rule. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | No AC for FK validation | AC (added AC-1b) | Added AC testing both-FK and neither-FK error cases |
| 2 | Gate rejection not logged | AC (added AC-8), Task 2 action | Added logAudit with RESOLUTION_GATE_BLOCKED action on every gate rejection |

### Deferred (Can Safely Defer)

None.

## 5. Audit & Compliance Readiness

- **Audit trail:** ContactAttempt records provide complete outreach history per record. Gate rejections now also logged. Post-incident reconstruction can show exactly what outreach was done and when.
- **Accountability:** The gate is server-enforced. Combined with RESOLUTION_GATE_BLOCKED logging, managers can see who's trying to skip calls.
- **Backward compatibility:** Pre-v2.9 records (0 attempts) can still be resolved normally. The gate only activates once a record enters the outreach workflow (≥1 attempt logged).

## 6. Final Release Bar

- Pre-v2.9 gate bypass must work (0-attempt records resolve freely)
- Gate rejection must be audit-logged
- Polymorphic FK must validate exactly-one
- All existing resolve functionality must continue working

---

**Summary:** Applied 1 must-have + 2 strongly-recommended upgrades. Deferred 0 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
