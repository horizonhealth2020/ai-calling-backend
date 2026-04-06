---
phase: 44
slug: chargeback-batch-review
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js |
| **Quick run command** | `npm test -- --testPathPattern="chargebacks"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="chargebacks"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 44-01-01 | 01 | 1 | CB-01 | — | N/A | integration | `npm test -- --testPathPattern="chargebacks"` | ❌ W0 | ⬜ pending |
| 44-01-02 | 01 | 1 | CB-02, CB-03 | T-44-01 | Preview returns match data without DB writes | integration | `npm test -- --testPathPattern="chargebacks"` | ❌ W0 | ⬜ pending |
| 44-02-01 | 02 | 1 | CB-04, CB-05 | — | N/A | manual | Browser check | N/A | ⬜ pending |
| 44-02-02 | 02 | 1 | CB-06 | — | N/A | manual | Browser check | N/A | ⬜ pending |
| 44-02-03 | 02 | 1 | CB-07, CB-08 | — | N/A | manual | Browser check | N/A | ⬜ pending |
| 44-02-04 | 02 | 1 | CB-09 | T-44-02 | Batch submit validates all entries before DB commit | integration | `npm test -- --testPathPattern="chargebacks"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/chargebacks-preview.test.js` — stubs for CB-01, CB-02, CB-03 (preview endpoint)
- [ ] `__tests__/chargebacks-batch.test.js` — stubs for CB-09 (batch submit with clawbacks)

*Existing test infrastructure (jest.config.js, test helpers) already in place.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Review table renders parsed rows with match badges | CB-04, CB-05 | React UI rendering | Paste test data, verify table shows all rows with correct badges |
| Summary bar shows colored count badges | CB-06 | React UI rendering | Verify badge counts match parsed entries by status |
| Product checkboxes auto-recalculate amount | CB-07, CB-08 | Interactive UI state | Toggle product checkboxes, verify amount updates |
| Row removal with undo toast | CB-04 | Toast + undo interaction | Click X, verify toast appears, click undo, verify row restored |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
