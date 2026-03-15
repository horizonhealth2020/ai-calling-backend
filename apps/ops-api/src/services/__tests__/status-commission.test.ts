describe('Status-based commission gating', () => {
  describe('upsertPayrollEntryForSale', () => {
    it.todo('generates normal commission for RAN sales');
    it.todo('generates $0 payroll entry for DECLINED sales');
    it.todo('generates $0 payroll entry for DEAD sales');
    it.todo('zeroes commission immediately when status changes from RAN to DEAD');
    it.todo('zeroes commission immediately when status changes from RAN to DECLINED');
    it.todo('creates negative adjustment for finalized period when RAN->Dead/Declined');
  });
});
