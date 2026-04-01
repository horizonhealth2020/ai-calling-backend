---
phase: 31
slug: auth-stability-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual-only (no test infra for ops-dashboard) |
| **Config file** | N/A — Jest configured for apps/morgan only |
| **Quick run command** | Manual browser test with expired token |
| **Full suite command** | Full manual protocol (8-step sequence) |
| **Estimated runtime** | ~120 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Manual browser test with expired token (steps 2-4)
- **After every plan wave:** Full 8-step manual protocol
- **Before `/gsd:verify-work`:** All 4 success criteria verified manually
- **Max feedback latency:** ~120 seconds (manual)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 31-01-01 | 01 | 1 | AUTH-01 | manual | N/A — Edge Runtime middleware | N/A | ⬜ pending |
| 31-01-02 | 01 | 1 | AUTH-02 | manual | N/A — Edge Runtime middleware | N/A | ⬜ pending |
| 31-01-03 | 01 | 1 | AUTH-03 | manual | N/A — React component + localStorage | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure does not cover ops-dashboard. Setting up test infra is out of scope for a 2-file bug fix. Manual testing is sufficient for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Middleware rejects expired JWT before role check | AUTH-01 | Edge Runtime middleware cannot be unit tested without Next.js test harness | 1. Log in, 2. Edit JWT exp to past in DevTools, 3. Navigate to /manager, 4. Verify redirect to / once (no loop) |
| Middleware deletes ops_session cookie on expired redirect | AUTH-02 | Same as above — cookie deletion requires middleware execution context | 5. Check Application > Cookies, verify ops_session is gone |
| Login page clears expired localStorage token before redirect | AUTH-03 | React component with browser APIs (localStorage, window.location) requires JSDOM + component testing | 6. Check Application > Local Storage, verify ops_session_token is gone, 7. Verify login form renders without flash |

---

## Validation Sign-Off

- [x] All tasks have manual verify protocol defined
- [x] Sampling continuity: manual test after each commit
- [x] Wave 0: N/A — no automated test infra in scope
- [x] No watch-mode flags
- [ ] Feedback latency < 120s (manual)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
