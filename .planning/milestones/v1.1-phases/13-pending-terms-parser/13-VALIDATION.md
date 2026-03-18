---
phase: 13
slug: pending-terms-parser
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 13 — Validation Strategy

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
- **After every plan wave:** Full manual walkthrough: paste → preview → edit → submit → verify DB
- **Before `/gsd:verify-work`:** All 6 TERM requirements verified manually with sample data
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 13-01-01 | 01 | 1 | SCHEMA | smoke | `npx prisma validate` | ✅ | ⬜ pending |
| 13-01-02 | 01 | 1 | API | smoke | `npx tsc --noEmit -p apps/ops-api/tsconfig.json` | ✅ | ⬜ pending |
| 13-02-01 | 02 | 2 | TERM-01 | manual-only | Paste sample data, verify parsed fields | N/A | ⬜ pending |
| 13-02-02 | 02 | 2 | TERM-02 | manual-only | Verify holdDate as DATE, holdReason as TEXT | N/A | ⬜ pending |
| 13-02-03 | 02 | 2 | TERM-03 | smoke | `cd apps/cs-dashboard && npx next build` | ❌ W0 | ⬜ pending |
| 13-02-04 | 02 | 2 | TERM-04 | manual-only | Paste multi-record data, verify consolidation + batch_id | N/A | ⬜ pending |
| 13-02-05 | 02 | 2 | TERM-05 | manual-only | Submit, verify DB record has raw_paste, submitted_by, submitted_at | N/A | ⬜ pending |
| 13-02-06 | 02 | 2 | TERM-06 | manual-only | Paste malformed data, verify null storage | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers build verification. No automated test infrastructure for cs-dashboard UI or pending terms API endpoints. Same justification as Phase 12.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Parser extracts fields from 3-line records | TERM-01 | Client-side parsing in Next.js | Paste sample from CONTEXT.md, verify all fields in preview |
| holdDate as DATE, holdReason as TEXT | TERM-02 | Schema/DB verification | Submit, query pending_terms table, verify column types |
| Editable preview table renders | TERM-03 | Visual UI verification | Paste data, edit fields, verify changes persist in preview |
| Multi-record detection + batch_id | TERM-04 | Client-side logic | Paste 7-row sample, verify 3 consolidated members |
| Records persist to DB | TERM-05 | End-to-end flow | Submit, query pending_terms, verify raw_paste/submitted_by/submitted_at |
| Malformed fields → null | TERM-06 | Error handling | Paste incomplete data, verify null storage, no crash |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
