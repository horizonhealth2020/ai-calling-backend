"use client";

import React, { useState } from "react";
import { colors, radius, shadows } from "../tokens";

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
}

const OFFSET = 8;

function getPositionStyles(position: NonNullable<TooltipProps["position"]>): React.CSSProperties {
  switch (position) {
    case "top":
      return {
        bottom: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginBottom: OFFSET,
      };
    case "bottom":
      return {
        top: "100%",
        left: "50%",
        transform: "translateX(-50%)",
        marginTop: OFFSET,
      };
    case "left":
      return {
        right: "100%",
        top: "50%",
        transform: "translateY(-50%)",
        marginRight: OFFSET,
      };
    case "right":
      return {
        left: "100%",
        top: "50%",
        transform: "translateY(-50%)",
        marginLeft: OFFSET,
      };
  }
}

export function Tooltip({
  content,
  children,
  position = "top",
}: TooltipProps) {
  const [visible, setVisible] = useState(false);

  const wrapStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  };

  const tooltipStyle: React.CSSProperties = {
    position: "absolute",
    background: colors.bgSurfaceOverlay,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: radius.sm,
    boxShadow: shadows.md,
    fontSize: 12,
    color: colors.textSecondary,
    padding: "6px 10px",
    whiteSpace: "nowrap",
    zIndex: 1000,
    pointerEvents: "none",
    ...getPositionStyles(position),
  };

  return (
    <span
      style={wrapStyle}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span className="animate-fade-in" style={tooltipStyle} role="tooltip">
          {content}
        </span>
      )}
    </span>
  );
}
