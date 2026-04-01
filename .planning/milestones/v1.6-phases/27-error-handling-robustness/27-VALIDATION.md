---
phase: 27
slug: error-handling-robustness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (Morgan service only — ops-api has no test runner) |
| **Config file** | `apps/morgan/jest.config.js` (ops-api has no Jest config) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Code audit via grep patterns to confirm no raw access remains
- **After every plan wave:** `npm run build` in ops-api to confirm no TypeScript errors
- **Before `/gsd:verify-work`:** Full grep audit confirming zero raw `req.body./req.params./req.query.` access outside Zod-parsed contexts
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-01-XX | 01 | 1 | EH-01 | manual-only | `grep -rn "router\.\(get\|post\|put\|patch\|delete\)" apps/ops-api/src/routes/ \| grep -v asyncHandler` | N/A | ⬜ pending |
| 27-01-XX | 01 | 1 | EH-02 | manual-only | `grep -rn "req\.body\.\|req\.params\.\|req\.query\." apps/ops-api/src/routes/ \| grep -v "parsed\|schema"` | N/A | ⬜ pending |
| 27-02-XX | 02 | 1 | EH-03 | manual-only | `grep -rn "PrismaClient\|handlePrismaError\|503" apps/ops-api/src/` | N/A | ⬜ pending |
| 27-02-XX | 02 | 1 | EH-04 | manual-only | `grep -rn "try.*catch\|safeEmit" apps/ops-api/src/socket.ts apps/ops-api/src/index.ts` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. ops-api has no test runner — all validation is via code audit (grep patterns) and TypeScript compilation.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All async handlers wrapped | EH-01 | Structural code audit, not runtime behavior | Grep for `router.(get\|post\|put\|patch\|delete)` without `asyncHandler` — expect 0 matches |
| All inputs Zod-validated | EH-02 | Structural code audit | Grep for raw `req.body.`, `req.params.`, `req.query.` outside Zod-parsed contexts — expect 0 matches |
| DB errors return 503 | EH-03 | Requires integration test with DB connection drop — not practical | Review global error handler for Prisma error class detection and 503 response |
| Socket.IO handlers have try/catch | EH-04 | Structural code audit | Verify try/catch in socket.ts emit functions and index.ts handlers |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
