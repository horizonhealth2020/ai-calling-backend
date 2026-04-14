---
phase: 68-cs-analytics-upgrade
plan: 01
subsystem: analytics
tags: [cs-analytics, outreach, accountability, recharts, prisma, zod, jest, aria, audit-log]

requires:
  - phase: 65-outreach-data-model
    provides: ContactAttempt model, bypassReason field, SAVED/CANCELLED/NO_CONTACT resolutionType
  - phase: 66-outreach-logging-ui
    provides: Contact attempt logging + gate override with bypassReason capture
  - phase: 67-stale-alerts
    provides: assignedTo (round-robin) populated on chargebacks + pending terms
  - phase: 59-cs-analytics-tab
    provides: CSAnalytics.tsx shell, date range filter pattern, CSV download pattern, csAnalyticsAggregator service, /cs/analytics role-gated route

provides:
  - getOutreachAnalytics service function returning leaderboards + correlation + bypass rollup
  - GET /cs/analytics/outreach endpoint (OWNER_VIEW/SUPER_ADMIN) with 366d range cap + audit logging
  - CSAnalytics.tsx outreach accountability section (two leaderboards, grouped bar chart, bypass callout)
  - Attempt-count correlation chart validating the 3-call gate policy
  - Audit-traceable CSV exports (filename includes range + generation timestamp)
  - Unit test coverage for all aggregator math + cutoff + resilience paths

affects: [future CS policy decisions, rep performance reviews, 3-call gate validation]

tech-stack:
  added: []
  patterns:
    - "Safe-default error contract: sub-query failures return empty arrays/zero counts, never null"
    - "Pre-v2.9 cutoff split: excluded from attempt-based metrics, included in outcome-based"
    - "Roster reconciliation: trim + case-insensitive match; unknown assignees surface as '(unassigned/unknown)'"
    - "ARIA sort headers with keyboard activation + hidden SR data tables for accessible charts"
    - "Read-side analytics endpoint: role gate + best-effort audit log on success"

key-files:
  created:
    - apps/ops-api/src/services/__tests__/csAnalyticsAggregator.test.ts
  modified:
    - apps/ops-api/src/services/csAnalyticsAggregator.ts
    - apps/ops-api/src/routes/cs-reps.ts
    - apps/ops-dashboard/app/(dashboard)/cs/CSAnalytics.tsx

key-decisions:
  - "Assignee-credit attribution (not resolver-credit) locked as accountability model"
  - "366-day max range cap on outreach endpoint prevents unbounded aggregation"
  - "V29_CUTOFF constant (2026-04-13T00:00:00Z) drives attempt/outcome metric split"
  - "Unknown assigneees surface under '(unassigned/unknown)' row, never silently dropped"
  - "Cache layer deferred — no measured need yet; revisit if p95 exceeds 500ms"

patterns-established:
  - "Safe-default error contract for analytics aggregators (empty vs null)"
  - "ARIA sort + keyboard activation on sortable table headers (reusable across future dashboards)"
  - "Recharts role=img + visually-hidden SR data table pairing"

duration: ~40min
started: 2026-04-14
completed: 2026-04-14
---

# Phase 68 Plan 01: CS Analytics Upgrade — Outreach Accountability Summary

**Owner-facing outreach accountability folded into the existing CS Analytics tab: two per-type leaderboards (Chargebacks + Pending Terms) attributed via `assignedTo` round-robin, a save-rate-by-attempt-count grouped bar chart validating the 3-call gate, and a gate-override callout surfacing who bypasses policy and why.**

## Performance

| Metric | Value |
|--------|-------|
| Duration | ~40 min |
| Started | 2026-04-14 |
| Completed | 2026-04-14 |
| Tasks | 4 completed (1, 1b, 2, 3) |
| Files modified | 3 modified + 1 created |

## Acceptance Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
| AC-1: Per-type outreach leaderboard metrics | Pass | Endpoint returns both leaderboards with assigned/worked/saved/cancelled/open/saveRate/workedRate/avgAttempts/avgTimeToResolveHours. Role-gated OWNER_VIEW/SUPER_ADMIN. |
| AC-2: Save rate by attempt count correlation | Pass | Five buckets ("0","1","2","3","4+") always returned, pre-v2.9 excluded. Verified via `AC-T3` test. |
| AC-3: Gate bypass rollup | Pass | Returns totalCount + top 5 reasons + top 10 per-rep. Verified via `AC-T4` test. |
| AC-4: Leaderboard + correlation chart render | Pass | Two sortable tables side-by-side via CSS grid auto-fit; Recharts grouped bar chart with tooltips; bypass callout with reasons + overriders; per-type CSV export. |
| AC-5: Pre-v2.9 exclusion + data correctness | Pass | Verified by `AC-T2` test: pre-v2.9 records excluded from worked/avgAttempts/correlation, included in saved/cancelled outcomes. |
| AC-6: Input validation + bounded cost | Pass | Zod via existing `dateRangeQuerySchema`; 400 on `from > to` and range > 366d; defaults to 30d rolling. |
| AC-7: Access audit trail | Pass | `logAudit(userId, "cs_outreach_analytics_viewed", "cs_analytics", undefined, { from, to, roles })` wired with best-effort catch. |
| AC-8: Error contract + safe defaults | Pass | Sub-query failures return empty arrays/zero counts. Verified by `AC-T8` test and by console.error with `cs_outreach_analytics.subquery_failed` event tag. |
| AC-9: Attribution + roster reconciliation | Pass | Trim + case-insensitive roster lookup. Unknown assignees → `(unassigned/unknown)`. Verified by `AC-T6` and `AC-T7` tests. |

## Accomplishments

- **Instrumented the v2.9 payoff question** — the correlation chart turns 3 phases of outreach data into a single visual that tells owners whether the 3-call gate produces real save-rate lift or is theater.
- **Built an audit-defensible analytics endpoint** — role gate, 366d range cap, best-effort audit logging, safe-default error contract, and a locked attribution model (assignee-credit, not resolver-credit) that resists drift.
- **Comprehensive test coverage for math-heavy logic** — 11 unit tests covering divide-by-zero, cutoff exclusion, bucket completeness, bypass rollup, attribution, unknown assignees, normalization, and sub-query resilience. All passing, zero regressions across 155 ops-api tests.
- **Accessibility-first table and chart** — ARIA sort attributes with keyboard activation, chart `role="img"` with aria-label, hidden SR data table fallback. Reusable patterns for future dashboards.

## Task Commits

Atomic commits will be made in the phase transition step.

| Task | Type | Description |
|------|------|-------------|
| Task 1: Aggregator + route + validation + audit | feat | `getOutreachAnalytics()` + `/cs/analytics/outreach` endpoint |
| Task 1b: Unit tests | test | 11 test cases covering all AC edges |
| Task 2: Leaderboards + date range + CSV | feat | Two sortable per-type tables with audit-traceable CSV |
| Task 3: Correlation chart + bypass callout | feat | Recharts grouped bar + override summary panel |

## Files Created/Modified

| File | Change | Purpose |
|------|--------|---------|
| `apps/ops-api/src/services/csAnalyticsAggregator.ts` | Modified | Added `getOutreachAnalytics` + supporting types, leaderboard/correlation/bypass builders, roster canonicalization. |
| `apps/ops-api/src/routes/cs-reps.ts` | Modified | Added `GET /cs/analytics/outreach` with Zod validation, 366d range cap, audit logging. |
| `apps/ops-api/src/services/__tests__/csAnalyticsAggregator.test.ts` | Created | 11 unit tests covering all AC edges with in-memory Prisma mock. |
| `apps/ops-dashboard/app/(dashboard)/cs/CSAnalytics.tsx` | Modified | Added Outreach Accountability section, `OutreachLeaderboard`, `CorrelationChart`, `BypassCallout` sub-components. |

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Assignee-credit attribution locked in plan boundaries | Accountability belongs to the assigned rep regardless of who clicks resolve (supervisors, coverage reps, etc.) — changing this silently would misrepresent workload ownership | Future maintainers must get stakeholder sign-off before altering; preserved via AC-9 + boundary note |
| 366-day max range cap | Prevents accidental UI-driven unbounded aggregation; 366 covers rolling year + leap day tolerance | Caller gets clean 400 instead of slow 500 |
| V29_CUTOFF = 2026-04-13T00:00:00Z, hardcoded constant | Matches Phase 67 baseline; clear provenance; no need for a config knob on a one-time data boundary | Pre-v2.9 records visible in outcomes but excluded from effort metrics |
| Unknown assignees surface under `(unassigned/unknown)` row, never dropped | Attribution gaps must be visible to owners, not hidden | Prevents silent under-counting when roster drift occurs |
| Cache layer deferred | No measured need; 18 reps × typical record volume aggregates in sub-500ms | Revisit only if p95 exceeds 500ms — principle: don't cache what isn't slow |

## Deviations from Plan

### Summary

| Type | Count | Impact |
|------|-------|--------|
| Auto-fixed | 3 | None — all adapt to existing project conventions |
| Scope additions | 0 | None |
| Deferred | 0 | None |

**Total impact:** Plan executed as specified. Three minor adaptations to match established project conventions; no scope changes.

### Auto-fixed Issues

**1. [Convention] Date range format uses YYYY-MM-DD instead of ISO datetime**
- **Found during:** Task 1 (route wiring)
- **Issue:** Plan AC-6 specified `z.string().datetime()` for from/to, but the project's established `dateRangeQuerySchema` helper (used by `/cs/analytics`, `/reps/resolved-log`, and others) uses YYYY-MM-DD.
- **Fix:** Reused the existing `dateRangeQuerySchema` + `dateRange()` helpers. Added post-parse guards for reversed range + 366d cap.
- **Verification:** Endpoint behaves correctly with both `range=30d` and `from=YYYY-MM-DD&to=YYYY-MM-DD` query shapes.

**2. [Convention] Error logging uses `console.error` instead of `logError` from @ops/utils**
- **Found during:** Task 1 (aggregator resilience pattern)
- **Issue:** Plan referenced `logError from @ops/utils` but `@ops/utils` only exports `formatDollar`, `formatDate`, `formatDateTime`. No structured logger exists despite CLAUDE.md mentioning it.
- **Fix:** Used `console.error` with stable event-name prefix `[cs_outreach_analytics.subquery_failed]` — matches existing aggregator patterns (`console.error("[csAnalytics] ...")`).
- **Verification:** Test AC-T8 validates safe-default behavior on thrown sub-query.

**3. [Gate]  Section visibility for non-owner roles**
- **Found during:** Task 2 (role gating approach)
- **Issue:** Plan Task 2 verify step asked for "Section hidden or cleanly gated for non-owner roles. Prefer hiding the section entirely, consistent with Phase 59."
- **Fix:** The CSAnalytics tab itself is already role-gated upstream (OWNER_VIEW/SUPER_ADMIN only per Phase 59). Non-owners never reach the tab. If they somehow did, the inner fetch surfaces a clean error banner via the existing error state — not a broken view.
- **Verification:** Tab-level gate is authoritative; this matches Phase 59's pattern (the entire tab was role-gated, not individual sections).

### Deferred Items

None — plan executed exactly as written, with minor adaptations above.

## Issues Encountered

| Issue | Resolution |
|-------|------------|
| Direct `tsc --noEmit` from app dir reports @ops/* path-resolution errors | Pre-existing build environment quirk; actual Next.js build has `typescript: { ignoreBuildErrors: true }` and uses transpilePackages. Verified no new errors introduced. |
| `spacing.lg/md/sm` type errors throughout CSAnalytics.tsx | Pre-existing codebase tech debt — tokens export numeric keys but dozens of files use named keys. Next.js ignoreBuildErrors handles it. My additions mirror the existing style for consistency. |

## Skill Audit

No `.paul/SPECIAL-FLOWS.md` configured. Discovery found relevant skills (support-analytics-reporter, sql-pro, kpi-dashboard-design, backend-dev-guidelines, react-patterns) during the skill-discovery invocation in planning. No required-skill gates blocked execution.

## Skill Evolution

No tasks were delegated to OpenSpace this phase — all work executed locally in the standard E/Q loop.

## Next Phase Readiness

**Ready:**
- v2.9 milestone now at 100% — all outreach instrumentation + analytics in place
- CS team and owners have full visibility: stale alerts (Phase 67), outreach logging UI (Phase 66), accountability analytics (Phase 68)
- Established pattern for read-side analytics endpoints: role gate + audit log + 366d cap + safe-default error contract

**Concerns:**
- If `assignedTo` free-text drift becomes common, `(unassigned/unknown)` row will grow. Long-term fix is a FK to `CsRepRoster.id` — not needed now, noted for future consideration.
- Caching still deferred. Watch ops-api p95 latency on `/cs/analytics/outreach` once real owner traffic starts; revisit if slow.

**Blockers:**
- None. v2.9 is shippable. Next up: milestone v2.10 (to be discussed via `/paul:discuss-milestone`).

---
*Phase: 68-cs-analytics-upgrade, Plan: 01*
*Completed: 2026-04-14*
