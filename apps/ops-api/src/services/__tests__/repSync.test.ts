import { batchRoundRobinAssign } from '../repSync';

// ── In-memory cursor + roster state shared across tx and root client ──────
let cursorStore: Record<string, string> = {};
let activeReps: Array<{ id: string; name: string; active: boolean }> = [];

// Build a tx-shaped client that reads/writes the shared in-memory state.
function makeClient() {
  return {
    csRepRoster: {
      findMany: jest.fn(async (_args: any) => {
        return [...activeReps]
          .filter((r) => r.active)
          .sort((a, b) => a.name.localeCompare(b.name));
      }),
    },
    salesBoardSetting: {
      findUnique: jest.fn(async ({ where }: any) => {
        const value = cursorStore[where.key];
        return value !== undefined ? { key: where.key, value } : null;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        if (cursorStore[where.key] !== undefined) {
          cursorStore[where.key] = update.value;
        } else {
          cursorStore[where.key] = create.value;
        }
        return { key: where.key, value: cursorStore[where.key] };
      }),
    },
  };
}

// Transaction runner that lets the callback throw to roll back.
const mockTransaction = jest.fn(async (cb: any) => {
  // Snapshot state so RR-03 can verify rollback semantics.
  const snapshot = { ...cursorStore };
  try {
    return await cb(makeClient());
  } catch (err) {
    cursorStore = snapshot; // simulate rollback
    throw err;
  }
});

jest.mock('@ops/db', () => {
  const client = {
    csRepRoster: {
      findMany: (...args: any[]) => (mockClient.csRepRoster.findMany as any)(...args),
    },
    salesBoardSetting: {
      findUnique: (...args: any[]) => (mockClient.salesBoardSetting.findUnique as any)(...args),
      upsert: (...args: any[]) => (mockClient.salesBoardSetting.upsert as any)(...args),
    },
    $transaction: (cb: any) => mockTransaction(cb),
  };
  return { __esModule: true, prisma: client, default: {} };
});

// Root-level client used for non-tx callers (none in these tests but kept for parity).
const mockClient = makeClient();

beforeEach(() => {
  cursorStore = {};
  activeReps = [
    { id: 'rep-1', name: 'Alice', active: true },
    { id: 'rep-2', name: 'Bob', active: true },
    { id: 'rep-3', name: 'Carol', active: true },
  ];
  mockTransaction.mockClear();
});

// ── RR-01: Preview does not advance cursor ────────────────────────
describe('RR-01: Preview does not advance cursor', () => {
  it('returns deterministic assignments without mutating salesBoardSetting', async () => {
    cursorStore['cs_round_robin_chargeback_index'] = '0';

    const assignments = await batchRoundRobinAssign('chargeback', 2, { persist: false });

    expect(assignments).toEqual(['Alice', 'Bob']);
    // Cursor unchanged
    expect(cursorStore['cs_round_robin_chargeback_index']).toBe('0');
  });
});

// ── RR-02: Commit advances cursor ─────────────────────────────────
describe('RR-02: Commit advances cursor', () => {
  it('persists the new cursor index modulo activeReps.length', async () => {
    cursorStore['cs_round_robin_chargeback_index'] = '0';

    const first = await batchRoundRobinAssign('chargeback', 2, { persist: true });
    expect(first).toEqual(['Alice', 'Bob']);
    expect(cursorStore['cs_round_robin_chargeback_index']).toBe('2'); // 2 % 3 = 2

    const second = await batchRoundRobinAssign('chargeback', 2, { persist: true });
    expect(second).toEqual(['Carol', 'Alice']);
    expect(cursorStore['cs_round_robin_chargeback_index']).toBe('1'); // (2+2) % 3 = 1
  });
});

// ── RR-03: Rollback on transaction failure ────────────────────────
describe('RR-03: Rollback on transaction failure', () => {
  it('leaves cursor at pre-submit value when the parent tx throws', async () => {
    cursorStore['cs_round_robin_chargeback_index'] = '0';

    await expect(
      mockTransaction(async (tx: any) => {
        await batchRoundRobinAssign('chargeback', 2, { persist: true, tx });
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(cursorStore['cs_round_robin_chargeback_index']).toBe('0');
  });
});

// ── RR-04: Preview is deterministic across calls ──────────────────
describe('RR-04: Preview is deterministic across calls', () => {
  it('two consecutive preview calls return identical assignments', async () => {
    cursorStore['cs_round_robin_chargeback_index'] = '0';

    const a = await batchRoundRobinAssign('chargeback', 3, { persist: false });
    const b = await batchRoundRobinAssign('chargeback', 3, { persist: false });

    expect(a).toEqual(['Alice', 'Bob', 'Carol']);
    expect(b).toEqual(['Alice', 'Bob', 'Carol']);
    expect(cursorStore['cs_round_robin_chargeback_index']).toBe('0');
  });
});
