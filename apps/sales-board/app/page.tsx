"use client";
import { useState, useEffect } from "react";
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
  ProgressRing,
  EmptyState,
  SkeletonCard,
  SkeletonLine,
  SkeletonTable,
  ThemeToggle,
} from "@ops/ui";
import { colors, spacing, radius, shadows, baseCardStyle } from "@ops/ui";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";
const INTERVAL = 30_000;

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

/* ── Podium rank configuration ────────────────────────────────── */

const PODIUM_CONFIG = {
  0: {
    bg: "radial-gradient(ellipse at top, rgba(251,191,36,0.25) 0%, rgba(217,119,6,0.12) 50%, transparent 100%), linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(180,83,9,0.1) 100%)",
    border: "rgba(251,191,36,0.45)",
    glow: `0 0 40px rgba(251,191,36,0.3), ${shadows.xl}`,
    rankColor: colors.gold,
    icon: <Trophy size={32} strokeWidth={1.5} />,
    height: 220,
    width: 200,
    nameSize: 17,
    countSize: 36,
    stagger: "stagger-2",
    label: "1st Place",
    order: 1,
  },
  1: {
    bg: "radial-gradient(ellipse at top, rgba(209,213,219,0.18) 0%, rgba(156,163,175,0.08) 50%, transparent 100%), linear-gradient(135deg, rgba(209,213,219,0.12) 0%, rgba(107,114,128,0.08) 100%)",
    border: "rgba(209,213,219,0.35)",
    glow: `0 0 24px rgba(209,213,219,0.2), ${shadows.lg}`,
    rankColor: colors.silver,
    icon: <Medal size={28} strokeWidth={1.5} />,
    height: 180,
    width: 175,
    nameSize: 15,
    countSize: 28,
    stagger: "stagger-1",
    label: "2nd Place",
    order: 0,
  },
  2: {
    bg: "radial-gradient(ellipse at top, rgba(217,119,6,0.2) 0%, rgba(180,83,9,0.1) 50%, transparent 100%), linear-gradient(135deg, rgba(217,119,6,0.12) 0%, rgba(146,64,14,0.08) 100%)",
    border: "rgba(217,119,6,0.4)",
    glow: `0 0 24px rgba(217,119,6,0.25), ${shadows.lg}`,
    rankColor: colors.bronze,
    icon: <Award size={26} strokeWidth={1.5} />,
    height: 160,
    width: 165,
    nameSize: 14,
    countSize: 26,
    stagger: "stagger-3",
    label: "3rd Place",
    order: 2,
  },
} as const;

/* ── PodiumCard ───────────────────────────────────────────────── */

function PodiumCard({
  rank,
  name,
  count,
  premium,
}: {
  rank: 0 | 1 | 2;
  name: string;
  count: number;
  premium: number;
}) {
  const cfg = PODIUM_CONFIG[rank];

  return (
    <div
      className={`animate-podium-rise ${cfg.stagger}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        order: cfg.order,
      }}
    >
      {/* Rank label above card */}
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: cfg.rankColor,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          marginBottom: 8,
          opacity: 0.8,
        }}
      >
        {cfg.label}
      </div>

      {/* Podium column */}
      <div
        style={{
          width: cfg.width,
          height: cfg.height,
          borderRadius: `${radius["2xl"]}px ${radius["2xl"]}px 0 0`,
          background: cfg.bg,
          border: `1.5px solid ${cfg.border}`,
          borderBottom: "none",
          boxShadow: cfg.glow,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: `${spacing[5]}px ${spacing[4]}px`,
          position: "relative",
          overflow: "hidden",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Subtle top highlight */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "10%",
            right: "10%",
            height: 1,
            background: `linear-gradient(90deg, transparent, ${cfg.border}, transparent)`,
            pointerEvents: "none",
          }}
        />

        {/* Icon */}
        <div
          style={{
            color: cfg.rankColor,
            marginBottom: spacing[2],
            filter: `drop-shadow(0 2px 8px ${cfg.rankColor}60)`,
          }}
        >
          {cfg.icon}
        </div>

        {/* Agent name */}
        <div
          style={{
            fontSize: cfg.nameSize,
            fontWeight: 700,
            color: colors.textPrimary,
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: spacing[2],
            letterSpacing: "-0.01em",
          }}
        >
          {name}
        </div>

        {/* Sales count */}
        <div
          style={{
            fontSize: cfg.countSize,
            fontWeight: 800,
            color: cfg.rankColor,
            lineHeight: 1,
            letterSpacing: "-0.03em",
            marginBottom: 4,
          }}
        >
          <AnimatedNumber value={count} />
        </div>

        {/* Premium */}
        <div style={{ fontSize: 12, fontWeight: 600, color: colors.textTertiary }}>
          <AnimatedNumber value={premium} prefix="$" decimals={2} />
        </div>
      </div>
    </div>
  );
}

/* ── Podium base platform ─────────────────────────────────────── */

function PodiumPlatform() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        gap: 0,
        height: 48,
        marginTop: -1,
      }}
    >
      {/* 2nd */}
      <div
        style={{
          width: 175,
          height: 32,
          background: "rgba(209,213,219,0.06)",
          border: "1px solid rgba(209,213,219,0.15)",
          borderBottom: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: colors.silver, opacity: 0.6 }}>2</span>
      </div>
      {/* 1st */}
      <div
        style={{
          width: 200,
          height: 48,
          background: "rgba(251,191,36,0.06)",
          border: "1px solid rgba(251,191,36,0.2)",
          borderBottom: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: colors.gold, opacity: 0.7 }}>1</span>
      </div>
      {/* 3rd */}
      <div
        style={{
          width: 165,
          height: 20,
          background: "rgba(217,119,6,0.06)",
          border: "1px solid rgba(217,119,6,0.15)",
          borderBottom: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: colors.bronze, opacity: 0.6 }}>3</span>
      </div>
    </div>
  );
}

/* ── DailyView ────────────────────────────────────────────────── */

function DailyView({ data }: { data: DetailedData }) {
  const [lbMode, setLbMode] = useState<"day" | "week">("day");
  const { agents, todayStats, weeklyTotals } = data;

  const stats = lbMode === "day" ? todayStats : weeklyTotals;

  const sorted = [...agents].sort((a, b) => {
    const aPrem = stats[a]?.premium ?? 0;
    const bPrem = stats[b]?.premium ?? 0;
    // Agents with sales sort by premium desc; agents without sales sort alphabetically
    if (aPrem > 0 && bPrem > 0) return bPrem - aPrem;
    if (aPrem > 0) return -1;
    if (bPrem > 0) return 1;
    return a.localeCompare(b);
  });
  const top3 = sorted
    .slice(0, 3)
    .map((a) => ({ name: a, count: stats[a]?.count ?? 0, premium: stats[a]?.premium ?? 0 }));
  const rest = sorted.slice(3);

  return (
    <div className="animate-fade-in">
      {/* Podium section */}
      {top3.length > 0 && (
        <div style={{ marginBottom: spacing[6] }}>
          {/* Podium stage header */}
          <div
            style={{
              textAlign: "center",
              marginBottom: spacing[4],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing[3],
            }}
          >
            <div style={{ height: 1, flex: 1, background: `linear-gradient(to right, transparent, ${colors.borderDefault})` }} />
            <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
              <Crown size={14} color={colors.gold} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.textTertiary,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Top Performers
              </span>
              <Crown size={14} color={colors.gold} />
            </div>
            <div style={{ height: 1, flex: 1, background: `linear-gradient(to left, transparent, ${colors.borderDefault})` }} />
          </div>

          {/* Day / Week toggle */}
          <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: spacing[4] }}>
            {(["day", "week"] as const).map(m => (
              <button
                key={m}
                onClick={() => setLbMode(m)}
                style={{
                  padding: "6px 18px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                  background: lbMode === m ? colors.primary500 : colors.bgSurfaceInset,
                  color: lbMode === m ? "#fff" : colors.textSecondary,
                  transition: "all 150ms ease-out",
                }}
              >
                {m === "day" ? "Today" : "This Week"}
              </button>
            ))}
          </div>

          {/* Podium cards */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              gap: 0,
            }}
          >
            {top3.map((a, i) => (
              <PodiumCard
                key={a.name}
                rank={i as 0 | 1 | 2}
                name={a.name}
                count={a.count}
                premium={a.premium}
              />
            ))}
          </div>

          {/* Platform base */}
          <PodiumPlatform />
        </div>
      )}

      {/* Remaining agents — individual columns */}
      {rest.length > 0 && (
        <>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textMuted,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              textAlign: "center",
              marginBottom: spacing[3],
            }}
          >
            All Agents
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "flex-end",
              gap: spacing[3],
              flexWrap: "wrap",
            }}
          >
            {rest.map((agent, i) => {
              const agentStat = stats[agent];
              const count = agentStat?.count ?? 0;
              const premium = agentStat?.premium ?? 0;
              const staggerClass = `stagger-${Math.min(i + 1, 10)}` as string;
              return (
                <div
                  key={agent}
                  className={`animate-fade-in-up ${staggerClass}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    width: 120,
                    flexShrink: 0,
                  }}
                >
                  {/* Rank */}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: radius.full,
                      background: colors.bgSurfaceOverlay,
                      border: `1px solid ${colors.borderDefault}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: colors.textMuted,
                      marginBottom: 6,
                    }}
                  >
                    {i + 4}
                  </div>
                  {/* Column */}
                  <div
                    style={{
                      width: "100%",
                      minHeight: 100,
                      borderRadius: `${radius.xl}px ${radius.xl}px 0 0`,
                      background: "linear-gradient(135deg, rgba(148,163,184,0.04) 0%, rgba(100,116,139,0.02) 100%)",
                      border: `1.5px solid ${count > 0 ? "rgba(20,184,166,0.3)" : colors.borderSubtle}`,
                      borderBottom: "none",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: `${spacing[3]}px ${spacing[2]}px ${spacing[4]}px`,
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: count > 0 ? colors.textPrimary : colors.textMuted,
                        lineHeight: 1.2,
                        marginBottom: spacing[1],
                        wordBreak: "break-word",
                      }}
                    >
                      {agent}
                    </div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: count > 0 ? colors.textPrimary : colors.textMuted,
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                        marginBottom: 2,
                        opacity: count > 0 ? 1 : 0.4,
                      }}
                    >
                      <AnimatedNumber value={count} />
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: colors.textTertiary, opacity: count > 0 ? 1 : 0.4 }}>
                      <AnimatedNumber value={premium} prefix="$" decimals={2} />
                    </div>
                  </div>
                </div>
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
      )}

      {/* Empty state if no agents at all */}
      {top3.length === 0 && rest.length === 0 && (
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

function WeeklyView({ data }: { data: DetailedData }) {
  const { agents, weeklyDays, weeklyTotals, grandTotalSales, grandTotalPremium } = data;
  const dayMap: Record<string, DayRow> = {};
  for (const d of weeklyDays) dayMap[d.label] = d;

  const sorted = [...agents].sort((a, b) => {
    const aPrem = weeklyTotals[a]?.premium ?? 0;
    const bPrem = weeklyTotals[b]?.premium ?? 0;
    if (aPrem > 0 && bPrem > 0) return bPrem - aPrem;
    if (aPrem > 0) return -1;
    if (bPrem > 0) return 1;
    return a.localeCompare(b);
  });

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
  const [tick, setTick] = useState(INTERVAL / 1000);

  async function refresh() {
    const res = await fetch(`${API}/api/sales-board/detailed`).catch(() => null);
    if (res?.ok) {
      setData(await res.json());
      setLastUpdated(new Date().toLocaleTimeString());
    }
    setTick(INTERVAL / 1000);
  }

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, INTERVAL);
    const cd = setInterval(() => setTick((t) => Math.max(0, t - 1)), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(cd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Derived summary stats */
  const totalToday = data
    ? Object.values(data.todayStats).reduce((s, v) => s + v.count, 0)
    : 0;
  const totalPremToday = data
    ? Object.values(data.todayStats).reduce((s, v) => s + v.premium, 0)
    : 0;

  /* Progress ring: tick out of 30s */
  const ringProgress = (tick / (INTERVAL / 1000)) * 100;

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

      {/* ── Hero Header ─────────────────────────────────────────── */}
      <div
        className="animate-fade-in-down"
        style={{
          padding: `${spacing[4]}px 0 ${spacing[3]}px`,
          borderBottom: `1px solid ${colors.borderSubtle}`,
          marginBottom: spacing[3],
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
              Sales Board
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

            {/* Countdown ring */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: spacing[2],
              }}
            >
              <ProgressRing
                progress={ringProgress}
                size={28}
                strokeWidth={2.5}
                color="#22c55e"
              />
              <span
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  fontWeight: 600,
                  minWidth: 48,
                }}
              >
                {tick}s
              </span>
              <span style={{ fontSize: 11, color: colors.textMuted }}>
                Updated {lastUpdated}
              </span>
            </div>
          </div>
        </div>

        {/* ── Stats bar ───────────────────────────────────────── */}
        <div
          className="stagger-1"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: spacing[3],
            marginTop: spacing[3],
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
      <div className="animate-fade-in stagger-3" style={{ marginBottom: spacing[3] }}>
        <TabNav
          tabs={[
            { key: "daily", label: "Leaderboard", icon: <Users size={14} /> },
            { key: "weekly", label: "Weekly Breakdown", icon: <Calendar size={14} /> },
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
        <WeeklyView key="weekly" data={data} />
      ) : (
        <DailyView key="daily" data={data} />
      )}
    </main>
  );
}
