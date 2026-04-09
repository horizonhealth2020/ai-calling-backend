"use client";
import React, { useState, useEffect } from "react";
import { formatDollar } from "@ops/utils";
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
  useToast,
  baseCardStyle,
  baseThStyle,
  baseTdStyle,
} from "@ops/ui";
import type { DateRangeFilterValue } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import {
  DollarSign,
  AlertTriangle,
  Clock,
  Activity,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

type AgentKpi = { agentId: string; agentName: string; chargebackCount: number; chargebackTotal: number; pendingTermCount: number };
type KpiData = { agents: AgentKpi[]; totals: { totalChargebackCount: number; totalChargebackDollars: number; totalPendingTermCount: number } };

/* -- Inline style constants -- */

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

/* -- AgentKPITable -- */

function AgentKPITable({ kpiData }: { kpiData: KpiData | null }) {
  const [sortCol, setSortCol] = useState<keyof AgentKpi>("chargebackTotal");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: keyof AgentKpi) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sorted = kpiData
    ? [...kpiData.agents].sort((a, b) => {
        const av = a[sortCol];
        const bv = b[sortCol];
        if (typeof av === "number" && typeof bv === "number") {
          return sortDir === "asc" ? av - bv : bv - av;
        }
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      })
    : [];

  const SortIcon = ({ col }: { col: keyof AgentKpi }) => {
    if (sortCol !== col) return null;
    return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  };

  if (!kpiData) {
    return (
      <div style={{ ...CARD, padding: 24 }}>
        <SkeletonTable rows={5} columns={4} />
      </div>
    );
  }

  return (
    <>
      {/* Summary stat cards */}
      <div
        className="grid-mobile-1"
        style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}
      >
        <StatCard
          label="Total Chargebacks"
          value={kpiData.totals.totalChargebackCount}
          icon={<AlertTriangle size={18} />}
          accent={colors.danger}
          style={{ borderTop: `3px solid ${colors.danger}` }}
        />
        <StatCard
          label="Chargeback Total"
          value={formatDollar(kpiData.totals.totalChargebackDollars)}
          icon={<DollarSign size={18} />}
          accent={colors.warning ?? "#eab308"}
          style={{ borderTop: `3px solid ${colors.warning ?? "#eab308"}` }}
        />
        <StatCard
          label="Pending Terms"
          value={kpiData.totals.totalPendingTermCount}
          icon={<Clock size={18} />}
          accent={colors.accentTeal}
          style={{ borderTop: `3px solid ${colors.accentTeal}` }}
        />
      </div>

      {/* Agent KPI table */}
      <div className="animate-fade-in-up stagger-2" style={{ ...CARD, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", gap: 10 }}>
          <Activity size={16} color={colors.textTertiary} />
          <span style={{ fontSize: 13, fontWeight: typography.weights.semibold, color: colors.textSecondary }}>
            Agent Retention KPIs (30-day window)
          </span>
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            icon={<Activity size={32} />}
            title="No KPI data yet"
            description="Agent chargeback and pending term metrics from the last 30 days will appear here."
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
                    onClick={() => toggleSort("chargebackCount")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Chargebacks <SortIcon col="chargebackCount" /></span>
                  </th>
                  <th
                    style={{ ...baseThStyle, cursor: "pointer", userSelect: "none", textAlign: "right" }}
                    onClick={() => toggleSort("chargebackTotal")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Chargeback Total <SortIcon col="chargebackTotal" /></span>
                  </th>
                  <th
                    style={{ ...baseThStyle, cursor: "pointer", userSelect: "none", textAlign: "right" }}
                    onClick={() => toggleSort("pendingTermCount")}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>Pending Terms <SortIcon col="pendingTermCount" /></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((agent) => (
                  <tr key={agent.agentId} className="row-hover" style={{ transition: `background ${motion.duration.fast} ${motion.easing.out}` }}>
                    <td style={{ ...baseTdStyle, fontWeight: typography.weights.semibold, color: colors.textPrimary }}>{agent.agentName}</td>
                    <td style={{ ...baseTdStyle, textAlign: "right", color: agent.chargebackCount > 0 ? colors.danger : colors.textSecondary }}>
                      {agent.chargebackCount}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", color: agent.chargebackTotal > 0 ? colors.danger : colors.textSecondary }}>
                      {formatDollar(agent.chargebackTotal)}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", color: agent.pendingTermCount > 0 ? (colors.warning ?? "#eab308") : colors.textSecondary }}>
                      {agent.pendingTermCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* -- Date range helper -- */

function buildDateParams(dr: DateRangeFilterValue): string {
  if (dr.preset === "custom" && dr.from && dr.to) return `from=${dr.from}&to=${dr.to}`;
  if (dr.preset && dr.preset !== "custom") return `range=${dr.preset}`;
  return "";
}

/* -- OwnerKPIs -- */

export default function OwnerKPIs({ API }: { API: string }) {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState<DateRangeFilterValue>({ preset: "today" });
  const [kpiData, setKpiData] = useState<KpiData | null>(null);

  useEffect(() => {
    const dp = buildDateParams(dateRange);
    const qs = dp ? `?${dp}` : "";
    authFetch(`${API}/api/agent-kpis${qs}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setKpiData(d); })
      .catch(() => { toast("error", "Failed to load KPI data"); });
  }, [API, dateRange]);

  return (
    <div className="animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ ...SECTION_TITLE, fontSize: typography.sizes.lg.fontSize }}>Agent Retention KPIs</h2>
          <p style={SECTION_SUBTITLE}>Per-agent chargeback and pending term metrics</p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} presets={KPI_PRESETS} />
      </div>
      <AgentKPITable kpiData={kpiData} />
    </div>
  );
}
