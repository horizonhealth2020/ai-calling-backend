# Domain Pitfalls

**Domain:** Payroll card overhaul, carryover system, and adjustment relocation
**Researched:** 2026-04-01
**Confidence:** HIGH (based on direct codebase analysis of payroll service, routes, and UI components)

## Critical Pitfalls

### Pitfall 1: Carryover Duplication on Period Status Toggle

**What goes wrong:** Payroll staff locks a period (OPEN -> LOCKED), carryover entries are created in the next period. Then they unlock it (LOCKED -> OPEN) to fix something, then re-lock it. The carryover logic runs again and creates duplicate entries in the next period, doubling the carryover amounts.

**Why it happens:** The existing `PATCH /payroll/periods/:id/status` endpoint allows toggling between OPEN and LOCKED freely. The carryover hook fires on every transition to LOCKED without checking if carryover already happened.

**Consequences:** Agent gets double-charged on holds or double-paid on bonus carryovers. Financial accuracy destroyed. Hard to detect because the duplicates look like legitimate entries.

**Prevention:** Before creating carryover entries, check if carryover entries already exist for this agent in the next period from this source period. Options: (A) Query for entries with a matching bonusLabel pattern. (B) Add an `isCarryover` boolean flag to PayrollEntry. (C) Delete previous carryover entries before re-creating (simplest, but loses manual edits to carryover entries). Recommend option B -- explicit flag is cheapest to query and most reliable.

**Detection:** Sum of carryover amounts in a period exceeding the source period's fronted/hold amounts.

---

### Pitfall 2: Zero-Value Bug is Deeper Than It Looks

**What goes wrong:** The Zod schema `.min(0)` correctly allows zero. The bug is likely client-side. When a user clears an input field, the value becomes empty string. `Number("")` = `0`, but if the onChange handler only sends the field when truthy (`if (value) { ... }`), zero is never sent. The PATCH endpoint uses `parsed.data.bonusAmount ?? Number(entry.bonusAmount)` which correctly passes `0` -- but only if `0` was sent.

**Why it happens:** JavaScript truthiness confusion. `0` is falsy. `if (value)` excludes zero.

**Consequences:** Once bonus/fronted/hold is set nonzero, it cannot be zeroed through the UI.

**Prevention:** Inspect PayrollPeriods.tsx save handler. Look for: (1) truthy checks excluding zero, (2) PATCH body construction skipping zero-value fields. Fix: always include the field, use `value !== undefined` not `if (value)`.

**Detection:** Test: set bonus to $50, save. Set bonus to $0, save. Verify API receives `bonusAmount: 0`.

---

### Pitfall 3: Agent With No Sales in Next Period Blocks Carryover

**What goes wrong:** PayrollEntry requires a `saleId` (non-nullable FK) with `@@unique([payrollPeriodId, saleId])`. An agent fronted $200 but with no sales in the next period has no sale to attach the carryover entry to.

**Why it happens:** PayrollEntry was designed as per-sale. Carryover is per-agent.

**Consequences:** Carryover fails for agents without sales in target period -- often the agents who most need it tracked.

**Prevention:** Two options: (A) Create a sentinel "Carryover Adjustment" sale per agent -- $0 premium system-generated sale. (B) Make `saleId` nullable on PayrollEntry for adjustment-only entries. Option A preserves data model. Option B is cleaner but needs migration + audit of code assuming saleId non-null.

**Detection:** Compare agents with fronted/hold > 0 in locked period vs agents with carryover entries in next period.

---

### Pitfall 4: PeriodCard Refactor Breaks Existing Functionality

**What goes wrong:** PayrollPeriods.tsx is ~1800 lines with interleaved concerns: period rendering, agent grouping, sale editing, bonus/fronted/hold inputs, mark paid/unpaid, print, status change requests, sale edit requests, chargeback alerts. Restructuring risks breaking any of these.

**Why it happens:** Component grew through 11 milestones. Too many responsibilities in one file.

**Consequences:** Regressions in mark-paid, sale editing, print, or alert display not caught until payroll day.

**Prevention:** Extract sub-components before restructuring. Create AgentCard, SaleRow, AgentSummary as separate components with explicit props. Test each in isolation. Then compose in new layout.

**Detection:** Manual testing checklist: (1) Edit sale premium -> commission recalculates. (2) Set bonus/fronted/hold -> net updates. (3) Mark paid -> status updates. (4) Print -> matches screen. (5) Chargeback alert displays. (6) Status change request approve/reject works.

## Moderate Pitfalls

### Pitfall 5: Carryover Interacts Badly With Clawbacks

**What goes wrong:** Agent fronted $200 in period N. Period N locks, creating $200 hold in period N+1. A clawback is applied to an entry in N+1, setting it to CLAWBACK_APPLIED. The hold amount on this entry becomes orphaned.

**Prevention:** When applying clawbacks, preserve hold/bonus amounts by moving them to another active entry for the same agent. Or use a dedicated carryover entry separate from sale entries.

### Pitfall 6: Print Template Diverges From Screen Layout

**What goes wrong:** After restructuring screen cards, the print template still generates old flat layout because it uses separate template literal code, not React components.

**Prevention:** Update print template in same phase as card restructure. Use same data grouping logic for both screen and print.

### Pitfall 7: Fronted Positive Display Creates Mental Model Mismatch

**What goes wrong:** Fronted displayed as `+$200.00` but net formula subtracts it. Reader sees Commission $500 + Bonus $50 + Fronted $200 = expects $750, but net shows $350.

**Prevention:** Clear labeling: `$200.00 Fronted (deducted from net)` or distinct visual treatment (different color, separate section) that communicates "already given, being deducted."

## Minor Pitfalls

### Pitfall 8: ACA Product Type Missing From Multiple UI Locations

**What goes wrong:** Adding ACA_PL to Products tab fixes that tab, but other locations may hardcode `"CORE" | "ADDON" | "AD_D"`.

**Prevention:** Search entire codebase for `TYPE_LABELS`, `TYPE_COLORS`, and ProductType unions. Update all occurrences.

### Pitfall 9: Addon Name Formatting Inconsistency

**What goes wrong:** Client-side truncation in pay cards produces different results than print template truncation.

**Prevention:** Extract shared `formatAddonName(name: string)` utility used by both React component and print template.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Quick fixes (zero-value, display) | Zero-value bug is client-side, not API-side | Inspect save handler in PayrollPeriods.tsx |
| ACA Products | Type union hardcoded in multiple files | Search codebase for all ProductType references |
| Agent-level adjustments | Per-entry storage has no agent-level ID | Use "first active entry" convention, not new table |
| Carryover system | Duplication on re-lock, no-sale agents blocked | Idempotency flag + sentinel sale or nullable saleId |
| Card restructure | 1800-line component regression | Extract sub-components first |
| Print enhancements | Print template is separate code from React | Update print in same phase as card changes |

## Sources

- `apps/ops-api/src/routes/payroll.ts` lines 186-214 -- PATCH handler with `??` operator
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` -- 1800+ line component
- `prisma/schema.prisma` -- PayrollEntry `@@unique([payrollPeriodId, saleId])`, saleId non-nullable
- `apps/ops-api/src/routes/payroll.ts` lines 29-42 -- period status toggle
