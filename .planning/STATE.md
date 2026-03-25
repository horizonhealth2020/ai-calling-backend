---
gsd_state_version: 1.0
milestone: v1.6
milestone_name: Pre-Launch Stabilization
status: defining requirements
last_updated: "2026-03-25"
last_activity: 2026-03-25
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State: Ops Platform -- Payroll & Usability Overhaul

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-25)

**Core Value:** A sale entered once flows correctly to every dashboard with accurate commission calculations -- agents get paid right, managers can track performance, owners see real KPIs.
**Current focus:** v1.6 Pre-Launch Stabilization

## Current Position

Phase: Not started (defining requirements)
Plan: --
Status: Defining requirements
Last activity: 2026-03-25 -- Milestone v1.6 started

## Performance Metrics

| Metric | Value |
|--------|-------|
| Milestones shipped | 4 (v1.0, v1.1, v1.2, v1.3) |
| Total phases | 19 complete + 1 planned |
| Total plans | 64 complete |
| Total requirements | 133 shipped + 14 v1.4 |
| Timeline | 10 days shipped (2026-03-14 to 2026-03-23) |
| Phase 23 P01 | 229 | 2 tasks | 3 files |
| Phase 24 P01 | 141s | 2 tasks | 3 files |
| Phase 24 P02 | 284s | 2 tasks | 2 files |

## Accumulated Context

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260317-dgz | Convoso call log API integration with KPI tiers and per-agent aggregates | 2026-03-17 | 6c8ef4e | [260317-dgz-convoso-call-log-api-integration-with-kp](./quick/260317-dgz-convoso-call-log-api-integration-with-kp/) |
| 260317-dqd | Wire Convoso call logs to Agent model with cost-per-sale and CallAudit auto-tag | 2026-03-17 | ba7b111 | [260317-dqd-wire-convoso-call-logs-to-agent-model-an](./quick/260317-dqd-wire-convoso-call-logs-to-agent-model-an/) |
| 260317-dxw | Cron worker polling Convoso every 10 min for per-agent KPI snapshots | 2026-03-17 | 2083caa | [260317-dxw-cron-worker-polling-convoso-every-10-min](./quick/260317-dxw-cron-worker-polling-convoso-every-10-min/) |
| 260317-e6a | Deduplicate Convoso call log processing to prevent KPI inflation | 2026-03-17 | b422e4b | [260317-e6a-deduplicate-convoso-call-logs-prevent-sa](./quick/260317-e6a-deduplicate-convoso-call-logs-prevent-sa/) |

### Key Decisions (v1.5)

| Decision | Rationale |
|----------|-----------|
| Auto-matching runs after createMany before alerts | Ensures alerts reference already-matched chargebacks |
| Commission-based clawback from PayrollEntry.payoutAmount | Agent pays back their commission portion, not full chargeback amount |
| Dedupe guard on saleId + matchedBy + matchedValue | Prevents double clawbacks from multiple submission paths |
| Agent-first grouping in detailed CSV | Matches print card workflow -- each agent gets a stack of weekly cards |
| Service staff trailing section with separate columns | Different pay structure (basePay/bonus/deductions vs commission/fronted/hold) |
| Map-based grouping with tagged entries | Clean separation of grouping logic, handles multi-period exports correctly |

### Key Decisions (v1.4)

| Decision | Rationale |
|----------|-----------|
| Per-row state approach for BundleRequirement | More queryable and auditable than String[] array; consistent with relational patterns (from research) |
| State-aware path replaces legacy isBundleQualifier | No double halving -- one check fires per sale; products with BundleRequirement skip legacy path |
| commissionApproved bypasses state-based halving | Consistent with existing behavior where it bypasses all other halving |
| memberState null falls through to legacy logic | Backward compatibility -- existing sales without state produce identical results |
| Consolidated to single phase (Phase 20) | User requested all work in one long-running phase |
| Manual migration SQL (no live DB) | Worktree environment has no PostgreSQL; SQL written manually to match Prisma output |
| US_STATES in @ops/types | Co-locates StateCode type with AppRole and SessionUser |
| FIX-02 confirmed no-op | No seed agents (Amy/Bob/Cara/David/Elena) exist in codebase |
| Fixed pre-existing VAB premium test expectations | Tests stale since 3e3e6bc; updated to match actual bundlePremium calculation |
| handleSaleEditApproval delegates to upsert | upsertPayrollEntryForSale already resolves bundle context; no direct calculateCommission call needed |
| GET /products includes bundle relations | Config UI needs requiredBundleAddon, fallbackBundleAddon, stateAvailability data |
| State availability returns flat array | Simpler client consumption than returning objects |
| US_STATES dropdown replaces free-text memberState | Better data quality, consistent 2-char codes |
| C.warning color for halving reason | Amber tone, consistent with other payroll warnings |
| 400ms role selector delay | Prevents premature collapse on mouse leave |

### Open Questions

- (none currently -- business rules locked per research recommendations)

### Blockers

None currently.

---
*State initialized: 2026-03-14*
*Last updated: 2026-03-24*
