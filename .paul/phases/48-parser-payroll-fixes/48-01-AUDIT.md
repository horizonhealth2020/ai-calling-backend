# Enterprise Plan Audit Report

**Plan:** .paul/phases/48-parser-payroll-fixes/48-01-PLAN.md
**Audited:** 2026-04-09
**Verdict:** Enterprise-ready (after applied upgrades)

---

## 1. Executive Verdict

**Enterprise-ready.** This is a tightly scoped 3-fix patch addressing production bugs with clear root causes, minimal blast radius, and appropriate boundaries. The fixes are UI and API-response level — no schema changes, no business logic rewrites, no new authorization surfaces. The risk profile is low.

I would approve this plan for production. The three changes are well-isolated, the acceptance criteria are testable, and the boundaries correctly protect the commission calculation engine, schema, and sale creation logic.

## 2. What Is Solid

- **Root cause analysis for the parser bug is precise.** The `\bAdd-on\b` regex vs "Add on" (no hyphen) mismatch is the exact cause. The fix targets the regex without refactoring the parser — correct scope discipline.
- **ACH highlight is display-only.** No changes to how ACH sales are assigned to payroll periods. The fix adds a visual signal without touching financial logic.
- **ACA sale date leverages existing API support.** The POST /sales/aca endpoint already accepts `saleDate` (line 145 of sales.ts). This is a UI-only addition — zero API risk.
- **Boundaries are correct.** Protecting payroll.ts commission calculation, sales.ts creation logic, and the Prisma schema from modification is appropriate for a display/parsing fix plan.
- **Priority ordering for row colors is explicitly documented** — clawback > zeroed-out > declined > needs-approval > ACH > default. This prevents ambiguity during implementation.

## 3. Enterprise Gaps Identified

### Gap 1: Contradictory Task 2 instructions (Clarity Risk)
Task 2 action text said "Add ACH check BEFORE the clawback/declined checks" then immediately said "Actually, add it AFTER declined checks." This contradiction could cause the implementer to insert ACH at the wrong position in the ternary chain, breaking the color priority system. If ACH green overrides clawback orange, financial alert visibility is degraded.

**Severity:** Must-have — ambiguity in a conditional chain affecting financial UI.

### Gap 2: Missing regression verification for non-addon products (Test Gap)
Task 1 verify only checked addon products. Products like "UBA Membership" that don't contain "Add" anywhere should be verified as unaffected. The regex `\bAdd[-\s]?on\b` is correctly bounded by `\b`, but explicit verification prevents silent regressions.

**Severity:** Strongly recommended.

### Gap 3: isLate override interaction undocumented (Edge Case)
The `rowBg` ternary chain at line 135-145 computes base styles, but `isLate` is applied as a spread override at line 156. An ACH sale that arrives after a period was marked paid would show yellow (isLate) instead of green (ACH). This is correct behavior — late arrival is a higher-priority signal — but the plan didn't document this interaction, which could lead to confusion during testing ("why isn't my ACH row green?").

**Severity:** Strongly recommended.

### Gap 4: ACA form grid position unspecified (Layout Ambiguity)
The standalone ACA form uses a 2-column grid (ACA_FORM_GRID). Adding a 5th field without specifying its position could result in an awkward layout. Should specify where the date field goes relative to existing fields.

**Severity:** Strongly recommended.

### Gap 5: Cross-type product validation in parser (Latent Risk)
`handleParse` at line 360-361 finds the first non-addon parsed product and calls `matchProduct`, which searches ALL products regardless of type. If the matched product is actually typed as ADDON in the DB, the form silently sets the wrong productId. This is existing behavior and not introduced by this fix.

**Severity:** Can safely defer — existing behavior, not introduced by this plan.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Contradictory Task 2 ACH position instructions | Task 2 action | Removed contradictory "BEFORE then actually AFTER" language. Replaced with explicit ternary chain insertion point: second-to-last branch, before default transparent. Added code snippet showing exact insertion. |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Missing non-addon regression check | Task 1 verify | Added "UBA Membership → isAddon = false" verification line and cleanName strip verification |
| 2 | isLate override interaction | Task 2 action + verification | Added note that isLate spread at line 156 correctly overrides ACH green. Added isLate override check to verification checklist |
| 3 | ACA form grid position | Task 3 action | Specified date field placement: after Members field, flowing to first cell of third row in 2-column grid |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Cross-type product validation in parser handleParse | Existing behavior — not introduced by this plan. Would require broader parser refactor. Tracked for future improvement. |

## 5. Audit & Compliance Readiness

**Audit evidence:** The plan produces no new audit trail entries (display-only changes). The existing `logAudit()` calls on sale creation and payroll operations remain untouched — appropriate since these fixes don't change financial operations.

**Silent failure prevention:** The parser fix is deterministic — a product name either matches the addon regex or it doesn't. No async operations, no network calls, no state machines. The ACH highlight is a pure function of paymentType field. No silent failure path.

**Post-incident reconstruction:** If a product is still misclassified after the fix, the `parsedInfo` panel in the UI (lines 982-1018) displays all parsed products with their addon/core classification, enabling immediate visual debugging.

**Ownership:** All changes are in frontend display code (ManagerEntry.tsx, WeekSection.tsx, payroll-types.ts) plus one API select field addition (payroll.ts line 20). Clear ownership boundary.

## 6. Final Release Bar

**What must be true before shipping:**
- Parser correctly classifies "Add on" (no hyphen) as addon — verified with the exact bug report receipt
- Existing "Add-on" (with hyphen) products still classify correctly — no regression
- ACH rows show green only when no higher-priority status applies
- ACA standalone entry sends saleDate and the sale lands in the correct payroll week
- TypeScript compiles clean

**Remaining risks if shipped as-is:**
- The `matchProduct` function doesn't validate product type against parsed classification. A name collision between a CORE and ADDON product could still produce wrong form state. This is pre-existing and low probability given the product naming conventions.

**Sign-off:** I would sign my name to this plan. The scope is narrow, the changes are isolated, and the risk profile is minimal.

---

**Summary:** Applied 1 must-have + 3 strongly-recommended upgrades. Deferred 1 item.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
