---
phase: 6
slug: dashboard-cascade
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-16
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (existing) |
| **Config file** | `apps/ops-api/jest.config.ts` and root `jest.config.js` |
| **Quick run command** | `npm test -- --testPathPattern socket` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern socket`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | CASC-01..04 | unit | `npm test -- socket` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | CASC-01 | manual-only | N/A | N/A | ⬜ pending |
| 06-02-02 | 02 | 1 | CASC-02 | manual-only | N/A | N/A | ⬜ pending |
| 06-02-03 | 02 | 1 | CASC-03 | manual-only | N/A | N/A | ⬜ pending |
| 06-02-04 | 02 | 1 | CASC-04 | manual-only | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/socket/src/index.ts` — shared `useSocket` hook and typed event interfaces
- [ ] `packages/socket/package.json` — new @ops/socket shared package
- [ ] `socket.io-client` dependency in sales-board, payroll-dashboard, owner-dashboard
- [ ] `@ops/socket` added to `transpilePackages` in all four dashboard next.config.js files
- [ ] `@ops/socket` workspace entry in root `package.json`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Manager tracker updates on sale:changed | CASC-01 | Requires browser with Socket.IO connection | Open manager dashboard, submit sale, verify agent tracker updates without refresh |
| Sales board updates on sale:changed | CASC-02 | Requires browser with Socket.IO connection | Open sales board, submit sale on manager, verify leaderboard updates without refresh |
| Payroll card updates on sale:changed | CASC-03 | Requires browser with Socket.IO connection | Open payroll dashboard, submit sale on manager, verify correct agent card updates without refresh |
| Owner KPIs update on sale:changed | CASC-04 | Requires browser with Socket.IO connection | Open owner dashboard, submit sale on manager, verify KPI metrics update without refresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
