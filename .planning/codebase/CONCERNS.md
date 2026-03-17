# Codebase Concerns

**Analysis Date:** 2026-03-17

## Tech Debt

**Monolithic routes file:**
- Issue: All ~1,907 lines of API logic live in a single file with no sub-routing
- Files: `apps/ops-api/src/routes/index.ts`
- Impact: Cognitive load is high; PRs always touch the same file causing merge conflicts; impossible to unit-test routes in isolation
- Fix approach: Split by domain (auth, sales, payroll, clawbacks, callAudit, convoso, settings) into `apps/ops-api/src/routes/` subdirectory files, each exporting a `Router`

**Monolithic frontend pages:**
- Issue: `payroll-dashboard` page.tsx (2,770 lines) and `manager-dashboard` page.tsx (2,666 lines) contain all UI, state, handlers, and fetch logic in a single Client Component
- Files: `apps/payroll-dashboard/app/page.tsx`, `apps/manager-dashboard/app/page.tsx`
- Impact: No component reuse, re-renders entire page on any state change, very hard to test or modify safely
- Fix approach: Extract sections into sub-components under `app/components/`; pull fetch logic into custom hooks

**Committed backup file:**
- Issue: `page.backup.tsx` is committed to the repository and tracked in git
- Files: `apps/sales-board/app/page.backup.tsx` (1,234 lines)
- Impact: Confuses tooling and developers; misleads code search
- Fix approach: Delete file and commit removal; use git history for recovery if needed

**`Sale.payrollStatus` and `Sale.clawbackStatus` denormalization never updated:**
- Issue: The `Sale` model has `payrollStatus` and `clawbackStatus` fields that are set to defaults on creation but never updated by any route or service
- Files: `prisma/schema.prisma` (lines 157-158), `apps/ops-api/src/routes/index.ts`
- Impact: These fields always reflect their default values (PENDING / OPEN) regardless of actual state, making them unreliable for any UI or query that reads them
- Fix approach: Either remove the denormalized fields and derive status from `PayrollEntry`/`Clawback` relations, or add update calls wherever `PayrollEntry.status` and `Clawback.status` are mutated

**Week boundary inconsistency between payroll and sales board:**
- Issue: `upsertPayrollEntryForSale` uses Sunday-to-Saturday weeks (via `getSundayWeekRange` in `payroll.ts`), while `sales-board/detailed` uses Monday-to-Sunday ISO weeks
- Files: `apps/ops-api/src/services/payroll.ts` (lines 7-30), `apps/ops-api/src/routes/index.ts` (lines 1213-1219)
- Impact: Sales appearing on Monday appear in the previous payroll week but the current sales-board week, creating a reporting discrepancy visible to agents on Mondays
- Fix approach: Standardize sales board to use the same Sunday-week logic as payroll, or document the intentional difference prominently

**`month` range is rolling 30 days, not a calendar month:**
- Issue: The `dateRange` helper returns "last 30 days" for `range=month`, not the current calendar month
- Files: `apps/ops-api/src/routes/index.ts` (lines 49-54)
- Impact: Dashboard date ranges are inconsistent with `/reporting/periods` monthly view which uses calendar months; confuses users comparing the two
- Fix approach: Define "month" as the current calendar month (first day to today + 1), or rename the parameter value to `last30` and add a true `month` option

**Pervasive `any` typing in routes:**
- Issue: 33 occurrences of `: any` or `as any` in `routes/index.ts` alone, including `updateData: any`, `(req.user as any)?.roles`, and `(parsed.data as any)[f]`
- Files: `apps/ops-api/src/routes/index.ts`
- Impact: Type errors in business logic are hidden at compile time; refactors can silently break data contracts
- Fix approach: Create typed interfaces for update payloads (e.g., `SaleUpdateData`), use the Prisma-generated input types directly

**Duplicate `extractConvosoResults` function:**
- Issue: The helper function is defined identically in two places
- Files: `apps/ops-api/src/routes/index.ts` (line 1799), `apps/ops-api/src/workers/convosoKpiPoller.ts` (line 20)
- Impact: Bug fixes must be applied twice; functions can drift
- Fix approach: Export from `apps/ops-api/src/services/convosoCallLogs.ts` and import in both locations

**Bonus category breakdown logic duplicated:**
- Issue: The breakdown calculation (split amounts by deduction category) appears in both `POST /payroll/service-entries` and `PATCH /payroll/service-entries/:id`
- Files: `apps/ops-api/src/routes/index.ts` (lines 1054-1065 and 1096-1107)
- Impact: Logic must be kept in sync; currently identical but divergence risk is high
- Fix approach: Extract to a `calculateServicePay(breakdown, basePay, fronted, cats)` helper function

## Security Considerations

**No rate limiting on authentication endpoints:**
- Risk: `POST /api/auth/login` and `POST /api/auth/change-password` have no brute-force protection
- Files: `apps/ops-api/src/routes/index.ts` (lines 57-88), `apps/ops-api/src/index.ts`
- Current mitigation: None
- Recommendations: Add `express-rate-limit` with a low limit (e.g., 10 req/15min per IP) on `/api/auth/login` and `/api/auth/change-password`

**No HTTP security headers:**
- Risk: No `helmet` middleware is applied; responses lack `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`
- Files: `apps/ops-api/src/index.ts`
- Current mitigation: None
- Recommendations: Add `helmet()` as the first middleware before CORS

**Webhook secret transmitted in query param:**
- Risk: `requireWebhookSecret` accepts the secret via `req.query.api_key` (in addition to header), which logs to web server access logs and browser history
- Files: `apps/ops-api/src/routes/index.ts` (lines 1295-1300)
- Current mitigation: Header-based secret also supported
- Recommendations: Remove the `api_key` query param fallback; require header-only delivery

**`SUPER_ADMIN` role bypass is implicit and undocumented per endpoint:**
- Risk: `requireRole` silently passes all `SUPER_ADMIN` users through every role check. If a `SUPER_ADMIN` token is compromised, every protected endpoint is exposed
- Files: `apps/ops-api/src/middleware/auth.ts` (line 29)
- Current mitigation: Intentional per CLAUDE.md; auth token expiry is 12h
- Recommendations: Add audit logging for all `SUPER_ADMIN` actions that bypass role-specific checks; consider issuing scoped tokens for automated tasks

**Unvalidated `agentId` query param in call-audits endpoint:**
- Risk: `req.query.agentId` is passed directly into a Prisma `where` clause without type validation
- Files: `apps/ops-api/src/routes/index.ts` (line 1400)
- Current mitigation: Prisma parameterization prevents SQL injection; authenticated endpoint
- Recommendations: Validate with Zod (`z.string().cuid().optional()`) to prevent unexpected behavior from malformed input

**`JSON.parse` on unchecked database string values:**
- Risk: `salesBoardSetting.value` is parsed with `JSON.parse` without try/catch in two places
- Files: `apps/ops-api/src/routes/index.ts` (lines 1008, 1056, 1098)
- Current mitigation: Data is only written through validated API endpoints
- Recommendations: Wrap `JSON.parse` in try/catch with a fallback to `DEFAULT_BONUS_CATEGORIES` to prevent 500 errors from corrupted settings records

**`z.parse` (throws) used on unauthenticated input in three routes:**
- Risk: `z.object({...}).parse(req.body)` at lines 855, 884, and 910 throws a `ZodError` rather than returning a 400. This is caught by `asyncHandler` and forwarded to the global error handler which returns a 500 with "Internal server error" instead of a 400 with validation details
- Files: `apps/ops-api/src/routes/index.ts` (lines 855, 884, 910)
- Current mitigation: Only affects `PAYROLL` and `SUPER_ADMIN` roles
- Recommendations: Replace `.parse()` with `.safeParse()` and return `zodErr(parsed.error)` with a 400 status, consistent with every other route

## Performance Bottlenecks

**`GET /payroll/periods` loads all periods with all entries:**
- Problem: Single query fetches every payroll period with all entries (each including sale details, product, addons, agent) with no pagination, no time limit
- Files: `apps/ops-api/src/routes/index.ts` (lines 832-849)
- Cause: No `take` or `where` filter; as data grows, this becomes a multi-MB response
- Improvement path: Add a `take: 12` or date-based filter; paginate from the frontend; or fetch period metadata separately from entries

**`GET /call-counts` and `GET /tracker/summary` load all call logs into memory:**
- Problem: Both routes fetch all `convosoCallLog` records matching the date range into Node.js memory, then aggregate in JavaScript
- Files: `apps/ops-api/src/routes/index.ts` (lines 783-830, 1464-1498)
- Cause: Per-lead-source buffer filtering requires row-level logic; Prisma `groupBy` cannot express conditional counting
- Improvement path: Pre-filter buffer-compliant calls at write time (set a `bufferPassed` boolean on the call log); then groupBy can work in the database

**In-memory audit job queue lost on process restart:**
- Problem: The `pendingJobs` array and `activeJobs` set in `auditQueue.ts` exist only in process memory; any server restart drops all queued audio audit jobs silently
- Files: `apps/ops-api/src/services/auditQueue.ts` (lines 8-9)
- Cause: No persistence layer for the queue
- Improvement path: Persist queue state to the database (`convosoCallLog.auditStatus = 'queued'`) and re-hydrate on server boot; or migrate to BullMQ with Redis

**`GET /sales-board/detailed` iterates all week's sales in JS:**
- Problem: All RAN sales for the current week are fetched and aggregated per-day per-agent in JavaScript loops
- Files: `apps/ops-api/src/routes/index.ts` (lines 1227-1291)
- Cause: Dynamic day labeling requires client-side grouping
- Improvement path: Move grouping to a `groupBy` with `_sum` aggregation; compute day labels from aggregated date values

## Fragile Areas

**Clawback logic uses `payrollEntries[0]` without ordering:**
- Files: `apps/ops-api/src/routes/index.ts` (lines 911-936)
- Why fragile: `prisma.sale.findFirst({ include: { payrollEntries: true } })` returns entries in default insertion order. A sale with multiple payroll entries (e.g., after a period reassignment) will have the wrong entry targeted — the clawback operates on the first inserted entry, not the most recent
- Safe modification: Add `orderBy: { createdAt: 'desc' }` to the `payrollEntries` include
- Test coverage: No test covers multi-entry clawback scenarios

**`handleSaleEditApproval` has ambiguous "same period finalized" branch:**
- Files: `apps/ops-api/src/services/payroll.ts` (lines 290-300)
- Why fragile: When a sale's edit lands in the same finalized period, the code comments "upsertPayrollEntryForSale already created new entry in correct period" but the new period is determined by the (possibly unchanged) `paymentType` and `saleDate`, meaning the "new entry in correct period" may be the same finalized period. The clawback is applied and a new entry overwrites the same finalized period entry
- Safe modification: Check if the upserted entry lands in the original finalized period before deciding the adjustment strategy
- Test coverage: Partially covered in `status-commission.test.ts` but the same-period finalized case is not tested

**Convoso KPI poller `agentMap` built from email only:**
- Files: `apps/ops-api/src/workers/convosoKpiPoller.ts` (lines 174-177)
- Why fragile: Agents without an email address are silently excluded from KPI attribution; the filter `agents.filter(a => a.email)` discards them without logging. Any Convoso call attributed to a non-email agent will never link to an internal agent
- Safe modification: Log excluded agents; alert when an unmatched `agent_user` appears repeatedly

**Sales board weekly/daily boundaries use server local time:**
- Files: `apps/ops-api/src/routes/index.ts` (lines 1197-1199, 1214-1224)
- Why fragile: `new Date(Date.now() - 86400000)` and `new Date(now.getFullYear(), ...)` use server local time, while `payroll.ts` explicitly converts to Eastern (`America/New_York`) via Luxon. If the server runs in UTC (Railway/Docker), the daily/weekly cutoffs for the sales board will differ from the payroll week boundaries by the Eastern UTC offset (4-5 hours)
- Safe modification: Use Luxon's `DateTime.now().setZone('America/New_York')` for all boundary calculations

## Scaling Limits

**`AgentCallKpi` table grows unbounded:**
- Current capacity: One row per agent per lead source per poll cycle (every 10 minutes)
- Limit: With 10 agents and 5 lead sources, this adds ~300 rows/hour / ~7,200/day; no cleanup or archival logic exists for this table
- Scaling path: Add a retention policy (e.g., delete records older than 90 days) in the poller's cleanup step alongside `processedConvosoCall` cleanup

**Socket.IO has no authentication on connection:**
- Current capacity: Any browser on an allowed CORS origin can open a persistent WebSocket connection to ops-api
- Limit: With no auth handshake, connections accumulate from unauthenticated clients; no per-connection rate limiting
- Scaling path: Add a `socket.io` auth middleware that validates the JWT on the `connection` event

## Dependencies at Risk

**`bcryptjs` instead of `bcrypt`:**
- Risk: `bcryptjs` is a pure-JavaScript implementation of bcrypt; it is significantly slower than the native `bcrypt` package (which uses C++ bindings). Under load, password hashing/comparison on every login adds latency
- Impact: Login endpoint latency; under high auth load, Node.js event loop is blocked during hash comparison
- Migration plan: Replace with `bcrypt` (native) or `argon2` for both better performance and stronger key derivation

## Missing Critical Features

**No refresh of `isBundleQualifier` status on product edit:**
- Problem: When `PATCH /products/:id` changes `isBundleQualifier` on an existing product, no commission recalculation is triggered on historical sales that used that product
- Blocks: Commission accuracy after product configuration changes
- Files: `apps/ops-api/src/routes/index.ts` (lines 252-274)

**No input sanitization on `notes` and `managerSummary` free-text fields:**
- Problem: Arbitrary text is stored and rendered in dashboards with no HTML sanitization
- Blocks: Any future move to HTML rendering in dashboards; current risk is low since all dashboards use React (which escapes by default)
- Files: Multiple `notes` and `coachingNotes` fields across sale, audit, and payroll routes

## Test Coverage Gaps

**No integration or E2E tests for any API routes:**
- What's not tested: Authentication, RBAC enforcement, sale creation, payroll period state machine, clawback creation, webhook ingestion
- Files: `apps/ops-api/src/routes/index.ts` (1,907 lines of untested route handlers)
- Risk: Any refactor of routes or middleware can break live behavior without any automated signal
- Priority: High

**No tests for frontend dashboards:**
- What's not tested: All `.tsx` pages — `payroll-dashboard`, `manager-dashboard`, `owner-dashboard`, `sales-board`, `auth-portal`
- Files: `apps/payroll-dashboard/app/page.tsx`, `apps/manager-dashboard/app/page.tsx`, `apps/owner-dashboard/app/page.tsx`
- Risk: UI regressions are caught only manually
- Priority: Medium

**`callAudit.ts` service has no tests:**
- What's not tested: Whisper transcription, Claude audit call, OpenAI scoring, DB persistence flow, `reAuditCall` function
- Files: `apps/ops-api/src/services/callAudit.ts` (368 lines)
- Risk: Changes to AI prompts or model parameters can silently break audit output structure
- Priority: High

**Clawback creation flow is not tested:**
- What's not tested: `POST /clawbacks` with `memberId`, `memberName`, multi-entry scenarios, `PAID` vs non-paid status branching
- Files: `apps/ops-api/src/routes/index.ts` (lines 909-938)
- Risk: Incorrect entry targeting (see `payrollEntries[0]` concern above) could silently corrupt payroll data
- Priority: High

---

*Concerns audit: 2026-03-17*
