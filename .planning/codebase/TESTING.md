# Testing Patterns

**Analysis Date:** 2026-03-23

## Test Framework

**Runner:**
- Jest 29 (root Morgan service): config at `jest.config.js`
- Jest 29 + ts-jest (ops-api TypeScript): config at `apps/ops-api/jest.config.ts`

**Assertion Library:**
- Jest built-in (`expect`, `toBe`, `toEqual`, `toMatchObject`, `toBeNull`, `toBeGreaterThan`, etc.)

**Run Commands:**
```bash
npm test                          # Run root Morgan service tests (jest.config.js)
npm run test:watch                # Watch mode for root tests
npm run test:coverage             # Coverage for root tests
npm run test:ops                  # Run ops-api TypeScript tests (apps/ops-api/jest.config.ts)
npm test -- helpers.test.js       # Single root test file
npm test -- -t "test name"        # Run by test name
```

## Test File Organization

**Location:**
- Root Morgan service: `__tests__/` directory at repo root (co-located with `index.js`)
- ops-api services: `apps/ops-api/src/services/__tests__/` (co-located with service files being tested)

**Naming:**
- Root tests: `helpers.test.js`, `integration.test.js`, `queueProcessor.test.js`, `rateLimitState.test.js`, `timeUtils.test.js`, `voiceGateway.test.js`, `morganToggle.test.js`
- ops-api tests: domain-prefixed kebab-case with spec IDs baked into suite names (`commission.test.ts`, `payroll-guard.test.ts`, `period-assignment.test.ts`, `reporting.test.ts`, `status-change.test.ts`, `status-commission.test.ts`)

**Structure:**
```
__tests__/                        # Root Morgan service tests (.js)
apps/ops-api/src/services/
  __tests__/
    __mocks__/
      ops-db.ts                   # Shared Prisma mock
    commission.test.ts
    payroll-guard.test.ts
    period-assignment.test.ts
    reporting.test.ts
    status-change.test.ts
    status-commission.test.ts
```

## Test Structure

**Suite Organization (ops-api TypeScript tests):**
```typescript
// Spec ID as describe label for traceability
describe('calculateCommission', () => {
  // =============================================
  // COMM-01: Core + Compass VAB = full rate
  // =============================================
  describe('COMM-01: Core with Compass VAB earns full commission rate', () => {
    it('core (premium=100, commissionAbove=50%, threshold=50) + Compass VAB = 50.00', () => {
      const sale = makeSale({ ... });
      expect(calculateCommission(sale)).toBe(50.00);
    });
  });
});
```

**Suite Organization (root JS tests):**
```javascript
describe('Helper Functions', () => {
  describe('normalizeConvosoNote', () => {
    test('should return empty string for null input', () => {
      expect(normalizeConvosoNote(null)).toBe('');
    });
  });
});
```

**Patterns:**
- `describe` + `it` style in TypeScript tests
- `describe` + `test` style in JavaScript tests (both are valid Jest syntax)
- Arithmetic comments before each `expect` explaining the expected calculation:
  ```typescript
  // 100 * 50% = 50, halved = 25 (FL is NOT exempt)
  expect(calculateCommission(sale)).toBe(25.00);
  ```
- `beforeEach` used for mock resets when mocks are module-scoped

## Mocking

**Framework:** Jest's built-in `jest.mock()` and `jest.fn()`

**Patterns:**

Module-level mock with manual implementation:
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

Shared static mock for Prisma (avoids real DB connection):
- File: `apps/ops-api/src/services/__tests__/__mocks__/ops-db.ts`
- Content: `export const prisma = {} as any;`
- Mapped in `apps/ops-api/jest.config.ts`:
  ```typescript
  moduleNameMapper: {
    '^@ops/db$': '<rootDir>/src/services/__tests__/__mocks__/ops-db.ts',
    '^@ops/(.*)$': '<rootDir>/../../packages/$1/src',
  }
  ```

**What to Mock:**
- `@ops/db` (Prisma client) — always mocked in unit tests to avoid requiring a real database
- External HTTP clients when testing queue/call logic
- Mock only the specific methods called by the function under test

**What NOT to Mock:**
- Pure calculation functions (`calculateCommission`, `computeTrend`, `shiftRange`) — tested directly with no mocks
- Domain logic helpers that have no I/O — test them with real inputs

## Fixtures and Factories

**Test Data:**
Factory functions with `Partial<T>` overrides — the dominant pattern in ops-api tests:
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
  id: 'sale-1',
  saleDate: new Date('2026-03-10T12:00:00Z'),
  // ...all required fields...
  ...overrides,
} as SaleWithProduct);
```

**Location:**
- Defined inline at the top of each `*.test.ts` file — no shared fixture files
- Factory helpers duplicated across `commission.test.ts` and `status-commission.test.ts` (known duplication)

**Root JS tests:**
- Functions under test are duplicated inline in the test file because `index.js` cannot be imported without running the full app:
  ```javascript
  // Since we can't directly import from index.js without running the whole app,
  // we'll create a standalone version for testing
  function normalizeConvosoNote(text, maxLen = 255) { ... }
  ```

## Coverage

**Requirements:** No minimum enforced — no coverage thresholds in either jest config

**View Coverage:**
```bash
npm run test:coverage    # Root Morgan service only
# ops-api coverage: add --coverage flag manually
npx jest --config apps/ops-api/jest.config.ts --coverage
```

**Collected From (root):**
- `*.js` at root (excludes `jest.config.js` and `coverage/**`)

## Test Types

**Unit Tests:**
- Pure function tests: `calculateCommission`, `computeTrend`, `shiftRange`, `buildPeriodSummary`, `getSundayWeekRange` — no mocks, real inputs/outputs
- Mocked DB tests: `isAgentPaidInPeriod` — Prisma mocked, tests the query logic
- Business rule tests: status transition logic (`status-change.test.ts`) — pure functions extracted from route logic and tested independently

**Integration Tests:**
- `__tests__/integration.test.js` in root — tests the Morgan voice service end-to-end flow

**E2E Tests:**
- Not used — no Cypress, Playwright, or other E2E framework detected

## Common Patterns

**Async Testing:**
```typescript
it('returns true when agent has at least one PAID entry in the period', async () => {
  mockFindMany.mockResolvedValue([
    { id: 'e1', status: 'PAID', agentId: 'agent-1', payrollPeriodId: 'pp-1' },
  ]);
  const result = await isAgentPaidInPeriod('agent-1', 'pp-1');
  expect(result).toBe(true);
  expect(mockFindMany).toHaveBeenCalledWith({
    where: { payrollPeriodId: 'pp-1', agentId: 'agent-1', status: 'PAID' },
  });
});
```

**Spec ID tracking:**
```typescript
// =============================================
// COMM-08: Enrollment fee below threshold halves commission
// =============================================
describe('COMM-08: Enrollment fee below threshold halves commission', () => {
  it('COMM-08a: core sale + Compass VAB + enrollmentFee=80 (< $99) -> commission halved from 50 to 25', () => {
```

**Timezone edge case testing:**
```typescript
test('PAYR-01b: Saturday March 14, 2026 11:30 PM Eastern (March 15 3:30 AM UTC, EDT) -> Sun Mar 8 - Sat Mar 14', () => {
  // EDT is UTC-4, so 11:30 PM EDT = 3:30 AM UTC next day
  const date = new Date('2026-03-15T03:30:00Z');
  const { weekStart, weekEnd } = getSundayWeekRange(date);
  expect(weekStart.toISOString()).toBe('2026-03-08T00:00:00.000Z');
  expect(weekEnd.toISOString()).toBe('2026-03-14T00:00:00.000Z');
});
```

**Mock call assertion:**
```typescript
expect(mockFindMany).toHaveBeenCalledWith({
  where: { payrollPeriodId: 'pp-1', agentId: 'agent-1', status: 'PAID' },
});
```

## Configuration Details

**Root jest.config.js:**
```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['*.js', '!jest.config.js', '!coverage/**'],
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  testTimeout: 10000,
  verbose: true,
};
```

**apps/ops-api/jest.config.ts:**
```typescript
const config: Config = {
  rootDir: path.resolve(__dirname),
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '../../tsconfig.base.json' }] },
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@ops/db$': '<rootDir>/src/services/__tests__/__mocks__/ops-db.ts',
    '^@ops/(.*)$': '<rootDir>/../../packages/$1/src',
  },
  verbose: true,
  testTimeout: 10000,
};
```

---

*Testing analysis: 2026-03-23*
