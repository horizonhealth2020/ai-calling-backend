describe("POST /api/chargebacks (batch submit)", () => {
  it.todo("creates chargeback submissions for all records in a batch (CB-09)");
  it.todo("uses selectedSaleId when provided instead of re-running automatic matching (CB-09)");
  it.todo("falls back to automatic memberId matching when selectedSaleId is null (CB-09)");
  it.todo("creates clawback entries for matched chargebacks (CB-09)");
  it.todo("returns 201 with count of created chargebacks");
});
