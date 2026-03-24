# Phase 22: Owner & Payroll Enhancements - Research

**Researched:** 2026-03-24
**Domain:** Owner dashboard KPI extension + CSV export restructuring
**Confidence:** HIGH

## Summary

This phase covers two distinct feature areas: (1) surfacing CS (service staff) payroll totals on the owner dashboard period summary table with real-time Socket.IO updates, and (2) restructuring the existing detailed CSV export to produce agent-grouped "print card" blocks with service staff in a separate trailing section.

Both features build on well-established patterns already present in the codebase. The owner dashboard already has a period summary table with `commissionPaid` column -- adding a `csPayrollTotal` column is a straightforward extension. The detailed CSV export already sorts by agent and produces subtotal rows -- restructuring from period-first to agent-first grouping is a refactor of existing logic, not new capability.

**Primary recommendation:** Extend the `/api/reporting/periods` endpoint to include `csPayrollTotal` per period, add Socket.IO emission to the service payroll entry routes, and refactor `exportDetailedCSV()` to group by agent across periods with a separate service staff section at the end.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** CS payroll total appears as a new column in the period summary table -- NOT as a separate StatCard in the overview grid
- **D-02:** The column shows the sum of ServicePayrollEntry totalPay for each period, displayed alongside the existing "Commission Paid" column
- **D-03:** Real-time updates via Socket.IO when service payroll entries change (existing `emitCSChanged` pattern)
- **D-04:** Agent-first grouping -- one pay card block per agent per week. For a 1-month export with 10 agents and 4 weeks, produces 40 pay card blocks
- **D-05:** Within each agent: weeks ordered chronologically. Agents ordered alphabetically by name
- **D-06:** Each pay card block: header row (agent name + week range) -> individual sale rows -> subtotal row
- **D-07:** Enhances/replaces the existing "Detailed CSV" export button in PayrollExports.tsx -- not a third export option
- **D-08:** Service staff pay cards appear in a separate section at the end of the CSV, after all commission agent pay cards
- **D-09:** Service staff section uses its own column layout: basePay, bonus, deductions, totalPay (not the commission/fronted/hold columns)

### Claude's Discretion
- Column header naming (e.g., "CS Payroll" vs "Service Payroll" vs "Service Total")
- Whether the service staff section in CSV gets its own header row distinguishing it from the commission section
- Handling of agents with zero entries in a given week (skip vs show empty card)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| OWNER-01 | Owner period summary shows CS payroll total next to commission total | Extend `/api/reporting/periods` to include `csPayrollTotal` from ServicePayrollEntry; add column to period summary table in OwnerOverview.tsx |
| OWNER-02 | CS payroll total updates via Socket.IO when service entries change | Add `emitServicePayrollChanged` to service.ts routes (POST/PATCH); owner dashboard listens for new event and refetches period data |
| EXPORT-01 | Detailed CSV export produces agent-grouped sections matching print card layout | Refactor `exportDetailedCSV()` from period-first to agent-first grouping across all filtered periods |
| EXPORT-02 | Each agent section includes header row, sale rows, and subtotal row | Existing subtotal pattern already in `exportDetailedCSV()` -- adapt to include header row with agent name + week range |
| EXPORT-03 | Export handles large datasets without browser memory issues | Use string concatenation or array join for CSV generation (current pattern); avoid creating intermediate objects per-row |
</phase_requirements>

## Standard Stack

### Core (Already in Use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | 4.x | API routes | Already powers all ops-api routes |
| Prisma | 5.x | Database queries | Already used for ServicePayrollEntry queries |
| Socket.IO | 4.x | Real-time events | Already used for `sale:changed`, `cs:changed` events |
| React | 18.x | UI components | Already renders owner dashboard |
| Next.js | 15 | Frontend framework | Already serves all dashboard apps |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/ui | workspace | UI primitives (StatCard, Badge, etc.) | Period summary table styling |
| @ops/auth/client | workspace | authFetch() | API calls from owner dashboard |
| @ops/socket | workspace | Socket event types + HIGHLIGHT_GLOW | Socket.IO type definitions |
| lucide-react | latest | Icons | Column headers if needed |

### Alternatives Considered
No alternatives needed -- this phase uses 100% existing stack.

## Architecture Patterns

### Pattern 1: API Endpoint Extension for CS Payroll Total

**What:** Extend the existing `/api/reporting/periods` endpoint to include `csPayrollTotal` per period by joining ServicePayrollEntry data.

**Current code (sales.ts:615-657):** The weekly view queries `payrollPeriod.findMany()` with `entries` include, then maps to `{ period, salesCount, premiumTotal, commissionPaid, periodStatus }`. It does NOT include `serviceEntries`.

**Change needed:** Add `serviceEntries` to the include clause and compute `csPayrollTotal` as `sum(serviceEntry.totalPay)` for each period.

```typescript
// In the weekly view branch of /api/reporting/periods
const periods = await prisma.payrollPeriod.findMany({
  include: {
    entries: {
      include: { sale: { select: { premium: true, status: true, addons: { select: { premium: true } } } } },
    },
    serviceEntries: {
      select: { totalPay: true },
    },
  },
  orderBy: { weekStart: "desc" },
  take: 12,
});

const result = periods.map(p => {
  const ranEntries = p.entries.filter(e => e.sale?.status === 'RAN');
  const csPayrollTotal = p.serviceEntries.reduce(
    (sum, se) => sum + Number(se.totalPay), 0
  );
  return {
    period: `${p.weekStart.toISOString().slice(0, 10)} - ${p.weekEnd.toISOString().slice(0, 10)}`,
    salesCount: ranEntries.length,
    premiumTotal: /* existing calc */,
    commissionPaid: /* existing calc */,
    csPayrollTotal,
    periodStatus: p.status,
  };
});
```

**Monthly view:** The monthly view uses raw SQL. Needs a LEFT JOIN to `service_payroll_entries` with `SUM(total_pay)` grouped by month. Alternatively, run a separate query for CS totals and merge.

### Pattern 2: Socket.IO Event for Service Payroll Changes

**What:** Emit a Socket.IO event when service payroll entries are created or updated, so the owner dashboard can react.

**Current state:** The service routes (`apps/ops-api/src/routes/service.ts`) do NOT import or call any socket emitters. The `emitCSChanged` function (in `socket.ts`) has payload type `{ type: "chargeback" | "pending_term", batchId, count }` -- this is about chargebacks, NOT service payroll entries.

**Two approaches:**

Option A -- Extend CSChangedPayload to include `"service_payroll"` type:
```typescript
export type CSChangedPayload = {
  type: "chargeback" | "pending_term" | "service_payroll";
  batchId: string;
  count: number;
};
```
Pro: Reuses existing event. Con: Semantically different (CSChanged = customer service tracking, not payroll).

Option B -- Create new `emitServicePayrollChanged`:
```typescript
export interface ServicePayrollChangedPayload {
  type: "created" | "updated";
  periodId: string;
  serviceAgentId: string;
  totalPay: number;
}
export function emitServicePayrollChanged(payload: ServicePayrollChangedPayload) {
  io?.emit("service-payroll:changed", payload);
}
```
Pro: Clean separation. Con: New event to maintain.

**Recommendation:** Option B -- new dedicated event. The CONTEXT.md says "existing `emitCSChanged` pattern" which means use the same pattern (simple emit), not necessarily the same event name. The owner dashboard can listen for `service-payroll:changed` and refetch period data.

### Pattern 3: Owner Dashboard Socket Listener

**What:** Owner dashboard listens for service payroll changes and refetches period data.

**Current pattern (OwnerOverview.tsx:378-420):** The component listens for `sale:changed` and does optimistic local state patching. For CS payroll total, optimistic patching is possible but a simpler approach is to refetch `/api/reporting/periods` when the event fires.

```typescript
// In OwnerOverview.tsx
useEffect(() => {
  if (!socket) return;
  const handler = () => {
    // Refetch period data to get updated csPayrollTotal
    authFetch(`${API}/api/reporting/periods?view=${periodView}`)
      .then(res => res.ok ? res.json() : { periods: [] })
      .then(data => setPeriods(data.periods ?? []))
      .catch(() => {});
  };
  socket.on("service-payroll:changed", handler);
  return () => { socket.off("service-payroll:changed", handler); };
}, [socket, API, periodView]);
```

### Pattern 4: Print Card CSV -- Agent-First Grouping

**What:** Restructure `exportDetailedCSV()` from the current period-first, agent-sorted layout to an agent-first layout where each agent gets a pay card block per week.

**Current flow (PayrollExports.tsx:114-172):**
```
For each period:
  Sort entries by agent name
  For each entry:
    If new agent -> emit subtotal for previous agent
    Emit sale row
  Emit final subtotal
```

**New flow (per D-04, D-05):**
```
1. Collect all entries across filtered periods
2. Group by agent name
3. Sort agents alphabetically
4. For each agent:
   a. Group entries by period (weekStart)
   b. Sort periods chronologically
   c. For each period:
      - Header row: "Agent Name | Week MM-DD-YYYY to MM-DD-YYYY"
      - Sale rows (same columns as current)
      - Subtotal row
5. Blank separator between agents
6. "=== SERVICE STAFF ===" separator
7. For each service agent (from serviceEntries):
   a. Group by period
   b. Header row: "Service Agent Name | Week MM-DD-YYYY to MM-DD-YYYY"
   c. Single row: basePay, bonus, deductions, totalPay
   d. (or subtotal if only one row per agent per period)
```

### Pattern 5: Service Staff Section in CSV

**What:** After all commission agent pay cards, add a visually distinct section for service staff using different column headers.

**Key detail (D-09):** Service staff columns are `basePay, bonus, deductions, totalPay` -- NOT the commission columns (`Commission, Bonus, Fronted, Hold, Net`). This means the CSV has two column header rows: one for commission agents, one for service staff.

```
[Commission agent pay cards...]

,,,,,,,,,,,,,,
=== SERVICE STAFF ===,,,,,,,,,,,,,,
Week Start,Week End,Service Agent,Base Pay,Bonus,Deductions,Fronted,Total Pay
[service entries...]
```

### Anti-Patterns to Avoid
- **DO NOT add a StatCard for CS payroll** -- D-01 explicitly says column in table, not StatCard
- **DO NOT create a third export button** -- D-07 says enhance/replace existing detailed CSV
- **DO NOT use the commission column layout for service entries** -- D-09 mandates different columns
- **DO NOT reuse `emitCSChanged` for semantically different events** -- CS tracking vs payroll are different domains

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV escaping | Custom regex | Existing `esc()` helper in PayrollExports.tsx | Already handles commas and quotes correctly |
| Date formatting | New formatter | Existing `fmtDate()` in PayrollExports.tsx | Consistent MM-DD-YYYY format |
| Date range filtering | New filter logic | Existing `filterPeriodsByDateRange()` in PayrollExports.tsx | Already handles all preset ranges |
| Socket.IO setup | New socket connection | Existing `socket` prop passed to OwnerOverview | Already connected and managed by parent |

## Common Pitfalls

### Pitfall 1: Monthly View Raw SQL Missing CS Totals
**What goes wrong:** The weekly view uses Prisma ORM (easy to add serviceEntries), but the monthly view uses raw SQL (`$queryRaw`). Forgetting to add CS totals to the monthly query means the column shows $0 in monthly view.
**Why it happens:** Two separate code paths for the same endpoint.
**How to avoid:** Add `LEFT JOIN service_payroll_entries spe ON spe.payroll_period_id = pp.id` to the monthly raw SQL query, or run a separate aggregation query and merge results.
**Warning signs:** CS Payroll column shows values in weekly view but $0 in monthly view.

### Pitfall 2: Decimal Type from Prisma
**What goes wrong:** `ServicePayrollEntry.totalPay` is `Decimal(12,2)` in Prisma. `Number(se.totalPay)` works but if you forget the conversion, you get string concatenation instead of addition.
**Why it happens:** Prisma returns `Decimal` as `Prisma.Decimal` objects, not native numbers.
**How to avoid:** Always wrap in `Number()` when summing: `p.serviceEntries.reduce((sum, se) => sum + Number(se.totalPay), 0)`.
**Warning signs:** CS payroll total shows as concatenated string like "250.00300.00" instead of 550.

### Pitfall 3: Large Export Memory -- String Concatenation vs Array
**What goes wrong:** For 100+ agents with 1000+ sales, creating one massive array of arrays then joining could use significant memory.
**Why it happens:** The current pattern builds `rows[]` array then joins at the end.
**How to avoid:** The current pattern (array of arrays, join at end) is fine for this scale. 1000 rows x 15 columns = ~15,000 strings. This is well within browser memory limits. No streaming needed.
**Warning signs:** Browser tab crashes or hangs during export.

### Pitfall 4: Socket Event Not Reaching Owner Dashboard
**What goes wrong:** Service payroll entry is saved but owner dashboard doesn't update.
**Why it happens:** The service routes don't import/call any socket emitter. Must add import and call in both POST and PATCH handlers.
**How to avoid:** Add `emitServicePayrollChanged()` call after successful `prisma.servicePayrollEntry.upsert()` and `prisma.servicePayrollEntry.update()` in `service.ts`.
**Warning signs:** CS payroll total only updates on page refresh, never via Socket.IO.

### Pitfall 5: PeriodSummary Type Not Updated
**What goes wrong:** TypeScript type `PeriodSummary` in OwnerOverview.tsx doesn't include `csPayrollTotal`, so the new column shows undefined.
**Why it happens:** The type is defined locally in the component file (line 40).
**How to avoid:** Add `csPayrollTotal?: number` to the `PeriodSummary` type definition.
**Warning signs:** Column renders but shows nothing or "NaN".

## Code Examples

### Current PeriodSummary Type (OwnerOverview.tsx:40)
```typescript
type PeriodSummary = {
  period: string;
  salesCount: number;
  premiumTotal: number;
  commissionPaid: number;
  periodStatus?: string;
};
```
Must add: `csPayrollTotal: number;`

### Current Period Summary Table Headers (OwnerOverview.tsx:303-309)
```typescript
<tr style={{ background: colors.bgSurfaceInset }}>
  <th style={baseThStyle}>Period</th>
  <th style={{ ...baseThStyle, textAlign: "right" }}>Sales</th>
  <th style={{ ...baseThStyle, textAlign: "right" }}>Premium</th>
  <th style={{ ...baseThStyle, textAlign: "right" }}>Commission</th>
  {periodView === "weekly" && <th style={baseThStyle}>Status</th>}
</tr>
```
Must add CS Payroll column before or after Commission.

### Existing Socket Emitter Pattern (socket.ts:57-59)
```typescript
export function emitSaleChanged(payload: SaleChangedPayload) {
  io?.emit("sale:changed", payload);
}
```
Follow same pattern for new service payroll event.

### Existing CSV Export Helper (PayrollExports.tsx:116)
```typescript
const esc = (v: string) =>
  v.includes(",") || v.includes('"')
    ? `"${v.replace(/"/g, '""')}"`
    : v;
```
Reuse in new export logic.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Period-first CSV grouping | Agent-first print card layout | This phase | More useful for payroll staff who distribute pay cards per agent |
| No CS payroll on owner dashboard | CS payroll column in period table | This phase | Complete financial picture for owners |
| No socket events for service payroll | Socket.IO emission on create/update | This phase | Real-time owner dashboard updates |

## Open Questions

1. **Monthly view CS payroll calculation**
   - What we know: Weekly view uses Prisma ORM. Monthly view uses raw SQL `$queryRaw`. Both need CS payroll totals.
   - What's unclear: Whether to add a JOIN to the existing monthly raw SQL or run a separate query and merge.
   - Recommendation: Separate query is simpler and less error-prone. The monthly query is already complex with its JOINs.

2. **Service staff with zero entries in a given week (Claude's Discretion)**
   - What we know: Commission agents with no entries in a period simply don't appear (no PayrollEntry row).
   - Recommendation: Skip agents with zero entries (no empty cards). This matches commission agent behavior and keeps the CSV concise.

3. **CSV section separator for service staff (Claude's Discretion)**
   - What we know: D-08 says separate section at end. D-09 says different columns.
   - Recommendation: Add a blank row, then a "=== SERVICE STAFF ===" header row, then new column headers (Week Start, Week End, Service Agent, Base Pay, Bonus, Deductions, Fronted, Total Pay), then service pay cards. The explicit separator makes the two sections unmistakable.

4. **Column header naming for CS payroll (Claude's Discretion)**
   - Recommendation: "Service Payroll" -- matches the domain terminology used throughout the codebase (ServiceAgent, ServicePayrollEntry) and is more descriptive than "CS Payroll" which abbreviates.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (root-level for Morgan service) |
| Config file | `jest.config.js` (root) |
| Quick run command | `npm test -- helpers.test.js` |
| Full suite command | `npm test` |

Note: The ops-api does not have its own test suite -- only `apps/ops-api/src/services/__tests__/` has two test files for payroll logic. Frontend has no tests.

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OWNER-01 | `/api/reporting/periods` returns csPayrollTotal | manual-only | Manual: verify API response in browser | N/A |
| OWNER-02 | Socket.IO emits on service entry create/update | manual-only | Manual: create service entry, check owner dashboard updates | N/A |
| EXPORT-01 | Detailed CSV groups by agent across periods | manual-only | Manual: export CSV, verify agent-first layout | N/A |
| EXPORT-02 | Each agent section has header + sales + subtotal | manual-only | Manual: inspect CSV structure | N/A |
| EXPORT-03 | Export handles 100+ agents / 1000+ sales | manual-only | Manual: test with large dataset | N/A |

Justification for manual-only: All requirements involve API endpoint changes (no isolated unit logic to test) and client-side CSV generation in React components (no test harness for frontend). The existing test infrastructure covers only the root Morgan service and two payroll calculation services.

### Sampling Rate
- **Per task commit:** Manual verification of changed endpoint/component
- **Per wave merge:** Full manual walkthrough of owner dashboard + CSV export
- **Phase gate:** All 5 requirements verified manually before completion

### Wave 0 Gaps
None -- no automated tests are feasible for this phase given the existing test infrastructure. All validation is manual.

## Sources

### Primary (HIGH confidence)
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx` -- Owner dashboard component with period summary table, Socket.IO handling, PeriodSummary type
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` -- Existing CSV export logic with agent grouping and subtotals
- `apps/ops-api/src/routes/sales.ts:615-657` -- `/api/reporting/periods` endpoint (weekly + monthly views)
- `apps/ops-api/src/routes/service.ts` -- Service payroll entry CRUD (no socket emissions currently)
- `apps/ops-api/src/socket.ts` -- Socket.IO emitter functions and payload types
- `prisma/schema.prisma:421-441` -- ServicePayrollEntry model definition

### Secondary (MEDIUM confidence)
- `apps/ops-api/src/routes/payroll.ts:10-27` -- PayrollPeriod query includes serviceEntries with serviceAgent
- `apps/ops-api/src/services/reporting.ts` -- buildPeriodSummary helper (does not include CS payroll)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- extending existing patterns with well-understood code paths
- Pitfalls: HIGH -- identified from direct code inspection of current implementation

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable codebase, no external dependency concerns)
