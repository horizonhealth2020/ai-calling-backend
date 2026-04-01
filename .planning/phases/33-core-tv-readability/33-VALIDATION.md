---
phase: 33
slug: core-tv-readability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-31
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Next.js build + visual inspection |
| **Config file** | apps/sales-board/next.config.js |
| **Quick run command** | `npx next build apps/sales-board` |
| **Full suite command** | `npx next build apps/sales-board` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx next build apps/sales-board`
- **After every plan wave:** Run `npx next build apps/sales-board`
- **Before `/gsd:verify-work`:** Full build must pass
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 33-01-01 | 01 | 1 | TYPO-01, TYPO-03, SCAL-04 | build + grep | `npx next build apps/sales-board` | N/A | ⬜ pending |
| 33-01-02 | 01 | 1 | TYPO-05 | grep | `grep textSecondary apps/sales-board/app/page.tsx` | N/A | ⬜ pending |
| 33-01-03 | 01 | 1 | OVFL-01, OVFL-02 | grep | `grep textOverflow apps/sales-board/app/page.tsx` | N/A | ⬜ pending |
| 33-01-04 | 01 | 1 | TYPO-04 | grep | `grep "fontSize: 36" apps/sales-board/app/page.tsx` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements. No new test framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TV readability at 10-15ft | TYPO-01, TYPO-03, TYPO-04 | Requires physical TV viewing | Load sales board on 1080p TV, verify text legible from 10-15 feet |
| Cell dimensions unchanged | SCAL-04 | Visual comparison | Compare row heights before/after — should be visually identical |
| Name truncation | OVFL-01 | Requires long name in DB | Add agent with long first name, verify ellipsis appears |
| Premium overflow | OVFL-02 | Requires large premium value | Enter sale with $12,345+ premium, verify no cell overflow |

---

## Validation Sign-Off

- [ ] All tasks have automated build verification
- [ ] Sampling continuity: build runs after every task
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
