import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@ops/db";
import { buildLogoutCookie, buildSessionCookie, signSessionToken } from "@ops/auth";
import { requireAuth, requireRole } from "../middleware/auth";
import { upsertPayrollEntryForSale } from "../services/payroll";

const router = Router();

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

router.post("/auth/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signSessionToken({ id: user.id, email: user.email, name: user.name, roles: user.roles as any });
  res.setHeader("Set-Cookie", buildSessionCookie(token));
  return res.json({ id: user.id, roles: user.roles, name: user.name });
});

router.post("/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", buildLogoutCookie());
  return res.status(204).end();
});

router.get("/session/me", requireAuth, async (req, res) => {
  res.json(req.user);
});

const ROLE_ENUM = z.enum(["SUPER_ADMIN", "OWNER_VIEW", "MANAGER", "PAYROLL", "SERVICE", "ADMIN"]);
const USER_SELECT = { id: true, name: true, email: true, roles: true, active: true, createdAt: true };

router.get("/users", requireAuth, requireRole("SUPER_ADMIN"), async (_req, res) => {
  res.json(await prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: USER_SELECT }));
});

router.post("/users", requireAuth, requireRole("SUPER_ADMIN"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(8),
    roles: z.array(ROLE_ENUM).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { password, ...rest } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({ data: { ...rest, passwordHash }, select: USER_SELECT });
    return res.status(201).json(user);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "Email already in use" });
    throw e;
  }
});

router.patch("/users/:id", requireAuth, requireRole("SUPER_ADMIN"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(8).optional(),
    roles: z.array(ROLE_ENUM).min(1).optional(),
    active: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const { password, ...rest } = parsed.data;
  const data: any = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { id: req.params.id }, data, select: USER_SELECT });
  return res.json(user);
});

router.get("/agents", requireAuth, async (_req, res) => res.json(await prisma.agent.findMany({ orderBy: { displayOrder: "asc" } })));

router.post("/agents", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), async (req, res) => {
  const schema = z.object({ name: z.string().min(1), email: z.string().optional(), userId: z.string().optional(), extension: z.string().optional() });
  const data = schema.parse(req.body);
  const count = await prisma.agent.count();
  const agent = await prisma.agent.create({ data: { ...data, displayOrder: count } });
  res.status(201).json(agent);
});

router.patch("/agents/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), async (req, res) => {
  const schema = z.object({ name: z.string().min(1).optional(), email: z.string().nullable().optional(), userId: z.string().nullable().optional(), extension: z.string().nullable().optional() });
  const data = schema.parse(req.body);
  const agent = await prisma.agent.update({ where: { id: req.params.id }, data });
  res.json(agent);
});

router.get("/lead-sources", requireAuth, async (_req, res) => res.json(await prisma.leadSource.findMany()));

router.post("/lead-sources", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), async (req, res) => {
  const schema = z.object({ name: z.string().min(1), listId: z.string().optional(), costPerLead: z.number().default(0) });
  const data = schema.parse(req.body);
  const ls = await prisma.leadSource.create({ data: { ...data, effectiveDate: new Date() } });
  res.status(201).json(ls);
});

router.patch("/lead-sources/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), async (req, res) => {
  const schema = z.object({ name: z.string().min(1).optional(), listId: z.string().nullable().optional(), costPerLead: z.number().optional() });
  const data = schema.parse(req.body);
  const ls = await prisma.leadSource.update({ where: { id: req.params.id }, data });
  res.json(ls);
});

router.get("/products", requireAuth, async (_req, res) => res.json(await prisma.product.findMany()));

router.post("/products", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    type: z.enum(["CORE", "ADDON", "AD_D"]).default("CORE"),
    premiumThreshold: z.number().nullable().optional(),
    commissionBelow: z.number().nullable().optional(),
    commissionAbove: z.number().nullable().optional(),
    bundledCommission: z.number().nullable().optional(),
    standaloneCommission: z.number().nullable().optional(),
    notes: z.string().optional(),
  });
  const data = schema.parse(req.body);
  const product = await prisma.product.create({ data });
  res.status(201).json(product);
});

router.patch("/products/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).optional(),
    active: z.boolean().optional(),
    type: z.enum(["CORE", "ADDON", "AD_D"]).optional(),
    premiumThreshold: z.number().nullable().optional(),
    commissionBelow: z.number().nullable().optional(),
    commissionAbove: z.number().nullable().optional(),
    bundledCommission: z.number().nullable().optional(),
    standaloneCommission: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
  });
  const data = schema.parse(req.body);
  const product = await prisma.product.update({ where: { id: req.params.id }, data });
  res.json(product);
});

router.post("/sales", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), async (req, res) => {
  const schema = z.object({
    saleDate: z.string(),
    agentId: z.string(),
    memberName: z.string(),
    memberId: z.string().optional(),
    carrier: z.string(),
    productId: z.string(),
    premium: z.number(),
    effectiveDate: z.string(),
    leadSourceId: z.string(),
    enrollmentFee: z.number().nullable().optional(),
    addonProductIds: z.array(z.string()).default([]),
    status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"]).default("SUBMITTED"),
    notes: z.string().optional(),
  });
  const parsed = schema.parse(req.body);
  const { addonProductIds, ...saleData } = parsed;
  const sale = await prisma.sale.create({
    data: {
      ...saleData,
      saleDate: new Date(parsed.saleDate),
      effectiveDate: new Date(parsed.effectiveDate),
      enteredByUserId: req.user!.id,
      addons: addonProductIds.length > 0 ? {
        create: addonProductIds.map(productId => ({ productId })),
      } : undefined,
    },
  });
  await upsertPayrollEntryForSale(sale.id);
  res.status(201).json(sale);
});

router.get("/sales", requireAuth, async (req, res) => {
  const dr = dateRange(req.query.range as string | undefined);
  const where = dr ? { saleDate: { gte: dr.gte, lt: dr.lt } } : {};
  const sales = await prisma.sale.findMany({
    where,
    include: { agent: true, product: true, leadSource: true },
    orderBy: { saleDate: "desc" },
  });
  res.json(sales);
});

router.patch("/sales/:id/approve-commission", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), async (req, res) => {
  const sale = await prisma.sale.update({
    where: { id: req.params.id },
    data: { commissionApproved: true },
  });
  await upsertPayrollEntryForSale(sale.id);
  res.json(sale);
});

router.get("/tracker/summary", requireAuth, async (req, res) => {
  const dr = dateRange(req.query.range as string | undefined);
  const salesWhere = dr ? { saleDate: { gte: dr.gte, lt: dr.lt } } : undefined;
  const data = await prisma.agent.findMany({
    include: {
      sales: {
        where: salesWhere,
        include: { leadSource: true },
      },
    },
  });
  const summary = data.map((agent) => {
    const salesCount = agent.sales.length;
    const premiumTotal = agent.sales.reduce((sum, s) => sum + Number(s.premium), 0);
    const totalLeadCost = agent.sales.reduce((sum, s) => sum + Number(s.leadSource.costPerLead), 0);
    return {
      agent: agent.name,
      salesCount,
      premiumTotal,
      totalLeadCost,
      costPerSale: salesCount > 0 ? totalLeadCost / salesCount : 0,
    };
  });
  res.json(summary);
});

router.get("/payroll/periods", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), async (_req, res) => {
  res.json(await prisma.payrollPeriod.findMany({
    include: {
      entries: {
        include: {
          sale: { select: { id: true, memberName: true, memberId: true, enrollmentFee: true, commissionApproved: true, product: { select: { name: true, type: true } } } },
          agent: { select: { name: true } },
        },
      },
    },
    orderBy: { weekStart: "desc" },
  }));
});

router.post("/clawbacks", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), async (req, res) => {
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
  res.status(201).json(clawback);
});

router.get("/owner/summary", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), async (req, res) => {
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
});

router.get("/sales-board/summary", async (_req, res) => {
  const agents = await prisma.agent.findMany({ orderBy: { displayOrder: "asc" } });
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
});

router.get("/sales-board/detailed", async (_req, res) => {
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
});

export default router;
