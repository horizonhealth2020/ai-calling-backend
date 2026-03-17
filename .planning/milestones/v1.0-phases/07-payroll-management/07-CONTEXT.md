# Phase 7: Payroll Management - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Payroll staff can manage pay periods through their full lifecycle (OPEN/PAID), view agent payroll cards with collapsible entries, enforce paid-status guards on edits, and export payroll data as CSV. Period status transitions and finalization guards are the core new capabilities. Card scrollability and export refinements improve the existing UI.

</domain>

<decisions>
## Implementation Decisions

### Period status workflow
- Two states only: OPEN and PAID (drop LOCKED/FINALIZED three-state model)
- OPEN = current active week, agents writing sales into it, payroll can edit entries
- PAID = agent has been paid, edits rejected by API until toggled back to OPEN
- Paid status is per-agent card, NOT per-period — payroll marks individual agent cards as paid within a period
- PAYROLL and SUPER_ADMIN roles only can mark paid / toggle unpaid
- Status is toggled manually by payroll, not triggered by date
- Payroll can toggle an agent back to OPEN/unpaid to make corrections, then re-mark as paid

### Finalization guards
- API rejects writes to entries for a paid agent with a clear error message ("Agent already marked paid")
- UI disables editing on paid agent cards (defense in depth — both API and UI enforce)
- Payroll can change agent back to unpaid to re-enable editing
- When a new sale lands in a period where the agent is already marked PAID, the payroll entry IS created but flagged visually as "arrived after paid"
- Managers create sales normally with no visibility into payment status — silent creation, flagged on payroll side only

### Card scrollability
- Collapsible entries: show first 5 entries by default, "Show N more" button to expand
- When expanded, card fully expands to show all entries (no internal scroll / max-height)
- Page scrolls naturally — no sticky period headers, no scroll-within-scroll
- Period view stacks agent cards vertically with natural page scroll

### CSV export
- Export any period data (OPEN or PAID) — not restricted to paid-only
- Keep existing client-side export approach (browser generates CSV from loaded data)
- Financial data only in CSV — no paid/unpaid status column
- Existing summary and detailed export formats are sufficient — no new export types needed

### Claude's Discretion
- Schema migration strategy for renaming OPEN/LOCKED/FINALIZED to OPEN/PAID (or repurposing existing enum values)
- Visual indicator design for entries that arrived after agent was marked paid
- "Show more" button styling and animation
- Per-agent paid/unpaid toggle button placement within AgentPayCard

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Payroll requirements
- `.planning/REQUIREMENTS.md` — PAYR-02 through PAYR-07 define the payroll management requirements
- `.planning/ROADMAP.md` §Phase 7 — Success criteria and dependency chain

### Existing payroll code
- `apps/payroll-dashboard/app/page.tsx` — Full payroll dashboard including AgentPayCard component, exports tab, period management UI
- `apps/ops-api/src/routes/index.ts` — Existing payroll period routes (GET /payroll/periods) and entry modification routes
- `apps/ops-api/src/services/payroll.ts` — Commission calculation, upsertPayrollEntryForSale, period assignment logic
- `prisma/schema.prisma` — PayrollPeriod model (OPEN/LOCKED/FINALIZED enum), PayrollEntry model with all financial fields

### Prior phase context
- `.planning/phases/10-sale-status-payroll-logic/10-CONTEXT.md` — AgentPayCard extraction, header financial summary, first-active-entry adjustment strategy
- `.planning/phases/06-dashboard-cascade/06-CONTEXT.md` — Socket.IO real-time updates to payroll cards, highlightedEntryIds pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AgentPayCard` component (payroll-dashboard page.tsx:776): Already built with entries display, editable bonus/fronted/hold, pending approval sections, onMarkPaid/onMarkUnpaid props
- `exportCSV` and `exportDetailedCSV` functions (payroll-dashboard page.tsx:1485-1561): Client-side CSV generation with week/month/quarter range filtering
- `PayrollPeriodStatus` enum (schema.prisma:19): Currently OPEN/LOCKED/FINALIZED — needs migration to OPEN/PAID
- Socket.IO `sale:changed` event pattern: Real-time updates already wired into payroll cards from Phase 6

### Established Patterns
- Per-agent operations within a period (mark paid/unpaid already has prop stubs in AgentPayCard)
- API guard pattern from Phase 10: finalized period checks in status change routes (routes/index.ts:1621)
- `asyncHandler` + Zod validation for all API routes
- Inline React.CSSProperties with dark glassmorphism theme

### Integration Points
- `GET /payroll/periods` route returns periods with entries — needs to include per-agent paid status
- PayrollEntry model may need a `paidAt` or similar field to track per-agent paid status within a period
- AgentPayCard already receives `onMarkPaid` and `onMarkUnpaid` callbacks — need to wire to real API calls
- Exports tab already functional — may need minor column adjustments but no major rework

</code_context>

<specifics>
## Specific Ideas

- OPEN means "the week agents are currently writing sales to — i.e., this week"
- LOCKED/PAID means "last week's sales, marked paid by payroll" — but payroll can still toggle back to unpaid for corrections
- The toggle between paid/unpaid is the key workflow — it's not a one-way finalization, it's a reversible lock per agent
- Late entries (sales landing after agent is paid) should be created and flagged, not blocked — nothing should be lost

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-payroll-management*
*Context gathered: 2026-03-16*
