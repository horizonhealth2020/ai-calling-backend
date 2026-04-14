# Enterprise Plan Audit Report

**Plan:** `.paul/phases/72-responsive-foundation/72-01-PLAN.md`
**Audited:** 2026-04-14
**Verdict:** **Conditionally acceptable → upgraded to enterprise-ready after auto-applied findings**

---

## 1. Executive Verdict

The original plan was **conditionally acceptable**. Architecture was sound (additive CSS, preserved desktop path, tokens as single source of truth) but five latent risks would have surfaced as production bugs or accessibility failures:

1. A **React hydration mismatch** path that would crash the dashboard tree on mobile first-load.
2. **Ambiguous breakpoint naming** (`mobile: 767` vs `desktop: 1024`) that would be misread by the four downstream phases.
3. **Focus trap and focus restoration** specified in the AC but not in the task action — leaving it to chance.
4. **Hamburger button missing all ARIA state** (no `aria-label`, `aria-expanded`, `aria-controls`) — fails WCAG 4.1.2.
5. **Body scroll lock hardcoded `""` on cleanup** — would clobber a parent modal's prior overflow state.

After auto-applying the must-have and strongly-recommended findings below, the plan is **enterprise-ready for APPLY**.

Would I sign my name to the upgraded plan? Yes — assuming the verification checklist is honored end-to-end.

## 2. What Is Solid (Do Not Change)

- **Additive CSS strategy.** Extending the existing media-query blocks in `responsive.css` without touching any selector already in use is low-risk and correct. The plan deliberately catalogs the 5 existing consumers and leaves them alone.
- **Desktop preservation by verbatim copy.** Task 3 keeps the current hover-to-expand nav block byte-for-byte in the desktop branch. This is the right risk posture for a shipped, role-gated navigation.
- **Boundaries are explicit.** `theme.css`, `animations.css`, `ConfirmModal.tsx`, and `sales-board` are all protected. Role-to-tab logic in `lib/roles.ts` is fenced off.
- **No new runtime dependencies.** Focus trap, scroll lock, and transitions are all implemented locally. This is the correct trade — `react-focus-lock` + `body-scroll-lock` + `framer-motion` would add ~20 KB gzipped for what three `useEffect`s can do.
- **`files_modified` is accurate and constrained.** Eight files, all additive except the nav refactor. Clean conflict surface for APPLY.
- **Autonomous = true is honest.** No legitimate human-in-the-loop checkpoint exists here; the foundation is mechanical work.

## 3. Enterprise Gaps Identified

Full list, in decreasing severity. Items 1-5 are must-have; 6-10 are strongly-recommended; 11-15 are safely deferred.

| # | Severity | Risk |
|---|---------|------|
| 1 | Must-have | Hydration mismatch when SSR renders desktop nav and client hydrates as mobile — React unmounts and remounts the subtree, wiping socket state and triggering a console error. |
| 2 | Must-have | Breakpoint token naming mixes `max-width` and `min-width` semantics under the same `breakpoints.xxx` keys. Consumers in Phases 73-76 will guess wrong. |
| 3 | Must-have | AC-3 promises focus trap and focus restoration, but Task 2 action explicitly avoids the ConfirmModal pattern and does not specify how focus management is implemented. Unspecified = unimplemented. |
| 4 | Must-have | Hamburger button in Task 3 has no `aria-label`, `aria-expanded`, or `aria-controls`. Blind-user accessibility and WCAG 4.1.2 failure. |
| 5 | Must-have | Body scroll lock specified as `document.body.style.overflow = "hidden"` with implicit "restore on cleanup". If cleanup hardcodes `""` or `"auto"`, it clobbers a parent modal's state. Must capture prior value. |
| 6 | Strongly-rec | `prefers-reduced-motion: reduce` is not honored — fails WCAG 2.3.3 (animation toggle). Trivial to add. |
| 7 | Strongly-rec | No in-drawer Close button. Backdrop tap and ESC are not reliable affordances for all users (low-vision users who can't locate the backdrop; users without physical keyboards). |
| 8 | Strongly-rec | `ariaLabel` typed as optional on `MobileDrawer`. Every dialog MUST be named. Make it required so TypeScript catches unnamed drawers at build time. |
| 9 | Strongly-rec | `packages/ui/src/hooks/` directory does not exist. Task 2 assumes its creation without specifying. Also no barrel file planned. |
| 10 | Strongly-rec | Task 2 verification step 3 was "write throwaway test in scratch file or manually mount — revert before commit." Fragile. Better: compile-enforce required prop, then run functional verification inside Task 3's browser smoke. |
| 11 | Deferred | Multi-drawer ESC stacking not handled — out of scope for this phase (no stacked-drawer use case until Phase 76). |
| 12 | Deferred | `viewport-fit=cover` not added to viewport meta — `env(safe-area-inset-bottom)` is a no-op on notched iOS. Progressive enhancement; bottom-sheet still functions. |
| 13 | Deferred | No automated regression test for desktop nav. Manual smoke is sufficient for infrastructure work; full Jest+RTL setup is a separate milestone concern. |
| 14 | Deferred | `.touch-target { min-width: 44px }` applied to wide buttons could visually overinflate. Documented as opt-in className — consumer's responsibility. |
| 15 | Deferred | No analytics for nav opens / drawer usage. This is infra, not feature. |

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking) — 5 applied

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Hydration mismatch path | AC-2, AC-4, Task 2 action, Task 3 action | Hook now returns `{ breakpoint, mounted }` / `{ isMobile, mounted }`. Task 3 gates mobile rendering on `mounted === true` (desktop branch renders until client hydration completes). AC-2 and AC-4 require zero hydration-mismatch warnings. |
| 2 | Breakpoint naming ambiguity | Task 1 action (`tokens.ts` block) | Renamed keys to `mobileMax`, `tabletMin`, `tabletMax`, `desktopMin`, `wideMin` — semantics unambiguous. Added JSDoc explaining each boundary. |
| 3 | Focus trap/restoration unspecified | AC-3, Task 2 action | AC-3 now requires focus to enter drawer on open, Tab to cycle inside, focus to restore to opener on close. Task 2 action specifies implementation: `previouslyFocusedRef`, query for focusables, boundary-wrapping Tab handler. |
| 4 | Hamburger a11y missing | AC-4, Task 3 action, verify | Hamburger now requires `aria-label="Open navigation"`, `aria-expanded={drawerOpen}`, `aria-controls="dashboard-main-drawer"`, `className="touch-target"`. Drawer carries matching `id`. |
| 5 | Scroll lock cleanup incorrect | AC-3, Task 2 action | Action now requires capturing prior `document.body.style.overflow` in a ref on open, restoring captured value on close — not hardcoded string. Verification checklist confirms in DevTools Console. |

### Strongly Recommended — 5 applied

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 6 | No reduced-motion support | AC-3, Task 2 action, verify | Action requires `transition: "none"` when `prefers-reduced-motion: reduce` matches. Verification includes DevTools emulation check. |
| 7 | No in-drawer Close button | AC-3, Task 2 action | MobileDrawer now renders a ×-button at top-right, `aria-label="Close"`, `className="touch-target"`. |
| 8 | `ariaLabel` optional | Task 2 action (prop type) | `ariaLabel` typed as required. TypeScript compile-check added to verify. |
| 9 | Hooks directory/barrel missing | Task 2 action, `files_modified` frontmatter | Action explicitly creates `packages/ui/src/hooks/` and `hooks/index.ts` barrel. Frontmatter lists the new barrel file. |
| 10 | Fragile throwaway verification | Task 2 verify, Task 3 verify | Task 2 verification now compile-checks required-prop enforcement; functional verification moved to Task 3's browser smoke (logical dependency ordering, no throwaway files). |

### Deferred (Can Safely Defer) — 5 noted, not applied

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 11 | Multi-drawer ESC stacking | No stacked-drawer use case in this phase. If Phase 76 introduces one, it will extend this primitive. Documented in Boundaries. |
| 12 | `viewport-fit=cover` for safe-area | Progressive enhancement only. Bottom sheet fully functional without it on non-notched devices and on Android. Documented in Boundaries as conscious defer. |
| 13 | Automated nav regression test | Infrastructure phase; manual smoke + "preserve verbatim" discipline is proportionate. Full RTL setup belongs in a dedicated testing milestone. Documented in Boundaries. |
| 14 | `.touch-target` min-width visual concern | Class is opt-in via `className="touch-target"` — consumer controls application. Not a defect of the utility itself. |
| 15 | Nav analytics instrumentation | Out of scope — this is infra, not a tracked feature. |

## 5. Audit & Compliance Readiness

| Area | Assessment |
|------|------------|
| Defensible audit evidence | **Pass.** PLAN.md is in git, SUMMARY.md will document what shipped, `@ops/ui` exports are greppable. Audit trail = git log + phase directory. |
| Silent failure prevention | **Pass** (after upgrades). TypeScript enforces required `ariaLabel`. Verification checklist catches hydration warnings, focus trap failures, aria attribute absence, and scroll-lock regressions. |
| Post-incident reconstruction | **Pass.** All changes are in two well-scoped locations (`packages/ui/`, one dashboard file). Rolling back is a clean revert. |
| Ownership and accountability | **Pass.** Single-plan phase. `Co-Authored-By` trailer on commit provides AI authorship attribution. |
| Accessibility (WCAG 2.1 AA) | **Pass** (after upgrades). 2.3.3 reduced motion ✓, 2.4.3 focus order ✓, 4.1.2 name/role/value on hamburger ✓, 1.4.11 touch targets ✓. |
| Regression risk on shipped functionality | **Low.** Desktop nav preserved verbatim by design. Hook mounted-gate ensures first paint matches SSR. |

## 6. Final Release Bar

**What must be true before this plan ships:**

1. All three tasks complete and all acceptance criteria demonstrated.
2. Verification checklist item-by-item — **not waved through**. Hydration warnings, aria attributes, and focus trap are the items most likely to silently regress; DevTools inspection is mandatory.
3. `npm run build` (full monorepo) passes with zero type errors.
4. Manual keyboard-only smoke confirms focus trap + focus restoration works end-to-end.
5. Browser console is clean (no React warnings) on both 375px and 1280px on reload.

**Risks remaining if shipped as-is (with upgrades applied):**

- iOS notched-device bottom-sheet polish is degraded (deferred `viewport-fit=cover`). Will be noticeable on iPhone X+ when Phase 76 adds the CS bottom-sheet. Mitigation: follow-up sub-phase or addendum commit if iOS polish is requested.
- Stacked drawer scenarios are not handled — Phase 76 must either close the nav drawer before opening its own or extend this primitive.

**Would I sign my name to the upgraded plan?** Yes. It's enterprise-defensible.

---

**Summary:** Applied **5 must-have + 5 strongly-recommended** upgrades. Deferred **5** items with documented rationale.
**Plan status:** Updated and ready for APPLY.

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
