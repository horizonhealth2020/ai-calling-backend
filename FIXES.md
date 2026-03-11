# Fixes Applied

---

## Ops Platform Fix: Railway Deployment Crash + "Failed to Add" Errors

Date: 2026-03-11

### Problem
All Railway services crashed after `output: "standalone"` was hardcoded in every `next.config.js`. Next.js `next start` (used by Railway) is incompatible with standalone output mode. With all services down, dashboard API calls received HTML error pages from Railway's reverse proxy instead of JSON. Dashboards parsed these with `res.json().catch(() => ({}))`, got an empty object with no `error` field, and displayed generic "Failed to add" messages.

### Root Cause
- `output: "standalone"` in `next.config.js` → `next start` fails with: `"next start" does not work with "output: standalone" configuration`
- Zod validation errors returned `parsed.error.flatten()` → `{ formErrors, fieldErrors }` format with no `error` key → dashboards showed generic fallback messages

### Fix Applied
1. **Conditional standalone output** — All 5 `next.config.js` files changed from `output: "standalone"` to `output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined`. Only Docker builds set this env var (`Dockerfile.nextjs`). Railway doesn't set it, so `next start` works.
2. **`zodErr()` helper** — All Zod error responses wrapped to always include `{ error: "message", details: {...} }` so dashboards can display the actual validation error.
3. **Status code in error messages** — Dashboard fallback messages changed from `"Failed to add agent"` to `` `Request failed (${res.status})` `` for debuggability.

### Files Changed
- `apps/{auth-portal,manager-dashboard,payroll-dashboard,owner-dashboard,sales-board}/next.config.js`
- `Dockerfile.nextjs`
- `apps/ops-api/src/routes/index.ts`
- `apps/manager-dashboard/app/page.tsx`
- `apps/payroll-dashboard/app/page.tsx`

### Prevention
- Never hardcode `output: "standalone"` in `next.config.js` — always use the conditional env check
- Always use `zodErr(parsed.error)` for Zod validation error responses, never raw `.flatten()`
- Always show HTTP status codes in dashboard error fallbacks

---

# Morgan Voice Service Fixes

Date: 2026-02-05

## Overview

Three critical issues from [ISSUES.md](ISSUES.md) have been fixed:

1. ✅ Race condition in queue processor
2. ✅ Memory leak in `morganQueuedIds` Set
3. ✅ Single-lead-per-tick bottleneck

---

## Fix #1: Race Condition Eliminated

### Problem
The `isLaunchingCall` flag was used to prevent concurrent tick execution, but it had a race condition:

```javascript
if (isLaunchingCall) return;  // Check
// ... gap ...
isLaunchingCall = true;       // Set
```

Multiple ticks could pass the check before any set the flag, causing race conditions.

### Solution
**Removed the global lock entirely** and restructured the queue processor:

- ❌ Removed: `isLaunchingCall` flag
- ✅ Added: Per-slot async processing with `Promise.allSettled()`
- ✅ Added: `launchCallForSlot()` helper function for isolated call launching

**Benefits:**
- No race conditions - each slot is handled independently
- Better concurrency - multiple slots can launch calls simultaneously
- Cleaner code - each call launch is isolated and testable

### Code Changes

**Before:**
```javascript
if (isLaunchingCall) return;
const lead = await getNextMorganLead();
isLaunchingCall = true;
try {
  // launch one call
} finally {
  isLaunchingCall = false;
}
```

**After:**
```javascript
const callPromises = [];
for (const freeSlotId of freeSlots) {
  const lead = await getNextMorganLead();
  callPromises.push(launchCallForSlot(freeSlotId, lead));
}
await Promise.allSettled(callPromises);
```

---

## Fix #2: Memory Leak Prevention

### Problem
`morganQueuedIds` Set grew indefinitely with no upper bound. Over weeks/months of operation, this would consume increasing memory.

### Solution
Implemented **LRU-style cleanup** with bounded size:

1. **Added constants:**
   - `MAX_QUEUED_IDS = 10,000` - Maximum Set size
   - `morganQueuedIdsTimestamps` - Map to track when each ID was added

2. **Added cleanup function:**
   - `cleanupOldQueuedIds()` - Removes oldest 10% of IDs when limit reached
   - Only removes IDs not currently in the active queue
   - Cleans both the Set and the timestamp Map

3. **Integrated cleanup:**
   - Called automatically in `enqueueMorganLead()` when approaching limit
   - Clears timestamps on dequeue, hydration, and merge

### Code Changes

**New global state:**
```javascript
const MAX_QUEUED_IDS = 10000;
const morganQueuedIdsTimestamps = new Map();
```

**Cleanup logic:**
```javascript
function cleanupOldQueuedIds() {
  const entriesToRemove = Math.floor(MAX_QUEUED_IDS * 0.1);
  const sorted = Array.from(morganQueuedIdsTimestamps.entries())
    .sort((a, b) => a[1] - b[1]);

  let removed = 0;
  for (const [leadId] of sorted) {
    if (removed >= entriesToRemove) break;
    const inQueue = morganQueue.some(lead => lead.id === leadId);
    if (!inQueue) {
      morganQueuedIds.delete(leadId);
      morganQueuedIdsTimestamps.delete(leadId);
      removed++;
    }
  }
  logger.info(`[MorganQueue] Cleaned up ${removed} old queued IDs`);
}
```

**Modified functions:**
- `enqueueMorganLead()` - Calls cleanup if needed, tracks timestamps
- `getNextMorganLead()` - Deletes timestamps on dequeue
- `hydrateMorganQueueFromConvoso()` - Clears timestamps on hydration
- `mergeMorganQueueFromMQ()` - Tracks timestamps for new leads

**Benefits:**
- Bounded memory usage (max ~10k entries in Set)
- Automatic cleanup of old entries
- Preserves active queue entries (never removes in-flight leads)
- Logged cleanup for monitoring

---

## Fix #3: Single-Lead-Per-Tick Bottleneck

### Problem
The queue processor only launched **one call per tick**, even when multiple slots were free:

```javascript
const freeSlots = getFreeMorganSlots();  // e.g., [slot-1, slot-2, slot-3]
const lead = await getNextMorganLead();  // Only processes ONE lead
```

With 3 slots and a 2-second tick interval, maximum throughput was **30 calls/minute** instead of **90 calls/minute**.

### Solution
**Process all free slots in parallel:**

1. Loop through all free slots
2. Dequeue one lead per slot
3. Launch all calls concurrently using `Promise.allSettled()`
4. Log aggregated results

### Code Changes

**Before:**
```javascript
const freeSlots = getFreeMorganSlots();
const lead = await getNextMorganLead();
// Only uses freeSlots[0]
```

**After:**
```javascript
const freeSlots = getFreeMorganSlots();
const callPromises = [];

for (const freeSlotId of freeSlots) {
  if (morganQueue.length === 0) break;

  const lead = await getNextMorganLead();
  if (!lead || !lead.phone) continue;

  callPromises.push(launchCallForSlot(freeSlotId, lead));
}

await Promise.allSettled(callPromises);
```

**Benefits:**
- **3x throughput** - All slots utilized simultaneously
- Graceful handling of empty queue (breaks loop)
- Better error isolation - one failed call doesn't block others
- Clearer logging - shows total calls launched per tick

---

## Testing

Added comprehensive test suite in [__tests__/queueProcessor.test.js](__tests__/queueProcessor.test.js):

### Test Coverage

1. **Memory Leak Prevention**
   - ✅ Enforces MAX_QUEUED_IDS limit
   - ✅ Cleanup doesn't remove active queue IDs
   - ✅ LRU eviction of oldest entries

2. **Concurrent Call Processing**
   - ✅ Processes multiple leads when slots are free
   - ✅ Handles partial failures gracefully
   - ✅ Stops when queue is empty

3. **Race Condition Elimination**
   - ✅ Allows concurrent tick execution
   - ✅ Promise.allSettled handles failures correctly

4. **Timestamp Tracking**
   - ✅ Tracks timestamps for cleanup
   - ✅ Cleans up timestamps on dequeue

### Run Tests

```bash
npm test queueProcessor.test.js
```

---

## Performance Impact

### Throughput Improvement

**Before:**
- Max 1 call per 2-second tick
- Max throughput: 30 calls/minute

**After:**
- Max 3 calls per 2-second tick
- Max throughput: 90 calls/minute
- **3x improvement** 🚀

### Memory Impact

**Before:**
- Unbounded `morganQueuedIds` Set
- Potential for multi-MB growth over time

**After:**
- Bounded to ~10k entries
- Additional ~10k entries in timestamp Map
- Approximately **320 KB max** (10k × 32 bytes per entry × 2 structures)
- Acceptable overhead for production

---

## Migration Notes

### Breaking Changes
None - API and behavior remain the same for external callers.

### Configuration
No new environment variables required.

### Monitoring

Watch for new log messages:
```
[MorganQueue] Cleaned up N old queued IDs to prevent memory leak
```

If you see this frequently (multiple times per day), consider:
1. Investigating why so many unique leads are being queued
2. Increasing `MAX_QUEUED_IDS` if needed
3. Reviewing lead filtering logic

---

## Validation Checklist

- [x] Code compiles without errors
- [x] Tests added for all three fixes
- [x] Tests pass locally
- [x] No breaking changes to API
- [x] Logging added for monitoring
- [x] Documentation updated (this file)
- [ ] Tested in staging environment (recommended before production)
- [ ] Production deployment plan reviewed

---

## Remaining Issues

See [ISSUES.md](ISSUES.md) for remaining medium and low severity issues:

**Next priorities:**
1. Add environment variable validation on startup (medium)
2. Implement webhook input validation (medium)
3. Add rate limiting to webhooks (medium)
4. Refactor monolithic index.js (low)

---

## References

- Original issue report: [ISSUES.md](ISSUES.md)
- Test suite: [__tests__/queueProcessor.test.js](__tests__/queueProcessor.test.js)
- Modified file: [index.js](index.js) (lines 40-45, 119-195, 461-641, 1169-1333)
