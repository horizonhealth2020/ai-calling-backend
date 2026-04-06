"use client";

import React, { useState } from "react";
import { Badge } from "@ops/ui";
import { colors, spacing, radius, motion, baseInputStyle } from "@ops/ui";
import { formatDollar } from "@ops/utils";
import { Search } from "lucide-react";
import type { SidebarAgent } from "./payroll-types";

const C = colors;
const S = spacing;

/* ── Props ──────────────────────────────────────────────────── */

interface AgentSidebarProps {
  salesAgents: SidebarAgent[];
  csAgents: SidebarAgent[];
  selectedAgent: string | null;
  onSelectAgent: (agentName: string) => void;
}

/* ── Style constants ────────────────────────────────────────── */

const SIDEBAR: React.CSSProperties = {
  width: 220,
  flexShrink: 0,
  borderRight: `1px solid ${C.borderSubtle}`,
  overflowY: "auto",
  background: C.bgSurfaceRaised,
  display: "flex",
  flexDirection: "column",
};

const SEARCH_WRAP: React.CSSProperties = {
  padding: S[3],
  borderBottom: `1px solid ${C.borderSubtle}`,
  position: "relative",
};

const SEARCH_INPUT: React.CSSProperties = {
  ...baseInputStyle,
  width: "100%",
  boxSizing: "border-box",
  fontSize: 13,
  padding: "8px 12px 8px 32px",
};

const SEARCH_ICON: React.CSSProperties = {
  position: "absolute",
  left: S[3] + 10,
  top: "50%",
  transform: "translateY(-50%)",
  color: C.textMuted,
  pointerEvents: "none",
};

const SECTION_HEADER: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: C.textTertiary,
  padding: `${S[2]}px ${S[4]}px`,
  marginTop: S[2],
};

const ROW: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  height: 40,
  padding: `0 ${S[4]}px`,
  cursor: "pointer",
  transition: `background ${motion.duration.fast} ${motion.easing.out}`,
  gap: S[1],
};

const ROW_SELECTED: React.CSSProperties = {
  ...ROW,
  background: C.bgSurfaceOverlay,
  borderLeft: `3px solid ${C.accentTeal}`,
  paddingLeft: S[4] - 3,
};

const TOP3_DOT: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: C.accentTeal,
  flexShrink: 0,
};

const NAME_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: C.textSecondary,
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const NAME_MUTED: React.CSSProperties = {
  ...NAME_STYLE,
  color: C.textMuted,
};

const EARNINGS_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 400,
  color: C.textTertiary,
  flexShrink: 0,
};

const DIVIDER: React.CSSProperties = {
  height: 1,
  background: C.borderSubtle,
  margin: `${S[2]}px 0`,
};

const NO_RESULTS: React.CSSProperties = {
  padding: S[4],
  fontSize: 13,
  color: C.textMuted,
  textAlign: "center",
};

/* ── Badge color mapping ────────────────────────────────────── */

const BADGE_MAP: Record<"paid" | "unpaid" | "partial", { color: string; label: string }> = {
  paid:    { color: C.success, label: "Paid" },
  unpaid:  { color: C.danger,  label: "Unpaid" },
  partial: { color: C.warning, label: "Partial" },
};

/* ── Component ──────────────────────────────────────────────── */

export function AgentSidebar({
  salesAgents,
  csAgents,
  selectedAgent,
  onSelectAgent,
}: AgentSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);

  const query = searchQuery.toLowerCase();
  const filteredSales = salesAgents.filter((a) =>
    a.agentName.toLowerCase().includes(query)
  );
  const filteredCS = csAgents.filter((a) =>
    a.agentName.toLowerCase().includes(query)
  );
  const noResults = filteredSales.length === 0 && filteredCS.length === 0;

  function renderRow(agent: SidebarAgent) {
    const isSelected = selectedAgent === agent.agentName;
    const isHovered = hoveredAgent === agent.agentName;
    const hasActivity = agent.activeCount > 0;

    const rowStyle: React.CSSProperties = isSelected
      ? ROW_SELECTED
      : {
          ...ROW,
          ...(isHovered ? { background: C.bgSurfaceOverlay } : {}),
        };

    return (
      <div
        key={agent.agentName}
        style={rowStyle}
        onClick={() => onSelectAgent(agent.agentName)}
        onMouseEnter={() => !isSelected && setHoveredAgent(agent.agentName)}
        onMouseLeave={() => setHoveredAgent(null)}
      >
        {agent.isTopEarner && <div style={TOP3_DOT} />}
        <span style={hasActivity ? NAME_STYLE : NAME_MUTED}>
          {agent.agentName}
        </span>
        {hasActivity && (
          <span style={EARNINGS_STYLE}>{formatDollar(agent.gross)}</span>
        )}
        {agent.status !== null && (
          <Badge color={BADGE_MAP[agent.status].color} size="sm">
            {BADGE_MAP[agent.status].label}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div style={SIDEBAR}>
      {/* Search */}
      <div style={SEARCH_WRAP}>
        <Search size={14} style={SEARCH_ICON} />
        <input
          style={SEARCH_INPUT}
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Scrollable agent list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Sales agents section */}
        <div style={SECTION_HEADER}>SALES AGENTS</div>
        {filteredSales.map(renderRow)}

        {/* Divider */}
        <div style={DIVIDER} />

        {/* CS agents section */}
        <div style={SECTION_HEADER}>CUSTOMER SERVICE</div>
        {filteredCS.map(renderRow)}

        {/* Empty search state */}
        {noResults && (
          <div style={NO_RESULTS}>No agents match your search.</div>
        )}
      </div>
    </div>
  );
}
