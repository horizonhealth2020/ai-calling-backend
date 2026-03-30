---
phase: 30
slug: lead-source-timing-analytics
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (Morgan service tests) |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- --testPathPattern=commission` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=commission`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | COMM-01, COMM-02 | unit | `npm test -- --testPathPattern=commission` | ✅ | ⬜ pending |
| 30-01-02 | 01 | 1 | DATA-01, DATA-02 | manual | Browser DevTools + server logs | N/A | ⬜ pending |
| 30-02-01 | 02 | 1 | DATA-03 | manual | `prisma migrate deploy` succeeds | N/A | ⬜ pending |
| 30-02-02 | 02 | 1 | DATA-04, DATA-07, DATA-08 | manual | `curl /api/lead-timing/heatmap` returns JSON | N/A | ⬜ pending |
| 30-02-03 | 02 | 1 | DATA-05 | manual | `curl /api/lead-timing/sparklines` returns JSON | N/A | ⬜ pending |
| 30-02-04 | 02 | 1 | DATA-06 | manual | `curl /api/lead-timing/recommendation` returns JSON | N/A | ⬜ pending |
| 30-03-01 | 03 | 2 | HEAT-01, HEAT-02, HEAT-03, HEAT-04, HEAT-05 | manual | Visual inspection in browser | N/A | ⬜ pending |
| 30-03-02 | 03 | 2 | REC-01, REC-02, REC-03 | manual | Visual inspection in browser | N/A | ⬜ pending |
| 30-03-03 | 03 | 2 | SPARK-01, SPARK-02 | manual | Visual inspection + SVG element check | N/A | ⬜ pending |
| 30-04-01 | 04 | 3 | DASH-01, DASH-02, DASH-03 | manual | Visual inspection in browser | N/A | ⬜ pending |
| 30-04-02 | 04 | 3 | DASH-04, DASH-05 | manual | Owner dashboard visual inspection | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers commission test requirements. No new test framework needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Heatmap renders with correct colors | HEAT-01 | Visual CSS rendering | Load Performance Tracker, verify red-to-green gradient cells |
| Tooltip shows on hover | HEAT-04 | Browser interaction | Hover heatmap cell, verify tooltip with rate/count |
| Collapsible section toggle | DASH-03 | Browser interaction | Click section header, verify expand/collapse |
| Owner sees same analytics | DASH-04 | Role-gated access | Login as OWNER_VIEW, verify timing analytics visible |
| SVG sparklines render | SPARK-01 | Visual rendering | Verify inline SVG polyline elements in DOM |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
