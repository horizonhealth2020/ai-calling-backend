import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { createSyncedRep } from "../services/repSync";
import { zodErr, asyncHandler, isPrismaError, idParamSchema } from "./helpers";

const router = Router();

const ROLE_ENUM = z.enum(["SUPER_ADMIN", "OWNER_VIEW", "MANAGER", "PAYROLL", "SERVICE", "ADMIN", "CUSTOMER_SERVICE"]);
const USER_SELECT = { id: true, name: true, email: true, roles: true, active: true, createdAt: true, csRepRosterId: true };

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
    let user = await prisma.user.create({ data: { ...rest, passwordHash }, select: USER_SELECT });
    // Auto-sync: CUSTOMER_SERVICE users get a linked CsRepRoster + ServiceAgent entry
    if (rest.roles.includes("CUSTOMER_SERVICE")) {
      const { csRep } = await createSyncedRep(user.name, 0, req.user!.id);
      user = await prisma.user.update({ where: { id: user.id }, data: { csRepRosterId: csRep.id }, select: USER_SELECT });
      await logAudit(req.user!.id, "CREATE", "SyncedRepLink", user.id, { csRepRosterId: csRep.id, name: user.name });
    }
    await logAudit(req.user!.id, "CREATE", "User", user.id, { email: rest.email, roles: rest.roles });
    return res.status(201).json(user);
  } catch (e: unknown) {
    if (isPrismaError(e) && e.code === "P2002") return res.status(409).json({ error: "Email already in use" });
    throw e;
  }
}));

router.patch("/users/:id", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
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
  const data: Record<string, unknown> = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.update({ where: { id: pp.data.id }, data, select: USER_SELECT });
  await logAudit(req.user!.id, "UPDATE", "User", user.id, { fields: Object.keys(rest) });
  return res.json(user);
}));

// PATCH /users/:id/link-roster — link a CUSTOMER_SERVICE user to a CsRepRoster entry
// Accessible by SUPER_ADMIN and OWNER_VIEW (admin UI on OwnerUsers dropdown)
router.patch("/users/:id/link-roster", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const parsed = z.object({ csRepRosterId: z.string().nullable() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const user = await prisma.user.update({
    where: { id: pp.data.id },
    data: { csRepRosterId: parsed.data.csRepRosterId },
    select: USER_SELECT,
  });
  await logAudit(req.user!.id, "UPDATE", "User", user.id, { csRepRosterId: parsed.data.csRepRosterId });
  return res.json(user);
}));

router.delete("/users/:id", requireAuth, requireRole("SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  await prisma.user.delete({ where: { id: pp.data.id } });
  await logAudit(req.user!.id, "DELETE", "User", pp.data.id);
  return res.status(204).end();
}));

export default router;
