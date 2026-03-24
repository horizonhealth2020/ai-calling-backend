---
phase: 24
slug: chargeback-automation-data-archival
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing) + TypeScript compilation |
| **Config file** | `jest.config.js` (root) + `apps/ops-api/tsconfig.json` |
| **Quick run command** | `cd apps/ops-api && npx tsc --noEmit` |
| **Full suite command** | `npm test && cd apps/ops-api && npx tsc --noEmit` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/ops-api && npx tsc --noEmit`
- **After every plan wave:** Run `npm test && cd apps/ops-api && npx tsc --noEmit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 24-01-01 | 01 | 1 | CLAWBACK-01, CLAWBACK-02, CLAWBACK-03 | integration | `cd apps/ops-api && npx tsc --noEmit` | ✅ | ⬜ pending |
| 24-01-02 | 01 | 1 | CLAWBACK-04, CLAWBACK-05 | integration | `cd apps/ops-api && npx tsc --noEmit` | ✅ | ⬜ pending |
| 24-02-01 | 02 | 1 | ARCHIVE-01, ARCHIVE-02 | integration | `cd apps/ops-api && npx tsc --noEmit` | ✅ | ⬜ pending |
| 24-02-02 | 02 | 1 | ARCHIVE-03, ARCHIVE-04 | integration | `cd apps/ops-api && npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — TypeScript compilation catches type errors, and existing Jest tests cover payroll/commission logic.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Unmatched chargeback visual flagging | CLAWBACK-04 | UI visual check | Submit chargeback without matching sale, verify yellow/red flag in tracking table |
| Archive stats display in Config tab | ARCHIVE-04 | UI visual check | Navigate to owner Config tab, verify row counts and archive/restore buttons render |
| Socket.IO clawback notification | CLAWBACK-05 | Requires WebSocket | Approve matched chargeback, verify payroll dashboard receives real-time update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
