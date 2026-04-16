import { executeCarryover, reverseCarryover } from '../carryover';

// ── Mock @ops/db ──────────────────────────────────────────────────
const mockPeriodFindUnique = jest.fn();
const mockPeriodUpsert = jest.fn();
const mockPeriodUpdate = jest.fn();
const mockAdjUpsert = jest.fn();
const mockAdjFindMany = jest.fn();
const mockAdjUpdate = jest.fn();

// Transaction runner: invokes the callback with a tx proxy that reuses the same mocks.
const mockTransaction = jest.fn((cb: any) => cb({
  payrollPeriod: {
    findUnique: (...args: any[]) => mockPeriodFindUnique(...args),
    update: (...args: any[]) => mockPeriodUpdate(...args),
  },
  agentPeriodAdjustment: {
    findMany: (...args: any[]) => mockAdjFindMany(...args),
    update: (...args: any[]) => mockAdjUpdate(...args),
  },
}));

jest.mock('@ops/db', () => ({
  __esModule: true,
  prisma: {
    payrollPeriod: {
      findUnique: (...args: any[]) => mockPeriodFindUnique(...args),
      upsert: (...args: any[]) => mockPeriodUpsert(...args),
      update: (...args: any[]) => mockPeriodUpdate(...args),
    },
    agentPeriodAdjustment: {
      upsert: (...args: any[]) => mockAdjUpsert(...args),
      findMany: (...args: any[]) => mockAdjFindMany(...args),
      update: (...args: any[]) => mockAdjUpdate(...args),
    },
    $transaction: (cb: any) => mockTransaction(cb),
  },
  default: {},
}));

// ── Helpers ───────────────────────────────────────────────────────
function makePeriod(overrides: Record<string, unknown> = {}) {
  return {
    id: 'period-1',
    weekStart: new Date('2026-03-29T00:00:00.000Z'), // Sunday
    weekEnd: new Date('2026-04-04T00:00:00.000Z'),   // Saturday
    carryoverExecuted: false,
    agentAdjustments: [],
    entries: [],
    ...overrides,
  };
}

function makeAdj(overrides: Record<string, unknown> = {}) {
  return {
    id: 'adj-1',
    agentId: 'agent-1',
    payrollPeriodId: 'period-1',
    bonusAmount: 0,
    frontedAmount: 0,
    holdAmount: 0,
    ...overrides,
  };
}

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    agentId: 'agent-1',
    payoutAmount: 100,
    adjustmentAmount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mockPeriodFindUnique.mockReset();
  mockPeriodUpsert.mockReset();
  mockPeriodUpdate.mockReset();
  mockAdjUpsert.mockReset();
  mockAdjFindMany.mockReset();
  mockAdjUpdate.mockReset();
  // Default: next period upsert returns an object
  mockPeriodUpsert.mockResolvedValue({ id: 'next-period' });
  mockPeriodUpdate.mockResolvedValue({});
  mockAdjUpsert.mockResolvedValue({});
  mockAdjFindMany.mockResolvedValue([]);
  mockAdjUpdate.mockResolvedValue({});
});

// ── CARRY-02: Fronted no longer carries (Phase 78) ────────────────
describe('CARRY-02: Fronted auto-carries as hold', () => {
  it('no longer carries fronted to next period (D-09 removed in Phase 78)', async () => {
    // Phase 78: fronted is deducted same-week by computeNetAmount.
    // payout=300, fronted=200, net = 300 - 200 = 100 (positive) → no D-10 carry either.
    const adj = makeAdj({ frontedAmount: 200, holdAmount: 0, bonusAmount: 0 });
    const entry = makeEntry({ agentId: 'agent-1', payoutAmount: 300, adjustmentAmount: 0 });
    const period = makePeriod({ agentAdjustments: [adj], entries: [entry] });
    mockPeriodFindUnique.mockResolvedValue(period);

    const result = await executeCarryover('period-1');

    expect(result.carried).toBe(0);
    expect(result.skipped).toBe(false);
    // No adj upsert — fronted is now a same-week deduction, no carry needed
    expect(mockAdjUpsert).not.toHaveBeenCalled();
    // carryoverExecuted is still set (idempotency flag)
    expect(mockPeriodUpdate).toHaveBeenCalled();
  });
});

// ── CARRY-03: Negative net carries as hold ────────────────────────
describe('CARRY-03: Negative net carries as hold', () => {
  it('carries negative net as hold when net is negative (D-10)', async () => {
    // Agent has frontedAmount=100, holdAmount=400, bonusAmount=0, payout=50, adj=0
    // Phase 78 formula: Net = payout + adj + bonus - hold - fronted
    // Net = 50 + 0 + 0 - 400 - 100 = -450
    // Carry = abs(-450) = 450 (D-10 only — D-09 removed)
    const adj = makeAdj({ frontedAmount: 100, holdAmount: 400, bonusAmount: 0 });
    const entry = makeEntry({ agentId: 'agent-1', payoutAmount: 50, adjustmentAmount: 0 });
    const period = makePeriod({ agentAdjustments: [adj], entries: [entry] });
    mockPeriodFindUnique.mockResolvedValue(period);

    const result = await executeCarryover('period-1');

    expect(result.carried).toBe(1);
    const call = mockAdjUpsert.mock.calls[0][0];
    expect(call.create.holdAmount).toBe(450);
    expect(call.update.holdAmount).toEqual({ increment: 450 });
  });
});

// ── CARRY-06: Idempotent — skip if already executed ───────────────
describe('CARRY-06: Carryover idempotent', () => {
  it('returns early without creating records when carryoverExecuted=true', async () => {
    const period = makePeriod({ carryoverExecuted: true, agentAdjustments: [makeAdj({ frontedAmount: 200 })] });
    mockPeriodFindUnique.mockResolvedValue(period);

    const result = await executeCarryover('period-1');

    expect(result.carried).toBe(0);
    expect(result.skipped).toBe(true);
    expect(mockAdjUpsert).not.toHaveBeenCalled();
    expect(mockPeriodUpdate).not.toHaveBeenCalled();
  });
});

// ── CARRY-07: Carryover increments existing values ────────────────
describe('CARRY-07: Carryover adds to existing hold (no overwrite)', () => {
  it('uses increment in update clause for D-10 negative-net carry', async () => {
    // D-10: large hold creates negative net → carry abs(net) to next period
    // payout=50, hold=200, fronted=0 → net = 50 - 200 = -150 → carry 150
    const adj = makeAdj({ frontedAmount: 0, holdAmount: 200, bonusAmount: 0 });
    const entry = makeEntry({ agentId: 'agent-1', payoutAmount: 50, adjustmentAmount: 0 });
    const period = makePeriod({ agentAdjustments: [adj], entries: [entry] });
    mockPeriodFindUnique.mockResolvedValue(period);

    await executeCarryover('period-1');

    expect(mockAdjUpsert).toHaveBeenCalledTimes(1);
    const call = mockAdjUpsert.mock.calls[0][0];
    // update path uses increment, not absolute value
    expect(call.update.holdAmount).toEqual({ increment: 150 });
    // create path uses absolute value
    expect(call.create.holdAmount).toBe(150);
  });
});

// ── No carryover when fronted=0 and net >= 0 ──────────────────────
describe('No carryover when fronted=0 and net >= 0', () => {
  it('skips agent with fronted=0 and positive net', async () => {
    const adj = makeAdj({ frontedAmount: 0, holdAmount: 0, bonusAmount: 10 });
    const entry = makeEntry({ agentId: 'agent-1', payoutAmount: 100 });
    const period = makePeriod({ agentAdjustments: [adj], entries: [entry] });
    mockPeriodFindUnique.mockResolvedValue(period);

    const result = await executeCarryover('period-1');

    expect(result.carried).toBe(0);
    expect(mockAdjUpsert).not.toHaveBeenCalled();
  });
});

// ── No carryover when period has no agentAdjustments ──────────────
describe('No carryover when period has no adjustments', () => {
  it('completes with carried=0 when no agentAdjustments exist', async () => {
    const period = makePeriod({ agentAdjustments: [], entries: [] });
    mockPeriodFindUnique.mockResolvedValue(period);

    const result = await executeCarryover('period-1');

    expect(result.carried).toBe(0);
    expect(result.skipped).toBe(false);
    expect(mockAdjUpsert).not.toHaveBeenCalled();
    // Should still mark carryoverExecuted
    expect(mockPeriodUpdate).toHaveBeenCalled();
  });
});

// ── CARRY-08: Reverse carryover clears next-period hold ──────────
describe('CARRY-08: reverseCarryover fully clears carryover-only hold', () => {
  it('zeroes holdAmount, clears metadata, resets source carryoverExecuted', async () => {
    mockPeriodFindUnique.mockResolvedValue({ id: 'period-1', carryoverExecuted: true });
    mockAdjFindMany.mockResolvedValue([
      {
        id: 'next-adj-1',
        holdAmount: 200,
        holdFromCarryover: true,
        holdLabel: 'Fronted Hold',
        carryoverSourcePeriodId: 'period-1',
        carryoverAmount: 200,
      },
    ]);

    const result = await reverseCarryover('period-1');

    expect(result.reversed).toBe(200);
    expect(result.rowsTouched).toBe(1);

    // Row fully drained -> clear all carryover metadata
    expect(mockAdjUpdate).toHaveBeenCalledWith({
      where: { id: 'next-adj-1' },
      data: {
        holdAmount: 0,
        holdFromCarryover: false,
        holdLabel: null,
        carryoverSourcePeriodId: null,
        carryoverAmount: null,
      },
    });

    // Source period reset so re-lock can carryover again
    expect(mockPeriodUpdate).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      data: { carryoverExecuted: false },
    });
  });

  it('is a no-op when source period was never executed', async () => {
    mockPeriodFindUnique.mockResolvedValue({ id: 'period-1', carryoverExecuted: false });

    const result = await reverseCarryover('period-1');

    expect(result.reversed).toBe(0);
    expect(result.rowsTouched).toBe(0);
    expect(mockAdjFindMany).not.toHaveBeenCalled();
    expect(mockAdjUpdate).not.toHaveBeenCalled();
    expect(mockPeriodUpdate).not.toHaveBeenCalled();
  });
});

// ── CARRY-09: Full cycle — lock, unlock, edit, re-lock (D-10) ────
describe('CARRY-09: lock -> unlock -> edit hold -> re-lock carries new amount', () => {
  it('first lock carries negative-net, unlock reverses, re-lock after edit carries updated amount', async () => {
    // Phase 78: D-09 removed. Test D-10 cycle (negative-net carry).
    // payout=50, hold=300, fronted=0 → net = -250 → carry 250

    // --- Step 1: first lock ---
    const adjV1 = makeAdj({ holdAmount: 300, frontedAmount: 0 });
    const entry = makeEntry({ agentId: 'agent-1', payoutAmount: 50 });
    const periodV1 = makePeriod({ agentAdjustments: [adjV1], entries: [entry], carryoverExecuted: false });
    mockPeriodFindUnique.mockResolvedValueOnce(periodV1);

    const r1 = await executeCarryover('period-1');
    expect(r1.carried).toBe(1);
    const firstUpsert = mockAdjUpsert.mock.calls[0][0];
    expect(firstUpsert.create.holdAmount).toBe(250);
    expect(firstUpsert.create.carryoverAmount).toBe(250);

    // --- Step 2: unlock -> reverseCarryover ---
    mockPeriodFindUnique.mockResolvedValueOnce({ id: 'period-1', carryoverExecuted: true });
    mockAdjFindMany.mockResolvedValueOnce([
      {
        id: 'next-adj-1',
        holdAmount: 250,
        holdFromCarryover: true,
        holdLabel: 'Fronted Hold',
        carryoverSourcePeriodId: 'period-1',
        carryoverAmount: 250,
      },
    ]);

    const r2 = await reverseCarryover('period-1');
    expect(r2.reversed).toBe(250);
    expect(r2.rowsTouched).toBe(1);
    expect(mockPeriodUpdate).toHaveBeenCalledWith({
      where: { id: 'period-1' },
      data: { carryoverExecuted: false },
    });

    // --- Step 3: reduce hold → re-lock carries 150 ---
    mockAdjUpsert.mockClear();
    const adjV2 = makeAdj({ holdAmount: 200, frontedAmount: 0 });
    // payout=50, hold=200 → net = -150 → carry 150
    const periodV2 = makePeriod({ agentAdjustments: [adjV2], entries: [entry], carryoverExecuted: false });
    mockPeriodFindUnique.mockResolvedValueOnce(periodV2);

    const r3 = await executeCarryover('period-1');
    expect(r3.carried).toBe(1);
    expect(r3.skipped).toBe(false);
    const secondUpsert = mockAdjUpsert.mock.calls[0][0];
    expect(secondUpsert.create.holdAmount).toBe(150);
    expect(secondUpsert.create.carryoverAmount).toBe(150);
    expect(secondUpsert.update.holdAmount).toEqual({ increment: 150 });
    expect(secondUpsert.update.carryoverAmount).toEqual({ increment: 150 });
  });
});

// ── CARRY-11: Next-period selection across timezone boundary ─────
describe('CARRY-11: executeCarryover writes carryover to NEXT period, not source period (timezone regression)', () => {
  it('upserts the carryover hold on the next week id, not the source id, across the EDT/UTC boundary', async () => {
    // Real UTC-midnight dates that exercise the EDT/UTC boundary.
    // Phase 78: use D-10 trigger (negative net) instead of D-09 (fronted carry).
    const sourceWeekStart = new Date('2026-03-29T00:00:00.000Z');
    const sourceWeekEnd = new Date('2026-04-04T00:00:00.000Z');
    const sourceId = `${sourceWeekStart.toISOString()}_${sourceWeekEnd.toISOString()}`;
    const expectedNextId = '2026-04-05T00:00:00.000Z_2026-04-11T00:00:00.000Z';

    // payout=50, hold=300 → net = 50 - 300 = -250 → carry 250 to next period
    const adj = makeAdj({ agentId: 'A1', frontedAmount: 0, holdAmount: 300, bonusAmount: 0 });
    const entry = makeEntry({ agentId: 'A1', payoutAmount: 50, adjustmentAmount: 0 });
    mockPeriodFindUnique.mockResolvedValueOnce({
      id: sourceId,
      weekStart: sourceWeekStart,
      weekEnd: sourceWeekEnd,
      carryoverExecuted: false,
      agentAdjustments: [adj],
      entries: [entry],
    });
    mockPeriodUpsert.mockResolvedValueOnce({ id: expectedNextId });
    mockAdjUpsert.mockResolvedValueOnce({});
    mockPeriodUpdate.mockResolvedValueOnce({});

    const result = await executeCarryover(sourceId);

    expect(result).toEqual({ carried: 1, skipped: false });

    // Assertion 1: the "ensure next period exists" upsert targets the next period id.
    const nextPeriodUpsertCall = mockPeriodUpsert.mock.calls[0][0];
    expect(nextPeriodUpsertCall.where.id).toBe(expectedNextId);
    expect(nextPeriodUpsertCall.where.id).not.toBe(sourceId);

    // Assertion 2: the agent adjustment upsert targets the next period.
    const adjUpsertCall = mockAdjUpsert.mock.calls[0][0];
    expect(adjUpsertCall.where.agentId_payrollPeriodId.payrollPeriodId).toBe(expectedNextId);
    expect(adjUpsertCall.where.agentId_payrollPeriodId.payrollPeriodId).not.toBe(sourceId);

    // Assertion 3: hold amount equals abs(negative net) = 250 (D-10 contract).
    expect(Number(adjUpsertCall.create.holdAmount)).toBe(250);
    expect(Number(adjUpsertCall.create.carryoverAmount)).toBe(250);
    expect(adjUpsertCall.create.carryoverSourcePeriodId).toBe(sourceId);
  });
});

// ── CARRY-10: Partial reversal preserves non-carryover hold ──────
describe('CARRY-10: reverseCarryover preserves hold contributed by other sources', () => {
  it('keeps remaining holdAmount and zeroes carryoverAmount only', async () => {
    mockPeriodFindUnique.mockResolvedValue({ id: 'period-1', carryoverExecuted: true });
    // holdAmount 500 but only 200 came from carryover (300 from some other source)
    mockAdjFindMany.mockResolvedValue([
      {
        id: 'next-adj-1',
        holdAmount: 500,
        holdFromCarryover: true,
        holdLabel: 'Fronted Hold',
        carryoverSourcePeriodId: 'period-1',
        carryoverAmount: 200,
      },
    ]);

    const result = await reverseCarryover('period-1');

    expect(result.reversed).toBe(200);
    expect(result.rowsTouched).toBe(1);
    // Partial reversal: keep metadata, clear carryoverAmount, hold drops by carried amount
    expect(mockAdjUpdate).toHaveBeenCalledWith({
      where: { id: 'next-adj-1' },
      data: {
        holdAmount: 300,
        carryoverAmount: null,
      },
    });
  });
});
