# Phase 29: Dashboard Fixes & Cost Tracking - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix premium display bug, lead source form missing buffer field, Convoso data flow mismatch (poller writes to wrong table), cost tracking visibility in tracker/owner dashboard, manager config products becomes read-only, and new CS resolved log audit tab for owners. All 14 v1.7 requirements in a single phase.

</domain>

<decisions>
## Implementation Decisions

### Bug Fixes
- **D-01:** Premium column in ManagerSales.tsx line 422 must sum core + addon premiums per row, matching the card-level total logic at lines 388-392
- **D-02:** Lead source create form in ManagerConfig.tsx must add a Buffer (seconds) number input field matching the edit form
- **D-03:** Lead source POST API in agents.ts must add `callBufferSeconds: z.number().int().min(0).optional()` to the Zod schema

### Manager Config Products
- **D-04:** Products section in ManagerConfig.tsx becomes read-only — remove add/edit/delete buttons and form
- **D-05:** Read-only view shows a simplified table: Product Name | Type (CORE/ADDON/AD_D) | Commission Rate | Bundle Config

### Convoso Data Flow Repair
- **D-06:** The KPI poller (convosoKpiPoller.ts) must write individual call records to the ConvosoCallLog table, not just AgentCallKpi snapshots
- **D-07:** Deduplication uses the `newRaw` array (post-dedup filter from ProcessedConvosoCall table) to avoid creating duplicates across poll cycles
- **D-08:** Keep AgentCallKpi writes as-is (parallel snapshot) — do not deprecate

### Cost Tracking Display
- **D-09:** Convoso not configured (no auth token): show "—" in cost columns (existing behavior)
- **D-10:** Convoso configured but no data: show "$0.00" for lead spend, "—" for cost per sale
- **D-11:** Agent with calls but zero sales: show total lead spend amount, "—" for cost per sale (avoid divide-by-zero)
- **D-12:** Agent with zero calls: show "$0.00" for lead spend, "—" for cost per sale

### CS Resolved Log
- **D-13:** Unified table combining resolved chargebacks and pending terms with a filterable "Type" column
- **D-14:** Columns: Type | Agent | Member | Resolution Date | Resolved By | Resolution Note | Original Amount
- **D-15:** Sorted by resolution date (most recent first)
- **D-16:** Notes displayed inline in table cell (truncated with expand-on-click if long)
- **D-17:** Tab visible only to OWNER_VIEW and SUPER_ADMIN roles (not CUSTOMER_SERVICE)
- **D-18:** Filterable by type (chargeback/pending term), date range, and agent
- **D-19:** Static audit view — no Socket.IO real-time updates needed

### Claude's Discretion
- Exact implementation of ConvosoCallLog field mapping from Convoso API response
- How to handle Convoso API field name verification (call_date vs start_time)
- CS Resolved Log API endpoint design (single unified endpoint vs two separate fetches)
- Notes truncation threshold and expand interaction

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Bug fix targets
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` — Line 422: premium column per-row display (FIX-01)
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerConfig.tsx` — Lead source create form and Products section (FIX-02, CFG-01, CFG-02)
- `apps/ops-api/src/routes/agents.ts` — Lines 75-87: lead source POST Zod schema (FIX-03)

### Convoso data flow
- `apps/ops-api/src/workers/convosoKpiPoller.ts` — KPI poller that needs ConvosoCallLog writes (DATA-01, DATA-02)
- `apps/ops-api/src/routes/sales.ts` — Lines 539-595: tracker/summary endpoint that reads ConvosoCallLog (DATA-03, DATA-04, DATA-05)
- `apps/ops-api/src/services/convosoCallLogs.ts` — Convoso API fetch service
- `prisma/schema.prisma` — ConvosoCallLog model (line ~457), AgentCallKpi model (line ~493)

### Cost tracking display
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx` — Manager tracker tab with cost columns
- `apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx` — Owner leaderboard with cost per sale

### CS Resolved Log
- `apps/ops-dashboard/app/(dashboard)/cs/` — Existing CS dashboard tab structure and role gating pattern
- `apps/ops-api/src/routes/cs-reps.ts` — Existing CS API routes pattern
- `prisma/schema.prisma` — ChargebackSubmission and PendingTermSubmission models with resolution fields

### Research
- `.planning/research/SUMMARY.md` — Synthesized research findings
- `.planning/research/PITFALLS.md` — 11 pitfalls with prevention strategies
- `.planning/research/ARCHITECTURE.md` — Integration analysis and data flow diagrams

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ManagerConfig.tsx` Products section: existing CRUD that needs to become read-only (remove form, keep table)
- `ManagerConfig.tsx` edit form: already has `callBufferSeconds` field — copy pattern to create form
- `ManagerSales.tsx` card-level premium calculation (lines 388-392): addon summation pattern to reuse per-row
- `CSTracking.tsx`: existing CS tab component with role gating and table patterns
- `@ops/ui` DateRangeFilter: reusable for resolved log date filtering
- `formatDollar` from `@ops/utils`: used for all dollar displays

### Established Patterns
- Inline React.CSSProperties with dark glassmorphism theme constants (CARD, BTN, INP, etc.)
- Flat tracking tables without agent grouping
- Submit-only form validation
- `asyncHandler` wrapper on all Express routes
- Zod schema validation with `zodErr()` wrapper
- `logAudit()` for sensitive operations
- `requireRole("OWNER_VIEW", "SUPER_ADMIN")` for owner-only access

### Integration Points
- CS Resolved Log: new tab in CS dashboard section of ops-dashboard
- CS Resolved Log: new API endpoint in cs-reps.ts (or new route file)
- Convoso poller: modify existing worker to also write ConvosoCallLog records
- Tracker/summary endpoint: already reads ConvosoCallLog — no changes needed once data flows

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard approaches following established patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-dashboard-fixes-cost-tracking*
*Context gathered: 2026-03-25*
