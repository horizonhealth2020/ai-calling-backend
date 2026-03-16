# Phase 8: Reporting - Research

**Researched:** 2026-03-16
**Domain:** Reporting endpoints, trend KPIs, period summaries, CSV export
**Confidence:** HIGH

## Summary

Phase 8 is primarily an enhancement phase, not a greenfield build. The existing codebase already has most of the data retrieval infrastructure needed: `/tracker/summary` returns per-agent salesCount, premiumTotal, totalLeadCost, and costPerSale; `/owner/summary` returns top-level KPIs with date range filtering; and the payroll dashboard has client-side CSV generation. The work is: (1) add commission totals to tracker summary by joining payroll entry data, (2) extend `/owner/summary` to return prior-period comparison values for trend display, (3) create a period summary endpoint aggregating weekly/monthly totals, and (4) add an agent performance CSV export following the existing `exportCSV()` pattern.

The `StatCard` component in `@ops/ui` already supports a `trend` prop with `{ value: number; direction: "up" | "down" | "flat" }` -- it renders colored arrows and percentage text. This means REPT-05 trend KPIs require only backend changes (returning comparison data) and wiring the `trend` prop in the owner dashboard. No new UI components needed.

**Primary recommendation:** Extend existing endpoints rather than creating parallel reporting routes. The tracker summary needs a commission join, the owner summary needs comparison date ranges, and a single new `/reporting/periods` endpoint handles weekly/monthly aggregation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Agent performance metrics (REPT-01, REPT-02) surfaced on manager dashboard tracker -- `/tracker/summary` already returns salesCount, premiumTotal, totalLeadCost, costPerSale with date range filter
- Period summaries (REPT-03) surfaced on both manager and owner dashboards
- Trend KPIs (REPT-05) added to owner dashboard's existing StatCard row
- No new standalone "reporting" tab -- enhance existing views with reporting data
- Extend `/owner/summary` to return prior-week and prior-month comparison values alongside current values
- Display as up/down arrows with percentage change on existing StatCards
- Compare: sales count, premium total, clawbacks -- current vs prior week and prior month
- Simple colored indicators (green up, red down) -- no sparklines or charts
- New API endpoint(s) for weekly and monthly aggregate totals (commission paid, premium collected, sale count)
- Aggregation uses payroll entry data (net amounts) for commission, sale data for premium/count
- Only RAN sales included in all metrics (Phase 10 decision)
- Weekly = Sun-Sat periods matching existing payroll period structure
- Monthly = calendar month aggregation
- REPT-04 extends existing payroll export with agent performance data (not a new export system)
- Leverage existing client-side CSV pattern from payroll dashboard
- Add agent performance CSV export (agent, sales count, commission earned, cost-per-sale, lead cost)
- Existing payroll summary + detailed exports remain as-is -- no duplication
- Cost-per-sale uses existing `/tracker/summary` calculation: totalLeadCost / salesCount per agent
- No charting library -- tables with trend indicators are sufficient for v1

### Claude's Discretion
- Exact API response shape for trend comparison data
- Whether period summaries use a new endpoint or extend existing ones
- StatCard trend indicator styling (arrow icons, color shades)
- Agent performance table column ordering and sort defaults
- Whether to add commission totals to tracker summary or fetch from payroll data

### Deferred Ideas (OUT OF SCOPE)
- Interactive charts and data visualizations -- future enhancement
- Drill-down from summary to individual sale records -- future enhancement
- Historical trend graphs over many periods -- future enhancement
- Custom date range reporting (beyond today/week/month) -- future enhancement
- Revenue forecasting or projections -- out of scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REPT-01 | Per-agent sales count and total commission earned are visible | Extend `/tracker/summary` to join PayrollEntry data for commission totals; already returns salesCount |
| REPT-02 | Per-agent cost-per-sale is tracked and displayed | Already returned by `/tracker/summary` as costPerSale; enhance visibility on manager dashboard tracker table |
| REPT-03 | Weekly and monthly period summary totals are available | New endpoint aggregating PayrollEntry net amounts + Sale premium/count by week and month |
| REPT-04 | Export-ready payroll reports can be generated | Add agent performance CSV export using existing client-side Blob/URL pattern from payroll dashboard |
| REPT-05 | Owner dashboard shows trend KPIs (vs prior week/month) | Extend `/owner/summary` response with comparison data; wire `trend` prop on existing StatCard |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | existing | API routes for reporting endpoints | Already used for all ops-api routes |
| Prisma | existing | Database queries with groupBy/aggregate | Already used for all data access |
| Next.js 15 | existing | Owner and manager dashboard rendering | Already powers all frontend apps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | existing | Request validation for range/period params | All new endpoints must validate with Zod |
| @ops/ui StatCard | existing | Trend KPI display with arrow indicators | Owner dashboard trend display |
| @ops/ui AnimatedNumber | existing | Animated numeric display | Manager dashboard commission column |
| lucide-react | existing | Icons for trend indicators | Already used across all dashboards |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side CSV | Server-side CSV generation | Client-side is simpler, already established pattern, no server memory concern for this data size |
| New `/reporting/*` routes | Extending existing endpoints | Extending is preferred per user decision; keeps fewer endpoints |

## Architecture Patterns

### API Response Shape for Trend Data

Recommended shape for `/owner/summary` extension:

```typescript
// Extend existing response with comparison data
type OwnerSummaryResponse = {
  salesCount: number;
  premiumTotal: number;
  clawbacks: number;
  openPayrollPeriods: number;
  // NEW: trend comparison data
  trends: {
    salesCount: { priorWeek: number; priorMonth: number };
    premiumTotal: { priorWeek: number; priorMonth: number };
    clawbacks: { priorWeek: number; priorMonth: number };
  };
};
```

This keeps the existing response shape intact (backward compatible) and adds a `trends` object. The frontend computes percentage change: `((current - prior) / prior) * 100` and maps to `{ value, direction }` for the StatCard `trend` prop.

### Period Summary Endpoint

Recommend a new endpoint `GET /api/reporting/periods?view=weekly|monthly` rather than extending existing endpoints, because period summaries are a new concept (cross-period aggregation) not covered by current routes.

```typescript
// Response shape
type PeriodSummary = {
  period: string;        // "2026-03-08 - 2026-03-14" or "2026-03"
  salesCount: number;
  premiumTotal: number;
  commissionPaid: number; // sum of PayrollEntry netAmount
  periodStatus?: string;  // OPEN/FINALIZED (weekly only)
};

type PeriodSummaryResponse = {
  view: "weekly" | "monthly";
  periods: PeriodSummary[];
};
```

### Tracker Summary Commission Extension

Add `commissionTotal` to the existing `/tracker/summary` response by joining PayrollEntry data:

```typescript
// Extended TrackerEntry
type TrackerEntry = {
  agent: string;
  salesCount: number;
  premiumTotal: number;
  totalLeadCost: number;
  costPerSale: number;
  commissionTotal: number; // NEW: sum of PayrollEntry payoutAmount for agent
};
```

### Pattern: Date Range Comparison Queries

The existing `dateRange()` helper returns `{ gte, lt }` for today/week/month. For trend comparison, compute equivalent prior ranges:

```typescript
function priorDateRange(range: string): { priorWeek: { gte: Date; lt: Date }; priorMonth: { gte: Date; lt: Date } } {
  // priorWeek: shift current range back 7 days
  // priorMonth: shift current range back ~30 days (same day count)
}
```

Run the same Prisma queries with prior date ranges in parallel using `Promise.all`.

### Anti-Patterns to Avoid
- **Creating a separate reporting database/cache:** This is a small-scale app. Direct Prisma queries are sufficient.
- **Duplicating commission calculation logic:** Use PayrollEntry.payoutAmount/netAmount directly -- never recalculate commission in reporting code.
- **Adding chart libraries:** User explicitly deferred charts. Tables with StatCard trend indicators only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | Custom CSV serializer | Existing `rows.map(r => r.join(",")).join("\n")` pattern | Already proven in payroll dashboard with proper escaping |
| Trend arrows/colors | Custom trend indicator UI | `StatCard` `trend` prop | Already built with arrow SVGs, color logic, percentage display |
| Date range computation | Custom date math | Extend existing `dateRange()` utility | Already handles today/week/month edge cases correctly |
| Commission totals | Recalculate from sale data | `PayrollEntry.payoutAmount` and `netAmount` | Payroll entries are the source of truth for commission |

**Key insight:** The entire reporting layer can be built by querying existing PayrollEntry and Sale tables with groupBy/aggregate -- no new data models or calculation logic needed.

## Common Pitfalls

### Pitfall 1: Decimal Precision in Aggregation
**What goes wrong:** Prisma returns `Decimal` objects from `aggregate()` and `groupBy()`. Using them directly in arithmetic or JSON serialization produces strings like `"123.45"` instead of numbers.
**Why it happens:** Prisma uses `Decimal.js` internally for precision.
**How to avoid:** Always `Number()` wrap Prisma Decimal values before arithmetic or JSON response. The existing codebase does this consistently (e.g., `Number(e.payoutAmount)`).
**Warning signs:** Frontend displays `[object Object]` or NaN for financial values.

### Pitfall 2: Empty Period Comparison (Division by Zero)
**What goes wrong:** Trend percentage calculation divides by prior period value, which may be zero (new deployment, no data).
**Why it happens:** No sales in prior week/month means prior value is 0.
**How to avoid:** Guard: `prior === 0 ? (current > 0 ? "up" : "flat") : compute percentage`. Never divide by zero.
**Warning signs:** NaN or Infinity displayed in trend indicators.

### Pitfall 3: RAN-Only Filter Inconsistency
**What goes wrong:** Some queries include all statuses while others filter to RAN only, producing mismatched totals.
**Why it happens:** Phase 10 added the RAN-only rule but not all existing queries were updated.
**How to avoid:** Check existing endpoints: `/owner/summary` already filters `status: 'RAN'`; `/tracker/summary` does NOT filter by status. New reporting queries MUST filter `status: 'RAN'` per Phase 10 decision. The tracker summary commission join should also be RAN-only.
**Warning signs:** Reporting totals don't match owner dashboard KPIs.

### Pitfall 4: PayrollEntry Status Filtering
**What goes wrong:** Including ZEROED_OUT or CLAWBACK_APPLIED entries in commission totals inflates or deflates numbers.
**Why it happens:** Dead/Declined sales create $0 payroll entries (ZEROED_OUT status).
**How to avoid:** For commission totals, either: (a) filter to exclude ZEROED_OUT entries, or (b) sum `payoutAmount` which is already $0 for zeroed entries. Option (b) is simpler since the amounts are correct regardless of status.
**Warning signs:** Commission totals include phantom $0 entries that inflate "entries processed" counts.

### Pitfall 5: Tracker Summary Missing Date Filter for Commission
**What goes wrong:** Commission totals are fetched globally while sales are date-filtered, causing mismatch.
**Why it happens:** PayrollEntry is tied to payroll periods (not sale dates), so the date filter logic differs.
**How to avoid:** Join PayrollEntry through Sale (which has saleDate) to maintain consistent date range filtering.
**Warning signs:** "This Week" shows 3 sales but commission total from all time.

## Code Examples

### Extending /tracker/summary with Commission

```typescript
// In the existing /tracker/summary handler, add commission aggregation
const commissionByAgent = await prisma.payrollEntry.groupBy({
  by: ['agentId'],
  _sum: { payoutAmount: true },
  where: {
    sale: {
      status: 'RAN',
      ...(dr ? { saleDate: { gte: dr.gte, lt: dr.lt } } : {}),
    },
  },
});

const commMap = new Map(commissionByAgent.map(c => [c.agentId, Number(c._sum.payoutAmount ?? 0)]));

// In the summary.map():
return {
  agent: agent.name,
  salesCount,
  premiumTotal,
  totalLeadCost,
  costPerSale: salesCount > 0 ? totalLeadCost / salesCount : 0,
  commissionTotal: commMap.get(agent.id) ?? 0,
};
```

### Trend Comparison in /owner/summary

```typescript
// Compute comparison date ranges
function shiftRange(dr: { gte: Date; lt: Date }, days: number) {
  return {
    gte: new Date(dr.gte.getTime() - days * 86400000),
    lt: new Date(dr.lt.getTime() - days * 86400000),
  };
}

const priorWeekDr = shiftRange(dr, 7);
const priorMonthDr = shiftRange(dr, 30);

// Run all three ranges in parallel
const [current, priorWeek, priorMonth] = await Promise.all([
  fetchSummaryData(dr),       // existing logic extracted
  fetchSummaryData(priorWeekDr),
  fetchSummaryData(priorMonthDr),
]);

res.json({
  ...current,
  trends: {
    salesCount: { priorWeek: priorWeek.salesCount, priorMonth: priorMonth.salesCount },
    premiumTotal: { priorWeek: priorWeek.premiumTotal, priorMonth: priorMonth.premiumTotal },
    clawbacks: { priorWeek: priorWeek.clawbacks, priorMonth: priorMonth.clawbacks },
  },
});
```

### Client-Side Trend Calculation

```typescript
function computeTrend(current: number, prior: number): { value: number; direction: "up" | "down" | "flat" } {
  if (prior === 0) return current > 0 ? { value: 100, direction: "up" } : { value: 0, direction: "flat" };
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return { value: 0, direction: "flat" };
  return { value: Math.abs(pct), direction: pct > 0 ? "up" : "down" };
}

// Usage with StatCard
<StatCard
  label="Total Sales"
  value={summary.salesCount}
  trend={computeTrend(summary.salesCount, summary.trends.salesCount.priorWeek)}
  icon={<BarChart3 size={18} />}
  accent={colors.accentTeal}
/>
```

### Agent Performance CSV Export

```typescript
function exportAgentPerformanceCSV(tracker: TrackerEntry[]) {
  const rows = [["Agent", "Sales Count", "Commission Earned", "Premium Total", "Lead Cost", "Cost Per Sale"]];
  for (const t of tracker) {
    rows.push([
      t.agent,
      String(t.salesCount),
      t.commissionTotal.toFixed(2),
      t.premiumTotal.toFixed(2),
      t.totalLeadCost.toFixed(2),
      t.costPerSale.toFixed(2),
    ]);
  }
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })),
    download: "agent-performance.csv",
  });
  a.click();
}
```

### Period Summary Endpoint

```typescript
router.get("/reporting/periods", requireAuth, requireRole("MANAGER", "OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const view = req.query.view === "monthly" ? "monthly" : "weekly";

  if (view === "weekly") {
    // Use existing PayrollPeriod structure
    const periods = await prisma.payrollPeriod.findMany({
      include: {
        entries: {
          where: { sale: { status: 'RAN' } },
          select: { payoutAmount: true, netAmount: true, sale: { select: { premium: true } } },
        },
      },
      orderBy: { weekStart: "desc" },
      take: 12, // last 12 weeks
    });
    const result = periods.map(p => ({
      period: `${p.weekStart.toISOString().slice(0,10)} - ${p.weekEnd.toISOString().slice(0,10)}`,
      salesCount: p.entries.length,
      premiumTotal: p.entries.reduce((s, e) => s + Number(e.sale.premium), 0),
      commissionPaid: p.entries.reduce((s, e) => s + Number(e.netAmount), 0),
      periodStatus: p.status,
    }));
    return res.json({ view, periods: result });
  }

  // Monthly: aggregate by calendar month from sales
  const monthlySales = await prisma.$queryRaw`
    SELECT
      TO_CHAR(s.sale_date, 'YYYY-MM') as period,
      COUNT(*)::int as sales_count,
      COALESCE(SUM(s.premium), 0) as premium_total,
      COALESCE(SUM(pe.net_amount), 0) as commission_paid
    FROM sales s
    LEFT JOIN payroll_entries pe ON pe.sale_id = s.id
    WHERE s.status = 'RAN'
    GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
    ORDER BY period DESC
    LIMIT 6
  `;
  return res.json({ view, periods: monthlySales });
}));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No trend indicators | StatCard supports `trend` prop | Phase 6 (UI components) | Trend display ready to use, zero UI work needed |
| All sale statuses counted | RAN-only filtering | Phase 10 | All reporting queries MUST filter status='RAN' |
| No commission in tracker | Tracker shows sales/premium/cost only | Current state | Phase 8 adds commissionTotal to tracker summary |

**Already implemented:**
- `StatCard` trend prop with up/down/flat arrows and percentage
- `/tracker/summary` with per-agent metrics and date range filter
- `/owner/summary` with KPIs and date range filter
- Client-side CSV export with proper escaping in payroll dashboard
- `dateRange()` utility for today/week/month

## Open Questions

1. **Monthly aggregation: Prisma vs raw SQL**
   - What we know: Weekly aggregation can use existing PayrollPeriod grouping. Monthly requires grouping by calendar month across periods.
   - What's unclear: Whether Prisma `groupBy` can handle month extraction or if raw SQL is needed.
   - Recommendation: Use `$queryRaw` for monthly -- it's cleaner than trying to extract months in Prisma's query builder. Keep weekly using Prisma relations.

2. **Tracker summary performance with commission join**
   - What we know: Adding `groupBy` on PayrollEntry is one extra query.
   - What's unclear: Whether the join through Sale for date filtering has acceptable performance.
   - Recommendation: Use `Promise.all` to run commission aggregation in parallel with existing tracker queries. Monitor query time. The data volume is small (tens of agents, hundreds of sales).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest with ts-jest |
| Config file | `apps/ops-api/jest.config.ts` |
| Quick run command | `cd apps/ops-api && npx jest --testPathPattern="<test>" --no-coverage -x` |
| Full suite command | `cd apps/ops-api && npx jest --no-coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REPT-01 | Commission totals returned in tracker summary | unit | `cd apps/ops-api && npx jest --testPathPattern="reporting" -x` | No -- Wave 0 |
| REPT-02 | Cost-per-sale already returned (visibility only) | manual-only | N/A -- UI enhancement, visually verify column prominence | N/A |
| REPT-03 | Period summary aggregation returns correct weekly/monthly totals | unit | `cd apps/ops-api && npx jest --testPathPattern="reporting" -x` | No -- Wave 0 |
| REPT-04 | Agent performance CSV export generates correct output | manual-only | N/A -- client-side CSV, verify download in browser | N/A |
| REPT-05 | Trend comparison values computed correctly | unit | `cd apps/ops-api && npx jest --testPathPattern="reporting" -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/ops-api && npx jest --no-coverage -x`
- **Per wave merge:** `cd apps/ops-api && npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/ops-api/src/services/__tests__/reporting.test.ts` -- covers REPT-01, REPT-03, REPT-05 trend computation logic
- [ ] Extract `computeTrendComparison()` and `buildPeriodSummary()` as pure functions for testability (following Phase 10 pattern of extracting testable pure functions)

## Sources

### Primary (HIGH confidence)
- `apps/ops-api/src/routes/index.ts` lines 745-787 -- `/tracker/summary` implementation
- `apps/ops-api/src/routes/index.ts` lines 1075-1086 -- `/owner/summary` implementation
- `packages/ui/src/components/StatCard.tsx` -- StatCard with trend prop (already supports arrows + percentage)
- `apps/payroll-dashboard/app/page.tsx` lines 1557-1635 -- existing CSV export pattern
- `apps/owner-dashboard/app/page.tsx` lines 480-522 -- StatCard usage in owner dashboard
- `prisma/schema.prisma` -- PayrollEntry, PayrollPeriod, Sale model definitions

### Secondary (MEDIUM confidence)
- `apps/manager-dashboard/app/page.tsx` -- TrackerEntry type and tracker table rendering

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries and patterns already exist in the codebase
- Architecture: HIGH -- extending existing endpoints with well-understood Prisma queries
- Pitfalls: HIGH -- identified from direct code review of existing implementations

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, no external dependencies)
