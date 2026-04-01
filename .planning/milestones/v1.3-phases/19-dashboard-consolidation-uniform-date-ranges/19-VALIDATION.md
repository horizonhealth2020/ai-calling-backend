---
phase: 19
slug: dashboard-consolidation-uniform-date-ranges
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing root config) |
| **Config file** | `jest.config.js` (root) |
| **Quick run command** | `npm test -- --bail` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --bail`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 1 | SHELL-01 | integration | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 1 | SHELL-02 | integration | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 19-01-03 | 01 | 1 | SHELL-03 | integration | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 19-01-04 | 01 | 1 | SHELL-04 | integration | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 19-01-05 | 01 | 1 | SHELL-05 | integration | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 1 | MIG-01 | manual | visual inspection | N/A | ⬜ pending |
| 19-02-02 | 02 | 1 | MIG-02 | manual | visual inspection | N/A | ⬜ pending |
| 19-02-03 | 02 | 1 | MIG-03 | manual | visual inspection | N/A | ⬜ pending |
| 19-02-04 | 02 | 1 | MIG-04 | manual | visual inspection | N/A | ⬜ pending |
| 19-03-01 | 03 | 2 | DR-01 | unit | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 19-03-02 | 03 | 2 | DR-02 | unit | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 19-03-03 | 03 | 2 | DR-03 | unit | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 19-03-04 | 03 | 2 | DR-04 | unit | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 19-03-05 | 03 | 2 | DR-05 | unit | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 19-03-06 | 03 | 2 | DR-06 | unit | `npm test -- --bail` | ❌ W0 | ⬜ pending |
| 19-04-01 | 04 | 3 | DEPLOY-01 | manual | Docker build + run | N/A | ⬜ pending |
| 19-04-02 | 04 | 3 | DEPLOY-02 | manual | Docker build + run | N/A | ⬜ pending |
| 19-04-03 | 04 | 3 | DEPLOY-03 | manual | `rm -rf apps/auth-portal apps/cs-dashboard apps/owner-dashboard apps/payroll-dashboard apps/manager-dashboard && ls apps/` | N/A | ⬜ pending |
| 19-04-04 | 04 | 3 | DEPLOY-04 | manual | Browser test sales-board | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for SHELL-01 through SHELL-05 (role-gated tab rendering, auth redirect, default tab routing)
- [ ] Test stubs for DR-01 through DR-06 (DateRangeFilter presets, state persistence, KPI updates)
- [ ] Shared test fixtures for mock session user with different roles

*Existing jest infrastructure covers root Morgan service. New unified app tests will need setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tab switch preserves Socket.IO connection | SHELL-05 | Requires browser WebSocket inspection | Open DevTools Network WS tab, switch tabs, verify no disconnect frames |
| URL-based tab navigation with browser back/forward | SHELL-04 | Requires browser history API interaction | Navigate tabs, use back button, verify correct tab loads |
| Docker single container deployment | DEPLOY-01 | Requires Docker runtime | `docker-compose up`, verify single dashboard container |
| Old app directories removed | DEPLOY-03 | File system verification | `ls apps/` — should show only ops-api, sales-board, unified-dashboard |
| Sales board standalone functionality | DEPLOY-04 | End-to-end browser test | Navigate to sales-board URL, verify leaderboard loads |
| CS/Owner/Payroll/Manager tab parity | MIG-01-04 | Visual + functional comparison | Compare each tab against standalone app screenshots |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
