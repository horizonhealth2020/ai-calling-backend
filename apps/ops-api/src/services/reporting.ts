/**
 * Pure reporting helper functions.
 * No DB dependencies -- tested directly in reporting.test.ts.
 */

export function computeTrend(
  current: number,
  prior: number
): { value: number; direction: "up" | "down" | "flat" } {
  if (prior === 0) {
    return current > 0
      ? { value: 100, direction: "up" }
      : { value: 0, direction: "flat" };
  }
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return { value: 0, direction: "flat" };
  return pct > 0
    ? { value: Math.abs(pct), direction: "up" }
    : { value: Math.abs(pct), direction: "down" };
}

export function shiftRange(
  dr: { gte: Date; lt: Date },
  days: number
): { gte: Date; lt: Date } {
  return {
    gte: new Date(dr.gte.getTime() - days * 86400000),
    lt: new Date(dr.lt.getTime() - days * 86400000),
  };
}

export function buildPeriodSummary(period: {
  weekStart: Date;
  weekEnd: Date;
  status: string;
  entries: Array<{
    payoutAmount: number | string | { toNumber(): number };
    netAmount: number | string | { toNumber(): number };
    sale: { premium: number | string | { toNumber(): number }; status: string };
  }>;
}): {
  period: string;
  salesCount: number;
  premiumTotal: number;
  commissionPaid: number;
  periodStatus: string;
} {
  const ranEntries = period.entries.filter((e) => e.sale.status === "RAN");
  return {
    period: `${period.weekStart.toISOString().slice(0, 10)} - ${period.weekEnd.toISOString().slice(0, 10)}`,
    salesCount: ranEntries.length,
    premiumTotal: ranEntries.reduce(
      (sum, e) => sum + Number(e.sale.premium),
      0
    ),
    commissionPaid: ranEntries.reduce((sum, e) => sum + Number(e.netAmount), 0),
    periodStatus: period.status,
  };
}
