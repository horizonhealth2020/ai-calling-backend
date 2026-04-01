import { executeCarryover } from '../carryover';

// ── Mock @ops/db ──────────────────────────────────────────────────
const mockPeriodFindUnique = jest.fn();
const mockPeriodUpsert = jest.fn();
const mockPeriodUpdate = jest.fn();
const mockAdjUpsert = jest.fn();

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
    },
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
  // Default: next period upsert returns an object
  mockPeriodUpsert.mockResolvedValue({ id: 'next-period' });
  mockPeriodUpdate.mockResolvedValue({});
  mockAdjUpsert.mockResolvedValue({});
});

// ── CARRY-02: Fronted carries as hold ─────────────────────────────
describe('CARRY-02: Fronted auto-carries as hold', () => {
  it('creates hold=200 in next period when agent has fronted=200 and net >= 0', async () => {
    const adj = makeAdj({ frontedAmount: 200, holdAmount: 0, bonusAmount: 0 });
    const entry = makeEntry({ agentId: 'agent-1', payoutAmount: 300, adjustmentAmount: 0 });
    const period = makePeriod({ agentAdjustments: [adj], entries: [entry] });
    mockPeriodFindUnique.mockResolvedValue(period);

    const result = await executeCarryover('period-1');

    expect(result.carried).toBe(1);
    expect(result.skipped).toBe(false);
    expect(mockAdjUpsert).toHaveBeenCalledTimes(1);
    const call = mockAdjUpsert.mock.calls[0][0];
    expect(call.create.holdAmount).toBe(200);
    expect(call.create.holdFromCarryover).toBe(true);
    expect(call.create.holdLabel).toBe('Fronted Hold');
    expect(call.update.holdAmount).toEqual({ increment: 200 });
  });
});

// ── CARRY-03: Negative net carries as hold ────────────────────────
describe('CARRY-03: Negative net carries as hold', () => {
  it('carries fronted + negative net as hold when net is negative', async () => {
    // Agent has fronted=100, hold=400, bonus=0, payout=50, adj=0
    // Net = 50 + 0 + 0 + 100 - 400 = -250
    // Carry = fronted(100) + abs(-250) = 350
    const adj = makeAdj({ frontedAmount: 100, holdAmount: 400, bonusAmount: 0 });
    const entry = makeEntry({ agentId: 'agent-1', payoutAmount: 50, adjustmentAmount: 0 });
    const period = makePeriod({ agentAdjustments: [adj], entries: [entry] });
    mockPeriodFindUnique.mockResolvedValue(period);

    const result = await executeCarryover('period-1');

    expect(result.carried).toBe(1);
    const call = mockAdjUpsert.mock.calls[0][0];
    expect(call.create.holdAmount).toBe(350);
    expect(call.update.holdAmount).toEqual({ increment: 350 });
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
  it('uses increment in update clause to add to existing holdAmount', async () => {
    const adj = makeAdj({ frontedAmount: 150 });
    const entry = makeEntry({ agentId: 'agent-1', payoutAmount: 200 });
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
