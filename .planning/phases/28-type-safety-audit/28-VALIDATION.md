---
phase: 28
slug: type-safety-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x (Morgan service) |
| **Config file** | `apps/morgan/jest.config.js` |
| **Quick run command** | `npx tsc --noEmit --project apps/ops-api/tsconfig.json` |
| **Full suite command** | `npx tsc --noEmit && npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** `npx tsc --noEmit --project apps/ops-api/tsconfig.json` to confirm no type errors introduced
- **After every plan wave:** `npx tsc --noEmit` (full monorepo) + `npm test` (Morgan tests)
- **Before `/gsd:verify-work`:** Zero `any` grep hits (excluding allowed exceptions) + full tsc clean + test suite green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 28-01-XX | 01 | 1 | TS-01 | grep + tsc | `grep -rn ": any\b\|as any" apps/ops-api/src --include="*.ts" --exclude-dir=__tests__ \| grep -v "err: any" \| wc -l` | N/A | ⬜ pending |
| 28-01-XX | 01 | 1 | TS-01 | grep + tsc | `grep -rn ": any\b\|as any" apps/ops-dashboard --include="*.ts" --include="*.tsx" \| wc -l` | N/A | ⬜ pending |
| 28-02-XX | 02 | 2 | TS-02 | manual | Compare route handler returns with dashboard inline types | N/A | ⬜ pending |
| 28-02-XX | 02 | 2 | TS-03 | grep | Check each package export for explicit return type annotation | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. Primary validation is grep-based `any` counting and TypeScript compilation, not new test files.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| API response shapes match dashboard types | TS-02 | Requires comparing route handler return values with dashboard inline type definitions | Review each route handler's response object fields against corresponding dashboard component's inline type alias |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
