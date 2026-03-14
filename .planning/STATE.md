# Project State: Ops Platform -- Payroll & Usability Overhaul

## Project Reference

**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations -- agents get paid right, managers can track performance, owners see real KPIs.

**Current Focus:** Phase 1 -- Sales Entry Fix

## Current Position

**Phase:** 1 of 9 -- Sales Entry Fix
**Plan:** Not yet planned
**Status:** Not started

```
Progress: [..........] 0%
Phase 1 [.....] | Phase 2 [.....] | Phase 3 [.....] | Phase 4 [.....]
Phase 5 [.....] | Phase 6 [.....] | Phase 7 [.....] | Phase 8 [.....]
Phase 9 [.....]
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 0 |
| Plans total | TBD |
| Requirements done | 0/36 |
| Phases done | 0/9 |

## Accumulated Context

### Key Decisions
- Fix sales entry 500 error before all other work (everything depends on it)
- Commission engine split into two phases: core bundle logic (Phase 2), then fees and arrears (Phase 3)
- Multi-product form (Phase 4) separated from commission preview/edit (Phase 5) to reduce complexity per phase
- Dashboard cascade (Phase 6) depends on correct commission data, so it follows the engine phases
- UI/UX polish is last phase -- polish is meaningless on broken functionality

### Research Findings Applied
- `memberState` reference in payroll.ts causes 500 on every sale creation -- Phase 1 priority
- String-matching bundle detection must be replaced with `isBundleQualifier` flag -- Phase 2
- Week-in-arrears logic not implemented (`getSundayWeekRange` maps to current week) -- Phase 3
- Socket.IO currently only emits audit events, needs sale/payroll/KPI events -- Phase 6
- Luxon already installed but underused; should be used for arrears period logic -- Phase 3

### Open Questions
- SaleAddon premium model: do products share one `sale.premium` or have per-product premiums? (resolve in Phase 1 planning)
- CSV vs Excel export format (resolve before Phase 7)
- Luxon timezone convention: UTC vs local (resolve before Phase 3)
- Commission preview endpoint design: separate `/api/sales/preview` vs dry-run mode (resolve before Phase 5)

### Blockers
None currently.

### TODOs
- Plan Phase 1
- Resolve SaleAddon premium business question before Phase 2

## Session Continuity

**Last session:** 2026-03-14 -- Roadmap created with 9 phases covering 36 requirements
**Next action:** Plan Phase 1 (Sales Entry Fix)

---
*State initialized: 2026-03-14*
*Last updated: 2026-03-14*
