"use client";
import React from "react";
import { colors, spacing, typography, baseThStyle, baseTdStyle } from "@ops/ui";

/* -- Types -- */

interface LeadTimingSparklinesProps {
  data: {
    sources: {
      leadSourceId: string;
      leadSourceName: string;
      days: string[];
      dayparts: { morning: number[]; afternoon: number[]; evening: number[] };
    }[];
  } | null;
}

/* -- Sparkline SVG -- */

function Sparkline({ data, width = 80, height = 24 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 0.01);
  const hasData = data.some(v => v > 0);
  if (!hasData) {
    return (
      <svg width={width} height={height} style={{ display: "block" }}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={colors.textMuted} strokeWidth={2} strokeDasharray="4 4" />
      </svg>
    );
  }
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - (v / max) * height}`
  ).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={points} fill="none" stroke={colors.accentTeal} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* -- Style constants -- */

const SUBSECTION_LBL: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: typography.tracking.caps, color: colors.textTertiary, marginBottom: spacing[2] };
const TABLE_WRAP: React.CSSProperties = { overflowX: "auto" };
const NO_DATA_MSG: React.CSSProperties = { textAlign: "center", color: colors.textMuted, fontSize: 13, padding: spacing[6] };
const SOURCE_NAME_TD: React.CSSProperties = { ...baseTdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/* -- Component -- */

export default function LeadTimingSparklines({ data }: LeadTimingSparklinesProps) {
  const isEmpty = !data || data.sources.length === 0;

  return (
    <div>
      <div style={SUBSECTION_LBL}>7-DAY TRENDS BY DAYPART</div>
      {isEmpty ? (
        <div style={NO_DATA_MSG}>No trend data available for the last 7 days.</div>
      ) : (
        <div style={TABLE_WRAP}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...baseThStyle, width: 200 }}>Lead Source</th>
                <th style={{ ...baseThStyle, width: 120 }}>Morning 8a-12p</th>
                <th style={{ ...baseThStyle, width: 120 }}>Afternoon 12p-5p</th>
                <th style={{ ...baseThStyle, width: 120 }}>Evening 5p-9p</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map(src => (
                <tr key={src.leadSourceId}>
                  <td style={SOURCE_NAME_TD} title={src.leadSourceName}>{src.leadSourceName}</td>
                  <td style={baseTdStyle}><Sparkline data={src.dayparts.morning} /></td>
                  <td style={baseTdStyle}><Sparkline data={src.dayparts.afternoon} /></td>
                  <td style={baseTdStyle}><Sparkline data={src.dayparts.evening} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
