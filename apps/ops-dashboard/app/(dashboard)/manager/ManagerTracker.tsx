"use client";
import React, { useState, useEffect } from "react";
import {
  Badge,
  Card,
  AnimatedNumber,
  EmptyState,
  DateRangeFilter,
  KPI_PRESETS,
  colors,
  spacing,
  radius,
  baseThStyle,
  baseTdStyle,
} from "@ops/ui";
import type { DateRangeFilterValue } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { useDateRange } from "@/lib/DateRangeContext";
import { HIGHLIGHT_GLOW } from "@ops/socket";
import {
  Trophy,
  Medal,
  Award,
  BarChart3,
  Download,
} from "lucide-react";

/* -- Types -- */

type TrackerEntry = { agent: string; salesCount: number; premiumTotal: number; totalLeadCost: number; costPerSale: number; commissionTotal: number };
type CallCount = { agentId: string; agentName: string; leadSourceId: string; leadSourceName: string; callCount: number; totalLeadCost: number };

export interface ManagerTrackerProps {
  API: string;
  tracker: TrackerEntry[];
  setTracker: React.Dispatch<React.SetStateAction<TrackerEntry[]>>;
  highlightedAgentNames: Set<string>;
}

/* -- Style constants -- */

const PODIUM_BORDERS = [
  `3px solid ${colors.gold}`,
  `3px solid ${colors.silver}`,
  `3px solid ${colors.bronze}`,
];

/* -- Helpers -- */

function buildDateParams(filter: DateRangeFilterValue): string {
  if (filter.preset === "custom" && filter.from && filter.to) {
    return `from=${filter.from}&to=${filter.to}`;
  }
  if (filter.preset !== "custom") {
    return `range=${filter.preset}`;
  }
  return "";
}

function exportAgentPerformanceCSV(tracker: TrackerEntry[]) {
  const esc = (v: string) => v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
  const rows: string[][] = [["Agent", "Sales Count", "Commission Earned", "Premium Total", "Lead Cost", "Cost Per Sale"]];
  for (const t of tracker) {
    rows.push([
      esc(t.agent),
      String(t.salesCount),
      t.commissionTotal.toFixed(2),
      t.premiumTotal.toFixed(2),
      t.totalLeadCost.toFixed(2),
      t.costPerSale.toFixed(2),
    ]);
  }
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })),
    download: "agent-performance.csv",
  });
  a.click();
}

/* -- Section header helper -- */

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: spacing[5] }}>
      <div style={{ color: colors.primary400 }}>{icon}</div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>{title}</h3>
      {count !== undefined && (
        <Badge color={colors.primary400} variant="subtle" size="sm">{count}</Badge>
      )}
    </div>
  );
}

/* -- Component -- */

export default function ManagerTracker({ API, tracker, setTracker, highlightedAgentNames }: ManagerTrackerProps) {
  const { value: dateRangeCtx, onChange: setDateRangeCtx } = useDateRange();
  const [callCounts, setCallCounts] = useState<CallCount[]>([]);
  const [, setCallCountsLoaded] = useState(false);
  const [convosoConfigured, setConvosoConfigured] = useState(false);

  useEffect(() => {
    const dp = buildDateParams(dateRangeCtx);
    authFetch(`${API}/api/call-counts${dp ? `?${dp}` : "?range=week"}`).then(r => r.ok ? r.json() : []).then(setCallCounts).catch(() => {});
    setCallCountsLoaded(true);
  }, [API, dateRangeCtx]);

  // Re-fetch tracker data when date range changes
  useEffect(() => {
    const dp = buildDateParams(dateRangeCtx);
    const url = `${API}/api/tracker/summary${dp ? `?${dp}` : ""}`;
    authFetch(url).then(r => r.ok ? r.json() : { agents: [] }).then(data => { setTracker(data.agents ?? []); setConvosoConfigured(!!data.convosoConfigured); }).catch(() => {});
  }, [API, dateRangeCtx, setTracker]);

  const callCountByAgent = new Map<string, number>();
  for (const cc of callCounts) {
    callCountByAgent.set(cc.agentName, (callCountByAgent.get(cc.agentName) ?? 0) + cc.callCount);
  }
  const sorted = [...tracker].sort((a, b) => b.salesCount - a.salesCount);

  return (
    <>
    <Card className="animate-fade-in">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing[5] }}>
        <SectionHeader icon={<Trophy size={18} />} title="Agent Performance" count={sorted.length} />
        <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
          <DateRangeFilter value={dateRangeCtx} onChange={setDateRangeCtx} presets={KPI_PRESETS} />
          <button
            onClick={() => exportAgentPerformanceCSV(tracker)}
            style={{
              padding: "6px 14px", borderRadius: radius.md, border: `1px solid ${colors.borderDefault}`,
              background: colors.bgSurface, color: colors.textSecondary, fontSize: 12, fontWeight: 600,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Rank", "Agent", "Calls", "Sales", "Premium Total", "Lead Spend", "Cost / Sale"].map((h, i) => (
                <th key={h} style={{ ...baseThStyle, textAlign: i >= 2 ? "right" : "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const agentCalls = callCountByAgent.get(row.agent) ?? 0;
              const isTop = i < 3;
              const rankIcon = i === 0 ? <Trophy size={15} color={colors.gold} /> : i === 1 ? <Medal size={15} color={colors.silver} /> : i === 2 ? <Award size={15} color={colors.bronze} /> : null;
              return (
                <tr
                  key={row.agent}
                  className={`animate-fade-in-up stagger-${Math.min(i + 1, 10)} row-hover`}
                  style={{
                    borderLeft: PODIUM_BORDERS[i] ?? "3px solid transparent",
                    background: isTop ? `rgba(${i === 0 ? "251,191,36" : i === 1 ? "148,163,184" : "205,127,50"},0.03)` : "transparent",
                    transition: "box-shadow 1.5s ease-out",
                    ...(highlightedAgentNames.has(row.agent) ? HIGHLIGHT_GLOW : {}),
                  }}
                >
                  <td style={{ ...baseTdStyle, fontWeight: 700 }}>
                    {rankIcon ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {rankIcon}
                        {i < 3 && (
                          <Badge
                            color={i === 0 ? colors.gold : i === 1 ? colors.silver : colors.bronze}
                            variant="subtle"
                            size="sm"
                          >
                            #{i + 1}
                          </Badge>
                        )}
                      </span>
                    ) : (
                      <span style={{ color: colors.textMuted }}>#{i + 1}</span>
                    )}
                  </td>
                  <td style={{ ...baseTdStyle, fontWeight: isTop ? 700 : 500, color: isTop ? colors.textPrimary : colors.textSecondary, fontSize: isTop ? 14 : 13 }}>
                    {row.agent}
                  </td>
                  <td style={{ ...baseTdStyle, textAlign: "right", color: colors.primary400, fontWeight: 600 }}>
                    {agentCalls ? <AnimatedNumber value={agentCalls} /> : <span style={{ color: colors.textMuted }}>{"\u2014"}</span>}
                  </td>
                  <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: isTop ? 700 : 400, color: colors.textPrimary }}>
                    <AnimatedNumber value={row.salesCount} />
                  </td>
                  <td style={{ ...baseTdStyle, textAlign: "right" }}>
                    <span style={{ fontWeight: 800, fontSize: isTop ? 16 : 14, background: "linear-gradient(135deg, #34d399, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties}>
                      <AnimatedNumber value={Number(row.premiumTotal)} prefix="$" decimals={2} />
                    </span>
                  </td>
                  <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: 600 }}>
                    {!convosoConfigured
                      ? <span style={{ color: colors.textMuted }}>{"\u2014"}</span>
                      : row.totalLeadCost > 0
                        ? <span style={{ color: colors.textPrimary }}>${Number(row.totalLeadCost).toFixed(2)}</span>
                        : <span style={{ color: colors.textSecondary }}>$0.00</span>}
                  </td>
                  <td style={{ ...baseTdStyle, textAlign: "right", color: colors.warning, fontWeight: 600 }}>
                    {!convosoConfigured
                      ? <span style={{ color: colors.textMuted }}>{"\u2014"}</span>
                      : row.salesCount > 0 && row.totalLeadCost > 0
                        ? <span style={{ color: colors.textPrimary }}>${Number(row.costPerSale).toFixed(2)}</span>
                        : <span style={{ color: colors.textMuted }}>{"\u2014"}</span>}
                  </td>
                </tr>
              );
            })}
            {tracker.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState icon={<BarChart3 size={32} />} title="No sales data yet" description="Sales will appear here once agents submit entries." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
    </>
  );
}
