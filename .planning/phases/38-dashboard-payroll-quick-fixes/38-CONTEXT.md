# Phase 38: Dashboard & Payroll Quick Fixes - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 5 specific bugs/behaviors so the audit, tracker, analytics, and payroll sections work correctly without user workarounds. No new features — targeted fixes to enrollment fee parsing, audit query window, analytics default state, and sparkline data rendering.

</domain>

<decisions>
## Implementation Decisions

### Audit Rolling Window (DASH-01, DASH-02)
- **D-01:** Replace the 24-hour time-based filter in `call-audits.ts:49-51` with a count-based "last 30 audits" query. Default view fetches last 30 audits ordered by call date descending, regardless of when they occurred.
- **D-02:** "Load more" pagination fetches the next 30 audits using cursor-based pagination (existing cursor mechanism).
- **D-03:** Per-agent filter (DASH-02) also returns the last 30 audits for that specific agent — consistent behavior, always 30 results regardless of context. Agent filter already exists at `call-audits.ts:53`.
- **D-04:** No date range override needed — remove the time-based default entirely in favor of pure count-based windowing.

### Enrollment Fee $0 Default (PAY-04)
- **D-05:** The bug is in `ManagerEntry.tsx:196` — `if (totalEnrollment > 0)` skips $0 enrollment fees. When a receipt has `Enrollment $0.00`, the parser extracts 0 but the condition prevents it from being set on the output. The form field stays empty (dash), so the commission engine never applies halving logic.
- **D-06:** Fix: change the condition so that when an `Enrollment` line is found in the receipt (even at $0), the fee value is set. Only skip when NO enrollment line exists at all — don't default all receipts to $0.
- **D-07:** Sample receipt confirmed: `Enrollment  $0.00` line is present, parser regex at line 182 (`efMatch`) correctly extracts it, but line 196 discards the value.

### Sparkline Data (DASH-04)
- **D-08:** The bug is a date format mismatch in `lead-timing.ts:201-213`. The raw SQL query returns `day` as a PostgreSQL `::date` type, which Prisma deserializes as a JavaScript Date object. `String(r.day)` produces a long date string (e.g., `"Thu Apr 02 2026 00:00:00 GMT+0000"`), but the lookup `days` array uses ISO format (`"2026-04-02"` from `toISOString().slice(0,10)`). The map keys never match, so all sparklines get 0 data.
- **D-09:** Fix: normalize `r.day` to ISO date string format when building the callMap/saleMap keys, matching the `days` array format.

### Analytics Default Expand (DASH-03)
- **D-10:** Change `LeadTimingSection.tsx:75` from `useState(false)` to `useState(true)` so lead source and timing analytics are visible immediately on page load.
- **D-11:** Use lazy loading (IntersectionObserver or similar) so the API call is deferred until the section scrolls into view, rather than fetching immediately on mount. Section starts visually expanded but data loads on scroll.

### Claude's Discretion
- Exact IntersectionObserver implementation for lazy-load analytics (or equivalent approach)
- Whether to normalize the date in the SQL query itself vs in JS post-processing for sparklines
- Any minor pagination adjustments needed when switching audit query from time-based to count-based

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit Query
- `apps/ops-api/src/routes/call-audits.ts:33-84` -- GET `/call-audits` endpoint with current 24-hour default filter (lines 49-51) and agent filter (line 53)
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx` -- Audit list UI with cursor pagination

### Enrollment Fee Parser
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:130-213` -- `parseReceipt()` function
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:182` -- Enrollment fee regex extraction (`efMatch`)
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:196` -- The bug: `if (totalEnrollment > 0)` skips $0 fees
- `apps/ops-api/src/services/payroll.ts:54-83` -- `applyEnrollmentFee()` halving logic (works correctly when fee is provided)

### Sparkline Data
- `apps/ops-api/src/routes/lead-timing.ts:142-228` -- GET `/lead-timing/sparklines` endpoint
- `apps/ops-api/src/routes/lead-timing.ts:201-205` -- callMap/saleMap key construction with `String(r.day)` (the bug)
- `apps/ops-api/src/routes/lead-timing.ts:208-213` -- `days` array built with `toISOString().slice(0,10)` (the expected format)
- `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSparklines.tsx` -- Sparkline SVG rendering component

### Analytics Expand
- `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSection.tsx:75` -- `useState(false)` that needs to become `useState(true)`
- `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSection.tsx:84-99` -- useEffect that triggers data fetch when expanded

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Cursor-based pagination already exists in `call-audits.ts` -- reuse for count-based windowing
- Agent filter parameter already wired in audit endpoint -- no new params needed
- `Sparkline` SVG component renders correctly when data is present -- only the data pipeline is broken
- `applyEnrollmentFee()` in payroll service works correctly when $0 is explicitly provided

### Established Patterns
- Raw SQL queries with `prisma.$queryRaw` for complex aggregations (lead-timing)
- `asyncHandler()` wrapper on all route handlers
- `useState` for section expand/collapse in dashboard components
- Receipt parser uses regex-based extraction with product block iteration

### Integration Points
- Audit endpoint consumed by `ManagerAudits.tsx` -- changing query logic requires no frontend API changes (same response shape)
- Sparkline fix is API-only -- component renders correctly when data is non-zero
- Enrollment fee fix is frontend-only -- commission engine already handles $0 correctly
- Analytics expand is frontend-only -- data fetch already triggers on expand state

</code_context>

<specifics>
## Specific Ideas

- User provided sample receipt showing `Enrollment  $0.00` line that fails to parse as $0
- Screenshot confirmed all sparklines show dashed "no data" lines despite lead sources loading correctly
- User explicitly wants lazy-load for analytics section (IntersectionObserver pattern) rather than immediate fetch on mount

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 38-dashboard-payroll-quick-fixes*
*Context gathered: 2026-04-06*
