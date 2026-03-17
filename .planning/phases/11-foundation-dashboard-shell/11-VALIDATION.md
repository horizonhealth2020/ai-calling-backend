---
phase: 11
slug: foundation-dashboard-shell
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-17
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 |
| **Config file** | root jest.config (default) + `apps/ops-api/jest.config.ts` |
| **Quick run command** | `npx next build` in cs-dashboard |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/cs-dashboard && npx next build`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green + `npx prisma migrate deploy` succeeds
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | SCHEMA-01 | manual-only | `npx prisma migrate deploy` + `npx prisma db pull` | N/A - migration SQL | ⬜ pending |
| 11-01-02 | 01 | 1 | SCHEMA-02 | manual-only | `npx prisma migrate deploy` + `npx prisma db pull` | N/A - migration SQL | ⬜ pending |
| 11-02-01 | 02 | 1 | ROLE-01 | smoke | `npx tsc --noEmit -p packages/types/tsconfig.json` | N/A | ⬜ pending |
| 11-03-01 | 03 | 2 | DASH-01 | smoke | `cd apps/cs-dashboard && npx next build` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2 | DASH-03 | smoke | `cd apps/auth-portal && npx next build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/cs-dashboard/` — entire app directory scaffolding
- [ ] `prisma/migrations/20260317_add_cs_tables/migration.sql` — migration SQL

*No unit tests needed for this phase — it's scaffolding + schema, verified by build and migration success.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| chargeback_submissions table created with correct columns | SCHEMA-01 | Schema DDL verified by migration success | Run `npx prisma migrate deploy`, verify no errors |
| pending_terms table created with correct columns | SCHEMA-02 | Schema DDL verified by migration success | Run `npx prisma migrate deploy`, verify no errors |
| CS user redirected to cs-dashboard after login | DASH-03 | Auth redirect flow requires browser | Log in as CUSTOMER_SERVICE user, verify redirect to localhost:3014 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
