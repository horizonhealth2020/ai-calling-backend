import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { upsertPayrollEntryForSale, handleCommissionZeroing, calculateCommission, getSundayWeekRange, resolveBundleRequirement, type PrismaTx } from "../services/payroll";
import { createAcaChildSale, removeAcaChildSale } from "../services/sales";
import { logAudit } from "../services/audit";
import { emitSaleChanged } from "../socket";
import { shiftRange } from "../services/reporting";
import { zodErr, asyncHandler, dateRange, dateRangeQuerySchema, idParamSchema } from "./helpers";
import { cacheWrap, invalidateAll } from "../services/cache";

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
  // Phase 47 WR-02: wrap sale.create + upsertPayrollEntryForSale in a single
  // transaction so a payroll upsert failure rolls back the sale insert. Previously
  // the client could get 201 with no payroll entry for the new sale.
  const sale = await prisma.$transaction(async (tx: PrismaTx) => {
    const created = await tx.sale.create({
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
    await upsertPayrollEntryForSale(created.id, tx);
    return created;
  });
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
          addons: fullSale.addons?.map((a: { product: { id: string; name: string; type: string } }) => ({ product: { id: a.product.id, name: a.product.name, type: a.product.type } })),
        },
        payrollEntries: payrollEntries.map((e: { id: string; payoutAmount: unknown; adjustmentAmount: unknown; bonusAmount: unknown; frontedAmount: unknown; holdAmount: unknown; netAmount: unknown; status: string; payrollPeriod: { id: string; weekStart: Date; weekEnd: Date } }) => ({
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
  logAudit(req.user!.id, "CREATE", "Sale", sale.id, {
    agentId: parsed.agentId,
    memberName: parsed.memberName,
    premium: parsed.premium,
    productId: parsed.productId,
    status: parsed.status,
  });

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

  // Phase 47 CR-02: explicit lookup + 400 instead of non-null assertion, which
  // previously crashed the process with a TypeError when no active lead source
  // was configured. Also fixes CR-02 companion: validate acaCoveringSaleId if
  // present (must exist, must belong to same agent).
  const defaultLeadSource = await prisma.leadSource.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });
  if (!defaultLeadSource) {
    return res.status(400).json({
      error: "No active lead source configured. Create one before entering ACA sales.",
    });
  }

  // Phase 47 WR-05: validate ACA parent link before insert. PATCH /sales/:id
  // validates this; the POST path was missing the check, allowing orphan FKs,
  // cross-agent linkages, and attaching to DEAD parents.
  if (parsed.acaCoveringSaleId) {
    const parent = await prisma.sale.findUnique({
      where: { id: parsed.acaCoveringSaleId },
      select: { id: true, agentId: true, status: true },
    });
    if (!parent) {
      return res.status(404).json({ error: "Covering parent sale not found" });
    }
    if (parent.agentId !== parsed.agentId) {
      return res.status(400).json({ error: "ACA child agent must match parent sale agent" });
    }
    if (parent.status === "DEAD" || parent.status === "DECLINED") {
      return res.status(400).json({ error: "Cannot attach ACA child to a DEAD or DECLINED parent sale" });
    }
  }

  const sale = await prisma.sale.create({
    data: {
      saleDate: new Date(saleDateStr + "T12:00:00"),
      agentId: parsed.agentId,
      memberName: parsed.memberName,
      carrier: parsed.carrier,
      productId: parsed.productId,
      premium: 0,
      effectiveDate: new Date(saleDateStr + "T12:00:00"),
      leadSourceId: defaultLeadSource.id,
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
    "CREATE",
    "Sale",
    sale.id,
    { agentId: parsed.agentId, memberCount: parsed.memberCount, carrier: parsed.carrier, type: "ACA_PL" },
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
    addons: addonProducts.map((p: { id: string; type: string }) => ({
      product: p,
      premium: parsed.data.addonPremiums[p.id] ?? 0,
    })),
  };

  // Resolve bundle context if core product has a bundle requirement configured
  const addonProductIds = addonProducts.map((p: { id: string }) => p.id);
  const bundleCtx = memberState && product.requiredBundleAddonId
    ? await resolveBundleRequirement(product, memberState, addonProductIds)
    : undefined;

  const result = calculateCommission(mockSale as unknown as Parameters<typeof calculateCommission>[0], bundleCtx ?? undefined);

  const saleDate = parsed.data.saleDate ? new Date(parsed.data.saleDate + "T12:00:00") : new Date();
  const shiftWeeks = parsed.data.paymentType === "ACH" ? 1 : 0;
  const { weekStart, weekEnd } = getSundayWeekRange(saleDate, shiftWeeks);

  const hasCore = product.type === "CORE" || addonProducts.some((p: { type: string }) => p.type === "CORE");
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
  const result = sales.map(({ _count, ...sale }: (typeof sales)[number]) => ({
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
    // Phase 47 Sub-feature 4: ACA covering-child management from the payroll edit row.
    // - object → create (if none exists) or update (if one exists) the child
    // - null   → remove the existing child
    // - undefined (omitted) → no change
    // The FK direction is: child.acaCoveringSaleId → parent.id. Parent NEVER holds it.
    acaChild: z.union([
      z.null(),
      z.object({
        productId: z.string(),
        memberCount: z.number().int().min(1),
      }),
    ]).optional(),
  });
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const saleId = pp.data.id;
  const userRoles: string[] = req.user?.roles ?? [];
  const isPrivileged = userRoles.includes("PAYROLL") || userRoles.includes("SUPER_ADMIN");

  if (isPrivileged) {
    // ── PAYROLL / SUPER_ADMIN: apply directly ──
    const { addonProductIds, addonPremiums, acaChild, ...saleFields } = parsed.data;
    const updateData: Record<string, unknown> = { ...saleFields };
    if (updateData.saleDate) updateData.saleDate = new Date(updateData.saleDate + "T12:00:00");
    if (updateData.effectiveDate) updateData.effectiveDate = new Date(updateData.effectiveDate + "T12:00:00");

    const oldSale = await prisma.sale.findUnique({ where: { id: saleId } });
    if (!oldSale) return res.status(404).json({ error: "Sale not found" });
    const oldAgentId = oldSale.agentId;

    // Recalculate commission if any financial/product/agent/date/paymentType field changed
    // (or if an ACA child is being attached/updated/removed — bundled rate can change).
    const financialFields = ['premium', 'enrollmentFee', 'productId', 'agentId', 'saleDate', 'effectiveDate', 'paymentType', 'commissionApproved', 'addonProductIds'];
    const needsRecalc =
      financialFields.some(f => (parsed.data as Record<string, unknown>)[f] !== undefined) ||
      acaChild !== undefined;

    // Phase 47 Sub-feature 4: ACA attach/detach/update + parent recalc MUST run inside
    // the transaction so D-16 audit atomicity holds (a crashed recalc cannot leave the
    // child-create committed but the parent payout stale).
    await prisma.$transaction(async (tx: PrismaTx) => {
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

      // If agent changed, delete old payroll entries for old agent (inside tx for atomicity)
      if (updateData.agentId && updateData.agentId !== oldAgentId) {
        await tx.payrollEntry.deleteMany({ where: { saleId, agentId: oldAgentId } });
      }

      // ── ACA covering-child handling (Phase 47 Sub-feature 4 / D-13..D-17) ──
      // The FK lives on the CHILD, not the parent. Parent reads via the
      // acaCoveredSales inverse relation. Single upsertPayrollEntryForSale
      // call after the mutation IS the sibling recalc because PayrollEntry
      // is one row per (period, sale) aggregating all products.
      if (acaChild !== undefined) {
        const parentWithCovered = await tx.sale.findUnique({
          where: { id: saleId },
          include: {
            acaCoveredSales: {
              where: { product: { type: "ACA_PL" } },
              select: { id: true },
            },
          },
        });
        const existingChildId = parentWithCovered?.acaCoveredSales[0]?.id ?? null;

        if (acaChild === null && existingChildId) {
          // D-17 REMOVAL — delete child + its PayrollEntry, recalc parent without bundled rates
          await removeAcaChildSale(tx, saleId, existingChildId);
          await upsertPayrollEntryForSale(saleId, tx);
          await logAudit(
            req.user!.id,
            "edit_sale_aca_removed",
            "Sale",
            saleId,
            { removedChildSaleId: existingChildId },
          );
        } else if (acaChild && !existingChildId) {
          // D-13 ATTACH — create child, then recalc parent (picks up acaBundledCommission)
          const child = await createAcaChildSale(tx, saleId, {
            productId: acaChild.productId,
            memberCount: acaChild.memberCount,
            userId: req.user!.id,
          });
          await upsertPayrollEntryForSale(saleId, tx);   // D-14: parent bundled-rate recalc
          await upsertPayrollEntryForSale(child.id, tx); // child's own flat-commission entry
          await logAudit(
            req.user!.id,
            "edit_sale_aca_attached",
            "Sale",
            saleId,
            { createdAcaChildSaleId: child.id, memberCount: acaChild.memberCount, productId: acaChild.productId },
          );
        } else if (acaChild && existingChildId) {
          // UPDATE — change product/memberCount on the existing child
          await tx.sale.update({
            where: { id: existingChildId },
            data: {
              productId: acaChild.productId,
              memberCount: acaChild.memberCount,
            },
          });
          await upsertPayrollEntryForSale(saleId, tx);
          await upsertPayrollEntryForSale(existingChildId, tx);
          await logAudit(
            req.user!.id,
            "edit_sale_aca_updated",
            "Sale",
            saleId,
            { childSaleId: existingChildId, memberCount: acaChild.memberCount, productId: acaChild.productId },
          );
        } else {
          // acaChild === null with no existing child — no-op, but still recalc if
          // other financial fields changed (handled below via needsRecalc path).
          if (needsRecalc) {
            await upsertPayrollEntryForSale(saleId, tx);
          }
        }
      } else if (needsRecalc) {
        // No ACA change — normal financial recalc path, still inside the transaction.
        await upsertPayrollEntryForSale(saleId, tx);
      }
    });

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
      const oldAddonIds = currentSale.addons.map((a: { productId: string }) => a.productId).sort();
      const newAddonIds = [...new Set(data.addonProductIds)].sort();
      if (JSON.stringify(oldAddonIds) !== JSON.stringify(newAddonIds)) {
        changes.addonProductIds = { old: oldAddonIds, new: newAddonIds };
      }
    }
    if (data.addonPremiums !== undefined) {
      const oldPremiums: Record<string, number> = {};
      currentSale.addons.forEach((a: { productId: string; premium: unknown }) => { oldPremiums[a.productId] = Number(a.premium ?? 0); });
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

  // D-18: collect ACA child sale IDs (linked via Phase 42 acaCoveringSaleId self-relation)
  // BEFORE the transaction so we can cascade their dependents and include the IDs in the audit payload.
  const childSales = await prisma.sale.findMany({
    where: { acaCoveringSaleId: saleId },
    select: { id: true },
  });
  const childIds = childSales.map((c: { id: string }) => c.id);

  // D-17, D-18: atomic cascade — delete child dependents + child sales BEFORE parent cleanup
  // so FK references from child rows are gone before the parent sale is removed.
  // Note: deleteMany with `id: { in: [] }` is a safe no-op in Prisma, so the cascade block
  // runs unconditionally with no guard for the no-child case.
  await prisma.$transaction([
    // --- ACA child cascade ---
    prisma.saleAddon.deleteMany({ where: { saleId: { in: childIds } } }),
    prisma.clawback.deleteMany({ where: { saleId: { in: childIds } } }),
    prisma.payrollEntry.deleteMany({ where: { saleId: { in: childIds } } }),
    prisma.statusChangeRequest.deleteMany({ where: { saleId: { in: childIds } } }),
    prisma.saleEditRequest.deleteMany({ where: { saleId: { in: childIds } } }),
    prisma.sale.deleteMany({ where: { id: { in: childIds } } }),

    // --- parent cleanup (existing logic) ---
    prisma.saleAddon.deleteMany({ where: { saleId } }),
    prisma.clawback.deleteMany({ where: { saleId } }),
    prisma.payrollEntry.deleteMany({ where: { saleId } }),
    prisma.statusChangeRequest.deleteMany({ where: { saleId } }),
    prisma.saleEditRequest.deleteMany({ where: { saleId } }),
    prisma.sale.delete({ where: { id: saleId } }),
  ]);

  // D-19: include cascaded child IDs in the audit payload (do not silently drop them).
  await logAudit(req.user!.id, "DELETE", "Sale", saleId, {
    memberName: sale.memberName,
    agentId: sale.agentId,
    premium: Number(sale.premium),
    cascadedChildSaleIds: childIds,
  });
  invalidateAll();
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
    const result = await prisma.$transaction(async (tx: PrismaTx) => {
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
    // Phase 47 WR-02: wrap the sale.update + statusChangeRequest cancel +
    // commission zeroing in a single transaction. Previously the sale.update
    // could commit but handleCommissionZeroing could fail, leaving sale=DEAD
    // with live payroll entries and no reconciliation path.
    const updated = await prisma.$transaction(async (tx: PrismaTx) => {
      await tx.statusChangeRequest.updateMany({
        where: { saleId: sale.id, status: "PENDING" },
        data: { status: "REJECTED", reviewedBy: req.user!.id, reviewedAt: new Date() },
      });

      const u = await tx.sale.update({
        where: { id: sale.id },
        data: { status: newStatus },
        include: { agent: true, product: true, leadSource: true },
      });
      await handleCommissionZeroing(sale.id, tx);
      return u;
    });
    await logAudit(req.user!.id, "UPDATE_STATUS", "Sale", sale.id, { oldStatus, newStatus });
    invalidateAll();
    return res.json(updated);
  }

  // Dead <-> Declined: free transition, no commission impact
  const updated = await prisma.sale.update({
    where: { id: sale.id },
    data: { status: newStatus },
    include: { agent: true, product: true, leadSource: true },
  });
  await logAudit(req.user!.id, "UPDATE_STATUS", "Sale", sale.id, { oldStatus, newStatus });
  invalidateAll();
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
  invalidateAll();
  res.json(sale);
}));

router.patch("/sales/:id/unapprove-commission", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));

  // Block unapprove on locked or finalized periods — only OPEN periods allow commission reversal
  const payrollEntries = await prisma.payrollEntry.findMany({
    where: { saleId: pp.data.id },
    include: { payrollPeriod: { select: { status: true } } },
  });
  const hasNonOpenPeriod = payrollEntries.some(
    (e: { payrollPeriod: { status: string } }) => e.payrollPeriod.status !== "OPEN"
  );
  if (hasNonOpenPeriod) {
    await logAudit(req.user!.id, "UNAPPROVE_BLOCKED", "Sale", pp.data.id, {
      reason: "Period not OPEN",
      periodStatuses: payrollEntries.map((e: { payrollPeriod: { status: string } }) => e.payrollPeriod.status),
    });
    return res.status(400).json({ error: "Cannot unapprove commission on a locked or finalized period" });
  }

  const sale = await prisma.sale.update({
    where: { id: pp.data.id },
    data: { commissionApproved: false },
  });
  await upsertPayrollEntryForSale(sale.id);
  await logAudit(req.user!.id, "UNAPPROVE_COMMISSION", "Sale", sale.id);
  invalidateAll();
  res.json(sale);
}));

// ── Batch commission approval ─────────────────────────────────
router.post("/payroll/batch-approve-commission", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed = z.object({ saleIds: z.array(z.string()).min(1).max(100) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { saleIds } = parsed.data;

  // Validate all saleIds exist before processing
  const existing = await prisma.sale.findMany({ where: { id: { in: saleIds } }, select: { id: true } });
  const existingIds = new Set(existing.map((s: { id: string }) => s.id));
  const missingIds = saleIds.filter(id => !existingIds.has(id));
  if (missingIds.length > 0) {
    return res.status(400).json({ error: "Some sales not found", missingIds });
  }

  // Process each sale with partial failure tracking
  const approved: string[] = [];
  const failedIds: string[] = [];
  for (const saleId of saleIds) {
    try {
      await prisma.sale.update({ where: { id: saleId }, data: { commissionApproved: true } });
      await upsertPayrollEntryForSale(saleId);
      approved.push(saleId);
    } catch (err) {
      console.error(`[batch-approve] Failed for sale ${saleId}:`, err);
      failedIds.push(saleId);
    }
  }

  await logAudit(req.user!.id, "BATCH_APPROVE_COMMISSION", "Sale", saleIds.join(","), {
    count: approved.length,
    failed: failedIds.length,
    failedIds: failedIds.length > 0 ? failedIds : undefined,
  });
  invalidateAll();
  res.json({ ok: true, approved: approved.length, failed: failedIds.length, failedIds });
}));

router.get("/tracker/summary", requireAuth, asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));

  const cacheKey = `sales:/tracker/summary?${req.url.split('?')[1] || ''}`;
  const result = await cacheWrap(cacheKey, async () => {
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const salesWhere = dr ? { status: 'RAN' as const, saleDate: { gte: dr.gte, lt: dr.lt }, product: { type: { not: 'ACA_PL' as const } } } : { status: 'RAN' as const, product: { type: { not: 'ACA_PL' as const } } };
  const callWhere: { agentId: { not: null }; leadSourceId: { not: null }; callTimestamp?: { gte: Date; lt: Date } } = { agentId: { not: null }, leadSourceId: { not: null } };
  if (dr) callWhere.callTimestamp = { gte: dr.gte, lt: dr.lt };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const todaySalesWhere = { status: 'RAN' as const, saleDate: { gte: todayStart, lt: todayEnd }, product: { type: { not: 'ACA_PL' as const } } };

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
  const commMap = new Map(commissionByAgent.map((c: { agentId: string; _sum: { payoutAmount: unknown } }) => [c.agentId, Number(c._sum.payoutAmount ?? 0)]));

  // Build today map
  const todayMap = new Map<string, { salesCount: number; premiumTotal: number }>();
  for (const agent of todayData) {
    const salesCount = agent.sales.length;
    const premiumTotal = agent.sales.reduce((sum: number, s: { premium: unknown; addons?: { premium: unknown }[] }) => sum + Number(s.premium ?? 0) + (s.addons?.reduce((aSum: number, a: { premium: unknown }) => aSum + Number(a.premium ?? 0), 0) ?? 0), 0);
    todayMap.set(agent.name, { salesCount, premiumTotal });
  }

  // Build lead source lookup
  const lsMap = new Map<string, { costPerLead: number; callBufferSeconds: number }>(allLeadSources.map((ls: { id: string; costPerLead: unknown; callBufferSeconds: number }) => [ls.id, { costPerLead: Number(ls.costPerLead), callBufferSeconds: ls.callBufferSeconds }]));

  // Aggregate lead cost per agent from Convoso call logs (applying buffer filter)
  const agentLeadCost = new Map<string, number>();
  for (const log of callLogs) {
    if (!log.agentId || !log.leadSourceId) continue;
    const ls = lsMap.get(log.leadSourceId);
    if (!ls) continue;
    if (ls.callBufferSeconds > 0 && (log.callDurationSeconds ?? 0) < ls.callBufferSeconds) continue;
    agentLeadCost.set(log.agentId, (agentLeadCost.get(log.agentId) ?? 0) + ls.costPerLead);
  }

  const summary = data.map((agent: { id: string; name: string; sales: { premium: unknown; addons?: { premium: unknown }[] }[] }) => {
    const salesCount = agent.sales.length;
    const premiumTotal = agent.sales.reduce((sum: number, s: { premium: unknown; addons?: { premium: unknown }[] }) => sum + Number(s.premium ?? 0) + (s.addons?.reduce((aSum: number, a: { premium: unknown }) => aSum + Number(a.premium ?? 0), 0) ?? 0), 0);
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
  return { agents: summary, convosoConfigured };
  }); // end cacheWrap
  res.json(result);
}));

router.get("/owner/summary", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));

  const cacheKey = `sales:/owner/summary?${req.url.split('?')[1] || ''}`;
  const result = await cacheWrap(cacheKey, async () => {
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
    const premiumTotal = salesForPremium.reduce((sum: number, s: { premium: unknown; addons?: { premium: unknown }[] }) => sum + Number(s.premium ?? 0) + (s.addons?.reduce((aSum: number, a: { premium: unknown }) => aSum + Number(a.premium ?? 0), 0) ?? 0), 0);
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
  return { ...current, trends, convosoConfigured };
  }); // end cacheWrap
  res.json(result);
}));

// ── Command Center (aggregated owner endpoint) ────────────────────
router.get("/command-center", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));

  const cacheKey = `sales:/command-center?${req.url.split('?')[1] || ''}`;
  const result = await cacheWrap(cacheKey, async () => {
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const priorDr = dr ? shiftRange(dr, Math.round((dr.lt.getTime() - dr.gte.getTime()) / 86400000)) : undefined;

  // ── Parallel data fetch ──
  const callWhere: { agentId: { not: null }; leadSourceId: { not: null }; callTimestamp?: { gte: Date; lt: Date } } = { agentId: { not: null }, leadSourceId: { not: null } };
  if (dr) callWhere.callTimestamp = { gte: dr.gte, lt: dr.lt };

  const saleWhere = { status: "RAN" as const, ...(dr ? { saleDate: { gte: dr.gte, lt: dr.lt } } : {}), product: { type: { not: "ACA_PL" as const } } };
  const priorSaleWhere = priorDr ? { status: "RAN" as const, saleDate: { gte: priorDr.gte, lt: priorDr.lt }, product: { type: { not: "ACA_PL" as const } } } : undefined;

  const now = new Date();
  const cbThisWeekRaw = getSundayWeekRange(now);
  const cbThisWeek = { gte: cbThisWeekRaw.weekStart, lt: cbThisWeekRaw.weekEnd };
  const cbLastWeek = shiftRange(cbThisWeek, 7);

  const [
    agents, priorSales, allLeadSources, callLogs,
    cbThisWeekAgg, cbLastWeekAgg, arrearsPeriod, commissionByAgent,
  ] = await Promise.all([
    // Current period agents + sales
    prisma.agent.findMany({
      where: { active: true },
      include: { sales: { where: saleWhere, include: { addons: { select: { premium: true } } } } },
    }),
    // Prior period sales
    priorSaleWhere
      ? prisma.sale.findMany({ where: priorSaleWhere, select: { premium: true, addons: { select: { premium: true } } } })
      : Promise.resolve([]),
    // Lead sources for cost calculation
    prisma.leadSource.findMany({ select: { id: true, costPerLead: true, callBufferSeconds: true } }),
    // Call logs for quality metrics
    prisma.convosoCallLog.findMany({ where: callWhere, select: { agentId: true, leadSourceId: true, callDurationSeconds: true } }),
    // Chargebacks this week
    prisma.chargebackSubmission.aggregate({ where: { createdAt: { gte: cbThisWeek.gte, lt: cbThisWeek.lt } }, _count: true, _sum: { totalAmount: true } }),
    // Chargebacks last week (trend)
    prisma.chargebackSubmission.aggregate({ where: { createdAt: { gte: cbLastWeek.gte, lt: cbLastWeek.lt } }, _count: true, _sum: { totalAmount: true } }),
    // Arrears period for commission owed Friday
    prisma.payrollPeriod.findFirst({
      where: { weekEnd: { lt: now } },
      orderBy: { weekStart: "desc" },
      include: {
        entries: { select: { payoutAmount: true, adjustmentAmount: true, bonusAmount: true, frontedAmount: true, holdAmount: true } },
        serviceEntries: { select: { totalPay: true } },
      },
    }),
    // Commission per agent for leaderboard
    prisma.payrollEntry.groupBy({
      by: ["agentId"],
      _sum: { payoutAmount: true },
      where: { sale: { status: "RAN", ...(dr ? { saleDate: { gte: dr.gte, lt: dr.lt } } : {}) } },
    }),
  ]);
  const commMap = new Map(commissionByAgent.map((c: { agentId: string; _sum: { payoutAmount: unknown } }) => [c.agentId, Number(c._sum.payoutAmount ?? 0)]));

  // ── Hero metrics ──
  let salesCount = 0;
  let premiumTotal = 0;
  const agentSalesMap = new Map<string, { salesCount: number; premiumTotal: number; totalLeadCost: number }>();

  for (const agent of agents) {
    const sc = agent.sales.length;
    const pt = agent.sales.reduce((s: number, sale: { premium: unknown; addons?: { premium: unknown }[] }) => s + Number(sale.premium ?? 0) + (sale.addons?.reduce((a: number, ad: { premium: unknown }) => a + Number(ad.premium ?? 0), 0) ?? 0), 0);
    salesCount += sc;
    premiumTotal += pt;
    agentSalesMap.set(agent.name, { salesCount: sc, premiumTotal: pt, totalLeadCost: 0 });
  }

  const priorSalesCount = priorSales.length;
  const priorPremiumTotal = priorSales.reduce((s: number, sale: { premium: unknown; addons?: { premium: unknown }[] }) => s + Number(sale.premium ?? 0) + (sale.addons?.reduce((a: number, ad: { premium: unknown }) => a + Number(ad.premium ?? 0), 0) ?? 0), 0);

  // ── Lead cost per agent ──
  const lsMap = new Map<string, { costPerLead: number; callBufferSeconds: number }>(allLeadSources.map((ls: { id: string; costPerLead: unknown; callBufferSeconds: number }) => [ls.id, { costPerLead: Number(ls.costPerLead), callBufferSeconds: ls.callBufferSeconds }]));
  const agentCallMetrics = new Map<string, { calls: number; tiers: { short: number; contacted: number; engaged: number; deep: number }; totalDuration: number; callCount: number }>();

  for (const log of callLogs) {
    if (!log.agentId || !log.leadSourceId) continue;
    const ls = lsMap.get(log.leadSourceId);
    if (!ls) continue;
    if (ls.callBufferSeconds > 0 && (log.callDurationSeconds ?? 0) < ls.callBufferSeconds) continue;

    // Lead cost
    const agentEntry = [...agents].find(a => a.id === log.agentId);
    if (agentEntry) {
      const existing = agentSalesMap.get(agentEntry.name);
      if (existing) existing.totalLeadCost += ls.costPerLead;
    }

    // Call quality metrics
    const aid = log.agentId;
    if (!agentCallMetrics.has(aid)) agentCallMetrics.set(aid, { calls: 0, tiers: { short: 0, contacted: 0, engaged: 0, deep: 0 }, totalDuration: 0, callCount: 0 });
    const m = agentCallMetrics.get(aid)!;
    m.calls++;
    const dur = log.callDurationSeconds;
    if (dur !== null) {
      if (dur < 30) m.tiers.short++;
      else if (dur < 120) m.tiers.contacted++;
      else if (dur < 300) m.tiers.engaged++;
      else m.tiers.deep++;
      m.totalDuration += dur;
      m.callCount++;
    }
  }

  // ── Commission owed Friday (arrears period net) ──
  let commissionOwedFriday = 0;
  if (arrearsPeriod) {
    commissionOwedFriday = arrearsPeriod.entries.reduce((s: number, e: { payoutAmount: unknown; adjustmentAmount: unknown; bonusAmount: unknown; frontedAmount: unknown; holdAmount: unknown }) =>
      s + Number(e.payoutAmount) + Number(e.adjustmentAmount) + Number(e.bonusAmount) + Number(e.frontedAmount) - Number(e.holdAmount), 0);
    commissionOwedFriday += arrearsPeriod.serviceEntries.reduce((s: number, e: { totalPay: unknown }) => s + Number(e.totalPay), 0);
  }

  // ── Leaderboard ──
  const agentIdToName = new Map(agents.map((a: { id: string; name: string }) => [a.id, a.name]));
  const leaderboard = agents
    .map((agent: { id: string; name: string }) => {
      const sales = agentSalesMap.get(agent.name) ?? { salesCount: 0, premiumTotal: 0, totalLeadCost: 0 };
      const callMetrics = agentCallMetrics.get(agent.id);
      return {
        agent: agent.name,
        calls: callMetrics?.calls ?? 0,
        avgCallLength: callMetrics && callMetrics.callCount > 0 ? Math.round(callMetrics.totalDuration / callMetrics.callCount) : 0,
        salesCount: sales.salesCount,
        premiumTotal: sales.premiumTotal,
        costPerSale: sales.salesCount > 0 ? sales.totalLeadCost / sales.salesCount : 0,
        commissionTotal: commMap.get(agent.id) ?? 0,
        callsByTier: callMetrics?.tiers ?? { short: 0, contacted: 0, engaged: 0, deep: 0 },
      };
    })
    .sort((a: { premiumTotal: number; salesCount: number }, b: { premiumTotal: number; salesCount: number }) => b.premiumTotal - a.premiumTotal || b.salesCount - a.salesCount);

  // ── Total lead cost for ROI ──
  let totalLeadCost = 0;
  for (const [, v] of agentSalesMap) totalLeadCost += v.totalLeadCost;
  const avgCostPerSale = salesCount > 0 ? totalLeadCost / salesCount : 0;
  const priorAvgCostPerSale = priorSalesCount > 0 ? totalLeadCost / priorSalesCount : 0; // approximate

  const convosoConfigured = !!process.env.CONVOSO_AUTH_TOKEN;

  return {
    hero: { salesCount, premiumTotal, priorSalesCount, priorPremiumTotal },
    statCards: {
      thisWeekPremium: premiumTotal,
      priorWeekPremium: priorPremiumTotal,
      commissionOwedFriday,
      chargebackCount: cbThisWeekAgg._count ?? 0,
      chargebackDollars: Number(cbThisWeekAgg._sum?.totalAmount ?? 0),
      priorChargebackCount: cbLastWeekAgg._count ?? 0,
      avgCostPerSale,
      priorAvgCostPerSale,
      convosoConfigured,
    },
    leaderboard,
  };
  }); // end cacheWrap
  res.json(result);
}));

router.get("/reporting/periods", requireAuth, requireRole("MANAGER", "OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const cacheKey = `sales:/reporting/periods?${req.url.split('?')[1] || ''}`;
  const cached = await cacheWrap(cacheKey, async () => {
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
    const result = periods.map((p: { weekStart: Date; weekEnd: Date; status: string; entries: { netAmount: unknown; sale?: { status: string; premium: unknown; addons?: { premium: unknown }[] } | null }[]; serviceEntries: { totalPay: unknown }[] }) => {
      const ranEntries = p.entries.filter((e: { sale?: { status: string } | null }) => e.sale?.status === 'RAN');
      const csPayrollTotal = p.serviceEntries.reduce(
        (sum: number, se: { totalPay: unknown }) => sum + Number(se.totalPay), 0
      );
      return {
        period: `${p.weekStart.toISOString().slice(0, 10)} - ${p.weekEnd.toISOString().slice(0, 10)}`,
        salesCount: ranEntries.length,
        premiumTotal: ranEntries.reduce((s: number, e: { sale?: { premium: unknown; addons?: { premium: unknown }[] } | null }) => s + Number(e.sale?.premium ?? 0) + (e.sale?.addons?.reduce((aSum: number, a: { premium: unknown }) => aSum + Number(a.premium ?? 0), 0) ?? 0), 0),
        commissionPaid: ranEntries.reduce((s: number, e: { netAmount: unknown }) => s + Number(e.netAmount), 0),
        csPayrollTotal,
        periodStatus: p.status,
      };
    });
    return { view, periods: result };
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
  return { view, periods: merged };
  }); // end cacheWrap
  res.json(cached);
}));

router.get("/sales-board/summary", asyncHandler(async (_req, res) => {
  const agents = await prisma.agent.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } });
  const agentMap = new Map(agents.map((a: { id: string; name: string }) => [a.id, a.name]));
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
    const totalPrem = Number(s.premium ?? 0) + (s.addons?.reduce((sum: number, a: { premium: unknown }) => sum + Number(a.premium ?? 0), 0) ?? 0);
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
  const agentNames = agents.map((a: { name: string }) => a.name);
  const agentMap = new Map(agents.map((a: { id: string; name: string }) => [a.id, a.name]));

  // Get Sunday of the current week (Sun=0)
  const now = new Date();
  const day = now.getDay(); // 0=Sun,1=Mon...6=Sat
  const weekSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const nextSunday = new Date(weekSunday);
  nextSunday.setDate(weekSunday.getDate() + 7);

  // Today boundaries
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);

  // Fetch all RAN sales for the current week (Sunday–Saturday)
  const sales = await prisma.sale.findMany({
    where: { status: 'RAN', saleDate: { gte: weekSunday, lt: nextSunday }, product: { type: { not: 'ACA_PL' } } },
    select: { agentId: true, saleDate: true, premium: true, addons: { select: { premium: true } } },
  });

  // Build per-day, per-agent breakdown for weekly view
  const dayLabels = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weeklyDays = dayLabels.map((label, idx) => {
    const dayStart = new Date(weekSunday);
    dayStart.setDate(weekSunday.getDate() + idx);
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
        const saleTotalPremium = Number(s.premium ?? 0) + (s.addons?.reduce((sum: number, a: { premium: unknown }) => sum + Number(a.premium ?? 0), 0) ?? 0);
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
    weeklyTotals[name].premium += Number(s.premium ?? 0) + (s.addons?.reduce((sum: number, a: { premium: unknown }) => sum + Number(a.premium ?? 0), 0) ?? 0);
    grandTotalSales++;
    grandTotalPremium += Number(s.premium ?? 0) + (s.addons?.reduce((sum: number, a: { premium: unknown }) => sum + Number(a.premium ?? 0), 0) ?? 0);
  }

  // Daily view: today stats per agent
  const todayStats: Record<string, { count: number; premium: number }> = {};
  for (const s of sales) {
    const sd = new Date(s.saleDate);
    if (sd >= todayStart && sd < todayEnd) {
      const name = agentMap.get(s.agentId) ?? s.agentId;
      if (!todayStats[name]) todayStats[name] = { count: 0, premium: 0 };
      todayStats[name].count++;
      todayStats[name].premium += Number(s.premium ?? 0) + (s.addons?.reduce((sum: number, a: { premium: unknown }) => sum + Number(a.premium ?? 0), 0) ?? 0);
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
