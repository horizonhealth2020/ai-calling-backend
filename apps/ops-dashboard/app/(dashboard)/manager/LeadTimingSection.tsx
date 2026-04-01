"use client";
import React, { useState, useEffect } from "react";
import {
  DateRangeFilter,
  SkeletonCard,
  colors,
  spacing,
  radius,
  typography,
  baseCardStyle,
  motion,
} from "@ops/ui";
import type { DateRangeFilterValue } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { Clock, ChevronDown } from "lucide-react";
import LeadTimingHeatmap from "./LeadTimingHeatmap";
import BestSourceCard from "./BestSourceCard";
import LeadTimingSparklines from "./LeadTimingSparklines";

/* -- Types -- */

type HeatmapCell = { hour: number; groupVal: number; calls: number; sales: number; closeRate: number };
type HeatmapSource = { leadSourceId: string; leadSourceName: string; cells: HeatmapCell[] };
type HeatmapData = { sources: HeatmapSource[]; groupBy: "dow" | "wom" | "moy" };

type SparklineSource = { leadSourceId: string; leadSourceName: string; days: string[]; dayparts: { morning: number[]; afternoon: number[]; evening: number[] } };
type SparklinesData = { sources: SparklineSource[] };

type Recommendation = {
  leadSourceId: string;
  leadSourceName: string;
  closeRate: number;
  calls: number;
  sales: number;
  trend: "up" | "down" | "flat" | null;
  trendDelta: number | null;
} | null;
type RecommendationData = { recommendation: Recommendation; currentHour: number; currentDow: number };

/* -- Presets -- */

const ANALYTICS_PRESETS = [
  { key: "7d", label: "Last Week" },
  { key: "30d", label: "Last 30 Days" },
  { key: "60d", label: "Last 60 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "custom", label: "Custom" },
];

/* -- Helpers -- */

function buildAnalyticsParams(filter: DateRangeFilterValue): string {
  if (filter.preset === "custom" && filter.from && filter.to) return `from=${filter.from}&to=${filter.to}`;
  if (filter.preset !== "custom") return `range=${filter.preset}`;
  return "";
}

/* -- Style constants -- */

const SECTION_WRAP: React.CSSProperties = { ...baseCardStyle, padding: spacing[6], marginTop: spacing[12] };
const HEADER_ROW: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" };
const HEADER_LEFT: React.CSSProperties = { display: "flex", alignItems: "center", gap: spacing[2] };
const HEADER_TITLE: React.CSSProperties = { fontSize: typography.sizes.lg.fontSize, fontWeight: 600, lineHeight: "1.4", color: colors.textPrimary };
const BODY: React.CSSProperties = { display: "flex", flexDirection: "column", gap: spacing[8], marginTop: spacing[4] };
const ERR: React.CSSProperties = { color: colors.danger, fontSize: typography.sizes.sm.fontSize, textAlign: "center", padding: spacing[6] };
const FILTER_ROW: React.CSSProperties = { marginTop: spacing[4], marginBottom: spacing[2] };

/* -- Component -- */

export interface LeadTimingSectionProps {
  API: string;
}

export default function LeadTimingSection({ API }: LeadTimingSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [analyticsRange, setAnalyticsRange] = useState<DateRangeFilterValue>({ preset: "30d" });
  const [groupBy, setGroupBy] = useState<"dow" | "wom" | "moy">("dow");
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [sparklinesData, setSparklinesData] = useState<SparklinesData | null>(null);
  const [recommendationData, setRecommendationData] = useState<RecommendationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    setError(null);
    const params = buildAnalyticsParams(analyticsRange);
    Promise.all([
      authFetch(`${API}/api/lead-timing/heatmap?${params}&groupBy=${groupBy}`).then(r => r.ok ? r.json() : null),
      authFetch(`${API}/api/lead-timing/sparklines?${params}`).then(r => r.ok ? r.json() : null),
      authFetch(`${API}/api/lead-timing/recommendation?${params}`).then(r => r.ok ? r.json() : null),
    ]).then(([hm, sp, rec]) => {
      setHeatmapData(hm);
      setSparklinesData(sp);
      setRecommendationData(rec);
    }).catch(() => setError("Failed to load timing analytics. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, [expanded, analyticsRange, groupBy, API]);

  const chevronStyle: React.CSSProperties = {
    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
    transition: `transform ${motion.duration.normal} ${motion.easing.out}`,
    color: expanded ? colors.accentTeal : colors.textTertiary,
  };

  return (
    <div style={SECTION_WRAP}>
      {/* Header */}
      <div style={HEADER_ROW} onClick={() => setExpanded(!expanded)}>
        <div style={HEADER_LEFT}>
          <Clock size={18} style={{ color: expanded ? colors.accentTeal : colors.textTertiary }} />
          <h3 style={HEADER_TITLE}>Lead Source Timing Analytics</h3>
        </div>
        <ChevronDown size={16} style={chevronStyle} />
      </div>

      {/* Body (expanded) */}
      {expanded && (
        <>
          {/* Date filter */}
          <div style={FILTER_ROW} onClick={e => e.stopPropagation()}>
            <DateRangeFilter
              presets={ANALYTICS_PRESETS}
              value={analyticsRange}
              onChange={setAnalyticsRange}
            />
          </div>

          {loading ? (
            <div style={BODY}>
              <SkeletonCard height={80} />
              <SkeletonCard height={200} />
              <SkeletonCard height={160} />
            </div>
          ) : error ? (
            <div style={ERR}>{error}</div>
          ) : (
            <div style={BODY}>
              <BestSourceCard recommendation={recommendationData?.recommendation ?? null} />
              <LeadTimingHeatmap data={heatmapData} groupBy={groupBy} onGroupByChange={setGroupBy} />
              <LeadTimingSparklines data={sparklinesData} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
