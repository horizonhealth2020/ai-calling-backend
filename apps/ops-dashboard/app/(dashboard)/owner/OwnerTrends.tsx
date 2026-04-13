"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  DateRangeFilter,
  KPI_PRESETS,
  SkeletonCard,
  EmptyState,
  useToast,
  colors,
  spacing,
  radius,
  typography,
  baseCardStyle,
  semanticColors,
  colorAlpha,
} from "@ops/ui";
import type { DateRangeFilterValue } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar } from "@ops/utils";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  LineChart,
  BarChart,
  AreaChart,
} from "recharts";
import { TrendingUp, BarChart3, Users, Layers, Download } from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────── */

type RevenueTrendPoint = {
  date: string;
  premiumTotal: number;
  commissionTotal: number;
  chargebackTotal: number;
};

type AgentKpiPoint = {
  date: string;
  agentId: string;
  agentName: string;
  totalCalls: number;
  avgCallLength: number;
  closeRate: number;
};

type LeadSourceRow = {
  sourceId: string;
  sourceName: string;
  salesCount: number;
  premiumTotal: number;
  callCount: number;
  costPerSale: number;
  conversionRate: number;
};

type CallQualityPoint = {
  date: string;
  short: number;
  contacted: number;
  engaged: number;
  deep: number;
};

type TrendsData = {
  revenueTrend: RevenueTrendPoint[];
  agentKpiTrend: AgentKpiPoint[];
  leadSourceEffectiveness: LeadSourceRow[];
  callQualityTrend: CallQualityPoint[];
};

/* ── Styles ────────────────────────────────────────────────────── */

const SECTION: React.CSSProperties = {
  ...baseCardStyle,
  padding: spacing.lg,
  marginBottom: spacing.lg,
};

const SECTION_HEADER: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: spacing.md,
  fontSize: typography.sizes.lg.fontSize,
  fontWeight: typography.weights.semibold,
  color: colors.textPrimary,
};

const CHART_WRAP: React.CSSProperties = {
  width: "100%",
  height: 320,
};

const SELECT_STYLE: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${colorAlpha(colors.textMuted, 0.25)}`,
  borderRadius: radius.md,
  color: colors.textPrimary,
  padding: "6px 12px",
  fontSize: typography.sizes.sm.fontSize,
  outline: "none",
  cursor: "pointer",
};

/* ── Custom Tooltip ────────────────────────────────────────────── */

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(15,15,25,0.95)",
  border: `1px solid ${colorAlpha(colors.textMuted, 0.2)}`,
  borderRadius: radius.md,
  padding: "10px 14px",
  fontSize: typography.sizes.sm.fontSize,
  color: colors.textPrimary,
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Recharts tooltip payload
function DarkTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ fontWeight: typography.weights.semibold, marginBottom: 6, color: colors.textSecondary }}>{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color, display: "inline-block" }} />
          <span style={{ color: colors.textSecondary }}>{entry.name}:</span>
          <span style={{ fontWeight: typography.weights.semibold }}>
            {formatter ? formatter(entry.value, entry.name) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Chart Colors ──────────────────────────────────────────────── */

const COLORS = {
  premium: semanticColors.accentTealMid,
  commission: semanticColors.accentBlue,
  chargeback: semanticColors.dangerLight,
  calls: semanticColors.accentTealMid,
  avgCallLength: semanticColors.accentBlue,
  closeRate: semanticColors.accentGreenMid,
  conversionRate: semanticColors.accentGreenMid,
  costPerSale: semanticColors.warningAmber,
  short: semanticColors.dangerLight,
  contacted: semanticColors.warningAmber,
  engaged: semanticColors.accentBlue,
  deep: semanticColors.accentGreenMid,
};

const GRID_STROKE = "rgba(255,255,255,0.06)";
const AXIS_TICK = { fill: colors.textMuted, fontSize: 11 };

/* ── CSV Helpers ──────────────────────────────────────────────── */

function csvField(val: string | number): string {
  const s = String(val);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Helpers ───────────────────────────────────────────────────── */

function buildDateParams(dr: DateRangeFilterValue): string {
  if (dr.preset === "custom" && dr.from && dr.to)
    return `from=${dr.from}&to=${dr.to}`;
  if (dr.preset && dr.preset !== "custom") return `range=${dr.preset}`;
  return "";
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtDuration(seconds: number): string {
  if (!seconds) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ── Component ─────────────────────────────────────────────────── */

export default function OwnerTrends({ API }: { API: string }) {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRangeFilterValue>({ preset: "month" });
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildDateParams(dateRange);
      const res = await authFetch(`${API}/api/owner/trends?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast("error", err?.error ?? `Request failed (${res.status})`);
        setData(null);
        return;
      }
      setData(await res.json());
    } catch {
      toast("error", "Failed to load trends data");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [API, dateRange, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Get unique agents from KPI data for selector
  const agents = data?.agentKpiTrend
    ? [...new Map(data.agentKpiTrend.map(d => [d.agentId, d.agentName])).entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // Filter KPI data for selected agent
  const filteredKpiData = data?.agentKpiTrend
    ? selectedAgent === "all"
      ? aggregateAllAgentKpi(data.agentKpiTrend)
      : data.agentKpiTrend.filter(d => d.agentId === selectedAgent)
    : [];

  const hasExportData = !loading && data && (
    (data.revenueTrend?.length ?? 0) > 0 ||
    (data.leadSourceEffectiveness?.length ?? 0) > 0 ||
    (data.callQualityTrend?.length ?? 0) > 0
  );

  function exportTrendsCsv() {
    if (!data) return;
    const sections: string[] = [];

    if (data.revenueTrend?.length) {
      sections.push("Revenue Trend");
      sections.push("Date,Premium,Commission,Chargebacks");
      for (const r of data.revenueTrend) {
        sections.push([r.date, r.premiumTotal.toFixed(2), r.commissionTotal.toFixed(2), r.chargebackTotal.toFixed(2)].join(","));
      }
      sections.push("");
    }

    if (data.leadSourceEffectiveness?.length) {
      sections.push("Lead Source Effectiveness");
      sections.push("Source,Sales,Premium,Calls,Cost/Sale,Conversion Rate");
      for (const r of data.leadSourceEffectiveness) {
        sections.push([csvField(r.sourceName), r.salesCount, r.premiumTotal.toFixed(2), r.callCount, r.costPerSale.toFixed(2), (r.conversionRate * 100).toFixed(1) + "%"].join(","));
      }
      sections.push("");
    }

    if (data.callQualityTrend?.length) {
      sections.push("Call Quality Trend");
      sections.push("Date,Short,Contacted,Engaged,Deep");
      for (const r of data.callQualityTrend) {
        sections.push([r.date, r.short, r.contacted, r.engaged, r.deep].join(","));
      }
    }

    downloadCsv(sections.join("\n"), `trends-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div>
      {/* Date Range Filter + Export */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing[3], marginBottom: spacing.md }}>
        {hasExportData && (
          <button
            onClick={exportTrendsCsv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(255,255,255,0.06)",
              border: `1px solid ${colorAlpha(colors.textMuted, 0.25)}`,
              borderRadius: radius.md,
              color: colors.textSecondary,
              padding: "6px 14px",
              fontSize: typography.sizes.sm.fontSize,
              cursor: "pointer",
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        )}
        <DateRangeFilter value={dateRange} onChange={setDateRange} presets={KPI_PRESETS} />
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          <SkeletonCard height={380} />
          <SkeletonCard height={380} />
          <SkeletonCard height={320} />
          <SkeletonCard height={380} />
        </div>
      ) : (
        <>
          {/* ── Revenue Trends ─────────────────────────────── */}
          <div style={SECTION}>
            <div style={SECTION_HEADER}>
              <TrendingUp size={20} color={COLORS.premium} />
              Revenue Trends
            </div>
            {!data?.revenueTrend?.length ? (
              <EmptyState icon={<TrendingUp size={32} />} title="No revenue data" description="No sales found in the selected date range." />
            ) : (
              <div style={CHART_WRAP}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.revenueTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="date" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<DarkTooltip formatter={(v: number, name: string) => name.includes("chargeback") ? formatDollar(v) : formatDollar(v)} />} />
                    <Legend wrapperStyle={{ color: colors.textSecondary, fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="premiumTotal"
                      name="Premium"
                      fill={colorAlpha(COLORS.premium, 0.15)}
                      stroke={COLORS.premium}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="commissionTotal"
                      name="Commission"
                      stroke={COLORS.commission}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Bar
                      dataKey="chargebackTotal"
                      name="Chargebacks"
                      fill={colorAlpha(COLORS.chargeback, 0.6)}
                      radius={[3, 3, 0, 0]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Agent KPI Trends ───────────────────────────── */}
          <div style={SECTION}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
              <div style={SECTION_HEADER}>
                <Users size={20} color={COLORS.calls} />
                Agent KPI Trends
              </div>
              <select
                style={SELECT_STYLE}
                value={selectedAgent}
                onChange={e => setSelectedAgent(e.target.value)}
              >
                <option value="all">All Agents (Avg)</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            {!filteredKpiData?.length ? (
              <EmptyState icon={<Users size={32} />} title="No agent KPI data" description="No call KPI snapshots found in the selected date range." />
            ) : (
              <div style={CHART_WRAP}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredKpiData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="date" tick={AXIS_TICK} />
                    <YAxis yAxisId="left" tick={AXIS_TICK} />
                    <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip content={<DarkTooltip formatter={(v: number, name: string) => {
                      if (name === "Close Rate") return fmtPct(v);
                      if (name === "Avg Call Length") return fmtDuration(v);
                      return v.toLocaleString();
                    }} />} />
                    <Legend wrapperStyle={{ color: colors.textSecondary, fontSize: 12 }} />
                    <Line yAxisId="left" type="monotone" dataKey="totalCalls" name="Total Calls" stroke={COLORS.calls} strokeWidth={2} dot={false} />
                    <Line yAxisId="left" type="monotone" dataKey="avgCallLength" name="Avg Call Length" stroke={COLORS.avgCallLength} strokeWidth={2} dot={false} strokeDasharray="5 5" />
                    <Line yAxisId="right" type="monotone" dataKey="closeRate" name="Close Rate" stroke={COLORS.closeRate} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Lead Source Effectiveness ──────────────────── */}
          <div style={SECTION}>
            <div style={SECTION_HEADER}>
              <BarChart3 size={20} color={COLORS.conversionRate} />
              Lead Source Effectiveness
            </div>
            {!data?.leadSourceEffectiveness?.length ? (
              <EmptyState icon={<BarChart3 size={32} />} title="No lead source data" description="No sales matched to lead sources in the selected date range." />
            ) : (
              <div style={CHART_WRAP}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.leadSourceEffectiveness} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="sourceName" tick={AXIS_TICK} interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis yAxisId="left" tick={AXIS_TICK} tickFormatter={(v: number) => `${v}%`} />
                    <YAxis yAxisId="right" orientation="right" tick={AXIS_TICK} tickFormatter={(v: number) => `$${v}`} />
                    <Tooltip content={<DarkTooltip formatter={(v: number, name: string) => {
                      if (name === "Conversion Rate") return fmtPct(v);
                      if (name === "Cost / Sale") return formatDollar(v);
                      return v.toLocaleString();
                    }} />} />
                    <Legend wrapperStyle={{ color: colors.textSecondary, fontSize: 12 }} />
                    <Bar yAxisId="left" dataKey="conversionRate" name="Conversion Rate" fill={colorAlpha(COLORS.conversionRate, 0.7)} radius={[3, 3, 0, 0]} />
                    <Bar yAxisId="right" dataKey="costPerSale" name="Cost / Sale" fill={colorAlpha(COLORS.costPerSale, 0.7)} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* ── Call Quality Over Time ─────────────────────── */}
          <div style={SECTION}>
            <div style={SECTION_HEADER}>
              <Layers size={20} color={COLORS.engaged} />
              Call Quality Over Time
            </div>
            {!data?.callQualityTrend?.length ? (
              <EmptyState icon={<Layers size={32} />} title="No call quality data" description="No call tier data found in the selected date range." />
            ) : (
              <div style={CHART_WRAP}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.callQualityTrend} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="date" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} />
                    <Tooltip content={<DarkTooltip formatter={(v: number, name: string) => {
                      // Find total for percentage
                      return v.toLocaleString();
                    }} />} />
                    <Legend wrapperStyle={{ color: colors.textSecondary, fontSize: 12 }} />
                    <Area type="monotone" dataKey="deep" name="Deep (>5m)" stackId="1" fill={colorAlpha(COLORS.deep, 0.6)} stroke={COLORS.deep} />
                    <Area type="monotone" dataKey="engaged" name="Engaged (2-5m)" stackId="1" fill={colorAlpha(COLORS.engaged, 0.6)} stroke={COLORS.engaged} />
                    <Area type="monotone" dataKey="contacted" name="Contacted (30s-2m)" stackId="1" fill={colorAlpha(COLORS.contacted, 0.6)} stroke={COLORS.contacted} />
                    <Area type="monotone" dataKey="short" name="Short (<30s)" stackId="1" fill={colorAlpha(COLORS.short, 0.6)} stroke={COLORS.short} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Aggregate all agents for "All Agents" view ─────────────── */

function aggregateAllAgentKpi(data: AgentKpiPoint[]): Array<{ date: string; totalCalls: number; avgCallLength: number; closeRate: number }> {
  const dayMap = new Map<string, { totalCalls: number; avgCallLengthSum: number; closeRateSum: number; count: number }>();

  for (const d of data) {
    const entry = dayMap.get(d.date) ?? { totalCalls: 0, avgCallLengthSum: 0, closeRateSum: 0, count: 0 };
    entry.totalCalls += d.totalCalls;
    entry.avgCallLengthSum += d.avgCallLength;
    entry.closeRateSum += d.closeRate;
    entry.count++;
    dayMap.set(d.date, entry);
  }

  return [...dayMap.entries()]
    .map(([date, v]) => ({
      date,
      totalCalls: v.totalCalls,
      avgCallLength: v.count > 0 ? Math.round((v.avgCallLengthSum / v.count) * 100) / 100 : 0,
      closeRate: v.count > 0 ? Math.round((v.closeRateSum / v.count) * 100) / 100 : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
