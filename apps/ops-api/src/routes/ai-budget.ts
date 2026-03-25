import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAiUsageStats, enqueueAutoScore, startAutoScorePolling } from "../services/auditQueue";
import { asyncHandler, dateRange, zodErr, dateRangeQuerySchema } from "./helpers";

const router = Router();

// GET /ai/usage-stats -- current AI usage and budget info
router.get("/ai/usage-stats", requireAuth, requireRole("OWNER_VIEW", "MANAGER", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const stats = await getAiUsageStats();
  res.json(stats);
}));

// POST /ai/auto-score -- trigger batch auto-scoring of eligible calls
router.post("/ai/auto-score", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const queued = await enqueueAutoScore();
  if (queued > 0) startAutoScorePolling();
  res.json({ queued, message: `${queued} calls queued for AI scoring` });
}));

// PUT /ai/budget -- update daily budget cap
router.put("/ai/budget", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed = z.object({ dailyBudget: z.number().min(0).max(1000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { dailyBudget } = parsed.data;
  await prisma.salesBoardSetting.upsert({
    where: { key: "ai_daily_budget_cap" },
    update: { value: String(dailyBudget) },
    create: { key: "ai_daily_budget_cap", value: String(dailyBudget) },
  });
  res.json({ dailyBudget });
}));

// GET /ai/scoring-stats -- aggregate AI scoring KPIs, per-agent breakdown, weekly trends
router.get("/ai/scoring-stats", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const where: any = { aiScore: { not: null } };
  if (dr) where.callDate = { gte: dr.gte, lt: dr.lt };

  // Aggregate KPIs
  const agg = await prisma.callAudit.aggregate({
    where,
    _avg: { aiScore: true },
    _count: { id: true },
    _min: { aiScore: true },
    _max: { aiScore: true },
  });

  // Score distribution buckets (parallel)
  const [poor, fair, good, excellent] = await Promise.all([
    prisma.callAudit.count({ where: { ...where, aiScore: { not: null, gte: 0, lt: 50 }, ...(dr ? { callDate: { gte: dr.gte, lt: dr.lt } } : {}) } }),
    prisma.callAudit.count({ where: { ...where, aiScore: { not: null, gte: 50, lt: 70 }, ...(dr ? { callDate: { gte: dr.gte, lt: dr.lt } } : {}) } }),
    prisma.callAudit.count({ where: { ...where, aiScore: { not: null, gte: 70, lt: 85 }, ...(dr ? { callDate: { gte: dr.gte, lt: dr.lt } } : {}) } }),
    prisma.callAudit.count({ where: { ...where, aiScore: { not: null, gte: 85, lte: 100 }, ...(dr ? { callDate: { gte: dr.gte, lt: dr.lt } } : {}) } }),
  ]);

  // Per-agent breakdown
  const agentGroups = await prisma.callAudit.groupBy({
    by: ["agentId"],
    where,
    _avg: { aiScore: true },
    _count: { id: true },
  });
  const agentIds = agentGroups.map((g) => g.agentId);
  const agents = agentIds.length > 0
    ? await prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } })
    : [];
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const agentBreakdown = agentGroups.map((g) => ({
    agentId: g.agentId,
    agentName: agentMap.get(g.agentId) ?? "Unknown",
    avgScore: Math.round(g._avg.aiScore ?? 0),
    auditCount: g._count.id,
  }));

  // Weekly trends
  const scored = await prisma.callAudit.findMany({
    where,
    select: { aiScore: true, callDate: true },
    orderBy: { callDate: "asc" },
  });
  const weekMap = new Map<string, number[]>();
  for (const audit of scored) {
    const d = new Date(audit.callDate);
    const dayOfYear = Math.floor((d.getTime() - new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getTime()) / 86400000);
    const weekNum = Math.ceil((dayOfYear + new Date(Date.UTC(d.getUTCFullYear(), 0, 1)).getUTCDay() + 1) / 7);
    const key = `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
    if (!weekMap.has(key)) weekMap.set(key, []);
    weekMap.get(key)!.push(audit.aiScore!);
  }
  const weeklyTrends: { week: string; avgScore: number; auditCount: number; delta: number | null }[] = [];
  let prevAvg: number | null = null;
  for (const [week, scores] of [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    weeklyTrends.push({ week, avgScore: avg, auditCount: scores.length, delta: prevAvg !== null ? avg - prevAvg : null });
    prevAvg = avg;
  }

  res.json({
    aggregate: {
      avgScore: Math.round(agg._avg.aiScore ?? 0),
      totalAudits: agg._count.id,
      minScore: agg._min.aiScore ?? 0,
      maxScore: agg._max.aiScore ?? 0,
    },
    distribution: { poor, fair, good, excellent },
    agents: agentBreakdown,
    weeklyTrends,
  });
}));

export default router;
