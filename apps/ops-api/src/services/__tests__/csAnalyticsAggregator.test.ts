import { getOutreachAnalytics } from "../csAnalyticsAggregator";

// ── In-memory fixture state ──────────────────────────────────────────
type RawCb = {
  assignedTo: string | null;
  submittedAt: Date;
  resolvedAt: Date | null;
  resolutionType: string | null;
  bypassReason: string | null;
  attemptCount: number;
  /** Phase 69: User.name of resolver (null if unresolved). */
  resolverName: string | null;
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
        resolver: r.resolverName ? { name: r.resolverName } : null,
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
    resolverName: null,
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

  // ── Phase 69: Resolver credit (assistSaves) + resolver-keyed bypass ───

  it("AC-1 assist credit: different rep resolves as SAVED", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    const alice = result.chargebacks.leaderboard.find(r => r.repName === "Alice Ng")!;
    expect(jane.saved).toBe(1);
    expect(jane.assistSaves).toBe(0);
    expect(alice.saved).toBe(0);
    expect(alice.assistSaves).toBe(1);
  });

  it("AC-2 self-resolution produces no assist", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: "Jane Doe", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(jane.saved).toBe(1);
    expect(jane.assistSaves).toBe(0);
    expect(result.chargebacks.leaderboard.filter(r => r.repName !== "Jane Doe")).toHaveLength(0);
  });

  it("AC-3a CANCELLED cross-rep does not produce assist", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolutionType: "CANCELLED", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(jane.cancelled).toBe(1);
    expect(jane.assistSaves).toBe(0);
    expect(result.chargebacks.leaderboard.find(r => r.repName === "Alice Ng")).toBeUndefined();
  });

  it("AC-3b NO_CONTACT cross-rep does not produce assist", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolutionType: "NO_CONTACT", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(jane.noContact).toBe(1);
    expect(jane.assistSaves).toBe(0);
    expect(result.chargebacks.leaderboard.find(r => r.repName === "Alice Ng")).toBeUndefined();
  });

  it("AC-4 owner/admin resolver (not in roster) gets no assist", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: "Owner Boss", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(jane.saved).toBe(1);
    expect(jane.assistSaves).toBe(0);
    // Owner Boss must NOT appear in leaderboard (not a CS rep)
    expect(result.chargebacks.leaderboard.find(r => r.repName === "Owner Boss")).toBeUndefined();
    expect(result.chargebacks.leaderboard.find(r => r.repName === "(owner/admin override)")).toBeUndefined();
  });

  it("AC-5 bypass perRep attributed to resolver, not assignee", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", bypassReason: "Customer urgent", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    expect(result.bypass.totalCount).toBe(1);
    expect(result.bypass.topReasons[0]).toEqual({ reason: "Customer urgent", count: 1 });
    const aliceEntry = result.bypass.perRep.find(p => p.repName === "Alice Ng");
    expect(aliceEntry).toBeDefined();
    expect(aliceEntry!.count).toBe(1);
    // Jane (assignee) must NOT be credited for the override
    expect(result.bypass.perRep.find(p => p.repName === "Jane Doe")).toBeUndefined();
  });

  it("AC-5 bypass from owner/admin surfaces as (owner/admin override)", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: "Owner Boss", bypassReason: "Exec escalation", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const adminEntry = result.bypass.perRep.find(p => p.repName === "(owner/admin override)");
    expect(adminEntry).toBeDefined();
    expect(adminEntry!.count).toBe(1);
  });

  it("AC-11 bypass with null resolver surfaces as (unresolved) — data-integrity signal", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: null, bypassReason: "Pending escalation", submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const unresolvedEntry = result.bypass.perRep.find(p => p.repName === "(unresolved)");
    expect(unresolvedEntry).toBeDefined();
    expect(unresolvedEntry!.count).toBe(1);
    expect(result.bypass.totalCount).toBe(1);
  });

  it("assist saves counted separately per type (CB + PT not summed)", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    ptFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const aliceCb = result.chargebacks.leaderboard.find(r => r.repName === "Alice Ng")!;
    const alicePt = result.pendingTerms.leaderboard.find(r => r.repName === "Alice Ng")!;
    // Each leaderboard is type-scoped — assists do NOT sum across
    expect(aliceCb.assistSaves).toBe(1);
    expect(alicePt.assistSaves).toBe(1);
  });

  it("conservation law: sum(saved) + sum(assistSaves) matches total roster SAVEDs (minus admin resolves)", async () => {
    cbFixture = [
      // Self-resolved SAVED (Jane) — saved=1, assist=0 expected
      cb({ assignedTo: "Jane Doe", resolverName: "Jane Doe", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
      // Cross-rep SAVED (Jane assigned, Alice resolves) — Jane saved=1, Alice assist=1
      cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
      // Cross-rep CANCELLED (Jane assigned, Alice resolves) — Jane cancelled=1, Alice assist=0
      cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolutionType: "CANCELLED", resolvedAt: AFTER, submittedAt: AFTER }),
      // Admin SAVE (not counted as assist) — Jane saved=1, no assist anywhere
      cb({ assignedTo: "Jane Doe", resolverName: "Owner Boss", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
      // Self-resolved SAVED (Alice) — Alice saved=1
      cb({ assignedTo: "Alice Ng", resolverName: "Alice Ng", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const sumSaved = result.chargebacks.leaderboard.reduce((s, r) => s + r.saved, 0);
    const sumAssist = result.chargebacks.leaderboard.reduce((s, r) => s + r.assistSaves, 0);
    // Total SAVED records in fixture: 4. Admin-resolved SAVED: 1. So:
    // sum(saved) = 4 (every SAVED credits the assignee regardless of resolver)
    // sum(assist) = 1 (only the Jane-assigned/Alice-resolved SAVED produces assist)
    expect(sumSaved).toBe(4);
    expect(sumAssist).toBe(1);
  });

  it("AC-8 pre-v2.9 cross-rep SAVED DOES count as assist (outcome semantics)", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: BEFORE, attemptCount: 2 }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    const alice = result.chargebacks.leaderboard.find(r => r.repName === "Alice Ng")!;
    // Outcome side of cutoff — included
    expect(jane.saved).toBe(1);
    expect(alice.assistSaves).toBe(1);
    // Effort side of cutoff — excluded (Phase 68 rule preserved)
    expect(jane.worked).toBe(0);
    expect(jane.avgAttempts).toBe(0);
    // Correlation still excludes pre-v2.9
    const b2 = result.chargebacks.correlation.find(b => b.bucket === "2")!;
    expect(b2.totalResolved).toBe(0);
  });

  it("AC-9 assist-only rep row renders cleanly (no NaN)", async () => {
    cbFixture = [
      cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const alice = result.chargebacks.leaderboard.find(r => r.repName === "Alice Ng")!;
    // Assist-only: zero assigned, zero everything except assistSaves
    expect(alice.assigned).toBe(0);
    expect(alice.worked).toBe(0);
    expect(alice.saved).toBe(0);
    expect(alice.cancelled).toBe(0);
    expect(alice.noContact).toBe(0);
    expect(alice.open).toBe(0);
    expect(alice.assistSaves).toBe(1);
    // Critical: no NaN — all rates/averages must be 0
    expect(alice.saveRate).toBe(0);
    expect(alice.workedRate).toBe(0);
    expect(alice.avgAttempts).toBe(0);
    expect(alice.avgTimeToResolveHours).toBe(0);
    expect(Number.isNaN(alice.saveRate)).toBe(false);
    expect(Number.isNaN(alice.workedRate)).toBe(false);
    // Serializable — no NaN would fail JSON.stringify's numeric encoding
    expect(() => JSON.stringify(alice)).not.toThrow();
    const parsed = JSON.parse(JSON.stringify(alice));
    expect(typeof parsed.saveRate).toBe("number");
  });

  // ── Phase 70 hotfix regression — production vocabulary normalization ──

  it("HOTFIX: chargeback resolutionType 'recovered' (production vocab) counts as saved", async () => {
    cbFixture = [
      { ...cb({ assignedTo: "Jane Doe", resolverName: "Jane Doe", resolvedAt: AFTER, submittedAt: AFTER }), resolutionType: "recovered" },
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(jane.saved).toBe(1);
    expect(jane.cancelled).toBe(0);
  });

  it("HOTFIX: chargeback resolutionType 'closed' (production vocab) counts as cancelled", async () => {
    cbFixture = [
      { ...cb({ assignedTo: "Jane Doe", resolverName: "Jane Doe", resolvedAt: AFTER, submittedAt: AFTER }), resolutionType: "closed" },
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(jane.cancelled).toBe(1);
    expect(jane.saved).toBe(0);
  });

  it("HOTFIX: pending term resolutionType 'saved' (lowercase, production vocab) counts as saved", async () => {
    ptFixture = [
      { ...cb({ assignedTo: "Jane Doe", resolverName: "Jane Doe", resolvedAt: AFTER, submittedAt: AFTER }), resolutionType: "saved" },
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.pendingTerms.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(jane.saved).toBe(1);
  });

  it("HOTFIX: pending term cross-rep 'saved' (lowercase) credits resolver via assistSaves", async () => {
    // The exact production scenario the user reported: Jasmine saves Alex's pending term
    ptFixture = [
      { ...cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolvedAt: AFTER, submittedAt: AFTER }), resolutionType: "saved" },
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.pendingTerms.leaderboard.find(r => r.repName === "Jane Doe")!;
    const alice = result.pendingTerms.leaderboard.find(r => r.repName === "Alice Ng")!;
    expect(jane.saved).toBe(1);
    expect(jane.assistSaves).toBe(0);
    expect(alice.saved).toBe(0);
    expect(alice.assistSaves).toBe(1);
  });

  it("HOTFIX: chargeback cross-rep 'recovered' credits resolver via assistSaves", async () => {
    cbFixture = [
      { ...cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolvedAt: AFTER, submittedAt: AFTER }), resolutionType: "recovered" },
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    const alice = result.chargebacks.leaderboard.find(r => r.repName === "Alice Ng")!;
    expect(jane.saved).toBe(1);
    expect(alice.assistSaves).toBe(1);
  });

  it("HOTFIX: unknown resolutionType normalizes to null (no false credit)", async () => {
    cbFixture = [
      { ...cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolvedAt: AFTER, submittedAt: AFTER }), resolutionType: "weird_value" },
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    const alice = result.chargebacks.leaderboard.find(r => r.repName === "Alice Ng");
    expect(jane.saved).toBe(0);
    expect(jane.cancelled).toBe(0);
    expect(jane.noContact).toBe(0);
    // Alice gets no row since she has no assigned + no assist
    expect(alice).toBeUndefined();
  });

  it("AC-10 cross-rep CANCELLED does not mutate existing resolver row", async () => {
    cbFixture = [
      // Alice's own assigned work — 3 records, 2 SAVED, 1 open
      cb({ assignedTo: "Alice Ng", resolverName: "Alice Ng", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
      cb({ assignedTo: "Alice Ng", resolverName: "Alice Ng", resolutionType: "SAVED", resolvedAt: AFTER, submittedAt: AFTER }),
      cb({ assignedTo: "Alice Ng", submittedAt: AFTER }), // open
      // Cross-rep: Alice CANCELS one of Jane's records — must NOT mutate Alice's row
      cb({ assignedTo: "Jane Doe", resolverName: "Alice Ng", resolutionType: "CANCELLED", resolvedAt: AFTER, submittedAt: AFTER }),
    ];
    const result = await getOutreachAnalytics(WINDOW);
    const alice = result.chargebacks.leaderboard.find(r => r.repName === "Alice Ng")!;
    expect(alice.assigned).toBe(3);
    expect(alice.saved).toBe(2);
    expect(alice.open).toBe(1);
    expect(alice.assistSaves).toBe(0);
    // Critical: Alice.cancelled must be 0 — the cross-rep CANCELLED was on Jane's record
    expect(alice.cancelled).toBe(0);
    const jane = result.chargebacks.leaderboard.find(r => r.repName === "Jane Doe")!;
    expect(jane.cancelled).toBe(1);
    expect(jane.assistSaves).toBe(0);
  });
});
