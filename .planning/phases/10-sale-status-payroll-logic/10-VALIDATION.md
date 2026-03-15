---
phase: 10
slug: sale-status-payroll-logic
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (TypeScript via ts-jest) |
| **Config file** | apps/ops-api/jest.config.ts |
| **Quick run command** | `npm test -- --testPathPattern=commission\|status` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=commission|status`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| P10-01 | 01 | 1 | RAN generates normal commission | unit | `npm test -- --testPathPattern=status-commission` | ❌ W0 | ⬜ pending |
| P10-02 | 01 | 1 | DECLINED/DEAD generate $0 entries | unit | `npm test -- --testPathPattern=status-commission` | ❌ W0 | ⬜ pending |
| P10-03 | 02 | 1 | Dead/Declined→Ran creates change request | unit | `npm test -- --testPathPattern=status-change` | ❌ W0 | ⬜ pending |
| P10-04 | 01 | 1 | Ran→Dead/Declined zeroes immediately | unit | `npm test -- --testPathPattern=status-commission` | ❌ W0 | ⬜ pending |
| P10-05 | 01 | 1 | Finalized period creates negative adj | unit | `npm test -- --testPathPattern=status-commission` | ❌ W0 | ⬜ pending |
| P10-06 | 02 | 1 | Approval recalculates commission | unit | `npm test -- --testPathPattern=status-change` | ❌ W0 | ⬜ pending |
| P10-07 | 02 | 1 | Rejection reverts to original status | unit | `npm test -- --testPathPattern=status-change` | ❌ W0 | ⬜ pending |
| P10-08 | 03 | 2 | Sales board filters status=RAN | unit | `npm test -- --testPathPattern=sales-board-filter` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/ops-api/src/services/__tests__/status-commission.test.ts` — stubs for P10-01, P10-02, P10-04, P10-05
- [ ] `apps/ops-api/src/services/__tests__/status-change.test.ts` — stubs for P10-03, P10-06, P10-07
- [ ] Extend existing `commission.test.ts` with status-aware test cases

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pending Ran badge (amber) | Visual indicator | CSS styling | Inspect agent sales tab for amber badge on pending status |
| Approval queue in payroll cards | UI layout | Visual placement | Open payroll dashboard, verify pending requests show inside agent cards |
| Inline confirmation dialog | UX flow | User interaction | Change Dead/Declined sale to Ran, verify confirmation appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
