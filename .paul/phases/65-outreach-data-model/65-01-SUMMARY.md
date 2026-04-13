---
phase: 65-outreach-data-model
plan: 01
subsystem: api, database
tags: [prisma, express, zod, contact-attempts, resolution-gate]

requires:
  - phase: 64-polish-exports
    provides: stable CS dashboard with chargeback/pending-term resolve endpoints
provides:
  - ContactAttempt Prisma model with polymorphic FK
  - POST/GET /api/contact-attempts endpoints
  - Resolution gate on chargeback and pending-term resolve endpoints
  - no_contact resolution type on both resolve endpoints
affects: [66-outreach-logging-ui, 67-stale-alerts, 68-cs-analytics]

tech-stack:
  added: []
  patterns: [polymorphic-fk-validation, resolution-gate-pattern, pre-v2.9-bypass]

key-files:
  created:
    - apps/ops-api/src/routes/contact-attempts.ts
    - prisma/migrations/20260413000001_add_contact_attempts/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-api/src/routes/pending-terms.ts
    - apps/ops-api/src/routes/index.ts

key-decisions:
  - "Polymorphic FK with app-level exactly-one validation (not DB CHECK constraint)"
  - "Pre-v2.9 bypass: 0 total attempts skips gate (never entered outreach workflow)"
  - "Gate counts only CALL type toward 3-attempt threshold"
  - "Migration created manually (remote DB unreachable from dev) — run on deploy"

patterns-established:
  - "Resolution gate pattern: count attempts before allowing close/cancel resolution"
  - "Polymorphic FK validation: hasCb === hasPt check for exactly-one enforcement"

duration: ~15min
completed: 2026-04-13T00:00:00Z
---

# Phase 65 Plan 01: Outreach Data Model Summary

**ContactAttempt model with polymorphic FK, CRUD API, and 3-call resolution gate on chargeback/pending-term resolve endpoints**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~15min |
| Completed | 2026-04-13 |
| Tasks | 2 completed |
| Files modified | 6 |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: ContactAttempt model created | Pass | All columns, FKs, reverse relations |
| AC-1b: Polymorphic FK validation | Pass | Both/neither FK returns 400 with exact message |
| AC-2: Create contact attempt endpoint | Pass | POST with auto-calc attemptNumber |
| AC-3: Attempt number auto-increments per type | Pass | Counts same type only |
| AC-4: List attempts for a record | Pass | Ordered by createdAt asc, includes agent name |
| AC-5: Resolution gate blocks < 3 calls | Pass | chargebacks: closed/no_contact gated |
| AC-6: saved/recovered bypasses gate | Pass | Not in gate condition |
| AC-7: Pre-v2.9 records skip gate | Pass | 0 total attempts = skip |
| AC-8: Gate rejection audit-logged | Pass | RESOLUTION_GATE_BLOCKED action |
| AC-9: no_contact resolution type added | Pass | Both resolve enums expanded |

## Accomplishments

- ContactAttempt table with polymorphic FK to ChargebackSubmission and PendingTerm
- Contact attempt CRUD API with role-based access (CS, SUPER_ADMIN, OWNER_VIEW)
- Resolution gate enforcing 3 CALL attempts before closing/cancelling records
- Backward-compatible: pre-v2.9 records bypass gate, existing resolution types preserved

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modified | Added ContactAttempt model + reverse relations |
| `prisma/migrations/20260413000001_add_contact_attempts/migration.sql` | Created | Migration SQL for contact_attempts table |
| `apps/ops-api/src/routes/contact-attempts.ts` | Created | POST + GET /api/contact-attempts endpoints |
| `apps/ops-api/src/routes/chargebacks.ts` | Modified | Added no_contact to enum, resolution gate |
| `apps/ops-api/src/routes/pending-terms.ts` | Modified | Added no_contact to enum, resolution gate |
| `apps/ops-api/src/routes/index.ts` | Modified | Registered contact-attempts route |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| App-level FK validation, not DB CHECK | Prisma doesn't support CHECK constraints declaratively; app validation gives better error messages | Phase 66 UI can rely on consistent 400 errors |
| Pre-v2.9 bypass via total attempt count | Records that never entered outreach workflow shouldn't be blocked by gate | Existing resolved records unaffected |
| Manual migration SQL | Remote DB unreachable from dev environment | Must run `prisma migrate deploy` on deployment |
| Separate route file for contact-attempts | Clean separation; endpoints shared across chargeback/pending-term domains | Route registered in index.ts |

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Remote DB unreachable for `prisma migrate dev` | Created migration SQL manually; schema validates and client generates cleanly |

## Next Phase Readiness

**Ready:**
- ContactAttempt API ready for Phase 66 (Outreach Logging UI) to build buttons and timeline
- Resolution gate enforced server-side — UI just needs to display attempt count and gate status
- Agent name included in GET response for timeline display

**Concerns:**
- Migration not yet applied to production DB — must deploy before Phase 66 UI work

**Blockers:**
- None

---
*Phase: 65-outreach-data-model, Plan: 01*
*Completed: 2026-04-13*
