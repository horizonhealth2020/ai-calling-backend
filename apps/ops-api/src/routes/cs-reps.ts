import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createSyncedRep, getNextRoundRobinRep, getRepChecklist, syncExistingReps, syncServiceAgentsToCsRoster } from "../services/repSync";
import { zodErr, asyncHandler, idParamSchema } from "./helpers";

const router = Router();

// ─── Synced Rep Management ────────────────────────────────────────

// POST /reps/create-synced -- create rep in both CsRepRoster + ServiceAgent
router.post("/reps/create-synced", requireAuth, requireRole("OWNER_VIEW", "PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed = z.object({
    name: z.string().min(1).max(100),
    basePay: z.number().min(0).optional().default(0),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const result = await createSyncedRep(parsed.data.name, parsed.data.basePay, req.user!.id);
  res.status(201).json(result);
}));

// POST /reps/sync-existing -- one-time sync of unlinked reps by name
router.post("/reps/sync-existing", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const result = await syncExistingReps();
  res.json(result);
}));

// GET /reps/next-assignment -- get next round robin rep
router.get("/reps/next-assignment", requireAuth, requireRole("CUSTOMER_SERVICE", "OWNER_VIEW", "PAYROLL", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const rep = await getNextRoundRobinRep();
  res.json(rep || { id: null, name: null });
}));

// GET /reps/checklist -- per-rep assignment checklist
router.get("/reps/checklist", requireAuth, requireRole("CUSTOMER_SERVICE", "OWNER_VIEW", "PAYROLL", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const checklist = await getRepChecklist();
  res.json(checklist);
}));

// ─── CS Rep Roster ────────────────────────────────────────────────

router.get("/cs-rep-roster", requireAuth, asyncHandler(async (_req, res) => {
  // Sync: ensure all ServiceAgents have a CsRepRoster entry
  await syncServiceAgentsToCsRoster();

  // On-access pruning: remove inactive reps older than 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  await prisma.csRepRoster.deleteMany({
    where: { active: false, updatedAt: { lt: thirtyDaysAgo } },
  });

  const reps = await prisma.csRepRoster.findMany({ orderBy: { createdAt: "asc" } });
  return res.json(reps);
}));

const csRepSchema = z.object({ name: z.string().min(1).max(100) });

router.post("/cs-rep-roster", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = csRepSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  // Use synced creation to create both CsRepRoster + ServiceAgent
  const { csRep } = await createSyncedRep(parsed.data.name, 0, req.user!.id);
  return res.status(201).json(csRep);
}));

const csRepToggleSchema = z.object({ active: z.boolean() });

router.patch("/cs-rep-roster/:id", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const parsed = csRepToggleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const rep = await prisma.csRepRoster.update({
    where: { id: pp.data.id },
    data: { active: parsed.data.active },
  });
  return res.json(rep);
}));

router.delete("/cs-rep-roster/:id", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  await prisma.csRepRoster.delete({ where: { id: pp.data.id } });
  return res.status(204).end();
}));

export default router;
