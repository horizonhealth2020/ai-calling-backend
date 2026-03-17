---
phase: 10-sale-status-payroll-logic
verified: 2026-03-15T18:00:00Z
status: human_needed
score: 14/14 must-haves verified
re_verification: false
human_verification:
  - test: "End-to-end sale creation with status selection"
    expected: "Sales form shows required status dropdown (Ran/Declined/Dead) with blank default; submit button is disabled until status is selected; submitting without status shows validation message"
    why_human: "Visual behavior, disabled state, and DOM-level HTML required attribute cannot be verified programmatically"
  - test: "Status change confirmation dialog on Dead/Declined -> Ran"
    expected: "Changing a Dead or Declined sale to Ran in the agent sales tab shows window.confirm dialog before calling the API; confirming shows 'Change request submitted for payroll approval' message"
    why_human: "window.confirm invocation and message display are runtime/browser behaviors"
  - test: "Pending Ran badge replaces dropdown for sales with pending change request"
    expected: "A sale with hasPendingStatusChange=true shows amber 'Pending Ran' badge (with hourglass) instead of an editable dropdown — the sale is not editable while pending"
    why_human: "Conditional render depends on API response data in browser session"
  - test: "Payroll dashboard pending approval section in agent cards"
    expected: "An agent's payroll card shows a Pending Approvals section (amber left border, clock icon) when that agent has a pending change request; Approve and Reject buttons are visible"
    why_human: "Visual rendering and data grouping by agentId require a live session with test data"
  - test: "Approve action triggers commission recalculation"
    expected: "Clicking Approve on a change request updates the sale to RAN, recalculates commission, and the payroll entry payout amount changes from $0 to the calculated commission"
    why_human: "Requires database state, API call chain, and UI refresh to verify end-to-end"
  - test: "Period totals exclude Dead/Declined $0 entries"
    expected: "A period with one RAN sale and one DECLINED sale shows sale count=1 and net amount reflecting only the RAN sale; the DECLINED entry is visible as a grayed-out row but does not contribute to totals"
    why_human: "Requires live database state with mixed-status entries to verify filtering"
  - test: "Sales board and owner KPIs exclude non-RAN sales"
    expected: "Dead/Declined sales do not appear on the sales leaderboard; owner summary counts and aggregate amounts reflect only RAN sales"
    why_human: "Requires live data in multiple statuses to verify filter behavior in browser"
---

# Phase 10: Sale Status Payroll Logic Verification Report

**Phase Goal:** Replace SaleStatus enum with Ran/Declined/Dead, add approval workflow for status changes that affect commission, gate commission to RAN-only, update all dashboards.
**Verified:** 2026-03-15T18:00:00Z
**Status:** human_needed — all 14/14 automated checks pass; 7 items require human verification in a running environment
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | SaleStatus enum has exactly RAN, DECLINED, DEAD | VERIFIED | `prisma/schema.prisma` lines 33-37: `enum SaleStatus { RAN DECLINED DEAD }` |
| 2 | All existing sales migrate to RAN via SQL | VERIFIED | `migration.sql` CASE maps SUBMITTED/APPROVED/REJECTED/CANCELLED → RAN |
| 3 | StatusChangeRequest model exists with correct relations | VERIFIED | Schema lines 282-301: full model with sale (Cascade), requester, reviewer relations, indexes on sale_id and status |
| 4 | Only RAN sales generate non-zero commission | VERIFIED | `payroll.ts` line 204: `const payoutAmount = sale.status === 'RAN' ? calculateCommission(sale) : 0;` |
| 5 | POST /api/sales accepts RAN/DECLINED/DEAD, no default | VERIFIED | `routes/index.ts` line 293: `status: z.enum(["RAN", "DECLINED", "DEAD"])` — no `.default()` call |
| 6 | PATCH /api/sales/:id does not accept status field | VERIFIED | `routes/index.ts` lines 341-349: schema fields are memberName, memberId, carrier, premium, enrollmentFee, memberState, notes — no status |
| 7 | Dead/Declined → Ran creates StatusChangeRequest (not direct update) | VERIFIED | `routes/index.ts` lines 396-421: transaction creates `statusChangeRequest`, returns `{ changeRequest, message }` — sale.status not changed |
| 8 | Ran → Dead/Declined zeroes commission immediately | VERIFIED | `routes/index.ts` lines 424-438: calls `handleCommissionZeroing(sale.id)`, also cancels orphaned pending requests |
| 9 | Dead ↔ Declined transitions apply immediately with no commission impact | VERIFIED | `routes/index.ts` lines 441-448: direct `prisma.sale.update` with no commission call |
| 10 | PAYROLL/SUPER_ADMIN can approve, triggering commission recalculation | VERIFIED | `routes/index.ts` lines 1182-1209: transaction updates request+sale status, then calls `upsertPayrollEntryForSale(changeRequest.saleId)` |
| 11 | PAYROLL/SUPER_ADMIN can reject, sale stays at original status | VERIFIED | `routes/index.ts` lines 1211-1225: only updates change request status to REJECTED; no sale.status change |
| 12 | Sales board and owner KPIs only count RAN sales | VERIFIED | `routes/index.ts` line 801: `status: 'RAN' as const` on owner/summary; lines 816-817: `where: { status: 'RAN', ... }` on both groupBy queries; line 846 on sales-board/detailed |
| 13 | GET /api/sales returns hasPendingStatusChange boolean per sale | VERIFIED | `routes/index.ts` lines 329-335: `_count` filtered select on PENDING statusChangeRequests, mapped to boolean |
| 14 | Payroll dashboard shows pending approvals and corrected period totals | VERIFIED | `payroll-dashboard/app/page.tsx` lines 749-838: pendingRequests state, authFetch to status-change-requests, approve/reject functions; `isActiveEntry()` function at lines 180-186 used across 5+ aggregation points |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | Updated SaleStatus enum, ChangeRequestStatus enum, StatusChangeRequest model | VERIFIED | All three present; StatusChangeRequest has id, saleId, requestedBy, requestedAt, oldStatus, newStatus, status, reviewedBy, reviewedAt, createdAt |
| `prisma/migrations/20260315_sale_status_replacement/migration.sql` | Manual SQL migration with CASE mapping all old values to RAN | VERIFIED | 65-line migration: creates SaleStatus_new, CASE maps all 4 old values to RAN, drops old enum, creates ChangeRequestStatus, creates status_change_requests table with FKs and indexes |
| `apps/ops-api/src/services/payroll.ts` | Commission gating and handleCommissionZeroing export | VERIFIED | Line 204: status gate; lines 172-195: exported `handleCommissionZeroing` |
| `apps/ops-api/src/routes/index.ts` | 4 new endpoints, filtered queries, hasPendingStatusChange | VERIFIED | PATCH /sales/:id/status (line 381), GET /status-change-requests (1169), POST approve (1182), POST reject (1211); owner/summary and sales-board filters; hasPendingStatusChange mapping |
| `apps/ops-api/src/services/__tests__/status-commission.test.ts` | Wave 0 test stubs | VERIFIED | 6 `it.todo()` stubs inside correct `describe` block |
| `apps/ops-api/src/services/__tests__/status-change.test.ts` | Wave 0 test stubs | VERIFIED | 8 `it.todo()` stubs across 3 `describe` blocks |
| `apps/manager-dashboard/app/page.tsx` | StatusBadge, status dropdown in form, editable status in sales tab | VERIFIED | StatusBadge lines 359-373 (4 statuses + hourglass icon); form dropdown lines 986-996 (blank default, required validation); agent sales tab lines 1403-1427 (PENDING_RAN badge vs dropdown, handleStatusChange) |
| `apps/payroll-dashboard/app/page.tsx` | Pending approval sections, approve/reject, filtered totals | VERIFIED | StatusChangeRequest type, pendingRequests state, approveChangeRequest/rejectChangeRequest functions, amber-bordered sections in agent cards lines 1643-1733, isActiveEntry filter used in 5 aggregation points |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `payroll.ts (upsertPayrollEntryForSale)` | `prisma/schema.prisma SaleStatus` | `sale.status === 'RAN'` | WIRED | Line 204: gating literal matches enum value |
| `routes/index.ts POST /api/sales` | `prisma/schema.prisma SaleStatus` | `z.enum(["RAN","DECLINED","DEAD"])` | WIRED | Line 293: Zod enum mirrors Prisma enum exactly |
| `PATCH /sales/:id/status` | `StatusChangeRequest model` | `prisma.statusChangeRequest.create` | WIRED | Lines 404-411: creates request in transaction for Dead/Declined→Ran |
| `POST /status-change-requests/:id/approve` | `upsertPayrollEntryForSale` | Commission recalculation on approval | WIRED | Line 1199: `await upsertPayrollEntryForSale(changeRequest.saleId)` called after transaction |
| `sales-board/summary` | `prisma.sale` | `status: 'RAN'` filter | WIRED | Lines 816-817: both daily and weekly groupBy include `status: 'RAN'` |
| `GET /api/sales` | `manager-dashboard/app/page.tsx` | `hasPendingStatusChange` boolean | WIRED | API maps `_count` to boolean; Sale type in manager dashboard includes `hasPendingStatusChange?: boolean` (line 80); consumed at line 1404 |
| `manager-dashboard/app/page.tsx (sales form)` | `POST /api/sales` | `authFetch` with status in body | WIRED | Form state includes `status` field; form submit sends it; status required per Zod schema |
| `manager-dashboard/app/page.tsx (agent sales tab)` | `PATCH /api/sales/:id/status` | `authFetch` on status change | WIRED | `handleStatusChange` (line 801) calls `${API}/api/sales/${saleId}/status` |
| `payroll-dashboard/app/page.tsx` | `GET /api/status-change-requests` | `authFetch` on mount | WIRED | Line 785: fetched alongside other data on component mount |
| `payroll-dashboard/app/page.tsx (approve button)` | `POST /api/status-change-requests/:id/approve` | `authFetch` on click | WIRED | `approveChangeRequest` function line 815 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| STATUS-01 | 10-01 | SaleStatus enum replaced with RAN/DECLINED/DEAD; existing sales migrated to RAN | SATISFIED | `prisma/schema.prisma` enum confirmed; migration.sql maps all 4 old values to RAN |
| STATUS-02 | 10-01 | StatusChangeRequest model exists with correct relations and migration SQL | SATISFIED | Model at schema lines 282-301; SQL creates table with FKs and indexes |
| STATUS-03 | 10-01 | Only RAN sales generate non-zero commission; DECLINED/DEAD create $0 payroll entries | SATISFIED | `payroll.ts` line 204: status gate; upsert creates $0 entry for non-RAN |
| STATUS-04 | 10-02 | Dead/Declined to Ran creates a change request instead of applying immediately | SATISFIED | PATCH /sales/:id/status lines 396-421: creates StatusChangeRequest, returns changeRequest in response |
| STATUS-05 | 10-02 | Ran to Dead/Declined zeroes commission immediately with finalized period handling | SATISFIED | Lines 424-438: calls `handleCommissionZeroing`; function handles OPEN (ZEROED_OUT) and finalized (CLAWBACK_APPLIED) |
| STATUS-06 | 10-02 | Payroll/SuperAdmin can approve a change request, triggering commission recalculation | SATISFIED | POST /status-change-requests/:id/approve: transaction updates request + sale, then calls upsertPayrollEntryForSale |
| STATUS-07 | 10-02 | Payroll/SuperAdmin can reject a change request, reverting to original status | SATISFIED | POST /status-change-requests/:id/reject: only updates change request; sale.status untouched (already at original Dead/Declined) |
| STATUS-08 | 10-02 | Sales board and owner KPIs only count RAN sales | SATISFIED | owner/summary line 801, sales-board/summary lines 816-817, sales-board/detailed line 846 all filter `status: 'RAN'` |
| STATUS-09 | 10-03 | Sales entry form has required status dropdown (blank default, Ran/Declined/Dead) | SATISFIED | `manager-dashboard/app/page.tsx` lines 986-996: select with disabled blank option, button disabled when `!form.status` |
| STATUS-10 | 10-03 | Agent sales tab has editable status dropdown with approval workflow confirmation | SATISFIED | Lines 1403-1427: conditional PENDING_RAN badge vs dropdown; handleStatusChange confirms before Dead/Declined→Ran call |
| STATUS-11 | 10-03 | StatusBadge shows correct colors: Ran=green, Declined=red, Dead=gray, Pending Ran=amber | SATISFIED | Lines 359-373: map `{ RAN: "#22c55e", DECLINED: "#ef4444", DEAD: "#6b7280", PENDING_RAN: "#f59e0b" }` with hourglass for PENDING_RAN |
| STATUS-12 | 10-04 | Payroll dashboard shows pending approval requests inside agent payroll cards | SATISFIED | Lines 1643-1733: pendingRequests filtered by agentId, rendered inside agent card with amber highlight |
| STATUS-13 | 10-04 | Period totals exclude $0 entries from Dead/Declined sales | SATISFIED | `isActiveEntry()` function at lines 180-186 used in period totals (line 1363), agent subtotals (line 1523), export CSV (line 959), and agent card totals (lines 1631-1633) |
| STATUS-14 | 10-04 | Payroll can approve/reject change requests from within payroll cards | SATISFIED | `approveChangeRequest` (line 815) and `rejectChangeRequest` (line 833) called from Approve/Reject buttons at lines 1706/1718 |

All 14 STATUS requirements: SATISFIED.

No orphaned requirements — all STATUS-01 through STATUS-14 were claimed in plans and verified.

---

### Anti-Patterns Found

No blockers or stubs detected.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `status-commission.test.ts` | 3-9 | `it.todo()` test stubs | Info | Intentional Wave 0 stubs — tests are pending, not failing. Documented in plan as required. |
| `status-change.test.ts` | 3-17 | `it.todo()` test stubs | Info | Intentional Wave 0 stubs — tests are pending, not failing. Documented in plan as required. |

Note: The `@default(RAN)` on `Sale.status` in schema (line 150) does not conflict with the "no default" requirement — the Zod schema for POST /api/sales has no `.default()`, making it a required API field. The DB-level default is a safety net only, never reached through the API.

Note: `handleCommissionZeroing` for CLAWBACK_APPLIED does not update `netAmount` — this is consistent with the existing clawback pattern in routes (line 620) which also only updates `adjustmentAmount`. This is pre-existing behavior, not a regression.

---

### Human Verification Required

### 1. Sales Form Status Dropdown Behavior

**Test:** Start the manager dashboard (`npm run manager:dev`), navigate to the Sales Entry tab, examine the status field.
**Expected:** A "Status *" label appears with a dropdown showing "Select status..." as the default (disabled/grayed), plus Ran, Declined, Dead options. The Submit Sale button is grayed/disabled until a status is selected. If status is not selected, "Status is required" text appears below the dropdown.
**Why human:** Visual disabled state, HTML `required` enforcement, and submit button opacity require browser rendering to verify.

### 2. Dead/Declined to Ran Confirmation Dialog

**Test:** Create a sale with status "Dead" on the manager dashboard. Navigate to the agent's sales tab and find that sale. Change the status dropdown to "Ran".
**Expected:** A `window.confirm` dialog appears: "This will create a change request for payroll approval. Continue?" Clicking Cancel aborts the change. Clicking OK calls the API and shows a success message: "Change request submitted for payroll approval".
**Why human:** `window.confirm` invocation and transient success message display require a live browser session.

### 3. Pending Ran Badge Rendering

**Test:** After the change request is created (from test 2), reload the manager dashboard sales tab.
**Expected:** The Dead sale now shows an amber "Pending Ran" badge with a hourglass icon instead of an editable dropdown. The sale cannot be status-changed while the request is pending.
**Why human:** Depends on `hasPendingStatusChange: true` returned from GET /api/sales after the change request is created — requires live API state and browser rendering.

### 4. Payroll Dashboard Pending Approval Section

**Test:** Log in as a PAYROLL or SUPER_ADMIN user, open the payroll dashboard, expand the relevant period, and find the agent's payroll card.
**Expected:** An amber-highlighted "Pending Approvals" section appears inside the card showing the member name, member ID, product, old→new status transition, requester name, and date. Approve and Reject buttons are present.
**Why human:** Requires live data (pending StatusChangeRequest in DB), correct agentId grouping, and visual rendering with amber border styling.

### 5. Approve Action End-to-End

**Test:** Click Approve on a pending request in the payroll dashboard.
**Expected:** The pending approval section disappears. The sale's payroll entry changes from $0 (ZEROED_OUT) to the calculated commission amount. The period totals update to include the newly approved sale. The sale status on the manager dashboard shows "Ran" (no longer Pending Ran).
**Why human:** Requires the full chain: API POST approve → DB transaction → upsertPayrollEntryForSale → UI refresh showing correct values.

### 6. Period Totals Filtering (Dead/Declined Excluded)

**Test:** Create one RAN sale and one DECLINED sale for the same agent in the same week. Open the payroll dashboard and find that period.
**Expected:** The period header shows sale count = 1 (not 2), and the net amount reflects only the RAN sale's commission. The DECLINED sale appears as a row in the agent's card (grayed out with a "Declined" badge) but does not add to the totals.
**Why human:** Requires controlled test data with mixed statuses to verify the isActiveEntry filter is correctly applied in all aggregation points.

### 7. Sales Board Leaderboard Filtering

**Test:** Create one RAN sale and one DEAD sale for different agents. Open the sales board.
**Expected:** Only the agent with the RAN sale appears in the leaderboard counts. The DEAD sale agent has no entry on the board (or zero if they have other RAN sales).
**Why human:** Requires live data in both statuses and visual verification of the leaderboard display.

---

### Gaps Summary

No gaps. All 14 STATUS requirements are verified against the actual codebase. The implementation is substantive and fully wired across all four layers (schema, API, manager dashboard, payroll dashboard).

The 7 human verification items are required because they test runtime behavior (window.confirm, visual state changes, live database state, UI reactivity after API calls) that cannot be confirmed through static code analysis alone.

---

*Verified: 2026-03-15T18:00:00Z*
*Verifier: Claude (gsd-verifier)*
