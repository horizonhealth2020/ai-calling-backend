import { Router, type NextFunction, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { createWorkflowAuth } from "../middleware/workflow-auth";
import { asyncHandler, zodErr } from "./helpers";
import {
  claimNextWork,
  completeWork,
  failWork,
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../services/workflow";

// Body size: the global `express.json()` parser in index.ts defaults to 100KB.
// Requests over that are rejected globally with 413 before reaching these routes.
// That is STRICTER than plan's 1MB cap — same DoS/OOM protection, tighter envelope.

const router = Router();

// Fail-fast at module load if WORKFLOW_API_TOKEN is missing or too short.
const workflowAuth = createWorkflowAuth();

const pollRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "rate_limit_exceeded" },
});
const writeRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "rate_limit_exceeded" },
});

const artifactTypeSchema = z.enum(["BRIEF", "PLAN", "DRAFT", "DEPLOYMENT_LOG"]);

const pollBodySchema = z.object({
  claimed_by: z.string().min(1).max(200),
});

const completeBodySchema = z.object({
  queueId: z.string().min(1),
  work_id: z.string().min(1),
  claimed_by: z.string().min(1).max(200),
  artifact: z.object({
    type: artifactTypeSchema,
    payload: z.unknown(),
  }),
});

const failBodySchema = z.object({
  queueId: z.string().min(1),
  work_id: z.string().min(1),
  claimed_by: z.string().min(1).max(200),
  error: z.string().max(5000),
});

// Map workflow-specific errors to HTTP status codes with generic bodies.
// Non-workflow errors fall through to the global error handler in index.ts
// (which already redacts stack/DB/internals per AC-7).
function mapWorkflowError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof ConflictError) return res.status(409).json({ error: err.code });
  if (err instanceof NotFoundError) return res.status(404).json({ error: err.message });
  if (err instanceof ValidationError) return res.status(400).json({ error: err.message, details: err.details });
  return next(err);
}

// POST /workflow/poll — claim next queued item atomically
router.post(
  "/workflow/poll",
  workflowAuth,
  pollRateLimit,
  asyncHandler(async (req, res, next) => {
    const parsed = pollBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
    try {
      const item = await claimNextWork(parsed.data.claimed_by);
      res.json({ item });
    } catch (err) {
      return mapWorkflowError(err, res, next);
    }
  }),
);

// POST /workflow/complete — mark work done + submit artifact (transactional, idempotent)
router.post(
  "/workflow/complete",
  workflowAuth,
  writeRateLimit,
  asyncHandler(async (req, res, next) => {
    const parsed = completeBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
    try {
      const result = await completeWork(
        parsed.data.queueId,
        parsed.data.work_id,
        parsed.data.claimed_by,
        parsed.data.artifact,
      );
      res.json({ ok: true, artifactId: result.artifactId });
    } catch (err) {
      return mapWorkflowError(err, res, next);
    }
  }),
);

// POST /workflow/fail — mark work failed; increments fail_attempts, permanent-fails at max
router.post(
  "/workflow/fail",
  workflowAuth,
  writeRateLimit,
  asyncHandler(async (req, res, next) => {
    const parsed = failBodySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
    try {
      const result = await failWork(
        parsed.data.queueId,
        parsed.data.work_id,
        parsed.data.claimed_by,
        parsed.data.error,
      );
      res.json({ ok: true, status: result.status });
    } catch (err) {
      return mapWorkflowError(err, res, next);
    }
  }),
);

export default router;
