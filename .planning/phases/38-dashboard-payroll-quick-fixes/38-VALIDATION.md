---
phase: 38
slug: dashboard-payroll-quick-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm run test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | DASH-01 | integration | `npm test -- call-audits` | ❌ W0 | ⬜ pending |
| 38-01-02 | 01 | 1 | DASH-02 | integration | `npm test -- call-audits` | ❌ W0 | ⬜ pending |
| 38-02-01 | 02 | 1 | PAY-04 | unit | `npm test -- ManagerEntry` | ❌ W0 | ⬜ pending |
| 38-03-01 | 03 | 1 | DASH-04 | unit | `npm test -- lead-timing` | ❌ W0 | ⬜ pending |
| 38-04-01 | 04 | 1 | DASH-03 | manual | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for audit rolling window (DASH-01, DASH-02)
- [ ] Test stubs for enrollment fee $0 parsing (PAY-04)
- [ ] Test stubs for sparkline date normalization (DASH-04)

*Existing jest infrastructure covers framework needs — only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Analytics section visible on page load | DASH-03 | Visual UI state — useState default change | Load manager dashboard, verify lead source and timing sections are expanded without clicking |
| IntersectionObserver lazy load | DASH-03 | Browser scroll behavior | Scroll analytics section into view, verify network tab shows API call only on scroll |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
