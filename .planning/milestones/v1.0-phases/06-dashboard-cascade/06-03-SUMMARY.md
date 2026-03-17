---
phase: 06-dashboard-cascade
plan: 03
subsystem: payroll-dashboard, owner-dashboard
tags: [socket.io, real-time, state-patching, highlight-animation]
dependency_graph:
  requires: ["@ops/socket (06-01)"]
  provides: ["CASC-03 payroll real-time", "CASC-04 owner KPI real-time"]
  affects: ["apps/payroll-dashboard", "apps/owner-dashboard"]
tech_stack:
  added: []
  patterns: ["local state patching from socket payload", "highlight glow with fade-out", "disconnect banner with reconnect refetch"]
key_files:
  created: []
  modified:
    - apps/payroll-dashboard/app/page.tsx
    - apps/owner-dashboard/app/page.tsx
decisions:
  - "Payroll entries upserted by periodId match against all loaded periods (not just expanded)"
  - "Owner tracker patched inline alongside KPI summary for consistent agent leaderboard"
  - "highlightedEntryIds passed through AgentPayCard to EditableSaleRow via props"
  - "highlightedCards passed to DashboardSection for StatCard glow styling"
metrics:
  duration: 394s
  completed: "2026-03-16"
  tasks: 2
  files: 2
---

# Phase 06 Plan 03: Payroll & Owner Dashboard Real-Time Integration Summary

Socket.IO sale:changed listeners with local state patching (no API refetch) for payroll agent cards and owner KPI metrics, plus blue highlight glow animations and disconnection banners.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Payroll dashboard sale:changed listener with agent card state patching and highlight | 21aec12 | apps/payroll-dashboard/app/page.tsx |
| 2 | Owner dashboard sale:changed listener with incremental KPI patching and highlight | fa7e414 | apps/owner-dashboard/app/page.tsx |

## Implementation Details

### Task 1: Payroll Dashboard

- Added `useSocket` hook connected to ops-api URL
- `handleSaleChanged` callback filters payroll entries by period, upserts into matching period entries (finds by entry ID, inserts if new)
- Entry data constructed from payload with sale info (memberName, product, addons, status, agent)
- `highlightedEntryIds` Set state tracks which entries should glow, cleared after 100ms (CSS transition handles the 1.5s visual fade)
- Highlight state passed through `AgentPayCard` -> `EditableSaleRow` via `highlighted` prop
- `EditableSaleRow` `<tr>` element gets `transition: "box-shadow 1.5s ease-out"` and `HIGHLIGHT_GLOW` when highlighted
- Disconnection banner rendered at top of PageShell content
- Reconnect callback triggers `refreshPeriods()` for full data reload

### Task 2: Owner Dashboard

- Added `useSocket` hook connected to ops-api URL
- `handleSaleChanged` callback guards on `status === "RAN"` and `type === "created" | "status_changed"`
- Patches `summary` state: increments `salesCount` by 1, adds `premium` to `premiumTotal`
- Patches `tracker` state: finds agent by name, increments their counts, or adds new agent row
- `highlightedCards` Set state tracks which KPI cards glow ("salesCount", "premiumTotal")
- `DashboardSection` receives `highlightedCards` prop, applies `HIGHLIGHT_GLOW` to StatCard `style`
- Numbers swap instantly (no AnimatedNumber or count-up animation for real-time updates)
- Disconnection banner rendered at top of PageShell content
- Reconnect callback triggers `fetchData(rangeRef.current)` with current range filter

## Deviations from Plan

None — plan executed exactly as written. The @ops/socket package and server-side emitSaleChanged were already created by prior 06-01 execution (commits d028c88, b90ad4d).

## Decisions Made

1. **Payroll patching scope:** Entries are patched across all loaded periods (not just expanded), so collapsing/expanding a period always shows fresh data
2. **Owner tracker patching:** Agent tracker rows are also patched from the socket event (not just KPI summary), keeping the leaderboard consistent
3. **Prop drilling for highlights:** highlightedEntryIds passed as prop to AgentPayCard/EditableSaleRow rather than context, keeping the pattern simple and consistent with existing architecture
4. **100ms highlight timeout:** The highlight state is removed after 100ms; the CSS `transition: box-shadow 1.5s ease-out` handles the visual fade from glow to no-glow

## Self-Check: PASSED
