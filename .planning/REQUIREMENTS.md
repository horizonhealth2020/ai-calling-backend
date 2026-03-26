# Requirements: Ops Platform — Lead Source Timing Analytics

**Defined:** 2026-03-26
**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations — agents get paid right, managers can track performance, owners see real KPIs.

## v1.8 Requirements

Requirements for Lead Source Timing Analytics milestone. Each maps to roadmap phases.

### Data Layer

- [x] **DATA-01**: Convoso poller DST handling uses Luxon instead of month-based approximation for accurate hour extraction
- [x] **DATA-02**: Convoso poller business hours check uses America/Los_Angeles local time instead of UTC hours
- [x] **DATA-03**: Database indexes added on ConvosoCallLog (leadSourceId, callTimestamp) and Sale (leadSourceId, createdAt) for aggregation performance
- [x] **DATA-04**: API endpoint returns heatmap data: close rate (sales/calls) grouped by lead source x hour-of-day, with day-of-week or week-of-month grouping toggle
- [x] **DATA-05**: API endpoint returns sparkline data: daily close rate per lead source per daypart (morning/afternoon/evening) for last 7 days
- [x] **DATA-06**: API endpoint returns recommendation data: top lead sources ranked by historical close rate for current hour and day-of-week
- [x] **DATA-07**: All aggregation queries use AT TIME ZONE for consistent timezone handling between Convoso (Pacific) and sale timestamps (UTC)
- [x] **DATA-08**: All API responses include sample size (call count) per bucket so frontend can indicate statistical confidence

### Heatmap Visualization

- [x] **HEAT-01**: Manager can view a source x hour heatmap grid with diverging color scale (red-white-green) showing close rate per cell
- [x] **HEAT-02**: Manager can toggle heatmap between day-of-week view and week-of-month view
- [x] **HEAT-03**: Heatmap cells with low sample sizes (< 10 calls) are visually de-emphasized with reduced opacity
- [x] **HEAT-04**: Hovering a heatmap cell shows tooltip with exact close rate, call count, and sale count
- [x] **HEAT-05**: Heatmap has its own independent date range filter (Last Week / 30 Days / 60 Days / 90 Days / Custom)

### Recommendation Card

- [x] **REC-01**: Manager can see a "Best Source Right Now" card showing the top lead source for the current hour based on historical close rate
- [x] **REC-02**: Card displays close rate, call count, and trend arrow (up/down/flat vs same hour last period)
- [x] **REC-03**: Card only shows recommendation when sufficient sample size exists; otherwise shows "Not enough data"

### Sparklines

- [x] **SPARK-01**: Manager can view a table of lead sources with inline SVG sparklines showing 7-day close rate trends per daypart (morning/afternoon/evening)
- [x] **SPARK-02**: Sparklines use no external charting library — rendered as inline SVG polylines with React.CSSProperties

### Dashboard Integration

- [ ] **DASH-01**: "Agent Tracker" tab renamed to "Performance Tracker" across Manager dashboard
- [ ] **DASH-02**: Agent performance card includes a "Today" column alongside existing time range columns
- [ ] **DASH-03**: Timing analytics section (heatmap + recommendation card + sparklines) renders below agent performance on Performance Tracker tab
- [ ] **DASH-04**: Same timing analytics components visible on Owner dashboard
- [x] **DASH-05**: Timing analytics section accessible to MANAGER, OWNER_VIEW, and SUPER_ADMIN roles

### Commission Fix

- [x] **COMM-01**: Fallback bundle addon only qualifies for full commission in states where the primary required addon is not available
- [x] **COMM-02**: In states where the primary required addon IS available, the fallback addon does not qualify as a bundle substitute (half commission applies)

## Future Requirements

### Timing Analytics Enhancements

- **TIMING-F01**: Agent-level drill-down per heatmap cell (click to see which agents perform best at that source/hour)
- **TIMING-F02**: Cost-per-sale overlay toggle on heatmap (close rate mode vs cost mode)
- **TIMING-F03**: Socket.IO real-time updates on recommendation card when new calls/sales come in
- **TIMING-F04**: Dialer ratio recommendation widget based on current connect rates

## Out of Scope

| Feature | Reason |
|---------|--------|
| Predictive ML model for best source | Data volume (hundreds of calls/day) doesn't support ML; historical averages provide 90% of value at 1% of complexity |
| Auto-routing to Convoso dialer | Dangerous without human oversight; advisory recommendations only |
| Per-minute granularity | Splits sparse data into noise; hourly matches how call centers think about scheduling |
| Full conversion funnel (calls → contacts → pitches → closes) | Data model only tracks calls and sales, not intermediate stages |
| External charting library (D3/Recharts/Nivo) | Codebase uses inline CSSProperties; charting library would be a foreign pattern |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 30 | Complete |
| DATA-02 | Phase 30 | Complete |
| DATA-03 | Phase 30 | Complete |
| DATA-04 | Phase 30 | Complete |
| DATA-05 | Phase 30 | Complete |
| DATA-06 | Phase 30 | Complete |
| DATA-07 | Phase 30 | Complete |
| DATA-08 | Phase 30 | Complete |
| HEAT-01 | Phase 30 | Complete |
| HEAT-02 | Phase 30 | Complete |
| HEAT-03 | Phase 30 | Complete |
| HEAT-04 | Phase 30 | Complete |
| HEAT-05 | Phase 30 | Complete |
| REC-01 | Phase 30 | Complete |
| REC-02 | Phase 30 | Complete |
| REC-03 | Phase 30 | Complete |
| SPARK-01 | Phase 30 | Complete |
| SPARK-02 | Phase 30 | Complete |
| DASH-01 | Phase 30 | Pending |
| DASH-02 | Phase 30 | Pending |
| DASH-03 | Phase 30 | Pending |
| DASH-04 | Phase 30 | Pending |
| DASH-05 | Phase 30 | Complete |
| COMM-01 | Phase 30 | Complete |
| COMM-02 | Phase 30 | Complete |

**Coverage:**
- v1.8 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*
