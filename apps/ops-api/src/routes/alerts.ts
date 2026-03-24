import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { getPendingAlerts, approveAlert, clearAlert } from "../services/alerts";
import { asyncHandler } from "./helpers";

const router = Router();

// GET /alerts -- pending payroll alerts
router.get("/alerts", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const alerts = await getPendingAlerts();
  res.json(alerts);
}));

// POST /alerts/:id/approve -- approve alert, create clawback in selected period
router.post("/alerts/:id/approve", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const { periodId } = z.object({ periodId: z.string().min(1) }).parse(req.body);
  const alert = await approveAlert(req.params.id, periodId, (req as any).user.id);
  res.json(alert);
}));

// POST /alerts/:id/clear -- clear/dismiss alert
router.post("/alerts/:id/clear", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const alert = await clearAlert(req.params.id, (req as any).user.id);
  res.json(alert);
}));

// GET /alerts/agent-periods/:agentId -- get unpaid periods for an agent (for approve dropdown)
router.get("/alerts/agent-periods/:agentId", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const periods = await prisma.payrollPeriod.findMany({
    where: {
      status: "OPEN",
      entries: { some: { agentId: req.params.agentId, status: { not: "PAID" } } },
    },
    orderBy: { weekStart: "desc" },
    select: { id: true, weekStart: true, weekEnd: true, status: true },
  });
  res.json(periods);
}));

export default router;
