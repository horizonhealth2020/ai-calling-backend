---
phase: 22
slug: owner-payroll-enhancements
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 22 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | apps/ops-api/jest.config.ts |
| **Quick run command** | `npx jest --config apps/ops-api/jest.config.ts --no-cache` |
| **Full suite command** | `npx jest --config apps/ops-api/jest.config.ts --no-cache` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit -p apps/ops-api/tsconfig.json` (type check)
- **After every plan wave:** Run `npx jest --config apps/ops-api/jest.config.ts --no-cache`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 22-01-01 | 01 | 1 | OWNER-01 | integration | `npx tsc --noEmit -p apps/ops-api/tsconfig.json` | ✅ | ⬜ pending |
| 22-01-02 | 01 | 1 | OWNER-02 | manual | Socket.IO browser test | N/A | ⬜ pending |
| 22-02-01 | 02 | 1 | EXPORT-01, EXPORT-02 | manual | CSV download + visual inspection | N/A | ⬜ pending |
| 22-02-02 | 02 | 1 | EXPORT-03 | manual | Large dataset export test | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CS payroll column displays in owner period summary | OWNER-01 | UI rendering | Load owner dashboard, check period summary table has CS Payroll column with correct totals |
| Socket.IO real-time update of CS payroll | OWNER-02 | Real-time browser event | Create/update service payroll entry, verify owner dashboard column updates without refresh |
| Print card CSV agent-first grouping | EXPORT-01, EXPORT-02 | CSV content layout | Export detailed CSV, verify agents alphabetical with weekly pay cards per agent |
| Large export performance | EXPORT-03 | Performance | Export 1-month period with many entries, verify no browser hang |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
