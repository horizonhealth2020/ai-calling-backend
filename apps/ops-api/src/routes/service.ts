import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { createSyncedRep } from "../services/repSync";
import { zodErr, asyncHandler } from "./helpers";

const router = Router();

// ── Service Agents ──────────────────────────────────────────────
router.get("/service-agents", requireAuth, asyncHandler(async (_req, res) => {
  res.json(await prisma.serviceAgent.findMany({ orderBy: { name: "asc" } }));
}));

router.post("/service-agents", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().min(1), basePay: z.number().min(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  // Use synced creation to create both ServiceAgent + CsRepRoster
  const { serviceAgent } = await createSyncedRep(parsed.data.name, parsed.data.basePay, req.user!.id);
  res.status(201).json(serviceAgent);
}));

router.patch("/service-agents/:id", requireAuth, requireRole("PAYROLL", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ name: z.string().min(1).optional(), basePay: z.number().min(0).optional(), active: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const agent = await prisma.serviceAgent.update({ where: { id: req.params.id }, data: parsed.data });
  await logAudit(req.user!.id, "UPDATE", "ServiceAgent", agent.id, parsed.data);
  res.json(agent);
}));

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

// ── Service Payroll Entries ─────────────────────────────────────
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

export default router;
