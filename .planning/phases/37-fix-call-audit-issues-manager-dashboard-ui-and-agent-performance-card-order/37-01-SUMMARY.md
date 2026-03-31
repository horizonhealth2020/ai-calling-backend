---
phase: 37-fix-call-audit-issues-manager-dashboard-ui-and-agent-performance-card-order
plan: 01
subsystem: api
tags: [prisma, audit-queue, retry, self-healing, exponential-backoff]

requires:
  - phase: 37-00
    provides: "auditQueue test infrastructure and test cases"
provides:
  - "ConvosoCallLog retryCount, lastFailedAt, failureReason fields"
  - "recoverOrphanedJobs() for startup orphan recovery"
  - "retryFailedAudits() with exponential backoff"
  - "categorizeError() for failure vector classification"
  - "formatDateTime helper in @ops/utils"
  - "Extended recording retry window (20 retries = 20min max)"
affects: [37-02, 37-03]

tech-stack:
  added: []
  patterns: ["self-healing queue with orphan recovery on startup", "exponential backoff retry (1min/5min/15min)", "categorized failure logging"]

key-files:
  created:
    - "prisma/migrations/20260331100000_add_audit_retry_fields/migration.sql"
  modified:
    - "prisma/schema.prisma"
    - "apps/ops-api/src/services/auditQueue.ts"
    - "packages/utils/src/index.ts"

key-decisions:
  - "Exponential backoff delays: 1min, 5min, 15min -- aggressive enough to retry quickly but not overwhelm"
  - "Max 3 retries per failed audit -- avoids infinite retry loops"
  - "Recording retry extended to 20 (20min) for long calls where Convoso takes longer to process"

patterns-established:
  - "Self-healing queue: orphan recovery on startup, retry on each poll cycle"
  - "Categorized error logging: recording_unavailable, transcription_timeout, claude_api_error, unknown"

requirements-completed: [D-01, D-02, D-03, D-04]

duration: 4min
completed: 2026-03-31
---

# Phase 37 Plan 01: Audit Queue Self-Healing Summary

**Self-healing audit queue with orphan recovery, exponential backoff retry (3 attempts at 1/5/15min), categorized failure logging, and 20-minute recording retry window for long calls**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-31T20:01:31Z
- **Completed:** 2026-03-31T20:05:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added retryCount, lastFailedAt, failureReason fields to ConvosoCallLog with migration
- Built orphan recovery that resets stuck processing/waiting_recording/transcribing/auditing jobs to queued on startup
- Implemented failed audit retry with exponential backoff (1min, 5min, 15min) up to 3 attempts
- Added error categorization distinguishing recording_unavailable, transcription_timeout, claude_api_error, and unknown
- Extended recording-availability retry window from 10 to 20 retries (20min max for long calls)
- Added formatDateTime helper to @ops/utils for upcoming UI work

## Task Commits

Each task was committed atomically:

1. **Task 1: Prisma migration, recording retry extension, and formatDateTime helper** - `526aed4` (feat)
2. **Task 2: Orphan recovery, retry mechanism, and failure categorization** - `4ecd779` (feat)

## Files Created/Modified
- `prisma/schema.prisma` - Added retryCount, lastFailedAt, failureReason to ConvosoCallLog
- `prisma/migrations/20260331100000_add_audit_retry_fields/migration.sql` - Migration for new fields
- `apps/ops-api/src/services/auditQueue.ts` - Added recoverOrphanedJobs, retryFailedAudits, categorizeError; modified runJob catch and startAutoScorePolling
- `packages/utils/src/index.ts` - Added formatDateTime helper

## Decisions Made
- Exponential backoff delays of 1min, 5min, 15min balance quick retry with not overwhelming external services
- Max 3 retries per failed audit prevents infinite retry loops on permanently broken audits
- Recording retry extended to 20 (20min) based on D-03 research showing long calls need more time for Convoso processing
- startAutoScorePolling made async to await orphan recovery before first poll

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Prisma client regeneration required**
- **Found during:** Task 2 (tests failed due to missing types)
- **Issue:** New schema fields (retryCount, lastFailedAt, failureReason) not in generated Prisma client types
- **Fix:** Ran `npx prisma generate` from worktree to regenerate client with new fields
- **Verification:** All 14 auditQueue tests pass after regeneration
- **Committed in:** 4ecd779 (part of Task 2)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Expected step for any schema change. No scope creep.

## Issues Encountered
None beyond the Prisma client regeneration handled above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Audit queue self-healing infrastructure complete, ready for Plan 02 (UI overhaul) and Plan 03 (composite scoring)
- formatDateTime helper available for audit detail columns in Plan 03

---
*Phase: 37-fix-call-audit-issues-manager-dashboard-ui-and-agent-performance-card-order*
*Completed: 2026-03-31*
