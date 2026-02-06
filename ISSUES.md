# Code Issues Report

Generated: 2026-02-05

## Critical Issues

### 1. Race Condition in Queue Processor ([index.js:1187-1195](index.js#L1187-L1195))
**Severity:** High
**Issue:** The `isLaunchingCall` flag check and set are not atomic, allowing potential race conditions.

```javascript
if (isLaunchingCall) return;
// ... other code ...
isLaunchingCall = true;
```

**Impact:** Could lead to multiple simultaneous call launches, exceeding rate limits.

**Fix:** Use proper locking mechanism or process queue sequentially.

---

### 2. Memory Leak in Queue ID Tracking ([index.js:41](index.js#L41))
**Severity:** High
**Issue:** `morganQueuedIds` Set grows indefinitely and is never cleaned up.

```javascript
const morganQueuedIds = new Set();
```

**Impact:** Long-running process will accumulate IDs, eventually causing memory issues.

**Fix:** Implement periodic cleanup or use TTL-based cache (e.g., LRU cache).

---

### 3. Queue Processes Only One Lead Per Tick ([index.js:1192](index.js#L1192))
**Severity:** Medium
**Issue:** Even when multiple slots are free, only one lead is processed per tick.

```javascript
const freeSlots = getFreeMorganSlots();
if (!freeSlots || freeSlots.length === 0) return;
const lead = await getNextMorganLead(); // Only processes ONE
```

**Impact:** Inefficient queue processing, artificial bottleneck.

**Fix:** Loop through all free slots and launch calls concurrently.

---

### 4. No Environment Variable Validation on Startup
**Severity:** Medium
**Issue:** App starts without validating required env vars, causing runtime errors.

**Required vars:**
- `CONVOSO_AUTH_TOKEN`
- `VAPI_API_KEY`
- `VAPI_MORGAN_ASSISTANT_ID`
- `VAPI_PHONE_NUMBER_IDS` or `VAPI_PHONE_NUMBER_ID`

**Impact:** Silent failures, difficult debugging.

**Fix:** Add startup validation function.

---

### 5. Potential Memory Leak in Call Slot Tracking ([index.js:61](index.js#L61))
**Severity:** Medium
**Issue:** `morganCallToSlot` Map never cleans up failed/hung calls properly.

```javascript
const morganCallToSlot = new Map();
```

**Impact:** If calls fail without proper cleanup, entries remain in memory.

**Fix:** Implement timeout-based cleanup in polling logic.

---

## Error Handling Issues

### 6. Inconsistent 429 Error Handling ([voiceGateway.js:148-150](voiceGateway.js#L148-L150))
**Severity:** Medium
**Issue:** Error status check relies on both `statusCode` property and string matching.

```javascript
if (err && (err.statusCode === 429 || String(err.message || "").includes("429"))) {
```

**Impact:** May not catch all 429 errors correctly.

**Fix:** Standardize error object structure.

---

### 7. No Retry Logic for Failed Convoso Updates
**Severity:** Medium
**Issue:** If Convoso update fails after max retries, lead state becomes inconsistent.

**Location:** [index.js:235-246](index.js#L235-L246)

**Impact:** Leads may be stuck in wrong status, causing duplicate calls or lost leads.

**Fix:** Implement dead letter queue or manual reconciliation endpoint.

---

### 8. Silent Failures in Webhook Endpoints
**Severity:** Low
**Issue:** Several endpoints return 200 OK even on errors.

**Example:** [index.js:1165](index.js#L1165) - Vapi webhook catches errors but returns 200

**Impact:** External systems won't know about failures.

**Fix:** Return appropriate error codes while maintaining idempotency.

---

## Data Validation Issues

### 9. No Input Validation on Webhook Payloads
**Severity:** Medium
**Issue:** Webhook endpoints trust all incoming data without validation.

**Locations:**
- [index.js:909-1011](index.js#L909-L1011) - Convoso webhook
- [index.js:1102-1167](index.js#L1102-L1167) - Vapi webhook
- [index.js:1375-1526](index.js#L1375-L1526) - sendLeadNote tool

**Impact:** Could cause crashes, data corruption, or security issues.

**Fix:** Add schema validation (e.g., Joi, Zod).

---

### 10. Unsafe String-to-Number Conversion ([index.js:323-327](index.js#L323-L327))
**Severity:** Low
**Issue:** `Number()` conversion returns `NaN` for invalid input, which is truthy in some contexts.

```javascript
const callCount = rawCalled == null || rawCalled === ""
  ? null
  : Number(rawCalled);
```

**Impact:** `NaN` values may cause logic errors downstream.

**Fix:** Validate numeric conversion or use `parseInt()` with radix.

---

## Configuration Issues

### 11. Phone Number Count Not Enforced ([index.js:51-56](index.js#L51-L56))
**Severity:** Low
**Issue:** App warns about not having exactly 3 phone numbers but continues anyway.

```javascript
if (MORGAN_PHONE_NUMBER_IDS.length !== 3) {
  logger.warn("Expected exactly 3 VAPI_PHONE_NUMBER_IDS...");
}
```

**Impact:** Slot logic assumes 3 slots, mismatch could cause issues.

**Fix:** Either enforce 3 numbers or make slot system dynamic.

---

### 12. Missing .env.example File
**Severity:** Low
**Issue:** No template for required environment variables.

**Impact:** Difficult for new developers to set up project.

**Fix:** Create `.env.example` with all required vars.

---

## Performance Issues

### 13. Inefficient Queue Hydration on Every Startup
**Severity:** Low
**Issue:** Fetches all MQ leads from Convoso on startup, could be slow with large datasets.

**Location:** [index.js:443-511](index.js#L443-L511)

**Impact:** Slow startup time, potential timeout.

**Fix:** Add pagination or limit, implement background hydration.

---

### 14. Synchronous Queue Processing ([index.js:266-282](index.js#L266-L282))
**Severity:** Low
**Issue:** Convoso request queue processes requests one-at-a-time with fixed delays.

**Impact:** Slow updates when many leads need status changes.

**Fix:** Batch updates or increase concurrency with rate limiting.

---

## Code Quality Issues

### 15. Monolithic index.js File (1,562 lines)
**Severity:** Low
**Issue:** Single file contains all application logic.

**Impact:** Hard to maintain, test, and review.

**Recommendation:** Refactor into modules:
- `routes/` - Express routes
- `services/` - Business logic
- `models/` - Data structures
- `utils/` - Helper functions

---

### 16. Mixed Logging Approaches
**Severity:** Low
**Issue:** Some code uses `logger` (lines 22-34), some uses `console.log` directly.

**Impact:** Inconsistent log formatting, difficult to configure log levels.

**Fix:** Use `logger` consistently throughout codebase.

---

### 17. Global Mutable State
**Severity:** Low
**Issue:** Multiple global variables for queue state.

**Examples:**
- `morganQueue` (line 40)
- `morganQueuedIds` (line 41)
- `morganSlots` (line 59)
- `isLaunchingCall` (line 43)

**Impact:** Hard to test, potential for bugs, no concurrency control.

**Recommendation:** Encapsulate in a class or use state management pattern.

---

## Security Considerations

### 18. Auth Token in Query String ([index.js:221-224](index.js#L221-L224))
**Severity:** Low (by Convoso API design)
**Issue:** Convoso API requires auth token in GET request query string.

```javascript
const url = `https://api.convoso.com/v1/leads/update?${params.toString()}`;
```

**Impact:** Auth tokens may appear in server logs, proxy logs.

**Note:** This is a Convoso API design issue, not in our control. Code does mask it in logs.

---

### 19. No Rate Limiting on Webhook Endpoints
**Severity:** Medium
**Issue:** Webhook endpoints have no rate limiting or authentication.

**Impact:** Vulnerable to DoS attacks or webhook spam.

**Fix:** Add rate limiting middleware and webhook signature verification.

---

## Testing Issues

### 20. No Test Suite
**Severity:** High
**Issue:** Zero test coverage - no unit, integration, or E2E tests.

**Impact:** High risk of regressions, difficult to refactor safely.

**Fix:** Add Jest test suite (see tests to be created).

---

## Documentation Issues

### 21. No README.md
**Severity:** Low
**Issue:** No project documentation for setup, deployment, or usage.

**Fix:** Create comprehensive README.

---

### 22. No API Documentation
**Severity:** Low
**Issue:** No documentation of webhook payload formats or tool schemas.

**Fix:** Add OpenAPI/Swagger spec or inline JSDoc comments.

---

## Summary

| Severity | Count |
|----------|-------|
| High     | 3     |
| Medium   | 7     |
| Low      | 12    |
| **Total**| **22**|

### Priority Fixes (High Severity)
1. Fix race condition in queue processor
2. Implement memory cleanup for `morganQueuedIds`
3. Add test suite
4. Process multiple leads per tick when slots available
5. Add environment variable validation
