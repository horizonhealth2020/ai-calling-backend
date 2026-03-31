# Phase 35: Fix KPI Polling Issues and Manager Dashboard Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 35-fix-kpi-polling-issues-and-manager-dashboard-features
**Areas discussed:** KPI Poller Timezone, Today Preset, Manager Tracker Today Column, Owner KPIs Default, Date Range Scoping, CS Round Robin

---

## KPI Poller Timezone Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcode Eastern | Change poller business hours check from `America/Los_Angeles` to `America/New_York` | |
| Add timezone setting | Store timezone in DB, expose in Owner Config UI | |
| Adapter approach | Keep Convoso data parsing as Pacific, business hours check as Eastern | ✓ |

**User's choice:** Adapter approach — Convoso call logs are reported in Los Angeles time but the business operates in New York time. Keep `convosoDateToUTC` as Pacific for data ingestion, fix business hours check to use Eastern. User noted earlier audit failures related to timezone when enabling/disabling call audits.
**Notes:** Log evidence provided: Mar 31, 9:07 AM EDT showed `currentTime: 06:07` (Pacific) against `businessHours: 09:00-18:00` (Eastern).

---

## Today Date Range Preset

| Option | Description | Selected |
|--------|-------------|----------|
| Add "Today" to KPI_PRESETS | First position in shared preset array | ✓ |

**User's choice:** Add "Today" as first preset. Order: Today, Current Week, Last Week, 30 Days, Custom.
**Notes:** Straightforward — no alternatives discussed.

---

## Manager Tracker Today Column

| Option | Description | Selected |
|--------|-------------|----------|
| Keep today column | Alongside the new Today filter preset | |
| Remove today column | Redundant once Today is a filter preset | ✓ |

**User's choice:** Remove the today column from the tracker card. The Today filter preset replaces it.
**Notes:** User specifically said "remove the today column i wanted a today column for the kpi range function at the top."

---

## Owner KPIs Default

| Option | Description | Selected |
|--------|-------------|----------|
| Default to Current Week | Current behavior | |
| Default to Today | Show today's data on load | ✓ |

**User's choice:** Default to Today on owner dashboard Performance Overview.
**Notes:** No alternatives discussed.

---

## Date Range Scoping

| Option | Description | Selected |
|--------|-------------|----------|
| Global shared state | Current behavior — one DateRangeProvider wraps all dashboards | |
| Per-dashboard state | Each dashboard manages its own date range independently | ✓ |

**User's choice:** Per-dashboard state. Custom date range should not persist when switching between dashboards.
**Notes:** User reported: "when i select a custom date range it persists across different dashboard should only persist in the current dashboard it was set in."

---

## CS Round Robin Fairness

| Option | Description | Selected |
|--------|-------------|----------|
| Investigate and fix | Debug why assignments appear uneven | ✓ |

**User's choice:** Fix round robin to distribute fairly.
**Notes:** User provided chargeback/pending term tracking data showing uneven distribution across Jasmine, Ally, and Alex.

---

## Claude's Discretion

- Exact approach for per-dashboard date range scoping
- Whether to extract shared BUSINESS_TIMEZONE constant
- Round robin fix approach after root cause investigation

## Deferred Ideas

None
