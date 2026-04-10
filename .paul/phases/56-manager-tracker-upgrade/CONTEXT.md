# Phase 56 Context

**Generated:** 2026-04-10
**Status:** Ready for /paul:plan

## Goals

1. Add call quality metrics to the manager tracker table — avg call length, longest call, and inline tier breakdown bar
2. Surface data that already exists in `/call-logs/kpi` but isn't displayed in ManagerTracker
3. Give managers instant visual signal of agent call quality vs just call quantity

## Approach

**New columns in existing tracker table:**
- Avg Call Length (m:ss format) — from per_agent[].avg_call_length
- Longest Call (m:ss format) — from per_agent[].longest_call
- Call Quality — inline stacked bar showing tier distribution

**Call quality tier bar:**
- Short (<30s) = red/danger — agent isn't keeping customers engaged
- Contacted (30s-2min) = amber/warning — decent but not deep
- Engaged (2-5min) = blue — good quality conversation
- Deep (5min+) = green — excellent engagement
- Live (null duration) = excluded from bar (not meaningful for quality)
- Hover on each segment shows exact count

**Data source:**
- ManagerTracker currently only calls `/call-counts` for simple totals
- Need to also call `/call-logs/kpi` to get tier breakdown, avg call length, longest call
- Both endpoints already exist — no new API work needed
- Data needs to be fetched and merged with existing tracker rows by agent name

**What we're NOT doing:**
- No commission column (payroll handles it)
- No today's sales section (date filter covers it)
- No sparklines/trends (Phase 58 owner dashboard)
- No conversion eligible flag (tier bar already communicates quality)

## Open Questions

- Does `/call-logs/kpi` respond to the same date range params as the tracker? Need to verify so the tier data matches the selected period.
- Should the call quality bar replace the simple "Calls" column, or sit alongside it?

---
*Context for /paul:plan consumption*
