# Phase 44: Chargeback Batch Review - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 44-chargeback-batch-review
**Areas discussed:** Match preview flow, Review table layout, Product selection UX, Edit & remove behavior

---

## Match Preview Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Preview API endpoint | New POST /api/chargebacks/preview that receives parsed records, runs matching logic, returns match status + sale details without creating anything | ✓ |
| Client-side matching | Frontend fetches all sales upfront, matches locally by memberId | |
| You decide | Claude picks best approach | |

**User's choice:** Preview API endpoint
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full match details | Match status, agent name, all sale products (id, name, type, premium), member info | ✓ |
| Status + agent only | Just match status and agent name, products fetched separately | |
| You decide | Claude picks based on table needs | |

**User's choice:** Full match details and chargeback amount
**Notes:** User emphasized wanting chargeback amount included in preview response

---

| Option | Description | Selected |
|--------|-------------|----------|
| Show all candidates, user picks one | Display all matching sales, user selects which one | ✓ |
| Flag for manual review only | Show MULTIPLE badge, resolve later in CS tracking | |
| You decide | Claude picks best UX | |

**User's choice:** Show all candidates, user picks one
**Notes:** None

---

## Review Table Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Expandable rows | Compact row with click to expand for product details | |
| All-visible flat rows | Every field visible in wide table row, no expansion needed | ✓ |
| Card-based layout | Each entry as a card with full details | |

**User's choice:** All-visible flat rows
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Counts + total amount | Colored badges with click-to-filter + total dollar amount | ✓ |
| Counts only, no filtering | Simple read-only count badges | |
| You decide | Claude picks best design | |

**User's choice:** Counts + total amount with click-to-filter
**Notes:** None

---

## Product Selection UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline checkboxes in row | Products as checkbox list in flat row, showing name + premium | ✓ |
| Popover/modal selector | Button opens popover with checkbox list | |
| You decide | Claude picks best UX | |

**User's choice:** Inline checkboxes in row
**Notes:** None

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, auto-recalculate | Toggling checkbox updates amount, manual override still possible | ✓ |
| No, amount stays manual | Checkboxes track products only, amount always manual | |
| You decide | Claude picks best behavior | |

**User's choice:** Yes, auto-recalculate
**Notes:** None

---

## Edit & Remove Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Always-editable fields | Amount, rep dropdown, product checkboxes always interactive | ✓ |
| Click-to-edit per row | Read-only by default, click edit icon to enable | |
| You decide | Claude picks best pattern | |

**User's choice:** Always-editable fields
**Notes:** Matches existing CSSubmissions pattern

---

| Option | Description | Selected |
|--------|-------------|----------|
| Instant remove with undo | X button removes immediately, toast with Undo option | ✓ |
| Confirm before removing | Inline confirmation before removal | |
| You decide | Claude picks best pattern | |

**User's choice:** Instant remove with undo
**Notes:** None

---

## Claude's Discretion

- Exact column widths and responsive behavior
- Loading state during preview API call
- MULTIPLE match candidate presentation style
- Toast duration and animation
- Summary bar filter toggle behavior

## Deferred Ideas

None — discussion stayed within phase scope.
