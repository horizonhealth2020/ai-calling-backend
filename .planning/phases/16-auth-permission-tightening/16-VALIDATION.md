---
phase: 16
slug: auth-permission-tightening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (no automated test framework for frontend role gating) |
| **Config file** | none |
| **Quick run command** | `npm run auth:dev && npm run cs:dev` |
| **Full suite command** | `npm test` (backend only — covers API role guards) |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Verify UI changes in browser with different role logins
- **After every plan wave:** Run `npm test` for backend regression
- **Before `/gsd:verify-work`:** Full manual role verification matrix
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | ROLE-04 | manual | Browser: login as SUPER_ADMIN, verify CS card on landing | N/A | ⬜ pending |
| 16-01-02 | 01 | 1 | ROLE-04 | manual | Browser: login as MANAGER, verify no Submissions tab | N/A | ⬜ pending |
| 16-01-03 | 01 | 1 | ROLE-04 | manual | Browser: login as CUSTOMER_SERVICE, verify Tracking only | N/A | ⬜ pending |
| 16-01-04 | 01 | 1 | ROLE-04 | grep | `grep -n "canManageCS" apps/cs-dashboard/app/page.tsx` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. Backend role guards already tested via existing Jest suite. Frontend changes are UI-only boolean logic — verified by grep and manual browser testing.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SUPER_ADMIN sees CS dashboard card | ROLE-04 | UI rendering depends on JWT roles | Login as SUPER_ADMIN, check auth-portal landing for CS card |
| Submissions tab hidden from MANAGER | ROLE-04 | Client-side tab rendering | Login as MANAGER, navigate to CS dashboard URL, verify only Tracking tab |
| Delete buttons hidden from MANAGER | ROLE-04 | Client-side button rendering | Login as MANAGER at CS dashboard, verify no delete buttons in tracking tables |
| CUSTOMER_SERVICE sees Tracking only | ROLE-04 | Regression check | Login as CUSTOMER_SERVICE, verify only Tracking tab, no delete/export |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
