# Phase 30: Lead Source Timing Analytics - Research

**Researched:** 2026-03-26
**Domain:** Time-based sales analytics (heatmap, sparklines, recommendation) + commission fix
**Confidence:** HIGH

## Summary

Phase 30 adds a lead source timing analytics section to the Manager and Owner dashboards, fixes two Convoso timezone bugs, adds database indexes for aggregation performance, and fixes a fallback bundle commission logic error. The work spans four layers: data layer fixes (DST handling, business hours check), new API endpoints (heatmap, sparklines, recommendation), new dashboard components (heatmap grid, sparklines table, best-source card with independent date filter), and a targeted commission logic fix in `resolveBundleRequirement()`.

All prior research (ARCHITECTURE.md, PITFALLS.md, STACK.md, FEATURES.md) has been completed and validated. No new dependencies are needed -- all visualization is raw SVG + React inline CSSProperties. The critical technical risks are timezone correctness in aggregation queries (must use `AT TIME ZONE 'America/New_York'`) and the `BigInt` serialization gotcha from `prisma.$queryRaw` COUNT results.

**Primary recommendation:** Build data layer fixes and API endpoints first (they are independently testable), then UI components, then owner dashboard integration. The commission fix is independent and can ship in any order.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Red-to-green gradient color scale for heatmap cells (red = low close rate, yellow = mid, green = high). Must contrast well against dark glassmorphism background.
- **D-02:** Dropdown selector for grouping mode with three options: Day of Week, Week of Month, Month of Year. Compact dropdown matching existing dashboard control patterns.
- **D-03:** Low sample size cells (< 10 calls) visually de-emphasized with reduced opacity. Tooltip shows exact close rate, call count, sale count.
- **D-04:** All times displayed in Eastern timezone (America/New_York). Convoso Pacific timestamps and Sale UTC timestamps both converted to ET for consistent display.
- **D-05:** Use Sale.createdAt (not Sale.saleDate) for hourly bucketing -- saleDate lacks hour precision.
- **D-06:** Close rate = aggregate (sales count / call count) per source per time bucket. No FK between calls and sales -- correlation is by leadSourceId + time window, not row-level matching.
- **D-07:** Section is collapsible with a header toggle. Default collapsed on page load to avoid overwhelming the tracker view.
- **D-08:** Layout within section is Claude's discretion -- pick the best arrangement of Best Source card, heatmap, and sparklines for the dark theme.
- **D-09:** Independent date range filter (Last Week / 30 Days / 60 Days / 90 Days / Custom) separate from the global DateRangeContext. Applies only to the timing analytics section.
- **D-10:** Fallback addon only qualifies for full commission when primary required addon is NOT available in the member's state. If primary IS available in that state but not in the sale, fallback does not substitute -- half commission applies.
- **D-11:** Fix is in `resolveBundleRequirement()` in payroll.ts: only enter fallback checking loop when `!requiredAvail`. Current code falls through to fallbacks even when primary is available.
- **D-12:** Rename "Agent Tracker" tab to "Performance Tracker" in manager page.tsx NAV_ITEMS.
- **D-13:** Add "Today" column to agent performance table in ManagerTracker.tsx.

### Claude's Discretion
- Analytics section internal layout (card + heatmap + sparklines arrangement)
- Exact heatmap cell sizing and spacing
- Sparkline SVG dimensions and styling
- Loading skeleton design for analytics section
- Error state handling for insufficient data
- Exact gradient RGB values for red-to-green scale on dark theme

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | Convoso poller DST handling uses Luxon instead of month-based approximation | Fix `convosoDateToUTC` at line 11 of convosoKpiPoller.ts; replace month-based check with Luxon `DateTime.fromFormat()` with zone `America/Los_Angeles` |
| DATA-02 | Convoso poller business hours check uses America/Los_Angeles local time | Fix `new Date().getHours()` in convosoKpiPoller.ts to use `DateTime.now().setZone('America/Los_Angeles')` |
| DATA-03 | Database indexes on ConvosoCallLog(leadSourceId, callTimestamp) and Sale(leadSourceId, createdAt) | Prisma migration adding two `@@index` entries; current ConvosoCallLog has `[agentId, leadSourceId, callTimestamp]` (leading agentId is suboptimal) and Sale lacks composite index on these columns |
| DATA-04 | API endpoint returns heatmap data grouped by source x hour with grouping toggle | New `GET /api/lead-timing/heatmap` endpoint using `prisma.$queryRaw` with `AT TIME ZONE 'America/New_York'`; parallel queries for calls + sales joined in application code |
| DATA-05 | API endpoint returns sparkline data: daily close rate per source per daypart for 7 days | New `GET /api/lead-timing/sparklines` endpoint; dayparts: morning(8-12), afternoon(12-17), evening(17-20) |
| DATA-06 | API endpoint returns recommendation data: top sources for current hour | New `GET /api/lead-timing/recommendation` endpoint; filters to current ET hour + day-of-week, ranks by close rate with sample thresholds |
| DATA-07 | All aggregation queries use AT TIME ZONE for consistent timezone handling | All raw SQL uses `AT TIME ZONE 'America/New_York'` on both `callTimestamp` (from ConvosoCallLog) and `created_at` (from Sales) |
| DATA-08 | All API responses include sample size (call count) per bucket | Response shapes include `calls` count per cell/bucket |
| HEAT-01 | Source x hour heatmap grid with diverging color scale | Raw SVG/HTML grid with inline `backgroundColor` computed from close rate; red-yellow-green per D-01 |
| HEAT-02 | Toggle heatmap between day-of-week, week-of-month, month-of-year | Dropdown sends `groupBy` param (`dow`, `wom`, `moy`) to heatmap endpoint; SQL uses corresponding EXTRACT expression |
| HEAT-03 | Low sample size cells de-emphasized with reduced opacity | Cells with < 10 calls get `opacity: 0.3` style per D-03 |
| HEAT-04 | Hover tooltip with exact close rate, call count, sale count | HTML tooltip div positioned on hover with cell data |
| HEAT-05 | Independent date range filter for heatmap section | Local `useState<DateRangeFilterValue>` in LeadTimingSection with custom presets array |
| REC-01 | "Best Source Right Now" card showing top source for current hour | BestSourceCard component consuming recommendation endpoint |
| REC-02 | Card shows close rate, call count, trend arrow | Trend computed by comparing current period to prior period same hour |
| REC-03 | Card shows "Not enough data" when insufficient sample | Endpoint returns `null` recommendation when no source has >= 10 calls |
| SPARK-01 | Sparklines table with 7-day close rate trends per source per daypart | Table rows per lead source, 3 sparkline columns (morning/afternoon/evening) |
| SPARK-02 | Sparklines as inline SVG polylines, no external charting library | `<svg><polyline>` component, ~30 lines, using React inline props |
| DASH-01 | Rename "Agent Tracker" to "Performance Tracker" | One-line change in NAV_ITEMS array in manager/page.tsx line 42 |
| DASH-02 | Add "Today" column to agent performance table | New column in ManagerTracker.tsx agent table; requires API change or client-side filter for today's data |
| DASH-03 | Timing analytics section renders below agent performance | LeadTimingSection imported and rendered in ManagerTracker.tsx |
| DASH-04 | Same timing analytics visible on Owner dashboard | Import LeadTimingSection into OwnerOverview.tsx |
| DASH-05 | Timing analytics accessible to MANAGER, OWNER_VIEW, SUPER_ADMIN | API uses `requireAuth` (SUPER_ADMIN bypasses); optionally add `requireRole("MANAGER", "OWNER_VIEW")` |
| COMM-01 | Fallback addon only qualifies when primary is NOT available in state | Fix condition in `resolveBundleRequirement()` |
| COMM-02 | When primary IS available, fallback does not substitute | Add `if (requiredAvail && !requiredAddonInSale)` guard before fallback loop to return half commission |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (SVG) | 18.3.1 | Heatmap grid, sparkline rendering | Native JSX SVG -- zero dependencies for simple visualizations |
| Prisma.$queryRaw | (workspace) | Timezone-aware aggregation queries | Prisma query builder cannot express EXTRACT/AT TIME ZONE/computed GROUP BY |
| Luxon | ^3.4.4 | DST-correct timezone conversion | Already in project; replaces broken month-based DST check |
| Express Router | ^4.18.2 | New lead-timing route module | Existing pattern for all API routes |
| Zod | (workspace) | Query param validation | Existing pattern for all route validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/ui tokens | (workspace) | Design tokens (colors, spacing, radius) | All new component styling |
| @ops/ui DateRangeFilter | (workspace) | Independent date filter with custom presets | Analytics section date range |
| @ops/ui Card, Badge, AnimatedNumber | (workspace) | Recommendation card UI | Best Source card layout |
| lucide-react | ^0.577.0 | Icons (TrendingUp, Clock, ChevronDown) | Section header, card icons, collapse toggle |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw SVG | @visx/heatmap (3.12.0) | visx adds 5 packages (~250KB) for 60 lines of code; introduces foreign pattern |
| Raw SVG polyline | recharts (3.8.1) | Overkill for 7-point sparklines; known inline-style issues |
| Raw SQL ($queryRaw) | Prisma groupBy | Prisma cannot express AT TIME ZONE or EXTRACT with computed GROUP BY |
| In-memory cache | Redis | Single Railway instance; data refreshes every 10 min; Map with TTL is sufficient |

**Installation:**
```bash
# No new packages to install. All dependencies already in workspace.
npm install
```

## Architecture Patterns

### Recommended Project Structure
```
apps/ops-api/src/routes/
  lead-timing.ts              # NEW: 3 GET endpoints (heatmap, sparklines, recommendation)
  index.ts                    # MODIFY: register leadTimingRoutes (2 lines)

apps/ops-api/src/workers/
  convosoKpiPoller.ts         # MODIFY: fix convosoDateToUTC DST, fix business hours check

apps/ops-api/src/services/
  payroll.ts                  # MODIFY: fix resolveBundleRequirement fallback logic

apps/ops-dashboard/app/(dashboard)/manager/
  page.tsx                    # MODIFY: rename NAV_ITEMS label
  ManagerTracker.tsx          # MODIFY: add Today column, import LeadTimingSection
  LeadTimingSection.tsx       # NEW: wrapper with independent date filter + collapsible
  LeadTimingHeatmap.tsx       # NEW: heatmap grid component
  LeadTimingSparklines.tsx    # NEW: sparklines table component
  BestSourceCard.tsx          # NEW: recommendation card component

apps/ops-dashboard/app/(dashboard)/owner/
  OwnerOverview.tsx           # MODIFY: import and render LeadTimingSection

prisma/
  migrations/YYYYMMDD.../     # NEW: add 2 indexes
  schema.prisma               # MODIFY: add @@index entries
```

### Pattern 1: Raw SQL Aggregation with Prisma.$queryRaw
**What:** Use tagged template literals for timezone-aware GROUP BY queries.
**When to use:** All heatmap/sparkline/recommendation data fetching.
**Example:**
```typescript
// Source: ARCHITECTURE.md research + Prisma docs
import { Prisma } from "@prisma/client";

interface HourBucket {
  lead_source_id: string;
  hour: number;
  dow: number;
  call_count: bigint;  // PostgreSQL COUNT returns bigint
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

// CRITICAL: Convert BigInt before JSON serialization
const calls = Number(row.call_count);
```

### Pattern 2: Application-Level Join for Calls + Sales
**What:** Run parallel queries for call counts and sale counts, merge via Map keyed on `leadSourceId:hour:group`.
**When to use:** Heatmap and sparkline endpoints (two tables, no FK).
**Example:**
```typescript
const [callBuckets, saleBuckets, leadSources] = await Promise.all([
  prisma.$queryRaw<CallBucket[]>(callQuery),
  prisma.$queryRaw<SaleBucket[]>(saleQuery),
  prisma.leadSource.findMany({ where: { active: true }, select: { id: true, name: true } }),
]);

const key = (lsId: string, hour: number, group: number) => `${lsId}:${hour}:${group}`;
const callMap = new Map<string, number>();
for (const row of callBuckets) {
  callMap.set(key(row.lead_source_id, row.hour, row.dow), Number(row.call_count));
}
// Same pattern for saleMap, then compute closeRate = sales / calls per key
```

### Pattern 3: Independent Date Filter (Not Global Context)
**What:** Local `useState` for analytics date range, separate from `useDateRange()` global context.
**When to use:** LeadTimingSection component.
**Example:**
```typescript
// Source: DateRangeFilter component API from @ops/ui
const ANALYTICS_PRESETS = [
  { key: "7d", label: "Last Week" },
  { key: "30d", label: "Last 30 Days" },
  { key: "60d", label: "Last 60 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "custom", label: "Custom" },
];

const [analyticsRange, setAnalyticsRange] = useState<DateRangeFilterValue>({ preset: "30d" });
// Pass analyticsRange as query params to lead-timing endpoints
```

### Pattern 4: Inline SVG Sparkline
**What:** Render 7-point trend as SVG polyline.
**When to use:** Sparklines table.
**Example:**
```typescript
function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 0.01); // avoid division by zero
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

### Pattern 5: Collapsible Section with Header Toggle
**What:** Section wrapper that collapses/expands with a chevron toggle, default collapsed.
**When to use:** LeadTimingSection wrapper.
**Example:**
```typescript
const [expanded, setExpanded] = useState(false);
// Header with ChevronDown icon that rotates; section body conditionally rendered
```

### Anti-Patterns to Avoid
- **Client-side aggregation:** Never fetch raw call logs to browser. All GROUP BY happens in PostgreSQL.
- **Using global DateRangeContext:** Analytics needs 30/60/90-day windows; global context defaults to weekly payroll alignment.
- **Using Sale.saleDate for hour bucketing:** saleDate lacks hour precision (set to noon). Use Sale.createdAt per D-05.
- **String interpolation in SQL:** Always use `Prisma.sql` tagged templates for parameterized queries.
- **Forgetting BigInt conversion:** `COUNT(*)` returns `bigint` in PostgreSQL; `JSON.stringify()` throws on BigInt. Always `Number()` before response.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DST-aware timezone conversion | Manual month-based offset check | Luxon `DateTime.fromFormat(..., { zone })` | DST transitions happen on specific Sundays, not month boundaries; Luxon handles IANA timezone rules |
| Date range filter UI | Custom date picker from scratch | `DateRangeFilter` from @ops/ui with custom presets array | Already exists, battle-tested, accepts `presets` prop |
| Auth/role checking | Custom role validation | `requireAuth` middleware (SUPER_ADMIN bypasses automatically) | Established pattern; optionally add `requireRole` |
| Error response formatting | Manual error JSON | `zodErr()` helper from routes/helpers.ts | Standard error shape dashboards expect |
| Async error handling | try/catch in every handler | `asyncHandler()` wrapper | Forwards errors to Express error handler |

**Key insight:** The entire visualization layer (heatmap + sparklines + card) is ~200 lines of code using raw SVG. A charting library would add more configuration code than the raw implementation.

## Common Pitfalls

### Pitfall 1: Naive Hour Extraction Without Timezone Conversion
**What goes wrong:** Using `EXTRACT(HOUR FROM call_timestamp)` extracts UTC hour. A 9 AM Pacific call shows as 4-5 PM in the heatmap.
**Why it happens:** PostgreSQL `timestamptz` stores UTC internally. Without `AT TIME ZONE`, EXTRACT returns UTC components.
**How to avoid:** Always use `EXTRACT(HOUR FROM col AT TIME ZONE 'America/New_York')` in all aggregation queries.
**Warning signs:** Peak activity appears at 4-5 PM instead of 9-10 AM.

### Pitfall 2: Incorrect DST in convosoDateToUTC
**What goes wrong:** The existing function uses `month >= 2 && month <= 9` for DST check. Calls on March 1-7 and October 25-31 get wrong offset by 1 hour.
**Why it happens:** DST transitions are on specific Sundays, not month boundaries.
**How to avoid:** Replace with Luxon: `DateTime.fromFormat(dateStr, 'yyyy-MM-dd HH:mm:ss', { zone: 'America/Los_Angeles' }).toJSDate()`.
**Warning signs:** Unusual spikes at 2-3 AM during DST transition weeks.

### Pitfall 3: Low Sample Size Misleading Heatmap Cells
**What goes wrong:** "100% close rate" from 1 call / 1 sale shows as bright green.
**Why it happens:** Close rate is meaningless at tiny sample sizes.
**How to avoid:** De-emphasize cells < 10 calls (opacity: 0.3 per D-03). Distinguish "no data" (0 calls = gray) from "zero conversions" (10+ calls, 0 sales = red).
**Warning signs:** "Best Source" recommendation changes wildly hour to hour.

### Pitfall 4: BigInt Serialization Error
**What goes wrong:** `JSON.stringify()` throws `TypeError: Do not know how to serialize a BigInt` when sending raw query results.
**Why it happens:** PostgreSQL `COUNT(*)` returns `bigint`. Prisma `$queryRaw` preserves the type as JS `BigInt`.
**How to avoid:** Always convert: `Number(row.call_count)` before including in response object.
**Warning signs:** 500 error on endpoint with no obvious query failure.

### Pitfall 5: Commission Fallback Bug (Current State)
**What goes wrong:** When primary addon IS available in the member's state but NOT in the sale, the code falls through to the fallback loop and may return `fallbackAddonAvailable: true` instead of half commission.
**Why it happens:** Lines 223-225 only check `requiredAvail && requiredAddonInSale`. When `requiredAvail` is true but `requiredAddonInSale` is false, execution continues to the fallback loop at line 227.
**How to avoid:** Add guard: `if (requiredAvail && !requiredAddonInSale)` before fallback loop, returning half commission immediately.
**Warning signs:** Agents getting full commission on sales with fallback addons in states where primary addon is available.

### Pitfall 6: Server Timezone for "Best Source Right Now"
**What goes wrong:** Recommendation endpoint uses `new Date().getHours()` to determine "current hour". On Railway (UTC), this returns UTC hour, not business hour.
**Why it happens:** `getHours()` is environment-dependent.
**How to avoid:** Use `DateTime.now().setZone('America/New_York').hour` for current business hour.
**Warning signs:** Wrong recommendation for actual business hour; behavior differs between local dev and production.

### Pitfall 7: Heatmap Month-of-Year Grouping SQL
**What goes wrong:** User added "Month of Year" as a third grouping mode (D-02). The SQL EXTRACT expression differs: `EXTRACT(MONTH FROM col AT TIME ZONE 'America/New_York')` returns 1-12.
**Why it happens:** Easy to forget this third mode when implementing the groupBy parameter.
**How to avoid:** Map the `groupBy` query param to the correct EXTRACT expression: `dow` -> DOW (0-6), `wom` -> `CEIL(EXTRACT(DAY FROM ...) / 7.0)` (1-5), `moy` -> MONTH (1-12).
**Warning signs:** 400 error or wrong grouping when selecting Month of Year mode.

## Code Examples

### convosoDateToUTC Fix (DATA-01)
```typescript
// Source: PITFALLS.md research + existing codebase pattern
import { DateTime } from 'luxon';

function convosoDateToUTC(dateStr: string): Date {
  const dt = DateTime.fromFormat(dateStr, 'yyyy-MM-dd HH:mm:ss', {
    zone: 'America/Los_Angeles'
  });
  if (!dt.isValid) return new Date();
  return dt.toJSDate();
}
```

### Business Hours Fix (DATA-02)
```typescript
// Source: PITFALLS.md research
import { DateTime } from 'luxon';

// Replace: const hour = new Date().getHours();
const now = DateTime.now().setZone('America/Los_Angeles');
const hour = now.hour;
const isBusinessHours = hour >= 8 && hour < 18;
```

### resolveBundleRequirement Fix (COMM-01, COMM-02)
```typescript
// Current code (lines 218-234 of payroll.ts):
// After checking requiredAvail + requiredAddonInSale, falls through to fallbacks

// Fixed version -- add guard before fallback loop:
if (requiredAvail && requiredAddonInSale) {
  return { requiredAddonAvailable: true, fallbackAddonAvailable: false, halvingReason: null };
}

// NEW: If primary IS available but NOT in sale, half commission -- skip fallbacks
if (requiredAvail && !requiredAddonInSale) {
  const addonName = coreProduct.requiredBundleAddon?.name ?? "required addon";
  return {
    requiredAddonAvailable: false,
    fallbackAddonAvailable: false,
    halvingReason: `Half commission - missing ${addonName}`,
  };
}

// Only check fallbacks when primary is NOT available in state (!requiredAvail)
const fallbacks = coreProduct.fallbackAddons ?? [];
// ... existing fallback loop
```

### Heatmap Color Scale for Dark Theme
```typescript
// Claude's discretion area -- recommended approach for red-yellow-green on dark background
function heatmapColor(closeRate: number, calls: number): React.CSSProperties {
  if (calls === 0) return { backgroundColor: "rgba(255,255,255,0.03)" }; // no data
  if (calls < 10) {
    // De-emphasized per D-03
    const bg = closeRate >= 0.10
      ? `rgba(34,197,94,${0.15})` : closeRate >= 0.05
      ? `rgba(234,179,8,${0.12})` : `rgba(239,68,68,${0.10})`;
    return { backgroundColor: bg, opacity: 0.3 };
  }
  // Full opacity for sufficient data
  if (closeRate >= 0.15) return { backgroundColor: "rgba(34,197,94,0.5)" };
  if (closeRate >= 0.10) return { backgroundColor: "rgba(34,197,94,0.3)" };
  if (closeRate >= 0.05) return { backgroundColor: "rgba(234,179,8,0.3)" };
  return { backgroundColor: "rgba(239,68,68,0.25)" };
}
```

### Week-of-Month SQL Expression
```sql
-- For groupBy=wom: week of month = ceil(day_of_month / 7)
CEIL(EXTRACT(DAY FROM call_timestamp AT TIME ZONE 'America/New_York') / 7.0)::int AS wom

-- For groupBy=moy: month of year
EXTRACT(MONTH FROM call_timestamp AT TIME ZONE 'America/New_York')::int AS moy
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Month-based DST check in convosoDateToUTC | Luxon with IANA timezone rules | Fix in this phase | Accurate hour extraction for all dates |
| `new Date().getHours()` for business hours | `DateTime.now().setZone()` | Fix in this phase | Correct behavior on UTC servers (Railway) |
| No timing analytics | Heatmap + sparklines + recommendation | This phase | Data-driven call routing decisions |
| Fallback addons qualify regardless of primary availability | Fallbacks only when primary unavailable in state | Fix in this phase | Correct commission calculations |

**Deprecated/outdated:**
- Manual DST offset calculation: replaced by Luxon timezone-aware parsing
- Treating `Sale.saleDate` as having hour precision: it does not; use `Sale.createdAt`

## Open Questions

1. **DASH-02 "Today" column data source**
   - What we know: ManagerTracker fetches tracker data via `/api/tracker/summary` with date range params. Adding a "Today" column requires either a separate API call filtered to today, or the existing endpoint returning a `todaySalesCount` field.
   - What's unclear: Whether to add a new field to the existing tracker/summary response or make a separate fetch.
   - Recommendation: Add `todaySalesCount` and `todayPremium` fields to the existing tracker/summary endpoint response to avoid an extra API call. Filter by `Sale.saleDate = today` in the existing query.

2. **Heatmap cell sizing for 24 columns**
   - What we know: 24 hour columns + label column + source rows on desktop. Business hours (8 AM - 8 PM) are the meaningful range.
   - What's unclear: Whether to show all 24 hours or only business hours (reduces to 12-13 columns).
   - Recommendation: Show all 24 hours but visually emphasize business hours (8-20) with slightly brighter cell borders. Off-hours cells exist but are smaller/dimmer.

3. **Sparkline daypart boundaries**
   - What we know: Requirements say "morning/afternoon/evening" dayparts.
   - What's unclear: Exact hour boundaries for each daypart.
   - Recommendation: Morning = 8:00-11:59, Afternoon = 12:00-16:59, Evening = 17:00-20:59. These align with standard call center shift patterns.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest |
| Config file | `apps/ops-api/jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern=payroll` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMM-01 | Fallback only qualifies when primary unavailable | unit | `npm test -- --testPathPattern=payroll` | Needs new test file |
| COMM-02 | Primary available + not in sale = half commission | unit | `npm test -- --testPathPattern=payroll` | Needs new test file |
| DATA-01 | Luxon DST-correct timezone conversion | unit | `npm test -- --testPathPattern=convosoDate` | Needs new test file |
| DATA-04 | Heatmap endpoint returns correct aggregation | integration | Manual curl / Postman | N/A |
| DATA-07 | AT TIME ZONE in all queries | integration | Manual verification via EXPLAIN | N/A |
| HEAT-02 | Grouping toggle (dow/wom/moy) | integration | Manual UI test | N/A |
| DASH-01 | Tab renamed | smoke | Manual UI check | N/A |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=payroll`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps
- [ ] `apps/ops-api/src/services/__tests__/bundle-requirement.test.ts` -- covers COMM-01, COMM-02 (test resolveBundleRequirement with primary available + fallback scenarios)
- [ ] `apps/ops-api/src/workers/__tests__/convosoDateToUTC.test.ts` -- covers DATA-01 (test DST boundary dates: March transition, November transition, mid-summer, mid-winter)
- [ ] Test mock for `prisma.productStateAvailability.findUnique` in existing `__mocks__/ops-db.ts`

## Sources

### Primary (HIGH confidence)
- Codebase: `apps/ops-api/src/workers/convosoKpiPoller.ts` -- DST bug at line 11-21, business hours bug
- Codebase: `apps/ops-api/src/services/payroll.ts` -- resolveBundleRequirement lines 207-244
- Codebase: `prisma/schema.prisma` -- ConvosoCallLog indexes (lines 490-491), Sale indexes (line 228)
- Codebase: `apps/ops-dashboard/app/(dashboard)/manager/page.tsx` -- NAV_ITEMS line 40-46
- Codebase: `packages/ui/src/components/DateRangeFilter.tsx` -- presets prop API
- Prior research: `.planning/research/ARCHITECTURE.md` -- endpoint specs, SQL patterns, build order
- Prior research: `.planning/research/PITFALLS.md` -- timezone pitfalls, sample size traps
- Prior research: `.planning/research/STACK.md` -- no new deps, raw SVG approach
- Prior research: `.planning/research/FEATURES.md` -- feature landscape, metric hierarchy

### Secondary (MEDIUM confidence)
- PostgreSQL docs: `AT TIME ZONE` behavior on `timestamptz` columns -- converts to target zone, returns `timestamp` (correct for EXTRACT)
- Prisma docs: `$queryRaw` with `Prisma.sql` tagged templates for parameterized queries

### Tertiary (LOW confidence)
- None -- all findings verified against codebase and official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; all verified against existing codebase
- Architecture: HIGH -- follows established route/component patterns; SQL patterns verified with PostgreSQL docs
- Pitfalls: HIGH -- timezone bugs confirmed in source code; commission bug logic traced line-by-line
- Commission fix: HIGH -- exact bug location and fix logic identified from code reading

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable codebase patterns, no fast-moving dependencies)
