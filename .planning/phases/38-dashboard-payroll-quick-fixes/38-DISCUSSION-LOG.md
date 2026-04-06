# Phase 38: Dashboard & Payroll Quick Fixes - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 38-dashboard-payroll-quick-fixes
**Areas discussed:** Audit rolling window, Enrollment fee $0 default, Sparkline data issues, Analytics default expand

---

## Audit Rolling Window

| Option | Description | Selected |
|--------|-------------|----------|
| Last 30 audits, no time filter | Default query fetches last 30 audits ordered by call date desc, regardless of when they occurred. Load more fetches next 30. Simple cursor pagination. | ✓ |
| Last 30 audits + date range option | Default is last 30, but keep the date range filter as an optional override. User can switch between 'recent 30' and a custom date range. | |
| Last 30 per time period | Still show date groupings, but ensure at least 30 audits are loaded even if that spans multiple days. | |

**User's choice:** Last 30 audits, no time filter (Recommended)
**Notes:** None

### Per-Agent Filter

| Option | Description | Selected |
|--------|-------------|----------|
| Last 30 per agent | When an agent is selected, show their last 30 audits. Consistent behavior. | ✓ |
| All audits for agent in current window | Filter the already-loaded 30 audits to show only that agent's. Could result in very few results. | |

**User's choice:** Last 30 per agent (Recommended)
**Notes:** None

---

## Enrollment Fee $0 Default

| Option | Description | Selected |
|--------|-------------|----------|
| Only fix $0 parsing | Change condition to include $0 when an enrollment line exists. Receipts without any enrollment line stay as-is. | ✓ |
| Default all to $0 | If no enrollment line found in receipt, also default to $0. Every parsed sale gets an enrollment fee value. | |

**User's choice:** Only fix $0 parsing (Recommended)
**Notes:** User provided sample receipt showing `Enrollment  $0.00` line. Bug traced to `ManagerEntry.tsx:196` where `if (totalEnrollment > 0)` skips $0 values. Parser regex correctly extracts the value but the condition discards it.

---

## Sparkline Data Issues

| Option | Description | Selected |
|--------|-------------|----------|
| Data is flat/zero | Sparklines show flat lines or no data points even though there are sales. | |
| Wrong values | The sparkline shapes don't match the actual daily sales/close rates. | |
| Visual rendering issue | Data is correct but SVG polylines don't render properly. | |

**User's choice:** "there is no data at all" + provided screenshot
**Notes:** Screenshot confirmed all sparklines show dashed "no data" lines. Bug identified as date format mismatch in `lead-timing.ts:201-213` — PostgreSQL `::date` becomes JS Date object, `String()` produces long format that doesn't match ISO lookup keys.

---

## Analytics Default Expand

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch on load | Start expanded, fetch immediately. Simple and matches the requirement. | |
| Lazy load on scroll | Start expanded but defer the API call until the section scrolls into view. | ✓ |

**User's choice:** Lazy load on scroll
**Notes:** User prefers deferring the API call until the section is visible, reducing initial page load.

---

## Claude's Discretion

- IntersectionObserver implementation approach for lazy-load analytics
- Whether to normalize sparkline dates in SQL vs JS
- Pagination adjustments for count-based audit windowing

## Deferred Ideas

None — discussion stayed within phase scope
