# Phase 8: Reporting - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Managers and owners can see agent performance metrics, period summaries, and trend data for decision-making. Export-ready reports can be generated and downloaded. This phase adds reporting endpoints, trend KPIs to the owner dashboard, and surfaces agent metrics more prominently. It does NOT add charts, interactive visualizations, or drill-down capabilities.

</domain>

<decisions>
## Implementation Decisions

### Reporting placement
- Agent performance metrics (REPT-01, REPT-02) surfaced on manager dashboard tracker — `/tracker/summary` already returns salesCount, premiumTotal, totalLeadCost, costPerSale
- Period summaries (REPT-03) surfaced on both manager and owner dashboards
- Trend KPIs (REPT-05) added to owner dashboard's existing StatCard row
- No new standalone "reporting" tab — enhance existing views with reporting data

### Trend KPIs (owner dashboard)
- Extend `/owner/summary` to return prior-week and prior-month comparison values alongside current values
- Display as up/down arrows with percentage change on existing StatCards
- Compare: sales count, premium total, clawbacks — current vs prior week and prior month
- Simple colored indicators (green up, red down) — no sparklines or charts

### Period summaries
- New API endpoint(s) for weekly and monthly aggregate totals (commission paid, premium collected, sale count)
- Aggregation uses payroll entry data (net amounts) for commission, sale data for premium/count
- Only RAN sales included in all metrics (Phase 10 decision)
- Weekly = Sun-Sat periods matching existing payroll period structure
- Monthly = calendar month aggregation

### Export scope
- REPT-04 extends existing payroll export with agent performance data (not a new export system)
- Leverage existing client-side CSV pattern from payroll dashboard
- Add agent performance CSV export (agent, sales count, commission earned, cost-per-sale, lead cost)
- Existing payroll summary + detailed exports remain as-is — no duplication

### Cost-per-sale metric
- Uses existing `/tracker/summary` calculation: totalLeadCost / salesCount per agent
- Already implemented — REPT-02 is about making it more visible, not reimplementing

### Claude's Discretion
- Exact API response shape for trend comparison data
- Whether period summaries use a new endpoint or extend existing ones
- StatCard trend indicator styling (arrow icons, color shades)
- Agent performance table column ordering and sort defaults
- Whether to add commission totals to tracker summary or fetch from payroll data

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Reporting requirements
- `.planning/REQUIREMENTS.md` — REPT-01 through REPT-05 define reporting requirements
- `.planning/ROADMAP.md` §Phase 8 — Success criteria and dependency chain

### Existing reporting code
- `apps/ops-api/src/routes/index.ts` lines 745-787 — `/tracker/summary` endpoint: per-agent salesCount, premiumTotal, totalLeadCost, costPerSale with date range filter
- `apps/ops-api/src/routes/index.ts` lines 1075-1086 — `/owner/summary` endpoint: salesCount, premiumTotal, clawbacks, openPayrollPeriods with date range filter
- `apps/owner-dashboard/app/page.tsx` — StatCard component usage, range toggle (today/week/month), Socket.IO real-time patching
- `apps/payroll-dashboard/app/page.tsx` lines 1557-1635 — `exportCSV()` and `exportDetailedCSV()` client-side CSV generation functions
- `apps/ops-api/src/services/payroll.ts` — Commission calculation, upsertPayrollEntryForSale, period assignment logic

### Prior phase context
- `.planning/phases/07-payroll-management/07-CONTEXT.md` — Payroll card structure, CSV export decisions, period status workflow
- `.planning/phases/10-sale-status-payroll-logic/10-CONTEXT.md` — RAN-only commission gating, status-driven metrics filtering

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StatCard` component (owner-dashboard): Already displays KPI values with labels — extend with trend indicators
- `/tracker/summary` endpoint: Per-agent salesCount, premiumTotal, totalLeadCost, costPerSale — already covers REPT-01 and REPT-02 data
- `/owner/summary` endpoint: Top-level KPIs with range filter — extend for trend comparisons
- `exportCSV()` / `exportDetailedCSV()` (payroll-dashboard): Client-side CSV generation pattern — reuse for agent performance export
- `dateRange()` helper (routes/index.ts): Converts range string (today/week/month) to gte/lt date bounds

### Established Patterns
- Date range filtering via `?range=` query parameter on summary endpoints
- Prisma `groupBy` and `aggregate` for data aggregation (used in sales-board/summary)
- `asyncHandler` + Zod validation for all API routes
- Inline React.CSSProperties with dark glassmorphism theme
- Socket.IO `sale:changed` for real-time dashboard updates

### Integration Points
- Owner dashboard `fetchData()` already calls `/owner/summary` and `/tracker/summary` in parallel — extend to include trend data
- Manager dashboard tracker tab renders agent performance table from `/tracker/summary` — enhance with commission data
- Payroll dashboard exports tab — potential home for agent performance CSV export button
- Socket.IO patching on owner dashboard already updates summary on sale events — extend to patch trend data

</code_context>

<specifics>
## Specific Ideas

- No charting library — tables with trend indicators (arrows + percentages) are sufficient for v1
- Reuse existing endpoints where possible rather than creating parallel reporting endpoints
- Agent performance is already computed — the gap is surfacing it clearly, not recalculating it
- Period summaries should align with existing Sun-Sat payroll periods for consistency

</specifics>

<deferred>
## Deferred Ideas

- Interactive charts and data visualizations — future enhancement
- Drill-down from summary to individual sale records — future enhancement
- Historical trend graphs over many periods — future enhancement
- Custom date range reporting (beyond today/week/month) — future enhancement
- Revenue forecasting or projections — out of scope

</deferred>

---

*Phase: 08-reporting*
*Context gathered: 2026-03-16*
