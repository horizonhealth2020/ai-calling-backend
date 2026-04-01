# Phase 37: Fix Call Audit Issues, Manager Dashboard UI, and Agent Performance Card Order - Research

**Researched:** 2026-03-31
**Domain:** Queue reliability, UI pagination/filtering, composite scoring
**Confidence:** HIGH

## Summary

This phase addresses three interconnected areas in the existing codebase: (1) audit queue reliability -- orphan recovery on startup and retry mechanism for failed audits, (2) audit UI overhaul -- adding timestamps, date-based pagination, and agent filtering, and (3) performance tracker ranking -- replacing simple salesCount sort with a composite performance score.

All three areas work within the existing Express.js + Prisma + Next.js 15 stack. No new libraries are needed. The changes are surgical modifications to existing files with well-understood patterns already established in the codebase. The primary risk is the composite scoring formula edge cases (agents with zero sales, missing cost data).

**Primary recommendation:** Implement orphan recovery as a startup function in `startAutoScorePolling()`, add a `retryFailedAudits()` function with exponential backoff, paginate the audit API with cursor-based pagination, and compute composite scores client-side in ManagerTracker using min-max normalization.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Add orphan recovery on startup -- detect audits stuck in processing/transcribing/auditing status with no active job, re-queue as queued
- **D-02:** Add retry mechanism for failed audits -- allow re-processing (at least manual, ideally automatic with backoff)
- **D-03:** Multiple failure vectors for longer calls: (a) Convoso may take longer to process/make recording available at the URL -- current 10 retries x 60s = 10 min max wait may not be enough for long calls, (b) Claude API timeout on large transcription text, (c) Railway process restart orphaning in-flight jobs. Whisper itself handles 20+ min audio fine (all 200 OK in logs). Calls can exceed 20 minutes.
- **D-04:** 41 failed audits and 14 orphaned as of 2026-03-31 -- need better logging to distinguish which failure vector caused each failure
- **D-05:** Add call timestamps to audit display -- show date AND time
- **D-06:** Default view shows last 24 hours of audits, ordered by date/time (most recent first)
- **D-07:** "Load more" pagination for older audits -- paginated approach
- **D-08:** Add agent filter to audit list
- **D-09:** Order audits by call date AND processing completion time
- **D-10:** Replace current salesCount descending sort with composite performance score
- **D-11:** Composite formula: Premium (40% weight) + Cost-per-sale efficiency (60% weight), with sale count as tiebreaker only
- **D-12:** Lower cost-per-sale = better efficiency (invert for scoring). Higher premium = better
- **D-13:** Agents with no sales or no cost data should rank last

### Claude's Discretion
- Normalization method for composite score (min-max, percentile, z-score) -- Claude to choose based on data distribution
- Exact pagination batch size for audit loading (24h suggested, but Claude can adjust)
- Whether to add a "retry failed" button in the audit UI or just auto-retry on startup

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | existing | REST API with asyncHandler pattern | Already powers all API routes |
| Prisma | existing | ORM for PostgreSQL queries | All DB access goes through @ops/db |
| Next.js 15 | existing | Dashboard frontend | ops-dashboard app framework |
| Socket.IO | existing | Real-time audit status events | Already wired for audit lifecycle |
| Zod | existing | Request validation | All API inputs validated via Zod |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/ui | internal | Badge, Card, Button, DateRangeFilter, EmptyState | All UI components |
| @ops/auth/client | internal | authFetch() with Bearer token | All API calls from dashboard |
| @ops/utils | internal | formatDate(), logEvent() | Date formatting, structured logging |
| lucide-react | existing | Icons (Headphones, RefreshCw, etc.) | All icon needs |

### No New Dependencies Needed
This phase is entirely modifications to existing code. No `npm install` required.

## Architecture Patterns

### Pattern 1: Orphan Recovery on Startup
**What:** Detect ConvosoCallLog records stuck in intermediate statuses (`processing`, `waiting_recording`, `transcribing`, `auditing`) that have no corresponding entry in the in-memory `activeJobs` Set, and reset them to `queued`.
**When to use:** On server startup, inside `startAutoScorePolling()` before the polling interval begins.

```typescript
// In auditQueue.ts, call before starting the interval
async function recoverOrphanedJobs(): Promise<number> {
  const orphaned = await prisma.convosoCallLog.updateMany({
    where: {
      auditStatus: { in: ["processing", "waiting_recording", "transcribing", "auditing"] },
    },
    data: { auditStatus: "queued" },
  });
  if (orphaned.count > 0) {
    console.log(JSON.stringify({
      event: "audit_orphan_recovery",
      recovered: orphaned.count,
      timestamp: new Date().toISOString(),
    }));
  }
  return orphaned.count;
}
```

**Key insight:** On startup, `activeJobs` is empty (fresh Set). ANY record in processing/transcribing/auditing is by definition orphaned since there's no in-memory job running for it. This makes the recovery logic trivially correct.

### Pattern 2: Failed Audit Retry with Backoff
**What:** Re-queue failed audits with a retry count, using exponential backoff (1min, 5min, 15min). Store `retryCount` and `lastFailedAt` to prevent infinite retries.
**When to use:** Both automatic (on startup/poll) and manual (via API button).

**Database change needed:** Add `retryCount Int @default(0)` and `lastFailedAt DateTime?` fields to ConvosoCallLog model. This avoids infinite retry loops and enables backoff timing.

```typescript
// Auto-retry: in the polling cycle, find failed audits eligible for retry
async function retryFailedAudits(): Promise<number> {
  const MAX_RETRIES = 3;
  const now = new Date();

  // Find failed audits with retryCount < MAX and enough time elapsed
  const candidates = await prisma.convosoCallLog.findMany({
    where: {
      auditStatus: "failed",
      retryCount: { lt: MAX_RETRIES },
      recordingUrl: { not: null },
    },
    select: { id: true, retryCount: true, lastFailedAt: true },
    take: 5,
  });

  const eligible = candidates.filter(c => {
    if (!c.lastFailedAt) return true;
    // Exponential backoff: 1min, 5min, 15min
    const delays = [60_000, 300_000, 900_000];
    const delay = delays[c.retryCount] ?? delays[delays.length - 1];
    return now.getTime() - c.lastFailedAt.getTime() > delay;
  });

  if (eligible.length === 0) return 0;

  await prisma.convosoCallLog.updateMany({
    where: { id: { in: eligible.map(e => e.id) } },
    data: { auditStatus: "queued" },
  });

  return eligible.length;
}
```

### Pattern 3: Failure Vector Logging
**What:** Categorize failures by vector so logs distinguish between recording-unavailable, transcription-timeout, Claude-timeout, and process-restart.
**When to use:** In `runJob()` and `processCallRecording()` catch blocks.

```typescript
// Enhanced error categorization in runJob catch block
function categorizeError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Recording download failed") || msg.includes("Recording empty") || msg.includes("Invalid audio")) return "recording_unavailable";
  if (msg.includes("Whisper transcription failed") || msg.includes("AbortError")) return "transcription_timeout";
  if (msg.includes("anthropic") || msg.includes("Claude") || msg.includes("429") || msg.includes("overloaded")) return "claude_api_error";
  return "unknown";
}

// Log with category
console.log(JSON.stringify({
  event: "audit_job_failed",
  callLogId,
  failureVector: categorizeError(err),
  errorMessage: err instanceof Error ? err.message : String(err),
  timestamp: new Date().toISOString(),
}));
```

### Pattern 4: Cursor-Based Pagination for Audits
**What:** Add cursor-based pagination to the `/call-audits` endpoint using `createdAt` as cursor. Return a batch of audits ordered by `callDate` desc with a `nextCursor` for "Load More".
**When to use:** Replace the current unbounded findMany.

```typescript
// API: cursor-based pagination
const schema = dateRangeQuerySchema.extend({
  agentId: z.string().optional(),
  cursor: z.string().optional(),  // ISO date string of last item's createdAt
  limit: z.coerce.number().min(1).max(100).default(25),
});

const where: any = {};
if (cursor) {
  where.createdAt = { lt: new Date(cursor) };
}

const audits = await prisma.callAudit.findMany({
  where,
  include: { agent: { select: { id: true, name: true } }, convosoCallLog: { select: { leadPhone: true } } },
  orderBy: { callDate: "desc" },
  take: limit + 1, // fetch one extra to know if more exist
});

const hasMore = audits.length > limit;
const items = hasMore ? audits.slice(0, limit) : audits;
const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

res.json({ audits: items, nextCursor });
```

### Pattern 5: Composite Performance Score (Client-Side)
**What:** Min-max normalization of premium and cost-per-sale efficiency, weighted 40/60, with sale count as tiebreaker.
**When to use:** In ManagerTracker.tsx, replacing the current `[...tracker].sort((a, b) => b.salesCount - a.salesCount)`.

**Recommendation: Use min-max normalization.** With a small agent pool (9-15 agents), z-scores can produce misleading results with outliers. Percentile ranking is overkill for N<20. Min-max maps to [0,1] range and is intuitive.

```typescript
function computeCompositeScores(entries: TrackerEntry[]): (TrackerEntry & { compositeScore: number })[] {
  // Filter agents with sales for scoring
  const withSales = entries.filter(e => e.salesCount > 0);
  const noSales = entries.filter(e => e.salesCount === 0);

  if (withSales.length === 0) return entries.map(e => ({ ...e, compositeScore: 0 }));

  // Premium: higher is better
  const premiums = withSales.map(e => e.premiumTotal);
  const minPrem = Math.min(...premiums);
  const maxPrem = Math.max(...premiums);
  const premRange = maxPrem - minPrem || 1; // avoid division by zero

  // Cost per sale: lower is better (invert)
  const costs = withSales.filter(e => e.costPerSale > 0).map(e => e.costPerSale);
  const minCost = costs.length > 0 ? Math.min(...costs) : 0;
  const maxCost = costs.length > 0 ? Math.max(...costs) : 1;
  const costRange = maxCost - minCost || 1;

  const scored = withSales.map(e => {
    const premScore = (e.premiumTotal - minPrem) / premRange; // 0-1, higher=better
    // For cost: if no cost data, treat as worst efficiency (score 0)
    const costScore = e.costPerSale > 0
      ? 1 - ((e.costPerSale - minCost) / costRange) // invert: lower cost = higher score
      : 0;
    const compositeScore = (premScore * 0.4) + (costScore * 0.6);
    return { ...e, compositeScore };
  });

  // Agents with no sales get score -1 (always last)
  const unscoredEntries = noSales.map(e => ({ ...e, compositeScore: -1 }));

  return [...scored, ...unscoredEntries];
}

// Sort: composite desc, then salesCount desc as tiebreaker
const sorted = computeCompositeScores(tracker)
  .sort((a, b) => b.compositeScore - a.compositeScore || b.salesCount - a.salesCount);
```

### Pattern 6: formatDateTime Helper
**What:** Add a `formatDateTime()` function to `@ops/utils` that shows both date and time.
**When to use:** For audit list display of call timestamps.

```typescript
/** Format an ISO date string as M/D/YYYY h:mm AM/PM. Returns "--" for null/undefined. */
export function formatDateTime(d: string | null | undefined): string {
  if (!d) return "--";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "--";
  return date.toLocaleString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
```

### Anti-Patterns to Avoid
- **Loading all audits at once:** Current code fetches all audits with no limit. With growing data this will cause lag. Use pagination.
- **Server-side composite score:** The tracker summary already returns all necessary fields. Computing client-side avoids API changes and keeps the formula adjustable without deploys.
- **Infinite retry loops:** Without a `retryCount` cap and backoff, failed audits would retry endlessly. Always cap retries.
- **Hardcoding timezone conversion:** Convoso `call_date` is Pacific time but `callTimestamp` in the DB is already stored as a proper DateTime. Use the DB field, not raw Convoso strings.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range filtering | Custom date picker | Existing `DateRangeFilter` from `@ops/ui` | Already has presets (today, week, month, custom) and is used in ManagerTracker |
| Cursor pagination | Offset-based pagination | Prisma cursor with `take` + 1 pattern | Offset pagination degrades with large datasets; cursor is O(1) |
| Exponential backoff | Custom timer management | Simple array of delay values with retryCount index | Three retries with fixed delays is simpler and more predictable than computed backoff |
| Score normalization | Custom statistical library | Inline min-max math | 10 lines of code, no library needed for N < 20 agents |

## Common Pitfalls

### Pitfall 1: Race Condition on Orphan Recovery
**What goes wrong:** If `recoverOrphanedJobs()` runs while `pollPendingJobs()` is also running, an actually-in-progress job could be reset.
**Why it happens:** The recovery checks DB status but `activeJobs` Set is the source of truth for running jobs.
**How to avoid:** Run orphan recovery BEFORE the first `pollPendingJobs()` call, in `startAutoScorePolling()` before setting the interval. On startup, `activeJobs` is guaranteed empty.
**Warning signs:** Duplicate processing of the same call, double Claude API charges.

### Pitfall 2: Convoso call_date Timezone Confusion
**What goes wrong:** Displaying raw `call_date` from Convoso without timezone context shows wrong time.
**Why it happens:** Convoso returns Pacific time as a plain string, but the DB stores it as UTC via Prisma DateTime.
**How to avoid:** Always use `callTimestamp` (the DB DateTime field) or `callDate` from CallAudit. Both are proper UTC dates. Format with `toLocaleString()` which respects browser timezone.
**Warning signs:** Times appearing 3 hours off (UTC vs Pacific).

### Pitfall 3: Division by Zero in Composite Score
**What goes wrong:** When all agents have the same premium or same cost-per-sale, the range is 0, causing NaN.
**Why it happens:** Min-max normalization divides by (max - min).
**How to avoid:** Guard with `|| 1` on the range calculation. When all values are equal, everyone gets score 0.5.
**Warning signs:** NaN scores, agents ranked seemingly randomly.

### Pitfall 4: Agents with No Cost Data Getting Top Rank
**What goes wrong:** Agents with `costPerSale === 0` (because no Convoso data) get treated as "zero cost" which is artificially best.
**Why it happens:** D-12 says lower cost = better, so 0 is "best."
**How to avoid:** Per D-13, agents with no cost data get `costScore = 0` (worst efficiency score), not `costScore = 1` (best). Only agents with actual `costPerSale > 0` participate in the cost normalization.
**Warning signs:** New agents with no calls ranked #1.

### Pitfall 5: Breaking Existing Socket Events
**What goes wrong:** Changing audit status flow breaks real-time dashboard updates.
**Why it happens:** Socket events (`processing_started`, `audit_status`, `new_audit`, `processing_failed`) are tied to specific status transitions.
**How to avoid:** Orphan recovery should NOT emit socket events. Only `runJob()` and `processCallRecording()` should emit events, same as today.
**Warning signs:** Phantom "processing" indicators in the dashboard.

### Pitfall 6: Pagination Cursor with Date Filtering
**What goes wrong:** Using date range + cursor together produces unexpected results.
**Why it happens:** If the cursor is based on `createdAt` but the date filter is on `callDate`, they're independent fields.
**How to avoid:** Default view (last 24h) uses `callDate` range. "Load more" extends by moving the time window back, not using a cursor on a different field. Alternatively, use `callDate` as the cursor field.
**Warning signs:** Missing audits in paginated results, duplicates.

## Code Examples

### Current Audit Fetch (ManagerAudits.tsx, line 147)
```typescript
// BEFORE: Fetches ALL audits, no filtering, no pagination
authFetch(`${API}/api/call-audits`).then(r => r.ok ? r.json() : []).then(setAudits);
```

### Current Sort (ManagerTracker.tsx, line 120)
```typescript
// BEFORE: Simple salesCount sort
const sorted = [...tracker].sort((a, b) => b.salesCount - a.salesCount);
```

### Current formatDate (packages/utils/src/index.ts, line 10)
```typescript
// Date only -- no time component
export function formatDate(d: string | null | undefined): string {
  if (!d) return "--";
  const [y, m, dd] = d.split("T")[0].split("-");
  return `${parseInt(m)}/${parseInt(dd)}/${y}`;
}
```

### Startup Hook Location (apps/ops-api/src/index.ts, line 93-97)
```typescript
server.listen(port, () => {
  console.log(`ops-api listening on ${port}`);
  startConvosoKpiPoller();
  startAutoScorePolling(); // <-- orphan recovery goes inside this function
});
```

### Existing API Validation Pattern (call-audits.ts)
```typescript
// Extend existing schema for pagination params
const qp = dateRangeQuerySchema.extend({
  agentId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(25),
}).safeParse(req.query);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Load all audits | Cursor-based pagination | This phase | Prevents UI lag with growing audit data |
| Simple salesCount sort | Composite weighted score | This phase | Better reflects actual agent value |
| Silent orphan accumulation | Startup recovery + retry | This phase | Self-healing queue system |
| Date-only display | Date+time display | This phase | Managers can see exact call timing |

## Open Questions

1. **Prisma migration for retryCount/lastFailedAt fields**
   - What we know: Need `retryCount Int @default(0)` and `lastFailedAt DateTime?` on ConvosoCallLog
   - What's unclear: Whether a migration should also add `failureReason String?` for storing the categorized failure vector
   - Recommendation: Add all three fields in one migration. `failureReason` is cheap and valuable for debugging.

2. **"Retry Failed" button vs auto-retry only**
   - What we know: Auto-retry on startup + during polling cycle covers most cases
   - What's unclear: Whether managers want manual control to retry specific failed audits
   - Recommendation: Add both. A "Retry" button next to failed audits in the UI (like the existing re-audit button) gives managers agency. Auto-retry handles the background recovery.

3. **Pagination batch size**
   - What we know: D-07 suggests 24-hour batches
   - What's unclear: Whether count-based (25 audits) or time-based (24h window) works better
   - Recommendation: Use count-based (25 items per page) with "Load More" button. Time-based can produce empty pages during low-activity periods. The default date filter (last 24h) provides the initial scoping.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing in apps/morgan/) |
| Config file | apps/morgan/jest.config.js |
| Quick run command | `npm test -- --testPathPattern=audit` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Orphan recovery resets stuck audits to queued | unit | `npm test -- auditQueue.test.js -t "orphan recovery"` | No -- Wave 0 |
| D-02 | Failed audits retry with backoff timing | unit | `npm test -- auditQueue.test.js -t "retry"` | No -- Wave 0 |
| D-03 | Failure vector categorization | unit | `npm test -- auditQueue.test.js -t "categorize"` | No -- Wave 0 |
| D-10/D-11 | Composite score calculation | unit | `npm test -- compositeScore.test.js` | No -- Wave 0 |
| D-12 | Cost inversion in scoring | unit | `npm test -- compositeScore.test.js -t "invert"` | No -- Wave 0 |
| D-13 | No-sales agents rank last | unit | `npm test -- compositeScore.test.js -t "no sales"` | No -- Wave 0 |
| D-05/D-06 | Audit UI shows timestamps, default 24h | manual-only | Visual verification in browser | N/A |
| D-07 | Load more pagination works | manual-only | Click "Load More" in audit UI | N/A |
| D-08 | Agent filter works | manual-only | Select agent in filter dropdown | N/A |

### Sampling Rate
- **Per task commit:** `npm test -- --testPathPattern=audit`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/morgan/tests/auditQueue.test.js` -- covers D-01, D-02, D-03 (orphan recovery, retry, failure categorization)
- [ ] `apps/morgan/tests/compositeScore.test.js` -- covers D-10, D-11, D-12, D-13 (scoring logic)
- [ ] Prisma migration for retryCount, lastFailedAt, failureReason on ConvosoCallLog

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of all referenced files (auditQueue.ts, callAudit.ts, call-audits.ts routes, ManagerAudits.tsx, ManagerTracker.tsx, sales.ts tracker endpoint)
- Prisma schema (schema.prisma) for ConvosoCallLog and CallAudit models
- Existing patterns: DateRangeFilter in @ops/ui, formatDate in @ops/utils, socket events in socket.ts

### Secondary (MEDIUM confidence)
- Composite scoring approach (min-max normalization) based on standard data science practice for small N populations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all existing libraries, no new deps
- Architecture: HIGH - patterns derived directly from existing codebase code
- Pitfalls: HIGH - identified from actual code inspection and data model review
- Composite scoring: MEDIUM - normalization method is a judgment call, but min-max is well-suited for N<20

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable codebase, no external dependency changes)
