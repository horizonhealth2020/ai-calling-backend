import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { zodErr, asyncHandler, isPrismaError } from "./helpers";

const router = Router();

const ROLE_ENUM = z.enum(["SUPER_ADMIN", "OWNER_VIEW", "MANAGER", "PAYROLL", "SERVICE", "ADMIN", "CUSTOMER_SERVICE"]);
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
  } catch (e: unknown) {
    if (isPrismaError(e) && e.code === "P2002") return res.status(409).json({ error: "Email already in use" });
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
  const data: Record<string, unknown> = { ...rest };
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

export default router;
