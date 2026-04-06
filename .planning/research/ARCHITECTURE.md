# Architecture Patterns

**Domain:** Ops platform iteration -- CSV batch processing, payroll navigation redesign, audit window change, ACA product editing, dashboard polish
**Researched:** 2026-04-06

## Recommended Architecture

All six v2.1 features integrate into the existing three-layer architecture (ops-dashboard -> ops-api -> Prisma/PostgreSQL) with no new services, no schema migrations, and no new shared packages. The changes are scoped to route modifications, service logic tweaks, and dashboard component refactors.

### Component Boundaries

| Component | Responsibility | Change Type | Communicates With |
|-----------|---------------|-------------|-------------------|
| `CSSubmissions.tsx` | Chargeback paste-to-parse UI | **NEW: CSV upload path alongside existing paste** | ops-api `/chargebacks` |
| `PayrollPeriods.tsx` | Agent pay cards, period management | **MAJOR REFACTOR: split into sidebar + per-agent view** | ops-api `/payroll/periods` |
| `PayrollProducts.tsx` | Product CRUD in payroll tab | **MODIFY: add ACA_PL fields (flatCommission, addon qualifier)** | ops-api `/products` |
| `call-audits.ts` (API route) | Audit list endpoint | **MODIFY: change default window from 24h to last 30 records** | Prisma `callAudit` |
| `ManagerAudits.tsx` | Audit display in manager tab | **MODIFY: update empty state text to reflect "last 30"** | ops-api `/call-audits` |
| `LeadTimingSection.tsx` | Lead source analytics collapsible | **MODIFY: change `useState(false)` to `useState(true)`** | ops-api `/lead-timing/*` |
| `LeadTimingSparklines.tsx` | 7-day trend sparklines | **MODIFY: fix data pipeline** | Parent prop passthrough |
| `payroll.ts` (service) | Commission engine | **MODIFY: treat null enrollmentFee as $0** | Prisma `Sale`, `Product` |
| `ManagerEntry.tsx` | Sales entry form | **MODIFY: default enrollmentFee field to "0" when empty** | ops-api `/sales` |

### Data Flow

**CSV Chargeback Upload (new flow):**
```
User selects CSV file
  -> Client-side CSV parser (no library -- split on commas/newlines)
  -> Column mapping UI (map CSV headers to chargeback fields)
  -> Pre-submit review table (editable matched rows)
  -> POST /chargebacks (existing endpoint, same schema)
  -> Auto-match + alert creation (existing server logic)
  -> Socket.IO emitCSChanged (existing real-time)
```

The key insight: the existing `POST /chargebacks` endpoint already accepts a `records[]` array with a `batchId`. CSV upload is purely a new client-side input method that feeds the same API contract. No API changes needed.

**Payroll Sidebar Navigation (refactor):**
```
Current: Period accordion -> all agents inline -> expand agent -> entries
New:     Agent sidebar (left) -> select agent -> last 4 pay cards (right) -> "Load More" button

Data source: Same GET /payroll/periods endpoint
Transform:  Client-side pivot from period-first to agent-first grouping
```

The payroll periods endpoint returns all periods with nested entries. The client currently groups by period then by agent. The redesign inverts this: group by agent across periods, show the 4 most recent periods per agent, with a "Load More" that extends the window.

**Enrollment Fee $0 Default (fix):**
```
Current: enrollmentFee === null -> skip fee logic entirely (no halving, no bonus check)
Fix:     enrollmentFee === null -> treat as $0 -> triggers half-commission (fee < $99 threshold)
Impact:  applyEnrollmentFee() in payroll.ts line 56-57, commission preview in ManagerEntry.tsx
```

This is a one-line change in `applyEnrollmentFee()`: remove the early return on `null` and instead set `fee = 0`. The downstream half-commission badge and approve button already handle the halving case correctly -- they just never see it when enrollmentFee is null.

## Integration Points: New vs Modified

### NEW Components (create from scratch)

1. **CSV Upload UI** in `CSSubmissions.tsx` (or extracted as `CSUploadCSV.tsx`)
   - File input with drag-and-drop zone
   - CSV parsing logic (client-side, no dependencies)
   - Column mapping step (auto-detect common headers, manual override)
   - Pre-submit review table with inline editing
   - Submits to existing `POST /chargebacks` endpoint

### MODIFIED Components (edit existing)

2. **`apps/ops-api/src/services/payroll.ts`** -- `applyEnrollmentFee()` function
   - Lines 56-57: Change `if (enrollmentFee === null) return { finalCommission: commission, enrollmentBonus: 0, feeHalvingReason: null }` to treat null as $0
   - This is the enrollment fee default fix

3. **`apps/ops-api/src/routes/call-audits.ts`** -- GET `/call-audits` handler
   - Lines 44-52: Change default behavior from "last 24 hours" to "last 30 records"
   - Remove the date-based default window; instead, when no date range and no cursor, just fetch `take: 30` without date filter
   - The cursor pagination already handles "load more" correctly

4. **`apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx`** -- ACA product editing
   - Add `flatCommission` field and `ACA_PL` type option to the product create/edit form
   - The API `PATCH /products/:id` already accepts most fields but the Zod validator needs `ACA_PL` in the type enum and `flatCommission` in the schema
   - Add addon qualifier rules display (which addons qualify for bundle rates)

5. **`apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx`** -- Agent card redesign
   - This is the largest change: 91K file needs refactoring
   - Extract agent sidebar as a sub-component
   - Transform period-first rendering to agent-first with period cards
   - Add "Load More" pagination for historical periods

6. **`apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSection.tsx`**
   - Line 75: Change `useState(false)` to `useState(true)` for default expanded
   - One-line change

7. **`apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSparklines.tsx`**
   - Debug and fix sparkline data -- verify the `days` array length matches daypart arrays
   - Likely issue: API returns 7-day data but daypart arrays may have length mismatches or all-zero values

8. **`apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx`**
   - Update UI text that references "last 24 hours" to "last 30 audits"

9. **`apps/ops-api/src/routes/products.ts`** -- Add ACA_PL fields to Zod schemas
   - Add `flatCommission` to POST and PATCH Zod schemas
   - Add `ACA_PL` to the type enum: `z.enum(["CORE", "ADDON", "AD_D", "ACA_PL"])`

## Patterns to Follow

### Pattern 1: Client-Side File Parsing (CSV Upload)
**What:** Parse CSV entirely on the client, submit structured JSON to existing API
**When:** CSV upload for chargebacks
**Why:** Follows the existing paste-to-parse pattern in CSSubmissions.tsx. The paste parser already does client-side text parsing and submits structured records to the same endpoint. CSV is just a different input source for the same pipeline.

```typescript
// Follow existing pattern from CSSubmissions paste handler:
// 1. Parse raw input -> structured records
// 2. Show editable preview table
// 3. Submit records[] + batchId to POST /chargebacks
function parseCSV(text: string, columnMap: Record<string, string>): ChargebackRecord[] {
  const lines = text.split("\n").filter(l => l.trim());
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line); // Handle quoted commas
    const record: Record<string, string> = {};
    headers.forEach((h, i) => { record[columnMap[h] || h] = values[i]; });
    return mapToChargebackSchema(record);
  });
}
```

### Pattern 2: Client-Side Data Pivot (Payroll Sidebar)
**What:** Transform period-grouped data into agent-grouped data on the client
**When:** Payroll agent sidebar redesign
**Why:** Avoids adding a new API endpoint. The existing `/payroll/periods` endpoint returns everything needed -- just restructured differently. This matches the codebase pattern of doing presentation transforms on the client (see: agent grouping already done in PayrollPeriods.tsx line 1701+).

```typescript
// Existing pattern already groups by agent within a period.
// New pattern: group across periods.
type AgentPayHistory = {
  agentId: string;
  agentName: string;
  periods: { period: Period; entries: Entry[] }[];
};

function pivotToAgentFirst(periods: Period[]): AgentPayHistory[] {
  const map = new Map<string, AgentPayHistory>();
  for (const p of periods) {
    for (const e of p.entries) {
      const name = e.agent?.name ?? "Unknown";
      if (!map.has(name)) map.set(name, { agentId: name, agentName: name, periods: [] });
      const agent = map.get(name)!;
      const existing = agent.periods.find(ap => ap.period.id === p.id);
      if (existing) existing.entries.push(e);
      else agent.periods.push({ period: p, entries: [e] });
    }
  }
  return [...map.values()].sort((a, b) => a.agentName.localeCompare(b.agentName));
}
```

### Pattern 3: Count-Based vs Time-Based Default Window
**What:** Default to "last N records" instead of "last N hours"
**When:** Call audit rolling window change
**Why:** Time-based windows show nothing on quiet days and overflow on busy ones. Count-based gives consistent UX.

```typescript
// Current (time-based):
if (!cursor) {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  where.callDate = { gte: yesterday, lt: now };
}

// New (count-based):
// Remove the date filter default entirely. Just use take: 30.
// The cursor pagination already handles "load more".
const audits = await prisma.callAudit.findMany({
  where,        // Only has date filter if user explicitly set a date range
  ...paginationArgs,
  orderBy: [{ callDate: "desc" }, { updatedAt: "desc" }],
  take: limit + 1,  // limit defaults to 25, but initial load uses 30
});
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: New API Endpoint for Payroll Agent View
**What:** Creating a separate `/payroll/by-agent` endpoint
**Why bad:** Duplicates data fetching logic, adds maintenance burden, the existing endpoint already returns all needed data
**Instead:** Pivot the data on the client. The periods endpoint is already fetched once and cached in React state.

### Anti-Pattern 2: Server-Side CSV Parsing
**What:** Uploading raw CSV to the server for parsing
**Why bad:** Breaks the existing pattern (paste-to-parse is client-side), adds file upload infrastructure (multer), makes the preview step require a round-trip
**Instead:** Parse CSV on the client with a simple split-based parser. The existing chargeback paste parser is the model. Handle quoted fields (commas inside quotes) but do not add a CSV library -- the format is simple enough.

### Anti-Pattern 3: Splitting PayrollPeriods.tsx into Multiple Route Pages
**What:** Making `/payroll/agents/[id]` a separate Next.js page
**Why bad:** Breaks the single-page dashboard pattern. All payroll functionality is in one tab. Navigation within the tab should be state-based, not route-based.
**Instead:** Use React state (`selectedAgent: string | null`) to toggle between the agent list sidebar view and the agent detail view. Same component tree, different render paths.

### Anti-Pattern 4: Adding enrollmentFee to the Database Default
**What:** Altering the Prisma schema to `@default(0)` on enrollmentFee
**Why bad:** Existing null values have semantic meaning (fee was not entered). The fix should be in the commission calculation logic, not the data model.
**Instead:** Treat null as $0 in `applyEnrollmentFee()` only. The UI can also default the form field to "0" for new sales.

### Anti-Pattern 5: Adding a CSV Parsing Library
**What:** Installing `papaparse` or `csv-parse` for client-side CSV parsing
**Why bad:** Inconsistent with codebase philosophy (no external UI/parsing libraries). The paste parser does text splitting inline. CSV parsing for this use case is ~30 lines of code: split lines, handle quoted fields, map headers.
**Instead:** Write a simple `parseCSVLine()` function that handles the one edge case (commas inside quoted fields).

## Build Order (Dependency-Aware)

The six features have minimal interdependencies. Recommended build order based on risk and dependency:

### Phase 1: Quick Fixes (independent, low risk)
These can be built in parallel:

1. **Enrollment fee $0 default** -- One-line fix in `payroll.ts`, one-line fix in `ManagerEntry.tsx`. Unblocks correct half-commission badge rendering.
2. **Call audit rolling window** -- Small change in `call-audits.ts` (remove date default, rely on take limit). Update `ManagerAudits.tsx` text.
3. **Lead timing starts expanded** -- One-line change in `LeadTimingSection.tsx`.
4. **Sparkline data fix** -- Debug `LeadTimingSparklines.tsx` data pipeline. Likely requires investigating the `/lead-timing/sparklines` API response shape.

### Phase 2: ACA Product Editing (moderate, extends existing)
5. **ACA product fields in PayrollProducts.tsx** -- Add `flatCommission` input, `ACA_PL` type option, addon qualifier rules UI. Requires matching Zod schema update in `products.ts` route.

### Phase 3: Major UI Changes (higher effort, self-contained)
6. **CSV chargeback upload** -- New UI in CS tab. Client-side CSV parser, column mapping, preview table. Feeds existing API.
7. **Payroll sidebar redesign** -- Largest change. Refactor 91K PayrollPeriods.tsx. Extract sidebar, implement agent-first pivot, add "Load More".

Build Phase 1 items in parallel for quick wins. Phase 2 is a natural extension of existing product CRUD. Phase 3 items are the biggest changes but are independent of each other and of Phases 1-2.

## Files Modified vs Created

| File | Action | Estimated Changes |
|------|--------|-------------------|
| `apps/ops-api/src/services/payroll.ts` | MODIFY | ~3 lines (null -> 0 in applyEnrollmentFee) |
| `apps/ops-api/src/routes/call-audits.ts` | MODIFY | ~8 lines (remove 24h default, adjust take) |
| `apps/ops-api/src/routes/products.ts` | MODIFY | ~4 lines (add ACA_PL to enum, flatCommission to schemas) |
| `apps/ops-dashboard/.../manager/LeadTimingSection.tsx` | MODIFY | 1 line (expanded default) |
| `apps/ops-dashboard/.../manager/LeadTimingSparklines.tsx` | MODIFY | ~5-15 lines (data fix) |
| `apps/ops-dashboard/.../manager/ManagerAudits.tsx` | MODIFY | ~2 lines (text update) |
| `apps/ops-dashboard/.../manager/ManagerEntry.tsx` | MODIFY | ~3 lines (default enrollmentFee to "0") |
| `apps/ops-dashboard/.../payroll/PayrollProducts.tsx` | MODIFY | ~40 lines (ACA_PL fields) |
| `apps/ops-dashboard/.../payroll/PayrollPeriods.tsx` | MAJOR REFACTOR | ~300-500 lines changed (sidebar + agent-first) |
| `apps/ops-dashboard/.../cs/CSSubmissions.tsx` | MODIFY | ~200 lines added (CSV upload UI) |

**Total: 10 files modified. 0 new files (CSV upload lives inside existing CSSubmissions.tsx or as extracted sub-component in same directory). No schema migrations. No new API endpoints.**

## Sources

- `apps/ops-api/src/routes/chargebacks.ts` -- existing chargeback API contract (lines 12-31 for schema, 33-115 for handler)
- `apps/ops-api/src/routes/products.ts` -- product CRUD with Zod schemas (lines 23-53 POST, 55-98 PATCH)
- `apps/ops-api/src/routes/call-audits.ts` -- audit list with 24h default window (lines 44-52)
- `apps/ops-api/src/services/payroll.ts` -- commission engine and enrollment fee logic (lines 55-84)
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` -- 91K agent card component with existing agent grouping at line 1701+
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` -- product management UI (no ACA_PL support currently)
- `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSection.tsx` -- collapsed by default (line 75)
- `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSparklines.tsx` -- sparkline rendering
- `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` -- existing paste-to-parse chargeback submission
- `prisma/schema.prisma` -- Product model (lines 129-159), ChargebackSubmission (lines 565-601), CallAudit (lines 241-269)
