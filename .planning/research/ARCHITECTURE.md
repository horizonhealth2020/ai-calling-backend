# Architecture Patterns

**Domain:** Payroll card overhaul, carryover system, agent-level adjustments
**Researched:** 2026-04-01

## Current Architecture (Relevant Subset)

### Payroll Data Flow

```
Sale Created/Updated
  |
  v
payroll.ts service: upsertPayrollEntryForSale()
  |-- calculateCommission() (pure function)
  |-- getSundayWeekRange() (determines period)
  |-- findOrCreate PayrollPeriod
  |-- create/update PayrollEntry (per-sale, per-period)
  |
  v
Socket.IO: emit "payroll:updated"
  |
  v
PayrollPeriods.tsx: re-fetches /payroll/periods
  |-- Groups entries by period
  |-- Renders PeriodCard per period
  |     |-- Renders agent sections within each period
  |     |-- Each section: agent name header + sale rows table
  |
  v
Print: window.open() with template literal HTML
```

### Component Boundaries (Current)

| Component | Responsibility | Location |
|-----------|---------------|----------|
| `payroll.ts` service | Commission calc, period management, entry upsert | `apps/ops-api/src/services/payroll.ts` |
| `payroll.ts` routes | CRUD endpoints, Zod validation, mark paid/unpaid | `apps/ops-api/src/routes/payroll.ts` |
| `PayrollPeriods.tsx` | Full payroll UI: period list, agent cards, print, editing | `apps/ops-dashboard/app/(dashboard)/payroll/` |
| `PayrollProducts.tsx` | Product CRUD with type-specific forms | Same directory |

### Current Entry Storage Pattern

PayrollEntry stores bonus/fronted/hold per-sale even though they are conceptually agent-level:

```
PayrollEntry (one per sale per period):
  - payoutAmount    (sale-specific: commission earned)
  - adjustmentAmount (sale-specific: clawback deductions)
  - bonusAmount     (agent-level: stored on first active entry)
  - frontedAmount   (agent-level: stored on first active entry)
  - holdAmount      (agent-level: stored on first active entry)
  - netAmount       (computed: payout + adjustment + bonus - fronted - hold)
```

The UI sums these across all entries for an agent in a period to compute the agent-level totals.

## Recommended Architecture Changes

### Change 1: Carryover as a Period Transition Hook

**Pattern:** When period status changes to LOCKED, scan for carryover-eligible agents and create adjustment entries in the next period.

```
Period Status: OPEN -> LOCKED
  |
  v
carryover.ts service: processCarryover(periodId)
  |
  |-- Query: all PayrollEntries in this period grouped by agentId
  |-- For each agent with frontedAmount > 0 or holdAmount > 0:
  |     |-- Find or create next period (getSundayWeekRange + 1 week)
  |     |-- Find agent's first PayrollEntry in next period
  |     |-- If no entry exists: create a "carryover" entry
  |     |-- Set holdAmount = previous fronted, bonusLabel = "Hold Payout"
  |     |-- Audit log: record carryover with amounts and source period
  |
  v
Socket.IO: emit "payroll:updated" (next period now has new entries)
```

**Why this pattern:** Carryover is triggered by an explicit user action (locking a period), not by automatic detection. This gives payroll staff control over timing. The existing `PATCH /payroll/periods/:id/status` endpoint is the natural hook point.

**Idempotency:** If a period is toggled LOCKED -> OPEN -> LOCKED, the carryover must not duplicate. Use a flag or check for existing carryover entries before creating new ones.

### Change 2: Agent-Level Grouping in PeriodCard

**Current structure:**
```
PeriodCard
  |-- flat list of entries sorted by agent
  |-- agent header rows interspersed with sale rows
```

**Proposed structure:**
```
PeriodCard
  |-- entries grouped by agentId (Object.groupBy or reduce)
  |-- AgentCard per agent (collapsible)
  |     |-- Header: agent name, totals, bonus/fronted/hold inputs
  |     |-- Body (expandable): week-by-week sale entries table
  |     |     |-- Week header rows
  |     |     |-- Sale rows within each week
```

**Why this pattern:** The existing expand/collapse pattern (period cards use `expandedPeriod` state + ChevronDown) is reusable. Agent cards follow the same boolean-state toggle.

### Change 3: Print Template Aligned to New Card Structure

The print HTML template must match the restructured card layout:

```
Print HTML per agent:
  Agent Name | Total Commission | Bonus ($label) | Fronted | Hold | Net
  ---
  Week of [date range]:
    Sale rows: Member | Product | Premium | Commission | [Approved pill] | Addons
  Week of [date range]:
    Sale rows...
```

**Key changes:**
- No Net column on individual sale rows
- Approved pill (green badge) on rows where `commissionApproved && halvingReason`
- Addon names cleaned up (strip prefix, normalize casing)
- Agent-level summary row shows bonus with custom label

### Data Flow for Carryover

```
                    Period N (OPEN -> LOCKED)
                    +-----------------------+
                    | Agent A:              |
                    |   fronted: $200       |
                    |   hold: $100          |
                    +-----------------------+
                              |
                    processCarryover()
                              |
                              v
                    Period N+1 (OPEN)
                    +-----------------------+
                    | Agent A:              |
                    |   hold: +$200         | <-- from previous fronted
                    |   bonusLabel:         |
                    |     "Hold Payout"     |
                    |   bonus: +$100        | <-- from previous hold
                    |   bonusLabel:         |
                    |     "Hold Release"    |
                    +-----------------------+
```

**Edge cases:**
1. Agent has no sales in next period: Create a "carryover-only" PayrollEntry with $0 payout but nonzero hold/bonus.
2. Next period does not exist yet: Create it using `getSundayWeekRange(currentPeriod.weekEnd + 1 day)`.
3. Status toggled back to OPEN after LOCKED: Remove carryover entries from next period (if unmodified).

## Patterns to Follow

### Pattern 1: Service Function + Route Hook

**What:** Business logic in a service function, called from route handler after status update succeeds.

**When:** Implementing carryover.

```typescript
// In payroll routes (existing PATCH /payroll/periods/:id/status):
const updated = await prisma.payrollPeriod.update(...);
if (parsed.data.status === "LOCKED") {
  await processCarryover(pp.data.id);
}
```

### Pattern 2: GroupBy for Agent-Level Rendering

**What:** Group entries by agentId using reduce/Map, render one AgentCard per group.

```typescript
const agentGroups = useMemo(() => {
  const groups = new Map<string, { agent: { name: string }; entries: Entry[] }>();
  for (const entry of period.entries) {
    const key = entry.agent?.name ?? "Unknown";
    if (!groups.has(key)) groups.set(key, { agent: entry.agent!, entries: [] });
    groups.get(key)!.entries.push(entry);
  }
  return [...groups.values()].sort((a, b) => a.agent.name.localeCompare(b.agent.name));
}, [period.entries]);
```

### Pattern 3: Prisma Transaction for Carryover Atomicity

**What:** Wrap carryover creation in `prisma.$transaction()`.

**Why:** Partial carryover (some agents carried, others not) is worse than no carryover.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate AgentPeriodAdjustment Table

**What:** New table for agent+period level bonus/fronted/hold.

**Why bad:** Requires new API endpoints, new types, data migration, and dual-table net calculation. The "first active entry" pattern works.

**Instead:** Keep on PayrollEntry. UI hides per-sale inputs, shows agent-level summary.

### Anti-Pattern 2: Eager Carryover on Period Creation

**What:** Auto-creating carryover when new period is created by a sale entry.

**Why bad:** Creates phantom entries for agents who might not have sales in the new period.

**Instead:** Trigger only on explicit period lock.

### Anti-Pattern 3: Changing the Net Amount Formula

**What:** Modifying formula for "fronted as positive" display.

**Why bad:** Formula is correct. Fronted IS a deduction from net. Display change is cosmetic.

**Instead:** Display-only change. Show fronted as positive with "Advanced" label.

## Integration Points Summary

| Change | API | Service | Database | Client |
|--------|-----|---------|----------|--------|
| Carryover | Hook in PATCH status | New processCarryover() | Migration: bonusLabel | Carryover indicator |
| Bonus label | Extend PATCH entry | None | Migration: bonusLabel | Dropdown on agent header |
| Agent-level inputs | No change | No change | No change | Move inputs to agent header |
| Card restructure | No change | No change | No change | Refactor PeriodCard |
| Print enhancements | No change | No change | No change | Edit template strings |
| ACA products | No change | No change | No change | Add ACA_PL to type maps |
| Zero-value fix | No change | No change | No change | Fix client value handling |

## Sources

- `apps/ops-api/src/services/payroll.ts` -- service pattern, getSundayWeekRange
- `apps/ops-api/src/routes/payroll.ts` -- route pattern, PATCH endpoints
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` -- PeriodCard, print templates
- `prisma/schema.prisma` -- PayrollEntry model, PayrollPeriod lifecycle
