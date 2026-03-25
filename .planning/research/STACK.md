# Technology Stack

**Project:** v1.7 Dashboard Fixes & Cost Tracking
**Researched:** 2026-03-25
**Confidence:** HIGH

## Verdict: No New Dependencies Required

Every v1.7 feature is achievable with the existing stack. This milestone is entirely bug fixes, missing field additions, and a new read-only audit tab -- none of which require new libraries, database engines, or architectural changes.

## Current Stack (Unchanged)

### Core Framework
| Technology | Version | Purpose | Status for v1.7 |
|------------|---------|---------|------------------|
| Next.js | 15.3.9 | Unified dashboard (ops-dashboard) | Sufficient -- new CS tab is a standard page component |
| Express | 4.19.2 | REST API (ops-api) | Sufficient -- new endpoints follow existing patterns |
| Prisma | 5.20.0 | ORM + migrations | Sufficient -- queries on existing models, no schema changes needed |
| PostgreSQL | (via Docker/Railway) | Primary database | Sufficient -- all data already persisted |
| Socket.IO | 4.8.3 (server) / 4.8.3 (client) | Real-time updates | Sufficient -- CS events already wired |
| Zod | 3.23.8 | Request validation | Sufficient -- standard schema patterns |

### Supporting Libraries
| Library | Version | Purpose | v1.7 Relevance |
|---------|---------|---------|----------------|
| Luxon | 3.4.4 | Timezone-aware date handling | Used in date range queries for resolved log |
| lucide-react | 0.577.0 | Icons | Tab icons for new Resolved Log tab |
| @anthropic-ai/sdk | 0.78.0 | AI call auditing | Not touched in v1.7 |

## What Each v1.7 Feature Needs from the Stack

### 1. Remove Products from Manager Config Tab
**Stack impact:** None. Pure frontend deletion -- remove the Products section JSX from the Manager Config tab component in ops-dashboard.

### 2. Add Buffer Field to Lead Source Create Form
**Stack impact:** None.
- **Database:** `callBufferSeconds` column already exists in `lead_sources` table (confirmed in `prisma/schema.prisma` line 114)
- **API:** The POST `/lead-sources` Zod schema in `agents.ts` line 76 is missing `callBufferSeconds` -- add `z.number().int().min(0).default(0)` to the schema and pass through to `prisma.leadSource.create()`
- **Frontend:** Add the number input field to the create form (pattern already exists in the edit form)

### 3. CS Resolved Log Tab (Audit Trail)
**Stack impact:** None.
- **Database:** All resolution fields already exist on `ChargebackSubmission` and `PendingTermSubmission` models: `resolvedAt`, `resolvedBy`, `resolutionNote`, `resolutionType`, plus `resolver` relation to User
- **API:** Existing GET `/chargebacks` and GET `/pending-terms` endpoints return resolution data with `include: { resolver: { select: { name: true } } }` (confirmed in `chargebacks.ts` line 177). Add a `?resolved=true` query param filter or create a dedicated `/chargebacks/resolved` endpoint.
- **Frontend:** New tab component in CS section, gated to OWNER_VIEW/SUPER_ADMIN. Standard inline CSSProperties table following existing CS tracking patterns.
- **Query pattern:** `prisma.chargebackSubmission.findMany({ where: { resolvedAt: { not: null } }, include: { resolver: ... } })`

### 4. Fix Convoso Call Log Data Flow
**Stack impact:** None. This is a data flow gap, not a stack gap.
- **Current state:** The KPI poller (`apps/ops-api/src/workers/convosoKpiPoller.ts`) fetches Convoso data, writes KPI aggregates to `AgentCallKpi`, and tracks processed calls via `ProcessedConvosoCall` -- but does NOT write individual records to the `ConvosoCallLog` table. The model exists in schema (line 457) with proper fields and indexes but is never populated by the poller.
- **Fix:** Add `prisma.convosoCallLog.createMany()` in `pollLeadSource()`, mapping Convoso API response fields to model columns: `agentUser` (from `user_id`), `listId`, `recordingUrl`, `callDurationSeconds` (from `call_length`), `callTimestamp`, `agentId` (from agent map lookup), `leadSourceId`.
- **Downstream impact:** Once ConvosoCallLog records are persisted, cost-per-sale can be calculated from actual stored data instead of live API calls. The tracker and owner dashboard can query local DB rather than hitting Convoso API.

### 5. Show Agent Lead Spend with Zero Sales
**Stack impact:** None.
- **Current state:** The `buildKpiSummary()` in `convosoCallLogs.ts` already calculates `totalLeadCost` for all agents with calls regardless of sale count. The issue is likely in dashboard display -- filtering out agents with zero conversion-eligible calls.
- **Fix:** Adjust the frontend query or display logic to show all agents with `totalLeadCost > 0`, not just those with `conversion_eligible === true`. May also need an API endpoint that joins `AgentCallKpi` data with `Sale` counts so agents with spend but zero sales appear.

### 6. Fix Manager Agent Sales Premium Column
**Stack impact:** None.
- **Current state:** Premium column likely shows only core product premium, omitting addon premiums per sale row.
- **Fix:** Include addon premium sum in the sales query by joining `SaleProduct` records where `product.type === 'ADDON'` and adding to the displayed total. This exact pattern already exists in the sales board leaderboard and payroll addon-inclusive premium (shipped in v1.2).

## Schema Changes Assessment

**No Prisma migrations expected.** All required database columns and tables already exist:

| Table/Column | Exists? | Evidence |
|--------------|---------|----------|
| `convoso_call_logs` table | Yes | Schema line 457, all columns present |
| `lead_sources.call_buffer_seconds` | Yes | Schema line 114, `@default(0)` |
| `chargeback_submissions.resolved_at` | Yes | Schema line 557 |
| `chargeback_submissions.resolved_by` | Yes | Schema line 558 |
| `chargeback_submissions.resolution_note` | Yes | Schema line 559 |
| `chargeback_submissions.resolution_type` | Yes | Schema line 560 |
| `pending_term_submissions` resolution fields | Yes | Same pattern as chargebacks |

## What NOT to Add

| Technology | Why Not |
|------------|---------|
| React Query / SWR | Dashboard uses `authFetch()` + `useEffect`. Adding a data fetching library for one tab creates inconsistency across the entire app. |
| DataGrid library (AG Grid, TanStack Table) | Resolved log is a simple read-only table. Existing inline-styled `<table>` pattern is sufficient and consistent. |
| State management (Zustand, Redux) | React state + context covers all v1.7 needs. No cross-component state sharing beyond what Socket.IO context already provides. |
| New database migrations | All required columns already exist. Zero schema changes. |
| Caching layer (Redis) | Query volumes are low (internal ops tool). Prisma query caching is unnecessary at this scale. |
| Separate analytics service | Convoso data flow fix is a one-line addition to the existing poller, not an architectural change. |

## Alternatives Considered

| Category | Decision | Alternative | Why Not |
|----------|----------|-------------|---------|
| Resolved log data source | Query existing ChargebackSubmission/PendingTermSubmission resolution fields | Separate AuditLog table | Unnecessary duplication -- resolution data is already on submission records with resolver relation |
| Convoso data persistence | Write to existing ConvosoCallLog model in poller | Create new materialized view | ConvosoCallLog model exists with indexes; adding writes is one function call |
| Resolved log API | Add `?resolved=true` filter to existing endpoints | New dedicated endpoints | Query param is simpler and follows existing `dateRangeQuerySchema` pattern. Separate endpoint only if query shape diverges significantly. |
| Cost per sale display | Join AgentCallKpi with Sales in API | Client-side calculation | Server-side join is more accurate and follows existing pattern of server-authoritative calculations |

## Installation

```bash
# No changes. Zero npm install commands for v1.7.
npm install          # existing workspace install, no new packages
npm run db:migrate   # no new migrations expected
```

## Sources

- `prisma/schema.prisma` -- ConvosoCallLog model (line 457), LeadSource.callBufferSeconds (line 114), ChargebackSubmission resolution fields (lines 557-560)
- `apps/ops-api/src/workers/convosoKpiPoller.ts` -- confirmed writes to AgentCallKpi but NOT ConvosoCallLog
- `apps/ops-api/src/routes/agents.ts:76` -- confirmed POST `/lead-sources` Zod schema missing callBufferSeconds
- `apps/ops-api/src/routes/chargebacks.ts:177` -- confirmed resolver relation included in GET response
- `apps/ops-api/src/services/convosoCallLogs.ts` -- confirmed cost_per_sale and total_lead_cost calculations already exist in buildKpiSummary

---
*Stack research for: v1.7 Dashboard Fixes & Cost Tracking*
*Researched: 2026-03-25*
