---
phase: 69-resolver-credit
plan: 01
subsystem: analytics
tags: [cs-analytics, outreach, resolver-credit, attribution, aria, jest]

requires:
  - phase: 68-cs-analytics-upgrade
    provides: getOutreachAnalytics service, /cs/analytics/outreach endpoint, leaderboard/correlation/bypass shape, CSAnalytics.tsx LEADERBOARD_COLS pattern

provides:
  - `assistSaves` field on OutreachRow (resolver-credit for cross-rep SAVED resolves)
  - Resolver-keyed bypass rollup (override credit to whoever clicked)
  - "(owner/admin override)" bucket for non-roster resolvers
  - "(unresolved)" bucket as data-integrity signal
  - Updated default sort: saveRate desc, (saved + assistSaves) desc, assigned desc
  - 13 new unit tests guarding all new attribution logic

affects: [future CS performance reviews, v2.10 analytics evolution]

tech-stack:
  added: []
  patterns:
    - "Two-pass aggregation: Pass 1 assignee credit (unchanged), Pass 2 resolver credit (additive)"
    - "OUTCOME vs EFFORT cutoff semantics — outcomes include pre-v2.9, efforts exclude"
    - "Data-integrity edge cases surfaced, not hidden: (unresolved), (owner/admin override)"
    - "tooltip property on LEADERBOARD_COLS config drives <th title> attribute (single source of truth for column metadata)"

key-files:
  modified:
    - apps/ops-api/src/services/csAnalyticsAggregator.ts
    - apps/ops-api/src/services/__tests__/csAnalyticsAggregator.test.ts
    - apps/ops-dashboard/app/(dashboard)/cs/CSAnalytics.tsx

key-decisions:
  - "assistSaves follows OUTCOME cutoff semantics — pre-v2.9 cross-rep SAVEDs count"
  - "(unresolved) bypass bucket surfaces data-integrity violation, not silently formatted"
  - "Sort tiebreaker change: (saved + assistSaves) desc inserted — intentional behavior change"
  - "Attribution model EXTENDED not replaced — assignee-credit preserved; resolver-credit added alongside"

patterns-established:
  - "Two-pass aggregation for additive credit models"
  - "Attribution table in boundaries: explicit per-metric credit rule"
  - "Conservation-law unit test (sum invariants) to prevent double-counting regression"

duration: ~30min
started: 2026-04-14
completed: 2026-04-14
---

# Phase 69 Plan 01: Resolver Credit in Outreach Analytics Summary

**Extended Phase 68 outreach leaderboards with `assistSaves` — a resolver-credit dimension that surfaces coverage work — without changing a single Phase 68 metric. Bypass override attribution shifted from assignee to resolver so gate override accountability follows the override button click.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~30 min |
| Started | 2026-04-14 |
| Completed | 2026-04-14 |
| Tasks | 3 completed (1, 1b, 2) |
| Files modified | 3 |
| Tests added | 13 (24 total in aggregator suite, all passing) |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Cross-rep SAVED credits resolver via assistSaves | Pass | Test `AC-1 assist credit` verifies Jane.saved=1 + Alice.assistSaves=1 |
| AC-2: Self-resolution produces no assist | Pass | Test `AC-2 self-resolution` verifies assistSaves stays 0 when assignee === resolver |
| AC-3: Non-SAVED cross-rep resolutions produce no assist | Pass | Tests `AC-3a CANCELLED` + `AC-3b NO_CONTACT` cover both cases |
| AC-4: Owner/admin resolvers get no assist | Pass | Test `AC-4 owner/admin resolver` verifies no leaderboard row and no assist attribution |
| AC-5: Bypass rollup keyed by resolver | Pass | Tests cover normal resolver + owner/admin override bucket |
| AC-6: Phase 68 metrics byte-identical | Pass | Original 11 Phase 68 tests all still pass without modification |
| AC-7: Frontend column, sortable, ARIA, CSV | Pass | LEADERBOARD_COLS drives table + CSV; tooltip via `title` attribute; keyboard activation inherited |
| AC-8: Pre-v2.9 outcome semantics for assistSaves | Pass | Pre-v2.9 cross-rep SAVED produces assist; effort metrics still excluded |
| AC-9: Assist-only row renders without NaN | Pass | Explicit `JSON.stringify` non-throw check + numeric field assertions |
| AC-10: Cross-rep non-SAVED does not mutate existing row | Pass | Test verifies Alice.cancelled stays 0 when she cancels Jane's record |
| AC-11: (unresolved) bypass surfaces edge | Pass | Test verifies the bucket appears with count when bypassReason is set without resolvedBy |

All 11 ACs pass.

## Accomplishments

- **Resolver credit surfaced without breaking assignee credit** — owners now see both "who owns the workload" and "who actually produced saves" in a single leaderboard.
- **Bypass attribution corrected** — gate override credit follows the override click, not the assignment. A supervisor bypassing on someone else's record now shows up where accountability belongs.
- **Data-integrity signals surfaced, not hidden** — `(unresolved)` bucket exposes records with bypassReason set but no resolvedBy (violates Phase 66 workflow invariant); `(owner/admin override)` exposes gate overrides by non-CS staff.
- **Conservation-law test guards against double-counting** — mathematical verification that sum(saved) across the leaderboard matches total SAVED records, and sum(assistSaves) matches cross-rep SAVEDs by roster members. Prevents any future regression from silently inflating counts.
- **Zero regressions on Phase 68 metrics** — original 11 tests still pass without modification, verifying byte-identical output for assigned/worked/saved/cancelled/open/saveRate/workedRate/avgAttempts/avgTimeToResolveHours.

## Task Commits

Atomic commits made in the phase transition step.

| Task | Type | Description |
|------|------|-------------|
| Task 1: Aggregator + bypass attribution | feat | assistSaves two-pass; resolver-keyed bypass; sort tiebreaker update |
| Task 1b: Unit tests | test | 13 new cases for attribution, cutoff, NaN safety, row isolation, edge buckets |
| Task 2: Frontend column + tooltip + CSV | feat | Assist Saves column in LEADERBOARD_COLS drives table + CSV via single source of truth |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `apps/ops-api/src/services/csAnalyticsAggregator.ts` | Modified | Two-pass leaderboard builder; RawRecord gains resolverName; Prisma queries include resolver; bypass keyed by resolver; new sort tiebreaker |
| `apps/ops-api/src/services/__tests__/csAnalyticsAggregator.test.ts` | Modified | RawCb type + Prisma mock + `cb()` helper extended with resolverName; 13 new describe cases appended |
| `apps/ops-dashboard/app/(dashboard)/cs/CSAnalytics.tsx` | Modified | OutreachRow type + LEADERBOARD_COLS entry + tooltip on `<th title>` |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| assistSaves uses OUTCOME cutoff (pre-v2.9 counts) | Matches Phase 68's saved/cancelled rule; resolver credit is about what got produced, not what effort was logged | Consistent cutoff philosophy across the whole metric family |
| `(unresolved)` bucket treated as data-integrity signal | Per Phase 66 workflow, bypassReason and resolvedBy are set together during the resolve action. Non-zero `(unresolved)` indicates a DB mutation outside the app | Surfaces a real bug class rather than hiding it |
| Sort tiebreaker includes (saved + assistSaves) | Intentional behavior change — reps producing more actual saves rank higher among equal save-rate ties | Owner leaderboard order may shift slightly from Phase 68 but in favor of better production signal |
| LEADERBOARD_COLS tooltip property | Single source of truth for column metadata including tooltip; inline on the config entry | Simpler than a separate helper function; keeps all column config in one place |
| Keep "Top Overriders" label unchanged | Already correct semantics after the server-side attribution flip | Zero UI copy change needed |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 1 | None — simplified tooltip implementation |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** Plan executed as written with one minor implementation simplification.

### Auto-fixed Issues

**1. [Simplification] Tooltip implemented inline on LEADERBOARD_COLS instead of separate helper**
- **Found during:** Task 2 (column addition)
- **Issue:** Plan called for `const getColTooltip = (key) => ...` helper function. With only one column needing a tooltip, a config property is simpler and keeps column metadata co-located.
- **Fix:** Added optional `tooltip?: string` to LEADERBOARD_COLS entry type; `<th title={col.tooltip}>` applies it automatically. The audit explicitly flagged this as a cosmetic deferral and the implementation matches that spirit.
- **Impact:** Zero functional difference; cleaner code.

### Deferred Items

None — all plan items shipped.

## Issues Encountered

None.

## Skill Audit

No SPECIAL-FLOWS.md configured. Phase 68's skill-discovery still applies — no new discovery needed since this extends shipped code.

## Skill Evolution

No tasks delegated to OpenSpace.

## Next Phase Readiness

**Ready:**
- Phase 70 (Test & Ops Hygiene) can proceed — the 3 pre-existing test failures it targets remain unchanged (auditQueue x 2, commission x 1)
- v2.9.1 analytics work is functionally complete; resolver-credit visible end-to-end from DB → aggregator → endpoint → table → CSV

**Concerns:**
- Watch for `(unresolved)` bucket appearing in production with nonzero count — indicates direct DB mutation of bypassReason outside the normal resolve flow; would point to a potential bug in some external script/tool
- If coverage reps often resolve non-SAVED outcomes on teammates' records, the assigned-CANCELLED rate for those teammates will look worse than the actual effort. That's a reporting tradeoff the attribution model explicitly makes — not a defect.

**Blockers:**
- None for Phase 70.

---
*Phase: 69-resolver-credit, Plan: 01*
*Completed: 2026-04-14*
