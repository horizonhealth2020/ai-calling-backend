import { prisma } from "@ops/db";

/**
 * Aggregates CS analytics data for the CS Analytics tab.
 * Returns partial results if any sub-query fails (resilient to individual failures).
 */

type DateWindow = { gte: Date; lt: Date };

function safeDivide(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

// ── Rep Performance ─────────────────────────────────────────────────

type RepPerformanceRow = {
  repName: string;
  chargebackCount: number;
  pendingTermCount: number;
  resolvedCount: number;
  resolutionRate: number;
  avgTurnaroundHours: number;
};

async function getRepPerformance(dw: DateWindow): Promise<RepPerformanceRow[]> {
  const [chargebacks, pendingTerms] = await Promise.all([
    prisma.chargebackSubmission.findMany({
      where: { submittedAt: { gte: dw.gte, lt: dw.lt }, assignedTo: { not: null } },
      select: { assignedTo: true, resolvedAt: true, submittedAt: true },
    }),
    prisma.pendingTerm.findMany({
      where: { submittedAt: { gte: dw.gte, lt: dw.lt }, assignedTo: { not: null } },
      select: { assignedTo: true, resolvedAt: true, submittedAt: true },
    }),
  ]);

  // Aggregate per rep
  const repMap = new Map<string, {
    chargebackCount: number;
    pendingTermCount: number;
    resolvedCount: number;
    turnaroundMs: number[];
  }>();

  for (const cb of chargebacks) {
    const name = (cb.assignedTo ?? "").trim();
    if (!name) continue;
    const entry = repMap.get(name) ?? { chargebackCount: 0, pendingTermCount: 0, resolvedCount: 0, turnaroundMs: [] };
    entry.chargebackCount++;
    if (cb.resolvedAt) {
      entry.resolvedCount++;
      entry.turnaroundMs.push(cb.resolvedAt.getTime() - cb.submittedAt.getTime());
    }
    repMap.set(name, entry);
  }

  for (const pt of pendingTerms) {
    const name = (pt.assignedTo ?? "").trim();
    if (!name) continue;
    const entry = repMap.get(name) ?? { chargebackCount: 0, pendingTermCount: 0, resolvedCount: 0, turnaroundMs: [] };
    entry.pendingTermCount++;
    if (pt.resolvedAt) {
      entry.resolvedCount++;
      entry.turnaroundMs.push(pt.resolvedAt.getTime() - pt.submittedAt.getTime());
    }
    repMap.set(name, entry);
  }

  return [...repMap.entries()]
    .map(([repName, data]) => {
      const totalAssigned = data.chargebackCount + data.pendingTermCount;
      const avgMs = data.turnaroundMs.length > 0
        ? data.turnaroundMs.reduce((s, v) => s + v, 0) / data.turnaroundMs.length
        : 0;
      return {
        repName,
        chargebackCount: data.chargebackCount,
        pendingTermCount: data.pendingTermCount,
        resolvedCount: data.resolvedCount,
        resolutionRate: Math.round(safeDivide(data.resolvedCount, totalAssigned) * 1000) / 10, // 1 decimal %
        avgTurnaroundHours: Math.round((avgMs / 3600000) * 10) / 10, // ms → hours, 1 decimal
      };
    })
    .sort((a, b) => b.resolvedCount - a.resolvedCount);
}

// ── Chargeback Patterns ─────────────────────────────────────────────

type ChargebackPatterns = {
  matchStatusDistribution: Array<{ status: string; count: number }>;
  resolutionTypeDistribution: Array<{ type: string; count: number }>;
};

async function getChargebackPatterns(dw: DateWindow): Promise<ChargebackPatterns> {
  const chargebacks = await prisma.chargebackSubmission.findMany({
    where: { submittedAt: { gte: dw.gte, lt: dw.lt } },
    select: { matchStatus: true, resolutionType: true, resolvedAt: true },
  });

  // Match status distribution
  const matchMap = new Map<string, number>();
  for (const cb of chargebacks) {
    const status = cb.matchStatus ?? "UNKNOWN";
    matchMap.set(status, (matchMap.get(status) ?? 0) + 1);
  }

  // Resolution type distribution
  const resMap = new Map<string, number>();
  for (const cb of chargebacks) {
    const type = cb.resolvedAt ? (cb.resolutionType ?? "unknown") : "unresolved";
    resMap.set(type, (resMap.get(type) ?? 0) + 1);
  }

  return {
    matchStatusDistribution: [...matchMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count),
    resolutionTypeDistribution: [...resMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// ── Pending Term Categories ─────────────────────────────────────────

type PendingTermCategories = {
  holdReasonDistribution: Array<{ reason: string; count: number }>;
  resolutionTypeDistribution: Array<{ type: string; count: number }>;
};

async function getPendingTermCategories(dw: DateWindow): Promise<PendingTermCategories> {
  const terms = await prisma.pendingTerm.findMany({
    where: { submittedAt: { gte: dw.gte, lt: dw.lt } },
    select: { holdReason: true, resolutionType: true, resolvedAt: true },
  });

  // Hold reason distribution
  const reasonMap = new Map<string, number>();
  for (const t of terms) {
    const reason = (t.holdReason ?? "").trim() || "No Reason";
    reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
  }

  // Resolution type distribution
  const resMap = new Map<string, number>();
  for (const t of terms) {
    const type = t.resolvedAt ? (t.resolutionType ?? "unknown") : "unresolved";
    resMap.set(type, (resMap.get(type) ?? 0) + 1);
  }

  return {
    holdReasonDistribution: [...reasonMap.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    resolutionTypeDistribution: [...resMap.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// ── Main Export ─────────────────────────────────────────────────────

export async function getCsAnalytics(dw: DateWindow) {
  const [repPerformance, chargebackPatterns, pendingTermCategories] = await Promise.all([
    getRepPerformance(dw).catch(err => { console.error("[csAnalytics] repPerformance failed:", err); return [] as RepPerformanceRow[]; }),
    getChargebackPatterns(dw).catch(err => { console.error("[csAnalytics] chargebackPatterns failed:", err); return { matchStatusDistribution: [], resolutionTypeDistribution: [] } as ChargebackPatterns; }),
    getPendingTermCategories(dw).catch(err => { console.error("[csAnalytics] pendingTermCategories failed:", err); return { holdReasonDistribution: [], resolutionTypeDistribution: [] } as PendingTermCategories; }),
  ]);

  // Compute totals from repPerformance
  const totalChargebacks = repPerformance.reduce((s, r) => s + r.chargebackCount, 0);
  const totalPendingTerms = repPerformance.reduce((s, r) => s + r.pendingTermCount, 0);
  const totalResolved = repPerformance.reduce((s, r) => s + r.resolvedCount, 0);
  const totalAssigned = totalChargebacks + totalPendingTerms;
  const allTurnaroundHours = repPerformance.filter(r => r.avgTurnaroundHours > 0);
  const avgTurnaroundHours = allTurnaroundHours.length > 0
    ? Math.round(allTurnaroundHours.reduce((s, r) => s + r.avgTurnaroundHours, 0) / allTurnaroundHours.length * 10) / 10
    : 0;

  return {
    repPerformance,
    chargebackPatterns,
    pendingTermCategories,
    totals: {
      totalChargebacks,
      totalPendingTerms,
      totalResolved,
      overallResolutionRate: Math.round(safeDivide(totalResolved, totalAssigned) * 1000) / 10,
      avgTurnaroundHours,
    },
  };
}

// ── Rep Drill-Down ──────────────────────────────────────────────────

export async function getRepDrillDown(repName: string, dw: DateWindow, limit: number, offset: number) {
  const [chargebacks, pendingTerms] = await Promise.all([
    prisma.chargebackSubmission.findMany({
      where: {
        assignedTo: { equals: repName, mode: "insensitive" },
        submittedAt: { gte: dw.gte, lt: dw.lt },
        resolvedAt: { not: null },
      },
      select: {
        resolvedAt: true,
        resolutionType: true,
        resolutionNote: true,
        chargebackAmount: true,
        payeeName: true,
        memberCompany: true,
        memberId: true,
      },
      orderBy: { resolvedAt: "desc" },
    }),
    prisma.pendingTerm.findMany({
      where: {
        assignedTo: { equals: repName, mode: "insensitive" },
        submittedAt: { gte: dw.gte, lt: dw.lt },
        resolvedAt: { not: null },
      },
      select: {
        resolvedAt: true,
        resolutionType: true,
        resolutionNote: true,
        enrollAmount: true,
        memberName: true,
        memberId: true,
      },
      orderBy: { resolvedAt: "desc" },
    }),
  ]);

  // Merge and sort
  const merged = [
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma select return
    ...chargebacks.map((cb: any) => ({
      type: "chargeback" as const,
      memberName: cb.payeeName ?? cb.memberCompany ?? cb.memberId ?? "Unknown",
      resolvedAt: cb.resolvedAt as Date | null,
      resolutionType: cb.resolutionType as string | null,
      resolutionNote: cb.resolutionNote as string | null,
      originalAmount: Number(cb.chargebackAmount ?? 0),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma select return
    ...pendingTerms.map((pt: any) => ({
      type: "pending_term" as const,
      memberName: pt.memberName ?? pt.memberId ?? "Unknown",
      resolvedAt: pt.resolvedAt as Date | null,
      resolutionType: pt.resolutionType as string | null,
      resolutionNote: pt.resolutionNote as string | null,
      originalAmount: Number(pt.enrollAmount ?? 0),
    })),
  ].sort((a, b) => new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime());

  const total = merged.length;
  const items = merged.slice(offset, offset + limit);

  return { items, total, hasMore: offset + limit < total };
}
