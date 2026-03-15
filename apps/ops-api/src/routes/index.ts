import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@ops/db";
import { buildLogoutCookie, buildSessionCookie, signSessionToken } from "@ops/auth";
import { requireAuth, requireRole } from "../middleware/auth";
import { upsertPayrollEntryForSale } from "../services/payroll";
import { logAudit } from "../services/audit";
import { reAuditCall } from "../services/callAudit";
import { enqueueAuditJob } from "../services/auditQueue";

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
    carrier: z.string(),
    productId: z.string(),
    premium: z.number().min(0),
    effectiveDate: z.string(),
    leadSourceId: z.string(),
    enrollmentFee: z.number().min(0).nullable().optional(),
    addonProductIds: z.array(z.string()).default([]),
    addonPremiums: z.record(z.string(), z.number().min(0)).default({}),
    status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"]).default("SUBMITTED"),
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
  res.status(201).json(sale);
}));

router.get("/sales", requireAuth, asyncHandler(async (req, res) => {
  const dr = dateRange(req.query.range as string | undefined);
  const where = dr ? { saleDate: { gte: dr.gte, lt: dr.lt } } : {};
  const sales = await prisma.sale.findMany({
    where,
    include: { agent: true, product: true, leadSource: true },
    orderBy: { saleDate: "desc" },
  });
  res.json(sales);
}));

router.patch("/sales/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({
    memberName: z.string().min(1).optional(),
    memberId: z.string().nullable().optional(),
    carrier: z.string().min(1).optional(),
    premium: z.number().min(0).optional(),
    enrollmentFee: z.number().min(0).nullable().optional(),
    status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
    memberState: z.string().max(2).nullable().optional(),
    notes: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const sale = await prisma.sale.update({
    where: { id: req.params.id },
    data: parsed.data,
    include: { agent: true, product: true, leadSource: true },
  });
  await logAudit(req.user!.id, "UPDATE", "Sale", sale.id, parsed.data);
  // Recalculate commission if premium or enrollment fee changed
  if (parsed.data.premium !== undefined || parsed.data.enrollmentFee !== undefined) {
    await upsertPayrollEntryForSale(sale.id);
  }
  res.json(sale);
}));

router.delete("/sales/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const saleId = req.params.id;
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { id: true, memberName: true, agentId: true, premium: true } });
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  await prisma.$transaction([
    prisma.saleAddon.deleteMany({ where: { saleId } }),
    prisma.clawback.deleteMany({ where: { saleId } }),
    prisma.payrollEntry.deleteMany({ where: { saleId } }),
    prisma.sale.delete({ where: { id: saleId } }),
  ]);
  await logAudit(req.user!.id, "DELETE", "Sale", saleId, { memberName: sale.memberName, agentId: sale.agentId, premium: Number(sale.premium) });
  return res.status(204).end();
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

  // Fetch agents with sales and their Convoso call logs in parallel
  const [data, allLeadSources, callLogs] = await Promise.all([
    prisma.agent.findMany({
      where: { active: true },
      include: { sales: { where: salesWhere } },
    }),
    prisma.leadSource.findMany({ select: { id: true, costPerLead: true, callBufferSeconds: true } }),
    prisma.convosoCallLog.findMany({ where: callWhere, select: { agentId: true, leadSourceId: true, callDurationSeconds: true } }),
  ]);

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
  const saleWhere = dr ? { saleDate: { gte: dr.gte, lt: dr.lt } } : {};
  const clawbackWhere = dr ? { createdAt: { gte: dr.gte, lt: dr.lt } } : {};
  const [salesCount, premiumAgg, clawbacks, openPayrollPeriods] = await Promise.all([
    prisma.sale.count({ where: saleWhere }),
    prisma.sale.aggregate({ _sum: { premium: true }, where: saleWhere }),
    prisma.clawback.count({ where: clawbackWhere }),
    prisma.payrollPeriod.count({ where: { status: "OPEN" } }),
  ]);
  res.json({ salesCount, premiumTotal: premiumAgg._sum.premium ?? 0, clawbacks, openPayrollPeriods });
}));

router.get("/sales-board/summary", asyncHandler(async (_req, res) => {
  const agents = await prisma.agent.findMany({ where: { active: true }, orderBy: { displayOrder: "asc" } });
  const agentMap = new Map(agents.map((a) => [a.id, a.name]));
  const [daily, weekly] = await Promise.all([
    prisma.sale.groupBy({ by: ["agentId"], _count: { id: true }, _sum: { premium: true }, where: { saleDate: { gte: new Date(Date.now() - 86400000) } } }),
    prisma.sale.groupBy({ by: ["agentId"], _count: { id: true }, _sum: { premium: true }, where: { saleDate: { gte: new Date(Date.now() - 7 * 86400000) } } }),
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

  // Fetch all sales for the current week
  const sales = await prisma.sale.findMany({
    where: { saleDate: { gte: monday, lt: sunday } },
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

export default router;
