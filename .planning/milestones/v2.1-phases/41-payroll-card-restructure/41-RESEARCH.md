# Phase 41: Payroll Card Restructure - Research

**Researched:** 2026-04-01
**Domain:** React UI restructuring (data regrouping, collapsible hierarchy, print templates)
**Confidence:** HIGH

## Summary

This phase is a pure frontend restructuring of `PayrollPeriods.tsx` (~2042 lines). The current hierarchy is Period (top-level collapsible) > Agent cards inside. The target is Agent (top-level collapsible) > Week sections inside, with per-week financial strips, inputs, print, and paid/unpaid controls. No API changes needed -- the existing `GET /payroll/periods` response already contains all data needed for agent-first grouping.

The core challenge is data regrouping: periods come from the API as the top-level entity, but the UI must present agents as top-level with periods nested inside. This requires building a `Map<agentName, Map<periodId, Entry[]>>` from the flat periods array. The existing `byAgent` Map (lines 1651-1665) is the starting point but currently lives inside the period loop -- it must be promoted to the top level with periods nested inside.

**Primary recommendation:** Extract the current `AgentPayCard` internals (financial strip, inputs, sale table) into a reusable `WeekSection` component. Create a new `AgentCard` component that wraps multiple `WeekSection` instances. Keep all existing handler functions in `PayrollPeriods` and pass them down.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Agent cards become top-level collapsible containers (replacing period cards as the primary grouping)
- **D-02:** Inside each agent card, individual period/week sections are rendered with their own commission strip, inputs, and sale rows
- **D-03:** All agents shown unless inactive -- no period-based filtering of which agents appear
- **D-04:** Header shows: agent name, sale count (most recent week only), Top Earner badge (most recent week only), financial summary strip
- **D-05:** Financial summary in header is read-only and reflects the currently selected week inside the card
- **D-06:** Selected week defaults to the current/most recent week; user clicks a week section inside to change which week the header summarizes
- **D-07:** Print and Paid buttons are NOT in the agent header -- they live per-week inside
- **D-08:** Each week section contains: date range label, period status badge (Open/Locked), full financial strip (commission, bonus/fronted/hold inputs, net), Print button, Paid/Unpaid button
- **D-09:** Essentially the current AgentPayCard header layout minus the agent name -- replicated per week
- **D-10:** Bonus/fronted/hold inputs are editable per-week (same AgentPeriodAdjustment data, same EditableLabel behavior from Phase 40)
- **D-11:** Carryover hints ("Carried from prev week") display per-week where the carryover landed
- **D-12:** Mark Paid styling unchanged from current behavior
- **D-13:** All sale entries shown per week -- no "Show more/Show less" toggle
- **D-14:** Last 2 weeks (most recent periods) start expanded inside each agent card; older weeks start collapsed
- **D-15:** Any week can be collapsed/expanded by clicking its header
- **D-16:** Agent cards themselves are collapsible (click agent header to expand/collapse the entire card)
- **D-17:** Keep current table layout: Agent | Status | Member | Product | Enroll Fee | Commission | Actions
- **D-18:** Agent column stays even though you're inside that agent's card (no column removal)
- **D-19:** Print button is per-week inside each agent card (prints that agent's entries for that specific week)
- **D-20:** Print output must match the new screen layout structure

### Claude's Discretion
- Visual separation between week sections inside an agent card (divider style, spacing, background treatment)
- Agent card expand/collapse animation and transition
- How the "selected week" indicator looks in the agent header summary
- Overall styling refinements for the nested card-within-card structure

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CARD-01 | Payroll view shows agent-level collapsible cards (one card per agent) | Data regrouping pattern (agent-first Map), AgentCard component with expand/collapse state, agent header with read-only summary |
| CARD-02 | Inside each agent card, week-by-week entries are separated for payroll processing | WeekSection component extracted from current AgentPayCard, per-week financial strip/inputs/print/paid controls, auto-expand last 2 weeks |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ (Next.js 15) | Component framework | Already in use |
| Next.js | 15 | App framework | Already in use |
| lucide-react | latest | Icons (ChevronDown, Printer, etc.) | Already imported |
| @ops/ui | workspace | Badge, AnimatedNumber, Button, Card, EmptyState | Already in use |
| @ops/auth/client | workspace | authFetch for API calls | Already in use |
| @ops/utils | workspace | formatDollar, formatDate | Already in use |

### Supporting
No new libraries needed. This is a pure restructuring of existing code using existing dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-built collapse | Radix Accordion | Adds dependency; project uses no component libraries -- stick with hand-built |
| CSS transitions for collapse | React Transition Group | Same -- project uses inline styles and CSS classes already present |

**Installation:** No new packages needed.

## Architecture Patterns

### Current vs Target Structure

**Current (Period-first):**
```
PayrollPeriods
  periods.map(period =>
    Card (period header, collapsible)
      byAgent.entries().map(agent =>
        AgentPayCard (header + financial strip + table)
      )
  )
```

**Target (Agent-first):**
```
PayrollPeriods
  agentMap.entries().map(agent =>
    AgentCard (agent header with selected-week summary, collapsible)
      agent.periods.map(period =>
        WeekSection (week header + financial strip + inputs + table + print + paid)
      )
  )
```

### Recommended Component Decomposition

```
PayrollPeriods.tsx
  AgentCard          -- top-level collapsible card per agent
    AgentHeader      -- agent name, badge, read-only financial summary of selected week
    WeekSection[]    -- one per period, extracted from current AgentPayCard
      WeekHeader     -- date range, status badge, collapse toggle
      FinancialStrip -- commission, bonus/fronted/hold inputs, net (from current AgentPayCard lines 809-916)
      SaleTable      -- reuses EditableSaleRow (from current lines 924-963)
      PendingApprovals -- reuses current approval request section (lines 996-1103)
```

### Pattern 1: Agent-First Data Regrouping

**What:** Transform period-first API data into agent-first view data using a two-level Map.
**When to use:** At the top of the render, as a useMemo computation.
**Example:**
```typescript
// Build agent-first grouping from period-first API data
const agentData = useMemo(() => {
  const map = new Map<string, {
    agentId: string;
    periods: {
      period: Period;
      entries: Entry[];
      adjustment?: AgentAdjustment;
      gross: number;
      net: number;
      activeCount: number;
    }[];
  }>();

  // Seed from allAgents to ensure all agents appear (D-03)
  for (const agent of allAgents) {
    map.set(agent.name, { agentId: agent.id, periods: [] });
  }

  // Group entries by agent, then by period
  for (const p of periods) {
    const byAgent = new Map<string, Entry[]>();
    for (const e of p.entries) {
      const name = e.agent?.name ?? "Unknown";
      if (!byAgent.has(name)) byAgent.set(name, []);
      byAgent.get(name)!.push(e);
    }
    // Include agents from adjustments (CARRY-08)
    if (p.agentAdjustments) {
      for (const adj of p.agentAdjustments) {
        const name = adj.agent?.name ?? "Unknown";
        if (!byAgent.has(name)) byAgent.set(name, []);
      }
    }

    for (const [agentName, entries] of byAgent) {
      if (!map.has(agentName)) {
        map.set(agentName, { agentId: "unknown", periods: [] });
      }
      const active = entries.filter(isActiveEntry);
      const adj = p.agentAdjustments?.find(a => a.agent?.name === agentName);
      map.get(agentName)!.periods.push({
        period: p,
        entries,
        adjustment: adj,
        gross: active.reduce((s, e) => s + Number(e.payoutAmount), 0),
        net: entries.reduce((s, e) => s + Number(e.netAmount), 0),
        activeCount: active.length,
      });
    }
  }

  return map;
}, [periods, allAgents]);
```

### Pattern 2: Two-Level Collapse State

**What:** Separate state for agent-level and week-level collapse.
**When to use:** Agent cards collapse entirely; week sections inside collapse independently.
**Example:**
```typescript
// Agent-level: Set of expanded agent names (multiple can be open)
const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

// Week-level: Map of agentName -> Set of expanded periodIds
// Initialize with last 2 periods expanded per D-14
const [expandedWeeks, setExpandedWeeks] = useState<Map<string, Set<string>>>(() => {
  const map = new Map<string, Set<string>>();
  // Populate with last 2 period IDs for each agent on initial render
  return map;
});

// Selected week for agent header summary (D-06)
const [selectedWeek, setSelectedWeek] = useState<Map<string, string>>(new Map());
// Defaults to most recent period per agent
```

### Pattern 3: Week Section as Extracted AgentPayCard

**What:** The current `AgentPayCard` (lines 626-1107) becomes the per-week section with minimal changes.
**When to use:** Each week inside an agent card.
**Key changes from current AgentPayCard:**
- Remove agent name from header (moved to parent AgentCard)
- Add date range label + period status badge to top
- Add collapse toggle to week header
- Remove "Show more/Show less" toggle (D-13: show all entries)
- Print/Paid buttons stay (D-07, D-08)
- Financial strip stays with inputs (D-10)
- EditableLabel + CarryoverHint stay (D-11)

### Pattern 4: Selected Week Header Summary

**What:** Agent header shows read-only financial summary mirroring the selected week.
**When to use:** Agent card header (D-05, D-06).
**Example:**
```typescript
// Read-only summary in agent header
const selectedPeriodData = agentPeriods.find(p => p.period.id === selectedWeekId);
// Display: Commission | Bonus | Fronted | Hold | Net (all read-only, no inputs)
// Values come from selectedPeriodData.gross, adjustment amounts, computed net
```

### Pattern 5: Per-Week Print Template

**What:** Print function now takes a single agent + single period, not an array.
**When to use:** Per-week print button (D-19).
**Key change:** The existing `printAgentCards()` already accepts `[string, Entry[]][]` -- for per-week print, pass `[[agentName, weekEntries]]` with the specific period. The period parameter already scopes the adjustment lookup.

### Anti-Patterns to Avoid
- **Nesting period-level state inside AgentCard:** Keep all API-calling handlers in `PayrollPeriods` (current pattern). Don't move `markEntriesPaid`, `toggleApproval`, etc. into child components.
- **Duplicating the period status toggle:** The Open/Locked toggle for each period must remain functional per-week. Don't accidentally scope it to the agent level.
- **Breaking Socket.IO reactivity:** `refreshPeriods()` rebuilds the entire periods array. The `useMemo` regrouping will automatically recompute. Don't add manual cache invalidation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Collapse animation | Custom JS animation | Existing `animate-slide-down` CSS class | Already used for period expand (line 1847) |
| Entry sorting | New sort function | Existing `useMemo` sort by memberId (lines 674-689) | Already handles edge cases |
| Financial calculation | New net formula | Existing formula: `gross + bonus + fronted - hold` (line 908) | Phase 40 established this |
| Print HTML generation | New print template | Adapt existing `printAgentCards()` (lines 1371-1472) | Already handles pills, product grouping, enrollment bonuses |
| Sale row rendering | New table component | Existing `EditableSaleRow` component (lines 256-620) | Already handles edit mode, approval, deletion, status colors |

**Key insight:** This phase is a structural reshuffling, not a feature addition. Nearly all rendering logic already exists in `AgentPayCard` -- the task is decomposing it into `AgentCard > WeekSection` and regrouping the data.

## Common Pitfalls

### Pitfall 1: Losing Period-Level Controls at Agent Level
**What goes wrong:** Period status toggle (Open/Locked), delete period, and period-level print accidentally get removed or moved to agent level.
**Why it happens:** The current period header has these controls. When periods become inner sections, they must keep their controls.
**How to avoid:** The week section header must include: date range, status badge (clickable to toggle), and the controls currently in the period header that are per-period (status toggle). Period delete and period-level print move to a period management area outside the agent cards, or remain accessible per-week.
**Warning signs:** Status toggle missing from week sections; no way to lock/unlock a period.

### Pitfall 2: Service Entries Falling Through
**What goes wrong:** Customer Service payroll entries (`serviceEntries`) don't fit the agent-first model since they use `ServiceEntry` type, not `Entry` type.
**Why it happens:** CS entries are a separate data path with different types (`ServiceEntry` vs `Entry`). The current code renders them in a separate section inside each period.
**How to avoid:** Keep the CS section as a separate block, either at the bottom of the page or as its own collapsible group. CS entries should NOT be mixed into sales agent cards.
**Warning signs:** CS entries disappear from the view, or get forced into the agent card structure.

### Pitfall 3: Agent Header Summary Stale After Input Change
**What goes wrong:** User edits bonus/fronted/hold in a week section, but the agent header read-only summary doesn't update.
**Why it happens:** If the header summary reads from a cached snapshot rather than live state.
**How to avoid:** The agent header financial summary must derive from the same state that the week section inputs use. After `handleHeaderBlur` triggers `refreshPeriods()`, the useMemo regrouping recomputes, and the header reads from the selected week's fresh data.
**Warning signs:** Header shows different values than the active week section.

### Pitfall 4: Expand State Reset on Data Refresh
**What goes wrong:** Socket.IO or manual refresh causes `refreshPeriods()`, which updates `periods` state, which causes useMemo to recompute, but expand/collapse state resets.
**Why it happens:** If expand state is stored as period IDs and periods get new IDs on refresh (they don't -- IDs are stable), or if state is derived from data.
**How to avoid:** Store expand state separately from data. Use agent names and period IDs as keys (both are stable across refreshes).
**Warning signs:** Cards collapse every time someone enters a sale or edits a field.

### Pitfall 5: Period-Level Aggregates Disappearing
**What goes wrong:** The current period header shows aggregate stats (total entries, commission, bonuses, fronted, hold, net across all agents). These provide a period-level overview that's lost when periods become inner sections.
**Why it happens:** When periods are no longer top-level cards, there's no natural place for period-level totals.
**How to avoid:** Consider keeping a small period summary row at the top of the page (above agent cards) showing per-period totals, or accept that period-level totals are no longer needed since the view is agent-centric. The CONTEXT.md decisions don't mention period-level totals, so this is Claude's discretion -- recommend a lightweight period summary strip.
**Warning signs:** User can no longer see total payroll for a given week at a glance.

### Pitfall 6: Print Template Mismatch
**What goes wrong:** Print output doesn't match the new screen layout (D-20).
**Why it happens:** `printAgentCards()` currently generates one page per agent with all their entries from a single period. The new print is per-week per-agent, which is actually the same data shape but triggered per-week.
**How to avoid:** The existing print function already handles single-agent single-period printing. Just ensure the print button passes the correct period's entries and adjustment.
**Warning signs:** Print shows entries from wrong period, or shows all periods for an agent.

### Pitfall 7: Enormous File Size
**What goes wrong:** Adding AgentCard and WeekSection components plus regrouping logic pushes the file well past 2000 lines.
**Why it happens:** Everything is currently in one file.
**How to avoid:** Extract components into separate files in the same directory: `AgentCard.tsx`, `WeekSection.tsx`. Import them into `PayrollPeriods.tsx`. The types, style constants, and helper functions can go in a `payroll-utils.ts` file.
**Warning signs:** File exceeds ~2500 lines, making it hard to navigate.

## Code Examples

### Agent Card Header (Read-Only Summary)
```typescript
// Derived from selected week's data -- read-only display, no inputs
function AgentHeader({ agentName, isTopEarner, selectedWeekData, onToggleExpand, expanded }: {
  agentName: string;
  isTopEarner: boolean;
  selectedWeekData: { gross: number; bonus: number; fronted: number; hold: number; net: number; activeCount: number; weekLabel: string } | null;
  onToggleExpand: () => void;
  expanded: boolean;
}) {
  return (
    <div
      style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        cursor: "pointer", padding: `${S[4]}px ${S[5]}px`,
      }}
      onClick={onToggleExpand}
    >
      <div style={{ display: "flex", alignItems: "center", gap: S[3] }}>
        <span style={{ fontWeight: 800, fontSize: 17, color: C.textPrimary }}>{agentName}</span>
        {isTopEarner && <Badge color={C.primary400}>Top Earner</Badge>}
        {selectedWeekData && (
          <span style={{ fontSize: 12, color: C.textMuted }}>
            {selectedWeekData.activeCount} sale{selectedWeekData.activeCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: S[3] }}>
        {/* Read-only financial summary from selected week */}
        {selectedWeekData && (
          <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
            <span style={{ color: C.textMuted }}>Commission: <strong style={{ color: C.textPrimary }}>{formatDollar(selectedWeekData.gross)}</strong></span>
            <span style={{ color: C.textMuted }}>Net: <strong style={{ color: selectedWeekData.net >= 0 ? C.success : C.danger }}>{formatDollar(selectedWeekData.net)}</strong></span>
          </div>
        )}
        <ChevronDown
          size={18}
          style={{
            color: C.textMuted,
            transition: `transform ${motion.duration.fast} ${motion.easing.out}`,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </div>
    </div>
  );
}
```

### Week Section Collapse Toggle
```typescript
// Per-week collapse header (D-14: last 2 expanded, D-15: any can toggle)
<div
  style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: `${S[3]}px ${S[5]}px`, cursor: "pointer",
    borderBottom: weekExpanded ? `1px solid ${C.borderSubtle}` : "none",
    background: "rgba(255,255,255,0.02)",
  }}
  onClick={() => toggleWeekExpand(agentName, period.id)}
>
  <div style={{ display: "flex", alignItems: "center", gap: S[3] }}>
    <span style={{ fontWeight: 700, fontSize: 14, color: C.textPrimary }}>
      {fmtDate(period.weekStart)} - {fmtDate(period.weekEnd)}
    </span>
    <Badge color={statusCfg.color} dot>{statusCfg.label}</Badge>
  </div>
  <ChevronDown
    size={14}
    style={{
      color: C.textMuted,
      transition: `transform 150ms ease-out`,
      transform: weekExpanded ? "rotate(180deg)" : "rotate(0deg)",
    }}
  />
</div>
```

### Selected Week Indicator
```typescript
// Subtle border/background treatment when a week section is the "selected" one for the agent header
const isSelected = selectedWeek.get(agentName) === period.id;
// Week section wrapper:
<div style={{
  borderLeft: isSelected ? `3px solid ${C.accentTeal}` : "3px solid transparent",
  background: isSelected ? "rgba(20,184,166,0.03)" : "transparent",
  transition: "all 150ms ease-out",
}}>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Period-first hierarchy | Agent-first hierarchy | Phase 41 | Payroll team processes per-agent, not per-period |
| Single expand state (one period) | Multi-level expand (agents + weeks) | Phase 41 | Multiple agents/weeks can be open simultaneously |
| Agent-scoped print in period context | Per-week print button | Phase 41 | More granular printing |
| "Show more/Show less" entry toggle | Show all entries always | Phase 41 (D-13) | Simpler UX, removes COLLAPSED_LIMIT logic |

**Removed from current code:**
- `expandedPeriod` single-selection state (replaced by `expandedAgents` Set)
- `showAllEntries` / `COLLAPSED_LIMIT` logic in sale table (D-13: show all)
- Period-level aggregate stats row (no longer top-level)
- Period-level print menu dropdown (print moves to per-week)

## Open Questions

1. **Period-level controls placement**
   - What we know: Period status toggle (Open/Locked), period delete must remain accessible. Currently in period card header.
   - What's unclear: Whether these controls should be in each week section header, or in a separate period management area.
   - Recommendation: Put status badge (clickable to toggle) and period-level actions in the week section header. This is the most natural placement per D-08 which specifies "period status badge (Open/Locked)" in each week section.

2. **Period-level aggregates**
   - What we know: Current view shows per-period totals (entries, commission, bonuses, fronted, hold, net) in the period header.
   - What's unclear: Whether users need period-level totals when the view is agent-centric.
   - Recommendation: Skip period-level aggregates for now. The agent header summary (D-05) provides agent-level visibility. Period-level totals can be added later if needed.

3. **File decomposition strategy**
   - What we know: Current file is 2042 lines. Adding agent-first logic will increase size.
   - What's unclear: Exact split boundary.
   - Recommendation: Extract into 3-4 files: `PayrollPeriods.tsx` (main + handlers + data regrouping), `AgentCard.tsx` (agent header + week iteration), `WeekSection.tsx` (extracted from AgentPayCard), `payroll-types.ts` (shared types and style constants).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (no frontend tests exist in ops-dashboard) |
| Config file | none -- see Wave 0 |
| Quick run command | Manual browser verification |
| Full suite command | Manual browser verification |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CARD-01 | Agent-level collapsible cards render as top-level | manual-only | Visual inspection in browser | N/A |
| CARD-02 | Week-by-week entries separated inside agent cards | manual-only | Visual inspection in browser | N/A |

**Justification for manual-only:** No test infrastructure exists for the dashboard. The ops-dashboard has zero test files. The payroll component relies heavily on visual layout, inline styles, and browser APIs (window.open for print). Setting up a test framework is out of scope for this phase (it's a UI restructuring, not a test infrastructure phase).

### Sampling Rate
- **Per task commit:** Manual browser verification -- expand/collapse agents, check week sections, verify print
- **Per wave merge:** Full manual walkthrough of payroll view with test data
- **Phase gate:** Visual verification that CARD-01 and CARD-02 behaviors match decisions D-01 through D-20

### Wave 0 Gaps
None -- manual verification only for this phase. No test infrastructure to set up.

## Sources

### Primary (HIGH confidence)
- Direct code analysis of `PayrollPeriods.tsx` (2042 lines) -- read and analyzed in full
- Phase 40 CONTEXT.md -- AgentPeriodAdjustment schema, EditableLabel, CarryoverHint patterns
- Phase 41 CONTEXT.md -- 22 locked decisions governing implementation

### Secondary (MEDIUM confidence)
- REQUIREMENTS.md -- CARD-01, CARD-02 requirement definitions
- STATE.md -- accumulated project decisions and patterns

### Tertiary (LOW confidence)
None -- all findings derived from direct code analysis.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, pure restructuring of existing code
- Architecture: HIGH -- data regrouping pattern is straightforward Map transformation; component decomposition follows existing patterns
- Pitfalls: HIGH -- identified from direct code analysis of current implementation; all pitfalls are grounded in specific line numbers and data flows

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- no external dependencies changing)
