# Feature Landscape: v1.7 Dashboard Fixes & Cost Tracking

**Domain:** Insurance sales operations platform -- bug fixes, missing form fields, audit trail
**Researched:** 2026-03-25
**Focus:** NEW features only (existing v1.0-v1.6 features are shipped)

---

## Table Stakes

Features that fix existing broken behavior or missing UI elements. These are bugs, not enhancements.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| Remove Products from Manager Config tab | Products section is duplicated -- it belongs in Payroll Config only. Managers editing products here causes confusion. | Low | None -- pure JSX removal |
| Add Buffer field to Lead Source create form | Buffer field exists in DB (`callBufferSeconds`) and in the edit form, but is missing from the create form. Users must create then immediately edit to set buffer. | Low | None -- add field to Zod schema + form |
| Fix Convoso call log data flow | Poller writes KPI aggregates to `AgentCallKpi` but skips `ConvosoCallLog` records. Cost per sale in tracker/owner dashboard cannot be computed from stored data. | Medium | ConvosoCallLog model (exists), poller logic |
| Fix Manager Agent Sales premium column | Premium column shows core product only, excludes addon premiums per row. Inconsistent with sales board and payroll which include addons (shipped v1.2). | Low | SaleProduct join pattern (exists in other views) |

## Differentiators

Features that add new capability beyond fixing what exists.

| Feature | Value Proposition | Complexity | Depends On |
|---------|-------------------|------------|------------|
| CS Resolved Log tab | Gives OWNER_VIEW/SUPER_ADMIN an audit trail of all resolved chargebacks and pending terms with resolver name, notes, timestamps. Currently resolution data exists but has no dedicated view -- you have to scan the full tracking table filtered by status. | Medium | Existing resolution fields on ChargebackSubmission and PendingTermSubmission |
| Show agent lead spend with zero sales | Agents burning through leads with no conversions are invisible in cost tracking. Surfacing their lead spend highlights coaching/termination needs. | Low | AgentCallKpi data (exists), display logic change |

## Anti-Features

Features to explicitly NOT build for v1.7.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time Convoso polling dashboard | v1.7 is about fixing data flow, not building a live call monitor | Fix the poller to persist ConvosoCallLog records; dashboard queries stored data |
| Editable resolution notes after resolve | Adds complexity to audit trail integrity; resolved records should be immutable | Allow unresolve then re-resolve if notes need changing (pattern already exists) |
| Batch re-resolve from resolved log | Tempting power feature but encourages sloppy workflows | Keep individual resolve/unresolve actions |
| Cost per sale charting | Premature -- fix the data flow first, then consider visualization in a future milestone | Show cost per sale as numbers in existing table columns |

---

## Feature Details

### 1. Remove Products from Manager Config Tab

**Current state:** Products section appears in both Manager Config and Payroll Config tabs. The Manager Config version allows editing products, which can conflict with Payroll's product management.

**What to do:** Delete the Products section JSX from the Manager Config tab component. No API changes. No database changes. Pure frontend cleanup.

**Complexity:** LOW -- 15 minutes of work. Identify the component/section, remove it, verify Manager Config still renders correctly.

---

### 2. Add Buffer Field to Lead Source Create Form

**Current state:** The `callBufferSeconds` column exists in the `lead_sources` table (schema line 114, default 0). The edit form includes this field. The create form and its backing Zod schema (`agents.ts` line 76) omit it:

```typescript
// Current (missing callBufferSeconds)
const schema = z.object({ name: z.string().min(1), listId: z.string().optional(), costPerLead: z.number().min(0).default(0) });
```

**What to do:**
1. Add `callBufferSeconds: z.number().int().min(0).default(0)` to the create schema
2. Pass `callBufferSeconds` through to `prisma.leadSource.create()`
3. Add a number input field to the create form in the dashboard (match existing edit form pattern)

**Complexity:** LOW -- schema fix + form field addition.

---

### 3. CS Resolved Log Tab

**Current state:** ChargebackSubmission and PendingTermSubmission both have resolution fields (`resolvedAt`, `resolvedBy`, `resolutionNote`, `resolutionType`) and a resolver User relation. The GET endpoints return this data but there is no dedicated view for browsing resolved records.

**What users expect:**
- A new tab in the CS section visible only to OWNER_VIEW and SUPER_ADMIN
- Table showing: record type (chargeback/pending term), member info, resolution type (recovered/closed for chargebacks; reinstated/closed for pending terms), resolver name, resolution date, resolution notes
- Date range filtering using existing DateRangeFilter component
- Sortable columns (at minimum by resolved date)
- CSV export of resolved records

**Implementation approach:**
- **API:** Add `?resolved=true` query param to existing GET `/chargebacks` and GET `/pending-terms` endpoints, or create dedicated `GET /chargebacks/resolved` and `GET /pending-terms/resolved` endpoints. The query is `WHERE resolvedAt IS NOT NULL`, including resolver relation.
- **Frontend:** New `CSResolvedLog.tsx` component in the CS tab section. Follows existing CSTracking pattern (table with filters, inline CSSProperties, lucide-react icons).
- **Role gating:** Only OWNER_VIEW and SUPER_ADMIN can see this tab (same pattern as Submissions tab gating).

**Complexity:** MEDIUM -- new tab component with two data sources (chargebacks + pending terms), merged into a single view.

---

### 4. Fix Convoso Call Log Data Flow

**Current state:** The KPI poller (`convosoKpiPoller.ts`) fetches Convoso API data, enriches it with tier classifications, builds per-agent KPI summaries, and writes aggregated KPIs to `AgentCallKpi`. It tracks processed calls via `ProcessedConvosoCall` for deduplication. But it does NOT write individual call records to `ConvosoCallLog`.

The `ConvosoCallLog` model exists in the schema with all needed fields: `agentUser`, `listId`, `recordingUrl`, `callDurationSeconds`, `callTimestamp`, `agentId`, `leadSourceId`. It is linked to `Agent`, `LeadSource`, and `CallAudit`. But zero records are ever created because the poller skips this step.

**What to do:**
1. In `pollLeadSource()`, after enrichment and before KPI aggregation, add `prisma.convosoCallLog.createMany()` to persist individual call records
2. Map Convoso API fields to model columns: `user_id` -> `agentUser`, `list_id` -> `listId`, `recording_url` -> `recordingUrl`, `call_length` -> `callDurationSeconds`, timestamp -> `callTimestamp`
3. Look up `agentId` from the existing `agentMap` (already built in the poller)
4. Set `leadSourceId` from the current lead source being polled
5. Use `skipDuplicates: true` to handle re-processing edge cases

**Downstream impact:** Once ConvosoCallLog records exist in the database:
- Cost per sale queries can join `ConvosoCallLog` with `Sale` data locally instead of hitting the Convoso API
- The tracker and owner dashboard cost columns will have data to display
- The call audit queue can reference stored call records instead of fetching them on-demand

**Complexity:** MEDIUM -- the data mapping is straightforward, but the Convoso API response structure needs careful field mapping, and the poller's deduplication logic (via ProcessedConvosoCall) must remain consistent.

---

### 5. Show Agent Lead Spend with Zero Sales

**Current state:** The `buildKpiSummary()` function already calculates `totalLeadCost` for every agent with calls, regardless of whether they have sales. The issue is likely in how the dashboard displays this data -- agents with zero conversion-eligible calls may be filtered out or shown without cost data.

**What to do:**
1. Verify the API response includes agents with `totalLeadCost > 0` but `conversion_eligible: false`
2. In the tracker/owner dashboard, display all agents with lead activity, not just those with conversions
3. Show `totalLeadCost` column even when `costPerSale` is null (because there are no sales to divide by)
4. Consider adding a "Lead Spend" column alongside existing columns in the agent tracker table

**Complexity:** LOW -- primarily a frontend display fix, possibly a minor API query adjustment.

---

### 6. Fix Manager Agent Sales Premium Column

**Current state:** The Manager Agent Sales view shows a premium column per sale row. This likely queries `Sale` with its `SaleProduct` records but only sums core product premiums, excluding addons. The sales board (v1.2) and payroll (v1.2) already include addon premiums using the pattern: `SaleProduct.where(product.type === 'ADDON')` summed into the total.

**What to do:**
1. In the API endpoint serving manager agent sales data, include addon premiums in the per-row premium calculation
2. Use the same join pattern as the sales board: include `SaleProduct` with `product` relation, sum `actualPremium` across all product types
3. Display the combined total in the premium column

**Complexity:** LOW -- replicate existing addon-inclusive pattern from sales board/payroll.

---

## Feature Dependencies

```
No hard dependencies between features -- all 6 can be implemented in any order.

However, logical grouping suggests:

Bug fixes (no new UI):
  - Remove Products from Manager Config
  - Add Buffer to Lead Source create form
  - Fix premium column (addon inclusion)

Data flow fix:
  - Fix Convoso call log persistence -> enables lead spend display
  - Show agent lead spend with zero sales

New capability:
  - CS Resolved Log tab
```

## MVP Recommendation

**Phase order by risk and value:**

1. **Quick fixes** (Products removal, Buffer field, Premium column) -- three low-complexity bug fixes that can ship as a single phase
2. **Convoso data flow fix** -- medium complexity, enables cost tracking improvements
3. **Agent lead spend with zero sales** -- low complexity, depends on Convoso data being persisted
4. **CS Resolved Log tab** -- medium complexity, standalone new feature

**Defer from v1.7:**
- Cost per sale charting -- fix the data flow first, visualization comes later
- Batch operations on resolved log -- keep it read-only audit trail
- Real-time Convoso monitoring -- out of scope per PROJECT.md

## Sources

- `apps/ops-api/src/routes/agents.ts:76` -- Lead Source create schema missing callBufferSeconds
- `apps/ops-api/src/workers/convosoKpiPoller.ts` -- Confirmed poller writes AgentCallKpi but not ConvosoCallLog
- `apps/ops-api/src/routes/chargebacks.ts:177` -- Resolver relation included in GET response
- `apps/ops-api/src/services/convosoCallLogs.ts` -- buildKpiSummary calculates totalLeadCost for all agents
- `prisma/schema.prisma:457` -- ConvosoCallLog model exists with all needed fields
- `prisma/schema.prisma:114` -- callBufferSeconds exists on LeadSource
- `.planning/PROJECT.md` -- v1.7 scope definition

---
*Feature research for: v1.7 Dashboard Fixes & Cost Tracking*
*Researched: 2026-03-25*
