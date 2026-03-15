describe('Status change workflow', () => {
  describe('PATCH /sales/:id/status', () => {
    it.todo('creates StatusChangeRequest when changing Dead->Ran');
    it.todo('creates StatusChangeRequest when changing Declined->Ran');
    it.todo('returns 409 if pending change request already exists');
    it.todo('applies Dead->Declined immediately with no commission impact');
    it.todo('applies Ran->Dead immediately and zeroes commission');
  });

  describe('POST /status-change-requests/:id/approve', () => {
    it.todo('updates sale status to RAN on approval');
    it.todo('recalculates commission via upsertPayrollEntryForSale on approval');
  });

  describe('POST /status-change-requests/:id/reject', () => {
    it.todo('leaves sale at original status on rejection');
  });
});
