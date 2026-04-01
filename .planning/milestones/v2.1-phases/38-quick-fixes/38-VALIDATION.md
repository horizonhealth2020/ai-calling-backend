---
phase: 38
slug: quick-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `apps/morgan/jest.config.js` (existing Morgan tests) |
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
| 38-01-01 | 01 | 1 | FIX-01 | manual | Visual: set bonus/fronted/hold to 0, save | N/A | ⬜ pending |
| 38-01-02 | 01 | 1 | FIX-02 | manual | Visual: verify fronted shows positive dollar amount | N/A | ⬜ pending |
| 38-01-03 | 01 | 1 | FIX-03 | manual | Visual: print card has no Net column in rows | N/A | ⬜ pending |
| 38-01-04 | 01 | 1 | FIX-04 | manual | Visual: addon names display as badges without overflow | N/A | ⬜ pending |
| 38-01-05 | 01 | 1 | FIX-05 | manual | Visual: half-commission shows Approved pill or halving reason | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. All fixes are UI display changes in a single component file — verification is visual/manual.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Zero-value inputs save | FIX-01 | HTML input attribute + form submit behavior | Set bonus, fronted, hold to 0 → save → no validation error |
| Fronted positive display | FIX-02 | Visual CSS/formatting check | Open pay card with fronted amount → shows "$200.00" not "-$200.00" |
| Net column removed from print rows | FIX-03 | Print template literal HTML | Click print → sale rows have no Net column, subtotal row still has Net |
| Addon badge layout on print | FIX-04 | Print template literal HTML | Click print → addons show as side-by-side blocks with name above premium |
| Half-commission indicators on print | FIX-05 | Print template literal HTML | Click print → approved shows green pill, unapproved shows orange reason |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
