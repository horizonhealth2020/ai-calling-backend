import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { enqueueAuditJob } from "../services/auditQueue";
import { zodErr, asyncHandler } from "./helpers";

const router = Router();

// ── Convoso Webhook ─────────────────────────────────────────────
const webhookQuerySchema = z.object({ api_key: z.string().optional() });

const requireWebhookSecret = (req: Request, res: Response, next: NextFunction) => {
  const secret = process.env.CONVOSO_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: "Webhook secret not configured" });
  const qp = webhookQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const provided = req.headers["x-webhook-secret"] || qp.data.api_key;
  if (provided !== secret) return res.status(401).json({ error: "Invalid webhook secret" });
  return next();
};

router.post("/webhooks/convoso", requireWebhookSecret, asyncHandler(async (req, res) => {
  const schema = z.object({
    agent_user: z.string().min(1),
    list_id: z.string().min(1),
    recording_url: z.string().optional(),
    call_timestamp: z.string().optional(),
    call_duration_seconds: z.number().int().min(0).optional(),
    member_id: z.string().optional(),
    lead_id: z.union([z.number(), z.string()]).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { agent_user, list_id, recording_url, call_timestamp, call_duration_seconds, member_id, lead_id } = parsed.data;

  // Resolve agent by email (CRM User ID)
  const agent = await prisma.agent.findUnique({ where: { email: agent_user } });
  // Resolve lead source by listId (CRM List ID)
  const leadSource = await prisma.leadSource.findFirst({ where: { listId: list_id } });

  const log = await prisma.convosoCallLog.create({
    data: {
      agentUser: agent_user,
      listId: list_id,
      recordingUrl: recording_url,
      callDurationSeconds: call_duration_seconds ?? null,
      callTimestamp: call_timestamp ? new Date(call_timestamp) : new Date(),
      agentId: agent?.id ?? null,
      leadSourceId: leadSource?.id ?? null,
    },
  });

  // If member_id is provided, also update the matching sale with recording data
  if (member_id) {
    const sale = await prisma.sale.findFirst({ where: { memberId: member_id }, orderBy: { saleDate: "desc" } });
    if (sale) {
      await prisma.sale.update({
        where: { id: sale.id },
        data: {
          recordingUrl: recording_url || undefined,
          callDuration: call_duration_seconds ?? undefined,
          callDateTime: call_timestamp ? new Date(call_timestamp) : undefined,
          convosoLeadId: lead_id != null ? String(lead_id) : undefined,
        },
      });
    }
  }

  // Check audit eligibility: agent must be matched AND have auditEnabled
  let auditEligible = !!(recording_url && agent?.auditEnabled);

  // Check min/max duration filters from settings
  if (auditEligible && call_duration_seconds !== undefined) {
    const [minSetting, maxSetting] = await Promise.all([
      prisma.salesBoardSetting.findUnique({ where: { key: "audit_min_seconds" } }),
      prisma.salesBoardSetting.findUnique({ where: { key: "audit_max_seconds" } }),
    ]);
    const minSec = minSetting ? parseInt(minSetting.value, 10) : 0;
    const maxSec = maxSetting ? parseInt(maxSetting.value, 10) : 0;
    if (minSec > 0 && call_duration_seconds < minSec) auditEligible = false;
    if (maxSec > 0 && call_duration_seconds > maxSec) auditEligible = false;
  }

  if (auditEligible) {
    enqueueAuditJob(log.id);
  } else if (!auditEligible && recording_url) {
    // Mark as skipped so it doesn't sit as "pending"
    await prisma.convosoCallLog.update({ where: { id: log.id }, data: { auditStatus: "skipped" } });
  }

  return res.status(201).json({ id: log.id, matched: { agent: !!agent, leadSource: !!leadSource } });
}));

export default router;
