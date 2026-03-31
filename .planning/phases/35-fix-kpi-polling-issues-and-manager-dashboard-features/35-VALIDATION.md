---
phase: 35
slug: fix-kpi-polling-issues-and-manager-dashboard-features
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (Morgan service only — ops-api and ops-dashboard have no test infra) |
| **Config file** | `apps/morgan/jest.config.js` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Manual browser verification (no automated tests for ops-api/ops-dashboard)
- **After every plan wave:** Full ops-dashboard build (`npm run dashboard:dev`) + visual check
- **Before `/gsd:verify-work`:** All 6 behaviors visually verified
- **Max feedback latency:** 30 seconds (build + reload)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 35-01-01 | 01 | 1 | D-01 | manual | Verify poller log shows `America/New_York` | N/A | ⬜ pending |
| 35-01-02 | 01 | 1 | D-02 | manual | Verify `convosoDateToUTC` unchanged | N/A | ⬜ pending |
| 35-02-01 | 02 | 1 | D-04 | manual | Visual: DateRangeFilter shows Today as first preset | N/A | ⬜ pending |
| 35-02-02 | 02 | 1 | D-05 | manual | Visual: Selecting Today loads current day data | N/A | ⬜ pending |
| 35-03-01 | 03 | 1 | D-06 | manual | Visual: Manager Tracker has no Today column | N/A | ⬜ pending |
| 35-03-02 | 03 | 1 | D-07 | manual | CSV export lacks todaySalesCount/todayPremium headers | N/A | ⬜ pending |
| 35-04-01 | 04 | 1 | D-08 | manual | Visual: OwnerKPIs loads with Today selected | N/A | ⬜ pending |
| 35-05-01 | 05 | 2 | D-09/D-10 | manual | Switch tabs, verify range resets to dashboard default | N/A | ⬜ pending |
| 35-06-01 | 06 | 2 | D-11 | manual | Submit multiple batches, verify even distribution | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework needed — ops-api and ops-dashboard lack test infra and adding it is out of scope for this bug-fix phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Poller uses Eastern timezone | D-01 | No ops-api test infra | Check poller logs after restart — currentTime should show Eastern |
| Today preset appears first | D-04 | UI visual check | Open any dashboard, verify DateRangeFilter shows Today first |
| Today column removed | D-06 | UI visual check | Open Manager Tracker, verify no Today column in table or CSV |
| OwnerKPIs defaults to Today | D-08 | UI visual check | Navigate to Owner KPIs, verify Today is selected on load |
| Date range scoped per tab | D-09/D-10 | Cross-tab interaction | Set Custom range on Manager, switch to Owner, verify Owner shows its default |
| Round robin fairness | D-11 | Requires multi-submission test | Submit 6+ items to round robin, verify even distribution across reps |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: visual check after each task commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
