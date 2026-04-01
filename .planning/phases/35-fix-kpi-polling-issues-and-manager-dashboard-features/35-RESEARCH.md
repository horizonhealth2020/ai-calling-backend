# Phase 35: Fix KPI Polling Issues and Manager Dashboard Features - Research

**Researched:** 2026-03-31
**Domain:** Bug fixes — timezone handling, date range UI, round robin fairness
**Confidence:** HIGH

## Summary

Phase 35 is a collection of bug fixes and adjustments to existing features. No new capabilities are introduced. The changes span three layers: (1) a backend timezone bug in the KPI poller business hours check, (2) frontend date range filter improvements including a "Today" preset, per-dashboard scoping, removing the redundant Today column from Manager Tracker, and defaulting Owner KPIs to "Today", and (3) investigation and fix of CS round robin assignment fairness.

The API already supports `range=today` in the `dateRange()` helper (`apps/ops-api/src/routes/helpers.ts:40-44`), so the "Today" preset only needs frontend wiring. The per-dashboard scoping requires replacing the single global `DateRangeProvider` in `layout.tsx` with per-component state. The round robin code is transactional but the client-side fallback always starts from index 0, which is a likely contributor to uneven distribution.

**Primary recommendation:** These are independent, well-scoped fixes. Each can be implemented and verified in isolation. The timezone fix is the highest priority (it delays polling by 3 hours daily).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Business hours check in `convosoKpiPoller.ts:316` must use `America/New_York` instead of `America/Los_Angeles`
- D-02: `convosoDateToUTC()` stays as-is -- Convoso timestamps are genuinely Pacific time
- D-03: No timezone setting UI -- hardcode `America/New_York` to match payroll.ts, auditQueue.ts, lead-timing.ts
- D-04: Add `{ key: "today", label: "Today" }` as first entry in `KPI_PRESETS` in `packages/ui/src/components/DateRangeFilter.tsx`. New order: Today, Current Week, Last Week, 30 Days, Custom
- D-05: API `buildDateParams()` helper in each dashboard must handle the `"today"` preset key
- D-06: Remove "Today" column (todaySalesCount, todayPremium) from Manager Tracker table
- D-07: Remove Today columns from CSV export header row
- D-08: Owner KPIs defaults to "Today" preset instead of "Current Week"
- D-09: Global `DateRangeProvider` in `layout.tsx:188` causes date ranges to persist across tabs -- each dashboard should manage its own state
- D-10: Move `DateRangeProvider` inside each dashboard page, or use keyed/scoped approach. Manager Tracker defaults to "Today", Owner KPIs defaults to "Today", CS and others keep "Current Week"
- D-11: Investigate and fix round robin fairness in `repSync.ts` -- check index sync on rep add/remove, local fallback bypass, rapid submission races

### Claude's Discretion
- Exact implementation of per-dashboard date range scoping (separate providers vs. keyed context vs. local useState)
- Whether to extract a shared `BUSINESS_TIMEZONE` constant
- Round robin fix approach once root cause is identified

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| luxon | (existing) | Timezone-aware date/time for poller business hours | Already used in convosoKpiPoller.ts and payroll.ts |
| React Context | (built-in) | Per-dashboard date range state management | Already used via DateRangeContext.tsx |
| Prisma | (existing) | Transaction-safe round robin index persistence | Already used in repSync.ts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ops/ui | (workspace) | KPI_PRESETS, DateRangeFilter component | Shared preset definition consumed by all dashboards |
| @ops/auth/client | (workspace) | authFetch for API calls | Used by CSSubmissions.tsx for batch-assign endpoint |

## Architecture Patterns

### Pattern 1: Timezone Constant Extraction
**What:** Extract `BUSINESS_TIMEZONE = 'America/New_York'` as a shared constant
**When to use:** When multiple files use the same timezone for business logic (not Convoso parsing)
**Recommendation:** Create the constant in a shared location. Currently `America/New_York` appears in:
- `apps/ops-api/src/services/payroll.ts:5`
- `apps/ops-api/src/services/auditQueue.ts:312-314`
- `apps/ops-api/src/routes/lead-timing.ts:61-76`
- `apps/ops-api/src/workers/convosoKpiPoller.ts:316` (currently wrong -- uses LA)

A simple approach: add `export const BUSINESS_TIMEZONE = 'America/New_York';` to a shared constants file in ops-api (e.g., `apps/ops-api/src/constants.ts`) and import it. This is NOT a cross-package concern since all consumers are in ops-api.

### Pattern 2: Per-Dashboard Date Range State (Recommended: Local useState)
**What:** Replace global DateRangeProvider with local state in each dashboard component
**Why this approach:** The current `DateRangeContext` is trivially simple (25 lines, just wraps useState). Each consumer already destructures `{ value, onChange }`. Replacing `useDateRange()` with a local `useState` in each dashboard component is the smallest change with zero risk of state leaking between tabs.

**Implementation:**
```typescript
// In each dashboard component (ManagerTracker, OwnerKPIs, OwnerOverview, OwnerScoring, CSTracking)
// BEFORE:
const { value: dateRange, onChange: setDateRange } = useDateRange();

// AFTER:
const [dateRange, setDateRange] = useState<DateRangeFilterValue>({ preset: "today" }); // or "week" per dashboard
```

**Consumers that need updating (6 total):**
1. `apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx:101` -- default: "today"
2. `apps/ops-dashboard/app/(dashboard)/owner/OwnerKPIs.tsx:206` -- default: "today"
3. `apps/ops-dashboard/app/(dashboard)/owner/OwnerOverview.tsx:352` -- default: "week"
4. `apps/ops-dashboard/app/(dashboard)/owner/OwnerScoring.tsx:289` -- default: "week"
5. `apps/ops-dashboard/app/(dashboard)/cs/CSTracking.tsx:168` -- default: "week"
6. `apps/ops-dashboard/app/(dashboard)/layout.tsx:188` -- remove DateRangeProvider wrapper

After all consumers are updated, the `DateRangeContext.tsx` file and its import in `layout.tsx` can be removed.

### Pattern 3: API Already Supports "today" Range
**What:** The `dateRange()` helper in `apps/ops-api/src/routes/helpers.ts:40-44` already handles `range=today`, and the Zod schema `dateRangeQuerySchema` already includes `"today"` as a valid enum value.
**Impact:** No API changes needed for the "today" preset. Only the frontend `KPI_PRESETS` array and per-dashboard defaults need updating.

### Anti-Patterns to Avoid
- **Don't use keyed providers:** A `DateRangeProvider key={tabName}` approach adds unnecessary complexity when simple useState works.
- **Don't create a per-dashboard context:** Each dashboard component already renders its own `DateRangeFilter`; local state is sufficient.
- **Don't change convosoDateToUTC:** The Convoso API genuinely returns Pacific timestamps. The business hours check and the Convoso timestamp parsing are separate concerns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date range calculation for "today" | Custom today logic in frontend | API's existing `dateRange("today")` | Already implemented, tested, and used by Zod schema |
| Timezone-aware business hours | Manual hour arithmetic | `luxon` `DateTime.now().setZone()` | DST transitions handled correctly by IANA database |
| Atomic round robin index | Custom locking mechanism | Prisma `$transaction` | Already used, provides serializable reads within transaction |

## Common Pitfalls

### Pitfall 1: dateRange() Uses Server Local Time, Not Eastern
**What goes wrong:** The `dateRange()` helper in `helpers.ts` uses `new Date()` which is server-local time (UTC on Railway). When `range=today` is requested, "today" is computed as UTC day, which may differ from Eastern day.
**Why it happens:** The helper was written for week/30d ranges where a few hours offset is negligible; for "today" the boundary matters.
**How to avoid:** Verify that the existing `range=today` path produces correct boundaries for Eastern business day. If it's UTC-based and the server runs in UTC, sales entered at 11 PM Eastern on Monday would appear as Tuesday in UTC. This may already be acceptable since sales have their own `saleDate` field; confirm with existing behavior.
**Warning signs:** Sales appearing in wrong "Today" bucket near midnight Eastern.

### Pitfall 2: Removing Today Column Before Adding Today Preset
**What goes wrong:** If the Today column is removed from Manager Tracker before the "Today" date range preset is available, managers lose their at-a-glance today view temporarily.
**How to avoid:** Ensure the "Today" preset is wired in the same plan as the column removal, or add the preset first.

### Pitfall 3: Round Robin Local Fallback Bias
**What goes wrong:** The client-side fallback in `CSSubmissions.tsx:441-444` always assigns starting from index 0 of the active reps array. If the API call fails intermittently, the first rep gets disproportionately more assignments.
**Why it happens:** The fallback was designed as a graceful degradation but doesn't track the server-side index.
**How to avoid:** Either (a) remove the local fallback entirely and show an error when the API is unreachable, or (b) cache the last known server index in component state and use it for the fallback start position.

### Pitfall 4: Round Robin Index Stale After Rep Roster Change
**What goes wrong:** The persisted index (e.g., 5) could be larger than the new active rep count (e.g., 3 reps) after deactivating reps. The code at `repSync.ts:100` does `currentIndex % activeReps.length` which handles this correctly with modulo. However, if the alphabetical ordering changes when a rep is added/removed, the same index now points to a different rep -- assignments may cluster.
**Why it happens:** `orderBy: { name: "asc" }` means the ordering is position-dependent on the full set of active reps. Adding "Alice" to a roster of ["Bob", "Charlie"] shifts Bob to index 1 and Charlie to index 2.
**How to avoid:** This is inherent to index-based round robin with dynamic rosters. The modulo handles out-of-bounds safely. Some clustering after roster changes is acceptable for a small team (3 reps). Document this as known behavior rather than treating it as a bug.

## Code Examples

### Fix: Poller Business Hours Timezone
```typescript
// apps/ops-api/src/workers/convosoKpiPoller.ts line 316
// BEFORE:
const now = DateTime.now().setZone("America/Los_Angeles");

// AFTER:
const now = DateTime.now().setZone("America/New_York");
```

### Fix: Add "Today" to KPI_PRESETS
```typescript
// packages/ui/src/components/DateRangeFilter.tsx
export const KPI_PRESETS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Current Week" },
  { key: "last_week", label: "Last Week" },
  { key: "30d", label: "30 Days" },
  { key: "custom", label: "Custom" },
];
```

### Fix: Per-Dashboard Date Range (Manager Tracker example)
```typescript
// apps/ops-dashboard/app/(dashboard)/manager/ManagerTracker.tsx
// Remove: import { useDateRange } from "@/lib/DateRangeContext";
// Add: import { useState } from "react";
import type { DateRangeFilterValue } from "@ops/ui";

export default function ManagerTracker({ API, tracker, setTracker, highlightedAgentNames }: ManagerTrackerProps) {
  const [dateRangeCtx, setDateRangeCtx] = useState<DateRangeFilterValue>({ preset: "today" });
  // ... rest unchanged
}
```

### Fix: Remove Today Column from Manager Tracker
```typescript
// Remove from TrackerEntry type in manager/page.tsx:
// todaySalesCount: number; todayPremium: number;

// Remove from table header array:
// ["Rank", "Agent", "Calls", "Sales", "Premium Total", "Lead Spend", "Cost / Sale"]

// Remove the <td> that renders todaySalesCount/todayPremium (lines 190-193)

// Remove from CSV export header and data rows (lines 64, 68-69)
```

### Fix: Round Robin Client Fallback
```typescript
// apps/ops-dashboard/app/(dashboard)/cs/CSSubmissions.tsx
// Option A: Remove fallback, surface error
const fetchBatchAssign = async (type: "chargeback" | "pending_term", count: number): Promise<string[]> => {
  const res = await authFetch(`${API}/api/reps/batch-assign?type=${type}&count=${count}`);
  if (res.ok) {
    const data = await res.json();
    return data.assignments ?? [];
  }
  throw new Error(`Assignment failed (${res.status})`);
};

// Option B: Keep fallback but distribute more fairly
// Fallback: local round-robin starting from random offset
const active = repsRef.current.filter((r) => r.active).map((r) => r.name);
if (active.length === 0) return Array(count).fill("");
const offset = Math.floor(Math.random() * active.length);
return Array.from({ length: count }, (_, i) => active[(offset + i) % active.length]);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global DateRangeProvider wrapping all dashboards | Per-dashboard local useState | Phase 35 | Date ranges no longer leak between tabs |
| Pacific time for business hours check | Eastern time for business hours check | Phase 35 | Poller starts at correct time (09:00 ET, not 12:00 ET) |
| Dedicated "Today" column in tracker | "Today" as a date range filter preset | Phase 35 | Consistent UX, one mechanism for date filtering |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (Morgan service only) |
| Config file | `apps/morgan/jest.config.js` |
| Quick run command | `npm test` |
| Full suite command | `npm run test:coverage` |

Note: The ops-api and ops-dashboard apps do NOT have test infrastructure. All Phase 35 changes are in ops-api (poller, repSync) and ops-dashboard (UI components). Manual verification is required.

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Poller uses America/New_York for business hours | manual | Verify via poller log output after deploy | N/A |
| D-04 | KPI_PRESETS includes "today" as first entry | manual | Visual check in browser | N/A |
| D-06 | Today column removed from Manager Tracker | manual | Visual check in browser | N/A |
| D-08 | OwnerKPIs defaults to "today" | manual | Visual check -- OwnerKPIs loads with Today selected | N/A |
| D-09 | Date range scoped per dashboard | manual | Switch tabs, verify range resets to dashboard default | N/A |
| D-11 | Round robin fairness improved | manual | Submit multiple batches, verify distribution | N/A |

### Sampling Rate
- **Per task commit:** Manual browser verification
- **Per wave merge:** Full ops-dashboard build (`npm run dashboard:dev` and visual check)
- **Phase gate:** All 6 behaviors visually verified

### Wave 0 Gaps
None -- no existing test infrastructure for ops-api or ops-dashboard. Test infrastructure is out of scope for this bug-fix phase.

## Open Questions

1. **dateRange() UTC vs Eastern for "today" range**
   - What we know: `dateRange("today")` in `helpers.ts:38-44` uses `new Date()` which is server-local time (UTC on Railway)
   - What's unclear: Whether UTC-based "today" boundaries are acceptable or need Eastern-aware logic
   - Recommendation: Accept UTC-based for now. Sales have explicit `saleDate` timestamps. The "today" filter is a convenience, not a payroll-critical boundary. Can revisit if users report wrong grouping near midnight.

2. **Round robin root cause specificity**
   - What we know: The local fallback always starts at index 0; the server-side code uses modulo correctly; roster changes shift indices
   - What's unclear: Whether the API actually fails in practice (triggering the fallback) or if the unevenness is purely from roster changes
   - Recommendation: Add console.warn in the fallback path to make it observable, then fix the fallback regardless (low risk)

## Sources

### Primary (HIGH confidence)
- Direct code reading: `convosoKpiPoller.ts:316` -- confirmed `America/Los_Angeles` timezone bug
- Direct code reading: `helpers.ts:40-44` -- confirmed `range=today` already handled server-side
- Direct code reading: `DateRangeContext.tsx` -- confirmed single global provider with `preset: "week"` default
- Direct code reading: `DateRangeFilter.tsx:58-63` -- confirmed KPI_PRESETS lacks "today" entry
- Direct code reading: `repSync.ts:84-151` -- confirmed round robin logic with modulo safety
- Direct code reading: `CSSubmissions.tsx:441-444` -- confirmed local fallback starts at index 0
- Direct code reading: All 5 `useDateRange()` consumers identified via grep

### Secondary (MEDIUM confidence)
- User-reported poller log showing `currentTime: 06:07` (Pacific) vs `businessHours: 09:00-18:00` (Eastern) -- confirms the bug symptoms

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use, no new dependencies
- Architecture: HIGH -- changes are targeted fixes to existing code with clear patterns
- Pitfalls: HIGH -- root causes identified through direct code reading

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable codebase, no external dependency changes)
