import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { getAiUsageStats, enqueueAutoScore, startAutoScorePolling } from "../services/auditQueue";
import { asyncHandler } from "./helpers";

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
  const { dailyBudget } = z.object({ dailyBudget: z.number().min(0).max(1000) }).parse(req.body);
  await prisma.salesBoardSetting.upsert({
    where: { key: "ai_daily_budget_cap" },
    update: { value: String(dailyBudget) },
    create: { key: "ai_daily_budget_cap", value: String(dailyBudget) },
  });
  res.json({ dailyBudget });
}));

export default router;
