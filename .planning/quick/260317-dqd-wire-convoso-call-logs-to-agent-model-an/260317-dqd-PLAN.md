---
phase: quick
plan: 260317-dqd
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/ops-api/src/services/convosoCallLogs.ts
  - apps/ops-api/src/routes/index.ts
autonomous: true
requirements: [AGENT-MATCH, COST-PER-SALE, AUTO-TAG-AUDIT]
must_haves:
  truths:
    - "KPI per_agent output only includes calls from recognized agents (agent.email matches Convoso user_id)"
    - "Unrecognized user_ids appear in a separate unmatched bucket in KPI response"
    - "Each AgentKpi includes agent_name from the Agent model"
    - "Each AgentKpi includes cost_per_sale and total_lead_cost derived from LeadSource.costPerLead"
    - "When a sale is created, matching CallAudit records are tagged with sale linkage"
  artifacts:
    - path: "apps/ops-api/src/services/convosoCallLogs.ts"
      provides: "Agent-matched KPI aggregation with cost metrics"
    - path: "apps/ops-api/src/routes/index.ts"
      provides: "Updated /kpi route with agent+leadSource DB lookups, sale creation auto-tag hook"
  key_links:
    - from: "apps/ops-api/src/routes/index.ts (GET /call-logs/kpi)"
      to: "prisma.agent.findMany + prisma.leadSource.findFirst"
      via: "DB queries before calling buildKpiSummary"
      pattern: "prisma\\.agent\\.findMany|prisma\\.leadSource"
    - from: "apps/ops-api/src/routes/index.ts (POST /sales)"
      to: "prisma.callAudit.updateMany"
      via: "Post-creation hook matching agentId + date proximity"
      pattern: "callAudit\\.update"
---

<objective>
Wire Convoso call log KPI aggregation to the Agent and LeadSource database models, and auto-tag CallAudit records when a matching sale is created.

Purpose: Currently the KPI endpoint returns raw Convoso user_ids with no connection to internal Agent records, no cost metrics, and no sale-audit linkage. This bridges the gap so managers see agent names, cost-per-sale data, and automatic audit tagging.

Output: Updated convosoCallLogs service with agent-aware KPI types, updated /kpi route with DB lookups, updated POST /sales with auto-tag hook.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/ops-api/src/services/convosoCallLogs.ts
@apps/ops-api/src/routes/index.ts
@prisma/schema.prisma

<interfaces>
<!-- Key models from Prisma schema -->

Agent model fields: id, name, email (CRM User ID / Convoso user_id), extension, active
  - agent.email stores the Convoso user_id string
  - Relations: sales, audits, payrollEntries, clawbacks, convosoCallLogs

LeadSource model fields: id, name, listId, costPerLead (Decimal 10,2), active, callBufferSeconds, effectiveDate
  - listId maps to Convoso list_id query param

CallAudit model fields: id, agentId, callDate, score, status, coachingNotes, reviewerUserId, recordingUrl, callOutcome, callDurationEstimate, issues, wins, missedOpportunities, suggestedCoaching, managerSummary
  - Has relation to ConvosoCallLog via ConvosoCallLog.callAuditId
  - No phone_number field exists -- matching to sales must use agentId + date or recordingUrl

Sale model relevant fields: id, agentId, memberId, saleDate, recordingUrl, convosoLeadId, callDuration, callDateTime

Existing KPI types in convosoCallLogs.ts:
  - AgentKpi: { user_id, total_calls, avg_call_length, calls_by_tier, conversion_eligible, longest_call }
  - KpiResponse: { summary, per_agent, results }
  - buildKpiSummary(records: EnrichedCallLog[]): KpiResponse -- groups by user_id, no DB awareness

Route patterns:
  - GET /call-logs/kpi: calls buildKpiSummary(enriched), returns { success, ...kpiResponse }
  - POST /sales: creates sale, upserts payroll, emits socket event, returns 201
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend KPI service and route with agent matching and cost-per-sale</name>
  <files>apps/ops-api/src/services/convosoCallLogs.ts, apps/ops-api/src/routes/index.ts</files>
  <action>
1. In convosoCallLogs.ts, update the AgentKpi interface to add:
   - agent_name: string | null (null for unmatched)
   - agent_id: string | null (internal Agent.id, null for unmatched)
   - cost_per_sale: number | null (null when no LeadSource match or zero conversion_eligible)
   - total_lead_cost: number | null

2. Update KpiResponse interface to add:
   - unmatched: AgentKpi[] (calls from unrecognized user_ids)

3. Refactor buildKpiSummary to accept an options object as second parameter:
   ```typescript
   interface KpiBuildOptions {
     agentMap?: Map<string, { id: string; name: string }>; // email -> agent
     costPerLead?: number; // from LeadSource
   }
   export function buildKpiSummary(records: EnrichedCallLog[], opts?: KpiBuildOptions): KpiResponse
   ```
   - After building the per-agent map by user_id, split into matched vs unmatched:
     - If opts.agentMap exists, check if user_id key exists in agentMap
     - Matched agents: populate agent_name and agent_id from agentMap, go into per_agent
     - Unmatched agents: agent_name=null, agent_id=null, go into unmatched array
     - If opts.agentMap is undefined (backward compat), all go into per_agent with null agent_name/agent_id
   - For cost metrics on each AgentKpi:
     - If opts.costPerLead is defined and > 0:
       - total_lead_cost = total_calls * costPerLead
       - conversion_eligible_count = tierCounts.engaged + tierCounts.deep
       - cost_per_sale = conversion_eligible_count > 0 ? total_lead_cost / conversion_eligible_count : null
     - Otherwise: cost_per_sale = null, total_lead_cost = null
   - Round cost values to 2 decimal places

4. In routes/index.ts, update the GET /call-logs/kpi handler (around line 1786):
   - After parsing query params, before calling buildKpiSummary:
     - Fetch all active agents: `const agents = await prisma.agent.findMany({ where: { active: true }, select: { id: true, name: true, email: true } })`
     - Build agentMap: `new Map(agents.filter(a => a.email).map(a => [a.email!, { id: a.id, name: a.name }]))`
     - If list_id is provided, fetch LeadSource: `const leadSource = await prisma.leadSource.findFirst({ where: { listId: list_id } })`
     - Extract costPerLead as number (use Number(leadSource?.costPerLead) or 0)
   - Pass options to buildKpiSummary: `buildKpiSummary(enriched, { agentMap, costPerLead })`
   - Import prisma at top if not already imported: `import { prisma } from "@ops/db"`
  </action>
  <verify>
    <automated>cd /c/Users/javer/Documents/Repositories/ai-calling-backend && npx tsc --noEmit -p apps/ops-api/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - AgentKpi includes agent_name, agent_id, cost_per_sale, total_lead_cost fields
    - KpiResponse includes unmatched array
    - buildKpiSummary accepts optional agentMap and costPerLead, splits matched/unmatched
    - GET /call-logs/kpi fetches agents and lead source from DB, passes to buildKpiSummary
    - Backward compatible: calling buildKpiSummary without options still works
  </done>
</task>

<task type="auto">
  <name>Task 2: Auto-tag CallAudit on sale creation</name>
  <files>apps/ops-api/src/routes/index.ts</files>
  <action>
1. In the POST /sales handler (around line 282), after the socket emit try/catch block and before `res.status(201).json(sale)`:
   - Add a new try/catch block for auto-tagging call audits
   - The CallAudit model has no phone_number field, so matching uses agentId + date proximity + recordingUrl:
     - Query: find CallAudit records where:
       - agentId matches sale.agentId
       - callDate is within +/- 1 day of sale.saleDate (to handle timezone differences)
       - status is "pending" or "new" (not already reviewed/tagged)
     - If sale.recordingUrl is set, also try matching by recordingUrl (exact match)
   - For each matching CallAudit, update:
     - status to "sale_matched"
     - Add to coachingNotes (append): "Auto-tagged: sale {sale.id} created on {date}"
   - Use prisma.callAudit.updateMany for efficiency:
     ```typescript
     await prisma.callAudit.updateMany({
       where: {
         agentId: sale.agentId,
         callDate: {
           gte: new Date(sale.saleDate.getTime() - 86400000),
           lte: new Date(sale.saleDate.getTime() + 86400000),
         },
         status: { in: ["pending", "new"] },
       },
       data: {
         status: "sale_matched",
       },
     });
     ```
   - Wrap in try/catch, log errors via console.error (non-fatal, same pattern as payroll upsert error handling on line 320)
   - Log the auto-tag event: `console.log(JSON.stringify({ event: "call_audit_auto_tagged", saleId: sale.id, agentId: sale.agentId }))`

2. If sale.recordingUrl is also set, do a second updateMany matching by recordingUrl (catches cross-agent audit records with same recording):
     ```typescript
     if (sale.recordingUrl) {
       await prisma.callAudit.updateMany({
         where: {
           recordingUrl: sale.recordingUrl,
           status: { in: ["pending", "new"] },
         },
         data: { status: "sale_matched" },
       });
     }
     ```
  </action>
  <verify>
    <automated>cd /c/Users/javer/Documents/Repositories/ai-calling-backend && npx tsc --noEmit -p apps/ops-api/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - POST /sales handler auto-tags CallAudit records after sale creation
    - Matching by agentId + callDate proximity (1 day window)
    - Secondary match by recordingUrl when available
    - Non-fatal: errors logged but do not block sale creation response
    - Matched audits get status "sale_matched"
  </done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors: `npx tsc --noEmit -p apps/ops-api/tsconfig.json`
- GET /call-logs/kpi response includes agent_name, cost_per_sale, unmatched fields
- POST /sales triggers CallAudit auto-tag (verify via DB query after test sale creation)
</verification>

<success_criteria>
- KPI endpoint returns per_agent with agent_name populated for recognized agents and unmatched bucket for unknown user_ids
- Cost metrics (cost_per_sale, total_lead_cost) calculated when list_id maps to a LeadSource with costPerLead
- Sale creation auto-tags pending CallAudit records by agentId + date proximity
- All changes are backward compatible (no breaking changes to existing API consumers)
</success_criteria>

<output>
After completion, create `.planning/quick/260317-dqd-wire-convoso-call-logs-to-agent-model-an/260317-dqd-SUMMARY.md`
</output>
