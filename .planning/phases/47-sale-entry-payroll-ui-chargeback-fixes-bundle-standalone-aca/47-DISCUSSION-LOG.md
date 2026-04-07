# Phase 47: Sale entry, payroll UI, chargeback fixes bundle — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-07
**Phase:** 47-sale-entry-payroll-ui-chargeback-fixes-bundle-standalone-aca
**Areas discussed:** Standalone ACA form skip, Payroll period spacing, Single chargeback lookup, ACA edit from payroll, Closed-period chargeback negative row

---

## Sub-feature Selection

| Option | Description | Selected |
|--------|-------------|----------|
| 1. Standalone ACA form skip | Which fields to skip and where | ✓ |
| 2. Period spacing + image.png | Header shrink strategy | ✓ |
| 3. Single chargeback lookup | Info surfacing in Chargebacks tab lookup card | ✓ |
| 4. ACA edit from payroll | Member-count input + bundle recalc | ✓ |
| 5. CB closed period → negative row | Cross-period chargeback handling | ✓ (pre-answered) |

**User notes on Sub-feature 5 (up front):** "1 BUT TARGET THE OLDEST OPEN PAYROLL PERIOD WE PAY 1 WEEK IN ARREARS SO AGENTS CAN SOMETIMES HAVE 2 OR 3 OPEN PAY PERIODS"

---

## Sub-feature 1: Standalone ACA form skip

| Option | Description | Selected |
|--------|-------------|----------|
| Main form no longer required | Standalone ACA submits without main form validation | ✓ |
| Standalone ACA replaces main form | Hide main form when standalone section in use | |
| Cleanup standalone section's own fields | Remove fields from within standalone section | |

**User's choice:** Main form no longer required

| Required Fields | Selected |
|-----------------|----------|
| Agent | ✓ |
| Member name | ✓ |
| ACA carrier (product) | ✓ |
| Member count | ✓ |

---

## Sub-feature 2: Payroll period spacing

| Option | Description | Selected |
|--------|-------------|----------|
| Shrink header + ticker height | Keep all elements, reduce padding/font | ✓ (effectively) |
| Make period header collapsible | KPI ticker collapses by default | |
| Remove top-level KPI ticker | Delete ticker entirely | |

**User's choice (free text):** "SHRINK THE SPACING AT THE TOP AND THE OVERALL UI. PAYROLL MANAGEMENT MAINLY FOCUSES ON PAYROLL CARDS VERIFYING ACCURACY AND SO ON AND RIGHT NOW THE PAYROLL CARDS TAKE UP LESS THAN 1/3 THE SCREEN THE KPIS ARE NECESSARY BUT WE CAN REDUCE TAKING UP SO MUCH OF THE SCREEN WHEN PAYROLL ENTRIES ARE THE MAIN FOCUS"

| Keep Visible | Selected |
|--------------|----------|
| Date range | ✓ |
| Net Payout total | ✓ |
| Action buttons | ✓ |
| Chargebacks count badge | ✓ |

---

## Sub-feature 3: Single Chargeback Lookup

**Initial Claude mistake:** Confused with Phase 46 chargeback alert badge in period header.
**User correction:** "I THINK YOUR CONFUSING THE CHARGEBACK ALERT WITH THE CHARGEBACK LOOKUP IN CHARGEBACKS TAB I WAS REFERRING TO SINGLE CHARGEBACK LOOKUP"

After re-reading `PayrollChargebacks.tsx` and locating the "Single Chargeback Lookup" section (~line 879):

| Display Fields | Selected |
|----------------|----------|
| Agent name | ✓ |
| Member name | ✓ |
| Sale amount | ✓ |
| Products (already shown) | ✓ |
| NET CHARGEBACK THAT WILL BE DEDUCTED FROM THE AGENT | ✓ (user-added) |

| Layout | Selected |
|--------|----------|
| Header row above product list | |
| Three info chips | |
| Claude's discretion | ✓ |

---

## Sub-feature 4: ACA edit from payroll

**User context (free text):** "IN PAYROLL ROWS IT CURRENTLY HAS AN EDIT BUTTON WHERE PRODUCTS CAN BE MANUALLY ADDED RIGHT NOW WHEN I TRY TO ADD ACA PRODUCT IT REQUIRES DOLLAR AMOUNT INSTEAD OF NUMBER OF MEMBERS AND ONCE I ADDED THE ADD ONS AND AD&D STAYED PAYABLE AS STANDALONE INSTEAD OF BUNDLED"

Located the defect: `WeekSection.tsx` `EditableSaleRow` addon dropdown (line 204–234) filters `p.type !== "CORE"` allowing ACA_PL as "addon" with Premium ($) input; also no covering-sale link is created.

| ACA Edit UI Approach | Selected |
|----------------------|----------|
| Swap $ → # members input | ✓ |
| Remove ACA from dropdown + dedicated button | |
| Claude's discretion | |

| Recalc Scope | Selected |
|--------------|----------|
| ACA commission amount | ✓ |
| Parent sale's bundle rate for addons/AD&D | ✓ |
| Parent bundle requirement satisfaction | ✓ |
| Audit log entry | (added by Claude for completeness) |

| Sibling Recalc Behavior | Selected |
|-------------------------|----------|
| Yes — auto recalc siblings | ✓ |
| No — only new entries | |

---

## Sub-feature 5: Closed-period chargeback negative row

**Pre-answered at start of discussion:** Negative row targets oldest OPEN period (not current).

| Row Shape | Selected |
|-----------|----------|
| New PayrollEntry w/ negative adjustmentAmount | |
| Clawback model tied to open period | |
| Claude's discretion | |

**User's choice (free text):** "Create a row identical to sales entry but highlighted orange and with negative commission amount"

| Label | Selected |
|-------|----------|
| Text: 'Chargeback — [member] ([closed period])' | |
| Badge: 'Prior Period CB' | |
| Claude's discretion | |

**User's choice (free text):** "match payroll row but highlighted orange with negative commission amount. print card should also be highlighted orange, a chargeback in a period that has not been closed and it just zeroed should be highlighted yellow"

**Key insight added from user:** Two visual states needed — **orange** for cross-period (CLOSED → OPEN), **yellow** for in-period zeroed. Both apply to print cards.

---

## Claude's Discretion

- Exact pixel values for header/ticker shrink (D-04/D-05)
- Exact orange/yellow color tokens (D-21/D-22)
- Internal helper extraction for edit-row ACA branch (D-12)
- Endpoint shape for lookup augmentation (D-10)
- Whether sibling recalc (D-14) runs inline or via post-commit hook
- Layout inside Single Chargeback Lookup info section (D-11)

## Deferred Ideas

- Retroactive recalculation of pre-deploy payroll entries
- Redesigning the Phase 46 `Chargebacks (N)` alert badge (out of scope — different feature)
- New tables for cross-period chargeback provenance (existing `adjustmentAmount` is sufficient)
