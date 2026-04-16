import { computeNetAmount } from '../payroll';

// Phase 78: Fronted is now a same-week deduction (reversed Phase 71 exclusion).
// Formula: net = payout + adjustment + bonus - hold - fronted
//
// This reverses the Phase 71 "fronted excluded" decision. Fronted (mid-week
// cash advance) reduces this week's net immediately, same semantics as hold.

describe('computeNetAmount — Phase 78 formula (fronted deducted same-week)', () => {
  it('1) baseline: payout only, no deductions', () => {
    const net = computeNetAmount({ payout: 100, adjustment: 0, bonus: 0, hold: 0, fronted: 0 });
    expect(net).toBe(100);
  });

  it('2) fronted deducts from net', () => {
    const net = computeNetAmount({ payout: 100, adjustment: 0, bonus: 0, hold: 0, fronted: 20 });
    expect(net).toBe(80);
  });

  it('3) hold deducts from net', () => {
    const net = computeNetAmount({ payout: 100, adjustment: 0, bonus: 0, hold: 15, fronted: 0 });
    expect(net).toBe(85);
  });

  it('4) hold and fronted both deduct', () => {
    const net = computeNetAmount({ payout: 100, adjustment: 0, bonus: 0, hold: 15, fronted: 20 });
    expect(net).toBe(65);
  });

  it('5) bonus adds to net', () => {
    const net = computeNetAmount({ payout: 100, adjustment: 0, bonus: 10, hold: 0, fronted: 0 });
    expect(net).toBe(110);
  });

  it('6) negative adjustment (chargeback) deducts', () => {
    const net = computeNetAmount({ payout: 100, adjustment: -30, bonus: 0, hold: 0, fronted: 0 });
    expect(net).toBe(70);
  });

  it('7) all fields combined', () => {
    // net = 200 + (-10) + 25 - 15 - 30 = 170
    const net = computeNetAmount({ payout: 200, adjustment: -10, bonus: 25, hold: 15, fronted: 30 });
    expect(net).toBe(170);
  });

  it('8) transition: carryover-generated hold + new Phase 78 fronted both deduct', () => {
    // Phase 77 carryover wrote hold=$30 to this period (from prior fronted).
    // Agent receives $20 fronted this week under Phase 78. Both deduct.
    // net = 100 + 0 + 0 - 30 - 20 = 50
    const net = computeNetAmount({ payout: 100, adjustment: 0, bonus: 0, hold: 30, fronted: 20 });
    expect(net).toBe(50);
  });

  it('backward compat: fronted omitted defaults to 0 (Phase 71 callers unaffected)', () => {
    // Callers that don't pass fronted get the same result as before Phase 78
    const net = computeNetAmount({ payout: 500, adjustment: 0, bonus: 0, hold: 0 });
    expect(net).toBe(500);
  });
});
