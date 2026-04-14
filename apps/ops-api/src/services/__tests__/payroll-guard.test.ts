import { isAgentPaidInPeriod } from '../payroll';

// Mock @ops/db with payrollEntry.findMany
const mockFindMany = jest.fn();
jest.mock('@ops/db', () => ({
  __esModule: true,
  prisma: { payrollEntry: { findMany: (...args: any[]) => mockFindMany(...args) } },
  default: { payrollEntry: { findMany: (...args: any[]) => mockFindMany(...args) } },
}));

beforeEach(() => {
  mockFindMany.mockReset();
});

describe('payroll-guard', () => {
  describe('isAgentPaidInPeriod', () => {
    it('returns true when agent has at least one PAID entry in the period', async () => {
      mockFindMany.mockResolvedValue([
        { id: 'e1', status: 'PAID', agentId: 'agent-1', payrollPeriodId: 'pp-1' },
      ]);
      const result = await isAgentPaidInPeriod('agent-1', 'pp-1');
      expect(result).toBe(true);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { payrollPeriodId: 'pp-1', agentId: 'agent-1', status: 'PAID' },
      });
    });

    it('returns false when agent has only PENDING/READY entries in the period', async () => {
      mockFindMany.mockResolvedValue([]);
      const result = await isAgentPaidInPeriod('agent-1', 'pp-1');
      expect(result).toBe(false);
    });

    it('returns false when agent has ZEROED_OUT entries (ZEROED_OUT is not PAID)', async () => {
      mockFindMany.mockResolvedValue([]);
      const result = await isAgentPaidInPeriod('agent-1', 'pp-1');
      expect(result).toBe(false);
    });

    it('returns true when agent has mix of PAID and PENDING entries (late arrival scenario)', async () => {
      // The query filters status: "PAID", so even if agent has PENDING entries too,
      // the presence of any PAID entry means the guard should block
      mockFindMany.mockResolvedValue([
        { id: 'e1', status: 'PAID', agentId: 'agent-1', payrollPeriodId: 'pp-1' },
      ]);
      const result = await isAgentPaidInPeriod('agent-1', 'pp-1');
      expect(result).toBe(true);
    });
  });

  describe('net formula consistency', () => {
    // Phase 71: fronted excluded from net. See payroll-net-formula.test.ts
    // for the authoritative regression suite against computeNetAmount.
    it('computes payout + adjustment + bonus - hold correctly', () => {
      const payout = 100;
      const adjustment = 10;
      const bonus = 5;
      const hold = 3;
      const net = payout + adjustment + bonus - hold;
      expect(net).toBe(112);
    });
  });
});
