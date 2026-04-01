# Feature Landscape

**Domain:** Payroll management -- pay card overhaul, carryover system, print formatting, product config
**Researched:** 2026-04-01
**Confidence:** HIGH (all features are well-scoped with direct codebase analysis)

## Table Stakes

Features the payroll team expects. Missing = payroll accuracy issues persist.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Zero-value validation bug fix | Cannot set bonus/fronted/hold to $0 once a nonzero value is entered. Blocks normal payroll workflow. | Low | Likely falsy check on `0` in UI send logic, or empty input converting to undefined instead of 0. |
| Fronted displayed as positive | Fronted is money advanced TO the agent -- showing negative confuses staff reading pay cards. | Low | Display-only. Net formula (`payout + adjustment + bonus - fronted - hold`) stays unchanged. |
| Net column removed from print card sale rows | Net per-sale is misleading because bonus/fronted/hold are agent-level adjustments, not sale-level. | Low | Remove `<th>Net</th>` and corresponding `<td>` from print template string. Keep agent-level net in summary. |
| Approved pill on half-commission deals in print view | Half-commission deals with `commissionApproved=true` show halving reason but no approval indicator. Payroll needs to see which overrides happened. | Low | Add green "Approved" badge in print template when `commissionApproved && halvingReason`. |
| Addon name formatting cleanup | Long addon names with parenthetical details overflow print table cells. | Low | Client-side string transform: strip type prefix, truncate to reasonable length. No migration needed. |
| ACA editable in Products tab | ACA_PL products exist in DB with `flatCommission` but Products tab hardcodes type union as `CORE | ADDON | AD_D`, excluding ACA. Staff cannot configure ACA commissions. | Medium | Add ACA_PL to type maps, show flatCommission field conditionally. No schema change -- column already exists. |

## Differentiators

Features that improve payroll workflow beyond bug fixes.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Fronted/hold auto-carryover | Eliminates manual re-entry of carryover amounts each pay period. Currently error-prone: staff must remember agent X was fronted $200 last week and manually enter corresponding hold. | High | Triggers on period status transition. Must handle: next period lookup, agents with no sales in next period, idempotency on status toggle. |
| Editable bonus label | Distinguish "Bonus" from "Hold Payout" on pay cards. Provides audit clarity on where money came from. | Medium | New `bonusLabel` field on PayrollEntry. Auto-carryover sets "Hold Payout". Manual entry defaults to "Bonus". |
| Bonus/fronted/hold agent-level only | Currently on PayrollEntry (per-sale) but conceptually agent-level. Per-sale inputs cause confusion -- you front money to an agent, not a specific sale. | Medium | Remove per-sale row inputs. Show only on agent card header. Keep storage on first active entry (existing pattern). |
| Payroll cards restructured: agent-level collapsible | Period card shows agent-level summaries that expand to show individual sale rows with week-by-week grouping. | High | Major refactor of PeriodCard component (~800 lines). Agent grouping with nested tables. Reuses existing expand/collapse pattern. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Per-sale bonus/fronted/hold inputs | These are agent-level adjustments. Per-sale inputs suggest sale-level semantics. | Agent card header inputs only. Store on first active entry. |
| PDF export library | Over-engineers print. Browser print-to-PDF covers the use case. | Keep window.open + window.print pattern. |
| Automatic carryover reversal | Auto-reversing wrong carryovers creates cascading audit complexity. | Manual adjustment. Audit log tracks original carryover. |
| Carryover across non-adjacent periods | Skipping periods adds edge cases. | Always carry over to immediately next period. Manual adjust if needed. |
| Carryover chain tracking | Linked list of "this hold came from that fronted" adds complexity for minimal value. | Use bonusLabel to indicate source. Audit log captures event. |
| Retroactive carryover recalculation | Editing fronted after carryover auto-updating downstream creates cascading complexity. | Manual adjustment if fronted changes post-carryover. |
| Custom print templates | Template editor for internal tool is over-engineering. | Hardcoded HTML print. Clean and consistent, not configurable. |

## Feature Dependencies

```
ACA editable in Products tab          (independent)
Zero-value validation bug fix         (independent)
Addon name formatting cleanup         (independent)
"Approved" pill on print view         (independent)
Net column removed from print rows    (independent)
Fronted positive display              (independent)

Bonus/fronted/hold agent-level only  --> Carryover (carryover needs clear agent-level storage)
Editable bonus label                 --> Carryover (carryover sets the label automatically)
Carryover system                     --> depends on agent-level storage + bonus label in place

Pay card restructure                  (independent of carryover, but should follow it
                                       so new layout displays carryover metadata correctly)
```

## MVP Recommendation

**Phase 1: Quick fixes (all independent, low complexity)**
1. Zero-value validation bug fix
2. Fronted displayed as positive
3. Net column removed from print card sale rows
4. "Approved" pill on half-commission deals in print view
5. Addon name formatting cleanup

**Phase 2: Product config**
6. ACA editable in Products tab

**Phase 3: Agent-level adjustments + carryover foundation**
7. Bonus/fronted/hold agent-level only
8. Editable bonus label (DB migration + UI)
9. Fronted/hold auto-carryover (backend logic + UI indicators)

**Phase 4: Card restructuring**
10. Payroll cards restructured: agent-level collapsible cards with week-by-week entries

**Rationale:** Quick fixes first (unblock daily payroll work). ACA next (independent, medium effort). Then carryover system (requires migration, most complex logic). Card restructure last (largest UI refactor, should build on stable carryover logic).

## Existing Code Impact Analysis

| Feature | Files Affected | Migration Needed |
|---------|---------------|-----------------|
| Zero-value bug fix | `PayrollPeriods.tsx` (client-side send logic) | No |
| Fronted positive display | `PayrollPeriods.tsx` (print + card header display) | No |
| Net column removed from print | `PayrollPeriods.tsx` (print template function) | No |
| Approved pill on print | `PayrollPeriods.tsx` (print template function) | No |
| Addon name formatting | `PayrollPeriods.tsx` (display helper) | No |
| ACA in Products tab | `PayrollProducts.tsx` (type union + conditional form) | No |
| Agent-level only | `PayrollPeriods.tsx` (hide per-row inputs) | No |
| Editable bonus label | `PayrollPeriods.tsx`, `payroll.ts` route, `schema.prisma` | Yes |
| Auto-carryover | New service function, `payroll.ts` routes, `PayrollPeriods.tsx` | Yes (shared with above) |
| Card restructuring | `PayrollPeriods.tsx` (major refactor) | No |

## Net Amount Formula Reference

Current formula in `apps/ops-api/src/routes/payroll.ts:206`:
```
net = payoutAmount + adjustmentAmount + bonus - fronted - hold
```

This formula does NOT change. "Fronted as positive" is display-only -- the database stores fronted as a positive number that gets subtracted. The print and card header show `$200.00 (advanced)` instead of `-$200.00`.

## Sources

- Direct analysis: `apps/ops-api/src/services/payroll.ts` (commission engine, net formula)
- Direct analysis: `apps/ops-api/src/routes/payroll.ts` (PATCH endpoint, Zod schemas)
- Direct analysis: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` (UI cards, print)
- Direct analysis: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollProducts.tsx` (product types)
- Direct analysis: `prisma/schema.prisma` (PayrollEntry model, ProductType enum)
