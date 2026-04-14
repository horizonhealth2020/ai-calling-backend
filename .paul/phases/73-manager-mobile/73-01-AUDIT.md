# Enterprise Plan Audit Report

**Plan:** `.paul/phases/73-manager-mobile/73-01-PLAN.md`
**Audited:** 2026-04-14
**Verdict:** **Conditionally acceptable → upgraded to enterprise-ready after auto-applied findings**

---

## 1. Executive Verdict

The original plan was **conditionally acceptable**. The high-level approach (CSS-class-driven retrofit, leverage Phase 72 primitives, no logic changes) is correct. The concrete tasks contained five issues that would have surfaced as user-visible breakage on iPhone:

1. **Sticky submit + iOS Safari soft keyboard** would occlude the input the manager was actively typing in.
2. **`.responsive-table` colliding with the inline-edit row** would render the edit form as a half-broken card-stack instead of a normal block.
3. **`.grid-mobile-1` is a no-op on `display: flex` parents** — silently fails wherever the implementer guesses wrong.
4. **Hand-wavy "et cetera" data-label list** would lead to skipped columns at implementation time.
5. **Vague "indistinguishable from before" desktop verification** is operator-vibe, not a check.

After auto-applying the must-have and strongly-recommended findings below, the plan is enterprise-ready for APPLY. Sticky submit was deliberately reversed in favor of inline submit + safe-area padding — simpler, no iOS keyboard collision, and Commission Preview stays visible.

Would I sign my name to the upgraded plan? Yes.

## 2. What Is Solid (Do Not Change)

- **CSS-class-first strategy.** Retrofitting via `.stack-mobile` / `.full-width-mobile` / `.touch-target` / `.responsive-table` is the right call — it keeps JSX single-source and lets the existing media queries do the work.
- **Phase 72 reuse discipline.** Plan correctly leverages tokens, hooks, and utilities without proposing additional design-system changes (one exception added by audit, narrowly justified).
- **Logic-untouched boundary.** Submit pipeline, validation, commission preview API, parser, and edit/delete handlers are all explicitly fenced. Eliminates the highest-risk regression class for a financial form.
- **Deferred screens documented.** ManagerAudits (758 lines) and ManagerConfig (admin) are explicitly out of scope rather than silently skipped — clean follow-up posture.
- **`useIsMobile` minimal usage.** Plan correctly limits JSX-level branching to where CSS can't carry the logic (sticky submit — now removed; heatmap overflow toggle — kept).
- **Hydration contract preserved.** AC-5 explicitly recapitulates the Phase 72 mounted-gate pattern. Audit reinforced the desktop-default-until-mounted rule.

## 3. Enterprise Gaps Identified

Full list, decreasing severity. Items 1-5 are must-have; 6-10 are strongly-recommended; 11-15 are safely deferred.

| # | Severity | Risk |
|---|---------|------|
| 1 | Must-have | Sticky submit on iOS Safari occludes the focused input when soft keyboard opens. Manager types in Notes, can't see what they're typing, may submit wrong content. Also occludes Commission Preview (halvingReason warning) at form bottom. |
| 2 | Must-have | Inline-edit row in ManagerSales uses `<td colSpan>` to span full width. With `.responsive-table` active, that cell is treated as a labeled card-row — form fields render as labeled list items instead of a normal block. Edit UX visibly broken. |
| 3 | Must-have | `.grid-mobile-1 { grid-template-columns: 1fr !important }` is a no-op on `display: flex` containers. Plan applied this class without checking parent display mode; will silently fail wherever the parent isn't grid. |
| 4 | Must-have | `data-label` list ends with "etc." — implementer will skip columns. Each missing label leaves a card row with no field name, which is worse than the table view. |
| 5 | Must-have | Plan does not say what `data-label` Actions cells get, and the `.responsive-table` `::before` pattern would prepend "Actions:" before the buttons — visually broken. Need an escape valve. |
| 6 | Strongly-rec | "Indistinguishable from before this commit" desktop verification is operator vibe. Adding `className`s can change specificity and computed styles. Need a concrete checklist. |
| 7 | Strongly-rec | Scroll-affordance hint is "pick one" between textual and shadow-fade. If implementer mixes approaches across phases, visual inconsistency. Decide here, record as project-wide standard. |
| 8 | Strongly-rec | No keyboard accessibility verification. ManagerEntry has tab order; ManagerSales has inline edit. Some users prefer keyboard. AC-6 added. |
| 9 | Strongly-rec | Save and Cancel buttons stacked vertically with `full-width-mobile` (per Task 2) become visually identical. High mis-tap risk on a destructive context. Differentiate primary vs neutral. |
| 10 | Strongly-rec | Heatmap "minWidth if needed" is conditional. Implementer may not check, scroll won't kick in. Make it a non-conditional spec with a computed natural width. |
| 11 | Deferred | Dark-mode mobile typography preview (theme-agnostic; classes inherit theme vars). |
| 12 | Deferred | Filter row search input + pill row interaction on mobile (cosmetic; pills handled). |
| 13 | Deferred | Layout density audit (form vs control vs whitespace ratio). |
| 14 | Deferred | iOS Safari dynamic-toolbar visual jank (related to sticky-submit; sticky now removed → moot). |
| 15 | Deferred | Analytics instrumentation for mobile vs desktop usage (infra, not feature). |

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking) — 5 applied

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Sticky submit + iOS keyboard / Commission Preview occlusion | AC-1, Task 1 action + verify | Sticky submit DROPPED. Submit renders inline at form bottom + form gets `paddingBottom: max(env(safe-area-inset-bottom), 16px)`. iOS keyboard verification added to Task 1 verify. |
| 2 | Inline-edit row collision with `.responsive-table` | AC-2, Task 2 action | New `.responsive-table-no-label` CSS class added (~4 lines in `responsive.css`). Edit row's colspan `<td>` gets this class to escape per-field card formatting. Files_modified updated. |
| 3 | `.grid-mobile-1` vs `.stack-mobile` display-mode mismatch | AC-3, Task 1 action, Task 3 action | Each container check is now an explicit step: read display mode, use `.grid-mobile-1` for grid, `.stack-mobile` for flex. Audit-tag includes the rationale (no-op on flex). |
| 4 | Hand-wavy "etc." data-label list | AC-2, Task 2 action | Exhaustive enumeration: Date, Agent, Member, Product, Premium, Payment, Status, Commission, Notes, Actions. Implementer told to verify against actual `<th>` text before applying. |
| 5 | Actions cell `data-label` would prepend "Actions:" | AC-2, Task 2 action | Same `.responsive-table-no-label` class applied to Actions `<td>`. Verification step explicitly checks the prefix is absent. |

### Strongly Recommended — 5 applied

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 6 | Vague desktop equivalence | AC-4 | Replaced "indistinguishable" with a concrete 9-item checklist covering form layout, table headers, KPI grid, agent grid, side-by-side BestSource/Sparklines, heatmap inline render, hover states. |
| 7 | Scroll-affordance pattern decision | AC-3, Task 3 action | Decided: textual "← swipe to see all hours →". Recorded as project-wide standard for Phases 75/76 to follow. |
| 8 | Keyboard accessibility | New AC-6, Task 1/2 verify | New AC-6 covers Tab order on ManagerEntry and inline edit form; Escape on edit form. Verify steps added in Task 1 and Task 2. |
| 9 | Save vs Cancel visual collision | AC-2, Task 2 action | Save uses primary-color treatment (background colors.primary500, semibold); Cancel uses neutral (transparent + borderDefault + textTertiary). Both touch-target full-width-mobile. |
| 10 | Heatmap natural-width condition | AC-3, Task 3 action | Removed conditional language. Implementer must compute natural width from column count × cell width and set `minWidth` explicitly. |

### Deferred (Can Safely Defer) — 5 noted, not applied

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 11 | Dark-mode mobile typography preview | Tokens are theme-aware via CSS vars; classes will inherit. Verify in routine smoke if it ever surfaces. |
| 12 | Filter-row search input layout | Cosmetic; pills are addressed. If the search input visibly breaks, log as a follow-up. |
| 13 | Layout density audit | Aesthetic / not functional. Not blocking ship. |
| 14 | iOS dynamic-toolbar jank | Was related to sticky submit. With sticky removed, this risk evaporates. |
| 15 | Mobile vs desktop analytics | Out of scope. |

## 5. Audit & Compliance Readiness

| Area | Assessment |
|------|------------|
| Defensible audit evidence | **Pass.** PLAN.md + AUDIT.md + SUMMARY.md trail in git. Concrete desktop checklist provides verifiable evidence. |
| Silent failure prevention | **Pass** (after upgrades). Display-mode-aware container choice prevents `.grid-mobile-1` no-ops. Exhaustive data-label list prevents missing field labels. iOS keyboard verification prevents the most common mobile-form bug. |
| Post-incident reconstruction | **Pass.** All changes scoped to 5 manager files + 4-line CSS addition. Clean revert. |
| Ownership and accountability | **Pass.** Single-plan phase. Co-Authored-By trailer planned. |
| Accessibility (WCAG 2.1 AA) | **Pass** (after upgrades). 1.4.11 touch targets ✓; 2.1.1 keyboard nav verified in AC-6; 2.4.3 focus order ✓; visual differentiation for primary vs neutral controls ✓. |
| Regression risk on shipped financial logic | **Low.** Layout-only constraint preserved across all three tasks. Submit pipeline + commission preview API + edit handlers explicitly off-limits. |

## 6. Final Release Bar

**What must be true before this plan ships:**

1. All three tasks complete and all six acceptance criteria demonstrated.
2. Verification checklist item-by-item — especially the iOS-keyboard occlusion check and the desktop concrete checklist.
3. `npx tsc --noEmit` baseline preserved (55 → 55).
4. Manual smoke on a real mobile viewport (or DevTools 375px) of all three pages, including a successful sale submission and inline-edit save.

**Risks remaining if shipped as-is (with upgrades applied):**

- The 4-line `.responsive-table-no-label` exception adds a new selector to `responsive.css`. Future phases must follow the rule "additive only, narrowly justified" or this approach will calcify into a free-for-all CSS file.
- ManagerAudits and ManagerConfig remain desktop-only. Documented; not blocking unless someone needs to triage an audit on their phone.
- iOS notched-device safe-area handling for the form bottom is via `env(safe-area-inset-bottom)` — works on iOS 11.2+, which covers all in-use devices today. No action needed.

**Would I sign my name to the upgraded plan?** Yes. The audit caught all of the iPhone-specific bugs that would have surfaced in user testing.

---

**Summary:** Applied **5 must-have + 5 strongly-recommended** upgrades. Deferred **5** items with documented rationale.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
