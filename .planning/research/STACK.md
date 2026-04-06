# Technology Stack

**Project:** Ops Platform v2.1 -- Chargeback Processing, Payroll Layout & Dashboard Polish
**Researched:** 2026-04-06
**Scope:** Incremental additions only. Core stack (Next.js 15, Express, Prisma, PostgreSQL, Socket.IO, Luxon, Zod, inline CSS) is validated and NOT re-researched.

## Key Decision: No New Dependencies

After analyzing all six v2.1 features, **zero new npm packages are required**. Every capability needed is already available through browser APIs, existing libraries, or simple code patterns. This is the correct approach for a codebase that has consistently avoided external dependencies (inline SVG sparklines over charting libraries, paste-to-parse over file upload libraries, etc.).

## Feature-by-Feature Stack Analysis

### 1. CSV Upload for Batch Chargeback Processing

**What's needed:** Read a CSV file from disk, parse it into structured rows, display a review table, submit as JSON.

**Recommendation: Browser FileReader API + client-side string splitting. No library needed.**

| Approach | Verdict | Rationale |
|----------|---------|-----------|
| PapaParse (npm) | REJECT | Adds 30KB for CSV parsing that a 15-line function handles. The existing `parseChargebackText()` in `CSSubmissions.tsx` already splits tab-delimited text -- CSV is the same pattern with commas instead of tabs. |
| Multer (server-side) | REJECT | File never needs to reach the server as a file. The established pattern is: parse on client, review in UI, POST JSON. Adding multipart upload middleware breaks this pattern for zero benefit. |
| FileReader + manual parse | USE THIS | `<input type="file" accept=".csv">` + `FileReader.readAsText()` + split by `\n` and `,`. Handles quoted fields with a simple regex or state machine if needed. Consistent with the codebase's no-external-library philosophy. |

**Implementation pattern:**
```typescript
// Mirrors existing parseChargebackText() but for CSV format
function parseChargebackCSV(text: string): ParsedRow[] {
  const lines = text.split("\n").filter(l => l.trim());
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const fields = splitCSVLine(line); // handles quoted commas
    // map fields to ParsedRow using header index lookup
  });
}
```

**Why not server-side parsing:** The existing chargeback flow is client-parse -> review table -> POST JSON to `/chargebacks` endpoint. The CSV upload is just a new input method feeding the same review table and the same API endpoint. The `chargebackSchema` Zod validation on the server already validates the JSON payload shape. No server changes needed for the parsing itself.

**Quoted field handling:** CSV files may contain commas inside quoted fields (e.g., `"Smith, John"`). A simple state-machine CSV line splitter (20 lines) handles this. If the carrier's CSV export is simple (no nested quotes), even a regex suffices. PapaParse is overkill for a known, consistent CSV format from a single carrier.

**Confidence:** HIGH -- Browser FileReader API is stable, the pattern matches existing codebase conventions, the chargeback API endpoint already accepts the right JSON shape.

### 2. Sidebar-Based Agent Card Navigation (Payroll Redesign)

**What's needed:** Replace flat agent card list with a sidebar listing all agents and a main content area showing one agent's pay cards at a time with load-more pagination.

**Recommendation: Pure React state + existing inline CSS. No library needed.**

| Approach | Verdict | Rationale |
|----------|---------|-----------|
| React Router nested routes | REJECT | This is a single-page tab component, not a routed view. URL state is unnecessary. |
| Virtualized list (react-window) | REJECT | Agent count is 9-15 per the sales board scaling work. Virtualization is for 1000+ items. |
| State management library | REJECT | `useState` for `selectedAgentId` is the entire state model. |
| Pure React useState | USE THIS | `selectedAgentId` drives which agent's cards render. Sidebar is a scrollable list with click handlers. Exactly the pattern used in `ManagerAudits.tsx` for agent filtering. |

**Implementation pattern:**
```typescript
const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
// Sidebar: agent list with active highlight
// Main: filtered entries for selectedAgentId with take/skip pagination
```

**Layout approach:** CSS flexbox with fixed-width sidebar (220-250px) and flex-grow main area. The codebase uses inline `React.CSSProperties` exclusively -- this is a straightforward two-column flex layout. No CSS Grid needed.

**Pagination for "last 4 pay cards + load more":** The payroll API already returns all periods. Client-side slicing (`periods.slice(0, visibleCount)`) with a "Load More" button incrementing `visibleCount` by 4. No API pagination changes needed since period count is bounded (52 weeks/year max, typically 4-8 visible).

**Confidence:** HIGH -- Standard React pattern, no new APIs or libraries required.

### 3. ACA Product Editable in Payroll Products Tab

**What's needed:** Make the ACA product type editable with flat commission per member and addon qualifier rule configuration.

**Recommendation: No stack changes. Existing Product CRUD endpoints + Zod schemas + inline form components.**

The payroll Products tab already has a read-only view (`PayrollPeriods.tsx` Product type). The change is: add edit form fields for `flatCommission`, `memberCount`-based calculation rules, and addon qualifier toggles. This is pure feature work using existing patterns:
- Zod schema extension on the product update endpoint
- Inline form with `baseInputStyle` from `@ops/ui`
- `authFetch` PUT to existing product routes

**Confidence:** HIGH -- Extends existing patterns.

### 4. Enrollment Fee Defaults to $0

**What's needed:** When enrollment fee is null/undefined, treat as $0 in commission calculation.

**Recommendation: No stack changes. Single-line fallback in commission engine.**

```typescript
const enrollmentFee = sale.enrollmentFee ?? 0;
```

This is a bug fix in `apps/ops-api/src/services/payroll.ts`, not a stack decision.

**Confidence:** HIGH -- Trivial code change.

### 5. Call Audit Rolling Window: Last 30 Audits

**What's needed:** Change default from "last 24 hours" to "last 30 audits" when no date range is specified.

**Recommendation: No stack changes. Modify Prisma query in `call-audits.ts`.**

Current code (line 48-52 of `call-audits.ts`):
```typescript
} else if (!cursor) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  where.callDate = { gte: yesterday, lt: now };
}
```

Change to: Remove the date filter in the default case and rely on `take: 30` (the existing `limit` parameter, defaulting to 30 instead of 25). The cursor pagination already handles "load more."

**Confidence:** HIGH -- Query parameter change only.

### 6. Performance Tracker: Expanded Analytics + Sparkline Fix

**What's needed:** Lead source/timing analytics default to expanded state; fix 7-day trend sparkline data.

**Recommendation: No stack changes. UI state default change + data query fix.**

- "Start expanded": Change `useState(false)` to `useState(true)` for the analytics collapse state.
- "Fix sparklines": Debug the 7-day trend data query in the lead timing analytics endpoints. The inline SVG sparkline renderer is already built and working -- this is a data issue, not a rendering issue.

**Confidence:** HIGH -- UI default + data query debugging.

## Recommended Stack (Unchanged)

No new packages to install. The v2.1 milestone is entirely buildable with the existing stack:

### Existing Stack (No Changes)

| Technology | Version | Purpose | Status for v2.1 |
|------------|---------|---------|-----------------|
| Next.js | 15.3.9 | Dashboard framework | Sufficient |
| React | 18.3.1 | UI components | Sufficient |
| Express | 4.19.2 | API server | Sufficient |
| Prisma | 5.20.0 | Database ORM | Sufficient |
| PostgreSQL | -- | Database | Sufficient |
| Socket.IO | 4.8.3 | Real-time updates | Sufficient |
| Zod | 3.23.8 | Input validation | Sufficient |
| Luxon | 3.4.4 | Date/time handling | Sufficient |
| lucide-react | 0.577.0 | Icons | Sufficient |
| TypeScript | 5.6.2 | Type safety | Sufficient |

### Browser APIs Used (No Install)

| API | Purpose | Browser Support |
|-----|---------|----------------|
| FileReader | Read CSV file as text | All modern browsers |
| `<input type="file">` | File picker UI | All modern browsers |
| crypto.randomUUID() | Batch ID generation (already used) | All modern browsers |

## Alternatives Considered and Rejected

| Category | Considered | Why Rejected |
|----------|------------|-------------|
| CSV parsing | PapaParse | 30KB dependency for a 15-line function. Known single-format CSV from carrier. Codebase precedent: inline SVG over chart libs, paste-parse over upload libs. |
| CSV parsing | csv-parse | Node.js stream-based parser. Server-side parsing not needed -- client parses, reviews, POSTs JSON. |
| File upload | Multer | Multipart middleware unnecessary. File never leaves the browser as a file -- it's read as text, parsed to JSON, and POST'd. |
| File upload | Formidable | Same rationale as Multer. |
| Sidebar UI | Radix UI | Component library adds dependency weight for a simple flex layout with click handlers. |
| Virtualization | react-window | Agent list is 9-15 items. Virtualization is for 1000+ items. |
| State management | Zustand/Jotai | Single `selectedAgentId` state. useState is the right tool. |
| Data table | TanStack Table | Review table is a simple map-to-tr render. No sorting/filtering/pagination complexity warranting a library. |

## What NOT to Add

These are explicitly called out because they might seem tempting but would violate codebase conventions:

1. **No drag-and-drop file upload library** (react-dropzone, etc.) -- A standard `<input type="file">` with a styled label is sufficient. The user clicks "Upload CSV", picks a file, done. Drag-and-drop is a UX luxury that adds dependency weight.

2. **No CSS framework or component library** -- The codebase uses inline `React.CSSProperties` exclusively. The sidebar layout is CSS flexbox. Do not introduce Tailwind, styled-components, or any CSS-in-JS library.

3. **No server-side file storage** -- CSV files are ephemeral. Read on client, parse, review, submit as JSON, discard the file. No need for S3, local file storage, or temp file management.

4. **No Papa Parse "just in case"** -- The CSV format is known (carrier chargeback export). If edge cases arise with quoted fields, a 20-line state machine handles it. The codebase has a strong precedent of avoiding libraries for things that can be done in <50 lines of code.

## Installation

```bash
# No new packages to install for v2.1
# The existing stack handles all six features
```

## Sources

- Codebase analysis: `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` -- existing paste-to-parse pattern (HIGH confidence)
- Codebase analysis: `apps/ops-api/src/routes/chargebacks.ts` -- existing chargeback API accepts JSON array (HIGH confidence)
- Codebase analysis: `apps/ops-api/src/routes/call-audits.ts` -- existing 24h window implementation (HIGH confidence)
- Codebase analysis: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` -- existing agent card rendering (HIGH confidence)
- Codebase analysis: `apps/ops-dashboard/package.json` -- current dependency list (HIGH confidence)
- MDN FileReader API documentation -- stable, all modern browsers (HIGH confidence)
- Project decision history: inline SVG sparklines chosen over charting library (KEY PRECEDENT)
- Project decision history: paste-to-parse chosen over file upload middleware (KEY PRECEDENT)
