# Pitfalls Research

**Domain:** Time-based sales analytics with mixed-timezone data (Pacific call logs + UTC sales records)
**Researched:** 2026-03-26
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Naive Hour Extraction From Mixed-Timezone Timestamps

**What goes wrong:**
The heatmap needs "hour of day" and "day of week" for both calls and sales. `ConvosoCallLog.callTimestamp` is stored as UTC (converted from Pacific via `convosoDateToUTC`). `Sale.createdAt` is UTC. If you extract the hour using `EXTRACT(HOUR FROM call_timestamp)` in SQL or `getUTCHours()` in JS, you get the UTC hour -- not the hour the call actually happened in the call center's timezone. A call at 9:00 AM Pacific shows as 16:00 or 17:00 UTC depending on DST. The heatmap would show peak activity at 4-5 PM when it was actually 9 AM.

**Why it happens:**
Developers see timestamps stored in the database and assume extracting the hour gives a meaningful business hour. PostgreSQL `timestamptz` stores UTC internally, and Prisma returns JS `Date` objects in UTC. Nothing in the query pipeline reminds you to convert to the business timezone before extracting the hour.

**How to avoid:**
Always convert to the business display timezone (America/Los_Angeles for this call center) before extracting hour/day-of-week. Two approaches:

1. **SQL-side (recommended for aggregation):** Use `AT TIME ZONE 'America/Los_Angeles'` in PostgreSQL:
   ```sql
   EXTRACT(HOUR FROM call_timestamp AT TIME ZONE 'America/Los_Angeles')
   ```
   This handles DST transitions automatically because PostgreSQL knows the timezone rules.

2. **Application-side:** Use Luxon (already in the project for payroll):
   ```typescript
   DateTime.fromJSDate(callTimestamp).setZone('America/Los_Angeles').hour
   ```

Use PostgreSQL `AT TIME ZONE` for the aggregation queries (heatmap, sparklines) and Luxon only for display formatting. Do NOT use `new Date().getHours()` -- it uses the server's local timezone which may differ between Railway (UTC) and local dev (Eastern/Pacific).

**Warning signs:**
- Heatmap shows peak call hours at 4-5 PM instead of 9-10 AM
- Day-of-week patterns shift by one day for evening calls (a Monday 10 PM Pacific call becomes Tuesday in UTC)
- Metrics disagree between local dev and production deployment

**Phase to address:**
Phase 1 (data layer / aggregation queries) -- this must be correct from the first query or every downstream visualization is wrong.

---

### Pitfall 2: Incorrect DST Handling in convosoDateToUTC

**What goes wrong:**
The existing `convosoDateToUTC` function in `convosoKpiPoller.ts` uses a crude month-based DST check: `month >= 2 && month <= 9` (March through October = PDT). This is wrong at the boundaries. DST transitions happen on specific Sundays (2nd Sunday of March, 1st Sunday of November), not on the 1st of the month. Calls on March 1-7 or October 25-31 get the wrong offset, shifting their timestamps by 1 hour. For heatmap analytics where the unit IS the hour, a 1-hour shift moves data into the wrong cell.

**Why it happens:**
The original implementation was "close enough" for KPI snapshots where a 1-hour offset on a few days per year does not matter. For hour-granularity heatmaps, it corrupts the data at DST boundaries.

**How to avoid:**
Replace the manual DST logic with Luxon, which is already a project dependency:
```typescript
import { DateTime } from 'luxon';

function convosoDateToUTC(dateStr: string): Date {
  // Parse as Pacific time (Luxon handles DST automatically)
  const dt = DateTime.fromFormat(dateStr, 'yyyy-MM-dd HH:mm:ss', {
    zone: 'America/Los_Angeles'
  });
  if (!dt.isValid) return new Date();
  return dt.toJSDate(); // JS Date in UTC
}
```

This should be done as a prerequisite fix, not as part of the analytics feature, to avoid corrupting historical data going forward.

**Warning signs:**
- Heatmap cells at 2-3 AM show unusual spikes during DST transition weeks (March, November)
- Aggregation totals for hour X differ by a few percent from a manual spot-check on DST transition dates
- Calls placed at 1:59 AM PST on "spring forward" day appear in the 3 AM cell instead of the 2 AM cell

**Phase to address:**
Phase 1 (data layer) -- fix this in the poller BEFORE building analytics queries. Also consider a one-time backfill migration for existing records near DST boundaries (low priority -- only affects a few hours of data per year).

---

### Pitfall 3: Misleading Heatmap Cells With Low Sample Sizes

**What goes wrong:**
A heatmap cell showing "Source X at 7 PM on Tuesdays has 100% close rate" is misleading if it is based on 1 call and 1 sale. Users see the bright green cell and shift lead routing to that slot, wasting budget. Worse: cells with 0 calls show as 0% instead of "no data", making inactive hours look like bad hours.

**Why it happens:**
Close rate = sales / calls is a ratio that is meaningless at small sample sizes. Developers display the raw ratio without any indication of confidence. The heatmap color scale treats 100% (1/1) the same as 100% (50/50).

**How to avoid:**
Three-layer defense:

1. **Minimum threshold display:** Do not color-code cells below a minimum sample size (e.g., 5 calls). Show them as gray/hatched with the raw count. The threshold should be configurable or at least a named constant.

2. **Show sample size in the cell:** Each heatmap cell should display both the close rate AND the call count. Format: `23% (47)` or use a tooltip on hover. The call count is the denominator.

3. **Distinguish "no data" from "zero conversions":** 0 calls = gray (no data), 10 calls with 0 sales = red (0% close rate). These are very different signals and must not share the same visual treatment.

Do NOT attempt Wilson score confidence intervals or Bayesian smoothing -- this is an internal ops tool, not a statistics product. Simple sample size indicators are sufficient and more understandable for managers.

**Warning signs:**
- Users report the "Best Source Right Now" recommendation keeps changing wildly hour to hour
- Early-morning or late-evening cells show extreme values (100% or 0%)
- Users distrust the heatmap because they saw a misleading cell

**Phase to address:**
Phase 2 (UI/visualization) -- but the API response should include the sample count from Phase 1 so the frontend has data to work with.

---

### Pitfall 4: Aggregation Query Performance on ConvosoCallLog Table

**What goes wrong:**
The heatmap query needs to GROUP BY (lead_source_id, hour, day_of_week) across potentially hundreds of thousands of call log records over 90 days. A naive query without proper indexing or with application-side grouping (fetching all rows then grouping in JS) causes multi-second response times. The "Best Source Right Now" card needs to run this query on every page load.

**Why it happens:**
The existing `ConvosoCallLog` table has indexes on `[callTimestamp]` and `[agentId, leadSourceId, callTimestamp]`, which help with range scans but not with the specific grouping pattern needed for heatmaps. The `AT TIME ZONE` conversion in GROUP BY prevents PostgreSQL from using a plain btree index on `callTimestamp` for the grouping.

**How to avoid:**

1. **Use Prisma `$queryRaw` for the aggregation query.** Prisma's query builder cannot express `EXTRACT(HOUR FROM col AT TIME ZONE 'X')` or `GROUP BY` with computed columns. Use raw SQL for the heatmap endpoint. This is consistent with the project's existing pattern -- complex queries use `$queryRaw`.

2. **Add a composite index** supporting the grouping pattern:
   ```sql
   CREATE INDEX idx_call_logs_source_timestamp ON convoso_call_logs (lead_source_id, call_timestamp);
   ```
   This already partially exists as `[agentId, leadSourceId, callTimestamp]` but the leading `agentId` column makes it less useful when you are not filtering by agent.

3. **Consider a materialized/precomputed summary table** only if query times exceed 500ms on the 90-day range. Do not prematurely optimize -- PostgreSQL handles GROUP BY on 100k rows efficiently with proper indexes. If needed later, a `lead_source_hourly_stats` table updated by the poller is the right approach.

4. **Cache the heatmap response** with a short TTL (5-10 minutes). The underlying data only changes every 10 minutes (poller interval), so caching is safe. An in-memory cache (Map with timestamp) is sufficient -- no Redis needed.

**Warning signs:**
- Heatmap endpoint takes >1s on 30-day range
- Database CPU spikes correlate with dashboard page loads
- EXPLAIN ANALYZE shows sequential scan on convoso_call_logs

**Phase to address:**
Phase 1 (data layer) -- design the query and index together. Add caching in Phase 2 if benchmarks justify it.

---

### Pitfall 5: Joining Calls to Sales Across Different Time Granularities

**What goes wrong:**
"Close rate" = sales / calls. But calls and sales are not directly linked -- there is no foreign key from Sale to ConvosoCallLog. To compute close rate per lead source per hour, you must count calls from `ConvosoCallLog` (grouped by lead_source_id + hour) and sales from `Sale` (grouped by leadSourceId + hour of saleDate). If you join on the wrong time field (Sale.createdAt vs Sale.saleDate) or use different timezone conversions for calls vs sales, the ratios are garbage.

**Why it happens:**
`Sale.saleDate` is the business date entered by the manager (when the sale actually happened). `Sale.createdAt` is when the record was created in the system (may be hours or days later). Using `createdAt` instead of `saleDate` shifts sales into the wrong hour/day bucket.

Additionally, `Sale.saleDate` does not have hour-level precision in many records -- it may be set to midnight or to the time the form was submitted, not the actual call time. If sales are entered in bulk at end of day, they all cluster in one hour.

**How to avoid:**

1. **Use `Sale.saleDate` for the date component** (which day the sale belongs to) but acknowledge that hour-level precision for sales may be unreliable. The heatmap's value comes from the CALL volume pattern (when calls happen) combined with the daily close rate (sales per day per source), not from matching individual calls to individual sales by hour.

2. **Design the metric as:** close rate per (lead_source, hour_of_day) = (sales on days where calls happened at this hour) / (calls at this hour). Or simpler: show call volume heatmap with a separate daily close rate overlay. Do not try to attribute individual sales to individual call hours.

3. **Document the metric definition** in the API response or UI tooltip so users understand what "close rate at 2 PM" means.

**Warning signs:**
- Close rates exceed 100% in some cells (more sales than calls at that hour)
- Total sales from heatmap does not match total sales from manager dashboard
- Users ask "what does this number mean?"

**Phase to address:**
Phase 1 (data layer design) -- the metric definition must be settled before writing queries. This is a product decision, not just a technical one.

---

### Pitfall 6: Business Hours Check Uses Server Local Time

**What goes wrong:**
The existing `convosoKpiPoller.ts` line 315-316 uses `new Date().getHours()` for the business hours check. `getHours()` returns the hour in the server's local timezone. On Railway (UTC), this means business hours 08:00-18:00 are actually checked against UTC, not Pacific or Eastern. The poller may stop polling at 10 AM Pacific (18:00 UTC) or start at midnight Pacific (08:00 UTC).

**Why it happens:**
`new Date().getHours()` is a common footgun -- it is timezone-dependent on the runtime environment. Local dev runs in the developer's timezone; Railway runs in UTC; Docker may run in whatever the host timezone is.

**How to avoid:**
This is an existing bug, not a new pitfall, but the analytics feature will inherit it if the analytics endpoints also use time-based logic (e.g., "Best Source Right Now" needs to know what hour it is in the call center's timezone). Fix by using Luxon:
```typescript
const now = DateTime.now().setZone('America/Los_Angeles');
const currentTime = now.toFormat('HH:mm');
```

**Warning signs:**
- Poller stops during business hours or runs outside them
- "Best Source Right Now" recommends based on wrong hour
- Behavior differs between local dev and production

**Phase to address:**
Phase 1 (data layer) -- fix alongside the `convosoDateToUTC` DST fix since both are timezone correctness issues in the same file.

---

### Pitfall 7: Inline CSSProperties Heatmap Color Scale

**What goes wrong:**
Heatmaps require dynamic background colors based on cell values. With inline `React.CSSProperties` (the project's styling constraint -- no Tailwind, no CSS files), you must compute `backgroundColor` as an inline style. Developers create a color scale function but forget to handle: (a) color-blind accessibility, (b) the dark theme context (light greens on dark backgrounds look different than on white), (c) no-data vs zero-value distinction.

**Why it happens:**
Heatmap color scales are typically done with CSS classes or Tailwind utilities. Inline styles require manual RGB/HSL interpolation, and the dark glassmorphism theme means standard red-yellow-green scales from charting libraries do not match the design system.

**How to avoid:**

1. **Build a `heatmapColor(value, min, max, sampleSize)` utility** that returns a `React.CSSProperties` object with `backgroundColor` and `color` (text contrast). Use HSL interpolation: hue from 0 (red) to 120 (green), saturation reduced for low sample sizes, lightness tuned for the dark theme background.

2. **Define the color scale as a constant array** matching the existing pattern of `const CARD`, `const BTN`, etc. Use the existing glassmorphism palette -- dark translucent backgrounds with colored borders or subtle fills.

3. **Reserve gray (`rgba(255,255,255,0.05)`)** for no-data cells. Use the existing `rgba(255,255,255,0.08)` pattern from the codebase for background consistency.

4. **Test with real data** -- heatmap colors that look good with 5 cells of sample data often fail when 90% of cells are in a narrow range.

**Warning signs:**
- All cells look the same color (value range too narrow for the color scale)
- Text is unreadable against certain cell colors
- Users cannot distinguish good from bad cells

**Phase to address:**
Phase 2 (UI/visualization) -- build the color utility early and test with realistic data distributions.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded 'America/Los_Angeles' timezone | Simple, works for current single-location call center | Cannot support multiple call center timezones | Acceptable now -- single location. Extract to config if multi-location ever needed |
| Raw SQL via `$queryRaw` for heatmap | Handles complex GROUP BY with timezone functions | Bypasses Prisma type safety, no migration tracking | Acceptable -- Prisma cannot express this query. Type the response manually with Zod |
| In-memory cache for heatmap data | No Redis dependency, simple implementation | Lost on server restart, not shared across instances | Acceptable -- single instance on Railway. Data refreshes every 10 min anyway |
| Close rate as simple ratio without statistical adjustment | Easy to understand, no stats library needed | Can mislead on small samples | Acceptable with sample size indicators (Pitfall 3) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Convoso call_date field | Treating as UTC when it is Pacific time | Always parse with `zone: 'America/Los_Angeles'` via Luxon, then convert to UTC for storage |
| Convoso API pagination | Assuming all results come in one response | Check for pagination fields in response; the poller currently fetches without explicit date ranges, which may return limited results for analytics |
| Sale.saleDate vs Sale.createdAt | Using createdAt for time-based analytics | saleDate is the business date; createdAt is the system timestamp. Use saleDate for analytics |
| PostgreSQL AT TIME ZONE | Using it on `timestamp` (without tz) vs `timestamptz` -- behavior differs | `callTimestamp` is `timestamptz` in Prisma (DateTime). `AT TIME ZONE` on timestamptz converts TO that zone and returns `timestamp`. This is correct for EXTRACT |
| Railway deployment timezone | Assuming server runs in same timezone as local dev | Railway containers run in UTC. All `new Date().getHours()` calls return UTC hours. Use Luxon with explicit zone |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Full table scan on 90-day heatmap query | >2s response time, database CPU spike | Add `(lead_source_id, call_timestamp)` index; use date range WHERE clause before GROUP BY | ~50k+ rows without index |
| Application-side grouping (fetch all rows, group in JS) | High memory usage, slow response | Do grouping in SQL with GROUP BY | ~10k+ rows |
| Recalculating heatmap on every request | Unnecessary database load when data changes every 10 min | In-memory cache with TTL matching poller interval | Concurrent dashboard users (5+) hammering the endpoint |
| COUNT(*) across entire ConvosoCallLog table for "total calls" KPI | Slow on large tables in PostgreSQL | Always filter by date range, never unbounded count | ~100k+ rows |
| N+1 query for lead source names in heatmap response | One query per lead source for name resolution | Join lead source names in the aggregation query or fetch all active lead sources in one query | 10+ lead sources |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing close rate without sample size | Users make routing decisions on statistically meaningless data | Show both rate and count: "23% (47 calls)" |
| Using red for low close rate | Alarm fatigue; some sources are legitimately low-volume | Use neutral color scale (blue gradient) with saturation for confidence; reserve red for anomalies |
| "Best Source Right Now" with no explanation | Users do not trust a recommendation they cannot verify | Show the top-3 sources with their rates and sample sizes, not just the #1 pick |
| Heatmap with too many hours (0-23) on mobile/small screens | Cells too small to read | Since desktop is primary (per constraints), show 6 AM - 10 PM (business-relevant hours); collapse overnight into one column |
| Date range filter independent from main dashboard filter | Users change the main filter and expect heatmap to update | Explicitly label "Analytics Date Range" separately and explain it covers historical data, not live |
| Sparkline without axis labels | Users cannot tell if a trend is 5% to 10% or 50% to 55% | Add min/max labels on sparkline Y-axis, or show the current value prominently next to the sparkline |

## "Looks Done But Isn't" Checklist

- [ ] **Heatmap timezone:** Verify EXTRACT uses `AT TIME ZONE 'America/Los_Angeles'` -- test with a call at 11 PM Pacific (should appear in the 11 PM column, not 6-7 AM next day)
- [ ] **DST boundary:** Test with a callTimestamp from March 10, 2026 2:30 AM Pacific (spring forward) -- this time does not exist; verify it does not crash or produce NaN
- [ ] **Zero calls vs no data:** Verify heatmap renders differently for "0% (10 calls)" vs "no data (0 calls)"
- [ ] **Sample size threshold:** Verify cells below minimum threshold are visually distinct and do not influence the "Best Source" recommendation
- [ ] **90-day query performance:** Run EXPLAIN ANALYZE on the heatmap query with production-scale data; verify it uses the index
- [ ] **Close rate denominator:** Confirm close rate uses total calls (not just "engaged" or "deep" tier calls) as the denominator, or document clearly if filtered
- [ ] **Business hours in correct timezone:** Verify the "Best Source Right Now" card shows the recommendation for the current Pacific hour, not UTC hour
- [ ] **Sale date precision:** Verify Sale.saleDate has meaningful hour-level precision for at least some records; if not, document the limitation in the UI

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong timezone in aggregation | LOW | Fix the SQL query, re-deploy. No data corruption -- stored timestamps are correct UTC; only the display/grouping was wrong |
| DST bug in convosoDateToUTC | MEDIUM | Fix the function, then run a one-time migration to recalculate callTimestamp for records near DST boundaries. Small number of affected records |
| No sample size indicators | LOW | Add sample count to API response and update UI. No backend data changes needed |
| Slow heatmap query | LOW | Add index via Prisma migration. Zero downtime, instant improvement |
| Wrong Sale date field used | MEDIUM | Change query from createdAt to saleDate. May shift some analytics results, requiring user communication |
| Business hours in wrong timezone | LOW | Fix to use Luxon with explicit zone. Immediate effect on next poll cycle |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Naive hour extraction (Pitfall 1) | Phase 1: Data layer / aggregation queries | Query returns correct hour for known test timestamps spanning PDT and PST |
| DST handling bug (Pitfall 2) | Phase 1: Data layer (prerequisite fix) | Test with timestamps on DST transition dates; compare Luxon output to manual calculation |
| Low sample size noise (Pitfall 3) | Phase 1 (API includes count) + Phase 2 (UI renders threshold) | UI shows gray cells for <5 calls; "Best Source" ignores low-sample cells |
| Query performance (Pitfall 4) | Phase 1: Data layer | EXPLAIN ANALYZE shows index scan; response time <500ms on 90-day range |
| Call-to-sale join mismatch (Pitfall 5) | Phase 1: Metric definition | Total sales in heatmap matches manager dashboard total for same date range |
| Server timezone bug (Pitfall 6) | Phase 1: Prerequisite fix | Poller business hours check works correctly on Railway (UTC) server |
| Heatmap color scale (Pitfall 7) | Phase 2: UI/visualization | Cells are visually distinct across full value range; text readable on all backgrounds |

## Sources

- Codebase analysis: `apps/ops-api/src/workers/convosoKpiPoller.ts` (existing DST handling, business hours check)
- Codebase analysis: `prisma/schema.prisma` (ConvosoCallLog, Sale, AgentCallKpi models and indexes)
- Codebase analysis: `apps/ops-api/src/services/convosoCallLogs.ts` (KPI aggregation patterns)
- Codebase analysis: `apps/ops-api/src/services/payroll.ts` (Luxon usage with America/New_York timezone)
- PostgreSQL documentation: `AT TIME ZONE` behavior differs between `timestamp` and `timestamptz` types
- Project memory: Convoso call_date is America/Los_Angeles (Pacific), not UTC
- Project constraints: Inline React.CSSProperties only, dark glassmorphism theme

---
*Pitfalls research for: Lead source timing analytics with mixed-timezone data*
*Researched: 2026-03-26*
