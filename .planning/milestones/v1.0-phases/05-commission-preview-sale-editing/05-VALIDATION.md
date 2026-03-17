---
phase: 5
slug: commission-preview-sale-editing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest + ts-jest |
| **Config file** | `apps/ops-api/jest.config.ts` |
| **Quick run command** | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "preview\|sale-edit" -x` |
| **Full suite command** | `npx jest --config apps/ops-api/jest.config.ts` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --config apps/ops-api/jest.config.ts --testPathPattern "preview|sale-edit" -x`
- **After every plan wave:** Run `npx jest --config apps/ops-api/jest.config.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | SALE-05 | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern preview -t "returns correct commission"` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | SALE-05 | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern preview -t "matches actual"` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 1 | SALE-05 | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern preview -t "edge"` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | SALE-06 | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern sale-edit -t "creates request"` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | SALE-06 | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern sale-edit -t "direct edit"` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | SALE-06 | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern sale-edit -t "recalculation"` | ❌ W0 | ⬜ pending |
| 05-02-04 | 02 | 1 | SALE-06 | unit | `npx jest --config apps/ops-api/jest.config.ts --testPathPattern sale-edit -t "finalized"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/ops-api/src/services/__tests__/preview.test.ts` — stubs for SALE-05 (preview calculation accuracy)
- [ ] `apps/ops-api/src/services/__tests__/sale-edit.test.ts` — stubs for SALE-06 (edit workflow, approval, recalculation)
- [ ] Mock product data fixtures for preview tests (extend existing `__mocks__/ops-db.ts`)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live commission preview updates as user types | SALE-05 | Requires browser interaction with debounced input | 1. Open sales form, 2. Select product, 3. Type enrollment fee, 4. Verify preview updates within ~500ms |
| Shimmer/pulse animation on preview during load | SALE-05 | Visual CSS animation | 1. Open sales form, 2. Change product, 3. Verify shimmer appears while loading |
| Inline editing UX in agent sales tab | SALE-06 | Requires browser interaction | 1. Open manager dashboard, 2. Click edit on a sale, 3. Verify fields become editable inline |
| Old-vs-new diff display before edit submission | SALE-06 | Visual diff rendering | 1. Edit a sale, 2. Change premium, 3. Verify diff shows "Commission: $X → $Y" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
