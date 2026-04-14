import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { emitCSChanged } from "../socket";
import { logAudit } from "../services/audit";
import { zodErr, asyncHandler, dateRange, dateRangeQuerySchema, idParamSchema } from "./helpers";
import { batchRoundRobinAssign } from "../services/repSync";

const router = Router();

const pendingTermSchema = z.object({
  records: z.array(z.object({
    agentName: z.string().nullable(),
    agentIdField: z.string().nullable(),
    memberId: z.string().nullable(),
    memberName: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    phone: z.string().nullable(),
    product: z.string().nullable(),
    monthlyAmount: z.number().nullable(),
    paid: z.string().nullable(),
    createdDate: z.string().nullable(),
    firstBilling: z.string().nullable(),
    activeDate: z.string().nullable(),
    nextBilling: z.string().nullable(),
    holdDate: z.string().nullable(),
    holdReason: z.string().nullable(),
    inactive: z.boolean().nullable(),
    lastTransactionType: z.string().nullable(),
    assignedTo: z.string().nullable(),
  })),
  rawPaste: z.string().min(1),
  batchId: z.string().min(1),
});

router.post("/pending-terms", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const parsed = pendingTermSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { records, rawPaste, batchId } = parsed.data;

  // Wrap createMany + cursor advance in a single transaction so a failed insert
  // rolls back the round-robin cursor (Bug 3 fix). Socket emits stay outside.
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const created = await tx.pendingTerm.createMany({
      data: records.map((r) => ({
        agentName: r.agentName,
        agentIdField: r.agentIdField,
        memberId: r.memberId,
        memberName: r.memberName,
        city: r.city,
        state: r.state,
        phone: r.phone,
        product: r.product,
        monthlyAmount: r.monthlyAmount,
        paid: r.paid,
        createdDate: r.createdDate ? new Date(r.createdDate) : null,
        firstBilling: r.firstBilling ? new Date(r.firstBilling) : null,
        activeDate: r.activeDate ? new Date(r.activeDate) : null,
        nextBilling: r.nextBilling ? new Date(r.nextBilling) : null,
        holdDate: r.holdDate ? new Date(r.holdDate + "T00:00:00") : null,
        holdReason: r.holdReason,
        inactive: r.inactive,
        lastTransactionType: r.lastTransactionType,
        assignedTo: r.assignedTo,
        submittedBy: req.user!.id,
        batchId,
        rawPaste,
      })),
    });

    // Advance the round-robin cursor by exactly the number of rows inserted, inside
    // the same tx so a thrown error rolls the cursor back to its pre-submit value.
    await batchRoundRobinAssign("pending_term", created.count, { persist: true, tx });

    return created;
  });

  // Emit CS changed event for real-time updates (post-commit, non-atomic)
  emitCSChanged({ type: "pending_term", batchId, count: result.count });

  logAudit(req.user!.id, "CREATE", "PendingTerm", batchId, { count: result.count });

  return res.status(201).json({ count: result.count, batchId });
}));

router.get("/pending-terms", requireAuth, asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.extend({ groupBy: z.enum(["holdDate", "saleDate"]).optional() }).safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const dateFilter = dr ? { createdAt: { gte: dr.gte, lt: dr.lt } } : {};

  // Support holdDate grouping for CS dashboard (CS-03)
  if (qp.data.groupBy === "holdDate") {
    const grouped = await prisma.pendingTerm.groupBy({
      by: ["holdDate"],
      where: { resolvedAt: null, ...dateFilter },
      _count: true,
      orderBy: { holdDate: "asc" },
    });
    const records = await prisma.pendingTerm.findMany({
      where: { resolvedAt: null, ...dateFilter },
      orderBy: { holdDate: "asc" },
      include: { submitter: { select: { name: true } }, resolver: { select: { name: true } }, contactAttempts: { select: { type: true } } },
    });
    return res.json({ grouped, records });
  }

  const records = await prisma.pendingTerm.findMany({
    orderBy: { submittedAt: "desc" },
    take: 200,
    where: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
    include: { submitter: { select: { name: true } }, resolver: { select: { name: true } }, contactAttempts: { select: { type: true } } },
  });
  return res.json(records);
}));

router.delete("/pending-terms/:id", requireAuth, requireRole("SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  await prisma.pendingTerm.delete({ where: { id: pp.data.id } });
  return res.status(204).end();
}));

// ─── Pending Term Resolution ────────────────────────────────────

const resolvePendingTermSchema = z.object({
  resolutionType: z.enum(["saved", "cancelled", "no_contact"]),
  resolutionNote: z.string().min(1).max(2000),
  bypassReason: z.string().min(10).max(1000).optional(),
});

router.patch("/pending-terms/:id/resolve", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const parsed = resolvePendingTermSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  // Resolution gate: "cancelled" and "no_contact" require 3 CALL attempts
  if (parsed.data.resolutionType === "cancelled" || parsed.data.resolutionType === "no_contact") {
    const totalAttempts = await prisma.contactAttempt.count({
      where: { pendingTermId: pp.data.id },
    });
    // Pre-v2.9 records (0 total attempts) skip gate — never entered outreach workflow
    if (totalAttempts > 0) {
      const callAttempts = await prisma.contactAttempt.count({
        where: { pendingTermId: pp.data.id, type: "CALL" },
      });
      if (callAttempts < 3) {
        if (parsed.data.bypassReason) {
          logAudit(req.user!.id, "BYPASSED", "PendingTerm", pp.data.id, {
            action: "RESOLUTION_GATE_BYPASSED",
            resolutionType: parsed.data.resolutionType,
            callAttempts,
            bypassReason: parsed.data.bypassReason,
          });
        } else {
          logAudit(req.user!.id, "BLOCKED", "PendingTerm", pp.data.id, {
            action: "RESOLUTION_GATE_BLOCKED",
            resolutionType: parsed.data.resolutionType,
            callAttempts,
          });
          return res.status(400).json({ error: `3 call attempts required before cancelling. Current: ${callAttempts}/3` });
        }
      }
    }
  }

  const record = await prisma.pendingTerm.update({
    where: { id: pp.data.id },
    data: {
      resolvedAt: new Date(),
      resolvedBy: req.user!.id,
      resolutionNote: parsed.data.resolutionNote,
      resolutionType: parsed.data.resolutionType,
      bypassReason: parsed.data.bypassReason || null,
    },
  });
  logAudit(req.user!.id, "UPDATE", "PendingTerm", pp.data.id, { resolutionType: parsed.data.resolutionType });
  emitCSChanged({ type: "pending_term", batchId: "resolution", count: 1 });
  return res.json(record);
}));

router.patch("/pending-terms/:id/unresolve", requireAuth, requireRole("CUSTOMER_SERVICE", "SUPER_ADMIN", "OWNER_VIEW"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const record = await prisma.pendingTerm.update({
    where: { id: pp.data.id },
    data: {
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
      resolutionType: null,
    },
  });
  return res.json(record);
}));

export default router;
