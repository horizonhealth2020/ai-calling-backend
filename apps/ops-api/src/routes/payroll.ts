import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { zodErr, asyncHandler } from "./helpers";

const router = Router();

router.get("/payroll/periods", requireAuth, requireRole("PAYROLL", "MANAGER", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  res.json(await prisma.payrollPeriod.findMany({
    include: {
      entries: {
        include: {
          sale: { select: { id: true, memberName: true, memberId: true, carrier: true, premium: true, enrollmentFee: true, commissionApproved: true, status: true, notes: true, product: { select: { id: true, name: true, type: true } }, addons: { select: { productId: true, premium: true, product: { select: { id: true, name: true, type: true } } } } } },
          agent: { select: { name: true } },
        },
      },
      serviceEntries: {
        include: {
          serviceAgent: { select: { name: true, basePay: true } },
        },
      },
    },
    orderBy: { weekStart: "desc" },
  }));
}));

// ── Toggle period status (OPEN ↔ LOCKED) ───────────────────────
router.patch("/payroll/periods/:id/status", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ status: z.enum(["OPEN", "LOCKED"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const period = await prisma.payrollPeriod.findUnique({ where: { id: req.params.id } });
  if (!period) return res.status(404).json({ error: "Period not found" });
  if (period.status === "FINALIZED") return res.status(400).json({ error: "Finalized periods cannot be changed" });
  const updated = await prisma.payrollPeriod.update({ where: { id: req.params.id }, data: { status: parsed.data.status } });
  await logAudit(req.user!.id, "UPDATE", "PayrollPeriod", req.params.id, { status: parsed.data.status });
  res.json(updated);
}));

router.delete("/payroll/periods/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { entries: true, serviceEntries: true } } },
  });
  if (!period) return res.status(404).json({ error: "Period not found" });

  // Delete entries first, then the period
  await prisma.payrollEntry.deleteMany({ where: { payrollPeriodId: req.params.id } });
  await prisma.servicePayrollEntry.deleteMany({ where: { payrollPeriodId: req.params.id } });
  await prisma.payrollPeriod.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.id, "HARD_DELETE", "PayrollPeriod", req.params.id, {
    weekStart: period.weekStart, weekEnd: period.weekEnd,
    entriesDeleted: period._count.entries, serviceEntriesDeleted: period._count.serviceEntries,
  });
  return res.status(204).end();
}));

router.post("/payroll/mark-paid", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed = z.object({
    entryIds: z.array(z.string()).optional().default([]),
    serviceEntryIds: z.array(z.string()).optional().default([]),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { entryIds, serviceEntryIds } = parsed.data;

  if (entryIds.length === 0 && serviceEntryIds.length === 0) {
    return res.status(400).json({ error: "No entry IDs provided" });
  }

  if (entryIds.length > 0) {
    await prisma.payrollEntry.updateMany({
      where: { id: { in: entryIds }, status: { not: "ZEROED_OUT" } },
      data: { status: "PAID", paidAt: new Date() },
    });
  }

  if (serviceEntryIds.length > 0) {
    await prisma.servicePayrollEntry.updateMany({
      where: { id: { in: serviceEntryIds } },
      data: { status: "PAID", paidAt: new Date() },
    });
  }

  await logAudit(req.user!.id, "MARK_PAID", "PayrollEntry", entryIds.concat(serviceEntryIds).join(","));

  res.json({ ok: true });
}));

router.post("/payroll/mark-unpaid", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed2 = z.object({
    entryIds: z.array(z.string()).optional().default([]),
    serviceEntryIds: z.array(z.string()).optional().default([]),
  }).safeParse(req.body);
  if (!parsed2.success) return res.status(400).json(zodErr(parsed2.error));
  const { entryIds, serviceEntryIds } = parsed2.data;

  if (entryIds.length === 0 && serviceEntryIds.length === 0) {
    return res.status(400).json({ error: "No entry IDs provided" });
  }

  // Guard: only allow un-pay for entries in OPEN periods
  if (entryIds.length > 0) {
    const entries = await prisma.payrollEntry.findMany({
      where: { id: { in: entryIds } },
      include: { payrollPeriod: { select: { status: true, id: true } } },
    });
    const nonOpen = entries.filter(e => e.payrollPeriod.status !== "OPEN");
    if (nonOpen.length > 0) {
      return res.status(400).json({
        error: "Cannot un-pay entries in LOCKED or FINALIZED periods. Only entries in OPEN periods can be marked unpaid."
      });
    }
  }
  if (serviceEntryIds.length > 0) {
    const serviceEntries = await prisma.servicePayrollEntry.findMany({
      where: { id: { in: serviceEntryIds } },
      include: { payrollPeriod: { select: { status: true, id: true } } },
    });
    const nonOpen = serviceEntries.filter(e => e.payrollPeriod.status !== "OPEN");
    if (nonOpen.length > 0) {
      return res.status(400).json({
        error: "Cannot un-pay service entries in LOCKED or FINALIZED periods. Only entries in OPEN periods can be marked unpaid."
      });
    }
  }

  if (entryIds.length > 0) {
    await prisma.payrollEntry.updateMany({
      where: { id: { in: entryIds }, status: "PAID" },
      data: { status: "READY", paidAt: null },
    });
  }

  if (serviceEntryIds.length > 0) {
    await prisma.servicePayrollEntry.updateMany({
      where: { id: { in: serviceEntryIds }, status: "PAID" },
      data: { status: "READY", paidAt: null },
    });
  }

  await logAudit(req.user!.id, "MARK_UNPAID", "PayrollEntry", entryIds.concat(serviceEntryIds).join(","));

  res.json({ ok: true });
}));

router.post("/clawbacks", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed3 = z.object({ memberId: z.string().optional(), memberName: z.string().optional(), notes: z.string().optional() }).safeParse(req.body);
  if (!parsed3.success) return res.status(400).json(zodErr(parsed3.error));
  const payload = parsed3.data;
  const sale = payload.memberId
    ? await prisma.sale.findFirst({ where: { memberId: payload.memberId }, include: { payrollEntries: true } })
    : await prisma.sale.findFirst({ where: { memberName: payload.memberName }, include: { payrollEntries: true } });
  if (!sale) return res.status(404).json({ error: "Matching sale not found" });

  const lastEntry = sale.payrollEntries[0];
  const zeroOut = !lastEntry || lastEntry.status !== "PAID";
  const clawback = await prisma.clawback.create({
    data: {
      saleId: sale.id,
      agentId: sale.agentId,
      matchedBy: payload.memberId ? "member_id" : "member_name",
      matchedValue: payload.memberId || payload.memberName || "",
      amount: lastEntry?.netAmount || 0,
      status: zeroOut ? "ZEROED" : "DEDUCTED",
      notes: payload.notes,
    },
  });
  if (lastEntry) {
    await prisma.payrollEntry.update({
      where: { id: lastEntry.id },
      data: zeroOut
        ? { payoutAmount: 0, netAmount: 0, status: "ZEROED_OUT" }
        : { adjustmentAmount: Number(lastEntry.adjustmentAmount) - Number(lastEntry.netAmount), status: "CLAWBACK_APPLIED" },
    });
  }
  await logAudit(req.user!.id, "CREATE", "Clawback", clawback.id, { saleId: sale.id, status: clawback.status, amount: Number(clawback.amount) });
  res.status(201).json(clawback);
}));

// ── Payroll Entry adjustments (bonus / fronted) ─────────────────
router.patch("/payroll/entries/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    bonusAmount: z.number().min(0).optional(),
    frontedAmount: z.number().min(0).optional(),
    holdAmount: z.number().min(0).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const entry = await prisma.payrollEntry.findUnique({ where: { id: req.params.id } });
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  // Guard: reject edits if this specific entry has already been paid
  if (entry.status === "PAID") {
    return res.status(400).json({ error: "This entry has already been marked paid and cannot be edited" });
  }
  const bonus = parsed.data.bonusAmount ?? Number(entry.bonusAmount);
  const fronted = parsed.data.frontedAmount ?? Number(entry.frontedAmount);
  const hold = parsed.data.holdAmount ?? Number(entry.holdAmount);
  const net = Number(entry.payoutAmount) + Number(entry.adjustmentAmount) + bonus - fronted - hold;
  const updated = await prisma.payrollEntry.update({
    where: { id: req.params.id },
    data: { bonusAmount: bonus, frontedAmount: fronted, holdAmount: hold, netAmount: net },
    include: { sale: { select: { id: true, memberName: true, memberId: true, enrollmentFee: true, commissionApproved: true, product: { select: { name: true, type: true } } } }, agent: { select: { name: true } } },
  });
  await logAudit(req.user!.id, "UPDATE", "PayrollEntry", req.params.id, { bonusAmount: bonus, frontedAmount: fronted, holdAmount: hold, netAmount: net });
  res.json(updated);
}));

export default router;
