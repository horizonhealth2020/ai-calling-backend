# Phase 40: Agent-Level Adjustments + Carryover System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 40-agent-level-adjustments-carryover-system
**Areas discussed:** Net formula & approval logic, Carryover mechanics, Agent-level storage & zero-sales cards, Carryover label UX

---

## Net formula & approval logic

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as-is (Commission + Bonus + Fronted - Hold) | Fronted adds to the check. It then carries as hold next week. | ✓ |
| Fronted should subtract | Revert to old formula: Commission + Bonus - Fronted - Hold | |

**User's choice:** Keep as-is
**Notes:** Fronted is confirmed as a cash advance — positive on current check.

| Option | Description | Selected |
|--------|-------------|----------|
| halvingReason-based badge | Badge count = entries with halvingReason && !commissionApproved. Consistent with button logic. | ✓ |
| Keep fee-based badge | Badge still counts low-fee entries, even though buttons use halvingReason. | |

**User's choice:** halvingReason-based badge
**Notes:** page.tsx:257 currently still uses enrollmentFee < 99 logic — confirmed as a bug to fix.

| Option | Description | Selected |
|--------|-------------|----------|
| Uniform everywhere | Same formula in WeekSection, print view, CSV export, and API. | ✓ |
| Different for print/export | Print or export could show a different breakdown format | |

**User's choice:** Uniform everywhere

---

## Carryover mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Fronted + negative net carry | Fronted always carries as hold. If net goes negative, the unpaid portion also carries. | ✓ |
| Only fronted carries | Negative net should NOT carry | |
| Different calculation | Custom carryover formula | |

**User's choice:** Fronted + negative net carry

| Option | Description | Selected |
|--------|-------------|----------|
| No auto-reverse on unlock | Unlock doesn't undo carryover. Payroll adjusts manually. Prevents accidental data loss. | ✓ |
| Auto-reverse on unlock | Unlocking subtracts carried amounts from next period automatically | |
| Reset flag only | Clear carryoverExecuted so re-locking recalculates | |

**User's choice:** No auto-reverse on unlock

| Option | Description | Selected |
|--------|-------------|----------|
| Bonus does NOT carry | Only fronted and unpaid hold carry. Bonus is a one-time per-period amount. | ✓ |
| Bonus carries too | Unused bonus rolls into next period | |

**User's choice:** Bonus does NOT carry

| Option | Description | Selected |
|--------|-------------|----------|
| Add/increment | If next period already has hold=100 and carryover is 200, result is 300. | ✓ |
| Overwrite | Carryover replaces whatever was there. | |

**User's choice:** Add/increment

---

## Agent-level storage & zero-sales cards

| Option | Description | Selected |
|--------|-------------|----------|
| Correct as-is | One row per agent+period with bonus, fronted, hold, labels, carryover flags | ✓ |
| Need additional fields | Add more columns to AgentPeriodAdjustment | |
| Different approach | Alternative storage model | |

**User's choice:** Correct as-is

| Option | Description | Selected |
|--------|-------------|----------|
| Show card | Agent card appears with adjustment inputs and net. Enables visibility and editing. | ✓ |
| Hide until sales exist | Only show agents who have actual payroll entries | |
| Show but collapsed | Card exists but starts collapsed with indicator | |

**User's choice:** Show card

---

## Carryover label UX

| Option | Description | Selected |
|--------|-------------|----------|
| Labels correct | Labels auto-set based on carryover source, editable by payroll staff | ✓ |
| Different label text | Different default label text for carryover items | |
| Not editable | Labels should be auto-set only | |

**User's choice:** Labels correct

| Option | Description | Selected |
|--------|-------------|----------|
| Keep hint as-is | Subtle carryover hint below input when carryover is present | ✓ |
| Show source period | Hint includes which specific period the carry came from | |
| Remove hint | Labels are sufficient, no extra hint needed | |

**User's choice:** Keep hint as-is

---

## Claude's Discretion

- Migration strategy for remaining entry-level values
- Zero-sales agent card rendering details
- Exact CarryoverHint styling

## Deferred Ideas

None — discussion stayed within phase scope
