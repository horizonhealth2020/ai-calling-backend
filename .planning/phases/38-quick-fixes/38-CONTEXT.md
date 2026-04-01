# Phase 38: Quick Fixes - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix 5 display bugs and validation issues blocking daily payroll workflow. No migrations needed — all fixes are independent of each other. Requirements: FIX-01 through FIX-05.

</domain>

<decisions>
## Implementation Decisions

### Zero-value validation (FIX-01)
- **D-01:** Server-side Zod already correct (`.min(0)`) — fix is client-side only
- **D-02:** Add `min="0"` attribute to bonus, fronted, and hold HTML number inputs in PayrollPeriods.tsx

### Fronted positive display (FIX-02)
- **D-03:** Fronted displays as positive dollar amount (e.g., "$200.00" not "-$200.00") — it represents money advanced to the agent
- **D-04:** Color scheme: Bonus = green, Fronted = orange, Hold = red — applies to both dashboard cards and print view
- **D-05:** Label stays "Fronted" — no rename needed
- **D-06:** Net payout formula remains `commission + bonus - fronted - hold` (server-side unchanged). Fronted still deducts from net. The display change is purely visual — show the amount as positive with orange color to reflect that the agent received this money upfront. The hold next week recoups it.

### Net column removal from print (FIX-03)
- **D-07:** Remove Net column from individual sale rows in print card (header `<th>` and row `<td>`)
- **D-08:** Keep Net in the subtotal row at the bottom of each agent's print section
- **D-09:** On-screen pay card rows already have Net removed — no dashboard changes needed

### Addon formatting on print cards (FIX-04)
- **D-10:** Replicate dashboard badge layout on print view — each product as a distinct block with name above and premium below
- **D-11:** Products display side-by-side (left to right) with clear separation between them, not comma-separated text
- **D-12:** Current dashboard badge layout (colored badges with premium underneath) is the reference design — print should mirror this structure using print-appropriate styling

### Half-commission print view indicators (FIX-05)
- **D-13:** Approved half-commission deals show green "Approved" pill directly below the commission amount on print
- **D-14:** Non-approved half-commission deals show orange/warning halving reason text (e.g., "Waived Fee", "Missing Add-on") directly below the commission amount on print
- **D-15:** +$10 enrollment bonus indicator moves to below the enrollment fee column (currently displays next to commission — wrong placement)
- **D-16:** Print view is read-only — shows current state only, no action buttons

### Claude's Discretion
- Exact print CSS for the product badge layout (spacing, borders, font sizes)
- How to handle very long product names in the side-by-side print layout (wrapping vs truncation)
- Print-specific pill styling for "Approved" and halving reason indicators

</decisions>

<specifics>
## Specific Ideas

- Dashboard pay card badge layout is the gold standard — print should feel like the same data, just in print form
- Example net calculation: Agent with $1000 commission, $100 bonus, $100 fronted = $1200 net payout this week. Next week $1000 commission with $100 hold = $900 net payout.
- Fronted is money the agent receives upfront; hold recoups it the following week via the carryover system (Phase 40)

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above and in:

### Requirements
- `.planning/REQUIREMENTS.md` — FIX-01 through FIX-05 definitions

### Roadmap
- `.planning/ROADMAP.md` — Phase 38 success criteria (5 items)

### Key source file
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` — All 5 fixes land in this file (inputs ~L726-776, print view ~L1242-1329, badge display ~L352-366)

### Related API
- `apps/ops-api/src/routes/payroll.ts` — Zod schema at ~L190-193 (already correct)
- `apps/ops-api/src/services/payroll.ts` — Net calculation (no change needed)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Dashboard badge component pattern (colored badges with premium underneath) at PayrollPeriods.tsx ~L352-366 — reference for print layout
- Approve/Unapprove button logic at ~L468-486 — shows `commissionApproved` flag and `needsApproval` logic
- `halvingReason` field already on payroll entries — used in print at ~L1303-1304
- Color constants (`C.danger`, `C.warning`, `C.accentTeal`) defined in the component

### Established Patterns
- Print view uses template literal HTML strings opened via `window.open()` — not React components
- All styling is inline React.CSSProperties on dashboard, inline CSS strings in print HTML
- `formatDollar()` from `@ops/utils` for currency formatting

### Integration Points
- Print function `printAgentCards()` at ~L1242 generates the HTML string
- Agent header section at ~L726-776 has bonus/fronted/hold inputs
- Net payout display on agent card header (will need color update for fronted)
- `+10` enrollment bonus badge currently at ~L? near commission — needs to move to enrollment fee area

</code_context>

<deferred>
## Deferred Ideas

- Fronted-to-hold auto-carryover logic — Phase 40
- Bonus label editing ("Bonus" vs "Hold Payout") — Phase 40
- Agent-level collapsible card restructure — Phase 41

</deferred>

---

*Phase: 38-quick-fixes*
*Context gathered: 2026-04-01*
