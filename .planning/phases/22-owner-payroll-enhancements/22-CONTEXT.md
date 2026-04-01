# Phase 22: Owner & Payroll Enhancements - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Surface CS (service staff) payroll totals on the owner dashboard period summary table, and enhance the payroll detailed CSV export to produce agent-first print card layout with service staff in a separate trailing section.

</domain>

<decisions>
## Implementation Decisions

### CS Payroll on Owner Dashboard
- **D-01:** CS payroll total appears as a new column in the period summary table — NOT as a separate StatCard in the overview grid
- **D-02:** The column shows the sum of ServicePayrollEntry totalPay for each period, displayed alongside the existing "Commission Paid" column
- **D-03:** Real-time updates via Socket.IO when service payroll entries change (existing `emitCSChanged` pattern)

### Print Card CSV Export
- **D-04:** Agent-first grouping — one pay card block per agent per week. For a 1-month export with 10 agents and 4 weeks, produces 40 pay card blocks
- **D-05:** Within each agent: weeks ordered chronologically. Agents ordered alphabetically by name
- **D-06:** Each pay card block: header row (agent name + week range) → individual sale rows → subtotal row
- **D-07:** Enhances/replaces the existing "Detailed CSV" export button in PayrollExports.tsx — not a third export option

### Service Entries in Export
- **D-08:** Service staff pay cards appear in a separate section at the end of the CSV, after all commission agent pay cards
- **D-09:** Service staff section uses its own column layout: basePay, bonus, deductions, totalPay (not the commission/fronted/hold columns)

### Claude's Discretion
- Column header naming (e.g., "CS Payroll" vs "Service Payroll" vs "Service Total")
- Whether the service staff section in CSV gets its own header row distinguishing it from the commission section
- Handling of agents with zero entries in a given week (skip vs show empty card)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Owner Dashboard
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx` — Period summary table, StatCards, date range filtering, Socket.IO integration
- `apps/ops-dashboard/app/(dashboard)/owner/page.tsx` — Owner tab structure and section routing

### Payroll Export
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` — Existing Summary CSV + Detailed CSV export logic with agent grouping and subtotals

### API Routes
- `apps/ops-api/src/routes/admin.ts` — Owner-facing endpoints (agent KPIs, permissions, storage stats)
- `apps/ops-api/src/routes/service.ts` — Service agent and service payroll entry endpoints
- `apps/ops-api/src/routes/payroll.ts` — Payroll period and entry endpoints

### Services
- `apps/ops-api/src/services/reporting.ts` — computeTrend, buildPeriodSummary helpers
- `apps/ops-api/src/socket.ts` — Socket.IO event emitters (emitCSChanged, emitSaleChanged)

### Data Model
- `prisma/schema.prisma` — ServicePayrollEntry model (basePay, bonusAmount, deductionAmount, totalPay)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PayrollExports.exportDetailedCSV()` — Already has agent-sorted rows with subtotals, CSV blob download pattern. Needs restructuring from period-first to agent-first grouping.
- `OwnerOverview.tsx` period summary table — Already fetches and displays per-period data with date range filtering. Adding a column is straightforward.
- `StatCard` component from `@ops/ui` — Available but NOT needed per D-01.
- `DateRangeFilter` + `KPI_PRESETS` — Already wired into both owner overview and payroll exports.
- `emitCSChanged` Socket.IO event — Already fires on service payroll entry changes; owner dashboard just needs to listen.

### Established Patterns
- Inline React.CSSProperties with dark glassmorphism theme — no Tailwind
- `authFetch()` for API calls with Bearer token
- `buildDateParams()` helper for date range query strings
- CSV export via client-side Blob + anchor click (no server-side CSV generation)

### Integration Points
- Owner overview fetches period summary from API — endpoint needs to include CS payroll totals per period
- PayrollExports receives `periods` prop with entries and serviceEntries already loaded — restructure export logic client-side
- Socket.IO `cs:changed` event already available in owner dashboard via `useSocketContext()`

</code_context>

<specifics>
## Specific Ideas

- Print card layout mirrors how physical pay cards would be handed to agents: each agent gets their stack of weekly cards
- Service staff section at the end is visually distinct (different columns) so payroll staff can separate them if needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-owner-payroll-enhancements*
*Context gathered: 2026-03-24*
