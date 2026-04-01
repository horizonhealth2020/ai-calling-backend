# Phase 40: Agent-Level Adjustments + Carryover System - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Move bonus/fronted/hold to agent-level storage (new AgentPeriodAdjustment table), fix the net formula (fronted is added, not subtracted), implement automatic carryover on period lock, fix Approve button logic to be halvingReason-based, and fix print view pill positioning.

</domain>

<decisions>
## Implementation Decisions

### Net formula change
- **D-01:** Net formula changes from `Commission + Bonus - Fronted - Hold` to `Commission + Bonus + Fronted - Hold`. Fronted is money advanced to the agent (positive on current check). It then carries as hold next week (deduction).
- **D-02:** This formula change applies everywhere: dashboard live net, API net calculation, print summary net, and any payroll reports.

### Approve/Unapprove button logic
- **D-03:** Approve button logic changes from enrollment fee-based (`fee < 99`) to halvingReason-based. Show Approve when `halvingReason` exists AND `commissionApproved` is false.
- **D-04:** Unapprove button mirrors: show when `halvingReason` exists AND `commissionApproved` is true.
- **D-05:** Approving a half-commission deal recalculates to full commission (current behavior, unchanged).
- **D-06:** The period-level "needs approval" filter (line 1526 area) must also switch to halvingReason-based.

### Print view pill positioning
- **D-07:** Half-commission and Approved pills appear to the LEFT of the commission amount on the same line, so commission values stay in a straight vertical column.
- **D-08:** Approved sales must show the green "Approved" pill in print view (currently missing for some approved sales — the condition checks `e.halvingReason && e.sale?.commissionApproved` which should work, investigate why it fails for specific entries).

### Carryover flow
- **D-09:** On period lock: current fronted amount carries to next period as hold. Rationale: fronted = cash advance that agent must repay.
- **D-10:** On period lock: if hold exceeds (commission + fronted + bonus) and net goes negative, the negative amount (unpaid hold) carries to next period as hold.
- **D-11:** Carryover amounts ADD to existing values in the next period (don't overwrite).
- **D-12:** Current bonus does NOT carry over. Only fronted and unpaid hold carry.
- **D-13:** Unlocking a period does NOT reverse carryover in the next period. Payroll adjusts manually.
- **D-14:** Carryover is idempotent — locking/unlocking repeatedly does not create duplicate entries. Use upsert or check-before-insert.

### Agent-level input restructure
- **D-15:** New `AgentPeriodAdjustment` table (or equivalent) to store bonus/fronted/hold at agent+period level instead of on individual payroll entries.
- **D-16:** Agent card header inputs (Bonus, Fronted, Hold) stay in current layout — no UI redesign.
- **D-17:** No per-sale inputs exist to remove — CARRY-01 is already satisfied at the UI level. The migration is purely backend storage.
- **D-18:** Agents with zero sales in a period still show a card with bonus/fronted/hold inputs. Enables carryover visibility and editing even before sales are entered.

### Carryover label UX
- **D-19:** Bonus label shows "Hold Payout" when the bonus value was sourced from carryover (previous week's hold being paid back). Shows "Bonus" otherwise.
- **D-20:** Hold label shows "Fronted Hold" (or similar) when sourced from previous week's fronted carryover. Shows "Hold" otherwise.
- **D-21:** Labels are editable by clicking inline — click the label text to change it. Payroll can override the automatic label.
- **D-22:** Subtle text note below the input indicates carryover source (e.g., "Carried from prev week"). Same treatment for both bonus and hold carryover.

### Claude's Discretion
- AgentPeriodAdjustment table schema details (columns, indexes, constraints)
- Migration strategy for moving existing entry-level values to agent-level table
- How to handle the zero-sales agent card rendering (placeholder entry vs separate query)
- Exact carryover source label text and styling
- Inline label edit interaction (click-to-edit component pattern)

</decisions>

<specifics>
## Specific Ideas

- Fronted is a cash advance: agent gets it NOW, pays it back next week as hold
- If net goes negative (hold > income), only the unpaid portion carries — not the full hold amount
- Agent cards must appear even with zero sales if carryover exists, showing negative net if applicable
- "Hold Payout" label is the specific text for bonus sourced from carryover

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above and REQUIREMENTS.md (CARRY-01 through CARRY-06, FIX-06 through FIX-08, NET-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PayrollPeriods.tsx`: Agent card component with header inputs (bonus/fronted/hold), live net calculation, print function
- `payroll.ts` (API): Period lock endpoint, payroll entry PATCH, net calculation
- `handleHeaderBlur()`: Delta-based input update logic (needs to target new AgentPeriodAdjustment table)

### Established Patterns
- Inline React.CSSProperties styling (no Tailwind)
- `authFetch()` for API calls with Bearer token
- `asyncHandler()` wrapper for Express routes
- Zod validation on API endpoints
- `logAudit()` for sensitive operations

### Integration Points
- **Period lock endpoint** — must trigger carryover logic (find/create next period adjustments)
- **Net calculation** — dashboard line 781, API payroll.ts line 206, print summary line 1291 — all must change formula
- **Approve button** — dashboard line 212-213 (`needsApproval`/`isApproved`) — change to halvingReason-based
- **Print pills** — line 1337 — move `commFlagHtml` before `$${amount}`
- **Agent card rendering** — currently filters by agents with entries; must also show agents with adjustments but no sales

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 40-agent-level-adjustments-carryover-system*
*Context gathered: 2026-04-01*
