"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  DateRangeFilter,
  KPI_PRESETS,
  Badge,
  colors,
  spacing,
  radius,
  baseThStyle,
  baseTdStyle,
  baseInputStyle,
  baseCardStyle,
  semanticColors,
  colorAlpha,
  typography,
} from "@ops/ui";
import type { DateRangeFilterValue } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar } from "@ops/utils";

/* -- Types -- */

type ResolvedItem = {
  type: "chargeback" | "pending_term";
  agentName: string;
  memberName: string;
  resolvedAt: string;
  resolvedByName: string;
  resolutionNote: string | null;
  resolutionType: string | null;
  originalAmount: number;
};

interface CSResolvedLogProps {
  API: string;
}

/* -- TruncatedNote helper -- */

function TruncatedNote({ text, maxLength = 80 }: { text: string | null; maxLength?: number }) {
  const [expanded, setExpanded] = useState(false);

  if (text === null) {
    return <span style={{ color: colors.textMuted }} aria-label="No data">{"\u2014"}</span>;
  }

  if (text.length <= maxLength) {
    return <span>{text}</span>;
  }

  return (
    <span
      style={{ cursor: "pointer" }}
      aria-expanded={expanded}
      title={expanded ? "Click to collapse" : "Click to expand"}
      onClick={() => setExpanded(!expanded)}
    >
      {expanded ? text : text.slice(0, maxLength) + "..."}
    </span>
  );
}

/* -- Badge colors -- */

const TYPE_BADGE_COLORS: Record<ResolvedItem["type"], { color: string; background: string }> = {
  chargeback: { color: semanticColors.dangerLight, background: colorAlpha(semanticColors.dangerLight, 0.08) },
  pending_term: { color: semanticColors.statusPending, background: colorAlpha(semanticColors.statusPending, 0.08) },
};

/* -- Component -- */

export default function CSResolvedLog({ API }: CSResolvedLogProps) {
  const [items, setItems] = useState<ResolvedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "chargeback" | "pending_term">("all");
  const [dateRange, setDateRange] = useState<DateRangeFilterValue>({ preset: "30d" });
  const [agentFilter, setAgentFilter] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (agent: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (dateRange.preset === "custom" && dateRange.from && dateRange.to) {
        params.set("from", dateRange.from);
        params.set("to", dateRange.to);
      } else if (dateRange.preset && dateRange.preset !== "custom") {
        params.set("range", dateRange.preset);
      }
      if (agent.trim()) params.set("agentName", agent.trim());

      const qs = params.toString();
      const res = await authFetch(`${API}/api/reps/resolved-log${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? `Request failed (${res.status})`);
        setItems([]);
        return;
      }
      const data: ResolvedItem[] = await res.json();
      setItems(data);
    } catch {
      setError("Failed to fetch resolved log");
    } finally {
      setLoading(false);
    }
  }, [API, typeFilter, dateRange]);

  // Fetch on mount and when typeFilter or dateRange changes (immediate)
  useEffect(() => {
    fetchData(agentFilter);
  }, [fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce agentFilter changes by 300ms
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      fetchData(agentFilter);
    }, 300);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [agentFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasFilters = typeFilter !== "all" || agentFilter.trim() !== "" || dateRange.preset !== "30d";

  return (
    <div style={baseCardStyle}>
      {/* Filter bar */}
      <div className="stack-mobile gap-mobile-sm" style={{ display: "flex", gap: spacing[3], marginBottom: spacing[4], flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <select
            style={{ ...baseInputStyle, minWidth: 160, width: "auto" }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | "chargeback" | "pending_term")}
          >
            <option value="all">All Types</option>
            <option value="chargeback">Chargebacks</option>
            <option value="pending_term">Pending Terms</option>
          </select>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} presets={KPI_PRESETS} />
        <div>
          <input
            style={{ ...baseInputStyle, width: 200 }}
            placeholder="Filter by agent..."
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <p style={{ textAlign: "center", fontSize: typography.sizes.sm.fontSize, color: colors.textMuted }}>Loading...</p>
      )}

      {/* Error state */}
      {!loading && error && (
        <p style={{ fontSize: typography.sizes.sm.fontSize, color: semanticColors.dangerLight }}>{error}</p>
      )}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <p style={{ textAlign: "center", fontSize: typography.sizes.sm.fontSize, color: colors.textMuted }}>
          {hasFilters ? "No results match your filters." : "No resolved items found."}
        </p>
      )}

      {/* Table */}
      {!loading && !error && items.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="responsive-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th scope="col" style={{ ...baseThStyle, width: 120 }}>Type</th>
                <th scope="col" style={baseThStyle}>Agent</th>
                <th scope="col" style={baseThStyle}>Member</th>
                <th scope="col" style={{ ...baseThStyle, width: 140 }}>Resolution Date</th>
                <th scope="col" style={{ ...baseThStyle, width: 140 }}>Resolved By</th>
                <th scope="col" style={{ ...baseThStyle, flex: 1 }}>Resolution Note</th>
                <th scope="col" style={{ ...baseThStyle, width: 120, textAlign: "right" }}>Original Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const badgeColors = TYPE_BADGE_COLORS[item.type];
                return (
                  <tr key={i}>
                    <td data-label="Type" style={baseTdStyle}>
                      <Badge color={badgeColors.color} aria-label={item.type === "chargeback" ? "Chargeback" : "Pending Term"}>
                        {item.type === "chargeback" ? "Chargeback" : "Pending Term"}
                      </Badge>
                    </td>
                    <td data-label="Agent" style={baseTdStyle}>{item.agentName}</td>
                    <td data-label="Member" style={baseTdStyle}>{item.memberName}</td>
                    <td data-label="Resolution Date" style={baseTdStyle}>
                      {item.resolvedAt
                        ? new Date(item.resolvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : "\u2014"}
                    </td>
                    <td data-label="Resolved By" style={baseTdStyle}>{item.resolvedByName}</td>
                    <td data-label="Resolution Note" style={baseTdStyle}>
                      <TruncatedNote text={item.resolutionNote} />
                    </td>
                    <td data-label="Original Amount" style={{ ...baseTdStyle, textAlign: "right" }}>{formatDollar(item.originalAmount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
