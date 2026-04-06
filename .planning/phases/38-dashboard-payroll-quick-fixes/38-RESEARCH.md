# Phase 38: Dashboard & Payroll Quick Fixes - Research

**Researched:** 2026-04-06
**Domain:** Bug fixes — Express API routes, React dashboard components, Prisma queries
**Confidence:** HIGH

## Summary

Phase 38 addresses five targeted bugs across the ops-api and ops-dashboard apps. All bugs have been precisely located in source code with root causes confirmed through code inspection. No new libraries, schemas, or architectural changes are needed — each fix is a small, isolated code change (1-10 lines).

The fixes span two apps: three are API-only (audit rolling window, per-agent audit filter, sparkline date format), one is frontend-only (enrollment fee parser condition), and one is frontend with a minor enhancement (analytics section default expand + lazy loading). The existing cursor-based pagination, receipt parser, and sparkline rendering infrastructure all work correctly — only the specific bug lines need modification.

**Primary recommendation:** Fix each bug at the exact line identified in CONTEXT.md. No refactoring, no new dependencies. Each fix can be verified independently.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Replace 24-hour time-based filter in `call-audits.ts:49-51` with count-based "last 30 audits" query. Default view fetches last 30 audits ordered by call date descending, regardless of when they occurred.
- **D-02:** "Load more" pagination fetches next 30 audits using cursor-based pagination (existing cursor mechanism).
- **D-03:** Per-agent filter (DASH-02) also returns last 30 audits for that specific agent -- consistent behavior, always 30 results regardless of context. Agent filter already exists at `call-audits.ts:53`.
- **D-04:** No date range override needed -- remove the time-based default entirely in favor of pure count-based windowing.
- **D-05:** Bug is in `ManagerEntry.tsx:196` -- `if (totalEnrollment > 0)` skips $0 enrollment fees.
- **D-06:** Fix: change condition so when an `Enrollment` line is found in the receipt (even at $0), the fee value is set. Only skip when NO enrollment line exists at all.
- **D-07:** Sample receipt confirmed: `Enrollment  $0.00` line is present, parser regex at line 182 (`efMatch`) correctly extracts it, but line 196 discards the value.
- **D-08:** Bug is a date format mismatch in `lead-timing.ts:201-213`. `String(r.day)` on a Date object produces long date string, but `days` array uses ISO format from `toISOString().slice(0,10)`.
- **D-09:** Fix: normalize `r.day` to ISO date string format when building callMap/saleMap keys.
- **D-10:** Change `LeadTimingSection.tsx:75` from `useState(false)` to `useState(true)`.
- **D-11:** Use lazy loading (IntersectionObserver or similar) so API call is deferred until section scrolls into view. Section starts visually expanded but data loads on scroll.

### Claude's Discretion
- Exact IntersectionObserver implementation for lazy-load analytics (or equivalent approach)
- Whether to normalize the date in the SQL query itself vs in JS post-processing for sparklines
- Any minor pagination adjustments needed when switching audit query from time-based to count-based

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PAY-04 | Sales with no enrollment fee default to $0, showing half-commission badge and approve button correctly | Fix at `ManagerEntry.tsx:196` -- change `totalEnrollment > 0` to track whether any enrollment line was found, set `out.enrollmentFee = "0.00"` when found with $0 value |
| DASH-01 | Call audit tab shows last 30 audits (rolling window) instead of last 24 hours | Remove time-based default at `call-audits.ts:48-51`, let Prisma query run without date filter on initial load; existing `take: limit + 1` with `orderBy: callDate desc` handles the count-based window |
| DASH-02 | Per-agent audit filter also uses rolling 30-audit window | Same fix as DASH-01 -- the agent filter at line 53 already applies independently of the date filter, so removing the time-based default applies to both filtered and unfiltered views |
| DASH-03 | Lead source and timing analytics sections start expanded by default | Change `useState(false)` to `useState(true)` at `LeadTimingSection.tsx:75`, add IntersectionObserver to defer data fetch until visible |
| DASH-04 | 7-day trend sparklines display data correctly | Normalize `r.day` Date objects to ISO strings at `lead-timing.ts:203-205` so map keys match the `days` array format |
</phase_requirements>

## Standard Stack

### Core (already in use -- no additions needed)
| Library | Purpose | Relevant Files |
|---------|---------|----------------|
| Express + asyncHandler | API route handlers | `call-audits.ts`, `lead-timing.ts` |
| Prisma | ORM queries (findMany, $queryRaw) | `call-audits.ts`, `lead-timing.ts` |
| React 18 + useState/useEffect | Dashboard component state | `LeadTimingSection.tsx`, `ManagerEntry.tsx`, `ManagerAudits.tsx` |
| Zod | Request validation | `call-audits.ts` (already wired) |

### No New Dependencies
All fixes use existing code patterns. No `npm install` needed.

## Architecture Patterns

### Fix 1: Audit Rolling Window (DASH-01, DASH-02) — API change

**File:** `apps/ops-api/src/routes/call-audits.ts`
**Lines:** 44-52

**Current (buggy):**
```typescript
// Lines 48-51: Default to last 24 hours if no date range and no cursor
} else if (!cursor) {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  where.callDate = { gte: yesterday, lt: now };
}
```

**Fix:** Remove the `else if (!cursor)` block entirely. When no date range is specified and no cursor is provided, the query runs without a `callDate` filter. The existing `orderBy: [{ callDate: "desc" }, { updatedAt: "desc" }]` and `take: limit + 1` already produce a count-based rolling window of the most recent audits.

**Impact on pagination:** The `loadMore` function in `ManagerAudits.tsx` already sends `cursor` on subsequent requests. When a cursor is present, lines 57-60 handle cursor-based pagination (skip 1 from cursor). This works identically whether or not a date filter exists -- no frontend changes needed.

**Impact on agent filter:** The `agentId` filter at line 53 is additive to `where`. Removing the date constraint means the agent filter naturally returns the last N audits for that agent, satisfying DASH-02.

**Change to default limit:** The frontend sends `limit=25` (line 156 of ManagerAudits.tsx). Decision D-01/D-02 says "last 30 audits." Either change the frontend to send `limit=30` or change the API default from 25 to 30. The API schema default is 25 (`z.coerce.number().min(1).max(100).default(25)` at line 37). Recommend changing frontend to `params.set("limit", "30")` since the API default is just a fallback.

### Fix 2: Enrollment Fee $0 (PAY-04) — Frontend change

**File:** `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx`
**Lines:** 158, 196, 216-222

**Current (buggy):**
```typescript
// Line 158: accumulator starts at 0
let totalEnrollment = 0;

// Lines 182-186: correctly extracts $0 from "Enrollment $0.00"
const efMatch = bt.match(/Enrollment\s+\$?([\d,]+\.?\d*)/);
if (efMatch) {
  enrollFee = efMatch[1].replace(/,/g, "");
  totalEnrollment += Number(enrollFee);  // adds 0
}

// Line 196: BUG — totalEnrollment is 0, so this is skipped
if (totalEnrollment > 0) out.enrollmentFee = totalEnrollment.toFixed(2);
```

**Fix:** Track whether any enrollment line was found (boolean), separate from the dollar amount:
```typescript
let totalEnrollment = 0;
let enrollmentFound = false;  // NEW

// Inside the loop:
if (efMatch) {
  enrollFee = efMatch[1].replace(/,/g, "");
  totalEnrollment += Number(enrollFee);
  enrollmentFound = true;  // NEW
}

// Line 196: set fee when enrollment line was found (even if $0)
if (enrollmentFound) out.enrollmentFee = totalEnrollment.toFixed(2);
```

**Downstream effect:** When `out.enrollmentFee` is `"0.00"`, the form field populates with `0.00`. The API receives `enrollmentFee: 0`. In `payroll.ts:applyEnrollmentFee()` (line 55-83), fee=0 is below the $99 threshold, so `feeHalvingReason` is set to "Half commission - waived enrollment fee" (line 80) and the half-commission badge appears. The approve button logic checks for `feeHalvingReason` -- this flows correctly when the fee is explicitly 0.

**Fallback extraction (lines 216-222):** There is a secondary extraction at lines 216-222 that also has `if (ef > 0)`. This should also be updated to use `enrollmentFound` or a similar flag for consistency, though in the primary flow the product-block extraction at line 182 should already catch it.

### Fix 3: Sparkline Date Format (DASH-04) — API change

**File:** `apps/ops-api/src/routes/lead-timing.ts`
**Lines:** 201-205

**Current (buggy):**
```typescript
// Line 201: key function uses String(day) which on a Date object gives long format
const key = (lsId: string, day: string, dp: string) => `${lsId}:${day}:${dp}`;

// Lines 203-205: String(r.day) produces "Thu Apr 02 2026 00:00:00 GMT+0000"
for (const r of calls) callMap.set(key(r.leadSourceId, String(r.day), r.daypart), r.callCount);
for (const r of sales) saleMap.set(key(r.leadSourceId, String(r.day), r.daypart), r.saleCount);

// Lines 208-212: days array uses ISO format "2026-04-02"
days.push(d.toISOString().slice(0, 10));
```

**Fix options (Claude's Discretion):**

Option A -- JS post-processing (recommended): Normalize `r.day` to ISO format when building map keys:
```typescript
const toISO = (d: unknown): string => {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d).slice(0, 10); // handles string dates too
};
for (const r of calls) callMap.set(key(r.leadSourceId, toISO(r.day), r.daypart), r.callCount);
```

Option B -- SQL normalization: Cast to text in the SQL query with `TO_CHAR(... ::date, 'YYYY-MM-DD')`. This avoids the Prisma Date deserialization entirely.

**Recommendation:** Option A (JS normalization). It is a 3-line helper that handles the type mismatch without modifying the raw SQL query. The SQL queries are complex tagged templates; changing them risks introducing syntax errors. The JS fix is safer and easier to verify.

### Fix 4: Analytics Default Expand (DASH-03) — Frontend change

**File:** `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSection.tsx`
**Line:** 75

**Change:** `useState(false)` to `useState(true)`.

**Lazy loading with IntersectionObserver (D-11):**

The current useEffect at lines 84-99 fires when `expanded` becomes true. If we just flip the default to `true`, the API call fires immediately on mount (before the section may be in the viewport). Decision D-11 requests lazy loading.

**Implementation pattern:**
```typescript
const sectionRef = useRef<HTMLDivElement>(null);
const [visible, setVisible] = useState(false);

useEffect(() => {
  if (!sectionRef.current) return;
  const observer = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
    { threshold: 0.1 }
  );
  observer.observe(sectionRef.current);
  return () => observer.disconnect();
}, []);

// Modify the existing data-fetch useEffect to depend on `visible` instead of (or in addition to) `expanded`:
useEffect(() => {
  if (!expanded || !visible) return;
  // ... existing fetch logic
}, [expanded, visible, analyticsRange, groupBy, API]);
```

Attach `ref={sectionRef}` to the section wrapper `<div>`. The section renders expanded (content area visible) but data only fetches once the section scrolls into the viewport. The skeleton loaders show until data arrives.

**Browser support:** IntersectionObserver is supported in all modern browsers (Chrome 51+, Firefox 55+, Safari 12.1+, Edge 15+). No polyfill needed for this project's target audience (internal ops tool).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lazy section loading | Custom scroll event listener | `IntersectionObserver` | Native API, handles edge cases (resize, overflow), no performance penalty |
| Date formatting | Custom date parser | `toISOString().slice(0,10)` | Already used in the `days` array; reuse same approach for consistency |
| Pagination | New pagination mechanism | Existing Prisma cursor pagination | Already implemented and tested at lines 56-60 of call-audits.ts |

## Common Pitfalls

### Pitfall 1: Enrollment Fee Fallback Extraction
**What goes wrong:** Fixing line 196 but forgetting the fallback extraction at lines 216-222 which has the same `if (ef > 0)` bug.
**Why it happens:** The fallback is only reached when `out.enrollmentFee` is not set by the primary extraction. After fixing line 196, the fallback should rarely execute, but if it does, it would still have the same bug.
**How to avoid:** Update both paths. The fallback at 216-222 should also handle $0 correctly. Simplest: if `enrollmentFound` is true from the product-block loop, skip the fallback entirely.

### Pitfall 2: Sparkline Date Timezone Offset
**What goes wrong:** Using `new Date(r.day).toISOString().slice(0,10)` could shift the date by one day due to UTC conversion if the Date object has timezone information.
**Why it happens:** PostgreSQL `::date` returns a date without time, but JavaScript Date constructor may interpret it in local timezone, then `toISOString()` converts to UTC.
**How to avoid:** If `r.day` is already a Date object at midnight UTC, `toISOString().slice(0,10)` works correctly. If it has timezone offset, use manual extraction: `const d = r.day as Date; const iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');`. Alternatively, use `toLocaleDateString('sv-SE')` which returns ISO format, or the SQL-side `TO_CHAR` approach.

### Pitfall 3: Audit Limit Mismatch Frontend vs Backend
**What goes wrong:** API default limit is 25 (line 37), but decisions say "last 30 audits."
**Why it happens:** Frontend explicitly sends `limit=25` at line 156 of ManagerAudits.tsx.
**How to avoid:** Change frontend to send `limit=30`. Update it in both the initial fetch (line 156) and the loadMore function (line 174).

### Pitfall 4: IntersectionObserver Fires Immediately
**What goes wrong:** If the analytics section is already in the viewport on page load (e.g., on a tall monitor), the observer callback fires immediately, causing the API call before the user scrolls.
**Why it happens:** IntersectionObserver triggers the callback for the initial intersection check.
**How to avoid:** This is actually desired behavior -- if the section is visible, load the data. The lazy loading is meant to defer loading only when the section is below the fold.

### Pitfall 5: BigInt Serialization in Sparkline Response
**What goes wrong:** The `COUNT(*)::bigint` in the sparkline SQL returns BigInt values. The `toBigIntSafe` helper at line 197 already handles this conversion.
**Why it happens:** N/A -- already handled.
**How to avoid:** Do not remove or bypass the `toBigIntSafe` call when modifying the sparkline endpoint.

## Code Examples

### Audit Query Fix (exact change)
```typescript
// call-audits.ts lines 44-52 — REPLACE WITH:
const where: { callDate?: { gte: Date; lt: Date }; agentId?: string } = {};
if (dr) {
  where.callDate = { gte: dr.gte, lt: dr.lt };
}
// Removed: else if (!cursor) { 24-hour default }
// When no date range and no cursor, query returns most recent `limit` audits
if (qp.data.agentId) where.agentId = qp.data.agentId;
```

### Enrollment Fee Fix (exact change)
```typescript
// ManagerEntry.tsx — add boolean tracker alongside totalEnrollment
let totalEnrollment = 0;
let enrollmentFound = false;

// Inside product block loop, after efMatch check:
if (efMatch) {
  enrollFee = efMatch[1].replace(/,/g, "");
  totalEnrollment += Number(enrollFee);
  enrollmentFound = true;
}

// Replace line 196:
if (enrollmentFound) out.enrollmentFee = totalEnrollment.toFixed(2);
```

### Sparkline Date Normalization (exact change)
```typescript
// lead-timing.ts — add helper before map construction
const toISODate = (d: unknown): string => {
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d);
  // Handle "YYYY-MM-DD" strings that may already be correct
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return new Date(s).toISOString().slice(0, 10);
};

// Replace String(r.day) with toISODate(r.day) on lines 203-205:
for (const r of calls) callMap.set(key(r.leadSourceId as string, toISODate(r.day), r.daypart as string), r.callCount as number);
for (const r of sales) saleMap.set(key(r.leadSourceId as string, toISODate(r.day), r.daypart as string), r.saleCount as number);
```

### Analytics Lazy Load (IntersectionObserver pattern)
```typescript
// LeadTimingSection.tsx — add refs and visibility state
const sectionRef = useRef<HTMLDivElement>(null);
const [visible, setVisible] = useState(false);

// Change expanded default
const [expanded, setExpanded] = useState(true);

// Add IntersectionObserver effect
useEffect(() => {
  const el = sectionRef.current;
  if (!el) return;
  const obs = new IntersectionObserver(
    ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
    { threshold: 0.1 }
  );
  obs.observe(el);
  return () => obs.disconnect();
}, []);

// Modify existing data-fetch effect (line 84):
useEffect(() => {
  if (!expanded || !visible) return;
  // ... rest of existing fetch logic unchanged
}, [expanded, visible, analyticsRange, groupBy, API]);

// Add ref to wrapper div:
// <div ref={sectionRef} style={SECTION_WRAP}>
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest |
| Config file | `apps/ops-api/jest.config.ts` |
| Quick run command | `npm test -- --testPathPattern=PATTERN -x` |
| Full suite command | `npm test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Audit query returns last 30 without date filter | manual | Verify API returns audits from >24h ago | N/A (route test) |
| DASH-02 | Per-agent audit also uses rolling window | manual | Same endpoint with agentId param | N/A (route test) |
| DASH-03 | Analytics section starts expanded | manual | Visual check -- section visible on load | N/A (UI) |
| DASH-04 | Sparkline date keys match days array | unit | `npm test -- --testPathPattern=sparkline -x` | No -- Wave 0 |
| PAY-04 | $0 enrollment fee parsed and set | unit | `npm test -- --testPathPattern=receipt-parser -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** Visual verification for UI changes; `npm test` for API changes
- **Per wave merge:** `npm test` full suite
- **Phase gate:** Full suite green + manual verification of all 5 success criteria

### Wave 0 Gaps
- [ ] `apps/ops-api/src/services/__tests__/sparkline-date.test.ts` -- unit test for `toISODate` helper verifying Date object and string inputs produce ISO format
- [ ] `apps/ops-dashboard/__tests__/receipt-parser.test.ts` -- unit test for `parseReceipt` with $0 enrollment fee receipt (note: may not be feasible if parseReceipt is not exported; if so, test manually)

Note: The route-level tests (DASH-01, DASH-02) would require integration test setup with database mocking, which is beyond the scope of these quick fixes. The sparkline date normalization and receipt parser fixes are pure functions that can be unit tested if extracted.

## Open Questions

1. **Sparkline timezone edge case**
   - What we know: PostgreSQL `::date` cast returns date in the session timezone. Prisma deserializes as JS Date at midnight UTC.
   - What's unclear: Whether the server timezone could cause `toISOString()` to shift the date. In Node.js, `Date` objects from Prisma raw queries are typically UTC midnight, so `toISOString().slice(0,10)` should be correct.
   - Recommendation: Use `toISOString().slice(0,10)` as primary approach. If dates appear shifted by one day during testing, fall back to `TO_CHAR` in SQL.

2. **Frontend limit parameter value**
   - What we know: D-01 says "last 30 audits" but frontend sends `limit=25`.
   - Recommendation: Update frontend to `limit=30` to match the decision. This is a 1-line change in ManagerAudits.tsx at line 156 and line 174.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `apps/ops-api/src/routes/call-audits.ts` -- confirmed 24-hour default at lines 48-51
- Direct code inspection of `apps/ops-dashboard/app/(dashboard)/manager/ManagerEntry.tsx` -- confirmed `if (totalEnrollment > 0)` at line 196
- Direct code inspection of `apps/ops-api/src/routes/lead-timing.ts` -- confirmed `String(r.day)` vs `toISOString().slice(0,10)` mismatch at lines 201-213
- Direct code inspection of `apps/ops-dashboard/app/(dashboard)/manager/LeadTimingSection.tsx` -- confirmed `useState(false)` at line 75
- Direct code inspection of `apps/ops-api/src/services/payroll.ts` -- confirmed `applyEnrollmentFee()` correctly handles `fee=0` (halves commission)

### Secondary (MEDIUM confidence)
- IntersectionObserver API compatibility: widely documented, supported in all modern browsers

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all existing code
- Architecture: HIGH -- all bugs precisely located with exact line numbers and root causes confirmed
- Pitfalls: HIGH -- edge cases identified through direct code analysis

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable codebase, bug fixes only)
