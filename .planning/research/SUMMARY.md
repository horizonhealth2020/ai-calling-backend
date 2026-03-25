# Project Research Summary

**Project:** v1.7 Dashboard Fixes & Cost Tracking
**Domain:** Insurance sales operations platform — bug fixes, Convoso data flow repair, CS audit trail
**Researched:** 2026-03-25
**Confidence:** HIGH

## Executive Summary

v1.7 is a surgical maintenance milestone, not a feature build. Every deliverable operates entirely within the existing Next.js 15 / Express / Prisma / PostgreSQL stack — zero new dependencies, zero schema migrations. The work divides into three buckets: (1) three low-friction UI/schema bug fixes that should have shipped earlier, (2) a medium-complexity Convoso data flow repair that unblocks accurate cost tracking, and (3) a new read-only CS Resolved Log tab that surfaces already-persisted resolution data in a dedicated audit view. The most significant research finding is that the `ConvosoCallLog` table, the `callBufferSeconds` column, and all ChargebackSubmission resolution fields already exist in the Prisma schema — the only work is wiring up code paths that were never connected.

The recommended approach is to ship the three quick fixes first, then repair the Convoso data flow, then build the lead spend display on top of the repaired data, and finally add the CS Resolved Log as a standalone capability. This order is driven by one hard dependency: agent lead spend with zero sales cannot display meaningful data until `ConvosoCallLog` records are being persisted by the poller. All other features are independent and could be parallelized if needed.

The key risk is duplicate `ConvosoCallLog` records if the `createMany` insert is placed at the wrong point in the poller's data flow. The existing `ProcessedConvosoCall` deduplication filter produces a `newRaw` slice that solves this — the insert must happen after that filter, not before it. A secondary risk is silent field-mapping errors from the Convoso API response. Both risks are well-understood, have concrete prevention steps, and are detectable within one poll cycle via a simple duplicate-check query.

## Key Findings

### Recommended Stack

No stack changes for v1.7. The existing stack handles all six features without new libraries, new database engines, or architectural changes. The most important confirmation is that the `ConvosoCallLog` model, `callBufferSeconds` column, and all ChargebackSubmission resolution fields already exist in the Prisma schema — the only work is wiring up code paths that were never connected. See `.planning/research/STACK.md` for per-feature stack impact analysis and rationale for explicitly rejecting React Query, DataGrid libraries, and separate analytics services.

**Core technologies (unchanged):**
- **Next.js 15.3.9:** New CS Resolved Log tab is a standard page component — no framework-level changes needed
- **Express 4.19.2:** New endpoints follow existing asyncHandler + Zod + RBAC patterns exactly
- **Prisma 5.20.0:** All queries use existing models; zero migrations expected
- **Socket.IO 4.8.3:** Existing `cs:changed` event covers resolved log refresh requirements
- **Zod 3.23.8:** Schema extension for buffer field and resolved query filter follow established patterns

### Expected Features

See `.planning/research/FEATURES.md` for full feature analysis with line-level implementation pointers.

**Must have (table stakes — fixing broken behavior):**
- Remove Products from Manager Config tab — duplicated section causes configuration conflicts; pure JSX removal
- Add Buffer field to Lead Source create form — field exists in DB and edit form but is absent from create form and Zod schema
- Fix Convoso call log data flow — poller never writes to `ConvosoCallLog`, blocking all cost-per-sale queries from local DB
- Fix Manager Agent Sales premium column — excludes addon premiums, inconsistent with sales board and payroll (both include addons since v1.2)

**Should have (new capability):**
- CS Resolved Log tab — audit trail for OWNER_VIEW/SUPER_ADMIN showing resolved chargebacks and pending terms with resolver name, timestamp, and notes
- Show agent lead spend with zero sales — surfaces agents burning through leads with no conversions, enabling coaching and termination decisions

**Defer (not in v1.7 scope):**
- Cost per sale charting — fix data flow first; visualization is a future milestone concern
- Batch operations on resolved log — keep it a read-only audit trail; batch ops encourage sloppy workflows
- Real-time Convoso call monitoring — out of scope per PROJECT.md

### Architecture Approach

v1.7 does not change the system architecture. All six features add code within existing component boundaries: a write call added to the KPI poller, a query filter added to two existing API endpoints, a Zod schema field added to the lead source create route, JSX removed from a manager config component, and one new tab component added to the CS dashboard section. The data flow diagram changes in exactly one place: `ConvosoCallLog` goes from never-written to written by the poller immediately after the `ProcessedConvosoCall` dedup filter. See `.planning/research/ARCHITECTURE.md` for implementation patterns with code examples for all four change types.

**Major components (unchanged boundaries):**
1. **convosoKpiPoller.ts** — add `prisma.convosoCallLog.createMany()` after `newRaw` filter, before KPI aggregation
2. **chargebacks.ts / pending-terms routes** — extend with `?resolved=true` query param filter; do not create new dedicated endpoints
3. **ops-dashboard CS section** — add `CSResolvedLog.tsx` component following existing CSTracking pattern with Socket.IO listener

### Critical Pitfalls

See `.planning/research/PITFALLS.md` for full pitfall analysis with detection queries.

1. **ConvosoCallLog duplicate records (P1, CRITICAL)** — inserting from `raw` instead of `newRaw` causes every call to be re-inserted on every poll cycle. Prevention: insert only from `newRaw` (post-dedup set), add `skipDuplicates: true`. Detection: `SELECT COUNT(*) FROM convoso_call_logs GROUP BY agent_user, call_timestamp HAVING COUNT(*) > 1` after first poll cycle.
2. **Convoso API field mapping mismatch (P2, CRITICAL)** — `call_length` unit (seconds vs minutes) and exact field names must be verified against live API response before finalizing the mapping. Prevention: log `raw[0]` during development, add explicit fallbacks (`r.call_length ?? r.call_duration`), spot-check 5 records after first cycle.
3. **Lead spend display shows nothing without poller data (P4, MODERATE)** — feature appears broken if Convoso data flow fix is not deployed and verified first. Prevention: ship Phase 2 before Phase 3; show "No call data available" empty state that distinguishes zero-spend from no-data.
4. **Resolved log shows stale data after unresolve (P3, MODERATE)** — new tab may not have a Socket.IO `cs:changed` listener. Prevention: add listener mirroring CSTracking component, or explicitly accept and document manual-refresh behavior for this audit view.
5. **Manager loses product visibility (P5, MODERATE)** — before removing the Products section, verify managers use it for configuration edits only, not for reference. Prevention: confirm with PROJECT.md scope; convert to read-only instead of deleting if reference access is needed.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Quick Bug Fixes
**Rationale:** Three independent, low-complexity changes with no shared dependencies and no dependency on the Convoso data flow work. Shipping them together reduces PR overhead and immediately improves UX for managers and ops admins.
**Delivers:** Products removed from Manager Config; Buffer field on Lead Source create; Manager Sales premium column shows addon-inclusive totals
**Addresses:** Table-stakes features 1, 2, 6 from FEATURES.md
**Avoids:** P5 (confirm manager product visibility needs before removal), P6 (label column "Total Premium" to signal addon inclusion), P7 (use `z.number().int().min(0).default(0)` not `.optional()` on buffer field)

### Phase 2: Convoso Data Flow Repair
**Rationale:** The foundational fix that unblocks Phase 3. Until `ConvosoCallLog` records exist, the lead spend display has no data source. This phase carries the highest technical risk of the milestone (P1 duplicate records, P2 field mapping) and must be verified before Phase 3 builds on top of it.
**Delivers:** Poller writes individual call records to `ConvosoCallLog` on every poll cycle; cost-per-sale queries can use local DB instead of live Convoso API; call audit pipeline can reference stored records
**Addresses:** Table-stakes feature 4 from FEATURES.md
**Avoids:** P1 (insert from `newRaw` after dedup, add `skipDuplicates: true`), P2 (log raw response in development, validate field names before production deploy)

### Phase 3: Lead Spend Display
**Rationale:** Direct dependent of Phase 2. Once `ConvosoCallLog` records exist, this is a low-complexity display change. Keeping it separate from Phase 2 allows Phase 2 to be verified independently before the dashboard surface is built on top of it.
**Delivers:** Agent tracker and owner dashboard show `totalLeadCost` for all agents with calls, including those with zero sales
**Addresses:** Should-have feature (agent lead spend with zero sales) from FEATURES.md
**Avoids:** P4 (Phase 2 must be deployed and verified first; empty state must distinguish "zero spend" from "no data available")

### Phase 4: CS Resolved Log Tab
**Rationale:** Standalone new capability with no dependency on the Convoso work. It is medium complexity (two data sources merged into one view) and benefits from shipping after the simpler phases to maintain focus in each PR.
**Delivers:** OWNER_VIEW/SUPER_ADMIN can browse all resolved chargebacks and pending terms with resolver name, resolution type, notes, and timestamps; date range filter; CSV export
**Addresses:** Should-have feature (CS Resolved Log) from FEATURES.md
**Avoids:** P3 (add `cs:changed` Socket.IO listener or explicitly document manual-refresh behavior for audit use case)

### Phase Ordering Rationale

- Phase 1 ships before Phase 2 because the quick fixes are independent and reduce codebase noise before the higher-risk poller change
- Phase 2 must precede Phase 3 due to a hard data dependency — no `ConvosoCallLog` records means no lead spend data
- Phase 4 is independent of Phases 2-3 and could be parallelized; sequential ordering is for simplicity, not necessity
- All six features have no blocking cross-dependencies beyond the Phase 2 → Phase 3 link

### Research Flags

Phases with standard patterns (research-phase not needed):
- **Phase 1:** All three changes follow well-established patterns already in the codebase (JSX removal, Zod schema extension, SaleProduct join pattern from sales board and payroll)
- **Phase 3:** Display-layer change on existing KPI data; standard authFetch + useEffect fetch pattern
- **Phase 4:** New tab component following existing CSTracking pattern; query filter extension is documented in ARCHITECTURE.md with working code example

Phases requiring implementation-time verification (not full research, but careful spot-checking):
- **Phase 2:** Convoso API field names and units must be verified against a live API response before finalizing the `createMany` field mapping. Log `raw[0]` during development. Spot-check 5 stored records against Convoso dashboard after first poll cycle.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct schema and source file analysis; all required columns and models confirmed to exist at specific line numbers |
| Features | HIGH | Each feature traced to specific file and line numbers; scope matches PROJECT.md; no ambiguous requirements |
| Architecture | HIGH | Implementation patterns extracted directly from existing codebase code; no inference required; code examples provided |
| Pitfalls | HIGH | P1 and P2 identified from direct code analysis of poller and schema; prevention steps are concrete with detection queries |

**Overall confidence:** HIGH

### Gaps to Address

- **Convoso API response shape:** The exact field names and units (seconds vs minutes for `call_length`, timestamp field name) must be verified against a live API response during Phase 2 implementation. The codebase casts the response without Zod validation. Log `raw[0]` on first development run before finalizing the field mapping.
- **Manager product reference use:** Whether managers actively use the Products section in Manager Config for reference (vs accidental edits) is a product question that code inspection cannot answer. Confirm with stakeholders before Phase 1 ships, or default to converting it to read-only rather than deleting it outright.
- **Resolved log CSV export implementation:** FEATURES.md identifies CSV export as an expected capability for the resolved log. The existing export pattern from other ops views should be confirmed as applicable here before Phase 4 implementation begins.

## Sources

### Primary (HIGH confidence — direct codebase analysis)
- `prisma/schema.prisma` lines 114, 457, 537, 557-560 — confirmed existing columns, models, and resolution fields
- `apps/ops-api/src/workers/convosoKpiPoller.ts` — confirmed poller writes `AgentCallKpi` but not `ConvosoCallLog`; `newRaw` dedup filter location identified
- `apps/ops-api/src/routes/agents.ts:76` — confirmed `callBufferSeconds` missing from lead source create Zod schema
- `apps/ops-api/src/routes/chargebacks.ts:148, 177` — `emitCSChanged` on resolve and resolver include in GET response confirmed
- `apps/ops-api/src/services/convosoCallLogs.ts` — `buildKpiSummary` calculates `totalLeadCost` for all agents with calls
- `.planning/PROJECT.md` — v1.7 milestone scope definition

### Secondary (MEDIUM confidence — pattern inference from existing views)
- Sales board / payroll addon-inclusive premium pattern — confirmed as the correct model for the Manager Sales premium fix; directly replicable without modification

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
