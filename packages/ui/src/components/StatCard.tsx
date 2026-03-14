"use client";

import React from "react";
import { colors, radius } from "../tokens";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  accent?: string;
  trend?: { value: number; direction: "up" | "down" | "flat" };
  className?: string;
  style?: React.CSSProperties;
}

function ArrowUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent,
  trend,
  className,
  style,
}: StatCardProps) {
  const accentColor = accent ?? colors.primary500;

  const cardStyle: React.CSSProperties = {
    background: colors.bgSurface,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: radius.xl,
    padding: 24,
    position: "relative",
    ...style,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 8,
    display: "block",
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 28,
    fontWeight: 800,
    color: colors.textPrimary,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
  };

  const iconWrapStyle: React.CSSProperties = {
    position: "absolute",
    top: 20,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: "50%",
    background: `${accentColor}1f`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: accentColor,
  };

  const trendColor =
    trend?.direction === "up"
      ? colors.success
      : trend?.direction === "down"
      ? colors.danger
      : colors.textTertiary;

  const trendStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    fontSize: 12,
    fontWeight: 600,
    color: trendColor,
    marginTop: 6,
  };

  return (
    <div
      className={["animate-fade-in-up", className].filter(Boolean).join(" ")}
      style={cardStyle}
    >
      {icon && (
        <div style={iconWrapStyle}>
          {icon}
        </div>
      )}
      <span style={labelStyle}>{label}</span>
      <div style={valueStyle}>{value}</div>
      {trend && (
        <div style={trendStyle}>
          {trend.direction === "up" && <ArrowUpIcon />}
          {trend.direction === "down" && <ArrowDownIcon />}
          {trend.direction === "flat" && <MinusIcon />}
          {trend.value !== 0 && `${Math.abs(trend.value)}%`}
          {trend.direction === "flat" && "No change"}
        </div>
      )}
    </div>
  );
}
