---
phase: 36-fix-manager-sales-entry-parsing-error-and-payroll-ui-issues
verified: 2026-03-31T00:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
---

# Phase 36: Fix Manager Sales Entry Parsing Error and Payroll UI Issues — Verification Report

**Phase Goal:** Fix receipt parser product matching for names with special characters ($, commas), stabilize payroll agent pay card row ordering by member ID, and add ACA PL flat-commission product type with dedicated entry flows and sales board exclusion
**Verified:** 2026-03-31
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Receipt pasting a product named 'American Financial - Critical Illness $5,000' matches the correct DB product | VERIFIED | `matchProduct()` in ManagerEntry.tsx (line 256-273) uses `includes(lower) || lower.includes(pn)` with length ratio guard — no regex word boundaries remain |
| 2  | Receipt pasting a product named 'American Financial - Critical Illness $10,000' matches the correct DB product | VERIFIED | Same `matchProduct()` fix; `$` and `,` are no longer regex-escaped, handled by plain `includes()` |
| 3  | Payroll agent pay card entries display in member ID ascending order | VERIFIED | `sortedEntries = useMemo(...)` at PayrollPeriods.tsx line 593 sorts by `a.sale?.memberId` ascending with numeric comparison |
| 4  | Entries without a member ID appear at the top of the list in agent pay cards | VERIFIED | Comparator contains `if (!aId) return -1` (line 599) — nulls sort first |
| 5  | Editing an entry amount does not reorder the rows in the agent pay card | VERIFIED | Sort key is `memberId` which is immutable; `visibleEntries` uses `sortedEntries` (line 612) not raw `entries` |
| 6  | ACA_PL product type exists in the database schema and can be assigned to products | VERIFIED | `ACA_PL` added to `ProductType` enum in schema.prisma (line 57); migration SQL `ALTER TYPE "ProductType" ADD VALUE 'ACA_PL'` applied |
| 7  | Products can have a flatCommission decimal field for per-member flat dollar amounts | VERIFIED | `flatCommission Decimal? @map("flat_commission") @db.Decimal(12,2)` at schema.prisma line 140 |
| 8  | Sales can store a memberCount integer and acaCoveringSaleId reference | VERIFIED | `memberCount Int? @map("member_count")` (line 219) and `acaCoveringSaleId String? @map("aca_covering_sale_id")` (line 220) with self-relation `AcaCovering` on Sale model |
| 9  | Commission calculation for ACA_PL products equals flatCommission * memberCount | VERIFIED | `calculateCommission()` in payroll.ts lines 104-112: early return `Math.round(flatAmount * count * 100) / 100` before any percentage logic |
| 10 | ACA_PL sales do not appear in sales board queries | VERIFIED | Both `GET /sales-board/summary` (line 836) and `GET /sales-board/detailed` (line 879) in sales.ts filter `product: { type: { not: 'ACA_PL' } }` |
| 11 | ACA_PL sales do not count in agent sales counts | VERIFIED | Tracker summary (lines 645, 653) uses `product: { type: { not: 'ACA_PL' as const } }` in both `salesWhere` and `todaySalesWhere` |
| 12 | When an ACA_PL sale covers a parent sale, the parent's bundle requirement is auto-fulfilled | VERIFIED | `resolveBundleRequirement()` in payroll.ts (lines 229-237) queries `acaCoveringSaleId: saleId` with `product: { type: "ACA_PL" }` and returns `requiredAddonAvailable: true` if found; `upsertPayrollEntryForSale` passes `saleId` (line 325) |
| 13 | A dedicated POST /sales/aca endpoint creates ACA sales with relaxed validation | VERIFIED | `router.post("/sales/aca", ...)` at sales.ts line 135; Zod schema requires only `agentId`, `memberName`, `carrier`, `memberCount`, `productId` — `premium`, `effectiveDate`, `leadSourceId` are NOT required |

**Score:** 13/13 truths verified

---

## Required Artifacts

### Plan 36-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` | Fixed matchProduct using includes() with length ratio guard | VERIFIED | Lines 256-273; `pn.includes(lower) \|\| lower.includes(pn)`, `shorter / longer > 0.5`, `.trim()`, no `\b` regex patterns |
| `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` | Stable entry sort by member ID ascending within AgentPayCard | VERIFIED | `sortedEntries` via `useMemo` at lines 593-608; `visibleEntries` references `sortedEntries` at lines 612-613 |

### Plan 36-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | ACA_PL enum value, flatCommission on Product, memberCount and acaCoveringSaleId on Sale | VERIFIED | All four fields present; migration file at `prisma/migrations/20260331000000_add_aca_pl_product_type/migration.sql` |
| `apps/ops-api/src/services/payroll.ts` | Flat commission calculation path for ACA_PL products | VERIFIED | `sale.product.type === "ACA_PL"` check at line 105; flat path at lines 106-112 |
| `apps/ops-api/src/routes/sales.ts` | POST /sales/aca endpoint and ACA_PL exclusion from board queries | VERIFIED | `router.post("/sales/aca"` at line 135; exclusion filters at lines 836, 879, 645, 653 |

### Plan 36-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` | ACA checkbox on sale form + standalone ACA entry section | VERIFIED | `"Include ACA Plan"` checkbox at line 675; `"ACA-Only Entry"` section at lines 943-1043; both modes call `/api/sales/aca` |
| `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` | ACA badge and flat commission display in agent pay cards | VERIFIED | `ACA_BADGE` const at line 154; conditional badge at line 344; flat commission format `"$X.XX x N members = $total"` at lines 391-394 |
| `apps/ops-api/src/routes/payroll.ts` | Extended payroll entry query with memberCount, product.type, product.flatCommission | VERIFIED | Both GET (line 15) and PATCH (line 210) include `memberCount` on sale and `flatCommission` + `type` on product |

---

## Key Link Verification

### Plan 36-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ManagerEntry.tsx matchProduct() | products array from API | includes() containment check with length ratio guard | VERIFIED | `shorter / longer > 0.5 && (pn.includes(lower) \|\| lower.includes(pn))` at line 268 |
| PayrollPeriods.tsx AgentPayCard | entries array | useMemo sort by sale.memberId ascending | VERIFIED | `useMemo(() => [...entries].sort(...))` referencing `sortedEntries` for `visibleEntries` |

### Plan 36-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| prisma/schema.prisma ProductType enum | payroll.ts calculateCommission | ACA_PL type check at top of function | VERIFIED | `sale.product.type === "ACA_PL"` first check in calculateCommission; accesses `flatCommission` and `memberCount` |
| sales.ts POST /sales/aca | payroll.ts upsertPayrollEntryForSale | same payroll upsert flow after sale creation | VERIFIED | `await upsertPayrollEntryForSale(sale.id)` at sales.ts line 176; covered sale recalc at line 226 (approx) |
| sales.ts sales-board queries | prisma sale.findMany | product type exclusion filter | VERIFIED | `product: { type: { not: 'ACA_PL' } }` in both summary and detailed queries |

### Plan 36-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ManagerEntry.tsx ACA checkbox | POST /sales/aca API endpoint | authFetch after regular sale creation | VERIFIED | `authFetch(\`${API}/api/sales/aca\`, ...)` with `acaCoveringSaleId: sale.id` at lines 482-493 |
| ManagerEntry.tsx standalone ACA form | POST /sales/aca API endpoint | authFetch with agentId, memberName, carrier, memberCount | VERIFIED | `authFetch(\`${API}/api/sales/aca\`, ...)` at lines 1009-1018 |
| PayrollPeriods.tsx entry row | entry.sale.product.type | conditional ACA badge rendering | VERIFIED | `entry.sale?.product?.type === "ACA_PL" && <span style={ACA_BADGE}>ACA</span>` at line 344 |

---

## Requirements Coverage

Requirements D-01 through D-13 are defined in `.planning/phases/36-fix-manager-sales-entry-parsing-error-and-payroll-ui-issues/36-CONTEXT.md`. REQUIREMENTS.md tracks earlier milestone requirements (TYPO-xx, SCAL-xx, OVFL-xx) and does not contain D-prefixed requirements — these are phase-local defect requirements defined in the CONTEXT file.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| D-01 | 36-01 | matchProduct() fails on $ and , in product names | SATISFIED | includes()-based matching with no regex in matchProduct() |
| D-02 | 36-01 | DB product names include dollar amounts | SATISFIED | matchProduct() handles exact names with $ characters |
| D-03 | 36-01 | Parser strips "- Add-on"; issue is solely in matchProduct() | SATISFIED | matchProduct() fix is scoped to containment matching only |
| D-04 | 36-01 | Scope fix to dollar-amount/special-character handling | SATISFIED | No regex changes outside matchProduct(); exact match path preserved |
| D-05 | 36-01 | Sort entries by member ID ascending in agent pay cards | SATISFIED | useMemo sort by memberId ascending in AgentPayCard |
| D-06 | 36-01 | Entries without member ID sort to top | SATISFIED | `if (!aId) return -1` in comparator |
| D-07 | 36-01 | Sort applies only to agent pay cards — CSV exports unchanged | SATISFIED | Agent card-level sort (by gross premium) not modified; sort scoped to sortedEntries in AgentPayCard |
| D-08 | 36-02 | ACA PL pays flat dollar per member; commission = flatAmount * memberCount | SATISFIED | calculateCommission() ACA_PL early return: `Math.round(flatAmount * count * 100) / 100` |
| D-09 | 36-02 | Add flatCommission field to Product model | SATISFIED | `flatCommission Decimal? @map("flat_commission")` in schema.prisma and migration |
| D-10 | 36-03 | ACA carrier name enterable per sale | SATISFIED | `carrier: z.string().min(1)` required in POST /sales/aca Zod schema; carrier input fields in both ACA UI modes |
| D-11 | 36-03 | Two entry modes: attached to regular sale (checkbox) and standalone | SATISFIED | "Include ACA Plan" checkbox with conditional fields + standalone "ACA-Only Entry" collapsible section |
| D-12 | 36-02 | ACA_PL excluded from agent sales counts and sales board | SATISFIED | tracker/summary, sales-board/summary, and sales-board/detailed all filter `product: { type: { not: 'ACA_PL' } }` |
| D-13 | 36-02 | ACA PL auto-fulfills bundle requirement | SATISFIED | resolveBundleRequirement() checks acaCoveringSaleId for ACA covering sale and returns requiredAddonAvailable: true |

**Coverage:** 13/13 requirements satisfied. No orphaned requirements.

---

## Anti-Patterns Found

No blockers found. Minor observations:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/ops-api/src/services/payroll.ts` | 107 | Type cast `(sale as SaleWithProduct & { memberCount?: number \| null })` to access memberCount | Info | Works correctly; indicates SaleWithProduct type doesn't yet include memberCount from the schema migration. Functional but could be improved with a proper type update. |

---

## Human Verification Required

The following behaviors require a running environment to verify visually:

### 1. Receipt Paste Product Matching

**Test:** In the manager entry form, paste a receipt containing "American Financial - Critical Illness $5,000". Verify the product auto-populates in the product dropdown.
**Expected:** The product field fills with the matching product; no "no match" warning appears.
**Why human:** Product matching depends on runtime data from the DB products list; cannot trace the exact DB product names statically.

### 2. ACA Checkbox Conditional Fields

**Test:** On the manager sale entry form, check "Include ACA Plan". Verify the carrier and member count fields slide in below the checkbox.
**Expected:** Two fields appear: "Carrier" (text input) and "Members" (number input, default 1).
**Why human:** Conditional rendering correctness requires visual inspection of the rendered DOM.

### 3. ACA-Only Entry Standalone Submission

**Test:** Click "ACA-Only Entry" to expand the section. Select an agent, fill member name, carrier, and set member count to 3. Click "Submit ACA Entry".
**Expected:** Success message "ACA entry submitted" appears; fields reset; sale count on the sales board does NOT increment.
**Why human:** Requires live API, database write, and sales board WebSocket to verify the exclusion end-to-end.

### 4. Payroll ACA Badge and Commission Format

**Test:** In a payroll period with an ACA_PL entry, open the agent's pay card.
**Expected:** The ACA entry shows a blue "ACA" badge next to the product name. Commission cell displays "$X.XX x N members = $total" format.
**Why human:** Requires live payroll data with an ACA_PL entry; badge color and layout need visual confirmation.

### 5. Payroll Row Stable Sort

**Test:** In an agent pay card with multiple entries, edit the payout amount on one entry.
**Expected:** Rows do not reorder after editing; order stays locked by member ID.
**Why human:** Row stability on edit requires interaction with the live component.

---

## Summary

Phase 36 achieved its goal across all three plans. All 13 observable truths are verified against the actual codebase:

- **Plan 36-01 (bugs):** `matchProduct()` in ManagerEntry.tsx correctly uses `includes()` with a length ratio guard instead of broken regex word boundaries. PayrollPeriods.tsx `AgentPayCard` sorts entries by member ID via a `useMemo` comparator with nulls-first ordering.

- **Plan 36-02 (backend):** The Prisma schema has the `ACA_PL` enum value, `flatCommission` on Product, and `memberCount`/`acaCoveringSaleId` on Sale, with a migration applied. `calculateCommission()` early-returns for ACA_PL with `flatAmount * count`. `POST /sales/aca` endpoint exists with relaxed Zod validation. Sales board and tracker summary queries all exclude ACA_PL via product type filters. Bundle auto-fulfill wired through `resolveBundleRequirement()` accepting optional `saleId`.

- **Plan 36-03 (UI):** ManagerEntry.tsx has the "Include ACA Plan" checkbox with conditional carrier/member count fields, and a standalone collapsible "ACA-Only Entry" section — both call `POST /sales/aca`. PayrollPeriods.tsx renders an info-blue ACA badge on ACA_PL entries and formats commission as `$X.XX x N members = $total`. The payroll API route returns `memberCount` and `flatCommission` in sale selects.

One minor type cast issue (payroll.ts line 107) is noted but does not affect runtime correctness.

---

_Verified: 2026-03-31_
_Verifier: Claude (gsd-verifier)_
