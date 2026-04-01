---
phase: 41
slug: payroll-card-restructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no frontend tests exist in ops-dashboard) |
| **Config file** | none — no test infrastructure |
| **Quick run command** | Manual browser verification |
| **Full suite command** | Manual browser verification |
| **Estimated runtime** | ~60 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Manual browser verification — expand/collapse agents, check week sections, verify print
- **After every plan wave:** Full manual walkthrough of payroll view with test data
- **Before `/gsd:verify-work`:** Visual verification that CARD-01 and CARD-02 behaviors match decisions D-01 through D-20
- **Max feedback latency:** ~60 seconds (browser refresh + visual inspection)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 41-01-XX | 01 | 1 | CARD-01 | manual-only | Visual inspection in browser | N/A | ⬜ pending |
| 41-02-XX | 02 | 1 | CARD-02 | manual-only | Visual inspection in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — manual verification only for this phase. No test infrastructure to set up.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent-level collapsible cards render as top-level | CARD-01 | No test infrastructure exists for ops-dashboard; payroll relies on visual layout, inline styles, browser APIs | 1. Navigate to payroll view 2. Verify each agent has a single collapsible card 3. Verify cards expand/collapse on click |
| Week-by-week entries separated inside agent cards | CARD-02 | Same — visual layout verification requiring browser | 1. Expand an agent card 2. Verify week sections with date ranges visible 3. Verify each week has its own financial strip, inputs, print, paid/unpaid 4. Verify last 2 weeks start expanded |
| Print output matches screen layout | CARD-02 | Print uses window.open with generated HTML — requires browser | 1. Click print on a specific week section 2. Verify print shows that agent's entries for that week only 3. Verify layout matches screen structure |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
