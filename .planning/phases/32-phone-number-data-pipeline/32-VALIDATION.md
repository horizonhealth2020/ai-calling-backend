---
phase: 32
slug: phone-number-data-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (existing) |
| **Config file** | `apps/morgan/jest.config.js` |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 32-01-01 | 01 | 1 | PHONE-01, PHONE-02 | migration | `npm run db:migrate` | N/A | ⬜ pending |
| 32-01-02 | 01 | 1 | PHONE-03 | grep | `grep "leadPhone\|phone_number" apps/ops-api/src/workers/convosoKpiPoller.ts` | N/A | ⬜ pending |
| 32-02-01 | 02 | 1 | PHONE-04 | grep | `grep "leadPhone" apps/ops-api/src/routes/call-audits.ts` | N/A | ⬜ pending |
| 32-02-02 | 02 | 1 | PHONE-06 | grep | `grep "leadPhone" apps/ops-api/src/routes/sales.ts` | N/A | ⬜ pending |
| 32-03-01 | 03 | 2 | PHONE-05 | grep | `grep "Phone" apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx` | N/A | ⬜ pending |
| 32-03-02 | 03 | 2 | PHONE-07 | grep | `grep "Phone" apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` | N/A | ⬜ pending |

*Status: ⬜ pending*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No new test framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phone column visible in ManagerAudits | PHONE-05 | UI rendering | Run dashboard, check Manager > Audits table |
| Phone column visible in ManagerSales | PHONE-07 | UI rendering | Run dashboard, check Manager > Sales table |
| Convoso poller captures phone | PHONE-03 | External API dependency | Wait for poll cycle, check DB record |
| Formatted phone input works | PHONE-06 | Form interaction | Create/edit sale with phone number |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
