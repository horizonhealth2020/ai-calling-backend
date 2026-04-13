import { prisma } from "@ops/db";

/**
 * Aggregates time-series trend data for the Owner Trends tab.
 * Returns partial results if any sub-query fails (resilient to individual failures).
 */

type DateWindow = { gte: Date; lt: Date };
type CallTiers = { short: number; contacted: number; engaged: number; deep: number };

function toSunday(d: Date): string {
  const dt = new Date(d);
  const day = dt.getUTCDay(); // 0=Sun
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10);
}

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function safeDivide(num: number, den: number): number {
  return den === 0 ? 0 : num / den;
}

function parseCallsByTier(raw: unknown): CallTiers | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.short !== "number" || typeof obj.contacted !== "number" ||
      typeof obj.engaged !== "number" || typeof obj.deep !== "number") return null;
  return { short: obj.short, contacted: obj.contacted, engaged: obj.engaged, deep: obj.deep };
}

// ── Revenue Trend ───────────────────────────────────────────────────

async function getRevenueTrend(dw: DateWindow) {
  // Sales grouped by week (saleDate → Monday)
  const sales = await prisma.sale.findMany({
    where: { status: "RAN", saleDate: { gte: dw.gte, lt: dw.lt } },
    select: { id: true, saleDate: true, premium: true, addons: { select: { premium: true } } },
  });

  // Commission from payroll entries for these sales
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma select return
  const saleIds = sales.map((s: any) => s.id as string);
  const payrollEntries = saleIds.length > 0
    ? await prisma.payrollEntry.findMany({
        where: { saleId: { in: saleIds } },
        select: { saleId: true, payoutAmount: true },
      })
    : [];
  const commBySale = new Map<string, number>();
  for (const pe of payrollEntries) {
    commBySale.set(pe.saleId, (commBySale.get(pe.saleId) ?? 0) + Number(pe.payoutAmount));
  }

  // Chargebacks in date range
  const chargebacks = await prisma.chargebackSubmission.findMany({
    where: { submittedAt: { gte: dw.gte, lt: dw.lt } },
    select: { submittedAt: true, chargebackAmount: true },
  });

  // Group sales by week
  const weekMap = new Map<string, { premiumTotal: number; commissionTotal: number; chargebackTotal: number }>();

  for (const sale of sales) {
    const week = toSunday(sale.saleDate);
    const entry = weekMap.get(week) ?? { premiumTotal: 0, commissionTotal: 0, chargebackTotal: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma addon select
    const addonPremium = sale.addons?.reduce((s: number, a: any) => s + Number(a.premium), 0) ?? 0;
    entry.premiumTotal += Number(sale.premium) + addonPremium;
    entry.commissionTotal += commBySale.get(sale.id) ?? 0;
    weekMap.set(week, entry);
  }

  for (const cb of chargebacks) {
    const week = toSunday(cb.submittedAt);
    const entry = weekMap.get(week) ?? { premiumTotal: 0, commissionTotal: 0, chargebackTotal: 0 };
    entry.chargebackTotal += Number(cb.chargebackAmount ?? 0);
    weekMap.set(week, entry);
  }

  return [...weekMap.entries()]
    .map(([date, vals]) => ({
      date,
      premiumTotal: Math.round(vals.premiumTotal * 100) / 100,
      commissionTotal: Math.round(vals.commissionTotal * 100) / 100,
      chargebackTotal: Math.round(vals.chargebackTotal * 100) / 100,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Agent KPI Trend ─────────────────────────────────────────────────

async function getAgentKpiTrend(dw: DateWindow) {
  const [snapshots, agents, sales] = await Promise.all([
    prisma.agentCallKpi.findMany({
      where: { snapshotDate: { gte: dw.gte, lt: dw.lt } },
      select: { agentId: true, snapshotDate: true, totalCalls: true, avgCallLength: true },
    }),
    prisma.agent.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.sale.findMany({
      where: { status: "RAN", saleDate: { gte: dw.gte, lt: dw.lt } },
      select: { agentId: true },
    }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma select return
  const agentNameMap = new Map<string, string>(agents.map((a: any) => [a.id, a.name]));

  // Count RAN sales per agent in period
  const salesByAgent = new Map<string, number>();
  for (const s of sales) {
    salesByAgent.set(s.agentId, (salesByAgent.get(s.agentId) ?? 0) + 1);
  }

  // Group snapshots by date + agentId
  const grouped = new Map<string, Map<string, { totalCalls: number; avgCallLengthSum: number; snapshotCount: number }>>();

  for (const snap of snapshots) {
    const day = toDay(snap.snapshotDate);
    if (!grouped.has(day)) grouped.set(day, new Map());
    const dayMap = grouped.get(day)!;
    const key = snap.agentId;
    const entry = dayMap.get(key) ?? { totalCalls: 0, avgCallLengthSum: 0, snapshotCount: 0 };
    entry.totalCalls += snap.totalCalls;
    entry.avgCallLengthSum += Number(snap.avgCallLength);
    entry.snapshotCount++;
    dayMap.set(key, entry);
  }

  const result: Array<{ date: string; agentId: string; agentName: string; totalCalls: number; avgCallLength: number; closeRate: number }> = [];

  for (const [date, agentMap] of grouped) {
    for (const [agentId, data] of agentMap) {
      const agentSales = salesByAgent.get(agentId) ?? 0;
      result.push({
        date,
        agentId,
        agentName: agentNameMap.get(agentId) ?? "Unknown",
        totalCalls: data.totalCalls,
        avgCallLength: Math.round((data.avgCallLengthSum / data.snapshotCount) * 100) / 100,
        closeRate: Math.round(safeDivide(agentSales, data.totalCalls) * 10000) / 100, // percentage with 2 decimal
      });
    }
  }

  return result.sort((a, b) => a.date.localeCompare(b.date) || a.agentName.localeCompare(b.agentName));
}

// ── Lead Source Effectiveness ───────────────────────────────────────

async function getLeadSourceEffectiveness(dw: DateWindow) {
  const [salesBySource, leadSources, callLogs, kpiCosts] = await Promise.all([
    prisma.sale.groupBy({
      by: ["leadSourceId"],
      where: { status: "RAN", saleDate: { gte: dw.gte, lt: dw.lt } },
      _count: true,
      _sum: { premium: true },
    }),
    prisma.leadSource.findMany({ select: { id: true, name: true, costPerLead: true, callBufferSeconds: true } }),
    prisma.convosoCallLog.groupBy({
      by: ["leadSourceId"],
      where: {
        leadSourceId: { not: null },
        callTimestamp: { gte: dw.gte, lt: dw.lt },
      },
      _count: true,
    }),
    prisma.agentCallKpi.groupBy({
      by: ["leadSourceId"],
      where: { snapshotDate: { gte: dw.gte, lt: dw.lt } },
      _sum: { totalLeadCost: true },
    }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma groupBy return types
  const sourceNameMap = new Map<string, string>(leadSources.map((ls: any) => [ls.id, ls.name]));
  const callCountMap = new Map<string, number>(callLogs.map((cl: any) => [cl.leadSourceId, cl._count]));
  const costMap = new Map<string, number>(kpiCosts.map((k: any) => [k.leadSourceId, Number(k._sum?.totalLeadCost ?? 0)]));

  return salesBySource
    .filter((s: any) => s._count > 0)
    .map((s: any) => {
      const salesCount = s._count as number;
      const premiumTotal = Number(s._sum?.premium ?? 0);
      const callCount = callCountMap.get(s.leadSourceId) ?? 0;
      const totalCost = costMap.get(s.leadSourceId) ?? 0;
      return {
        sourceId: s.leadSourceId as string,
        sourceName: sourceNameMap.get(s.leadSourceId) ?? "Unknown",
        salesCount,
        premiumTotal: Math.round(premiumTotal * 100) / 100,
        callCount,
        costPerSale: Math.round(safeDivide(totalCost, salesCount) * 100) / 100,
        conversionRate: Math.round(safeDivide(salesCount, callCount) * 10000) / 100, // percentage
      };
    })
    .sort((a: any, b: any) => b.conversionRate - a.conversionRate);
}

// ── Call Quality Trend ──────────────────────────────────────────────

async function getCallQualityTrend(dw: DateWindow) {
  const snapshots = await prisma.agentCallKpi.findMany({
    where: { snapshotDate: { gte: dw.gte, lt: dw.lt } },
    select: { snapshotDate: true, callsByTier: true },
  });

  const dayMap = new Map<string, CallTiers>();

  for (const snap of snapshots) {
    const tiers = parseCallsByTier(snap.callsByTier);
    if (!tiers) continue; // skip malformed
    const day = toDay(snap.snapshotDate);
    const entry = dayMap.get(day) ?? { short: 0, contacted: 0, engaged: 0, deep: 0 };
    entry.short += tiers.short;
    entry.contacted += tiers.contacted;
    entry.engaged += tiers.engaged;
    entry.deep += tiers.deep;
    dayMap.set(day, entry);
  }

  return [...dayMap.entries()]
    .map(([date, tiers]) => ({ date, ...tiers }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Main Export ─────────────────────────────────────────────────────

export async function getOwnerTrends(dw: DateWindow) {
  // Run all 4 queries with individual error handling for partial failure resilience
  const [revenueTrend, agentKpiTrend, leadSourceEffectiveness, callQualityTrend] = await Promise.all([
    getRevenueTrend(dw).catch(err => { console.error("[trendAggregator] revenueTrend failed:", err); return []; }),
    getAgentKpiTrend(dw).catch(err => { console.error("[trendAggregator] agentKpiTrend failed:", err); return []; }),
    getLeadSourceEffectiveness(dw).catch(err => { console.error("[trendAggregator] leadSourceEffectiveness failed:", err); return []; }),
    getCallQualityTrend(dw).catch(err => { console.error("[trendAggregator] callQualityTrend failed:", err); return []; }),
  ]);

  return { revenueTrend, agentKpiTrend, leadSourceEffectiveness, callQualityTrend };
}
