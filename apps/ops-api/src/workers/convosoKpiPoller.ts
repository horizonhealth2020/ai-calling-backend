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
  type ConvosoCallLog,
} from "../services/convosoCallLogs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractConvosoResults(response: unknown): Record<string, unknown>[] {
  const resp = response as Record<string, unknown> | undefined;
  // Convoso wraps results as { data: { results: [...] } }
  const dataObj = resp?.data as Record<string, unknown> | undefined;
  if (dataObj && Array.isArray(dataObj.results)) return dataObj.results as Record<string, unknown>[];
  // Fallback: data is directly an array
  if (Array.isArray(resp?.data)) return resp.data as Record<string, unknown>[];
  // Fallback: top-level results array
  if (Array.isArray(resp?.results)) return resp.results as Record<string, unknown>[];
  if (Array.isArray(response)) return response as Record<string, unknown>[];
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
  callBufferSeconds: number;
}

async function pollLeadSource(
  leadSource: LeadSourceRow,
  agentMap: Map<string, { id: string; name: string }>,
): Promise<number> {
  try {
    const response = await fetchConvosoCallLogs({
      list_id: leadSource.listId!,
      call_type: "INBOUND",
      called_count: "0",
      include_recordings: "1",
    });

    const raw = extractConvosoResults(response);
    if (raw.length === 0) return 0;

    // --- Deduplication: filter out already-processed call IDs ---
    const callIds = raw.map((r) => String(r.id)).filter(Boolean);

    const existing = await prisma.processedConvosoCall.findMany({
      where: { convosoCallId: { in: callIds } },
      select: { convosoCallId: true },
    });
    const existingSet = new Set(existing.map((e) => e.convosoCallId));

    const newRaw = raw.filter((r) => !existingSet.has(String(r.id)));

    if (existingSet.size > 0) {
      console.log(
        JSON.stringify({
          event: "kpi_poll_dedup",
          leadSourceId: leadSource.id,
          totalFetched: raw.length,
          alreadyProcessed: existingSet.size,
          newCalls: newRaw.length,
          timestamp: new Date().toISOString(),
        }),
      );
    }

    if (newRaw.length === 0) return 0;

    // Write individual call records to ConvosoCallLog (before buffer filtering)
    const callLogRecords = newRaw
      .map((r) => {
        const userId = String(r.user_id ?? "");
        const agentInfo = agentMap.get(userId);
        return {
          agentUser: userId,
          listId: leadSource.listId!,
          recordingUrl: (() => {
            // Convoso returns recording as array of objects with public_url/src
            if (Array.isArray(r.recording) && r.recording.length > 0) {
              const rec = r.recording[0] as Record<string, unknown>;
              const url = String(rec.public_url ?? rec.src ?? "");
              return url.length > 0 ? url : null;
            }
            if (r.recording_url) return String(r.recording_url);
            return null;
          })(),
          callDurationSeconds: (() => {
            const raw = r.call_length ?? r.duration ?? r.length;
            if (raw == null || raw === "") return null;
            const n = Number(raw);
            return isNaN(n) ? null : n;
          })(),
          callTimestamp: (() => {
            const raw = r.call_date ?? r.start_time;
            if (!raw) return new Date();
            // Convoso returns "YYYY-MM-DD HH:MM:SS" without timezone — treat as UTC
            const str = String(raw).replace(" ", "T") + "Z";
            const d = new Date(str);
            return isNaN(d.getTime()) ? new Date() : d;
          })(),
          agentId: agentInfo?.id ?? null,
          leadSourceId: leadSource.id,
        };
      })
      .filter((r) => r.agentUser !== ""); // skip records without user_id

    if (callLogRecords.length > 0) {
      console.log(JSON.stringify({
        event: "kpi_poll_call_log_write",
        leadSourceId: leadSource.id,
        count: callLogRecords.length,
        sample: callLogRecords[0] ? {
          agentUser: callLogRecords[0].agentUser,
          duration: callLogRecords[0].callDurationSeconds,
          hasRecording: !!callLogRecords[0].recordingUrl,
          timestamp: callLogRecords[0].callTimestamp,
        } : null,
        timestamp: new Date().toISOString(),
      }));
      await prisma.convosoCallLog.createMany({ data: callLogRecords });
    }

    // Mark as processed IMMEDIATELY after ConvosoCallLog write
    // (before KPI step which can crash and cause duplicate call logs)
    const newCallIds = newRaw.map((r) => String(r.id)).filter(Boolean);
    if (newCallIds.length > 0) {
      await prisma.processedConvosoCall.createMany({
        data: newCallIds.map((cid) => ({
          convosoCallId: cid,
          leadSourceId: leadSource.id,
        })),
        skipDuplicates: true,
      });
    }

    // Filter: only calls with call_length >= lead source buffer count toward KPIs
    const bufferSeconds = leadSource.callBufferSeconds ?? 0;
    const filtered = bufferSeconds > 0
      ? newRaw.filter((r) => {
          const len = Number(r.call_length ?? 0);
          return len >= bufferSeconds;
        })
      : newRaw;

    if (filtered.length === 0) return 0;

    const enriched = enrichWithTiers(filtered as ConvosoCallLog[]);
    const costPerLead =
      typeof leadSource.costPerLead === "number"
        ? leadSource.costPerLead
        : typeof (leadSource.costPerLead as { toNumber?: () => number })?.toNumber === "function"
          ? (leadSource.costPerLead as { toNumber: () => number }).toNumber()
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
        callsByTier: a.calls_by_tier as unknown as Record<string, number>,
        costPerSale: a.cost_per_sale,
        totalLeadCost: a.total_lead_cost,
        longestCall: a.longest_call,
        conversionEligible: a.conversion_eligible,
      }));

    if (records.length === 0) return 0;

    await prisma.agentCallKpi.createMany({ data: records });

    return records.length;
  } catch (err: unknown) {
    console.error(
      JSON.stringify({
        event: "kpi_poll_lead_source_error",
        leadSourceId: leadSource.id,
        leadSourceName: leadSource.name,
        error: err instanceof Error ? err.message : String(err),
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

  // Check if polling is enabled
  const enabledSetting = await prisma.salesBoardSetting.findUnique({ where: { key: "convoso_polling_enabled" } });
  if (!enabledSetting || enabledSetting.value !== "true") {
    console.log(JSON.stringify({ event: "kpi_poll_cycle_skipped", reason: "polling disabled", timestamp: new Date().toISOString() }));
    return;
  }

  // Check business hours
  const [startSetting, endSetting] = await Promise.all([
    prisma.salesBoardSetting.findUnique({ where: { key: "convoso_business_hours_start" } }),
    prisma.salesBoardSetting.findUnique({ where: { key: "convoso_business_hours_end" } }),
  ]);
  const startHour = startSetting?.value ?? "08:00";
  const endHour = endSetting?.value ?? "18:00";
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  if (currentTime < startHour || currentTime >= endHour) {
    console.log(JSON.stringify({ event: "kpi_poll_cycle_skipped", reason: "outside business hours", currentTime, businessHours: `${startHour}-${endHour}`, timestamp: now.toISOString() }));
    return;
  }

  const leadSources = await prisma.leadSource.findMany({
    where: { active: true, listId: { not: null } },
  });

  const agents = await prisma.agent.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true },
  });

  // Agent map keyed by CRM user ID (stored in email field) → agent info
  const agentMap = new Map(
    agents
      .filter((a) => a.email)
      .map((a) => [a.email!, { id: a.id, name: a.name }]),
  );

  let totalCount = 0;

  // Sequential to avoid Convoso rate limiting
  for (const ls of leadSources) {
    const count = await pollLeadSource(ls, agentMap);
    totalCount += count;
  }

  // Cleanup processed call records older than 30 days
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count } = await prisma.processedConvosoCall.deleteMany({
      where: { processedAt: { lt: cutoff } },
    });
    if (count > 0) {
      console.log(
        JSON.stringify({
          event: "kpi_poll_cleanup",
          deletedRecords: count,
          cutoffDate: cutoff.toISOString(),
          timestamp: new Date().toISOString(),
        }),
      );
    }
  } catch (cleanupErr: unknown) {
    console.error(
      JSON.stringify({
        event: "kpi_poll_cleanup_error",
        error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        timestamp: new Date().toISOString(),
      }),
    );
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
