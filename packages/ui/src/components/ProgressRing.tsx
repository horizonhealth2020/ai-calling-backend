"use client";

import React from "react";
import { colors } from "../tokens";

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function ProgressRing({
  progress,
  size = 40,
  strokeWidth = 3,
  color = colors.primary500,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, progress));
  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ display: "block", transform: "rotate(-90deg)" }}
      aria-label={`Progress: ${Math.round(clamped)}%`}
      role="img"
    >
      {/* Track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={colors.borderSubtle}
        strokeWidth={strokeWidth}
      />
      {/* Progress */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: "stroke-dashoffset 400ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </svg>
  );
}
