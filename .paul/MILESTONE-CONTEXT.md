# Milestone Context

**Generated:** 2026-04-09
**Status:** Pre-discussion notes — ready for /paul:discuss-milestone

## UX Audit Findings (5 dashboard audits completed)

### CRITICAL (Professional Feel Killers)

1. **`window.confirm()` for destructive actions** — Payroll (period close/reopen), manager (sale deletion, status changes), CS (chargeback deletion). Browser-native dialogs break dark glassmorphism theme.
2. **No loading feedback on save operations** — Bonus/fronted/hold inputs in payroll, agent config saves, rep management in CS fire API calls with zero visual feedback.
3. **Missing focus/keyboard states everywhere** — Buttons, inputs, table rows, tabs, sidebar items have no `:focus-visible` styling. Shared Button component has no focus ring.
4. **Disabled inputs look identical to enabled ones** — Button, Input, Select in @ops/ui have no disabled styling beyond opacity 0.6.
5. **Hardcoded colors (~50+ instances)** — Every dashboard has inline rgba/hex instead of design tokens.

### HIGH (UX Friction)

6. **No debounce on filter/search inputs** — CS tracking search, payroll sidebar search, owner date range all trigger on every keystroke.
7. **Silent API failures** — Multiple catch blocks swallow errors. Owner archive, manager tracker, CS rep management failures are invisible.
8. **Inconsistent error clearing on forms** — Manager sales entry clears some field errors on change but not others.
9. **Tables not responsive** — All dashboards use fixed-column tables with overflowX:auto but no scroll indicators or mobile fallback.
10. **Missing aria-label on inputs, icon buttons, dropdowns** — Pervasive across all dashboards.

### MEDIUM (Polish)

11. **No confirmation for resolve/unapprove actions** — CS resolve panel, payroll commission unapprove — single click, no undo.
12. **KPI cards use hardcoded 4-column grid** — CS and owner dashboards break on smaller screens.
13. **Navigation collapse uses mouse events only** — Touch devices can't expand sidebar nav.
14. **Missing transitions** — Filter panels appear/disappear instantly, note expansion snaps.
15. **Inconsistent typography** — Hardcoded fontSize values instead of typography tokens.

## Relevant Skills from Skill Library

Load these during planning phases:

| Priority | Skill | Path | Focus |
|----------|-------|------|-------|
| 1 | design-taste-frontend | `~/.claude/Skill-library/design-taste-frontend/SKILL.md` | Anti-generic standards, interaction states, loading/empty/error |
| 2 | ui-ux-pro-max | `~/.claude/Skill-library/ui-ux-pro-max/SKILL.md` | Accessibility (focus rings, ARIA, contrast, touch targets) |
| 3 | high-end-visual-design | `~/.claude/Skill-library/high-end-visual-design/SKILL.md` | Micro-interactions, disabled states, premium finishes |
| 4 | form-cro | `~/.claude/Skill-library/form-cro/SKILL.md` | Form validation, error messaging, disabled submit |
| 5 | redesign-existing-projects | `~/.claude/Skill-library/redesign-existing-projects/SKILL.md` | Audit framework for missing polish |
| 6 | frontend-developer | `~/.claude/Skill-library/frontend-developer/SKILL.md` | React/Next.js accessibility (WCAG 2.1/2.2) |

## Suggested Phase Structure

| Phase | Focus | Findings Addressed |
|-------|-------|--------------------|
| 50 | Shared UI hardening | Focus rings, disabled states, confirm modal component, loading button states, aria-invalid (#1,3,4) |
| 51 | Dashboard interaction fixes | Replace window.confirm, save feedback/toasts, debounce inputs, error handling (#2,5,6,7,8,11) |
| 52 | Visual consistency pass | Design token migration for hardcoded colors, responsive grids, transitions, typography (#5,9,12,14,15) |

---

*This file is temporary. It will be consumed by /paul:discuss-milestone.*
