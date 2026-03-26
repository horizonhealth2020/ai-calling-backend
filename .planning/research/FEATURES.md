# Feature Research: Lead Source Timing Analytics

**Domain:** Outbound sales analytics / call center performance intelligence
**Researched:** 2026-03-26
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features managers and owners will expect from any "timing analytics" section. Missing these makes the feature feel half-baked.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Source x Hour heatmap grid | This is the core visualization -- a 2D grid of lead sources (rows) vs hours (columns) colored by close rate. Every sales analytics tool that claims "best time to call" has one. | MEDIUM | Render as HTML table/grid with inline background-color gradient. No charting library needed -- CSS background opacity on cells is sufficient for the dark theme. Data: `GROUP BY leadSourceId, EXTRACT(HOUR FROM callTimestamp)` joining ConvosoCallLog to Sale. |
| Close rate as primary metric | Close rate (sales / calls) is the bottom-line metric for outbound. Connect rate and contact rate are upstream enablers, but close rate is what pays commissions. Industry consensus: close rate is the true measure of sales success. | LOW | `COUNT(sales WHERE status=RAN) / COUNT(calls)` per source per hour bucket. Sale joins via `leadSourceId` + time window overlap. |
| Sample size indicators | Without sample size, a cell showing "100% close rate" from 1 call is misleading. Users expect to know when data is too thin to trust. Standard practice in any analytics tool. | LOW | Display call count in each cell (e.g., "32% (47)"). Dim or grey-out cells below a threshold (suggest N < 10 calls). No statistical significance calculation needed -- just visual de-emphasis of low-N cells. |
| Date range filter | Already exists in the platform (Current Week / Last Week / 30 Days / Custom). Users expect analytics to respect the same filtering pattern. The milestone specifies independent range: Last Week / 30 Days / 60 Days / 90 Days / Custom. | LOW | Reuse existing DateRangeFilter component from @ops/ui with extended presets. Longer default ranges (30 Days) make sense for analytics -- weekly data is too sparse for hourly patterns. |
| Day-of-week toggle on heatmap | Industry data shows strong day-of-week patterns (Tue-Thu outperform Mon/Fri). Users expect to slice by day. The milestone explicitly calls for "day-of-week and week-of-month views." | MEDIUM | Toggle between: (a) Source x Hour aggregated across all days, (b) Source x Hour filtered to specific day-of-week, (c) Source x Hour by week-of-month. Server endpoint returns all dimensions; client filters. |
| "Best Source Right Now" recommendation card | Explicitly in the milestone requirements. Answers the question managers ask every morning: "Which source should my agents dial first?" | MEDIUM | Server computes: for current hour + current day-of-week, rank lead sources by historical close rate WHERE sample size >= threshold. Return top 1-3 sources with close rate, call count, and trend direction. Depends on: ConvosoCallLog with leadSourceId + callTimestamp, Sale with leadSourceId + saleDate. |
| Visible on both Manager and Owner dashboards | Milestone specifies both. Managers need it for real-time call routing decisions. Owners need it for lead source ROI analysis. | LOW | Same API endpoint, same component rendered in two tabs. Manager sees it on "Performance Tracker" tab; Owner sees it on their dashboard. |

### Differentiators (Competitive Advantage)

Features that go beyond what generic analytics tools offer. These leverage the platform's unique data (Convoso call logs + sale outcomes + lead source costs).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Daypart sparklines table | 7-day rolling conversion trend per source per daypart (morning/afternoon/evening). Shows whether a source is getting better or worse at specific times. Most analytics tools show static snapshots; trends reveal momentum. | MEDIUM | Three dayparts: Morning (8-12), Afternoon (12-5), Evening (5-8). For each source, show a tiny inline SVG sparkline (7 data points = last 7 days). No charting library -- SVG polyline is ~15 lines of code. Data: daily close rates per source per daypart for last 7 days. |
| Cost-per-sale overlay on heatmap | Platform already has costPerLead on LeadSource and costPerSale on AgentCallKpi. Overlaying cost data on the timing heatmap answers: "Not just which source converts best right now, but which is cheapest to convert right now." | LOW | Toggle heatmap color between close-rate mode and cost-per-sale mode. Cost = (costPerLead * calls) / sales for each cell. LeadSource.costPerLead is already in the schema. |
| "Best Source Right Now" with trend arrow | Instead of just showing the top source, show whether it is trending up or down compared to same hour last week. A source at 25% and climbing is different from 25% and falling. | LOW | Compare current-period close rate to prior-period close rate for same hour/day. Display up/down/flat arrow. Simple arithmetic on the same query with two date windows. |
| Agent-level drill-down per cell | Click a heatmap cell (e.g., "Source X at 2 PM") to see which agents performed best/worst on that source at that hour. Connects timing analytics to agent coaching. | MEDIUM | Modal or expandable row showing agent breakdown. Query: `GROUP BY agentId` with same source + hour filter. Leverages existing agent-performance table patterns from Manager dashboard. |
| Real-time "pulse" via Socket.IO | When a new sale or call comes in, update the "Best Source Right Now" card without page refresh. Platform already has Socket.IO infrastructure for real-time updates. | LOW | Emit event on new ConvosoCallLog or Sale creation. Client recalculates the recommendation card. Existing Socket.IO provider at layout level handles connection. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Predictive ML model for "best source" | Sounds impressive -- "AI-powered recommendations." | Massive complexity for marginal gain over simple historical averages. The data volume (hundreds of calls/day, not millions) does not support ML. Overfitting risk is high. Training pipeline adds maintenance burden. | Simple historical average with recency weighting (last 30 days, weighted toward recent weeks) provides 90% of the value at 1% of the complexity. |
| Real-time auto-routing to dialers | Auto-switch Convoso campaigns based on analytics. | Dangerous without human oversight. A bad data hour could route all agents to wrong source. Integration with Convoso campaign API adds external dependency. | Show the recommendation; let managers make the routing decision. Advisory, not automated. |
| Per-minute granularity | "Hour is too coarse, show me 15-minute windows." | Splits already-sparse data into even sparser buckets. A source with 50 calls in an hour becomes 12 calls per 15-min window -- too noisy to draw conclusions. | Stick with hourly buckets. They match how call centers actually think about shifts and scheduling. |
| Conversion funnel visualization (calls -> contacts -> pitches -> closes) | Multi-stage funnel analytics. | The platform's data model tracks calls (ConvosoCallLog) and sales (Sale) -- not intermediate stages like "contact made" or "pitch delivered." Building a full funnel requires call disposition data that does not exist in the current schema. | Two-stage metric (calls to sales) is honest about what the data supports. Add call duration tiers as a proxy for "quality contact" -- calls > 60 seconds likely reached a decision-maker. |
| Heatmap with drag-to-zoom or interactive tooltips via D3/Recharts | Rich interactive charting library. | Adds a dependency (Recharts/D3) to a codebase that uses zero charting libraries. The inline CSSProperties pattern means all visualizations must be built with React + inline styles. A charting library would be a foreign pattern. | HTML table with inline background-color gradients. Hover shows a simple tooltip div. Sparklines as inline SVG. Keeps the zero-dependency visualization pattern consistent with the rest of the platform. |
| Compare agent-to-agent heatmaps side by side | "Show me Agent A vs Agent B on the same source." | Per-agent data is extremely sparse when sliced by source AND hour. An agent might have 2-3 calls in a given source-hour cell over 30 days. The visualization would be mostly empty cells. | Agent drill-down within a cell (differentiator above) is the right level. Aggregate heatmap at source level, then drill into agents contextually. |

## Feature Dependencies

```
[ConvosoCallLog data with leadSourceId + callTimestamp]
    |
    +--requires--> [Timing aggregation API endpoint]
    |                  |
    |                  +--enables--> [Source x Hour heatmap]
    |                  |                 |
    |                  |                 +--enhances--> [Day-of-week toggle]
    |                  |                 +--enhances--> [Cost-per-sale overlay]
    |                  |                 +--enhances--> [Agent-level drill-down]
    |                  |
    |                  +--enables--> ["Best Source Right Now" card]
    |                  |                 +--enhances--> [Trend arrow]
    |                  |                 +--enhances--> [Socket.IO real-time pulse]
    |                  |
    |                  +--enables--> [Daypart sparklines table]
    |
[Sale data with leadSourceId + saleDate + status]
    |
    +--requires--> [Close rate calculation (sales/calls join)]

[DateRangeFilter component from @ops/ui]
    +--enables--> [Independent date range filter for analytics]

[Manager "Performance Tracker" tab (renamed from "Agent Tracker")]
    +--hosts--> [Heatmap + sparklines + recommendation card]

[Owner dashboard]
    +--hosts--> [Same analytics components]
```

### Dependency Notes

- **Heatmap requires timing aggregation endpoint:** The core API query joins ConvosoCallLog (calls with timestamps) to Sale (outcomes with leadSourceId). Both already have leadSourceId as a foreign key. The correlation is at the aggregate level: count calls per source/hour, count sales per source/hour, divide for close rate.
- **"Best Source Right Now" requires the same data as heatmap:** It is the heatmap query filtered to current hour + current day-of-week, then ranked. Build the heatmap endpoint first; the recommendation is a derived view.
- **Daypart sparklines require daily granularity:** The heatmap endpoint returns hourly data; sparklines need daily rollups grouped into dayparts. Could be same endpoint with different GROUP BY, or a separate lightweight query.
- **All features depend on ConvosoCallLog having leadSourceId populated:** This was added in v1.7 via Convoso KPI poller. Analytics will only cover data from v1.7 onward. Older call logs without leadSourceId are excluded automatically by the FK filter.
- **Sale-to-call correlation is approximate:** Sales have `saleDate` and `leadSourceId`. Calls have `callTimestamp` and `leadSourceId`. Matching is by source + time proximity at the aggregate level, not a direct foreign key. This is a known limitation that sample size indicators help mitigate.

## MVP Definition

### Launch With (v1.8 Phase 1-2)

- [ ] **Timing aggregation API endpoint** -- Single endpoint returning close rate by leadSourceId x hour x day-of-week, with call counts. This is the data backbone for all visualizations.
- [ ] **Source x Hour heatmap** -- HTML table with color-gradient cells, sample size in each cell, dim low-N cells. Default: 30-day range, all days aggregated.
- [ ] **Day-of-week toggle** -- Filter heatmap by specific day or view all-days aggregate.
- [ ] **"Best Source Right Now" card** -- Top 1-3 sources for current hour/day with close rate and call count. Minimum N threshold to avoid recommending sources with tiny samples.
- [ ] **Independent date range filter** -- Last Week / 30 Days / 60 Days / 90 Days / Custom, defaulting to 30 Days.
- [ ] **Sample size indicators** -- Call count per cell, visual de-emphasis below threshold.
- [ ] **Tab rename** -- "Agent Tracker" becomes "Performance Tracker" on Manager dashboard.

### Add After Validation (v1.8 Phase 3)

- [ ] **Daypart sparklines table** -- 7-day trend lines per source per daypart. Adds the temporal dimension: "Is this source getting better or worse?"
- [ ] **Cost-per-sale overlay** -- Toggle heatmap coloring between close rate and cost efficiency. Uses existing LeadSource.costPerLead.
- [ ] **Trend arrow on "Best Source Right Now"** -- Compare current vs prior period performance.
- [ ] **Real-time Socket.IO updates** -- Push updates to recommendation card on new call/sale events.

### Future Consideration (v2+)

- [ ] **Agent-level drill-down per cell** -- Defer because per-agent-per-source-per-hour data is sparse initially. Revisit once 90+ days of data accumulate.
- [ ] **Week-of-month heatmap view** -- Lower priority than day-of-week. Add if users ask for monthly cyclical patterns.
- [ ] **Exportable analytics (CSV/PDF)** -- The platform already has CSV export patterns. Apply to analytics once the data views are validated.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Timing aggregation API | HIGH | MEDIUM | P1 |
| Source x Hour heatmap | HIGH | MEDIUM | P1 |
| "Best Source Right Now" card | HIGH | LOW | P1 |
| Date range filter (extended) | HIGH | LOW | P1 |
| Sample size indicators | HIGH | LOW | P1 |
| Day-of-week toggle | MEDIUM | LOW | P1 |
| Tab rename to "Performance Tracker" | LOW | LOW | P1 |
| Daypart sparklines | MEDIUM | MEDIUM | P2 |
| Cost-per-sale overlay | MEDIUM | LOW | P2 |
| Trend arrow on recommendation | MEDIUM | LOW | P2 |
| Socket.IO real-time updates | MEDIUM | LOW | P2 |
| Agent drill-down per cell | LOW | MEDIUM | P3 |
| Week-of-month view | LOW | LOW | P3 |
| Analytics CSV export | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for v1.8 launch -- core analytics value
- P2: Should have, adds depth after core is working
- P3: Nice to have, defer until data accumulates

## Key Metrics Hierarchy

The milestone should focus on these metrics in priority order:

1. **Close rate (sales / calls)** -- The money metric. A call that leads to a sale is the only outcome that generates revenue. This is the primary heatmap color dimension.

2. **Call volume (total calls)** -- Sample size indicator. A 50% close rate from 2 calls is noise; 50% from 200 calls is a pattern. Display alongside close rate in every cell.

3. **Cost per sale (lead cost * calls / sales)** -- ROI metric. Uses existing LeadSource.costPerLead. A source with 30% close rate at $5/lead beats one with 40% close rate at $20/lead if cost matters. Secondary heatmap toggle.

4. **Connect rate (calls > 60 seconds / total calls)** -- Proxy for reaching a live person. ConvosoCallLog has callDurationSeconds. Calls under 60 seconds likely hit voicemail or were dropped. Useful for diagnosing WHY a source underperforms at certain hours (bad numbers vs. bad timing).

5. **Average call duration** -- Already stored in ConvosoCallLog.callDurationSeconds and aggregated in AgentCallKpi.avgCallLength. Longer calls at certain hours may indicate better lead engagement even without a sale.

## Existing Data Model Fit

### What Already Exists (No Schema Changes Needed)

| Data Point | Source | Field |
|------------|--------|-------|
| Call timestamp | ConvosoCallLog | `callTimestamp` (already indexed) |
| Call-to-source mapping | ConvosoCallLog | `leadSourceId` (FK to LeadSource) |
| Call duration | ConvosoCallLog | `callDurationSeconds` |
| Call-to-agent mapping | ConvosoCallLog | `agentId` (FK to Agent) |
| Sale outcome | Sale | `status` (RAN / DECLINED / DEAD) |
| Sale-to-source mapping | Sale | `leadSourceId` (FK to LeadSource) |
| Sale date | Sale | `saleDate` |
| Lead source cost | LeadSource | `costPerLead` |
| Existing composite index | ConvosoCallLog | `@@index([agentId, leadSourceId, callTimestamp])` |

### What Might Need Adding

| Need | Why | Approach |
|------|-----|----------|
| Index on `ConvosoCallLog(leadSourceId, callTimestamp)` | The existing composite index includes agentId first, which is suboptimal for source-level aggregation queries that do not filter by agent. | Add a new index: `@@index([leadSourceId, callTimestamp])` |
| Timezone-aware hour extraction | ConvosoCallLog.callTimestamp stores timestamps but Convoso call_date is in Pacific time (America/Los_Angeles). Hour-of-day analytics must use the business's local timezone, not UTC. | Extract hour using `AT TIME ZONE 'America/New_York'` in Prisma raw query (business operates East Coast based on Luxon config using America/New_York). |

### Sale-to-Call Correlation Strategy

There is no direct FK from Sale to ConvosoCallLog. The correlation is:
- Same `leadSourceId` on both tables
- `Sale.saleDate` should be close to `ConvosoCallLog.callTimestamp`

For heatmap purposes, this correlation is handled implicitly: count calls by source/hour, count sales by source/hour, divide. The join is at the aggregate level (same source, same hour bucket), not row-level. This is simpler and more robust than trying to match individual calls to individual sales.

## Competitor Feature Analysis

| Feature | Convoso Analytics | Five9 Dashboards | Generic BI (Looker/Metabase) | Our Approach |
|---------|-------------------|-------------------|-------------------------------|--------------|
| Hourly heatmap | Built into dialer analytics, but only shows connect rate, not close rate | Available as custom report | Requires manual SQL and dashboard config | Close rate heatmap with call volume, zero config for the user |
| "Best source now" | Not available -- shows aggregate metrics only | Not available | Not a standard widget | Unique differentiator: real-time recommendation with trend context |
| Daypart sparklines | Not available | Not available | Possible via custom visualization | Mini inline trends showing source momentum over 7 days |
| Cost overlay | Shows cost metrics separately from timing | Cost dashboards separate from timing | Can be combined with effort | Unified view: close rate AND cost in one heatmap toggle |
| Sample size warnings | Usually shows raw numbers without statistical context | Some products show confidence intervals | Depends on configuration | Visual de-emphasis of low-N cells prevents over-reliance on sparse data |

## Sources

- [Convoso: Best Time to Cold Call](https://www.convoso.com/blog/best-time-to-cold-call/) -- Industry timing data, optimal call windows
- [Revenue.io: Best Time to Cold Call Prospects](https://www.revenue.io/blog/the-best-time-to-cold-call-prospects) -- Data-backed call timing patterns
- [Close.com: Best Days & Times to Cold Call](https://www.close.com/blog/best-days-times-to-cold-call) -- Day-of-week performance patterns
- [Convoso: Contact Rate vs Connection Rate](https://www.convoso.com/blog/connection-rate-vs-contact-rate/) -- Metric definitions and hierarchy
- [Balto: Outbound Call Center Performance Metrics](https://www.balto.ai/blog/outbound-call-center-performance-metrics/) -- KPI hierarchy for outbound
- [CloudTalk: Call Center Analytics Dashboard Best Practices](https://www.cloudtalk.io/blog/call-center-analytics-dashboard/) -- Dashboard design patterns
- [Zoom: Call Center Dashboard](https://www.zoom.com/en/blog/call-center-dashboard/) -- Metrics tracking best practices
- [Monday.com: Lead Analytics Dashboard Metrics](https://monday.com/blog/crm-and-sales/lead-analytics-dashboard/) -- 2026 analytics trends
- [LogRocket: Best Heatmap Libraries for React](https://blog.logrocket.com/best-heatmap-libraries-react/) -- Visualization options (decided against external library)
- [ZoomInfo: Best Days to Cold Call](https://pipeline.zoominfo.com/sales/best-days-to-cold-call) -- 1.4M call dataset patterns

---
*Feature research for: Lead Source Timing Analytics (v1.8)*
*Researched: 2026-03-26*
