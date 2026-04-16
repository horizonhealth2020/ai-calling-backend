# Enterprise Plan Audit Report

**Plan:** `.paul/phases/78-payroll-polish/78-01-PLAN.md`
**Audited:** 2026-04-16
**Verdict:** Conditionally acceptable → enterprise-ready after upgrades

---

## 1. Executive Verdict

Conditionally acceptable. The plan correctly identifies the right bugs and architectural
approach for all three problems (display, edit form, approval chain). The fix strategy
(JSON.stringify display, addon premium inputs, approval handler defensive shape handling)
is sound. However, three enterprise-grade gaps prevent sign-off as-written:

1. The "string error" root cause is ambiguous — numeric fields sent as strings from HTML
   inputs is a plausible parallel cause not addressed by the plan.
2. The `{ old, new }` wrapping responsibility is underspecified — who is responsible
   (client vs server) was not prescribed.
3. AC-4 commission verification was too vague to be audit-defensible (no baseline/delta check).

All three gaps have been applied. Plan is now enterprise-ready.

---

## 2. What Is Solid

- **Task 2 pattern reference**: ManagerEntry.tsx correctly named as the implementation
  pattern for addon premium inputs — avoids divergence between entry and edit UX.
- **Conditional addonProductIds inclusion** (Task 1 FIX 2): The guard
  `!('addonProductIds' in changes)` correctly handles the case where the user also
  toggled an addon (already included) vs only changed a premium (needs injection).
- **Approval handler defensive shape** (Task 3): Handling both `{ old, new }` and
  flat-value shapes with a type guard is the correct approach given the ambiguous
  existing server behavior.
- **Boundary protection**: `ManagerEntry.tsx`, commission logic, role-gating, and CS
  files are all explicitly protected — prevents scope creep.
- **AC-5 regression check**: Non-addon edit flows are explicitly guarded.

---

## 3. Enterprise Gaps Identified

### G1 — Numeric string coercion as parallel root cause of string error [Must-Have]
HTML `<input type="number">` returns string values from `e.target.value`. If
`editForm.premium` is initialized as a number but mutated to a string via input change,
`changes.premium = "25"` (string). The sales.ts PATCH Zod schema validates
`premium: z.number()` → rejects with "Expected number, received string". This is a
DIFFERENT bug from the addonPremiums shape issue and could be the actual "string error"
the manager saw. Not addressed by the original plan.

### G2 — { old, new } wrapping responsibility unresolved [Must-Have]
The plan says "if the PATCH route stores X, do Y; if it stores Z, do W" — conditional
phrasing during apply leads to ambiguous decisions. The prescriptive rule is: server-side
wrapping is the correct architecture. The PATCH route should fetch current values and wrap
`{ old: currentDb, new: submitted }` before storing in SaleEditRequest.changes. If it
doesn't, the approval handler fix is defensive but the root architecture is wrong.

### G3 — AC-4 commission verification too vague [Must-Have]
"Check via GET /api/payroll endpoint or DB query" is not audit-defensible. There is no
expected value specified, no baseline captured, no delta asserted. This verification would
pass trivially even if commission recalc broke.

### G4 — CHANGES display line range unspecified [Strongly Recommended]
Task 1 PRECONDITION says "find where the diff is rendered" without a line range. The apply
phase would waste time searching a 1300+ line file.

### G5 — editForm.addonProductIds initialization not verified [Strongly Recommended]
FIX 2 uses `editForm.addonProductIds ?? []`. If the edit form initializes addonProductIds
as undefined (not as `[]`), the CHANGES detection at line 271 would produce
`JSON.stringify(undefined) !== JSON.stringify([])` → false negative (no change detected
when an addon was cleared). This must be verified, not assumed.

### G6 — Audit trail for SaleEditRequest creation [Can Safely Defer]
The plan doesn't verify whether the POST that creates the SaleEditRequest is logged via
logAudit. If it isn't, there's no audit trail for who submitted the edit request. This is
existing behavior — not a new gap introduced here — and can be addressed in a hygiene pass.

---

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Numeric string coercion parallel root cause | Task 3 PRECONDITION | Added explicit check: if Zod schema uses z.number() and client sends strings, add coercion in saveEdit() for all numeric fields before building changes object |
| 2 | { old, new } wrapping prescriptive rule | Task 3 PRECONDITION | Added PRESCRIPTIVE RULE: server-side PATCH wraps in { old, new }; if it stores flat values, approval handler fix is defensive but architecture should be server-authoritative |
| 3 | AC-4 commission verification vague | Task 3 verify step 3 | Replaced "check via GET/DB query" with concrete before/after baseline: capture PayrollEntry.netAmount before edit request, verify it changes after approval |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 4 | CHANGES display line range unspecified | Task 1 PRECONDITION step 1 | Added "search around line 740-760" hint |
| 5 | editForm.addonProductIds initialization | Task 1 PRECONDITION step 3 (new) | Added explicit verification that editForm initializes addonProductIds as array (not undefined) |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|------------------------|
| 1 | Audit trail for SaleEditRequest creation logging | Existing behavior not introduced by this plan; applies to all edit requests, not just addon edits. Hygiene pass scope. |

---

## 5. Audit & Compliance Readiness

**Audit evidence:** logAudit is called at change-requests.ts:215 on approval — this records
the approval event. The SaleEditRequest row itself is evidence of who submitted what change.
Sufficient for post-incident reconstruction of what was edited and when.

**Silent failure prevention:** The defensive shape handling for addonPremiums (both flat and
`{ old, new }` shapes) prevents the approval from silently setting addon premiums to null/0
when the shape doesn't match. The explicit baseline/delta verification for commission recalc
prevents silent formula misapplication.

**Ownership:** PATCH role-gating (MANAGER → SaleEditRequest; SUPER_ADMIN → direct) is
preserved. PAYROLL role approves. Clear accountability chain.

**Post-incident reconstruction:** SaleEditRequest.changes records the diff. PayrollEntry has
an updatedAt timestamp. Enough to reconstruct the sequence.

---

## 6. Final Release Bar

**Must be true before this plan ships:**
- Numeric fields in saveEdit() changes object are coerced to numbers before submission
- addonPremiums shape handled in approval (both flat and { old, new })
- Commission recalc verified with concrete before/after baseline
- `npm test` full suite passes

**Remaining risks if shipped as-is (pre-upgrades):**
- Manager string error persists if root cause is numeric coercion (unaddressed)
- Commission recalc verified only informally (no audit trail of the test)

**Post-upgrade sign-off:** Yes, I would approve this plan for production.

---

**Summary:** Applied 3 must-have + 2 strongly-recommended upgrades. Deferred 1 item.
**Plan status:** Updated and enterprise-ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
