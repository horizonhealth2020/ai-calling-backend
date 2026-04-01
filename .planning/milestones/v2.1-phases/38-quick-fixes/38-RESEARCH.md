# Phase 38: Quick Fixes - Research

**Researched:** 2026-04-01
**Domain:** Frontend UI fixes (React/Next.js payroll dashboard + print view)
**Confidence:** HIGH

## Summary

All 5 fixes target a single file: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` (1888 lines). No backend changes, no migrations, no new dependencies. The fixes split into two categories: (1) dashboard input behavior (FIX-01) and display tweaks (FIX-02 fronted color), and (2) print view HTML template corrections (FIX-02 print, FIX-03, FIX-04, FIX-05). The print view is generated as a template literal HTML string via `printAgentCards()` at line 1242 -- not React components -- so all print fixes are string manipulation in that function.

The API-side Zod schema (lines 190-193 of `apps/ops-api/src/routes/payroll.ts`) already correctly uses `.min(0)` allowing zero values. The server needs no changes.

**Primary recommendation:** Treat each FIX as an independent, atomic change within the single file. Group dashboard fixes (FIX-01, FIX-02 dashboard) and print fixes (FIX-02 print, FIX-03, FIX-04, FIX-05) into two waves for clean verification.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Server-side Zod already correct (`.min(0)`) -- fix is client-side only
- D-02: Add `min="0"` attribute to bonus, fronted, and hold HTML number inputs in PayrollPeriods.tsx
- D-03: Fronted displays as positive dollar amount (e.g., "$200.00" not "-$200.00")
- D-04: Color scheme: Bonus = green, Fronted = orange, Hold = red -- applies to both dashboard cards and print view
- D-05: Label stays "Fronted" -- no rename needed
- D-06: Net payout formula remains `commission + bonus - fronted - hold` (server-side unchanged). Display change is purely visual.
- D-07: Remove Net column from individual sale rows in print card (header `<th>` and row `<td>`)
- D-08: Keep Net in the subtotal row at the bottom of each agent's print section
- D-09: On-screen pay card rows already have Net removed -- no dashboard changes needed
- D-10: Replicate dashboard badge layout on print view -- each product as a distinct block with name above and premium below
- D-11: Products display side-by-side (left to right) with clear separation between them, not comma-separated text
- D-12: Current dashboard badge layout (colored badges with premium underneath) is the reference design
- D-13: Approved half-commission deals show green "Approved" pill directly below the commission amount on print
- D-14: Non-approved half-commission deals show orange/warning halving reason text below the commission amount on print
- D-15: +$10 enrollment bonus indicator moves to below the enrollment fee column (currently next to commission)
- D-16: Print view is read-only -- shows current state only, no action buttons

### Claude's Discretion
- Exact print CSS for the product badge layout (spacing, borders, font sizes)
- How to handle very long product names in the side-by-side print layout (wrapping vs truncation)
- Print-specific pill styling for "Approved" and halving reason indicators

### Deferred Ideas (OUT OF SCOPE)
- Fronted-to-hold auto-carryover logic -- Phase 40
- Bonus label editing ("Bonus" vs "Hold Payout") -- Phase 40
- Agent-level collapsible card restructure -- Phase 41
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIX-01 | User can set bonus/fronted/hold values to zero without validation error | Add `min="0"` to 3 number inputs at lines 726-776. Server Zod already allows zero. |
| FIX-02 | Fronted amount displays as positive on pay cards | Dashboard: change fronted color from `C.danger` (red) to orange (`C.warning`). Print summary: remove `-` prefix from fronted, change class from `red` to orange. |
| FIX-03 | Net column removed from print card sale rows | Remove `<th>Net</th>` from print table header and `<td>` Net cell from each row at lines 1291-1317. Keep Net in subtotal row. |
| FIX-04 | Addon names display cleanly on pay cards with shortened names | Replace `printProd()` comma-separated output with block layout matching dashboard badge pattern at lines 340-366. |
| FIX-05 | Half-commission approved/non-approved indicators on print view | Add `commissionApproved` check to print rows. Show green "Approved" pill or orange halving reason below commission. Move +$10 bonus to enrollment fee column. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI components | Already in use, dashboard is React |
| Next.js | 15 | App framework | Already in use for ops-dashboard |

### Supporting
No new libraries needed. All fixes use existing inline CSS patterns and template literal HTML.

## Architecture Patterns

### Single File Target
All 5 fixes land in one file:
```
apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx
```

Key regions:
- **Lines 726-776**: Agent header inputs (bonus, fronted, hold) -- FIX-01, FIX-02 dashboard
- **Lines 340-366**: Dashboard badge layout (reference for FIX-04 print)
- **Lines 380-404**: Dashboard commission display with halvingReason and enrollment badge (reference for FIX-05 print)
- **Lines 1242-1329**: `printAgentCards()` function -- FIX-02 print, FIX-03, FIX-04, FIX-05

### Pattern: Dashboard Inline Styles
Dashboard uses `React.CSSProperties` constant objects. Color constants are defined in a `C` object:
- `C.success` = green
- `C.danger` = red
- `C.warning` = orange/amber
- `C.accentTeal` = teal
- `C.textMuted` = muted gray
- `C.textPrimary` = primary text

### Pattern: Print View HTML Template
The print view is NOT React. It is a template literal HTML string:
```typescript
function printAgentCards(agents: [string, Entry[]][], period: Period) {
  const html = `<!DOCTYPE html>...` + 
    agents.map(([agentName, entries]) => {
      // Pure string concatenation, inline CSS styles
      return `<div class="agent-card">...`;
    }).join("") + `</body></html>`;
  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
}
```

CSS classes are defined in a `<style>` block at lines 1244-1269. New classes for print pills/badges should be added here.

### Pattern: Product Display in Print
Current print `printProd()` helper (line 1299-1301) joins products with commas:
```typescript
const printProd = (items: { name: string; premium?: number }[]) => items.length
  ? items.map(p => p.name + (p.premium != null ? `<br><span style="font-size:10px;color:#64748b">$${p.premium.toFixed(2)}</span>` : "")).join(", ")
  : "\u2014";
```
This needs replacement with a block layout that mirrors the dashboard badge pattern.

### Anti-Patterns to Avoid
- **Changing server-side validation**: Zod schema is correct. Do not touch `apps/ops-api/src/routes/payroll.ts`.
- **Changing net calculation logic**: Formula `commission + bonus - fronted - hold` remains unchanged. Only the visual display of fronted changes.
- **Adding React components to print**: Print is template literal HTML -- keep it that way.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Currency formatting | Custom formatters | `formatDollar()` from `@ops/utils` | Already used throughout, handles edge cases |
| Color constants | Hardcoded hex | `C.success`, `C.warning`, `C.danger` | Consistent theme, already defined |

## Common Pitfalls

### Pitfall 1: Changing Net Calculation
**What goes wrong:** Accidentally modifying the net formula when changing fronted display
**Why it happens:** The display change (positive fronted) can be confused with a formula change
**How to avoid:** Only change the display prefix/color. The `liveNet` calculation at line 781 stays as `agentGross + bonus - fronted - hold`. Server `netAmount` is untouched.
**Warning signs:** Net amounts change after the fix

### Pitfall 2: Print Subtotal Column Count
**What goes wrong:** After removing Net from sale rows (FIX-03), the subtotal `colspan` is wrong
**Why it happens:** Subtotal row at line 1319-1322 uses `colspan="6"` -- when removing Net column header, column count drops from 8 to 7, so subtotal needs `colspan="5"` (covering 5 columns before Commission and Net)
**How to avoid:** Count columns after removal: Member ID, Member Name, Core, Add-on, AD&D, Enroll Fee, Commission = 7 columns. Subtotal spans first 5 (`colspan="5"`), then Commission cell, then Net cell.
**Warning signs:** Subtotal row misaligned in print

### Pitfall 3: commissionApproved Not in Print Data
**What goes wrong:** `commissionApproved` field not available in print row entries
**Why it happens:** Print iterates over `entries` which are `Entry[]` type -- need to verify the type includes `sale.commissionApproved`
**How to avoid:** Check the Entry type definition. Line 19 confirms: `commissionApproved: boolean` is on the sale type. Print has access via `e.sale?.commissionApproved`.
**Warning signs:** Approved pill never shows

### Pitfall 4: Enrollment Bonus Logic in Print
**What goes wrong:** Moving +$10 enrollment bonus to wrong column
**Why it happens:** Currently at line 1306 the bonus is appended to flags shown in member name column. Need to move it to enrollment fee column output.
**How to avoid:** Remove enrollment bonus from `flags[]` array. Add it directly after the `fee` variable in the enrollment fee `<td>`.
**Warning signs:** +$10 shows in two places or disappears entirely

### Pitfall 5: Print Fronted Color
**What goes wrong:** Only fixing dashboard fronted display but forgetting print summary
**Why it happens:** Fronted appears in TWO places: dashboard header (line 748-750) and print summary (line 1285)
**How to avoid:** Fix both. Dashboard: change `C.danger` to `C.warning` (orange). Print summary: change class from `red` to use orange color, remove `-` prefix.
**Warning signs:** Print still shows `-$200.00` in red for fronted

## Code Examples

### FIX-01: Add min attribute to inputs
Current (line 736):
```html
<input type="number" step="0.01" value={headerBonus} .../>
```
Fix:
```html
<input type="number" step="0.01" min="0" value={headerBonus} .../>
```
Apply to all three inputs: bonus (line 736), fronted (line 754), hold (line 772).

### FIX-02: Fronted positive display - Dashboard
Current (line 749-750):
```typescript
color: Number(headerFronted) > 0 ? C.danger : C.textPrimary,
```
Fix:
```typescript
color: Number(headerFronted) > 0 ? C.warning : C.textPrimary,
```
Also change background tint from red to orange:
```typescript
background: Number(headerFronted) > 0 ? "rgba(251,191,36,0.10)" : SMALL_INP.background,
```

### FIX-02: Fronted positive display - Print
Current (line 1285):
```html
<div class="summary-item"><div class="summary-label">Fronted</div><div class="summary-value red">-$${agentFronted.toFixed(2)}</div></div>
```
Fix:
```html
<div class="summary-item"><div class="summary-label">Fronted</div><div class="summary-value" style="color:#d97706">$${agentFronted.toFixed(2)}</div></div>
```
Note: Remove `-` prefix, use orange color (#d97706 matches C.warning).

### FIX-03: Remove Net from print sale rows
Current header (line 1292):
```html
<th class="right">Commission</th><th class="right">Net</th>
```
Fix:
```html
<th class="right">Commission</th>
```
Current row (lines 1315-1316):
```html
<td class="right" style="font-weight:700">$${Number(e.payoutAmount).toFixed(2)}</td>
<td class="right green" style="font-weight:700">$${Number(e.netAmount).toFixed(2)}</td>
```
Fix: Remove the Net `<td>` line. Keep Commission `<td>`.

Subtotal (lines 1319-1322): Adjust `colspan` and keep Net only in subtotal:
```html
<tr class="subtotal">
  <td colspan="5" class="right">SUBTOTAL</td>
  <td class="right">$${agentGross.toFixed(2)}</td>
  <td class="right green">$${agentNet.toFixed(2)}</td>
</tr>
```

### FIX-04: Product badge layout in print
Replace `printProd()` with block-based layout. Add CSS classes:
```css
.prod-group { display: inline-flex; gap: 8px; flex-wrap: wrap; }
.prod-block { display: inline-flex; flex-direction: column; align-items: center; }
.prod-name { font-size: 11px; font-weight: 600; white-space: nowrap; max-width: 90px; overflow: hidden; text-overflow: ellipsis; }
.prod-premium { font-size: 10px; color: #64748b; }
```
Then each product renders as:
```html
<div class="prod-block">
  <span class="prod-name core">Product Name</span>
  <span class="prod-premium">$XX.XX</span>
</div>
```

### FIX-05: Half-commission indicators in print
Add CSS for print pills:
```css
.pill { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; margin-top: 2px; }
.pill-approved { background: #d1fae5; color: #059669; }
.pill-warn { background: #fef3c7; color: #d97706; }
```
In the commission `<td>`, after the amount:
```typescript
// Check commissionApproved and halvingReason
const commFlags: string[] = [];
if (e.halvingReason && e.sale?.commissionApproved) {
  commFlags.push(`<div class="pill pill-approved">Approved</div>`);
} else if (e.halvingReason) {
  commFlags.push(`<div class="pill pill-warn">${e.halvingReason}</div>`);
}
```
Move enrollment bonus from member name flags to enrollment fee cell:
```typescript
const enrollBonusHtml = enrollFee >= 125 ? `<div class="flag flag-bonus">+$10</div>` : "";
// Add after fee in enrollment fee td
<td class="right">${fee}${enrollBonusHtml}</td>
```

## State of the Art

No technology changes needed. All fixes use existing patterns and established conventions in the codebase.

## Open Questions

None. All implementation details are fully specified by the locked decisions in CONTEXT.md and verified against the source code.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (morgan service only -- no dashboard tests exist) |
| Config file | `apps/morgan/jest.config.js` |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIX-01 | Zero values accepted in bonus/fronted/hold inputs | manual-only | N/A -- browser input validation, no React test infra | N/A |
| FIX-02 | Fronted displays as positive with orange color | manual-only | N/A -- visual verification required | N/A |
| FIX-03 | Net column absent from print sale rows, present in subtotal | manual-only | N/A -- print HTML template visual check | N/A |
| FIX-04 | Addon names display as block badges, not comma-separated | manual-only | N/A -- print HTML template visual check | N/A |
| FIX-05 | Approved pill / halving reason / enrollment bonus placement correct | manual-only | N/A -- print HTML template visual check | N/A |

**Justification for manual-only:** The ops-dashboard has no test infrastructure (no Jest/Vitest/Playwright config, no test files). All fixes are visual/UI changes in a single component file and a print HTML template. Setting up a React testing environment for 5 CSS/HTML fixes would be disproportionate overhead. Verification is through visual inspection of the dashboard and print output.

### Sampling Rate
- **Per task commit:** Visual verification of the specific fix
- **Per wave merge:** Open payroll dashboard, verify all inputs accept zero, check fronted color, print a card and verify all 5 fixes
- **Phase gate:** Full manual walkthrough of all 5 success criteria

### Wave 0 Gaps
None -- no test infrastructure needed for these visual fixes. Manual verification is appropriate.

## Sources

### Primary (HIGH confidence)
- Source code: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` -- all line references verified
- Source code: `apps/ops-api/src/routes/payroll.ts` lines 187-196 -- Zod schema verified
- CONTEXT.md decisions D-01 through D-16 -- locked by user

### Secondary (MEDIUM confidence)
- None needed -- all fixes are within existing codebase patterns

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, single file changes
- Architecture: HIGH -- verified all line numbers and patterns against source code
- Pitfalls: HIGH -- identified from direct code analysis (colspan, dual-location fronted, type availability)

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable -- internal tool, no external dependencies changing)
