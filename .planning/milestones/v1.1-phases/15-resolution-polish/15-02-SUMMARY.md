---
phase: 15-resolution-polish
plan: 02
subsystem: shared-formatting
tags: [formatting, utils, dashboards, consistency]
dependency_graph:
  requires: []
  provides: [formatDollar, formatNegDollar, formatDate]
  affects: [cs-dashboard, manager-dashboard, payroll-dashboard, owner-dashboard, sales-board]
tech_stack:
  added: []
  patterns: [shared-formatting-helpers, single-source-of-truth]
key_files:
  created: []
  modified:
    - packages/utils/src/index.ts
    - apps/cs-dashboard/next.config.js
    - apps/manager-dashboard/next.config.js
    - apps/payroll-dashboard/next.config.js
    - apps/owner-dashboard/next.config.js
    - apps/sales-board/next.config.js
    - apps/cs-dashboard/app/page.tsx
    - apps/manager-dashboard/app/page.tsx
    - apps/payroll-dashboard/app/page.tsx
    - apps/owner-dashboard/app/page.tsx
    - apps/sales-board/app/page.tsx
    - apps/cs-dashboard/package.json
    - apps/manager-dashboard/package.json
    - apps/payroll-dashboard/package.json
    - apps/owner-dashboard/package.json
    - apps/sales-board/package.json
decisions:
  - Owner dashboard keeps Intl.NumberFormat with 0 decimals for KPI summary (intentionally different from formatDollar)
  - Manager dashboard period date range keeps short month format (not replaced with formatDate)
  - CSV export numeric values kept as toFixed(2) raw numbers (no $ prefix needed in CSV data)
metrics:
  duration: 353s
  completed: 2026-03-18
---

# Phase 15 Plan 02: Shared Formatting Helpers Summary

Extracted formatDollar, formatNegDollar, and formatDate to @ops/utils as single source of truth for dollar and date formatting across all 5 dashboard apps.

## Task Results

| # | Task | Status | Commit | Key Changes |
|---|------|--------|--------|-------------|
| 1 | Add formatting helpers to @ops/utils and update transpilePackages | Done | 508b34c | Added 3 formatting functions to packages/utils, added @ops/utils to all 5 dashboard transpilePackages and package.json |
| 2 | Update all dashboards to import shared formatting helpers | Done | ce33993 | Replaced local formatDollar/fmtDate/fmt$ with imports from @ops/utils across all 5 dashboards |

## Key Changes

### packages/utils/src/index.ts
- `formatDollar(n)` - formats as $X,XXX.XX (always positive, 2 decimal places)
- `formatNegDollar(n)` - formats as -$X,XXX.XX
- `formatDate(d)` - formats ISO date as M/D/YYYY, returns "--" for null/undefined

### Dashboard Updates
- **cs-dashboard**: Removed local `formatDollar`, `formatNegDollar`, and `fmtDate` functions; all replaced with imports
- **sales-board**: Removed local `fmt$` function; replaced with `formatDollar` import
- **manager-dashboard**: Replaced inline `$${x.toFixed(2)}` display patterns and `toLocaleDateString()` calls with shared helpers
- **payroll-dashboard**: Replaced inline dollar display patterns with `formatDollar()` in commission, subtotal, and service agent views
- **owner-dashboard**: Added import for availability (keeps existing Intl.NumberFormat for whole-dollar KPI display)

## Deviations from Plan

### Design Decisions (not deviations)

**1. Owner dashboard KPI formatting preserved**
- Owner dashboard uses `Intl.NumberFormat` with `maximumFractionDigits: 0` for KPI cards (shows `$1,234` not `$1,234.00`)
- This is intentional for summary-level display; replacing would change the visual design
- Import added for future use but existing formatter preserved

**2. CSV export values not replaced**
- CSV exports use `toFixed(2)` for raw numeric values without `$` prefix
- These are data values, not display formatting -- replacing with `formatDollar()` would add `$` and commas to CSV cells

**3. Manager dashboard period date range preserved**
- Period start/end dates use `toLocaleDateString("en-US", { month: "short", day: "numeric" })` format (e.g., "Mar 18")
- This is intentionally different from the M/D/YYYY format for compact payroll period display

## Verification

- `grep -rn "from '@ops/utils'" apps/*/app/page.tsx` returns 5 matches (one per dashboard)
- `grep -c "export function format" packages/utils/src/index.ts` returns 3
- No local `fmtDate`, `fmt$`, or duplicate `formatDollar` in any dashboard
- All 5 next.config.js files include `@ops/utils` in transpilePackages

## Self-Check: PASSED
