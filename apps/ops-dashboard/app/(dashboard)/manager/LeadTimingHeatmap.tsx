"use client";
import React, { useState, useRef, useCallback, useMemo } from "react";
import { colors, spacing, radius, typography, shadows, baseInputStyle, semanticColors, colorAlpha } from "@ops/ui";

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
    ? colorAlpha(semanticColors.statusRan, 0.50)
    : closeRate >= 0.10
    ? colorAlpha(semanticColors.statusRan, 0.30)
    : closeRate >= 0.05
    ? "rgba(234,179,8,0.30)"
    : colorAlpha(semanticColors.statusDead, 0.25);
  return { backgroundColor: base, opacity: calls < 10 ? 0.3 : 1.0 };
}

/* -- Business hours: 9am-9pm (12 columns) -- */

const START_HOUR = 9;
const END_HOUR = 21; // exclusive
const VISIBLE_HOURS: number[] = [];
for (let h = START_HOUR; h < END_HOUR; h++) VISIBLE_HOURS.push(h);

function hourLabel(h: number): string {
  const hr12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const suffix = h < 12 ? "a" : "p";
  return `${hr12}${suffix}`;
}

/* -- Group labels -- */

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WOM_LABELS = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5"];
const MOY_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getGroupLabels(groupBy: "dow" | "wom" | "moy"): { val: number; label: string }[] {
  if (groupBy === "dow") return DOW_LABELS.map((label, i) => ({ val: i, label }));
  if (groupBy === "wom") return WOM_LABELS.map((label, i) => ({ val: i + 1, label }));
  return MOY_LABELS.map((label, i) => ({ val: i + 1, label }));
}

/* -- Style constants -- */

const COLS = VISIBLE_HOURS.length; // 12
const SUBSECTION_LBL: React.CSSProperties = { fontSize: typography.sizes.xs.fontSize, fontWeight: 600, textTransform: "uppercase", letterSpacing: typography.tracking.caps, color: colors.textTertiary, marginBottom: spacing[2] };
const CONTROLS_ROW: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing[4] };
const GRID: React.CSSProperties = { display: "grid", gridTemplateColumns: `100px repeat(${COLS}, 1fr)`, gap: 2 };
const GROUP_HEADER: React.CSSProperties = {
  gridColumn: `1 / -1`,
  fontSize: typography.sizes.xs.fontSize,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: typography.tracking.caps,
  color: colors.accentTeal,
  padding: `${spacing[2]} 0 ${spacing[1]} 0`,
  borderBottom: `1px solid rgba(255,255,255,0.06)`,
};
const SOURCE_ROW_LABEL: React.CSSProperties = { fontSize: typography.sizes.xs.fontSize, color: colors.textSecondary, display: "flex", alignItems: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: spacing[2] };
const HOUR_LABEL_STYLE: React.CSSProperties = { fontSize: typography.sizes.xs.fontSize, fontWeight: 600, color: colors.textTertiary, textAlign: "center" };
const CELL: React.CSSProperties = { minHeight: 26, borderRadius: 3, cursor: "pointer", transition: "outline 150ms" };
const NO_DATA_MSG: React.CSSProperties = { textAlign: "center", color: colors.textMuted, fontSize: typography.sizes.sm.fontSize, padding: spacing[6] };
const GRID_WRAP: React.CSSProperties = { position: "relative", overflowX: "auto", overflowY: "visible" };
const SELECT_STYLE: React.CSSProperties = { ...baseInputStyle, padding: "4px 8px", fontSize: typography.sizes.sm.fontSize, width: "auto" };

/* -- Component -- */

export default function LeadTimingHeatmap({ data, groupBy, onGroupByChange }: LeadTimingHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; cell: HeatmapCell; groupLabel: string; sourceName: string } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const handleCellEnter = useCallback((e: React.MouseEvent<HTMLDivElement>, cell: HeatmapCell, groupLabel: string, sourceName: string) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const cellRect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      x: cellRect.left - rect.left + cellRect.width / 2,
      y: cellRect.top - rect.top,
      cell,
      groupLabel,
      sourceName,
    });
  }, []);

  const handleCellLeave = useCallback(() => setTooltip(null), []);

  const isEmpty = !data || data.sources.length === 0 || data.sources.every(s => s.cells.length === 0);
  const groupLabels = getGroupLabels(groupBy);

  // Build cell maps per source: "groupVal:hour" -> HeatmapCell
  const sourceCellMaps = useMemo(() => {
    if (!data) return [];
    return data.sources.map(src => {
      const map = new Map<string, HeatmapCell>();
      for (const c of src.cells) {
        const k = `${c.groupVal}:${c.hour}`;
        const existing = map.get(k);
        if (existing) {
          const calls = existing.calls + c.calls;
          const sales = existing.sales + c.sales;
          map.set(k, { ...c, calls, sales, closeRate: calls > 0 ? sales / calls : 0 });
        } else {
          map.set(k, { ...c });
        }
      }
      return { ...src, cellMap: map };
    });
  }, [data]);

  const controlsBlock = (
    <div style={CONTROLS_ROW}>
      <div style={SUBSECTION_LBL}>CLOSE RATE HEATMAP</div>
      <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
        <span style={{ fontSize: typography.sizes.xs.fontSize, color: colors.textTertiary }}>Group by</span>
        <select
          value={groupBy}
          onChange={e => onGroupByChange(e.target.value as "dow" | "wom" | "moy")}
          style={SELECT_STYLE}
        >
          <option value="dow">Day of Week</option>
          <option value="wom">Week of Month</option>
          <option value="moy">Month of Year</option>
        </select>
      </div>
    </div>
  );

  if (isEmpty) {
    return (
      <div>
        {controlsBlock}
        <div style={NO_DATA_MSG}>No call data found for this date range. Adjust filters or check that the Convoso poller is running.</div>
      </div>
    );
  }

  return (
    <div>
      {controlsBlock}

      <div style={GRID_WRAP} ref={gridRef}>
        <div style={GRID} role="grid" aria-label="Close rate heatmap">
          {/* Header row: label column + hour labels */}
          <div />
          {VISIBLE_HOURS.map(h => (
            <div key={h} style={HOUR_LABEL_STYLE}>{hourLabel(h)}</div>
          ))}

          {/* Grouped rows: section header per groupVal, source rows underneath */}
          {groupLabels.map(({ val, label }) => (
            <React.Fragment key={val}>
              {/* Section header spanning full width */}
              <div style={GROUP_HEADER}>{label}</div>

              {/* One row per lead source */}
              {sourceCellMaps.map(src => (
                <React.Fragment key={`${val}-${src.leadSourceId}`}>
                  <div style={SOURCE_ROW_LABEL} title={src.leadSourceName}>{src.leadSourceName}</div>
                  {VISIBLE_HOURS.map(h => {
                    const cell = src.cellMap.get(`${val}:${h}`);
                    const c: HeatmapCell = cell ?? { hour: h, groupVal: val, calls: 0, sales: 0, closeRate: 0 };
                    const colorStyle = heatmapColor(c.closeRate, c.calls);
                    return (
                      <div
                        key={h}
                        style={{ ...CELL, ...colorStyle }}
                        onMouseEnter={e => handleCellEnter(e, c, label, src.leadSourceName)}
                        onMouseLeave={handleCellLeave}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: "absolute",
            left: tooltip.x,
            top: tooltip.y - 110,
            background: colors.bgSurfaceOverlay,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: radius.md,
            padding: `${spacing[2]} ${spacing[3]}`,
            boxShadow: shadows.md,
            zIndex: 50,
            pointerEvents: "none",
            transform: "translateX(-50%)",
            minWidth: 150,
          }}>
            <div style={{ fontSize: typography.sizes.xs.fontSize, color: colors.textTertiary, marginBottom: 2 }}>{tooltip.sourceName}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 2 }}>{tooltip.groupLabel} &middot; {hourLabel(tooltip.cell.hour)}</div>
            <div style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textPrimary, fontWeight: 600 }}>Close rate: {(tooltip.cell.closeRate * 100).toFixed(1)}%</div>
            <div style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary }}>Calls: {tooltip.cell.calls}</div>
            <div style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary }}>Sales: {tooltip.cell.sales}</div>
            {tooltip.cell.calls < 10 && tooltip.cell.calls > 0 && (
              <div style={{ fontSize: typography.sizes.xs.fontSize, color: colors.textMuted, fontStyle: "italic" }}>(low sample size)</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
