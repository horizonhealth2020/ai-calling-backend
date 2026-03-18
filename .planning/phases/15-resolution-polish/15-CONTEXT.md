# Phase 15: Resolution & Polish - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Customer service staff can mark chargeback and pending term records as resolved with typed resolution outcomes, filter tracking tables by status, and all formatting/role gating is consistent across the CS dashboard. Also includes removing agent grouping from pending terms table, extracting shared formatting helpers to @ops/utils, and applying consistent date/dollar formatting across all dashboards.

</domain>

<decisions>
## Implementation Decisions

### Resolve action UX
- Inline "Resolve" button in each table row
- Clicking expands the row downward into a panel showing record details + resolution fields + Save/Cancel
- Resolved records stay visible in default view but appear dimmed/faded with a "Resolved" badge showing resolved_by and resolved_at
- Resolution is reopenable — resolved records get an "Unresolve" button to clear resolution and return to open status

### Resolution types
- **Chargebacks:** Two resolution types — "Recovered" (money back, updates Total Recovered KPI) and "Closed" (written off, no KPI impact). User selects type when resolving. Both require a resolution note.
- **Pending terms:** Two resolution types — "Saved" (member retained) and "Cancelled" (member lost). Both require a resolution note.
- Resolution type stored alongside resolved_by, resolved_at, and resolution_note in database

### KPI behavior with resolution
- KPI counters are NOT affected by status filters (open/resolved/all toggle)
- Total Recovered KPI updates ONLY when a chargeback is marked as "Recovered" resolution type
- Net Exposure = Total Chargebacks - Total Recovered
- Pending terms summary bar unaffected by resolution types (no dollar KPIs)

### Status filtering
- Toggle pill buttons (Open / Resolved / All) positioned above each tracking table
- Default view: Open records
- Pill toggle is separate from the collapsible filter panel — always visible
- Status filter does NOT affect KPI counters or summary bars

### Pending terms table change
- Remove agent grouping (collapsible sections) — flat table view instead
- Agent name still stored in DB but not shown as a column (unchanged from Phase 14)

### Role gating & tab visibility
- customer_service role: Submissions tab completely invisible in PageShell sidebar — only "Tracking" shown
- customer_service: API routes for submission endpoints blocked server-side (not just hidden in UI)
- customer_service: No delete action — delete button hidden and API blocked for this role
- customer_service: No CSV export — button hidden for this role
- owner and super_admin: Both Submissions and Tracking tabs visible
- owner and super_admin: Full access to delete and CSV export (unchanged from Phase 14)

### Date & dollar formatting
- Extract `formatDollar` (commas, 2 decimal places) to `@ops/utils` as shared helper
- Extract `formatDate` (M/D/YYYY) to `@ops/utils` as shared helper
- Update ALL dashboards (cs-dashboard, manager-dashboard, payroll-dashboard, owner-dashboard, sales-board) to import from @ops/utils
- Audit entire CS dashboard for consistent usage of both helpers

### Live updates (DASH-04)
- Counters, filters, and summary bars update without full page reload when data or filter state changes
- Client-side state management — filter changes trigger re-render with useMemo (consistent with Phase 14 pattern)

### Claude's Discretion
- Expandable row panel animation/transition
- Exact pill toggle styling (active/inactive states)
- Database migration approach for resolution fields (resolved_at, resolved_by, resolution_note, resolution_type on both tables)
- Unresolve API endpoint design
- How to structure the @ops/utils exports

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing tracking implementation (MODIFY)
- `apps/cs-dashboard/app/page.tsx` — Current TrackingTab (line 1334+) with chargeback and pending terms tables. Add resolve action, status pills, role gating.

### API endpoints (EXTEND)
- `apps/ops-api/src/routes/index.ts` — Existing GET/DELETE endpoints for chargebacks and pending terms. Add PATCH resolve/unresolve endpoints, add role gating to submission routes.

### Database schema (EXTEND)
- `prisma/schema.prisma` — ChargebackSubmission (line 476) and PendingTerm (line 514) models. Need resolution fields added.

### Auth & role system
- `apps/ops-api/src/middleware/auth.ts` — requireAuth, requireRole for route protection
- `packages/types/src/index.ts` — AppRole enum with CUSTOMER_SERVICE

### Shared packages
- `packages/ui/src/index.tsx` — PageShell, Card, EmptyState, Button, Input
- `packages/utils/src/index.ts` — Target for formatDollar and formatDate extraction

### All dashboards (formatting update)
- `apps/cs-dashboard/app/page.tsx` — Primary target
- `apps/manager-dashboard/app/page.tsx` — Adopt shared formatDollar/formatDate
- `apps/payroll-dashboard/app/page.tsx` — Adopt shared formatDollar/formatDate
- `apps/owner-dashboard/app/page.tsx` — Adopt shared formatDollar/formatDate
- `apps/sales-board/app/page.tsx` — Adopt shared formatDollar/formatDate

### Requirements
- `.planning/REQUIREMENTS.md` — RESV-01 through RESV-04, ROLE-02 through ROLE-04, DASH-02, DASH-04, DASH-05

### Prior context
- `.planning/phases/14-tracking-tables/14-CONTEXT.md` — KPI counter behavior, filter patterns, CSV export role gating
- `.planning/phases/11-foundation-dashboard-shell/11-CONTEXT.md` — Tab navigation pattern, role naming

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `formatDollar` (cs-dashboard line 235) — extract to @ops/utils
- `AnimatedNumber` component — used for KPI counters, no changes needed
- `SortHeader` component — reusable column sorting, no changes needed
- `authFetch` from @ops/auth/client — for resolve/unresolve API calls
- `Card`, `Button`, `Input` from @ops/ui — for expandable row panel
- Collapsible filter panel pattern — already exists in TrackingTab

### Established Patterns
- Inline React.CSSProperties for all styling
- Client-side filtering with useMemo
- Data fetched via authFetch with Promise.all in useEffect
- Delete handler with optimistic UI update pattern (reuse for resolve)
- Tab state via useState with type union

### Integration Points
- `apps/cs-dashboard/app/page.tsx` — Add resolve UX, status pills, role-gated tab visibility
- `apps/ops-api/src/routes/index.ts` — Add PATCH resolve/unresolve endpoints, role-gate submission routes
- `prisma/schema.prisma` — Add resolution fields to both models, new migration
- `packages/utils/src/index.ts` — Add formatDollar and formatDate exports
- All 5 dashboard apps — Update imports to use @ops/utils formatting

</code_context>

<specifics>
## Specific Ideas

- Chargeback resolution type "Recovered" is the ONLY thing that feeds into the Total Recovered KPI — not just any resolution
- Pending terms resolution types map to business outcomes: "Saved" = member retained, "Cancelled" = member lost
- Agent grouping removed from pending terms table — flat list is preferred
- Unresolve should be possible to fix mistakes, not just one-way workflow

</specifics>

<deferred>
## Deferred Ideas

- **Paid toggle fix** — Allow paid/unpaid toggle to go both directions freely (payroll dashboard)
- **Inline sale editing in payroll** — Edit sales entries directly in payroll view (payroll dashboard)
- **Remove bonus/fronted/hold from paycard header** — Clean up sale entry line at top of each paycard per agent (payroll dashboard)
- **+10 enrollment bonus indicator** — Show small "+10" next to enrollment fee amount when $125 bonus earned (payroll dashboard)

</deferred>

---

*Phase: 15-resolution-polish*
*Context gathered: 2026-03-18*
