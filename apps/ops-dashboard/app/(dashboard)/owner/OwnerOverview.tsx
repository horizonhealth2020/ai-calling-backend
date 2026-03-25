"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StatCard,
  Badge,
  AnimatedNumber,
  EmptyState,
  SkeletonCard,
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
import { HIGHLIGHT_GLOW } from "@ops/socket";
import type { SaleChangedPayload } from "@ops/socket";
import {
  BarChart3,
  DollarSign,
  AlertTriangle,
  Award,
  Clock,
} from "lucide-react";

type SocketClient = import("socket.io-client").Socket;

type Summary = {
  salesCount: number; premiumTotal: number; clawbacks: number; openPayrollPeriods: number;
  trends: { salesCount: { priorWeek: number; priorMonth: number }; premiumTotal: { priorWeek: number; priorMonth: number }; clawbacks: { priorWeek: number; priorMonth: number } } | null;
};
type TrackerEntry = { agent: string; salesCount: number; premiumTotal: number; totalLeadCost: number; costPerSale: number; commissionTotal: number };
type PeriodSummary = { period: string; salesCount: number; premiumTotal: number; commissionPaid: number; csPayrollTotal: number; periodStatus?: string };

function computeTrend(current: number, prior: number): { value: number; direction: "up" | "down" | "flat" } {
  if (prior === 0) return current > 0 ? { value: 100, direction: "up" } : { value: 0, direction: "flat" };
  const pct = Math.round(((current - prior) / prior) * 100);
  if (pct === 0) return { value: 0, direction: "flat" };
  return { value: Math.abs(pct), direction: pct > 0 ? "up" : "down" };
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function buildDateParams(dr: DateRangeFilterValue): string {
  if (dr.preset === "custom" && dr.from && dr.to) return `from=${dr.from}&to=${dr.to}`;
  if (dr.preset && dr.preset !== "custom") return `range=${dr.preset}`;
  return "";
}

const RANK_COLORS = ["#fbbf24", "#94a3b8", "#d97706"] as const;
const RANK_LABELS = ["Gold", "Silver", "Bronze"] as const;

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

/* -- DashboardSkeleton -- */

function DashboardSkeleton() {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} height={120} />
        ))}
      </div>
      <SkeletonCard height={400} />
    </>
  );
}

/* -- DashboardSection -- */

function DashboardSection({
  summary,
  tracker,
  dateRange,
  onDateRangeChange,
  highlightedCards,
  periods,
  periodView,
  onPeriodViewChange,
}: {
  summary: Summary | null;
  tracker: TrackerEntry[];
  dateRange: DateRangeFilterValue;
  onDateRangeChange: (v: DateRangeFilterValue) => void;
  highlightedCards: Set<string>;
  periods: PeriodSummary[];
  periodView: "weekly" | "monthly";
  onPeriodViewChange: (v: "weekly" | "monthly") => void;
}) {
  const sortedTracker = [...tracker].sort((a, b) => b.premiumTotal - a.premiumTotal);

  return (
    <>
      {/* Range + KPI row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ ...SECTION_TITLE, fontSize: typography.sizes.lg.fontSize }}>Performance Overview</h2>
          <p style={SECTION_SUBTITLE}>Real-time sales metrics and agent leaderboard</p>
        </div>
        <DateRangeFilter value={dateRange} onChange={onDateRangeChange} presets={KPI_PRESETS} />
      </div>

      {/* KPI stat cards */}
      <div
        className="grid-mobile-1"
        style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 32 }}
      >
        <StatCard
          label="Total Sales"
          value={summary ? summary.salesCount : "\u2014"}
          icon={<BarChart3 size={18} />}
          accent={colors.accentTeal}
          className="stagger-1"
          style={{ borderTop: `3px solid ${colors.accentTeal}`, transition: "box-shadow 1.5s ease-out", ...(highlightedCards.has("salesCount") ? HIGHLIGHT_GLOW : {}) }}
          trend={summary?.trends ? computeTrend(summary.salesCount, summary.trends.salesCount.priorWeek) : undefined}
        />
        <StatCard
          label="Premium Total"
          value={summary ? fmt.format(Number(summary.premiumTotal)) : "\u2014"}
          icon={<DollarSign size={18} />}
          accent={colors.success}
          className="stagger-2"
          style={{ borderTop: `3px solid ${colors.success}`, transition: "box-shadow 1.5s ease-out", ...(highlightedCards.has("premiumTotal") ? HIGHLIGHT_GLOW : {}) }}
          trend={summary?.trends ? computeTrend(Number(summary.premiumTotal), summary.trends.premiumTotal.priorWeek) : undefined}
        />
        <StatCard
          label="Chargebacks"
          value={summary ? summary.clawbacks : "\u2014"}
          icon={<AlertTriangle size={18} />}
          accent={colors.danger}
          className="stagger-3"
          style={{ borderTop: `3px solid ${colors.danger}` }}
          trend={summary?.trends ? computeTrend(summary.clawbacks, summary.trends.clawbacks.priorWeek) : undefined}
        />
        <StatCard
          label="Open Payroll"
          value={summary ? summary.openPayrollPeriods : "\u2014"}
          icon={<Clock size={18} />}
          accent={colors.warning}
          className="stagger-4"
          style={{ borderTop: `3px solid ${colors.warning}` }}
        />
      </div>

      {/* Agent performance table */}
      <div
        className="animate-fade-in-up stagger-5"
        style={{ ...CARD, padding: 0, overflow: "hidden" }}
      >
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", gap: 10 }}>
          <Award size={18} color={colors.warning} />
          <div>
            <h3 style={SECTION_TITLE}>Agent Performance</h3>
            <p style={SECTION_SUBTITLE}>Ranked by premium total for selected period</p>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: colors.bgSurfaceInset }}>
                <th style={baseThStyle}>Rank</th>
                <th style={baseThStyle}>Agent</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Sales</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Premium</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Avg / Sale</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Cost / Sale</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Commission</th>
              </tr>
            </thead>
            <tbody>
              {sortedTracker.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={<BarChart3 size={32} />}
                      title="No agent data yet"
                      description="Sales data will appear here once agents start submitting."
                    />
                  </td>
                </tr>
              )}
              {sortedTracker.map((row, i) => {
                const isTop3 = i < 3;
                const rankColor = isTop3 ? RANK_COLORS[i] : colors.textMuted;
                return (
                  <tr
                    key={row.agent}
                    className="row-hover animate-fade-in-up"
                    style={{
                      borderLeft: isTop3 ? `3px solid ${rankColor}` : "3px solid transparent",
                      transition: `background ${motion.duration.fast} ${motion.easing.out}`,
                    }}
                  >
                    <td style={{ ...baseTdStyle, paddingLeft: isTop3 ? 13 : 16 }}>
                      {isTop3 ? (
                        <Badge color={rankColor} variant="subtle" size="sm">
                          #{i + 1} {RANK_LABELS[i]}
                        </Badge>
                      ) : (
                        <span style={{ color: colors.textMuted, fontSize: 13, fontWeight: typography.weights.medium }}>
                          #{i + 1}
                        </span>
                      )}
                    </td>
                    <td style={{ ...baseTdStyle, fontWeight: isTop3 ? typography.weights.bold : typography.weights.semibold, color: isTop3 ? colors.textPrimary : colors.textSecondary }}>
                      {row.agent}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: typography.weights.bold, color: colors.textSecondary }}>
                      <AnimatedNumber value={row.salesCount} />
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: typography.weights.extrabold }}>
                      {i === 0 ? (
                        <span
                          style={{
                            backgroundImage: "linear-gradient(135deg, #34d399, #10b981, #059669)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            backgroundClip: "text",
                          }}
                        >
                          <AnimatedNumber value={Number(row.premiumTotal)} prefix="$" decimals={0} />
                        </span>
                      ) : (
                        <span style={{ color: colors.success }}>
                          <AnimatedNumber value={Number(row.premiumTotal)} prefix="$" decimals={0} />
                        </span>
                      )}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", color: colors.textTertiary }}>
                      {row.salesCount > 0 ? fmt.format(Number(row.premiumTotal) / row.salesCount) : "\u2014"}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", color: colors.warning, fontWeight: typography.weights.semibold }}>
                      {row.costPerSale > 0 ? fmt.format(row.costPerSale) : "\u2014"}
                    </td>
                    <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: typography.weights.bold, color: colors.accentTeal }}>
                      {row.commissionTotal > 0 ? fmt.format(row.commissionTotal) : "\u2014"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Period Summary */}
      <div className="animate-fade-in-up stagger-6" style={{ ...CARD, padding: 0, overflow: "hidden", marginTop: 24 }}>
        <div style={{ padding: "20px 24px", borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Clock size={18} color={colors.accentTeal} />
            <div>
              <h3 style={SECTION_TITLE}>Period Summary</h3>
              <p style={SECTION_SUBTITLE}>Aggregate totals by pay period</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {(["weekly", "monthly"] as const).map(v => (
              <button
                key={v}
                onClick={() => onPeriodViewChange(v)}
                style={{
                  padding: "6px 14px", borderRadius: radius.md, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                  background: periodView === v ? colors.primary500 : colors.bgSurfaceInset,
                  color: periodView === v ? "#fff" : colors.textSecondary,
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: colors.bgSurfaceInset }}>
                <th style={baseThStyle}>Period</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Sales</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Premium</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Commission</th>
                <th style={{ ...baseThStyle, textAlign: "right" }}>Service Payroll</th>
                {periodView === "weekly" && <th style={baseThStyle}>Status</th>}
              </tr>
            </thead>
            <tbody>
              {periods.length === 0 && (
                <tr><td colSpan={periodView === "weekly" ? 6 : 5}><EmptyState icon={<Clock size={32} />} title="No period data" description="Period summaries appear once sales are entered." /></td></tr>
              )}
              {periods.map(p => (
                <tr key={p.period} className="row-hover" style={{ transition: `background ${motion.duration.fast} ${motion.easing.out}` }}>
                  <td style={baseTdStyle}>{p.period}</td>
                  <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: typography.weights.bold }}>{p.salesCount}</td>
                  <td style={{ ...baseTdStyle, textAlign: "right", color: colors.success }}>{fmt.format(p.premiumTotal)}</td>
                  <td style={{ ...baseTdStyle, textAlign: "right", color: colors.accentTeal }}>{fmt.format(p.commissionPaid)}</td>
                  <td style={{ ...baseTdStyle, textAlign: "right", color: colors.warning }}>{fmt.format(p.csPayrollTotal ?? 0)}</td>
                  {periodView === "weekly" && <td style={baseTdStyle}><Badge color={p.periodStatus === "OPEN" ? colors.success : colors.textMuted} variant="subtle" size="sm">{p.periodStatus}</Badge></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* -- OwnerOverview -- */

export default function OwnerOverview({ socket, API }: { socket: SocketClient | null; API: string }) {
  const { value: dateRange, onChange: setDateRange } = useDateRange();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tracker, setTracker] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodView, setPeriodView] = useState<"weekly" | "monthly">("weekly");
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [highlightedCards, setHighlightedCards] = useState<Set<string>>(new Set());
  const dateRangeRef = useRef(dateRange);
  dateRangeRef.current = dateRange;

  const highlightCard = (cardKey: string) => {
    setHighlightedCards(prev => new Set(prev).add(cardKey));
    setTimeout(() => {
      setHighlightedCards(prev => { const next = new Set(prev); next.delete(cardKey); return next; });
    }, 100);
  };

  const fetchData = useCallback((dr: DateRangeFilterValue) => {
    setLoading(true);
    const dp = buildDateParams(dr);
    const qs = dp ? `?${dp}` : "";
    Promise.all([
      authFetch(`${API}/api/owner/summary${qs}`).then((res) => res.ok ? res.json() : null).catch(() => null),
      authFetch(`${API}/api/tracker/summary${qs}`).then((res) => res.ok ? res.json() : []).catch(() => []),
      authFetch(`${API}/api/reporting/periods?view=${periodView}`).then(res => res.ok ? res.json() : { periods: [] }).catch(() => ({ periods: [] })),
    ]).then(([s, t, periodData]) => {
      setSummary(s);
      setTracker(t);
      setPeriods(periodData.periods ?? []);
      setLoading(false);
    });
  }, [API, periodView]);

  useEffect(() => { fetchData(dateRange); }, [dateRange, fetchData]);

  useEffect(() => {
    authFetch(`${API}/api/reporting/periods?view=${periodView}`)
      .then(res => res.ok ? res.json() : { periods: [] })
      .then(data => setPeriods(data.periods ?? []))
      .catch(() => {});
  }, [API, periodView]);

  // Socket.IO: real-time KPI patching
  const handleSaleChanged = useCallback((payload: SaleChangedPayload) => {
    if (payload.sale.status !== "RAN") return;
    if (payload.type !== "created" && payload.type !== "status_changed") return;

    highlightCard("salesCount");
    highlightCard("premiumTotal");

    const addonPrem = (payload.sale as any).addons?.reduce((s: number, a: any) => s + Number(a.premium ?? 0), 0) ?? 0;
    const totalPrem = payload.sale.premium + addonPrem;

    setSummary(prev => prev ? {
      ...prev,
      salesCount: (prev.salesCount || 0) + 1,
      premiumTotal: (prev.premiumTotal || 0) + totalPrem,
    } : prev);

    setTracker(prev => {
      const agentName = payload.sale.agent.name;
      const existing = prev.find(t => t.agent === agentName);
      if (existing) {
        return prev.map(t => t.agent === agentName ? {
          ...t,
          salesCount: t.salesCount + 1,
          premiumTotal: t.premiumTotal + totalPrem,
        } : t);
      }
      return [...prev, {
        agent: agentName,
        salesCount: 1,
        premiumTotal: totalPrem,
        totalLeadCost: 0,
        costPerSale: 0,
        commissionTotal: 0,
      }];
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("sale:changed", handleSaleChanged);
    return () => { socket.off("sale:changed", handleSaleChanged); };
  }, [socket, handleSaleChanged]);

  // Socket.IO: refetch periods when service payroll changes
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      authFetch(`${API}/api/reporting/periods?view=${periodView}`)
        .then(res => res.ok ? res.json() : { periods: [] })
        .then(data => setPeriods(data.periods ?? []))
        .catch(() => {});
    };
    socket.on("service-payroll:changed", handler);
    return () => { socket.off("service-payroll:changed", handler); };
  }, [socket, API, periodView]);

  // Refetch on reconnect
  useEffect(() => {
    if (!socket) return;
    const handleReconnect = () => fetchData(dateRangeRef.current);
    socket.on("connect", handleReconnect);
    return () => { socket.off("connect", handleReconnect); };
  }, [socket, fetchData]);

  return (
    <div className="animate-fade-in">
      {loading ? (
        <DashboardSkeleton />
      ) : (
        <DashboardSection
          summary={summary}
          tracker={tracker}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          highlightedCards={highlightedCards}
          periods={periods}
          periodView={periodView}
          onPeriodViewChange={setPeriodView}
        />
      )}
    </div>
  );
}
