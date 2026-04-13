import { applyChargebackToEntry } from '../payroll';
import type { Prisma } from '@prisma/client';

// ── Mock TransactionClient builder ──────────────────────────────

function buildMockTx(overrides: {
  periodStatus?: string;
  oldestOpenId?: string | null;
  updatedEntry?: { id: string };
  createdEntry?: { id: string };
} = {}) {
  const mockFindUnique = jest.fn().mockResolvedValue(
    overrides.periodStatus !== undefined ? { status: overrides.periodStatus } : null,
  );
  const mockFindFirst = jest.fn().mockResolvedValue(
    overrides.oldestOpenId ? { id: overrides.oldestOpenId } : null,
  );
  const mockUpdate = jest.fn().mockResolvedValue(
    overrides.updatedEntry ?? { id: 'updated-entry-1' },
  );
  const mockCreate = jest.fn().mockResolvedValue(
    overrides.createdEntry ?? { id: 'created-entry-1' },
  );

  const tx = {
    payrollPeriod: { findUnique: mockFindUnique, findFirst: mockFindFirst },
    payrollEntry: { update: mockUpdate, create: mockCreate },
  } as unknown as Prisma.TransactionClient;

  return { tx, mockFindUnique, mockFindFirst, mockUpdate, mockCreate };
}

// ── Test Helpers ────────────────────────────────────────────────

function makeSaleArg(overrides: Partial<{
  id: string;
  agentId: string;
  payrollEntries: { id: string; payrollPeriodId: string; payoutAmount: number; status?: string; createdAt?: Date }[];
}> = {}) {
  return {
    id: overrides.id ?? 'sale-1',
    agentId: overrides.agentId ?? 'agent-1',
    payrollEntries: overrides.payrollEntries ?? [
      {
        id: 'entry-1',
        payrollPeriodId: 'period-1',
        payoutAmount: 50,
        status: 'ACTIVE',
        createdAt: new Date('2026-03-10T12:00:00Z'),
      },
    ],
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyChargebackToEntry', () => {

  describe('in-period (OPEN)', () => {
    it('zeros payoutAmount and netAmount on original entry', async () => {
      const { tx, mockUpdate } = buildMockTx({ periodStatus: 'OPEN' });
      const sale = makeSaleArg();

      await applyChargebackToEntry(tx, sale, 50);

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: 'entry-1' },
        data: {
          payoutAmount: 0,
          netAmount: 0,
          status: 'ZEROED_OUT_IN_PERIOD',
        },
      });
    });

    it('returns mode "in_period" with entry id', async () => {
      const { tx } = buildMockTx({ periodStatus: 'OPEN', updatedEntry: { id: 'entry-1' } });
      const sale = makeSaleArg();

      const result = await applyChargebackToEntry(tx, sale, 50);

      expect(result).toEqual({ mode: 'in_period', entryId: 'entry-1' });
    });
  });

  describe('cross-period (LOCKED)', () => {
    it('creates new negative entry in oldest OPEN period', async () => {
      const { tx, mockCreate } = buildMockTx({
        periodStatus: 'LOCKED',
        oldestOpenId: 'open-period-1',
      });
      const sale = makeSaleArg();

      await applyChargebackToEntry(tx, sale, 50);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          payrollPeriodId: 'open-period-1',
          saleId: 'sale-1',
          agentId: 'agent-1',
          payoutAmount: 0,
          adjustmentAmount: -50,
          netAmount: -50,
          status: 'CLAWBACK_CROSS_PERIOD',
        },
      });
    });

    it('does not modify the original entry', async () => {
      const { tx, mockUpdate } = buildMockTx({
        periodStatus: 'LOCKED',
        oldestOpenId: 'open-period-1',
      });
      const sale = makeSaleArg();

      await applyChargebackToEntry(tx, sale, 50);

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns mode "cross_period" with new entry id', async () => {
      const { tx } = buildMockTx({
        periodStatus: 'LOCKED',
        oldestOpenId: 'open-period-1',
        createdEntry: { id: 'cross-entry-1' },
      });
      const sale = makeSaleArg();

      const result = await applyChargebackToEntry(tx, sale, 50);

      expect(result).toEqual({ mode: 'cross_period', entryId: 'cross-entry-1' });
    });

    it('works for FINALIZED period (same as LOCKED)', async () => {
      const { tx, mockCreate } = buildMockTx({
        periodStatus: 'FINALIZED',
        oldestOpenId: 'open-period-1',
      });
      const sale = makeSaleArg();

      const result = await applyChargebackToEntry(tx, sale, 75);

      expect(result.mode).toBe('cross_period');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            adjustmentAmount: -75,
            netAmount: -75,
          }),
        }),
      );
    });
  });

  describe('entry filtering', () => {
    it('skips entries with CLAWBACK_APPLIED status', async () => {
      const { tx, mockFindUnique } = buildMockTx({ periodStatus: 'OPEN' });
      const sale = makeSaleArg({
        payrollEntries: [
          { id: 'clawed-1', payrollPeriodId: 'p-1', payoutAmount: 50, status: 'CLAWBACK_APPLIED', createdAt: new Date('2026-03-01') },
          { id: 'live-1', payrollPeriodId: 'p-2', payoutAmount: 50, status: 'ACTIVE', createdAt: new Date('2026-03-05') },
        ],
      });

      await applyChargebackToEntry(tx, sale, 50);

      // findUnique should be called with the LIVE entry's period, not the clawed-back one
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'p-2' },
        select: { status: true },
      });
    });

    it('skips entries with ZEROED_OUT_IN_PERIOD status', async () => {
      const { tx, mockFindUnique } = buildMockTx({ periodStatus: 'OPEN' });
      const sale = makeSaleArg({
        payrollEntries: [
          { id: 'zeroed-1', payrollPeriodId: 'p-1', payoutAmount: 0, status: 'ZEROED_OUT_IN_PERIOD', createdAt: new Date('2026-03-01') },
          { id: 'live-1', payrollPeriodId: 'p-2', payoutAmount: 50, status: 'ACTIVE', createdAt: new Date('2026-03-05') },
        ],
      });

      await applyChargebackToEntry(tx, sale, 50);

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'p-2' },
        select: { status: true },
      });
    });

    it('skips entries with CLAWBACK_CROSS_PERIOD status', async () => {
      const { tx, mockFindUnique } = buildMockTx({ periodStatus: 'OPEN' });
      const sale = makeSaleArg({
        payrollEntries: [
          { id: 'cross-1', payrollPeriodId: 'p-1', payoutAmount: 0, status: 'CLAWBACK_CROSS_PERIOD', createdAt: new Date('2026-03-01') },
          { id: 'live-1', payrollPeriodId: 'p-2', payoutAmount: 50, status: 'ACTIVE', createdAt: new Date('2026-03-05') },
        ],
      });

      await applyChargebackToEntry(tx, sale, 50);

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'p-2' },
        select: { status: true },
      });
    });

    it('selects oldest non-clawback entry by createdAt ascending', async () => {
      const { tx, mockFindUnique } = buildMockTx({ periodStatus: 'OPEN' });
      const sale = makeSaleArg({
        payrollEntries: [
          { id: 'newer', payrollPeriodId: 'p-2', payoutAmount: 50, status: 'ACTIVE', createdAt: new Date('2026-03-10') },
          { id: 'oldest', payrollPeriodId: 'p-1', payoutAmount: 50, status: 'ACTIVE', createdAt: new Date('2026-03-01') },
        ],
      });

      await applyChargebackToEntry(tx, sale, 50);

      // Should pick oldest entry (p-1), not newer (p-2)
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        select: { status: true },
      });
    });
  });

  describe('error cases', () => {
    it('throws when no eligible live entry exists', async () => {
      const { tx } = buildMockTx();
      const sale = makeSaleArg({
        payrollEntries: [
          { id: 'clawed-1', payrollPeriodId: 'p-1', payoutAmount: 0, status: 'ZEROED_OUT_IN_PERIOD', createdAt: new Date() },
          { id: 'clawed-2', payrollPeriodId: 'p-2', payoutAmount: 0, status: 'CLAWBACK_CROSS_PERIOD', createdAt: new Date() },
        ],
      });

      await expect(applyChargebackToEntry(tx, sale, 50)).rejects.toThrow(
        'has no eligible live payroll entry',
      );
    });

    it('throws when sale has empty payroll entries', async () => {
      const { tx } = buildMockTx();
      const sale = makeSaleArg({ payrollEntries: [] });

      await expect(applyChargebackToEntry(tx, sale, 50)).rejects.toThrow(
        'has no eligible live payroll entry',
      );
    });

    it('throws when no OPEN period exists for cross-period', async () => {
      const { tx } = buildMockTx({
        periodStatus: 'LOCKED',
        oldestOpenId: null,
      });
      const sale = makeSaleArg();

      await expect(applyChargebackToEntry(tx, sale, 50)).rejects.toThrow(
        'No OPEN payroll period exists',
      );
    });

    it('error message includes sale ID for debugging', async () => {
      const { tx } = buildMockTx();
      const sale = makeSaleArg({ id: 'sale-xyz-123', payrollEntries: [] });

      await expect(applyChargebackToEntry(tx, sale, 50)).rejects.toThrow(
        'sale-xyz-123',
      );
    });
  });
});
