# Phase 43: Payroll Agent Tab Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 43-payroll-agent-tab-navigation
**Areas discussed:** Sidebar layout & density, Agent selection & content area, Period pagination, Status badges

---

## Sidebar layout & density

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow fixed sidebar | ~220px fixed left panel with agent name, earnings, badge. Compact rows ~40px. | ✓ |
| Wide sidebar with mini stats | ~300px with more info per row | |
| Collapsible drawer | Toggle open/closed | |

**User's choice:** Narrow fixed sidebar
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Real-time filter | Filters as you type | |
| Debounced filter | Filters after 300ms | |

**User's choice:** Show all active agents in sidebar and customer service agents (free text)
**Notes:** User wants both sales agents and CS agents visible in the sidebar

| Option | Description | Selected |
|--------|-------------|----------|
| Keep stats at top | Aggregate across all agents | ✓ |
| Move into content area | Scoped to selected agent | |

**User's choice:** Keep at top

| Option | Description | Selected |
|--------|-------------|----------|
| Same list with CS badge | Mixed in with sales agents | |
| Separate section at bottom | Sales agents first, divider, CS below | ✓ |
| Separate tab toggle | Toggle between groups | |

**User's choice:** Separate section at bottom

---

## Agent selection & content area

| Option | Description | Selected |
|--------|-------------|----------|
| Replace content area | Single agent view | ✓ |
| Scroll to agent | All agents in vertical list | |
| Split panel | Two agents side-by-side | |

**User's choice:** Replace content area

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-select top earner | First in sorted list selected | |
| No default selection | Prompt until clicked | ✓ |

**User's choice:** No default selection

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to top | Content scrolls to top | ✓ |
| Preserve scroll position | Remember per agent | |

**User's choice:** Reset to top

---

## Period pagination (Load More)

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side slice | Show 4, Load More from existing data | ✓ |
| API-backed pagination | Fetch per page from server | |
| Show all periods | No pagination | |

**User's choice:** Client-side slice

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-expand most recent | First period expanded, rest collapsed | |
| All collapsed | All start collapsed | |

**User's choice:** All 4 expanded (free text override)
**Notes:** User wants all 4 visible periods expanded by default, not just the most recent

---

## Status badges & visual indicators

| Option | Description | Selected |
|--------|-------------|----------|
| Based on most recent period | All PAID=green, none=red, mixed=yellow | ✓ |
| Based on all visible periods | Comprehensive cross-period check | |
| Based on period status field | Uses OPEN/LOCKED/FINALIZED | |

**User's choice:** Based on most recent period

| Option | Description | Selected |
|--------|-------------|----------|
| Show with muted style | All active agents shown, muted if $0 | ✓ |
| Hide zero-sale agents | Only agents with entries | |

**User's choice:** Show with muted style

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle accent on top 3 | Gold dot/border for top earners | ✓ |
| No special highlighting | All agents look the same | |
| Bold earnings text | Colored earnings for top earners | |

**User's choice:** Subtle accent on top 3, BUT sort sidebar alphabetically (free text override)
**Notes:** User specifically requested alphabetical sort in sidebar instead of earnings-based sort. Top 3 accent still applies.

---

## Claude's Discretion

- Exact sidebar width (200-240px)
- Agent switching animation
- Load More batch size
- CS section header styling
- Empty state prompt design

## Deferred Ideas

None
