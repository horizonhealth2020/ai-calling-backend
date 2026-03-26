"use client";
import React, { useState, useRef, useCallback } from "react";
import { colors, spacing, radius, typography, shadows, baseInputStyle } from "@ops/ui";

/* -- Types -- */

interface HeatmapCell {
  hour: number;
  groupVal: number;
  calls: number;
  sales: number;
  closeRate: number;
}

interface LeadTimingHeatmapProps {
  data: {
    sources: {
      leadSourceId: string;
      leadSourceName: string;
      cells: HeatmapCell[];
    }[];
    groupBy: "dow" | "wom" | "moy";
  } | null;
  groupBy: "dow" | "wom" | "moy";
  onGroupByChange: (g: "dow" | "wom" | "moy") => void;
}

/* -- Heatmap color function -- */

function heatmapColor(closeRate: number, calls: number): React.CSSProperties {
  if (calls === 0) return { backgroundColor: "rgba(255,255,255,0.03)" };
  const base = closeRate >= 0.15
    ? "rgba(34,197,94,0.50)"
    : closeRate >= 0.10
    ? "rgba(34,197,94,0.30)"
    : closeRate >= 0.05
    ? "rgba(234,179,8,0.30)"
    : "rgba(239,68,68,0.25)";
  return { backgroundColor: base, opacity: calls < 10 ? 0.3 : 1.0 };
}

/* -- Hour labels -- */

const HOUR_LABELS: string[] = [];
for (let h = 0; h < 24; h++) {
  const hr12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const suffix = h < 12 ? "a" : "p";
  HOUR_LABELS.push(`${hr12}${suffix}`);
}

/* -- Style constants -- */

const SUBSECTION_LBL: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: typography.tracking.caps, color: colors.textTertiary, marginBottom: spacing[2] };
const CONTROLS_ROW: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing[4] };
const GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: "120px repeat(24, 1fr)", gap: 2 };
const SOURCE_LABEL: React.CSSProperties = { fontSize: 13, color: colors.textSecondary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120, display: "flex", alignItems: "center" };
const HOUR_LABEL_STYLE: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: colors.textTertiary, textAlign: "center" };
const CELL: React.CSSProperties = { minWidth: 36, minHeight: 36, borderRadius: 4, cursor: "pointer", transition: "outline 150ms" };
const NO_DATA_MSG: React.CSSProperties = { textAlign: "center", color: colors.textMuted, fontSize: 13, padding: spacing[6] };
const GRID_WRAP: React.CSSProperties = { position: "relative", overflowX: "auto", overflowY: "visible" };

/* -- Component -- */

export default function LeadTimingHeatmap({ data, groupBy, onGroupByChange }: LeadTimingHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; cell: HeatmapCell } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const handleCellEnter = useCallback((e: React.MouseEvent<HTMLDivElement>, cell: HeatmapCell) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const cellRect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: cellRect.left - rect.left + cellRect.width / 2,
      y: cellRect.top - rect.top,
      cell,
    });
  }, []);

  const handleCellLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const isEmpty = !data || data.sources.length === 0 || data.sources.every(s => s.cells.length === 0);

  if (isEmpty) {
    return (
      <div>
        <div style={CONTROLS_ROW}>
          <div style={SUBSECTION_LBL}>CLOSE RATE HEATMAP</div>
          <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
            <span style={{ fontSize: 11, color: colors.textTertiary }}>Group by</span>
            <select
              value={groupBy}
              onChange={e => onGroupByChange(e.target.value as "dow" | "wom" | "moy")}
              style={{ ...baseInputStyle, padding: "4px 8px", fontSize: 13, width: "auto" }}
            >
              <option value="dow">Day of Week</option>
              <option value="wom">Week of Month</option>
              <option value="moy">Month of Year</option>
            </select>
          </div>
        </div>
        <div style={NO_DATA_MSG}>No call data found for this date range. Adjust filters or check that the Convoso poller is running.</div>
      </div>
    );
  }

  // Build a lookup for each source: hour -> cell
  const sourceCellMaps = data.sources.map(src => {
    const map = new Map<number, HeatmapCell>();
    for (const c of src.cells) map.set(c.hour, c);
    return { ...src, cellMap: map };
  });

  return (
    <div>
      <div style={CONTROLS_ROW}>
        <div style={SUBSECTION_LBL}>CLOSE RATE HEATMAP</div>
        <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
          <span style={{ fontSize: 11, color: colors.textTertiary }}>Group by</span>
          <select
            value={groupBy}
            onChange={e => onGroupByChange(e.target.value as "dow" | "wom" | "moy")}
            style={{ ...baseInputStyle, padding: "4px 8px", fontSize: 13, width: "auto" }}
          >
            <option value="dow">Day of Week</option>
            <option value="wom">Week of Month</option>
            <option value="moy">Month of Year</option>
          </select>
        </div>
      </div>

      <div style={GRID_WRAP} ref={gridRef}>
        <div style={GRID} role="grid" aria-label="Close rate heatmap by lead source and hour">
          {/* Header row: empty corner + hour labels */}
          <div />
          {HOUR_LABELS.map((label, h) => (
            <div
              key={h}
              style={{
                ...HOUR_LABEL_STYLE,
                borderBottom: h >= 8 && h <= 20 ? "1px solid rgba(255,255,255,0.06)" : undefined,
              }}
            >
              {label}
            </div>
          ))}

          {/* Data rows */}
          {sourceCellMaps.map(src => (
            <React.Fragment key={src.leadSourceId}>
              <div style={SOURCE_LABEL} title={src.leadSourceName}>{src.leadSourceName}</div>
              {Array.from({ length: 24 }, (_, h) => {
                const cell = src.cellMap.get(h);
                const c: HeatmapCell = cell ?? { hour: h, groupVal: 0, calls: 0, sales: 0, closeRate: 0 };
                const colorStyle = heatmapColor(c.closeRate, c.calls);
                return (
                  <div
                    key={h}
                    style={{ ...CELL, ...colorStyle }}
                    onMouseEnter={e => handleCellEnter(e, c)}
                    onMouseLeave={handleCellLeave}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y - 80,
            background: colors.bgSurfaceOverlay,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: radius.md,
            padding: spacing[2],
            boxShadow: shadows.md,
            zIndex: 50,
            pointerEvents: "none",
            transform: "translateX(-50%)",
          }}>
            <div style={{ fontSize: 13, color: colors.textPrimary, fontWeight: 600 }}>Close rate: {(tooltip.cell.closeRate * 100).toFixed(1)}%</div>
            <div style={{ fontSize: 13, color: colors.textSecondary }}>Calls: {tooltip.cell.calls}</div>
            <div style={{ fontSize: 13, color: colors.textSecondary }}>Sales: {tooltip.cell.sales}</div>
            {tooltip.cell.calls < 10 && tooltip.cell.calls > 0 && (
              <div style={{ fontSize: 11, color: colors.textMuted, fontStyle: "italic" }}>(low sample size)</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
