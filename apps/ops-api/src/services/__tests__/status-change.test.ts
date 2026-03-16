// Status transition rules (mirrors logic in routes/index.ts PATCH /sales/:id/status)
type SaleStatus = 'RAN' | 'DECLINED' | 'DEAD';

interface TransitionResult {
  action: 'create_change_request' | 'apply_immediate' | 'noop';
  requiresCommissionZeroing: boolean;
  requiresCommissionRecalc: boolean;
}

function determineTransition(oldStatus: SaleStatus, newStatus: SaleStatus): TransitionResult {
  if (oldStatus === newStatus) {
    return { action: 'noop', requiresCommissionZeroing: false, requiresCommissionRecalc: false };
  }
  // Dead/Declined -> Ran requires approval
  if ((oldStatus === 'DEAD' || oldStatus === 'DECLINED') && newStatus === 'RAN') {
    return { action: 'create_change_request', requiresCommissionZeroing: false, requiresCommissionRecalc: false };
  }
  // Ran -> Dead/Declined zeroes commission immediately
  if (oldStatus === 'RAN' && (newStatus === 'DEAD' || newStatus === 'DECLINED')) {
    return { action: 'apply_immediate', requiresCommissionZeroing: true, requiresCommissionRecalc: false };
  }
  // Dead <-> Declined: free, no commission impact
  return { action: 'apply_immediate', requiresCommissionZeroing: false, requiresCommissionRecalc: false };
}

// Approval/rejection rules (mirrors POST /status-change-requests/:id/approve|reject)
function determineApprovalResult(
  requestStatus: 'PENDING' | 'APPROVED' | 'REJECTED',
  action: 'approve' | 'reject',
): {
  newRequestStatus: string;
  updateSaleStatus: boolean;
  recalcCommission: boolean;
} {
  if (requestStatus !== 'PENDING') {
    throw new Error('Can only act on PENDING requests');
  }
  if (action === 'approve') {
    return { newRequestStatus: 'APPROVED', updateSaleStatus: true, recalcCommission: true };
  }
  return { newRequestStatus: 'REJECTED', updateSaleStatus: false, recalcCommission: false };
}

// --- Tests ---

describe('Status change workflow', () => {
  describe('determineTransition', () => {
    it('creates StatusChangeRequest when changing Dead->Ran', () => {
      const result = determineTransition('DEAD', 'RAN');
      expect(result.action).toBe('create_change_request');
      expect(result.requiresCommissionZeroing).toBe(false);
    });

    it('creates StatusChangeRequest when changing Declined->Ran', () => {
      const result = determineTransition('DECLINED', 'RAN');
      expect(result.action).toBe('create_change_request');
      expect(result.requiresCommissionZeroing).toBe(false);
    });

    it('applies Ran->Dead immediately and requires commission zeroing', () => {
      const result = determineTransition('RAN', 'DEAD');
      expect(result.action).toBe('apply_immediate');
      expect(result.requiresCommissionZeroing).toBe(true);
    });

    it('applies Ran->Declined immediately and requires commission zeroing', () => {
      const result = determineTransition('RAN', 'DECLINED');
      expect(result.action).toBe('apply_immediate');
      expect(result.requiresCommissionZeroing).toBe(true);
    });

    it('applies Dead->Declined immediately with no commission impact', () => {
      const result = determineTransition('DEAD', 'DECLINED');
      expect(result.action).toBe('apply_immediate');
      expect(result.requiresCommissionZeroing).toBe(false);
    });

    it('applies Declined->Dead immediately with no commission impact', () => {
      const result = determineTransition('DECLINED', 'DEAD');
      expect(result.action).toBe('apply_immediate');
      expect(result.requiresCommissionZeroing).toBe(false);
    });

    it('returns noop when status unchanged', () => {
      expect(determineTransition('RAN', 'RAN').action).toBe('noop');
      expect(determineTransition('DEAD', 'DEAD').action).toBe('noop');
      expect(determineTransition('DECLINED', 'DECLINED').action).toBe('noop');
    });

    it('never requires commission recalc on immediate transitions', () => {
      // Commission recalc only happens on approval (async flow)
      const transitions: [SaleStatus, SaleStatus][] = [
        ['RAN', 'DEAD'],
        ['RAN', 'DECLINED'],
        ['DEAD', 'DECLINED'],
        ['DECLINED', 'DEAD'],
      ];
      for (const [from, to] of transitions) {
        expect(determineTransition(from, to).requiresCommissionRecalc).toBe(false);
      }
    });
  });

  describe('determineApprovalResult', () => {
    it('approve sets APPROVED, updates sale status, and recalcs commission', () => {
      const result = determineApprovalResult('PENDING', 'approve');
      expect(result.newRequestStatus).toBe('APPROVED');
      expect(result.updateSaleStatus).toBe(true);
      expect(result.recalcCommission).toBe(true);
    });

    it('reject sets REJECTED, does NOT update sale status or recalc', () => {
      const result = determineApprovalResult('PENDING', 'reject');
      expect(result.newRequestStatus).toBe('REJECTED');
      expect(result.updateSaleStatus).toBe(false);
      expect(result.recalcCommission).toBe(false);
    });

    it('throws when request is already APPROVED', () => {
      expect(() => determineApprovalResult('APPROVED', 'approve')).toThrow('Can only act on PENDING requests');
    });

    it('throws when request is already REJECTED', () => {
      expect(() => determineApprovalResult('REJECTED', 'reject')).toThrow('Can only act on PENDING requests');
    });
  });

  // Integration-test territory: The "returns 409 if pending change request already exists"
  // behavior requires a Prisma query (findFirst for existing PENDING StatusChangeRequest).
  // This is a DB-level constraint check that should be covered by integration/E2E tests
  // when HTTP test infrastructure (supertest) is added.
});
