# Codebase Concerns

**Analysis Date:** 2026-03-14

## Tech Debt

**Comprehensive Integration Test Suite Missing:**
- Issue: All integration tests in `__tests__/integration.test.js` are placeholder stubs with TODO comments. No actual test implementations exist for critical API endpoints.
- Files: `__tests__/integration.test.js` (127 lines, all tests are empty)
- Impact: Cannot validate API behavior changes during development. Risk of breaking changes going undetected. External API integration failures (Convoso, Vapi) cannot be verified before production.
- Fix approach: Implement full integration test suite using supertest, mock Convoso and Vapi APIs with nock or jest.mock(), add tests for all major flows: lead enqueueing, call initiation, slot management, rate limit handling, webhook processing. Target coverage for `index.js`, `voiceGateway.js`, and all `routes/index.ts` endpoints.

**Monolithic Route File:**
- Issue: All API routes consolidated in single 1,084-line file at `apps/ops-api/src/routes/index.ts`. Difficult to locate specific endpoints, increases merge conflict risk, violates separation of concerns.
- Files: `apps/ops-api/src/routes/index.ts`
- Impact: Code navigation and maintenance overhead. Adding new endpoints requires editing a massive file. Harder to enforce consistent patterns across route groups.
- Fix approach: Split into modular route files: `routes/auth.ts`, `routes/sales.ts`, `routes/payroll.ts`, `routes/agents.ts`, `routes/exports.ts`. Import and register in main Express app via `for (const router of [authRouter, salesRouter, ...]) app.use(router)`.

**Large Monolithic Dashboard Pages:**
- Issue: Dashboard UX files are single-file React components: `payroll-dashboard/app/page.tsx` (2,182 lines), `manager-dashboard/app/page.tsx` (1,921 lines), `owner-dashboard/app/page.tsx` (1,265 lines). Mixed logic, state management, and UI rendering in one file.
- Files: `apps/payroll-dashboard/app/page.tsx`, `apps/manager-dashboard/app/page.tsx`, `apps/owner-dashboard/app/page.tsx`, `apps/sales-board/app/page.tsx` (1,103 lines)
- Impact: Difficult to test individual features. Hard to reuse UI components. Hot reload development is sluggish. High risk of regressions when modifying one feature.
- Fix approach: Extract features into separate sub-components and separate files. Create `components/PayrollSummary.tsx`, `components/CommissionTable.tsx`, `components/AgentTracker.tsx`, etc. Move state management into custom hooks (`usePayrollData`, `useAgentMetrics`). Keep main page as orchestrator only.

**Debug Code Left in Production:**
- Issue: Extensive debug logging prefixed with "[DEBUG]" and "[DEBUG RAW]" left in production code at `index.js` lines 555, 565, 572, 582, 597, 607, 620.
- Files: `index.js` (lines 555-627, debugFetchMQLeads() and debugFetchMQRaw() functions)
- Impact: Pollutes logs with unnecessary debug output. Makes it harder to spot actual errors. May impact performance in high-volume scenarios.
- Fix approach: Remove debug functions `debugFetchMQLeads()` and `debugFetchMQRaw()`. If debugging MQ issues, use proper structured logging with log levels instead. Ensure LOG_LEVEL environment variable is set to "warn" or "info" in production.

**No Input Validation on Bulk Financial Operations:**
- Issue: Payroll mark-paid endpoint `POST /payroll/mark-paid` accepts unbounded array of entry IDs without validation limits. No size checks, no authorization verification that user can modify those specific entries.
- Files: `apps/ops-api/src/routes/index.ts` (lines 453-480)
- Impact: Could mark thousands of unrelated payroll entries as paid in single request. No audit trail per entry, bulk operation logged once. Risk of accidental or malicious mass payroll updates.
- Fix approach: Add validation: `z.array(z.string()).max(100)` to limit batch size. Add per-entry authorization check before bulk update. Verify each entry belongs to accessible period/agent. Log individual entry changes, not aggregate. Consider requiring multi-step confirmation UI for large batches.

**Missing Access Control Verification for Entry Modifications:**
- Issue: Payroll entry patch endpoint at `apps/ops-api/src/routes/index.ts` (lines 544-565) modifies bonusAmount, frontedAmount, holdAmount without verifying the entry belongs to data the user is authorized to access. SUPER_ADMIN check passes all users, but regular PAYROLL users could modify entries from any agent/period.
- Files: `apps/ops-api/src/routes/index.ts` (lines 544-565)
- Impact: PAYROLL-role users could modify compensation for agents outside their scope. Financial records could be altered without proper authorization chain.
- Fix approach: Before update, verify entry's payroll period matches user's allowed scope. Query entry with period info: `include: { payrollPeriod: true }`. Enforce: `if (!authorizedPeriods.includes(entry.payrollPeriod.id)) return 403`. Log which user modified which entries and with what values.

---

## Known Bugs

**Clawback Net Amount Calculation Inconsistency:**
- Symptoms: When applying clawback to already-paid entry, line 536 applies adjustment: `adjustmentAmount: Number(lastEntry.adjustmentAmount) - Number(lastEntry.netAmount)`. If entry has existing adjustment (e.g., from bonus already applied), calculation becomes: `oldAdj - netAmount`, not `oldAdj - clawbackAmount`. This can result in incorrect net amount.
- Files: `apps/ops-api/src/routes/index.ts` (line 536)
- Trigger: Create sale → apply bonus → mark paid → apply clawback. Entry's netAmount will be incorrect.
- Workaround: Manually recalculate via Prisma or database directly. Current code doesn't expose adjustment recalculation endpoint.
- Fix approach: When clawback applied to PAID entry, recalculate net as: `payout + (adjustment - clawback) + bonus - fronted - hold`. Verify against payroll-dashboard display to ensure user sees correct values.

**Morgan Queue Cleanup Only on Explicit Hydration:**
- Symptoms: `morganQueuedIdsTimestamps` map is only cleared on explicit call to `hydrateMorganQueueFromConvoso()` (line 497). If that job is skipped (outside business hours, Morgan disabled), timestamps accumulate forever. After 10,000 IDs, `MAX_QUEUED_IDS` check prevents additions but doesn't remove old entries.
- Files: `index.js` (lines 47, 497)
- Trigger: Disable Morgan for a day or run outside business hours. Queue timestamps continue growing.
- Workaround: Restart service to reset in-memory state.
- Fix approach: Add TTL-based cleanup: Every hour, remove entries older than 24 hours from `morganQueuedIdsTimestamps`. Implement with periodic job: `setInterval(() => { const now = Date.now(); for (const [id, ts] of morganQueuedIdsTimestamps) { if (now - ts > 86400000) morganQueuedIdsTimestamps.delete(id); } }, 3600000)`.

---

## Security Considerations

**JWT Token Exposed in URL Query Parameters:**
- Risk: Token passed via `session_token` URL param and stored in localStorage. If browser history is accessed or URL logged by proxy/CDN, JWT is exposed.
- Files: `packages/auth/src/client.ts` (lines 11-24, captureTokenFromUrl)
- Current mitigation: Token is removed from URL via `history.replaceState()` after capture. 12-hour token expiry limits exposure window.
- Recommendations: Use POST-based auth redirect (form submission with hidden field) instead of URL params. Implement token binding to prevent replay if token is captured. Add Content-Security-Policy headers to block localStorage access from inline scripts.

**SUPER_ADMIN Role Bypasses All Checks:**
- Risk: SUPER_ADMIN users can access any endpoint without role-based restrictions. If SUPER_ADMIN account is compromised, attacker has full access.
- Files: `apps/ops-api/src/middleware/auth.ts` (line 29)
- Current mitigation: SUPER_ADMIN role is intentional per CLAUDE.md. Assumption is that SUPER_ADMIN accounts are tightly controlled.
- Recommendations: Add additional audit logging for all SUPER_ADMIN actions. Implement rate limiting on sensitive endpoints even for SUPER_ADMIN. Consider requiring 2FA for SUPER_ADMIN login. Regularly rotate SUPER_ADMIN credentials and audit access logs.

**No Rate Limiting on Auth Endpoints:**
- Risk: Login endpoint `POST /auth/login` accepts unlimited password attempts. No rate limiting, IP blocking, or account lockout after N failures.
- Files: `apps/ops-api/src/routes/index.ts` (lines 54-66)
- Current mitigation: Bcrypt compare slows down each attempt, but doesn't prevent brute force at scale.
- Recommendations: Add rate limiting middleware (redis-based) to auth endpoints: max 5 login attempts per IP per 15 minutes. Implement account lockout after 3 failed attempts within 1 hour. Log suspicious login patterns and alert admins.

**Clawback Search by Member Name Only:**
- Risk: Clawback creation searches sales by member name without fuzzy matching or pagination. Multiple matching results could be confused. Line 515 takes first match only.
- Files: `apps/ops-api/src/routes/index.ts` (lines 511-541)
- Current mitigation: Prefer memberId over name in request body. If memberId not provided, use name.
- Recommendations: Require both memberId and name for verification if both available. Return list of matching sales and require explicit selection instead of auto-selecting first. Add audit note showing which sale was matched.

**No Webhook Signature Validation:**
- Risk: Convoso and Vapi webhooks at `index.js` have no signature verification. Any caller can invoke webhook endpoints and trigger state changes.
- Files: `index.js` (webhook handlers for Convoso and Vapi endpoints)
- Current mitigation: Endpoints are internal-only in typical deployment, but no code-level protection.
- Recommendations: Implement HMAC-SHA256 signature validation for all incoming webhooks. Store webhook secrets in environment variables. Verify signature before processing payload.

---

## Performance Bottlenecks

**Synchronous Convoso API Pagination:**
- Problem: `convosoSearchAllPages()` loads ALL pages synchronously in a loop without concurrency control. If Convoso has 100+ pages of leads, request blocks event loop.
- Files: `index.js` (lines 403-445, convosoSearchAllPages function)
- Cause: Sequential await in for loop fetching each page.
- Improvement path: Implement concurrent pagination with Promise.all() for up to 5 parallel requests. Add exponential backoff if 429 returned. Cache results for 5 minutes to avoid re-fetching same data.

**Unbounded In-Memory Queue:**
- Problem: `morganQueue` array has no size limit. If lead enqueuing outpaces calling, array grows indefinitely, consuming memory.
- Files: `index.js` (lines 40, 666, 1240)
- Cause: Only limit is `MAX_QUEUED_IDS = 10000`, but array can still grow beyond available memory if many leads queued before IDs cleaned.
- Improvement path: Set hard queue size limit: if `morganQueue.length > 5000`, stop accepting new leads and log warning. Implement FIFO with circular buffer or consider external queue (Redis) if more persistence needed.

**Full Payroll Period Hydration on Every Request:**
- Problem: `GET /payroll/periods` returns ALL payroll periods with full nested includes (all entries, all sales, all addons) every time. No pagination, no filtering by date range.
- Files: `apps/ops-api/src/routes/index.ts` (lines 434-451)
- Cause: Dashboard loads full history without limit.
- Improvement path: Add `?limit=10&offset=0` pagination params. Default to last 3 periods (6-9 weeks). Add `?from=2024-01-01&to=2024-03-01` date range filtering. Implement cursor-based pagination for large result sets.

**Vapi Rate Limit Backoff is Global, Not Per-Number:**
- Problem: Single `VAPI_429_BACKOFF_MS` timestamp blocks ALL phone numbers when ANY number hits 429. If one number rate-limited, other 2 free numbers still sit idle.
- Files: `index.js` (lines 44, 268-280, rateLimitState.js)
- Cause: Backoff state is shared across all slots.
- Improvement path: Track backoff per phone number ID: `const vapiBackoffUntil = new Map<phoneNumberId, timestamp>()`. Only skip calls for rate-limited number, allow other numbers to proceed.

---

## Fragile Areas

**Morgan Queue Tick Processing Without Transactional Consistency:**
- Files: `index.js` (lines 122-210, morganQueueProcessTick)
- Why fragile: If call launch via Vapi succeeds but subsequent Convoso status update fails, slot is marked busy but lead status never updated. Next tick sees slot busy but has no way to recover lead.
- Safe modification: Wrap Vapi + Convoso status update in try-catch. If Convoso fails, mark slot free and re-queue lead. Better: use database transaction if Vapi API key is stored in DB, query within transaction for atomicity.
- Test coverage: No tests for failure scenarios. Need: test Vapi 200 + Convoso 500, test Vapi timeout + recovery, test slot stuck busy.

**Payroll Calculation Logic Has State Dependency:**
- Files: `apps/ops-api/src/services/payroll.ts` (lines 87-126, calculateCommission)
- Why fragile: Commission calculation depends on addon products array. If addon deleted from DB after sale created but before commission calculated, calculation silently ignores missing addon. No validation that all referenced products still exist.
- Safe modification: Before calculating, verify all referenced product IDs exist. Throw error if product deleted. Add database constraint: foreign key on sale.productId and saleAddon.productId with ON DELETE RESTRICT.
- Test coverage: No tests for commission calculation with various addon combinations. Need: test core + addon + AD&D, test missing addon handling, test FL exemption, test enrollment fee edge cases ($99, $125, <$50).

**Clawback Status Transitions Not Validated:**
- Files: `apps/ops-api/src/routes/index.ts` (lines 520-541)
- Why fragile: Clawback can be created from any entry status. If entry is ZEROED_OUT, clawback creation doesn't check state. Multiple clawbacks could be created for same sale, each reducing net amount.
- Safe modification: Validate entry status before creating clawback. Only allow clawbacks on PAID or READY entries. Query existing clawbacks for same sale and reject if active clawback exists.
- Test coverage: No tests for clawback scenarios. Need: test clawback on PAID entry, test clawback on already-clawed-back entry (should fail), test ZEROED_OUT entry handling.

**Auth Token Refresh Can Fail Silently:**
- Files: `packages/auth/src/client.ts` (lines 72-92, ensureTokenFresh)
- Why fragile: If refresh endpoint returns non-OK status, token is cleared. Subsequent request without token fails with 401. User is logged out with no explanation.
- Safe modification: On refresh failure, emit event or throw error visible to UI. Dashboard should show "Session expired, please log in again" instead of generic 401.
- Test coverage: No tests for refresh failure. Need: test 401 on refresh, test network timeout on refresh, test expired token detection.

---

## Scaling Limits

**In-Memory Morgan State Not Persistent:**
- Current capacity: Queue holds ~10,000 lead IDs in memory. Slots managed as 3 phone numbers.
- Limit: Restart required to reset queue. No state survives process termination. If service scales to multiple replicas, each has independent queue and slot state.
- Scaling path: Move to Redis or database-backed queue. Store morganQueue, morganQueuedIds, morganSlots in Redis with TTL. Multiple service replicas can share queue and coordinate slot allocation via Redis.

**Dashboard Full-History Fetch:**
- Current capacity: Payroll endpoint returns all periods unfiltered. With 52 weeks/year * years, this is 100s of entries * 10+ fields each.
- Limit: Payload size grows with time. Loading entire history on dashboard load becomes slow (seconds+).
- Scaling path: Implement pagination (done above). Add archiving: auto-archive periods older than 1 year to separate table. Query recent periods by default, fetch archive only if user navigates to old dates.

**Audit Log Unbounded Growth:**
- Current capacity: `app_audit_log` table records every action. No retention policy or archival.
- Limit: After 1-2 years, queries on audit table slow down (millions of rows).
- Scaling path: Implement time-based partitioning on audit table by week or month. Archive old partitions to separate schema. Query recent audits by default. Allow admin export of old audit logs to cold storage (S3, GCS).

---

## Dependencies at Risk

**No Version Lock Strategy on Minor/Patch Updates:**
- Risk: `package.json` uses ^ for semver (e.g., `^1.0.0`), allowing minor/patch updates. If dependency introduces breaking change in patch version (rare but possible), builds break unexpectedly.
- Impact: CI/CD can fail without code changes. Production deployments may fail if dependency published.
- Migration plan: Switch critical dependencies to exact versions (1.0.0 instead of ^1.0.0) for Zod, Prisma, bcryptjs. Use lockfile (npm ci instead of npm install) in CI/production. Regular dependency audits (npm audit, Snyk) to catch known vulnerabilities.

**Prisma Client Generated Code Not Committed:**
- Risk: `node_modules/.prisma/client` is generated from schema. If generation fails or diverges between environments, queries break silently.
- Impact: Different developers/CI might have different generated client code. Schema changes require regenerating client before tests pass.
- Migration plan: Commit `.prisma/client` to git. Run `prisma generate` as part of CI. Verify generated code matches schema before deployment.

---

## Missing Critical Features

**No Multi-Tenant Isolation:**
- Problem: System assumes single company. No tenant/organization concept. If expanding to multiple clients, current schema/auth won't support data isolation.
- Blocks: SaaS multi-customer deployment, franchising model, white-label expansion.
- Implementation approach: Add `tenantId` column to all core tables (User, Agent, Sale, Payroll*). Add `tenantId` check in all queries and auth middleware. Enforce tenant isolation at middleware level before route handlers execute.

**No Webhook Retry Logic:**
- Problem: If Vapi webhook delivery fails (network error, 500 response), call completion is lost. Slot never freed, call status never recorded.
- Blocks: Reliable end-of-call processing. Can't guarantee slot recovery if webhook flaky.
- Implementation approach: Implement webhook queue in database or Redis. When endpoint returns non-200, enqueue for retry. Background job retries with exponential backoff (5m, 15m, 1h, 1day). Alert if webhook fails 3 times.

**No Call Recording Cleanup:**
- Problem: `recordingUrl` stored in Sale but no mechanism to delete recordings from Vapi when sale deleted or after retention period.
- Blocks: Compliance with data retention policies. Recording storage costs accumulate indefinitely.
- Implementation approach: Add `recordingDeletedAt` field. On sale delete, call Vapi delete endpoint. Add retention policy: auto-delete recordings older than 90 days via background job.

---

## Test Coverage Gaps

**No Tests for Commission Calculation Edge Cases:**
- What's not tested: Core + addon bundling, FL exemption, enrollment fee halving, missing addons, negative enrollment fees.
- Files: `apps/ops-api/src/services/payroll.ts`
- Risk: Commission calculations can drift without detection. Financial calculations are high-risk for bugs.
- Priority: **High** - commission directly impacts payroll. Errors propagate to payments.

**No Tests for Queue Processing Failure Scenarios:**
- What's not tested: Vapi 429 backoff, call launch timeout, Convoso update failure, slot stuck busy, concurrent queue ticks.
- Files: `index.js` (morganQueueProcessTick, slot management)
- Risk: Queue deadlock or lost leads undetected in production.
- Priority: **High** - core revenue-generating system.

**No Tests for Clawback State Transitions:**
- What's not tested: Multiple clawbacks per sale, clawback on ZEROED_OUT entry, clawback net amount calculation, clawback status to PAID transition.
- Files: `apps/ops-api/src/routes/index.ts`
- Risk: Payroll disputes from incorrect clawback amounts.
- Priority: **High** - financial reconciliation depends on this.

**No Tests for Auth Token Refresh and Expiry:**
- What's not tested: Token expiry detection, refresh success/failure, concurrent refresh requests, refresh endpoint 401 handling.
- Files: `packages/auth/src/client.ts`
- Risk: Silent logout on refresh failure leaves users confused. Concurrent refreshes could create race conditions.
- Priority: **Medium** - impacts user experience but not data integrity.

**No Tests for Dashboard Component State:**
- What's not tested: Filter/sort interactions, pagination, error recovery, loading states, null/undefined handling.
- Files: `apps/payroll-dashboard/app/page.tsx`, `apps/manager-dashboard/app/page.tsx`, `apps/owner-dashboard/app/page.tsx`
- Risk: UI bugs, crashes on edge cases undetected until user reports.
- Priority: **Medium** - affects user experience.

---

*Concerns audit: 2026-03-14*
