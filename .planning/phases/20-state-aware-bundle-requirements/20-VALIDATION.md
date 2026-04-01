---
phase: 20
slug: state-aware-bundle-requirements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `apps/ops-api/jest.config.js` |
| **Quick run command** | `npm test -- --testPathPattern="commission"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern="commission"`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | BUNDLE-01 | migration | `npx prisma migrate status` | ✅ | ⬜ pending |
| 20-02-01 | 02 | 1 | BUNDLE-02, BUNDLE-03, BUNDLE-04, BUNDLE-05 | unit | `npm test -- --testPathPattern="commission"` | ✅ | ⬜ pending |
| 20-02-02 | 02 | 1 | BUNDLE-07 | unit | `npm test -- --testPathPattern="commission"` | ✅ | ⬜ pending |
| 20-02-03 | 02 | 1 | BUNDLE-08 | unit | `npm test -- --testPathPattern="commission"` | ✅ | ⬜ pending |
| 20-03-01 | 03 | 2 | BUNDLE-06, CFG-01, CFG-02 | integration | `npm test -- --testPathPattern="routes"` | ❌ W0 | ⬜ pending |
| 20-04-01 | 04 | 2 | CFG-03 | manual | visual inspection | N/A | ⬜ pending |
| 20-05-01 | 05 | 3 | SALE-01 | manual | visual inspection | N/A | ⬜ pending |
| 20-06-01 | 06 | 3 | FIX-01, FIX-02 | unit | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing test infrastructure covers commission engine requirements
- New tests for bundle resolution will be added as part of commission engine plan

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CORE product cards show bundle requirement section | CFG-01, CFG-02 | React UI rendering | Open Products tab → edit CORE product → verify "Bundle Requirements" section with addon selectors |
| ADDON product cards show state availability | CFG-03 | React UI rendering | Open Products tab → edit ADDON product → verify state multi-select dropdown |
| Completeness indicator shows uncovered states | BUNDLE-06 | Visual indicator | Configure partial state coverage → verify indicator surfaces gaps |
| Sales entry includes state dropdown | SALE-01 | React UI rendering | Open sales entry form → verify US state dropdown populates memberState |
| Role selector delay is configurable | FIX-01 | UI timing behavior | Login → verify role selector stays expanded for configured delay |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
