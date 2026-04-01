import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { archiveRecords, restoreBatch, getArchiveStats, previewArchive } from "../services/archive";
import { asyncHandler, zodErr } from "./helpers";

const router = Router();

const archiveSchema = z.object({
  cutoffDays: z.number().int().min(1).default(90),
  tables: z.array(z.enum(["call_audits", "convoso_call_logs", "app_audit_log"])).min(1),
});

const restoreSchema = z.object({
  batchId: z.string().min(1),
});

// GET /archive/preview -- return eligible row counts without archiving
router.get("/archive/preview", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const qp = z.object({ cutoffDays: z.coerce.number().int().min(1).default(90) }).safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const days = qp.data.cutoffDays;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const result = await previewArchive(cutoffDate);
  return res.json(result);
}));

// POST /archive -- archive records older than cutoff
router.post("/archive", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = archiveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - parsed.data.cutoffDays);

  const result = await archiveRecords(cutoffDate, parsed.data.tables, req.user!.id);
  return res.json(result);
}));

// POST /archive/restore -- restore an archived batch
router.post("/archive/restore", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = restoreSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const result = await restoreBatch(parsed.data.batchId, req.user!.id);
  return res.json(result);
}));

// GET /archive/stats -- get archive statistics
router.get("/archive/stats", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (_req, res) => {
  const stats = await getArchiveStats();
  return res.json(stats);
}));

export default router;
