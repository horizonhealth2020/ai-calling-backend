# Testing Patterns

**Analysis Date:** 2026-03-14

## Test Framework

**Runner:**
- Jest 29.7.0
- Config: `jest.config.js` (root)
- Environment: Node.js

**Assertion Library:**
- Jest built-in matchers (`expect()`)

**Run Commands:**
```bash
npm test                         # Run all tests
npm test -- helpers.test.js      # Single file
npm test -- -t "test name"       # By name
npm run test:watch               # Watch mode
npm run test:coverage            # Generate coverage report
```

## Test File Organization

**Location:**
- Co-located in `__tests__/` directory at root
- Tests for Morgan service (legacy backend at `index.js`)
- Path: `__tests__/*.test.js`

**Naming:**
- Convention: `[module].test.js`
- Examples: `helpers.test.js`, `voiceGateway.test.js`, `queueProcessor.test.js`, `rateLimitState.test.js`, `timeUtils.test.js`, `integration.test.js`, `morganToggle.test.js`

**Coverage:**
- Configured in `jest.config.js`: `collectCoverageFrom: ['*.js', '!jest.config.js', '!coverage/**']`
- Covers root-level `.js` files only (Morgan service)
- Frontend/API apps (under `apps/`) are **not tested via Jest** — testing framework TBD for TypeScript projects

## Test Structure

**Suite Organization:**
```javascript
describe('Helper Functions', () => {
  describe('normalizeConvosoNote', () => {
    test('should return empty string for null input', () => {
      expect(normalizeConvosoNote(null)).toBe('');
    });

    test('should collapse multiple spaces into single space', () => {
      expect(normalizeConvosoNote('hello    world')).toBe('hello world');
    });
  });
});
```

**Patterns:**
- Top-level `describe()` for module/feature
- Nested `describe()` for function or behavior group
- Individual `test()` for single assertion or scenario
- Descriptive test names using "should" convention
- Clear arrange-act-assert structure (often combined in simple tests)

## Mocking

**Framework:** Jest's built-in `jest.mock()` and `jest.fn()`

**Pattern from `__tests__/voiceGateway.test.js`:**
```javascript
jest.mock('node-fetch');
jest.mock('../morganToggle', () => ({
  isMorganEnabled: jest.fn(() => true),
}));
jest.mock('../rateLimitState', () => ({
  setLastVapi429At: jest.fn(),
  getLastVapi429At: jest.fn(() => 0),
}));

describe('voiceGateway', () => {
  let startOutboundCall;
  let fetch;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    fetch = require('node-fetch');
    const voiceGateway = require('../voiceGateway');
    startOutboundCall = voiceGateway.startOutboundCall;
  });
```

**Setup Pattern:**
- `beforeEach()` clears mocks and resets module cache
- Environment variables saved/restored in `beforeEach()`/`afterEach()`
- Mocks configured with return values using `jest.fn().mockResolvedValue()` or `jest.fn().mockReturnValue()`

**What to Mock:**
- External APIs: `node-fetch` for HTTP calls
- Environment-dependent modules: `morganToggle`, `rateLimitState`
- System time if needed: `Date.now()`
- Database calls (would use mocked `@ops/db` in app tests)

**What NOT to Mock:**
- Core helper functions being tested
- Business logic utilities (test directly)
- Simple data transformations

## Fixtures and Factories

**Test Data:**
```javascript
test('should normalize basic lead data', () => {
  const input = {
    lead_id: '123',
    list_id: '456',
    first_name: 'John',
    last_name: 'Doe',
    phone_number: '+13055551234',
    state: 'FL',
    called_count: 2,
  };

  const result = normalizeConvosoLead(input);

  expect(result).toMatchObject({
    id: '123',
    list_id: '456',
    first_name: 'John',
    last_name: 'Doe',
    phone: '+13055551234',
    phone_number: '+13055551234',
    state: 'FL',
    call_count: 2,
  });
});
```

**Location:**
- Inline in test files as `const input = { ... }`
- No separate fixtures directory (kept simple for Morgan service tests)
- Test data created fresh per test

## Coverage

**Requirements:**
- Not enforced (no threshold in jest.config.js)
- Generated on demand: `npm run test:coverage`
- Report location: `coverage/` directory

**View Coverage:**
```bash
npm run test:coverage
# Output: lcov.info and HTML report in coverage/
```

## Test Types

**Unit Tests:**
- Scope: Individual functions in isolation
- Approach: Mock all dependencies
- Examples: `helpers.test.js` (normalize functions), `timeUtils.test.js` (date helpers), `rateLimitState.test.js`
- Timeout: 10 seconds (set in `jest.config.js`)

**Integration Tests:**
- Scope: Multiple modules together, mocked external APIs
- Approach: Real function calls, mocked fetch/Vapi/Convoso
- Status: **Placeholder suite exists** at `__tests__/integration.test.js` with TODO comments
- Blocked: Requires mocking Express app (suggest `supertest` package)

**E2E Tests:**
- Framework: Not used
- Status: Not implemented
- Note: Would require running full Docker stack or live environment

## Common Patterns

**Async Testing:**
```javascript
test('should make successful call with valid parameters', async () => {
  const mockResponse = {
    ok: true,
    json: jest.fn().mockResolvedValue({ id: 'call-123', status: 'queued' }),
    text: jest.fn(),
  };
  fetch.mockResolvedValue(mockResponse);

  const result = await startOutboundCall({
    agentName: 'Morgan',
    toNumber: '+13055551234',
    metadata: { test: 'data' },
    callName: 'Test Call',
  });

  expect(result).toEqual({
    provider: 'vapi',
    callId: 'call-123',
    raw: { id: 'call-123', status: 'queued' },
  });
});
```

**Error Testing:**
```javascript
test('should return null for empty string', () => {
  expect(getMemberIdValue({ member_id: '' })).toBeNull();
});

test('should return null for null object', () => {
  expect(getMemberIdValue(null)).toBeNull();
});
```

**Snapshot/Matching:**
```javascript
test('should normalize basic lead data', () => {
  const result = normalizeConvosoLead(input);
  expect(result).toMatchObject({
    id: '123',
    list_id: '456',
    // ... assertions
  });
});
```

## Middleware & Setup/Teardown

**Setup (`beforeEach`):**
- Save original environment state
- Set test-specific env vars
- Clear Jest module cache
- Clear all mocks
- Re-require modules under test

**Teardown (`afterEach`):**
- Restore original environment variables
- Delete dynamically-set env keys

**Example from `voiceGateway.test.js`:**
```javascript
beforeEach(() => {
  originalEnv = {
    VAPI_API_KEY: process.env.VAPI_API_KEY,
    VAPI_MORGAN_ASSISTANT_ID: process.env.VAPI_MORGAN_ASSISTANT_ID,
    VAPI_PHONE_NUMBER_IDS: process.env.VAPI_PHONE_NUMBER_IDS,
  };

  process.env.VAPI_API_KEY = 'test-api-key';
  process.env.VAPI_MORGAN_ASSISTANT_ID = 'test-morgan-id';
  process.env.VAPI_PHONE_NUMBER_IDS = 'phone-1,phone-2,phone-3';

  jest.resetModules();
  jest.clearAllMocks();
});

afterEach(() => {
  Object.keys(originalEnv).forEach((key) => {
    if (originalEnv[key] !== undefined) {
      process.env[key] = originalEnv[key];
    } else {
      delete process.env[key];
    }
  });
});
```

## Testing Gaps

**Not Tested (Morgan Service):**
- Express route handlers (need `supertest`)
- Webhook payloads (integration tests blocked)
- Rate limiting recovery logic
- Queue processor concurrent behavior (unit tests only)
- External API interactions (Vapi, Convoso, calls)

**Frontend/API Apps (`apps/*`):**
- No Jest configuration detected
- No test files in `apps/ops-api`, `apps/manager-dashboard`, etc.
- Would require separate test setup per app (recommend Vitest for TypeScript)
- Prisma models untested
- API routes untested

**Recommendation:** Create tests for critical paths before expanding features.

---

*Testing analysis: 2026-03-14*
