# Phase 30: Lead Source Timing Analytics - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Data layer fixes (Convoso timezone bugs, DB indexes), aggregation API endpoints for timing analytics, heatmap/sparklines/recommendation card UI on Manager Performance Tracker and Owner dashboard, independent date range filter, tab rename + Today column on agent performance, and fallback bundle commission fix. All within existing Express + Prisma + Next.js architecture using inline React.CSSProperties.

</domain>

<decisions>
## Implementation Decisions

### Heatmap Visual Design
- **D-01:** Red-to-green gradient color scale for heatmap cells (red = low close rate, yellow = mid, green = high). Must contrast well against dark glassmorphism background.
- **D-02:** Dropdown selector for grouping mode with three options: Day of Week, Week of Month, Month of Year. Compact dropdown matching existing dashboard control patterns.
- **D-03:** Low sample size cells (< 10 calls) visually de-emphasized with reduced opacity. Tooltip shows exact close rate, call count, sale count.

### Metric Definition
- **D-04:** All times displayed in Eastern timezone (America/New_York). Convoso Pacific timestamps and Sale UTC timestamps both converted to ET for consistent display.
- **D-05:** Use Sale.createdAt (not Sale.saleDate) for hourly bucketing — saleDate lacks hour precision.
- **D-06:** Close rate = aggregate (sales count / call count) per source per time bucket. No FK between calls and sales — correlation is by leadSourceId + time window, not row-level matching.

### Analytics Section Layout
- **D-07:** Section is collapsible with a header toggle. Default collapsed on page load to avoid overwhelming the tracker view.
- **D-08:** Layout within section is Claude's discretion — pick the best arrangement of Best Source card, heatmap, and sparklines for the dark theme.
- **D-09:** Independent date range filter (Last Week / 30 Days / 60 Days / 90 Days / Custom) separate from the global DateRangeContext. Applies only to the timing analytics section.

### Commission Fix
- **D-10:** Fallback addon only qualifies for full commission when primary required addon is NOT available in the member's state. If primary IS available in that state but not in the sale, fallback does not substitute — half commission applies.
- **D-11:** Fix is in `resolveBundleRequirement()` in payroll.ts: only enter fallback checking loop when `!requiredAvail`. Current code falls through to fallbacks even when primary is available.

### Dashboard Polish
- **D-12:** Rename "Agent Tracker" tab to "Performance Tracker" in manager page.tsx NAV_ITEMS.
- **D-13:** Add "Today" column to agent performance table in ManagerTracker.tsx.

### Claude's Discretion
- Analytics section internal layout (card + heatmap + sparklines arrangement)
- Exact heatmap cell sizing and spacing
- Sparkline SVG dimensions and styling
- Loading skeleton design for analytics section
- Error state handling for insufficient data
- Exact gradient RGB values for red-to-green scale on dark theme

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Timing Analytics API
- `.planning/research/ARCHITECTURE.md` — API endpoint specs, query patterns, component boundaries
- `.planning/research/FEATURES.md` — Feature landscape, table stakes vs differentiators, metric hierarchy
- `.planning/research/STACK.md` — Stack recommendations (no new deps, SVG approach)
- `.planning/research/PITFALLS.md` — Timezone bugs, sample size traps, performance pitfalls

### Commission Logic
- `apps/ops-api/src/services/payroll.ts` — `resolveBundleRequirement()` (lines 207-244), `calculateCommission()`, `BundleRequirementContext` type

### Dashboard Integration Points
- `apps/ops-dashboard/app/(dashboard)/manager/page.tsx` — NAV_ITEMS array (tab label), ManagerTracker import
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx` — Agent performance table, date range usage, component structure
- `apps/ops-dashboard/lib/DateRangeContext.tsx` — Global date range (analytics section needs independent filter)
- `packages/ui/src/components/DateRangeFilter.tsx` — Reusable filter component with presets

### Convoso Data Layer
- `apps/ops-api/src/workers/convosoKpiPoller.ts` — `convosoDateToUTC()` DST bug (line 11), business hours check
- `apps/ops-api/src/services/convosoCallLogs.ts` — Call log service
- `apps/ops-api/src/routes/call-logs.ts` — Existing call log routes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DateRangeFilter` from @ops/ui: Reusable for the independent analytics date filter, just needs custom presets (30d/60d/90d instead of KPI_PRESETS)
- `Card` from @ops/ui: Container for the Best Source recommendation card and section wrapper
- `Badge` from @ops/ui: For sample size indicators and trend arrows
- `AnimatedNumber` from @ops/ui: For the recommendation card close rate display
- `SectionHeader` helper in ManagerTracker.tsx: Pattern for section headers with icon + title + count
- `buildDateParams()` in ManagerTracker.tsx: Query string builder for date range API calls
- `authFetch` from @ops/auth/client: For API calls with auth headers

### Established Patterns
- Style constants as `const CARD: React.CSSProperties = {...}` objects
- Table rendering with `baseThStyle`/`baseTdStyle` from @ops/ui tokens
- `useEffect` + `authFetch` for data fetching (no SWR/React Query)
- CSV export as client-side blob generation
- Route modules in `apps/ops-api/src/routes/` registered in `routes/index.ts`

### Integration Points
- New route module: `apps/ops-api/src/routes/lead-timing.ts` → register in `routes/index.ts`
- New components: `LeadTimingSection.tsx` (or similar) in manager directory
- ManagerTracker.tsx: Add analytics section below existing content, wrap in collapsible
- Manager page.tsx: Change NAV_ITEMS label from "Agent Tracker" to "Performance Tracker"
- Owner dashboard: Import and render same timing analytics components
- Prisma raw query: `prisma.$queryRaw` for AT TIME ZONE aggregations (first use of raw SQL)

</code_context>

<specifics>
## Specific Ideas

- Heatmap grouping dropdown includes three modes: Day of Week, Week of Month, Month of Year (user explicitly added Month of Year beyond the original two)
- Fortune 500 research informed the feature set: "Best Source Right Now" card pattern from InsideSales/Convoso enterprise dashboards
- User's original instinct: "calls sell better from 12-1pm" and "last week of the month is always great" — the heatmap should make these patterns visually obvious

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 30-lead-source-timing-analytics*
*Context gathered: 2026-03-26*
