import { reverseClawback } from '../payroll';
import { createRecoveryAlert } from '../alerts';
import type { Prisma } from '@prisma/client';

// @ops/db is mocked at jest.config.ts level (maps to __mocks__/ops-db.ts → {}).
// All tests here pass an explicit tx to the functions under test, so the
// default-prisma-path is never exercised.

// Socket emits are fire-and-forget with try/catch; no-op them here.
// Path: test file is at src/services/__tests__/*.test.ts; socket.ts is at src/socket.ts.
jest.mock('../../socket', () => ({
  emitAlertCreated: jest.fn(),
  emitAlertResolved: jest.fn(),
  emitClawbackCreated: jest.fn(),
  emitClawbackReversed: jest.fn(),
}));

// ── Fixtures ─────────────────────────────────────────────────────

function makeClawback(overrides: {
  id?: string;
  saleId?: string;
  agentId?: string;
  amount?: number;
  appliedPayrollPeriodId?: string | null;
  appliedPeriodStatus?: 'OPEN' | 'LOCKED' | 'FINALIZED';
  entries?: Array<{ id: string; payrollPeriodId: string; payoutAmount: number; adjustmentAmount?: number; status: string; createdAt?: Date }>;
} = {}) {
  const periodId = overrides.appliedPayrollPeriodId === null ? null : (overrides.appliedPayrollPeriodId ?? 'period-1');
  return {
    id: overrides.id ?? 'cb-1',
    saleId: overrides.saleId ?? 'sale-1',
    agentId: overrides.agentId ?? 'agent-1',
    amount: overrides.amount ?? 50,
    appliedPayrollPeriodId: periodId,
    appliedPayrollPeriod: periodId ? { id: periodId, status: overrides.appliedPeriodStatus ?? 'OPEN' } : null,
    sale: {
      id: overrides.saleId ?? 'sale-1',
      agentId: overrides.agentId ?? 'agent-1',
      payrollEntries: overrides.entries ?? [
        {
          id: 'entry-zeroed',
          payrollPeriodId: periodId ?? 'period-1',
          payoutAmount: 0,
          adjustmentAmount: 0,
          status: 'ZEROED_OUT_IN_PERIOD',
          createdAt: new Date('2026-04-10T12:00:00Z'),
        },
      ],
      agent: { id: overrides.agentId ?? 'agent-1', name: 'Test Agent' },
    },
  };
}

function buildMockTx(overrides: {
  clawback?: ReturnType<typeof makeClawback> | null;
  deleteClawbackThrows?: { code?: string; message?: string } | null;
  payrollAlert?: { findFirst?: jest.Mock; create?: jest.Mock; count?: jest.Mock };
  // Phase 81-05: mock tx.payrollPeriod.findUnique for the ENTRY's actual-period OPEN check.
  // Default: returns OPEN unless overridden.
  entryPeriodStatus?: 'OPEN' | 'LOCKED' | 'FINALIZED';
} = {}) {
  const clawbackFindUnique = jest.fn().mockResolvedValue(overrides.clawback ?? null);
  const payrollEntryDelete = jest.fn().mockResolvedValue({ id: 'deleted' });
  const clawbackProductDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
  const clawbackDelete = overrides.deleteClawbackThrows
    ? jest.fn().mockRejectedValue(overrides.deleteClawbackThrows)
    : jest.fn().mockResolvedValue({ id: 'deleted' });
  const payrollPeriodFindUnique = jest.fn().mockResolvedValue({ status: overrides.entryPeriodStatus ?? 'OPEN' });

  const tx = {
    clawback: { findUnique: clawbackFindUnique, delete: clawbackDelete },
    payrollEntry: { delete: payrollEntryDelete },
    payrollPeriod: { findUnique: payrollPeriodFindUnique },
    clawbackProduct: { deleteMany: clawbackProductDeleteMany },
    payrollAlert: {
      findFirst: overrides.payrollAlert?.findFirst ?? jest.fn().mockResolvedValue(null),
      create: overrides.payrollAlert?.create ?? jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'alert-new', ...args.data })),
      count: overrides.payrollAlert?.count ?? jest.fn().mockResolvedValue(0),
    },
  } as unknown as Prisma.TransactionClient;

  return { tx, clawbackFindUnique, payrollEntryDelete, clawbackProductDeleteMany, clawbackDelete, payrollPeriodFindUnique };
}

// ── Tests: reverseClawback ──────────────────────────────────────

describe('reverseClawback', () => {
  describe('in-period mode', () => {
    it('deletes ZEROED_OUT_IN_PERIOD entry, calls upsertFn, deletes clawback products + row', async () => {
      const upsertFn = jest.fn().mockResolvedValue({ id: 'new-entry-from-upsert' });
      const clawback = makeClawback({
        entries: [{ id: 'entry-zeroed', payrollPeriodId: 'period-1', payoutAmount: 0, status: 'ZEROED_OUT_IN_PERIOD' }],
      });
      const { tx, payrollEntryDelete, clawbackProductDeleteMany, clawbackDelete } = buildMockTx({ clawback });

      const result = await reverseClawback(tx, 'cb-1', { upsertFn });

      expect(payrollEntryDelete).toHaveBeenCalledWith({ where: { id: 'entry-zeroed' } });
      expect(upsertFn).toHaveBeenCalledWith('sale-1', tx);
      expect(clawbackProductDeleteMany).toHaveBeenCalledWith({ where: { clawbackId: 'cb-1' } });
      expect(clawbackDelete).toHaveBeenCalledWith({ where: { id: 'cb-1' } });
      expect(result).toMatchObject({
        mode: 'in_period',
        entryId: 'entry-zeroed',
        newEntryId: 'new-entry-from-upsert',
        periodId: 'period-1',
        saleId: 'sale-1',
        agentId: 'agent-1',
        amount: 50,
      });
    });
  });

  describe('cross-period mode', () => {
    it('verifies state (payoutAmount=0, adjustmentAmount=-50) then deletes entry + clawback', async () => {
      const clawback = makeClawback({
        amount: 50,
        entries: [{
          id: 'entry-cross',
          payrollPeriodId: 'period-1',
          payoutAmount: 0,
          adjustmentAmount: -50,
          status: 'CLAWBACK_CROSS_PERIOD',
        }],
      });
      const { tx, payrollEntryDelete, clawbackDelete } = buildMockTx({ clawback });

      const result = await reverseClawback(tx, 'cb-1');

      expect(payrollEntryDelete).toHaveBeenCalledWith({ where: { id: 'entry-cross' } });
      expect(clawbackDelete).toHaveBeenCalledWith({ where: { id: 'cb-1' } });
      expect(result.mode).toBe('cross_period');
      expect(result.entryId).toBe('entry-cross');
    });

    it('throws on state mismatch when payoutAmount was manually edited', async () => {
      const clawback = makeClawback({
        amount: 50,
        entries: [{
          id: 'entry-cross',
          payrollPeriodId: 'period-1',
          payoutAmount: 10, // edited — should be 0
          adjustmentAmount: -50,
          status: 'CLAWBACK_CROSS_PERIOD',
        }],
      });
      const { tx, payrollEntryDelete, clawbackDelete } = buildMockTx({ clawback });

      await expect(reverseClawback(tx, 'cb-1')).rejects.toThrow(/Entry modified post-clawback/);
      expect(payrollEntryDelete).not.toHaveBeenCalled();
      expect(clawbackDelete).not.toHaveBeenCalled();
    });

    it('throws on state mismatch when adjustmentAmount was manually edited', async () => {
      const clawback = makeClawback({
        amount: 50,
        entries: [{
          id: 'entry-cross',
          payrollPeriodId: 'period-1',
          payoutAmount: 0,
          adjustmentAmount: -25, // edited — should be -50
          status: 'CLAWBACK_CROSS_PERIOD',
        }],
      });
      const { tx } = buildMockTx({ clawback });

      await expect(reverseClawback(tx, 'cb-1')).rejects.toThrow(/Entry modified post-clawback/);
    });
  });

  describe('period-status gating (Phase 81-05: gated on entry\'s actual period)', () => {
    it('throws on LOCKED entry period', async () => {
      const clawback = makeClawback({
        entries: [{ id: 'entry-zeroed', payrollPeriodId: 'period-1', payoutAmount: 0, status: 'ZEROED_OUT_IN_PERIOD' }],
      });
      const { tx } = buildMockTx({ clawback, entryPeriodStatus: 'LOCKED' });

      await expect(reverseClawback(tx, 'cb-1')).rejects.toThrow(/period is LOCKED/);
    });

    it('throws on FINALIZED entry period', async () => {
      const clawback = makeClawback({
        entries: [{ id: 'entry-zeroed', payrollPeriodId: 'period-1', payoutAmount: 0, status: 'ZEROED_OUT_IN_PERIOD' }],
      });
      const { tx } = buildMockTx({ clawback, entryPeriodStatus: 'FINALIZED' });

      await expect(reverseClawback(tx, 'cb-1')).rejects.toThrow(/period is FINALIZED/);
    });
  });

  describe('error paths', () => {
    it('throws "Clawback not found" when findUnique returns null', async () => {
      const { tx } = buildMockTx({ clawback: null });

      await expect(reverseClawback(tx, 'cb-missing')).rejects.toThrow('Clawback not found');
    });

    it('throws manual-reconciliation error when no affected entry located', async () => {
      const clawback = makeClawback({
        entries: [{ id: 'entry-active', payrollPeriodId: 'period-1', payoutAmount: 100, status: 'ACTIVE' }],
      });
      const { tx } = buildMockTx({ clawback });

      await expect(reverseClawback(tx, 'cb-1')).rejects.toThrow(/cannot locate affected entry/);
    });

    it('maps Prisma P2025 on clawback.delete to "Clawback not found" (race loser)', async () => {
      const upsertFn = jest.fn().mockResolvedValue({ id: 'new-entry' });
      const clawback = makeClawback({
        entries: [{ id: 'entry-zeroed', payrollPeriodId: 'period-1', payoutAmount: 0, status: 'ZEROED_OUT_IN_PERIOD' }],
      });
      const { tx } = buildMockTx({
        clawback,
        deleteClawbackThrows: { code: 'P2025', message: 'Record not found' },
      });

      await expect(reverseClawback(tx, 'cb-1', { upsertFn })).rejects.toThrow('Clawback not found');
    });
  });
});

// ── Tests: createRecoveryAlert ──────────────────────────────────

describe('createRecoveryAlert', () => {
  it('creates a new PENDING RECOVERY alert when none exists', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({
      id: 'alert-1',
      type: 'RECOVERY',
      clawbackId: 'cb-1',
      agentId: 'agent-1',
      status: 'PENDING',
    });
    const count = jest.fn().mockResolvedValue(0);
    const { tx } = buildMockTx({ payrollAlert: { findFirst, create, count } });

    const { alert, pendingRecoveryAlertsForAgent } = await createRecoveryAlert(tx, {
      chargebackSubmissionId: 'sub-1',
      clawbackId: 'cb-1',
      agentId: 'agent-1',
      agentName: 'Test',
      customerName: 'Cust',
      amount: 50,
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { type: 'RECOVERY', clawbackId: 'cb-1', status: 'PENDING' },
    });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'RECOVERY',
        clawbackId: 'cb-1',
        chargebackSubmissionId: 'sub-1',
        agentId: 'agent-1',
        status: 'PENDING',
      }),
    });
    expect(alert).toMatchObject({ id: 'alert-1', type: 'RECOVERY' });
    expect(pendingRecoveryAlertsForAgent).toBe(0);
  });

  it('returns existing PENDING alert unchanged when one already exists (idempotent)', async () => {
    const existing = { id: 'alert-existing', type: 'RECOVERY', clawbackId: 'cb-1', status: 'PENDING' };
    const findFirst = jest.fn().mockResolvedValue(existing);
    const create = jest.fn();
    const count = jest.fn().mockResolvedValue(0);
    const { tx } = buildMockTx({ payrollAlert: { findFirst, create, count } });

    const { alert } = await createRecoveryAlert(tx, {
      chargebackSubmissionId: 'sub-1',
      clawbackId: 'cb-1',
      agentId: 'agent-1',
      amount: 50,
    });

    expect(alert).toBe(existing);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns pendingRecoveryAlertsForAgent count correctly', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({ id: 'alert-new', type: 'RECOVERY', clawbackId: 'cb-1' });
    const count = jest.fn().mockResolvedValue(2); // 2 OTHER pending recovery alerts for this agent
    const { tx } = buildMockTx({ payrollAlert: { findFirst, create, count } });

    const { pendingRecoveryAlertsForAgent } = await createRecoveryAlert(tx, {
      chargebackSubmissionId: 'sub-1',
      clawbackId: 'cb-1',
      agentId: 'agent-1',
      amount: 50,
    });

    expect(count).toHaveBeenCalledWith({
      where: { type: 'RECOVERY', status: 'PENDING', agentId: 'agent-1', id: { not: 'alert-new' } },
    });
    expect(pendingRecoveryAlertsForAgent).toBe(2);
  });
});
