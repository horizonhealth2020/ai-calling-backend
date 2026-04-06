# Phase 40: Agent-Level Adjustments + Carryover System - Context

**Gathered:** 2026-04-06 (updated)
**Status:** Ready for planning

<domain>
## Phase Boundary

Move bonus/fronted/hold to agent-level storage (AgentPeriodAdjustment table), fix the net formula (fronted is added, not subtracted), implement automatic carryover on period lock, fix Approve button logic to be halvingReason-based, and fix print view pill positioning.

</domain>

<decisions>
## Implementation Decisions

### Net formula
- **D-01:** Net formula is `Commission + Bonus + Fronted - Hold`. Fronted is money advanced to the agent (positive on current check). It then carries as hold next week (deduction).
- **D-02:** This formula applies uniformly everywhere: dashboard live net (WeekSection), API net calculation, print summary net, and CSV export. No view-specific variations.

### Approve/Unapprove button logic
- **D-03:** Approve button logic uses halvingReason-based checks: show Approve when `halvingReason` exists AND `commissionApproved` is false.
- **D-04:** Unapprove button mirrors: show when `halvingReason` exists AND `commissionApproved` is true.
- **D-05:** Approving a half-commission deal recalculates to full commission (unchanged behavior).
- **D-06:** The period-level "needs approval" badge count (page.tsx:257) MUST also switch to halvingReason-based: `entries.filter(e => !!e.halvingReason && !e.sale?.commissionApproved)`. Currently still uses the old `enrollmentFee < 99` logic — this is a confirmed bug to fix.

### Print view pill positioning
- **D-07:** Half-commission and Approved pills appear to the LEFT of the commission amount on the same line (commFlagHtml before `$${amount}`), so commission values stay in a straight vertical column.
- **D-08:** Approved sales show the green "Approved" pill in print view. Condition: `e.halvingReason && e.sale?.commissionApproved`.

### Carryover flow
- **D-09:** On period lock: current fronted amount carries to next period as hold. Fronted = cash advance agent must repay.
- **D-10:** On period lock: if agent net goes negative, the unpaid portion (abs of negative net) carries to next period as additional hold.
- **D-11:** Carryover amounts ADD to existing values in the next period (increment, not overwrite). Preserves any manual adjustments already entered.
- **D-12:** Bonus does NOT carry over. Only fronted and unpaid hold carry.
- **D-13:** Unlocking a period does NOT auto-reverse carryover in the next period. Payroll adjusts manually. This prevents accidental data loss.
- **D-14:** Carryover is idempotent via `carryoverExecuted` flag on PayrollPeriod. Lock/unlock does not create duplicate entries.

### Agent-level input storage
- **D-15:** AgentPeriodAdjustment table stores bonus/fronted/hold at agent+period level. One row per agent+period with bonus, fronted, hold amounts, labels, carryover flags, and source period reference.
- **D-16:** Agent card header inputs (Bonus, Fronted, Hold) stay in current layout via WeekSection component.
- **D-17:** No per-sale adjustment inputs — agent-level only.
- **D-18:** Agents with zero sales in a period show a card when carryover adjustments exist. Enables visibility and editing of carryover amounts even before sales are entered.

### Carryover label UX
- **D-19:** Bonus label shows "Hold Payout" when `bonusFromCarryover` is true. Shows "Bonus" otherwise.
- **D-20:** Hold label shows "Fronted Hold" when `holdFromCarryover` is true (and hold > 0). Shows "Hold" otherwise.
- **D-21:** Labels are editable inline via EditableLabel component — click to change. Payroll can override the automatic label.
- **D-22:** Subtle CarryoverHint below the input indicates carryover source (e.g., "Carried from prev week"). Shown when carryover flag is true and amount > 0.

### Claude's Discretion
- Migration strategy for any remaining entry-level values
- How to handle zero-sales agent card rendering details
- Exact CarryoverHint styling

</decisions>

<specifics>
## Specific Ideas

- Fronted is a cash advance: agent gets it NOW, pays it back next week as hold
- If net goes negative (hold > income), only the unpaid portion carries — not the full hold amount
- Agent cards must appear even with zero sales if carryover exists, showing negative net if applicable
- "Hold Payout" label is the specific text for bonus sourced from carryover
- Badge count fix at page.tsx:257 is the primary remaining implementation gap

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above and v2.1-REQUIREMENTS.md (CARRY-01 through CARRY-09, FIX-06 through FIX-08, NET-01).

### Requirements
- `.planning/milestones/v2.1-REQUIREMENTS.md` — CARRY-01 to CARRY-09, FIX-06 to FIX-08, NET-01

### Existing implementation
- `apps/ops-api/src/services/carryover.ts` — Carryover execution service (D-09, D-10, D-11, D-14)
- `prisma/schema.prisma` — AgentPeriodAdjustment model (line 698+)
- `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` — Agent adjustment inputs, EditableLabel, CarryoverHint
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — Print view pill logic (line 544+), net calculation (line 517)
- `apps/ops-dashboard/app/(dashboard)/payroll/page.tsx` — Badge count (line 257, needs fix)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `carryover.ts`: Complete carryover service with idempotent execution
- `WeekSection.tsx`: Agent card with EditableLabel, CarryoverHint, handleHeaderBlur for adjustment CRUD
- `AgentPeriodAdjustment` Prisma model with all fields (bonus, fronted, hold, labels, carryover flags, source period)
- `payroll.ts` API routes: adjustment CRUD endpoints already implemented

### Established Patterns
- Inline React.CSSProperties styling (no Tailwind)
- `authFetch()` for API calls with Bearer token
- `asyncHandler()` wrapper for Express routes
- Zod validation on API endpoints
- `logAudit()` for sensitive operations
- Delta-based input update via `handleHeaderBlur()`

### Integration Points
- **Period lock endpoint** — triggers `executeCarryover()` from carryover.ts
- **Net calculation** — WeekSection line 517 (dashboard), PayrollPeriods line 517 (print)
- **Approve button** — WeekSection line 117-118 (halvingReason-based, correct)
- **Badge count** — page.tsx line 257 (still fee-based, needs fix to halvingReason)
- **Print pills** — PayrollPeriods line 560 (commFlagHtml before amount, correct)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-agent-level-adjustments-carryover-system*
*Context gathered: 2026-04-06*
