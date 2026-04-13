import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { logAudit } from "../services/audit";
import { zodErr, asyncHandler } from "./helpers";

const router = Router();

const createContactAttemptSchema = z.object({
  type: z.enum(["CALL", "EMAIL", "TEXT"]),
  notes: z.string().max(500).optional(),
  chargebackSubmissionId: z.string().optional(),
  pendingTermId: z.string().optional(),
});

router.post("/contact-attempts", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = createContactAttemptSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { type, notes, chargebackSubmissionId, pendingTermId } = parsed.data;

  // Validate exactly one FK provided
  const hasCb = !!chargebackSubmissionId;
  const hasPt = !!pendingTermId;
  if (hasCb === hasPt) {
    return res.status(400).json({ error: "Provide exactly one of chargebackSubmissionId or pendingTermId" });
  }

  // Validate the referenced record exists
  if (chargebackSubmissionId) {
    const cb = await prisma.chargebackSubmission.findUnique({ where: { id: chargebackSubmissionId }, select: { id: true } });
    if (!cb) return res.status(404).json({ error: "Chargeback submission not found" });
  }
  if (pendingTermId) {
    const pt = await prisma.pendingTerm.findUnique({ where: { id: pendingTermId }, select: { id: true } });
    if (!pt) return res.status(404).json({ error: "Pending term not found" });
  }

  // Auto-calculate attemptNumber: count existing attempts of same type for the same record + 1
  const existingCount = await prisma.contactAttempt.count({
    where: {
      type,
      ...(chargebackSubmissionId ? { chargebackSubmissionId } : { pendingTermId }),
    },
  });

  const attempt = await prisma.contactAttempt.create({
    data: {
      type,
      notes,
      attemptNumber: existingCount + 1,
      chargebackSubmissionId: chargebackSubmissionId || null,
      pendingTermId: pendingTermId || null,
      agentId: req.user!.id,
    },
  });

  logAudit(req.user!.id, "CREATE", "ContactAttempt", attempt.id, {
    type,
    attemptNumber: attempt.attemptNumber,
    chargebackSubmissionId,
    pendingTermId,
  });

  return res.status(201).json(attempt);
}));

const listContactAttemptsSchema = z.object({
  chargebackSubmissionId: z.string().optional(),
  pendingTermId: z.string().optional(),
});

router.get("/contact-attempts", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = listContactAttemptsSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { chargebackSubmissionId, pendingTermId } = parsed.data;

  const hasCb = !!chargebackSubmissionId;
  const hasPt = !!pendingTermId;
  if (hasCb === hasPt) {
    return res.status(400).json({ error: "Provide exactly one of chargebackSubmissionId or pendingTermId" });
  }

  const attempts = await prisma.contactAttempt.findMany({
    where: chargebackSubmissionId ? { chargebackSubmissionId } : { pendingTermId },
    orderBy: { createdAt: "asc" },
    include: {
      agent: { select: { name: true } },
    },
  });

  return res.json(attempts);
}));

export default router;
