import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createAlertFromChargeback } from "../services/alerts";
import { emitCSChanged } from "../socket";
import { getSundayWeekRange } from "../services/payroll";
import { zodErr, asyncHandler, dateRange, dateRangeQuerySchema, idParamSchema } from "./helpers";

const router = Router();

const chargebackSchema = z.object({
  records: z.array(z.object({
    postedDate: z.string().nullable(),
    type: z.string().nullable(),
    payeeId: z.string().nullable(),
    payeeName: z.string().nullable(),
    payoutPercent: z.number().nullable(),
    chargebackAmount: z.number(),
    totalAmount: z.number().nullable(),
    transactionDescription: z.string().nullable(),
    product: z.string().nullable(),
    memberCompany: z.string().nullable(),
    memberId: z.string().nullable(),
    memberAgentCompany: z.string().nullable(),
    memberAgentId: z.string().nullable(),
    assignedTo: z.string().nullable(),
  })),
  rawPaste: z.string().min(1),
  batchId: z.string().min(1),
});

router.post("/chargebacks", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = chargebackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { records, rawPaste, batchId } = parsed.data;
  const result = await prisma.chargebackSubmission.createMany({
    data: records.map((r) => ({
      postedDate: r.postedDate ? new Date(r.postedDate) : null,
      type: r.type,
      payeeId: r.payeeId,
      payeeName: r.payeeName,
      payoutPercent: r.payoutPercent,
      chargebackAmount: r.chargebackAmount,
      totalAmount: r.totalAmount,
      transactionDescription: r.transactionDescription,
      product: r.product,
      memberCompany: r.memberCompany,
      memberId: r.memberId,
      memberAgentCompany: r.memberAgentCompany,
      memberAgentId: r.memberAgentId,
      assignedTo: r.assignedTo,
      submittedBy: req.user!.id,
      batchId,
      rawPaste,
    })),
  });

  // Retrieve created chargebacks for matching and alert creation
  const createdChargebacks = await prisma.chargebackSubmission.findMany({
    where: { batchId },
    orderBy: { createdAt: "desc" },
  });

  // Auto-match chargebacks to sales by memberId (D-01: exact match only)
  for (const cb of createdChargebacks) {
    if (cb.memberId) {
      const matchingSales = await prisma.sale.findMany({
        where: { memberId: cb.memberId },
        select: { id: true },
      });

      if (matchingSales.length === 1) {
        await prisma.chargebackSubmission.update({
          where: { id: cb.id },
          data: { matchedSaleId: matchingSales[0].id, matchStatus: "MATCHED" },
        });
      } else if (matchingSales.length > 1) {
        // D-02: Multiple matches -- flag for manual review, do NOT auto-select
        await prisma.chargebackSubmission.update({
          where: { id: cb.id },
          data: { matchStatus: "MULTIPLE" },
        });
      } else {
        await prisma.chargebackSubmission.update({
          where: { id: cb.id },
          data: { matchStatus: "UNMATCHED" },
        });
      }
    } else {
      await prisma.chargebackSubmission.update({
        where: { id: cb.id },
        data: { matchStatus: "UNMATCHED" },
      });
    }
  }

  // Create payroll alerts for chargebacks with amounts
  for (const cb of createdChargebacks) {
    if (cb.chargebackAmount) {
      await createAlertFromChargeback(
        cb.id,
        cb.memberAgentId || cb.memberAgentCompany || undefined,
        cb.memberCompany || cb.memberId || undefined,
        cb.chargebackAmount ? Number(cb.chargebackAmount) : undefined,
      );
    }
  }

  // Emit CS changed event for real-time updates
  emitCSChanged({ type: "chargeback", batchId, count: result.count });

  return res.status(201).json({ count: result.count, batchId });
}));

router.delete("/chargebacks/:id", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const id = pp.data.id;
  // Delete related alerts first (FK constraint)
  await prisma.payrollAlert.deleteMany({ where: { chargebackSubmissionId: id } });
  await prisma.chargebackSubmission.delete({ where: { id } });
  return res.status(204).end();
}));

// ─── Chargeback Resolution ──────────────────────────────────────

const resolveChargebackSchema = z.object({
  resolutionType: z.enum(["recovered", "closed"]),
  resolutionNote: z.string().min(1).max(2000),
});

router.patch("/chargebacks/:id/resolve", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const parsed = resolveChargebackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const record = await prisma.chargebackSubmission.update({
    where: { id: pp.data.id },
    data: {
      resolvedAt: new Date(),
      resolvedBy: (req as any).user!.id,
      resolutionNote: parsed.data.resolutionNote,
      resolutionType: parsed.data.resolutionType,
    },
  });
  emitCSChanged({ type: "chargeback", batchId: "resolution", count: 1 });
  return res.json(record);
}));

router.patch("/chargebacks/:id/unresolve", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const record = await prisma.chargebackSubmission.update({
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

router.get("/chargebacks", requireAuth, asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const records = await prisma.chargebackSubmission.findMany({
    orderBy: { submittedAt: "desc" },
    take: 200,
    where: dr ? { createdAt: { gte: dr.gte, lt: dr.lt } } : undefined,
    include: {
      submitter: { select: { name: true } },
      resolver: { select: { name: true } },
      matchedSale: { select: { id: true, memberName: true, agentId: true } },
    },
  });
  return res.json(records);
}));

router.get("/chargebacks/weekly-total", requireAuth, asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  let gte: Date, lt: Date, wsIso: string, weIso: string;
  if (dr) {
    gte = dr.gte;
    lt = dr.lt;
    wsIso = gte.toISOString();
    weIso = lt.toISOString();
  } else {
    const { weekStart, weekEnd } = getSundayWeekRange(new Date());
    const nextSunday = new Date(weekEnd);
    nextSunday.setDate(nextSunday.getDate() + 1);
    gte = weekStart;
    lt = nextSunday;
    wsIso = weekStart.toISOString();
    weIso = weekEnd.toISOString();
  }

  const result = await prisma.chargebackSubmission.aggregate({
    _sum: { chargebackAmount: true },
    _count: { id: true },
    where: { submittedAt: { gte, lt } },
  });

  return res.json({
    total: result._sum.chargebackAmount ?? 0,
    count: result._count.id,
    weekStart: wsIso,
    weekEnd: weIso,
  });
}));

router.get("/chargebacks/totals", requireAuth, asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const dateFilter = dr ? { createdAt: { gte: dr.gte, lt: dr.lt } } : {};
  const [totalResult, recoveredResult] = await Promise.all([
    prisma.chargebackSubmission.aggregate({
      _sum: { chargebackAmount: true },
      _count: { id: true },
      where: dateFilter,
    }),
    prisma.chargebackSubmission.aggregate({
      _sum: { chargebackAmount: true },
      where: { ...dateFilter, resolutionType: "recovered" },
    }),
  ]);
  return res.json({
    totalChargebacks: totalResult._sum.chargebackAmount ? Math.abs(Number(totalResult._sum.chargebackAmount)) : 0,
    totalRecovered: recoveredResult._sum?.chargebackAmount ? Math.abs(Number(recoveredResult._sum.chargebackAmount)) : 0,
    recordCount: totalResult._count.id,
  });
}));

export default router;
