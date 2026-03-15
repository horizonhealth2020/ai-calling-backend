import { getSundayWeekRange } from '../payroll';

describe('PAYR-01: Period assignment with Eastern timezone', () => {
  test('PAYR-01a: Tuesday March 10, 2026 12:00 UTC -> Sun Mar 8 - Sat Mar 14', () => {
    const date = new Date('2026-03-10T12:00:00Z');
    const { weekStart, weekEnd } = getSundayWeekRange(date);
    expect(weekStart.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-03-14T00:00:00.000Z');
  });

  test('PAYR-01b: Saturday March 14, 2026 11:30 PM Eastern (March 15 3:30 AM UTC, EDT) -> Sun Mar 8 - Sat Mar 14', () => {
    // EDT is UTC-4, so 11:30 PM EDT = 3:30 AM UTC next day
    const date = new Date('2026-03-15T03:30:00Z');
    const { weekStart, weekEnd } = getSundayWeekRange(date);
    expect(weekStart.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-03-14T00:00:00.000Z');
  });

  test('PAYR-01c: Sunday March 15, 2026 12:30 AM Eastern (March 15 4:30 AM UTC) -> Sun Mar 15 - Sat Mar 21', () => {
    const date = new Date('2026-03-15T04:30:00Z');
    const { weekStart, weekEnd } = getSundayWeekRange(date);
    expect(weekStart.toISOString()).toBe('2026-03-15T00:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-03-21T00:00:00.000Z');
  });

  test('PAYR-01d: Saturday Nov 7, 2026 11:30 PM Eastern (Nov 8 4:30 AM UTC, EST) -> Sun Nov 1 - Sat Nov 7', () => {
    // EST is UTC-5, so 11:30 PM EST = 4:30 AM UTC next day
    const date = new Date('2026-11-08T04:30:00Z');
    const { weekStart, weekEnd } = getSundayWeekRange(date);
    expect(weekStart.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-11-07T00:00:00.000Z');
  });
});

describe('COMM-10: ACH sales shift period +1 week', () => {
  test('COMM-10a: ACH sale on Tuesday March 10, 2026 -> shifted period Sun Mar 15 - Sat Mar 21', () => {
    const date = new Date('2026-03-10T12:00:00Z');
    const { weekStart, weekEnd } = getSundayWeekRange(date, 1);
    expect(weekStart.toISOString()).toBe('2026-03-15T00:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-03-21T00:00:00.000Z');
  });

  test('COMM-10b: CC sale on Tuesday March 10, 2026 -> normal period Sun Mar 8 - Sat Mar 14', () => {
    const date = new Date('2026-03-10T12:00:00Z');
    const { weekStart, weekEnd } = getSundayWeekRange(date, 0);
    expect(weekStart.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-03-14T00:00:00.000Z');
  });

  test('COMM-10c: null paymentType sale -> normal period (no shift)', () => {
    const date = new Date('2026-03-10T12:00:00Z');
    const { weekStart, weekEnd } = getSundayWeekRange(date);
    expect(weekStart.toISOString()).toBe('2026-03-08T00:00:00.000Z');
    expect(weekEnd.toISOString()).toBe('2026-03-14T00:00:00.000Z');
  });
});
