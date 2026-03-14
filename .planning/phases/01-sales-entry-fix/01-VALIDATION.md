---
phase: 1
slug: sales-entry-fix
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (root-level — covers Morgan service only; no ops-api test infra) |
| **Config file** | Root `package.json` (`"test": "jest"`) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (regression check — existing tests still pass)
- **After every plan wave:** Run `npm test` + manual verification of sale creation flow
- **Before `/gsd:verify-work`:** Full suite must be green + manual sale creation test
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | SALE-01 | integration | `npm test` | ✅ | ⬜ pending |
| TBD | 01 | 1 | SALE-01 | manual | Manual: create sale in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers regression checking. No new test files required for Phase 1 — the fix is verified by:*
1. *Existing Jest tests pass (no regressions)*
2. *Manual sale creation succeeds (no 500 error)*

*Setting up ops-api integration test infrastructure is valuable but better scoped as cross-cutting work, not Phase 1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sale creation completes without 500 | SALE-01 | No ops-api test infra; Next.js + Express E2E requires browser | 1. Open manager dashboard 2. Fill sale form 3. Submit 4. Verify success message appears |
| Sale appears in sales list | SALE-01 | Frontend rendering requires browser | 1. After successful creation 2. Verify new sale appears in list without page refresh |
| memberState persisted | SALE-01 | Requires running database | 1. Create sale with memberState="FL" 2. Query DB: `SELECT member_state FROM sales ORDER BY created_at DESC LIMIT 1` 3. Verify "FL" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
