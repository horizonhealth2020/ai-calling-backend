import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { reAuditCall } from "../services/callAudit";
import { logAudit } from "../services/audit";
import { zodErr, asyncHandler, dateRange, dateRangeQuerySchema, idParamSchema } from "./helpers";

const router = Router();

// ── Call Recordings (sales with attached recording data) ─────────
router.get("/call-recordings", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const where: any = { recordingUrl: { not: null } };
  if (dr) where.callDateTime = { gte: dr.gte, lt: dr.lt };
  const recordings = await prisma.sale.findMany({
    where,
    select: {
      id: true, memberName: true, memberId: true, status: true, recordingUrl: true,
      callDuration: true, callDateTime: true, convosoLeadId: true,
      agent: { select: { name: true, email: true } },
      product: { select: { name: true } },
    },
    orderBy: { callDateTime: "desc" },
    take: 200,
  });
  res.json(recordings);
}));

// ── Call Audits ─────────────────────────────────────────────────
router.get("/call-audits", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.extend({ agentId: z.string().optional() }).safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const where: any = {};
  if (dr) where.callDate = { gte: dr.gte, lt: dr.lt };
  if (qp.data.agentId) where.agentId = qp.data.agentId;

  const audits = await prisma.callAudit.findMany({
    where,
    include: { agent: { select: { id: true, name: true } } },
    orderBy: { callDate: "desc" },
  });
  res.json(audits);
}));

router.get("/call-audits/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const audit = await prisma.callAudit.findUnique({
    where: { id: pp.data.id },
    include: {
      agent: { select: { id: true, name: true } },
      convosoCallLog: { select: { id: true, callDurationSeconds: true, agentUser: true, listId: true, callTimestamp: true, auditStatus: true } },
    },
  });
  if (!audit) return res.status(404).json({ error: "Audit not found" });
  res.json(audit);
}));

router.patch("/call-audits/:id", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  const schema = z.object({
    score: z.number().min(0).max(100).optional(),
    status: z.string().min(1).optional(),
    coachingNotes: z.string().nullable().optional(),
    callOutcome: z.enum(["sold", "callback_scheduled", "lost", "not_qualified", "incomplete"]).optional(),
    managerSummary: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const audit = await prisma.callAudit.update({
    where: { id: pp.data.id },
    data: { ...parsed.data, reviewerUserId: req.user!.id },
    include: { agent: { select: { id: true, name: true } } },
  });
  await logAudit(req.user!.id, "UPDATE", "CallAudit", audit.id, parsed.data);
  res.json(audit);
}));

router.post("/call-audits/:id/re-audit", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const pp = idParamSchema.safeParse(req.params);
  if (!pp.success) return res.status(400).json(zodErr(pp.error));
  await reAuditCall(pp.data.id);
  const audit = await prisma.callAudit.findUnique({
    where: { id: pp.data.id },
    include: { agent: { select: { id: true, name: true } } },
  });
  await logAudit(req.user!.id, "RE_AUDIT", "CallAudit", pp.data.id, {});
  res.json(audit);
}));

// ── Call Counts (Convoso aggregation) ───────────────────────────
router.get("/call-counts", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const qp = dateRangeQuerySchema.safeParse(req.query);
  if (!qp.success) return res.status(400).json(zodErr(qp.error));
  const dr = dateRange(qp.data.range, qp.data.from, qp.data.to);
  const where: any = { agentId: { not: null }, leadSourceId: { not: null } };
  if (dr) where.callTimestamp = { gte: dr.gte, lt: dr.lt };

  // Get all lead sources to apply per-source buffer filtering
  const allLeadSources = await prisma.leadSource.findMany({
    select: { id: true, name: true, costPerLead: true, callBufferSeconds: true },
  });
  const lsMap = new Map(allLeadSources.map(ls => [ls.id, { name: ls.name, costPerLead: Number(ls.costPerLead), callBufferSeconds: ls.callBufferSeconds }]));

  // Fetch raw call logs (not groupBy) so we can filter by per-source buffer
  const logs = await prisma.convosoCallLog.findMany({
    where,
    select: { agentId: true, leadSourceId: true, callDurationSeconds: true },
  });

  // Aggregate counts, filtering out calls shorter than the lead source buffer
  const countMap = new Map<string, number>();
  for (const log of logs) {
    const lsInfo = lsMap.get(log.leadSourceId!);
    const buffer = lsInfo?.callBufferSeconds ?? 0;
    if (buffer > 0 && log.callDurationSeconds !== null && log.callDurationSeconds < buffer) continue;
    const key = `${log.agentId}|${log.leadSourceId}`;
    countMap.set(key, (countMap.get(key) ?? 0) + 1);
  }

  const agentIds = [...new Set(logs.map(l => l.agentId!))];
  const agents = await prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } });
  const agentMap = new Map(agents.map(a => [a.id, a.name]));

  const result = [...countMap.entries()].map(([key, count]) => {
    const [agentId, leadSourceId] = key.split("|");
    const ls = lsMap.get(leadSourceId) ?? { name: "Unknown", costPerLead: 0, callBufferSeconds: 0 };
    return {
      agentId,
      agentName: agentMap.get(agentId) ?? "Unknown",
      leadSourceId,
      leadSourceName: ls.name,
      callCount: count,
      totalLeadCost: ls.costPerLead * count,
    };
  });

  res.json(result);
}));

// ── AI Audit System Prompt Settings ─────────────────────────────
const DEFAULT_AI_AUDIT_PROMPT = `You are a sales call auditor for a health insurance agency. Your job is to identify SPECIFIC MOMENTS in the call that need coaching, with exact quotes.

## YOUR OUTPUT PRIORITIES

1. Find the moments that cost the sale — or could have in a won call
2. Quote exactly what was said — no paraphrasing, no summarizing
3. Provide the exact script the agent should have used instead
4. Be specific and actionable — a manager should be able to read your output and immediately know what to say to the agent

## WHAT TO LOOK FOR

### Red Flags (Issues)
- Customer raised an objection and agent fumbled it
- Agent asked a yes/no question instead of assumptive close
- Agent let customer off the hook without locking specific time
- Agent talked too much during discovery (customer should talk 60%+)
- Agent skipped key discovery questions
- Agent didn't create urgency
- Agent didn't use tie-downs before presenting price
- Agent gave up after first objection

### Green Flags (Wins)
- Strong rebuttal that kept the call alive
- Good use of assumptive close language
- Connected benefits to customer's stated priorities
- Recovered from a tough objection

## ANTI-HALLUCINATION RULES — CRITICAL

1. ONLY cite what is explicitly in the transcript. If you cannot find a direct quote, write "No direct quote available".
2. If the transcript is incomplete or unclear, flag this rather than guessing.
3. Do not assume customer intent beyond what they explicitly stated.
4. Limit issues to the 3-5 most impactful moments.
5. Include 1-2 wins if they exist.
6. Coaching priorities should be max 3 items.`;

router.get("/settings/ai-audit-prompt", requireAuth, requireRole("OWNER_VIEW", "MANAGER", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const setting = await prisma.salesBoardSetting.findUnique({ where: { key: "ai_audit_system_prompt" } });
  if (setting) return res.json({ prompt: setting.value });
  // Auto-seed default prompt on first access
  await prisma.salesBoardSetting.create({ data: { key: "ai_audit_system_prompt", value: DEFAULT_AI_AUDIT_PROMPT } });
  res.json({ prompt: DEFAULT_AI_AUDIT_PROMPT });
}));

router.put("/settings/ai-audit-prompt", requireAuth, requireRole("OWNER_VIEW", "MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ prompt: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  await prisma.salesBoardSetting.upsert({
    where: { key: "ai_audit_system_prompt" },
    create: { key: "ai_audit_system_prompt", value: parsed.data.prompt },
    update: { value: parsed.data.prompt },
  });
  await logAudit(req.user!.id, "UPDATE", "SalesBoardSetting", "ai_audit_system_prompt");
  res.json({ prompt: parsed.data.prompt });
}));

// ── Audit Duration Filter Settings ──────────────────────────────
router.get("/settings/audit-duration", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const [minS, maxS] = await Promise.all([
    prisma.salesBoardSetting.findUnique({ where: { key: "audit_min_seconds" } }),
    prisma.salesBoardSetting.findUnique({ where: { key: "audit_max_seconds" } }),
  ]);
  res.json({ minSeconds: minS ? parseInt(minS.value, 10) : 0, maxSeconds: maxS ? parseInt(maxS.value, 10) : 0 });
}));

router.put("/settings/audit-duration", requireAuth, requireRole("MANAGER", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const schema = z.object({ minSeconds: z.number().int().min(0), maxSeconds: z.number().int().min(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  await Promise.all([
    prisma.salesBoardSetting.upsert({
      where: { key: "audit_min_seconds" },
      create: { key: "audit_min_seconds", value: String(parsed.data.minSeconds) },
      update: { value: String(parsed.data.minSeconds) },
    }),
    prisma.salesBoardSetting.upsert({
      where: { key: "audit_max_seconds" },
      create: { key: "audit_max_seconds", value: String(parsed.data.maxSeconds) },
      update: { value: String(parsed.data.maxSeconds) },
    }),
  ]);
  await logAudit(req.user!.id, "UPDATE", "SalesBoardSetting", "audit_duration_filter");
  res.json(parsed.data);
}));

// GET /settings/ai-scoring-enabled
router.get("/settings/ai-scoring-enabled", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const row = await prisma.salesBoardSetting.findUnique({ where: { key: "ai_scoring_enabled" } });
  res.json({ enabled: row ? row.value === "true" : false });
}));

// PUT /settings/ai-scoring-enabled
router.put("/settings/ai-scoring-enabled", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  await prisma.salesBoardSetting.upsert({
    where: { key: "ai_scoring_enabled" },
    update: { value: String(parsed.data.enabled) },
    create: { key: "ai_scoring_enabled", value: String(parsed.data.enabled) },
  });
  await logAudit(req.user!.id, "UPDATE", "SalesBoardSetting", "ai_scoring_enabled", { enabled: parsed.data.enabled });
  res.json({ enabled: parsed.data.enabled });
}));

// GET /settings/convoso-polling
router.get("/settings/convoso-polling", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (_req, res) => {
  const [enabledRow, startRow, endRow] = await Promise.all([
    prisma.salesBoardSetting.findUnique({ where: { key: "convoso_polling_enabled" } }),
    prisma.salesBoardSetting.findUnique({ where: { key: "convoso_business_hours_start" } }),
    prisma.salesBoardSetting.findUnique({ where: { key: "convoso_business_hours_end" } }),
  ]);
  res.json({
    enabled: enabledRow ? enabledRow.value === "true" : false,
    businessHoursStart: startRow?.value ?? "08:00",
    businessHoursEnd: endRow?.value ?? "18:00",
  });
}));

// PUT /settings/convoso-polling
router.put("/settings/convoso-polling", requireAuth, requireRole("OWNER_VIEW", "SUPER_ADMIN"), asyncHandler(async (req, res) => {
  const parsed = z.object({
    enabled: z.boolean().optional(),
    businessHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    businessHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));
  const updates: Promise<unknown>[] = [];
  if (parsed.data.enabled !== undefined) {
    updates.push(prisma.salesBoardSetting.upsert({
      where: { key: "convoso_polling_enabled" },
      update: { value: String(parsed.data.enabled) },
      create: { key: "convoso_polling_enabled", value: String(parsed.data.enabled) },
    }));
  }
  if (parsed.data.businessHoursStart) {
    updates.push(prisma.salesBoardSetting.upsert({
      where: { key: "convoso_business_hours_start" },
      update: { value: parsed.data.businessHoursStart },
      create: { key: "convoso_business_hours_start", value: parsed.data.businessHoursStart },
    }));
  }
  if (parsed.data.businessHoursEnd) {
    updates.push(prisma.salesBoardSetting.upsert({
      where: { key: "convoso_business_hours_end" },
      update: { value: parsed.data.businessHoursEnd },
      create: { key: "convoso_business_hours_end", value: parsed.data.businessHoursEnd },
    }));
  }
  await Promise.all(updates);
  await logAudit(req.user!.id, "UPDATE", "SalesBoardSetting", "convoso_polling", parsed.data);
  res.json(parsed.data);
}));

export default router;
