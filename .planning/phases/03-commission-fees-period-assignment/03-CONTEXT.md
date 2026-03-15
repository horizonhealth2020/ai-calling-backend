# Phase 3: Commission Fees & Period Assignment - Context

**Gathered:** 2026-03-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Enrollment fee rules (COMM-08, COMM-09) apply correctly in the commission engine, and sales land in the right pay period based on payment type. ACH sales shift one week forward. No new UI — this is backend commission and period logic only.

</domain>

<decisions>
## Implementation Decisions

### Period assignment (PAYR-01)
- Current `getSundayWeekRange` already maps sales to the correct Sun-Sat period containing the sale date — this is the intended behavior
- "One week in arrears" refers to payout timing (paid the following week), NOT period assignment shifting — no change needed to period mapping logic
- Period calculation must use America/New_York (Eastern) timezone via Luxon, not raw UTC — this resolves the open question from STATE.md
- Luxon is already installed; use it to convert sale dates from UTC to Eastern before determining which Sun-Sat week they fall in

### ACH period shift (COMM-10)
- ACH sales are assigned to the pay period one week after their normal period (current week + 1)
- Only `paymentType === 'ACH'` triggers the shift; all other types (CC, null) stay in the current week's period
- ACH detection uses the existing `paymentType` string field on Sale model

### PaymentType enforcement
- Make `paymentType` required on sale creation API (the form selector already exists)
- Keep current enum values: CC and ACH only (Check/Other deferred to Phase 4, SALE-03)
- Backfill existing null paymentType records to 'CC' via data migration
- Treat null as CC in commission engine as a safety fallback

### Enrollment fee threshold (COMM-08)
- `applyEnrollmentFee()` already exists with threshold logic — verify and fix if needed
- Core/AD&D sales use $99 threshold; standalone addons use product's `enrollFeeThreshold` or $50 default
- Fee below threshold halves commission unless `commissionApproved` is true

### $125 bonus (COMM-09)
- `applyEnrollmentFee()` already has $125 bonus logic — verify it matches requirements
- Current code gives bonus for fee >= 125; verify if requirement means exactly $125 or $125+

### Claude's Discretion
- Whether to refactor `getSundayWeekRange` to use Luxon or create a new function
- Test structure and migration file organization
- Error handling for edge cases in period assignment
- Whether to split enrollment fee fixes and period assignment into separate plans

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getSundayWeekRange(date)` in `payroll.ts`: Current period calculation — needs Luxon timezone conversion
- `applyEnrollmentFee()` in `payroll.ts`: Already handles COMM-08 and COMM-09 logic — needs verification against requirements
- `calculateCommission()` in `payroll.ts`: Calls `applyEnrollmentFee()` — integration point for fee rules
- `upsertPayrollEntryForSale()` in `payroll.ts`: Calls `getSundayWeekRange()` — integration point for period assignment
- Existing commission tests in `services/__tests__/commission.test.ts`

### Established Patterns
- Commission calc is synchronous pure function called by async upsert function
- Manual migration SQL (no `prisma migrate dev`) — continued from Phase 1 and Phase 2
- Final-only rounding with `Math.round` at end of calculation (Phase 2 decision)
- `console.warn` for null rates (Phase 2 pattern)

### Integration Points
- `upsertPayrollEntryForSale(saleId)` is called after sale creation in routes — ACH shift applies here
- Sale model `paymentType` field already exists as nullable String, mapped to `payment_type`
- Zod schema in routes validates `paymentType` as `z.enum(["CC", "ACH"]).optional()`

</code_context>

<specifics>
## Specific Ideas

- The Luxon timezone resolution (UTC vs local) from STATE.md open questions is now decided: America/New_York (Eastern)
- ACH shift is +1 week from normal period, not +2 — "two weeks out" in the requirement means one extra week beyond the standard one-week arrears payout timing
- Backfill migration for null paymentType to 'CC' keeps data clean for reporting

</specifics>

<deferred>
## Deferred Ideas

- Check and Other payment types — Phase 4 (SALE-03)
- Payout date tracking/display — future phase (payroll management)

</deferred>

---

*Phase: 03-commission-fees-period-assignment*
*Context gathered: 2026-03-14*
