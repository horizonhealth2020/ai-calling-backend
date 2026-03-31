import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { upsertPayrollEntryForSale, handleCommissionZeroing, calculateCommission, getSundayWeekRange, resolveBundleRequirement } from "../services/payroll";
import { logAudit } from "../services/audit";
import { emitSaleChanged } from "../socket";
import { shiftRange } from "../services/reporting";
import { zodErr, asyncHandler, dateRange, dateRangeQuerySchema, idParamSchema } from "./helpers";

const router = Router();

router.post("/sales", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    saleDate: z.string(),
    agentId: z.string(),
    memberName: z.string(),
    memberId: z.string().optional(),
    carrier: z.string().optional().default(""),
    productId: z.string(),
    premium: z.number().min(0),
    effectiveDate: z.string(),
    leadSourceId: z.string(),
    enrollmentFee: z.number().min(0).nullable().optional(),
    addonProductIds: z.array(z.string()).default([]),
    addonPremiums: z.record(z.string(), z.number().min(0)).default({}),
    status: z.enum(["RAN", "DECLINED", "DEAD"]),
    paymentType: z.enum(["CC", "ACH"]),
    memberState: z.string().max(2).optional(),
    leadPhone: z.string().optional(),
    notes: z.string().optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json(zodErr(result.error));
  const parsed = result.data;
  const { addonProductIds, addonPremiums, ...saleData } = parsed;
  const uniqueAddonIds = [...new Set(addonProductIds)];
  const sale = await prisma.sale.create({
    data: {
      ...saleData,
      saleDate: new Date(parsed.saleDate + "T12:00:00"),
      effectiveDate: new Date(parsed.effectiveDate + "T12:00:00"),
      enteredByUserId: req.user!.id,
      addons: uniqueAddonIds.length > 0 ? {
        create: uniqueAddonIds.map(productId => ({ productId, premium: addonPremiums[productId] ?? null })),
      } : undefined,
    },
  });
  try {
    await upsertPayrollEntryForSale(sale.id);
  } catch (err) {
    console.error("Payroll entry failed for sale", sale.id, err);
  }
  // Emit real-time sale:changed event to all connected dashboards
  try {
    const fullSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        agent: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, type: true } },
        addons: { include: { product: { select: { id: true, name: true, type: true } } } },
      },
    });
    const payrollEntries = await prisma.payrollEntry.findMany({
      where: { saleId: sale.id },
      include: { payrollPeriod: { select: { id: true, weekStart: true, weekEnd: true } } },
    });
    if (fullSale) {
      emitSaleChanged({
        type: "created",
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
          addons: fullSale.addons?.map((a) => ({ product: { id: a.product.id, name: a.product.name, type: a.product.type } })),
        },
        payrollEntries: payrollEntries.map((e) => ({
          id: e.id,
          payoutAmount: Number(e.payoutAmount),
          adjustmentAmount: Number(e.adjustmentAmount),
          bonusAmount: Number(e.bonusAmount),
          frontedAmount: Number(e.frontedAmount),
          holdAmount: Number(e.holdAmount),
          netAmount: Number(e.netAmount),
          status: e.status,
          periodId: e.payrollPeriod.id,
          periodWeekStart: e.payrollPeriod.weekStart.toISOString(),
          periodWeekEnd: e.payrollPeriod.weekEnd.toISOString(),
        })),
      });
    }
  } catch (emitErr) {
    console.error("Socket emit failed for sale", sale.id, emitErr);
  }
  // Auto-tag CallAudit records matching this sale (non-fatal)
  try {
    const saleDate = new Date(parsed.saleDate + "T12:00:00");
    await prisma.callAudit.updateMany({
      where: {
        agentId: sale.agentId,
        callDate: {
          gte: new Date(saleDate.getTime() - 86400000),
          lte: new Date(saleDate.getTime() + 86400000),
        },
        status: { in: ["pending", "new"] },
      },
      data: {
        status: "sale_matched",
      },
    });
    if (sale.recordingUrl) {
      await prisma.callAudit.updateMany({
        where: {
          recordingUrl: sale.recordingUrl,
          status: { in: ["pending", "new"] },
        },
        data: { status: "sale_matched" },
      });
    }
    console.log(JSON.stringify({ event: "call_audit_auto_tagged", saleId: sale.id, agentId: sale.agentId }));
  } catch (tagErr) {
    console.error("CallAudit auto-tag failed for sale", sale.id, tagErr);
  }
  res.status(201).json(sale);
}));

// ── ACA PL Sale Entry ─────────────────────────────────────────
router.post("/sales/aca", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    agentId: z.string(),
    memberName: z.string().min(1),
    carrier: z.string().min(1),
    memberCount: z.number().int().min(1),
    productId: z.string(),
    saleDate: z.string().optional(),
    acaCoveringSaleId: z.string().optional(),
    notes: z.string().optional(),
  });
  const result = schema.safeParse(req.body);
  if (!result.success) return res.status(400).json(zodErr(result.error));
  const parsed = result.data;

  // Verify product is ACA_PL type
  const product = await prisma.product.findUnique({ where: { id: parsed.productId } });
  if (!product || product.type !== "ACA_PL") {
    return res.status(400).json({ error: "Product must be ACA_PL type" });
  }

  const saleDateStr = parsed.saleDate || new Date().toISOString().slice(0, 10);
  const sale = await prisma.sale.create({
    data: {
      saleDate: new Date(saleDateStr + "T12:00:00"),
      agentId: parsed.agentId,
      memberName: parsed.memberName,
      carrier: parsed.carrier,
      productId: parsed.productId,
      premium: 0,
      effectiveDate: new Date(saleDateStr + "T12:00:00"),
      leadSourceId: (await prisma.leadSource.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } }))!.id,
      status: "RAN",
      enteredByUserId: req.user!.id,
      memberCount: parsed.memberCount,
      acaCoveringSaleId: parsed.acaCoveringSaleId ?? null,
      notes: parsed.notes ?? null,
    },
  });

  try {
    await upsertPayrollEntryForSale(sale.id);
  } catch (err) {
    console.error("Payroll entry failed for ACA sale", sale.id, err);
  }

  // Emit sale:changed but skip sales board notification for ACA_PL
  try {
    const fullSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        agent: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, type: true } },
      },
    });
    if (fullSale) {
      emitSaleChanged({
        type: "created",
        sale: {
          id: fullSale.id,
          saleDate: fullSale.saleDate.toISOString(),
          memberName: fullSale.memberName,
          memberId: fullSale.memberId ?? undefined,
          carrier: fullSale.carrier,
          premium: 0,
          enrollmentFee: null,
          status: fullSale.status,
          agent: { id: fullSale.agent.id, name: fullSale.agent.name },
          product: { id: fullSale.product.id, name: fullSale.product.name, type: fullSale.product.type },
          addons: [],
        },
        payrollEntries: [],
      });
    }
  } catch (emitErr) {
    console.error("Socket emit failed for ACA sale", sale.id, emitErr);
  }

  // If this ACA sale covers another sale, recalculate that sale's payroll (bundle auto-fulfill)
  if (parsed.acaCoveringSaleId) {
    try {
      await upsertPayrollEntryForSale(parsed.acaCoveringSaleId);
    } catch (err) {
      console.error("Payroll recalc failed for covered sale", parsed.acaCoveringSaleId, err);
    }
  }

  logAudit(
    req.user!.id,
    "aca_sale_created",
    "sale",
    sale.id,
    { agentId: parsed.agentId, memberCount: parsed.memberCount, carrier: parsed.carrier },
  );

  res.status(201).json(sale);
}));

// ── Commission Preview ────────────────────────────────────────
router.post("/sales/preview", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const previewSchema = z.object({
    productId: z.string(),
    premium: z.number().min(0),
    enrollmentFee: z.number().min(0).nullable().optional(),
    addonProductIds: z.array(z.string()).default([]),
    addonPremiums: z.record(z.string(), z.number().min(0)).default({}),
    paymentType: z.enum(["CC", "ACH"]),
    status: z.enum(["RAN", "DECLINED", "DEAD"]).optional().default("RAN"),
    commissionApproved: z.boolean().optional().default(false),
    saleDate: z.string().optional(),
    memberState: z.string().length(2).regex(/^[A-Z]{2}$/).nullable().optional(),
  });
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    include: {
      requiredBundleAddon: { select: { name: true } },
      fallbackAddons: { select: { fallbackProduct: { select: { id: true, name: true } } } },
    },
  });
  if (!product) return res.status(404).json({ error: "Product not found" });

  const uniqueAddonIds = [...new Set(parsed.data.addonProductIds)];
  const addonProducts = uniqueAddonIds.length > 0
    ? await prisma.product.findMany({ where: { id: { in: uniqueAddonIds } } })
    : [];

  const memberState = parsed.data.memberState ?? null;

  const mockSale = {
    premium: parsed.data.premium,
    enrollmentFee: parsed.data.enrollmentFee ?? null,
    commissionApproved: parsed.data.commissionApproved,
    status: parsed.data.status,
    memberState,
    product,
    addons: addonProducts.map(p => ({
      product: p,
      premium: parsed.data.addonPremiums[p.id] ?? 0,
    })),
  };

  // Resolve bundle context if core product has a bundle requirement configured
  const addonProductIds = addonProducts.map(p => p.id);
  const bundleCtx = memberState && product.requiredBundleAddonId
    ? await resolveBundleRequirement(product, memberState, addonProductIds)
    : undefined;

  const result = calculateCommission(mockSale as unknown as Parameters<typeof calculateCommission>[0], bundleCtx ?? undefined);

  const saleDate = parsed.data.saleDate ? new Date(parsed.data.saleDate + "T12:00:00") : new Date();
  const shiftWeeks = parsed.data.paymentType === "ACH" ? 1 : 0;
  const { weekStart, weekEnd } = getSundayWeekRange(saleDate, shiftWeeks);

  const hasCore = product.type === "CORE" || addonProducts.some(p => p.type === "CORE");
  const hasBundleRequirement = !!product.requiredBundleAddonId;

  res.json({
    commission: result.commission,
    halvingReason: result.halvingReason,
    periodStart: weekStart,
    periodEnd: weekEnd,
    breakdown: {
      hasBundleRequirement,
      hasCore,
      enrollmentFee: parsed.data.enrollmentFee ?? null,
      paymentType: parsed.data.paymentType,
      status: parsed.data.status,
    },
  });
}));

router.get("/sales", requireAuth, asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const where = dr ? { saleDate: { gte: dr.gte, lt: dr.lt } } : {};
  const sales = await prisma.sale.findMany({
    where,
    include: {
      agent: true, product: true, leadSource: true,
      addons: { select: { id: true, productId: true, premium: true, product: { select: { id: true, name: true, type: true } } } },
      _count: {
        select: {
          statusChangeRequests: { where: { status: 'PENDING' } },
          saleEditRequests: { where: { status: 'PENDING' } },
        },
      },
    },
    orderBy: { saleDate: "desc" },
  });
  const result = sales.map(({ _count, ...sale }) => ({
    ...sale,
    hasPendingStatusChange: _count.statusChangeRequests > 0,
    hasPendingEditRequest: _count.saleEditRequests > 0,
  }));
  res.json(result);
}));

router.get("/sales/:id", requireAuth, asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const sale = await prisma.sale.findUnique({
    where: { id: pp.data.id },
    include: {
      agent: true, product: true, leadSource: true,
      addons: { include: { product: true } },
      _count: {
        select: {
          statusChangeRequests: { where: { status: 'PENDING' } },
          saleEditRequests: { where: { status: 'PENDING' } },
        },
      },
    },
  });
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  const { _count, ...rest } = sale;
  res.json({
    ...rest,
    hasPendingStatusChange: _count.statusChangeRequests > 0,
    hasPendingEditRequest: _count.saleEditRequests > 0,
  });
}));

// ── Sale Editing (role-aware) ─────────────────────────────────
router.patch("/sales/:id", requireAuth, requireRole("MANAGER", "PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const editSchema = z.object({
    saleDate: z.string().optional(),
    agentId: z.string().optional(),
    memberName: z.string().min(1).optional(),
    memberId: z.string().nullable().optional(),
    carrier: z.string().optional(),
    productId: z.string().optional(),
    premium: z.number().min(0).optional(),
    effectiveDate: z.string().optional(),
    leadSourceId: z.string().optional(),
    enrollmentFee: z.number().min(0).nullable().optional(),
    addonProductIds: z.array(z.string()).optional(),
    addonPremiums: z.record(z.string(), z.number().min(0)).optional(),
    paymentType: z.enum(["CC", "ACH"]).optional(),
    memberState: z.string().max(2).nullable().optional(),
    leadPhone: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    commissionApproved: z.boolean().optional(),
  });
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const saleId = pp.data.id;
  const userRoles: string[] = req.user?.roles ?? [];
  const isPrivileged = userRoles.includes("PAYROLL") || userRoles.includes("SUPER_ADMIN");

  if (isPrivileged) {
    // ── PAYROLL / SUPER_ADMIN: apply directly ──
    const { addonProductIds, addonPremiums, ...saleFields } = parsed.data;
    const updateData: Record<string, unknown> = { ...saleFields };
    if (updateData.saleDate) updateData.saleDate = new Date(updateData.saleDate + "T12:00:00");
    if (updateData.effectiveDate) updateData.effectiveDate = new Date(updateData.effectiveDate + "T12:00:00");

    const oldSale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!oldSale) return res.status(404).json({ error: "Sale not found" });
    const oldAgentId = oldSale.agentId;

    await prisma.$transaction(async (tx) => {
      await tx.sale.update({ where: { id: saleId }, data: updateData });

      if (addonProductIds !== undefined) {
        await tx.saleAddon.deleteMany({ where: { saleId } });
        const uniqueIds = [...new Set(addonProductIds)];
        if (uniqueIds.length > 0) {
          await tx.saleAddon.createMany({
            data: uniqueIds.map(productId => ({
              saleId, productId, premium: addonPremiums?.[productId] ?? null,
            })),
          });
        }
      }
    });

    // If agent changed, delete old payroll entries for old agent
    if (updateData.agentId && updateData.agentId !== oldAgentId) {
      await prisma.payrollEntry.deleteMany({ where: { saleId, agentId: oldAgentId } });
    }

    // Recalculate commission if any financial/product/agent/date/paymentType field changed
    const financialFields = ['premium', 'enrollmentFee', 'productId', 'agentId', 'saleDate', 'effectiveDate', 'paymentType', 'commissionApproved', 'addonProductIds'];
    const needsRecalc = financialFields.some(f => (parsed.data as Record<string, unknown>)[f] !== undefined);
    if (needsRecalc) {
      await upsertPayrollEntryForSale(saleId);
    }

    const updatedSale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { agent: true, product: true, leadSource: true, addons: { include: { product: true } } },
    });
    await logAudit(req.user!.id, "UPDATE", "Sale", saleId, parsed.data);
    res.json(updatedSale);
  } else {
    // ── MANAGER: create SaleEditRequest ──
    // Check for pending StatusChangeRequest
    const pendingStatusChange = await prisma.statusChangeRequest.findFirst({
      where: { saleId, status: "PENDING" },
    });
    if (pendingStatusChange) {
      return res.status(409).json({ error: "This sale has a pending status change. Wait for resolution before editing." });
    }

    // Check for pending SaleEditRequest
    const pendingEdit = await prisma.saleEditRequest.findFirst({
      where: { saleId, status: "PENDING" },
    });
    if (pendingEdit) {
      return res.status(409).json({ error: "This sale already has a pending edit request." });
    }

    // Fetch current sale to build diff
    const currentSale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { product: true, addons: { include: { product: true } } },
    });
    if (!currentSale) return res.status(404).json({ error: "Sale not found" });

    // Build diff: { fieldName: { old: currentValue, new: newValue } }
    const changes: Record<string, { old: unknown; new: unknown }> = {};
    const data = parsed.data;

    const fieldMap: Record<string, (sale: NonNullable<typeof currentSale>) => unknown> = {
      saleDate: s => s.saleDate?.toISOString?.()?.split("T")[0] ?? null,
      agentId: s => s.agentId,
      memberName: s => s.memberName,
      memberId: s => s.memberId,
      carrier: s => s.carrier,
      productId: s => s.productId,
      premium: s => Number(s.premium),
      effectiveDate: s => s.effectiveDate?.toISOString?.()?.split("T")[0] ?? null,
      leadSourceId: s => s.leadSourceId,
      enrollmentFee: s => s.enrollmentFee !== null ? Number(s.enrollmentFee) : null,
      paymentType: s => s.paymentType,
      memberState: s => s.memberState,
      leadPhone: s => s.leadPhone,
      notes: s => s.notes,
      commissionApproved: s => s.commissionApproved,
    };

    for (const [field, getter] of Object.entries(fieldMap)) {
      if ((data as Record<string, unknown>)[field] !== undefined) {
        const oldVal = getter(currentSale);
        const newVal = (data as Record<string, unknown>)[field];
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changes[field] = { old: oldVal, new: newVal };
        }
      }
    }

    // Handle addon changes
    if (data.addonProductIds !== undefined) {
      const oldAddonIds = currentSale.addons.map(a => a.productId).sort();
      const newAddonIds = [...new Set(data.addonProductIds)].sort();
      if (JSON.stringify(oldAddonIds) !== JSON.stringify(newAddonIds)) {
        changes.addonProductIds = { old: oldAddonIds, new: newAddonIds };
      }
    }
    if (data.addonPremiums !== undefined) {
      const oldPremiums: Record<string, number> = {};
      currentSale.addons.forEach(a => { oldPremiums[a.productId] = Number(a.premium ?? 0); });
      changes.addonPremiums = { old: oldPremiums, new: data.addonPremiums };
    }

    if (Object.keys(changes).length === 0) {
      return res.status(400).json({ error: "No changes detected" });
    }

    const editRequest = await prisma.saleEditRequest.create({
      data: {
        saleId,
        requestedBy: req.user!.id,
        changes: JSON.parse(JSON.stringify(changes)),
      },
    });

    res.json({ editRequest, message: "Edit request created for payroll approval" });
  }
}));

router.delete("/sales/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const saleId = pp.data.id;
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { id: true, memberName: true, agentId: true, premium: true } });
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  await prisma.$transaction([
    prisma.saleAddon.deleteMany({ where: { saleId } }),
    prisma.clawback.deleteMany({ where: { saleId } }),
    prisma.payrollEntry.deleteMany({ where: { saleId } }),
    prisma.statusChangeRequest.deleteMany({ where: { saleId } }),
    prisma.saleEditRequest.deleteMany({ where: { saleId } }),
    prisma.sale.delete({ where: { id: saleId } }),
  ]);
  await logAudit(req.user!.id, "DELETE", "Sale", saleId, { memberName: sale.memberName, agentId: sale.agentId, premium: Number(sale.premium) });
  return res.status(204).end();
}));

// ── Sale Status Change ──────────────────────────────────────────
router.patch("/sales/:id/status", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const schema = z.object({ status: z.enum(["RAN", "DECLINED", "DEAD"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const sale = await prisma.sale.findUnique({ where: { id: pp.data.id } });
  if (!sale) return res.status(404).json({ error: "Sale not found" });

  const oldStatus = sale.status;
  const newStatus = parsed.data.status;

  // No-op if same status
  if (oldStatus === newStatus) return res.json(sale);

  // Dead/Declined -> Ran: requires approval workflow
  if ((oldStatus === "DEAD" || oldStatus === "DECLINED") && newStatus === "RAN") {
    const result = await prisma.$transaction(async (tx) => {
      // Check for existing PENDING change request
      const existing = await tx.statusChangeRequest.findFirst({
        where: { saleId: sale.id, status: "PENDING" },
      });
      if (existing) return { conflict: true };

      const changeRequest = await tx.statusChangeRequest.create({
        data: {
          saleId: sale.id,
          requestedBy: req.user!.id,
          oldStatus,
          newStatus,
        },
      });
      return { conflict: false, changeRequest };
    });

    if (result.conflict) {
      return res.status(409).json({ error: "A pending change request already exists for this sale" });
    }

    await logAudit(req.user!.id, "REQUEST_STATUS_CHANGE", "Sale", sale.id, { oldStatus, newStatus });
    return res.json({ changeRequest: result.changeRequest, message: "Change request created for payroll approval" });
  }

  // Ran -> Dead/Declined: immediate with commission zeroing
  if (oldStatus === "RAN" && (newStatus === "DEAD" || newStatus === "DECLINED")) {
    // Cancel any pending change request to prevent orphans
    await prisma.statusChangeRequest.updateMany({
      where: { saleId: sale.id, status: "PENDING" },
      data: { status: "REJECTED", reviewedBy: req.user!.id, reviewedAt: new Date() },
    });

    const updated = await prisma.sale.update({
      where: { id: sale.id },
      data: { status: newStatus },
      include: { agent: true, product: true, leadSource: true },
    });
    await handleCommissionZeroing(sale.id);
    await logAudit(req.user!.id, "UPDATE_STATUS", "Sale", sale.id, { oldStatus, newStatus });
    return res.json(updated);
  }

  // Dead <-> Declined: free transition, no commission impact
  const updated = await prisma.sale.update({
    where: { id: sale.id },
    data: { status: newStatus },
    include: { agent: true, product: true, leadSource: true },
  });
  await logAudit(req.user!.id, "UPDATE_STATUS", "Sale", sale.id, { oldStatus, newStatus });
  return res.json(updated);
}));

router.patch("/sales/:id/approve-commission", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const schema = z.object({ approved: z.boolean().default(true) });
  const parsed = schema.safeParse(req.body);
  const approved = parsed.success ? parsed.data.approved : true;
  const sale = await prisma.sale.update({
    where: { id: pp.data.id },
    data: { commissionApproved: approved },
  });
  await upsertPayrollEntryForSale(sale.id);
  await logAudit(req.user!.id, approved ? "APPROVE_COMMISSION" : "REVOKE_COMMISSION", "Sale", sale.id);
  res.json(sale);
}));

router.patch("/sales/:id/unapprove-commission", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const sale = await prisma.sale.update({
    where: { id: pp.data.id },
    data: { commissionApproved: false },
  });
  await upsertPayrollEntryForSale(sale.id);
  await logAudit(req.user!.id, "UNAPPROVE_COMMISSION", "Sale", sale.id);
  res.json(sale);
}));

router.get("/tracker/summary", requireAuth, asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const salesWhere = dr ? { saleDate: { gte: dr.gte, lt: dr.lt }, product: { type: { not: 'ACA_PL' as const } } } : { product: { type: { not: 'ACA_PL' as const } } };
  const callWhere: { agentId: { not: null }; leadSourceId: { not: null }; callTimestamp?: { gte: Date; lt: Date } } = { agentId: { not: null }, leadSourceId: { not: null } };
  if (dr) callWhere.callTimestamp = { gte: dr.gte, lt: dr.lt };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todaySalesWhere = { saleDate: { gte: todayStart, lt: todayEnd }, product: { type: { not: 'ACA_PL' as const } } };

  // Fetch agents with sales, call logs, and commission totals in parallel
  const [data, allLeadSources, callLogs, commissionByAgent, todayData] = await Promise.all([
    prisma.agent.findMany({
      where: { active: true },
      include: { sales: { where: salesWhere, include: { addons: { select: { premium: true } } } } },
    }),
    prisma.leadSource.findMany({ select: { id: true, costPerLead: true, callBufferSeconds: true } }),
    prisma.convosoCallLog.findMany({ where: callWhere, select: { agentId: true, leadSourceId: true, callDurationSeconds: true } }),
    prisma.payrollEntry.groupBy({
      by: ['agentId'],
      _sum: { payoutAmount: true },
      where: {
        sale: {
          status: 'RAN',
          ...(dr ? { saleDate: { gte: dr.gte, lt: dr.lt } } : {}),
        },
      },
    }),
    prisma.agent.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        sales: {
          where: todaySalesWhere,
          select: { premium: true, addons: { select: { premium: true } } },
        },
      },
    }),
  ]);
  const commMap = new Map(commissionByAgent.map(c => [c.agentId, Number(c._sum.payoutAmount ?? 0)]));

  // Build today map
  const todayMap = new Map<string, { salesCount: number; premiumTotal: number }>();
  for (const agent of todayData) {
    const salesCount = agent.sales.length;
    const premiumTotal = agent.sales.reduce((sum, s) => sum + Number(s.premium ?? 0) + (s.addons?.reduce((aSum: number, a) => aSum + Number(a.premium ?? 0), 0) ?? 0), 0);
    todayMap.set(agent.name, { salesCount, premiumTotal });
  }

  // Build lead source lookup
  const lsMap = new Map(allLeadSources.map(ls => [ls.id, { costPerLead: Number(ls.costPerLead), callBufferSeconds: ls.callBufferSeconds }]));

  // Aggregate lead cost per agent from Convoso call logs (applying buffer filter)
  const agentLeadCost = new Map<string, number>();
  for (const log of callLogs) {
    if (!log.agentId || !log.leadSourceId) continue;
    const ls = lsMap.get(log.leadSourceId);
    if (!ls) continue;
    if (ls.callBufferSeconds > 0 && (log.callDurationSeconds ?? 0) < ls.callBufferSeconds) continue;
    agentLeadCost.set(log.agentId, (agentLeadCost.get(log.agentId) ?? 0) + ls.costPerLead);
  }

  const summary = data.map((agent) => {
    const salesCount = agent.sales.length;
    const premiumTotal = agent.sales.reduce((sum, s) => sum + Number(s.premium ?? 0) + (s.addons?.reduce((aSum: number, a) => aSum + Number(a.premium ?? 0), 0) ?? 0), 0);
    const totalLeadCost = agentLeadCost.get(agent.id) ?? 0;
    const today = todayMap.get(agent.name) ?? { salesCount: 0, premiumTotal: 0 };
    return {
      agent: agent.name,
      salesCount,
      premiumTotal,
      totalLeadCost,
      costPerSale: salesCount > 0 ? totalLeadCost / salesCount : 0,
      commissionTotal: commMap.get(agent.id) ?? 0,
      todaySalesCount: today.salesCount,
      todayPremium: today.premiumTotal,
    };
  });
  const convosoConfigured = !!process.env.CONVOSO_AUTH_TOKEN;
  res.json({ agents: summary, convosoConfigured });
}));

router.get("/owner/summary", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);

  async function fetchSummaryData(range: { gte: Date; lt: Date } | undefined) {
    const saleWhere = range ? { status: 'RAN' as const, saleDate: { gte: range.gte, lt: range.lt } } : { status: 'RAN' as const };
    const clawbackWhere = range ? { createdAt: { gte: range.gte, lt: range.lt } } : {};
    const [salesCount, salesForPremium, clawbacks, openPayrollPeriods] = await Promise.all([
      prisma.sale.count({ where: saleWhere }),
      prisma.sale.findMany({ where: saleWhere, select: { premium: true, addons: { select: { premium: true } } } }),
      prisma.clawback.count({ where: clawbackWhere }),
      prisma.payrollPeriod.count({ where: { status: "OPEN" } }),
    ]);
    const premiumTotal = salesForPremium.reduce((sum: number, s) => sum + Number(s.premium ?? 0) + (s.addons?.reduce((aSum: number, a) => aSum + Number(a.premium ?? 0), 0) ?? 0), 0);
    return { salesCount, premiumTotal, clawbacks, openPayrollPeriods };
  }

  const priorWeekDr = dr ? shiftRange(dr, 7) : undefined;
  const priorMonthDr = dr ? shiftRange(dr, 30) : undefined;

  const [current, priorWeek, priorMonth] = await Promise.all([
    fetchSummaryData(dr),
    fetchSummaryData(priorWeekDr),
    fetchSummaryData(priorMonthDr),
  ]);

  const trends = dr ? {
    salesCount: { priorWeek: priorWeek.salesCount, priorMonth: priorMonth.salesCount },
    premiumTotal: { priorWeek: priorWeek.premiumTotal, priorMonth: priorMonth.premiumTotal },
    clawbacks: { priorWeek: priorWeek.clawbacks, priorMonth: priorMonth.clawbacks },
  } : null;

  const convosoConfigured = !!process.env.CONVOSO_AUTH_TOKEN;
  res.json({ ...current, trends, convosoConfigured });
}));

router.get("/reporting/periods", requireAuth, requireRole("MANAGER", "OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const viewQuery = z.object({ view: z.enum(["weekly", "monthly"]).optional() }).safeParse(req.query);
  const view = viewQuery.success && viewQuery.data.view === "monthly" ? "monthly" : "weekly";

  if (view === "weekly") {
    const periods = await prisma.payrollPeriod.findMany({
      include: {
        entries: {
          include: { sale: { select: { premium: true, status: true, addons: { select: { premium: true } } } } },
        },
        serviceEntries: {
          select: { totalPay: true },
        },
      },
      orderBy: { weekStart: "desc" },
      take: 12,
    });
    const result = periods.map(p => {
      const ranEntries = p.entries.filter(e => e.sale?.status === 'RAN');
      const csPayrollTotal = p.serviceEntries.reduce(
        (sum: number, se) => sum + Number(se.totalPay), 0
      );
      return {
        period: `${p.weekStart.toISOString().slice(0, 10)} - ${p.weekEnd.toISOString().slice(0, 10)}`,
        salesCount: ranEntries.length,
        premiumTotal: ranEntries.reduce((s, e) => s + Number(e.sale?.premium ?? 0) + (e.sale?.addons?.reduce((aSum: number, a) => aSum + Number(a.premium ?? 0), 0) ?? 0), 0),
        commissionPaid: ranEntries.reduce((s, e) => s + Number(e.netAmount), 0),
        csPayrollTotal,
        periodStatus: p.status,
      };
    });
    return res.json({ view, periods: result });
  }

  // Monthly: raw SQL for calendar month grouping
  const monthlySales = await prisma.$queryRaw`
    SELECT
      TO_CHAR(s.sale_date, 'YYYY-MM') as period,
      COUNT(DISTINCT s.id)::int as "salesCount",
      COALESCE(SUM(s.premium), 0)::float + COALESCE(SUM(sa.premium), 0)::float as "premiumTotal",
      COALESCE(SUM(pe.net_amount), 0)::float as "commissionPaid"
    FROM sales s
    LEFT JOIN payroll_entries pe ON pe.sale_id = s.id
    LEFT JOIN sale_addons sa ON sa.sale_id = s.id
    WHERE s.status = 'RAN'
    GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
    ORDER BY period DESC
    LIMIT 6
  `;
  const monthlyCSPayroll: { period: string; csPayrollTotal: number }[] = await prisma.$queryRaw`
    SELECT
      TO_CHAR(pp.week_start, 'YYYY-MM') as period,
      COALESCE(SUM(spe.total_pay), 0)::float as "csPayrollTotal"
    FROM service_payroll_entries spe
    JOIN payroll_periods pp ON pp.id = spe.payroll_period_id
    GROUP BY TO_CHAR(pp.week_start, 'YYYY-MM')
  `;
  const csMap = new Map(monthlyCSPayroll.map((r) => [r.period, r.csPayrollTotal]));
  const merged = (monthlySales as { period: string; salesCount: number; premiumTotal: number; commissionPaid: number }[]).map(r => ({
    ...r,
    csPayrollTotal: csMap.get(r.period) ?? 0,
  }));
  return res.json({ view, periods: merged });
}));

router.get("/sales-board/summary", asyncHandler(async (_req, res) => {
  const agents = await prisma.agent.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } });
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const cutoff24h = new Date(Date.now() - 86400000);
  const cutoff7d = new Date(Date.now() - 7 * 86400000);
  const allSales = await prisma.sale.findMany({
    where: { status: 'RAN', saleDate: { gte: cutoff7d }, product: { type: { not: 'ACA_PL' } } },
    select: { agentId: true, saleDate: true, premium: true, addons: { select: { premium: true } } },
  });
  const daily: Record<string, { count: number; premium: number }> = {};
  const weekly: Record<string, { count: number; premium: number }> = {};
  for (const s of allSales) {
    const name = agentMap.get(s.agentId) ?? s.agentId;
    const totalPrem = Number(s.premium ?? 0) + (s.addons?.reduce((sum: number, a) => sum + Number(a.premium ?? 0), 0) ?? 0);
    if (!weekly[name]) weekly[name] = { count: 0, premium: 0 };
    weekly[name].count++;
    weekly[name].premium += totalPrem;
    if (s.saleDate >= cutoff24h) {
      if (!daily[name]) daily[name] = { count: 0, premium: 0 };
      daily[name].count++;
      daily[name].premium += totalPrem;
    }
  }
  const fmt = (map: Record<string, { count: number; premium: number }>) =>
    Object.entries(map).map(([agent, v]) => ({ agent, count: v.count, premium: v.premium }))
      .sort((a, b) => b.count - a.count);
  res.json({ daily: fmt(daily), weekly: fmt(weekly) });
}));

router.get("/sales-board/detailed", asyncHandler(async (_req, res) => {
  const agents = await prisma.agent.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } });
  const agentNames = agents.map((a) => a.name);
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));

  // Get Monday of the current week (ISO: Mon=1)
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon...6=Sat
  const diffToMon = day === 0 ? 6 : day - 1;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMon);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);

  // Today boundaries
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);

  // Fetch all RAN sales for the current week
  const sales = await prisma.sale.findMany({
    where: { status: 'RAN', saleDate: { gte: monday, lt: sunday }, product: { type: { not: 'ACA_PL' } } },
    select: { agentId: true, saleDate: true, premium: true, addons: { select: { premium: true } } },
  });

  // Build per-day, per-agent breakdown for weekly view
  const dayLabels = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const weeklyDays = dayLabels.map((label, idx) => {
    const dayStart = new Date(monday);
    dayStart.setDate(monday.getDate() + idx);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayStart.getDate() + 1);

    const daySales: Record<string, { count: number; premium: number }> = {};
    let totalSales = 0;
    let totalPremium = 0;

    for (const s of sales) {
      const sd = new Date(s.saleDate);
      if (sd >= dayStart && sd < dayEnd) {
        const name = agentMap.get(s.agentId) ?? s.agentId;
        if (!daySales[name]) daySales[name] = { count: 0, premium: 0 };
        daySales[name].count++;
        const saleTotalPremium = Number(s.premium ?? 0) + (s.addons?.reduce((sum: number, a) => sum + Number(a.premium ?? 0), 0) ?? 0);
        daySales[name].premium += saleTotalPremium;
        totalSales++;
        totalPremium += saleTotalPremium;
      }
    }

    return { label, agents: daySales, totalSales, totalPremium };
  });

  // Weekly totals per agent
  const weeklyTotals: Record<string, { count: number; premium: number }> = {};
  let grandTotalSales = 0;
  let grandTotalPremium = 0;
  for (const s of sales) {
    const name = agentMap.get(s.agentId) ?? s.agentId;
    if (!weeklyTotals[name]) weeklyTotals[name] = { count: 0, premium: 0 };
    weeklyTotals[name].count++;
    weeklyTotals[name].premium += Number(s.premium ?? 0) + (s.addons?.reduce((sum: number, a) => sum + Number(a.premium ?? 0), 0) ?? 0);
    grandTotalSales++;
    grandTotalPremium += Number(s.premium ?? 0) + (s.addons?.reduce((sum: number, a) => sum + Number(a.premium ?? 0), 0) ?? 0);
  }

  // Daily view: today stats per agent
  const todayStats: Record<string, { count: number; premium: number }> = {};
  for (const s of sales) {
    const sd = new Date(s.saleDate);
    if (sd >= todayStart && sd < todayEnd) {
      const name = agentMap.get(s.agentId) ?? s.agentId;
      if (!todayStats[name]) todayStats[name] = { count: 0, premium: 0 };
      todayStats[name].count++;
      todayStats[name].premium += Number(s.premium ?? 0) + (s.addons?.reduce((sum: number, a) => sum + Number(a.premium ?? 0), 0) ?? 0);
    }
  }

  res.json({
    agents: agentNames,
    weeklyDays,
    weeklyTotals,
    grandTotalSales,
    grandTotalPremium,
    todayStats,
  });
}));

export default router;
