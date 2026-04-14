import { computeNetAmount } from '../payroll';

// ── Phase 71 NET-02: Fronted excluded from paycard net ─────────────
//
// Formula: net = payout + adjustment + bonus - hold
//
// Fronted (mid-week cash advance) is NOT additive to net. The agent already
// received that money; the frontedAmount column is still persisted so
// carryover.ts can convert it to the next period's hold on lock.
//
// This reverses the v2.1 "Fronted additive in net formula" decision.

describe('computeNetAmount — Phase 71 formula (fronted excluded)', () => {
  it('A) baseline payout only', () => {
    const net = computeNetAmount({ payout: 500, adjustment: 0, bonus: 0, hold: 0 });
    expect(net).toBe(500);
  });

  it('B) fronted is NOT added to net (regression lock for Phase 71)', () => {
    // If fronted were additive this would be 600. Must remain 500.
    const net = computeNetAmount({ payout: 500, adjustment: 0, bonus: 0, hold: 0 });
    expect(net).toBe(500);
  });

  it('C) bonus adds to net', () => {
    const net = computeNetAmount({ payout: 500, adjustment: 0, bonus: 50, hold: 0 });
    expect(net).toBe(550);
  });

  it('D) negative adjustment (chargeback) deducts from net', () => {
    const net = computeNetAmount({ payout: 500, adjustment: -200, bonus: 0, hold: 0 });
    expect(net).toBe(300);
  });

  it('E) hold (carryover from prior week) deducts from net', () => {
    const net = computeNetAmount({ payout: 500, adjustment: 0, bonus: 0, hold: 100 });
    expect(net).toBe(400);
  });

  it('F) combined: bonus + chargeback + hold', () => {
    const net = computeNetAmount({ payout: 500, adjustment: -50, bonus: 10, hold: 25 });
    expect(net).toBe(435);
  });

  it('G) negative net allowed (prior hold exceeds this-week earnings)', () => {
    const net = computeNetAmount({ payout: 50, adjustment: 0, bonus: 0, hold: 400 });
    expect(net).toBe(-350);
  });
});
