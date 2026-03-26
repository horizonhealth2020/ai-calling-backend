# Project Research Summary

**Project:** Lead Source Timing Analytics (v1.8)
**Domain:** Data visualization additions to existing sales operations platform
**Researched:** 2026-03-26
**Confidence:** HIGH

## Executive Summary

This feature adds lead source timing analytics to an existing Express/Prisma/Next.js sales operations monorepo. All four research areas converge on a single clear approach: build server-side PostgreSQL aggregations over existing `ConvosoCallLog` and `Sale` tables, expose three new API endpoints, and render the results using hand-rolled SVG and inline CSSProperties components — no new dependencies required. The codebase already contains every building block: timezone-aware Luxon, Socket.IO for real-time updates, an established inline-style design system, and parallel-query patterns from existing tracker routes.

The recommended approach is a four-phase build that front-loads critical data layer work. Before any UI is touched, Phase 1 must resolve two pre-existing bugs in `convosoKpiPoller.ts` (crude DST handling and server-local-time usage) and add two database indexes. These fixes are prerequisites, not enhancements — without them, every heatmap cell will bucket calls into the wrong hours. Once the data layer is correct, the heatmap, sparklines, and recommendation card all derive from the same aggregation pattern and can be built with confidence.

The primary risks are all timezone-related. Mixed-timezone data (Convoso Pacific call timestamps stored as UTC, Sales timestamps in UTC, business operating in Eastern) creates multiple failure surfaces where hours silently shift. The mitigation strategy is consistent: use `AT TIME ZONE 'America/Los_Angeles'` in every PostgreSQL aggregation and Luxon with explicit zone for all application-level time math. Secondary risks are statistical (misleading heatmap cells from small sample sizes) and are fully addressed by the sample-size indicator design specified in FEATURES.md.

## Key Findings

### Recommended Stack

Research strongly recommends building all visualizations with raw SVG and React's native JSX rendering. No charting library is justified for this scope: one heatmap (a 60-line `<rect>` grid), one sparkline (a 30-line `<polyline>`), and one recommendation card (standard React divs). Every charting library evaluated (recharts, visx, nivo, d3) either conflicts with the inline CSSProperties constraint, introduces fighting theming layers, or brings 250KB+ of dependencies for functionality expressible in under 200 lines.

**Core technologies:**
- Raw SVG + React 18.3.1: Heatmap grid and sparkline rendering — zero dependencies, full inline-style control, native JSX rendering
- Luxon ^3.4.4: Timezone-aware hour/day bucketing — already installed, handles DST automatically via named zones
- Prisma `$queryRaw`: Aggregation queries with PostgreSQL-specific functions (`EXTRACT`, `AT TIME ZONE`, `GROUP BY`) — required because Prisma's query builder cannot express these
- Express + Zod: Three new API endpoints following existing route/validation patterns — no new setup needed
- Socket.IO-client ^4.8.3: Real-time recommendation card updates — already installed at layout level

### Expected Features

Research identified seven table-stakes features that must ship in v1.8 Phase 1-2, five differentiators that add depth in Phase 3, and four anti-features to explicitly avoid.

**Must have (table stakes):**
- Source x Hour heatmap grid with close rate coloring — the core visualization every timing analytics tool provides
- Sample size indicators per cell (`23% (47 calls)`) — without these, 1/1 = 100% misleads managers into bad routing decisions
- Date range filter with 30/60/90-day presets — timing patterns require longer windows than the weekly payroll presets
- Day-of-week toggle on heatmap — Tue-Thu patterns differ strongly from Mon/Fri; industry data confirms this
- "Best Source Right Now" recommendation card — the primary actionable output, ranked by current-hour historical close rate
- Manager and Owner dashboard visibility — explicitly required by milestone, same components rendered in both
- Tab rename from "Agent Tracker" to "Performance Tracker" — low effort, part of milestone spec

**Should have (competitive):**
- Daypart sparklines (7-day rolling trend per source) — reveals whether a source is improving or declining
- Cost-per-sale heatmap overlay — toggle between close rate and cost efficiency using existing `LeadSource.costPerLead`
- Trend arrow on recommendation card — current vs prior-period comparison
- Real-time Socket.IO pulse on recommendation card — existing infrastructure makes this low effort

**Defer (v2+):**
- Agent-level drill-down per heatmap cell — data is too sparse until 90+ days of records accumulate
- Week-of-month heatmap view — lower priority than day-of-week
- Analytics CSV export — apply after data views are validated

### Architecture Approach

The feature integrates cleanly as a new route module (`routes/lead-timing.ts`) plus a new dashboard section (`LeadTimingSection.tsx`). No new database tables are needed. The architecture is a direct extension of the existing tracker pattern: parallel raw SQL queries, TypeScript application-level join, typed API response, React components with inline styles. The critical design decision is keeping the timing analytics date filter as independent local state, not wired to the global `DateRangeContext` which controls payroll-week presets.

**Major components:**
1. `routes/lead-timing.ts` — Three GET endpoints (heatmap, sparklines, recommendation), all using `prisma.$queryRaw` with `AT TIME ZONE 'America/Los_Angeles'`, parallel query execution, and BigInt-to-Number conversion before JSON serialization
2. `LeadTimingSection.tsx` — Wrapper component with independent date filter state; composes all three visualization components; renders in both Manager and Owner dashboard tabs
3. `LeadTimingHeatmap.tsx` / `LeadTimingSparklines.tsx` / `BestSourceCard.tsx` — Pure display components; heatmap uses inline `backgroundColor` computed from `interpolateColor(t)`; sparklines use SVG `<polyline>`; recommendation card uses existing `Card` and `Badge` from `@ops/ui`

### Critical Pitfalls

1. **Naive hour extraction from UTC timestamps** — Always use `AT TIME ZONE 'America/Los_Angeles'` in every `EXTRACT()` call in PostgreSQL. Never use `getUTCHours()` or `getHours()` — the former gives UTC hours, the latter uses the server's local zone (UTC on Railway). Test by verifying a 9 AM Pacific call appears in the 9 AM heatmap column, not the 16-17 PM column.

2. **DST bug in `convosoDateToUTC`** — The existing poller uses a crude month-range check (`month >= 2 && month <= 9`) that is wrong at DST boundaries. Replace with Luxon: `DateTime.fromFormat(dateStr, 'yyyy-MM-dd HH:mm:ss', { zone: 'America/Los_Angeles' })`. Fix this before writing analytics queries or DST-boundary data corrupts heatmap cells.

3. **Misleading cells from low sample sizes** — A 100% close rate from 1 call looks identical to 100% from 50 calls without sample size indicators. Three-layer defense: gray out cells below N=5 threshold, show count alongside rate in each cell, and ensure the recommendation endpoint ignores sources with fewer than 10 calls in the target hour slot.

4. **Call-to-sale join using wrong time field** — `Sale.saleDate` is the business date for analytics but lacks hour precision in many records. `Sale.createdAt` has timestamp precision but reflects when the record was entered, not when the call happened. The correct approach is aggregate-level correlation (count calls per source/hour, count sales per source/day) rather than attempting row-level sale-to-call matching. Settling this metric definition is a Phase 1 product decision.

5. **Query performance on 90-day range** — The existing `ConvosoCallLog` composite index leads with `agentId`, making it suboptimal for source-level aggregations. Add `@@index([leadSourceId, callTimestamp])` on `ConvosoCallLog` and `@@index([leadSourceId, createdAt])` on `Sale` in Phase 1. Add a 5-10 minute in-memory cache if response times exceed 500ms.

## Implications for Roadmap

Based on combined research, the natural phase structure follows strict data-dependency ordering. The API must exist before the UI. The timezone bugs must be fixed before the API is written. The Owner dashboard integration is pure component reuse with no new API work.

### Phase 1: Data Layer — Prerequisite Fixes, Indexes, and API Endpoints

**Rationale:** All visualizations are downstream of correct data. Two pre-existing bugs in the poller produce wrong timestamps; writing queries on top of bad data locks in incorrect heatmap patterns from day one. This phase must ship and be validated with curl/Postman before any UI work begins.

**Delivers:** Three working API endpoints returning correctly time-bucketed close rate data; fixed DST handling in `convosoDateToUTC`; fixed server timezone in business hours check; two new database indexes.

**Addresses:**
- Fix `convosoDateToUTC` to use Luxon (Pitfall 2, PITFALLS.md)
- Fix `new Date().getHours()` business hours check to use Luxon with explicit zone (Pitfall 6, PITFALLS.md)
- Add `@@index([leadSourceId, callTimestamp])` on ConvosoCallLog and `@@index([leadSourceId, createdAt])` on Sale (Pitfall 4, PITFALLS.md)
- Settle the sale-to-call correlation metric definition before writing queries (Pitfall 5, PITFALLS.md)
- Build `routes/lead-timing.ts` with all three endpoints using `prisma.$queryRaw` + `AT TIME ZONE` (Pitfall 1, PITFALLS.md)
- Include call count in all API responses to enable sample size UI in Phase 2 (Pitfall 3, PITFALLS.md)

**Avoids:** Timezone shifts in heatmap cells, DST-boundary data corruption, slow 90-day queries, misleading close rates

### Phase 2: Core Heatmap and Tab Rename

**Rationale:** The heatmap is the highest-value visualization and validates that the Phase 1 API data shape is correct. The tab rename is a trivial one-line change bundled here. Manager stakeholders can validate the heatmap before the full feature set is complete.

**Delivers:** Functional source x hour heatmap in Manager's "Performance Tracker" tab; independent date range filter with 30/60/90-day presets; day-of-week toggle; sample size indicators (gray cells below N=5 threshold).

**Uses:** Raw SVG `<rect>` grid with `interpolateColor(t)` utility (STACK.md); inline CSSProperties `cellColor(closeRate, calls)` function; independent `useState` for date filter (ARCHITECTURE.md Anti-Pattern 2)

**Implements:** `LeadTimingHeatmap.tsx`, `LeadTimingSection.tsx`, `LeadTimingDateFilter.tsx`; rename `NAV_ITEMS` in `manager/page.tsx`

**Avoids:** Using global `DateRangeContext`; charting library dependency; Canvas-based rendering

### Phase 3: Sparklines, Recommendation Card, and Differentiators

**Rationale:** These components build on the same data patterns established in Phase 2 and add the temporal and real-time dimensions. The recommendation card is the highest-value daily-use feature; sparklines add the "is this trend improving?" context.

**Delivers:** Daypart sparklines table with 7-day SVG trend lines; "Best Source Right Now" card with confidence indicator and trend arrow; real-time Socket.IO updates on new call/sale events; cost-per-sale heatmap overlay toggle.

**Uses:** Raw SVG `<polyline>` sparklines (30-line component per STACK.md); existing Socket.IO provider at layout level; existing `LeadSource.costPerLead` field; existing `Card` and `Badge` from `@ops/ui`

**Implements:** `LeadTimingSparklines.tsx`, `BestSourceCard.tsx`; Socket.IO emit on ConvosoCallLog/Sale creation

**Avoids:** Recommending sources below sample size threshold; showing trend arrows without sufficient comparison-period data

### Phase 4: Owner Dashboard Integration

**Rationale:** Owner dashboard is a pure component reuse phase — no new API work required. `OWNER_VIEW` role access needs verification against the `requireAuth` middleware, but no additional role restriction is needed beyond what Phase 1 establishes.

**Delivers:** `BestSourceCard` and `LeadTimingHeatmap` visible on Owner dashboard; OWNER_VIEW role confirmed able to reach lead-timing endpoints.

**Uses:** Same components from Phases 2-3; role verification via existing `requireAuth` middleware

**Implements:** Import `LeadTimingSection` (or subset) into `OwnerOverview.tsx` or `OwnerKPIs.tsx`

### Phase Ordering Rationale

- Phase 1 must precede all others because the analytics surface is only as trustworthy as the data layer; fixing timezone bugs after visualizations are built forces re-validation of every chart
- Phase 2 before Phase 3 because the heatmap confirms the API data contract; sparklines and the recommendation card are derived views of the same query patterns
- Phase 4 last because it requires zero new API work and is a read-only consumer of already-built components
- The split between Phase 2 and Phase 3 creates a natural validation checkpoint: the heatmap can be demoed to managers before completing the full feature set

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** The sale-to-call correlation metric definition requires a product decision (aggregate-level correlation vs daily close rate overlay). Both are technically viable but produce different user-facing numbers. Validate with manager stakeholder before writing queries.
- **Phase 1:** `Sale.saleDate` hour precision needs a data audit — if most sales are entered at midnight or noon, hour-level sale bucketing is meaningless and the heatmap should show call volume only with a separate daily close rate metric.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Heatmap grid with inline styles follows directly from established codebase patterns. All implementation details are specified in ARCHITECTURE.md with full code examples.
- **Phase 3:** SVG sparklines and Socket.IO real-time updates have explicit code patterns in ARCHITECTURE.md. Socket.IO provider already exists at layout level.
- **Phase 4:** Owner dashboard integration is component import work with no novel decisions.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against installed package.json; specific version compatibility confirmed; all charting library alternatives explicitly evaluated and rejected with cited reasons |
| Features | HIGH | Industry sources consulted (Convoso, Revenue.io, ZoomInfo 1.4M call dataset); competitor feature analysis completed; feature prioritization matrix grounded in existing platform data model |
| Architecture | HIGH | Derived from direct codebase analysis of existing routes, schema, and component patterns; SQL queries and TypeScript patterns provided with full implementation detail |
| Pitfalls | HIGH | Most pitfalls identified from direct codebase analysis of existing bugs (`convosoKpiPoller.ts` DST check, `getHours()` usage); PostgreSQL `AT TIME ZONE` behavior verified against documentation |

**Overall confidence:** HIGH

### Gaps to Address

- **Sale hour precision:** `Sale.saleDate` is documented as lacking hour-level precision (set to noon in the seed). A data audit of production `Sale.createdAt` timestamps is needed to determine whether hour-of-day sale bucketing is reliable or whether the heatmap should display call-volume only with daily close rate as a separate metric. Resolve before writing Phase 1 queries.

- **Convoso data coverage:** Analytics will only cover call logs from v1.7 onward (when `leadSourceId` was added to ConvosoCallLog). The total date range of available data is unknown. If less than 30 days of data exists, the default 30-day range filter will show sparse heatmaps at launch. Consider showing a data-coverage indicator or defaulting to the available-data range on first load.

- **Timezone for heatmap hours:** PITFALLS.md recommends `America/Los_Angeles` (Convoso source timezone per project memory). ARCHITECTURE.md references `America/New_York` (payroll/business timezone). The call center's operating timezone needs explicit confirmation before writing queries — heatmap hours should reflect the timezone managers think in, not the timezone Convoso data originates from.

## Sources

### Primary (HIGH confidence)

- `apps/ops-api/src/workers/convosoKpiPoller.ts` — DST handling bug, business hours check bug, ConvosoCallLog write pattern (direct codebase analysis)
- `prisma/schema.prisma` — ConvosoCallLog, Sale, LeadSource models and existing indexes (direct codebase analysis)
- `apps/ops-api/src/routes/sales.ts` — parallel query pattern, aggregation approach (direct codebase analysis)
- `apps/ops-dashboard/app/(dashboard)/manager/page.tsx` — tab structure, NAV_ITEMS pattern (direct codebase analysis)
- `apps/ops-dashboard/lib/DateRangeContext.tsx` — global date range pattern, isolation rationale (direct codebase analysis)
- `packages/ui/src/tokens.ts` — design token CSS custom properties confirmed compatible with SVG fill (direct codebase analysis)
- React 18 SVG rendering — native JSX SVG support confirmed for `<svg>`, `<rect>`, `<polyline>`, `<text>`, `<g>`
- PostgreSQL `EXTRACT()` + `AT TIME ZONE` documentation — behavior on `timestamptz` confirmed correct
- Prisma `$queryRaw` documentation — tagged template parameterization confirmed safe against SQL injection

### Secondary (MEDIUM confidence)

- [Convoso: Best Time to Cold Call](https://www.convoso.com/blog/best-time-to-cold-call/) — Industry call timing patterns and peak hours
- [ZoomInfo: Best Days to Cold Call](https://pipeline.zoominfo.com/sales/best-days-to-cold-call) — 1.4M call dataset day-of-week patterns
- [Balto: Outbound Call Center Performance Metrics](https://www.balto.ai/blog/outbound-call-center-performance-metrics/) — Close rate as primary KPI hierarchy for outbound call centers
- [LogRocket: Best Heatmap Libraries for React](https://blog.logrocket.com/best-heatmap-libraries-react/) — Charting library evaluation leading to rejection of all external options
- npm package versions for recharts (3.8.1), @visx/heatmap (3.12.0), react-sparklines (1.7.0) — verified via `npm view`

### Tertiary (LOW confidence)

- [Recharts inline style GitHub issue #2169](https://github.com/recharts/recharts/issues/2169) — Inline style CSS class conflicts (not directly tested in this codebase; cited issue confirmed to exist)
- react-sparklines React 18 compatibility — unverified; inferred from package being unmaintained since 2018

---
*Research completed: 2026-03-26*
*Ready for roadmap: yes*
