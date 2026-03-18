---
phase: 14
slug: tracking-tables
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (existing Morgan service tests) |
| **Config file** | jest.config.js (root) |
| **Quick run command** | `npm test -- --bail` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --bail`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | TRKC-01 | manual | Visual: KPI bar renders 4 counters with correct colors | N/A | ⬜ pending |
| 14-01-02 | 01 | 1 | TRKC-02 | manual | Visual: chargeback_amount column renders in red | N/A | ⬜ pending |
| 14-01-03 | 01 | 1 | TRKC-03, TRKC-04 | manual | Visual: filter panel + search box filter chargeback rows | N/A | ⬜ pending |
| 14-01-04 | 01 | 1 | TRKC-05 | manual | Visual: column headers clickable, sort indicator visible | N/A | ⬜ pending |
| 14-01-05 | 01 | 1 | TRKC-06 | manual | Visual: export button visible only for owner/super_admin | N/A | ⬜ pending |
| 14-02-01 | 02 | 1 | TRKT-01 | manual | Visual: summary bar shows totals, hold_reason counts, urgent count | N/A | ⬜ pending |
| 14-02-02 | 02 | 1 | TRKT-02 | manual | Visual: color coding on next_billing, active, hold_date, hold_reason | N/A | ⬜ pending |
| 14-02-03 | 02 | 1 | TRKT-03 | manual | Visual: agent_name/agent_id NOT visible as columns | N/A | ⬜ pending |
| 14-02-04 | 02 | 1 | TRKT-04, TRKT-05 | manual | Visual: filter panel + search box filter pending terms rows | N/A | ⬜ pending |
| 14-02-05 | 02 | 1 | TRKT-06 | manual | Visual: group-by-agent with collapsible sections | N/A | ⬜ pending |
| 14-02-06 | 02 | 1 | TRKT-07 | manual | Visual: CSV export visible only for owner/super_admin | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This phase is entirely frontend UI work — validation is visual/manual via UAT.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| KPI counter animation | TRKC-01 | AnimatedNumber visual effect | Load tracking tab, verify counters animate on load |
| Chargeback amount red color | TRKC-02 | CSS visual property | Inspect chargeback_amount cells for red text |
| Filter panel collapse/expand | TRKC-03 | Interactive UI behavior | Click filter button, verify panel toggles |
| Search across both tables | TRKC-04, TRKT-05 | Cross-table search behavior | Type in search box, verify both tables filter |
| Column sort toggle | TRKC-05 | Interactive table behavior | Click column headers, verify sort direction changes |
| CSV export role gating | TRKC-06, TRKT-07 | Role-dependent visibility | Log in as customer_service vs owner, verify button presence |
| Pending terms color coding | TRKT-02 | CSS visual properties | Inspect cells for correct color per field type |
| Group-by-agent collapse | TRKT-06 | Interactive UI behavior | Click agent group headers, verify sections toggle |
| Hidden agent columns | TRKT-03 | Column absence verification | Verify agent_name and agent_id not in table headers |

---

## Validation Sign-Off

- [x] All tasks have manual verify (frontend-only phase)
- [x] Sampling continuity: visual verification after each commit
- [x] Wave 0 covers all MISSING references (N/A — no automated tests needed)
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
