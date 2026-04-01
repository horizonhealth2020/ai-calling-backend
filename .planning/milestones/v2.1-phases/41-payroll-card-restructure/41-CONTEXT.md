# Phase 41: Payroll Card Restructure - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Restructure payroll view from period-first to agent-first hierarchy. Each agent gets a top-level collapsible card containing week-by-week sections with sale grouping. Print template matches the new screen layout.

</domain>

<decisions>
## Implementation Decisions

### Card hierarchy flip
- **D-01:** Agent cards become top-level collapsible containers (replacing period cards as the primary grouping)
- **D-02:** Inside each agent card, individual period/week sections are rendered with their own commission strip, inputs, and sale rows
- **D-03:** All agents shown unless inactive — no period-based filtering of which agents appear

### Agent card header
- **D-04:** Header shows: agent name, sale count (most recent week only), Top Earner badge (most recent week only), financial summary strip
- **D-05:** Financial summary in header is read-only and reflects the currently selected week inside the card
- **D-06:** Selected week defaults to the current/most recent week; user clicks a week section inside to change which week the header summarizes
- **D-07:** Print and Paid buttons are NOT in the agent header — they live per-week inside

### Week sections inside agent card
- **D-08:** Each week section contains: date range label, period status badge (Open/Locked), full financial strip (commission, bonus/fronted/hold inputs, net), Print button, Paid/Unpaid button
- **D-09:** Essentially the current AgentPayCard header layout minus the agent name — replicated per week
- **D-10:** Bonus/fronted/hold inputs are editable per-week (same AgentPeriodAdjustment data, same EditableLabel behavior from Phase 40)
- **D-11:** Carryover hints ("Carried from prev week") display per-week where the carryover landed
- **D-12:** Mark Paid styling unchanged from current behavior
- **D-13:** All sale entries shown per week — no "Show more/Show less" toggle

### Collapse behavior
- **D-14:** Last 2 weeks (most recent periods) start expanded inside each agent card; older weeks start collapsed
- **D-15:** Any week can be collapsed/expanded by clicking its header
- **D-16:** Agent cards themselves are collapsible (click agent header to expand/collapse the entire card)

### Sale row table
- **D-17:** Keep current table layout: Agent | Status | Member | Product | Enroll Fee | Commission | Actions
- **D-18:** Agent column stays even though you're inside that agent's card (no column removal)

### Print template
- **D-19:** Print button is per-week inside each agent card (prints that agent's entries for that specific week)
- **D-20:** Print output must match the new screen layout structure

### Claude's Discretion
- Visual separation between week sections inside an agent card (divider style, spacing, background treatment)
- Agent card expand/collapse animation and transition
- How the "selected week" indicator looks in the agent header summary
- Overall styling refinements for the nested card-within-card structure

</decisions>

<specifics>
## Specific Ideas

- Agent cards should feel like the current period cards — same collapsible dropdown pattern, just at a different level
- The per-week strip is essentially the current agent card header (commission + inputs + net) relocated inside each week section
- The agent header financial summary is a convenience mirror of the selected week — not a new data source

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above and REQUIREMENTS.md (CARD-01, CARD-02).

### Prior phase context
- `.planning/phases/40-agent-level-adjustments-carryover-system/40-CONTEXT.md` — AgentPeriodAdjustment schema, EditableLabel, CarryoverHint, zero-sales agent cards. Phase 41 builds directly on this data shape.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PayrollPeriods.tsx` (lines 626-1107): Current `AgentPayCard` component — the per-week strip will reuse most of this layout
- `PayrollPeriods.tsx` (lines 1371-1472): `printAgentCards()` — needs restructuring to match new per-week print
- `EditableLabel` component: Already built in Phase 40 for bonus/hold label editing
- `CarryoverHint` display: Phase 40 subtle text below inputs for carryover source
- `AgentPeriodAdjustment` table and CRUD endpoints: Stable from Phase 40, no schema changes needed

### Established Patterns
- Period cards use `expandedPeriod` state (line 1138) for collapse — agent cards will use similar pattern
- `byAgent` Map grouping (lines 1651-1665) — can be promoted to top-level grouping
- Entry sorting by `useMemo` with stable member ID sort
- Inline React.CSSProperties styling throughout

### Integration Points
- **Payroll API**: `GET /payroll/periods` returns periods with entries and agentAdjustments — data shape supports agent-first grouping without API changes
- **Agent grouping logic**: Currently inside period loop; needs to move to top-level with periods nested inside
- **Period status controls**: Open/Locked toggle stays per-week inside agent cards
- **Socket.IO events**: Payroll real-time updates must still propagate correctly to the restructured view
- **handleHeaderBlur()**: Input save handler targets AgentPeriodAdjustment — works unchanged per-week

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 41-payroll-card-restructure*
*Context gathered: 2026-04-01*
