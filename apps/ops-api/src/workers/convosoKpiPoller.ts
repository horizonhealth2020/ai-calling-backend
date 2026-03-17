/**
 * Cron worker that polls Convoso every 10 minutes for each active lead source,
 * builds per-agent KPI summaries, and persists snapshots to AgentCallKpi table.
 *
 * Silently disabled when CONVOSO_AUTH_TOKEN is not set.
 */

import { prisma } from "@ops/db";
import {
  fetchConvosoCallLogs,
  enrichWithTiers,
  buildKpiSummary,
  type AgentKpi,
} from "../services/convosoCallLogs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractConvosoResults(response: any): any[] {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response)) return response;
  return [];
}

// ---------------------------------------------------------------------------
// Poll a single lead source
// ---------------------------------------------------------------------------

interface LeadSourceRow {
  id: string;
  name: string;
  listId: string | null;
  costPerLead: { toNumber?: () => number } | number;
}

async function pollLeadSource(
  leadSource: LeadSourceRow,
  agentMap: Map<string, { id: string; name: string }>,
  queueId: string,
): Promise<number> {
  try {
    const response = await fetchConvosoCallLogs({
      queue_id: queueId,
      list_id: leadSource.listId!,
      call_type: "INBOUND",
      called_count: "0",
      include_recordings: "0",
    });

    const raw = extractConvosoResults(response);
    if (raw.length === 0) return 0;

    const enriched = enrichWithTiers(raw);
    const costPerLead =
      typeof leadSource.costPerLead === "number"
        ? leadSource.costPerLead
        : typeof (leadSource.costPerLead as any)?.toNumber === "function"
          ? (leadSource.costPerLead as any).toNumber()
          : Number(leadSource.costPerLead);

    const kpiResponse = buildKpiSummary(enriched, { agentMap, costPerLead });

    const records = kpiResponse.per_agent
      .filter((a: AgentKpi) => a.agent_id !== null)
      .map((a: AgentKpi) => ({
        agentId: a.agent_id!,
        leadSourceId: leadSource.id,
        convosoUserId: a.user_id,
        totalCalls: a.total_calls,
        avgCallLength: a.avg_call_length,
        callsByTier: a.calls_by_tier as any,
        costPerSale: a.cost_per_sale,
        totalLeadCost: a.total_lead_cost,
        longestCall: a.longest_call,
        conversionEligible: a.conversion_eligible,
      }));

    if (records.length === 0) return 0;

    await prisma.agentCallKpi.createMany({ data: records });
    return records.length;
  } catch (err: any) {
    console.error(
      JSON.stringify({
        event: "kpi_poll_lead_source_error",
        leadSourceId: leadSource.id,
        leadSourceName: leadSource.name,
        error: err.message,
        timestamp: new Date().toISOString(),
      }),
    );
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Full poll cycle
// ---------------------------------------------------------------------------

async function runPollCycle(): Promise<void> {
  if (!process.env.CONVOSO_AUTH_TOKEN) {
    console.log(
      JSON.stringify({
        event: "kpi_poll_cycle_skipped",
        reason: "CONVOSO_AUTH_TOKEN not set",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  const queueId = process.env.CONVOSO_DEFAULT_QUEUE_ID;
  if (!queueId) {
    console.log(
      JSON.stringify({
        event: "kpi_poll_cycle_skipped",
        reason: "CONVOSO_DEFAULT_QUEUE_ID not set",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  const leadSources = await prisma.leadSource.findMany({
    where: { active: true, listId: { not: null } },
  });

  const agents = await prisma.agent.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true },
  });

  const agentMap = new Map(
    agents
      .filter((a) => a.email)
      .map((a) => [a.email!, { id: a.id, name: a.name }]),
  );

  let totalCount = 0;

  // Sequential to avoid Convoso rate limiting
  for (const ls of leadSources) {
    const count = await pollLeadSource(ls, agentMap, queueId);
    totalCount += count;
  }

  console.log(
    JSON.stringify({
      event: "kpi_poll_cycle_complete",
      leadSourcesPolled: leadSources.length,
      totalRecordsStored: totalCount,
      timestamp: new Date().toISOString(),
    }),
  );
}

// ---------------------------------------------------------------------------
// Entry point — called once at server boot
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function startConvosoKpiPoller(): void {
  if (!process.env.CONVOSO_AUTH_TOKEN) {
    console.log(
      JSON.stringify({
        event: "kpi_poller_disabled",
        reason: "CONVOSO_AUTH_TOKEN not set",
        timestamp: new Date().toISOString(),
      }),
    );
    return;
  }

  setInterval(runPollCycle, POLL_INTERVAL_MS);

  // Fire-and-forget initial run
  runPollCycle().catch((err) =>
    console.error(
      JSON.stringify({
        event: "kpi_poll_cycle_error",
        error: err.message,
        timestamp: new Date().toISOString(),
      }),
    ),
  );

  console.log(
    JSON.stringify({
      event: "kpi_poller_started",
      intervalMinutes: 10,
      timestamp: new Date().toISOString(),
    }),
  );
}
