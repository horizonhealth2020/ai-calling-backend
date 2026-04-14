# Phase 68 — CS Analytics Upgrade

**Milestone:** v2.9 CS Accountability & Outreach Tracking (final phase)
**Depends on:** Phase 67 complete (all outreach data flowing)
**Created:** 2026-04-14

---

## Primary Question

> Who is actually *attempting* to save these records, who is actually *saving* them, and at what rate?

Owner-facing analytics for performance review and accountability. Pays off the v2.9 instrumentation bet (Phases 65–67) by turning raw outreach data into actionable insight.

## Goals

1. **Effort visibility** — surface which CS reps are working their assigned records (logging contact attempts) vs. just closing them out.
2. **Outcome visibility** — save rate per rep, on records they were actually assigned.
3. **Validate the 3-call gate** — correlate save rate with attempt count to prove (or disprove) that more attempts drives more saves. Either answer is actionable.
4. **Surface gate bypasses** — when reps skip the 3-call requirement and why (`bypassReason`).
5. **Readable over comprehensive** — punchy, actionable insight, not KPI bloat.

## Audience

- Owner / SUPER_ADMIN only (role-gated like existing CS Analytics tab)
- Used for performance review + accountability
- CS reps do **not** see this view (they have My Queue from Phase 67)

## Shape

Fold into existing `CSAnalytics.tsx` (ops-dashboard). New or upgraded tab/section containing:

### 1. Two leaderboards — split by type (not combined)

**Chargebacks leaderboard** and **Pending Terms leaderboard** rendered side-by-side or as sub-tabs. Separate because:
- CB and PT have different staleness rules (resets-on-attempt vs. resolution-only)
- Different save dynamics
- Combining them hides type-specific patterns

Each leaderboard = one row per CS rep (from `CsRepRoster`), columns:

| Column | Definition |
|---|---|
| Rep | `CsRepRoster.name` |
| Assigned | Count of records with `assignedTo` = this rep in date range |
| Worked | Of assigned, count with ≥1 `ContactAttempt` logged by this rep |
| Saved | Of assigned, `resolutionType = SAVED` |
| Cancelled | Of assigned, `resolutionType = CANCELLED` |
| Open | Assigned − Saved − Cancelled − NoContact |
| Save Rate | Saved / (Saved + Cancelled) — excludes still-open |
| Worked Rate | Worked / Assigned |
| Avg Attempts | Mean ContactAttempts per resolved record |
| Avg Time-to-Resolve | Mean (resolvedAt − assignedAt/createdAt) |

Sortable. Default sort by Save Rate descending.

### 2. Save rate correlation chart (one per type)

Bucket resolved records by attempt count (1, 2, 3, 4+) and plot save rate per bucket. This validates whether the 3-call gate does real work or if agents just log attempts to clear the gate.

### 3. Gate bypass callout

Small panel showing:
- Count of records closed via gate override in date range
- Top `bypassReason` values (rolled up)
- Per-rep bypass count (who overrides most)

### 4. Date range picker

Matches pattern used on other owner dashboards (command center, trends). Default: rolling 30 days.

## Attribution Model (critical)

- **`submittedBy`** = owner/admin who pasted the batch → **ignore for rep attribution**
- **`assignedTo`** = round-robin assigned CS rep from `CsRepRoster` → **this is the denominator**
- **`resolvedBy`** = whoever closed it (may or may not be the assigned rep) → used only for resolution outcome, not credit
- **`ContactAttempt.serviceAgentId`** (or equivalent) → effort credit goes to whoever logged it

Pre-v2.9 records (no `ContactAttempt` data, no `assignedTo` populated) are **excluded** from attempt-based and rate-based metrics, matching the Phase 67 convention.

## Approach Notes

- **Server-side aggregation** — new endpoint(s) on ops-api, likely extending `csAnalyticsAggregator.ts`
- **Cache + invalidate** — follow v2.8 pattern: cache aggregation, invalidate on ContactAttempt create, chargeback/pendingTerm resolution, and assignment changes
- **Role gate** — OWNER_VIEW + SUPER_ADMIN only (same as existing CS Analytics tab)
- **CSV export** — match pattern from Phases 59/64
- **No new data model** — Phase 68 is pure read-side, Phases 65–67 already put all the data in place

## Open Questions (for planning)

1. Worked-rate denominator for **still-open** records — count attempts made on open records toward "worked," or only on resolved? (Probably yes, count on open — reps working open records is exactly the effort we want to measure.)
2. For the correlation chart, should the 4+ bucket be broken further (4, 5, 6+) or kept as one aggregate? Depends on data volume — decide during planning after looking at actual attempt distribution.
3. Time-to-resolve start anchor: `createdAt` vs `assignedAt` vs `submittedAt`? If `assignedTo` is set at batch submission, they're the same. Verify during planning.
4. Handling records reassigned mid-work (if that's a thing) — attribute to current assignee or split? Check whether reassignment happens in practice.

## Recommended Skills (from skill-discovery)

**Lead skills (apply to planning + implementation):**
- `support-analytics-reporter` — CS/support analytics shape and reporting structure
- `sql-pro` — aggregation query optimization for per-rep rollups over ContactAttempt + Chargeback/PendingTerm joins
- `kpi-dashboard-design` — readable, actionable dashboard layout (not KPI bloat)

**Framing skills:**
- `analytics-tracking` — ensures metrics are decision-ready, not vanity
- `business-analyst` — KPI structure for "attempting vs saving" question

**Implementation skills:**
- `backend-dev-guidelines` — Express/Prisma aggregator routes + services
- `react-patterns` — leaderboard table components, memoization
- `performance-engineer` — cache strategy for heavy aggregations
- `frontend-developer` — Next.js 15 + CSAnalytics.tsx integration

## Out of Scope

- New data model / schema changes (Phases 65–67 covered this)
- CS rep-facing analytics (they have My Queue; this is owner-only)
- Real-time / live-updating dashboard — batch aggregation with cache invalidation is sufficient
- Cross-period comparisons beyond date range picker (e.g., "this period vs last period" side-by-side)

## Success Criteria

- Owner can answer "who's working hard, who's effective, and is the 3-call gate paying off" in under 30 seconds on the CS Analytics tab
- Metrics correctly attribute effort to `assignedTo` + `ContactAttempt` logger, not `submittedBy`
- Save rate correlation chart renders with sufficient data to be readable
- Bypass callout surfaces override patterns clearly
- Pre-v2.9 records correctly excluded from attempt/rate metrics
- Role-gated to OWNER_VIEW + SUPER_ADMIN

---

*Ready for `/paul:plan` — consume this file for plan structure.*
