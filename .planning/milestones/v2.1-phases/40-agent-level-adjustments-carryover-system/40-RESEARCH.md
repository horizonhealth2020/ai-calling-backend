# Phase 40: Agent-Level Adjustments + Carryover System - Research

**Researched:** 2026-04-01
**Domain:** Payroll carryover logic, Prisma schema migration, React inline-edit UX
**Confidence:** HIGH

## Summary

This phase restructures how bonus/fronted/hold values are stored (moving from per-entry to per-agent-per-period), fixes the net formula (fronted becomes additive), implements automatic carryover on period lock, and fixes approval button logic and print view pill positioning.

The codebase is well-understood. All changes are within two files primarily: `PayrollPeriods.tsx` (1909 lines) for the frontend and `payroll.ts` routes/services for the backend. A new Prisma model `AgentPeriodAdjustment` must be created, the period lock endpoint must trigger carryover logic, and the dashboard must read adjustment values from the new table instead of summing entry-level fields.

**Primary recommendation:** Start with the schema migration and data migration, then fix the net formula everywhere simultaneously (API + dashboard + print), then implement carryover logic on lock, then fix the UI issues (approval buttons, print pills, labels).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Net formula changes from `Commission + Bonus - Fronted - Hold` to `Commission + Bonus + Fronted - Hold`. Fronted is money advanced to the agent (positive on current check). It then carries as hold next week (deduction).
- D-02: This formula change applies everywhere: dashboard live net, API net calculation, print summary net, and any payroll reports.
- D-03: Approve button logic changes from enrollment fee-based (`fee < 99`) to halvingReason-based. Show Approve when `halvingReason` exists AND `commissionApproved` is false.
- D-04: Unapprove button mirrors: show when `halvingReason` exists AND `commissionApproved` is true.
- D-05: Approving a half-commission deal recalculates to full commission (current behavior, unchanged).
- D-06: The period-level "needs approval" filter (line 1526 area) must also switch to halvingReason-based.
- D-07: Half-commission and Approved pills appear to the LEFT of the commission amount on the same line, so commission values stay in a straight vertical column.
- D-08: Approved sales must show the green "Approved" pill in print view (currently missing for some approved sales).
- D-09: On period lock: current fronted amount carries to next period as hold.
- D-10: On period lock: if hold exceeds (commission + fronted + bonus) and net goes negative, the negative amount carries to next period as hold.
- D-11: Carryover amounts ADD to existing values in the next period (don't overwrite).
- D-12: Current bonus does NOT carry over. Only fronted and unpaid hold carry.
- D-13: Unlocking a period does NOT reverse carryover in the next period. Payroll adjusts manually.
- D-14: Carryover is idempotent -- locking/unlocking repeatedly does not create duplicate entries.
- D-15: New `AgentPeriodAdjustment` table to store bonus/fronted/hold at agent+period level instead of on individual sale entries.
- D-16: Agent card header inputs (Bonus, Fronted, Hold) stay in current layout -- no UI redesign.
- D-17: No per-sale inputs exist to remove -- CARRY-01 is already satisfied at UI level. Migration is purely backend.
- D-18: Agents with zero sales in a period still show a card with bonus/fronted/hold inputs.
- D-19: Bonus label shows "Hold Payout" when sourced from carryover. Shows "Bonus" otherwise.
- D-20: Hold label shows "Fronted Hold" when sourced from fronted carryover. Shows "Hold" otherwise.
- D-21: Labels are editable by clicking inline.
- D-22: Subtle text note below the input indicates carryover source.

### Claude's Discretion
- AgentPeriodAdjustment table schema details (columns, indexes, constraints)
- Migration strategy for moving existing entry-level values to agent-level table
- How to handle the zero-sales agent card rendering (placeholder entry vs separate query)
- Exact carryover source label text and styling
- Inline label edit interaction (click-to-edit component pattern)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIX-06 | Approve/Unapprove button based on halvingReason (not enrollment fee threshold) | Lines 212-213 in PayrollPeriods.tsx need `halvingReason`-based logic; line 1525-1526 period-level filter also |
| FIX-07 | Print view pills positioned left of commission amount for column alignment | Line 1337: move `commFlagHtml` before `$${amount}` in template literal |
| FIX-08 | Approved sales show green Approved pill in print view (fix missing pill bug) | Line 1318: condition `e.halvingReason && e.sale?.commissionApproved` -- investigate entries where halvingReason cleared on approve |
| NET-01 | Net formula changed to Commission + Bonus + Fronted - Hold | Four locations: payroll.ts:354, payroll routes:206, PayrollPeriods.tsx:789, print summary:1291 |
| CARRY-01 | Bonus/fronted/hold stored at agent+period level (AgentPeriodAdjustment table) | New Prisma model + migration + data migration from existing entry-level values |
| CARRY-02 | Fronted auto-carries as hold in next period on lock | Period lock endpoint (payroll routes:30-42) must trigger carryover logic |
| CARRY-03 | Negative net carries as hold in next period | Same lock endpoint; calculate net per agent, carry unpaid portion |
| CARRY-04 | Carryover amounts editable after auto-population | AgentPeriodAdjustment PATCH endpoint + dashboard input integration |
| CARRY-05 | Bonus label shows "Hold Payout" when from carryover; hold label shows source; labels editable inline | New `bonusLabel`/`holdLabel` columns + click-to-edit UI component |
| CARRY-06 | Carryover idempotent -- lock/unlock does not duplicate | Use upsert pattern with unique constraint on agentId+periodId |
| CARRY-07 | Carryover adds to existing values (no overwrite) | Increment pattern: `existing.holdAmount + carryoverAmount` in upsert |
| CARRY-08 | Agent cards appear with zero sales if carryover exists | Query AgentPeriodAdjustment alongside entries; merge into byAgent map |
| CARRY-09 | Subtle "Carried from prev week" text below inputs when values are from carryover | `fromCarryover` boolean fields on AgentPeriodAdjustment + UI rendering |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | existing | Schema migration, new model, data migration | Already used for all DB operations |
| Express | existing | New/modified API endpoints for adjustments | Already used for all API routes |
| React | existing | Dashboard component updates | Already used, inline CSSProperties pattern |
| Zod | existing | Request validation for new endpoints | Already used for all API validation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| luxon | existing | Date arithmetic for next-period calculation | Already imported in payroll.ts for week range |

No new dependencies required. Everything is achievable with the existing stack.

## Architecture Patterns

### New Model: AgentPeriodAdjustment

```prisma
model AgentPeriodAdjustment {
  id              String   @id @default(cuid())
  agentId         String   @map("agent_id")
  payrollPeriodId String   @map("payroll_period_id")
  bonusAmount     Decimal  @default(0) @map("bonus_amount") @db.Decimal(12, 2)
  frontedAmount   Decimal  @default(0) @map("fronted_amount") @db.Decimal(12, 2)
  holdAmount      Decimal  @default(0) @map("hold_amount") @db.Decimal(12, 2)
  bonusLabel      String?  @map("bonus_label")    // null = "Bonus", "Hold Payout" when from carryover
  holdLabel       String?  @map("hold_label")     // null = "Hold", "Fronted Hold" when from carryover
  bonusFromCarryover  Boolean @default(false) @map("bonus_from_carryover")
  holdFromCarryover   Boolean @default(false) @map("hold_from_carryover")
  carryoverSourcePeriodId String? @map("carryover_source_period_id")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  agent         Agent         @relation(fields: [agentId], references: [id])
  payrollPeriod PayrollPeriod @relation(fields: [payrollPeriodId], references: [id])

  @@unique([agentId, payrollPeriodId])
  @@map("agent_period_adjustments")
}
```

**Key design decisions:**
- `@@unique([agentId, payrollPeriodId])` enables upsert for idempotent carryover (CARRY-06)
- `bonusLabel`/`holdLabel` nullable: null means default label, non-null means custom/carryover label (CARRY-05)
- `bonusFromCarryover`/`holdFromCarryover` booleans for rendering "Carried from prev week" text (CARRY-09)
- `carryoverSourcePeriodId` optional reference for audit trail

### Relations to Add

On `Agent` model:
```prisma
periodAdjustments AgentPeriodAdjustment[]
```

On `PayrollPeriod` model:
```prisma
agentAdjustments AgentPeriodAdjustment[]
```

### Net Formula Change Pattern

**Old formula (4 locations):**
```typescript
net = payout + adjustment + bonus - fronted - hold
```

**New formula (all 4 locations):**
```typescript
net = payout + adjustment + bonus + fronted - hold
```

Locations requiring change:
1. `apps/ops-api/src/services/payroll.ts` line 354: `upsertPayrollEntryForSale`
2. `apps/ops-api/src/routes/payroll.ts` line 206: PATCH `/payroll/entries/:id`
3. `apps/ops-dashboard/.../PayrollPeriods.tsx` line 789: `liveNet` calculation
4. `apps/ops-dashboard/.../PayrollPeriods.tsx` line 1291: print summary net (uses `agentNet` which is `netAmount` from server -- will be correct once API is fixed)

**Important:** The print summary at line 1291 uses `entries.reduce((s, e) => s + Number(e.netAmount), 0)` which reads the pre-computed `netAmount` from the server. Once the API formula is fixed, this will automatically be correct. However, the live net display at line 789 computes client-side and must also change.

### Carryover Logic (on Period Lock)

```typescript
// In period lock endpoint (payroll routes)
async function executeCarryover(periodId: string) {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    include: { agentAdjustments: true, entries: true }
  });
  
  // Calculate next period dates
  const nextWeekStart = new Date(period.weekEnd.getTime() + 86400000); // +1 day
  const { weekStart, weekEnd } = getSundayWeekRange(nextWeekStart);
  const nextPeriodId = `${weekStart.toISOString()}_${weekEnd.toISOString()}`;
  
  // Ensure next period exists
  const nextPeriod = await prisma.payrollPeriod.upsert({ ... });
  
  // For each agent with adjustments in this period:
  for (const adj of period.agentAdjustments) {
    const agentEntries = period.entries.filter(e => e.agentId === adj.agentId);
    const totalPayout = agentEntries.reduce((s, e) => s + Number(e.payoutAmount), 0);
    const agentNet = totalPayout + Number(adj.bonusAmount) + Number(adj.frontedAmount) - Number(adj.holdAmount);
    
    let carryHold = 0;
    
    // D-09: Fronted carries as hold
    carryHold += Number(adj.frontedAmount);
    
    // D-10: Negative net carries as hold (unpaid portion)
    if (agentNet < 0) {
      carryHold += Math.abs(agentNet);
    }
    
    if (carryHold <= 0) continue;
    
    // D-14: Idempotent upsert (CARRY-06)
    // D-11: Add to existing, don't overwrite (CARRY-07)
    const existing = await prisma.agentPeriodAdjustment.findUnique({
      where: { agentId_payrollPeriodId: { agentId: adj.agentId, payrollPeriodId: nextPeriodId } }
    });
    
    await prisma.agentPeriodAdjustment.upsert({
      where: { agentId_payrollPeriodId: { agentId: adj.agentId, payrollPeriodId: nextPeriodId } },
      create: {
        agentId: adj.agentId,
        payrollPeriodId: nextPeriodId,
        holdAmount: carryHold,
        holdFromCarryover: true,
        holdLabel: "Fronted Hold",
        carryoverSourcePeriodId: periodId,
      },
      update: {
        holdAmount: { increment: carryHold }, // CARRY-07: add, don't overwrite
        holdFromCarryover: true,
        holdLabel: "Fronted Hold",
        carryoverSourcePeriodId: periodId,
      },
    });
  }
}
```

**Idempotency approach (CARRY-06):** On re-lock after unlock, the carryover runs again. Since D-13 says unlocking does NOT reverse carryover, and D-14 says it must be idempotent, the solution is to track that carryover already happened. Options:
1. Store a `carryoverExecuted` boolean on the period -- skip if already true
2. Store carryover records separately with source/target period IDs

**Recommendation:** Add a `carryoverExecuted` boolean on `PayrollPeriod`. Set to `true` after first lock. On subsequent locks, skip carryover. On unlock, do NOT reset this flag (per D-13). This is the simplest idempotency approach.

### Approval Button Logic Change

**Current (enrollment fee-based):**
```typescript
// Line 212-213
const needsApproval = fee !== null && fee < 99 && !entry.sale?.commissionApproved;
const isApproved = entry.sale?.commissionApproved && fee !== null && fee < 99;
```

**New (halvingReason-based):**
```typescript
const needsApproval = !!entry.halvingReason && !entry.sale?.commissionApproved;
const isApproved = !!entry.halvingReason && entry.sale?.commissionApproved;
```

**Period-level filter (line 1525-1526):**
```typescript
// Current
const needsApproval = p.entries.filter(
  e => e.sale && e.sale.enrollmentFee !== null && Number(e.sale.enrollmentFee) < 99 && !e.sale.commissionApproved
);
// New
const needsApproval = p.entries.filter(
  e => e.halvingReason && !e.sale?.commissionApproved
);
```

### Print Pill Positioning (FIX-07)

**Current (line 1337):**
```html
<td class="right" style="font-weight:700">$${amount}${commFlagHtml}</td>
```

**New:**
```html
<td class="right" style="font-weight:700">${commFlagHtml}$${amount}</td>
```

Pills appear inline-block, so placing them before the dollar amount pushes the amount to the right, maintaining column alignment.

### FIX-08: Missing Approved Pill Bug

The condition at line 1318 is:
```typescript
if (e.halvingReason && e.sale?.commissionApproved) {
  commFlags.push(`<div class="pill pill-approved">Approved</div>`);
}
```

**Root cause hypothesis:** When a sale is approved, `upsertPayrollEntryForSale` recalculates commission. The `calculateCommission` function returns `halvingReason: null` when `commissionApproved` is true (because the halving is skipped). So the payroll entry's `halvingReason` gets cleared to `null` on recalculation, and the condition `e.halvingReason && e.sale?.commissionApproved` fails.

**Fix:** The `halvingReason` should be preserved on the entry even after approval, so it can still be displayed. Alternatively, change the print condition to check the sale's `commissionApproved` independently. The cleanest fix: in `calculateCommission` or `upsertPayrollEntryForSale`, store the original halving reason even when commission is approved. This aligns with D-03/D-04 which use halvingReason as the source of truth for showing buttons.

**Recommended approach:** In `upsertPayrollEntryForSale`, always store the halvingReason from the calculation BEFORE the commissionApproved skip. This requires a small refactor: calculate halvingReason independently of whether commission was actually halved.

### Data Migration Strategy

Move existing bonus/fronted/hold from `PayrollEntry` to `AgentPeriodAdjustment`:

```sql
-- Migration: aggregate entry-level values to agent+period level
INSERT INTO agent_period_adjustments (id, agent_id, payroll_period_id, bonus_amount, fronted_amount, hold_amount, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  agent_id,
  payroll_period_id,
  SUM(bonus_amount),
  SUM(fronted_amount),
  SUM(COALESCE(hold_amount, 0)),
  NOW(),
  NOW()
FROM payroll_entries
WHERE bonus_amount > 0 OR fronted_amount > 0 OR COALESCE(hold_amount, 0) > 0
GROUP BY agent_id, payroll_period_id
ON CONFLICT (agent_id, payroll_period_id) DO UPDATE SET
  bonus_amount = EXCLUDED.bonus_amount,
  fronted_amount = EXCLUDED.fronted_amount,
  hold_amount = EXCLUDED.hold_amount;
```

**After migration:** Zero out entry-level bonus/fronted/hold columns (or leave them for backward compat and remove in a later phase). Recommendation: zero them out to avoid confusion, and update the net formula on entries to be `payout + adjustment` only, with the agent-level adjustments applied at the aggregate level.

### Zero-Sales Agent Card Rendering (CARRY-08)

**Current behavior:** Line 1529-1534 builds `byAgent` map from `p.entries`. Line 1535-1537 adds all active agents with empty arrays. This means agents without sales already appear -- but only from `allAgents`.

**For carryover:** An agent with carryover but no sales AND who might not be in `allAgents` (e.g., inactive) needs to appear. The solution:
1. Include `agentAdjustments` in the period query (add to the GET `/payroll/periods` include)
2. In the `byAgent` map construction, also add agents from `agentAdjustments`
3. Pass adjustment data to `AgentPayCard` so it can display values even with empty entries

### Click-to-Edit Label Component

Simple inline pattern (no library needed):

```typescript
function EditableLabel({ value, onChange, defaultLabel }: { value: string | null; onChange: (v: string) => void; defaultLabel: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? defaultLabel);
  
  if (!editing) {
    return (
      <span onClick={() => setEditing(true)} style={{ cursor: "pointer", ...HEADER_LBL }}>
        {value ?? defaultLabel}
      </span>
    );
  }
  
  return (
    <input
      autoFocus
      style={{ ...SMALL_INP, width: 100, fontSize: 11 }}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onChange(draft); setEditing(false); }}
      onKeyDown={e => { if (e.key === "Enter") { onChange(draft); setEditing(false); } }}
    />
  );
}
```

### Anti-Patterns to Avoid
- **Double-counting carryover:** If lock/unlock/lock creates duplicate hold, agents get charged twice. The `carryoverExecuted` flag prevents this.
- **Overwriting manual edits:** If payroll adjusts a carryover amount, then period is re-locked, the increment pattern would add MORE. The `carryoverExecuted` flag prevents re-execution entirely.
- **Client-side net formula divergence:** The dashboard computes `liveNet` client-side and the server computes `netAmount`. Both must use the same formula. Always update both simultaneously.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique constraint upsert | Manual check-then-insert | Prisma `upsert` with `@@unique` | Race conditions on concurrent locks |
| Date arithmetic for next period | Manual date math | `getSundayWeekRange` (existing) | Already handles timezone + Sunday-start weeks |
| Data migration | Manual UPDATE loop | Prisma migration with raw SQL | Atomic, reversible, part of migration history |

## Common Pitfalls

### Pitfall 1: halvingReason Cleared on Approve
**What goes wrong:** When a sale is approved, `upsertPayrollEntryForSale` recalculates and `calculateCommission` returns `halvingReason: null` because `commissionApproved` is true. The entry loses its halvingReason.
**Why it happens:** The halving logic short-circuits when `commissionApproved` is true.
**How to avoid:** Separate "reason for potential halving" from "was actually halved". Store the reason regardless of approval status. Either: (a) store reason before checking approval in `calculateCommission`, or (b) add a separate `halvingReasonOriginal` field.
**Warning signs:** Approved sales missing pills in print view; approve/unapprove buttons not appearing after approval.

### Pitfall 2: Net Formula Inconsistency Across Locations
**What goes wrong:** Formula changed in API but not in dashboard liveNet, or vice versa.
**Why it happens:** Four separate locations compute net.
**How to avoid:** Change all four locations in the same commit. Test: set fronted > 0, verify net increases (not decreases).
**Warning signs:** Dashboard shows different net than print view or API response.

### Pitfall 3: Carryover on Non-Existent Next Period
**What goes wrong:** Locking a period tries to create carryover in a next period that doesn't exist yet.
**Why it happens:** Periods are lazily created when sales are entered.
**How to avoid:** Always upsert the next period before creating carryover adjustments.

### Pitfall 4: Entry-Level Fields Still Used After Migration
**What goes wrong:** Old code reads `bonusAmount` from `PayrollEntry` instead of `AgentPeriodAdjustment`.
**Why it happens:** Many places reference entry-level fields.
**How to avoid:** After migration, zero out entry-level fields and update ALL reads to use the new table.

### Pitfall 5: Decimal Precision in Prisma
**What goes wrong:** `Decimal` values from Prisma are objects, not numbers. Arithmetic with them fails or produces NaN.
**Why it happens:** Prisma returns `Decimal` type for `@db.Decimal` columns.
**How to avoid:** Always `Number()` wrap Prisma Decimal values before arithmetic (existing pattern in codebase).

## Code Examples

### Existing Net Formula (to be changed)
```typescript
// apps/ops-api/src/services/payroll.ts line 354
const netAmount = payoutAmount + adjustment + bonus - fronted - hold;
// Change to:
const netAmount = payoutAmount + adjustment + bonus + fronted - hold;
```

### Existing Approval Logic (to be changed)
```typescript
// apps/ops-dashboard/.../PayrollPeriods.tsx line 212-213
const needsApproval = fee !== null && fee < 99 && !entry.sale?.commissionApproved;
const isApproved = entry.sale?.commissionApproved && fee !== null && fee < 99;
// Change to:
const needsApproval = !!entry.halvingReason && !entry.sale?.commissionApproved;
const isApproved = !!entry.halvingReason && !!entry.sale?.commissionApproved;
```

### Existing Print Pill (to be repositioned)
```typescript
// Line 1337
`<td class="right" style="font-weight:700">$${Number(e.payoutAmount).toFixed(2)}${commFlagHtml}</td>`
// Change to:
`<td class="right" style="font-weight:700">${commFlagHtml}$${Number(e.payoutAmount).toFixed(2)}</td>`
```

### Period Lock Carryover Integration Point
```typescript
// apps/ops-api/src/routes/payroll.ts line 30-42
// Current: just toggles status
// Must add: if newStatus === "LOCKED", call executeCarryover(periodId)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bonus/fronted/hold on PayrollEntry | Agent+period level (AgentPeriodAdjustment) | This phase | Enables carryover, zero-sale cards |
| Net = Commission + Bonus - Fronted - Hold | Net = Commission + Bonus + Fronted - Hold | This phase | Fronted correctly adds to current check |
| Approval by enrollment fee threshold | Approval by halvingReason existence | This phase | Correct button visibility for all half-commission cases |

## Open Questions

1. **Entry-level field cleanup timing**
   - What we know: Entry-level bonus/fronted/hold will be migrated to AgentPeriodAdjustment
   - What's unclear: Should entry-level columns be dropped in this phase or a future phase?
   - Recommendation: Zero them out in migration but keep columns. Remove in Phase 41 or later to avoid breaking rollback scenarios.

2. **halvingReason preservation on approve**
   - What we know: `calculateCommission` clears halvingReason when `commissionApproved` is true
   - What's unclear: Whether to change `calculateCommission` return value or handle it in `upsertPayrollEntryForSale`
   - Recommendation: Have `calculateCommission` always return the reason (add a separate `wouldHalve` boolean), and let `upsertPayrollEntryForSale` store the reason regardless. The `payoutAmount` already reflects whether halving was applied.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest |
| Config file | `apps/ops-api/jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern="commission\|payroll"` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NET-01 | Net formula: commission + bonus + fronted - hold | unit | `npm test -- payroll-guard.test.ts -t "net formula"` | Needs update (existing test at payroll-guard.test.ts:52 uses old formula) |
| CARRY-02 | Fronted carries as hold on lock | unit | `npm test -- carryover.test.ts` | Wave 0 |
| CARRY-03 | Negative net carries as hold | unit | `npm test -- carryover.test.ts -t "negative net"` | Wave 0 |
| CARRY-06 | Carryover idempotent on re-lock | unit | `npm test -- carryover.test.ts -t "idempotent"` | Wave 0 |
| CARRY-07 | Carryover adds to existing values | unit | `npm test -- carryover.test.ts -t "increment"` | Wave 0 |
| FIX-06 | Approve button based on halvingReason | manual-only | Visual verification on dashboard | N/A -- UI logic |
| FIX-07 | Print pills left of commission | manual-only | Visual print verification | N/A -- HTML template |
| FIX-08 | Approved pill visible in print | manual-only | Visual print verification | N/A -- depends on halvingReason fix |
| CARRY-01 | Agent-level storage via new table | unit | `npm test -- carryover.test.ts -t "agent period"` | Wave 0 |
| CARRY-04 | Carryover editable | integration | Manual API test (PATCH endpoint) | N/A |
| CARRY-05 | Labels show carryover source | manual-only | Visual verification | N/A -- UI |
| CARRY-08 | Zero-sale cards with carryover | manual-only | Visual verification | N/A -- UI |
| CARRY-09 | "Carried from prev week" text | manual-only | Visual verification | N/A -- UI |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern="commission|payroll|carryover" --bail`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before verify

### Wave 0 Gaps
- [ ] `apps/ops-api/src/services/__tests__/carryover.test.ts` -- covers CARRY-02, CARRY-03, CARRY-06, CARRY-07, CARRY-01
- [ ] Update `apps/ops-api/src/services/__tests__/payroll-guard.test.ts` -- update net formula test for NET-01
- [ ] Carryover service function must be extracted to a testable module (not inline in route handler)

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of:
  - `prisma/schema.prisma` -- current PayrollEntry model, all relations
  - `apps/ops-api/src/services/payroll.ts` -- commission calculation, net formula, upsert logic
  - `apps/ops-api/src/routes/payroll.ts` -- period lock endpoint, entry PATCH endpoint
  - `apps/ops-dashboard/.../PayrollPeriods.tsx` -- all UI logic (1909 lines)
  - `apps/ops-api/src/services/__tests__/commission.test.ts` -- existing test patterns
  - `apps/ops-api/src/services/__tests__/payroll-guard.test.ts` -- existing net formula test

### Secondary (MEDIUM confidence)
- Prisma documentation on `@@unique` composite constraints and `upsert` behavior -- well-established pattern already used in codebase (`@@unique([payrollPeriodId, saleId])` on PayrollEntry)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, all existing patterns
- Architecture: HIGH - schema design follows existing Prisma patterns, carryover logic is straightforward
- Pitfalls: HIGH - identified from direct code inspection (halvingReason clearing is the highest-risk issue)
- Net formula: HIGH - four locations identified with exact line numbers

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable internal codebase)
