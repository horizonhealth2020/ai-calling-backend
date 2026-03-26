---
phase: 29-dashboard-fixes-cost-tracking
verified: 2026-03-25T22:30:00Z
status: passed
score: 15/15 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 12/15
  gaps_closed:
    - "Agents with calls but zero sales show total lead spend and em-dash for cost per sale"
    - "When no Convoso data exists, display shows appropriate empty state"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Confirm ManagerTracker CSV export includes Lead Cost column correctly"
    expected: "CSV download contains 'Lead Cost' column with agent totalLeadCost values"
    why_human: "CSV export already includes Lead Cost header and totalLeadCost value — visual verification confirms correct export formatting"
  - test: "Confirm Resolved Log tab appearance matches design spec"
    expected: "Resolved Log tab appears in CS dashboard for OWNER_VIEW/SUPER_ADMIN, not visible for CUSTOMER_SERVICE role"
    why_human: "Role-conditional tab rendering requires a live authenticated session to verify visually"
---

# Phase 29: Dashboard Fixes & Cost Tracking — Verification Report

**Phase Goal:** Fix premium display, lead source form, Convoso data flow, cost tracking visibility, manager config cleanup, and add CS resolved log audit trail
**Verified:** 2026-03-25T22:30:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 29-04)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Manager Agent Sales tab shows total premium (core + addon) per sale row | VERIFIED | `ManagerSales.tsx` lines 424-426: `addonTotal + Number(s.premium)` as `rowTotal`, renders `formatDollar(rowTotal)` |
| 2 | Lead source create form includes a Buffer (seconds) field | VERIFIED | `ManagerConfig.tsx` line 225: `newLS` state has `callBufferSeconds: "0"`; line 342: number input with `min="0"` |
| 3 | Lead source POST API accepts callBufferSeconds | VERIFIED | `agents.ts` line 76: `callBufferSeconds: z.number().int().min(0).optional()` in POST schema |
| 4 | Manager Config Products section is read-only with no add/edit/delete controls | VERIFIED | `ManagerConfig.tsx` lines 352-398: read-only table; no save/edit/delete product references found |
| 5 | Read-only Products table shows product name, type, commission rates, and bundle config | VERIFIED | Four-column table: Product, Type, Commission, Bundle Config; type Badge per CORE/ADDON/AD_D |
| 6 | After a poll cycle, new call records appear in ConvosoCallLog table | VERIFIED | `convosoKpiPoller.ts` line 100: `prisma.convosoCallLog.createMany({ data: callLogRecords })` from `newRaw` array |
| 7 | Running poller multiple times does not create duplicate ConvosoCallLog records | VERIFIED | `convosoKpiPoller.ts` lines 57-65: dedup via `processedConvosoCall` table; only net-new IDs reach `createMany` |
| 8 | Manager Tracker shows cost per sale for agents when Convoso polling is enabled | VERIFIED | `ManagerTracker.tsx` lines 204-210: three-state Cost / Sale column using `convosoConfigured` |
| 9 | Owner Dashboard leaderboard shows cost per sale for agents | VERIFIED | `OwnerOverview.tsx` lines 269-275: identical three-state logic; `convosoConfigured` from tracker/summary |
| 10 | Agents with calls but zero sales show total lead spend and em-dash for cost per sale | VERIFIED | `ManagerTracker.tsx` lines 197-203: Lead Spend column renders `totalLeadCost` independently; Cost / Sale shows em-dash when `salesCount === 0`. `OwnerOverview.tsx` lines 262-268: identical. |
| 11 | When no Convoso data exists, display shows appropriate empty state | VERIFIED | Both files: `!convosoConfigured` shows em-dash (`textMuted`); configured + `totalLeadCost === 0` shows `$0.00` (`textSecondary`); `totalLeadCost > 0` shows dollar amount (`textPrimary`) |
| 12 | CS dashboard shows a Resolved Log tab visible only to OWNER_VIEW and SUPER_ADMIN roles | VERIFIED | `cs/page.tsx` line 32: `canManageCS` checks SUPER_ADMIN or OWNER_VIEW; line 38: Resolved Log navItem inside canManageCS block |
| 13 | Resolved Log lists all resolved chargebacks and pending terms with resolution detail | VERIFIED | `cs-reps.ts` lines 46-88: queries `chargebackSubmission` and `pendingTerm` with `resolvedAt: { not: null }`; includes resolver name, resolutionNote, resolutionType |
| 14 | User can filter the resolved log by type, date range, and agent | VERIFIED | `CSResolvedLog.tsx`: type select, DateRangeFilter, agent text input with debounce; all params passed to API |
| 15 | Resolved Log notes truncated at 80 characters with click-to-expand | VERIFIED | `CSResolvedLog.tsx` lines 38-58: TruncatedNote component, `maxLength=80`, `aria-expanded`, click toggle |

**Score:** 15/15 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerSales.tsx` | Premium column summing core + addon per row | VERIFIED | `addonTotal`, `rowTotal`, `formatDollar(rowTotal)` at lines 424-426 |
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerConfig.tsx` | Buffer field in create form, read-only products table | VERIFIED | `callBufferSeconds` in `newLS` state, number input, read-only Products table |
| `apps/ops-api/src/routes/agents.ts` | `callBufferSeconds` in lead source POST Zod schema | VERIFIED | Line 76: `callBufferSeconds: z.number().int().min(0).optional()` |
| `apps/ops-api/src/workers/convosoKpiPoller.ts` | ConvosoCallLog writes from poller using newRaw dedup array | VERIFIED | Line 100: `prisma.convosoCallLog.createMany({ data: callLogRecords })` |
| `apps/ops-api/src/routes/sales.ts` | `convosoConfigured` flag in tracker/summary response | VERIFIED | Lines 594-595: `const convosoConfigured = !!process.env.CONVOSO_AUTH_TOKEN; res.json({ agents: summary, convosoConfigured })` |
| `apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx` | Lead Spend column + three-state cost display | VERIFIED | Line 144: 7-column headers including "Lead Spend"; lines 197-203: three-state Lead Spend cell; line 216: `colSpan={7}` |
| `apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx` | Lead Spend column + three-state cost display | VERIFIED | Line 195: `<th>Lead Spend</th>` between Avg/Sale and Cost/Sale; lines 262-268: three-state Lead Spend cell; line 203: `colSpan={8}` |
| `apps/ops-api/src/routes/cs-reps.ts` | GET /reps/resolved-log returning unified resolved items | VERIFIED | Line 12: route with `requireRole("OWNER_VIEW", "SUPER_ADMIN")`, queries both models, sorts by resolvedAt desc |
| `apps/ops-dashboard/app/(dashboard)/cs/page.tsx` | Resolved Log tab in CS nav for OWNER_VIEW/SUPER_ADMIN | VERIFIED | Lines 9, 38, 55: imports CSResolvedLog, canManageCS navItem, conditional render |
| `apps/ops-dashboard/app/(dashboard)/cs/CSResolvedLog.tsx` | Resolved Log component with filters | VERIFIED | 7-column table, TruncatedNote, type/date/agent filters, all states handled |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `convosoKpiPoller.ts` | `prisma.convosoCallLog` | createMany with newRaw mapped records | WIRED | Line 100: `prisma.convosoCallLog.createMany({ data: callLogRecords })` confirmed |
| `sales.ts tracker/summary` | `ManagerTracker.tsx` | `convosoConfigured` boolean in JSON response | WIRED | Line 595: `res.json({ agents: summary, convosoConfigured })`; ManagerTracker line 112 reads `data.convosoConfigured` |
| `ManagerTracker.tsx Lead Spend cell` | `row.totalLeadCost` | Three-state inline render | WIRED | Lines 197-203: `row.totalLeadCost > 0` branches to dollar amount or `$0.00` |
| `OwnerOverview.tsx Lead Spend cell` | `row.totalLeadCost` | Three-state inline render | WIRED | Lines 262-268: identical pattern; `convosoConfigured` from `fetchData` line 380 |
| `ManagerConfig.tsx create form` | `POST /api/lead-sources` | authFetch POST body includes callBufferSeconds | WIRED | Line 292: POST body includes `callBufferSeconds: Number(newLS.callBufferSeconds) || 0` |
| `CSResolvedLog.tsx` | `GET /api/cs-reps/reps/resolved-log` | authFetch with type, from, to, agentName params | WIRED | Line 92: `authFetch(\`${API}/api/cs-reps/reps/resolved-log${qs}\`)` with all four params |
| `cs/page.tsx` | `CSResolvedLog.tsx` | Conditional tab render for canManageCS | WIRED | Line 55: `effectiveTab === "resolved-log" && <CSResolvedLog API={API} />` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FIX-01 | 29-01 | Manager Agent Sales tab shows total premium (core + addon) per row | SATISFIED | ManagerSales.tsx lines 424-426 |
| FIX-02 | 29-01 | Lead source create form includes Buffer (seconds) field | SATISFIED | ManagerConfig.tsx — state, POST body, input |
| FIX-03 | 29-01 | Lead source POST API accepts callBufferSeconds in Zod schema | SATISFIED | agents.ts line 76 |
| CFG-01 | 29-01 | Manager Config Products section is read-only | SATISFIED | ManagerConfig.tsx — no edit/delete/add controls |
| CFG-02 | 29-01 | Read-only Products view shows name, type, commission, bundle config | SATISFIED | Four-column table with Badge, commission %, bundleConfig |
| DATA-01 | 29-02 | Convoso KPI poller writes individual call records to ConvosoCallLog | SATISFIED | convosoKpiPoller.ts lines 83-101 |
| DATA-02 | 29-02 | Poller deduplicates to prevent duplicate ConvosoCallLog records | SATISFIED | newRaw is post-dedup; createMany operates only on net-new records |
| DATA-03 | 29-02 | Cost per sale displays correctly in Manager Tracker when Convoso enabled | SATISFIED | Cost / Sale column unchanged; Lead Spend column added with correct three-state logic |
| DATA-04 | 29-02 | Cost per sale displays correctly in Owner Dashboard leaderboard | SATISFIED | Same — both columns present and correct in OwnerOverview |
| DATA-05 | 29-02 | Agent lead spend shows in tracker even when agent has zero sales | SATISFIED | Lead Spend column renders `totalLeadCost` independently of `salesCount`; zero-sales agents see their lead spend |
| CS-01 | 29-03 | CS dashboard has Resolved Log tab for OWNER_VIEW and SUPER_ADMIN only | SATISFIED | page.tsx canManageCS gate confirmed |
| CS-02 | 29-03 | Resolved Log displays resolved chargebacks with resolution details | SATISFIED | cs-reps.ts queries chargebackSubmission model with resolver include |
| CS-03 | 29-03 | Resolved Log displays resolved pending terms with resolution details | SATISFIED | cs-reps.ts queries pendingTerm model with resolver include |
| CS-04 | 29-03 | Resolved Log supports filtering by type, date range, and agent | SATISFIED | CSResolvedLog.tsx: type select, DateRangeFilter, agent input with debounce |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `CSResolvedLog.tsx` | ~101 | Catch block uses generic message "Failed to fetch resolved log" with no status code | Info | Minor UX degradation for debugging only; does not block goal |

No blocker or warning-level anti-patterns found.

---

## Human Verification Required

### 1. CSV Export Lead Cost Column

**Test:** Log in as MANAGER, navigate to Manager Tracker, click "Export CSV". Open the downloaded file.
**Expected:** CSV contains a "Lead Cost" column with the agent's `totalLeadCost` value. Column appears between "Premium Total" and "Cost Per Sale".
**Why human:** File download and CSV column order require visual confirmation in a running app.

### 2. Resolved Log Tab Role Visibility

**Test:** Log in as CUSTOMER_SERVICE role, navigate to CS dashboard, inspect the tab bar.
**Expected:** Only standard tabs visible (Queue, Tracking). "Resolved Log" must NOT appear.
**Why human:** Role-conditional rendering requires a live authenticated session.

---

## Re-verification Summary

Plan 29-04 closed both previous gaps completely.

**Gap 1 closed — DATA-05 (Lead Spend column):** Both `ManagerTracker.tsx` (line 144) and `OwnerOverview.tsx` (line 195) now have a "Lead Spend" column header. Both render `row.totalLeadCost` with the three-state logic from the UI-SPEC: not configured shows em-dash (`textMuted`), configured with zero cost shows `$0.00` (`textSecondary`), positive cost shows dollar amount (`textPrimary`). The `colSpan` values were correctly updated to 7 (ManagerTracker) and 8 (OwnerOverview).

**Gap 2 closed — DATA-03/DATA-04 ($0.00 state):** The `$0.00` state for configured-but-zero-calls agents is now correctly rendered in both files via the new Lead Spend column. The existing Cost / Sale column logic (em-dash for zero-sales agents regardless of lead cost) remains unchanged, which is correct per the UI-SPEC.

No regressions detected in any previously-passing item. All 14 requirements (FIX-01 through CS-04) are fully satisfied.

---

_Verified: 2026-03-25T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
