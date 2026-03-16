import { computeTrend, shiftRange, buildPeriodSummary } from '../reporting';

describe('computeTrend', () => {
  it('returns up with correct percentage when current > prior', () => {
    expect(computeTrend(10, 5)).toEqual({ value: 100, direction: 'up' });
  });

  it('returns down with correct percentage when current < prior', () => {
    expect(computeTrend(5, 10)).toEqual({ value: 50, direction: 'down' });
  });

  it('returns flat when current equals prior', () => {
    expect(computeTrend(5, 5)).toEqual({ value: 0, direction: 'flat' });
  });

  it('handles prior=0 with current>0 (no division by zero)', () => {
    expect(computeTrend(5, 0)).toEqual({ value: 100, direction: 'up' });
  });

  it('handles both zero as flat', () => {
    expect(computeTrend(0, 0)).toEqual({ value: 0, direction: 'flat' });
  });
});

describe('shiftRange', () => {
  it('shifts a date range back by N days', () => {
    const range = {
      gte: new Date('2026-03-10T00:00:00.000Z'),
      lt: new Date('2026-03-17T00:00:00.000Z'),
    };
    const shifted = shiftRange(range, 7);
    expect(shifted.gte.toISOString()).toBe('2026-03-03T00:00:00.000Z');
    expect(shifted.lt.toISOString()).toBe('2026-03-10T00:00:00.000Z');
  });
});

describe('buildPeriodSummary', () => {
  it('maps period data and filters to RAN-only entries', () => {
    const period = {
      weekStart: new Date('2026-03-09T00:00:00.000Z'),
      weekEnd: new Date('2026-03-15T00:00:00.000Z'),
      status: 'OPEN',
      entries: [
        { payoutAmount: 100, netAmount: 80, sale: { premium: 500, status: 'RAN' } },
        { payoutAmount: 50, netAmount: 40, sale: { premium: 300, status: 'RAN' } },
        { payoutAmount: 25, netAmount: 20, sale: { premium: 150, status: 'DEAD' } },
      ],
    };

    const result = buildPeriodSummary(period);

    expect(result.period).toBe('2026-03-09 - 2026-03-15');
    expect(result.salesCount).toBe(2);
    expect(result.premiumTotal).toBe(800);
    expect(result.commissionPaid).toBe(120);
    expect(result.periodStatus).toBe('OPEN');
  });
});
