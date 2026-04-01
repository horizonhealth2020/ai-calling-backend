import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@ops/db";
import { DateTime } from "luxon";
import { requireAuth, requireRole } from "../middleware/auth";
import { zodErr, asyncHandler } from "./helpers";

const router = Router();

/* ------------------------------------------------------------------ */
/* Shared types and helpers                                            */
/* ------------------------------------------------------------------ */

type GroupBy = "dow" | "wom" | "moy";

const dateRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  range: z.enum(["7d", "30d", "60d", "90d"]).optional(),
});

function computeDateRange(params: { from?: string; to?: string; range?: string }): { gte: Date; lt: Date } {
  if (params.from && params.to) {
    return { gte: new Date(params.from), lt: new Date(params.to + "T23:59:59.999Z") };
  }
  const days = params.range === "7d" ? 7 : params.range === "60d" ? 60 : params.range === "90d" ? 90 : 30;
  const lt = new Date();
  const gte = new Date();
  gte.setDate(gte.getDate() - days);
  gte.setHours(0, 0, 0, 0);
  return { gte, lt };
}

/** PostgreSQL COUNT returns bigint; must convert before JSON.stringify */
function toBigIntSafe(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(row => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = typeof v === "bigint" ? Number(v) : v;
    }
    return out;
  });
}

/* ------------------------------------------------------------------ */
/* GET /api/lead-timing/heatmap                                        */
/* ------------------------------------------------------------------ */

const heatmapSchema = dateRangeSchema.extend({
  groupBy: z.enum(["dow", "wom", "moy"]).default("dow"),
});

router.get("/lead-timing/heatmap", requireAuth, requireRole("MANAGER", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = heatmapSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { groupBy } = parsed.data;
  const { gte, lt } = computeDateRange(parsed.data);

  const callGroupExpr = groupBy === "dow"
    ? Prisma.sql`EXTRACT(DOW FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int`
    : groupBy === "wom"
    ? Prisma.sql`CEIL(EXTRACT(DAY FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') / 7.0)::int`
    : Prisma.sql`EXTRACT(MONTH FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int`;

  const saleGroupExpr = groupBy === "dow"
    ? Prisma.sql`EXTRACT(DOW FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int`
    : groupBy === "wom"
    ? Prisma.sql`CEIL(EXTRACT(DAY FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') / 7.0)::int`
    : Prisma.sql`EXTRACT(MONTH FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int`;

  const [callBuckets, saleBuckets, leadSources] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        lead_source_id AS "leadSourceId",
        EXTRACT(HOUR FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int AS hour,
        ${callGroupExpr} AS "groupVal",
        COUNT(*)::bigint AS "callCount"
      FROM convoso_call_logs
      WHERE call_timestamp >= ${gte} AND call_timestamp < ${lt}
        AND agent_id IS NOT NULL
        AND lead_source_id IS NOT NULL
      GROUP BY lead_source_id, hour, "groupVal"
    `,
    prisma.$queryRaw`
      SELECT
        lead_source_id AS "leadSourceId",
        EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int AS hour,
        ${saleGroupExpr} AS "groupVal",
        COUNT(*)::bigint AS "saleCount"
      FROM sales
      WHERE created_at >= ${gte} AND created_at < ${lt}
        AND lead_source_id IS NOT NULL
        AND status = 'RAN'
      GROUP BY lead_source_id, hour, "groupVal"
    `,
    prisma.leadSource.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  // Application-level join
  const calls = toBigIntSafe(callBuckets as Record<string, unknown>[]);
  const sales = toBigIntSafe(saleBuckets as Record<string, unknown>[]);

  const key = (lsId: string, hour: number, group: number) => `${lsId}:${hour}:${group}`;
  const callMap = new Map<string, number>();
  for (const row of calls) {
    callMap.set(key(row.leadSourceId as string, row.hour as number, row.groupVal as number), row.callCount as number);
  }
  const saleMap = new Map<string, number>();
  for (const row of sales) {
    saleMap.set(key(row.leadSourceId as string, row.hour as number, row.groupVal as number), row.saleCount as number);
  }

  // Build response: array of { leadSourceId, leadSourceName, cells: [...] }
  const lsNameMap = new Map(leadSources.map(ls => [ls.id, ls.name]));
  const allKeys = new Set([...callMap.keys(), ...saleMap.keys()]);
  const bySource = new Map<string, { hour: number; groupVal: number; calls: number; sales: number; closeRate: number }[]>();

  for (const k of allKeys) {
    const [lsId, hourStr, groupStr] = k.split(":");
    const hour = Number(hourStr);
    const groupVal = Number(groupStr);
    const c = callMap.get(k) ?? 0;
    const s = saleMap.get(k) ?? 0;
    if (!bySource.has(lsId)) bySource.set(lsId, []);
    bySource.get(lsId)!.push({ hour, groupVal, calls: c, sales: s, closeRate: c > 0 ? s / c : 0 });
  }

  const result = leadSources.map(ls => ({
    leadSourceId: ls.id,
    leadSourceName: ls.name,
    cells: bySource.get(ls.id) ?? [],
  }));

  res.json({ sources: result, groupBy });
}));

/* ------------------------------------------------------------------ */
/* GET /api/lead-timing/sparklines                                     */
/* ------------------------------------------------------------------ */

router.get("/lead-timing/sparklines", requireAuth, requireRole("MANAGER", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  // Dayparts: morning=8-11, afternoon=12-16, evening=17-20
  const [callBuckets, saleBuckets, leadSources] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        lead_source_id AS "leadSourceId",
        ((call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::date AS day,
        CASE
          WHEN EXTRACT(HOUR FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 8 AND 11 THEN 'morning'
          WHEN EXTRACT(HOUR FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 12 AND 16 THEN 'afternoon'
          WHEN EXTRACT(HOUR FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 17 AND 20 THEN 'evening'
          ELSE NULL
        END AS daypart,
        COUNT(*)::bigint AS "callCount"
      FROM convoso_call_logs
      WHERE call_timestamp >= ${sevenDaysAgo} AND call_timestamp < ${now}
        AND agent_id IS NOT NULL AND lead_source_id IS NOT NULL
      GROUP BY lead_source_id, day, daypart
      HAVING CASE
        WHEN EXTRACT(HOUR FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 8 AND 11 THEN 'morning'
        WHEN EXTRACT(HOUR FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 12 AND 16 THEN 'afternoon'
        WHEN EXTRACT(HOUR FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 17 AND 20 THEN 'evening'
        ELSE NULL
      END IS NOT NULL
    `,
    prisma.$queryRaw`
      SELECT
        lead_source_id AS "leadSourceId",
        ((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::date AS day,
        CASE
          WHEN EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 8 AND 11 THEN 'morning'
          WHEN EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 12 AND 16 THEN 'afternoon'
          WHEN EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 17 AND 20 THEN 'evening'
          ELSE NULL
        END AS daypart,
        COUNT(*)::bigint AS "saleCount"
      FROM sales
      WHERE created_at >= ${sevenDaysAgo} AND created_at < ${now}
        AND lead_source_id IS NOT NULL AND status = 'RAN'
      GROUP BY lead_source_id, day, daypart
      HAVING CASE
        WHEN EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 8 AND 11 THEN 'morning'
        WHEN EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 12 AND 16 THEN 'afternoon'
        WHEN EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York') BETWEEN 17 AND 20 THEN 'evening'
        ELSE NULL
      END IS NOT NULL
    `,
    prisma.leadSource.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  const calls = toBigIntSafe(callBuckets as Record<string, unknown>[]);
  const sales = toBigIntSafe(saleBuckets as Record<string, unknown>[]);

  // Build lookup: leadSourceId:day:daypart -> { calls, sales }
  const key = (lsId: string, day: string, dp: string) => `${lsId}:${day}:${dp}`;
  const callMap = new Map<string, number>();
  for (const r of calls) callMap.set(key(r.leadSourceId as string, String(r.day), r.daypart as string), r.callCount as number);
  const saleMap = new Map<string, number>();
  for (const r of sales) saleMap.set(key(r.leadSourceId as string, String(r.day), r.daypart as string), r.saleCount as number);

  // Generate 7-day series
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const result = leadSources.map(ls => {
    const dayparts: Record<string, number[]> = { morning: [], afternoon: [], evening: [] };
    for (const day of days) {
      for (const dp of ["morning", "afternoon", "evening"]) {
        const c = callMap.get(key(ls.id, day, dp)) ?? 0;
        const s = saleMap.get(key(ls.id, day, dp)) ?? 0;
        dayparts[dp].push(c > 0 ? s / c : 0);
      }
    }
    return { leadSourceId: ls.id, leadSourceName: ls.name, days, dayparts };
  });

  res.json({ sources: result });
}));

/* ------------------------------------------------------------------ */
/* GET /api/lead-timing/recommendation                                 */
/* ------------------------------------------------------------------ */

router.get("/lead-timing/recommendation", requireAuth, requireRole("MANAGER", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = dateRangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { gte, lt } = computeDateRange(parsed.data);

  // Current hour and day-of-week in ET
  const nowET = DateTime.now().setZone("America/New_York");
  const currentHour = nowET.hour;
  const currentDow = nowET.weekday % 7; // Luxon: 1=Mon..7=Sun -> PostgreSQL DOW: 0=Sun..6=Sat

  // Get call counts and sale counts for this hour + dow across the date range
  const [callBuckets, saleBuckets] = await Promise.all([
    prisma.$queryRaw`
      SELECT
        lead_source_id AS "leadSourceId",
        COUNT(*)::bigint AS "callCount"
      FROM convoso_call_logs
      WHERE call_timestamp >= ${gte} AND call_timestamp < ${lt}
        AND agent_id IS NOT NULL AND lead_source_id IS NOT NULL
        AND EXTRACT(HOUR FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int = ${currentHour}
        AND EXTRACT(DOW FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int = ${currentDow}
      GROUP BY lead_source_id
    `,
    prisma.$queryRaw`
      SELECT
        lead_source_id AS "leadSourceId",
        COUNT(*)::bigint AS "saleCount"
      FROM sales
      WHERE created_at >= ${gte} AND created_at < ${lt}
        AND lead_source_id IS NOT NULL AND status = 'RAN'
        AND EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int = ${currentHour}
        AND EXTRACT(DOW FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int = ${currentDow}
      GROUP BY lead_source_id
    `,
  ]);

  const calls = toBigIntSafe(callBuckets as Record<string, unknown>[]);
  const sales = toBigIntSafe(saleBuckets as Record<string, unknown>[]);

  const callMap = new Map<string, number>();
  for (const r of calls) callMap.set(r.leadSourceId as string, r.callCount as number);
  const saleMap = new Map<string, number>();
  for (const r of sales) saleMap.set(r.leadSourceId as string, r.saleCount as number);

  // Rank sources with >= 10 calls (minimum sample threshold)
  const MIN_SAMPLE = 10;
  const candidates: { leadSourceId: string; calls: number; sales: number; closeRate: number }[] = [];
  for (const [lsId, c] of callMap) {
    if (c < MIN_SAMPLE) continue;
    const s = saleMap.get(lsId) ?? 0;
    candidates.push({ leadSourceId: lsId, calls: c, sales: s, closeRate: s / c });
  }
  candidates.sort((a, b) => b.closeRate - a.closeRate);

  if (candidates.length === 0) {
    return res.json({ recommendation: null, currentHour, currentDow });
  }

  const best = candidates[0];
  const ls = await prisma.leadSource.findUnique({ where: { id: best.leadSourceId }, select: { name: true } });

  // Compute trend: compare to prior period same hour/dow
  const rangeDays = Math.round((lt.getTime() - gte.getTime()) / (1000 * 60 * 60 * 24));
  const priorGte = new Date(gte.getTime() - rangeDays * 24 * 60 * 60 * 1000);
  const priorLt = gte;

  const [priorCalls, priorSales] = await Promise.all([
    prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS "callCount"
      FROM convoso_call_logs
      WHERE call_timestamp >= ${priorGte} AND call_timestamp < ${priorLt}
        AND lead_source_id = ${best.leadSourceId}
        AND agent_id IS NOT NULL
        AND EXTRACT(HOUR FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int = ${currentHour}
        AND EXTRACT(DOW FROM (call_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int = ${currentDow}
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS "saleCount"
      FROM sales
      WHERE created_at >= ${priorGte} AND created_at < ${priorLt}
        AND lead_source_id = ${best.leadSourceId}
        AND status = 'RAN'
        AND EXTRACT(HOUR FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int = ${currentHour}
        AND EXTRACT(DOW FROM (created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::int = ${currentDow}
    `,
  ]);

  const pc = Number((priorCalls as Record<string, unknown>[])[0]?.callCount ?? 0n);
  const ps = Number((priorSales as Record<string, unknown>[])[0]?.saleCount ?? 0n);
  const priorRate = pc > 0 ? ps / pc : 0;
  const trendDelta = best.closeRate - priorRate;
  const trend = pc >= MIN_SAMPLE ? (trendDelta > 0.005 ? "up" : trendDelta < -0.005 ? "down" : "flat") : null;

  res.json({
    recommendation: {
      leadSourceId: best.leadSourceId,
      leadSourceName: ls?.name ?? "Unknown",
      closeRate: best.closeRate,
      calls: best.calls,
      sales: best.sales,
      trend,
      trendDelta: trend ? trendDelta : null,
    },
    currentHour,
    currentDow,
  });
}));

export default router;
