# Enterprise Plan Audit Report

**Plan:** .paul/phases/58-owner-trends-tab/58-01-PLAN.md
**Audited:** 2026-04-10
**Verdict:** Conditionally acceptable (now upgraded to enterprise-ready after applying findings)

---

## 1. Executive Verdict

**Conditionally acceptable**, upgraded to **enterprise-ready** after applying 4 must-have and 4 strongly-recommended fixes.

The original plan had solid architecture (clean separation of aggregation service from route, correct auth pattern, good chart selection) but had several production-safety gaps: Prisma Decimal serialization was unaddressed, division-by-zero scenarios were unguarded, the `dateRange` helper's actual return shape (`{ gte, lt }`) was misrepresented as `from`/`to`, and partial failure in the aggregation service would result in 500 errors. All have been remediated.

I would sign my name to this plan post-remediation.

## 2. What Is Solid

- **Auth pattern is correct.** `requireAuth` + `requireRole("OWNER_VIEW", "SUPER_ADMIN")` follows the exact pattern used by all existing admin routes. No gap.
- **Service extraction.** Creating `trendAggregator.ts` as a separate service (not inline in the route) is the right call — matches `agentKpiAggregator.ts` pattern, keeps routes thin.
- **Chart library choice.** Recharts is SVG-based, React-native, and doesn't require global CSS — compatible with the inline CSSProperties constraint. No architectural conflict.
- **Boundaries are well-scoped.** Explicitly protecting OwnerOverview, OwnerScoring, and all other stable tabs. No schema changes. No Socket.IO coupling for trend data (correct — trends are historical, not real-time).
- **Tab integration approach.** Renaming `kpis` → `trends` in the ActiveSection type with hash routing update is clean and backward-compatible (old `#kpis` links will fall back to default tab).
- **Empty state handling specified.** Per-section EmptyState rather than full-page blank is the correct UX for multi-chart dashboards.

## 3. Enterprise Gaps Identified

### Gap 1: Prisma Decimal serialization (MUST-HAVE)
Prisma returns `Decimal` objects for `premium`, `avgCallLength`, `costPerSale`, `totalLeadCost`. These serialize to strings (`"12.50"`) in JSON, not numbers. Every chart would receive string data and either fail silently or render incorrectly. The plan's task descriptions did not specify `Number()` conversion.

### Gap 2: Division-by-zero in computed fields (MUST-HAVE)
`closeRate = sales / totalCalls`, `conversionRate = sales / calls`, `costPerSale = leadCost / sales` — all can divide by zero when an agent has snapshots but no calls, or a lead source has calls but no sales. Unguarded, these produce `NaN` or `Infinity` which propagate through Recharts as broken chart segments.

### Gap 3: `dateRange()` returns `{ gte, lt }` not `{ from, to }` (MUST-HAVE)
The plan referenced `dateRange.from` and `dateRange.to` in query descriptions. The actual helper returns `{ gte: Date, lt: Date }`. Using wrong field names would produce queries that match nothing (returning empty data with no error indication).

### Gap 4: Missing range returns undefined, not error (MUST-HAVE)
When `dateRange()` can't parse the range param (e.g., no range provided at all), it returns `undefined`. If the service passes `undefined` to Prisma where clauses, it silently matches all records — a full table scan returning unbounded data.

### Gap 5: `saleDate` vs `createdAt` for revenue grouping (STRONGLY RECOMMENDED)
The plan specified grouping by `createdAt` truncated to Monday. The business-correct field is `saleDate` — the date the sale was actually made. `createdAt` reflects when the record was entered into the system, which can differ by days for backdated entries.

### Gap 6: Partial failure resilience (STRONGLY RECOMMENDED)
The aggregation service runs 4+ queries in parallel. If one query fails (e.g., ConvosoCallLog table issue), the entire endpoint would 500. For a dashboard endpoint, partial data is better than no data.

### Gap 7: callsByTier JSON validation (STRONGLY RECOMMENDED)
`callsByTier` is stored as `Json` (not typed). If any historical record has malformed data (missing keys, wrong types), accessing `.short`, `.contacted`, etc. directly would throw or produce `undefined` in chart data.

### Gap 8: Recharts SSR/monorepo install (STRONGLY RECOMMENDED)
The plan said "Run `npm install recharts` in apps/ops-dashboard" but this is a monorepo — installs should run from root. Also, Recharts uses browser APIs; the `"use client"` directive is required, and `transpilePackages` may be needed depending on the Recharts version's ESM packaging.

## 4. Upgrades Applied to Plan

### Must-Have (Release-Blocking)

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | Prisma Decimal serialization | AC-1, Task 1 action | Added "convert Decimal to Number()" requirement on all Decimal fields throughout task descriptions |
| 2 | Division-by-zero guards | Task 1 action (items 2, 3) | Added explicit div-by-zero guards for closeRate, conversionRate, costPerSale |
| 3 | dateRange returns { gte, lt } | Task 1 action (header + all items) | Corrected field name references, added bold warning about actual return shape |
| 4 | Missing range returns undefined | Task 1 action (route section) | Added 400 response when dateRange returns undefined |

### Strongly Recommended

| # | Finding | Plan Section Modified | Change Applied |
|---|---------|----------------------|----------------|
| 1 | saleDate vs createdAt | Task 1 action (item 1) | Changed "createdAt" to "saleDate" for revenue grouping |
| 2 | Partial failure resilience | Task 1 action | Added try/catch with partial result return + logError |
| 3 | callsByTier JSON validation | Task 1 action (item 4) | Added JSON shape validation with skip-on-malformed |
| 4 | Recharts SSR/monorepo install | Task 2 action | Corrected install instructions, added "use client", transpilePackages note |

### Deferred (Can Safely Defer)

| # | Finding | Rationale for Deferral |
|---|---------|----------------------|
| 1 | Response caching for trends endpoint | Trend data is historical and changes slowly. A 60s cache-control header or in-memory cache would reduce DB load. Safe to defer because the team is 18 agents — query volume is negligible. |
| 2 | Chart data export (CSV/PDF) | Owners may want to export trend charts. Not in ROADMAP scope. Can be added as a future enhancement. |
| 3 | Automated tests for trendAggregator | The project's test suite covers Morgan only. Adding Jest tests for this service would be valuable but is consistent with the existing test coverage pattern (no API service tests currently exist). |

## 5. Audit & Compliance Readiness

**Auth/authorization:** Solid. Uses the same `requireAuth` + `requireRole` middleware as all other admin endpoints. SUPER_ADMIN bypass is intentional and documented.

**Audit trail:** Not applicable for read-only endpoint. No state mutations in this plan. The existing `logAudit` infrastructure is not needed here and correctly not invoked.

**Silent failure prevention:** Improved. Original plan had no error handling specification. After remediation: partial failure returns partial data with logged errors, missing range returns explicit 400, empty data returns empty arrays (not nulls).

**Data integrity:** Improved. Decimal→Number conversion prevents silent type coercion in charts. Division-by-zero guards prevent NaN/Infinity propagation. JSON validation on callsByTier prevents malformed historical data from crashing the endpoint.

**Ownership:** Clear. Two tasks with explicit file lists, verification commands, and acceptance criteria linkage.

## 6. Final Release Bar

**What must be true before this ships:**
- All Decimal fields convert to Number before JSON serialization
- All computed ratios guard against division by zero
- dateRange undefined → 400 response (not unbounded query)
- Recharts renders in "use client" component without SSR errors
- Empty data states render gracefully per-section

**Risks remaining if shipped as-is (post-remediation):**
- No server-side caching — acceptable at current scale (18 agents)
- No automated test coverage for the aggregation service — consistent with existing project patterns
- callsByTier JSON schema is implicit — if Convoso poller changes tier format, the chart would silently show 0s (not crash)

**Sign-off:** I would approve this plan for production execution.

---

**Summary:** Applied 4 must-have + 4 strongly-recommended upgrades. Deferred 3 items.
**Plan status:** Updated and ready for APPLY

---
*Audit performed by PAUL Enterprise Audit Workflow*
*Audit template version: 1.0*
