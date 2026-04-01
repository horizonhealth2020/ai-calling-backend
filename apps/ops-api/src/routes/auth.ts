import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@ops/db";
import { buildLogoutCookie, buildSessionCookie, signSessionToken } from "@ops/auth";
import type { AppRole } from "@ops/types";
import { requireAuth } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { zodErr, asyncHandler } from "./helpers";

const router = Router();

router.post("/auth/login", asyncHandler(async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = signSessionToken({ id: user.id, email: user.email, name: user.name, roles: user.roles as AppRole[] });
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
  const token = signSessionToken({ id: user.id, email: user.email, name: user.name, roles: user.roles as AppRole[] });
  res.setHeader("Set-Cookie", buildSessionCookie(token));
  return res.json({ token });
}));

router.get("/session/me", requireAuth, asyncHandler(async (req, res) => {
  res.json(req.user);
}));

export default router;
