import { Request, Response, NextFunction } from "express";
import { z } from "zod";

/** Format Zod errors so the response always includes an `error` key for dashboard display. */
export function zodErr(ze: z.ZodError) {
  const flat = ze.flatten();
  const msg = flat.formErrors[0]
    || Object.values(flat.fieldErrors).flat()[0]
    || "Validation failed";
  return { error: msg, details: flat };
}

/** Wrap async route handlers so errors are forwarded to Express error handler */
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req, res, next).catch(next);

/** Type guard for Prisma known-request errors (e.g. P2002 unique constraint). */
export interface PrismaClientError {
  code: string;
  meta?: Record<string, unknown>;
}
export function isPrismaError(e: unknown): e is PrismaClientError {
  return typeof e === "object" && e !== null && "code" in e && typeof (e as PrismaClientError).code === "string";
}

/** Compute date-range boundaries from a `range` query param or custom from/to dates. */
export function dateRange(range?: string, from?: string, to?: string): { gte: Date; lt: Date } | undefined {
  // Custom from/to takes precedence
  if (from && to) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) return undefined;
    return {
      gte: new Date(from + "T00:00:00.000Z"),
      lt: new Date(to + "T23:59:59.999Z"),
    };
  }
  if (!range) return undefined;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === "today") {
    const lt = new Date(todayStart);
    lt.setDate(lt.getDate() + 1);
    return { gte: todayStart, lt };
  }
  if (range === "week") {
    // Sunday-to-Saturday week containing today
    const day = now.getDay(); // 0=Sun ... 6=Sat
    const sunday = new Date(todayStart);
    sunday.setDate(todayStart.getDate() - day);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 7); // exclusive upper bound (next Sunday 00:00)
    return { gte: sunday, lt: saturday };
  }
  if (range === "last_week") {
    const day = now.getDay(); // 0=Sun ... 6=Sat
    const thisSunday = new Date(todayStart);
    thisSunday.setDate(todayStart.getDate() - day);
    const lastSunday = new Date(thisSunday);
    lastSunday.setDate(thisSunday.getDate() - 7);
    return { gte: lastSunday, lt: thisSunday }; // previous Sun 00:00 to this Sun 00:00
  }
  if (range === "7d") {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 7);
    const lt = new Date(todayStart);
    lt.setDate(lt.getDate() + 1);
    return { gte: start, lt };
  }
  if (range === "30d") {
    const start = new Date(todayStart);
    start.setDate(start.getDate() - 30);
    const lt = new Date(todayStart);
    lt.setDate(lt.getDate() + 1);
    return { gte: start, lt };
  }
  if (range === "month") {
    // month - rolling 30 days
    const thirtyAgo = new Date(todayStart);
    thirtyAgo.setDate(todayStart.getDate() - 30);
    const lt = new Date(todayStart);
    lt.setDate(lt.getDate() + 1);
    return { gte: thirtyAgo, lt };
  }
  return undefined;
}
