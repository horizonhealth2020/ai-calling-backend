---
phase: 2
slug: commission-engine-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x with ts-jest |
| **Config file** | `apps/ops-api/jest.config.ts` (Wave 0 creates) |
| **Quick run command** | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern commission` |
| **Full suite command** | `npm test && npx jest --config apps/ops-api/jest.config.ts` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --config apps/ops-api/jest.config.ts --testPathPattern commission`
- **After every plan wave:** Run `npm test && npx jest --config apps/ops-api/jest.config.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | COMM-03 | unit | `npx jest --config apps/ops-api/jest.config.ts --testNamePattern "isBundleQualifier"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | COMM-01 | unit | `npx jest --config apps/ops-api/jest.config.ts --testNamePattern "full rate"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | COMM-02 | unit | `npx jest --config apps/ops-api/jest.config.ts --testNamePattern "half rate"` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | COMM-04 | unit | `npx jest --config apps/ops-api/jest.config.ts --testNamePattern "addon bundled"` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | COMM-05 | unit | `npx jest --config apps/ops-api/jest.config.ts --testNamePattern "standalone addon"` | ❌ W0 | ⬜ pending |
| 02-01-06 | 01 | 1 | COMM-06 | unit | `npx jest --config apps/ops-api/jest.config.ts --testNamePattern "AD.D standalone"` | ❌ W0 | ⬜ pending |
| 02-01-07 | 01 | 1 | COMM-07 | unit | `npx jest --config apps/ops-api/jest.config.ts --testNamePattern "AD.D bundled"` | ❌ W0 | ⬜ pending |
| 02-01-08 | 01 | 1 | COMM-11 | unit | `npx jest --config apps/ops-api/jest.config.ts --testNamePattern "rounding"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/ops-api/jest.config.ts` — TypeScript Jest config with ts-jest transform
- [ ] `apps/ops-api/src/services/__tests__/commission.test.ts` — stubs for COMM-01 through COMM-07, COMM-11
- [ ] `ts-jest` devDependency — if not already installed
- [ ] Test helpers for building mock Sale/Product/SaleAddon objects

*Root jest.config.js remains for Morgan voice tests; ops-api gets its own config.*

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
