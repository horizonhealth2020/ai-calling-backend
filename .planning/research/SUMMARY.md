# Research Summary: v1.5 Platform Cleanup & Remaining Features

**Domain:** Insurance sales operations platform -- AI scoring, chargeback automation, data archival, route splitting, payroll enhancements
**Researched:** 2026-03-24
**Overall confidence:** HIGH

## Executive Summary

v1.5 adds six features to an existing Express/Prisma/Next.js 15 ops platform that has shipped 4 milestones in 10 days (~124,000 LOC). The existing architecture is sound but has one clear bottleneck: a 2750-line single route file that every feature touches. All six features are implementable with the existing dependency tree -- no new npm packages required (recharts is already installed but unused).

The most architecturally significant finding is that the chargeback-to-clawback flow has a known bug: `approveAlert()` uses `memberId` (a string identifier) as `saleId` (a cuid), creating clawback records that point to nonexistent sales. This must be fixed as part of the automation work, not as a separate patch. The automation service adds an auto-match step after alert creation that attempts exact matches on memberId/memberName, falling back to manual review when no match is found.

For data archival, the research files contain two competing approaches: STACK.md recommends soft-delete with `archivedAt` columns on core tables, while ARCHITECTURE.md recommends parallel archive tables accessed via `prisma.$queryRaw`. The archive table approach is the better fit because: (1) it avoids the query contamination risk where every existing Prisma query must be updated to exclude archived records (PITFALLS P8), (2) it genuinely reduces main table sizes for faster queries, and (3) it only applies to high-volume non-core tables (call logs, audit logs) rather than core business tables (sales, payroll entries) which should never be archived. The roadmapper should use ARCHITECTURE.md's approach.

The AI scoring dashboard is the highest-UI-complexity feature but has zero schema changes -- all data already exists in `CallAudit` records. Three new aggregate API endpoints feed a new owner dashboard tab. STACK.md discovered that recharts 3.8.0 is already installed in root `package.json` but never used; however, ARCHITECTURE.md recommends against using it (table-based display matching existing patterns). This is a UX judgment call for the implementer -- both approaches work.

## Key Findings

**Stack:** No new dependencies needed. Recharts already installed (unused). Express Router composition for route splitting. Prisma `$queryRaw` for archive tables.

**Architecture:** 16-file route split from single 2750-line file. New `services/clawbackAutomation.ts` for auto-matching. New `services/archival.ts` with parallel archive tables. Three new API endpoints for AI scoring aggregation. Client-side print card CSV export.

**Critical pitfall:** `approveAlert()` in `services/alerts.ts` creates clawbacks with invalid saleId (memberId string instead of sale cuid). Automating this broken flow would systematically create corrupt clawback records. Must be rewritten before automation.

## Implications for Roadmap

Based on research, the suggested phase structure accounts for dependencies, risk ordering, and the need to eliminate the route file bottleneck before all other work.

### Phase 1: Route File Splitting (Tech Debt)

**Rationale:** The 2750-line route file is touched by every subsequent feature. Splitting it first means features 2-6 target clean, small files with no merge conflicts. Pure refactor -- zero behavior changes.

**Delivers:** 16 domain route files averaging 100-300 lines each. Shared `helpers.ts` with zodErr, asyncHandler, dateRange. Barrel `index.ts` mounting all sub-routers.

**Addresses:** Route splitting feature (FEATURES.md), P3 and P10 pitfalls (PITFALLS.md)

### Phase 2: CS Payroll on Owner Dashboard

**Rationale:** Smallest scope feature. No schema changes. Adds ServicePayrollEntry aggregate to existing owner summary endpoint and a KPI card to OwnerOverview.tsx. Quick win that gives owners a complete financial picture.

**Delivers:** Modified `GET /owner/summary` and `GET /reporting/periods` with servicePayrollTotal. New KPI card in OwnerOverview.

**Addresses:** CS payroll feature (FEATURES.md), P7 pitfall (PITFALLS.md)

### Phase 3: Payroll CSV Print Card Format

**Rationale:** Client-side only change. No API or schema changes. Adds a third export option to PayrollExports.tsx that matches the existing print card HTML layout.

**Delivers:** `exportPrintCardCSV()` function with agent-grouped sections, summary headers, and subtotals matching printAgentCards layout.

**Addresses:** CSV export feature (FEATURES.md), P11 pitfall (PITFALLS.md -- get print card sample first)

### Phase 4: AI Scoring Dashboard

**Rationale:** No schema changes needed. All data exists in CallAudit. Adds 3 new aggregate endpoints (scoring-summary, scoring-trends, agent-scores) and a new OwnerScoring.tsx component. Moderate UI complexity.

**Delivers:** New "Scoring" tab on owner dashboard with KPI cards, weekly trend table, and per-agent score breakdown. DateRangeFilter integration.

**Addresses:** AI scoring dashboard feature (FEATURES.md), P5 and P15 pitfalls (PITFALLS.md)

### Phase 5: Chargeback-to-Clawback Automation

**Rationale:** Schema migration required (2 new columns). Fixes the existing approveAlert bug. Adds auto-matching service that runs after alert creation. Higher risk than phases 2-4 because it modifies the chargeback submission flow and creates financial records.

**Delivers:** New `services/clawbackAutomation.ts`. Modified chargeback submission handler. Fixed `approveAlert()`. Schema migration adding `source_alert_id` to clawbacks, `auto_matched` + `matched_sale_id` to payroll_alerts.

**Addresses:** Chargeback automation feature (FEATURES.md), P1 and P6 pitfalls (PITFALLS.md)

### Phase 6: Data Archival with Restore

**Rationale:** Highest risk feature. Involves raw SQL, data deletion, FK handling, and new archive tables. Benefits from all other features being stable. Ship last.

**Delivers:** 6 archive tables (convoso_call_logs, call_audits, ai_usage_logs, app_audit_log, processed_convoso_calls, agent_call_kpis). New `services/archival.ts` with batched archive/restore. Admin endpoints. Data management section in OwnerConfig.

**Addresses:** Data archival feature (FEATURES.md), P2, P8, P13, P14 pitfalls (PITFALLS.md)

**Phase ordering rationale:**
- Route splitting first eliminates merge conflict bottleneck for all subsequent work
- Phases 2-3 are lowest risk, no migrations, quick wins
- Phase 4 adds endpoints but no migrations, moderate complexity
- Phase 5 has a migration and modifies an existing flow -- needs stable route structure
- Phase 6 is highest risk with raw SQL and data deletion -- needs everything else stable

**Research flags for phases:**
- Phase 1: Standard Express pattern, unlikely to need research
- Phase 2: Standard Prisma aggregate, unlikely to need research
- Phase 3: Needs print card sample from business before implementation
- Phase 4: Standard aggregate queries, may need research if recharts is chosen over tables
- Phase 5: May need deeper research on matching strategies if exact match rate is too low
- Phase 6: May need phase-specific research on FK cascade ordering and Railway PostgreSQL VACUUM behavior

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All packages verified in package.json. No new dependencies needed. |
| Features | HIGH | All features derived from PROJECT.md scope + direct codebase analysis. |
| Architecture | HIGH | All recommendations based on direct code analysis with specific file/line references. |
| Pitfalls | HIGH | 15 pitfalls identified from code inspection. P1 (broken saleId) confirmed by reading alerts.ts. |

## Conflicts Between Research Files

| Conflict | STACK.md Says | ARCHITECTURE.md Says | Resolution |
|----------|---------------|---------------------|------------|
| Archival approach | Soft-delete with `archivedAt` column on core models | Parallel archive tables via raw SQL for non-core tables only | Use ARCHITECTURE.md approach -- avoids P8 query contamination, only archives high-volume non-core tables |
| AI dashboard charts | Use recharts (already installed) | Use table-based display (no chart library) | Implementer's judgment call. Both work. Tables are simpler and match existing patterns. |
| Route file naming | `owner.ts`, `callAudit.ts`, `salesBoard.ts`, `config.ts`, `alerts.ts` | `reporting.ts`, `call-audit.ts`, `admin.ts`, `settings.ts`, `webhooks.ts` | Use ARCHITECTURE.md naming -- more granular split with kebab-case consistency |

## Gaps to Address

- Print card sample needed from business before Phase 3 CSV work
- Matching strategy for chargebacks needs real-world data analysis (what % of chargebacks have exact memberId matches?)
- Railway PostgreSQL VACUUM behavior after bulk deletes needs validation before Phase 6

## Sources

### Primary (HIGH confidence -- direct codebase inspection)
- `apps/ops-api/src/routes/index.ts` -- 2750 lines, 95 handlers
- `apps/ops-api/src/services/alerts.ts` -- broken saleId in approveAlert (line 46)
- `apps/ops-api/src/services/callAudit.ts` -- structured audit pipeline
- `apps/ops-api/src/services/payroll.ts` -- commission engine
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx` -- print card format
- `apps/ops-dashboard/app/(dashboard)/payroll/PayrollExports.tsx` -- existing CSV exports
- `apps/ops-dashboard/app/(dashboard)/owner/page.tsx` -- tab structure
- `prisma/schema.prisma` -- all 28 models
- `.planning/PROJECT.md` -- v1.5 scope

---
*Research completed: 2026-03-24*
*Ready for roadmap: yes*
