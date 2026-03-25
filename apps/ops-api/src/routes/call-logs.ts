import { Router } from "express";
import { z } from "zod";
import { prisma } from "@ops/db";
import { requireAuth } from "../middleware/auth";
import { fetchConvosoCallLogs, enrichWithTiers, filterByCallLength, filterByTier, buildKpiSummary, CallLengthTier, type ConvosoCallLog } from "../services/convosoCallLogs";
import { zodErr, asyncHandler } from "./helpers";

const router = Router();

const callLogsQuerySchema = z.object({
  queue_id: z.string().min(1, "queue_id is required"),
  list_id: z.string().min(1, "list_id is required"),
  min_call_length: z.coerce.number().optional(),
  max_call_length: z.coerce.number().optional(),
  tier: z.enum(["live", "short", "contacted", "engaged", "deep"]).optional(),
});

const CALL_LOG_PASS_THROUGH_PARAMS = [
  "id", "lead_id", "campaign_id", "user_id", "status", "phone_number",
  "number_dialed", "first_name", "last_name", "start_time", "end_time",
  "limit", "offset", "order",
] as const;

function buildConvosoParams(query: Record<string, string | string[] | undefined>): Record<string, string> {
  const params: Record<string, string> = {
    queue_id: String(query.queue_id),
    list_id: String(query.list_id),
    call_type: (query.call_type as string) || "INBOUND",
    called_count: (query.called_count as string) || "0",
    include_recordings: (query.include_recordings as string) || "1",
  };
  for (const key of CALL_LOG_PASS_THROUGH_PARAMS) {
    if (query[key] !== undefined && query[key] !== "") {
      params[key] = String(query[key]);
    }
  }
  return params;
}

function extractConvosoResults(response: unknown): Record<string, unknown>[] {
  const resp = response as Record<string, unknown> | undefined;
  if (Array.isArray(resp?.data)) return resp.data as Record<string, unknown>[];
  if (Array.isArray(resp?.results)) return resp.results as Record<string, unknown>[];
  if (Array.isArray(response)) return response as Record<string, unknown>[];
  return [];
}

function tierBreakdown(records: { call_length_tier: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of records) {
    counts[r.call_length_tier] = (counts[r.call_length_tier] || 0) + 1;
  }
  return counts;
}

// KPI route registered first to avoid Express treating /kpi as a param on /call-logs
router.get("/call-logs/kpi", requireAuth, asyncHandler(async (req, res) => {
  const parsed = callLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { queue_id, list_id, min_call_length: minCallLength, max_call_length: maxCallLength, tier: tierParam } = parsed.data;

  try {
    const params = buildConvosoParams(req.query as Record<string, string | string[] | undefined>);
    const response = await fetchConvosoCallLogs(params);
    const raw = extractConvosoResults(response);

    let enriched = enrichWithTiers(raw as ConvosoCallLog[]);
    if (minCallLength !== undefined || maxCallLength !== undefined) {
      enriched = filterByCallLength(enriched, minCallLength, maxCallLength);
    }
    if (tierParam) {
      enriched = filterByTier(enriched, tierParam);
    }

    // Fetch agents and lead source for agent-aware KPI aggregation
    const agents = await prisma.agent.findMany({ where: { active: true }, select: { id: true, name: true, email: true } });
    const agentMap = new Map(agents.filter(a => a.email).map(a => [a.email!, { id: a.id, name: a.name }]));
    let costPerLead = 0;
    if (list_id) {
      const leadSource = await prisma.leadSource.findFirst({ where: { listId: list_id } });
      costPerLead = leadSource?.costPerLead ? Number(leadSource.costPerLead) : 0;
    }

    const kpiResponse = buildKpiSummary(enriched, { agentMap, costPerLead });

    console.log(JSON.stringify({
      event: "call_logs_kpi_fetch",
      queue_id,
      list_id,
      timestamp: new Date().toISOString(),
      total_results: enriched.length,
      tier_breakdown: tierBreakdown(enriched),
      summary: kpiResponse.summary,
    }));

    return res.json({ success: true, ...kpiResponse });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("CONVOSO_AUTH_TOKEN")) {
      return res.status(500).json({ error: "Convoso integration not configured" });
    }
    return res.status(502).json({ error: "Failed to fetch from Convoso", details: message });
  }
}));

router.get("/call-logs", requireAuth, asyncHandler(async (req, res) => {
  const parsed = callLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json(zodErr(parsed.error));

  const { queue_id, list_id, min_call_length: minCallLength, max_call_length: maxCallLength, tier: tierParam } = parsed.data;

  try {
    const params = buildConvosoParams(req.query as Record<string, string | string[] | undefined>);
    const response = await fetchConvosoCallLogs(params);
    const raw = extractConvosoResults(response);

    let enriched = enrichWithTiers(raw as ConvosoCallLog[]);
    if (minCallLength !== undefined || maxCallLength !== undefined) {
      enriched = filterByCallLength(enriched, minCallLength, maxCallLength);
    }
    if (tierParam) {
      enriched = filterByTier(enriched, tierParam);
    }

    console.log(JSON.stringify({
      event: "call_logs_fetch",
      queue_id,
      list_id,
      timestamp: new Date().toISOString(),
      total_results: enriched.length,
      tier_breakdown: tierBreakdown(enriched),
    }));

    return res.json({ success: true, count: enriched.length, data: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("CONVOSO_AUTH_TOKEN")) {
      return res.status(500).json({ error: "Convoso integration not configured" });
    }
    return res.status(502).json({ error: "Failed to fetch from Convoso", details: message });
  }
}));

export default router;
