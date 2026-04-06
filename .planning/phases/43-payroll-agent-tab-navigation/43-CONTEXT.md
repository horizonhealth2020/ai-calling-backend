# Phase 43: Payroll Agent Tab Navigation - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current vertically stacked agent cards in the Payroll Periods tab with a left sidebar + content area layout. Payroll staff can navigate between agents via the sidebar and view paginated pay periods per agent. Pure UI refactor — zero API changes, all data already available in the existing `agentData` Map.

</domain>

<decisions>
## Implementation Decisions

### Sidebar layout
- **D-01:** Narrow fixed sidebar (~220px) on the left with independent scroll. Agent rows are compact (~40px) showing name, current week earnings, and status badge.
- **D-02:** Sidebar lists ALL active agents AND customer service agents. CS agents appear in a separate section below a divider, after the sales agents.
- **D-03:** Agents are sorted **alphabetically** in the sidebar (not by earnings). This is a change from the current earnings-based sort.
- **D-04:** Real-time search input at top of sidebar filters the agent list as the user types.
- **D-05:** Summary stats strip (gross, net, bonus, etc.) remains at the top above the sidebar+content layout, showing aggregate totals across ALL agents for the current week.

### Agent selection & content area
- **D-06:** Clicking an agent in the sidebar replaces the content area with that agent's pay periods. Single-agent view — the existing AgentCard component renders in the content area with all current functionality (week sections, sale details, print, mark paid).
- **D-07:** No default agent selected on page load. Content area shows a prompt ("Select an agent from the sidebar") until one is clicked.
- **D-08:** Switching agents resets the content area scroll to top, showing the most recent period first.

### Period pagination
- **D-09:** Client-side pagination — all periods are already in memory via the `agentData` Map. Show first 4 periods by default. "Load More" button reveals the next batch from existing data (no API call).
- **D-10:** All 4 initially visible periods are expanded by default (showing sale details). Loaded-more periods also expand.

### Status badges
- **D-11:** Paid/unpaid/partial badge computed from the agent's most recent period: all entries PAID → green "Paid", none PAID → red "Unpaid", mixed → yellow "Partial".
- **D-12:** Agents with zero sales/entries still appear in the sidebar with muted text style and no badge — confirms payroll hasn't missed anyone.
- **D-13:** Top 3 earners get a subtle accent indicator (small dot or left border highlight) in the sidebar. This uses the existing top3 earnings calculation even though the list is sorted alphabetically.

### Claude's Discretion
- Exact sidebar width tuning (200-240px range)
- Transition animation when switching agents (fade, instant, or slide)
- "Load More" batch size (4 or all remaining)
- How the CS agent section header looks in the sidebar
- Empty state prompt design when no agent is selected

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Payroll UI components
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — Main component being refactored (962 lines). Contains `agentData` Map, `sortedAgents`, summary stats, and agent card rendering loop.
- `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx` — Existing AgentCard component with full week section rendering, sale details, print, mark paid/unpaid. Will be reused in the content area.
- `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` — Type definitions: `AgentData`, `AgentPeriodData`, `Entry`, `Period`, etc.
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` — Week section component used inside AgentCard.

### Design system
- `packages/ui/` — Shared components: Badge, AnimatedNumber, Button, Card, EmptyState, design tokens (colors, spacing, radius)

### Requirements
- `.planning/REQUIREMENTS.md` — PAY-01 through PAY-06 (sidebar, agent selection, pagination, badges, search)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `agentData` useMemo (PayrollPeriods.tsx:96-141): Already groups all periods by agent into a `Map<string, AgentData>`. This is the data source for both sidebar and content area — no restructuring needed.
- `sortedAgents` useMemo (PayrollPeriods.tsx:224-255): Currently sorts by earnings. Will need modification to sort alphabetically per D-03, but top3 earner calculation should remain.
- `AgentCard` component: Already renders a complete agent view with week sections, sale details, and all action handlers. Can be rendered directly in the content area for the selected agent.
- `StatMini` component (PayrollPeriods.tsx:30-49): Summary stats already exist and work independently of agent selection.
- Service entries rendering (PayrollPeriods.tsx:843-959): CS agents rendered per-period outside agent cards. Needs adaptation for sidebar CS section.

### Established Patterns
- Inline React.CSSProperties with design tokens (C, S, R) — no Tailwind
- `@ops/ui` components: Badge, Button, Card, EmptyState, AnimatedNumber
- Expand/collapse state via `Set` and `Map` (expandedAgents, expandedWeeks, selectedWeek)

### Integration Points
- `PayrollPeriodsProps` interface (line 54-71): Props passed from page.tsx — no changes needed
- Socket.IO for real-time updates — must continue working after refactor
- Print functionality — must work for selected agent's visible periods

</code_context>

<specifics>
## Specific Ideas

- Sidebar shows all active agents AND customer service agents (CS in separate section)
- Alphabetical sort in sidebar (departure from current earnings sort)
- Top 3 earners get subtle accent even though list is alphabetical
- No default selection — explicit "Select an agent" prompt on load
- All 4 visible periods expanded by default (not collapsed)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 43-payroll-agent-tab-navigation*
*Context gathered: 2026-04-06*
