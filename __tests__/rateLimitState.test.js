// __tests__/rateLimitState.test.js

const { setLastVapi429At, getLastVapi429At } = require('../rateLimitState');

describe('rateLimitState', () => {
  beforeEach(() => {
    // Reset state before each test
    jest.resetModules();
  });

  test('should initialize with 0', () => {
    expect(getLastVapi429At()).toBe(0);
  });

  test('should set and get timestamp', () => {
    const timestamp = Date.now();
    setLastVapi429At(timestamp);
    expect(getLastVapi429At()).toBe(timestamp);
  });

  test('should update timestamp when called multiple times', () => {
    const first = 1000;
    const second = 2000;

    setLastVapi429At(first);
    expect(getLastVapi429At()).toBe(first);

    setLastVapi429At(second);
    expect(getLastVapi429At()).toBe(second);
  });

  test('should handle 0 timestamp', () => {
    setLastVapi429At(0);
    expect(getLastVapi429At()).toBe(0);
  });

  test('should handle negative timestamp', () => {
    setLastVapi429At(-100);
    expect(getLastVapi429At()).toBe(-100);
  });
});
