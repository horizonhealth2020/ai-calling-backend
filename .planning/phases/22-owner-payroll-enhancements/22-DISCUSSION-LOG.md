# Phase 22: Owner & Payroll Enhancements - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-24
**Phase:** 22-owner-payroll-enhancements
**Areas discussed:** CS Payroll KPI placement, Print card CSV format, Service entries in exports

---

## CS Payroll KPI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New StatCard in overview grid | 5th card showing total CS payroll for selected date range | |
| Column in period summary table | Add "CS Payroll" column next to "Commission Paid" per period | ✓ |
| Both | StatCard for aggregate + column for per-period breakdown | |

**User's choice:** Column in period summary table
**Notes:** No separate StatCard needed — per-period breakdown in the existing table is sufficient.

---

## Print Card CSV vs Existing Detailed CSV

| Option | Description | Selected |
|--------|-------------|----------|
| Add header row per agent | Insert agent header before sales, enhance existing Detailed CSV | |
| Already good enough | Existing detailed CSV with subtotals is sufficient | |
| Something else | Custom layout | ✓ |

**User's choice:** Agent-first grouping — one pay card block per agent per week. Agents alphabetical, weeks chronological within each agent. Like handing out physical pay cards.
**Notes:** Current detailed CSV groups by period first then agent within period. User wants it flipped: agent-first, then weeks within agent. For a 1-month export with 10 agents, produces 40 pay card blocks (10 agents × 4 weeks).

---

## Service Entries in Exports

| Option | Description | Selected |
|--------|-------------|----------|
| Separate section at end | Commission agent cards first, then service staff with own columns | ✓ |
| Interleaved alphabetically | Service staff mixed in by name, different column layout | |
| Exclude service staff | Commission agents only, service staff have their own export | |

**User's choice:** Separate section at the end
**Notes:** Service staff pay cards use their own column layout (basePay, bonus, deductions, totalPay) since their pay structure differs from commission agents.

---

## Claude's Discretion

- Column header naming for CS payroll in period summary table
- Whether service staff section in CSV gets a distinguishing header row
- Handling of agents with zero entries in a given week

## Deferred Ideas

None
