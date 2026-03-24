# Phase 23: AI Scoring Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 23-ai-scoring-dashboard
**Areas discussed:** Score visualization, Score distribution, Agent coaching signals

---

## Score Visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Simple table | Rows with week, avg score, count, change | |
| Inline bar indicators | Table with CSS-only colored bars | |
| You decide | Claude picks best approach | ✓ |

**User's choice:** You decide
**Notes:** No charting library in project. Claude should pick simplest approach fitting existing style.

---

## Score Distribution Breakdown

| Option | Description | Selected |
|--------|-------------|----------|
| Numeric buckets | 5 buckets (0-20, 21-40, etc.) with counts | |
| Letter grades | A/B/C/D/F mapping | |
| Summary stats only | avg, min, max, median | |
| You decide | Claude picks best format | ✓ |

**User's choice:** You decide
**Notes:** Pick what's most useful for monitoring call quality.

---

## Agent Coaching Signals

| Option | Description | Selected |
|--------|-------------|----------|
| Threshold highlighting | Red/warning rows below configurable score | |
| Trend-based flags | Flag declining week-over-week scores | |
| No flags, just sorting | Sortable columns only | |
| You decide | Claude decides approach | ✓ |

**User's choice:** You decide
**Notes:** Read-only dashboard — owner just needs to find agents needing coaching.

---

## Claude's Discretion

All 3 areas deferred to Claude: score visualization format, distribution breakdown, and coaching signals.

## Deferred Ideas

None
