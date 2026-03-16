---
phase: 7
slug: payroll-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest + ts-jest |
| **Config file** | apps/ops-api/jest.config.ts |
| **Quick run command** | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "payroll" -x` |
| **Full suite command** | `npx jest --config apps/ops-api/jest.config.ts` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "payroll" -x`
- **After every plan wave:** Run `npx jest --config apps/ops-api/jest.config.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | PAYR-04 | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "payroll-guard" -x` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | PAYR-05 | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "payroll-guard" -x` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | PAYR-02 | manual-only | N/A (React component) | N/A | ⬜ pending |
| 07-02-02 | 02 | 1 | PAYR-03 | manual-only | N/A (UI behavior) | N/A | ⬜ pending |
| 07-03-01 | 03 | 1 | PAYR-06 | manual-only | N/A (client-side, already working) | N/A | ⬜ pending |
| 07-03-02 | 03 | 1 | PAYR-07 | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "commission" -x` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/ops-api/src/services/__tests__/payroll-guard.test.ts` — stubs for PAYR-04, PAYR-05 (paid agent guard logic)
- [ ] Test should validate: PAID entries block edits, toggle back to unpaid re-enables edits, late entries are created but not blocked

*Existing jest.config.ts and test infrastructure covers remaining requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent cards show correct commission totals | PAYR-02 | React component, no frontend test infra | Open payroll dashboard, select a period, verify each agent card shows correct payout + adjustment + bonus - fronted - hold |
| Cards collapse/expand with "Show N more" | PAYR-03 | UI interaction behavior | Open a period with agent having >5 entries, verify first 5 shown, click "Show N more", verify all entries visible, page scrolls naturally |
| CSV export works for any period | PAYR-06 | Client-side file download | Click export on OPEN and PAID periods, verify CSV downloads with correct financial columns |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
