"use client";
import { useState, useEffect, useCallback } from "react";
import { useSocket, DISCONNECT_BANNER, HIGHLIGHT_GLOW } from "@ops/socket";
import type { SaleChangedPayload } from "@ops/socket";
import {
  Trophy,
  Medal,
  Award,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  BarChart3,
  Calendar,
  Crown,
} from "lucide-react";
import {
  AnimatedNumber,
  Badge,
  TabNav,
  EmptyState,
  SkeletonCard,
  SkeletonLine,
  SkeletonTable,
  ThemeToggle,
} from "@ops/ui";
import { colors, spacing, radius, shadows, baseCardStyle } from "@ops/ui";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

type AgentStat = { count: number; premium: number };
type DayRow = { label: string; agents: Record<string, AgentStat>; totalSales: number; totalPremium: number };
type DetailedData = {
  agents: string[];
  weeklyDays: DayRow[];
  weeklyTotals: Record<string, AgentStat>;
  grandTotalSales: number;
  grandTotalPremium: number;
  todayStats: Record<string, AgentStat>;
};

const fmt$ = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/* ── Race bar configuration ───────────────────────────────────── */

const BAR_HEIGHT = 340;
const BAR_MIN_W = 60;
const BAR_MAX_W = 160;

const RANK_STYLES: Record<number, { bg: string; fill: string; border: string; glow: string; rankColor: string; icon: React.ReactNode }> = {
  0: {
    bg: "linear-gradient(135deg, rgba(251,191,36,0.06) 0%, rgba(180,83,9,0.03) 100%)",
    fill: "linear-gradient(to top, rgba(251,191,36,0.35) 0%, rgba(217,119,6,0.15) 60%, transparent 100%)",
    border: "rgba(251,191,36,0.45)",
    glow: `0 0 40px rgba(251,191,36,0.3), ${shadows.xl}`,
    rankColor: colors.gold,
    icon: <Trophy size={24} strokeWidth={1.5} />,
  },
  1: {
    bg: "linear-gradient(135deg, rgba(209,213,219,0.05) 0%, rgba(107,114,128,0.03) 100%)",
    fill: "linear-gradient(to top, rgba(209,213,219,0.3) 0%, rgba(156,163,175,0.1) 60%, transparent 100%)",
    border: "rgba(209,213,219,0.35)",
    glow: `0 0 24px rgba(209,213,219,0.2), ${shadows.lg}`,
    rankColor: colors.silver,
    icon: <Medal size={22} strokeWidth={1.5} />,
  },
  2: {
    bg: "linear-gradient(135deg, rgba(217,119,6,0.05) 0%, rgba(146,64,14,0.03) 100%)",
    fill: "linear-gradient(to top, rgba(217,119,6,0.3) 0%, rgba(180,83,9,0.12) 60%, transparent 100%)",
    border: "rgba(217,119,6,0.4)",
    glow: `0 0 24px rgba(217,119,6,0.25), ${shadows.lg}`,
    rankColor: colors.bronze,
    icon: <Award size={20} strokeWidth={1.5} />,
  },
};

const GHOST_STYLE = {
  bg: "linear-gradient(135deg, rgba(148,163,184,0.04) 0%, rgba(100,116,139,0.02) 100%)",
  fill: "none",
  border: "rgba(148,163,184,0.15)",
  glow: "none",
  rankColor: colors.textMuted,
  icon: null,
};

const DEFAULT_BAR_STYLE = {
  bg: "linear-gradient(135deg, rgba(20,184,166,0.06) 0%, rgba(13,148,136,0.03) 100%)",
  fill: "linear-gradient(to top, rgba(20,184,166,0.25) 0%, rgba(13,148,136,0.08) 60%, transparent 100%)",
  border: "rgba(20,184,166,0.3)",
  glow: shadows.md,
  rankColor: colors.textSecondary,
  icon: null,
};

/** Arrange sorted items center-out: 1st->center, 2nd->left, 3rd->right, 4th->further left... */
function buildRaceOrder(count: number): number[] {
  if (count === 0) return [];
  const result = new Array<number>(count);
  const positions: number[] = [];
  const center = Math.floor(count / 2);
  positions.push(center);
  for (let offset = 1; positions.length < count; offset++) {
    if (center - offset >= 0) positions.push(center - offset);
    if (positions.length < count && center + offset < count) positions.push(center + offset);
  }
  for (let i = 0; i < count; i++) {
    result[i] = positions[i];
  }
  return result;
}

/* ── RaceBar ──────────────────────────────────────────────────── */

function RaceBar({
  rank,
  name,
  count,
  premium,
  fillPercent,
  order,
  hasMedal,
  highlighted,
}: {
  rank: number;
  name: string;
  count: number;
  premium: number;
  fillPercent: number;
  order: number;
  hasMedal: boolean;
  highlighted?: boolean;
}) {
  const noSales = count === 0;
  const style = noSales
    ? GHOST_STYLE
    : hasMedal
      ? (RANK_STYLES[rank] ?? DEFAULT_BAR_STYLE)
      : DEFAULT_BAR_STYLE;
  const isTop3 = hasMedal && rank < 3;

  return (
    <div
      className={`animate-podium-rise stagger-${Math.min(rank + 1, 10)}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        order,
        flex: `1 1 0`,
        minWidth: BAR_MIN_W,
        maxWidth: BAR_MAX_W,
      }}
    >
      {/* Medal or rank label above bar */}
      {isTop3 && style.icon ? (
        <div
          style={{
            color: style.rankColor,
            marginBottom: 6,
            filter: `drop-shadow(0 2px 6px ${style.rankColor}60)`,
          }}
        >
          {style.icon}
        </div>
      ) : (
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: radius.full,
            background: noSales ? "transparent" : colors.bgSurfaceOverlay,
            border: `1px solid ${noSales ? colors.borderSubtle : colors.borderDefault}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            color: colors.textMuted,
            marginBottom: 6,
            opacity: noSales ? 0.5 : 1,
          }}
        >
          {rank + 1}
        </div>
      )}

      {/* Bar column — always full height, fill grows from bottom */}
      <div
        style={{
          width: "100%",
          height: BAR_HEIGHT,
          borderRadius: `${radius.xl}px ${radius.xl}px 0 0`,
          background: style.bg,
          border: `1.5px solid ${style.border}`,
          borderBottom: "none",
          boxShadow: noSales ? "none" : style.glow,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          position: "relative",
          backdropFilter: noSales ? undefined : "blur(8px)",
          transition: "box-shadow 1.5s ease-out, border-color 0.6s ease",
          ...(highlighted ? HIGHLIGHT_GLOW : {}),
        }}
      >
        {/* Fill overlay — grows from bottom */}
        {fillPercent > 0 && style.fill !== "none" && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: `${fillPercent}%`,
              background: style.fill,
              borderRadius: fillPercent >= 98 ? `${radius.xl}px ${radius.xl}px 0 0` : undefined,
              transition: "height 1s cubic-bezier(0.4,0,0.2,1)",
              pointerEvents: "none",
            }}
          />
        )}

        {/* Top highlight */}
        {!noSales && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "10%",
              right: "10%",
              height: 1,
              background: `linear-gradient(90deg, transparent, ${style.border}, transparent)`,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Content — always at bottom of bar */}
        <div style={{ position: "relative", zIndex: 1, padding: `${spacing[3]}px ${spacing[1]}px ${spacing[4]}px`, textAlign: "center", width: "100%" }}>
          {/* Agent name */}
          <div
            style={{
              fontSize: isTop3 ? 13 : 11,
              fontWeight: 700,
              color: noSales ? colors.textMuted : colors.textPrimary,
              lineHeight: 1.2,
              marginBottom: spacing[1],
              letterSpacing: "-0.01em",
              wordBreak: "break-word",
              opacity: noSales ? 0.6 : 1,
            }}
          >
            {name}
          </div>

          {/* Sales count */}
          <div
            style={{
              fontSize: isTop3 ? 26 : 20,
              fontWeight: 800,
              color: noSales ? colors.textMuted : (isTop3 ? style.rankColor : colors.textPrimary),
              lineHeight: 1,
              letterSpacing: "-0.03em",
              marginBottom: 2,
              opacity: noSales ? 0.4 : 1,
            }}
          >
            <AnimatedNumber value={count} />
          </div>

          {/* Premium */}
          <div style={{ fontSize: 10, fontWeight: 600, color: colors.textTertiary, opacity: noSales ? 0.4 : 1 }}>
            <AnimatedNumber value={premium} prefix="$" decimals={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── DailyView ────────────────────────────────────────────────── */

function DailyView({ data, highlightedAgentNames }: { data: DetailedData; highlightedAgentNames: Set<string> }) {
  const { agents, todayStats } = data;

  // Sort all agents by premium (descending) for the race
  const sorted = [...agents].sort(
    (a, b) => (todayStats[b]?.premium ?? 0) - (todayStats[a]?.premium ?? 0)
  );

  const maxPremium = Math.max(...sorted.map((a) => todayStats[a]?.premium ?? 0), 0);
  const orders = buildRaceOrder(sorted.length);

  // Only award medals when there are clear leaders with actual sales
  const agentsWithSales = sorted.filter(a => (todayStats[a]?.count ?? 0) > 0).length;
  const showMedals = agentsWithSales >= 1;

  return (
    <div className="animate-fade-in">
      {sorted.length > 0 ? (
        <>
          {/* Race header */}
          <div
            style={{
              textAlign: "center",
              marginBottom: spacing[6],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing[3],
            }}
          >
            <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, transparent, ${colors.borderDefault})` }} />
            <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
              <Crown size={14} color={showMedals ? colors.gold : colors.textMuted} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.textTertiary,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Leaderboard
              </span>
              <Crown size={14} color={showMedals ? colors.gold : colors.textMuted} />
            </div>
            <div style={{ height: 1, flex: 1, background: `linear-gradient(to left, transparent, ${colors.borderDefault})` }} />
          </div>

          {/* Race bars container — flex fills screen width */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              gap: spacing[2],
              overflowX: "auto",
              paddingBottom: spacing[4],
              paddingTop: spacing[4],
              width: "100%",
            }}
          >
            {sorted.map((agent, i) => {
              const stat = todayStats[agent];
              const premium = stat?.premium ?? 0;
              const count = stat?.count ?? 0;
              const fillPercent = maxPremium > 0 ? Math.max((premium / maxPremium) * 100, count > 0 ? 10 : 0) : 0;
              const hasMedal = showMedals && count > 0;

              return (
                <RaceBar
                  key={agent}
                  rank={i}
                  name={agent}
                  count={count}
                  premium={premium}
                  fillPercent={fillPercent}
                  order={orders[i]}
                  hasMedal={hasMedal}
                  highlighted={highlightedAgentNames.has(agent)}
                />
              );
            })}
          </div>

          {/* Base line */}
          <div
            style={{
              height: 2,
              background: `linear-gradient(90deg, transparent, ${colors.borderDefault}, transparent)`,
              marginTop: -1,
            }}
          />
        </>
      ) : (
        <EmptyState
          icon={<Users size={32} />}
          title="No Agents Yet"
          description="Add agents in the Manager Dashboard to see the leaderboard."
        />
      )}
    </div>
  );
}

/* ── WeeklyView ───────────────────────────────────────────────── */

function WeeklyView({ data, highlightedAgentNames }: { data: DetailedData; highlightedAgentNames: Set<string> }) {
  const { agents, weeklyDays, weeklyTotals, grandTotalSales, grandTotalPremium } = data;
  const dayMap: Record<string, DayRow> = {};
  for (const d of weeklyDays) dayMap[d.label] = d;

  const sorted = [...agents].sort(
    (a, b) => (weeklyTotals[b]?.count ?? 0) - (weeklyTotals[a]?.count ?? 0)
  );

  const TH: React.CSSProperties = {
    padding: "14px 16px",
    textAlign: "center",
    fontSize: 11,
    fontWeight: 700,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    background: "rgba(12,16,33,0.9)",
    backdropFilter: "blur(8px)",
    borderBottom: `1px solid ${colors.borderDefault}`,
    position: "sticky" as const,
    top: 0,
    zIndex: 2,
    whiteSpace: "nowrap" as const,
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        overflowX: "auto",
        borderRadius: radius.xl,
        border: `1px solid ${colors.borderDefault}`,
        boxShadow: shadows.lg,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
        <thead>
          <tr>
            <th style={{ ...TH, textAlign: "left", paddingLeft: spacing[5] }}>Agent</th>
            {WEEK_DAYS.map((day) => (
              <th key={day} style={TH}>
                {day.slice(0, 3)}
              </th>
            ))}
            <th style={{ ...TH, color: colors.gold }}>Total</th>
            <th style={{ ...TH, textAlign: "right", paddingRight: spacing[5], color: colors.gold }}>
              Premium
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((agent, i) => {
            const total = weeklyTotals[agent];
            const isTop = i < 3;
            const isFirst = i === 0;
            const staggerClass = `stagger-${Math.min(i + 1, 10)}` as string;

            return (
              <tr
                key={agent}
                className={`row-hover animate-fade-in-up ${staggerClass}`}
                style={{
                  background: isTop
                    ? "rgba(251,191,36,0.04)"
                    : i % 2 === 0
                    ? `rgba(12,16,33,0.4)`
                    : "transparent",
                  transition: "box-shadow 1.5s ease-out",
                  ...(highlightedAgentNames.has(agent) ? HIGHLIGHT_GLOW : {}),
                }}
              >
                {/* Agent name cell */}
                <td
                  style={{
                    padding: `14px ${spacing[5]}px`,
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    fontWeight: 700,
                    color: colors.textPrimary,
                    whiteSpace: "nowrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
                    {/* Rank badge */}
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: radius.full,
                        background: isTop ? `rgba(251,191,36,0.12)` : colors.bgSurfaceOverlay,
                        border: `1px solid ${isTop ? "rgba(251,191,36,0.25)" : colors.borderSubtle}`,
                        fontSize: 11,
                        fontWeight: 700,
                        color: isTop ? colors.gold : colors.textMuted,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span>{agent}</span>
                    {isFirst && (
                      <span style={{ color: colors.gold, display: "flex", alignItems: "center" }}>
                        <Crown size={14} />
                      </span>
                    )}
                  </div>
                </td>

                {/* Daily cells */}
                {WEEK_DAYS.map((day) => {
                  const stat = dayMap[day]?.agents[agent];
                  return (
                    <td
                      key={day}
                      style={{
                        padding: "14px 16px",
                        textAlign: "center",
                        borderBottom: `1px solid ${colors.borderSubtle}`,
                      }}
                    >
                      {stat ? (
                        <>
                          <div
                            style={{
                              fontSize: 17,
                              fontWeight: 700,
                              color:
                                stat.count >= 3
                                  ? colors.success
                                  : stat.count >= 1
                                  ? colors.info
                                  : colors.borderStrong,
                            }}
                          >
                            <AnimatedNumber value={stat.count} />
                          </div>
                          <div style={{ fontSize: 10, color: colors.textMuted, marginTop: 2 }}>
                            {fmt$(stat.premium)}
                          </div>
                        </>
                      ) : (
                        <span style={{ color: colors.borderStrong, fontSize: 14 }}>&mdash;</span>
                      )}
                    </td>
                  );
                })}

                {/* Total */}
                <td
                  style={{
                    padding: "14px 16px",
                    textAlign: "center",
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    fontSize: 20,
                    fontWeight: 800,
                    color: isTop ? colors.gold : colors.success,
                    letterSpacing: "-0.02em",
                  }}
                >
                  <AnimatedNumber value={total?.count ?? 0} />
                </td>

                {/* Premium */}
                <td
                  style={{
                    padding: `14px ${spacing[5]}px`,
                    textAlign: "right",
                    borderBottom: `1px solid ${colors.borderSubtle}`,
                    fontWeight: 700,
                    color: colors.textSecondary,
                    fontSize: 13,
                    whiteSpace: "nowrap",
                  }}
                >
                  <AnimatedNumber value={total?.premium ?? 0} prefix="$" decimals={2} />
                </td>
              </tr>
            );
          })}

          {/* Team total row */}
          <tr style={{ background: "rgba(251,191,36,0.07)" }}>
            <td
              style={{
                padding: `${spacing[4]}px ${spacing[5]}px`,
                fontWeight: 800,
                color: colors.gold,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                borderTop: `2px solid rgba(251,191,36,0.2)`,
              }}
            >
              Team Total
            </td>
            {WEEK_DAYS.map((day) => {
              const d = dayMap[day];
              return (
                <td
                  key={day}
                  style={{
                    padding: `${spacing[4]}px 16px`,
                    textAlign: "center",
                    borderTop: `2px solid rgba(251,191,36,0.2)`,
                  }}
                >
                  {d ? (
                    <div style={{ fontSize: 17, fontWeight: 800, color: colors.gold }}>
                      <AnimatedNumber value={d.totalSales} />
                    </div>
                  ) : (
                    <span style={{ color: colors.borderStrong }}>&mdash;</span>
                  )}
                </td>
              );
            })}
            <td
              style={{
                padding: `${spacing[4]}px 16px`,
                textAlign: "center",
                borderTop: `2px solid rgba(251,191,36,0.2)`,
                fontSize: 24,
                fontWeight: 800,
                color: colors.gold,
                letterSpacing: "-0.02em",
              }}
            >
              <AnimatedNumber value={grandTotalSales} />
            </td>
            <td
              style={{
                padding: `${spacing[4]}px ${spacing[5]}px`,
                textAlign: "right",
                borderTop: `2px solid rgba(251,191,36,0.2)`,
                fontSize: 15,
                fontWeight: 800,
                color: colors.gold,
                whiteSpace: "nowrap",
              }}
            >
              <AnimatedNumber value={grandTotalPremium} prefix="$" decimals={2} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ── LoadingSkeleton ──────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Header skeleton */}
      <div style={{ marginBottom: spacing[8] }}>
        <SkeletonLine height={11} width={120} />
        <div style={{ marginTop: 10 }}>
          <SkeletonLine height={36} width={220} />
        </div>
      </div>

      {/* Stats bar skeleton */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: spacing[4],
          marginBottom: spacing[8],
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} height={100} />
        ))}
      </div>

      {/* Podium skeleton */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          gap: spacing[2],
          marginBottom: spacing[8],
        }}
      >
        <SkeletonCard height={180} />
        <SkeletonCard height={220} />
        <SkeletonCard height={160} />
      </div>

      {/* Table skeleton */}
      <SkeletonTable rows={5} columns={9} />
    </div>
  );
}

/* ── Main SalesBoard page ─────────────────────────────────────── */

export default function SalesBoard() {
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [data, setData] = useState<DetailedData | null>(null);
  const [lastUpdated, setLastUpdated] = useState("\u2014");
  const [highlightedAgentNames, setHighlightedAgentNames] = useState<Set<string>>(new Set());

  const highlightAgent = useCallback((name: string) => {
    setHighlightedAgentNames(prev => new Set(prev).add(name));
    setTimeout(() => {
      setHighlightedAgentNames(prev => { const next = new Set(prev); next.delete(name); return next; });
    }, 100);
  }, []);

  async function refresh() {
    const res = await fetch(`${API}/api/sales-board/detailed`).catch(() => null);
    if (res?.ok) {
      setData(await res.json());
      setLastUpdated(new Date().toLocaleTimeString());
    }
  }

  /* ── Real-time sale:changed handler -- incremental state patching ── */
  const handleSaleChanged = useCallback((payload: SaleChangedPayload) => {
    // Only RAN sales appear on the board
    if (payload.sale.status !== "RAN") return;
    // Only cascade on created / status_changed (per CONTEXT.md scope)
    if (payload.type !== "created" && payload.type !== "status_changed") return;

    const agentName = payload.sale.agent.name;
    highlightAgent(agentName);
    setLastUpdated(new Date().toLocaleTimeString());

    // Patch leaderboard state directly from payload -- NO API refetch
    setData(prev => {
      if (!prev) return prev;

      const premium = payload.sale.premium;

      // Patch todayStats
      const todayStats = { ...prev.todayStats };
      const existing = todayStats[agentName] ?? { count: 0, premium: 0 };
      todayStats[agentName] = { count: existing.count + 1, premium: existing.premium + premium };

      // Patch weeklyTotals
      const weeklyTotals = { ...prev.weeklyTotals };
      const wt = weeklyTotals[agentName] ?? { count: 0, premium: 0 };
      weeklyTotals[agentName] = { count: wt.count + 1, premium: wt.premium + premium };

      // Patch weeklyDays: find today's day label and increment
      const saleDate = new Date(payload.sale.saleDate + "T12:00:00");
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const todayLabel = dayNames[saleDate.getDay()];
      const weeklyDays = prev.weeklyDays.map(day => {
        if (day.label !== todayLabel) return day;
        const agents = { ...day.agents };
        const ds = agents[agentName] ?? { count: 0, premium: 0 };
        agents[agentName] = { count: ds.count + 1, premium: ds.premium + premium };
        return { ...day, agents, totalSales: day.totalSales + 1, totalPremium: day.totalPremium + premium };
      });

      // Add agent to list if not present
      const agents = prev.agents.includes(agentName) ? prev.agents : [...prev.agents, agentName];

      // Re-sort agents by weekly premium descending
      agents.sort((a, b) => (weeklyTotals[b]?.premium ?? 0) - (weeklyTotals[a]?.premium ?? 0));

      return {
        ...prev,
        agents,
        todayStats,
        weeklyTotals,
        weeklyDays,
        grandTotalSales: prev.grandTotalSales + 1,
        grandTotalPremium: prev.grandTotalPremium + premium,
      };
    });
  }, [highlightAgent]);

  const { disconnected } = useSocket(API, handleSaleChanged, refresh);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Derived summary stats */
  const totalToday = data
    ? Object.values(data.todayStats).reduce((s, v) => s + v.count, 0)
    : 0;
  const totalPremToday = data
    ? Object.values(data.todayStats).reduce((s, v) => s + v.premium, 0)
    : 0;

  return (
    <main
      style={{
        background: colors.bgRoot,
        minHeight: "100vh",
        padding: `0 ${spacing[10]}px ${spacing[12]}px`,
        color: colors.textPrimary,
      }}
    >
      {/* Top accent bar */}
      <div
        style={{
          height: 3,
          background: colors.accentGradient,
          marginLeft: -spacing[10],
          marginRight: -spacing[10],
          marginBottom: 0,
        }}
      />
      {disconnected && <div style={DISCONNECT_BANNER}>Connection lost. Reconnecting...</div>}

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <div
        className="animate-fade-in-down"
        style={{
          padding: `${spacing[8]}px 0 ${spacing[6]}px`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          marginBottom: spacing[6],
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
          className="stack-mobile"
        >
          {/* Title block */}
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.primary400,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: spacing[2],
              }}
            >
              Live Leaderboard
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 36,
                fontWeight: 800,
                lineHeight: 1,
                color: colors.textPrimary,
                letterSpacing: "-0.02em",
              }}
            >
              Sales Arena
            </h1>
          </div>

          {/* Right: live indicator + countdown + theme toggle */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: spacing[2],
            }}
          >
            {/* Live badge + theme toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
              <ThemeToggle />
              <Badge color="#22c55e" variant="subtle" size="md">
                <span
                  className="animate-live-pulse"
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#22c55e",
                    flexShrink: 0,
                  }}
                />
                LIVE
              </Badge>
            </div>

            {/* Real-time status */}
            <span style={{ fontSize: 11, color: colors.textMuted }}>
              Updated {lastUpdated}
            </span>
          </div>
        </div>

        {/* ── Stats bar ───────────────────────────────────────── */}
        <div
          className="stagger-1"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: spacing[4],
            marginTop: spacing[6],
          }}
        >
          {/* Today's Sales */}
          <div
            className="animate-fade-in-up stagger-1"
            style={{
              padding: `${spacing[5]}px`,
              borderRadius: radius.xl,
              background: colors.successBg,
              border: `1px solid rgba(52,211,153,0.15)`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: spacing[4],
                right: spacing[4],
                color: colors.success,
                opacity: 0.5,
              }}
            >
              <Activity size={20} />
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.success,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: spacing[1],
              }}
            >
              Today&apos;s Sales
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: colors.success,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {data ? <AnimatedNumber value={totalToday} /> : <span style={{ color: colors.borderStrong }}>—</span>}
            </div>
          </div>

          {/* Today's Premium */}
          <div
            className="animate-fade-in-up stagger-2"
            style={{
              padding: `${spacing[5]}px`,
              borderRadius: radius.xl,
              background: colors.warningBg,
              border: `1px solid rgba(251,191,36,0.15)`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: spacing[4],
                right: spacing[4],
                color: colors.gold,
                opacity: 0.5,
              }}
            >
              <DollarSign size={20} />
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.gold,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: spacing[1],
              }}
            >
              Today&apos;s Premium
            </div>
            <div
              style={{
                fontSize: data && totalPremToday >= 10000 ? 22 : 26,
                fontWeight: 800,
                color: colors.gold,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {data ? (
                <AnimatedNumber value={totalPremToday} prefix="$" decimals={2} />
              ) : (
                <span style={{ color: colors.borderStrong }}>—</span>
              )}
            </div>
          </div>

          {/* Weekly Sales */}
          <div
            className="animate-fade-in-up stagger-3"
            style={{
              padding: `${spacing[5]}px`,
              borderRadius: radius.xl,
              background: colors.infoBg,
              border: `1px solid rgba(45,212,191,0.15)`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: spacing[4],
                right: spacing[4],
                color: colors.info,
                opacity: 0.5,
              }}
            >
              <BarChart3 size={20} />
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.info,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: spacing[1],
              }}
            >
              Weekly Sales
            </div>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: colors.info,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {data ? (
                <AnimatedNumber value={data.grandTotalSales} />
              ) : (
                <span style={{ color: colors.borderStrong }}>—</span>
              )}
            </div>
          </div>

          {/* Weekly Premium */}
          <div
            className="animate-fade-in-up stagger-4"
            style={{
              padding: `${spacing[5]}px`,
              borderRadius: radius.xl,
              background: colors.infoBg,
              border: `1px solid rgba(45,212,191,0.15)`,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: spacing[4],
                right: spacing[4],
                color: colors.info,
                opacity: 0.5,
              }}
            >
              <TrendingUp size={20} />
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: colors.info,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: spacing[1],
              }}
            >
              Weekly Premium
            </div>
            <div
              style={{
                fontSize: data && data.grandTotalPremium >= 10000 ? 20 : 26,
                fontWeight: 800,
                color: colors.info,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {data ? (
                <AnimatedNumber value={data.grandTotalPremium} prefix="$" decimals={2} />
              ) : (
                <span style={{ color: colors.borderStrong }}>—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── View Toggle ──────────────────────────────────────────── */}
      <div className="animate-fade-in stagger-3" style={{ marginBottom: spacing[6] }}>
        <TabNav
          tabs={[
            { key: "daily", label: "Daily View", icon: <Users size={14} /> },
            { key: "weekly", label: "Weekly View", icon: <Calendar size={14} /> },
          ]}
          active={view}
          onChange={(k) => setView(k as "daily" | "weekly")}
        />
      </div>

      {/* ── Content area ─────────────────────────────────────────── */}
      {!data ? (
        <LoadingSkeleton />
      ) : data.agents.length === 0 ? (
        <div
          style={{
            ...baseCardStyle,
            padding: `${spacing[16]}px ${spacing[8]}px`,
          }}
        >
          <EmptyState
            icon={<Users size={32} />}
            title="No Agents Yet"
            description="Add agents in the Manager Dashboard to start tracking the leaderboard."
          />
        </div>
      ) : view === "weekly" ? (
        <WeeklyView key="weekly" data={data} highlightedAgentNames={highlightedAgentNames} />
      ) : (
        <DailyView key="daily" data={data} highlightedAgentNames={highlightedAgentNames} />
      )}
    </main>
  );
}
