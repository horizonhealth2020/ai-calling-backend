# Phase 23: AI Scoring Dashboard - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Scoring" tab to the owner dashboard showing aggregate AI audit score KPIs, per-agent score breakdown with sortable columns, and weekly trend data. All filtered by the shared DateRangeFilter context. Read-only dashboard — no write operations.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
- **D-01:** Score visualization approach (weekly trends) — Claude decides the best format that fits existing table/card patterns. No charting library exists; keep it dependency-free.
- **D-02:** Score distribution breakdown format — Claude decides between numeric buckets, letter grades, summary stats, or hybrid. Pick what's most useful for an owner monitoring call quality.
- **D-03:** Agent coaching signals — Claude decides whether to add visual flags (threshold-based, trend-based, or none). Sortable columns are the minimum; any additional signals are at Claude's discretion.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Owner Dashboard
- `apps/ops-dashboard/app/(dashboard)/owner/page.tsx` — Owner tab structure, section routing, tab constants
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx` — Existing owner tab pattern with StatCards, tables, date range, Socket.IO
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerKPIs.tsx` — Agent KPI table pattern with sortable columns

### API Routes
- `apps/ops-api/src/routes/ai-budget.ts` — Existing AI scoring and budget endpoints
- `apps/ops-api/src/routes/call-audits.ts` — Call audit endpoints, AI audit settings

### Services
- `apps/ops-api/src/services/auditQueue.ts` — getAiUsageStats, enqueueAutoScore, AI scoring logic
- `apps/ops-api/src/services/callAudit.ts` — Call audit service

### Data Model
- `prisma/schema.prisma` — CallAudit model with aiScore field (0-100 integer)

### Shared UI
- `packages/ui/src/index.ts` — StatCard, DateRangeFilter, KPI_PRESETS, design tokens (colors, radius, typography, baseCardStyle, baseThStyle, baseTdStyle)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StatCard` component — for aggregate KPIs (avg score, total audits, distribution)
- `DateRangeFilter` + `useDateRange` context — already wired in owner dashboard, reuse for scoring tab
- `OwnerKPIs.tsx` sortable table pattern — agent KPI table with sort state, toggle function, chevron icons
- `authFetch()` — standard API call pattern
- `baseCardStyle`, `baseThStyle`, `baseTdStyle` — consistent table/card styling

### Established Patterns
- Owner tabs use `ActiveSection` union type and conditional rendering in page.tsx
- Each tab is a separate component file (OwnerOverview, OwnerKPIs, OwnerConfig, OwnerUsers)
- Inline React.CSSProperties with dark glassmorphism theme
- `formatDollar` from @ops/utils for currency display

### Integration Points
- `page.tsx` — Add "scoring" to ActiveSection type, new tab button, conditional render of OwnerScoring component
- New API endpoint needed for scoring aggregation (per-agent scores, weekly trends) — add to ai-budget.ts or new scoring route
- CallAudit.aiScore field is the data source for all scoring KPIs

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Owner wants to monitor call quality and identify agents needing coaching. All presentation decisions deferred to Claude.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-ai-scoring-dashboard*
*Context gathered: 2026-03-24*
