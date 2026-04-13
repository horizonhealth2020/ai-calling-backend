"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  AnimatedNumber,
  DateRangeFilter,
  KPI_PRESETS,
  Card,
  SkeletonCard,
  EmptyState,
  Badge,
  useToast,
  colors,
  spacing,
  radius,
  typography,
  motion,
  baseCardStyle,
  baseThStyle,
  baseTdStyle,
  semanticColors,
  colorAlpha,
} from "@ops/ui";
import type { DateRangeFilterValue } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { HIGHLIGHT_GLOW } from "@ops/socket";
import type { SaleChangedPayload } from "@ops/socket";
import {
  Trophy,
  Medal,
  Award,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Edit3,
  CheckCircle,
  Clock,
  Activity,
  Download,
} from "lucide-react";

/* ── Types ────────────────────────────────────────────────────── */

type SocketClient = import("socket.io-client").Socket;

type CallTiers = {
  short: number;
  contacted: number;
  engaged: number;
  deep: number;
};

type LeaderboardEntry = {
  agent: string;
  calls: number;
  avgCallLength: number;
  salesCount: number;
  premiumTotal: number;
  costPerSale: number;
  commissionTotal: number;
  callsByTier: CallTiers;
};

type FeedEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
  actorName: string;
};

type CommandCenterData = {
  hero: {
    salesCount: number;
    premiumTotal: number;
    priorSalesCount: number;
    priorPremiumTotal: number;
  };
  statCards: {
    thisWeekPremium: number;
    priorWeekPremium: number;
    commissionOwedFriday: number;
    chargebackCount: number;
    chargebackDollars: number;
    priorChargebackCount: number;
    avgCostPerSale: number;
    priorAvgCostPerSale: number;
    convosoConfigured: boolean;
  };
  leaderboard: LeaderboardEntry[];
};

/* ── Helpers ──────────────────────────────────────────────────── */

function buildDateParams(dr: DateRangeFilterValue): string {
  if (dr.preset === "custom" && dr.from && dr.to)
    return `from=${dr.from}&to=${dr.to}`;
  if (dr.preset && dr.preset !== "custom") return `range=${dr.preset}`;
  return "";
}

function fmtDuration(seconds: number): string {
  if (!seconds) return "\u2014";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function fmtDollar(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDollarExact(n: number): string {
  return `$${n.toFixed(2)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatFeedEvent(event: FeedEvent): { icon: React.ReactNode; color: string; description: string } {
  const d = event.details as Record<string, string | number | undefined>;
  if (event.entityType === "Sale" && event.action === "CREATE") {
    return { icon: <DollarSign size={14} />, color: semanticColors.accentTealMid, description: `entered a sale — ${d.productName ?? "Sale"} ${d.premium ? fmtDollar(Number(d.premium)) : ""} for ${d.memberName ?? ""}`.trim() };
  }
  if (event.entityType === "Sale" && event.action === "UPDATE") {
    return { icon: <Edit3 size={14} />, color: semanticColors.accentBlue, description: `updated sale — ${d.memberName ?? ""}` };
  }
  if (event.entityType === "Sale" && event.action === "UPDATE_STATUS") {
    const status = (d.newStatus as string) ?? "";
    return { icon: <Edit3 size={14} />, color: status === "DEAD" || status === "DECLINED" ? semanticColors.dangerLight : semanticColors.accentBlue, description: `changed sale status to ${status} — ${d.memberName ?? ""}` };
  }
  if (event.entityType === "Sale" && event.action === "REQUEST_STATUS_CHANGE") {
    return { icon: <Clock size={14} />, color: semanticColors.warningAmber, description: `requested status change — ${d.memberName ?? ""}` };
  }
  if (event.entityType === "Sale" && event.action === "DELETE") {
    return { icon: <AlertTriangle size={14} />, color: semanticColors.dangerLight, description: `deleted sale — ${d.memberName ?? ""}` };
  }
  if (event.entityType === "ChargebackSubmission" && event.action === "CREATE") {
    return { icon: <AlertTriangle size={14} />, color: semanticColors.dangerLight, description: `filed chargeback — ${d.payeeName ?? ""} ${d.totalAmount ? fmtDollar(Number(d.totalAmount)) : ""}`.trim() };
  }
  if (event.entityType === "ChargebackSubmission" && event.action === "UPDATE") {
    return { icon: <CheckCircle size={14} />, color: semanticColors.accentGreenMid, description: `resolved chargeback — ${d.payeeName ?? ""}` };
  }
  if (event.entityType === "PendingTerm" && event.action === "CREATE") {
    return { icon: <Clock size={14} />, color: semanticColors.warningAmber, description: `submitted pending term — ${d.memberName ?? ""}` };
  }
  if (event.entityType === "PendingTerm" && event.action === "UPDATE") {
    return { icon: <CheckCircle size={14} />, color: semanticColors.accentGreenMid, description: `resolved pending term — ${d.memberName ?? ""}` };
  }
  return { icon: <Activity size={14} />, color: colors.textMuted, description: `${event.action.toLowerCase()} ${event.entityType}` };
}

function computeDelta(
  current: number,
  prior: number
): { pct: number; direction: "up" | "down" | "flat" } {
  if (prior === 0)
    return current > 0
      ? { pct: 100, direction: "up" }
      : { pct: 0, direction: "flat" };
  const pct = Math.round(((current - prior) / prior) * 100);
  return {
    pct: Math.abs(pct),
    direction: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
  };
}

/* ── Style Constants ─────────────────────────────────────────── */

const HERO_CARD: React.CSSProperties = {
  ...baseCardStyle,
  borderRadius: radius["2xl"],
  padding: 24,
  borderLeft: `4px solid ${semanticColors.accentTealMid}`,
  position: "relative",
  overflow: "hidden",
  transition: `box-shadow ${motion.duration.slow} ${motion.easing.out}`,
};

const HERO_PREMIUM: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 800,
  letterSpacing: typography.tracking.tight,
  backgroundImage: `linear-gradient(135deg, ${semanticColors.accentGreenBright}, ${semanticColors.accentGreenMid})`,
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
  backgroundClip: "text",
  lineHeight: 1.1,
  margin: 0,
};

const HERO_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: colors.textTertiary,
  textTransform: "uppercase",
  letterSpacing: typography.tracking.caps,
  marginBottom: 4,
};

const HERO_SALES: React.CSSProperties = {
  fontSize: 18,
  fontWeight: typography.weights.semibold,
  color: colors.textSecondary,
  marginTop: 4,
};

const STAT_CARD: React.CSSProperties = {
  ...baseCardStyle,
  borderRadius: radius.xl,
  padding: 20,
  position: "relative",
};

const STAT_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: colors.textTertiary,
  textTransform: "uppercase",
  letterSpacing: typography.tracking.caps,
  marginBottom: 8,
};

const STAT_VALUE: React.CSSProperties = {
  fontSize: 22,
  fontWeight: typography.weights.bold,
  color: colors.textPrimary,
  lineHeight: 1.2,
};

const DELTA_BADGE_BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 3,
  fontSize: 11,
  fontWeight: typography.weights.semibold,
  padding: "2px 8px",
  borderRadius: radius.full,
  marginTop: 6,
};

const LEADERBOARD_CARD: React.CSSProperties = {
  ...baseCardStyle,
  borderRadius: radius["2xl"],
  padding: 0,
  overflow: "hidden",
  marginTop: 16,
};

const LEADERBOARD_HEADER: React.CSSProperties = {
  padding: "16px 24px",
  borderBottom: `1px solid ${colors.borderSubtle}`,
  display: "flex",
  alignItems: "center",
  gap: 10,
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
  margin: "2px 0 0",
};

/* ── Delta Badge ─────────────────────────────────────────────── */

function DeltaBadge({
  current,
  prior,
  invertColor = false,
}: {
  current: number;
  prior: number;
  invertColor?: boolean;
}) {
  const { pct, direction } = computeDelta(current, prior);
  if (direction === "flat") return null;

  const isPositive = direction === "up";
  const isGood = invertColor ? !isPositive : isPositive;

  const bgColor = isGood
    ? colorAlpha(semanticColors.accentGreenMid, 0.15)
    : colorAlpha(semanticColors.dangerLight, 0.15);
  const textColor = isGood
    ? semanticColors.accentGreenBright
    : semanticColors.dangerLight;
  const arrow = isPositive ? "\u2191" : "\u2193";

  return (
    <span style={{ ...DELTA_BADGE_BASE, background: bgColor, color: textColor }}>
      {arrow} {pct}%
    </span>
  );
}

/* ── Quality Dot ─────────────────────────────────────────────── */

function QualityDot({ tiers }: { tiers: CallTiers }) {
  const total = tiers.short + tiers.contacted + tiers.engaged + tiers.deep;
  if (total === 0) return <span style={{ color: colors.textMuted }}>{"\u2014"}</span>;

  const qualityRatio = (tiers.engaged + tiers.deep) / total;
  const pctLabel = `${Math.round(qualityRatio * 100)}% quality`;

  let dotColor: string;
  if (qualityRatio > 0.6) {
    dotColor = semanticColors.accentGreenMid;
  } else if (qualityRatio > 0.3) {
    dotColor = semanticColors.warningAmber;
  } else {
    dotColor = semanticColors.dangerLight;
  }

  return (
    <span
      title={pctLabel}
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: radius.full,
        background: dotColor,
        verticalAlign: "middle",
      }}
    />
  );
}

/* ── Rank Icon ───────────────────────────────────────────────── */

function RankIcon({ rank }: { rank: number }) {
  if (rank === 0)
    return <Trophy size={16} color={colors.gold} strokeWidth={2.5} />;
  if (rank === 1)
    return <Medal size={16} color={colors.silver} strokeWidth={2.5} />;
  if (rank === 2)
    return <Award size={16} color={colors.bronze} strokeWidth={2.5} />;
  return (
    <span
      style={{
        color: colors.textMuted,
        fontSize: typography.sizes.sm.fontSize,
        fontWeight: typography.weights.medium,
      }}
    >
      #{rank + 1}
    </span>
  );
}

/* ── Skeleton Loading ────────────────────────────────────────── */

function CommandCenterSkeleton() {
  return (
    <div>
      <SkeletonCard height={140} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} height={100} />
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <SkeletonCard height={300} />
      </div>
    </div>
  );
}

/* ── Hero Section ────────────────────────────────────────────── */

function HeroSection({
  hero,
  dateRange,
  onDateRangeChange,
  compact,
  glowing,
}: {
  hero: CommandCenterData["hero"];
  dateRange: DateRangeFilterValue;
  onDateRangeChange: (v: DateRangeFilterValue) => void;
  compact: boolean;
  glowing: boolean;
}) {
  const glowStyle: React.CSSProperties = glowing
    ? { boxShadow: `0 0 30px ${colorAlpha(semanticColors.accentGreenBright, 0.2)}, 0 0 60px ${colorAlpha(semanticColors.accentGreenBright, 0.08)}` }
    : {};

  return (
    <div style={{ ...HERO_CARD, ...glowStyle, display: "flex", flexDirection: compact ? "column" : "row", alignItems: compact ? "stretch" : "center", justifyContent: "space-between", gap: 20 }}>
      {/* Left: Premium + Sales */}
      <div style={{ flex: 1 }}>
        <div style={HERO_LABEL}>Total Premium</div>
        <div style={HERO_PREMIUM}>
          <AnimatedNumber value={hero.premiumTotal} prefix="$" decimals={0} />
        </div>
        <div style={HERO_SALES}>
          <AnimatedNumber value={hero.salesCount} decimals={0} /> sales
        </div>
        <DeltaBadge current={hero.premiumTotal} prior={hero.priorPremiumTotal} />
      </div>

      {/* Right: Date filter */}
      <div style={{ flexShrink: 0 }}>
        <DateRangeFilter
          value={dateRange}
          onChange={onDateRangeChange}
          presets={KPI_PRESETS}
        />
      </div>
    </div>
  );
}

/* ── Stat Cards Row ──────────────────────────────────────────── */

function StatCardsRow({ stats, hero }: { stats: CommandCenterData["statCards"]; hero: CommandCenterData["hero"] }) {
  const chargebackDanger =
    stats.chargebackCount > stats.priorChargebackCount;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
      }}
    >
      {/* Total Sales */}
      <div
        className="stagger-1"
        style={{
          ...STAT_CARD,
          borderLeft: `3px solid ${colors.accentTeal}`,
        }}
      >
        <div style={STAT_LABEL}>Sales</div>
        <div style={STAT_VALUE}><AnimatedNumber value={hero.salesCount} decimals={0} /></div>
        <DeltaBadge current={hero.salesCount} prior={hero.priorSalesCount} />
      </div>

      {/* Total Premium */}
      <div
        className="stagger-2"
        style={{
          ...STAT_CARD,
          borderLeft: `3px solid ${semanticColors.accentGreenMid}`,
        }}
      >
        <div style={STAT_LABEL}>Premium</div>
        <div style={STAT_VALUE}>{fmtDollar(hero.premiumTotal)}</div>
        <DeltaBadge current={hero.premiumTotal} prior={hero.priorPremiumTotal} />
      </div>

      {/* Commission Friday */}
      <div
        className="stagger-3"
        style={{
          ...STAT_CARD,
          borderLeft: `3px solid ${semanticColors.accentBlue}`,
        }}
      >
        <div style={STAT_LABEL}>Commission Friday</div>
        <div style={STAT_VALUE}>{fmtDollar(stats.commissionOwedFriday)}</div>
      </div>

      {/* Chargebacks */}
      <div
        className={chargebackDanger ? "stagger-4 animate-pulse" : "stagger-4"}
        style={{
          ...STAT_CARD,
          borderLeft: `3px solid ${chargebackDanger ? semanticColors.dangerLight : colors.danger}`,
        }}
      >
        <div style={STAT_LABEL}>Chargebacks</div>
        <div style={STAT_VALUE}>
          {stats.chargebackCount}{" "}
          <span
            style={{
              fontSize: 14,
              fontWeight: typography.weights.medium,
              color: colors.textTertiary,
            }}
          >
            ({fmtDollar(stats.chargebackDollars)})
          </span>
        </div>
        <DeltaBadge
          current={stats.chargebackCount}
          prior={stats.priorChargebackCount}
          invertColor
        />
      </div>

      {/* Lead ROI */}
      <div
        className="stagger-5"
        style={{
          ...STAT_CARD,
          borderLeft: `3px solid ${semanticColors.warningAmber}`,
        }}
      >
        <div style={STAT_LABEL}>Lead ROI</div>
        <div style={STAT_VALUE}>
          {stats.convosoConfigured
            ? `${fmtDollarExact(stats.avgCostPerSale)}/sale`
            : "\u2014"}
        </div>
        {stats.convosoConfigured && (
          <DeltaBadge
            current={stats.avgCostPerSale}
            prior={stats.priorAvgCostPerSale}
            invertColor
          />
        )}
      </div>
    </div>
  );
}

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

/* ── Leaderboard Section ─────────────────────────────────────── */

function LeaderboardSection({
  leaderboard,
  compact,
}: {
  leaderboard: LeaderboardEntry[];
  compact: boolean;
}) {
  const sorted = [...leaderboard].sort(
    (a, b) => b.premiumTotal - a.premiumTotal
  );

  function exportLeaderboardCsv() {
    const headers = "Agent,Calls,Avg Call Length (s),Sales,Premium,Cost/Sale,Commission";
    const rows = sorted.map(r =>
      [csvField(r.agent), r.calls, r.avgCallLength.toFixed(0), r.salesCount, r.premiumTotal.toFixed(2), r.costPerSale.toFixed(2), r.commissionTotal.toFixed(2)].join(",")
    );
    downloadCsv([headers, ...rows].join("\n"), `leaderboard-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div style={LEADERBOARD_CARD} className="animate-fade-in-up stagger-5">
      <div style={{ ...LEADERBOARD_HEADER, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
          <BarChart3 size={18} color={colors.accentTeal} />
          <div>
            <h3 style={SECTION_TITLE}>Agent Leaderboard</h3>
            <p style={SECTION_SUBTITLE}>Ranked by premium total</p>
          </div>
        </div>
        {sorted.length > 0 && (
          <button
            onClick={exportLeaderboardCsv}
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
      </div>

      <div style={{ overflowX: compact ? "auto" : undefined }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: colors.bgSurfaceInset }}>
              <th style={baseThStyle}>Rank</th>
              <th style={baseThStyle}>Agent</th>
              <th style={{ ...baseThStyle, textAlign: "right" }}>Calls</th>
              <th style={{ ...baseThStyle, textAlign: "right" }}>Avg</th>
              <th style={{ ...baseThStyle, textAlign: "right" }}>Sales</th>
              <th style={{ ...baseThStyle, textAlign: "right" }}>Premium</th>
              <th style={{ ...baseThStyle, textAlign: "right" }}>Commission</th>
              <th style={{ ...baseThStyle, textAlign: "right" }}>Cost/Sale</th>
              <th style={{ ...baseThStyle, textAlign: "center" }}>Quality</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    icon={<BarChart3 size={32} />}
                    title="No agent data yet"
                    description="Sales data will appear here once agents start submitting."
                  />
                </td>
              </tr>
            )}
            {sorted.map((row, i) => {
              const isTop3 = i < 3;
              return (
                <tr
                  key={row.agent}
                  className="row-hover animate-fade-in-up"
                  style={{
                    transition: `background ${motion.duration.fast} ${motion.easing.out}`,
                  }}
                >
                  {/* Rank */}
                  <td
                    style={{
                      ...baseTdStyle,
                      textAlign: "center",
                      width: 50,
                    }}
                  >
                    <RankIcon rank={i} />
                  </td>

                  {/* Agent */}
                  <td
                    style={{
                      ...baseTdStyle,
                      fontWeight: isTop3
                        ? typography.weights.bold
                        : typography.weights.semibold,
                      color: isTop3
                        ? colors.textPrimary
                        : colors.textSecondary,
                    }}
                  >
                    {row.agent}
                  </td>

                  {/* Calls */}
                  <td
                    style={{
                      ...baseTdStyle,
                      textAlign: "right",
                      fontWeight: typography.weights.semibold,
                      color: colors.textSecondary,
                    }}
                  >
                    {row.calls}
                  </td>

                  {/* Avg Call Length */}
                  <td
                    style={{
                      ...baseTdStyle,
                      textAlign: "right",
                      color: colors.textTertiary,
                      fontFamily: typography.fontMono,
                      fontSize: typography.sizes.xs2.fontSize,
                    }}
                  >
                    {fmtDuration(row.avgCallLength)}
                  </td>

                  {/* Sales */}
                  <td
                    style={{
                      ...baseTdStyle,
                      textAlign: "right",
                      fontWeight: typography.weights.bold,
                      color: colors.textSecondary,
                    }}
                  >
                    <AnimatedNumber value={row.salesCount} />
                  </td>

                  {/* Premium */}
                  <td
                    style={{
                      ...baseTdStyle,
                      textAlign: "right",
                      fontWeight: typography.weights.extrabold,
                    }}
                  >
                    {i === 0 ? (
                      <span
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${semanticColors.accentGreenBright}, ${semanticColors.accentGreenMid}, ${semanticColors.accentGreenDark})`,
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        <AnimatedNumber
                          value={row.premiumTotal}
                          prefix="$"
                          decimals={0}
                        />
                      </span>
                    ) : (
                      <span style={{ color: colors.success }}>
                        <AnimatedNumber
                          value={row.premiumTotal}
                          prefix="$"
                          decimals={0}
                        />
                      </span>
                    )}
                  </td>

                  {/* Commission */}
                  <td
                    style={{
                      ...baseTdStyle,
                      textAlign: "right",
                      fontWeight: typography.weights.semibold,
                      color: semanticColors.accentGreenMid,
                    }}
                  >
                    {row.commissionTotal > 0
                      ? fmtDollar(row.commissionTotal)
                      : "\u2014"}
                  </td>

                  {/* Cost/Sale */}
                  <td
                    style={{
                      ...baseTdStyle,
                      textAlign: "right",
                      fontWeight: typography.weights.semibold,
                      color: colors.textSecondary,
                    }}
                  >
                    {row.costPerSale > 0
                      ? fmtDollarExact(row.costPerSale)
                      : "\u2014"}
                  </td>

                  {/* Quality */}
                  <td
                    style={{
                      ...baseTdStyle,
                      textAlign: "center",
                    }}
                  >
                    <QualityDot tiers={row.callsByTier} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Activity Feed ────────────────────────────────────────────── */

function ActivityFeed({ events }: { events: FeedEvent[] }) {
  return (
    <div
      className="animate-fade-in-up stagger-8"
      style={{
        ...baseCardStyle,
        borderRadius: radius["2xl"],
        padding: 0,
        overflow: "hidden",
        marginTop: 16,
      }}
    >
      <div
        style={{
          padding: "16px 24px",
          borderBottom: `1px solid ${colors.borderSubtle}`,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Activity size={16} color={colors.textTertiary} />
        <span
          style={{
            fontSize: typography.sizes.sm.fontSize,
            fontWeight: typography.weights.semibold,
            color: colors.textSecondary,
          }}
        >
          Live Activity
        </span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: semanticColors.accentGreenMid,
            display: "inline-block",
            marginLeft: 4,
          }}
          className="animate-live-pulse"
        />
      </div>

      {events.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center" }}>
          <EmptyState
            icon={<Activity size={28} />}
            title="No recent activity"
            description="Events will appear here as sales and chargebacks are entered."
          />
        </div>
      ) : (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {events.map((event, i) => {
            const { icon, color, description } = formatFeedEvent(event);
            return (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 24px",
                  borderBottom: i < events.length - 1 ? `1px solid ${colors.borderSubtle}` : undefined,
                  transition: `background ${motion.duration.fast} ${motion.easing.out}`,
                }}
                className="row-hover"
              >
                <span
                  style={{
                    color,
                    flexShrink: 0,
                    marginTop: 2,
                    width: 24,
                    height: 24,
                    borderRadius: radius.md,
                    background: colorAlpha(color, 0.1),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textPrimary }}>
                    <span style={{ fontWeight: typography.weights.semibold }}>{event.actorName}</span>{" "}
                    <span style={{ color: colors.textSecondary }}>{description}</span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: typography.sizes.xs.fontSize,
                    color: colors.textMuted,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {timeAgo(event.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */

export default function OwnerOverview({
  socket,
  API,
}: {
  socket: SocketClient | null;
  API: string;
}) {
  const { toast } = useToast();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeFilterValue>({
    preset: "week",
  });
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [compact, setCompact] = useState(false);
  const [heroGlow, setHeroGlow] = useState(false);
  const dateRangeRef = useRef(dateRange);
  dateRangeRef.current = dateRange;

  /* Responsive */
  useEffect(() => {
    const check = () => setCompact(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* Fetch data */
  const fetchData = useCallback(
    (dr: DateRangeFilterValue) => {
      setLoading(true);
      const dp = buildDateParams(dr);
      const qs = dp ? `?${dp}` : "";
      authFetch(`${API}/api/command-center${qs}`)
        .then((res) => {
          if (!res.ok) throw new Error(`Request failed (${res.status})`);
          return res.json();
        })
        .then((d: CommandCenterData) => {
          setData(d);
          setLoading(false);
        })
        .catch(() => {
          toast("error", "Failed to load command center data");
          setLoading(false);
        });
    },
    [API, toast]
  );

  useEffect(() => {
    fetchData(dateRange);
  }, [dateRange, fetchData]);

  /* Socket: real-time sale updates */
  const handleSaleChanged = useCallback((payload: SaleChangedPayload) => {
    if (payload.sale.status !== "RAN") return;
    if (payload.type !== "created" && payload.type !== "status_changed") return;

    const addonPrem =
      payload.sale.addons?.reduce(
        (s: number, a) =>
          s + Number((a as { premium?: number | null }).premium ?? 0),
        0
      ) ?? 0;
    const totalPrem = payload.sale.premium + addonPrem;

    /* Flash the hero */
    setHeroGlow(true);
    setTimeout(() => setHeroGlow(false), 1500);

    setData((prev) => {
      if (!prev) return prev;

      /* Update hero */
      const hero = {
        ...prev.hero,
        salesCount: prev.hero.salesCount + 1,
        premiumTotal: prev.hero.premiumTotal + totalPrem,
      };

      /* Update stat cards */
      const statCards = {
        ...prev.statCards,
        thisWeekPremium: prev.statCards.thisWeekPremium + totalPrem,
      };

      /* Update leaderboard */
      const agentName = payload.sale.agent.name;
      const existingIdx = prev.leaderboard.findIndex(
        (e) => e.agent === agentName
      );
      let leaderboard: LeaderboardEntry[];

      if (existingIdx >= 0) {
        leaderboard = prev.leaderboard.map((e, idx) =>
          idx === existingIdx
            ? {
                ...e,
                salesCount: e.salesCount + 1,
                premiumTotal: e.premiumTotal + totalPrem,
              }
            : e
        );
      } else {
        leaderboard = [
          ...prev.leaderboard,
          {
            agent: agentName,
            calls: 0,
            avgCallLength: 0,
            salesCount: 1,
            premiumTotal: totalPrem,
            costPerSale: 0,
            commissionTotal: 0,
            callsByTier: { short: 0, contacted: 0, engaged: 0, deep: 0 },
          },
        ];
      }

      return { hero, statCards, leaderboard };
    });
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on("sale:changed", handleSaleChanged);
    return () => {
      socket.off("sale:changed", handleSaleChanged);
    };
  }, [socket, handleSaleChanged]);

  /* Reconnect refetch */
  useEffect(() => {
    if (!socket) return;
    const handleReconnect = () => fetchData(dateRangeRef.current);
    socket.on("connect", handleReconnect);
    return () => {
      socket.off("connect", handleReconnect);
    };
  }, [socket, fetchData]);

  /* ── Activity Feed ──────────────────────────────────────────── */

  const refetchFeed = useCallback(() => {
    authFetch(`${API}/api/activity-feed?limit=20`)
      .then(r => r.ok ? r.json() : { events: [] })
      .then((d: { events: FeedEvent[] }) => setFeedEvents(d.events ?? []))
      .catch(() => {});
  }, [API]);

  // Initial feed load
  useEffect(() => { refetchFeed(); }, [refetchFeed]);

  // Refetch feed on socket events
  useEffect(() => {
    if (!socket) return;
    socket.on("sale:changed", refetchFeed);
    socket.on("cs:changed", refetchFeed);
    return () => {
      socket.off("sale:changed", refetchFeed);
      socket.off("cs:changed", refetchFeed);
    };
  }, [socket, refetchFeed]);

  /* ── Render ─────────────────────────────────────────────────── */

  return (
    <div className="animate-fade-in">
      {loading || !data ? (
        <CommandCenterSkeleton />
      ) : (
        <>
          {/* Period Selector Bar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 16,
            ...(heroGlow ? { filter: `drop-shadow(0 0 8px ${colorAlpha(semanticColors.accentGreenBright, 0.3)})`, transition: "filter 1.5s ease-out" } : {}),
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: typography.sizes.lg.fontSize, fontWeight: typography.weights.bold, color: colors.textPrimary }}>Command Center</h2>
              <p style={{ margin: "4px 0 0", fontSize: typography.sizes.sm.fontSize, color: colors.textTertiary }}>Office performance at a glance</p>
            </div>
            <DateRangeFilter value={dateRange} onChange={setDateRange} presets={KPI_PRESETS} />
          </div>
          <StatCardsRow stats={data.statCards} hero={data.hero} />
          <LeaderboardSection
            leaderboard={data.leaderboard}
            compact={compact}
          />
          <ActivityFeed events={feedEvents} />
        </>
      )}
    </div>
  );
}
