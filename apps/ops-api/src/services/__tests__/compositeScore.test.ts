/**
 * compositeScore.test.ts -- Test scaffold for composite performance scoring.
 *
 * These tests are written BEFORE implementation (TDD RED phase).
 * Plan 37-02 will create the computeCompositeScores function,
 * making these tests pass (GREEN phase).
 *
 * The function is pure math (no React, no side effects) so it can be
 * tested from any jest runner. Plan 02 should export it from a location
 * importable by this test.
 */

// ── Type definition (matches ManagerTracker.tsx TrackerEntry) ────

type TrackerEntry = {
  agent: string;
  salesCount: number;
  premiumTotal: number;
  totalLeadCost: number;
  costPerSale: number;
  commissionTotal: number;
};

type ScoredEntry = TrackerEntry & { compositeScore: number };

// ── Function under test ─────────────────────────────────────────
// Plan 02 must make this function available. Until then, we define
// the expected behavior here. The function signature is:
//
//   computeCompositeScores(entries: TrackerEntry[]): ScoredEntry[]
//
// Algorithm (from D-10 through D-13):
//   1. Agents with salesCount=0 get compositeScore=-1 (rank last)
//   2. For agents with sales:
//      a. premScore = (premiumTotal - minPrem) / (maxPrem - minPrem || 1)
//      b. costScore = 1 - (costPerSale - minCost) / (maxCost - minCost || 1)
//         (lower cost = higher score; costPerSale=0 means no data = worst = costScore 0)
//      c. compositeScore = 0.4 * premScore + 0.6 * costScore
//   3. Sort by compositeScore desc, salesCount desc as tiebreaker
//   4. Return entries with compositeScore attached

// Implementation stub -- Plan 02 replaces this with the real import
// When Plan 02 exports the real function, update this import path
function computeCompositeScores(entries: TrackerEntry[]): ScoredEntry[] {
  // Separate no-sales agents
  const withSales = entries.filter((e) => e.salesCount > 0);
  const noSales = entries.filter((e) => e.salesCount === 0);

  if (withSales.length === 0) {
    return entries.map((e) => ({ ...e, compositeScore: -1 }));
  }

  // Min-max ranges for normalization
  const prems = withSales.map((e) => e.premiumTotal);
  const minPrem = Math.min(...prems);
  const maxPrem = Math.max(...prems);
  const premRange = maxPrem - minPrem || 1;

  // For cost: only consider agents that have cost data (costPerSale > 0)
  const costs = withSales.map((e) => e.costPerSale).filter((c) => c > 0);
  const minCost = costs.length > 0 ? Math.min(...costs) : 0;
  const maxCost = costs.length > 0 ? Math.max(...costs) : 0;
  const costRange = maxCost - minCost || 1;

  const scored: ScoredEntry[] = withSales.map((e) => {
    const premScore = (e.premiumTotal - minPrem) / premRange;
    // costPerSale=0 means no cost data -- treat as worst efficiency (costScore=0)
    const costScore =
      e.costPerSale > 0 ? 1 - (e.costPerSale - minCost) / costRange : 0;
    const compositeScore = 0.4 * premScore + 0.6 * costScore;
    return { ...e, compositeScore };
  });

  const noSalesScored: ScoredEntry[] = noSales.map((e) => ({
    ...e,
    compositeScore: -1,
  }));

  // Sort: compositeScore desc, salesCount desc as tiebreaker
  return [...scored, ...noSalesScored].sort(
    (a, b) => b.compositeScore - a.compositeScore || b.salesCount - a.salesCount
  );
}

// ── Test fixtures ───────────────────────────────────────────────

const fixtures = {
  highPerformer: {
    agent: "Alice",
    salesCount: 10,
    premiumTotal: 50000,
    totalLeadCost: 500,
    costPerSale: 50,
    commissionTotal: 5000,
  },
  midPerformer: {
    agent: "Bob",
    salesCount: 8,
    premiumTotal: 30000,
    totalLeadCost: 800,
    costPerSale: 100,
    commissionTotal: 3000,
  },
  lowPerformer: {
    agent: "Carol",
    salesCount: 3,
    premiumTotal: 10000,
    totalLeadCost: 600,
    costPerSale: 200,
    commissionTotal: 1000,
  },
  noSales: {
    agent: "Dave",
    salesCount: 0,
    premiumTotal: 0,
    totalLeadCost: 0,
    costPerSale: 0,
    commissionTotal: 0,
  },
  noCostData: {
    agent: "Eve",
    salesCount: 5,
    premiumTotal: 20000,
    totalLeadCost: 0,
    costPerSale: 0,
    commissionTotal: 2000,
  },
};

// ══════════════════════════════════════════════════════════════════
// Basic scoring (D-10, D-11)
// ══════════════════════════════════════════════════════════════════

describe("computeCompositeScores - basic scoring", () => {
  it("agent with highest premium + lowest cost ranks first", () => {
    const result = computeCompositeScores([
      fixtures.lowPerformer,
      fixtures.highPerformer,
      fixtures.midPerformer,
    ]);

    expect(result[0].agent).toBe("Alice");
    expect(result[result.length - 1].agent).toBe("Carol");
  });

  it("applies 40% premium + 60% cost efficiency weighting", () => {
    const result = computeCompositeScores([
      fixtures.highPerformer,
      fixtures.midPerformer,
      fixtures.lowPerformer,
    ]);

    // Alice: premScore=1.0 (highest), costScore=1.0 (lowest cost)
    // composite = 0.4*1.0 + 0.6*1.0 = 1.0
    expect(result[0].compositeScore).toBeCloseTo(1.0, 5);

    // Carol: premScore=0.0 (lowest), costScore=0.0 (highest cost)
    // composite = 0.4*0.0 + 0.6*0.0 = 0.0
    const carol = result.find((r) => r.agent === "Carol")!;
    expect(carol.compositeScore).toBeCloseTo(0.0, 5);
  });

  it("sale count is tiebreaker only (equal composite scores break by salesCount desc)", () => {
    const agentA = { agent: "AgentA", salesCount: 10, premiumTotal: 30000, totalLeadCost: 500, costPerSale: 100, commissionTotal: 3000 };
    const agentB = { agent: "AgentB", salesCount: 5, premiumTotal: 30000, totalLeadCost: 500, costPerSale: 100, commissionTotal: 3000 };

    const result = computeCompositeScores([agentB, agentA]);

    // Both have identical premium and cost, so same composite score
    // Tiebreaker: agentA has more sales (10 > 5)
    expect(result[0].agent).toBe("AgentA");
    expect(result[1].agent).toBe("AgentB");
  });
});

// ══════════════════════════════════════════════════════════════════
// Cost inversion (D-12)
// ══════════════════════════════════════════════════════════════════

describe("computeCompositeScores - cost inversion", () => {
  it("lower costPerSale produces higher score", () => {
    const result = computeCompositeScores([
      fixtures.highPerformer, // costPerSale: 50
      fixtures.lowPerformer,  // costPerSale: 200
    ]);

    const alice = result.find((r) => r.agent === "Alice")!;
    const carol = result.find((r) => r.agent === "Carol")!;

    expect(alice.compositeScore).toBeGreaterThan(carol.compositeScore);
  });

  it("Agent A (costPerSale=50) ranks above Agent B (costPerSale=100) when premiums are equal", () => {
    const agentA = { agent: "AgentA", salesCount: 5, premiumTotal: 30000, totalLeadCost: 250, costPerSale: 50, commissionTotal: 3000 };
    const agentB = { agent: "AgentB", salesCount: 5, premiumTotal: 30000, totalLeadCost: 500, costPerSale: 100, commissionTotal: 3000 };

    const result = computeCompositeScores([agentB, agentA]);

    expect(result[0].agent).toBe("AgentA");
  });
});

// ══════════════════════════════════════════════════════════════════
// Edge cases (D-13)
// ══════════════════════════════════════════════════════════════════

describe("computeCompositeScores - edge cases", () => {
  it("agents with salesCount=0 get compositeScore=-1 (rank last)", () => {
    const result = computeCompositeScores([
      fixtures.noSales,
      fixtures.highPerformer,
    ]);

    const dave = result.find((r) => r.agent === "Dave")!;
    expect(dave.compositeScore).toBe(-1);
    expect(result[result.length - 1].agent).toBe("Dave");
  });

  it("agents with costPerSale=0 (no cost data) but has sales get costScore=0 (worst efficiency)", () => {
    const result = computeCompositeScores([
      fixtures.noCostData,    // costPerSale: 0, premiumTotal: 20000
      fixtures.highPerformer, // costPerSale: 50, premiumTotal: 50000
    ]);

    const eve = result.find((r) => r.agent === "Eve")!;
    const alice = result.find((r) => r.agent === "Alice")!;

    // Eve has no cost data, so costScore=0 (worst)
    // Alice has lowest (only) cost, so costScore=1.0
    expect(alice.compositeScore).toBeGreaterThan(eve.compositeScore);
    // Eve: premScore = (20000-20000)/(50000-20000) = 0, costScore = 0
    // composite = 0.4*0 + 0.6*0 = 0
    expect(eve.compositeScore).toBeCloseTo(0.0, 5);
  });

  it("single agent with sales gets a valid compositeScore", () => {
    const result = computeCompositeScores([fixtures.highPerformer]);

    expect(result).toHaveLength(1);
    expect(result[0].compositeScore).toBeGreaterThanOrEqual(0);
    // Single agent: premRange = 0, guarded by ||1, so premScore = 0
    // Single agent with cost: costRange = 0, guarded by ||1, costScore = 1 - 0 = 1
    // But actually with single cost data point: minCost=maxCost=50, range=0||1
    // costScore = 1 - (50-50)/1 = 1.0
    // premScore = (50000-50000)/1 = 0
    // composite = 0.4*0 + 0.6*1.0 = 0.6
    expect(result[0].compositeScore).toBeCloseTo(0.6, 5);
  });
});

// ══════════════════════════════════════════════════════════════════
// Division-by-zero guard
// ══════════════════════════════════════════════════════════════════

describe("computeCompositeScores - division-by-zero guard", () => {
  it("all agents with same premium: premRange guarded by ||1, all get premScore=0", () => {
    const a1 = { agent: "A1", salesCount: 5, premiumTotal: 30000, totalLeadCost: 250, costPerSale: 50, commissionTotal: 3000 };
    const a2 = { agent: "A2", salesCount: 4, premiumTotal: 30000, totalLeadCost: 400, costPerSale: 100, commissionTotal: 3000 };

    const result = computeCompositeScores([a1, a2]);

    // Both premiumTotal = 30000, so premRange = 0, guarded by ||1
    // premScore for both = (30000-30000)/1 = 0
    // Score difference comes entirely from cost efficiency (60% weight)
    const s1 = result.find((r) => r.agent === "A1")!;
    const s2 = result.find((r) => r.agent === "A2")!;

    // Both should have premScore component = 0
    // A1: costScore = 1 - (50-50)/50 = 1.0; composite = 0.6*1.0 = 0.6
    // A2: costScore = 1 - (100-50)/50 = 0.0; composite = 0.6*0.0 = 0.0
    expect(s1.compositeScore).toBeGreaterThan(s2.compositeScore);
    expect(s1.compositeScore).toBeCloseTo(0.6, 5);
    expect(s2.compositeScore).toBeCloseTo(0.0, 5);
  });

  it("all agents with same costPerSale: costRange guarded by ||1", () => {
    const a1 = { agent: "A1", salesCount: 5, premiumTotal: 50000, totalLeadCost: 500, costPerSale: 100, commissionTotal: 5000 };
    const a2 = { agent: "A2", salesCount: 4, premiumTotal: 20000, totalLeadCost: 400, costPerSale: 100, commissionTotal: 2000 };

    const result = computeCompositeScores([a1, a2]);

    // Both costPerSale = 100, so costRange = 0, guarded by ||1
    // costScore for both = 1 - (100-100)/1 = 1.0
    // Score difference comes entirely from premium (40% weight)
    const s1 = result.find((r) => r.agent === "A1")!;
    const s2 = result.find((r) => r.agent === "A2")!;

    // A1 has higher premium, so should rank higher
    expect(s1.compositeScore).toBeGreaterThan(s2.compositeScore);
  });
});
