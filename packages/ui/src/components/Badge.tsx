"use client";

import React from "react";
import { radius } from "../tokens";

interface BadgeProps {
  children: React.ReactNode;
  color: string;
  variant?: "solid" | "outline" | "subtle";
  size?: "sm" | "md";
  dot?: boolean;
}

const SIZE_STYLES: Record<NonNullable<BadgeProps["size"]>, React.CSSProperties> = {
  sm: { fontSize: 10, padding: "2px 6px" },
  md: { fontSize: 11, padding: "3px 8px" },
};

function hexToRgba(hex: string, alpha: number): string {
  // Handle non-hex colors (rgba, named, etc.) by using the opacity hex suffix approach
  if (!hex.startsWith("#")) return hex;
  const cleaned = hex.replace("#", "");
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function Badge({
  children,
  color,
  variant = "subtle",
  size = "sm",
  dot = false,
}: BadgeProps) {
  const variantStyles: React.CSSProperties =
    variant === "solid"
      ? { background: color, color: "#ffffff" }
      : variant === "outline"
      ? { background: "transparent", color, border: `1px solid ${color}` }
      : {
          background: hexToRgba(color, 0.15),
          color,
        };

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    borderRadius: radius.full,
    fontWeight: 600,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
    lineHeight: 1,
    ...SIZE_STYLES[size],
    ...variantStyles,
  };

  const dotStyle: React.CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: variant === "solid" ? "rgba(255,255,255,0.85)" : color,
    flexShrink: 0,
  };

  return (
    <span style={baseStyle}>
      {dot && <span style={dotStyle} />}
      {children}
    </span>
  );
}
