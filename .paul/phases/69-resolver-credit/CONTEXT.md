# Phase 69 — Resolver Credit in Outreach Analytics

**Milestone:** v2.9.1 CS Analytics Refinement & Hygiene
**Depends on:** Phase 68 shipped
**Created:** 2026-04-14

---

## Why this exists

Within minutes of v2.9 going live, an agent saved another agent's assigned pending term. Phase 68's strict assignee-credit model left that save invisible on the resolver's analytics — Alex got full credit for work Jasmine actually did. Operationally this pattern is frequent enough that managers need visibility on BOTH:

- **Who owns the assigned workload** (assignee — already in place)
- **Who actually produced saves** (resolver — missing)

This phase adds the second lens without breaking the first.

## Goals

1. **Assist Saves visible per rep** — when Rep B resolves Rep A's assigned record as SAVED, Rep B gets credit in their analytics row.
2. **Bypass attribution corrected** — gate overrides are attributed to whoever clicked the override (resolver), not the assignee.
3. **Accountability intact** — assignee columns (Assigned / Worked / Saved / Cancelled / Open / Save Rate / Worked Rate) unchanged; correlation chart unchanged.

## Audience

Owner / SUPER_ADMIN — same as Phase 68. Unchanged gate.

## Shape (locked decisions from design discussion)

### Leaderboard columns — ONE new column added

Current columns (Phase 68, kept as-is):
| Rep | Assigned | Worked | Saved | Cancelled | Open | Save Rate | Worked Rate | Avg Attempts | Avg Resolve (h) |

New in Phase 69:
| … | Saved | **Assist Saves** | Cancelled | … |

- **Assist Saves** = records NOT assigned to this rep but resolved by this rep with `resolutionType = SAVED`
- Column positioned immediately after `Saved` for visual pairing
- No "Total Saves" column — keep the leaderboard lean; readers can mentally sum

### Assist credit scope (locked)

- **SAVED only.** Cancellations and NO_CONTACT closures do NOT produce assist credit — those are administrative closeouts, not performance wins.
- Applies to **both** Chargebacks and Pending Terms leaderboards.

### Correlation chart (locked)

- **Unchanged.** The save-rate-by-attempt-count chart stays anchored on assignee credit. The 3-call gate measures effort on assigned workload; assist saves don't factor in.

### Bypass callout — attribution shift

- **From assignee → to resolver.** Whoever clicks the gate override button owns that decision.
- `perRep` rollup now lists the user who resolved + entered `bypassReason`, not the person the record was assigned to.
- `totalCount` and `topReasons` unchanged in shape.

### Attribution rules (full table)

| Metric | Credit to | Rationale |
|---|---|---|
| Assigned | Assignee | Ownership of workload |
| Worked | Assignee | Effort on assigned queue |
| Saved | Assignee | Outcome on assigned queue |
| **Assist Saves** | **Resolver** (when ≠ assignee) | Coverage performance |
| Cancelled | Assignee | Outcome on assigned queue |
| Open | Assignee | Still-pending assigned workload |
| Save Rate | Assignee-based | "Of my assigned resolutions, what % were saves?" |
| Worked Rate | Assignee | Effort on assigned queue |
| Avg Attempts | Assignee | Effort measurement |
| Avg Resolve Hours | Assignee | Turnaround on assigned queue |
| Correlation buckets | Assignee | Policy validation |
| Gate Bypass | **Resolver** (whoever clicked override) | Override decision ownership |

## Data model (no changes)

All data required is already present:
- `ChargebackSubmission.resolvedBy` and `PendingTerm.resolvedBy` → User FK
- `ChargebackSubmission.resolutionType` / `PendingTerm.resolutionType` → "SAVED" gate
- `CsRepRoster.name` → canonical rep name for matching

Resolver name resolution:
- `resolvedBy` → `User` → match User.name against CsRepRoster (lowercase, trim) → canonical name
- If resolver is not in CsRepRoster (owner/admin doing resolutions): **does NOT count as assist** — assist is specifically a CS-rep-to-CS-rep coverage metric, not an owner/admin intervention metric.

## Open Questions (for planning)

1. Resolvers not in CsRepRoster — the plan above says "no assist credit." Should they instead surface under a "(owner/admin override)" row like unassigned assignees do? I'd argue no — the leaderboard is a CS rep performance view, and admin resolves are more like gate bypasses than coverage. But planner should confirm.
2. What if `resolvedBy === assignedTo` (same rep both assigned and resolved)? That's normal — Saved column fires, Assist Saves does NOT. Zero-sum with no double-counting.
3. Bypass attribution for owner/admin overrides (they're not in roster) — should show up under "(owner/admin override)" row since the override came from outside the rep pool.

## Scope Limits

- Read-side only — no schema changes, no new endpoints beyond extending the existing `/cs/analytics/outreach` response
- Same role gate (OWNER_VIEW + SUPER_ADMIN)
- No changes to Phase 68's correlation chart, stale alerts, logging UI, or data model
- No retroactive recalculation of any shipped metric — just adding a new dimension

## Out of Scope

- Replacing assignee-credit anywhere (explicitly preserved)
- Per-resolver drill-down view (existing Phase 59 drill-down is assignee-only; not expanding in this phase)
- Historical "who saved whose records" activity log
- Alerts/notifications when a rep is assisting another's workload heavily

## Success Criteria

- When Rep B saves Rep A's assigned pending term, Rep B's row shows `assistSaves: 1`; Rep A's row shows `saved: 1, assistSaves: 0`
- Totals are consistent: sum of `saved + assistSaves` across all reps = total SAVED records in the period (minus owner/admin resolves)
- Bypass `perRep` now shows the user who triggered the override, not the assignee
- No regression in Phase 68 metrics (Assigned / Worked / Save Rate etc. identical values)
- Correlation chart pixel-identical output
- Tests cover the new attribution logic including same-rep and roster-edge cases

## Recommended Skills (from Phase 68 skill-discovery, still applicable)

- `support-analytics-reporter` — shaping the additional metric
- `backend-dev-guidelines` — Prisma query for resolver joins
- `react-patterns` — leaderboard column addition
- `sql-pro` — efficient multi-record-type resolver-credit aggregation

---
*Ready for `/paul:plan 69` — consume this file for plan structure.*
