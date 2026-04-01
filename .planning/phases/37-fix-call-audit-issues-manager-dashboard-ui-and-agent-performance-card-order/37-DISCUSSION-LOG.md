# Phase 37: Fix Call Audit Issues, Manager Dashboard UI, and Agent Performance Card Order - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 37-fix-call-audit-issues-manager-dashboard-ui-and-agent-performance-card-order
**Areas discussed:** Call Audit Fixes, Performance Ranking Formula, Dashboard Layout Fixes

---

## Call Audit Issues

| Option | Description | Selected |
|--------|-------------|----------|
| Scoring/grading problems | AI scores are inaccurate or formula needs adjustment | |
| Processing/queue issues | Audits stuck, failing silently | ✓ |
| UI display problems | Data missing, formatting, usability | ✓ |
| Manager override issues | Problems with edit/override capability | ✓ |

**User's choice:** All audit areas selected, but scoring is fine — the issues are: (1) UI is just a long flat list by date with no timestamps, (2) longer recordings silently fail, (3) old audits clutter the view

**Notes:** User provided Railway logs showing `failed: 41, inProgress: 14, activeJobs: 0` — confirming orphaned jobs and unrecovered failures. Whisper logs show all transcriptions succeed (200 OK for 5-20+ min audio), so failures are post-transcription (Claude API or DB save). Calls can exceed 20 minutes.

### Audit UX

| Option | Description | Selected |
|--------|-------------|----------|
| Group by agent | Organize by agent instead of flat list | |
| Filter and search | Add agent, outcome, score, date filters | ✓ |
| Summary cards at top | KPI cards above the list | |
| Just timestamps + fix failures | Minimal changes | |

**User's choice:** Filter/search, order by date+timestamp, fix aging audits (don't show old ones by default)

### Audit Aging

| Option | Description | Selected |
|--------|-------------|----------|
| Last 7 days default | 7-day window with date range picker | |
| Last 24 hours default | Today's audits, expandable | ✓ |
| Current week default | Sun-Sat pay week pattern | |

**User's choice:** Last 24 hours with expandable view, but expand should NOT dump all old audits at once (pagination/load-more to prevent lag)

---

## Dashboard Layout Fixes

| Option | Description | Selected |
|--------|-------------|----------|
| Sales Entry form | Form layout issues | |
| Performance Tracker | Tracker/leaderboard styling | ✓ |
| Agent Sales table | Sales listing issues | |
| Call Audits section | Audit cards/layout | ✓ |

**User's choice:** Performance Tracker and Call Audits — both already discussed in other areas

---

## Performance Ranking Formula

| Option | Description | Selected |
|--------|-------------|----------|
| Premium-heavy (70/30) | High earners rank higher | |
| Equal weight (50/50) | Balanced | |
| Efficiency-heavy (30/70) | Efficient agents rank higher | |

**User's choice:** 40% premium / 60% CPS efficiency (user-proposed split)

**Notes:** User asked if sale count should be a factor — concluded it's redundant with premium (more sales = more premium). Agreed on sale count as tiebreaker only.

### Confirm Ranking

| Option | Description | Selected |
|--------|-------------|----------|
| 40/60 with sale count tiebreaker | Premium 40%, CPS 60%, sales break ties | ✓ |
| Three-way composite | Premium 30%, CPS 50%, Sales 20% | |
| Just premium + CPS | 40/60, no tiebreaker | |

**User's choice:** 40/60 with sale count tiebreaker

---

## Claude's Discretion

- Normalization method for composite score
- Pagination batch size for audit loading
- Retry UI vs auto-retry on startup for failed audits

## Deferred Ideas

None
