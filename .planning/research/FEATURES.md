# Feature Landscape

**Domain:** Sales operations platform — insurance sales, payroll, chargebacks, agent KPIs
**Milestone:** v1.2 Platform Polish & Integration
**Researched:** 2026-03-18

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|-------------|-------|
| Custom date range CSV exports | Every ops dashboard since 2020 has date pickers on exports. Current system only offers "week/month/quarter" presets — users will ask for custom ranges immediately | Medium | All 6 dashboards, ops-api routes | Client-side CSV generation already exists in payroll (`exportCSV`, `exportDetailedCSV`). Need shared DateRangePicker component in @ops/ui, then wire to each dashboard. API needs `startDate`/`endDate` query params on data endpoints |
| Payroll paid/unpaid toggle (both directions) | Payroll staff need to undo mistakes. One-way toggle is a daily friction point — no recovery path for accidental marks | Low | Payroll dashboard, ops-api payroll routes | Toggle already works one direction. Add reverse mutation with audit log. Guard against toggling within FINALIZED periods. Standard pattern: toggle button with confirmation modal for un-paying |
| Edit button per sale in payroll view | Payroll staff see errors but must leave context to fix them. Inline editing is standard in payroll tools (Gusto, Rippling, ADP) | Medium | Payroll dashboard, existing sale edit request API (`SaleEditRequest` model) | Reuse existing sale edit request flow. Modal overlay with editable fields. Must recalculate commission on save via `upsertPayrollEntryForSale()` |
| Chargeback alerts in payroll | Chargebacks directly affect agent pay. Payroll staff need visibility without switching to CS dashboard. In insurance ops, chargebacks always surface in payroll views | High | `ChargebackSubmission` model, payroll dashboard, Socket.IO, new PayrollAlert DB model | Alert pipeline: chargeback created -> alert record -> Socket.IO event -> payroll banner with approve/clear workflow. This is the core v1.2 value proposition |
| Fix AI config "INP not defined" error | Broken feature = broken trust. Bug fixes are always table stakes | Low | Owner dashboard AI tab | Missing style constant (`INP` for input CSSProperties). All dashboards use inline style constants — this one was missed. Inspect, define, done |
| Remove commission column from agent tracker | User-requested removal. Column creates confusion — commission details live in payroll, not manager view | Low | Manager dashboard agent tracker component | Pure UI removal. Delete column from table header and row rendering |
| Bonus/fronted/hold off sale rows, keep on agent card header | Declutters per-sale view. These are agent-level aggregates, not per-sale data. Showing per-row implies sale-specific values, which misleads payroll staff | Low | Payroll dashboard pay card component | UI-only change. Remove three columns from sale row rendering. Agent card header already displays these aggregates |

## Differentiators

Features that set this product apart from generic sales dashboards.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|-------------|-------|
| AI call transcript auto-scoring | Existing `callAudit.ts` already does Claude-powered structured audits with tool-use. Auto-scoring means running this pipeline on every Convoso transcript automatically — turns manual QA (1-2% of calls) into 100% coverage. McKinsey cites 30-45% improvement from automated scoring | High | `ANTHROPIC_API_KEY`, Convoso ingestion, existing `callAudit.ts`, `ConvosoCallLog` model | Infrastructure exists: `auditWithClaude()`, `deriveScore()`, structured tool output. Need: auto-trigger when `ConvosoCallLog` gets a transcription, rate limiting (cost control), score surfacing in agent views. `deriveScore()` already maps outcomes to 0-100 |
| System prompt editor in owner dashboard | Owners tune AI evaluation without developer intervention. See bad audit -> adjust prompt -> re-audit. Competitive advantage over tools requiring vendor support for criteria changes | Medium | Owner dashboard (fix INP error first), `SalesBoardSetting` model (key: `ai_audit_system_prompt`), `reAuditCall()` | Storage exists — `SalesBoardSetting` already stores the prompt. Need: textarea in AI tab, GET/PUT endpoints, "Re-audit" button. Show `DEFAULT_AUDIT_PROMPT` as placeholder when no custom prompt saved |
| Pending terms + chargebacks wired to agent KPIs | Transforms CS data from isolated tracking into actionable performance metrics. Managers see which agents generate chargebacks. High-chargeback agents get flagged before they become expensive. Standard in insurance ops — "percentage pending" is a top-15 insurance KPI per industry benchmarks | High | New KPI aggregation tables, `Agent` model, `ChargebackSubmission`, `PendingTerm`, API endpoints | New model(s): `AgentRetentionKpi` with chargeback count, dollar total, pending term count, 30-day flag. Aggregate on chargeback/term creation and resolution. Display in agent tracker and owner KPI views |
| Real-time Socket.IO for CS submissions | CS reps working simultaneously see each other's submissions without refresh. Already have Socket.IO for sales cascade — extending to CS is incremental and creates feature parity | Medium | Socket.IO (exists in `socket.ts`), CS dashboard, ops-api CS endpoints | Pattern exists: `emitSaleChanged()`. Add `emitChargebackSubmitted()` and `emitPendingTermSubmitted()`. CS dashboard subscribes and appends to tracking tables. Use Socket.IO rooms to target only CS dashboard clients |
| "+10" indicator on enrollment fee for $124 bonus | Visual affordance making the bonus rule visible. Reduces "why did I get $124 extra?" questions from agents and "why is this bonus here?" from payroll | Low | Commission calculation logic, payroll pay card UI | Display-only. Check if enrollment fee >= `enrollFeeThreshold` during render. Show "+10" badge next to fee amount. Do not change calculation — just surface existing business rule |
| Rep checklist for pending term + chargeback round robin | Formalizes distribution workflow. Without it, reps cherry-pick or forget assignments. Round robin ensures even workload and accountability | Medium | `CsRepRoster` model (exists), `ChargebackSubmission.assignedTo`, `PendingTerm.assignedTo` | Auto-distribution already exists for chargebacks via `CsRepRoster`. Extend to pending terms. New piece: checklist view grouped by rep showing open assignments and completion status |
| Service agent sync between payroll and CS | Two separate registries (`ServiceAgent` for payroll, `CsRepRoster` for CS) create data drift. Sync means one source of truth | Medium | `ServiceAgent` model, `CsRepRoster` model | Recommend: add `serviceAgentId` FK to `CsRepRoster`, sync on ServiceAgent CRUD. Do not merge tables — destructive merge risks breaking existing `ServicePayrollEntry` relations |
| CS tracking: holder date records per date | Replaces vague "due within 7 days" with actual date-based contact records. Creates audit trail for insurance term management compliance | Medium | `PendingTerm` model, new `HolderDateRecord` model, CS dashboard tracking UI | New model: `HolderDateRecord { id, pendingTermId, contactDate, notes, recordedBy }`. Display as expandable sub-rows under pending terms. Remove "due within 7 days" filter |
| Storage alert with download + clearance | Proactive warning before database fills up. Railway/small plans have storage limits | Low | ops-api health endpoint, owner dashboard | Periodic check via `pg_database_size()`. Compare against threshold. Alert banner in owner dashboard. "Export and Clear" for old periods using existing CSV export |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Client-side commission recalculation | Commission logic must be server-authoritative. Client-side calc creates payroll discrepancies. Already noted as out of scope in PROJECT.md | Keep all commission in `apps/ops-api/src/services/payroll.ts`. UI previews via API, never calculates locally |
| Real-time collaborative sale editing | Multiple users editing same sale adds OT/CRDT complexity. Edit request queue handles concurrent access safely | Keep the edit request queue. Add optimistic locking (`updatedAt` check) if stale edits arise |
| Custom report builder | Drag-and-drop report builder is a product in itself (Metabase territory). CSV exports let power users use Excel | Offer comprehensive CSV exports with date range filtering. For custom reports, connect a BI tool to the database |
| Mobile-responsive redesign | Desktop is primary for internal ops staff at workstations. Mobile adds testing surface for minimal user value | Keep desktop-first inline CSSProperties. Mobile is a separate initiative if ever needed |
| Bulk chargeback auto-matching to sales | Matching chargebacks to original sales by member ID has high false-positive risk. Insurance member IDs can be reused, names have variants. Wrong matches create payroll errors | Keep manual matching. Surface "possible match" suggestions (search by member ID) but require human confirmation |
| Per-agent notification preferences | Over-engineering for <50 internal users. Everyone gets the same alerts | All alerts go to dashboard. Global email toggle later if needed |
| Automated clawback triggers from chargebacks | Auto-deducting from agent pay without human review is legally and operationally risky. Chargeback -> alert -> manual review -> clawback is the safe pipeline | Build the alert pipeline. Payroll staff decide whether to create a clawback from a chargeback alert. Never auto-deduct |

## Feature Dependencies

```
[Standalone — no dependencies]
  Fix AI config "INP not defined" error
  Remove commission column from agent tracker
  Bonus/fronted/hold off sale rows
  Payroll paid/unpaid toggle both directions
  "+10" enrollment fee indicator

[Cross-cutting infrastructure]
  Shared DateRangePicker in @ops/ui
    -> Custom date range CSV exports (all dashboards)

[Payroll integration chain]
  Edit button per sale in payroll
    -> Reuses existing SaleEditRequest API + upsertPayrollEntryForSale()

  ChargebackSubmission (exists)
    -> Chargeback alerts in payroll (new PayrollAlert model + Socket.IO)
      -> Pending terms + chargebacks -> agent KPIs (new aggregation tables)

[AI chain]
  Fix AI config "INP not defined"
    -> System prompt editor in owner dashboard
      -> AI call transcript auto-scoring (auto-trigger on transcript ingestion)

[CS workflow chain]
  Real-time Socket.IO for CS submissions
    (extends existing socket.ts pattern)

  HolderDateRecord model (new)
    -> CS tracking: holder date records per date
      -> Pending terms -> agent KPIs (needs complete term data)

  ServiceAgent sync
    -> CsRepRoster linked via FK
      -> Rep checklist for round robin (needs authoritative rep list)

[Monitoring]
  Storage alert -> owner dashboard (standalone, defer)
```

## MVP Recommendation

**Priority 1 — Bug fixes and quick UI wins (1-2 days):**
1. Fix AI config "INP not defined" error
2. Remove commission column from agent tracker
3. Bonus/fronted/hold off sale rows, keep on agent card header
4. Payroll paid/unpaid toggle both directions
5. "+10" enrollment fee indicator

**Priority 2 — Cross-cutting infrastructure (2-3 days):**
6. Shared DateRangePicker component in @ops/ui
7. Custom date range CSV exports across all dashboards
8. Real-time Socket.IO for CS submissions

**Priority 3 — Core v1.2 value: chargeback-to-payroll pipeline (3-4 days):**
9. Chargeback alerts in payroll (new PayrollAlert model, Socket.IO, approve/clear UX)
10. Edit button per sale in payroll
11. CS tracking: holder date records per date (new model, remove "due within 7 days")
12. Service agent sync between payroll and CS

**Priority 4 — AI and KPI integration (3-4 days):**
13. System prompt editor in owner dashboard
14. AI call transcript auto-scoring (auto-trigger pipeline)
15. Pending terms + chargebacks wired to agent KPIs (new aggregation tables)
16. Rep checklist for round robin

**Defer:**
- Storage alert: Low urgency unless Railway plan is near capacity
- Bulk chargeback auto-matching: Anti-feature, do not build

**Ordering rationale:** Bug fixes first because broken features erode trust. Date range picker is cross-cutting infrastructure that unblocks all dashboard exports. Chargeback-to-payroll is the core v1.2 value — makes CS data actionable for payroll staff. AI features build on the fixed owner dashboard. KPI integration comes last because it needs the most new schema and depends on chargeback and pending term data pipelines being complete.

## UX Conventions for Key Patterns

### Date Range Filtering
- Dual-calendar picker (start + end) positioned horizontally on desktop
- Preset buttons alongside custom range: "This Week", "Last 7 Days", "This Month", "Last 30 Days", "This Quarter"
- Text input fallback for precise dates (users going far back in time)
- Selected range displayed as pill/chip above the data table
- Export button inherits the active date range automatically

### KPI Dashboard Layout
- 5-7 KPIs maximum per role view (McKinsey recommendation)
- Top row: summary cards with large numbers + trend arrows (up/down vs prior period)
- Agent KPIs: chargeback count, chargeback dollar total, pending term count, composite quality score
- Color coding: green (improving), red (declining), gray (neutral)
- Drill-down: click a KPI card to see the underlying records

### Alert Pipeline UX
- Alert banner at top of payroll dashboard (not modal — non-blocking)
- Badge count on navigation tab showing unread alerts
- Alert list view: newest first, with chargeback details, agent name, dollar amount
- Actions per alert: "View Details", "Create Clawback", "Dismiss"
- Dismissed alerts move to a "Cleared" section, not deleted (audit trail)

### AI-Assisted Scoring Display
- Score shown as 0-100 with color band (red <40, yellow 40-70, green >70)
- Expandable card showing issues, wins, missed opportunities
- Manager summary visible without expanding (the "10-second read")
- "Re-audit" button for when prompt changes need to be tested

## Sources

- [Sales Performance Dashboard Guide (Everstage)](https://www.everstage.com/sales-performance/sales-performance-dashboard) — KPI dashboard patterns
- [Date Picker Design (UX Collective)](https://uxdesign.cc/date-picker-design-5c5ef8f35286) — Date range picker UX
- [Dashboard Design UX Patterns (Pencil & Paper)](https://www.pencilandpaper.io/articles/ux-pattern-analysis-data-dashboards) — Dashboard best practices, "basic data etiquette" for exports
- [LLM-Powered Call Scoring (Insight7)](https://insight7.io/how-llm-powered-conversation-ai-is-changing-call-scoring/) — AI scoring patterns, 100% call coverage
- [Automating QA with LLM Call Scoring (Call Criteria)](https://callcriteria.com/how-to-automate-contact-center-quality-monitoring-building-llm-powered-call-scoring/) — LLM QA automation, calibration tools
- [Real-Time Dashboards with Socket.IO (OneUptime)](https://oneuptime.com/blog/post/2026-01-26-socketio-realtime-dashboards/view) — Socket.IO alert pipeline patterns
- [Insurance Agent Chargebacks (EverQuote)](https://learn.everquote.com/insurance-agent-chargebacks) — Chargeback workflow, commission clawback mechanics
- [Insurance KPIs (Plecto)](https://www.plecto.com/blog/insurance/insurance-kpis/) — "Percentage Pending" as top insurance KPI
- [Best AI Call Scoring Software 2026 (CloudTalk)](https://www.cloudtalk.io/blog/best-ai-call-scoring-software/) — AI scoring landscape, 30-45% improvement per McKinsey
- [Date-Input Form Fields (NN/g)](https://www.nngroup.com/articles/date-input/) — Authoritative UX research on date inputs
- Existing codebase: `callAudit.ts` (Claude audit pipeline), `socket.ts` (Socket.IO events), `schema.prisma` (all models), payroll dashboard `page.tsx` (CSV export pattern)
