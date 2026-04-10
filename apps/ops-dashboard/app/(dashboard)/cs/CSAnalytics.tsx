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
  baseThStyle,
  baseTdStyle,
  semanticColors,
  colorAlpha,
} from "@ops/ui";
import type { DateRangeFilterValue } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar } from "@ops/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";
import { PieChart, Users, AlertTriangle, FileText, ChevronDown, ChevronUp, Download, Loader2 } from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────── */

type RepPerformance = {
  repName: string;
  chargebackCount: number;
  pendingTermCount: number;
  resolvedCount: number;
  resolutionRate: number;
  avgTurnaroundHours: number;
};

type Distribution = { status?: string; type?: string; reason?: string; count: number };

type AnalyticsData = {
  repPerformance: RepPerformance[];
  chargebackPatterns: {
    matchStatusDistribution: Array<{ status: string; count: number }>;
    resolutionTypeDistribution: Array<{ type: string; count: number }>;
  };
  pendingTermCategories: {
    holdReasonDistribution: Array<{ reason: string; count: number }>;
    resolutionTypeDistribution: Array<{ type: string; count: number }>;
  };
  totals: {
    totalChargebacks: number;
    totalPendingTerms: number;
    totalResolved: number;
    overallResolutionRate: number;
    avgTurnaroundHours: number;
  };
};

type DrillDownItem = {
  type: "chargeback" | "pending_term";
  memberName: string;
  resolvedAt: string;
  resolutionType: string | null;
  resolutionNote: string | null;
  originalAmount: number;
};

type DrillDownResult = { items: DrillDownItem[]; total: number; hasMore: boolean };

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

const STAT_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: spacing.md,
  marginBottom: spacing.lg,
};

const STAT_CARD: React.CSSProperties = {
  ...baseCardStyle,
  padding: spacing.md,
  textAlign: "center" as const,
};

const CHART_WRAP: React.CSSProperties = {
  width: "100%",
  height: 280,
};

const SIDE_BY_SIDE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: spacing.md,
};

const HALF_CHART: React.CSSProperties = {
  flex: "1 1 320px",
  minWidth: 0,
};

const TOOLTIP_STYLE: React.CSSProperties = {
  background: "rgba(15,15,25,0.95)",
  border: `1px solid ${colorAlpha(colors.textMuted, 0.2)}`,
  borderRadius: radius.md,
  padding: "10px 14px",
  fontSize: typography.sizes.sm.fontSize,
  color: colors.textPrimary,
  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
};

const DRILL_ROW: React.CSSProperties = {
  background: "rgba(255,255,255,0.02)",
  borderTop: `1px solid ${colorAlpha(colors.textMuted, 0.1)}`,
  padding: spacing.md,
};

const BADGE: (color: string) => React.CSSProperties = (color) => ({
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: radius.sm,
  fontSize: typography.sizes.xs.fontSize,
  fontWeight: typography.weights.semibold,
  background: colorAlpha(color, 0.15),
  color,
});

/* ── Chart Colors ──────────────────────────────────────────────── */

const COLORS = {
  resolved: semanticColors.accentGreenMid,
  chargeback: semanticColors.dangerLight,
  pendingTerm: semanticColors.warningAmber,
  matched: semanticColors.accentGreenMid,
  unmatched: semanticColors.dangerLight,
  multiple: semanticColors.warningAmber,
  unknown: colors.textMuted,
  recovered: semanticColors.accentGreenMid,
  closed: semanticColors.warningAmber,
  saved: semanticColors.accentGreenMid,
  cancelled: semanticColors.warningAmber,
  unresolved: semanticColors.dangerLight,
};

const GRID_STROKE = "rgba(255,255,255,0.06)";
const AXIS_TICK = { fill: colors.textMuted, fontSize: 11 };

/* ── Custom Tooltip ────────────────────────────────────────────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div style={{ fontWeight: typography.weights.semibold, marginBottom: 6, color: colors.textSecondary }}>{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color, display: "inline-block" }} />
          <span style={{ color: colors.textSecondary }}>{entry.name}:</span>
          <span style={{ fontWeight: typography.weights.semibold }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────── */

function buildDateParams(dr: DateRangeFilterValue): string {
  if (dr.preset === "custom" && dr.from && dr.to)
    return `from=${dr.from}&to=${dr.to}`;
  if (dr.preset && dr.preset !== "custom") return `range=${dr.preset}`;
  return "";
}

function getBarColor(key: string): string {
  return (COLORS as Record<string, string>)[key.toLowerCase()] ?? semanticColors.accentBlue;
}

function generateCsv(data: AnalyticsData): string {
  const headers = ["Rep Name", "Chargebacks", "Pending Terms", "Resolved", "Resolution Rate (%)", "Avg Turnaround (hrs)"];
  const rows = data.repPerformance.map(r =>
    [r.repName, r.chargebackCount, r.pendingTermCount, r.resolvedCount, r.resolutionRate, r.avgTurnaroundHours].join(",")
  );
  const totals = data.totals;
  rows.push(["TOTAL", totals.totalChargebacks, totals.totalPendingTerms, totals.totalResolved, totals.overallResolutionRate, totals.avgTurnaroundHours].join(","));
  return [headers.join(","), ...rows].join("\n");
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cs-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Component ─────────────────────────────────────────────────── */

export default function CSAnalytics({ API }: { API: string }) {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRangeFilterValue>({ preset: "month" });
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRep, setExpandedRep] = useState<string | null>(null);
  const [drillData, setDrillData] = useState<DrillDownResult | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setExpandedRep(null);
    setDrillData(null);
    try {
      const params = buildDateParams(dateRange);
      const res = await authFetch(`${API}/api/cs/analytics?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        toast("error", err?.error ?? `Request failed (${res.status})`);
        setData(null);
        return;
      }
      setData(await res.json());
    } catch {
      toast("error", "Failed to load CS analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [API, dateRange, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchDrillDown = useCallback(async (repName: string, offset = 0) => {
    setDrillLoading(true);
    try {
      const params = buildDateParams(dateRange);
      const res = await authFetch(`${API}/api/cs/analytics/rep/${encodeURIComponent(repName)}?${params}&limit=50&offset=${offset}`);
      if (!res.ok) {
        toast("error", "Failed to load rep details");
        return;
      }
      const result: DrillDownResult = await res.json();
      if (offset > 0 && drillData) {
        setDrillData({ ...result, items: [...drillData.items, ...result.items] });
      } else {
        setDrillData(result);
      }
    } catch {
      toast("error", "Failed to load rep details");
    } finally {
      setDrillLoading(false);
    }
  }, [API, dateRange, toast, drillData]);

  const toggleRep = (repName: string) => {
    if (expandedRep === repName) {
      setExpandedRep(null);
      setDrillData(null);
    } else {
      setExpandedRep(repName);
      setDrillData(null);
      fetchDrillDown(repName);
    }
  };

  return (
    <div>
      {/* Header with DateRange + CSV Export */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: spacing.md, marginBottom: spacing.md }}>
        {data && (
          <button
            onClick={() => downloadCsv(generateCsv(data))}
            style={{
              display: "flex",
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
          <SkeletonCard height={80} />
          <SkeletonCard height={380} />
          <SkeletonCard height={300} />
          <SkeletonCard height={300} />
        </div>
      ) : !data ? (
        <EmptyState icon={<PieChart size={32} />} title="No analytics data" description="Failed to load CS analytics." />
      ) : (
        <>
          {/* ── Summary Stat Cards ─────────────────────── */}
          <div style={STAT_GRID}>
            <StatCard label="Total Chargebacks" value={data.totals.totalChargebacks} color={COLORS.chargeback} />
            <StatCard label="Total Pending Terms" value={data.totals.totalPendingTerms} color={COLORS.pendingTerm} />
            <StatCard label="Resolution Rate" value={`${data.totals.overallResolutionRate}%`} color={COLORS.resolved} />
            <StatCard label="Avg Turnaround" value={`${data.totals.avgTurnaroundHours}h`} color={semanticColors.accentBlue} />
          </div>

          {/* ── Rep Performance ────────────────────────── */}
          <div style={SECTION}>
            <div style={SECTION_HEADER}>
              <Users size={20} color={COLORS.resolved} />
              Rep Performance
            </div>
            {!data.repPerformance.length ? (
              <EmptyState icon={<Users size={32} />} title="No rep data" description="No assigned items found in the selected date range." />
            ) : (
              <>
                <div style={{ ...CHART_WRAP, height: Math.max(200, data.repPerformance.length * 40 + 60) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.repPerformance} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} horizontal={false} />
                      <XAxis type="number" tick={AXIS_TICK} />
                      <YAxis type="category" dataKey="repName" tick={AXIS_TICK} width={75} />
                      <Tooltip content={<DarkTooltip />} />
                      <Legend wrapperStyle={{ color: colors.textSecondary, fontSize: 12 }} />
                      <Bar dataKey="resolvedCount" name="Resolved" fill={colorAlpha(COLORS.resolved, 0.7)} radius={[0, 3, 3, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Rep Performance Table */}
                <div style={{ overflowX: "auto", marginTop: spacing.md }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={baseThStyle}>Rep</th>
                        <th style={{ ...baseThStyle, textAlign: "right" }}>Chargebacks</th>
                        <th style={{ ...baseThStyle, textAlign: "right" }}>Pending Terms</th>
                        <th style={{ ...baseThStyle, textAlign: "right" }}>Resolved</th>
                        <th style={{ ...baseThStyle, textAlign: "right" }}>Rate</th>
                        <th style={{ ...baseThStyle, textAlign: "right" }}>Avg Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.repPerformance.map(rep => (
                        <React.Fragment key={rep.repName}>
                          <tr
                            onClick={() => toggleRep(rep.repName)}
                            style={{ cursor: "pointer" }}
                          >
                            <td style={{ ...baseTdStyle, color: semanticColors.accentTealMid, fontWeight: typography.weights.semibold }}>
                              {expandedRep === rep.repName ? <ChevronUp size={14} style={{ marginRight: 4, verticalAlign: "middle" }} /> : <ChevronDown size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />}
                              {rep.repName}
                            </td>
                            <td style={{ ...baseTdStyle, textAlign: "right" }}>{rep.chargebackCount}</td>
                            <td style={{ ...baseTdStyle, textAlign: "right" }}>{rep.pendingTermCount}</td>
                            <td style={{ ...baseTdStyle, textAlign: "right" }}>{rep.resolvedCount}</td>
                            <td style={{ ...baseTdStyle, textAlign: "right" }}>{rep.resolutionRate}%</td>
                            <td style={{ ...baseTdStyle, textAlign: "right" }}>{rep.avgTurnaroundHours}h</td>
                          </tr>
                          {expandedRep === rep.repName && (
                            <tr>
                              <td colSpan={6} style={{ padding: 0 }}>
                                <DrillDownPanel
                                  data={drillData}
                                  loading={drillLoading}
                                  onLoadMore={() => fetchDrillDown(rep.repName, drillData?.items.length ?? 0)}
                                  onClose={() => { setExpandedRep(null); setDrillData(null); }}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* ── Chargeback Patterns ────────────────────── */}
          <div style={SECTION}>
            <div style={SECTION_HEADER}>
              <AlertTriangle size={20} color={COLORS.chargeback} />
              Chargeback Patterns
            </div>
            {!data.chargebackPatterns.matchStatusDistribution.length && !data.chargebackPatterns.resolutionTypeDistribution.length ? (
              <EmptyState icon={<AlertTriangle size={32} />} title="No chargeback data" description="No chargebacks found in the selected date range." />
            ) : (
              <div style={SIDE_BY_SIDE}>
                <div style={HALF_CHART}>
                  <div style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, marginBottom: 8 }}>Match Status</div>
                  <div style={CHART_WRAP}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.chargebackPatterns.matchStatusDistribution} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis dataKey="status" tick={AXIS_TICK} />
                        <YAxis tick={AXIS_TICK} />
                        <Tooltip content={<DarkTooltip />} />
                        <Bar dataKey="count" name="Count" radius={[3, 3, 0, 0]}>
                          {data.chargebackPatterns.matchStatusDistribution.map((d, i) => (
                            <Cell key={i} fill={getBarColor(d.status)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={HALF_CHART}>
                  <div style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, marginBottom: 8 }}>Resolution Type</div>
                  <div style={CHART_WRAP}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.chargebackPatterns.resolutionTypeDistribution} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis dataKey="type" tick={AXIS_TICK} />
                        <YAxis tick={AXIS_TICK} />
                        <Tooltip content={<DarkTooltip />} />
                        <Bar dataKey="count" name="Count" radius={[3, 3, 0, 0]}>
                          {data.chargebackPatterns.resolutionTypeDistribution.map((d, i) => (
                            <Cell key={i} fill={getBarColor(d.type)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Pending Term Categories ────────────────── */}
          <div style={SECTION}>
            <div style={SECTION_HEADER}>
              <FileText size={20} color={COLORS.pendingTerm} />
              Pending Term Categories
            </div>
            {!data.pendingTermCategories.holdReasonDistribution.length && !data.pendingTermCategories.resolutionTypeDistribution.length ? (
              <EmptyState icon={<FileText size={32} />} title="No pending term data" description="No pending terms found in the selected date range." />
            ) : (
              <div style={SIDE_BY_SIDE}>
                <div style={HALF_CHART}>
                  <div style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, marginBottom: 8 }}>Hold Reason</div>
                  <div style={CHART_WRAP}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.pendingTermCategories.holdReasonDistribution.slice(0, 10)} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis dataKey="reason" tick={AXIS_TICK} interval={0} angle={-25} textAnchor="end" height={60} />
                        <YAxis tick={AXIS_TICK} />
                        <Tooltip content={<DarkTooltip />} />
                        <Bar dataKey="count" name="Count" fill={colorAlpha(COLORS.pendingTerm, 0.7)} radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div style={HALF_CHART}>
                  <div style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, marginBottom: 8 }}>Resolution Type</div>
                  <div style={CHART_WRAP}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.pendingTermCategories.resolutionTypeDistribution} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                        <XAxis dataKey="type" tick={AXIS_TICK} />
                        <YAxis tick={AXIS_TICK} />
                        <Tooltip content={<DarkTooltip />} />
                        <Bar dataKey="count" name="Count" radius={[3, 3, 0, 0]}>
                          {data.pendingTermCategories.resolutionTypeDistribution.map((d, i) => (
                            <Cell key={i} fill={getBarColor(d.type)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={STAT_CARD}>
      <div style={{ fontSize: typography.sizes.xs.fontSize, color: colors.textMuted, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: typography.sizes.xl.fontSize, fontWeight: typography.weights.bold, color }}>{value}</div>
    </div>
  );
}

function DrillDownPanel({ data, loading, onLoadMore, onClose }: {
  data: DrillDownResult | null;
  loading: boolean;
  onLoadMore: () => void;
  onClose: () => void;
}) {
  return (
    <div style={DRILL_ROW}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
        <span style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary }}>
          Resolved Items {data ? `(${data.items.length} of ${data.total})` : ""}
        </span>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", color: colors.textMuted, cursor: "pointer", padding: 4 }}
        >
          Close
        </button>
      </div>

      {loading && !data ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: spacing.md, color: colors.textMuted }}>
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading...
        </div>
      ) : !data?.items.length ? (
        <div style={{ padding: spacing.md, color: colors.textMuted, fontSize: typography.sizes.sm.fontSize }}>No resolved items found.</div>
      ) : (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...baseThStyle, fontSize: typography.sizes.xs.fontSize }}>Type</th>
                <th style={{ ...baseThStyle, fontSize: typography.sizes.xs.fontSize }}>Member</th>
                <th style={{ ...baseThStyle, fontSize: typography.sizes.xs.fontSize }}>Resolved</th>
                <th style={{ ...baseThStyle, fontSize: typography.sizes.xs.fontSize }}>Resolution</th>
                <th style={{ ...baseThStyle, fontSize: typography.sizes.xs.fontSize, textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item, i) => (
                <tr key={i}>
                  <td style={baseTdStyle}>
                    <span style={BADGE(item.type === "chargeback" ? COLORS.chargeback : COLORS.pendingTerm)}>
                      {item.type === "chargeback" ? "CB" : "PT"}
                    </span>
                  </td>
                  <td style={{ ...baseTdStyle, fontSize: typography.sizes.sm.fontSize }}>{item.memberName}</td>
                  <td style={{ ...baseTdStyle, fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary }}>
                    {new Date(item.resolvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td style={{ ...baseTdStyle, fontSize: typography.sizes.sm.fontSize }}>
                    {item.resolutionType ?? "\u2014"}
                  </td>
                  <td style={{ ...baseTdStyle, fontSize: typography.sizes.sm.fontSize, textAlign: "right" }}>
                    {formatDollar(item.originalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.hasMore && (
            <div style={{ textAlign: "center", padding: spacing.sm }}>
              <button
                onClick={onLoadMore}
                disabled={loading}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${colorAlpha(colors.textMuted, 0.25)}`,
                  borderRadius: radius.md,
                  color: colors.textSecondary,
                  padding: "6px 16px",
                  fontSize: typography.sizes.sm.fontSize,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
