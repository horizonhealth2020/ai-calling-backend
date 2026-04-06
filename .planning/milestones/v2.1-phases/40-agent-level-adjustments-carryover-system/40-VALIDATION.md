---
phase: 40
slug: agent-level-adjustments-carryover-system
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `apps/morgan/jest.config.js` (existing) |
| **Quick run command** | `npm test -- --testPathPattern=payroll` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=payroll`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 40-01-01 | 01 | 1 | NET-01 | unit | `npm test -- --testPathPattern=payroll` | ❌ W0 | ⬜ pending |
| 40-01-02 | 01 | 1 | FIX-06 | unit | `npm test -- --testPathPattern=payroll` | ❌ W0 | ⬜ pending |
| 40-02-01 | 02 | 1 | CARRY-01 | unit | `npm test -- --testPathPattern=payroll` | ❌ W0 | ⬜ pending |
| 40-02-02 | 02 | 2 | CARRY-02, CARRY-03 | unit | `npm test -- --testPathPattern=payroll` | ❌ W0 | ⬜ pending |
| 40-02-03 | 02 | 2 | CARRY-04, CARRY-05, CARRY-06 | unit | `npm test -- --testPathPattern=payroll` | ❌ W0 | ⬜ pending |
| 40-03-01 | 03 | 2 | FIX-07, FIX-08 | manual | N/A — visual | N/A | ⬜ pending |
| 40-03-02 | 03 | 2 | CARRY-07, CARRY-08 | manual | N/A — visual | N/A | ⬜ pending |
| 40-03-03 | 03 | 3 | CARRY-09 | unit | `npm test -- --testPathPattern=payroll` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/morgan/__tests__/payroll-net.test.js` — net formula tests (NET-01)
- [ ] `apps/morgan/__tests__/payroll-carryover.test.js` — carryover logic tests (CARRY-02 through CARRY-06, CARRY-09)
- [ ] `apps/morgan/__tests__/payroll-approval.test.js` — approval logic tests (FIX-06)

*Existing jest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Print pills left of commission | FIX-07 | Visual layout verification | Open print view, verify Approved/Half pills appear left of $ amount |
| Approved pill in print view | FIX-08 | Visual rendering | Approve a half-commission deal, open print, verify green "Approved" pill |
| Hold Payout label display | CARRY-07 | UI label rendering | Lock period with fronted, check next period bonus shows "Hold Payout" |
| Zero-sale agent card | CARRY-08 | UI rendering | Create carryover for agent with no sales, verify card appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
