---
phase: 25
slug: file-structure-cleanup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x |
| **Config file** | `apps/morgan/jest.config.js` (after relocation) |
| **Quick run command** | `npx jest --config apps/morgan/jest.config.js --passWithNoTests` |
| **Full suite command** | `npx jest --config apps/morgan/jest.config.js` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | FS-01 | integration | `npx jest --config apps/morgan/jest.config.js` | yes (moved) | pending |
| 25-01-02 | 01 | 1 | FS-01 | manual | Verify `railway.toml` paths updated | N/A | pending |
| 25-02-01 | 02 | 2 | FS-02 | shell | `test ! -d apps/payroll-dashboard` | N/A | pending |
| 25-02-02 | 02 | 2 | FS-03 | shell | `ls -1 *.js 2>/dev/null` at root returns empty | N/A | pending |
| 25-03-01 | 03 | 2 | FS-04 | shell | `test ! -f FIXES.md && test ! -f ISSUES.md && test ! -f TESTING.md` | N/A | pending |

*Status: pending*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework or stubs needed — Morgan's existing Jest tests validate the relocation worked.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway deployment path | FS-01 | Railway UI config not testable locally | Check railway.toml start script points to apps/morgan/index.js |
| No root JS orphans | FS-03 | Filesystem state check | Run `ls *.js` at repo root — should return nothing |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
