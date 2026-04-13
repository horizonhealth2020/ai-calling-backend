---
phase: 66-outreach-logging-ui
plan: 01
subsystem: ui, api, database
tags: [react, express, zod, prisma, contact-attempts, resolution-gate, cs-dashboard]

requires:
  - phase: 65-outreach-data-model
    provides: ContactAttempt model + API + resolution gate
provides:
  - Outreach logging workspace on CS tracking cards
  - Log Call/Email/Text with required notes
  - Attempt timeline with datetime stamps
  - Gate override with justification (bypassReason persisted on record)
  - no_contact resolution type in UI
affects: [67-stale-alerts, 68-cs-analytics]

tech-stack:
  added: []
  patterns: [lazy-fetch-on-expand, conditional-optimistic-update, soft-gate-override]

key-files:
  created:
    - prisma/migrations/20260413000002_add_bypass_reason/migration.sql
  modified:
    - prisma/schema.prisma
    - apps/ops-api/src/routes/contact-attempts.ts
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-api/src/routes/pending-terms.ts
    - apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx

key-decisions:
  - "Gate override always visible when < 3 calls (removed totalAttempts > 0 UI condition)"
  - "bypassReason persisted on record (not just audit log) for CS analytics drill-down"
  - "Lazy attempt fetch on expand to avoid N+1 on page load"
  - "Conditional optimistic update: wait for API on gated resolve paths"
  - "CALL=info/blue, EMAIL=success/green, TEXT=warning/amber for timeline type badges"

patterns-established:
  - "Lazy fetch on expand: badges show dash until first expand triggers API call"
  - "Soft gate pattern: checkbox reveals justification textarea, min 10 chars"
  - "Three-section expanded workspace: Log Attempt + Timeline + Resolve"

duration: ~30min
completed: 2026-04-13T00:00:00Z
---

# Phase 66 Plan 01: Outreach Logging UI Summary

**CS tracking cards reworked with outreach logging workspace — log attempts, view timeline, resolve with soft 3-call gate override and bypassReason persisted on record**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~30min |
| Completed | 2026-04-13 |
| Tasks | 2 auto + 1 checkpoint |
| Files modified | 6 |
| Post-checkpoint fixes | 2 (gate always visible, datetime stamps) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Contact attempt notes required | Pass | Zod min(1) on notes field |
| AC-2: Resolution gate bypass with reason | Pass | Both cb + pt, audit-logged |
| AC-2a: Bypass reason persisted on record | Pass | bypassReason column on both models |
| AC-2b: Resolve 400 error displayed to user | Pass | Parses error field, toasts exact API message |
| AC-3: Call count badge visible | Pass | Shows "—" until expanded, then "N/3 Calls", green at 3/3 |
| AC-4: Expand trigger renamed + reworked | Pass | "Work" button, 3-section workspace |
| AC-5: Log attempt UI with required notes | Pass | Log Call/Email/Text + Save Attempt |
| AC-6: Attempt timeline displays attempts | Pass | Type badge, attempt #, agent, notes, datetime |
| AC-7: Resolve with gate override | Pass | Checkbox + justification textarea |
| AC-8: no_contact displays correctly | Pass | Amber/warning styling |

## Accomplishments

- CS tracking cards transformed from simple resolve form to full outreach workspace
- Contact attempt logging with required notes creates accountability trail
- 3-call resolution gate enforced visually with soft override (justification required)
- bypassReason persisted on record for CS analytics per-rep reporting
- Conditional optimistic update prevents UI/server state divergence on gated paths
- no_contact resolution type added with distinct amber styling

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modified | Added bypassReason to ChargebackSubmission + PendingTerm |
| `prisma/migrations/20260413000002_add_bypass_reason/migration.sql` | Created | bypass_reason column on both tables |
| `apps/ops-api/src/routes/contact-attempts.ts` | Modified | Notes required (min 1) |
| `apps/ops-api/src/routes/chargebacks.ts` | Modified | bypassReason in schema + gate bypass logic + persist on record |
| `apps/ops-api/src/routes/pending-terms.ts` | Modified | Same as chargebacks |
| `apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx` | Modified | Full workspace rework (~350 lines changed) |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Gate override always visible (< 3 calls) | Removed totalAttempts > 0 condition — users couldn't see override on first test | API still has pre-v2.9 bypass, so override on 0-attempt records is harmless |
| bypassReason on record, not just audit log | User requested: CS analytics drill-down needs to read bypass notes per rep | Added schema column + migration |
| Lazy fetch on expand | Audit finding: N+1 on page load with 50+ records | Badge shows "—" until expanded — acceptable UX tradeoff |
| Conditional optimistic update | Audit finding: optimistic update on gated resolve causes UI/server divergence | Waits for API response when gate might block |
| formatDateTime on timeline | User requested: need full date+time stamps on all logs | Already had formatDateTime utility, just switched from formatDate |

## Deviations from Plan

### Post-Checkpoint Fixes

**1. Gate override visibility**
- **Found during:** UAT checkpoint
- **Issue:** Override checkbox not appearing — totalAttempts > 0 condition too restrictive
- **Fix:** Removed condition; gate UI shows whenever < 3 calls and selecting close/cancel/no_contact
- **Commit:** 5792c83

**2. DateTime timestamps**
- **Found during:** UAT feedback
- **Issue:** Timeline showed date only, user wanted date + time
- **Fix:** Switched formatDate → formatDateTime on attempt timeline
- **Commit:** 5792c83

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| `colors.primaryBg` doesn't exist in token system | Used `colors.infoBg` for CALL type badge instead |
| Remote DB unreachable for migration | Created migration SQL manually |

## Next Phase Readiness

**Ready:**
- Contact attempt data flowing with full UI logging
- Phase 67 (48-Hour Stale Alerts) can query ContactAttempt timestamps for staleness
- Phase 68 (CS Analytics) can read bypassReason from records for per-rep reporting

**Concerns:**
- Migration not yet deployed — must run before Phase 67/68 work

**Blockers:**
- None

---
*Phase: 66-outreach-logging-ui, Plan: 01*
*Completed: 2026-04-13*
