"use client";
import React, { useState, useEffect } from "react";
import {
  StatCard,
  EmptyState,
  SkeletonTable,
  DateRangeFilter,
  KPI_PRESETS,
  colors,
  radius,
  typography,
  motion,
  baseCardStyle,
  baseThStyle,
  baseTdStyle,
} from "@ops/ui";
import type { DateRangeFilterValue } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { useDateRange } from "@/lib/DateRangeContext";
import {
  Target,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  BarChart3,
  Users,
  Award,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────── */

type AgentScore = { agentId: string; agentName: string; avgScore: number; auditCount: number };
type WeeklyTrend = { week: string; avgScore: number; auditCount: number; delta: number | null };
type ScoringData = {
  aggregate: { avgScore: number; totalAudits: number; minScore: number; maxScore: number };
  distribution: { poor: number; fair: number; good: number; excellent: number };
  agents: AgentScore[];
  weeklyTrends: WeeklyTrend[];
};

/* ── Inline style constants ─────────────────────────────────────── */

const CARD: React.CSSProperties = {
  ...baseCardStyle,
  borderRadius: radius["2xl"],
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: typography.sizes.md.fontSize,
  fontWeight: typography.weights.bold,
  color: colors.textPrimary,
  letterSpacing: typography.tracking.tight,
  margin: 0,
};

const SECTION_SUBTITLE: React.CSSProperties = {
  fontSize: typography.sizes.sm.fontSize,
  color: colors.textTertiary,
  margin: "4px 0 0",
};

/* ── Helpers ────────────────────────────────────────────────────── */

function scoreColor(avg: number): string {
  if (avg >= 85) return colors.success;
  if (avg >= 70) return colors.accentTeal;
  if (avg >= 50) return colors.warning;
  return colors.danger;
}

const SCORE_BUCKETS = [
  { label: "Excellent", range: "85-100", color: colors.success, key: "excellent" as const },
  { label: "Good", range: "70-84", color: colors.accentTeal, key: "good" as const },
  { label: "Fair", range: "50-69", color: colors.warning, key: "fair" as const },
  { label: "Poor", range: "0-49", color: colors.danger, key: "poor" as const },
];

function buildDateParams(dr: DateRangeFilterValue): string {
  if (dr.preset === "custom" && dr.from && dr.to) return `from=${dr.from}&to=${dr.to}`;
  if (dr.preset && dr.preset !== "custom") return `range=${dr.preset}`;
  return "";
}

/* ── Agent Score Table ──────────────────────────────────────────── */

type SortableCol = "agentName" | "avgScore" | "auditCount";

function AgentScoreTable({ agents }: { agents: AgentScore[] }) {
  const [sortCol, setSortCol] = useState<SortableCol>("avgScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: SortableCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = [...agents].sort((a, b) => {
    const av = a[sortCol];
    const bv = b[sortCol];
    if (typeof av === "number" && typeof bv === "number") {
      return sortDir === "asc" ? av - bv : bv - av;
    }
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  const SortIcon = ({ col }: { col: SortableCol }) => {
    if (sortCol !== col) return null;
    return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  return (
    <div className="animate-fade-in-up stagger-2" style={{ ...CARD, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", gap: 10 }}>
        <Users size={16} color={colors.textTertiary} />
        <span style={{ fontSize: 13, fontWeight: typography.weights.semibold, color: colors.textSecondary }}>
          Per-Agent Score Breakdown
        </span>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Users size={32} />}
          title="No agent data"
          description="No agents with AI-scored audits found in the selected range."
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: colors.bgSurfaceInset }}>
                <th
                  style={{ ...baseThStyle, cursor: "pointer", userSelect: "none" }}
                  onClick={() => toggleSort("agentName")}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Agent Name <SortIcon col="agentName" /></span>
                </th>
                <th
                  style={{ ...baseThStyle, cursor: "pointer", userSelect: "none", textAlign: "right" }}
                  onClick={() => toggleSort("avgScore")}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Avg Score <SortIcon col="avgScore" /></span>
                </th>
                <th
                  style={{ ...baseThStyle, cursor: "pointer", userSelect: "none", textAlign: "right" }}
                  onClick={() => toggleSort("auditCount")}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Audits <SortIcon col="auditCount" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((agent) => (
                <tr key={agent.agentId} className="row-hover" style={{ transition: `background ${motion.duration.fast} ${motion.easing.out}` }}>
                  <td style={{ ...baseTdStyle, fontWeight: typography.weights.semibold, color: colors.textPrimary }}>
                    {agent.agentName}
                  </td>
                  <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: 600, color: scoreColor(agent.avgScore) }}>
                    {agent.avgScore}
                  </td>
                  <td style={{ ...baseTdStyle, textAlign: "right", color: colors.textSecondary }}>
                    {agent.auditCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Weekly Trends Table ────────────────────────────────────────── */

function WeeklyTrendsTable({ trends }: { trends: WeeklyTrend[] }) {
  return (
    <div className="animate-fade-in-up stagger-3" style={{ ...CARD, padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", gap: 10 }}>
        <TrendingUp size={16} color={colors.textTertiary} />
        <span style={{ fontSize: 13, fontWeight: typography.weights.semibold, color: colors.textSecondary }}>
          Weekly Score Trends
        </span>
      </div>

      {trends.length === 0 ? (
        <EmptyState
          icon={<TrendingUp size={32} />}
          title="No trend data"
          description="Weekly trend data will appear once AI-scored audits span multiple weeks."
        />
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: colors.bgSurfaceInset }}>
                <th style={baseThStyle}>Week</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Avg Score</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Audits</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Change</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((t) => (
                <tr key={t.week} className="row-hover" style={{ transition: `background ${motion.duration.fast} ${motion.easing.out}` }}>
                  <td style={{ ...baseTdStyle, fontWeight: typography.weights.semibold, color: colors.textPrimary }}>
                    {t.week}
                  </td>
                  <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: 600, color: scoreColor(t.avgScore) }}>
                    {t.avgScore}
                  </td>
                  <td style={{ ...baseTdStyle, textAlign: "right", color: colors.textSecondary }}>
                    {t.auditCount}
                  </td>
                  <td style={{ ...baseTdStyle, textAlign: "right" }}>
                    {t.delta === null || t.delta === 0 ? (
                      <span style={{ color: colors.textTertiary }}>--</span>
                    ) : t.delta > 0 ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: colors.success }}>
                        <ChevronUp size={14} /> +{t.delta} pts
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: colors.danger }}>
                        <ChevronDown size={14} /> {t.delta} pts
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ── Score Distribution ─────────────────────────────────────────── */

function ScoreDistribution({ distribution, total }: { distribution: ScoringData["distribution"]; total: number }) {
  return (
    <div className="animate-fade-in-up stagger-1" style={{ ...CARD, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Award size={16} color={colors.textTertiary} />
        <span style={{ fontSize: 13, fontWeight: typography.weights.semibold, color: colors.textSecondary }}>
          Score Distribution
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {SCORE_BUCKETS.map((bucket) => {
          const count = distribution[bucket.key];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={bucket.key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: colors.textSecondary }}>
                  {bucket.label} <span style={{ color: colors.textTertiary, fontSize: 11 }}>({bucket.range})</span>
                </span>
                <span style={{ fontWeight: 600, color: bucket.color }}>{count} <span style={{ color: colors.textTertiary, fontWeight: 400 }}>({pct}%)</span></span>
              </div>
              <div style={{ height: 8, background: colors.bgSurfaceInset, borderRadius: radius.full, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    background: bucket.color,
                    borderRadius: radius.full,
                    transition: "width 0.4s ease",
                    minWidth: count > 0 ? 4 : 0,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── OwnerScoring (main component) ──────────────────────────────── */

export default function OwnerScoring({ API }: { API: string }) {
  const { value: dateRange, onChange: setDateRange } = useDateRange();
  const [data, setData] = useState<ScoringData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const dp = buildDateParams(dateRange);
    const qs = dp ? `?${dp}` : "";
    authFetch(`${API}/api/ai/scoring-stats${qs}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [API, dateRange]);

  return (
    <div className="animate-fade-in">
      {/* Header with date range filter */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ ...SECTION_TITLE, fontSize: typography.sizes.lg.fontSize }}>AI Scoring Dashboard</h2>
          <p style={SECTION_SUBTITLE}>Call quality scores, agent performance, and weekly trends</p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} presets={KPI_PRESETS} />
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ ...CARD, padding: 24 }}>
          <SkeletonTable rows={4} columns={3} />
        </div>
      )}

      {/* Empty state */}
      {!loading && data && data.aggregate.totalAudits === 0 && (
        <EmptyState
          icon={<Target size={32} />}
          title="No AI-scored audits"
          description="No audits with AI scores found in the selected date range."
        />
      )}

      {/* Data loaded with results */}
      {!loading && data && data.aggregate.totalAudits > 0 && (
        <>
          {/* Aggregate KPI StatCards */}
          <div
            className="grid-mobile-1"
            style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}
          >
            <StatCard
              label="Average Score"
              value={data.aggregate.avgScore}
              icon={<Target size={18} />}
              accent={scoreColor(data.aggregate.avgScore)}
              style={{ borderTop: `3px solid ${scoreColor(data.aggregate.avgScore)}` }}
            />
            <StatCard
              label="Total Audits"
              value={data.aggregate.totalAudits}
              icon={<BarChart3 size={18} />}
              accent={colors.primary400}
              style={{ borderTop: `3px solid ${colors.primary400}` }}
            />
            <StatCard
              label="Score Range"
              value={`${data.aggregate.minScore} - ${data.aggregate.maxScore}`}
              icon={<TrendingUp size={18} />}
              accent={colors.accentTeal}
              style={{ borderTop: `3px solid ${colors.accentTeal}` }}
            />
          </div>

          {/* Score Distribution */}
          <div style={{ marginBottom: 24 }}>
            <ScoreDistribution distribution={data.distribution} total={data.aggregate.totalAudits} />
          </div>

          {/* Per-Agent Breakdown */}
          <div style={{ marginBottom: 24 }}>
            <AgentScoreTable agents={data.agents} />
          </div>

          {/* Weekly Trends */}
          <WeeklyTrendsTable trends={data.weeklyTrends} />
        </>
      )}
    </div>
  );
}
