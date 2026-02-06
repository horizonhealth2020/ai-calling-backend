// __tests__/timeUtils.test.js

const { DateTime } = require('luxon');
const { isBusinessHours } = require('../timeUtils');

describe('timeUtils - isBusinessHours', () => {
  test('should return true for Monday at 10:00 AM ET', () => {
    // Mock DateTime to return Monday 10:00 AM
    const mockNow = DateTime.fromObject(
      { year: 2026, month: 2, day: 2, hour: 10, minute: 0 }, // Monday Feb 2, 2026
      { zone: 'America/New_York' }
    );

    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);

    expect(isBusinessHours()).toBe(true);

    DateTime.now.mockRestore();
  });

  test('should return true for Friday at 3:00 PM ET', () => {
    const mockNow = DateTime.fromObject(
      { year: 2026, month: 2, day: 6, hour: 15, minute: 0 }, // Friday Feb 6, 2026
      { zone: 'America/New_York' }
    );

    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);

    expect(isBusinessHours()).toBe(true);

    DateTime.now.mockRestore();
  });

  test('should return true during afternoon hours (2:30 PM to 5:00 PM)', () => {
    const mockNow = DateTime.fromObject(
      { year: 2026, month: 2, day: 3, hour: 14, minute: 30 }, // Tuesday 2:30 PM
      { zone: 'America/New_York' }
    );

    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);

    expect(isBusinessHours()).toBe(true);

    DateTime.now.mockRestore();
  });

  test('should return false during lunch break (1:00 PM to 2:30 PM)', () => {
    const mockNow = DateTime.fromObject(
      { year: 2026, month: 2, day: 3, hour: 13, minute: 30 }, // Tuesday 1:30 PM
      { zone: 'America/New_York' }
    );

    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);

    expect(isBusinessHours()).toBe(false);

    DateTime.now.mockRestore();
  });

  test('should return false for Saturday', () => {
    const mockNow = DateTime.fromObject(
      { year: 2026, month: 2, day: 7, hour: 10, minute: 0 }, // Saturday Feb 7, 2026
      { zone: 'America/New_York' }
    );

    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);

    expect(isBusinessHours()).toBe(false);

    DateTime.now.mockRestore();
  });

  test('should return false for Sunday', () => {
    const mockNow = DateTime.fromObject(
      { year: 2026, month: 2, day: 8, hour: 10, minute: 0 }, // Sunday Feb 8, 2026
      { zone: 'America/New_York' }
    );

    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);

    expect(isBusinessHours()).toBe(false);

    DateTime.now.mockRestore();
  });

  test('should return false before 9:00 AM', () => {
    const mockNow = DateTime.fromObject(
      { year: 2026, month: 2, day: 2, hour: 8, minute: 59 }, // Monday 8:59 AM
      { zone: 'America/New_York' }
    );

    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);

    expect(isBusinessHours()).toBe(false);

    DateTime.now.mockRestore();
  });

  test('should return false after 5:00 PM', () => {
    const mockNow = DateTime.fromObject(
      { year: 2026, month: 2, day: 2, hour: 17, minute: 1 }, // Monday 5:01 PM
      { zone: 'America/New_York' }
    );

    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);

    expect(isBusinessHours()).toBe(false);

    DateTime.now.mockRestore();
  });

  test('should handle edge case at exactly 9:00 AM', () => {
    const mockNow = DateTime.fromObject(
      { year: 2026, month: 2, day: 2, hour: 9, minute: 0 }, // Monday 9:00 AM
      { zone: 'America/New_York' }
    );

    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);

    expect(isBusinessHours()).toBe(true);

    DateTime.now.mockRestore();
  });

  test('should handle edge case at exactly 1:00 PM (start of lunch)', () => {
    const mockNow = DateTime.fromObject(
      { year: 2026, month: 2, day: 2, hour: 13, minute: 0 }, // Monday 1:00 PM
      { zone: 'America/New_York' }
    );

    jest.spyOn(DateTime, 'now').mockReturnValue(mockNow);

    expect(isBusinessHours()).toBe(false);

    DateTime.now.mockRestore();
  });
});
