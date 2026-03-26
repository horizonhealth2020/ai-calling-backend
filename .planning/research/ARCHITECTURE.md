# Architecture Patterns

**Domain:** Lead source timing analytics for sales operations platform
**Researched:** 2026-03-26

## Recommended Architecture

The lead source timing analytics feature integrates as a **new API route module + new dashboard sub-tab** into the existing Express/Prisma/Next.js architecture. No new database tables are needed -- all data already exists in `ConvosoCallLog` (calls with timestamps + lead source) and `Sale` (conversions with timestamps + lead source). The core computation is server-side SQL aggregation that joins calls and sales by lead source and hour-of-day buckets.

### High-Level Data Flow

```
ConvosoCallLog + Sale tables
        |
  PostgreSQL aggregation queries (GROUP BY hour, day-of-week, lead source)
        |
  New route module: apps/ops-api/src/routes/lead-timing.ts
        |
  3 API endpoints (heatmap, sparklines, recommendation)
        |
  New dashboard component: ManagerTimingAnalytics.tsx
  (also embedded in OwnerOverview or as Owner sub-tab)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `routes/lead-timing.ts` | New route module -- 3 GET endpoints for timing analytics | Prisma (ConvosoCallLog, Sale, LeadSource) |
| `routes/index.ts` | Register new `leadTimingRoutes` import (1-line addition) | lead-timing.ts |
| `ManagerTracker.tsx` | Existing tracker -- rename tab label to "Performance Tracker", add timing analytics section below existing content | lead-timing API endpoints |
| `LeadTimingHeatmap.tsx` | New component -- heatmap grid (source x hour), toggle day-of-week/week-of-month | GET `/api/lead-timing/heatmap` |
| `LeadTimingSparklines.tsx` | New component -- table with 7-day sparkline per source | GET `/api/lead-timing/sparklines` |
| `BestSourceCard.tsx` | New component -- recommendation card for current hour | GET `/api/lead-timing/recommendation` |
| `LeadTimingDateFilter.tsx` | Independent date range filter (separate from global DateRangeContext) | Local state, passed as query params |
| Owner dashboard | Embed same components (read-only) in OwnerKPIs or OwnerOverview | Same API endpoints (OWNER_VIEW role) |

## New API Endpoints

### 1. GET `/api/lead-timing/heatmap`

Returns close rate (sales/calls) bucketed by lead source, hour-of-day, and either day-of-week or week-of-month.

**Query params:**
- `range`: `7d` | `30d` | `60d` | `90d` (required, or custom from/to)
- `from`, `to`: custom date range (YYYY-MM-DD)
- `groupBy`: `dow` (day-of-week, default) | `wom` (week-of-month)

**Auth:** `requireAuth` -- visible to MANAGER, OWNER_VIEW, SUPER_ADMIN.

**Response shape:**
```typescript
{
  sources: Array<{
    leadSourceId: string;
    leadSourceName: string;
    cells: Array<{
      hour: number;       // 0-23
      group: number;      // 0-6 (dow) or 1-5 (wom)
      calls: number;
      sales: number;
      closeRate: number;  // sales/calls, 0-1
    }>;
  }>;
}
```

**PostgreSQL aggregation strategy:**

```sql
-- Calls by lead source, hour, day-of-week
SELECT
  lead_source_id,
  EXTRACT(HOUR FROM call_timestamp AT TIME ZONE 'America/New_York') AS hour,
  EXTRACT(DOW FROM call_timestamp AT TIME ZONE 'America/New_York') AS dow,
  COUNT(*) AS call_count
FROM convoso_call_logs
WHERE call_timestamp >= $1 AND call_timestamp < $2
  AND agent_id IS NOT NULL
  AND lead_source_id IS NOT NULL
GROUP BY lead_source_id, hour, dow;

-- Sales by lead source, hour, day-of-week
SELECT
  lead_source_id,
  EXTRACT(HOUR FROM created_at AT TIME ZONE 'America/New_York') AS hour,
  EXTRACT(DOW FROM created_at AT TIME ZONE 'America/New_York') AS dow,
  COUNT(*) AS sale_count
FROM sales
WHERE created_at >= $1 AND created_at < $2
  AND status = 'RAN'
GROUP BY lead_source_id, hour, dow;
```

**Why raw SQL over Prisma:** Prisma does not support `EXTRACT()`, `AT TIME ZONE`, or `GROUP BY` computed expressions. Use `prisma.$queryRaw` with tagged template literals for parameterized queries. This is the same approach the codebase would need -- the existing codebase uses Prisma `groupBy` where possible, but timing bucket aggregation requires raw SQL.

**Why `America/New_York`:** The business operates on Eastern Time (confirmed by Luxon usage in payroll for `America/New_York`). Heatmap cells should reflect the business's operating hours, not UTC. Convoso timestamps are stored as UTC after conversion from Pacific in the poller.

**Why `created_at` for sales (not `sale_date`):** `sale_date` is a date-only field set by the manager (day the sale happened). `created_at` captures when the sale was entered and has timestamp precision needed for hour bucketing. However, `sale_date` with `callDateTime` (if populated from Convoso) could be an alternative. Decision: use `created_at` as primary, with a note that `callDateTime` would be more accurate if consistently populated.

### 2. GET `/api/lead-timing/sparklines`

Returns 7-day rolling conversion data per lead source for sparkline rendering.

**Query params:**
- `range`: `7d` | `30d` | `60d` | `90d` (or custom from/to)

**Response shape:**
```typescript
{
  sources: Array<{
    leadSourceId: string;
    leadSourceName: string;
    days: Array<{
      date: string;      // YYYY-MM-DD
      calls: number;
      sales: number;
      closeRate: number;
    }>;
    avgCloseRate: number;
    totalCalls: number;
    totalSales: number;
  }>;
}
```

**PostgreSQL query:**
```sql
SELECT
  lead_source_id,
  DATE(call_timestamp AT TIME ZONE 'America/New_York') AS day,
  COUNT(*) AS call_count
FROM convoso_call_logs
WHERE call_timestamp >= $1 AND call_timestamp < $2
  AND agent_id IS NOT NULL
  AND lead_source_id IS NOT NULL
GROUP BY lead_source_id, day
ORDER BY lead_source_id, day;
```

Parallel query for sales grouped by `DATE(created_at)` and `lead_source_id`. Join in application code (TypeScript) since the two result sets come from different tables.

### 3. GET `/api/lead-timing/recommendation`

Returns the best lead source for the current hour based on historical close rates.

**Query params:**
- `range`: lookback window (default `30d`)

**Response shape:**
```typescript
{
  currentHour: number;
  recommendation: {
    leadSourceId: string;
    leadSourceName: string;
    closeRate: number;
    sampleSize: number;
    confidence: 'high' | 'medium' | 'low';  // based on sample size thresholds
  } | null;
  alternatives: Array<{
    leadSourceId: string;
    leadSourceName: string;
    closeRate: number;
    sampleSize: number;
  }>;
}
```

**Logic:** Query calls and sales for the current hour-of-day (Eastern) across the lookback window, grouped by lead source. Rank by close rate. Apply confidence thresholds:
- HIGH: >= 50 calls in that hour slot
- MEDIUM: 20-49 calls
- LOW: < 20 calls (flag as insufficient data)

Return `null` recommendation if no source has >= 10 calls in the hour slot.

## Integration Points with Existing Code

### API Layer (apps/ops-api/)

**New files:**
- `src/routes/lead-timing.ts` -- new route module (follows existing pattern: Router, Zod validation, asyncHandler, requireAuth)

**Modified files:**
- `src/routes/index.ts` -- add `import leadTimingRoutes from "./lead-timing"` and `router.use(leadTimingRoutes)` (2 lines)

**Reused helpers from `routes/helpers.ts`:**
- `zodErr()` for validation errors
- `asyncHandler()` for async error forwarding
- `dateRange()` -- needs extension to support `60d` and `90d` presets, OR the lead-timing route handles its own date math (preferred to avoid touching shared helper)

**Auth:** Use `requireAuth` only (no `requireRole`). The Manager and Owner tabs both need access. SUPER_ADMIN bypasses automatically. If tighter control needed later, add `requireRole("MANAGER", "OWNER_VIEW", "SUPER_ADMIN")`.

### Dashboard Layer (apps/ops-dashboard/)

**New files (in `app/(dashboard)/manager/`):**
- `LeadTimingHeatmap.tsx` -- heatmap grid component
- `LeadTimingSparklines.tsx` -- sparklines table component
- `BestSourceCard.tsx` -- recommendation card component
- `LeadTimingSection.tsx` -- wrapper that composes all three + independent date filter

**Modified files:**
- `app/(dashboard)/manager/page.tsx` -- rename "Agent Tracker" nav label to "Performance Tracker" in `NAV_ITEMS` array
- `app/(dashboard)/manager/ManagerTracker.tsx` -- import and render `LeadTimingSection` below existing tracker content (or as a collapsible section)
- `app/(dashboard)/owner/OwnerOverview.tsx` or `OwnerKPIs.tsx` -- import and render `BestSourceCard` + `LeadTimingHeatmap` (subset of timing components)

### Independent Date Filter

The timing analytics section uses its **own local date filter state**, not the global `DateRangeContext`. Rationale: the existing global date range controls payroll-aligned week presets (Current Week, Last Week, 30 Days). The timing analytics needs different presets (Last Week, 30 Days, 60 Days, 90 Days) and changing the global filter would disrupt the tracker KPIs above.

Implementation: local `useState<DateRangeFilterValue>` in `LeadTimingSection.tsx` with a `DateRangeFilter` component using custom presets.

### Database Layer

**No new tables needed.** All data exists:
- `convoso_call_logs` -- calls with `call_timestamp`, `lead_source_id`, `agent_id`
- `sales` -- conversions with `created_at`, `lead_source_id`, `status`
- `lead_sources` -- names for display

**New index needed:**
```prisma
// On Sale model, add:
@@index([leadSourceId, createdAt])
```

The existing `@@index([callTimestamp])` and `@@index([agentId, leadSourceId, callTimestamp])` on ConvosoCallLog already cover heatmap queries well. However, the sales table lacks a composite index on `[leadSourceId, createdAt]` -- it only has `@@index([saleDate])`. The timing queries filter and group by `lead_source_id` + timestamp, so this index is important for performance.

**Migration:** Single `CREATE INDEX` migration. No schema changes to models.

## Patterns to Follow

### Pattern 1: Raw SQL with Prisma.$queryRaw

**What:** Use `prisma.$queryRaw` for aggregation queries that need PostgreSQL-specific functions (`EXTRACT`, `AT TIME ZONE`, computed `GROUP BY`).

**When:** The heatmap and sparkline queries require time-zone-aware date extraction that Prisma's query builder cannot express.

**Example:**
```typescript
import { Prisma } from "@prisma/client";

interface HourBucket {
  lead_source_id: string;
  hour: number;
  dow: number;
  call_count: bigint;
}

const callBuckets = await prisma.$queryRaw<HourBucket[]>(Prisma.sql`
  SELECT
    lead_source_id,
    EXTRACT(HOUR FROM call_timestamp AT TIME ZONE 'America/New_York')::int AS hour,
    EXTRACT(DOW FROM call_timestamp AT TIME ZONE 'America/New_York')::int AS dow,
    COUNT(*)::bigint AS call_count
  FROM convoso_call_logs
  WHERE call_timestamp >= ${gte} AND call_timestamp < ${lt}
    AND agent_id IS NOT NULL
    AND lead_source_id IS NOT NULL
  GROUP BY lead_source_id, hour, dow
`);
```

**Why tagged template:** `Prisma.sql` provides parameterized queries that prevent SQL injection. Never use string interpolation for date values.

**Gotcha:** `COUNT(*)` returns `bigint` in PostgreSQL. Convert with `Number()` before sending as JSON (BigInt is not JSON-serializable).

### Pattern 2: Parallel Query Execution

**What:** Run independent call and sale aggregation queries in parallel with `Promise.all()`.

**When:** Heatmap and sparkline endpoints each need data from two tables (calls + sales).

**Example:**
```typescript
const [callBuckets, saleBuckets, leadSources] = await Promise.all([
  prisma.$queryRaw<CallBucket[]>(callQuery),
  prisma.$queryRaw<SaleBucket[]>(saleQuery),
  prisma.leadSource.findMany({ where: { active: true }, select: { id: true, name: true } }),
]);
```

This pattern is already used throughout the codebase (see `tracker/summary` route which runs 4 parallel queries).

### Pattern 3: Application-Level Join

**What:** Merge call counts and sale counts by building a Map keyed on `leadSourceId + hour + group`, then compute close rates in TypeScript.

**When:** The two raw SQL queries return separate result sets that need to be combined.

**Example:**
```typescript
const key = (lsId: string, hour: number, group: number) => `${lsId}:${hour}:${group}`;

const callMap = new Map<string, number>();
for (const row of callBuckets) {
  callMap.set(key(row.lead_source_id, row.hour, row.dow), Number(row.call_count));
}

// Build response by iterating lead sources x hours x groups
for (const ls of leadSources) {
  for (let hour = 0; hour < 24; hour++) {
    for (let group = 0; group < 7; group++) {
      const k = key(ls.id, hour, group);
      const calls = callMap.get(k) ?? 0;
      const sales = saleMap.get(k) ?? 0;
      const closeRate = calls > 0 ? sales / calls : 0;
      // push to response
    }
  }
}
```

### Pattern 4: Inline CSSProperties for Visualization

**What:** All UI uses inline `React.CSSProperties` constant objects. The heatmap grid cells use computed background colors via inline styles.

**When:** Building the heatmap grid, sparkline SVGs, recommendation card.

**Example:**
```typescript
const CELL: React.CSSProperties = {
  width: 36, height: 36,
  borderRadius: radius.sm,
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 11, fontWeight: 600,
  transition: "all 0.2s ease",
};

// Dynamic color based on close rate
function cellColor(closeRate: number, calls: number): string {
  if (calls < 5) return "rgba(255,255,255,0.03)"; // insufficient data
  if (closeRate >= 0.15) return "rgba(34,197,94,0.5)";  // hot
  if (closeRate >= 0.08) return "rgba(234,179,8,0.3)";  // warm
  return "rgba(239,68,68,0.2)";                          // cold
}
```

### Pattern 5: SVG Sparklines (No Library)

**What:** Render sparklines as inline SVG `<polyline>` elements. No charting library needed for simple 7-point trend lines.

**When:** The sparklines table shows a small trend line per lead source.

**Example:**
```typescript
function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 0.01);
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - (v / max) * height}`
  ).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={colors.accent} strokeWidth={2} />
    </svg>
  );
}
```

**Why no charting library:** The project uses zero external UI libraries beyond Lucide icons. Adding recharts/visx for 7-point sparklines would be overkill. SVG polylines are sufficient and keep bundle size zero-addition.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Aggregation

**What:** Fetching raw call logs and sales to the browser and computing heatmap buckets in JavaScript.

**Why bad:** ConvosoCallLog could have tens of thousands of rows for a 90-day window. Transferring and processing this on the client wastes bandwidth and causes UI jank.

**Instead:** All aggregation happens server-side in PostgreSQL. The API returns pre-computed cell values (typically < 2KB per lead source for a full 24x7 heatmap).

### Anti-Pattern 2: Using the Global DateRangeContext

**What:** Wiring timing analytics to the shared `useDateRange()` context.

**Why bad:** The global context defaults to "Current Week" and controls payroll-aligned KPIs. Timing analytics needs 30/60/90-day windows to have meaningful sample sizes. Changing the global filter would break the tracker KPIs above.

**Instead:** Use local state in `LeadTimingSection.tsx`. The section has its own `DateRangeFilter` with analytics-appropriate presets.

### Anti-Pattern 3: Storing Pre-Aggregated Heatmap Data

**What:** Creating a materialized table or cron job that pre-computes heatmap cells.

**Why bad:** Premature optimization. The queries aggregate a few thousand to tens of thousands of rows with good indexes. PostgreSQL handles this in < 100ms. Adding a materialized view introduces cache invalidation complexity.

**Instead:** Query live data on each request. If performance becomes an issue at scale, add a simple in-memory cache with 5-minute TTL in the route handler (a Map with timestamp check, same pattern the codebase uses elsewhere).

### Anti-Pattern 4: Using `sale_date` for Hour Bucketing

**What:** Using the `sale_date` field to determine what hour a sale happened.

**Why bad:** `sale_date` is a date-only value (set to noon via `new Date(parsed.saleDate + "T12:00:00")`). It has no hour precision. All sales would bucket into hour 12.

**Instead:** Use `created_at` (has full timestamp precision) or `callDateTime` if populated from Convoso integration.

## Build Order (Based on Data Dependencies)

The following order ensures each step produces testable output and respects data availability:

### Phase 1: Database Index + API Route Module

1. **Migration:** Add `@@index([leadSourceId, createdAt])` to Sale model. Run `npm run db:migrate`.
2. **Route module:** Create `src/routes/lead-timing.ts` with all 3 endpoints. Register in `src/routes/index.ts`.
3. **Test with curl/Postman:** Verify endpoints return correct aggregated data against existing ConvosoCallLog + Sale records.

**Why first:** The API must exist and return correct data before any frontend work begins. The heatmap component is useless without a working data source.

### Phase 2: Heatmap Component + Tab Rename

1. **Rename tab:** Change "Agent Tracker" to "Performance Tracker" in `NAV_ITEMS`.
2. **Build `LeadTimingSection.tsx`:** Wrapper with independent date filter.
3. **Build `LeadTimingHeatmap.tsx`:** Grid of colored cells, source x hour, with day-of-week/week-of-month toggle.
4. **Integrate into ManagerTracker:** Render `LeadTimingSection` below existing tracker content.

**Why second:** The heatmap is the highest-value visualization and validates the API data shape is correct.

### Phase 3: Sparklines + Recommendation Card

1. **Build `LeadTimingSparklines.tsx`:** Table with SVG sparklines and close rate numbers.
2. **Build `BestSourceCard.tsx`:** Recommendation card with confidence indicator.
3. **Add to `LeadTimingSection`:** Compose all three components.

**Why third:** These build on the same data patterns established in Phase 2 and add incremental value.

### Phase 4: Owner Dashboard Integration

1. **Embed timing analytics in Owner dashboard:** Import `BestSourceCard` and `LeadTimingHeatmap` into OwnerOverview or OwnerKPIs.
2. **Verify role access:** Confirm OWNER_VIEW can hit lead-timing endpoints.

**Why last:** Owner dashboard is a read-only consumer of the same components. No new API work needed.

## Scalability Considerations

| Concern | Current (< 10K call logs) | At 100K call logs | At 1M call logs |
|---------|---------------------------|-------------------|-----------------|
| Heatmap query time | < 50ms | < 200ms (indexes cover it) | Add 5-min in-memory cache |
| Sparkline query time | < 30ms | < 100ms | Same cache strategy |
| Recommendation query | < 20ms (single hour filter) | < 50ms | Negligible (narrow filter) |
| Response payload | ~2KB per source | Same (aggregated) | Same (aggregated) |
| Index storage | Negligible | ~10MB for new index | ~50MB -- acceptable |

The existing `@@index([agentId, leadSourceId, callTimestamp])` on ConvosoCallLog means the heatmap queries need a sequential scan only on the `lead_source_id` + `call_timestamp` dimensions, which PostgreSQL can handle efficiently even at 100K rows. A dedicated `@@index([leadSourceId, callTimestamp])` (without agentId) would be optimal for the heatmap query but is not critical at current data volumes.

## Sources

- Existing codebase: `apps/ops-api/src/routes/sales.ts` (tracker/summary pattern, parallel queries)
- Existing codebase: `apps/ops-api/src/workers/convosoKpiPoller.ts` (ConvosoCallLog write pattern, timezone handling)
- Existing codebase: `apps/ops-api/src/routes/helpers.ts` (dateRange utility, Zod helpers)
- Existing codebase: `prisma/schema.prisma` (ConvosoCallLog indexes, Sale model)
- Existing codebase: `apps/ops-dashboard/app/(dashboard)/manager/page.tsx` (tab structure, NAV_ITEMS)
- Existing codebase: `apps/ops-dashboard/lib/DateRangeContext.tsx` (global date range pattern)
- PostgreSQL documentation: `EXTRACT()`, `AT TIME ZONE` for timestamp bucketing (HIGH confidence -- core PostgreSQL features)
- Prisma documentation: `$queryRaw` for raw SQL with tagged template parameterization (HIGH confidence)
