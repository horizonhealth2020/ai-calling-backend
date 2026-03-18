---
phase: 18
slug: platform-polish-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `jest.config.js` (root — Morgan service only) |
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
| 18-01-01 | 01 | 1 | EXPORT-01 | integration | `curl localhost:8080/api/sales/export?startDate=...&endDate=...` | ❌ W0 | ⬜ pending |
| 18-01-02 | 01 | 1 | EXPORT-02 | integration | `curl localhost:8080/api/payroll/export?startDate=...&endDate=...` | ❌ W0 | ⬜ pending |
| 18-01-03 | 01 | 1 | EXPORT-03 | unit | `grep -q "DateRangeFilter" apps/*/app/**/*.tsx` | ❌ W0 | ⬜ pending |
| 18-02-01 | 02 | 1 | PAY-01 | integration | `curl localhost:8080/api/payroll/alerts` | ❌ W0 | ⬜ pending |
| 18-02-02 | 02 | 1 | PAY-02 | manual | Socket.IO event verification | ❌ W0 | ⬜ pending |
| 18-03-01 | 03 | 2 | AI-01 | integration | `curl localhost:8080/api/ai/prompt` | ❌ W0 | ⬜ pending |
| 18-03-02 | 03 | 2 | AI-02 | integration | `curl localhost:8080/api/ai/score` | ❌ W0 | ⬜ pending |
| 18-03-03 | 03 | 2 | AI-03 | unit | Budget cap config read | ❌ W0 | ⬜ pending |
| 18-04-01 | 04 | 2 | MGR-01 | integration | `curl localhost:8080/api/agents/kpis` | ❌ W0 | ⬜ pending |
| 18-04-02 | 04 | 2 | CS-01 | integration | `curl localhost:8080/api/cs/reps` | ❌ W0 | ⬜ pending |
| 18-05-01 | 05 | 3 | REP-01 | manual | Paste-to-parse sale entry | N/A | ⬜ pending |
| 18-05-02 | 05 | 3 | PAY-03 | manual | Toggle paid/unpaid both directions | N/A | ⬜ pending |
| 18-05-03 | 05 | 3 | MGR-05 | unit | `grep -q "+10" apps/manager-dashboard/` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing Jest infrastructure covers root Morgan service only — ops-api routes need manual curl verification
- [ ] No additional test framework installation needed — existing `npm test` sufficient for unit tests

*Existing infrastructure covers unit tests. Integration verification via curl commands and manual UI checks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Socket.IO real-time alerts | PAY-02 | WebSocket events require browser client | Open payroll dashboard, create chargeback, verify alert appears without refresh |
| Paste-to-parse sale entry | REP-01 | Clipboard API + form population | Copy sale text, paste into sale form, verify fields auto-populate |
| Payroll paid/unpaid toggle | PAY-03 | UI state + API round-trip | Mark period paid, then mark unpaid, verify both transitions work |
| DateRangeFilter UX across dashboards | EXPORT-03 | Cross-dashboard visual consistency | Open each of 6 dashboards, verify date picker renders and filters export |
| +10 enrollment indicator | MGR-05 | Visual badge rendering | Create sale with enrollment fee > qualifying threshold, verify badge shows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
