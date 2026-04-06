describe("POST /api/chargebacks/preview", () => {
  it.todo("returns MATCHED status when exactly one sale matches memberId (CB-01, CB-03)");
  it.todo("returns MULTIPLE status when several sales match the same memberId (CB-02, CB-03)");
  it.todo("returns UNMATCHED status when no sale matches the memberId (CB-03)");
  it.todo("uses a single IN query for all memberIds instead of N+1 lookups (CB-01)");
  it.todo("does not create any database records (read-only preview)");
  it.todo("returns 400 for invalid request body");
  it.todo("returns 401 without auth token");
});
