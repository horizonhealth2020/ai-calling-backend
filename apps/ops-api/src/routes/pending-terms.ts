import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { emitCSChanged } from "../socket";
import { zodErr, asyncHandler, dateRange, dateRangeQuerySchema, idParamSchema } from "./helpers";

const router = Router();

const pendingTermSchema = z.object({
  records: z.array(z.object({
    agentName: z.string().nullable(),
    agentIdField: z.string().nullable(),
    memberId: z.string().nullable(),
    memberName: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    phone: z.string().nullable(),
    product: z.string().nullable(),
    monthlyAmount: z.number().nullable(),
    paid: z.string().nullable(),
    createdDate: z.string().nullable(),
    firstBilling: z.string().nullable(),
    activeDate: z.string().nullable(),
    nextBilling: z.string().nullable(),
    holdDate: z.string().nullable(),
    holdReason: z.string().nullable(),
    inactive: z.boolean().nullable(),
    lastTransactionType: z.string().nullable(),
    assignedTo: z.string().nullable(),
  })),
  rawPaste: z.string().min(1),
  batchId: z.string().min(1),
});

router.post("/pending-terms", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = pendingTermSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { records, rawPaste, batchId } = parsed.data;
  const result = await prisma.pendingTerm.createMany({
    data: records.map((r) => ({
      agentName: r.agentName,
      agentIdField: r.agentIdField,
      memberId: r.memberId,
      memberName: r.memberName,
      city: r.city,
      state: r.state,
      phone: r.phone,
      product: r.product,
      monthlyAmount: r.monthlyAmount,
      paid: r.paid,
      createdDate: r.createdDate ? new Date(r.createdDate) : null,
      firstBilling: r.firstBilling ? new Date(r.firstBilling) : null,
      activeDate: r.activeDate ? new Date(r.activeDate) : null,
      nextBilling: r.nextBilling ? new Date(r.nextBilling) : null,
      holdDate: r.holdDate ? new Date(r.holdDate + "T00:00:00") : null,
      holdReason: r.holdReason,
      inactive: r.inactive,
      lastTransactionType: r.lastTransactionType,
      assignedTo: r.assignedTo,
      submittedBy: req.user!.id,
      batchId,
      rawPaste,
    })),
  });

  // Emit CS changed event for real-time updates
  emitCSChanged({ type: "pending_term", batchId, count: result.count });

  return res.status(201).json({ count: result.count, batchId });
}));

router.get("/pending-terms", requireAuth, asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.extend({ groupBy: z.enum(["holdDate", "saleDate"]).optional() }).safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const dateFilter = dr ? { createdAt: { gte: dr.gte, lt: dr.lt } } : {};

  // Support holdDate grouping for CS dashboard (CS-03)
  if (qp.data.groupBy === "holdDate") {
    const grouped = await prisma.pendingTerm.groupBy({
      by: ["holdDate"],
      where: { resolvedAt: null, ...dateFilter },
      _count: true,
      orderBy: { holdDate: "asc" },
    });
    const records = await prisma.pendingTerm.findMany({
      where: { resolvedAt: null, ...dateFilter },
      orderBy: { holdDate: "asc" },
      include: { submitter: { select: { name: true } }, resolver: { select: { name: true } } },
    });
    return res.json({ grouped, records });
  }

  const records = await prisma.pendingTerm.findMany({
    orderBy: { submittedAt: "desc" },
    take: 200,
    where: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
    include: { submitter: { select: { name: true } }, resolver: { select: { name: true } } },
  });
  return res.json(records);
}));

router.delete("/pending-terms/:id", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  await prisma.pendingTerm.delete({ where: { id: pp.data.id } });
  return res.status(204).end();
}));

// ─── Pending Term Resolution ────────────────────────────────────

const resolvePendingTermSchema = z.object({
  resolutionType: z.enum(["saved", "cancelled"]),
  resolutionNote: z.string().min(1).max(2000),
});

router.patch("/pending-terms/:id/resolve", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const parsed = resolvePendingTermSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const record = await prisma.pendingTerm.update({
    where: { id: pp.data.id },
    data: {
      resolvedAt: new Date(),
      resolvedBy: (req as any).user!.id,
      resolutionNote: parsed.data.resolutionNote,
      resolutionType: parsed.data.resolutionType,
    },
  });
  emitCSChanged({ type: "pending_term", batchId: "resolution", count: 1 });
  return res.json(record);
}));

router.patch("/pending-terms/:id/unresolve", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const record = await prisma.pendingTerm.update({
    where: { id: pp.data.id },
    data: {
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
      resolutionType: null,
    },
  });
  return res.json(record);
}));

export default router;
