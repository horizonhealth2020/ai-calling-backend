---
phase: 12
slug: chargeback-parser
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (root only) + manual smoke tests |
| **Config file** | `jest.config.js` (root — covers Morgan service only) |
| **Quick run command** | `cd apps/cs-dashboard && npx next build` |
| **Full suite command** | `npm test` + manual paste-submit walkthrough |
| **Estimated runtime** | ~45 seconds (build) + ~2 min (manual) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/cs-dashboard && npx next build`
- **After every plan wave:** Full manual walkthrough: paste → preview → edit → submit → verify DB + weekly ticker
- **Before `/gsd:verify-work`:** All 6 CHBK requirements verified manually with sample data
- **Max feedback latency:** 45 seconds (build verification)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | SCHEMA | smoke | `npx prisma validate` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | API | smoke | `npx tsc --noEmit -p apps/ops-api/tsconfig.json` | ✅ | ⬜ pending |
| 12-02-01 | 02 | 2 | CHBK-01 | manual-only | Paste sample data, verify parsed fields | N/A | ⬜ pending |
| 12-02-02 | 02 | 2 | CHBK-02 | manual-only | Verify ($582.00) displays as -582.00 | N/A | ⬜ pending |
| 12-02-03 | 02 | 2 | CHBK-03 | smoke | `cd apps/cs-dashboard && npx next build` | ❌ W0 | ⬜ pending |
| 12-02-04 | 02 | 2 | CHBK-04 | manual-only | Set date picker, override type, verify in preview | N/A | ⬜ pending |
| 12-02-05 | 02 | 2 | CHBK-05 | manual-only | Paste multi-row data, verify consolidation + batch_id | N/A | ⬜ pending |
| 12-02-06 | 02 | 2 | CHBK-06 | manual-only | Submit, verify DB record has raw_paste, submitted_by, submitted_at | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers build verification. No automated test infrastructure exists for cs-dashboard UI or chargeback API endpoints — the existing Jest setup only covers the root Morgan service. Parser logic is client-side in Next.js, verified by build success + manual smoke tests.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Parser extracts fields from pasted text | CHBK-01 | Client-side parsing in Next.js, no Jest in cs-dashboard | Paste sample from CONTEXT.md, verify all fields in preview table |
| Parenthesized dollar → negative decimal | CHBK-02 | Client-side logic | Paste ($582.00), verify shows -582.00 |
| Editable preview table renders | CHBK-03 | Visual UI verification | Paste data, click cells to edit, verify changes persist in preview |
| Date picker + type override | CHBK-04 | Interactive UI verification | Change date via picker, edit type field, verify before submit |
| Multi-row consolidation + batch_id | CHBK-05 | Consolidation logic visual check | Paste 2+ rows for same member, verify 1 consolidated row with summed totals |
| Records persist to DB | CHBK-06 | End-to-end flow | Submit, query chargeback_submissions table, verify raw_paste/submitted_by/submitted_at |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
