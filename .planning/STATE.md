---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 10-03-PLAN.md
last_updated: "2026-03-15T17:02:58Z"
progress:
  total_phases: 10
  completed_phases: 3
  total_plans: 15
  completed_plans: 13
  percent: 87
---

# Project State: Ops Platform -- Payroll & Usability Overhaul

## Project Reference

**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations -- agents get paid right, managers can track performance, owners see real KPIs.

**Current Focus:** Phase 10 -- Sale Status Payroll Logic

## Current Position

**Phase:** 10 of 10 -- Sale Status Payroll Logic -- IN PROGRESS
**Plan:** 3 of 4 -- Manager Dashboard Status UI -- COMPLETE
**Status:** In progress

```
Progress: [########.] 87%
Phase 1 [#####] | Phase 2 [#####] | Phase 3 [#####] | Phase 4 [##...]
Phase 5 [.....] | Phase 6 [.....] | Phase 7 [.....] | Phase 8 [.....]
Phase 9 [.....] | Phase 10 [###.]
```

## Performance Metrics

| Metric | Value |
|--------|-------|
| Plans completed | 13 |
| Plans total | 15+ (remaining phases TBD) |
| Requirements done | 21/36 |
| Phases done | 3/10 |

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01 | 01 | 220s | 2 | 3 |
| 01 | 02 | 39s | 1 | 1 |
| 01 | 03 | 33s | 2 | 1 |
| 02 | 01 | 147s | 2 | 5 |
| 02 | 02 | 240s | 2 | 4 |
| 02 | 03 | ~120s | 2 | 3 |
| 02 | 04 | ~180s | 3 | 2 |
| 03 | 01 | 125s | 2 | 1 |
| 03 | 02 | 157s | 2 | 4 |
| 04 | 01 | 100s | 2 | 2 |
| 10 | 01 | 192s | 3 | 6 |
| 10 | 02 | 172s | 2 | 2 |
| 10 | 03 | 169s | 2 | 1 |

## Accumulated Context

### Key Decisions
- [Phase 10] All existing sales migrate to RAN (not REJECTED->DEAD) per user decision
- [Phase 10] Commission gate in upsertPayrollEntryForSale, not calculateCommission (keeps calc pure)
- [Phase 10] POST /api/sales requires explicit status (no default) so managers must choose
- [Phase 10] PATCH /api/sales/:id no longer accepts status (moved to dedicated endpoint in Plan 02)
- [Phase 10] handleCommissionZeroing follows existing clawback pattern (ZEROED_OUT for OPEN, CLAWBACK_APPLIED for finalized)
- [Phase 10] Pending change requests auto-cancelled on Ran->Dead/Declined to prevent orphans
- [Phase 10] StatusChangeRequest cleanup added explicitly to sale delete transaction
- [Phase 10] window.confirm for Dead/Declined->Ran confirmation (consistent with existing delete pattern)
- [Phase 10] Pending Ran sales show badge instead of dropdown to prevent editing while awaiting approval
- [Phase 4] Carrier made optional with .optional().default("") to preserve existing DB behavior (empty string, not null)
- [Phase 4] Product dropdown filters to CORE type only; addon picker shows ADDON first then AD_D
- [Phase 3] Luxon America/New_York used for day-of-week only; output stays UTC midnight dates to preserve period ID format
- [Phase 3] shiftWeeks default=0 makes ACH shift backward compatible
- [Phase 3] Null payment_type backfilled to CC (preserves existing period assignments)
- [Phase 3] Bonus triggers for fee >= $125 (not just exactly $125) -- kept existing behavior per user decision
- [Phase 2] Final-only rounding (Math.round at end) avoids penny accumulation from intermediate rounding
- [Phase 2] Console.warn for null commission rates -- ops visibility without breaking calculation
- [Phase 2] Mock @ops/db module for unit tests to avoid PrismaClient connection
- [Phase 2] ts-node added as devDependency for Jest TypeScript config file parsing
- [Phase 2] Jest config uses path.resolve(__dirname) for tsconfig path to avoid ts-jest relative resolution issues
- [Phase 2] Manual migration SQL (no prisma migrate dev) continued from Phase 1 decision
- [Phase 2] Product column shows read-only badges in edit mode (not editable inline)
- [Phase 2] enrollmentFee sent as nullable number to PATCH /sales/:id
- [Phase 2] Addon premiums tracked as separate React state, sent as Record<productId, number> to API
- Fix sales entry 500 error before all other work (everything depends on it)
- Commission engine split into two phases: core bundle logic (Phase 2), then fees and arrears (Phase 3)
- Multi-product form (Phase 4) separated from commission preview/edit (Phase 5) to reduce complexity per phase
- Dashboard cascade (Phase 6) depends on correct commission data, so it follows the engine phases
- UI/UX polish is last phase -- polish is meaningless on broken functionality
- [Phase 1] memberState added to Sale model using @map("member_state") convention; migration only for SaleAddon premium since member_state column already existed
- [Phase 1] Alert bar moved above form for immediate visibility; typed message state replaces fragile string-prefix detection
- [Phase 1] Manual migration SQL created due to no DATABASE_URL in dev environment
- [Phase 1] Noon UTC (T12:00:00) chosen for date storage to maximize timezone buffer in both directions
- [Phase 1] Payroll upsert errors logged via console.error, non-fatal to sale creation
- [Phase 1] Agent dropdown kept ?all=true fetch but defaults to empty; only saleDate display needed UTC fix

### Roadmap Evolution
- Phase 10 added: Sale Status Payroll Logic — status-driven commission (Ran/Declined/Dead), change request workflow, payroll approval queue

### Research Findings Applied
- `memberState` reference in payroll.ts causes 500 on every sale creation -- FIXED in Phase 1
- String-matching bundle detection replaced with `isBundleQualifier` flag -- DONE in Phase 2
- Week-in-arrears logic implemented: getSundayWeekRange uses Luxon Eastern timezone with ACH +1 week shift -- DONE in Phase 3
- Socket.IO currently only emits audit events, needs sale/payroll/KPI events -- Phase 6
- Luxon now used for Eastern timezone period assignment in getSundayWeekRange -- DONE in Phase 3

### Open Questions
- SaleAddon premium model resolved: per-addon premium field added as Decimal(12,2) optional
- CSV vs Excel export format (resolve before Phase 7)
- Luxon timezone convention resolved: America/New_York for day-of-week, UTC midnight for storage/period IDs
- Commission preview endpoint design: separate `/api/sales/preview` vs dry-run mode (resolve before Phase 5)

### Blockers
None currently.

### TODOs
- Execute Phase 4 Plan 2 (Field reorder, stagger animations, end-to-end verification)

## Session Continuity

**Last session:** 2026-03-15T17:02:58Z
**Stopped at:** Completed 10-03-PLAN.md
**Next action:** Execute Phase 10 Plan 4 (Payroll dashboard pending approvals)

---
*State initialized: 2026-03-14*
*Last updated: 2026-03-15*
