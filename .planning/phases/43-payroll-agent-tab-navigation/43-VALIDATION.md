---
phase: 43
slug: payroll-agent-tab-navigation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (Morgan service only — no frontend tests exist) |
| **Config file** | `jest.config.js` at root |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Visual verification in dev server (`npm run dashboard:dev`)
- **After every plan wave:** Full manual walkthrough of all 6 requirements
- **Before `/gsd-verify-work`:** All 6 requirements verified visually
- **Max feedback latency:** 30 seconds (dev server hot reload)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-01-01 | 01 | 1 | PAY-01 | — | N/A | manual-only | Visual: sidebar shows agents alphabetically with earnings | N/A | ⬜ pending |
| 43-01-02 | 01 | 1 | PAY-06 | — | N/A | manual-only | Visual: search input filters agents by name | N/A | ⬜ pending |
| 43-01-03 | 01 | 1 | PAY-05 | — | N/A | manual-only | Visual: paid/unpaid/partial badges in sidebar | N/A | ⬜ pending |
| 43-01-04 | 01 | 1 | PAY-02 | — | N/A | manual-only | Visual: clicking agent shows periods in content area | N/A | ⬜ pending |
| 43-01-05 | 01 | 1 | PAY-03 | — | N/A | manual-only | Visual: only last 4 periods shown by default | N/A | ⬜ pending |
| 43-01-06 | 01 | 1 | PAY-04 | — | N/A | manual-only | Visual: Load More reveals older periods | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This is a pure UI refactor with no existing frontend test infrastructure. All verification is manual/visual.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar lists all agents alphabetically with earnings | PAY-01 | Pure visual UI — no frontend test framework | Open Payroll Periods tab, verify sidebar appears with agent list sorted A-Z |
| Agent click loads pay periods | PAY-02 | User interaction — no test framework | Click agent name in sidebar, verify content area shows their periods |
| Last 4 periods shown by default | PAY-03 | Visual count verification | Select an agent with >4 periods, verify only 4 show initially |
| Load More reveals older periods | PAY-04 | User interaction + visual | Click "Load More" button, verify additional periods appear |
| Status badges in sidebar | PAY-05 | Visual styling verification | Check each agent has correct paid/unpaid/partial badge color |
| Search filters agents | PAY-06 | User interaction | Type agent name in search input, verify list filters in real-time |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
