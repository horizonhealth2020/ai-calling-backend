import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createSyncedRep, getNextRoundRobinRep, batchRoundRobinAssign, getRepChecklist, syncExistingReps, syncServiceAgentsToCsRoster } from "../services/repSync";
import { getCsAnalytics, getRepDrillDown } from "../services/csAnalyticsAggregator";
import { zodErr, asyncHandler, idParamSchema, dateRange, dateRangeQuerySchema } from "./helpers";

const router = Router();

// ─── CS Analytics (Aggregated Metrics) ───────────────────────────

router.get("/cs/analytics", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  if (!dr) return res.status(400).json({ error: "A valid date range is required (range, or from+to)" });
  const analytics = await getCsAnalytics(dr);
  res.set("Cache-Control", "private, max-age=60");
  res.json(analytics);
}));

router.get("/cs/analytics/rep/:repName", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const repName = decodeURIComponent(req.params.repName);
  if (!repName) return res.status(400).json({ error: "repName is required" });
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  if (!dr) return res.status(400).json({ error: "A valid date range is required (range, or from+to)" });
  const limitParam = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);
  const offsetParam = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);
  const result = await getRepDrillDown(repName, dr, limitParam, offsetParam);
  res.json(result);
}));

// ─── Resolved Log (Audit Trail) ──────────────────────────────────

router.get("/reps/resolved-log", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = dateRangeQuerySchema.extend({
    type: z.enum(["all", "chargeback", "pending_term"]).default("all"),
    agentName: z.string().optional(),
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { type, agentName } = parsed.data;
  const dr = dateRange(parsed.data.range, parsed.data.from, parsed.data.to);

  // Build date filter for resolvedAt
  const dateFilter: Record<string, unknown> = { resolvedAt: { not: null } };
  if (dr) {
    dateFilter.resolvedAt = { gte: dr.gte, lt: dr.lt };
  }

  const results: Array<{
    type: "chargeback" | "pending_term";
    agentName: string;
    memberName: string;
    resolvedAt: Date | null;
    resolvedByName: string;
    resolutionNote: string | null;
    resolutionType: string | null;
    originalAmount: number;
  }> = [];

  if (type === "all" || type === "chargeback") {
    const chargebacks = await prisma.chargebackSubmission.findMany({
      where: {
        ...dateFilter,
        ...(agentName ? { payeeName: { contains: agentName, mode: "insensitive" as const } } : {}),
      },
      include: { resolver: { select: { name: true } } },
      orderBy: { resolvedAt: "desc" },
    });
    results.push(...chargebacks.map((c) => ({
      type: "chargeback" as const,
      agentName: c.payeeName ?? "Unknown",
      memberName: c.memberCompany ?? c.memberId ?? "Unknown",
      resolvedAt: c.resolvedAt,
      resolvedByName: c.resolver?.name ?? "Unknown",
      resolutionNote: c.resolutionNote ?? null,
      resolutionType: c.resolutionType ?? null,
      originalAmount: Number(c.chargebackAmount ?? 0),
    })));
  }

  if (type === "all" || type === "pending_term") {
    const terms = await prisma.pendingTerm.findMany({
      where: {
        ...dateFilter,
        ...(agentName ? { agentName: { contains: agentName, mode: "insensitive" as const } } : {}),
      },
      include: { resolver: { select: { name: true } } },
      orderBy: { resolvedAt: "desc" },
    });
    results.push(...terms.map((t) => ({
      type: "pending_term" as const,
      agentName: t.agentName ?? "Unknown",
      memberName: t.memberName ?? t.memberId ?? "Unknown",
      resolvedAt: t.resolvedAt,
      resolvedByName: t.resolver?.name ?? "Unknown",
      resolutionNote: t.resolutionNote ?? null,
      resolutionType: t.resolutionType ?? null,
      originalAmount: Number(t.enrollAmount ?? 0),
    })));
  }

  // Sort unified results by resolvedAt descending (most recent first)
  results.sort((a, b) => new Date(b.resolvedAt!).getTime() - new Date(a.resolvedAt!).getTime());
  res.json(results);
}));

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

// GET /reps/next-assignment -- get next round robin rep (separate indices per type)
router.get("/reps/next-assignment", requireAuth, requireRole("CUSTOMER_SERVICE", "OWNER_VIEW", "PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const type = req.query.type === "pending_term" ? "pending_term" : "chargeback";
  const rep = await getNextRoundRobinRep(type);
  res.json(rep || { id: null, name: null });
}));

// GET /reps/batch-assign -- get N round-robin assignments
// Pass `?preview=true` for dry-run (no cursor advance) -- used by client paste/refresh flows.
// Without preview the cursor still advances for backwards-compat with any non-CS callers.
router.get("/reps/batch-assign", requireAuth, requireRole("CUSTOMER_SERVICE", "OWNER_VIEW", "PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const type = req.query.type === "pending_term" ? "pending_term" : "chargeback";
  const count = Math.min(Math.max(parseInt(String(req.query.count ?? "0"), 10) || 0, 0), 500);
  const preview = req.query.preview === "true";
  const assignments = await batchRoundRobinAssign(type as "chargeback" | "pending_term", count, { persist: !preview });
  res.json({ assignments, preview });
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
