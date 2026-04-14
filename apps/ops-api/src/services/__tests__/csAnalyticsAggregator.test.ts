import { getOutreachAnalytics } from "../csAnalyticsAggregator";

// ── In-memory fixture state ──────────────────────────────────────────
type RawCb = {
  assignedTo: string | null;
  submittedAt: Date;
  resolvedAt: Date | null;
  resolutionType: string | null;
  bypassReason: string | null;
  attemptCount: number;
};

let cbFixture: RawCb[] = [];
let ptFixture: RawCb[] = [];
let rosterFixture: string[] = [];
let cbThrows = false;

// Build Prisma mock matching the aggregator's expectations
jest.mock("@ops/db", () => {
  const shapeFind = (store: () => RawCb[]) => jest.fn(async (args: any) => {
    const gte = args?.where?.submittedAt?.gte?.getTime?.() ?? -Infinity;
    const lt = args?.where?.submittedAt?.lt?.getTime?.() ?? Infinity;
    return store()
      .filter(r => r.submittedAt.getTime() >= gte && r.submittedAt.getTime() < lt)
      .filter(r => args?.where?.assignedTo?.not === null ? r.assignedTo !== null : true)
      .map(r => ({
        assignedTo: r.assignedTo,
        submittedAt: r.submittedAt,
        resolvedAt: r.resolvedAt,
        resolutionType: r.resolutionType,
        bypassReason: r.bypassReason,
        _count: { contactAttempts: r.attemptCount },
      }));
  });

  const client = {
    chargebackSubmission: {
      findMany: (args: any) => {
        if (cbThrows) return Promise.reject(new Error("chargeback query failed"));
        return shapeFind(() => cbFixture)(args);
      },
    },
    pendingTerm: {
      findMany: shapeFind(() => ptFixture),
    },
    csRepRoster: {
      findMany: jest.fn(async (_args: any) => {
        return rosterFixture.map(name => ({ name }));
      }),
    },
  };
  return { __esModule: true, prisma: client, default: {} };
});

// ── Helpers ──────────────────────────────────────────────────────────
const WINDOW = {
  gte: new Date("2026-04-01T00:00:00Z"),
  lt: new Date("2026-04-20T00:00:00Z"),
};
const CUTOFF = new Date("2026-04-13T00:00:00.000Z");
const BEFORE = new Date("2026-04-10T00:00:00Z"); // pre-v2.9
const AFTER = new Date("2026-04-14T00:00:00Z");  // post-v2.9

function cb(partial: Partial<RawCb>): RawCb {
  return {
    assignedTo: "Jane Doe",
    submittedAt: AFTER,
    resolvedAt: null,
    resolutionType: null,
    bypassReason: null,
    attemptCount: 0,
    ...partial,
  };
}

function resetFixtures() {
  cbFixture = [];
  ptFixture = [];
  rosterFixture = ["Jane Doe", "John Smith", "Alice Ng"];
  cbThrows = false;
}

beforeEach(resetFixtures);

// ── Tests ────────────────────────────────────────────────────────────

describe("getOutreachAnalytics", () => {
  it("returns empty shape with zero records", async () => {
    const result = await getOutreachAnalytics(WINDOW);
    expect(result.cutoff).toBe(CUTOFF.toISOString());
    expect(result.chargebacks.leaderboard).toEqual([]);
    expect(result.pendingTerms.leaderboard).toEqual([]);
    expect(result.chargebacks.correlation).toHaveLength(5);
    expect(result.pendingTerms.correlation).toHaveLength(5);
    expect(result.bypass).toEqual({ totalCount: 0, topReasons: [], perRep: [] });
  });

  it("AC-T1 saveRate: divide-by-zero returns 0, not NaN", async () => {
    // Rep with open record only — no saved, no cancelled
    cbFixture = [cb({ assignedTo: "Jane Doe", submittedAt: AFTER })];
    const result = await getOutreachAnalytics(WINDOW);
    const row = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(row.saveRate).toBe(0);
    expect(Number.isNaN(row.saveRate)).toBe(false);
  });

  it("AC-T2 pre-v2.9 exclusion: excluded from worked/avgAttempts/correlation; included in outcome + saveRate", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", submittedAt: BEFORE, attemptCount: 5, resolvedAt: AFTER, resolutionType: "SAVED" }),
      cb({ assignedTo: "Jane Doe", submittedAt: AFTER, attemptCount: 2, resolvedAt: AFTER, resolutionType: "SAVED" }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const row = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;

    // Both count toward saved (outcome is backfillable)
    expect(row.saved).toBe(2);
    // saveRate uses saved/(saved+cancelled) = 2/2 = 100
    expect(row.saveRate).toBe(100);
    // worked: only post-cutoff record with attemptCount>0 → 1, not 2
    expect(row.worked).toBe(1);
    // avgAttempts: only v2.9+ resolved sample (attemptCount=2) → 2.0
    expect(row.avgAttempts).toBe(2);

    // Correlation buckets: only the v2.9+ record (2 attempts) populates the "2" bucket
    const b2 = result.chargebacks.correlation.find(b => b.bucket === "2")!;
    expect(b2.totalResolved).toBe(1);
    expect(b2.savedCount).toBe(1);
    // Pre-v2.9 5-attempt record must NOT appear in the "4+" bucket
    const b4 = result.chargebacks.correlation.find(b => b.bucket === "4+")!;
    expect(b4.totalResolved).toBe(0);
  });

  it("AC-T3 correlation bucket completeness: all five buckets always returned", async () => {
    // Only 1-attempt records in data
    cbFixture = [
      cb({ assignedTo: "Jane Doe", submittedAt: AFTER, attemptCount: 1, resolvedAt: AFTER, resolutionType: "SAVED" }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const labels = result.chargebacks.correlation.map(b => b.bucket);
    expect(labels).toEqual(["0", "1", "2", "3", "4+"]);
    // Same for pendingTerms even with no data
    const ptLabels = result.pendingTerms.correlation.map(b => b.bucket);
    expect(ptLabels).toEqual(["0", "1", "2", "3", "4+"]);
  });

  it("AC-T4 bypass rollup: topReasons capped at 5, perRep capped at 10", async () => {
    const reasons = ["R1", "R2", "R3", "R4", "R5", "R6", "R7"];
    cbFixture = reasons.map((r, i) =>
      cb({ assignedTo: `Rep${i}`, submittedAt: AFTER, bypassReason: r })
    );
    // Also add extra perRep entries so we have >10
    for (let i = 0; i < 12; i++) {
      ptFixture.push(cb({ assignedTo: `User${i}`, submittedAt: AFTER, bypassReason: "X" }));
    }
    const result = await getOutreachAnalytics(WINDOW);
    expect(result.bypass.totalCount).toBe(reasons.length + 12);
    expect(result.bypass.topReasons.length).toBeLessThanOrEqual(5);
    expect(result.bypass.perRep.length).toBeLessThanOrEqual(10);
    // Reasons are sorted by count desc — "X" has 12 so it should lead
    expect(result.bypass.topReasons[0].reason).toBe("X");
  });

  it("AC-T5 attribution: assignee credited for SAVED even when resolver differs (model only checks resolutionType)", async () => {
    // Our aggregator only looks at assignedTo + resolutionType — resolver is never considered.
    // This test documents that invariant: a SAVED resolution always credits the assignee.
    cbFixture = [
      cb({ assignedTo: "Jane Doe", submittedAt: AFTER, resolvedAt: AFTER, resolutionType: "SAVED", attemptCount: 3 }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(jane.saved).toBe(1);
    expect(jane.saveRate).toBe(100);
  });

  it("AC-T6 unknown assignee surfaces under '(unassigned/unknown)', not dropped", async () => {
    cbFixture = [
      cb({ assignedTo: "Ghost Rep", submittedAt: AFTER, resolvedAt: AFTER, resolutionType: "SAVED", attemptCount: 1 }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const unknownRow = result.chargebacks.leaderboard.find(r => r.repName === "(unassigned/unknown)");
    expect(unknownRow).toBeDefined();
    expect(unknownRow!.assigned).toBe(1);
    expect(unknownRow!.saved).toBe(1);
  });

  it("AC-T7 normalization: trim + case-insensitive match against roster", async () => {
    cbFixture = [
      cb({ assignedTo: "  jane doe ", submittedAt: AFTER, attemptCount: 1 }),
      cb({ assignedTo: "JANE DOE", submittedAt: AFTER, attemptCount: 1 }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    // Both records should normalize to canonical "Jane Doe" row
    const rows = result.chargebacks.leaderboard.filter(r => r.repName === "Jane Doe");
    expect(rows).toHaveLength(1);
    expect(rows[0].assigned).toBe(2);
    // Must not surface as unknown
    expect(result.chargebacks.leaderboard.find(r => r.repName === "(unassigned/unknown)")).toBeUndefined();
  });

  it("AC-T8 sub-query failure returns safe defaults, never null", async () => {
    cbThrows = true;
    ptFixture = [cb({ assignedTo: "Jane Doe", submittedAt: AFTER, resolvedAt: AFTER, resolutionType: "SAVED", attemptCount: 1 })];
    const result = await getOutreachAnalytics(WINDOW);
    // Chargebacks failed → safe defaults
    expect(result.chargebacks.leaderboard).toEqual([]);
    expect(result.chargebacks.correlation).toHaveLength(5);
    expect(result.chargebacks.leaderboard).not.toBeNull();
    // Pending terms should have rendered successfully despite CB failure
    expect(result.pendingTerms.leaderboard.length).toBeGreaterThan(0);
    // Bypass still computed (using whatever records succeeded)
    expect(result.bypass).toBeDefined();
    expect(result.bypass.topReasons).toEqual(expect.any(Array));
  });

  it("workedRate = worked/assigned (percent, 1 decimal)", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", submittedAt: AFTER, attemptCount: 1 }), // worked
      cb({ assignedTo: "Jane Doe", submittedAt: AFTER, attemptCount: 0 }), // not worked
      cb({ assignedTo: "Jane Doe", submittedAt: AFTER, attemptCount: 2 }), // worked
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const row = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(row.assigned).toBe(3);
    expect(row.worked).toBe(2);
    // 2/3 = 66.666... → 66.7
    expect(row.workedRate).toBeCloseTo(66.7, 1);
  });

  it("open count = assigned - saved - cancelled - noContact, floored at 0", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", submittedAt: AFTER, resolvedAt: AFTER, resolutionType: "SAVED" }),
      cb({ assignedTo: "Jane Doe", submittedAt: AFTER, resolvedAt: AFTER, resolutionType: "CANCELLED" }),
      cb({ assignedTo: "Jane Doe", submittedAt: AFTER }), // open
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const row = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(row.assigned).toBe(3);
    expect(row.saved).toBe(1);
    expect(row.cancelled).toBe(1);
    expect(row.open).toBe(1);
  });
});
