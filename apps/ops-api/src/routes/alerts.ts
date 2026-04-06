import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { getPendingAlerts, approveAlert, clearAlert } from "../services/alerts";
import { asyncHandler, zodErr, idParamSchema } from "./helpers";

const router = Router();

// GET /alerts -- pending payroll alerts
router.get("/alerts", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const alerts = await getPendingAlerts();
  res.json(alerts);
}));

// POST /alerts/:id/approve -- approve alert, create clawback in selected period
router.post("/alerts/:id/approve", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const parsed = z.object({ periodId: z.string().min(1).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { periodId } = parsed.data;
  const alert = await approveAlert(pp.data.id, periodId, req.user!.id);
  res.json(alert);
}));

// POST /alerts/:id/clear -- clear/dismiss alert
router.post("/alerts/:id/clear", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const alert = await clearAlert(pp.data.id, req.user!.id);
  res.json(alert);
}));

// GET /alerts/agent-periods/:agentId -- get unpaid periods for an agent (for approve dropdown)
router.get("/alerts/agent-periods/:agentId", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const ap = z.object({ agentId: z.string().min(1, "Agent ID is required") }).safeParse(req.params);
  if (!ap.success) return res.status(400).json(zodErr(ap.error));
  const periods = await prisma.payrollPeriod.findMany({
    where: {
      status: "OPEN",
      entries: { some: { agentId: ap.data.agentId, status: { not: "PAID" } } },
    },
    orderBy: { weekStart: "asc" },
    select: { id: true, weekStart: true, weekEnd: true, status: true },
  });
  res.json(periods);
}));

export default router;
