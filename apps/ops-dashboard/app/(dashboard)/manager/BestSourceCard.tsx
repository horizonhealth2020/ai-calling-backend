"use client";
import React from "react";
import { AnimatedNumber, colors, spacing, radius, typography } from "@ops/ui";
import { TrendingUp, TrendingDown } from "lucide-react";

/* -- Types -- */

interface BestSourceCardProps {
  recommendation: {
    leadSourceName: string;
    closeRate: number;
    calls: number;
    sales: number;
    trend: "up" | "down" | "flat" | null;
    trendDelta: number | null;
  } | null;
}

/* -- Style constants -- */

const CARD_WRAP: React.CSSProperties = {
  background: colors.bgSurfaceRaised,
  border: `1px solid ${colors.borderDefault}`,
  borderLeft: `3px solid ${colors.accentTeal}`,
  borderRadius: radius.lg,
  padding: spacing[6],
};
const TITLE_LBL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: typography.tracking.caps,
  color: colors.textTertiary,
  marginBottom: spacing[2],
};
const SOURCE_NAME: React.CSSProperties = { fontSize: typography.sizes.md.fontSize, fontWeight: 600, color: colors.textPrimary };
const RATE_VAL: React.CSSProperties = { fontSize: typography.sizes.md.fontSize, fontWeight: 600, color: colors.success };
const CALL_COUNT: React.CSSProperties = { fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary };
const NO_DATA: React.CSSProperties = { fontSize: typography.sizes.sm.fontSize, color: colors.textMuted };
const TREND_ROW: React.CSSProperties = { display: "flex", alignItems: "center", gap: 4, marginTop: spacing[1] };
const STATS_ROW: React.CSSProperties = { display: "flex", alignItems: "center", gap: spacing[4], marginTop: spacing[2] };

/* -- Component -- */

export default function BestSourceCard({ recommendation }: BestSourceCardProps) {
  return (
    <div style={CARD_WRAP}>
      <div style={TITLE_LBL}>BEST SOURCE RIGHT NOW</div>
      {recommendation === null ? (
        <div style={NO_DATA}>Not enough data for this hour. Try expanding the date range.</div>
      ) : (
        <>
          <div style={SOURCE_NAME}>{recommendation.leadSourceName}</div>
          <div style={STATS_ROW}>
            <span style={RATE_VAL}>
              <AnimatedNumber value={+(recommendation.closeRate * 100).toFixed(1)} decimals={1} suffix="%" />
            </span>
            <span style={CALL_COUNT}>{recommendation.calls} calls this hour</span>
          </div>
          {recommendation.trend === "up" && recommendation.trendDelta != null && (
            <div style={TREND_ROW}>
              <TrendingUp size={14} style={{ color: colors.success }} />
              <span style={{ fontSize: typography.sizes.sm.fontSize, color: colors.success }}>
                +{(recommendation.trendDelta * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {recommendation.trend === "down" && recommendation.trendDelta != null && (
            <div style={TREND_ROW}>
              <TrendingDown size={14} style={{ color: colors.danger }} />
              <span style={{ fontSize: typography.sizes.sm.fontSize, color: colors.danger }}>
                {(recommendation.trendDelta * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
