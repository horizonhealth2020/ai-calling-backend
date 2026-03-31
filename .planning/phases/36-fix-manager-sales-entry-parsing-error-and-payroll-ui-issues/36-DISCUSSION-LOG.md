# Phase 36: Fix Manager Sales Entry Parsing Error and Payroll UI Issues - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 36-fix-manager-sales-entry-parsing-error-and-payroll-ui-issues
**Areas discussed:** Addon name matching, Payroll row ordering, ACA PL flat commission

---

## Addon Name Matching

| Option | Description | Selected |
|--------|-------------|----------|
| Exact receipt names | DB names match what's on the receipt | |
| Shorter/different names | DB uses different naming | |
| You decide matching | Claude's discretion on normalization | |

**User's choice:** Provided exact DB product names — they match receipt names exactly: "American Financial - Critical Illness $5,000", "$10,000", "$2,500", "$7,500" all type AD&D.

| Option | Description | Selected |
|--------|-------------|----------|
| Just this one | Only dollar-amount addon names fail | |
| Other issues too | Other receipts fail too | |

**User's choice:** Just this one — only American Financial dollar-amount names discovered so far.

**Notes:** The `$` and `,` characters in product names like "$5,000" break the regex word-boundary matching in `matchProduct()`. Parser correctly strips "- Add-on" suffix.

---

## Payroll Row Ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Agent pay cards only | Sort by member ID only in pay cards | |
| All payroll views | Apply member ID sort everywhere | |
| You decide scope | Claude determines scope | |

**User's choice:** Agent pay cards only — CSV exports and other views keep existing sort.

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom of list | No-ID entries sort last | |
| Top of list | No-ID entries sort first | |
| You decide | Claude picks default | |

**User's choice:** Top of list — entries without member ID appear before ID-sorted entries.

---

## ACA PL Flat Commission

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed amount all members | Same flat amount regardless | |
| Varies by plan tier | Different amounts by tier | |
| Configurable per product | Store flat amount on Product record | |

**User's choice:** Flat amount per member, can be multiple members on a plan. Needs to be editable. ACA is a category with different insurance carriers.

| Option | Description | Selected |
|--------|-------------|----------|
| New fields on sale form | Add member count + carrier when ACA selected | |
| Reuse existing fields | Use existing carrier field + add member count | |
| I'll describe the flow | Custom description | |

**User's choice:** Two features: (1) Checkbox on right side of existing form to add ACA to a sale with carrier + member count — fulfills bundle requirements for addons. (2) Standalone ACA entry with just agent, member name, carrier, member count — no regular sale form requirements. ACA plans don't count toward agent sales or go on sales board.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, same pay card | ACA in regular agent pay card | |
| Separate ACA section | Distinct payroll section for ACA | |
| You decide | Claude determines display | |

**User's choice:** You decide — Claude's discretion on how ACA entries appear in payroll.

| Option | Description | Selected |
|--------|-------------|----------|
| On the Product record | flatCommission field on Product model | |
| Entered per sale | Manager types amount each time | |
| Product record + override | Store on Product, allow per-sale override | |

**User's choice:** Product record with per-sale override capability (Recommended).

---

## Claude's Discretion

- ACA entry display in payroll agent pay cards (same card vs separate section)
- Exact UI layout of ACA checkbox and fields on sale entry form
- Standalone ACA form design (separate section vs mode toggle)
- Migration approach for flatCommission and memberCount fields
- ACA exclusion method from sales board and agent counts

## Deferred Ideas

None — discussion stayed within phase scope
