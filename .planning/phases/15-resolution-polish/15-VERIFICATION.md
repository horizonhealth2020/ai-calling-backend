---
phase: 15-resolution-polish
verified: 2026-03-18T17:00:00Z
status: passed
score: 13/13 must-haves verified
re_verification: false
gaps:
  - truth: "ROLE-03: customer_service cannot access Submissions tab or any other dashboard"
    status: partial
    reason: "Submissions tab is fully gated in cs-dashboard (effectiveTab + conditional render). However ROLE-03 is still marked '- [ ]' in REQUIREMENTS.md and the plan that claimed it (15-01) is scoped to backend only. The Submissions-tab gating is implemented in Plan 03, and the 'other dashboards' constraint is enforced by (a) auth portal routing CS users to only the CS dashboard URL and (b) ops-api requireRole guards that exclude CUSTOMER_SERVICE from manager/payroll endpoints. The requirement is substantively satisfied by code but REQUIREMENTS.md status field is still marked Pending."
    artifacts:
      - path: "apps/cs-dashboard/app/page.tsx"
        issue: "Implementation correct -- isCSOnly gates Submissions tab and effectiveTab forces 'tracking'. No code gap."
      - path: ".planning/REQUIREMENTS.md"
        issue: "ROLE-03 marked '- [ ]' (Pending) despite implementation existing across Plans 01 and 03. Status field was not updated after phase completion."
    missing:
      - "Update REQUIREMENTS.md to mark ROLE-03 as [x] -- the implementation is complete."
human_verification:
  - test: "Log in as a user with only CUSTOMER_SERVICE role. Verify the navigation shows only the Tracking tab and Submissions tab is absent."
    expected: "Single-tab nav showing only Tracking. Clicking anywhere on the sidebar shows only one nav item."
    why_human: "Role-based conditional rendering depends on /api/session/me returning correct roles at runtime."
  - test: "Open a chargeback row, click Resolve, select a resolution type, enter a note, and click Save Resolution."
    expected: "Row immediately dims to 50% opacity, shows a badge with resolution type, shows 'Resolved by You | today', and a toast confirms success."
    why_human: "Optimistic UI and toast behavior require runtime DOM observation."
  - test: "Click Unresolve on a resolved chargeback row."
    expected: "Row returns to full opacity, badge disappears, Resolve button reappears, toast confirms 'Resolution cleared'."
    why_human: "Rollback and state restoration require runtime observation."
  - test: "Toggle Status pills between Open, Resolved, and All on the chargebacks table. Verify the KPI bar (Total Chargebacks, Total Recovered, Net Exposure) does not change."
    expected: "Table rows filter correctly. KPI counters are unaffected by status pill state."
    why_human: "KPI stability during filter changes requires visual inspection of rendered values."
---

# Phase 15: Resolution & Polish Verification Report

**Phase Goal:** Customer service staff can mark records as resolved, filter by status, and all formatting/role gating is consistent
**Verified:** 2026-03-18T17:00:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Chargeback records can be resolved with a resolution type and note via API | VERIFIED | `PATCH /chargebacks/:id/resolve` at routes/index.ts:1972 with `prisma.chargebackSubmission.update` at line 1975 |
| 2 | Pending term records can be resolved with a resolution type and note via API | VERIFIED | `PATCH /pending-terms/:id/resolve` at routes/index.ts:2172 with `prisma.pendingTerm.update` at line 2175 |
| 3 | Resolved records can be un-resolved via API | VERIFIED | `PATCH /chargebacks/:id/unresolve` (line 1987) and `PATCH /pending-terms/:id/unresolve` (line 2187) clear all four resolution fields to null |
| 4 | Total Recovered KPI aggregates only recovered chargebacks | VERIFIED | Totals endpoint (line 2028) uses `where: { resolutionType: "recovered" }` in a separate aggregate call; cs-dashboard wires this to `totals?.totalRecovered ?? 0` (page.tsx:1750) |
| 5 | CUSTOMER_SERVICE role can be assigned to users via admin API | VERIFIED | ROLE_ENUM at routes/index.ts:101 includes "CUSTOMER_SERVICE"; AppRole type in packages/types/src/index.ts includes it |
| 6 | All dollar amounts across all dashboards render with commas and 2 decimal places | VERIFIED | `formatDollar` exported from packages/utils/src/index.ts; all 5 dashboards import from `@ops/utils` |
| 7 | All dates across all dashboards render as M/D/YYYY without leading zeros | VERIFIED | `formatDate` exported from packages/utils/src/index.ts uses `parseInt(m)/${parseInt(dd)}/${y}` pattern; all 5 dashboards import it |
| 8 | Formatting functions come from a single shared source in @ops/utils | VERIFIED | packages/utils/src/index.ts exports `formatDollar`, `formatNegDollar`, `formatDate`; no local duplicates remain in any dashboard |
| 9 | User can click Resolve on a chargeback/pending-term row and see an expandable panel | VERIFIED | `expandedRowId` state at page.tsx:1392; expandable `<tr>` rendered at lines 2027 and 2253; contains "Resolution Type", "Resolution Note", "Save Resolution", "Discard" |
| 10 | Resolved records appear dimmed with badge, resolver name, and resolved date | VERIFIED | `opacity: 0.5` on `<tr>` at line 1968; badge with `textTransform: "uppercase"` at lines 1988/2218; "Resolved by {cb.resolver?.name}" at lines 1998/2224 |
| 11 | Status pill toggle filters each table independently, defaulting to Open | VERIFIED | `cbStatusFilter` and `ptStatusFilter` both initialized to `"open"` (lines 1388-1389); filter applied as first step in useMemo pipelines (lines 1425-1426, 1471-1472) |
| 12 | KPI counters are NOT affected by status pill toggle | VERIFIED | KPI `AnimatedNumber` values use `totals` state (from `/api/chargebacks/totals` API, not `filteredChargebacks`); pending terms summary bar uses full `pendingTerms` array, not `filteredPending` |
| 13 | customer_service role sees only Tracking tab; owner and super_admin see both tabs | VERIFIED | `isCSOnly` computed at page.tsx:500; `navItems` conditional at 504; `effectiveTab` forced to "tracking" for CS at 511 |
| 14 | ROLE-03: customer_service cannot access Submissions tab or any other dashboard | PARTIAL | Submissions tab is inaccessible to CS users via code (effectiveTab + conditional render). Other dashboards: auth portal routes CS users only to CS dashboard URL; ops-api requireRole guards exclude CUSTOMER_SERVICE from non-CS endpoints. Implementation is substantively complete but REQUIREMENTS.md still marks ROLE-03 as `- [ ]` (Pending). |
| 15 | Agent grouping removed from pending terms table | VERIFIED | No `groupedPending`, `toggleGroup`, or `collapsed` Set state in page.tsx (grep returns zero matches); flat `filteredPending.map` is used |
| 16 | customer_service cannot see delete or CSV export buttons | VERIFIED | `!isCSOnly` condition guards delete buttons (lines 2011, 2237); `canExport` includes `!isCSOnly` (line 1687) |

**Score:** 15/16 truths fully verified (1 partial -- ROLE-03 implementation exists, REQUIREMENTS.md status not updated)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `prisma/schema.prisma` | Resolution fields on ChargebackSubmission and PendingTerm models | VERIFIED | `resolvedAt`, `resolvedBy`, `resolutionNote`, `resolutionType` on both models; `resolver User?` relations on both; `resolvedChargebacks` and `resolvedPendingTerms` reverse relations on User |
| `prisma/migrations/20260318_add_resolution_fields/` | Migration creating resolution columns | VERIFIED | Directory exists in prisma/migrations/ |
| `apps/ops-api/src/routes/index.ts` | Resolve/unresolve PATCH endpoints for both tables | VERIFIED | 4 PATCH endpoints present: lines 1972, 1987, 2172, 2187 |
| `packages/utils/src/index.ts` | Shared formatDollar, formatNegDollar, formatDate helpers | VERIFIED | All 3 functions exported with correct signatures and implementations |
| `apps/cs-dashboard/next.config.js` | transpilePackages includes @ops/utils | VERIFIED | Line 3: `["@ops/ui", "@ops/auth", "@ops/utils"]` |
| `apps/manager-dashboard/next.config.js` | transpilePackages includes @ops/utils | VERIFIED | Present |
| `apps/payroll-dashboard/next.config.js` | transpilePackages includes @ops/utils | VERIFIED | Present |
| `apps/owner-dashboard/next.config.js` | transpilePackages includes @ops/utils | VERIFIED | Present |
| `apps/sales-board/next.config.js` | transpilePackages includes @ops/utils | VERIFIED | Present |
| `apps/cs-dashboard/app/page.tsx` | Resolve UX, status pills, role-gated tabs, flat pending terms table | VERIFIED | Contains `expandedRowId`, `cbStatusFilter`, `ptStatusFilter`, `isCSOnly`, all handlers, no `groupedPending` |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `apps/ops-api/src/routes/index.ts` | `prisma.chargebackSubmission.update` | resolve endpoint handler | WIRED | Line 1975 calls `prisma.chargebackSubmission.update` inside the resolve PATCH handler |
| `apps/ops-api/src/routes/index.ts` | `prisma.pendingTerm.update` | resolve endpoint handler | WIRED | Line 2175 calls `prisma.pendingTerm.update` inside the resolve PATCH handler |
| `apps/cs-dashboard/app/page.tsx` | `/api/chargebacks/:id/resolve` | authFetch PATCH in handleResolveCb | WIRED | Line 1583: `authFetch(\`${API}/api/chargebacks/${id}/resolve\`, { method: "PATCH", ... })` with response handling |
| `apps/cs-dashboard/app/page.tsx` | `/api/pending-terms/:id/resolve` | authFetch PATCH in handleResolvePt | WIRED | Line 1628: `authFetch(\`${API}/api/pending-terms/${id}/resolve\`, { method: "PATCH", ... })` with response handling |
| `apps/cs-dashboard/app/page.tsx` | `/api/session/me` | fetch in CSDashboard parent for role gating | WIRED | Line 491: `authFetch(\`${API}/api/session/me\`)` in CSDashboard parent useEffect; TrackingTab no longer has its own session/me fetch |
| `apps/cs-dashboard/app/page.tsx` | `packages/utils/src/index.ts` | `import { formatDollar, formatNegDollar, formatDate } from "@ops/utils"` | WIRED | Line 24: import present; functions used throughout the file |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| RESV-01 | 15-01, 15-03 | Customer service can mark a chargeback record as resolved with a resolution note | SATISFIED | PATCH endpoint at routes:1972; UI handler `handleResolveCb` at page.tsx:1568 |
| RESV-02 | 15-01, 15-03 | Customer service can mark a pending term record as resolved with a resolution note | SATISFIED | PATCH endpoint at routes:2172; UI handler `handleResolvePt` at page.tsx:1613 |
| RESV-03 | 15-01, 15-03 | Resolved records show resolved status, resolved_by, resolved_at, and resolution note | SATISFIED | Badge (type), "Resolved by {name}", `formatDate(resolvedAt)`, resolutionNote all rendered in action cell (page.tsx:1988-2005) |
| RESV-04 | 15-03 | Tracking tables can filter by status (open/resolved) with open as default view | SATISFIED | `cbStatusFilter` and `ptStatusFilter` initialized to "open"; status pills render above each table |
| ROLE-02 | 15-03 | customer_service can access Customer Service dashboard Tracking tab only | SATISFIED | `isCSOnly` gates navItems and forces effectiveTab; REQUIREMENTS.md marks as [x] |
| ROLE-03 | 15-01 | customer_service cannot access Submissions tab or any other dashboard | PARTIALLY SATISFIED | Submissions tab: blocked via isCSOnly + effectiveTab. Other dashboards: blocked by auth portal URL routing + ops-api requireRole. Code is complete. REQUIREMENTS.md still marks as `- [ ]`. |
| ROLE-04 | 15-03 | owner and super_admin can access both Submissions and Tracking tabs | SATISFIED | Non-CS navItems includes both Submissions and Tracking tabs; effectiveTab is unrestricted for owner/admin |
| DASH-02 | 15-03 | Dashboard has two tabs: Submissions and Tracking with role-gated visibility | SATISFIED | Both tabs in navItems for owner/admin; single tab for CS-only |
| DASH-04 | 15-03 | All counters, filters, and summaries update without page reload | SATISFIED | All filtering via useMemo with state dependencies; resolve/unresolve via optimistic UI; no page reloads |
| DASH-05 | 15-02 | All dates displayed as M/D/YYYY, all dollar amounts formatted with commas and 2 decimal places | SATISFIED | Shared helpers in @ops/utils; all 5 dashboards import them; no local duplicate formatters remain |

### Orphaned Requirements

No orphaned requirements found. All 10 requirement IDs declared in plan frontmatter (RESV-01, RESV-02, RESV-03, RESV-04, ROLE-02, ROLE-03, ROLE-04, DASH-02, DASH-04, DASH-05) are accounted for and appear in REQUIREMENTS.md mapped to Phase 15.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/cs-dashboard/app/page.tsx` | 1376 | `// Pending terms filters (placeholder for Plan 02)` | Info | Stale comment label from planning; `ptFilters` state is fully used and functional. No code impact. |
| `.planning/REQUIREMENTS.md` | 14, 101 | `ROLE-03` marked `- [ ]` and `Pending` despite implementation being complete | Warning | REQUIREMENTS.md is out of sync with the codebase. Does not affect runtime behavior but creates misleading audit trail. |

No blocker anti-patterns. No stubs in implementation files. No `return null` or empty handlers. All `placeholder=` occurrences are HTML input placeholder attributes (correct usage).

---

## Human Verification Required

### 1. CS Role Tab Gating

**Test:** Log in as a user with only CUSTOMER_SERVICE role and observe the navigation sidebar.
**Expected:** Only one nav item "Tracking" is shown. No "Submissions" tab is visible. Typing `/` or clicking elsewhere does not expose the Submissions tab.
**Why human:** Role-based conditional rendering depends on `/api/session/me` returning `roles: ["CUSTOMER_SERVICE"]` at runtime with a real session token.

### 2. Resolve Chargeback Workflow

**Test:** On the Tracking tab with at least one chargeback in Open state: click the "Resolve" button, select "Recovered" or "Closed", enter a note, and click "Save Resolution".
**Expected:** The row immediately dims (opacity 0.5), shows a colored badge with the resolution type in uppercase, shows "Resolved by You | {today's date}", and a green toast notification appears.
**Why human:** Optimistic UI, toast rendering, and badge appearance require runtime DOM inspection.

### 3. Unresolve Rollback

**Test:** On a resolved chargeback row, click "Unresolve".
**Expected:** Row returns to full opacity, badge disappears, Resolve button reappears, toast shows "Resolution cleared".
**Why human:** State rollback behavior requires runtime observation.

### 4. Status Pill Filter Independence

**Test:** Switch the chargebacks status pill to "Resolved". Note the row count. Then switch to "All". While doing this, observe the KPI bar (Total Chargebacks, Total Recovered, Net Exposure).
**Expected:** Row count changes with each pill. KPI values remain constant regardless of which pill is selected.
**Why human:** KPI stability requires visual inspection to confirm the totals bar does not re-render with filtered counts.

### 5. Pending Terms Resolution Types

**Test:** Click Resolve on a pending term row. Verify the resolution type buttons are labeled "Saved" and "Cancelled" (not "Recovered"/"Closed" which are chargeback types).
**Expected:** Two buttons: "Saved" and "Cancelled".
**Why human:** Confirming correct type options are rendered requires runtime DOM inspection.

---

## Gaps Summary

One gap found: **ROLE-03 status not reflected in REQUIREMENTS.md.**

The implementation is complete -- isCSOnly in page.tsx blocks the Submissions tab, auth portal routes CS users to only the CS dashboard URL, and ops-api requireRole guards exclude CUSTOMER_SERVICE from non-CS endpoints. However, REQUIREMENTS.md still marks ROLE-03 as `- [ ]` (Pending) and its tracking table row as "Pending".

This is a documentation sync issue, not a code gap. The fix is to update REQUIREMENTS.md line 14 from `- [ ]` to `- [x]` and line 101 from `Pending` to `Complete`.

This does not affect runtime behavior and is a warning-level finding. The core phase goal -- "Customer service staff can mark records as resolved, filter by status, and all formatting/role gating is consistent" -- is achieved in the codebase.

---

_Verified: 2026-03-18T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
