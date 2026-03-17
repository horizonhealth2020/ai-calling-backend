---
phase: 09
slug: ui-ux-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser verification (no component test framework in project) |
| **Config file** | none — UI polish is visual verification |
| **Quick run command** | `npm run ops:dev` + visual inspection |
| **Full suite command** | `npm run ops:dev` + all dashboards + visual inspection |
| **Estimated runtime** | ~60 seconds (server startup + page load) |

---

## Sampling Rate

- **After every task commit:** Run `npm run ops:dev` + verify affected dashboard
- **After every plan wave:** Visual check all dashboards for consistency
- **Before `/gsd:verify-work`:** Full visual audit of all dashboards
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | UIUX-02, UIUX-03 | manual | visual inspection | N/A | ⬜ pending |
| 09-01-02 | 01 | 1 | UIUX-01 | manual | visual inspection | N/A | ⬜ pending |
| 09-02-01 | 02 | 1 | UIUX-02, UIUX-03 | manual | visual inspection | N/A | ⬜ pending |
| 09-02-02 | 02 | 1 | UIUX-01 | manual | visual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework setup needed — this phase is entirely visual/UI and verified through manual browser inspection.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Form validation errors display inline | UIUX-01 | Visual rendering | Submit empty form, verify red borders + error text below fields |
| Form layout consistency | UIUX-02 | Visual comparison | Open manager, payroll, owner dashboards side-by-side, compare spacing/styles |
| Glassmorphism theme adherence | UIUX-03 | Visual rendering | Check all cards, inputs, buttons match dark theme with glass effect |
| Skeleton loading states | UIUX-03 | Visual timing | Refresh dashboard, verify skeleton appears during data fetch |
| EmptyState components | UIUX-03 | Visual rendering | Filter to empty dataset, verify EmptyState component displays |
| Hover/focus consistency | UIUX-03 | Interactive | Tab through forms, hover buttons/rows, verify consistent styling |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
