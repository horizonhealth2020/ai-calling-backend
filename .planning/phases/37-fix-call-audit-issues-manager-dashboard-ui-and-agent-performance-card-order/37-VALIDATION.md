---
phase: 37
slug: fix-call-audit-issues-manager-dashboard-ui-and-agent-performance-card-order
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (Morgan tests) + manual API verification |
| **Config file** | `jest.config.js` (root) |
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
| 37-01-01 | 01 | 1 | D-01 | integration | `grep -q "recoverOrphanedAudits" apps/ops-api/src/services/auditQueue.ts` | ❌ W0 | ⬜ pending |
| 37-01-02 | 01 | 1 | D-02 | integration | `grep -q "retryFailedAudits" apps/ops-api/src/services/auditQueue.ts` | ❌ W0 | ⬜ pending |
| 37-01-03 | 01 | 1 | D-03 | manual | Review retry config values in auditQueue.ts | N/A | ⬜ pending |
| 37-01-04 | 01 | 1 | D-04 | integration | `grep -q "failureVector\|failure_vector\|failureReason" apps/ops-api/src/services/auditQueue.ts` | ❌ W0 | ⬜ pending |
| 37-02-01 | 02 | 2 | D-05 | manual | Verify timestamps visible in audit list UI | N/A | ⬜ pending |
| 37-02-02 | 02 | 2 | D-06 | manual | Verify default 24h view with most-recent-first ordering | N/A | ⬜ pending |
| 37-02-03 | 02 | 2 | D-07 | integration | `grep -q "cursor\|loadMore\|skip\|offset" apps/ops-api/src/routes/call-audits.ts` | ❌ W0 | ⬜ pending |
| 37-02-04 | 02 | 2 | D-08 | manual | Verify agent filter dropdown works in audit list | N/A | ⬜ pending |
| 37-03-01 | 03 | 1 | D-10,D-11 | integration | `grep -q "compositeScore\|composite_score" apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx` | ❌ W0 | ⬜ pending |
| 37-03-02 | 03 | 1 | D-12,D-13 | integration | `grep -q "costPerSale\|normali" apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. No new test framework or fixtures needed.
- Backend changes verified via grep + API smoke tests.
- Frontend changes verified via manual UI inspection + grep for expected patterns.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Audit timestamps display date AND time | D-05 | UI visual check | Open manager audits tab, confirm call_date shows "MM/DD HH:mm" format |
| Default 24h view loads correctly | D-06 | UI behavior | Load audits tab fresh, confirm only last 24h shown |
| Load more pagination works | D-07 | UI interaction | Click "Load more", confirm older audits append without lag |
| Agent filter filters correctly | D-08 | UI interaction | Select agent from dropdown, confirm list filters |
| Composite score ranking is correct | D-10-D-13 | Calculation logic | Compare card order against manual score calculation |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
