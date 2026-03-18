---
phase: 15
slug: resolution-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (root Morgan service only — no frontend/API tests) |
| **Config file** | `jest.config.js` (root) |
| **Quick run command** | `npm test -- --testPathPattern="helpers"` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Manual browser testing (no automated test infrastructure for frontend apps or ops-api)
- **After every plan wave:** Manual verification against success criteria
- **Before `/gsd:verify-work`:** All 7 success criteria verified manually
- **Max feedback latency:** N/A — manual verification

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | RESV-01, RESV-02 | manual-only | N/A | N/A | ⬜ pending |
| 15-01-02 | 01 | 1 | RESV-03, RESV-04 | manual-only | N/A | N/A | ⬜ pending |
| 15-01-03 | 01 | 1 | ROLE-02, ROLE-03, ROLE-04, DASH-02 | manual-only | N/A | N/A | ⬜ pending |
| 15-02-01 | 02 | 1 | DASH-05 | manual-only | N/A | N/A | ⬜ pending |
| 15-02-02 | 02 | 1 | DASH-04 | manual-only | N/A | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No automated test infrastructure exists for ops-api routes or frontend dashboard apps — this is consistent with Phases 11-14 validation approach.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Resolve action on chargeback record | RESV-01 | Frontend UI interaction, no component test infrastructure | Click Resolve button on chargeback row, enter note, select "Recovered", confirm resolution metadata appears |
| Resolve action on pending term record | RESV-02 | Frontend UI interaction | Click Resolve button on pending term row, enter note, select "Saved", confirm resolution metadata appears |
| Resolved record display | RESV-03 | Visual styling check | Verify dimmed row, Resolved badge, resolved_by name, resolved_at date, resolution note visible |
| Status pill toggle filtering | RESV-04 | Client-side state behavior | Toggle Open/Resolved/All pills, verify table contents change, verify KPI counters unchanged |
| CS role sees Tracking only | ROLE-02, DASH-02 | Auth flow requires real login | Log in as CUSTOMER_SERVICE user, verify only Tracking tab in sidebar |
| CS role blocked from submissions | ROLE-03 | API route protection | As CS user, attempt direct API call to POST /chargebacks — verify 403 |
| Owner/admin sees both tabs | ROLE-04 | Auth flow requires real login | Log in as OWNER_VIEW user, verify both Submissions and Tracking tabs visible |
| No page reload on filter change | DASH-04 | Runtime behavior check | Change filters/status pills, verify no full page reload (URL doesn't change, no loading flash) |
| Consistent date/dollar formatting | DASH-05 | Cross-dashboard visual audit | Check all 5 dashboards for M/D/YYYY dates and $X,XXX.XX dollar amounts |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < N/A (manual)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
