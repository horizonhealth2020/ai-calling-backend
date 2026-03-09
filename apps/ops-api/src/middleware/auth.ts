import type { NextFunction, Request, Response } from "express";
import { SESSION_COOKIE, verifySessionToken } from "@ops/auth";
import type { AppRole } from "@ops/types";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: AppRole; email: string; name: string };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const user = verifySessionToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  req.user = user;
  return next();
};

export const requireRole = (...roles: AppRole[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Forbidden" });
  return next();
};
