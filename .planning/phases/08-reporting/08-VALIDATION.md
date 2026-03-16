---
phase: 08
slug: reporting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 08 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js (root) |
| **Quick run command** | `npm test -- --testPathPattern=reporting` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=reporting`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | REPT-01, REPT-02 | integration | `npm test -- --testPathPattern=reporting` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | REPT-03 | integration | `npm test -- --testPathPattern=reporting` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 2 | REPT-05 | typecheck | `cd apps/owner-dashboard && npx tsc --noEmit` | N/A | ⬜ pending |
| 08-02-02 | 02 | 2 | REPT-03, REPT-04 | typecheck + manual | `cd apps/manager-dashboard && npx tsc --noEmit` + browser CSV download | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/ops-api/src/services/__tests__/reporting.test.ts` — stubs for REPT-01, REPT-02, REPT-03, REPT-05
- [ ] Test fixtures for agent/sale/payroll entry test data

*Existing jest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSV downloads correctly in browser | REPT-04 | Requires browser download API | Click export button, verify CSV opens with correct columns |
| StatCard trend arrows render correctly | REPT-05 | Visual rendering | Check owner dashboard StatCards show colored arrows with percentages |
| Period summary displays on both dashboards | REPT-03 | Visual rendering | Check both owner and manager dashboards show period summary table with weekly/monthly toggle |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
