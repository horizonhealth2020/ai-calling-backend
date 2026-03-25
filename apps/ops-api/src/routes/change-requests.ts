import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { upsertPayrollEntryForSale, handleSaleEditApproval } from "../services/payroll";
import { logAudit } from "../services/audit";
import { emitSaleChanged } from "../socket";
import { asyncHandler, zodErr, idParamSchema } from "./helpers";

const router = Router();

// ── Status Change Requests (approval workflow) ─────────────────
const statusQuerySchema = z.object({ status: z.string().optional().default("PENDING") });

router.get("/status-change-requests", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const qp = statusQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const status = qp.data.status;
  const requests = await prisma.statusChangeRequest.findMany({
    where: { status: status as any },
    include: {
      sale: { include: { agent: true, product: true } },
      requester: { select: { name: true, email: true } },
    },
    orderBy: { requestedAt: "asc" },
  });
  res.json(requests);
}));

router.post("/status-change-requests/:id/approve", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const changeRequest = await prisma.statusChangeRequest.findUnique({ where: { id: pp.data.id } });
  if (!changeRequest) return res.status(404).json({ error: "Change request not found" });
  if (changeRequest.status !== "PENDING") return res.status(400).json({ error: "Change request is not pending" });

  const updated = await prisma.$transaction(async (tx) => {
    const cr = await tx.statusChangeRequest.update({
      where: { id: changeRequest.id },
      data: { status: "APPROVED", reviewedBy: req.user!.id, reviewedAt: new Date() },
    });
    await tx.sale.update({
      where: { id: changeRequest.saleId },
      data: { status: changeRequest.newStatus },
    });
    return cr;
  });

  await upsertPayrollEntryForSale(changeRequest.saleId);
  await logAudit(req.user!.id, "APPROVE_STATUS_CHANGE", "StatusChangeRequest", changeRequest.id, {
    saleId: changeRequest.saleId, oldStatus: changeRequest.oldStatus, newStatus: changeRequest.newStatus,
  });

  // Emit sale:changed for Dead/Declined -> Ran transitions (appears as new sale on boards)
  if (changeRequest.newStatus === "RAN" && changeRequest.oldStatus !== "RAN") {
    try {
      const fullSale = await prisma.sale.findUnique({
        where: { id: changeRequest.saleId },
        include: {
          agent: { select: { id: true, name: true } },
          product: { select: { id: true, name: true, type: true } },
          addons: { include: { product: { select: { id: true, name: true, type: true } } } },
        },
      });
      const payrollEntries = await prisma.payrollEntry.findMany({
        where: { saleId: changeRequest.saleId },
        include: { period: { select: { id: true, weekStart: true, weekEnd: true } } },
      });
      if (fullSale) {
        emitSaleChanged({
          type: "status_changed",
          sale: {
            id: fullSale.id,
            saleDate: fullSale.saleDate.toISOString(),
            memberName: fullSale.memberName,
            memberId: fullSale.memberId ?? undefined,
            carrier: fullSale.carrier,
            premium: Number(fullSale.premium),
            enrollmentFee: fullSale.enrollmentFee != null ? Number(fullSale.enrollmentFee) : null,
            status: fullSale.status,
            agent: { id: fullSale.agent.id, name: fullSale.agent.name },
            product: { id: fullSale.product.id, name: fullSale.product.name, type: fullSale.product.type },
            addons: fullSale.addons?.map((a: any) => ({ product: { id: a.product.id, name: a.product.name, type: a.product.type } })),
          },
          payrollEntries: payrollEntries.map((e: any) => ({
            id: e.id,
            payoutAmount: Number(e.payoutAmount),
            adjustmentAmount: Number(e.adjustmentAmount),
            bonusAmount: Number(e.bonusAmount),
            frontedAmount: Number(e.frontedAmount),
            holdAmount: Number(e.holdAmount),
            netAmount: Number(e.netAmount),
            status: e.status,
            periodId: e.period.id,
            periodWeekStart: e.period.weekStart.toISOString(),
            periodWeekEnd: e.period.weekEnd.toISOString(),
          })),
        });
      }
    } catch (emitErr) {
      console.error("Socket emit failed for status change", changeRequest.id, emitErr);
    }
  }

  const result = await prisma.statusChangeRequest.findUnique({
    where: { id: updated.id },
    include: { sale: { include: { agent: true, product: true } } },
  });
  res.json(result);
}));

router.post("/status-change-requests/:id/reject", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const changeRequest = await prisma.statusChangeRequest.findUnique({ where: { id: pp.data.id } });
  if (!changeRequest) return res.status(404).json({ error: "Change request not found" });
  if (changeRequest.status !== "PENDING") return res.status(400).json({ error: "Change request is not pending" });

  const updated = await prisma.statusChangeRequest.update({
    where: { id: changeRequest.id },
    data: { status: "REJECTED", reviewedBy: req.user!.id, reviewedAt: new Date() },
  });

  await logAudit(req.user!.id, "REJECT_STATUS_CHANGE", "StatusChangeRequest", changeRequest.id, {
    saleId: changeRequest.saleId,
  });
  res.json(updated);
}));

// ── Sale Edit Requests (approval workflow) ──────────────────────
router.get("/sale-edit-requests", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const qp = statusQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const status = qp.data.status;
  const requests = await prisma.saleEditRequest.findMany({
    where: { status: status as any },
    include: {
      sale: { include: { agent: true, product: true } },
      requester: { select: { name: true, email: true } },
    },
    orderBy: { requestedAt: "asc" },
  });
  res.json(requests);
}));

router.post("/sale-edit-requests/:id/approve", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const editRequest = await prisma.saleEditRequest.findUnique({
    where: { id: pp.data.id },
    include: { sale: true },
  });
  if (!editRequest) return res.status(404).json({ error: "Edit request not found" });
  if (editRequest.status !== "PENDING") return res.status(400).json({ error: "Edit request is not pending" });

  const changes = editRequest.changes as Record<string, { old: any; new: any }>;
  const saleId = editRequest.saleId;
  const oldAgentId = editRequest.sale.agentId;

  // Build sale update data from changes
  const saleUpdateData: any = {};
  const dateFields = ['saleDate', 'effectiveDate'];
  for (const [field, diff] of Object.entries(changes)) {
    if (field === 'addonProductIds' || field === 'addonPremiums') continue;
    if (dateFields.includes(field)) {
      saleUpdateData[field] = new Date(diff.new + "T12:00:00");
    } else {
      saleUpdateData[field] = diff.new;
    }
  }

  await prisma.$transaction(async (tx) => {
    // Update the edit request status
    await tx.saleEditRequest.update({
      where: { id: editRequest.id },
      data: { status: "APPROVED", reviewedBy: req.user!.id, reviewedAt: new Date() },
    });

    // Apply sale field changes
    if (Object.keys(saleUpdateData).length > 0) {
      await tx.sale.update({ where: { id: saleId }, data: saleUpdateData });
    }

    // Handle addon changes
    if (changes.addonProductIds) {
      await tx.saleAddon.deleteMany({ where: { saleId } });
      const newAddonIds: string[] = changes.addonProductIds.new;
      const addonPremiums: Record<string, number> = changes.addonPremiums?.new ?? {};
      const uniqueIds = [...new Set(newAddonIds)];
      if (uniqueIds.length > 0) {
        await tx.saleAddon.createMany({
          data: uniqueIds.map(productId => ({
            saleId, productId, premium: addonPremiums[productId] ?? null,
          })),
        });
      }
    }
  });

  // Check if sale is in a finalized period and handle accordingly
  const existingEntries = await prisma.payrollEntry.findMany({
    where: { saleId },
    include: { payrollPeriod: true },
  });
  const hasFinalizedEntry = existingEntries.some(e =>
    e.payrollPeriod.status === 'FINALIZED' || e.payrollPeriod.status === 'LOCKED'
  );

  if (hasFinalizedEntry) {
    await handleSaleEditApproval(saleId, changes, changes.agentId ? oldAgentId : undefined);
  } else {
    await upsertPayrollEntryForSale(saleId);
  }

  await logAudit(req.user!.id, "APPROVE_SALE_EDIT", "SaleEditRequest", editRequest.id, {
    saleId, changes,
  });

  const result = await prisma.saleEditRequest.findUnique({
    where: { id: editRequest.id },
    include: { sale: { include: { agent: true, product: true } } },
  });
  res.json(result);
}));

router.post("/sale-edit-requests/:id/reject", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const editRequest = await prisma.saleEditRequest.findUnique({ where: { id: pp.data.id } });
  if (!editRequest) return res.status(404).json({ error: "Edit request not found" });
  if (editRequest.status !== "PENDING") return res.status(400).json({ error: "Edit request is not pending" });

  const updated = await prisma.saleEditRequest.update({
    where: { id: editRequest.id },
    data: { status: "REJECTED", reviewedBy: req.user!.id, reviewedAt: new Date() },
  });

  await logAudit(req.user!.id, "REJECT_SALE_EDIT", "SaleEditRequest", editRequest.id, {
    saleId: editRequest.saleId,
  });
  res.json(updated);
}));

export default router;
