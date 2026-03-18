# Phase 18: Platform Polish & Integration - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire isolated dashboard systems together: chargebacks flow to payroll alerts with clawback creation, pending terms + chargebacks aggregate into agent KPIs on owner dashboard, AI call scoring becomes visible/editable, all CSV exports gain date range filtering, and accumulated UX issues across manager/payroll dashboards are fixed. Service agents sync between payroll and CS via FK link.

</domain>

<decisions>
## Implementation Decisions

### Chargeback Alert Pipeline
- Chargebacks submitted in CS create alerts displayed in a **table above the current open week** in payroll dashboard
- **Approve action:** Payroll selects which unpaid week to apply the clawback to from a dropdown of the agent's unpaid periods. If 3 weeks are unpaid, all 3 appear as options. Selecting a week creates a clawback entry in that period.
- **Clear action:** Permanently dismisses the alert — no record kept, treated as false positive or already handled
- New `PayrollAlert` model needed (or similar) to persist alerts between CS submission and payroll action
- Socket.IO `alert:created` event so payroll dashboard auto-refreshes when new chargebacks are submitted

### Agent KPI Tables
- **Location:** Owner dashboard only — new KPI section with per-agent breakdown
- **Metrics:** Chargeback count, chargeback dollar total, pending term count — all within 30-day rolling window
- Data aggregated from ChargebackSubmission and PendingTerm tables, matched to agents

### Sale Parser (Manager Dashboard)
- Paste textarea **already exists** in the sale entry form — needs fixing, currently errors with "invalid enum APPROVED"
- Fix: Map parsed sale status values (e.g., "Approved", "SALE") to correct enum values the API accepts
- **Preview step:** After parsing, show parsed results in a confirmation card (like CS chargeback preview pattern), then populate form fields on confirm
- **Product matching:** Auto-match ALL products from parsed text to product list (fuzzy match). Pre-select matched products in multi-product form.
- **Core product rule:** Core product is NOT auto-selected by default — only selected if explicitly parsed from the text. Not every sale has a core product.
- **Lead source:** Move field to top of form, next to agent selector
- **State field:** Must be correctly populated from parsed address data (currently blank after parse)

### Permission Table
- **Model:** Role-level defaults + per-user overrides (both layers)
- Owner (OWNER_VIEW) can grant or revoke permissions individually per user
- **Hard-coded restrictions (cannot be overridden):**
  - Payroll access: SUPER_ADMIN only
  - User creation: SUPER_ADMIN only
- **Configurable create actions:** All entity creates — sales, chargebacks, pending terms, reps, agents, products, lead sources
- UI: Permission table in owner dashboard users section

### Rep Sync & Round Robin
- **Sync model:** FK link — keep both ServiceAgent and CsRepRoster tables, add `serviceAgentId` FK on CsRepRoster
- Creating a rep in one dashboard auto-creates in the other
- **Round robin:** Keep existing auto-assign behavior with editable dropdown before submission
- **Checklist:** Per-rep tracking showing assigned chargebacks + pending terms with completion status
- **Rep creation roles:** OWNER_VIEW + PAYROLL can create from either CS or payroll dashboard

### Date Range Exports
- Date range picker (from/to) on ALL CSV exports across all 6 dashboards
- Include relative presets: Last 7 days, Last 30 days, This month, Custom
- Extend existing `dateRange()` helper to accept `from`/`to` ISO params alongside preset ranges
- Shared `DateRangeFilter` component in `@ops/ui` — replaces current pill-button pattern

### Storage Monitoring
- Monitor PostgreSQL database size via `pg_database_size()`
- Alert in owner dashboard when near plan capacity
- Offer CSV download of data categories and clearance options for old records

### Payroll UX Fixes
- **Paid/unpaid toggle:** Works both directions (currently one-way to paid). Un-pay restricted to OPEN periods only per research flag P4.
- **Edit button:** Per sale record in payroll view — inline edit
- **Card cleanup:** Bonus, fronted, and hold fields removed from sale rows — only appear on agent card header
- **Enrollment indicator:** Small "+10" next to enrollment fee amount in sale row when qualifying for $124 enrollment bonus

### Manager Dashboard Cleanup
- Remove commission column from agent tracker
- Fix "INP not defined" error on owner dashboard AI config tab

### AI Visibility
- System prompt visible and editable in owner dashboard AI tab (currently hidden in prompt box)
- AI auto-scores call transcripts from Convoso with configurable daily budget cap
- Backend already fully built (callAudit.ts, auditQueue.ts) — primarily frontend exposure work

### Real-Time CS
- Same Socket.IO pattern as sales cascade — new `cs:changed` event
- CS tracking tables auto-refresh on new chargeback/pending term submissions

### Claude's Discretion
- Exact DateRangeFilter component styling (follow existing @ops/ui patterns)
- Storage alert threshold percentage
- KPI table layout and sorting on owner dashboard
- Permission table UI layout details
- How to handle edge cases in receipt parsing (missing fields, unusual formats)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Payroll & Commission
- `apps/ops-api/src/services/payroll.ts` — Commission calculation, period assignment, net amount formula, clawback handling
- `apps/payroll-dashboard/app/page.tsx` — EditableSaleRow component, paid/unpaid toggle, export patterns, pay card layout
- `prisma/schema.prisma` — PayrollPeriod, PayrollEntry, ServicePayrollEntry, Clawback models

### Chargeback & Pending Terms
- `apps/cs-dashboard/app/page.tsx` — Paste parsers (parseChargebackText, parsePendingTermsText), round robin assignment, rep roster management
- `apps/ops-api/src/routes/index.ts` — Chargeback/pending term CRUD routes, resolution workflow, CS rep roster routes
- `prisma/schema.prisma` — ChargebackSubmission (lines 478-509), PendingTerm (lines 521-560), CsRepRoster (lines 511-519)

### Sale Entry & Parser
- `apps/manager-dashboard/app/page.tsx` — Existing parseReceipt(), matchProduct(), sale entry form, agent tracker
- `apps/ops-api/src/routes/index.ts` — POST /sales route, sale schema validation

### AI & Call Auditing
- `apps/ops-api/src/services/callAudit.ts` — processCallRecording, auditTool structured output, reAuditCall
- `apps/ops-api/src/services/auditQueue.ts` — In-memory queue (needs DB-backing per research P1)
- `apps/owner-dashboard/app/page.tsx` — AI Config tab, users section

### Socket.IO
- `apps/ops-api/src/socket.ts` — emitSaleChanged pattern, emitAudit* events
- `packages/socket/src/useSocket.ts` — Client hook, DISCONNECT_BANNER, HIGHLIGHT_GLOW
- `packages/socket/src/types.ts` — SaleChangedPayload type

### Permissions & Auth
- `apps/ops-api/src/middleware/auth.ts` — requireAuth, requireRole, SUPER_ADMIN bypass
- `apps/owner-dashboard/app/page.tsx` — UserRow component, RoleCheckboxes component
- `packages/types/src/index.ts` — AppRole enum

### Shared UI
- `packages/ui/src/index.tsx` — PageShell, Badge, AnimatedNumber, StatCard, TabNav, Toast, style tokens
- `packages/utils/src/index.ts` — formatDollar, formatDate

### Research
- `.planning/research/SUMMARY.md` — Key findings and pitfalls
- `.planning/research/PITFALLS.md` — P1 (audit queue), P2 (chargeback matching), P4 (toggle lifecycle), P5 (agent sync)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `parseReceipt()` in manager-dashboard — existing sale parser to fix/extend
- `matchProduct()` — fuzzy product name matching, reusable for auto-match
- `parseChargebackText()` / `parsePendingTermsText()` — CS parser patterns to reference
- `EditableSaleRow` in payroll-dashboard — inline edit pattern already built
- `dateRange()` helper in routes — extend for custom from/to support
- `@ops/ui` components: StatCard (for KPIs), TabNav, Badge, AnimatedNumber, Toast
- `useSocket` hook — extend with new event types (cs:changed, alert:created)
- `SalesBoardSetting` — existing key-value settings store for permissions config

### Established Patterns
- Client-side CSV: `filterByRange` → build rows → `Blob + anchor.click()`
- Socket.IO cascade: emit on server → `useSocket` listener → highlight with HIGHLIGHT_GLOW
- Resolution workflow: `resolvedAt/resolvedBy/resolutionNote/resolutionType` columns
- Settings storage: `SalesBoardSetting` upsert with string keys
- Inline edit: `useState(false)` for edit mode, colSpan expansion
- Zod validation: `zodErr()` wrapper on every safeParse failure
- Audit trail: `logAudit()` on sensitive mutations

### Integration Points
- New `PayrollAlert` Prisma model → routes → Socket.IO event → payroll dashboard table
- `CsRepRoster.serviceAgentId` FK → Prisma migration → sync logic in create/update routes
- `dateRange()` extension → all export endpoints → new DateRangeFilter component in @ops/ui
- Permission overrides → new DB table or SalesBoardSetting entries → requireRole middleware enhancement
- Agent KPI aggregation → new owner dashboard API endpoint → StatCard/table display

</code_context>

<specifics>
## Specific Ideas

- Chargeback alert table renders **above the current open week** in payroll — not in a separate tab or modal
- Approve action presents a **dropdown of the agent's unpaid periods** — payroll picks which week gets the clawback
- Receipt parser already exists and just needs fixing — the "invalid enum APPROVED" is the key bug, plus state field not populating
- Core product selection is opt-in only — never auto-selected, only when explicitly parsed from receipt text
- Existing round robin auto-assign behavior stays — just add editable dropdown before submission and per-rep tracking checklist
- Payroll un-pay must respect period lifecycle — only allowed on OPEN periods

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-platform-polish-integration*
*Context gathered: 2026-03-18*
