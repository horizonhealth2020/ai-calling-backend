---
phase: 23
slug: ai-scoring-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | apps/ops-api/jest.config.ts |
| **Quick run command** | `npx tsc --noEmit -p apps/ops-api/tsconfig.json` |
| **Full suite command** | `npx jest --config apps/ops-api/jest.config.ts --no-cache` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit -p apps/ops-api/tsconfig.json`
- **After every plan wave:** Run `npx jest --config apps/ops-api/jest.config.ts --no-cache`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-01-01 | 01 | 1 | SCORE-01, SCORE-02, SCORE-03 | integration | `npx tsc --noEmit -p apps/ops-api/tsconfig.json` | ✅ | ⬜ pending |
| 23-01-02 | 01 | 1 | SCORE-01, SCORE-04 | manual | Browser test — scoring tab with StatCards + DateRangeFilter | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scoring tab renders with aggregate KPIs | SCORE-01 | UI rendering | Open owner dashboard, click Scoring tab, verify StatCards show avg score, total audits, distribution |
| Per-agent table sorts correctly | SCORE-02 | UI interaction | Click column headers, verify sort toggles asc/desc |
| Weekly trend data displays | SCORE-03 | UI rendering | Verify trend table shows weeks with delta values |
| DateRangeFilter filters all content | SCORE-04 | UI interaction | Change date range, verify all KPIs and tables update |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
