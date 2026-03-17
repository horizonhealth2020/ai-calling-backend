/**
 * Convoso Call Log API integration with KPI screening.
 *
 * Fetches call logs from Convoso, classifies by call-length tier,
 * and aggregates per-agent KPI summaries for performance screening.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CallLengthTier = "live" | "short" | "contacted" | "engaged" | "deep";

export interface ConvosoCallLog extends Record<string, unknown> {
  call_length: number | null;
  user_id: string | number | null;
}

export interface EnrichedCallLog extends ConvosoCallLog {
  call_length_tier: CallLengthTier;
}

export interface KpiSummary {
  total_calls: number;
  avg_call_length: number;
  live_call_count: number;
  breakdown_by_tier: Record<CallLengthTier, number>;
}

export interface AgentKpi {
  user_id: string;
  total_calls: number;
  avg_call_length: number;
  calls_by_tier: Record<CallLengthTier, number>;
  conversion_eligible: boolean;
  longest_call: number;
}

export interface KpiResponse {
  summary: KpiSummary;
  per_agent: AgentKpi[];
  results: EnrichedCallLog[];
}

// ---------------------------------------------------------------------------
// Tier classification
// ---------------------------------------------------------------------------

export function classifyTier(callLength: number | null): CallLengthTier {
  if (callLength === null || callLength === undefined) return "live";
  if (callLength < 30) return "short";
  if (callLength < 120) return "contacted";
  if (callLength < 300) return "engaged";
  return "deep";
}

// ---------------------------------------------------------------------------
// Convoso API client
// ---------------------------------------------------------------------------

export async function fetchConvosoCallLogs(params: Record<string, string>): Promise<any> {
  const token = process.env.CONVOSO_AUTH_TOKEN;
  if (!token) {
    throw new Error("CONVOSO_AUTH_TOKEN is not configured");
  }

  const url = new URL("https://api.convoso.com/v1/log/retrieve");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Convoso API returned ${response.status}: ${body}`);
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// Enrichment & filtering
// ---------------------------------------------------------------------------

export function enrichWithTiers(records: ConvosoCallLog[]): EnrichedCallLog[] {
  return records.map((record) => ({
    ...record,
    call_length_tier: classifyTier(record.call_length),
  }));
}

export function filterByCallLength(
  records: EnrichedCallLog[],
  min?: number,
  max?: number,
): EnrichedCallLog[] {
  return records.filter((r) => {
    if (r.call_length === null || r.call_length === undefined) return false;
    if (min !== undefined && r.call_length < min) return false;
    if (max !== undefined && r.call_length > max) return false;
    return true;
  });
}

export function filterByTier(
  records: EnrichedCallLog[],
  tier: CallLengthTier,
): EnrichedCallLog[] {
  return records.filter((r) => r.call_length_tier === tier);
}

// ---------------------------------------------------------------------------
// KPI aggregation
// ---------------------------------------------------------------------------

function emptyTierCounts(): Record<CallLengthTier, number> {
  return { live: 0, short: 0, contacted: 0, engaged: 0, deep: 0 };
}

export function buildKpiSummary(records: EnrichedCallLog[]): KpiResponse {
  const breakdownByTier = emptyTierCounts();
  let callLengthSum = 0;
  let callLengthCount = 0;
  let liveCallCount = 0;

  for (const r of records) {
    breakdownByTier[r.call_length_tier]++;
    if (r.call_length !== null && r.call_length !== undefined) {
      callLengthSum += r.call_length;
      callLengthCount++;
    } else {
      liveCallCount++;
    }
  }

  const summary: KpiSummary = {
    total_calls: records.length,
    avg_call_length: callLengthCount > 0 ? Math.round((callLengthSum / callLengthCount) * 100) / 100 : 0,
    live_call_count: liveCallCount,
    breakdown_by_tier: breakdownByTier,
  };

  // Group by user_id for per-agent KPIs
  const agentMap = new Map<string, EnrichedCallLog[]>();
  for (const r of records) {
    const uid = String(r.user_id ?? "unknown");
    const list = agentMap.get(uid);
    if (list) {
      list.push(r);
    } else {
      agentMap.set(uid, [r]);
    }
  }

  const perAgent: AgentKpi[] = [];
  for (const [userId, agentRecords] of agentMap) {
    const tierCounts = emptyTierCounts();
    let agentSum = 0;
    let agentCount = 0;
    let longestCall = 0;

    for (const r of agentRecords) {
      tierCounts[r.call_length_tier]++;
      if (r.call_length !== null && r.call_length !== undefined) {
        agentSum += r.call_length;
        agentCount++;
        if (r.call_length > longestCall) longestCall = r.call_length;
      }
    }

    perAgent.push({
      user_id: userId,
      total_calls: agentRecords.length,
      avg_call_length: agentCount > 0 ? Math.round((agentSum / agentCount) * 100) / 100 : 0,
      calls_by_tier: tierCounts,
      conversion_eligible: tierCounts.engaged > 0 || tierCounts.deep > 0,
      longest_call: longestCall,
    });
  }

  return { summary, per_agent: perAgent, results: records };
}
