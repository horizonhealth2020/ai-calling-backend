# Project Research Summary

**Project:** Ops Platform v1.2 — Platform Polish & Integration
**Domain:** Sales operations platform — insurance sales, payroll, chargebacks, agent KPIs
**Researched:** 2026-03-18
**Confidence:** HIGH

## Executive Summary

v1.2 is an integration milestone, not a technology milestone. The platform already contains all the infrastructure it needs: Claude-powered call audits, Socket.IO for real-time events, Prisma models for chargebacks and pending terms, and client-side CSV export. The work is about connecting these isolated systems — CS data into payroll alerts, chargeback records into agent KPI tables, the audit pipeline into owner-visible scoring, and date range filtering across all six dashboards. Zero new npm packages are required. The only schema additions are one new `Alert` model and a handful of fields on `CsRepRoster`.

The recommended approach is to build in dependency order: cross-dashboard date range infrastructure first (used by every downstream feature), Socket.IO events for CS next (unblocks the alert pipeline), then the chargeback-to-payroll alert pipeline (the core v1.2 value proposition), followed by AI scoring visibility and agent KPI aggregation. Standalone UI fixes — the INP bug, commission column removal, payroll card layout, paid/unpaid toggle, and "+10" indicator — can be parallelized at any point since they carry no API dependencies. This ordering ensures each phase produces testable value and avoids blocking chains.

The top risks are financial safety and operational cost. The chargeback-to-payroll alert pipeline must use fuzzy matching with explicit manual confirmation — never auto-deduct payroll based on unreliable free-text member ID fields from paste-parsed carrier reports. The AI auto-scoring feature must ship with a daily budget cap and a DB-backed queue rather than the current in-memory array, which does not survive deploys and has no backpressure. The bidirectional payroll toggle must be restricted to OPEN periods only to avoid corrupting finalized payroll records.

## Key Findings

### Recommended Stack

v1.2 requires no new npm packages. Every feature maps directly to existing capabilities: `@anthropic-ai/sdk` for call auditing, `socket.io` for real-time events, Prisma for data persistence, Zod for validation, and native `<input type="date">` for the date range picker (avoiding CSS conflicts with the inline CSSProperties pattern). The only infrastructure change is one Prisma migration: a new `Alert` model and three fields added to `CsRepRoster`. See [STACK.md](.planning/research/STACK.md) for the full feature-by-feature analysis.

**Core technologies (no changes needed):**
- `@anthropic-ai/sdk` 0.78.0: AI call audit pipeline — integrated in `callAudit.ts`; system prompt stored in `SalesBoardSetting`
- `socket.io` 4.8.x: real-time cascade — extend existing pattern with `cs:changed` and `alert:created` events
- Prisma 5.20.x: ORM — add `Alert` model and `CsRepRoster` fields via a single migration
- Native `<input type="date">`: date range picker — no library; avoids inline CSSProperties conflicts
- `fs.statfs()` (Node 20.x built-in): disk monitoring — zero-dependency solution

### Expected Features

See [FEATURES.md](.planning/research/FEATURES.md) for the full feature table with complexity ratings and dependency mapping.

**Must have (table stakes):**
- Custom date range CSV exports — preset-only system creates immediate friction for ops staff
- Payroll paid/unpaid toggle (both directions) — one-way toggle has no recovery path for accidental marks
- Edit button per sale in payroll view — staff see errors but must leave context to correct them
- Chargeback alerts in payroll dashboard — the core v1.2 value; chargebacks directly affect agent pay
- Fix AI config "INP not defined" bug — broken tab erodes trust in the entire owner dashboard
- Remove commission column from agent tracker — user-requested; commission detail belongs in payroll only
- Bonus/fronted/hold off sale rows, keep on agent card header — declutters per-sale view

**Should have (differentiators):**
- AI call transcript auto-scoring — turns 1-2% manual QA into 100% call coverage using existing `callAudit.ts`
- System prompt editor in owner dashboard — owners tune AI evaluation without developer intervention
- Pending terms + chargebacks wired to agent KPIs — makes CS data actionable for managers and owners
- Real-time Socket.IO for CS submissions — feature parity with the existing sale cascade
- "+10" enrollment fee indicator — surfaces the existing $10 bonus rule inline on the payroll card
- Rep checklist for round-robin assignment — formalizes distribution, prevents cherry-picking
- Service agent sync between payroll and CS — single source of truth for rep lists
- CS tracking: holder date records per date — audit trail for insurance term management compliance

**Defer:**
- Storage alert with download/clearance — low urgency unless Railway plan is near capacity; build stats endpoint first, observe before alerting
- Bulk chargeback auto-matching to sales — anti-feature; false positives create payroll errors; keep manual matching with "possible match" suggestions only

### Architecture Approach

v1.2 adds an integration layer over the existing monorepo. Three new files are the only meaningful additions: `apps/ops-api/src/services/alerts.ts` (creates `Alert` records from domain events, emits `alert:created` via Socket.IO), `apps/ops-api/src/services/agentKpiAggregator.ts` (queries chargebacks and pending terms grouped by agent), and `packages/ui/src/components/DateRangeFilter.tsx` (shared date range picker with preset buttons and custom `from`/`to` ISO params). All other changes are route extensions, additions to existing dashboard pages, or new Socket.IO events in the existing `socket.ts`. See [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) for full data flow diagrams and schema additions.

**Major components:**
1. `AlertService` (ops-api/services) — creates `Alert` records from chargeback events; emits `alert:created` to payroll dashboard
2. `AgentKpiAggregator` (ops-api/services) — computes per-agent chargeback count, dollar total, and pending term count on read from existing tables
3. `DateRangeFilter` (`@ops/ui`) — shared date picker with presets; extends the `dateRange()` helper to accept `from`/`to` ISO strings alongside existing preset params
4. Updated `socket.ts` — adds `emitCSChanged` and `emitAlertCreated` following the existing `emitSaleChanged` pattern
5. Owner dashboard AI tab — system prompt editor, aggregate score view, score distribution; reads from existing `CallAudit` data via a new aggregation endpoint

### Critical Pitfalls

See [PITFALLS.md](.planning/research/PITFALLS.md) for all 15 pitfalls with phase assignments and detection strategies.

1. **AI scoring queue has no backpressure or persistence (P1)** — `auditQueue.ts` is an in-memory array; designed for manual one-off audits. Auto-scoring all Convoso transcripts will grow it unbounded and lose jobs on restart. Replace with a DB-backed queue using a `scoring_status` column on `ConvosoCallLog`. Must be done before enabling auto-scoring.

2. **Chargeback-to-payroll match creates phantom financial impact (P2)** — `ChargebackSubmission.memberId` is free-text from paste-parsed carrier reports, not a FK to `Sale.memberId`. Naive string matching produces false positives. Alerts must be informational-only with explicit payroll staff approval; never auto-deduct. Add a nullable `matchedSaleId` FK and match confidence score.

3. **Auto-scoring cost spiral (P11)** — Claude + Whisper fees at 200 calls/day run $15-30/day with no current budget controls. Ship a configurable daily budget cap and a minimum call duration filter with auto-scoring. Show estimated monthly cost in the owner dashboard. Never ship auto-scoring without these controls.

4. **Bidirectional toggle corrupts finalized periods (P4)** — Un-paying an entry in a LOCKED or FINALIZED period breaks `handleCommissionZeroing` logic and audit trail. Restrict PAID -> READY toggle to OPEN periods only; require an adjustment workflow for finalized periods.

5. **Service agent sync creates identity split (P5)** — `ServiceAgent` (payroll) and `CsRepRoster` (CS) have no shared key. Round robin assignment depends on a single authoritative rep list. Consolidate before building round robin: add `serviceAgentId` FK on `CsRepRoster`, or use `ServiceAgent` with an `isCsRep` flag.

## Implications for Roadmap

Based on combined research, a four-phase structure is recommended, with standalone UI fixes parallelizable throughout all phases.

### Phase 1: Foundation — Bug Fixes, UI Cleanup, and Date Range Infrastructure

**Rationale:** Bug fixes restore trust and are the lowest-risk changes with immediate user impact. The shared `DateRangeFilter` component is horizontal infrastructure consumed by every downstream phase — export endpoints, KPI tables, and AI summary views all need date range support. Building it first prevents each later phase from solving the same problem independently.

**Delivers:** Working owner dashboard AI tab (INP fix), clean manager agent tracker (commission column removed), correct payroll card layout (bonus/fronted/hold moved to header), bidirectional paid toggle restricted to OPEN periods, "+10" enrollment fee indicator, shared `DateRangeFilter` in `@ops/ui`, extended `dateRange()` helper with `from`/`to` params, custom date range CSV exports wired across all dashboards.

**Addresses:** Fix AI config INP error, remove commission column, bonus/fronted/hold layout, paid/unpaid toggle, "+10" indicator, custom date range exports (all table stakes)

**Avoids:** P4 (period corruption) by restricting toggle to OPEN periods from day one; P6 (timezone inconsistency) by centralizing date boundary logic in a shared utility; P13 (CSV memory pressure) by adding a maximum selectable date range

**Research flag:** Standard patterns — no phase research needed. All changes are frontend-only or minimal API extensions with well-documented patterns in the codebase.

---

### Phase 2: CS Real-Time and Chargeback-Payroll Alert Pipeline

**Rationale:** Socket.IO events for CS are a small code change (one new emit function in `socket.ts`) that must exist before the alert pipeline can be built. The chargeback-to-payroll alert pipeline is the stated core value of v1.2 — it makes CS submissions visible to payroll staff without requiring a dashboard context switch. This phase also includes the edit-per-sale in payroll (reuses the existing `SaleEditRequest` API) and CS holder date records (new model, replaces the vague "due within 7 days" filter).

**Delivers:** Real-time CS dashboard (no manual refresh for concurrent users), chargeback alerts in payroll with Socket.IO badge notification, approve/clear alert workflow with audit trail, edit-per-sale in payroll routed through existing `handleSaleEditApproval`, holder date records per pending term.

**Addresses:** Chargeback alerts in payroll, edit button per sale, real-time Socket.IO for CS submissions, holder date records (table stakes + differentiators)

**Avoids:** P2 (phantom financial impact) by making all alerts informational-only with manual approval required; P7 (Socket.IO event explosion) by emitting one batch event per CS submission, not one per row; P9 (edit bypass) by routing payroll edits through the existing single edit path

**Research flag:** Standard patterns for Socket.IO and alert pipeline — both extend proven existing patterns. The chargeback match quality (P2) requires testing the proposed fuzzy matching against historical production data before shipping. Run this validation before Phase 2 deploys.

---

### Phase 3: Agent KPIs and Service Agent Sync

**Rationale:** Agent KPI aggregation requires the Phase 1 date range infrastructure (queries accept `from`/`to`). Service agent sync must be resolved before round robin assignment can be built — round robin needs a single authoritative rep list. These two features are grouped because they share the same architectural concern: consolidating distributed agent data into unified views.

**Delivers:** Per-agent chargeback count, dollar total, and pending term count in manager and owner dashboards (computed on read, not snapshot); `serviceAgentId` FK linking `CsRepRoster` to `ServiceAgent`; rep checklist with availability toggles and round-robin auto-assignment using DB transactions for concurrency safety.

**Addresses:** Pending terms + chargebacks to agent KPIs, service agent sync, rep checklist for round robin (differentiators)

**Avoids:** P3 (KPI double-counting) by separating call-performance KPIs (Convoso snapshots) from retention KPIs (live-computed on read, clearly labeled with date range and "as of" timestamp); P5 (identity split) by adding FK before building round robin; P10 (round robin concurrency) by using `SELECT ... FOR UPDATE` for atomic index increment

**Research flag:** Needs planning attention for agent matching strategy. `ChargebackSubmission.memberAgentId` may not map cleanly to `Agent.id` — the aggregator needs a defined matching strategy and an "Unmatched" fallback category before implementation begins. Validate against real data before committing to the schema.

---

### Phase 4: AI Scoring and Owner Visibility

**Rationale:** AI scoring builds on the fixed owner dashboard (Phase 1). The auto-scoring pipeline requires a DB-backed queue and cost controls to be designed before a single trigger is wired. This phase unlocks the highest-value differentiator (100% call coverage QA) but is the highest operational risk due to queue stability and API cost exposure.

**Delivers:** System prompt editor in owner dashboard with prompt version history, aggregate AI score view per agent with score trend, score distribution by call outcome, auto-scoring trigger on Convoso transcript ingestion (DB-backed queue, minimum call duration filter, configurable daily budget cap), "Re-audit" button for testing prompt changes against one existing transcript before saving.

**Addresses:** System prompt editor, AI call transcript auto-scoring (differentiators)

**Avoids:** P1 (queue memory/loss) by replacing in-memory array with DB-backed queue using `scoring_status` on `ConvosoCallLog`; P8 (prompt versioning) by creating a `prompt_version` field on `CallAudit` and an `AiPromptHistory` log in the same migration as the editor; P11 (cost spiral) by shipping budget cap and minimum duration filter as mandatory requirements alongside auto-scoring, never as follow-up work

**Research flag:** Needs phase research. The DB-backed queue design (polling interval, retry logic, concurrency control), the cost monitoring schema (`AiUsageLog`), and budget enforcement timing all need detailed design before implementation begins.

---

### Phase 5 (Optional): Storage Monitoring

**Rationale:** Low urgency. Defer unless Railway plan is approaching capacity. Build a stats endpoint first, observe actual growth for 1-2 weeks, then configure alert thresholds. Alert on growth rate, not absolute size, to avoid alert fatigue.

**Delivers:** `/admin/storage-stats` endpoint reporting per-table row counts and sizes via `pg_total_relation_size()`; optional growth-rate alert banner in owner dashboard.

**Avoids:** P12 (no baseline metrics) by requiring observation before alerting

**Research flag:** Skip if not prioritized. Uses standard PostgreSQL functions via `prisma.$queryRaw` — no new patterns needed.

---

### Phase Ordering Rationale

- **Date range first** — the only true cross-cutting dependency; every phase either exports CSV or queries with date filters; solving it once prevents per-phase reimplementation
- **CS Socket.IO events before alert pipeline** — the payroll alert pipeline listens on events that must exist first; this is a hard dependency, not a preference
- **Service agent sync before round robin** — round robin needs a single authoritative rep list; building the checklist first and syncing after produces throwaway code
- **AI scoring last** — highest operational risk (queue stability, billing exposure); isolating it to the final phase contains blast radius if a rollback is needed
- **UI-only fixes** (INP bug, commission column removal, card layout, toggle, "+10") are parallelizable with every phase; no API dependencies

### Research Flags

Phases needing deeper research during planning:
- **Phase 3 (Agent KPIs):** Agent matching strategy for `ChargebackSubmission.memberAgentId` to `Agent.id` must be validated against real production data before the schema is finalized
- **Phase 4 (AI Scoring):** DB-backed queue design, cost enforcement timing, and prompt versioning schema require design documents before any implementation begins

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** All changes are frontend-only or minimal API extensions with direct codebase precedents
- **Phase 2 (CS Alerts):** Alert pipeline follows the existing `emitSaleChanged` + `SaleEditRequest` patterns exactly
- **Phase 5 (Storage):** `pg_total_relation_size()` is standard PostgreSQL; no external dependencies or novel patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All features verified against actual codebase files; confirmed by reading `callAudit.ts`, `socket.ts`, `schema.prisma`, and `routes/index.ts` directly; zero new packages required |
| Features | HIGH | Table stakes derived from explicit codebase gaps and user requests in PROJECT.md; differentiators validated against insurance ops domain sources |
| Architecture | HIGH | All patterns extend proven existing patterns; new service files follow the `payroll.ts` model; schema additions are minimal and well-scoped |
| Pitfalls | HIGH | All critical pitfalls confirmed by direct code inspection of `auditQueue.ts`, `payroll.ts`, `CsRepRoster` model, and `PayrollPeriod` lifecycle — not speculative |

**Overall confidence:** HIGH

### Gaps to Address

- **Chargeback match quality (P2):** Before Phase 2 ships, run the proposed fuzzy matching logic against historical production data to measure match rate. If match rate is below 70%, adjust the "match candidates" UI to surface more context for manual resolution.
- **"Storage monitoring" scope ambiguity:** The requirement does not specify whether this means database size, disk size, or recording storage volume. Clarify with stakeholders before Phase 5 planning. The `pg_database_size()` path is the most likely intent.
- **AI scoring per-agent display location:** The exact UI placement (agent tracker row, separate tab, card overlay) needs a design decision during Phase 3/4 planning; the data shape is clear but the surface is not.
- **`OWNER_VIEW` role for AI prompt write access:** `PUT /api/settings/ai-audit-prompt` currently requires MANAGER or SUPER_ADMIN. Extending write access to OWNER_VIEW is a one-line change but needs explicit confirmation that owners should be able to modify the prompt in production without MANAGER approval.

## Sources

### Primary (HIGH confidence)
- Codebase: `apps/ops-api/src/services/callAudit.ts`, `auditQueue.ts`, `payroll.ts` — AI pipeline, queue design, commission logic
- Codebase: `apps/ops-api/src/socket.ts` — Socket.IO event patterns
- Codebase: `apps/ops-api/src/routes/index.ts` — existing endpoints, `dateRange()` helper
- Codebase: `prisma/schema.prisma` — all current models and relations
- [Node.js fs.statfs docs](https://nodejs.org/api/fs.html#fsstatfspath-options-callback) — native disk monitoring API

### Secondary (MEDIUM confidence)
- [Insight7: LLM-Powered Call Scoring](https://insight7.io/how-llm-powered-conversation-ai-is-changing-call-scoring/) — AI scoring patterns, 100% call coverage value
- [Plecto: Insurance KPIs](https://www.plecto.com/blog/insurance/insurance-kpis/) — "Percentage Pending" as top insurance KPI
- [CloudTalk: Best AI Call Scoring Software 2026](https://www.cloudtalk.io/blog/best-ai-call-scoring-software/) — 30-45% improvement per McKinsey
- [EverQuote: Insurance Agent Chargebacks](https://learn.everquote.com/insurance-agent-chargebacks) — chargeback workflow, commission clawback mechanics
- [OneUptime: Socket.IO Real-Time Dashboards](https://oneuptime.com/blog/post/2026-01-26-socketio-realtime-dashboards/view) — alert pipeline patterns
- [Everstage: Sales Performance Dashboard Guide](https://www.everstage.com/sales-performance/sales-performance-dashboard) — KPI dashboard layout patterns
- [NN/g: Date-Input Form Fields](https://www.nngroup.com/articles/date-input/) — date range picker UX

### Tertiary (LOW confidence)
- [Anthropic SDK on npm](https://www.npmjs.com/package/@anthropic-ai/sdk) — v0.79.0 availability (minor patch, not required for v1.2)
- [check-disk-space on npm](https://www.npmjs.com/package/check-disk-space) — evaluated and rejected in favor of native Node 20 APIs

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
