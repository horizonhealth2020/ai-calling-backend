---
phase: 39
slug: aca-product-configuration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 39 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | apps/morgan/jest.config.js (existing — Morgan tests only) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm run test:coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm run test:coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 39-01-01 | 01 | 1 | ACA-01 | grep | `grep -c "ACA_PL" apps/ops-api/src/routes/products.ts` | ✅ | ⬜ pending |
| 39-01-02 | 01 | 1 | ACA-01 | grep | `grep -c "flatCommission" apps/ops-api/src/routes/products.ts` | ✅ | ⬜ pending |
| 39-01-03 | 01 | 1 | ACA-01 | grep | `grep -c "ACA_PL" apps/ops-dashboard/app/\(dashboard\)/payroll/PayrollProducts.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or stubs needed — this phase modifies UI and API validation only, verifiable via grep and visual inspection.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ACA PL products appear as separate group in Products tab | ACA-01 | UI rendering requires browser | Navigate to Products tab, verify ACA PL group visible |
| Flat commission edit saves successfully | ACA-01 | API + UI integration | Edit flat commission on an ACA PL product, verify value persists after refresh |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
