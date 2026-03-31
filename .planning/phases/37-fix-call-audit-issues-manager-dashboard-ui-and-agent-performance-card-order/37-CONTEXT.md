# Phase 37: Fix Call Audit Issues, Manager Dashboard UI, and Agent Performance Card Order - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Three areas: (1) Fix call audit processing reliability and overhaul the audit UI for usability, (2) Fix manager Performance Tracker to rank agents by composite performance score, (3) Add timestamps to audit display and date-based filtering.

</domain>

<decisions>
## Implementation Decisions

### Call Audit Processing Fixes
- **D-01:** Add orphan recovery on startup — detect audits stuck in `processing/transcribing/auditing` status with no active job, and re-queue them as `queued`
- **D-02:** Add retry mechanism for `failed` audits — allow re-processing (at least manual, ideally automatic with backoff)
- **D-03:** Multiple failure vectors for longer calls: (a) Convoso may take longer to process/make recording available at the URL — current 10 retries x 60s = 10 min max wait may not be enough for long calls, (b) Claude API timeout on large transcription text, (c) Railway process restart orphaning in-flight jobs. Whisper itself handles 20+ min audio fine (all 200 OK in logs). Calls can exceed 20 minutes.
- **D-04:** 41 failed audits and 14 orphaned as of 2026-03-31 — need better logging to distinguish which failure vector caused each failure (recording unavailable vs transcription timeout vs Claude timeout vs process restart)

### Call Audit UI Overhaul
- **D-05:** Add call timestamps to audit display — Convoso returns `call_date` as `"2026-03-31 06:21:46"` (Pacific time). Show date AND time in the audit list
- **D-06:** Default view shows last 24 hours of audits, ordered by date/time (most recent first)
- **D-07:** "Load more" pagination for older audits — do NOT dump all old audits at once (causes lag). Paginated approach, e.g., load next 24-hour batch on demand
- **D-08:** Add agent filter to audit list — filter audits by agent name
- **D-09:** Order audits by call date AND processing completion time (when the audit was processed)

### Performance Tracker Ranking
- **D-10:** Replace current `salesCount` descending sort with composite performance score
- **D-11:** Composite formula: Premium (40% weight) + Cost-per-sale efficiency (60% weight), with sale count as tiebreaker only
- **D-12:** Lower cost-per-sale = better efficiency (invert for scoring). Higher premium = better
- **D-13:** Agents with no sales or no cost data should rank last (not get artificially high/low scores)

### Claude's Discretion
- Normalization method for composite score (min-max, percentile, z-score) — Claude to choose based on data distribution
- Exact pagination batch size for audit loading (24h suggested, but Claude can adjust)
- Whether to add a "retry failed" button in the audit UI or just auto-retry on startup

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit Processing
- `apps/ops-api/src/services/auditQueue.ts` — Queue system, job runner, orphan detection needed here
- `apps/ops-api/src/services/callAudit.ts` — Transcription + Claude audit pipeline, where failures occur post-Whisper
- `apps/ops-api/src/routes/call-audits.ts` — API endpoints for audit CRUD

### Audit UI
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerAudits.tsx` — Current flat list UI, needs timestamp display, filtering, pagination
- `apps/ops-dashboard/app/(dashboard)/manager/page.tsx` — Manager tab orchestrator

### Performance Tracker
- `apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx` — Current `salesCount` sort, needs composite score
- `apps/ops-api/src/routes/sales.ts` — Tracker summary endpoint (provides premium, salesCount, costPerSale data)

### Convoso Data
- Convoso `call_date` format: `"2026-03-31 06:21:46"` in America/Los_Angeles timezone (per prior memory)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `formatDate()` from `@ops/utils` — currently date-only, needs time variant or new `formatDateTime()` helper
- `authFetch()` from `@ops/auth/client` — used for all API calls with 30s timeout
- `Badge`, `Card`, `Button`, `EmptyState` from `@ops/ui` — available for audit cards
- Socket.IO events already exist for real-time audit status (`processing_started`, `audit_status`, `new_audit`, `processing_failed`)

### Established Patterns
- Inline React.CSSProperties with dark glassmorphism theme — no Tailwind
- Date range filtering pattern exists in other tabs (DateRangeFilter component)
- Sorting done client-side in ManagerTracker (`[...tracker].sort(...)`)
- API returns pre-calculated `costPerSale` in tracker summary endpoint

### Integration Points
- `enqueueAutoScore()` runs on 30s polling interval — startup recovery should hook into `startAutoScorePolling()`
- Tracker data comes from existing API endpoint — composite score calculation can be client-side or server-side
- Call timestamps stored as `callTimestamp` in ConvosoCallLog, linked to CallAudit via `callAuditId`

</code_context>

<specifics>
## Specific Ideas

- User wants audits ordered by both call date/time AND processing time
- Whisper logs confirm transcription succeeds for all durations (5min to 20min) — failures are post-transcription
- Railway logs show `failed: 41, inProgress: 14, activeJobs: 0` — clear orphan + failure accumulation
- User specifically noted "long calls will take longer" — they understand and accept processing time, the issue is silent failures
- Whisper model offloads after 300s idle — first audit after idle period has ~1-3s model load overhead

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 37-fix-call-audit-issues-manager-dashboard-ui-and-agent-performance-card-order*
*Context gathered: 2026-03-31*
