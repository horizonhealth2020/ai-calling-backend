---
phase: 3
slug: commission-fees-period-assignment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest + ts-jest (existing) |
| **Config file** | `apps/ops-api/jest.config.ts` |
| **Quick run command** | `cd apps/ops-api && npx jest --testPathPattern=commission\|period --no-coverage` |
| **Full suite command** | `cd apps/ops-api && npx jest --no-coverage` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/ops-api && npx jest --testPathPattern=commission|period --no-coverage`
- **After every plan wave:** Run `cd apps/ops-api && npx jest --no-coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | COMM-08 | unit | `cd apps/ops-api && npx jest --testPathPattern=commission -t "COMM-08" --no-coverage` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | COMM-09 | unit | `cd apps/ops-api && npx jest --testPathPattern=commission -t "COMM-09" --no-coverage` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | PAYR-01 | unit | `cd apps/ops-api && npx jest --testPathPattern=period -t "PAYR-01" --no-coverage` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | COMM-10 | unit | `cd apps/ops-api && npx jest --testPathPattern=period -t "COMM-10" --no-coverage` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/ops-api/src/services/__tests__/period-assignment.test.ts` — stubs for PAYR-01, COMM-10
- [ ] COMM-08 and COMM-09 labeled test blocks in `commission.test.ts`
- [ ] Export `getSundayWeekRange` signature must accept optional `shiftWeeks` parameter for testability

*Existing commission.test.ts has test patterns but no labeled COMM-08/COMM-09 blocks.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
