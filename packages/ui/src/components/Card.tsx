"use client";

import React from "react";
import { colors, radius, shadows } from "../tokens";

interface CardProps {
  children: React.ReactNode;
  variant?: "default" | "raised" | "inset" | "interactive";
  accent?: string;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  style?: React.CSSProperties;
}

const PADDING_MAP: Record<NonNullable<CardProps["padding"]>, number | string> = {
  none: 0,
  sm: 12,
  md: 24,
  lg: 32,
};

export function Card({
  children,
  variant = "default",
  accent,
  className,
  padding = "md",
  style,
}: CardProps) {
  const base: React.CSSProperties = {
    borderRadius: radius.xl,
    border: `1px solid ${colors.borderDefault}`,
    padding: PADDING_MAP[padding],
    position: "relative",
    overflow: "hidden",
  };

  const variantStyles: Record<NonNullable<CardProps["variant"]>, React.CSSProperties> = {
    default: {
      background: colors.bgSurface,
    },
    raised: {
      background: colors.bgSurfaceRaised,
      boxShadow: shadows.md,
    },
    inset: {
      background: colors.bgSurfaceInset,
    },
    interactive: {
      background: colors.bgSurface,
      cursor: "pointer",
    },
  };

  const accentStyle: React.CSSProperties = accent
    ? { borderLeft: `3px solid ${accent}` }
    : {};

  const interactiveClasses =
    variant === "interactive" ? "hover-lift hover-glow-primary" : "";

  const composedStyle: React.CSSProperties = {
    ...base,
    ...variantStyles[variant],
    ...accentStyle,
    ...style,
  };

  return (
    <div
      className={[interactiveClasses, className].filter(Boolean).join(" ")}
      style={composedStyle}
    >
      {children}
    </div>
  );
}
