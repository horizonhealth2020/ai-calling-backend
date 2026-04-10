"use client";
import { Badge, AnimatedNumber } from "@ops/ui";
import { colors, spacing, radius, motion, semanticColors, colorAlpha, typography } from "@ops/ui";
import { formatDollar } from "@ops/utils";
import { ChevronDown } from "lucide-react";
import {
  type Entry, type Period, type Product, type AgentAdjustment,
  type AgentPeriodData, type StatusChangeRequest, type SaleEditRequest,
} from "./payroll-types";
import { WeekSection } from "./WeekSection";

const C = colors;
const S = spacing;
const R = radius;

/* ── AgentCard Props ────────────────────────────────────────── */

interface AgentCardProps {
  agentName: string;
  agentData: AgentPeriodData[];
  isTopEarner: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  expandedWeeks: Set<string>;
  selectedWeekId: string | null;
  onToggleWeek: (periodId: string) => void;
  onSelectWeek: (periodId: string) => void;
  products: Product[];
  allAgents: { id: string; name: string }[];
  pendingRequests: StatusChangeRequest[];
  pendingEditRequests: SaleEditRequest[];
  approvingId: string | null;
  rejectingId: string | null;
  approvingEditId: string | null;
  rejectingEditId: string | null;
  onSaleUpdate: (saleId: string, data: Record<string, unknown>) => void | Promise<void>;
  onApprove: (saleId: string) => void | Promise<void>;
  onUnapprove: (saleId: string) => void | Promise<void>;
  onDelete: (saleId: string) => void | Promise<void>;
  onPrintWeek: (agentName: string, entries: Entry[], period: Period) => void;
  onMarkPaid: (entryIds: string[], serviceEntryIds: string[], agentName: string) => void;
  onMarkUnpaid: (entryIds: string[], serviceEntryIds: string[], agentName: string) => void;
  onApproveChangeRequest: (id: string) => void | Promise<void>;
  onRejectChangeRequest: (id: string) => void | Promise<void>;
  onApproveEditRequest: (id: string) => void | Promise<void>;
  onRejectEditRequest: (id: string) => void | Promise<void>;
  highlightedEntryIds: Set<string>;
  API: string;
  refreshPeriods: () => Promise<void>;
}

/* ── AgentCard Component ────────────────────────────────────── */

export function AgentCard({
  agentName, agentData, isTopEarner,
  expanded, onToggleExpand,
  expandedWeeks, selectedWeekId, onToggleWeek, onSelectWeek,
  products, allAgents, pendingRequests, pendingEditRequests,
  approvingId, rejectingId, approvingEditId, rejectingEditId,
  onSaleUpdate, onApprove, onUnapprove, onDelete,
  onPrintWeek, onMarkPaid, onMarkUnpaid,
  onApproveChangeRequest, onRejectChangeRequest,
  onApproveEditRequest, onRejectEditRequest,
  highlightedEntryIds, API, refreshPeriods,
}: AgentCardProps) {
  // Sort periods by weekStart descending (most recent first)
  const sortedPeriods = [...agentData].sort((a, b) =>
    new Date(b.period.weekStart).getTime() - new Date(a.period.weekStart).getTime()
  );

  // Check if all entries across all weeks are paid
  const allEntries = agentData.flatMap(pd => pd.entries);
  const allPaid = allEntries.length > 0 && allEntries.every(
    e => e.status === "PAID" || e.status === "ZEROED_OUT" || e.status === "CLAWBACK_APPLIED"
  );

  // Find selected week data for header summary
  const selectedData = selectedWeekId
    ? agentData.find(pd => pd.period.id === selectedWeekId)
    : sortedPeriods[0];

  // Sale count from most recent week only
  const mostRecentData = sortedPeriods[0];
  const saleCount = mostRecentData?.activeCount ?? 0;

  // Header financial summary from selected week
  const headerGross = selectedData?.gross ?? 0;
  const headerAdj = selectedData?.adjustment;
  const headerBonus = headerAdj ? Number(headerAdj.bonusAmount) : 0;
  const headerFronted = headerAdj ? Number(headerAdj.frontedAmount) : 0;
  const headerHold = headerAdj ? Number(headerAdj.holdAmount) : 0;
  const headerNet = headerGross + headerBonus + headerFronted - headerHold;

  return (
    <div style={{
      border: `1px solid ${C.borderDefault}`,
      borderRadius: R["2xl"],
      background: C.bgSurface,
      marginBottom: S[8],
      overflow: "hidden",
      opacity: allPaid ? 0.7 : 1,
      transition: "opacity 150ms ease-out",
    }}>
      {/* Agent header */}
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: `${S[4]}px ${S[5]}px`,
          borderBottom: `1px solid ${C.borderSubtle}`,
          background: isTopEarner ? colorAlpha(semanticColors.accentTealMid, 0.04) : "transparent",
          cursor: "pointer",
        }}
        onClick={onToggleExpand}
      >
        <div style={{ display: "flex", alignItems: "center", gap: S[3] }}>
          <span style={{ fontWeight: 700, fontSize: typography.sizes.md.fontSize, color: C.textPrimary }}>{agentName}</span>
          {isTopEarner && <Badge color={C.primary400}>Top Earner</Badge>}
          <span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted }}>
            {saleCount} sale{saleCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ display: "flex", gap: S[3], fontSize: typography.sizes.sm.fontSize, alignItems: "center" }}>
          {/* Read-only financial summary of selected week */}
          <span style={{ color: C.textMuted }}>Commission: <strong style={{ color: C.textPrimary, fontWeight: 700, fontSize: typography.sizes.md.fontSize }}>{formatDollar(headerGross)}</strong></span>
          <span style={{ color: C.textMuted }}>Net: <strong style={{ color: headerNet >= 0 ? C.success : C.danger, fontWeight: 700, fontSize: typography.sizes.md.fontSize }}>{formatDollar(headerNet)}</strong></span>
          <div
            style={{
              color: C.textMuted,
              transition: `transform 150ms ${motion.easing.out}`,
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <ChevronDown size={18} />
          </div>
        </div>
      </div>

      {/* Expanded content - week sections */}
      {expanded && (
        <div className="animate-slide-down">
          {sortedPeriods.map(pd => (
            <WeekSection
              key={pd.period.id}
              agentName={agentName}
              entries={pd.entries}
              period={pd.period}
              adjustment={pd.adjustment}
              agentGross={pd.gross}
              agentNet={pd.net}
              activeCount={pd.activeCount}
              products={products}
              allAgents={allAgents}
              pendingRequests={pendingRequests}
              pendingEditRequests={pendingEditRequests}
              approvingId={approvingId}
              rejectingId={rejectingId}
              approvingEditId={approvingEditId}
              rejectingEditId={rejectingEditId}
              expanded={expandedWeeks.has(pd.period.id)}
              isSelected={selectedWeekId === pd.period.id}
              onToggleExpand={() => onToggleWeek(pd.period.id)}
              onSelect={() => onSelectWeek(pd.period.id)}
              onSaleUpdate={onSaleUpdate}
              onApprove={onApprove}
              onUnapprove={onUnapprove}
              onDelete={onDelete}
              onPrint={() => onPrintWeek(agentName, pd.entries, pd.period)}
              onMarkPaid={() => onMarkPaid(pd.entries.map(e => e.id), [], agentName)}
              onMarkUnpaid={() => onMarkUnpaid(pd.entries.map(e => e.id), [], agentName)}
              onApproveChangeRequest={onApproveChangeRequest}
              onRejectChangeRequest={onRejectChangeRequest}
              onApproveEditRequest={onApproveEditRequest}
              onRejectEditRequest={onRejectEditRequest}
              highlightedEntryIds={highlightedEntryIds}
              API={API}
              refreshPeriods={refreshPeriods}
            />
          ))}
        </div>
      )}
    </div>
  );
}
