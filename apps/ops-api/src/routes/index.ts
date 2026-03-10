import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@ops/db";
import { buildLogoutCookie, buildSessionCookie, signSessionToken } from "@ops/auth";
import { requireAuth, requireRole } from "../middleware/auth";
import { upsertPayrollEntryForSale } from "../services/payroll";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signSessionToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  res.setHeader("Set-Cookie", buildSessionCookie(token));
  return res.json({ id: user.id, role: user.role, name: user.name });
});

router.post("/auth/logout", (_req, res) => {
  res.setHeader("Set-Cookie", buildLogoutCookie());
  return res.status(204).end();
});

router.get("/session/me", requireAuth, async (req, res) => {
  res.json(req.user);
});

router.get("/users", requireAuth, requireRole("SUPER_ADMIN"), async (_req, res) => {
  res.json(await prisma.user.findMany({ orderBy: { createdAt: "desc" } }));
});

router.get("/agents", requireAuth, async (_req, res) => res.json(await prisma.agent.findMany({ orderBy: { displayOrder: "asc" } })));

router.post("/agents", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), async (req, res) => {
  const schema = z.object({ name: z.string().min(1), email: z.string().email().optional(), userId: z.string().optional() });
  const data = schema.parse(req.body);
  const count = await prisma.agent.count();
  const agent = await prisma.agent.create({ data: { ...data, displayOrder: count } });
  res.status(201).json(agent);
});

router.patch("/agents/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), async (req, res) => {
  const schema = z.object({ name: z.string().min(1).optional(), email: z.string().email().nullable().optional(), userId: z.string().nullable().optional() });
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
    status: z.enum(["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"]).default("SUBMITTED"),
    notes: z.string().optional(),
  });
  const parsed = schema.parse(req.body);
  const sale = await prisma.sale.create({
    data: {
      ...parsed,
      saleDate: new Date(parsed.saleDate),
      effectiveDate: new Date(parsed.effectiveDate),
      enteredByUserId: req.user!.id,
    },
  });
  await upsertPayrollEntryForSale(sale.id);
  res.status(201).json(sale);
});

router.get("/tracker/summary", requireAuth, async (_req, res) => {
  const data = await prisma.agent.findMany({
    include: { sales: true },
  });
  const summary = data.map((agent) => ({
    agent: agent.name,
    salesCount: agent.sales.length,
    premiumTotal: agent.sales.reduce((sum, s) => sum + Number(s.premium), 0),
  }));
  res.json(summary);
});

router.get("/payroll/periods", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), async (_req, res) => {
  res.json(await prisma.payrollPeriod.findMany({ include: { entries: true }, orderBy: { weekStart: "desc" } }));
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

router.get("/owner/summary", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), async (_req, res) => {
  const [salesCount, premiumAgg, clawbacks, openPayrollPeriods] = await Promise.all([
    prisma.sale.count(),
    prisma.sale.aggregate({ _sum: { premium: true } }),
    prisma.clawback.count(),
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
