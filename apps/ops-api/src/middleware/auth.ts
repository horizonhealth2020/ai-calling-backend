import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE, verifySessionToken } from "@ops/auth";
import type { AppRole } from "@ops/types";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; roles: AppRole[]; email: string; name: string };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Accept token from Authorization header (Bearer) or fall back to cookie
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : req.cookies?.[SESSION_COOKIE];
  const user = verifySessionToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  req.user = user;
  return next();
};

export const requireRole = (...roles: AppRole[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const userRoles = req.user.roles ?? [];
  // SUPER_ADMIN bypasses all role checks
  if (userRoles.includes("SUPER_ADMIN")) return next();
  if (!roles.some(r => userRoles.includes(r))) return res.status(403).json({ error: "Forbidden" });
  return next();
};
