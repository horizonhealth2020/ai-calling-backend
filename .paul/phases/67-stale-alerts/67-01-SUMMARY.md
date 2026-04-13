---
phase: 67-stale-alerts
plan: 01
subsystem: api, ui
tags: [express, react, stale-alerts, my-queue, cs-dashboard]

requires:
  - phase: 65-outreach-data-model
    provides: ContactAttempt model
  - phase: 66-outreach-logging-ui
    provides: Contact attempt logging UI (records enter outreach workflow)
provides:
  - GET /api/stale-summary endpoint with dual staleness logic
  - My Queue personal view for CS reps
  - Stale Overview card for owner/admin on tracking page
affects: [68-cs-analytics]

tech-stack:
  added: []
  patterns: [dual-staleness-model, outreach-workflow-gating, batch-latest-attempt-query]

key-files:
  created:
    - apps/ops-dashboard/app/(dashboard)/cs/CSMyQueue.tsx
  modified:
    - apps/ops-api/src/routes/chargebacks.ts
    - apps/ops-dashboard/app/(dashboard)/cs/page.tsx
    - apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx

key-decisions:
  - "Pre-v2.9 records excluded from stale: requires ≥1 contact attempt (some: {})"
  - "My Queue visible to CUSTOMER_SERVICE only, not owner/admin"
  - "CB staleness resets on any contact attempt; PT staleness only clears on resolution"
  - "UTC midnight as baseline for 48-hour deadline"
  - "Single API call for My Queue (allRecords field in stale-summary response)"

patterns-established:
  - "Outreach workflow gating: only records with ≥1 attempt enter stale/gate systems"
  - "Dual staleness: different reset conditions per record type"
  - "StaleOverviewCard: reusable exported component for owner/admin views"

duration: ~20min
completed: 2026-04-13T00:00:00Z
---

# Phase 67 Plan 01: 48-Hour Stale Alerts Summary

**Stale alert system with dual staleness logic — My Queue for CS reps, Stale Overview for owners, pre-v2.9 records excluded**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~20min |
| Completed | 2026-04-13 |
| Tasks | 2 auto + 1 checkpoint |
| Files modified | 4 |
| Post-checkpoint fixes | 2 (My Queue visibility, pre-v2.9 exclusion) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Stale summary API endpoint | Pass | Dual logic, batch query, per-agent grouping |
| AC-2: Filterable by agent name | Pass | Case-insensitive + trimmed matching |
| AC-3: My Queue tab visible to CS reps | Pass | Hidden from owner/admin (post-checkpoint fix) |
| AC-4: Stale items prioritized | Pass | Red STALE badge + overdue time, sorted to top |
| AC-5: PT staleness — resolution only | Pass | Attempts don't clear PT staleness |
| AC-6: CB staleness — resets on attempt | Pass | Last attempt + 48h is new deadline |
| AC-7: Owner/admin stale overview | Pass | StaleOverviewCard on tracking page, per-agent counts |
| AC-8: Resolved records never stale | Pass | WHERE resolvedAt IS NULL |

## Accomplishments

- Dual staleness model: chargebacks reset on contact attempt, pending terms require resolution
- My Queue personal view gives CS reps immediate visibility into their stale items
- Stale Overview gives owners per-agent accountability (who has stale records)
- Pre-v2.9 records excluded from stale system (requires ≥1 contact attempt)
- Single API call serves both stale and all-assigned records for My Queue

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `apps/ops-api/src/routes/chargebacks.ts` | Modified | GET /api/stale-summary endpoint |
| `apps/ops-dashboard/app/(dashboard)/cs/CSMyQueue.tsx` | Created | My Queue component + StaleOverviewCard export |
| `apps/ops-dashboard/app/(dashboard)/cs/page.tsx` | Modified | My Queue tab for CS reps, userName from session |
| `apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx` | Modified | StaleOverviewCard import for owner/admin |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Pre-v2.9 exclusion via `contactAttempts: { some: {} }` | Old records from before outreach system flooded stale view | Consistent with resolution gate's pre-v2.9 bypass pattern |
| My Queue hidden from owner/admin | Owners don't get assigned records; seeing empty queue is confusing | Owner accountability via Stale Overview card instead |
| Default tab = "tracking" for all | Owner was landing on empty My Queue | CS reps can click into My Queue from nav |
| Batch query with Prisma include | Audit finding: avoid N+1 per-chargeback attempt lookup | Uses `contactAttempts: { orderBy, take: 1 }` in single query |
| allRecords in stale-summary response | Audit finding: avoid separate fetches for fresh items | Single API call serves entire My Queue view |

## Deviations from Plan

### Post-Checkpoint Fixes

**1. My Queue visibility**
- **Found during:** UAT — owner saw empty My Queue tab
- **Fix:** Tab only shows for CUSTOMER_SERVICE role, not owner/admin
- **Commit:** ac1ece1

**2. Pre-v2.9 stale records**
- **Found during:** UAT — stale overview showed old chargebacks from last week
- **Fix:** Added `contactAttempts: { some: {} }` filter to both CB and PT queries
- **Commit:** ac1ece1

## Next Phase Readiness

**Ready:**
- Stale data flowing for Phase 68 (CS Analytics Upgrade) to aggregate
- Per-agent stale counts available via /api/stale-summary
- StaleOverviewCard exportable for reuse in analytics views

**Concerns:**
- None

**Blockers:**
- None

---
*Phase: 67-stale-alerts, Plan: 01*
*Completed: 2026-04-13*
