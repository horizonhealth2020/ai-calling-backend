---
phase: 36
slug: fix-manager-sales-entry-parsing-error-and-payroll-ui-issues
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `jest.config.js` (root) |
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
| TBD | TBD | TBD | matchProduct fix | unit | `npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | payroll sort | manual | browser verify | N/A | ⬜ pending |
| TBD | TBD | TBD | ACA commission | unit | `npm test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | ACA UI form | manual | browser verify | N/A | ⬜ pending |
| TBD | TBD | TBD | ACA sales board exclusion | unit | `npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test stubs for matchProduct special character handling
- [ ] Test stubs for ACA flat commission calculation
- [ ] Test stubs for ACA sales board exclusion query

*Existing jest infrastructure covers framework needs. Only test files need to be created.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Payroll row sort stability | D-05/D-06 | UI render order | Open PayrollPeriods, edit an entry amount, verify row order does not change |
| ACA checkbox reveal | D-11 | UI interaction | Check "Include ACA Plan" checkbox, verify carrier + member count fields appear |
| ACA standalone form | D-11 | UI interaction | Expand ACA-Only Entry section, fill and submit, verify success toast |
| ACA badge in payroll | D-08 | UI display | Submit ACA entry, navigate to payroll, verify "ACA" badge and flat commission format |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
