import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { zodErr, asyncHandler, idParamSchema, booleanQueryParam } from "./helpers";

const router = Router();

router.get("/agents", requireAuth, asyncHandler(async (req, res) => {
  const qp = z.object({ all: booleanQueryParam }).safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const includeInactive = qp.data.all;
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
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const qp = z.object({ permanent: booleanQueryParam }).safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const hard = qp.data.permanent;
  if (hard) {
    try {
      await prisma.agent.delete({ where: { id: pp.data.id } });
      await logAudit(req.user!.id, "HARD_DELETE", "Agent", pp.data.id);
    } catch (e: any) {
      if (e.code === "P2003") return res.status(409).json({ error: "Cannot delete — agent has associated sales or payroll entries. Deactivate instead." });
      throw e;
    }
  } else {
    await prisma.agent.update({ where: { id: pp.data.id }, data: { active: false, email: null } });
    await logAudit(req.user!.id, "DEACTIVATE", "Agent", pp.data.id);
  }
  return res.status(204).end();
}));

router.patch("/agents/:id/reactivate", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const agent = await prisma.agent.update({ where: { id: pp.data.id }, data: { active: true } });
  await logAudit(req.user!.id, "REACTIVATE", "Agent", pp.data.id);
  res.json(agent);
}));

router.patch("/agents/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const schema = z.object({ name: z.string().min(1).optional(), email: z.string().nullable().optional(), userId: z.string().nullable().optional(), extension: z.string().nullable().optional(), auditEnabled: z.boolean().optional(), active: z.boolean().optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  try {
    const agent = await prisma.agent.update({ where: { id: pp.data.id }, data: parsed.data });
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
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const schema = z.object({ name: z.string().min(1).optional(), listId: z.string().nullable().optional(), costPerLead: z.number().min(0).optional(), callBufferSeconds: z.number().int().min(0).optional() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  try {
    const ls = await prisma.leadSource.update({ where: { id: pp.data.id }, data: parsed.data });
    res.json(ls);
  } catch (e: any) {
    if (e.code === "P2002") return res.status(409).json({ error: "A lead source with this name already exists" });
    throw e;
  }
}));

router.delete("/lead-sources/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  await prisma.leadSource.update({ where: { id: pp.data.id }, data: { active: false } });
  await logAudit(req.user!.id, "DELETE", "LeadSource", pp.data.id);
  return res.status(204).end();
}));

export default router;
