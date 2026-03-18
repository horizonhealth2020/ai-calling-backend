---
phase: 14-tracking-tables
verified: 2026-03-18T15:30:00Z
status: human_needed
score: 15/15 must-haves verified
human_verification:
  - test: "Confirm REQUIREMENTS.md TRKC-02 wording ('15 specified columns') reflects the locked design decision to use 8 columns"
    expected: "REQUIREMENTS.md updated to match the UI-SPEC column count of 8, or stakeholder confirms 8 columns is the accepted scope"
    why_human: "REQUIREMENTS.md says '15 specified columns' but the UI-SPEC (locked design contract) specifies 8 columns. CONTEXT.md explicitly locks the decision to 8. Implementation follows the UI-SPEC. A human must confirm whether the requirement text needs updating."
  - test: "Confirm REQUIREMENTS.md TRKT-02 wording ('active/first_billing blue, hold_reason red italic') reflects the locked design decision to omit those columns"
    expected: "REQUIREMENTS.md updated to match UI-SPEC columns (hold_date red, next_billing green only), or stakeholder confirms omitting active_date, first_billing, and hold_reason as visible columns is acceptable"
    why_human: "REQUIREMENTS.md references color coding for active/first_billing blue and hold_reason red italic, but the UI-SPEC explicitly excludes these as visible table columns. The implementation follows the UI-SPEC. A human must confirm the requirement text is stale."
  - test: "Load the Tracking tab in a browser and verify KPI counters animate on load (AnimatedNumber count-up visible)"
    expected: "All 4 KPI counters animate from 0 to their values over 600ms on initial page load"
    why_human: "AnimatedNumber visual animation cannot be verified programmatically."
  - test: "Click a chargeback column header twice and verify sort direction toggles with chevron indicator"
    expected: "First click sorts ascending (ChevronUp shown), second click sorts descending (ChevronDown shown)"
    why_human: "Interactive table sort behavior requires browser-level verification."
  - test: "Click the Filters button and verify both filter panels expand/collapse together"
    expected: "Chargeback and pending terms filter panels both toggle on one button click; Clear Filters appears when any filter is active"
    why_human: "Interactive collapsible panel behavior requires browser-level verification."
  - test: "Click an agent group header in the pending terms table and verify the section collapses and expands"
    expected: "ChevronRight shown when collapsed, ChevronDown when expanded; rows hide/show on toggle"
    why_human: "Interactive collapsible group behavior requires browser-level verification."
  - test: "Log in as a CUSTOMER_SERVICE role user and verify the Export CSV button is absent; log in as OWNER_VIEW and verify it is present"
    expected: "Export CSV button absent for non-export roles, present for SUPER_ADMIN and OWNER_VIEW"
    why_human: "Role-gated UI visibility requires live auth session testing."
  - test: "Click Export CSV and verify the downloaded file contains both chargeback and pending terms sections"
    expected: "CSV file named cs-tracking-YYYY-MM-DD.csv with '--- CHARGEBACKS ---' and '--- PENDING TERMS ---' sections, filtered rows matching what is on screen"
    why_human: "File download behavior and CSV content require browser-level testing."
---

# Phase 14: Tracking Tables Verification Report

**Phase Goal:** Add chargeback and pending terms tracking tables to the CS dashboard with KPI bars, filters, sortable tables, and CSV export
**Verified:** 2026-03-18T15:30:00Z
**Status:** human_needed — all automated checks passed; 8 items require human/browser verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

#### Plan 01: Chargeback KPI Bar & Tracking Table

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | KPI bar shows 4 counters: Total Chargebacks (red), Total Recovered (green, $0), Net Exposure, Records count | VERIFIED | Lines 1638, 1647, 1656, 1665: TICKER_LABEL spans present; AnimatedNumber on lines 1640, 1649, 1658, 1667 |
| 2 | KPI counters always show global totals unaffected by search or filters | VERIFIED | Counters bound to `totals` state from `/api/chargebacks/totals`; filter state (`cbFilters`, `searchTerm`) does not affect `totals` |
| 3 | Chargeback table displays 8 data columns + delete button with chargeback_amount always red | VERIFIED | 8 SortHeader components (lines 1824-1831); `color: colors.danger` on chargebackAmount td (line 1843) |
| 4 | Shared search box filters chargeback table by payeeName, memberAgentCompany, memberId, memberAgentId | VERIFIED | filteredChargebacks useMemo (lines 1404-1407) matches all 4 fields |
| 5 | Collapsible filter panel filters chargebacks by date range, product, member company, member agent company, amount range | VERIFIED | cbFiltersOpen state; 7 filter inputs rendered at lines 1730-1754 |
| 6 | All chargeback columns are sortable with ascending/descending toggle | VERIFIED | SortHeader component defined at line 1308; handleCbSort at line 1544; all 8 columns use SortHeader |
| 7 | Export CSV button is visible only to SUPER_ADMIN and OWNER_VIEW roles | VERIFIED | `canExport` at line 1581 checks both roles; conditional render at line 1706 |

#### Plan 02: Pending Terms Summary Bar, Grouped Table & CSV Export

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 8 | Summary bar shows total pending records, count per hold_reason category, and urgent count (next_billing within 7 days) in red | VERIFIED | ptSummary useMemo (lines 1497-1520); TOTAL PENDING (line 1879), hold_reason pills (line 1888), DUE WITHIN 7 DAYS in colors.danger (line 1907-1908) |
| 9 | Pending terms table shows 7 columns: Member Name, Member ID, Phone, Product, Hold Date, Next Billing, Assigned To | VERIFIED | 7 SortHeader components (lines 1927-1933) |
| 10 | agent_name and agent_id are never shown as visible table columns | VERIFIED | grep for `agentName.*baseTdStyle` or `baseTdStyle.*agentName` returns 0 matches; agentName used only for grouping/filtering |
| 11 | Records are grouped by agent name with collapsible sections showing agent name and record count | VERIFIED | groupedPending useMemo (line 1486); toggleGroup (line 1572); collapsed Set (line 1367); colSpan={8} group header rows (line 1946) |
| 12 | Pending terms filters work: agent, state, product, hold_reason, date ranges | VERIFIED | ptFilters state has keys: agent, state, product, holdReason, dateFrom, dateTo (line 1359); filter inputs at lines 1796+ |
| 13 | Shared search box filters pending terms by memberName, memberId, agentName, agentId, phone | VERIFIED | filteredPending useMemo (lines 1446-1450) searches all 5 fields |
| 14 | CSV export includes both chargebacks and pending terms data | VERIFIED | exportCSV at line 1591; filteredPending.forEach at line 1613 appends pending terms rows; CSV header at line 1612 |
| 15 | Color coding: holdDate red, nextBilling green | VERIFIED | Line 1971: `color: colors.danger` for holdDate; line 1972: `color: colors.success` for nextBilling |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/ops-api/src/routes/index.ts` | GET /api/chargebacks/totals endpoint | VERIFIED | Line 1992: `router.get("/chargebacks/totals", requireAuth, asyncHandler(...))`; uses `prisma.chargebackSubmission.aggregate` with `_sum` and `_count`; returns `totalChargebacks` (Math.abs), `totalRecovered` (0), `recordCount` |
| `apps/cs-dashboard/app/page.tsx` | Rewritten TrackingTab with KPI bar, search, filters, sortable chargeback table, pending terms summary bar and grouped table | VERIFIED | Contains TOTAL CHARGEBACKS, TOTAL RECOVERED, NET EXPOSURE, RECORDS, TOTAL PENDING, DUE WITHIN 7 DAYS; SortHeader component; filteredChargebacks, filteredPending, groupedPending useMemos; canExport; exportCSV |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/cs-dashboard/app/page.tsx` | `/api/chargebacks/totals` | `authFetch` in `fetchData` | WIRED | Line 1375: `authFetch(\`${API}/api/chargebacks/totals\`)` inside Promise.all; result assigned to `totals` state (line 1380) |
| `apps/cs-dashboard/app/page.tsx` | `/api/session/me` | `authFetch` for role detection | WIRED | Line 1378: `authFetch(\`${API}/api/session/me\`)`; roles extracted and stored in `userRoles` state (lines 1382-1385) |
| `apps/cs-dashboard/app/page.tsx` | `/api/pending-terms` | `authFetch` in `fetchData` | WIRED | Line 1377: `authFetch(\`${API}/api/pending-terms\`)`; result stored in `pendingTerms` state (line 1381) |
| `apps/cs-dashboard/app/page.tsx` | `filteredPending` | useMemo pipeline for pending terms | WIRED | Line 1439: `const filteredPending = useMemo(...)` consuming `pendingTerms`, `searchTerm`, `ptFilters`, `ptSortKey`, `ptSortDir` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TRKC-01 | 14-01 | KPI counter bar with 4 animated counters | SATISFIED | 4 AnimatedNumber components (lines 1640, 1649, 1658, 1667); all use duration={600} |
| TRKC-02 | 14-01 | Chargeback table with chargeback_amount always red | PARTIALLY SATISFIED* | 8 columns implemented (per UI-SPEC); chargebackAmount always `colors.danger`; REQUIREMENTS.md says "15 columns" but UI-SPEC locks to 8 |
| TRKC-03 | 14-01 | Table filterable by date range, product, member company, member agent company, amount range | SATISFIED | 7 filter fields in cbFilters (lines 1412-1418; UI at lines 1730-1754) |
| TRKC-04 | 14-01 | Table searchable by payee name, member agent company, member ID, member agent ID | SATISFIED | filteredChargebacks useMemo lines 1404-1407 |
| TRKC-05 | 14-01 | Table sortable by any column | SATISFIED | All 8 columns use SortHeader; handleCbSort toggles asc/desc |
| TRKC-06 | 14-01 | CSV export for owner and super_admin only | SATISFIED | canExport checks SUPER_ADMIN|OWNER_VIEW (line 1581); conditional render (line 1706) |
| TRKT-01 | 14-02 | Summary bar: total pending, hold_reason counts, urgent count | SATISFIED | ptSummary useMemo; TOTAL PENDING, hold_reason pills, DUE WITHIN 7 DAYS in danger color |
| TRKT-02 | 14-02 | Pending terms table with color coding | PARTIALLY SATISFIED* | hold_date red, next_billing green implemented; active/first_billing and hold_reason not rendered as columns per UI-SPEC locked decision |
| TRKT-03 | 14-02 | agent_name and agent_id never displayed as visible columns | SATISFIED | 0 matches for agentName/agentId in baseTdStyle; used only for grouping and search |
| TRKT-04 | 14-02 | Filterable by agent, state, product, hold_reason, date ranges | SATISFIED | ptFilters with 6 keys; filter inputs rendered (lines 1784-1801) |
| TRKT-05 | 14-02 | Searchable by member name, member ID, agent name, agent ID, phone | SATISFIED | filteredPending useMemo lines 1446-1450 |
| TRKT-06 | 14-02 | Group-by-agent with collapsible sections | SATISFIED | groupedPending useMemo; toggleGroup; collapsed Set; group header rows with colSpan={8} |
| TRKT-07 | 14-02 | CSV export for owner and super_admin only | SATISFIED | Same canExport and conditional render covers both chargeback and pending terms export |

*See Human Verification Required section for TRKC-02 and TRKT-02 discrepancy details.

---

### Anti-Patterns Found

No blocker or warning-level anti-patterns found in modified files.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| No anti-patterns detected | — | — | — | — |

The implementation does not contain TODO/FIXME markers, empty handlers, placeholder returns, or stub implementations in the phase-modified code paths.

---

### Human Verification Required

#### 1. REQUIREMENTS.md vs UI-SPEC column count reconciliation (TRKC-02)

**Test:** Review REQUIREMENTS.md TRKC-02 ("displays all 15 specified columns") against the UI-SPEC locked decision (8 columns: Date Posted, Member, Member ID, Product, Type, Total, Assigned To, Submitted).
**Expected:** Stakeholder confirms 8 columns is the accepted scope, and REQUIREMENTS.md is updated to say "8 columns" instead of "15 specified columns."
**Why human:** The REQUIREMENTS.md was written before the UI-SPEC locked the column count. The UI-SPEC is the authoritative contract for Phase 14 and explicitly lists 8 columns. A human must confirm whether the old "15 columns" wording is simply stale, or whether missing columns are a gap.

#### 2. REQUIREMENTS.md vs UI-SPEC column scope reconciliation (TRKT-02)

**Test:** Review REQUIREMENTS.md TRKT-02 ("active/first_billing blue, hold_date red, hold_reason red italic") against the UI-SPEC which specifies only 7 visible columns (Member Name, Member ID, Phone, Product, Hold Date, Next Billing, Assigned To) — omitting active_date, first_billing, and hold_reason as visible columns.
**Expected:** Stakeholder confirms omitting active_date, first_billing, and hold_reason as visible columns is acceptable per the CONTEXT.md locked decision.
**Why human:** CONTEXT.md explicitly locks the column set to 7 visible columns. The requirement text predates this decision. A human must confirm whether the requirement should be updated.

#### 3. KPI counter animation

**Test:** Load the Tracking tab; observe all 4 KPI counters on page load and after deleting a record.
**Expected:** All counters animate from 0 to their values over 600ms; animation re-triggers after a delete refreshes totals.
**Why human:** AnimatedNumber visual behavior cannot be verified programmatically.

#### 4. Column sort interaction

**Test:** Click any chargeback column header, then click it again.
**Expected:** First click shows ChevronUp (ascending); second click shows ChevronDown (descending); rows reorder correctly.
**Why human:** Interactive table sort behavior requires browser-level testing.

#### 5. Filter panel toggle

**Test:** Click the "Filters" button; enter a value in one chargeback filter field.
**Expected:** Both chargeback and pending terms filter panels expand; "Clear Filters" button appears when a value is entered; "Clear Filters" removes all filter values.
**Why human:** Interactive collapsible panel behavior requires browser-level testing.

#### 6. Agent group collapsibility

**Test:** Click an agent group header row in the pending terms table.
**Expected:** Section collapses (ChevronRight shown, rows hidden); click again to expand (ChevronDown shown, rows visible). Groups default to expanded.
**Why human:** Interactive collapsible group behavior requires browser-level testing.

#### 7. Role-gated export button

**Test:** Log in as CUSTOMER_SERVICE role, navigate to Tracking tab. Then log in as OWNER_VIEW, navigate to Tracking tab.
**Expected:** Export CSV button absent for CUSTOMER_SERVICE; present for OWNER_VIEW and SUPER_ADMIN.
**Why human:** Requires live auth sessions with different roles.

#### 8. CSV export content and format

**Test:** As OWNER_VIEW, apply a filter, then click Export CSV.
**Expected:** File named `cs-tracking-YYYY-MM-DD.csv` downloads; contains `--- CHARGEBACKS ---` and `--- PENDING TERMS ---` sections; rows match what is visible in the tables (filtered).
**Why human:** File download and CSV content verification require browser-level testing.

---

### Gaps Summary

No gaps blocking goal achievement. All 15 observable truths are verified in the codebase:

- The `/api/chargebacks/totals` endpoint is correctly implemented at line 1992 of `apps/ops-api/src/routes/index.ts` with the correct Prisma aggregate, Math.abs conversion, and requireAuth middleware.
- The TrackingTab in `apps/cs-dashboard/app/page.tsx` contains a complete implementation of all specified features: 4-counter KPI bar with AnimatedNumber, shared search box, collapsible filter panels (7 chargeback fields, 6 pending terms fields), sortable chargeback table (8 columns + delete), pending terms summary bar (TOTAL PENDING, hold_reason pills, DUE WITHIN 7 DAYS), grouped-by-agent pending terms table (7 columns + delete, collapsible), and role-gated CSV export covering both data types.
- All 3 commits from the summaries (7a8839f, e42bd73, be39bee) exist and are valid.

The two "PARTIALLY SATISFIED" requirements (TRKC-02, TRKT-02) reflect stale wording in REQUIREMENTS.md that predates the UI-SPEC design lock. The implementation correctly follows the authoritative UI-SPEC. Human confirmation is needed to close these as intentional design decisions.

---

_Verified: 2026-03-18T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
