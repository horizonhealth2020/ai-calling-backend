---
phase: 41-payroll-card-restructure
verified: 2026-04-01T20:30:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Load the payroll view in a browser with real data and confirm one card per agent renders at the top level"
    expected: "Each agent appears as a single collapsible card; no duplicate cards for the same agent across periods"
    why_human: "agentData Map keying is verified structurally but correct aggregation across multiple live periods requires visual confirmation"
  - test: "Expand an agent card and confirm weeks appear as nested sections, each with a date range header, financial strip (Commission / Bonus / Fronted / Hold / Net), editable inputs, and a sale table"
    expected: "Each week is a distinct collapsible row inside the agent card; inputs are functional; sales are listed without a Show More button"
    why_human: "Financial strip wiring (handleHeaderBlur POST/PATCH) depends on live API and adjustment state not verifiable statically"
  - test: "Collapse/expand an agent card and a week section independently"
    expected: "Agent header click collapses/expands all week sections; week header click collapses/expands only that week"
    why_human: "UI interaction and animation cannot be verified by grep"
  - test: "Verify last 2 weeks start expanded and older weeks start collapsed on page load"
    expected: "On initial render the two most recent weeks per agent are open; any third or older week is collapsed"
    why_human: "Requires live render with at least 3 periods per agent"
  - test: "Click Print Week on any week section and verify the printed output shows the agent name and the week date range"
    expected: "Print popup shows agent name header followed by 'Week of MM-DD-YYYY - MM-DD-YYYY' subtitle, then financial summary and sale table"
    why_human: "printAgentCards generates a window.open HTML document; cannot inspect output statically"
  - test: "Select different week sections in the same agent card and verify the agent header summary updates"
    expected: "Commission and Net values in the agent header change to reflect the selected week's figures when clicking different week headers"
    why_human: "selectedWeek state driven by onClick wiring requires live interaction to confirm"
---

# Phase 41: Payroll Card Restructure Verification Report

**Phase Goal:** Payroll view uses agent-level collapsible cards with week-by-week sale grouping, and print template matches screen layout
**Verified:** 2026-04-01T20:30:00Z
**Status:** human_needed (all automated checks passed; visual/interactive behaviors require human testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Each agent has a single top-level collapsible card in the payroll view | VERIFIED | `agentData` useMemo in PayrollPeriods.tsx builds a `Map<string, AgentData>` seeded from `allAgents`; `sortedAgents.map` renders one `<AgentCard>` per map key (line 654) |
| 2 | Inside each agent card, sales are grouped by week with visible week separators | VERIFIED | AgentCard.tsx iterates `sortedPeriods` and renders `<WeekSection>` per period (lines 141-178); each WeekSection has its own date-range header at line 572 |
| 3 | Week sections contain financial strip with editable bonus/fronted/hold inputs | VERIFIED | WeekSection.tsx lines 641-740 contain Commission read-only display plus Bonus/Fronted/Hold `<input>` elements with `handleHeaderBlur` on blur, posting to `/api/payroll/adjustments` |
| 4 | Agent header shows read-only financial summary of selected week | VERIFIED | AgentCard.tsx lines 87-92 derive `headerGross`/`headerNet` from `selectedData`; lines 124-125 render Commission and Net in the agent header |
| 5 | Last 2 weeks start expanded, older weeks start collapsed | VERIFIED | PayrollPeriods.tsx useEffect lines 119-138 slice sorted periods to `[0,2]` for `expandedIds`; older periods are excluded |
| 6 | Print button per-week prints that single agent + single week | VERIFIED | WeekSection `onPrint` prop (line 167 in AgentCard.tsx) calls `printAgentCards([[agentName, pd.entries]], pd.period)`; print template includes `Week of ${fmtDate(period.weekStart)} - ${fmtDate(period.weekEnd)}` at line 434 of PayrollPeriods.tsx |

**Score:** 6/6 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/ops-dashboard/app/(dashboard)/payroll/payroll-types.ts` | Shared types, style constants, helper functions | VERIFIED | 207 lines; exports `Entry`, `Period`, `AgentAdjustment`, `AgentPeriodData`, `AgentData`, `SMALL_INP`, `STATUS_BADGE`, `HEADER_LBL`, `EDITABLE_LBL`, `isActiveEntry`, `fmtDate` |
| `apps/ops-dashboard/app/(dashboard)/payroll/WeekSection.tsx` | Per-week collapsible section with financial strip, sale table, print/paid buttons | VERIFIED | 903 lines; exports `WeekSection`; contains `EditableLabel`, `CarryoverHint`, `EditableSaleRow`, `handleHeaderBlur`, `Print Week`, selected-week `borderLeft` with `accentTeal` |
| `apps/ops-dashboard/app/(dashboard)/payroll/AgentCard.tsx` | Top-level collapsible agent card wrapping multiple WeekSections | VERIFIED | 183 lines; exports `AgentCard`; contains `Top Earner` badge, `<WeekSection>` usage, Commission/Net read-only summary, `ChevronDown` |
| `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` | Main component with agent-first data regrouping and AgentCard rendering | VERIFIED | 836 lines (down from 2042); contains `agentData` useMemo, `expandedAgents`, `expandedWeeks`, `selectedWeek`, `<AgentCard` in render, Customer Service section, `printAgentCards` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| PayrollPeriods.tsx | AgentCard.tsx | `sortedAgents.map` iterates `agentData.entries()` and renders `<AgentCard>` | WIRED | Line 654: `sortedAgents.map(({ agentName, data, isTopEarner }, agentIdx)` renders `<AgentCard>` passing `data.periods` |
| AgentCard.tsx | WeekSection.tsx | `sortedPeriods.map` renders `<WeekSection>` per period | WIRED | Lines 141-178: `sortedPeriods.map(pd => (<WeekSection key={pd.period.id} .../>))` |
| WeekSection.tsx | payroll-types.ts | imports shared types, styles, and helpers | WIRED | Line 18: `from "./payroll-types"` imports `SMALL_INP`, `STATUS_BADGE`, `HEADER_LBL`, `EDITABLE_LBL`, `isActiveEntry`, `fmtDate`, plus all type definitions |
| PayrollPeriods.tsx | payroll-types.ts | imports shared types and helpers | WIRED | Line 19: `from "./payroll-types"` imports `isActiveEntry`, `fmtDate`, `inputStyle`, table styles, and all type definitions |
| AgentCard.tsx | payroll-types.ts | imports shared types | WIRED | Line 9: `from "./payroll-types"` imports `Entry`, `Period`, `Product`, `AgentAdjustment`, `AgentPeriodData`, `StatusChangeRequest`, `SaleEditRequest` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CARD-01 | 41-01-PLAN.md | Payroll view shows agent-level collapsible cards (one card per agent) | SATISFIED | `agentData` Map ensures one entry per agent; `sortedAgents.map` renders exactly one `<AgentCard>` per agent; `onToggleExpand` toggling `expandedAgents` Set controls collapse |
| CARD-02 | 41-01-PLAN.md | Inside each agent card, week-by-week entries are separated for payroll processing | SATISFIED | AgentCard iterates `sortedPeriods` and renders `<WeekSection>` per period; each WeekSection has independent expand/collapse, financial strip with editable inputs, sale table, and paid/unpaid controls |

No orphaned requirements for Phase 41 — both CARD-01 and CARD-02 are claimed in 41-01-PLAN.md and confirmed implemented.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| page.tsx | 47 | Local `type ProductType = "CORE" \| "ADDON" \| "AD_D"` (missing `"ACA_PL"`) conflicts with `payroll-types.ts` definition | Info | Pre-existing TS error (confirmed present before phase 41 commits); causes `TS2719` in `npx tsc --noEmit`. Does not block runtime — Next.js builds with type errors in dev mode. Not introduced by this phase. |
| middleware.ts | 32, 40 | Cookie deletion signature mismatch — pre-existing TS error | Info | Pre-existing; unrelated to phase 41 |
| packages/auth/src/index.ts | 1, 2 | Missing `@types/jsonwebtoken` and `@types/cookie` — pre-existing TS error | Info | Pre-existing; unrelated to phase 41 |

No blocker anti-patterns. No TODO/FIXME/placeholder comments in the four phase-41 files. No stub implementations found. No `showAllEntries` or `COLLAPSED_LIMIT` remnants. No `function AgentPayCard`, `expandedPeriod`, or `printMenuPeriod` in PayrollPeriods.tsx.

---

### Removed Code Confirmed Absent

The following items were required to be removed and are confirmed absent from PayrollPeriods.tsx:

- `function AgentPayCard` — not present
- `expandedPeriod` state — not present
- `printMenuPeriod` state — not present
- `showAllEntries` / `COLLAPSED_LIMIT` — not present
- `type Entry =` inline definition — not present (imported from payroll-types.ts)

---

### TypeScript Compilation Status

`npx tsc --noEmit --project apps/ops-dashboard/tsconfig.json` produces 5 errors, all pre-existing before phase 41:
- `page.tsx:322` — ProductType mismatch between page.tsx local type and PayrollProducts.tsx (existed before phase 41; PayrollProducts already had ACA_PL locally)
- `middleware.ts:32,40` — cookie deletion API signature mismatch
- `packages/auth/src/index.ts:1,2` — missing type declaration files

The SUMMARY correctly documented: "TypeScript compilation: passes (only pre-existing errors in middleware.ts, page.tsx, packages/auth)."

---

### Human Verification Required

#### 1. Agent-first card rendering with live data

**Test:** Load the payroll view in a browser with real data and confirm one card per agent renders at the top level
**Expected:** Each agent appears as a single collapsible card; no duplicate cards for the same agent across periods
**Why human:** agentData Map keying is verified structurally but correct aggregation across multiple live periods requires visual confirmation

#### 2. Week section content completeness

**Test:** Expand an agent card and confirm weeks appear as nested sections, each with a date range header, financial strip (Commission / Bonus / Fronted / Hold / Net), editable inputs, and a sale table
**Expected:** Each week is a distinct collapsible row inside the agent card; inputs are functional; sales are listed without a Show More button
**Why human:** Financial strip wiring (handleHeaderBlur POST/PATCH) depends on live API and adjustment state not verifiable statically

#### 3. Collapse/expand interactions

**Test:** Click the agent header to collapse the agent card, then click again to expand; click individual week headers to toggle week sections independently
**Expected:** Agent header click collapses/expands all week sections; week header click collapses/expands only that week; ChevronDown rotates 180 degrees on both
**Why human:** UI interaction and animation cannot be verified by grep

#### 4. Last-2-weeks expansion default

**Test:** Load the payroll view for an agent with 3 or more historical periods and verify the initial expand state
**Expected:** The two most recent weeks per agent are open on initial render; any third or older week is collapsed
**Why human:** Requires live render with at least 3 periods per agent

#### 5. Per-week print output

**Test:** Click "Print Week" on any week section and inspect the print preview popup
**Expected:** Print popup shows the agent name as the header, followed by "Week of MM-DD-YYYY - MM-DD-YYYY" as a subtitle, then financial summary boxes and the sale table
**Why human:** printAgentCards generates a window.open HTML document; cannot inspect output statically

#### 6. Agent header summary updates on week selection

**Test:** Click different week headers within the same agent card and watch the agent header
**Expected:** Commission and Net values in the agent header update to reflect the clicked week's data each time a different week header is selected
**Why human:** selectedWeek state wiring requires live interaction to confirm; the Map update logic is correct by inspection but observable result needs confirmation

---

### Gaps Summary

No gaps. All 6 observable truths are verified at all three levels (exists, substantive, wired). Both requirements CARD-01 and CARD-02 are satisfied. All key links are wired. No anti-patterns introduced by this phase. TypeScript errors present are pre-existing and unrelated.

The only outstanding items are 6 human verification tests that require a running browser session to confirm visual rendering, interactive behavior, and live API integration.

---

_Verified: 2026-04-01T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
