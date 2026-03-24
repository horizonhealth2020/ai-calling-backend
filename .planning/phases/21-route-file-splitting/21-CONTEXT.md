# Phase 21: Route File Splitting - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Split the 2750-line `apps/ops-api/src/routes/index.ts` into focused domain modules. Zero behavior change — every endpoint must return identical responses before and after.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (Full)
User delegated all implementation decisions to Claude. Guidelines from research:

- **D-01:** Group ~95 handlers into ~10-16 domain files by entity/feature area
- **D-02:** Extract shared helpers (zodErr, asyncHandler, dateRange, prisma imports) into a common helpers file
- **D-03:** Use Express Router composition — each domain file exports a router, barrel index.ts mounts all sub-routers
- **D-04:** File naming and structure at Claude's discretion (research suggests kebab-case)
- **D-05:** Keep flat URL paths unchanged — splitting is internal only
- **D-06:** All existing tests must pass without modification after the split

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Route File
- `apps/ops-api/src/routes/index.ts` — The 2750-line monolith to split (95+ handlers)

### Middleware
- `apps/ops-api/src/middleware/auth.ts` — requireAuth, requireRole middleware

### Services
- `apps/ops-api/src/services/payroll.ts` — Commission engine, upsertPayrollEntryForSale
- `apps/ops-api/src/services/alerts.ts` — Alert approval flow
- `apps/ops-api/src/services/audit.ts` — logAudit helper
- `apps/ops-api/src/services/callAudit.ts` — AI call audit queue

### Research
- `.planning/research/ARCHITECTURE.md` — Recommended domain split and file naming
- `.planning/research/PITFALLS.md` — P3 (helper extraction order), P10 (import chain breaks)

</canonical_refs>

<code_context>
## Existing Code Insights

### Route Handler Domains (from grep analysis)
| Domain | Lines (approx) | Handlers |
|--------|---------------|----------|
| Auth (login, logout, refresh, session) | 94-139 | 5 |
| Users | 141-188 | 4 |
| Agents + Lead Sources | 190-278 | 10 |
| Products + State Availability | 280-420 | 8 |
| Sales (CRUD, preview, status, commission) | 425-940 | 12 |
| Payroll (periods, entries, mark-paid) | 993-1185 | 10 |
| Service agents + entries + settings | 1188-1535 | 15 |
| Webhooks (Convoso) | 1538-1610 | 1 |
| Call recordings + audits + AI | 1612-1830 | 12 |
| Status/edit change requests | 1825-2088 | 6 |
| Call logs + KPI | 2089-2200 | 3 |
| Chargebacks | 2204-2370 | 8 |
| CS reps + roster | 2361-2460 | 8 |
| Pending terms | 2463-2572 | 5 |
| Alerts | 2574-2610 | 4 |
| AI budget + scoring | 2614-2650 | 3 |
| Agent KPIs + permissions + storage | 2656-2750 | 5 |

### Shared Dependencies (top of file)
- prisma client import
- zodErr, asyncHandler helpers (defined in file)
- dateRange helper (defined in file)
- getSundayWeekRange, calculateCommission, resolveBundleRequirement imports
- Various Zod schemas inline

### Integration Points
- Socket.IO `io` instance passed to some handlers (sales, chargebacks, pending terms)
- All routes mounted on a single Express Router exported as default

</code_context>

<specifics>
## Specific Ideas

No specific requirements — full Claude discretion on the split approach.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 21-route-file-splitting*
*Context gathered: 2026-03-24*
