# Testing Guide

## Overview

This project uses [Jest](https://jestjs.io/) for testing. The test suite covers utility modules, helper functions, and critical business logic.

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (auto-rerun on file changes)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

## Test Structure

```
__tests__/
├── helpers.test.js          # Helper function unit tests
├── morganToggle.test.js     # Morgan enable/disable toggle
├── rateLimitState.test.js   # Rate limit state management
├── timeUtils.test.js        # Business hours logic
├── voiceGateway.test.js     # Vapi integration tests
└── integration.test.js      # API endpoint integration tests (TODO)
```

## Test Coverage

Current test coverage by module:

| Module | Functions | Lines | Status |
|--------|-----------|-------|--------|
| `morganToggle.js` | 100% | 100% | ✅ Complete |
| `rateLimitState.js` | 100% | 100% | ✅ Complete |
| `timeUtils.js` | 100% | ~95% | ✅ Complete |
| `voiceGateway.js` | ~80% | ~75% | ✅ Complete |
| Helper functions | ~60% | ~50% | ✅ Core functions |
| `index.js` (main) | ~10% | ~5% | ⚠️ Needs work |

## Writing New Tests

### Unit Test Example

```javascript
describe('MyFunction', () => {
  test('should handle valid input', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });

  test('should handle edge case', () => {
    const result = myFunction(null);
    expect(result).toBeNull();
  });
});
```

### Mocking External Dependencies

```javascript
jest.mock('node-fetch');
const fetch = require('node-fetch');

test('should call external API', async () => {
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({ data: 'mocked' })
  });

  const result = await myApiCall();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('api.example.com'));
});
```

### Testing Environment Variables

```javascript
let originalEnv;

beforeEach(() => {
  originalEnv = process.env.MY_VAR;
  process.env.MY_VAR = 'test-value';
  jest.resetModules(); // Clear module cache
});

afterEach(() => {
  if (originalEnv) {
    process.env.MY_VAR = originalEnv;
  } else {
    delete process.env.MY_VAR;
  }
});
```

## TODO: Integration Tests

The `integration.test.js` file contains placeholder tests for API endpoints. To implement these:

### 1. Install supertest

```bash
npm install --save-dev supertest
```

### 2. Refactor `index.js` to export app

Current (end of index.js):
```javascript
const server = app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
});
```

Should be:
```javascript
// Only start server if not in test mode
if (require.main === module) {
  const server = app.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
```

### 3. Write integration tests

```javascript
const request = require('supertest');
const app = require('../index'); // Now you can import the app

describe('API Endpoints', () => {
  test('GET /health should return 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
  });
});
```

## Continuous Integration

Add to your CI/CD pipeline (GitHub Actions example):

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3  # Optional: upload coverage
```

## Test Best Practices

### ✅ DO

- Write tests for all new functions
- Mock external API calls
- Test edge cases and error handling
- Use descriptive test names
- Keep tests isolated and independent
- Clean up after tests (restore env, clear mocks)

### ❌ DON'T

- Don't test external APIs directly
- Don't share state between tests
- Don't use real credentials in tests
- Don't skip flaky tests - fix them
- Don't test implementation details

## Debugging Tests

### Run specific test file
```bash
npm test -- helpers.test.js
```

### Run specific test by name
```bash
npm test -- -t "should normalize phone number"
```

### Run with verbose output
```bash
npm test -- --verbose
```

### Debug with Node inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

Then open `chrome://inspect` in Chrome.

## Test Data

Use realistic but fake data:

```javascript
const mockLead = {
  lead_id: '12345',
  list_id: '28001',
  first_name: 'John',
  last_name: 'Doe',
  phone_number: '+13055551234',
  state: 'FL',
  called_count: 2,
};
```

## Common Issues

### Module not found
- Make sure you're importing from the correct relative path
- Check that the module exports what you're trying to import

### Tests fail in CI but pass locally
- Environment variables may be different
- Timezone differences (always use UTC in tests)
- File system differences (use path.join)

### Tests are slow
- Mock external APIs instead of calling them
- Use `jest.useFakeTimers()` for time-dependent tests
- Run tests in parallel (default in Jest)

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Jest Matchers](https://jestjs.io/docs/expect)
- [Testing Node.js Applications](https://nodejs.org/en/docs/guides/testing/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
