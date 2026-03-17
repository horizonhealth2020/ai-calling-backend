import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@ops/db";
import { buildLogoutCookie, buildSessionCookie, signSessionToken } from "@ops/auth";
import { requireAuth, requireRole } from "../middleware/auth";
import { upsertPayrollEntryForSale, handleCommissionZeroing, calculateCommission, getSundayWeekRange, handleSaleEditApproval, isAgentPaidInPeriod } from "../services/payroll";
import { logAudit } from "../services/audit";
import { reAuditCall } from "../services/callAudit";
import { enqueueAuditJob } from "../services/auditQueue";
import { emitSaleChanged } from "../socket";
import { computeTrend, shiftRange } from "../services/reporting";
import { fetchConvosoCallLogs, enrichWithTiers, filterByCallLength, filterByTier, buildKpiSummary, CallLengthTier } from "../services/convosoCallLogs";

const router = Router();

/** Format Zod errors so the response always includes an `error` key for dashboard display. */
function zodErr(ze: z.ZodError) {
  const flat = ze.flatten();
  const msg = flat.formErrors[0]
    || Object.values(flat.fieldErrors).flat()[0]
    || "Validation failed";
  return { error: msg, details: flat };
}

/** Wrap async route handlers so errors are forwarded to Express error handler */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

/** Compute date‐range boundaries from a `range` query param. */
function dateRange(range?: string): { gte: Date; lt: Date } | undefined {
  if (!range || !["today", "week", "month"].includes(range)) return undefined;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "today") {
    const lt = new Date(todayStart);
    lt.setDate(lt.getDate() + 1);
    return { gte: todayStart, lt };
  }
  if (range === "week") {
    // Sunday‑to‑Saturday week containing today
    const day = now.getDay(); // 0=Sun … 6=Sat
    const sunday = new Date(todayStart);
    sunday.setDate(todayStart.getDate() - day);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 7); // exclusive upper bound (next Sunday 00:00)
    return { gte: sunday, lt: saturday };
  }
  // month – rolling 30 days
  const thirtyAgo = new Date(todayStart);
  thirtyAgo.setDate(todayStart.getDate() - 30);
  const lt = new Date(todayStart);
  lt.setDate(lt.getDate() + 1);
  return { gte: thirtyAgo, lt };
}

router.post("/auth/login", asyncHandler(async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signSessionToken({ id: user.id, email: user.email, name: user.name, roles: user.roles as any });
  res.setHeader("Set-Cookie", buildSessionCookie(token));
  return res.json({ id: user.id, roles: user.roles, name: user.name, token });
}));

router.post("/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", buildLogoutCookie());
  return res.status(204).end();
});

router.post("/auth/change-password", asyncHandler(async (req, res) => {
  const schema = z.object({ email: z.string().email(), currentPassword: z.string().min(8), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.active) return res.status(401).json({ error: "Invalid credentials" });
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Current password is incorrect" });
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  await logAudit(user.id, "CHANGE_PASSWORD", "User", user.id);
  res.json({ success: true });
}));

router.get("/auth/refresh", requireAuth, asyncHandler(async (req, res) => {
  const user = req.user!;
  const token = signSessionToken({ id: user.id, email: user.email, name: user.name, roles: user.roles as any });
  res.setHeader("Set-Cookie", buildSessionCookie(token));
  return res.json({ token });
}));

router.get("/session/me", requireAuth, asyncHandler(async (req, res) => {
  res.json(req.user);
}));

const ROLE_ENUM = z.enum(["SUPER_ADMIN", "OWNER_VIEW", "MANAGER", "PAYROLL", "SERVICE", "ADMIN"]);
const USER_SELECT = { id: true, name: true, email: true, roles: true, active: true, createdAt: true };

router.get("/users", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  res.json(await prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: USER_SELECT }));
}));

router.post("/users", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    roles: z.array(ROLE_ENUM).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { password, ...rest } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({ data: { ...rest, passwordHash }, select: USER_SELECT });
    await logAudit(req.user!.id, "CREATE", "User", user.id, { email: rest.email, roles: rest.roles });
    return res.status(201).json(user);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Email already in use" });
    throw e;
  }
}));

router.patch("/users/:id", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    roles: z.array(ROLE_ENUM).min(1).optional(),
    active: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const { password, ...rest } = parsed.data;
  const data: any = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { id: req.params.id }, data, select: USER_SELECT });
  await logAudit(req.user!.id, "UPDATE", "User", user.id, { fields: Object.keys(rest) });
  return res.json(user);
}));

router.delete("/users/:id", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(async (req, res) => {
  await prisma.user.delete({ where: { id: req.params.id } });
  await logAudit(req.user!.id, "DELETE", "User", req.params.id);
  return res.status(204).end();
}));

router.get("/agents", requireAuth, asyncHandler(async (req, res) => {
  const includeInactive = req.query.all === "true";
  res.json(await prisma.agent.findMany({ where: includeInactive ? {} : { active: true }, orderBy: { displayOrder: "asc" } }));
}));

router.post("/agents", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().min(1), email: z.string().optional(), userId: z.string().optional(), extension: z.string().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const count = await prisma.agent.count();
  try {
    const agent = await prisma.agent.create({ data: { ...parsed.data, displayOrder: count } });
    res.status(201).json(agent);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "An agent with this email already exists" });
    throw e;
  }
}));

router.delete("/agents/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  await prisma.agent.update({ where: { id: req.params.id }, data: { active: false, email: null } });
  await logAudit(req.user!.id, "DELETE", "Agent", req.params.id);
  return res.status(204).end();
}));

router.patch("/agents/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().min(1).optional(), email: z.string().nullable().optional(), userId: z.string().nullable().optional(), extension: z.string().nullable().optional(), auditEnabled: z.boolean().optional(), active: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  try {
    const agent = await prisma.agent.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(agent);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "An agent with this email already exists" });
    throw e;
  }
}));

router.get("/lead-sources", requireAuth, asyncHandler(async (_req, res) => res.json(await prisma.leadSource.findMany({ where: { active: true } }))));

router.post("/lead-sources", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().min(1), listId: z.string().optional(), costPerLead: z.number().min(0).default(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  try {
    const ls = await prisma.leadSource.create({ data: { ...parsed.data, effectiveDate: new Date() } });
    await logAudit(req.user?.id ?? null, "CREATE", "LeadSource", ls.id, { name: ls.name });
    res.status(201).json(ls);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "A lead source with this name already exists" });
    throw e;
  }
}));

router.patch("/lead-sources/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().min(1).optional(), listId: z.string().nullable().optional(), costPerLead: z.number().min(0).optional(), callBufferSeconds: z.number().int().min(0).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  try {
    const ls = await prisma.leadSource.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(ls);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "A lead source with this name already exists" });
    throw e;
  }
}));

router.delete("/lead-sources/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  await prisma.leadSource.update({ where: { id: req.params.id }, data: { active: false } });
  await logAudit(req.user!.id, "DELETE", "LeadSource", req.params.id);
  return res.status(204).end();
}));

router.get("/products", requireAuth, asyncHandler(async (_req, res) => res.json(await prisma.product.findMany())));

router.post("/products", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    type: z.enum(["CORE", "ADDON", "AD_D"]).default("CORE"),
    premiumThreshold: z.number().min(0).nullable().optional(),
    commissionBelow: z.number().min(0).max(100).nullable().optional(),
    commissionAbove: z.number().min(0).max(100).nullable().optional(),
    bundledCommission: z.number().min(0).max(100).nullable().optional(),
    standaloneCommission: z.number().min(0).max(100).nullable().optional(),
    enrollFeeThreshold: z.number().min(0).nullable().optional(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  try {
    const product = await prisma.product.create({ data: parsed.data });
    await logAudit(req.user!.id, "CREATE", "Product", product.id, { name: product.name });
    res.status(201).json(product);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "A product with this name already exists" });
    throw e;
  }
}));

router.patch("/products/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    active: z.boolean().optional(),
    type: z.enum(["CORE", "ADDON", "AD_D"]).optional(),
    premiumThreshold: z.number().min(0).nullable().optional(),
    commissionBelow: z.number().min(0).max(100).nullable().optional(),
    commissionAbove: z.number().min(0).max(100).nullable().optional(),
    bundledCommission: z.number().min(0).max(100).nullable().optional(),
    standaloneCommission: z.number().min(0).max(100).nullable().optional(),
    enrollFeeThreshold: z.number().min(0).nullable().optional(),
    notes: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  try {
    const product = await prisma.product.update({ where: { id: req.params.id }, data: parsed.data });
    res.json(product);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "A product with this name already exists" });
    throw e;
  }
}));

router.delete("/products/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { active: false } });
  await logAudit(req.user!.id, "DELETE", "Product", req.params.id);
  return res.status(204).end();
}));

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
      include: { period: { select: { id: true, weekStart: true, weekEnd: true } } },
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
  });
  const parsed = previewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product) return res.status(404).json({ error: "Product not found" });

  const uniqueAddonIds = [...new Set(parsed.data.addonProductIds)];
  const addonProducts = uniqueAddonIds.length > 0
    ? await prisma.product.findMany({ where: { id: { in: uniqueAddonIds } } })
    : [];

  const mockSale = {
    premium: parsed.data.premium,
    enrollmentFee: parsed.data.enrollmentFee ?? null,
    commissionApproved: parsed.data.commissionApproved,
    status: parsed.data.status,
    product,
    addons: addonProducts.map(p => ({
      product: p,
      premium: parsed.data.addonPremiums[p.id] ?? 0,
    })),
  } as any;

  const commission = calculateCommission(mockSale);

  const saleDate = parsed.data.saleDate ? new Date(parsed.data.saleDate + "T12:00:00") : new Date();
  const shiftWeeks = parsed.data.paymentType === "ACH" ? 1 : 0;
  const { weekStart, weekEnd } = getSundayWeekRange(saleDate, shiftWeeks);

  const hasBundleQualifier = [product, ...addonProducts].some(p => p.isBundleQualifier);
  const hasCore = product.type === "CORE" || addonProducts.some(p => p.type === "CORE");

  res.json({
    commission,
    periodStart: weekStart,
    periodEnd: weekEnd,
    breakdown: {
      hasBundleQualifier,
      hasCore,
      enrollmentFee: parsed.data.enrollmentFee ?? null,
      paymentType: parsed.data.paymentType,
      status: parsed.data.status,
    },
  });
}));

router.get("/sales", requireAuth, asyncHandler(async (req, res) => {
  const dr = dateRange(req.query.range as string | undefined);
  const where = dr ? { saleDate: { gte: dr.gte, lt: dr.lt } } : {};
  const sales = await prisma.sale.findMany({
    where,
    include: {
      agent: true, product: true, leadSource: true,
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
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
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
    notes: z.string().nullable().optional(),
    commissionApproved: z.boolean().optional(),
  });
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const saleId = req.params.id;
  const userRoles: string[] = (req.user as any)?.roles ?? [];
  const isPrivileged = userRoles.includes("PAYROLL") || userRoles.includes("SUPER_ADMIN");

  if (isPrivileged) {
    // ── PAYROLL / SUPER_ADMIN: apply directly ──
    const { addonProductIds, addonPremiums, ...saleFields } = parsed.data;
    const updateData: any = { ...saleFields };
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
    const needsRecalc = financialFields.some(f => (parsed.data as any)[f] !== undefined);
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
    const changes: Record<string, { old: any; new: any }> = {};
    const data = parsed.data;

    const fieldMap: Record<string, (sale: any) => any> = {
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
      notes: s => s.notes,
      commissionApproved: s => s.commissionApproved,
    };

    for (const [field, getter] of Object.entries(fieldMap)) {
      if ((data as any)[field] !== undefined) {
        const oldVal = getter(currentSale);
        const newVal = (data as any)[field];
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
        changes,
      },
    });

    res.json({ editRequest, message: "Edit request created for payroll approval" });
  }
}));

router.delete("/sales/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const saleId = req.params.id;
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
  const schema = z.object({ status: z.enum(["RAN", "DECLINED", "DEAD"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const sale = await prisma.sale.findUnique({ where: { id: req.params.id } });
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
  const schema = z.object({ approved: z.boolean().default(true) });
  const parsed = schema.safeParse(req.body);
  const approved = parsed.success ? parsed.data.approved : true;
  const sale = await prisma.sale.update({
    where: { id: req.params.id },
    data: { commissionApproved: approved },
  });
  await upsertPayrollEntryForSale(sale.id);
  await logAudit(req.user!.id, approved ? "APPROVE_COMMISSION" : "REVOKE_COMMISSION", "Sale", sale.id);
  res.json(sale);
}));

router.patch("/sales/:id/unapprove-commission", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const sale = await prisma.sale.update({
    where: { id: req.params.id },
    data: { commissionApproved: false },
  });
  await upsertPayrollEntryForSale(sale.id);
  await logAudit(req.user!.id, "UNAPPROVE_COMMISSION", "Sale", sale.id);
  res.json(sale);
}));

router.get("/tracker/summary", requireAuth, asyncHandler(async (req, res) => {
  const dr = dateRange(req.query.range as string | undefined);
  const salesWhere = dr ? { saleDate: { gte: dr.gte, lt: dr.lt } } : undefined;
  const callWhere: any = { agentId: { not: null }, leadSourceId: { not: null } };
  if (dr) callWhere.callTimestamp = { gte: dr.gte, lt: dr.lt };

  // Fetch agents with sales, call logs, and commission totals in parallel
  const [data, allLeadSources, callLogs, commissionByAgent] = await Promise.all([
    prisma.agent.findMany({
      where: { active: true },
      include: { sales: { where: salesWhere } },
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
  ]);
  const commMap = new Map(commissionByAgent.map(c => [c.agentId, Number(c._sum.payoutAmount ?? 0)]));

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
    const premiumTotal = agent.sales.reduce((sum, s) => sum + Number(s.premium), 0);
    const totalLeadCost = agentLeadCost.get(agent.id) ?? 0;
    return {
      agent: agent.name,
      salesCount,
      premiumTotal,
      totalLeadCost,
      costPerSale: salesCount > 0 ? totalLeadCost / salesCount : 0,
      commissionTotal: commMap.get(agent.id) ?? 0,
    };
  });
  res.json(summary);
}));

router.get("/payroll/periods", requireAuth, requireRole("PAYROLL", "MANAGER", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  res.json(await prisma.payrollPeriod.findMany({
    include: {
      entries: {
        include: {
          sale: { select: { id: true, memberName: true, memberId: true, carrier: true, premium: true, enrollmentFee: true, commissionApproved: true, status: true, notes: true, product: { select: { id: true, name: true, type: true } }, addons: { select: { product: { select: { id: true, name: true, type: true } } } } } },
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

router.post("/payroll/mark-paid", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const { entryIds, serviceEntryIds } = z.object({
    entryIds: z.array(z.string()).optional().default([]),
    serviceEntryIds: z.array(z.string()).optional().default([]),
  }).parse(req.body);

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
  const { entryIds, serviceEntryIds } = z.object({
    entryIds: z.array(z.string()).optional().default([]),
    serviceEntryIds: z.array(z.string()).optional().default([]),
  }).parse(req.body);

  if (entryIds.length === 0 && serviceEntryIds.length === 0) {
    return res.status(400).json({ error: "No entry IDs provided" });
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
  const payload = z.object({ memberId: z.string().optional(), memberName: z.string().optional(), notes: z.string().optional() }).parse(req.body);
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
  // Guard: reject edits if agent is already marked paid in this period
  const agentPaid = await isAgentPaidInPeriod(entry.agentId, entry.payrollPeriodId);
  if (agentPaid) {
    return res.status(400).json({ error: "Agent already marked paid for this period" });
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

// ── Service Agents ──────────────────────────────────────────────
router.get("/service-agents", requireAuth, asyncHandler(async (_req, res) => {
  res.json(await prisma.serviceAgent.findMany({ orderBy: { name: "asc" } }));
}));

router.post("/service-agents", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().min(1), basePay: z.number().min(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const agent = await prisma.serviceAgent.create({ data: parsed.data });
  await logAudit(req.user!.id, "CREATE", "ServiceAgent", agent.id, { name: agent.name });
  res.status(201).json(agent);
}));

router.patch("/service-agents/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().min(1).optional(), basePay: z.number().min(0).optional(), active: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const agent = await prisma.serviceAgent.update({ where: { id: req.params.id }, data: parsed.data });
  await logAudit(req.user!.id, "UPDATE", "ServiceAgent", agent.id, parsed.data);
  res.json(agent);
}));

// ── Service Payroll Entries ─────────────────────────────────────
// ── Service Bonus Category Settings ──────────────────────────────
const DEFAULT_BONUS_CATEGORIES = [
  { name: "Flips", isDeduction: false },
  { name: "Saves", isDeduction: false },
  { name: "Team Lead", isDeduction: false },
  { name: "Cancel Bonus", isDeduction: false },
  { name: "Avg Talk Time", isDeduction: false },
  { name: "Most Calls", isDeduction: false },
  { name: "On Time", isDeduction: false },
  { name: "Out", isDeduction: true },
];

router.get("/settings/service-bonus-categories", requireAuth, asyncHandler(async (_req, res) => {
  const setting = await prisma.salesBoardSetting.findUnique({ where: { key: "service_bonus_categories" } });
  if (setting) return res.json(JSON.parse(setting.value));
  res.json(DEFAULT_BONUS_CATEGORIES);
}));

router.put("/settings/service-bonus-categories", requireAuth, requireRole("PAYROLL", "MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ categories: z.array(z.object({ name: z.string().min(1), isDeduction: z.boolean() })).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  await prisma.salesBoardSetting.upsert({
    where: { key: "service_bonus_categories" },
    create: { key: "service_bonus_categories", value: JSON.stringify(parsed.data.categories) },
    update: { value: JSON.stringify(parsed.data.categories) },
  });
  await logAudit(req.user!.id, "UPDATE", "SalesBoardSetting", "service_bonus_categories", { categories: parsed.data.categories });
  res.json(parsed.data.categories);
}));

router.get("/payroll/service-entries", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  res.json(await prisma.servicePayrollEntry.findMany({
    include: { serviceAgent: true, payrollPeriod: true },
    orderBy: { createdAt: "desc" },
  }));
}));

router.post("/payroll/service-entries", requireAuth, requireRole("PAYROLL", "MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    serviceAgentId: z.string(),
    payrollPeriodId: z.string(),
    bonusAmount: z.number().min(0).default(0),
    deductionAmount: z.number().min(0).default(0),
    frontedAmount: z.number().min(0).default(0),
    bonusBreakdown: z.record(z.string(), z.number()).optional(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const agent = await prisma.serviceAgent.findUnique({ where: { id: parsed.data.serviceAgentId } });
  if (!agent) return res.status(404).json({ error: "Service agent not found" });
  const basePay = Number(agent.basePay);
  const frontedAmt = parsed.data.frontedAmount;

  let bonusAmount = parsed.data.bonusAmount;
  let deductionAmount = parsed.data.deductionAmount;
  let totalPay = basePay + bonusAmount - deductionAmount - frontedAmt;
  const breakdown = parsed.data.bonusBreakdown;

  if (breakdown) {
    const setting = await prisma.salesBoardSetting.findUnique({ where: { key: "service_bonus_categories" } });
    const cats: { name: string; isDeduction: boolean }[] = setting ? JSON.parse(setting.value) : DEFAULT_BONUS_CATEGORIES;
    const deductionNames = new Set(cats.filter(c => c.isDeduction).map(c => c.name));
    let adds = 0, deductions = 0;
    for (const [cat, amt] of Object.entries(breakdown)) {
      if (deductionNames.has(cat)) deductions += amt;
      else adds += amt;
    }
    bonusAmount = adds;
    deductionAmount = deductions;
    totalPay = basePay + adds - deductions - frontedAmt;
  }

  const entry = await prisma.servicePayrollEntry.upsert({
    where: { payrollPeriodId_serviceAgentId: { payrollPeriodId: parsed.data.payrollPeriodId, serviceAgentId: parsed.data.serviceAgentId } },
    create: { serviceAgentId: parsed.data.serviceAgentId, payrollPeriodId: parsed.data.payrollPeriodId, basePay, bonusAmount, deductionAmount, frontedAmount: frontedAmt, totalPay, bonusBreakdown: breakdown ?? undefined, notes: parsed.data.notes },
    update: { bonusAmount, deductionAmount, frontedAmount: frontedAmt, totalPay, bonusBreakdown: breakdown ?? undefined, notes: parsed.data.notes },
    include: { serviceAgent: true },
  });
  res.status(201).json(entry);
}));

router.patch("/payroll/service-entries/:id", requireAuth, requireRole("PAYROLL", "MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    bonusAmount: z.number().min(0).optional(),
    deductionAmount: z.number().min(0).optional(),
    frontedAmount: z.number().min(0).optional(),
    bonusBreakdown: z.record(z.string(), z.number()).optional(),
    notes: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const entry = await prisma.servicePayrollEntry.findUnique({ where: { id: req.params.id }, include: { serviceAgent: true } });
  if (!entry) return res.status(404).json({ error: "Entry not found" });

  const breakdown = parsed.data.bonusBreakdown;
  const fronted = parsed.data.frontedAmount ?? Number(entry.frontedAmount);
  let bonus = parsed.data.bonusAmount ?? Number(entry.bonusAmount);
  let deduction = parsed.data.deductionAmount ?? Number(entry.deductionAmount);
  let totalPay = Number(entry.basePay) + bonus - deduction - fronted;

  if (breakdown) {
    const setting = await prisma.salesBoardSetting.findUnique({ where: { key: "service_bonus_categories" } });
    const cats: { name: string; isDeduction: boolean }[] = setting ? JSON.parse(setting.value) : DEFAULT_BONUS_CATEGORIES;
    const deductionNames = new Set(cats.filter(c => c.isDeduction).map(c => c.name));
    let adds = 0, deductions = 0;
    for (const [cat, amt] of Object.entries(breakdown)) {
      if (deductionNames.has(cat)) deductions += amt;
      else adds += amt;
    }
    bonus = adds;
    deduction = deductions;
    totalPay = Number(entry.basePay) + adds - deductions - fronted;
  }

  const updated = await prisma.servicePayrollEntry.update({
    where: { id: req.params.id },
    data: { bonusAmount: bonus, deductionAmount: deduction, frontedAmount: fronted, totalPay, bonusBreakdown: breakdown ?? undefined, notes: parsed.data.notes ?? entry.notes },
    include: { serviceAgent: true },
  });
  res.json(updated);
}));

router.get("/owner/summary", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const dr = dateRange(req.query.range as string | undefined);

  async function fetchSummaryData(range: { gte: Date; lt: Date } | undefined) {
    const saleWhere = range ? { status: 'RAN' as const, saleDate: { gte: range.gte, lt: range.lt } } : { status: 'RAN' as const };
    const clawbackWhere = range ? { createdAt: { gte: range.gte, lt: range.lt } } : {};
    const [salesCount, premiumAgg, clawbacks, openPayrollPeriods] = await Promise.all([
      prisma.sale.count({ where: saleWhere }),
      prisma.sale.aggregate({ _sum: { premium: true }, where: saleWhere }),
      prisma.clawback.count({ where: clawbackWhere }),
      prisma.payrollPeriod.count({ where: { status: "OPEN" } }),
    ]);
    return { salesCount, premiumTotal: Number(premiumAgg._sum.premium ?? 0), clawbacks, openPayrollPeriods };
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

  res.json({ ...current, trends });
}));

router.get("/reporting/periods", requireAuth, requireRole("MANAGER", "OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const view = req.query.view === "monthly" ? "monthly" : "weekly";

  if (view === "weekly") {
    const periods = await prisma.payrollPeriod.findMany({
      include: {
        entries: {
          include: { sale: { select: { premium: true, status: true } } },
        },
      },
      orderBy: { weekStart: "desc" },
      take: 12,
    });
    const result = periods.map(p => {
      const ranEntries = p.entries.filter(e => e.sale?.status === 'RAN');
      return {
        period: `${p.weekStart.toISOString().slice(0, 10)} - ${p.weekEnd.toISOString().slice(0, 10)}`,
        salesCount: ranEntries.length,
        premiumTotal: ranEntries.reduce((s, e) => s + Number(e.sale?.premium ?? 0), 0),
        commissionPaid: ranEntries.reduce((s, e) => s + Number(e.netAmount), 0),
        periodStatus: p.status,
      };
    });
    return res.json({ view, periods: result });
  }

  // Monthly: raw SQL for calendar month grouping
  const monthlySales = await prisma.$queryRaw`
    SELECT
      TO_CHAR(s.sale_date, 'YYYY-MM') as period,
      COUNT(*)::int as "salesCount",
      COALESCE(SUM(s.premium), 0)::float as "premiumTotal",
      COALESCE(SUM(pe.net_amount), 0)::float as "commissionPaid"
    FROM sales s
    LEFT JOIN payroll_entries pe ON pe.sale_id = s.id
    WHERE s.status = 'RAN'
    GROUP BY TO_CHAR(s.sale_date, 'YYYY-MM')
    ORDER BY period DESC
    LIMIT 6
  `;
  return res.json({ view, periods: monthlySales });
}));

router.get("/sales-board/summary", asyncHandler(async (_req, res) => {
  const agents = await prisma.agent.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } });
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const [daily, weekly] = await Promise.all([
    prisma.sale.groupBy({ by: ["agentId"], _count: { id: true }, _sum: { premium: true }, where: { status: 'RAN', saleDate: { gte: new Date(Date.now() - 86400000) } } }),
    prisma.sale.groupBy({ by: ["agentId"], _count: { id: true }, _sum: { premium: true }, where: { status: 'RAN', saleDate: { gte: new Date(Date.now() - 7 * 86400000) } } }),
  ]);
  const fmt = (rows: typeof daily) =>
    rows
      .map((r) => ({ agent: agentMap.get(r.agentId) ?? r.agentId, count: r._count.id, premium: Number(r._sum.premium ?? 0) }))
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
    where: { status: 'RAN', saleDate: { gte: monday, lt: sunday } },
    select: { agentId: true, saleDate: true, premium: true },
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
        daySales[name].premium += Number(s.premium ?? 0);
        totalSales++;
        totalPremium += Number(s.premium ?? 0);
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
    weeklyTotals[name].premium += Number(s.premium ?? 0);
    grandTotalSales++;
    grandTotalPremium += Number(s.premium ?? 0);
  }

  // Daily view: today stats per agent
  const todayStats: Record<string, { count: number; premium: number }> = {};
  for (const s of sales) {
    const sd = new Date(s.saleDate);
    if (sd >= todayStart && sd < todayEnd) {
      const name = agentMap.get(s.agentId) ?? s.agentId;
      if (!todayStats[name]) todayStats[name] = { count: 0, premium: 0 };
      todayStats[name].count++;
      todayStats[name].premium += Number(s.premium ?? 0);
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

// ── Convoso Webhook ─────────────────────────────────────────────
const requireWebhookSecret = (req: Request, res: Response, next: NextFunction) => {
  const secret = process.env.CONVOSO_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "Webhook secret not configured" });
  const provided = req.headers["x-webhook-secret"] || req.query.api_key;
  if (provided !== secret) return res.status(401).json({ error: "Invalid webhook secret" });
  return next();
};

router.post("/webhooks/convoso", requireWebhookSecret, asyncHandler(async (req, res) => {
  const schema = z.object({
    agent_user: z.string().min(1),
    list_id: z.string().min(1),
    recording_url: z.string().optional(),
    call_timestamp: z.string().optional(),
    call_duration_seconds: z.number().int().min(0).optional(),
    member_id: z.string().optional(),
    lead_id: z.union([z.number(), z.string()]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { agent_user, list_id, recording_url, call_timestamp, call_duration_seconds, member_id, lead_id } = parsed.data;

  // Resolve agent by email (CRM User ID)
  const agent = await prisma.agent.findUnique({ where: { email: agent_user } });
  // Resolve lead source by listId (CRM List ID)
  const leadSource = await prisma.leadSource.findFirst({ where: { listId: list_id } });

  const log = await prisma.convosoCallLog.create({
    data: {
      agentUser: agent_user,
      listId: list_id,
      recordingUrl: recording_url,
      callDurationSeconds: call_duration_seconds ?? null,
      callTimestamp: call_timestamp ? new Date(call_timestamp) : new Date(),
      agentId: agent?.id ?? null,
      leadSourceId: leadSource?.id ?? null,
    },
  });

  // If member_id is provided, also update the matching sale with recording data
  if (member_id) {
    const sale = await prisma.sale.findFirst({ where: { memberId: member_id }, orderBy: { saleDate: "desc" } });
    if (sale) {
      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          recordingUrl: recording_url || undefined,
          callDuration: call_duration_seconds ?? undefined,
          callDateTime: call_timestamp ? new Date(call_timestamp) : undefined,
          convosoLeadId: lead_id != null ? String(lead_id) : undefined,
        },
      });
    }
  }

  // Check audit eligibility: agent must be matched AND have auditEnabled
  let auditEligible = !!(recording_url && agent?.auditEnabled);

  // Check min/max duration filters from settings
  if (auditEligible && call_duration_seconds !== undefined) {
    const [minSetting, maxSetting] = await Promise.all([
      prisma.salesBoardSetting.findUnique({ where: { key: "audit_min_seconds" } }),
      prisma.salesBoardSetting.findUnique({ where: { key: "audit_max_seconds" } }),
    ]);
    const minSec = minSetting ? parseInt(minSetting.value, 10) : 0;
    const maxSec = maxSetting ? parseInt(maxSetting.value, 10) : 0;
    if (minSec > 0 && call_duration_seconds < minSec) auditEligible = false;
    if (maxSec > 0 && call_duration_seconds > maxSec) auditEligible = false;
  }

  if (auditEligible) {
    enqueueAuditJob(log.id);
  } else if (!auditEligible && recording_url) {
    // Mark as skipped so it doesn't sit as "pending"
    await prisma.convosoCallLog.update({ where: { id: log.id }, data: { auditStatus: "skipped" } });
  }

  return res.status(201).json({ id: log.id, matched: { agent: !!agent, leadSource: !!leadSource } });
}));

// ── Call Recordings (sales with attached recording data) ─────────
router.get("/call-recordings", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const dr = dateRange(req.query.range as string | undefined);
  const where: any = { recordingUrl: { not: null } };
  if (dr) where.callDateTime = { gte: dr.gte, lt: dr.lt };
  const recordings = await prisma.sale.findMany({
    where,
    select: {
      id: true, memberName: true, memberId: true, status: true, recordingUrl: true,
      callDuration: true, callDateTime: true, convosoLeadId: true,
      agent: { select: { name: true, email: true } },
      product: { select: { name: true } },
    },
    orderBy: { callDateTime: "desc" },
    take: 200,
  });
  res.json(recordings);
}));

// ── Call Audits ─────────────────────────────────────────────────
router.get("/call-audits", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const dr = dateRange(req.query.range as string | undefined);
  const where: any = {};
  if (dr) where.callDate = { gte: dr.gte, lt: dr.lt };
  if (req.query.agentId) where.agentId = req.query.agentId;

  const audits = await prisma.callAudit.findMany({
    where,
    include: { agent: { select: { id: true, name: true } } },
    orderBy: { callDate: "desc" },
  });
  res.json(audits);
}));

router.get("/call-audits/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const audit = await prisma.callAudit.findUnique({
    where: { id: req.params.id },
    include: {
      agent: { select: { id: true, name: true } },
      convosoCallLog: { select: { id: true, callDurationSeconds: true, agentUser: true, listId: true, callTimestamp: true, auditStatus: true } },
    },
  });
  if (!audit) return res.status(404).json({ error: "Audit not found" });
  res.json(audit);
}));

router.patch("/call-audits/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    score: z.number().min(0).max(100).optional(),
    status: z.string().min(1).optional(),
    coachingNotes: z.string().nullable().optional(),
    callOutcome: z.enum(["sold", "callback_scheduled", "lost", "not_qualified", "incomplete"]).optional(),
    managerSummary: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const audit = await prisma.callAudit.update({
    where: { id: req.params.id },
    data: { ...parsed.data, reviewerUserId: req.user!.id },
    include: { agent: { select: { id: true, name: true } } },
  });
  await logAudit(req.user!.id, "UPDATE", "CallAudit", audit.id, parsed.data);
  res.json(audit);
}));

router.post("/call-audits/:id/re-audit", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  await reAuditCall(req.params.id);
  const audit = await prisma.callAudit.findUnique({
    where: { id: req.params.id },
    include: { agent: { select: { id: true, name: true } } },
  });
  await logAudit(req.user!.id, "RE_AUDIT", "CallAudit", req.params.id, {});
  res.json(audit);
}));

// ── Call Counts (Convoso aggregation) ───────────────────────────
router.get("/call-counts", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const dr = dateRange(req.query.range as string | undefined);
  const where: any = { agentId: { not: null }, leadSourceId: { not: null } };
  if (dr) where.callTimestamp = { gte: dr.gte, lt: dr.lt };

  // Get all lead sources to apply per-source buffer filtering
  const allLeadSources = await prisma.leadSource.findMany({
    select: { id: true, name: true, costPerLead: true, callBufferSeconds: true },
  });
  const lsMap = new Map(allLeadSources.map(ls => [ls.id, { name: ls.name, costPerLead: Number(ls.costPerLead), callBufferSeconds: ls.callBufferSeconds }]));

  // Fetch raw call logs (not groupBy) so we can filter by per-source buffer
  const logs = await prisma.convosoCallLog.findMany({
    where,
    select: { agentId: true, leadSourceId: true, callDurationSeconds: true },
  });

  // Aggregate counts, filtering out calls shorter than the lead source buffer
  const countMap = new Map<string, number>();
  for (const log of logs) {
    const lsInfo = lsMap.get(log.leadSourceId!);
    const buffer = lsInfo?.callBufferSeconds ?? 0;
    if (buffer > 0 && log.callDurationSeconds !== null && log.callDurationSeconds < buffer) continue;
    const key = `${log.agentId}|${log.leadSourceId}`;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  const agentIds = [...new Set(logs.map(l => l.agentId!))];
  const agents = await prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } });
  const agentMap = new Map(agents.map(a => [a.id, a.name]));

  const result = [...countMap.entries()].map(([key, count]) => {
    const [agentId, leadSourceId] = key.split("|");
    const ls = lsMap.get(leadSourceId) ?? { name: "Unknown", costPerLead: 0, callBufferSeconds: 0 };
    return {
      agentId,
      agentName: agentMap.get(agentId) ?? "Unknown",
      leadSourceId,
      leadSourceName: ls.name,
      callCount: count,
      totalLeadCost: ls.costPerLead * count,
    };
  });

  res.json(result);
}));

// ── AI Audit System Prompt Settings ─────────────────────────────
router.get("/settings/ai-audit-prompt", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const setting = await prisma.salesBoardSetting.findUnique({ where: { key: "ai_audit_system_prompt" } });
  res.json({ prompt: setting?.value ?? "" });
}));

router.put("/settings/ai-audit-prompt", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ prompt: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  await prisma.salesBoardSetting.upsert({
    where: { key: "ai_audit_system_prompt" },
    create: { key: "ai_audit_system_prompt", value: parsed.data.prompt },
    update: { value: parsed.data.prompt },
  });
  await logAudit(req.user!.id, "UPDATE", "SalesBoardSetting", "ai_audit_system_prompt");
  res.json({ prompt: parsed.data.prompt });
}));

// ── Audit Duration Filter Settings ──────────────────────────────
router.get("/settings/audit-duration", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const [minS, maxS] = await Promise.all([
    prisma.salesBoardSetting.findUnique({ where: { key: "audit_min_seconds" } }),
    prisma.salesBoardSetting.findUnique({ where: { key: "audit_max_seconds" } }),
  ]);
  res.json({ minSeconds: minS ? parseInt(minS.value, 10) : 0, maxSeconds: maxS ? parseInt(maxS.value, 10) : 0 });
}));

router.put("/settings/audit-duration", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ minSeconds: z.number().int().min(0), maxSeconds: z.number().int().min(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  await Promise.all([
    prisma.salesBoardSetting.upsert({
      where: { key: "audit_min_seconds" },
      create: { key: "audit_min_seconds", value: String(parsed.data.minSeconds) },
      update: { value: String(parsed.data.minSeconds) },
    }),
    prisma.salesBoardSetting.upsert({
      where: { key: "audit_max_seconds" },
      create: { key: "audit_max_seconds", value: String(parsed.data.maxSeconds) },
      update: { value: String(parsed.data.maxSeconds) },
    }),
  ]);
  await logAudit(req.user!.id, "UPDATE", "SalesBoardSetting", "audit_duration_filter");
  res.json(parsed.data);
}));

// ── Status Change Requests (approval workflow) ─────────────────
router.get("/status-change-requests", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const status = (req.query.status as string) || "PENDING";
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
  const changeRequest = await prisma.statusChangeRequest.findUnique({ where: { id: req.params.id } });
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
  const changeRequest = await prisma.statusChangeRequest.findUnique({ where: { id: req.params.id } });
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
  const status = (req.query.status as string) || "PENDING";
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
  const editRequest = await prisma.saleEditRequest.findUnique({
    where: { id: req.params.id },
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
  const editRequest = await prisma.saleEditRequest.findUnique({ where: { id: req.params.id } });
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

// ---------------------------------------------------------------------------
// Convoso Call Logs
// ---------------------------------------------------------------------------

const callLogsQuerySchema = z.object({
  queue_id: z.string().min(1, "queue_id is required"),
  list_id: z.string().min(1, "list_id is required"),
});

const CALL_LOG_PASS_THROUGH_PARAMS = [
  "id", "lead_id", "campaign_id", "user_id", "status", "phone_number",
  "number_dialed", "first_name", "last_name", "start_time", "end_time",
  "limit", "offset", "order",
] as const;

function buildConvosoParams(query: Record<string, any>): Record<string, string> {
  const params: Record<string, string> = {
    queue_id: query.queue_id,
    list_id: query.list_id,
    call_type: (query.call_type as string) || "INBOUND",
    called_count: (query.called_count as string) || "0",
    include_recordings: (query.include_recordings as string) || "1",
  };
  for (const key of CALL_LOG_PASS_THROUGH_PARAMS) {
    if (query[key] !== undefined && query[key] !== "") {
      params[key] = String(query[key]);
    }
  }
  return params;
}

function extractConvosoResults(response: any): any[] {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response)) return response;
  return [];
}

function tierBreakdown(records: { call_length_tier: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of records) {
    counts[r.call_length_tier] = (counts[r.call_length_tier] || 0) + 1;
  }
  return counts;
}

// KPI route registered first to avoid Express treating /kpi as a param on /call-logs
router.get("/call-logs/kpi", requireAuth, asyncHandler(async (req, res) => {
  const parsed = callLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { queue_id, list_id } = parsed.data;
  const minCallLength = req.query.min_call_length ? Number(req.query.min_call_length) : undefined;
  const maxCallLength = req.query.max_call_length ? Number(req.query.max_call_length) : undefined;
  const tierParam = req.query.tier as CallLengthTier | undefined;

  try {
    const params = buildConvosoParams(req.query);
    const response = await fetchConvosoCallLogs(params);
    const raw = extractConvosoResults(response);

    let enriched = enrichWithTiers(raw);
    if (minCallLength !== undefined || maxCallLength !== undefined) {
      enriched = filterByCallLength(enriched, minCallLength, maxCallLength);
    }
    if (tierParam) {
      enriched = filterByTier(enriched, tierParam);
    }

    // Fetch agents and lead source for agent-aware KPI aggregation
    const agents = await prisma.agent.findMany({ where: { active: true }, select: { id: true, name: true, email: true } });
    const agentMap = new Map(agents.filter(a => a.email).map(a => [a.email!, { id: a.id, name: a.name }]));
    let costPerLead = 0;
    if (list_id) {
      const leadSource = await prisma.leadSource.findFirst({ where: { listId: list_id } });
      costPerLead = leadSource?.costPerLead ? Number(leadSource.costPerLead) : 0;
    }

    const kpiResponse = buildKpiSummary(enriched, { agentMap, costPerLead });

    console.log(JSON.stringify({
      event: "call_logs_kpi_fetch",
      queue_id,
      list_id,
      timestamp: new Date().toISOString(),
      total_results: enriched.length,
      tier_breakdown: tierBreakdown(enriched),
      summary: kpiResponse.summary,
    }));

    return res.json({ success: true, ...kpiResponse });
  } catch (err: any) {
    if (err.message?.includes("CONVOSO_AUTH_TOKEN")) {
      return res.status(500).json({ error: "Convoso integration not configured" });
    }
    return res.status(502).json({ error: "Failed to fetch from Convoso", details: err.message });
  }
}));

router.get("/call-logs", requireAuth, asyncHandler(async (req, res) => {
  const parsed = callLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { queue_id, list_id } = parsed.data;
  const minCallLength = req.query.min_call_length ? Number(req.query.min_call_length) : undefined;
  const maxCallLength = req.query.max_call_length ? Number(req.query.max_call_length) : undefined;
  const tierParam = req.query.tier as CallLengthTier | undefined;

  try {
    const params = buildConvosoParams(req.query);
    const response = await fetchConvosoCallLogs(params);
    const raw = extractConvosoResults(response);

    let enriched = enrichWithTiers(raw);
    if (minCallLength !== undefined || maxCallLength !== undefined) {
      enriched = filterByCallLength(enriched, minCallLength, maxCallLength);
    }
    if (tierParam) {
      enriched = filterByTier(enriched, tierParam);
    }

    console.log(JSON.stringify({
      event: "call_logs_fetch",
      queue_id,
      list_id,
      timestamp: new Date().toISOString(),
      total_results: enriched.length,
      tier_breakdown: tierBreakdown(enriched),
    }));

    return res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err: any) {
    if (err.message?.includes("CONVOSO_AUTH_TOKEN")) {
      return res.status(500).json({ error: "Convoso integration not configured" });
    }
    return res.status(502).json({ error: "Failed to fetch from Convoso", details: err.message });
  }
}));

// ─── Chargebacks ──────────────────────────────────────────────────

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

  return res.status(201).json({ count: result.count, batchId });
}));

router.delete("/chargebacks/:id", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  await prisma.chargebackSubmission.delete({ where: { id: req.params.id } });
  return res.status(204).end();
}));

router.get("/chargebacks", requireAuth, asyncHandler(async (_req, res) => {
  const records = await prisma.chargebackSubmission.findMany({
    orderBy: { submittedAt: "desc" },
    take: 200,
  });
  return res.json(records);
}));

router.get("/chargebacks/weekly-total", requireAuth, asyncHandler(async (_req, res) => {
  const { weekStart, weekEnd } = getSundayWeekRange(new Date());
  const nextSunday = new Date(weekEnd);
  nextSunday.setDate(nextSunday.getDate() + 1);

  const result = await prisma.chargebackSubmission.aggregate({
    _sum: { chargebackAmount: true },
    _count: { id: true },
    where: { submittedAt: { gte: weekStart, lt: nextSunday } },
  });

  return res.json({
    total: result._sum.chargebackAmount ?? 0,
    count: result._count.id,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
  });
}));

// ─── CS Rep Roster ────────────────────────────────────────────────

router.get("/cs-rep-roster", requireAuth, asyncHandler(async (_req, res) => {
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

router.post("/cs-rep-roster", requireAuth, asyncHandler(async (req, res) => {
  const parsed = csRepSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const rep = await prisma.csRepRoster.create({ data: { name: parsed.data.name } });
  return res.status(201).json(rep);
}));

const csRepToggleSchema = z.object({ active: z.boolean() });

router.patch("/cs-rep-roster/:id", requireAuth, asyncHandler(async (req, res) => {
  const parsed = csRepToggleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const rep = await prisma.csRepRoster.update({
    where: { id: req.params.id },
    data: { active: parsed.data.active },
  });
  return res.json(rep);
}));

router.delete("/cs-rep-roster/:id", requireAuth, asyncHandler(async (req, res) => {
  await prisma.csRepRoster.delete({ where: { id: req.params.id } });
  return res.status(204).end();
}));

export default router;
