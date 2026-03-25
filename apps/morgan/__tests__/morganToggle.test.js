// __tests__/morganToggle.test.js

describe('morganToggle', () => {
  let originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = process.env.MORGAN_ENABLED;
    // Clear module cache to get fresh require
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original env
    if (originalEnv !== undefined) {
      process.env.MORGAN_ENABLED = originalEnv;
    } else {
      delete process.env.MORGAN_ENABLED;
    }
  });

  test('should return true when MORGAN_ENABLED is "true"', () => {
    process.env.MORGAN_ENABLED = 'true';
    const { isMorganEnabled } = require('../morganToggle');
    expect(isMorganEnabled()).toBe(true);
  });

  test('should return true when MORGAN_ENABLED is "1"', () => {
    process.env.MORGAN_ENABLED = '1';
    const { isMorganEnabled } = require('../morganToggle');
    expect(isMorganEnabled()).toBe(true);
  });

  test('should return true when MORGAN_ENABLED is "yes"', () => {
    process.env.MORGAN_ENABLED = 'yes';
    const { isMorganEnabled } = require('../morganToggle');
    expect(isMorganEnabled()).toBe(true);
  });

  test('should return true when MORGAN_ENABLED is "TRUE" (case insensitive)', () => {
    process.env.MORGAN_ENABLED = 'TRUE';
    const { isMorganEnabled } = require('../morganToggle');
    expect(isMorganEnabled()).toBe(true);
  });

  test('should return false when MORGAN_ENABLED is "false"', () => {
    process.env.MORGAN_ENABLED = 'false';
    const { isMorganEnabled } = require('../morganToggle');
    expect(isMorganEnabled()).toBe(false);
  });

  test('should return false when MORGAN_ENABLED is "0"', () => {
    process.env.MORGAN_ENABLED = '0';
    const { isMorganEnabled } = require('../morganToggle');
    expect(isMorganEnabled()).toBe(false);
  });

  test('should return true when MORGAN_ENABLED is not set (default)', () => {
    delete process.env.MORGAN_ENABLED;
    const { isMorganEnabled } = require('../morganToggle');
    expect(isMorganEnabled()).toBe(true);
  });

  test('should return false when MORGAN_ENABLED is random string', () => {
    process.env.MORGAN_ENABLED = 'random';
    const { isMorganEnabled } = require('../morganToggle');
    expect(isMorganEnabled()).toBe(false);
  });
});
