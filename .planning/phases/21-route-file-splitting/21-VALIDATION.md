---
phase: 21
slug: route-file-splitting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | `apps/ops-api/jest.config.ts` |
| **Quick run command** | `npx jest --config apps/ops-api/jest.config.ts` |
| **Full suite command** | `npx jest --config apps/ops-api/jest.config.ts` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --config apps/ops-api/jest.config.ts`
- **After every plan wave:** Run `npx jest --config apps/ops-api/jest.config.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | SPLIT-01 | unit | `npx jest --config apps/ops-api/jest.config.ts` | ✅ | ⬜ pending |
| 21-01-02 | 01 | 1 | SPLIT-02 | unit | `npx jest --config apps/ops-api/jest.config.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. The 6 existing test files test service functions directly and will verify zero behavior change.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All API endpoints return identical responses | SPLIT-02 | No integration tests for HTTP endpoints | Compare curl responses before/after split on a running server |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
