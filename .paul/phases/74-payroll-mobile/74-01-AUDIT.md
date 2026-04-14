# Enterprise Plan Audit Report

**Plan:** `.paul/phases/74-payroll-mobile/74-01-PLAN.md`
**Audited:** 2026-04-14
**Verdict:** **Conditionally acceptable → upgraded to enterprise-ready after auto-applied findings**

---

## 1. Executive Verdict

The original plan was **conditionally acceptable** — strong compared to Phase 73's pre-audit baseline because it inherited the lessons learned (display-mode-aware classes, mounted-gating, ariaLabel required, `.responsive-table-no-label` reuse, print HTML fenced). The remaining gaps fall into one theme: **financial-display surfaces need stricter discipline than ManagerSales did**.

Four gaps required upgrades before the plan was safe to execute:

1. **Sidebar mount discipline** — "do not let LAYOUT's sidebar slot consume space" was hand-wavy. Without explicit `{!showMobileDrawer && ...}` gating, the inline AgentSidebar might double-render or leave an empty flex slot.
2. **WeekSection complexity underestimated** — 1131 lines with compound cells (status badge + adjustment input + clawback indicator together) cannot be mechanically class-decorated like ManagerSales's simple-text cells. Reading-first discipline and cell classification mandatory.
3. **Net-amount byte-identical proof** was specified as a manual-eyeball check. For a financial-accuracy claim this is insufficient. Replaced with a structural argument (only className/data-label additions, no formula/formatter touched) PLUS a baseline triple captured pre-phase as the empirical sanity check.
4. **Pre-existing `flexWrap: "wrap"` on header status row** would conflict with newly-added `.stack-mobile` (double-stack). Required: inspect first, only stack if wrap is absent.

After upgrades: **enterprise-ready.** Would I sign my name to this plan touching payroll display code? Yes, given the structural net-accuracy argument and the cell-classification discipline.

## 2. What Is Solid (Do Not Change)

- **Print HTML strings explicitly fenced.** Lines 902 + 993 in PayrollPeriods.tsx are the printable PDF templates — financial reporting at the company level. Plan correctly says do-not-touch and adds a `grep -c "<table>"` invariant check.
- **Net formula consumers fenced.** Phase 71 made `computeNetAmount` canonical; plan correctly says do-not-modify.
- **Adjustment input touch-target without changing onChange.** Exactly the right discipline — fat-finger protection for dollar amounts without risking handler regression.
- **AgentSidebar API preserved.** Wraps usages instead of changing component props. Avoids cascading changes to other consumers.
- **Phase-72/73 reuse.** No new responsive.css selectors. `.responsive-table-no-label` (Phase 73's narrow exception) reused for action cells and colspan rows.
- **Display-mode-aware container choice** is explicit per Task — Phase 73 lesson absorbed.
- **Sidebar → drawer is the right call.** 220px sidebar on a 375px viewport eats 60% of the screen. No half-measure (e.g., shrinking the sidebar) would preserve usability.
- **Hydration safety** preserved (mounted-gate; desktop is the SSR default).
- **Keyboard a11y AC** included from day one (inheriting Phase 73's audit lesson — no need for the audit to add it this time).

## 3. Enterprise Gaps Identified

Decreasing severity. Items 1-4 are must-have; 5-6 are strongly-recommended; 7-13 are safely deferred.

| # | Severity | Risk |
|---|---------|------|
| 1 | Must-have | Hand-wavy "do not let LAYOUT's sidebar slot consume space" — without explicit `{!showMobileDrawer && <AgentSidebar />}` gate, the inline sidebar might double-mount (slot reserved, drawer mounts second copy) or leave an empty 220px flex slot on mobile. Either breaks layout. |
| 2 | Must-have | WeekSection (1131 lines) has cells more complex than ManagerSales (status badge + adjustment input + clawback indicator together). Mechanical `data-label` addition risks unreadable card rows. Need PRECONDITION: read structure, classify cells (SIMPLE / ACTION-CONTROL / COMPOUND), document choices. |
| 3 | Must-have | "Read the actual `<th>` text — do NOT guess" was implicit in Task 2; needs to be a hard PRECONDITION step before any class addition, with `grep` command specified. |
| 4 | Must-have | "Net amount displayed is byte-identical" stated as manual-eyeball check. For a financial claim this is insufficient. Need structural argument (className/data-label only, no formula/formatter calls modified — provable via `git diff`) + baseline triple as sanity check. |
| 5 | Strongly-rec | Header status badge row may already use `flexWrap: "wrap"`. Adding `.stack-mobile` blindly would double-stack (wrap + column-direction). Inspect first; only stack if wrap absent. |
| 6 | Strongly-rec | Verification checklist needed PRE-phase baseline capture step (write down/screenshot the test agent's net BEFORE editing anything). Otherwise "byte-identical" is unverifiable post-hoc. |
| 7 | Deferred | AgentSidebar's `overflowY: auto` may double-scroll inside MobileDrawer's content area (which also has `overflowY: auto` per Phase 72). Likely works fine — smoke confirms. |
| 8 | Deferred | Drawer panel max-width is 360px (Phase 72); AgentSidebar is 220px wide. Inside the drawer the 220 width sits inside 360 — slight visual asymmetry but acceptable. |
| 9 | Deferred | Editable cells in `.responsive-table` mode render as `Label: input` flex pair via Phase 72 CSS. Visual layout will be confirmed in smoke. |
| 10 | Deferred | Long agent-name truncation in "Select Agent" trigger button — covered by Task 1 step 6 ("wrap with truncation styles"). |
| 11 | Deferred | ConfirmModal (Phase 50) on mobile — pre-dates Phase 72 MobileDrawer focus trap. Was QA'd at the time; no new issue introduced. |
| 12 | Deferred | Mobile vs desktop usage analytics — explicitly out of scope (audit-noted in Phase 73 too). |
| 13 | Deferred | Adjustment input visual conflict in card row layout — smoke will confirm. |

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking) — 4 applied

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Sidebar mount discipline | Task 1 action | Concrete code block showing `{!showMobileDrawer && <AgentSidebar />}` gate. MobileDrawer rendered as sibling of LAYOUT (not inside) to escape `overflow: hidden`. Drawer's onSelectAgent wired to also close drawer. |
| 2 | WeekSection cell complexity | Task 2 action | New PRECONDITION step: read structure, classify each cell as SIMPLE-VALUE / ACTION-CONTROL / COMPOUND, document classifications in a comment block, then apply. |
| 3 | Reading-first for table headers | Task 2 action (PRECONDITION step a) | Specified `grep -n` command; reading-first explicitly required before any data-label addition. Same discipline for PayrollPeriods.tsx:1062 table. |
| 4 | Net-amount accuracy proof | AC-4, verify checklist | Replaced manual-eyeball check with: (a) structural argument — only className/data-label additions, no formula/formatter calls modified, provable via `git diff`; (b) baseline triple (agent name, period id, displayed net string) captured pre-phase; (c) byte-identical comparison post-phase as empirical sanity check. |

### Strongly Recommended — 2 applied

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 5 | Header status badge double-stack | Task 3 action step 3 | Inspect FIRST — only add `.stack-mobile` if `flexWrap: "wrap"` is absent. Avoid double-stacking. |
| 6 | Pre-phase baseline capture | Verification checklist | Added explicit "Pre-phase" step at top of verification checklist: capture baseline triple before starting. |

### Deferred (Can Safely Defer) — 7 noted, not applied

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 7 | AgentSidebar overflowY inside drawer overflowY | Likely works (browser handles nested overflow gracefully); smoke confirms. |
| 8 | Drawer max-width 360 vs sidebar width 220 | Visual asymmetry only — sidebar sits inside drawer with extra padding. Acceptable. |
| 9 | Editable cell `Label: input` visual | Phase 72 CSS handles via `display: flex; justify-content: space-between`. Smoke confirms. |
| 10 | Long agent-name truncation | Already covered by Task 1 step 6. |
| 11 | ConfirmModal focus management | Phase 50 component; no regression introduced by this phase. |
| 12 | Mobile vs desktop analytics | Out of scope for the milestone (mobile-friendly, not mobile-measured). |
| 13 | Adjustment input visual conflict | Smoke will confirm; fallback to `responsive-table-no-label` documented in Task 2 PRECONDITION step (b). |

## 5. Audit & Compliance Readiness

| Area | Assessment |
|------|------------|
| Defensible audit evidence | **Pass.** PLAN.md + AUDIT.md + SUMMARY.md trail in git. Structural net-accuracy argument is testable via `git diff` — auditable artifact. |
| Silent failure prevention | **Pass** (after upgrades). PRECONDITION reading discipline prevents skipped columns. Cell classification prevents unreadable compound cards. Sidebar-gate prevents layout collapse. Diff-inspection prevents formula drift. |
| Post-incident reconstruction | **Pass.** All changes scoped to 4 payroll files + zero CSS additions. Clean revert. |
| Ownership and accountability | **Pass.** Single-plan phase. Co-Authored-By trailer planned. |
| Accessibility (WCAG 2.1 AA) | **Pass.** Touch targets on dollar inputs (1.4.11). Drawer trigger has aria-label/aria-expanded/aria-controls (4.1.2). Focus trap + restoration inherited from Phase 72 MobileDrawer (2.4.3). |
| Regression risk on shipped financial logic | **Very Low.** Layout-only constraint enforced. computeNetAmount + lock/unlock handlers + period derivation all explicitly fenced. Print HTML byte-identical. Net display protected by both structural argument AND empirical baseline check. |

## 6. Final Release Bar

**What must be true before this plan ships:**

1. All three tasks complete and all six acceptance criteria demonstrated.
2. Pre-phase baseline triple captured (agent + period + displayed net string).
3. Post-phase: same triple displays identically; `git diff` confirms only className/data-label additions on financial cells.
4. `npx tsc --noEmit` baseline preserved (55 → 55).
5. Print preview at 1280px shows original wide-table layout.
6. `grep -c "<table>"` on PayrollPeriods.tsx unchanged.

**Risks remaining if shipped as-is (with upgrades applied):**

- WeekSection compound cells may render as visually noisy cards on mobile despite the PRECONDITION discipline. If smoke reveals an unreadable card, the fallback is `responsive-table-no-label` on that cell (documented in Task 2 step b). Worst case: a follow-up plan refines specific cells.
- PayrollChargebacks / PayrollProducts / PayrollExports / PayrollService remain desktop-only. Documented; not blocking unless a payroll user needs to do those operations from a phone.
- Print view stays desktop-shaped. This is a feature, not a bug — printable PDFs must remain consistent across viewports.

**Would I sign my name to the upgraded plan touching payroll's financial display code?** Yes. The structural net-accuracy guarantee + cell-classification PRECONDITION + print-HTML fence are the right discipline for this surface.

---

**Summary:** Applied **4 must-have + 2 strongly-recommended** upgrades. Deferred **7** items with documented rationale.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
