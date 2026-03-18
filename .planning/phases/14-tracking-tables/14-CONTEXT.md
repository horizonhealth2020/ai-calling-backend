# Phase 14: Tracking Tables - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the existing basic TrackingTab with full-featured chargeback and pending terms tracking tables. Includes KPI counter bars, column sorting, shared search, collapsible filter panels, group-by-agent for pending terms, and a single combined CSV export restricted to owner/super_admin roles.

</domain>

<decisions>
## Implementation Decisions

### KPI bar layout & metrics
- Replace the existing weekly chargeback ticker with a full 4-counter KPI bar: Total Chargebacks (red), Total Recovered (green, $0 until Phase 15 adds resolution), Net Exposure (red/green), Records count
- All counters use AnimatedNumber with count-up animation
- KPI counters always show global totals — NOT affected by active filters
- Pending terms summary bar: total pending, count by hold_reason category, urgent count (next_billing within 7 days in red)
- Pending terms summary bar layout at Claude's discretion (stacked sections vs sub-tabs)

### Table columns
- **Chargeback table:** Keep current 8 columns — Date Posted, Member, Member ID, Product, Type, Total, Assigned To, Submitted (+ delete button). No column toggle needed.
- **Pending terms table:** Member Name, Member ID, Phone, Product, Hold Date, Next Billing, Assigned To. No column toggle.
- agent_name and agent_id stored in DB but NEVER shown as visible columns (TRKT-03)
- All columns sortable on both tables (click header for ascending/descending toggle)

### Pending terms grouping
- Default view is grouped by agent with collapsible sections
- Agent name as group header (agent_name from DB, not shown as a column)
- No flat-list toggle — always grouped

### Filter & search UX
- Single shared search box at top of Tracking tab — searches across both chargeback and pending terms tables simultaneously
- Search matches across: payee name, member company, member ID, member agent company, member agent ID (chargebacks) and member name, member ID, agent name, agent ID, phone (pending terms)
- Collapsible filter panel (button to expand/collapse) — not always-visible inline row
- Chargeback filters: date range, product, member company, member agent company, chargeback amount range
- Pending terms filters: agent (behind-the-scenes), state, product, hold_reason keyword, date ranges
- Client-side vs server-side filtering at Claude's discretion

### CSV export & role gating
- Single combined CSV export button — one file containing both chargebacks and pending terms data
- Export respects active filters/search — what you see is what you export
- Export button visible only to owner and super_admin roles
- Button placement and filename convention at Claude's discretion

### Claude's Discretion
- Pending terms summary bar layout (stacked vs tabbed relative to chargeback KPIs)
- Client-side vs server-side filtering approach
- CSV filename convention and export button placement
- Sort indicator icons (arrows, chevrons, etc.)
- Color coding for pending terms columns (next_billing green, active/first_billing blue, hold_date red, hold_reason red italic per TRKT-02)
- Collapsible group section animation/styling
- Filter panel layout and field arrangement

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing tracking implementation (REPLACE)
- `apps/cs-dashboard/app/page.tsx` lines 1306-1443 — Current TrackingTab with basic chargeback table and pending terms placeholder. This gets replaced entirely.

### API endpoints
- `apps/ops-api/src/routes/index.ts` — Existing GET /api/chargebacks, GET /api/chargebacks/weekly-total, GET /api/pending-terms endpoints

### Database schema
- `prisma/schema.prisma` — ChargebackSubmission and PendingTerm models with all fields

### Requirements
- `.planning/REQUIREMENTS.md` — TRKC-01 through TRKC-06, TRKT-01 through TRKT-07

### Shared components & tokens
- `packages/ui/src/index.tsx` — PageShell, Card, EmptyState, Button, Input
- `packages/ui/src/tokens.ts` — Design tokens (colors, spacing, radius)

### Prior parser context
- `.planning/phases/12-chargeback-parser/12-CONTEXT.md` — Chargeback field mapping and consolidation rules
- `.planning/phases/13-pending-terms-parser/13-CONTEXT.md` — Pending terms field mapping and 3-line parsing

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AnimatedNumber` component — already used for weekly ticker, reuse for all KPI counters
- `Card` component — container for KPI bars and tables
- `EmptyState` component — for when no records exist
- `authFetch` — for all API calls
- `baseThStyle`, `baseTdStyle` — existing table cell styles in TrackingTab
- `SECTION_HEADING`, `TICKER_CARD`, `TICKER_LABEL`, `TICKER_VALUE`, `TICKER_SUB` — existing style constants
- `formatDollar` — dollar formatting helper (if exists)
- Lucide React icons (X, BarChart3) — already imported

### Established Patterns
- Inline React.CSSProperties for all styling
- Data fetched via `authFetch` with `Promise.all` in `useEffect`
- Delete handler pattern with optimistic UI update + ticker refresh
- Date formatting: `parseInt(m)/${parseInt(d)}/${y}` pattern
- Dark glassmorphism theme with color tokens

### Integration Points
- `apps/cs-dashboard/app/page.tsx` — Replace TrackingTab function (lines 1306-1443)
- `apps/ops-api/src/routes/index.ts` — May need updated GET endpoints to support filter params (if server-side filtering chosen)
- No new database tables or migrations needed — all data already exists

</code_context>

<specifics>
## Specific Ideas

- Chargeback amounts should always render in red (TRKC-02)
- Pending terms color coding per TRKT-02: next_billing green, active/first_billing blue, hold_date red, hold_reason red italic
- Weekly ticker is being removed — the full KPI bar replaces it with broader metrics
- Combined CSV means one file with both data types, not a zip of separate files

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-tracking-tables*
*Context gathered: 2026-03-18*
