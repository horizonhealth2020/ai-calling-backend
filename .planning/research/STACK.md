# Technology Stack

**Project:** v2.2 Chargeback Batch Review & Payroll Agent Tabs
**Researched:** 2026-04-06
**Scope:** NEW capabilities only (existing stack validated and excluded)

## Verdict: No New Dependencies Required

Both features are buildable with the existing stack. The codebase already contains every primitive needed. Adding libraries would contradict the project's established patterns (inline SVG sparklines over charting libs, zero external UI libraries beyond lucide-react).

## What Already Exists (DO NOT Add)

| Capability | Already In Stack | Used By |
|------------|-----------------|---------|
| Tab/sidebar navigation | `@ops/ui` PageShell with NavItem[] | All dashboard pages |
| Paste-to-parse parsing | Client-side parser in CSSubmissions.tsx | Chargeback + pending terms |
| Table rendering | Inline `<table>` with `baseThStyle`/`baseTdStyle` tokens | Every dashboard tab |
| Batch API submission | `POST /chargebacks` with `records[]` array + Zod validation | CS submissions |
| Agent-first data grouping | `AgentData`/`AgentPeriodData` types in payroll-types.ts | PayrollPeriods |
| Paginated API fetching | `authFetch` with query params | Multiple endpoints |
| Real-time updates | Socket.IO via `@ops/socket` provider | Layout-level shared connection |
| State management | React useState/useCallback/useMemo | All components |
| Icons | lucide-react | All dashboards |
| Toast notifications | `@ops/ui` ToastProvider + useToast | All mutation feedback |
| Dollar/date formatting | `@ops/utils` formatDollar/formatDate | All dashboards |
| Skeleton loading | `@ops/ui` SkeletonCard | Payroll, CS dashboards |

## Feature-Specific Stack Analysis

### 1. Batch Chargeback Review UI

**What's needed:** Parse multiple chargebacks from pasted text, display in editable review table, allow confirm/edit/remove per row, then bulk submit.

**Stack approach:**
- **Parser:** Extend existing `parseChargebackText()` and `consolidateByMember()` in CSSubmissions.tsx. These already handle multi-row tab-delimited paste. No new parsing library needed.
- **Review table:** Standard `<table>` with inline CSSProperties following existing `thStyle`/`tdStyle` tokens from payroll-types.ts pattern. No table library needed -- the codebase uses raw HTML tables everywhere.
- **Partial product selection:** Already implemented (per PROJECT.md validated features). Checkboxes with inline styles following existing patterns.
- **Editable rows:** Inline `<input>` elements using existing `baseInputStyle` from `@ops/ui`. The payroll sale-row edit pattern (inline product/premium editing) is the reference implementation.
- **State management:** `useState<ParsedRow[]>` with row-level edit handlers. No form library needed -- the codebase uses submit-only validation, not per-field.
- **Batch submit:** Existing `POST /chargebacks` endpoint already accepts `records[]` array. May need minor Zod schema additions for new fields but no structural changes.
- **Auto-matching preview:** Existing chargeback auto-matching by memberId (MATCHED/MULTIPLE/UNMATCHED status) can be called pre-submit via a new lightweight API endpoint or computed client-side against cached agent/sale data.

**Confidence:** HIGH -- every primitive exists; this is composition, not new capability.

### 2. Payroll Agent Tab Navigation

**What's needed:** Replace scrollable agent card list with left sidebar agent tabs. Clicking an agent shows their last 4 pay periods. "Load More" button fetches older periods.

**Stack approach:**
- **Agent sidebar:** NOT the PageShell sidebar (that's for top-level nav: Periods/Chargebacks/Exports/Products/Service). This is a nested sidebar within the Periods tab content area. Build with a `<div>` flex layout: left panel (agent list) + right panel (period content). Uses existing `colors.bgSurface`, `colors.borderSubtle`, `spacing` tokens.
- **Agent list rendering:** Map over `allAgents` array (already fetched on page load). Active agent highlighted with `colors.accentGradient` or `colors.accentBlue`. Follows the existing NavItem pill pattern from PageShell but as a vertical scrollable list.
- **Paginated period loading:** New API endpoint `GET /payroll/agents/:agentId/periods?limit=4&offset=0` returning periods with entries scoped to that agent. This replaces the current monolithic `GET /payroll/periods` that fetches ALL periods with ALL entries for ALL agents.
- **"Load More" button:** Standard `@ops/ui` Button component with loading state. Appends results to existing `AgentPeriodData[]` state.
- **Data architecture change:** Current approach fetches all periods globally then regroups client-side in `useMemo`. New approach fetches per-agent on tab click. This is the most significant change -- it moves from "fetch everything, regroup" to "fetch on demand per agent."

**Confidence:** HIGH -- standard React patterns with existing UI tokens.

### 3. API Changes Needed

| Endpoint | Method | Purpose | Why |
|----------|--------|---------|-----|
| `/payroll/agents/:id/periods` | GET | Paginated periods for one agent | Replaces client-side regrouping of monolithic fetch; enables "Load More" |
| `/chargebacks/preview` | POST | Pre-submit match preview | Returns match status per parsed row without creating records |

Both endpoints use existing patterns: Express router, Zod validation, Prisma queries, asyncHandler wrapper.

**Prisma query for agent-scoped periods:**
```typescript
// Find periods where this agent has entries OR adjustments, ordered desc, with limit/offset
const periods = await prisma.payrollPeriod.findMany({
  where: {
    OR: [
      { entries: { some: { sale: { agentId } } } },
      { agentAdjustments: { some: { agentId } } },
    ],
  },
  include: {
    entries: {
      where: { sale: { agentId } },
      include: { sale: { select: { /* existing fields */ } }, agent: { select: { name: true } } },
    },
    agentAdjustments: {
      where: { agentId },
      include: { agent: { select: { id: true, name: true } } },
    },
    // No serviceEntries -- those are not agent-scoped
  },
  orderBy: { weekStart: "desc" },
  take: limit,
  skip: offset,
});
```

**Confidence:** HIGH -- Prisma relation filtering is well-documented and this uses standard patterns already in the codebase.

## Libraries Explicitly NOT to Add

| Library | Why Not |
|---------|---------|
| react-table / TanStack Table | Overkill. Existing raw `<table>` pattern handles sorting/filtering inline. Review table is simple enough. |
| react-hook-form / Formik | Codebase uses submit-only validation with useState. Adding a form lib would be inconsistent. |
| react-virtualized / react-window | Agent list will have 10-30 agents. Virtualization is unnecessary at this scale. |
| @tanstack/react-query | Data fetching uses authFetch + useState. Adding a query cache layer would be a codebase-wide pattern change, not a point addition. |
| Any CSS-in-JS library | Inline CSSProperties is the established pattern. No Tailwind, no styled-components, no CSS modules. |
| Pagination component library | "Load More" is a single Button click. No complex pagination UI needed. |
| Zustand / Redux | State is component-local with prop drilling. The payroll page already manages complex state this way with 15+ useState calls. |

## Installation

```bash
# No new packages needed
# Existing dependencies cover all requirements
```

## Database Schema Changes

No new tables needed. The existing schema supports both features:

- **Chargeback batch review:** `ChargebackSubmission` table already has `batchId`, `matchedSaleId`, `matchStatus` fields. The preview endpoint is read-only (no schema change).
- **Agent-scoped period queries:** `PayrollEntry` already has `sale.agentId` relation. `AgentPeriodAdjustment` already has `agentId` field. Prisma can filter by these without migration.

**Potential optimization:** Add a database index on `Sale.agentId` + `PayrollEntry.saleId` if agent-scoped queries are slow. Check with `EXPLAIN ANALYZE` before adding.

## Sources

- Codebase analysis: `apps/ops-dashboard/app/(dashboard)/payroll/` (AgentCard.tsx, PayrollPeriods.tsx, payroll-types.ts, WeekSection.tsx)
- Codebase analysis: `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx` (existing parser)
- Codebase analysis: `apps/ops-api/src/routes/chargebacks.ts` (existing API)
- Codebase analysis: `apps/ops-api/src/routes/payroll.ts` (existing periods endpoint)
- Codebase analysis: `packages/ui/src/` (available UI primitives)
- Project constraints: CLAUDE.md, PROJECT.md
