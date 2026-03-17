---
phase: quick
plan: 260317-dxw
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/ops-api/src/workers/convosoKpiPoller.ts
  - apps/ops-api/src/index.ts
  - apps/ops-api/.env.example
  - prisma/schema.prisma
  - prisma/migrations/20260317_add_agent_call_kpi/migration.sql
autonomous: true
requirements: [CRON-WORKER]
must_haves:
  truths:
    - "Worker polls Convoso every 10 minutes on server boot"
    - "Each active lead source with a listId is queried independently"
    - "KPI snapshots are persisted to AgentCallKpi table per agent per lead source"
    - "One failing lead source does not stop others from being polled"
    - "Worker is silently disabled when CONVOSO_AUTH_TOKEN is not set"
  artifacts:
    - path: "apps/ops-api/src/workers/convosoKpiPoller.ts"
      provides: "Cron worker that polls Convoso and stores KPI snapshots"
    - path: "prisma/schema.prisma"
      provides: "AgentCallKpi model for historical KPI storage"
    - path: "prisma/migrations/20260317_add_agent_call_kpi/migration.sql"
      provides: "SQL migration creating agent_call_kpis table"
  key_links:
    - from: "apps/ops-api/src/workers/convosoKpiPoller.ts"
      to: "apps/ops-api/src/services/convosoCallLogs.ts"
      via: "fetchConvosoCallLogs, enrichWithTiers, buildKpiSummary imports"
    - from: "apps/ops-api/src/workers/convosoKpiPoller.ts"
      to: "prisma AgentCallKpi"
      via: "prisma.agentCallKpi.createMany for bulk snapshot insert"
    - from: "apps/ops-api/src/index.ts"
      to: "apps/ops-api/src/workers/convosoKpiPoller.ts"
      via: "startConvosoKpiPoller() call after server.listen"
---

<objective>
Build a cron worker that runs inside the ops-api process, polling Convoso every 10 minutes for each active lead source to generate and persist agent KPI snapshots.

Purpose: Enable historical tracking of agent call performance metrics per lead source without manual API calls.
Output: New AgentCallKpi table, worker service file, server integration.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/ops-api/src/services/convosoCallLogs.ts
@apps/ops-api/src/index.ts
@apps/ops-api/src/routes/index.ts (lines 1783-1865 for buildConvosoParams/extractConvosoResults pattern)
@prisma/schema.prisma

<interfaces>
<!-- From apps/ops-api/src/services/convosoCallLogs.ts -->
```typescript
export function fetchConvosoCallLogs(params: Record<string, string>): Promise<any>;
export function enrichWithTiers(records: ConvosoCallLog[]): EnrichedCallLog[];
export function buildKpiSummary(records: EnrichedCallLog[], opts?: KpiBuildOptions): KpiResponse;

export interface KpiBuildOptions {
  agentMap?: Map<string, { id: string; name: string }>; // email -> agent
  costPerLead?: number;
}

export interface AgentKpi {
  user_id: string;
  agent_name: string | null;
  agent_id: string | null;
  total_calls: number;
  avg_call_length: number;
  calls_by_tier: Record<CallLengthTier, number>;
  conversion_eligible: boolean;
  longest_call: number;
  cost_per_sale: number | null;
  total_lead_cost: number | null;
}
```

<!-- From routes/index.ts — helper patterns to reuse -->
```typescript
// extractConvosoResults safely pulls array from varied API response shapes
function extractConvosoResults(response: any): any[] {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response)) return response;
  return [];
}
```

<!-- LeadSource model fields relevant to worker -->
```prisma
model LeadSource {
  id          String   @id @default(cuid())
  name        String   @unique
  listId      String?  @map("list_id")
  costPerLead Decimal  @db.Decimal(10, 2) @map("cost_per_lead")
  active      Boolean  @default(true)
  // ...
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add AgentCallKpi model and migration</name>
  <files>prisma/schema.prisma, prisma/migrations/20260317_add_agent_call_kpi/migration.sql, apps/ops-api/.env.example</files>
  <action>
1. Add `AgentCallKpi` model to `prisma/schema.prisma` after the `ConvosoCallLog` model:

```prisma
model AgentCallKpi {
  id              String   @id @default(cuid())
  agentId         String   @map("agent_id")
  leadSourceId    String   @map("lead_source_id")
  convosoUserId   String   @map("convoso_user_id")
  totalCalls      Int      @map("total_calls")
  avgCallLength   Decimal  @db.Decimal(10, 2) @map("avg_call_length")
  callsByTier     Json     @map("calls_by_tier")
  costPerSale     Decimal? @db.Decimal(10, 2) @map("cost_per_sale")
  totalLeadCost   Decimal? @db.Decimal(10, 2) @map("total_lead_cost")
  longestCall     Int      @default(0) @map("longest_call")
  conversionEligible Boolean @default(false) @map("conversion_eligible")
  snapshotDate    DateTime @default(now()) @map("snapshot_date")
  createdAt       DateTime @default(now()) @map("created_at")

  agent      Agent      @relation(fields: [agentId], references: [id])
  leadSource LeadSource @relation(fields: [leadSourceId], references: [id])

  @@index([agentId, leadSourceId, snapshotDate])
  @@index([snapshotDate])
  @@map("agent_call_kpis")
}
```

2. Add the reverse relations:
   - On `Agent` model, add: `callKpis AgentCallKpi[]`
   - On `LeadSource` model, add: `callKpis AgentCallKpi[]`

3. Create manual migration SQL at `prisma/migrations/20260317_add_agent_call_kpi/migration.sql`:

```sql
CREATE TABLE "agent_call_kpis" (
  "id" TEXT NOT NULL,
  "agent_id" TEXT NOT NULL,
  "lead_source_id" TEXT NOT NULL,
  "convoso_user_id" TEXT NOT NULL,
  "total_calls" INTEGER NOT NULL,
  "avg_call_length" DECIMAL(10,2) NOT NULL,
  "calls_by_tier" JSONB NOT NULL,
  "cost_per_sale" DECIMAL(10,2),
  "total_lead_cost" DECIMAL(10,2),
  "longest_call" INTEGER NOT NULL DEFAULT 0,
  "conversion_eligible" BOOLEAN NOT NULL DEFAULT false,
  "snapshot_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_call_kpis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_call_kpis_agent_id_lead_source_id_snapshot_date_idx" ON "agent_call_kpis"("agent_id", "lead_source_id", "snapshot_date");
CREATE INDEX "agent_call_kpis_snapshot_date_idx" ON "agent_call_kpis"("snapshot_date");

ALTER TABLE "agent_call_kpis" ADD CONSTRAINT "agent_call_kpis_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "agent_call_kpis" ADD CONSTRAINT "agent_call_kpis_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

4. Add `CONVOSO_DEFAULT_QUEUE_ID` to `apps/ops-api/.env.example`:
   ```
   CONVOSO_DEFAULT_QUEUE_ID=your-convoso-queue-id
   ```
  </action>
  <verify>
    <automated>cd /c/Users/javer/Documents/Repositories/ai-calling-backend && npx prisma validate</automated>
  </verify>
  <done>AgentCallKpi model in schema, migration SQL ready, .env.example updated with CONVOSO_DEFAULT_QUEUE_ID</done>
</task>

<task type="auto">
  <name>Task 2: Create cron worker and wire to server</name>
  <files>apps/ops-api/src/workers/convosoKpiPoller.ts, apps/ops-api/src/index.ts</files>
  <action>
1. Create `apps/ops-api/src/workers/convosoKpiPoller.ts`:

```typescript
import { prisma } from "@ops/db";
import { fetchConvosoCallLogs, enrichWithTiers, buildKpiSummary } from "../services/convosoCallLogs";
```

Implement these functions:

**`extractConvosoResults(response: any): any[]`** — copy the same pattern from routes (handles response.data, response.results, or raw array).

**`async function pollLeadSource(leadSource, agentMap, queueId): Promise<number>`**
- Calls `fetchConvosoCallLogs` with params: `{ queue_id: queueId, list_id: leadSource.listId, call_type: "INBOUND", called_count: "0", include_recordings: "0" }`
- Extracts results via `extractConvosoResults`
- Enriches with `enrichWithTiers`
- Builds KPI via `buildKpiSummary(enriched, { agentMap, costPerLead: Number(leadSource.costPerLead) })`
- For each agent in `kpiResponse.per_agent` that has a non-null `agent_id`, creates an `AgentCallKpi` record via `prisma.agentCallKpi.create`:
  - `agentId`: from `agentKpi.agent_id`
  - `leadSourceId`: from `leadSource.id`
  - `convosoUserId`: from `agentKpi.user_id`
  - `totalCalls`: from `agentKpi.total_calls`
  - `avgCallLength`: from `agentKpi.avg_call_length`
  - `callsByTier`: from `agentKpi.calls_by_tier` (JSON)
  - `costPerSale`: from `agentKpi.cost_per_sale` (nullable)
  - `totalLeadCost`: from `agentKpi.total_lead_cost` (nullable)
  - `longestCall`: from `agentKpi.longest_call`
  - `conversionEligible`: from `agentKpi.conversion_eligible`
- Use `prisma.agentCallKpi.createMany({ data: records })` for bulk insert efficiency
- Returns count of records inserted
- Wrap entire function in try/catch — on error, log via `console.error(JSON.stringify({ event: "kpi_poll_lead_source_error", leadSourceId: leadSource.id, leadSourceName: leadSource.name, error: err.message, timestamp: new Date().toISOString() }))` and return 0

**`async function runPollCycle(): Promise<void>`**
- Check `process.env.CONVOSO_AUTH_TOKEN` — if falsy, log warning and return
- Get `queueId` from `process.env.CONVOSO_DEFAULT_QUEUE_ID` — if falsy, log warning and return
- Fetch all active lead sources with non-null listId: `prisma.leadSource.findMany({ where: { active: true, listId: { not: null } } })`
- Fetch all active agents for agentMap: `prisma.agent.findMany({ where: { active: true }, select: { id: true, name: true, email: true } })`
- Build agentMap: `new Map(agents.filter(a => a.email).map(a => [a.email!, { id: a.id, name: a.name }]))`
- Loop through lead sources sequentially (not Promise.all — avoid rate limiting Convoso)
- For each, call `pollLeadSource(leadSource, agentMap, queueId)`
- After all done, log: `console.log(JSON.stringify({ event: "kpi_poll_cycle_complete", leadSourcesPolled: leadSources.length, totalRecordsStored: totalCount, timestamp: new Date().toISOString() }))`

**`export function startConvosoKpiPoller(): void`**
- Check `process.env.CONVOSO_AUTH_TOKEN` — if falsy, log `console.log(JSON.stringify({ event: "kpi_poller_disabled", reason: "CONVOSO_AUTH_TOKEN not set", timestamp: new Date().toISOString() }))` and return (do NOT crash)
- Use `setInterval(runPollCycle, 10 * 60 * 1000)` for 10-minute interval
- Also call `runPollCycle()` immediately on startup (fire-and-forget, don't await — just `.catch(err => console.error(...))`)
- Log: `console.log(JSON.stringify({ event: "kpi_poller_started", intervalMinutes: 10, timestamp: new Date().toISOString() }))`

2. Modify `apps/ops-api/src/index.ts`:
- Add import at top: `import { startConvosoKpiPoller } from "./workers/convosoKpiPoller";`
- After the `server.listen(port, ...)` callback, add: `startConvosoKpiPoller();`
  </action>
  <verify>
    <automated>cd /c/Users/javer/Documents/Repositories/ai-calling-backend && npx tsc --noEmit -p apps/ops-api/tsconfig.json 2>&1 | head -20</automated>
  </verify>
  <done>Worker starts on server boot, polls every 10 min, stores AgentCallKpi records per agent per lead source, logs each cycle, handles errors per-lead-source gracefully, disabled without auth token</done>
</task>

</tasks>

<verification>
1. `npx prisma validate` passes (schema is valid)
2. TypeScript compiles without errors
3. Worker file exports `startConvosoKpiPoller` and is imported in index.ts
4. Migration SQL creates the table with correct columns, indexes, and foreign keys
</verification>

<success_criteria>
- AgentCallKpi model exists in Prisma schema with all required fields
- Manual migration SQL creates the table correctly
- Worker polls all active lead sources with listId every 10 minutes
- Each agent's KPI is stored as a snapshot row (not upserted — historical tracking)
- Errors per lead source are caught and logged without stopping the cycle
- Worker is no-op when CONVOSO_AUTH_TOKEN is missing
- CONVOSO_DEFAULT_QUEUE_ID documented in .env.example
- Server boots and registers the poller after listen
</success_criteria>

<output>
After completion, create `.planning/quick/260317-dxw-cron-worker-polling-convoso-every-10-min/260317-dxw-SUMMARY.md`
</output>
