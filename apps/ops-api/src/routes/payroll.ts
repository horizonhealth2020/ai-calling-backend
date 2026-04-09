import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { executeCarryover, reverseCarryover } from "../services/carryover";
import { findOldestOpenPeriodForAgent, calculatePerProductCommission, applyChargebackToEntry } from "../services/payroll";
import { zodErr, asyncHandler, idParamSchema } from "./helpers";

const router = Router();

router.get("/payroll/periods", requireAuth, requireRole("PAYROLL", "MANAGER", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  res.json(await prisma.payrollPeriod.findMany({
    include: {
      agentAdjustments: {
        include: { agent: { select: { id: true, name: true } } },
      },
      entries: {
        include: {
          sale: { select: { id: true, memberName: true, memberId: true, carrier: true, premium: true, enrollmentFee: true, commissionApproved: true, status: true, notes: true, memberCount: true, acaCoveringSaleId: true, product: { select: { id: true, name: true, type: true, flatCommission: true } }, addons: { select: { productId: true, premium: true, product: { select: { id: true, name: true, type: true } } } } } },
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
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const schema = z.object({ status: z.enum(["OPEN", "LOCKED"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const period = await prisma.payrollPeriod.findUnique({ where: { id: pp.data.id } });
  if (!period) return res.status(404).json({ error: "Period not found" });
  if (period.status === "FINALIZED") return res.status(400).json({ error: "Finalized periods cannot be changed" });

  // LOCKED -> OPEN: reverse any prior carryover so re-lock sees a clean slate (Bug 45 fix)
  if (period.status === "LOCKED" && parsed.data.status === "OPEN" && period.carryoverExecuted) {
    try {
      const result = await reverseCarryover(pp.data.id);
      await logAudit(req.user!.id, "REVERSE_CARRYOVER", "PayrollPeriod", pp.data.id, {
        reversed: result.reversed,
        rowsTouched: result.rowsTouched,
      });
    } catch (err) {
      console.error("[carryover] Reverse failed:", err);
      return res.status(500).json({ error: "Failed to reverse carryover on unlock" });
    }
  }

  const updated = await prisma.payrollPeriod.update({ where: { id: pp.data.id }, data: { status: parsed.data.status } });
  await logAudit(req.user!.id, "UPDATE", "PayrollPeriod", pp.data.id, { status: parsed.data.status });

  // Execute carryover when locking (idempotent -- skips if already done)
  if (parsed.data.status === "LOCKED") {
    try {
      const result = await executeCarryover(pp.data.id);
      await logAudit(req.user!.id, "CARRYOVER", "PayrollPeriod", pp.data.id, {
        carried: result.carried,
        skipped: result.skipped,
      });
    } catch (err) {
      // Log but don't fail the lock operation
      console.error("[carryover] Failed:", err);
    }
  }

  res.json(updated);
}));

router.delete("/payroll/periods/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const period = await prisma.payrollPeriod.findUnique({
    where: { id: pp.data.id },
    include: { _count: { select: { entries: true, serviceEntries: true } } },
  });
  if (!period) return res.status(404).json({ error: "Period not found" });

  // Delete entries first, then the period
  await prisma.payrollEntry.deleteMany({ where: { payrollPeriodId: pp.data.id } });
  await prisma.servicePayrollEntry.deleteMany({ where: { payrollPeriodId: pp.data.id } });
  await prisma.payrollPeriod.delete({ where: { id: pp.data.id } });
  await logAudit(req.user!.id, "HARD_DELETE", "PayrollPeriod", pp.data.id, {
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
    // Phase 47 WR-03: exclude ZEROED_OUT_IN_PERIOD and CLAWBACK_CROSS_PERIOD as well,
    // so a bulk "Mark Paid" does not overwrite the visual distinction (yellow/orange)
    // for already-resolved cross-period chargebacks.
    await prisma.payrollEntry.updateMany({
      where: {
        id: { in: entryIds },
        status: { notIn: ["ZEROED_OUT", "ZEROED_OUT_IN_PERIOD", "CLAWBACK_CROSS_PERIOD"] },
      },
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
  const parsed3 = z.object({
    memberId: z.string().optional(),
    memberName: z.string().optional(),
    notes: z.string().optional(),
    productIds: z.array(z.string()).optional(),
  }).safeParse(req.body);
  if (!parsed3.success) return res.status(400).json(zodErr(parsed3.error));
  const payload = parsed3.data;
  // Phase 46 GAP-46-02: include acaCoveredSales so calculatePerProductCommission
  // can detect ACA-bundled parent sales and apply acaBundledCommission rate.
  // Phase 47 CR-01: deterministic order on payrollEntries so downstream
  // applyChargebackToEntry sees entries sorted oldest-first.
  const saleInclude = {
    payrollEntries: { orderBy: { createdAt: "asc" as const } },
    product: true,
    addons: { include: { product: true } },
    acaCoveredSales: { where: { product: { type: "ACA_PL" as const } }, select: { id: true } },
  };
  const sale = payload.memberId
    ? await prisma.sale.findFirst({
        where: { memberId: payload.memberId },
        include: saleInclude,
      })
    : await prisma.sale.findFirst({
        where: { memberName: payload.memberName },
        include: saleInclude,
      });
  if (!sale) return res.status(404).json({ error: "Matching sale not found" });

  // Determine reference entry for amount calculation: prefer OPEN-period entry,
  // fall back to the oldest non-clawback entry (could be in LOCKED/FINALIZED).
  // Phase 47 CR-01: exclude clawback rows so we anchor to the live original entry.
  const openPeriodId = await findOldestOpenPeriodForAgent(sale.agentId);
  const liveEntries = sale.payrollEntries.filter(e =>
    e.status !== "CLAWBACK_APPLIED" &&
    e.status !== "ZEROED_OUT_IN_PERIOD" &&
    e.status !== "CLAWBACK_CROSS_PERIOD"
  );
  const referenceEntry =
    (openPeriodId
      ? liveEntries.find(e => e.payrollPeriodId === openPeriodId)
      : undefined) ?? liveEntries[0];

  // Calculate chargeback amount
  let chargebackAmount: number;
  const productIds = payload.productIds;
  if (productIds && productIds.length > 0) {
    const fullPayout = referenceEntry ? Number(referenceEntry.payoutAmount) : 0;
    chargebackAmount = calculatePerProductCommission(sale as Parameters<typeof calculatePerProductCommission>[0], productIds, fullPayout);
  } else {
    // Phase 47 WR-01: canonicalize on payoutAmount (sale's own commission), not netAmount
    // which is contaminated by bonus/fronted/hold from the target period.
    chargebackAmount = referenceEntry ? Number(referenceEntry.payoutAmount) : 0;
  }

  // Build notes with product names for partial chargebacks
  let notes = payload.notes || "";
  if (productIds && productIds.length > 0) {
    const allProducts = [sale.product, ...sale.addons.map(a => a.product)];
    const selectedNames = allProducts.filter(p => productIds.includes(p.id)).map(p => p.name);
    if (selectedNames.length < allProducts.length) {
      notes = `Partial chargeback: ${selectedNames.join(", ")}${notes ? ` | ${notes}` : ""}`;
    }
  }

  // Wrap clawback insert + entry mutation in a single transaction so partial
  // failure cannot leave a clawback row without its corresponding payroll entry.
  const { clawback, outcome } = await prisma.$transaction(async (tx) => {
    const created = await tx.clawback.create({
      data: {
        saleId: sale.id,
        agentId: sale.agentId,
        matchedBy: payload.memberId ? "member_id" : "member_name",
        matchedValue: payload.memberId || payload.memberName || "",
        amount: chargebackAmount,
        status: "ZEROED",
        appliedPayrollPeriodId: openPeriodId || undefined,
        notes: notes || undefined,
      },
    });

    // Create ClawbackProduct records for per-product tracking
    if (productIds && productIds.length > 0) {
      const allProducts = [sale.product, ...sale.addons.map(a => a.product)];
      const fullPayout = referenceEntry ? Number(referenceEntry.payoutAmount) : 0;
      const productRecords = productIds
        .filter(pid => allProducts.some(p => p.id === pid))
        .map(pid => ({
          clawbackId: created.id,
          productId: pid,
          amount: calculatePerProductCommission(sale as Parameters<typeof calculatePerProductCommission>[0], [pid], fullPayout),
        }));
      if (productRecords.length > 0) {
        await tx.clawbackProduct.createMany({ data: productRecords });
      }
    }

    // Apply via shared helper — handles in-period zero vs cross-period insert
    const applied = await applyChargebackToEntry(
      tx,
      { id: sale.id, agentId: sale.agentId, payrollEntries: sale.payrollEntries },
      chargebackAmount,
    );

    return { clawback: created, outcome: applied };
  });

  await logAudit(req.user!.id, "CREATE", "Clawback", clawback.id, {
    saleId: sale.id,
    status: clawback.status,
    amount: chargebackAmount,
    chargebackMode: outcome.mode,
    appliedEntryId: outcome.entryId,
  });
  res.status(201).json(clawback);
}));

// ── Clawback sale lookup (for product selection UI) ─────────────
router.get("/clawbacks/lookup", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed = z.object({
    memberId: z.string().optional(),
    memberName: z.string().optional(),
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { memberId, memberName } = parsed.data;
  if (!memberId && !memberName) return res.status(400).json({ error: "Provide memberId or memberName" });

  const where = memberId ? { memberId } : { memberName };
  const sale = await prisma.sale.findFirst({
    where,
    include: {
      agent: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, type: true } },
      addons: { include: { product: { select: { id: true, name: true, type: true } } } },
      acaCoveredSales: { where: { product: { type: "ACA_PL" } }, select: { id: true } },
      payrollEntries: {
        orderBy: { payoutAmount: "desc" },
        select: { payoutAmount: true, status: true },
      },
    },
  });
  if (!sale) return res.status(404).json({ error: "No matching sale found" });

  // Pick the entry with the highest payoutAmount (the original commission before any chargeback zeroing)
  const fullPayout = sale.payrollEntries[0] ? Number(sale.payrollEntries[0].payoutAmount) : 0;
  res.set("Cache-Control", "no-store");

  const allProducts = [
    { id: sale.product.id, name: sale.product.name, type: sale.product.type, premium: Number(sale.premium) },
    ...sale.addons.map(a => ({
      id: a.product.id,
      name: a.product.name,
      type: a.product.type,
      premium: Number(a.premium ?? 0),
    })),
  ];

  const productsWithCommission = allProducts.map(p => ({
    ...p,
    commission: calculatePerProductCommission(
      sale as unknown as Parameters<typeof calculatePerProductCommission>[0],
      [p.id],
      fullPayout,
    ),
  }));

  res.json({
    saleId: sale.id,
    memberName: sale.memberName,
    memberId: sale.memberId,
    agentName: sale.agent.name,
    agentId: sale.agent.id,
    premium: Number(sale.premium),
    enrollmentFee: sale.enrollmentFee != null ? Number(sale.enrollmentFee) : null,
    products: productsWithCommission,
    fullCommission: fullPayout,
  });
}));

// ── Payroll Entry adjustments (bonus / fronted) ─────────────────
router.patch("/payroll/entries/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const schema = z.object({
    bonusAmount: z.number().min(0).optional(),
    frontedAmount: z.number().min(0).optional(),
    holdAmount: z.number().min(0).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const entry = await prisma.payrollEntry.findUnique({ where: { id: pp.data.id } });
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  // Guard: reject edits if this specific entry has already been paid
  if (entry.status === "PAID") {
    return res.status(400).json({ error: "This entry has already been marked paid and cannot be edited" });
  }
  const bonus = parsed.data.bonusAmount ?? Number(entry.bonusAmount);
  const fronted = parsed.data.frontedAmount ?? Number(entry.frontedAmount);
  const hold = parsed.data.holdAmount ?? Number(entry.holdAmount);
  const net = Number(entry.payoutAmount) + Number(entry.adjustmentAmount) + bonus + fronted - hold;
  const updated = await prisma.payrollEntry.update({
    where: { id: pp.data.id },
    data: { bonusAmount: bonus, frontedAmount: fronted, holdAmount: hold, netAmount: net },
    include: { sale: { select: { id: true, memberName: true, memberId: true, enrollmentFee: true, commissionApproved: true, memberCount: true, product: { select: { name: true, type: true, flatCommission: true } } } }, agent: { select: { name: true } } },
  });
  await logAudit(req.user!.id, "UPDATE", "PayrollEntry", pp.data.id, { bonusAmount: bonus, frontedAmount: fronted, holdAmount: hold, netAmount: net });
  res.json(updated);
}));

// ── Agent Period Adjustment CRUD ──────────────────────────────────

// GET /payroll/adjustments/:periodId -- fetch all adjustments for a period
router.get("/payroll/adjustments/:periodId", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const adjustments = await prisma.agentPeriodAdjustment.findMany({
    where: { payrollPeriodId: req.params.periodId },
    include: { agent: { select: { id: true, name: true } } },
  });
  res.json(adjustments);
}));

// PATCH /payroll/adjustments/:id -- update an adjustment (CARRY-04)
router.patch("/payroll/adjustments/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const schema = z.object({
    bonusAmount: z.number().min(0).optional(),
    frontedAmount: z.number().min(0).optional(),
    holdAmount: z.number().min(0).optional(),
    bonusLabel: z.string().nullable().optional(),
    holdLabel: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const existing = await prisma.agentPeriodAdjustment.findUnique({ where: { id: pp.data.id } });
  if (!existing) return res.status(404).json({ error: "Adjustment not found" });
  // Clear carryover flags when amount is zeroed out
  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.holdAmount === 0) {
    updateData.holdFromCarryover = false;
    updateData.holdLabel = null;
  }
  if (parsed.data.bonusAmount === 0) {
    updateData.bonusFromCarryover = false;
    updateData.bonusLabel = null;
  }
  const updated = await prisma.agentPeriodAdjustment.update({
    where: { id: pp.data.id },
    data: updateData,
    include: { agent: { select: { id: true, name: true } } },
  });
  await logAudit(req.user!.id, "UPDATE", "AgentPeriodAdjustment", pp.data.id, parsed.data);
  res.json(updated);
}));

// POST /payroll/adjustments -- create/upsert adjustment for agent+period
router.post("/payroll/adjustments", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    agentId: z.string(),
    payrollPeriodId: z.string(),
    bonusAmount: z.number().min(0).optional().default(0),
    frontedAmount: z.number().min(0).optional().default(0),
    holdAmount: z.number().min(0).optional().default(0),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const adjustment = await prisma.agentPeriodAdjustment.upsert({
    where: { agentId_payrollPeriodId: { agentId: parsed.data.agentId, payrollPeriodId: parsed.data.payrollPeriodId } },
    create: parsed.data,
    update: {
      bonusAmount: parsed.data.bonusAmount,
      frontedAmount: parsed.data.frontedAmount,
      holdAmount: parsed.data.holdAmount,
    },
    include: { agent: { select: { id: true, name: true } } },
  });
  await logAudit(req.user!.id, "UPSERT", "AgentPeriodAdjustment", adjustment.id, parsed.data);
  res.status(201).json(adjustment);
}));

export default router;
