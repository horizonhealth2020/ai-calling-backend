"use client";

import React from "react";
import { colors, radius } from "../tokens";

const SHIMMER_BG =
  "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)";

/* ── SkeletonLine ──────────────────────────────────────────────── */

interface SkeletonLineProps {
  height?: number | string;
  width?: number | string;
}

export function SkeletonLine({ height = 14, width = "100%" }: SkeletonLineProps) {
  const style: React.CSSProperties = {
    height,
    width,
    borderRadius: radius.sm,
    background: SHIMMER_BG,
    backgroundSize: "200% 100%",
    display: "block",
  };

  return <span className="animate-shimmer" style={style} />;
}

/* ── SkeletonCard ──────────────────────────────────────────────── */

interface SkeletonCardProps {
  height?: number | string;
}

export function SkeletonCard({ height }: SkeletonCardProps) {
  const cardStyle: React.CSSProperties = {
    background: colors.bgSurface,
    border: `1px solid ${colors.borderDefault}`,
    borderRadius: radius.xl,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    height,
  };

  return (
    <div style={cardStyle}>
      <SkeletonLine height={18} width="55%" />
      <SkeletonLine height={12} width="80%" />
      <SkeletonLine height={12} width="65%" />
      <SkeletonLine height={12} width="70%" />
    </div>
  );
}

/* ── SkeletonTable ─────────────────────────────────────────────── */

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
  };

  const headerCellStyle: React.CSSProperties = {
    padding: "10px 12px",
    borderBottom: `1px solid ${colors.borderDefault}`,
  };

  const bodyCellStyle: React.CSSProperties = {
    padding: "12px 12px",
    borderBottom: `1px solid ${colors.borderSubtle}`,
  };

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} style={headerCellStyle}>
              <SkeletonLine height={12} width={i === 0 ? "70%" : "50%"} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <tr key={rowIdx}>
            {Array.from({ length: columns }).map((_, colIdx) => (
              <td key={colIdx} style={bodyCellStyle}>
                <SkeletonLine
                  height={13}
                  width={colIdx === 0 ? "75%" : `${50 + ((rowIdx + colIdx) % 3) * 10}%`}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
