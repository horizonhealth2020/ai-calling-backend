# Testing Patterns

**Analysis Date:** 2026-03-17

## Test Framework

**Runner:**
- Jest v29.7.0
- Root config: `jest.config.js` (covers Morgan voice service JS tests)
- ops-api config: `apps/ops-api/jest.config.ts` (covers TypeScript service tests, uses `ts-jest`)

**Assertion Library:**
- Jest built-in (`expect`, `toBe`, `toEqual`, `toMatchObject`, `toBeNull`, `rejects.toThrow`)

**Transform:**
- TypeScript tests use `ts-jest` with `tsconfig.base.json`

**Run Commands:**
```bash
npm test                         # Run all root-level JS tests (Morgan voice service)
npm run test:watch               # Watch mode
npm run test:coverage            # With coverage report (outputs to coverage/)
npm test -- helpers.test.js      # Single file by name
npm test -- -t "test name"       # By test name pattern
npm run test:ops                 # Run ops-api TypeScript tests only
```

## Test File Organization

**Root-level (Morgan voice service):**
- Location: `__tests__/` directory at repo root
- Naming: `<module>.test.js` matching source module name
- Test files: `helpers.test.js`, `voiceGateway.test.js`, `timeUtils.test.js`, `queueProcessor.test.js`, `morganToggle.test.js`, `rateLimitState.test.js`, `integration.test.js`

**ops-api (TypeScript services):**
- Location: `apps/ops-api/src/services/__tests__/`
- Naming: `<domain>.test.ts` kebab-case, matching the service function's concern
- Test files: `commission.test.ts`, `payroll-guard.test.ts`, `period-assignment.test.ts`, `reporting.test.ts`, `status-change.test.ts`, `status-commission.test.ts`
- Mock files: `apps/ops-api/src/services/__tests__/__mocks__/ops-db.ts`

**Structure:**
```
__tests__/                         # Root JS tests (Morgan service)
├── helpers.test.js
├── voiceGateway.test.js
├── timeUtils.test.js
├── queueProcessor.test.js
├── morganToggle.test.js
├── rateLimitState.test.js
└── integration.test.js            # Placeholder stubs only

apps/ops-api/src/services/
└── __tests__/
    ├── __mocks__/
    │   └── ops-db.ts              # Prisma client stub
    ├── commission.test.ts
    ├── payroll-guard.test.ts
    ├── period-assignment.test.ts
    ├── reporting.test.ts
    ├── status-change.test.ts
    └── status-commission.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
// ops-api TypeScript tests
describe('calculateCommission', () => {
  // =============================================
  // COMM-01: Descriptive business rule ID
  // =============================================
  describe('COMM-01: Core with Compass VAB earns full commission rate', () => {
    it('core (premium=100, commissionAbove=50%, threshold=50) + Compass VAB = 50.00', () => {
      const sale = makeSale({ ... });
      expect(calculateCommission(sale)).toBe(50.00);
    });
  });
});
```

```javascript
// Root JS tests
describe('Helper Functions', () => {
  describe('normalizeConvosoNote', () => {
    test('should return empty string for null input', () => {
      expect(normalizeConvosoNote(null)).toBe('');
    });
  });
});
```

**Patterns:**
- TypeScript tests use `it(...)` inside nested `describe`; JS tests use `test(...)`
- Business rule IDs (e.g., `COMM-01`, `PAYR-01`) in describe labels to trace to spec
- Inline math comments explain expected values: `// 100 * 50% = 50, halved = 25`
- `beforeEach` used for mock resets and env setup; `afterEach` for env teardown

## Mocking

**Framework:** Jest built-in (`jest.fn()`, `jest.mock()`, `jest.spyOn()`, `jest.resetModules()`)

**Prisma DB mock (ops-api TypeScript tests):**
```typescript
// apps/ops-api/src/services/__tests__/__mocks__/ops-db.ts
export const prisma = {} as any;
```
The `jest.config.ts` maps `@ops/db` to this file via `moduleNameMapper`:
```typescript
'^@ops/db$': '<rootDir>/src/services/__tests__/__mocks__/ops-db.ts'
```

For tests that need specific Prisma behavior, mock functions are declared at the top of the test file:
```typescript
const mockFindMany = jest.fn();
jest.mock('@ops/db', () => ({
  __esModule: true,
  prisma: { payrollEntry: { findMany: (...args: any[]) => mockFindMany(...args) } },
  default: { payrollEntry: { findMany: (...args: any[]) => mockFindMany(...args) } },
}));

beforeEach(() => {
  mockFindMany.mockReset();
});
```

**Module mocking (JS tests):**
```javascript
jest.mock('node-fetch');
jest.mock('../morganToggle', () => ({
  isMorganEnabled: jest.fn(() => true),
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  fetch = require('node-fetch');
  const voiceGateway = require('../voiceGateway');
  startOutboundCall = voiceGateway.startOutboundCall;
});
```

**Environment variable mocking:**
```javascript
beforeEach(() => {
  originalEnv = { VAPI_API_KEY: process.env.VAPI_API_KEY };
  process.env.VAPI_API_KEY = 'test-api-key';
});
afterEach(() => {
  // Restore or delete keys
  Object.keys(originalEnv).forEach((key) => {
    if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key];
    else delete process.env[key];
  });
});
```

**DateTime mocking (Luxon):**
```javascript
jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);
// ... assertions ...
DateTime.now.mockRestore();
```

**What to Mock:**
- All DB access (`@ops/db` / Prisma client) — tests must not require a live database
- External HTTP clients (`node-fetch`) for tests touching Vapi/Convoso APIs
- Side-effect modules (`morganToggle`, `rateLimitState`) when testing downstream behavior
- `DateTime.now` for time-sensitive business logic (business hours, timezone calculations)

**What NOT to Mock:**
- Pure business logic functions (`calculateCommission`, `getSundayWeekRange`, `computeTrend`) — tested with real arguments
- Shared utility functions from `@ops/utils` — not mocked; tested directly if needed

## Fixtures and Factories

**Factory pattern (TypeScript):**
```typescript
const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod-1',
  name: 'Test Product',
  active: true,
  type: 'CORE',
  premiumThreshold: new Decimal(50),
  commissionBelow: new Decimal(25),
  commissionAbove: new Decimal(50),
  bundledCommission: null,
  standaloneCommission: null,
  isBundleQualifier: false,
  enrollFeeThreshold: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeSale = (overrides: Partial<SaleWithProduct> = {}): SaleWithProduct => ({
  // full default shape
  ...overrides,
} as SaleWithProduct);

const makeAddon = (productOverrides: Partial<Product> = {}, premium: number = 0) => ({ ... });
```

- Factories are defined at the top of each test file (no shared fixture module)
- `makeProduct`, `makeSale`, and `makeAddon` are duplicated between `commission.test.ts` and `status-commission.test.ts` — noted as technical debt with comment `// --- Test Helpers (mirrored from commission.test.ts) ---`

**Location:**
- No shared fixture module — factories are local to each test file
- `Decimal` from `@prisma/client/runtime/library` used for financial values

## Coverage

**Requirements:** No minimum threshold enforced in config

**View Coverage:**
```bash
npm run test:coverage            # outputs to coverage/ directory
```

**Collection scope (root):** `*.js` files at repo root, excluding `jest.config.js` and `coverage/`

## Test Types

**Unit Tests:**
- Pure function tests: `commission.test.ts`, `reporting.test.ts`, `period-assignment.test.ts`, `helpers.test.js`, `timeUtils.test.js`
- Mock-assisted unit tests: `payroll-guard.test.ts`, `voiceGateway.test.js`
- Pattern behavior tests (inlined logic mirrors): `status-change.test.ts`, `status-commission.test.ts`

**Integration Tests:**
- `__tests__/integration.test.js` exists but contains only stub tests with `// TODO: Implement with supertest` comments and `expect(true).toBe(true)` placeholders
- No HTTP-level integration tests are currently implemented for ops-api

**E2E Tests:**
- Not present

## Common Patterns

**Async Testing:**
```typescript
it('returns true when agent has at least one PAID entry', async () => {
  mockFindMany.mockResolvedValue([{ id: 'e1', status: 'PAID', ... }]);
  const result = await isAgentPaidInPeriod('agent-1', 'pp-1');
  expect(result).toBe(true);
});
```

**Error Testing:**
```javascript
test('should throw error when VAPI_API_KEY is missing', async () => {
  delete process.env.VAPI_API_KEY;
  jest.resetModules();
  const { startOutboundCall } = require('../voiceGateway');
  await expect(
    startOutboundCall({ agentName: 'Morgan', toNumber: '+13055551234', metadata: {}, callName: 'Test' })
  ).rejects.toThrow('Missing VAPI_API_KEY env var');
});
```

**Synchronous throw testing:**
```typescript
it('throws when request is already APPROVED', () => {
  expect(() => determineApprovalResult('APPROVED', 'approve')).toThrow('Can only act on PENDING requests');
});
```

**Spy-based time control:**
```javascript
jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);
expect(isBusinessHours()).toBe(false);
DateTime.now.mockRestore();
```

**Verifying call arguments:**
```javascript
expect(mockFindMany).toHaveBeenCalledWith({
  where: { payrollPeriodId: 'pp-1', agentId: 'agent-1', status: 'PAID' },
});
```

---

*Testing analysis: 2026-03-17*
