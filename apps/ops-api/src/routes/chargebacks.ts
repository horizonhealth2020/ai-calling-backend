import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createAlertFromChargeback } from "../services/alerts";
import { emitCSChanged } from "../socket";
import { getSundayWeekRange, findOldestOpenPeriodForAgent, calculatePerProductCommission } from "../services/payroll";
import { logAudit } from "../services/audit";
import { zodErr, asyncHandler, dateRange, dateRangeQuerySchema, idParamSchema } from "./helpers";
import { matchChargebacksToSales } from "../services/chargebacks";

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
    selectedSaleId: z.string().nullable().optional(),
  })),
  rawPaste: z.string().min(1),
  batchId: z.string().min(1),
});

const previewSchema = z.object({
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
  })),
});

router.post("/chargebacks/preview", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { records } = parsed.data;
  const memberIds = records.map(r => r.memberId).filter(Boolean) as string[];
  const salesByMemberId = await matchChargebacksToSales(memberIds);

  const previews = records.map(record => {
    const matchingSales = record.memberId ? (salesByMemberId.get(record.memberId) || []) : [];
    let matchStatus: "MATCHED" | "MULTIPLE" | "UNMATCHED";
    if (matchingSales.length === 1) matchStatus = "MATCHED";
    else if (matchingSales.length > 1) matchStatus = "MULTIPLE";
    else matchStatus = "UNMATCHED";

    return {
      ...record,
      matchStatus,
      matchedSales: matchingSales.map(sale => ({
        id: sale.id,
        memberName: sale.memberName,
        agentName: sale.agent.name,
        agentId: sale.agentId,
        products: [
          { id: sale.product.id, name: sale.product.name, type: sale.product.type, premium: Number(sale.premium) },
          ...sale.addons.map((a: any) => ({
            id: a.product.id, name: a.product.name, type: a.product.type, premium: Number(a.premium ?? 0),
          })),
        ],
      })),
      selectedSaleId: matchingSales.length === 1 ? matchingSales[0].id : null,
    };
  });

  return res.json({ previews });
}));

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

  // Build selectedSaleId lookup from submitted records (D-03: user-resolved matches)
  const selectedSaleIdByMemberId = new Map<string, string>();
  for (const r of records) {
    if (r.selectedSaleId && r.memberId) {
      selectedSaleIdByMemberId.set(r.memberId, r.selectedSaleId);
    }
  }

  // Auto-match chargebacks to sales by memberId (D-01: exact match only)
  for (const cb of createdChargebacks) {
    // D-03: If frontend provided a selectedSaleId, verify and use it directly
    const userSelectedId = cb.memberId ? selectedSaleIdByMemberId.get(cb.memberId) : undefined;
    if (userSelectedId) {
      const selectedSale = await prisma.sale.findUnique({
        where: { id: userSelectedId },
        select: { id: true, memberId: true },
      });
      if (selectedSale) {
        await prisma.chargebackSubmission.update({
          where: { id: cb.id },
          data: { matchedSaleId: selectedSale.id, matchStatus: "MATCHED" },
        });
        continue;
      }
      // If selectedSaleId not found, fall through to automatic matching
    }

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

  // Create clawbacks for matched chargebacks against agent's oldest open payroll period
  const refreshedChargebacks = await prisma.chargebackSubmission.findMany({
    where: { batchId },
    orderBy: { createdAt: "desc" },
  });

  for (const cb of refreshedChargebacks) {
    if (cb.matchStatus !== "MATCHED" || !cb.matchedSaleId) continue;

    const sale = await prisma.sale.findUnique({
      where: { id: cb.matchedSaleId },
      include: { payrollEntries: true, product: true, addons: { include: { product: true } } },
    });
    if (!sale) continue;

    // Find oldest OPEN payroll period for the agent
    let targetPeriodId = await findOldestOpenPeriodForAgent(sale.agentId);
    if (!targetPeriodId && sale.payrollEntries.length > 0) {
      targetPeriodId = sale.payrollEntries[0].payrollPeriodId;
    }

    const targetEntry = targetPeriodId
      ? sale.payrollEntries.find(e => e.payrollPeriodId === targetPeriodId) ?? sale.payrollEntries[0]
      : sale.payrollEntries[0];

    const chargebackAmount = targetEntry ? Number(targetEntry.netAmount) : Math.abs(Number(cb.chargebackAmount));

    const zeroOut = !targetEntry || targetEntry.status !== "PAID";
    const clawback = await prisma.clawback.create({
      data: {
        saleId: sale.id,
        agentId: sale.agentId,
        matchedBy: cb.memberId ? "member_id" : "member_name",
        matchedValue: cb.memberId || cb.memberCompany || "",
        amount: chargebackAmount,
        status: zeroOut ? "ZEROED" : "DEDUCTED",
        appliedPayrollPeriodId: targetPeriodId || undefined,
        notes: `Batch chargeback (${batchId})`,
      },
    });

    if (targetEntry) {
      await prisma.payrollEntry.update({
        where: { id: targetEntry.id },
        data: zeroOut
          ? { payoutAmount: 0, netAmount: 0, status: "ZEROED_OUT" }
          : { adjustmentAmount: Number(targetEntry.adjustmentAmount) - chargebackAmount, status: "CLAWBACK_APPLIED" },
      });
    }

    await logAudit(req.user!.id, "CREATE", "Clawback", clawback.id, { saleId: sale.id, status: clawback.status, amount: chargebackAmount, batchId });
  }

  // Create payroll alerts for chargebacks with amounts
  for (const cb of refreshedChargebacks) {
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
      resolvedBy: req.user!.id,
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
