import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";

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

/** Map Prisma errors to HTTP responses. Never leaks raw DB error messages to clients. */
export function handlePrismaError(err: unknown, res: Response): Response {
  console.error("Database error:", err);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Record not found" });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Record already exists" });
    }
    // P1xxx = connection/server errors
    if (err.code.startsWith("P1")) {
      return res.status(503).json({ error: "Database temporarily unavailable" });
    }
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return res.status(503).json({ error: "Database temporarily unavailable" });
  }

  // Unknown database error -- don't leak details
  return res.status(500).json({ error: "Internal server error" });
}

/** Zod schema for date range query params (range, from, to) used by many GET routes */
export const dateRangeQuerySchema = z.object({
  range: z.enum(["today", "week", "last_week", "7d", "30d", "month"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (expected YYYY-MM-DD)").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (expected YYYY-MM-DD)").optional(),
});

/** Zod schema for id route param -- validates non-empty string */
export const idParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

/** Zod schema for boolean-ish query params (e.g., ?all=true) */
export const booleanQueryParam = z.enum(["true", "false"]).optional().transform(v => v === "true");
