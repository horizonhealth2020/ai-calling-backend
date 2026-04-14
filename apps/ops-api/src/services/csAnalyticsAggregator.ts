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

// ── Outreach Accountability Analytics (Phase 68) ────────────────────
//
// v2.9 cutoff — records submitted before this date did not have outreach
// instrumentation in place. They are excluded from attempt-based metrics
// (worked, workedRate, avgAttempts, correlation buckets) but included in
// outcome-based metrics (saved, cancelled, saveRate) because resolution
// outcomes may have been backfilled.
const V29_CUTOFF = new Date("2026-04-13T00:00:00.000Z");

export type OutreachRow = {
  repName: string;
  assigned: number;
  worked: number;
  saved: number;
  cancelled: number;
  noContact: number;
  open: number;
  saveRate: number;         // percent, 1 decimal
  workedRate: number;       // percent, 1 decimal
  avgAttempts: number;      // 1 decimal
  avgTimeToResolveHours: number; // 1 decimal
};

export type CorrelationBucket = {
  bucket: "0" | "1" | "2" | "3" | "4+";
  totalResolved: number;
  savedCount: number;
  saveRate: number; // percent, 1 decimal
};

export type BypassRollup = {
  totalCount: number;
  topReasons: Array<{ reason: string; count: number }>;
  perRep: Array<{ repName: string; count: number }>;
};

export type OutreachAnalytics = {
  cutoff: string;
  chargebacks: { leaderboard: OutreachRow[]; correlation: CorrelationBucket[] };
  pendingTerms: { leaderboard: OutreachRow[]; correlation: CorrelationBucket[] };
  bypass: BypassRollup;
};

const UNKNOWN_REP = "(unassigned/unknown)";

const EMPTY_CORRELATION: CorrelationBucket[] = [
  { bucket: "0", totalResolved: 0, savedCount: 0, saveRate: 0 },
  { bucket: "1", totalResolved: 0, savedCount: 0, saveRate: 0 },
  { bucket: "2", totalResolved: 0, savedCount: 0, saveRate: 0 },
  { bucket: "3", totalResolved: 0, savedCount: 0, saveRate: 0 },
  { bucket: "4+", totalResolved: 0, savedCount: 0, saveRate: 0 },
];

function bucketFor(attemptCount: number): CorrelationBucket["bucket"] {
  if (attemptCount <= 0) return "0";
  if (attemptCount === 1) return "1";
  if (attemptCount === 2) return "2";
  if (attemptCount === 3) return "3";
  return "4+";
}

function pct(num: number, den: number): number {
  return Math.round(safeDivide(num, den) * 1000) / 10;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type RawRecord = {
  assignedTo: string | null;
  submittedAt: Date;
  resolvedAt: Date | null;
  resolutionType: string | null;
  bypassReason: string | null;
  attemptCount: number;
};

type RosterEntry = { nameLower: string; canonical: string };

/** Build a lowercase->canonical lookup from the active roster. */
async function loadRosterIndex(): Promise<Map<string, string>> {
  const reps = await prisma.csRepRoster.findMany({
    where: { active: true },
    select: { name: true },
  });
  const index = new Map<string, string>();
  for (const r of reps) {
    const norm = r.name.trim().toLowerCase();
    if (norm) index.set(norm, r.name);
  }
  return index;
}

/** Normalize an `assignedTo` value against the roster. Returns canonical name or UNKNOWN_REP. */
function canonicalizeRep(raw: string | null | undefined, roster: Map<string, string>): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return UNKNOWN_REP;
  const match = roster.get(trimmed.toLowerCase());
  return match ?? UNKNOWN_REP;
}

/** Build a per-rep leaderboard from a flat list of records. */
function buildLeaderboard(records: RawRecord[], roster: Map<string, string>): OutreachRow[] {
  type Acc = {
    assigned: number;
    worked: number;
    saved: number;
    cancelled: number;
    noContact: number;
    resolved: number;
    attemptSum: number;       // only for v2.9+ records (attempt-based)
    attemptSamples: number;   // v2.9+ resolved sample count for avgAttempts
    resolveMsSum: number;     // for resolved records (any era)
    resolveMsSamples: number;
  };
  const map = new Map<string, Acc>();

  for (const rec of records) {
    const repName = canonicalizeRep(rec.assignedTo, roster);
    const acc = map.get(repName) ?? {
      assigned: 0, worked: 0, saved: 0, cancelled: 0, noContact: 0,
      resolved: 0, attemptSum: 0, attemptSamples: 0,
      resolveMsSum: 0, resolveMsSamples: 0,
    };
    acc.assigned++;

    const isV29 = rec.submittedAt.getTime() >= V29_CUTOFF.getTime();

    // worked: v2.9+ with at least one attempt
    if (isV29 && rec.attemptCount > 0) acc.worked++;

    // outcome counters (any era — outcome data is backfillable)
    if (rec.resolutionType === "SAVED") acc.saved++;
    else if (rec.resolutionType === "CANCELLED") acc.cancelled++;
    else if (rec.resolutionType === "NO_CONTACT") acc.noContact++;

    // resolved samples
    if (rec.resolvedAt) {
      acc.resolved++;
      acc.resolveMsSum += rec.resolvedAt.getTime() - rec.submittedAt.getTime();
      acc.resolveMsSamples++;

      // avgAttempts sample — v2.9+ resolved records only
      if (isV29) {
        acc.attemptSum += rec.attemptCount;
        acc.attemptSamples++;
      }
    }

    map.set(repName, acc);
  }

  const rows: OutreachRow[] = [...map.entries()].map(([repName, a]) => {
    const open = a.assigned - a.saved - a.cancelled - a.noContact;
    return {
      repName,
      assigned: a.assigned,
      worked: a.worked,
      saved: a.saved,
      cancelled: a.cancelled,
      noContact: a.noContact,
      open: Math.max(0, open),
      saveRate: pct(a.saved, a.saved + a.cancelled),
      workedRate: pct(a.worked, a.assigned),
      avgAttempts: a.attemptSamples > 0 ? round1(a.attemptSum / a.attemptSamples) : 0,
      avgTimeToResolveHours: a.resolveMsSamples > 0
        ? round1(a.resolveMsSum / a.resolveMsSamples / 3_600_000)
        : 0,
    };
  });

  // Default sort: save rate desc, assigned desc as tiebreaker
  rows.sort((a, b) => b.saveRate - a.saveRate || b.assigned - a.assigned);
  return rows;
}

/** Build correlation buckets from a flat list of records. v2.9+ resolved records only. */
function buildCorrelation(records: RawRecord[]): CorrelationBucket[] {
  const buckets = EMPTY_CORRELATION.map(b => ({ ...b }));
  const byKey = new Map<string, CorrelationBucket>();
  for (const b of buckets) byKey.set(b.bucket, b);

  for (const rec of records) {
    if (!rec.resolvedAt) continue;
    if (rec.submittedAt.getTime() < V29_CUTOFF.getTime()) continue;
    const key = bucketFor(rec.attemptCount);
    const b = byKey.get(key)!;
    b.totalResolved++;
    if (rec.resolutionType === "SAVED") b.savedCount++;
  }

  for (const b of buckets) b.saveRate = pct(b.savedCount, b.totalResolved);
  return buckets;
}

async function getChargebackRecords(dw: DateWindow): Promise<RawRecord[]> {
  const rows = await prisma.chargebackSubmission.findMany({
    where: { submittedAt: { gte: dw.gte, lt: dw.lt }, assignedTo: { not: null } },
    select: {
      assignedTo: true,
      submittedAt: true,
      resolvedAt: true,
      resolutionType: true,
      bypassReason: true,
      _count: { select: { contactAttempts: true } },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma select return
  return rows.map((r: any) => ({
    assignedTo: r.assignedTo,
    submittedAt: r.submittedAt,
    resolvedAt: r.resolvedAt,
    resolutionType: r.resolutionType,
    bypassReason: r.bypassReason,
    attemptCount: r._count.contactAttempts,
  }));
}

async function getPendingTermRecords(dw: DateWindow): Promise<RawRecord[]> {
  const rows = await prisma.pendingTerm.findMany({
    where: { submittedAt: { gte: dw.gte, lt: dw.lt }, assignedTo: { not: null } },
    select: {
      assignedTo: true,
      submittedAt: true,
      resolvedAt: true,
      resolutionType: true,
      bypassReason: true,
      _count: { select: { contactAttempts: true } },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma select return
  return rows.map((r: any) => ({
    assignedTo: r.assignedTo,
    submittedAt: r.submittedAt,
    resolvedAt: r.resolvedAt,
    resolutionType: r.resolutionType,
    bypassReason: r.bypassReason,
    attemptCount: r._count.contactAttempts,
  }));
}

function buildBypass(cbRecords: RawRecord[], ptRecords: RawRecord[], roster: Map<string, string>): BypassRollup {
  const reasonMap = new Map<string, number>();
  const repMap = new Map<string, number>();
  let total = 0;

  const consume = (r: RawRecord) => {
    const reason = (r.bypassReason ?? "").trim();
    if (!reason) return;
    total++;
    reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
    const repName = canonicalizeRep(r.assignedTo, roster);
    repMap.set(repName, (repMap.get(repName) ?? 0) + 1);
  };

  for (const r of cbRecords) consume(r);
  for (const r of ptRecords) consume(r);

  const topReasons = [...reasonMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const perRep = [...repMap.entries()]
    .map(([repName, count]) => ({ repName, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { totalCount: total, topReasons, perRep };
}

export async function getOutreachAnalytics(dw: DateWindow): Promise<OutreachAnalytics> {
  // Safe defaults for each section. Any sub-query failure returns defaults,
  // never null — the UI must never null-guard top-level keys.
  const emptyGroup = () => ({ leaderboard: [] as OutreachRow[], correlation: EMPTY_CORRELATION.map(b => ({ ...b })) });
  const emptyBypass = (): BypassRollup => ({ totalCount: 0, topReasons: [], perRep: [] });

  const [roster, cbRecords, ptRecords] = await Promise.all([
    loadRosterIndex().catch(err => {
      console.error("[cs_outreach_analytics.subquery_failed] roster:", err);
      return new Map<string, string>();
    }),
    getChargebackRecords(dw).catch(err => {
      console.error("[cs_outreach_analytics.subquery_failed] chargebacks:", err);
      return [] as RawRecord[];
    }),
    getPendingTermRecords(dw).catch(err => {
      console.error("[cs_outreach_analytics.subquery_failed] pendingTerms:", err);
      return [] as RawRecord[];
    }),
  ]);

  let chargebacks = emptyGroup();
  let pendingTerms = emptyGroup();
  let bypass = emptyBypass();

  try {
    chargebacks = {
      leaderboard: buildLeaderboard(cbRecords, roster),
      correlation: buildCorrelation(cbRecords),
    };
  } catch (err) {
    console.error("[cs_outreach_analytics.subquery_failed] chargeback aggregation:", err);
  }

  try {
    pendingTerms = {
      leaderboard: buildLeaderboard(ptRecords, roster),
      correlation: buildCorrelation(ptRecords),
    };
  } catch (err) {
    console.error("[cs_outreach_analytics.subquery_failed] pendingTerm aggregation:", err);
  }

  try {
    bypass = buildBypass(cbRecords, ptRecords, roster);
  } catch (err) {
    console.error("[cs_outreach_analytics.subquery_failed] bypass:", err);
  }

  return {
    cutoff: V29_CUTOFF.toISOString(),
    chargebacks,
    pendingTerms,
    bypass,
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
