# Phase 43: Payroll Agent Tab Navigation - Research

**Researched:** 2026-04-06
**Domain:** React UI refactor — sidebar navigation + client-side pagination
**Confidence:** HIGH

## Summary

This phase is a pure client-side UI refactor of `PayrollPeriods.tsx` (962 lines). The existing `agentData` Map already groups all payroll data by agent with `AgentData` and `AgentPeriodData` types. No API changes are needed. The refactor replaces the current vertically stacked `AgentCard` loop with a sidebar + content area layout where clicking an agent in the sidebar shows that agent's periods in the main content area.

The existing component architecture (AgentCard, WeekSection, StatMini) remains intact. Two new presentational components are needed: `AgentSidebar` (sidebar with search, agent list, CS section) and `AgentRow` (single sidebar row). The `sortedAgents` useMemo needs modification to sort alphabetically (D-03) while preserving top-3 earner calculation. New state is minimal: `selectedAgent: string | null`, `searchQuery: string`, `visiblePeriodCount: Map<string, number>`.

**Primary recommendation:** Extract the sidebar into an `AgentSidebar` component, add `selectedAgent` state to PayrollPeriods, and render a single AgentCard in the content area for the selected agent with client-side period slicing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Narrow fixed sidebar (~220px) on the left with independent scroll. Agent rows are compact (~40px) showing name, current week earnings, and status badge.
- **D-02:** Sidebar lists ALL active agents AND customer service agents. CS agents appear in a separate section below a divider, after the sales agents.
- **D-03:** Agents are sorted **alphabetically** in the sidebar (not by earnings). This is a change from the current earnings-based sort.
- **D-04:** Real-time search input at top of sidebar filters the agent list as the user types.
- **D-05:** Summary stats strip (gross, net, bonus, etc.) remains at the top above the sidebar+content layout, showing aggregate totals across ALL agents for the current week.
- **D-06:** Clicking an agent in the sidebar replaces the content area with that agent's pay periods. Single-agent view — the existing AgentCard component renders in the content area with all current functionality (week sections, sale details, print, mark paid).
- **D-07:** No default agent selected on page load. Content area shows a prompt ("Select an agent from the sidebar") until one is clicked.
- **D-08:** Switching agents resets the content area scroll to top, showing the most recent period first.
- **D-09:** Client-side pagination — all periods are already in memory via the `agentData` Map. Show first 4 periods by default. "Load More" button reveals the next batch from existing data (no API call).
- **D-10:** All 4 initially visible periods are expanded by default (showing sale details). Loaded-more periods also expand.
- **D-11:** Paid/unpaid/partial badge computed from the agent's most recent period: all entries PAID -> green "Paid", none PAID -> red "Unpaid", mixed -> yellow "Partial".
- **D-12:** Agents with zero sales/entries still appear in the sidebar with muted text style and no badge — confirms payroll hasn't missed anyone.
- **D-13:** Top 3 earners get a subtle accent indicator (small dot or left border highlight) in the sidebar. This uses the existing top3 earnings calculation even though the list is sorted alphabetically.

### Claude's Discretion
- Exact sidebar width tuning (200-240px range)
- Transition animation when switching agents (fade, instant, or slide)
- "Load More" batch size (4 or all remaining)
- How the CS agent section header looks in the sidebar
- Empty state prompt design when no agent is selected

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAY-01 | Payroll Periods tab has a left sidebar listing all agents with current earnings sort | Sidebar component with alphabetical sort (D-03 overrides "earnings sort" in req), top-3 earner indicators, earnings display per row |
| PAY-02 | Clicking an agent in sidebar shows that agent's pay periods in the main content area | `selectedAgent` state drives content area; existing AgentCard renders for selected agent |
| PAY-03 | Agent display shows last 4 pay periods by default (most recent first) | Client-side slice of `agentData.periods` sorted by weekStart descending, capped at `visibleCount` |
| PAY-04 | "Load More" button at bottom fetches older pay periods for the selected agent | Client-side — increment visibleCount to show remaining periods from existing data |
| PAY-05 | Sidebar shows paid/unpaid/partial status badges next to each agent name | Badge computed from most recent period entries using existing Badge component |
| PAY-06 | Sidebar includes search/filter to find agents by name | Controlled input with `searchQuery` state filtering `sortedAgents` array |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ (Next.js 15) | Component framework | Already in use |
| @ops/ui | local | Badge, Button, Card, EmptyState, AnimatedNumber, design tokens | Project design system |
| lucide-react | existing | Icons (Search, User, ChevronDown) | Already used throughout payroll |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/utils | local | formatDollar, formatDate | Currency formatting in sidebar rows |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom sidebar | Headless UI Listbox | Overkill — simple list with click handlers, no accessibility complexity needed |
| Virtual scroll for agent list | react-window | Agent count is 9-15 (per STATE.md), not enough to warrant virtualization |

**Installation:**
```bash
# No new dependencies — everything needed is already in the project
```

## Architecture Patterns

### Recommended Project Structure
```
apps/ops-dashboard/app/(dashboard)/payroll/
  PayrollPeriods.tsx    # Refactored — adds sidebar+content layout, selectedAgent state
  AgentSidebar.tsx      # NEW — sidebar with search, agent list, CS section
  AgentCard.tsx          # Existing — renders in content area for selected agent
  WeekSection.tsx        # Existing — unchanged
  payroll-types.ts       # Existing — may add SidebarAgent type
```

### Pattern 1: Sidebar + Content Split Layout
**What:** CSS flexbox layout with fixed-width sidebar and flex-1 content area
**When to use:** Master-detail navigation pattern
**Example:**
```typescript
// PayrollPeriods.tsx — layout wrapper around existing content
const LAYOUT: React.CSSProperties = {
  display: "flex",
  gap: 0,
  minHeight: 0,
};

const SIDEBAR: React.CSSProperties = {
  width: 220,
  flexShrink: 0,
  borderRight: `1px solid ${C.borderSubtle}`,
  overflowY: "auto",
  background: C.bgSurfaceRaised,
};

const CONTENT: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflowY: "auto",
};
```

### Pattern 2: Client-Side Period Pagination
**What:** Slice the periods array in memory rather than making API calls
**When to use:** When all data is already loaded (agentData Map contains everything)
**Example:**
```typescript
// Track how many periods to show per agent
const [visibleCount, setVisibleCount] = useState(4);

// When agent changes, reset count
useEffect(() => { setVisibleCount(4); }, [selectedAgent]);

const selectedData = selectedAgent ? agentData.get(selectedAgent) : null;
const allPeriods = selectedData
  ? [...selectedData.periods].sort((a, b) =>
      new Date(b.period.weekStart).getTime() - new Date(a.period.weekStart).getTime()
    )
  : [];
const visiblePeriods = allPeriods.slice(0, visibleCount);
const hasMore = allPeriods.length > visibleCount;
```

### Pattern 3: Status Badge Computation
**What:** Derive paid/unpaid/partial from most recent period's entries
**When to use:** For sidebar badge display per D-11
**Example:**
```typescript
function getAgentStatus(periods: AgentPeriodData[]): "paid" | "unpaid" | "partial" | null {
  if (periods.length === 0) return null;
  const mostRecent = [...periods].sort((a, b) =>
    new Date(b.period.weekStart).getTime() - new Date(a.period.weekStart).getTime()
  )[0];
  const entries = mostRecent.entries;
  if (entries.length === 0) return null;
  const paidStatuses = ["PAID", "ZEROED_OUT", "CLAWBACK_APPLIED"];
  const allPaid = entries.every(e => paidStatuses.includes(e.status));
  const nonePaid = entries.every(e => !paidStatuses.includes(e.status));
  if (allPaid) return "paid";
  if (nonePaid) return "unpaid";
  return "partial";
}
```

### Pattern 4: Socket.IO State Preservation
**What:** Use `useRef` to guard selected agent across socket updates
**When to use:** When socket events trigger data refresh that would otherwise clear selection
**Example:**
```typescript
// From STATE.md pitfall: "agent tab state loss on socket update — use useRef guard for selectedAgentId"
const selectedAgentRef = useRef<string | null>(null);

// Keep ref in sync
useEffect(() => { selectedAgentRef.current = selectedAgent; }, [selectedAgent]);

// In socket handler or data refresh callback, restore from ref
useEffect(() => {
  if (selectedAgentRef.current && agentData.has(selectedAgentRef.current)) {
    setSelectedAgent(selectedAgentRef.current);
  }
}, [agentData]);
```

### Anti-Patterns to Avoid
- **Lifting too much state:** Keep `selectedAgent` and `searchQuery` in PayrollPeriods only. AgentSidebar receives them as props + callbacks.
- **Re-sorting in sidebar component:** Sort once in PayrollPeriods useMemo, pass sorted array to AgentSidebar.
- **Duplicating period sorting:** AgentCard already sorts periods by weekStart descending (line 67). Don't sort again in PayrollPeriods before passing to AgentCard — pass the sliced array and let AgentCard sort.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status badges | Custom colored spans | `<Badge>` from @ops/ui | Already styled with color prop, used throughout codebase |
| Empty state UI | Custom centered text | `<EmptyState>` from @ops/ui | Standard icon + title + description pattern |
| Search input styling | Custom input styles | `baseInputStyle` from tokens.ts | Consistent with all other inputs in the app |
| Dollar formatting | `toFixed(2)` with $ prefix | `formatDollar()` from @ops/utils | Handles edge cases, consistent formatting |

**Key insight:** This phase is a layout reorganization, not a feature build. Every visual element already exists in the codebase. The work is rearranging components and adding selection state.

## Common Pitfalls

### Pitfall 1: Socket.IO Resets Selected Agent
**What goes wrong:** When periods data refreshes via socket event, React re-renders agentData Map. If selectedAgent state is derived from agentData keys, a brief intermediate state could clear the selection.
**Why it happens:** Socket-driven `setPeriods` triggers agentData recalculation; if the Map temporarily doesn't include the selected agent's name, selection is lost.
**How to avoid:** Use a `useRef` to persist `selectedAgent` across re-renders. In the effect that responds to agentData changes, check if the ref'd agent still exists in the new data and restore selection.
**Warning signs:** Agent selection randomly resets after a sale is entered or status changes.

### Pitfall 2: AgentCard Expand/Collapse State Mismatch
**What goes wrong:** The current code initializes ALL agents as expanded on first load (line 150). With sidebar navigation, this is wrong — only the selected agent's periods should be expanded.
**Why it happens:** The `expandedAgents` Set and `expandedWeeks` Map were designed for the all-agents-visible layout.
**How to avoid:** With sidebar navigation, the expand/collapse pattern changes. The selected agent is always "expanded" (their card is visible). The `expandedWeeks` state can be simplified — D-10 says all visible periods are expanded by default. Consider removing the agent-level expand/collapse entirely since only one agent shows at a time.
**Warning signs:** Clicking an agent shows collapsed card requiring extra click to see content.

### Pitfall 3: CS Agents in Wrong Section
**What goes wrong:** CS agents (service entries) are currently rendered in a completely separate block outside the agent cards loop (lines 843-959). They use `ServiceEntry` types, not `Entry` types. Putting them in the sidebar requires mapping service entries to a sidebar-compatible format.
**Why it happens:** Service agents have different data structures — `ServiceEntry` has `basePay`, `bonusBreakdown`, `totalPay` vs regular entries with `payoutAmount`, `adjustmentAmount`.
**How to avoid:** Create a unified sidebar row interface that works for both sales agents (from agentData Map) and CS agents (from period.serviceEntries). When a CS agent is selected, render the existing CS entry UI in the content area instead of AgentCard.
**Warning signs:** CS agents missing from sidebar, or clicking a CS agent crashes because AgentCard expects sales entry data.

### Pitfall 4: Content Area Scroll Not Resetting
**What goes wrong:** D-08 requires scroll reset when switching agents. If the content area uses the page scroll (not its own scroll container), `scrollTo(0,0)` scrolls the entire page.
**Why it happens:** The content area needs its own overflow container with a ref to call `scrollTo`.
**How to avoid:** Give the content area `overflowY: "auto"` and a `ref`. On agent selection change, call `contentRef.current?.scrollTo({ top: 0 })`.
**Warning signs:** Switching from a long agent view to a short one shows the content at the bottom/middle instead of top.

### Pitfall 5: Search Filtering Deselects Current Agent
**What goes wrong:** If the search filter hides the currently selected agent, the content area could show stale data or error.
**Why it happens:** Search filters the sidebar display but doesn't affect which agent is selected.
**How to avoid:** Keep selectedAgent independent from search filter. The content area always shows the selected agent's data regardless of sidebar filter state. Only the sidebar list is filtered.
**Warning signs:** Typing in search clears the content area or shows wrong agent.

## Code Examples

Verified patterns from the existing codebase:

### Alphabetical Sort with Top-3 Earners (D-03, D-13)
```typescript
// Modified sortedAgents useMemo — sort alphabetically, keep top3 calculation
const sortedAgents = useMemo(() => {
  const agentEntries = [...agentData.entries()].map(([name, data]) => {
    const sorted = [...data.periods].sort((a, b) =>
      new Date(b.period.weekStart).getTime() - new Date(a.period.weekStart).getTime()
    );
    const mostRecent = sorted[0];
    return {
      agentName: name,
      data,
      gross: mostRecent?.gross ?? 0,
      net: mostRecent?.net ?? 0,
      activeCount: mostRecent?.activeCount ?? 0,
    };
  });

  // Top 3 by earnings (before alphabetical sort)
  const byEarnings = [...agentEntries].sort((a, b) => b.gross - a.gross);
  const top3 = new Set(
    byEarnings.slice(0, 3).filter(a => a.net > 0).map(a => a.agentName)
  );

  // D-03: Alphabetical sort for sidebar display
  const result = [...agentEntries].sort((a, b) =>
    a.agentName.localeCompare(b.agentName)
  );

  return result.map(a => ({
    ...a,
    isTopEarner: top3.has(a.agentName),
  }));
}, [agentData]);
```

### Sidebar Row with Badge and Top-3 Dot
```typescript
// Source: UI-SPEC.md sidebar row structure
const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 40,
  padding: `0 ${S[4]}px`,
  cursor: "pointer",
  transition: `background ${motion.duration.fast} ${motion.easing.out}`,
};

const ROW_SELECTED: React.CSSProperties = {
  ...ROW,
  background: C.bgSurfaceOverlay,
  borderLeft: `3px solid ${C.accentTeal}`,
  paddingLeft: S[4] - 3, // compensate for border
};

// Top-3 dot
const TOP3_DOT: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: C.accentTeal,
  flexShrink: 0,
};
```

### AgentCard Modification for Pagination
```typescript
// AgentCard currently receives all periods. For pagination, pass only visible slice.
// In PayrollPeriods content area:
const allPeriods = selectedData
  ? [...selectedData.periods].sort((a, b) =>
      new Date(b.period.weekStart).getTime() - new Date(a.period.weekStart).getTime()
    )
  : [];
const visiblePeriods = allPeriods.slice(0, visibleCount);

<AgentCard
  agentName={selectedAgent}
  agentData={visiblePeriods}  // sliced, not full array
  isTopEarner={isTopEarner}
  expanded={true}  // always expanded in sidebar layout
  onToggleExpand={() => {}}  // no-op — always visible
  // ... rest of props unchanged
/>
{hasMore && (
  <div style={{ textAlign: "center", padding: S[4] }}>
    <span
      role="button"
      onClick={() => setVisibleCount(allPeriods.length)}
      style={{
        color: C.accentTeal,
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
      }}
    >
      Load More Periods
    </span>
  </div>
)}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Vertically stacked agent cards | Sidebar + single agent content area | Phase 43 (this phase) | Reduces scrolling, enables quick agent switching |
| All agents expanded on load | No default selection, explicit agent pick | Phase 43 (this phase) | Faster initial render, focused workflow |
| Earnings-based sort | Alphabetical sort with top-3 indicators | Phase 43 (D-03) | Predictable agent location for payroll staff |

**Deprecated/outdated:**
- `expandedAgents` Set: becomes unnecessary with single-agent view — the selected agent is always "expanded"
- Agent-level toggle: `onToggleExpand` on AgentCard becomes a no-op in the new layout (card is always visible when selected)

## Open Questions

1. **AgentCard `expanded` prop behavior**
   - What we know: AgentCard uses `expanded` boolean to show/hide week sections. In the new layout, the card is always visible.
   - What's unclear: Should we keep passing `expanded={true}` or refactor AgentCard to remove the toggle? 
   - Recommendation: Pass `expanded={true}` and no-op `onToggleExpand` for minimal change. The expand header still shows financial summary which is useful.

2. **CS agent content area rendering**
   - What we know: CS agents use `ServiceEntry` type and render differently from sales agents (base pay, bonus breakdown, no AgentCard).
   - What's unclear: When a CS agent is selected in the sidebar, what renders in the content area? The existing CS rendering (lines 843-959) is per-period, not per-agent.
   - Recommendation: Group service entries by `serviceAgent.name` similar to how sales entries are grouped. Render a CS-specific content view that shows all periods for that CS agent.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (Morgan service only — no frontend tests exist) |
| Config file | `jest.config.js` at root |
| Quick run command | `npm test` |
| Full suite command | `npm run test:coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-01 | Sidebar lists all agents alphabetically with earnings | manual-only | Visual verification in browser | N/A |
| PAY-02 | Agent click shows pay periods in content area | manual-only | Visual verification in browser | N/A |
| PAY-03 | Last 4 pay periods shown by default | manual-only | Visual verification in browser | N/A |
| PAY-04 | Load More reveals older periods | manual-only | Visual verification in browser | N/A |
| PAY-05 | Status badges (paid/unpaid/partial) in sidebar | manual-only | Visual verification in browser | N/A |
| PAY-06 | Search input filters agents by name | manual-only | Visual verification in browser | N/A |

### Sampling Rate
- **Per task commit:** Visual verification in dev server (`npm run dashboard:dev`)
- **Per wave merge:** Full manual walkthrough of all 6 requirements
- **Phase gate:** All 6 requirements verified visually before completion

### Wave 0 Gaps
None — this is a pure UI refactor with no existing frontend test infrastructure. All verification is manual/visual. No test files need to be created for this phase.

## Sources

### Primary (HIGH confidence)
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — 962 lines, complete current implementation reviewed
- `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx` — 183 lines, full component with props interface
- `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` — 208 lines, all type definitions and style constants
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` — complex component, interface reviewed
- `packages/ui/src/tokens.ts` — 197 lines, all design tokens (colors, spacing, radius, typography, motion)
- `.planning/phases/43-payroll-agent-tab-navigation/43-CONTEXT.md` — 13 locked decisions
- `.planning/phases/43-payroll-agent-tab-navigation/43-UI-SPEC.md` — Complete UI design contract
- `.planning/STATE.md` — Project decisions and pitfall notes

### Secondary (MEDIUM confidence)
- None needed — all research is from primary codebase sources

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing libraries
- Architecture: HIGH — existing data structures support the refactor directly
- Pitfalls: HIGH — identified from codebase analysis and STATE.md accumulated context

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable — pure UI refactor of existing codebase)
