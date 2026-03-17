---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/ops-api/src/services/convosoCallLogs.ts
  - apps/ops-api/src/routes/index.ts
  - apps/ops-api/.env.example
autonomous: true
must_haves:
  truths:
    - "GET /api/call-logs returns Convoso call log data filtered by queue_id and list_id"
    - "GET /api/call-logs/kpi returns enriched data with tier tags, summary, and per-agent breakdown"
    - "Missing queue_id or list_id returns 400"
    - "Null call_length values are handled safely (tagged as live tier, no crashes)"
    - "min_call_length and max_call_length query params filter results by call_length seconds"
    - "tier query param filters to matching tier only"
    - "Missing CONVOSO_AUTH_TOKEN returns 500 with clear error"
  artifacts:
    - path: "apps/ops-api/src/services/convosoCallLogs.ts"
      provides: "Convoso API client, tier classification, KPI aggregation logic"
    - path: "apps/ops-api/src/routes/index.ts"
      provides: "GET /api/call-logs and GET /api/call-logs/kpi endpoints"
    - path: "apps/ops-api/.env.example"
      provides: "CONVOSO_AUTH_TOKEN placeholder"
  key_links:
    - from: "apps/ops-api/src/routes/index.ts"
      to: "apps/ops-api/src/services/convosoCallLogs.ts"
      via: "import { fetchConvosoCallLogs, classifyTier, buildKpiSummary }"
      pattern: "import.*convosoCallLogs"
    - from: "apps/ops-api/src/services/convosoCallLogs.ts"
      to: "https://api.convoso.com/v1/log/retrieve"
      via: "fetch with Authorization header from CONVOSO_AUTH_TOKEN env"
      pattern: "api\\.convoso\\.com"
---

<objective>
Add Convoso call log API integration with KPI screening to the ops-api.

Purpose: Enable fetching agent call logs from Convoso with call length tier classification and per-agent KPI summaries for performance screening.
Output: Two new API endpoints (GET /api/call-logs and GET /api/call-logs/kpi) backed by a dedicated service module.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@apps/ops-api/src/routes/index.ts
@apps/ops-api/src/services/reporting.ts
@apps/ops-api/.env.example
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Convoso call log service module</name>
  <files>apps/ops-api/src/services/convosoCallLogs.ts, apps/ops-api/.env.example</files>
  <action>
Create `apps/ops-api/src/services/convosoCallLogs.ts` with the following exports:

1. **Type definitions:**
   - `CallLengthTier = "live" | "short" | "contacted" | "engaged" | "deep"`
   - `ConvosoCallLog` — shape matching Convoso API response records (id, user_id, call_length, status, phone_number, etc. — keep it loose with `Record<string, unknown>` base extended with known fields: `call_length: number | null`, `user_id: string | number | null`)
   - `EnrichedCallLog` — extends ConvosoCallLog with `call_length_tier: CallLengthTier`
   - `KpiSummary` — `{ total_calls: number, avg_call_length: number, live_call_count: number, breakdown_by_tier: Record<CallLengthTier, number> }`
   - `AgentKpi` — `{ user_id: string, total_calls: number, avg_call_length: number, calls_by_tier: Record<CallLengthTier, number>, conversion_eligible: boolean, longest_call: number }`
   - `KpiResponse` — `{ summary: KpiSummary, per_agent: AgentKpi[], results: EnrichedCallLog[] }`

2. **`classifyTier(callLength: number | null): CallLengthTier`** — Pure function:
   - `null` -> `"live"`
   - `0-29` -> `"short"`
   - `30-119` -> `"contacted"`
   - `120-299` -> `"engaged"`
   - `300+` -> `"deep"`

3. **`fetchConvosoCallLogs(params: Record<string, string>): Promise<any>`** — Calls `https://api.convoso.com/v1/log/retrieve` via fetch (node built-in). Reads `process.env.CONVOSO_AUTH_TOKEN`. Throws descriptive error if token missing. Passes params as URL query string. Sets `Authorization: Bearer {token}` header. Returns parsed JSON. On non-2xx response, throws with status and response body.

4. **`enrichWithTiers(records: ConvosoCallLog[]): EnrichedCallLog[]`** — Maps each record, adds `call_length_tier` via `classifyTier`. Handles null `call_length` safely.

5. **`filterByCallLength(records: EnrichedCallLog[], min?: number, max?: number): EnrichedCallLog[]`** — Filters records where `call_length` is not null and falls within [min, max]. Records with null `call_length` (live) are excluded when min/max filters are active (they have no measurable duration).

6. **`filterByTier(records: EnrichedCallLog[], tier: CallLengthTier): EnrichedCallLog[]`** — Filters to matching tier only.

7. **`buildKpiSummary(records: EnrichedCallLog[]): KpiResponse`** — Computes:
   - `summary.total_calls`: count of records
   - `summary.avg_call_length`: average of non-null call_length values (0 if all null)
   - `summary.live_call_count`: count where call_length is null
   - `summary.breakdown_by_tier`: count per tier
   - `per_agent`: group by `user_id`, for each agent compute `total_calls`, `avg_call_length` (non-null only), `calls_by_tier`, `conversion_eligible` (has at least one "engaged" or "deep" call), `longest_call` (max call_length, 0 if all null)
   - `results`: the enriched records array

Also add `CONVOSO_AUTH_TOKEN=your-convoso-auth-token-here` to `apps/ops-api/.env.example` (append after existing entries).
  </action>
  <verify>
    <automated>cd apps/ops-api && npx ts-node -e "
      const { classifyTier } = require('./src/services/convosoCallLogs');
      const assert = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };
      assert(classifyTier(null) === 'live', 'null should be live');
      assert(classifyTier(0) === 'short', '0 should be short');
      assert(classifyTier(29) === 'short', '29 should be short');
      assert(classifyTier(30) === 'contacted', '30 should be contacted');
      assert(classifyTier(119) === 'contacted', '119 should be contacted');
      assert(classifyTier(120) === 'engaged', '120 should be engaged');
      assert(classifyTier(299) === 'engaged', '299 should be engaged');
      assert(classifyTier(300) === 'deep', '300 should be deep');
      assert(classifyTier(999) === 'deep', '999 should be deep');
      console.log('All tier tests passed');
    "
    </automated>
  </verify>
  <done>Service module exports all functions with correct tier classification, KPI aggregation, and null-safe handling. CONVOSO_AUTH_TOKEN added to .env.example.</done>
</task>

<task type="auto">
  <name>Task 2: Add call-logs and call-logs/kpi routes to ops-api</name>
  <files>apps/ops-api/src/routes/index.ts</files>
  <action>
Add two new routes to the existing router in `apps/ops-api/src/routes/index.ts`. Import from the new service module. Place routes after the existing endpoint blocks, before the final `export default router`.

Follow existing patterns exactly: `asyncHandler` wrapper, Zod validation via `zodErr`, `requireAuth` middleware.

**Route 1: GET /call-logs**

```typescript
router.get("/call-logs", requireAuth, asyncHandler(async (req, res) => {
```

- Validate with Zod: `queue_id` (string, required), `list_id` (string, required). Return 400 via zodErr if missing.
- Optional query params with defaults: `call_type` (default "INBOUND"), `called_count` (default "0"), `include_recordings` (default "1").
- Optional pass-through params (include in Convoso request only if present): `id`, `lead_id`, `campaign_id`, `user_id`, `status`, `phone_number`, `number_dialed`, `first_name`, `last_name`, `start_time`, `end_time`, `limit`, `offset`, `order`.
- Optional filter params (NOT sent to Convoso): `min_call_length`, `max_call_length`, `tier`.
- Build params object for `fetchConvosoCallLogs`. Call it.
- Extract results array from Convoso response (check `response.data` or `response.results` — handle both common Convoso response shapes, fall back to empty array).
- Apply `enrichWithTiers` to results.
- If `min_call_length` or `max_call_length` provided, apply `filterByCallLength`.
- If `tier` provided, apply `filterByTier`.
- Log request via `console.log` (structured JSON): `{ event: "call_logs_fetch", queue_id, list_id, timestamp: new Date().toISOString(), total_results: enrichedResults.length, tier_breakdown }` where tier_breakdown counts each tier.
- Return `{ success: true, count: results.length, data: results }`.
- Wrap in try/catch: if `fetchConvosoCallLogs` throws, return 502 with `{ error: "Failed to fetch from Convoso", details: err.message }`. If CONVOSO_AUTH_TOKEN missing error, return 500 with `{ error: "Convoso integration not configured" }`.

**Route 2: GET /call-logs/kpi**

```typescript
router.get("/call-logs/kpi", requireAuth, asyncHandler(async (req, res) => {
```

- Same Zod validation as /call-logs (queue_id, list_id required).
- Same param building and Convoso fetch.
- Same optional defaults (call_type, called_count, include_recordings).
- Same pass-through params.
- Enrich with tiers.
- Apply min_call_length/max_call_length filter if provided.
- Apply tier filter if provided.
- Call `buildKpiSummary` on filtered results.
- Log request with same structure as /call-logs plus `summary` object.
- Return `{ success: true, ...kpiResponse }` (spread summary, per_agent, results).
- Same error handling pattern.

IMPORTANT: The /call-logs/kpi route MUST be registered BEFORE /call-logs to avoid Express matching /call-logs first and treating /kpi as a parameter. Alternatively, use exact path matching. Safest approach: register /call-logs/kpi first, then /call-logs.
  </action>
  <verify>
    <automated>cd apps/ops-api && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>Both routes registered, TypeScript compiles without errors, routes use requireAuth middleware, Zod validation returns 400 on missing queue_id/list_id, structured logging on each request, proper error handling for missing token (500) and Convoso API failures (502).</done>
</task>

</tasks>

<verification>
1. TypeScript compilation: `cd apps/ops-api && npx tsc --noEmit` passes
2. Tier classification: all boundary values correctly categorized (null=live, 0-29=short, 30-119=contacted, 120-299=engaged, 300+=deep)
3. .env.example contains CONVOSO_AUTH_TOKEN entry
4. Routes are protected by requireAuth middleware
5. Missing queue_id or list_id returns 400 with Zod error format
</verification>

<success_criteria>
- GET /api/call-logs proxies to Convoso with auth, returns enriched results with tier tags
- GET /api/call-logs/kpi returns summary object, per-agent KPI array, and enriched results
- Null call_length handled safely everywhere (classified as "live", no NaN or crashes)
- Input validation rejects requests missing queue_id or list_id
- CONVOSO_AUTH_TOKEN documented in .env.example
- All code follows existing patterns (asyncHandler, zodErr, requireAuth)
</success_criteria>

<output>
After completion, create `.planning/quick/260317-dgz-convoso-call-log-api-integration-with-kp/260317-dgz-SUMMARY.md`
</output>
