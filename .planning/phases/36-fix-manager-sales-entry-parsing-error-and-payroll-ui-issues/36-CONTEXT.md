# Phase 36: Fix Manager Sales Entry Parsing Error and Payroll UI Issues - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Three fixes to existing features: (1) receipt parser fails on addon names containing dollar amounts like "American Financial - Critical Illness $5,000", (2) payroll agent pay card rows reorder on edit — need stable member ID sort, (3) ACA PL product type that pays flat dollar amount per member, auto-fulfills addon bundle requirements, and needs a dedicated entry flow. No new dashboard tabs or navigation — all changes are within existing Manager Entry and Payroll Periods views.

</domain>

<decisions>
## Implementation Decisions

### Addon Name Matching Fix
- **D-01:** The `matchProduct()` function in `ManagerEntry.tsx` fails when product names contain `$` and `,` characters (e.g., "American Financial - Critical Illness $5,000"). The regex word-boundary matching breaks on these special characters. Fix the matching logic to handle dollar amounts in product names.
- **D-02:** DB product names match receipt names exactly: "American Financial - Critical Illness $5,000", "American Financial - Critical Illness $10,000", etc. All are type `AD_D`.
- **D-03:** The parser correctly strips "- Add-on" from the parsed name. The issue is solely in `matchProduct()` failing to match the cleaned name against the DB product name due to special character handling.
- **D-04:** No other known receipt parsing failures — scope fix to dollar-amount/special-character handling in `matchProduct()`.

### Payroll Row Ordering
- **D-05:** Within agent pay cards in `PayrollPeriods.tsx`, sort entries by member ID ascending (lowest to highest) instead of current gross premium descending. This keeps rows stable when edits change amounts.
- **D-06:** Entries without a member ID sort to the top of the list (before ID-sorted entries).
- **D-07:** Sort change applies only to agent pay cards — CSV exports and other views keep their existing sort order.

### ACA PL Flat Commission Product
- **D-08:** ACA PL is a new product category that pays a flat dollar amount per member on the plan (not percentage-based). Multiple members can be on one plan, so commission = flatAmount * memberCount.
- **D-09:** Add a `flatCommission` field to the Product model to store the per-member flat amount. This is the default, but allow override per sale if needed.
- **D-10:** ACA is a category with multiple insurance carriers underneath — the carrier name must be enterable per sale.
- **D-11:** Two entry modes for ACA:
  - **Add to existing sale:** Checkbox on the right side of the current sale entry form. When checked, shows carrier + member count fields. The ACA entry ties to the same sale and fulfills bundle requirements for any addons on that sale.
  - **Standalone ACA entry:** Separate minimal form requiring only: agent, member name, carrier, member count. No premium or regular sale form fields required.
- **D-12:** ACA PL entries do NOT count toward agent sales counts and do NOT appear on the sales board.
- **D-13:** When ACA PL is the core product on a sale with addons, it auto-fulfills the bundle requirement — addons earn full commission (no halving for missing required addon).

### Claude's Discretion
- How to display ACA entries in payroll agent pay cards (same card vs separate section)
- Exact UI layout of the ACA checkbox and carrier/member-count fields on the sale entry form
- Whether ACA standalone entry is a separate form section or a mode toggle on the existing form
- Database migration approach for `flatCommission` field and `memberCount` on sale/payroll entry
- How to exclude ACA from sales board queries and agent sales counts (filter by product type or flag)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Receipt Parser
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:114-209` — `parseReceipt()` function and `matchProduct()` function
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx:211-232` — `matchProduct()` with regex word-boundary matching (the bug)

### Payroll Entry Display
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:1676-1681` — Current sort logic (gross premium desc) that needs to change to member ID asc
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx:17-23` — `SaleInfo` type with `memberId` field

### Commission Engine
- `apps/ops-api/src/services/payroll.ts:103` — `calculateCommission()` — percentage-based, needs flat-amount path
- `apps/ops-api/src/services/payroll.ts:55-83` — `applyEnrollmentFee()` — enrollment fee halving logic
- `apps/ops-api/src/services/payroll.ts:87-100` — Bundle aggregation comments explaining current logic

### Product Schema
- `prisma/schema.prisma:54-56` — `ProductType` enum: `CORE`, `ADDON`, `AD_D`
- `prisma/schema.prisma:132-136` — Product fields: `type`, `premiumThreshold`, `commissionBelow`, `commissionAbove`, `bundledCommission`

### Sales Board (exclusion reference)
- `apps/sales-board/app/page.tsx` — Sales board display, ACA entries must be excluded

### Bundle Logic
- State-aware bundle commission: configurable required/fallback addon per state (v1.4 feature)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `matchProduct()` in ManagerEntry.tsx — existing fuzzy matching function that needs special character fix
- `calculateCommission()` in payroll.ts — commission engine to extend with flat-amount path
- `AgentPayCard` component in PayrollPeriods.tsx — existing pay card that will display ACA entries
- Product model with `commissionAbove`/`commissionBelow`/`bundledCommission`/`premiumThreshold` fields

### Established Patterns
- Inline `React.CSSProperties` constants for all styling (CARD, BTN, INP, etc.)
- Zod validation with `zodErr()` wrapper for API route validation
- `asyncHandler()` wrapper for all Express route handlers
- `logAudit()` for sensitive operations
- Socket.IO `emitSaleChanged` for real-time dashboard updates

### Integration Points
- `ManagerEntry.tsx` — sale entry form where ACA checkbox + fields will be added
- `PayrollPeriods.tsx:1676` — sort logic within agent pay cards
- `payroll.ts:calculateCommission` — commission engine needs flat-amount branch
- `prisma/schema.prisma` — Product model needs `flatCommission` field; Sale or PayrollEntry may need `memberCount`
- Sales API routes — need to handle ACA sale creation with member count
- Sales board queries — need to exclude ACA product type from counts

</code_context>

<specifics>
## Specific Ideas

- User provided sample receipt that fails: "American Financial - Critical Illness $5,000 - Add-on" with exact DB product names matching
- ACA checkbox should appear on the right side of the existing sale entry form
- Standalone ACA entry needs minimal fields: agent, member name, carrier, member count
- Flat commission amount stored on Product record with per-sale override capability

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-fix-manager-sales-entry-parsing-error-and-payroll-ui-issues*
*Context gathered: 2026-03-31*
