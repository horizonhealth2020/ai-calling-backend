# Phase 14: Tracking Tables - Research

**Researched:** 2026-03-18
**Domain:** React data tables with filtering, sorting, grouping, and CSV export
**Confidence:** HIGH

## Summary

Phase 14 replaces the existing basic `TrackingTab` function (lines 1306-1443 in `apps/cs-dashboard/app/page.tsx`) with full-featured chargeback and pending terms tracking tables. The existing code already fetches chargebacks and displays a simple 8-column table with a weekly ticker -- this gets replaced entirely with a KPI counter bar, filterable/sortable/searchable tables, group-by-agent for pending terms, and role-gated CSV export.

The page file is currently 1443 lines and already contains the parser/submissions tab logic. The TrackingTab function is relatively self-contained (lines 1306-1443). The replacement will be significantly larger due to filter state, sort logic, grouping, and KPI computation. All existing patterns (inline CSSProperties, `authFetch`, `AnimatedNumber`, design tokens from `@ops/ui`) should be reused directly.

**Primary recommendation:** Implement client-side filtering/sorting/grouping since both endpoints already cap at 200 records, and add a new `/api/chargebacks/totals` endpoint for the KPI bar aggregates. Fetch user role via `/session/me` for export button visibility.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Replace existing weekly ticker with 4-counter KPI bar: Total Chargebacks (red), Total Recovered (green, $0 until Phase 15), Net Exposure (red/green), Records count
- All KPI counters use AnimatedNumber with count-up animation
- KPI counters show global totals -- NOT affected by active filters
- Chargeback table columns: Date Posted, Member, Member ID, Product, Type, Total, Assigned To, Submitted (+ delete button). No column toggle.
- Pending terms table columns: Member Name, Member ID, Phone, Product, Hold Date, Next Billing, Assigned To. No column toggle.
- agent_name and agent_id stored in DB but NEVER shown as visible columns (TRKT-03)
- Default view is grouped by agent with collapsible sections; no flat-list toggle
- Single shared search box at top of Tracking tab searches both tables simultaneously
- Collapsible filter panel (button to expand/collapse) -- not always-visible
- Single combined CSV export button -- one file with both chargebacks and pending terms
- Export respects active filters/search
- Export visible only to owner and super_admin roles

### Claude's Discretion
- Pending terms summary bar layout (stacked vs tabbed relative to chargeback KPIs)
- Client-side vs server-side filtering approach
- CSV filename convention and export button placement
- Sort indicator icons (arrows, chevrons, etc.)
- Color coding implementation for pending terms columns
- Collapsible group section animation/styling
- Filter panel layout and field arrangement

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TRKC-01 | KPI counter bar: Total Chargebacks (red), Total Recovered (green), Net Exposure (red/green), Records count with animated count-up | AnimatedNumber component exists in @ops/ui; need new /api/chargebacks/totals endpoint for global aggregates |
| TRKC-02 | Chargeback table with all columns, chargeback_amount always red | 8 columns defined in CONTEXT.md; use `colors.danger` for red; existing baseThStyle/baseTdStyle for table cells |
| TRKC-03 | Filterable by date range, product, member company, member agent company, chargeback amount range | Client-side filtering on 200-record dataset; filter state management pattern documented below |
| TRKC-04 | Searchable by payee name, member agent company, member ID, member agent ID | Client-side text search with case-insensitive partial match |
| TRKC-05 | Sortable by any column | Click-to-sort with ascending/descending toggle; sort state per table |
| TRKC-06 | CSV export for owner and super_admin only | Fetch role via /session/me; client-side CSV generation using existing Blob/createObjectURL pattern |
| TRKT-01 | Summary bar: total pending, count by hold_reason category, urgent count (next_billing within 7 days) | Compute from fetched pending terms data; date comparison for urgency |
| TRKT-02 | Color coding: next_billing green, active/first_billing blue, hold_date red, hold_reason red italic | Use colors.success, colors.info, colors.danger from tokens |
| TRKT-03 | agent_name/agent_id in DB but never as visible columns | Data exists in API response; exclude from table rendering but use for grouping/search |
| TRKT-04 | Filterable by agent, state, product, hold_reason keyword, date ranges | Client-side filtering; agent filter uses behind-the-scenes agentName field |
| TRKT-05 | Searchable by member name, member ID, agent name, agent ID, phone | Shared search box with chargeback search |
| TRKT-06 | Group-by-agent with collapsible sections | Group pending terms by agentName; collapsible sections with ChevronDown/ChevronRight icons |
| TRKT-07 | CSV export for owner and super_admin only | Combined export with chargebacks in same file |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18/19 (Next.js 15) | UI rendering | Already in project |
| @ops/ui | local | AnimatedNumber, Card, EmptyState, design tokens | Project design system |
| @ops/auth/client | local | authFetch, captureTokenFromUrl | Project auth pattern |
| lucide-react | installed | Icons (ChevronDown, ChevronRight, ChevronUp, Download, Filter, Search, X) | Already used in cs-dashboard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/types | local | AppRole, SessionUser types | Role checking for export visibility |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side filtering | Server-side with query params | With 200-record cap, client-side is simpler and faster; no API changes needed for filters |
| Custom table | react-table/tanstack-table | Adding a library for one table is overkill; project pattern is plain HTML tables with inline styles |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Component Structure
The TrackingTab function should be broken into sub-components to manage complexity:

```
TrackingTab (main)
  KpiBar (chargeback KPI counters)
  PendingSummaryBar (pending terms summary)
  SearchAndFilterBar (shared search + filter toggle)
  ChargebackFilterPanel (collapsible chargeback filters)
  PendingFilterPanel (collapsible pending filters)
  ChargebackTable (sortable table with all columns)
  PendingTermsTable (grouped by agent, collapsible sections)
  ExportButton (role-gated CSV download)
```

Since the existing page.tsx is a single-file component (1443 lines), these should remain as functions within the same file following the established pattern. Each "component" is a function defined above the main `TrackingTab`.

### Pattern 1: Client-Side Filtering
**What:** All filtering, searching, and sorting happens in the browser on the full dataset
**When to use:** When dataset is small (capped at 200 records per endpoint)
**Example:**
```typescript
// Filter + search + sort pipeline
const filteredChargebacks = useMemo(() => {
  let result = chargebacks;

  // Apply search
  if (searchTerm) {
    const q = searchTerm.toLowerCase();
    result = result.filter(cb =>
      (cb.payeeName || "").toLowerCase().includes(q) ||
      (cb.memberAgentCompany || "").toLowerCase().includes(q) ||
      (cb.memberId || "").toLowerCase().includes(q) ||
      (cb.memberAgentId || "").toLowerCase().includes(q)
    );
  }

  // Apply filters
  if (filters.product) result = result.filter(cb => cb.product === filters.product);
  // ... other filters

  // Apply sort
  if (sortKey) {
    result = [...result].sort((a, b) => {
      const aVal = a[sortKey] ?? "";
      const bVal = b[sortKey] ?? "";
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  return result;
}, [chargebacks, searchTerm, filters, sortKey, sortDir]);
```

### Pattern 2: Group-By-Agent with Collapsible Sections
**What:** Group pending terms records by agentName, render collapsible sections
**When to use:** TRKT-06 requirement
**Example:**
```typescript
// Group records by agent
const grouped = useMemo(() => {
  const map = new Map<string, PendingTermRecord[]>();
  filteredPending.forEach(pt => {
    const key = pt.agentName || "Unassigned";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(pt);
  });
  return Array.from(map.entries()); // [agentName, records[]]
}, [filteredPending]);

// Collapse state
const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
const toggleGroup = (agent: string) => {
  setCollapsed(prev => {
    const next = new Set(prev);
    next.has(agent) ? next.delete(agent) : next.add(agent);
    return next;
  });
};
```

### Pattern 3: Role-Gated Export Button
**What:** Fetch user role on mount, conditionally render export button
**When to use:** TRKC-06, TRKT-07
**Example:**
```typescript
const [userRoles, setUserRoles] = useState<string[]>([]);

useEffect(() => {
  authFetch(`${API}/api/session/me`)
    .then(res => res.ok ? res.json() : null)
    .then(data => { if (data?.roles) setUserRoles(data.roles); })
    .catch(() => {});
}, []);

const canExport = userRoles.includes("SUPER_ADMIN") || userRoles.includes("OWNER_VIEW");
```

### Pattern 4: CSV Export (Existing Project Pattern)
**What:** Client-side CSV generation using Blob and createObjectURL
**When to use:** Export functionality
**Example:**
```typescript
// Source: apps/payroll-dashboard/app/page.tsx lines 1508-1523
function exportCSV() {
  const esc = (v: string) => v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
  const rows: string[][] = [];

  // Chargeback section
  rows.push(["--- CHARGEBACKS ---"]);
  rows.push(["Date Posted", "Member", "Member ID", "Product", "Type", "Total", "Assigned To", "Submitted"]);
  filteredChargebacks.forEach(cb => { /* push row */ });

  rows.push([]); // blank separator

  // Pending terms section
  rows.push(["--- PENDING TERMS ---"]);
  rows.push(["Member Name", "Member ID", "Phone", "Product", "Hold Date", "Next Billing", "Assigned To"]);
  filteredPending.forEach(pt => { /* push row */ });

  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })),
    download: `cs-tracking-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
}
```

### Anti-Patterns to Avoid
- **Don't add external table libraries:** Project uses plain HTML tables with inline styles everywhere. Adding react-table or similar would break the pattern.
- **Don't use server-side filtering for 200-record datasets:** Adds API complexity for no performance benefit.
- **Don't show agent_name/agent_id as table columns:** They must be used for grouping and search but never rendered as visible columns per TRKT-03.
- **Don't apply filters to KPI counters:** KPI counters show global totals regardless of active filters per locked decision.
- **Don't use CSS modules or Tailwind:** Project uses inline React.CSSProperties exclusively.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Animated numbers | Custom animation | `AnimatedNumber` from `@ops/ui` | Already exists, supports prefix/suffix/decimals |
| Table cell styles | Custom styles | `baseThStyle`, `baseTdStyle` from `@ops/ui` | Consistent with all other tables in the project |
| Auth fetch with headers | Manual fetch | `authFetch` from `@ops/auth/client` | Handles Bearer token, 30s timeout, auto-refresh |
| Dollar formatting | Custom formatter | `formatDollar` already defined in page.tsx line 233 | Exists in the same file |
| Date formatting | Moment/date-fns | Inline `parseInt(m)/${parseInt(d)}/${y}` pattern | Consistent with existing code pattern |

## Common Pitfalls

### Pitfall 1: KPI Bar Reacting to Filters
**What goes wrong:** KPI counters change when filters are applied
**Why it happens:** Using filtered data for KPI calculations
**How to avoid:** KPI bar uses separate global totals (from a dedicated API endpoint or full unfiltered dataset), never the filtered subset
**Warning signs:** KPI numbers change when typing in search box

### Pitfall 2: Decimal Handling for Chargeback Amounts
**What goes wrong:** Amounts display as strings like "123.4500" or lose precision
**Why it happens:** Prisma returns Decimal fields as strings; parseFloat can lose precision
**How to avoid:** Use `parseFloat()` and `toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` -- same pattern already in the existing code
**Warning signs:** Dollar amounts showing with wrong decimal places

### Pitfall 3: holdDate Timezone Shift
**What goes wrong:** Hold dates display as the wrong day (off by one)
**Why it happens:** PostgreSQL DATE column has no time component; JavaScript Date constructor interprets as midnight UTC and may shift to previous day in local timezone
**How to avoid:** Split on "T" and format manually: `const [y,m,d] = dateStr.split("T")[0].split("-")` -- established pattern in the codebase
**Warning signs:** Dates appearing one day off from what was entered

### Pitfall 4: Missing Agent Name in Group Headers
**What goes wrong:** Group headers show "null" or "undefined" instead of agent name
**Why it happens:** agentName can be null in the database
**How to avoid:** Default to "Unassigned" when agentName is null/undefined
**Warning signs:** Groups with null headers

### Pitfall 5: CSV Values Containing Commas or Quotes
**What goes wrong:** CSV file is malformed when data contains commas
**Why it happens:** Product names and descriptions often contain commas
**How to avoid:** Use the escape function: `const esc = (v: string) => v.includes(",") || v.includes('"') ? \`"${v.replace(/"/g, '""')}"\` : v;` -- same pattern from payroll dashboard
**Warning signs:** CSV opens in Excel with columns misaligned

### Pitfall 6: Page File Size
**What goes wrong:** page.tsx becomes unmanageable (already 1443 lines)
**Why it happens:** Adding ~300-500 lines of table/filter/export logic to existing file
**How to avoid:** Keep functions well-organized with clear section comments. The existing pattern is all-in-one file so maintain that, but use clear section dividers like `/* ── Tracking Tab ── */`
**Warning signs:** Losing track of state variables, duplicate style constants

## Code Examples

### KPI Counter Bar
```typescript
// Reuses existing TICKER_CARD, TICKER_VALUE, TICKER_LABEL, TICKER_SUB styles
// and AnimatedNumber from @ops/ui
<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: `${spacing[4]}px` }}>
  <Card style={TICKER_CARD}>
    <span style={TICKER_LABEL}>TOTAL CHARGEBACKS</span>
    <div style={{ ...TICKER_VALUE, color: colors.danger }}>
      <AnimatedNumber value={totalChargebacks} decimals={2} prefix="$" duration={600} />
    </div>
    <span style={TICKER_SUB}>{recordCount} records</span>
  </Card>
  {/* Total Recovered (green, $0 until Phase 15) */}
  {/* Net Exposure */}
  {/* Records count */}
</div>
```

### Sortable Column Header
```typescript
// Sort indicator using ChevronUp/ChevronDown from lucide-react
function SortHeader({ label, sortKey, currentSort, currentDir, onSort }: {
  label: string; sortKey: string;
  currentSort: string | null; currentDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const active = currentSort === sortKey;
  return (
    <th
      style={{ ...baseThStyle, cursor: "pointer", userSelect: "none" }}
      onClick={() => onSort(sortKey)}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {active && (currentDir === "asc"
          ? <ChevronUp size={12} />
          : <ChevronDown size={12} />
        )}
      </span>
    </th>
  );
}
```

### Collapsible Filter Panel
```typescript
const [filtersOpen, setFiltersOpen] = useState(false);

<Button
  variant="ghost"
  onClick={() => setFiltersOpen(!filtersOpen)}
  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
>
  <Filter size={14} />
  Filters
  {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
</Button>

{filtersOpen && (
  <div style={{
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: `${spacing[4]}px`,
    padding: `${spacing[4]}px`,
    background: colors.bgSurfaceInset,
    borderRadius: radius.lg,
    marginTop: spacing[3],
  }}>
    {/* Filter fields */}
  </div>
)}
```

### Pending Terms Color Coding (TRKT-02)
```typescript
// next_billing: green
<td style={{ ...baseTdStyle, color: colors.success }}>
  {formatDate(pt.nextBilling)}
</td>

// active_date / first_billing: blue
<td style={{ ...baseTdStyle, color: colors.info }}>
  {formatDate(pt.activeDate)}
</td>

// hold_date: red
<td style={{ ...baseTdStyle, color: colors.danger }}>
  {formatDate(pt.holdDate)}
</td>

// hold_reason: red italic
<td style={{ ...baseTdStyle, color: colors.danger, fontStyle: "italic" }}>
  {pt.holdReason || "--"}
</td>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Weekly ticker only | Full 4-counter KPI bar | Phase 14 | Broader metrics visibility |
| Basic 8-column table | Filterable/sortable/searchable tables | Phase 14 | Full tracking capability |
| No pending terms display | Grouped-by-agent pending terms | Phase 14 | Complete pending terms visibility |
| No export | Role-gated combined CSV export | Phase 14 | Data portability for authorized users |

## API Endpoint Strategy

### Existing Endpoints (reuse as-is)
- `GET /api/chargebacks` -- returns all records (capped at 200), used for table data
- `GET /api/pending-terms` -- returns all records (capped at 200), used for table data
- `DELETE /api/chargebacks/:id` -- delete chargeback record
- `DELETE /api/pending-terms/:id` -- delete pending term record

### New Endpoint Needed
- `GET /api/chargebacks/totals` -- returns global aggregates for KPI bar:
  - `totalChargebacks`: sum of absolute chargeback_amount across ALL records
  - `totalRecovered`: 0 (placeholder until Phase 15 adds resolution)
  - `recordCount`: total count of all chargeback records
  - This endpoint must NOT be affected by any filters -- it always returns global totals
  - The existing `/api/chargebacks/weekly-total` is scoped to the current week and not suitable for the global KPI bar

### Existing Endpoint for Role Detection
- `GET /api/session/me` -- returns `{ id, email, name, roles }` for the authenticated user

## Open Questions

1. **Pending Terms Summary Bar Placement**
   - What we know: Needs total pending, count by hold_reason category, urgent count
   - What's unclear: Whether to place it as a second row below chargeback KPIs or as a sub-section within the pending terms card
   - Recommendation: Place as a separate summary row between KPI bar and the tables, using a slightly different visual treatment (e.g., smaller cards or a horizontal stat strip)

2. **200-Record Cap Implications**
   - What we know: Both GET endpoints cap at 200 records via `take: 200`
   - What's unclear: Whether KPI totals should count ALL records or just the 200 shown
   - Recommendation: KPI totals endpoint should aggregate ALL records (no `take` limit); table shows 200 most recent. This is why a separate `/api/chargebacks/totals` endpoint is needed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root Morgan service tests only) |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test -- helpers.test.js` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRKC-01 | KPI bar shows 4 counters with correct values | manual-only | N/A -- React component in Next.js app, no test infra for frontend | N/A |
| TRKC-02 | Chargeback table renders all columns, amount in red | manual-only | N/A | N/A |
| TRKC-03 | Filter by date range, product, company, amount range | manual-only | N/A | N/A |
| TRKC-04 | Search by payee name, company, member ID, agent ID | manual-only | N/A | N/A |
| TRKC-05 | All columns sortable | manual-only | N/A | N/A |
| TRKC-06 | CSV export visible only to owner/super_admin | manual-only | N/A | N/A |
| TRKT-01 | Summary bar with totals and urgent count | manual-only | N/A | N/A |
| TRKT-02 | Color coding on pending terms columns | manual-only | N/A | N/A |
| TRKT-03 | agent_name/agent_id not shown as columns | manual-only | N/A | N/A |
| TRKT-04 | Filter by agent, state, product, hold_reason, dates | manual-only | N/A | N/A |
| TRKT-05 | Search by member name, ID, agent name, ID, phone | manual-only | N/A | N/A |
| TRKT-06 | Group-by-agent with collapsible sections | manual-only | N/A | N/A |
| TRKT-07 | CSV export visible only to owner/super_admin | manual-only | N/A | N/A |

**Justification for manual-only:** The project has no frontend test infrastructure. Jest is configured only for the root Morgan voice service. All cs-dashboard requirements are UI-level and require visual verification. The new `/api/chargebacks/totals` API endpoint could theoretically be tested but the existing test setup only covers Morgan helpers.

### Sampling Rate
- **Per task commit:** Visual verification in browser at localhost:3014
- **Per wave merge:** Full walkthrough of all 13 requirements
- **Phase gate:** All success criteria verified manually

### Wave 0 Gaps
None -- no test infrastructure applies to this phase. All validation is manual browser testing.

## Sources

### Primary (HIGH confidence)
- `apps/cs-dashboard/app/page.tsx` lines 1306-1443 -- Current TrackingTab implementation being replaced
- `prisma/schema.prisma` -- ChargebackSubmission (lines 476-502) and PendingTerm (lines 514-548) models with all field definitions
- `apps/ops-api/src/routes/index.ts` -- Existing GET/DELETE endpoints for chargebacks and pending terms
- `packages/ui/src/tokens.ts` -- Design tokens (colors, spacing, radius, typography, motion)
- `packages/ui/src/components/AnimatedNumber.tsx` -- AnimatedNumber component API (value, duration, prefix, suffix, decimals)
- `packages/types/src/index.ts` -- AppRole and SessionUser type definitions
- `apps/payroll-dashboard/app/page.tsx` lines 1508-1587 -- Existing CSV export pattern (Blob + createObjectURL)

### Secondary (MEDIUM confidence)
- `apps/ops-api/src/routes/index.ts` line 97 -- `/session/me` endpoint returns user roles for role-gating

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in project, no new dependencies
- Architecture: HIGH - follows established patterns from existing codebase
- Pitfalls: HIGH - identified from real issues in existing code (timezone, decimal, CSV escaping)

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- no external dependencies changing)
