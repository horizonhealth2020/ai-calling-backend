# Pitfalls Research

**Project:** Ops Platform — Payroll & Usability Overhaul
**Dimension:** Pitfalls
**Confidence:** HIGH

## Critical Pitfalls (Fix First)

### P1: Sale Creation 500 Error — `memberState` Missing
**What goes wrong:** `payroll.ts` references `sale.memberState` but the field doesn't exist on the Prisma Sale model. Every sale creation attempt crashes.
**Consequences:** Entire platform is non-functional for sales entry. No downstream features can be tested.
**Prevention:** Add `memberState` to Prisma schema via migration, OR remove the reference if it's dead code from a previous iteration.
**Detection:** Any POST to `/api/sales` returns 500.
**Phase:** Must be Phase 1, Task 1.

### P2: Arrears Logic Not Implemented
**What goes wrong:** `getSundayWeekRange(saleDate)` maps sales to the week *containing* the sale date. Business requirement is week-in-arrears (following week). ACH double-delay is completely missing.
**Consequences:** Every payroll entry is assigned to the wrong pay period. Agents get paid a week early. ACH sales get paid two weeks early.
**Prevention:** Rewrite `getSundayWeekRange` to offset by +1 week. Add ACH check for +2 weeks. Unit test with boundary dates.
**Detection:** Compare sale dates vs assigned period dates in database.
**Phase:** Phase 1, immediately after fixing sale creation.

### P3: Floating-Point Commission Math
**What goes wrong:** Commission calculations cast Prisma `Decimal` to `Number()` before arithmetic. Over many sales, sub-cent rounding drift accumulates.
**Consequences:** Payroll totals don't match expected values. Small discrepancies compound over pay periods.
**Prevention:** Round to 2 decimal places at each calculation step using `Math.round(value * 100) / 100`. Test with known inputs and exact expected outputs.
**Detection:** Compare calculated commissions against manual spreadsheet calculations.
**Phase:** Phase 1, during commission engine fixes.

### P4: Compass VAB Detection via String Matching
**What goes wrong:** Commission logic checks `product.name.includes("Compass VAB")` to determine bundle qualification. If the product is renamed, all bundle detection breaks silently.
**Consequences:** Commission calculations produce wrong amounts. No error thrown — just incorrect pay.
**Prevention:** Add `isBundleQualifier: Boolean` field to Product model. Set it on the Compass VAB product. Check the flag instead of the name.
**Detection:** Rename Compass VAB product in dev and verify commission calculations still work.
**Phase:** Phase 1, schema change with commission fixes.

### P5: SaleAddon Has No Premium Field
**What goes wrong:** `SaleAddon` is a bare junction table (saleId + productId). All addon commission calculations use `sale.premium` instead of per-addon values.
**Consequences:** If AD&D or Add-on products have different premiums than the core product, commissions are calculated on the wrong amount.
**Prevention:** Clarify business requirement — do all products on a sale share one premium, or does each have its own? If per-product, add `premium` column to SaleAddon.
**Detection:** Enter a sale with mixed premium values and verify commission breakdown.
**Phase:** Phase 1, schema decision before multi-product form.

### P6: Net Amount Desync Between Create/Update Paths
**What goes wrong:** `upsertPayrollEntryForSale` calculates net amount on create but the update path may use a different formula or miss fields (adjustment, bonus, fronted).
**Consequences:** Editing a sale or adding an adjustment produces inconsistent net amounts.
**Prevention:** Single `calculateNetAmount(payout, adjustment, bonus, fronted)` function used by both paths. Formula: `payout + adjustment + bonus - fronted`.
**Detection:** Create a payroll entry, then edit it — compare net amounts.
**Phase:** Phase 1, commission engine consolidation.

## Moderate Pitfalls

### P7: UTC vs Local Timezone Mismatch
**What goes wrong:** `dateRange()` utility uses local time for display, but `getSundayWeekRange()` uses UTC for period boundaries. A sale entered at 11pm Friday local time could be assigned to Saturday's period in UTC.
**Consequences:** Boundary sales assigned to wrong pay period. Intermittent and hard to reproduce.
**Prevention:** Standardize on UTC throughout, or use Luxon with explicit timezone. Document the timezone convention.
**Detection:** Enter sales near midnight and verify period assignment.
**Phase:** Phase 1, with arrears logic fix.

### P8: Sale Edits Skip Addon/Payment Recalculation
**What goes wrong:** If a sale is edited to change payment type (ACH → Check) or add/remove products, the commission and period assignment may not be recalculated.
**Consequences:** Stale payroll entries with wrong amounts or wrong periods.
**Prevention:** Any sale edit triggers full recalculation via `upsertPayrollEntryForSale`. Delete old payroll entry if period changes.
**Detection:** Edit a sale's payment type and verify the payroll entry moves to the correct period.
**Phase:** Phase 2, after core sale flow works.

### P9: No Socket.IO Events for Sale CRUD
**What goes wrong:** Only call audit events are emitted via Socket.IO. Sale creation, updates, and deletes don't notify other dashboards.
**Consequences:** Dashboards show stale data until manual refresh. Users think sales weren't entered.
**Prevention:** Emit events after every sale mutation: `sale:created`, `sale:updated`, `sale:deleted`. Dashboards subscribe and re-fetch.
**Detection:** Enter a sale on manager dashboard while watching payroll dashboard — payroll won't update.
**Phase:** Phase 2, after commission logic is correct.

### P10: Multi-Product Form Double-Submit
**What goes wrong:** Complex forms with multiple products and commission preview can be accidentally submitted twice, creating duplicate sales.
**Consequences:** Duplicate payroll entries, doubled commissions.
**Prevention:** Disable submit button on click, add server-side idempotency check (e.g., unique constraint on agent + saleDate + products hash within short window).
**Detection:** Rapidly click submit on sale form.
**Phase:** Phase 3, multi-product form implementation.

### P11: Payroll Period Status Not Enforced on Writes
**What goes wrong:** Finalized payroll periods can still receive new entries or modifications via API.
**Consequences:** "Final" payroll numbers change after export, causing reconciliation failures.
**Prevention:** Add middleware/service check: reject writes to FINALIZED periods. Return clear error message.
**Detection:** Finalize a period, then try to add a sale that maps to that period.
**Phase:** Phase 3, payroll workflow.

### P12: Clawback Period Targeting for ACH Sales
**What goes wrong:** Clawbacks for ACH sales paid two weeks in arrears may target the wrong period (original sale period vs the period where the ACH payment was actually made).
**Consequences:** Clawback deducted from wrong agent paycheck.
**Prevention:** Clawbacks should target the period where the commission was actually paid, not the sale date period.
**Detection:** Create an ACH sale, then clawback — verify which period is affected.
**Phase:** Phase 4, after core payroll flow works.

## Minor Pitfalls

### P13: Leaderboard Query Performance
**What goes wrong:** Sales board queries may scan full sales table without date filters as data grows.
**Prevention:** Add date range filters and database indexes on `saleDate`.
**Phase:** Phase 5, optimization.

### P14: Hardcoded Commission Fallback Defaults
**What goes wrong:** Commission calculation has fallback values (e.g., 0% if product type unknown) that mask configuration errors.
**Prevention:** Throw explicit error on unknown product type instead of defaulting to 0.
**Phase:** Phase 1, commission engine fixes.

### P15: Owner Dashboard Date Range Mixing
**What goes wrong:** KPI queries may mix date ranges (this week vs this month) producing inconsistent comparisons.
**Prevention:** Standardize date range calculation, share between routes.
**Phase:** Phase 4, reporting.

## Phase-Specific Warnings

| Phase | Watch For |
|-------|-----------|
| 1 (Fix Pipeline) | P1, P2, P3, P4, P5, P6, P7, P14 — all commission/period bugs |
| 2 (Wire Cascade) | P8, P9 — edit recalculation, socket events |
| 3 (Payroll UX) | P10, P11 — form safety, period enforcement |
| 4 (Reporting) | P12, P15 — clawback targeting, date consistency |
| 5 (Polish) | P13 — query performance |

---
*Research completed: 2026-03-14*
