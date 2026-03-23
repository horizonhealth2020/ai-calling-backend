# Codebase Concerns

**Analysis Date:** 2026-03-23

---

## Tech Debt

**Monolithic routes file:**
- Issue: All 2,591 lines of API route handlers live in a single flat file.
- Files: `apps/ops-api/src/routes/index.ts`
- Impact: Any change requires scrolling/searching a 2,500+ line file. Merge conflicts are frequent when multiple features land simultaneously. Cognitive overhead for new contributors.
- Fix approach: Split by domain — `routes/auth.ts`, `routes/sales.ts`, `routes/payroll.ts`, `routes/cs.ts`, `routes/callLogs.ts`, `routes/settings.ts`.

**Legacy Morgan service is plain JS with no types:**
- Issue: `index.js` (1,612 lines) is CommonJS with zero TypeScript. Business logic lives alongside webhook handlers and debug endpoints in one file.
- Files: `index.js`, `voiceGateway.js`, `morganToggle.js`, `rateLimitState.js`
- Impact: No compile-time safety. Runtime errors are the only feedback. Slot management state (`morganSlots`, `morganCallToSlot`) is in-memory and lost on restart.
- Fix approach: Migrate to TypeScript; extract slot management into a stateful class or Redis-backed store.

**`as any` type escapes throughout routes:**
- Issue: 108 uses of `any` type exist in `apps/ops-api/src/routes/index.ts`, with 14 explicit `as any` casts, including on `req.user` after `requireAuth` has already typed it.
- Files: `apps/ops-api/src/routes/index.ts` lines 103, 129, 473, 569, 606, 664, 1669, 1779, 2113, 2390, 2423, 2429
- Impact: Type errors pass silently; `(req as any).user` bypasses the already-correct `req.user` typing set up in `middleware/auth.ts`.
- Fix approach: Remove `as any` from `req.user` accesses (already typed via Express namespace augmentation). Use typed Prisma enums instead of `status as any` on lines 1669 and 1779.

**Unbounded `findMany()` on products and permission overrides:**
- Issue: Two queries have no `where`, `take`, or `select` constraints.
- Files: `apps/ops-api/src/routes/index.ts` lines 263, 2503
- Impact: As the product catalog and permission override tables grow, these endpoints will return progressively larger payloads with no ceiling.
- Fix approach: Add `orderBy` and `take` caps; add `select` to limit returned fields.

**`payroll/periods` loads all periods with all nested data — no pagination:**
- Issue: `GET /payroll/periods` fetches every PayrollPeriod with full nested entries (sales, addons, agents, service entries) with no date filter or `take` limit.
- Files: `apps/ops-api/src/routes/index.ts` lines 869–886
- Impact: As payroll history grows, this endpoint will return megabytes of nested JSON on each load, degrading the payroll dashboard.
- Fix approach: Add a `year` or `months` query param filter; default to showing only the last 12 periods.

**N+1 query pattern in `getRepChecklist`:**
- Issue: `getRepChecklist` fetches all active reps, then issues 2 separate `prisma.findMany` queries per rep inside `Promise.all` — 2N+1 total queries.
- Files: `apps/ops-api/src/services/repSync.ts` lines 112–141
- Impact: Slow on CS dashboard load as rep count grows; 10 reps = 21 queries; 20 reps = 41 queries.
- Fix approach: Fetch all chargebacks and pending terms in two bulk queries, then group by `assignedTo` in memory.

**`dateRange` has two overlapping interpretations of "month":**
- Issue: Both `range === "month"` and `range === "30d"` compute rolling 30-day windows with identical logic. The named `month` case is redundant.
- Files: `apps/ops-api/src/routes/index.ts` lines 83–90
- Impact: Confusion when the owner dashboard intends "calendar month" but gets a rolling window. Minor but misleading naming.
- Fix approach: Rename `month` to `30d` (or add true calendar-month logic starting on the 1st).

**AI model name hardcoded as string literal:**
- Issue: `"claude-sonnet-4-20250514"` is hardcoded in two places with no env var override.
- Files: `apps/ops-api/src/services/callAudit.ts` line 164, `apps/ops-api/src/services/auditQueue.ts` line 135
- Impact: Upgrading the model requires a code deploy rather than a config change.
- Fix approach: Extract to a constant or env var `ANTHROPIC_MODEL_ID` with a fallback.

**AI cost estimates are hardcoded with stale pricing:**
- Issue: Claude Sonnet cost is hardcoded as `$3/M input, $15/M output` in a comment/function. Actual pricing changes without any code signal.
- Files: `apps/ops-api/src/services/callAudit.ts` lines 252–260
- Impact: Cost tracking in `ai_usage_log` will silently drift from actual billing as model pricing changes.
- Fix approach: Pull cost rates from a settings table or env vars.

**`startAutoScorePolling` only called on manual trigger — not at boot:**
- Issue: `startAutoScorePolling()` is only called from the `POST /ai/auto-score` route handler. The `convosoKpiPoller` starts at boot, but the audit queue poller does not.
- Files: `apps/ops-api/src/routes/index.ts` line 2457, `apps/ops-api/src/index.ts` line 68
- Impact: If ops-api restarts while calls are in `queued` status, they will remain stuck until a human manually POSTs `/ai/auto-score`.
- Fix approach: Call `startAutoScorePolling()` at boot in `apps/ops-api/src/index.ts` alongside `startConvosoKpiPoller()`.

**`repSync.syncExistingReps` matches reps by name string — fragile deduplication:**
- Issue: Linking unlinked `CsRepRoster` entries to `ServiceAgent` records is done by lowercased name match. Any name discrepancy (typo, middle initial) silently skips linkage.
- Files: `apps/ops-api/src/services/repSync.ts` lines 54–76
- Impact: Reps appear duplicated in CS roster; payroll/CS data is disconnected.
- Fix approach: Add a stable foreign key (`serviceAgentId`) as the canonical link and remove name-based matching.

**Dashboard components are extremely large single files:**
- Issue: `PayrollPeriods.tsx` is 1,777 lines; `CSSubmissions.tsx` is 1,228 lines; `CSTracking.tsx` is 1,126 lines; `ManagerEntry.tsx` is 815 lines.
- Files: `apps/ops-dashboard/app/(dashboard)/payroll/PayrollPeriods.tsx`, `apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx`, `apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx`, `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx`
- Impact: Hard to review, test, or extend. State management is intermingled with rendering logic.
- Fix approach: Extract sections into smaller sub-components per domain concern (form, table, modal, etc.).

---

## Known Bugs

**`upsertPayrollEntryForSale` overwrites bonus/fronted/hold on update:**
- Symptoms: When a sale is edited and commission is recalculated, the `update` branch of the `payrollEntry.upsert` only sets `payoutAmount` and `netAmount`, discarding the existing `bonus`, `fronted`, and `hold` values that were already fetched from `existing`. The `create` branch correctly uses `payoutAmount` (not those values).
- Files: `apps/ops-api/src/services/payroll.ts` lines 252–263
- Trigger: Edit a sale that already has a bonus or fronted amount applied on its payroll entry.
- Workaround: Manually re-enter bonus/fronted after editing.

**`handleSaleEditApproval` may double-clawback in same-period edits:**
- Symptoms: Lines 311–323 mark the finalized entry as `CLAWBACK_APPLIED` in both the "different period" and "same period" branches. In the same-period case, `upsertPayrollEntryForSale` already updated the entry in place, so the subsequent clawback marks an already-updated entry.
- Files: `apps/ops-api/src/services/payroll.ts` lines 289–327
- Trigger: Approve a sale edit when the sale's payroll period is finalized, and the sale date/paymentType does not change periods.

**Round-robin reads roster BEFORE transaction — not fully atomic:**
- Symptoms: `getNextRoundRobinRep` fetches active reps outside the transaction, then uses that stale list inside. Under concurrent calls, two requests can assign the same rep.
- Files: `apps/ops-api/src/services/repSync.ts` lines 83–106
- Trigger: Two simultaneous chargeback batch submissions with auto-assign enabled.
- Workaround: None — requires moving the `csRepRoster.findMany` call inside the `prisma.$transaction` block.

---

## Security Considerations

**JWT has an insecure fallback secret:**
- Risk: `packages/auth/src/index.ts` line 11 falls back to `"dev-secret"` if `AUTH_JWT_SECRET` is missing. Any deployment without the env var set will silently accept and issue tokens signed with this predictable key.
- Files: `packages/auth/src/index.ts` line 11
- Current mitigation: `apps/ops-api/src/index.ts` validates `AUTH_JWT_SECRET` is present at startup and exits if missing — but the auth package itself will still use `"dev-secret"` if imported standalone.
- Recommendations: Remove the `"dev-secret"` fallback from `getSecret()`. Throw if the key is absent.

**JWT passed as URL query parameter:**
- Risk: Session tokens appear in `?session_token=<jwt>` on redirect from auth-portal to dashboards. Tokens are visible in browser history, server access logs, and referrer headers.
- Files: `apps/ops-dashboard/app/api/login/route.ts` line 50, `packages/auth/src/client.ts` lines 10–23
- Current mitigation: `captureTokenFromUrl()` removes the token from the URL immediately via `history.replaceState`. However the token has already been exposed.
- Recommendations: Use POST redirect pattern or set an httpOnly cookie at the auth-portal level and redirect without the token in the URL.

**Debug endpoints are unauthenticated and exposed in production:**
- Risk: `POST /debug/test-call`, `POST /debug/hydrate-mq`, `POST /debug/hydrate-mq-raw` in `index.js` have no authentication. Anyone with network access can trigger outbound AI calls or read raw Convoso lead data.
- Files: `index.js` lines 1051–1137
- Current mitigation: `isMorganEnabled()` check gates actual call execution, but lead data is still exposed through `/debug/hydrate-mq`.
- Recommendations: Add an `X-Debug-Secret` header check, or gate behind the `MORGAN_ENABLED` env only in non-production environments.

**Webhook secret accepted via query param (`api_key`):**
- Risk: `requireWebhookSecret` accepts the secret in `req.query.api_key` as an alternative to the `x-webhook-secret` header. Query params are logged by most infrastructure.
- Files: `apps/ops-api/src/routes/index.ts` line 1374
- Current mitigation: Secret value is validated, but it appears in access logs if passed via query string.
- Recommendations: Remove the `req.query.api_key` path; require the header only.

**JWT token stored in localStorage — XSS accessible:**
- Risk: Tokens stored in `localStorage` under key `ops_session_token` are accessible to any JavaScript running on the page, including injected scripts.
- Files: `packages/auth/src/client.ts` lines 6, 16, 29
- Current mitigation: An httpOnly session cookie is also set by the API — but browsers may use the localStorage token for API calls before the cookie is established.
- Recommendations: Migrate to httpOnly-only cookie flow and remove localStorage token storage.

---

## Performance Bottlenecks

**`GET /payroll/periods` — unbounded nested load:**
- Problem: Loads all payroll periods with full nested `entries` (including sales with addons and product details) and `serviceEntries`. No date filter, no `take` limit.
- Files: `apps/ops-api/src/routes/index.ts` lines 869–886
- Cause: No pagination. Every period ever created is returned on each page load.
- Improvement path: Add `orderBy: { weekStart: "desc" }, take: 12` as default; expose a `year` query param for historical access.

**`GET /agent-tracker` — fetches all call logs for date range into memory:**
- Problem: `convosoCallLog.findMany` fetches potentially thousands of records into Node memory for in-process aggregation (buffer filtering, cost calculation).
- Files: `apps/ops-api/src/routes/index.ts` lines 1540–1574
- Cause: Per-source `callBufferSeconds` filtering cannot be pushed to SQL since it requires joining per-source buffer values dynamically.
- Improvement path: Pre-compute buffer-filtered call counts in a materialized view or push the buffer logic into the Convoso KPI poller rather than the read path.

**`getRepChecklist` — 2N+1 queries per request:**
- Problem: Issues 2 `findMany` queries per active CS rep (chargebacks + pending terms) rather than 2 total queries.
- Files: `apps/ops-api/src/services/repSync.ts` lines 117–141
- Cause: Fan-out inside `Promise.all`. For 10 reps this is 21 DB round trips; for 20 reps, 41.
- Improvement path: Replace with two bulk queries filtered by `assignedTo: { in: repNames }` and group in memory.

---

## Fragile Areas

**In-memory Morgan slot state — lost on restart:**
- Files: `index.js` lines 40–68
- Why fragile: `morganSlots` and `morganCallToSlot` are plain `Map` objects. Any process restart orphans active call slots permanently (they remain "busy" forever).
- Safe modification: Do not modify slot state outside `markMorganSlotBusy` and `freeMorganSlot` functions. Add a startup log of slot state for observability.
- Test coverage: No tests cover slot state. `__tests__/integration.test.js` contains only TODO stubs.

**`handleSaleEditApproval` — finalized-period logic:**
- Files: `apps/ops-api/src/services/payroll.ts` lines 277–328
- Why fragile: The function finds a "new entry" by excluding the finalized entry ID — but if `upsertPayrollEntryForSale` updates the same entry in-place, `newEntries[0]` is still the finalized entry, causing incorrect comparison.
- Safe modification: Always check `payrollPeriod.status` on re-fetched entries after upsert rather than relying on ID exclusion.
- Test coverage: Covered by `services/__tests__/commission.test.ts` but not for the same-period finalized edge case.

**`DEFAULT_AI_AUDIT_PROMPT` duplicated in two places:**
- Files: `apps/ops-api/src/routes/index.ts` lines 1577–1611, `apps/ops-api/src/services/callAudit.ts` (separate `DEFAULT_AUDIT_PROMPT` constant)
- Why fragile: Changes to the default prompt must be made in two places or will silently diverge.
- Safe modification: Extract to a shared constant in `apps/ops-api/src/services/callAudit.ts` and import it in the route.

**`dateRange` function uses local `new Date()` — timezone inconsistent with payroll:**
- Files: `apps/ops-api/src/routes/index.ts` lines 34–92
- Why fragile: `dateRange` computes ranges from `new Date()` (server local time / UTC), while `getSundayWeekRange` in payroll uses Luxon with explicit `America/New_York` timezone. Reports filtered with `dateRange` may show different week boundaries than payroll entries.
- Safe modification: Use Luxon throughout `dateRange` with a consistent timezone.

---

## Scaling Limits

**Single-process in-memory audit queue:**
- Current capacity: 3 concurrent audit jobs; queue state lives in `activeJobs` Set in the Node process.
- Limit: Horizontal scaling (multiple ops-api instances) will result in duplicate job processing since both instances will pick the same `queued` records from the database.
- Scaling path: Use a distributed lock (e.g., `pg_advisory_lock`) or a proper job queue (BullMQ with Redis) to coordinate across instances.

**`processedConvosoCall` table as deduplication store:**
- Current capacity: Records older than 30 days are cleaned up in each poll cycle.
- Limit: High call volume without cleanup will grow this table unbounded. Cleanup is best-effort inside the same transaction as the poll — if the poll crashes, cleanup is skipped.
- Scaling path: Run cleanup as a separate cron; add a DB index on `processedAt` if not already present.

---

## Dependencies at Risk

**`node-fetch` in legacy Morgan service:**
- Risk: `index.js` uses `node-fetch` (CommonJS `require`), which is a v2 pinned package. Node 18+ has native `fetch`. There is also a mismatch where `apps/ops-api` uses native `fetch`.
- Impact: Dependency drift; security patches for `node-fetch` v2 may not arrive.
- Migration plan: Remove `node-fetch` from `index.js` and use the Node native `fetch` (available since Node 18).

**Dual AI provider dependency (Anthropic + OpenAI):**
- Risk: Two AI SDKs are imported; OpenAI is the fallback path but may receive less attention/testing. The fallback audit result shape differs from the Claude structured output (no `issues`/`wins` arrays).
- Files: `apps/ops-api/src/services/callAudit.ts` lines 218–242
- Impact: If Anthropic is unavailable, the OpenAI fallback silently writes a different data shape into `callAudit`, breaking the structured audit display.
- Migration plan: Either standardize on one provider or ensure the fallback path produces the same structured output.

---

## Missing Critical Features

**No rate limiting on any API endpoint:**
- Problem: `apps/ops-api/src/index.ts` has no rate-limiting middleware (no `express-rate-limit` or equivalent). The login endpoint (`POST /api/auth/login`) is brute-forceable.
- Blocks: Security hardening; compliance requirements.

**No input size limits beyond Zod validation:**
- Problem: `express.json()` in `apps/ops-api/src/index.ts` uses the default 100kb body limit. The CSV paste for chargebacks/pending-terms (`rawPaste` field) can exceed this.
- Files: `apps/ops-api/src/index.ts` line 20
- Blocks: Reliable bulk paste import for large CS batches.

**Integration tests are entirely unimplemented:**
- Problem: `__tests__/integration.test.js` contains 25+ `it` blocks that are entirely TODO stubs. The entire integration test suite passes vacuously.
- Files: `__tests__/integration.test.js`
- Blocks: Confidence in Morgan service correctness; regression detection.

---

## Test Coverage Gaps

**Morgan service (index.js) — zero functional tests:**
- What's not tested: Slot management, Convoso lead enqueueing, Vapi call initiation, webhook handling, end-of-call processing, Monday lead backfill logic.
- Files: `index.js`, `voiceGateway.js`, `morganToggle.js`, `rateLimitState.js`
- Risk: Any refactor to the Morgan service has no regression safety net.
- Priority: High — this is the core revenue-generating AI calling system.

**`handleSaleEditApproval` — finalized same-period edge case:**
- What's not tested: The scenario where a sale is edited but the new sale date stays in the same (already finalized) payroll period.
- Files: `apps/ops-api/src/services/payroll.ts` lines 311–323
- Risk: Commission double-counting or incorrect clawback creation goes undetected.
- Priority: High — payroll correctness is critical.

**`getRepChecklist` — CS rep assignment:**
- What's not tested: Round-robin assignment under concurrency; rep checklist aggregation with mixed resolved/unresolved items.
- Files: `apps/ops-api/src/services/repSync.ts`
- Risk: Uneven distribution to CS reps; silent duplicate assignment under concurrent requests.
- Priority: Medium.

**Convoso KPI poller — poll cycle logic:**
- What's not tested: Deduplication behavior when `processedConvosoCall` records are present; cleanup of old records; agent mapping by email.
- Files: `apps/ops-api/src/workers/convosoKpiPoller.ts`
- Risk: Silent data duplication if deduplication logic has a bug.
- Priority: Medium.

---

*Concerns audit: 2026-03-23*
