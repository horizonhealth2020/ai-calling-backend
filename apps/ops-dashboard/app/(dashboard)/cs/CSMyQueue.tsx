"use client";
import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  EmptyState,
  spacing,
  colors,
  typography,
  baseThStyle,
  baseTdStyle,
  radius,
} from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDate, formatDateTime } from "@ops/utils";

interface CSMyQueueProps {
  API: string;
  userName: string;
}

type StaleRecord = {
  id: string;
  assignedTo: string | null;
  createdAt: string;
  staleSince: string;
  lastAttemptAt?: string | null;
  // chargeback fields
  memberCompany?: string | null;
  memberId?: string | null;
  // pending term fields
  memberName?: string | null;
  holdDate?: string | null;
  product?: string | null;
};

type AgentSummary = {
  name: string;
  staleChargebacks: number;
  stalePendingTerms: number;
  totalStale: number;
};

type StaleSummaryResponse = {
  agents: AgentSummary[];
  records: { chargebacks: StaleRecord[]; pendingTerms: StaleRecord[] };
  allRecords: { chargebacks: StaleRecord[]; pendingTerms: StaleRecord[] };
};

function timeOverdue(staleSince: string): string {
  const diff = Date.now() - new Date(staleSince).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "<1h overdue";
  if (hours < 24) return `${hours}h overdue`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h overdue`;
}

export default function CSMyQueue({ API, userName }: CSMyQueueProps) {
  const [data, setData] = useState<StaleSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API}/api/stale-summary?assignedTo=${encodeURIComponent(userName)}`);
      if (res.ok) setData(await res.json());
    } catch { /* silent */ }
    setLoading(false);
  }, [API, userName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div style={{ padding: spacing[6], color: colors.textTertiary }}>Loading queue...</div>;
  if (!data) return <EmptyState title="Failed to load queue" />;

  const staleIds = new Set([
    ...data.records.chargebacks.map(r => r.id),
    ...data.records.pendingTerms.map(r => r.id),
  ]);
  const freshCbs = data.allRecords.chargebacks.filter(r => !staleIds.has(r.id));
  const freshPts = data.allRecords.pendingTerms.filter(r => !staleIds.has(r.id));
  const totalStale = data.records.chargebacks.length + data.records.pendingTerms.length;
  const totalFresh = freshCbs.length + freshPts.length;

  // Merge stale records into single sorted list
  const staleItems = [
    ...data.records.chargebacks.map(r => ({ ...r, recordType: "CB" as const })),
    ...data.records.pendingTerms.map(r => ({ ...r, recordType: "PT" as const })),
  ].sort((a, b) => new Date(a.staleSince).getTime() - new Date(b.staleSince).getTime());

  // Merge fresh records
  const freshItems = [
    ...freshCbs.map(r => ({ ...r, recordType: "CB" as const })),
    ...freshPts.map(r => ({ ...r, recordType: "PT" as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const ROW: React.CSSProperties = { display: "flex", alignItems: "center", gap: spacing[3], padding: `${spacing[3]}px ${spacing[4]}px`, borderBottom: `1px solid ${colors.borderSubtle}` };
  const TYPE_BADGE: (type: string) => React.CSSProperties = (type) => ({
    fontSize: typography.sizes.xs.fontSize, fontWeight: typography.weights.bold,
    borderRadius: radius.full, padding: "2px 8px",
    color: type === "CB" ? colors.danger : colors.warning,
    background: type === "CB" ? colors.dangerBg : colors.warningBg,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing[5] }}>
      {/* Stale Items */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: `${spacing[4]}px ${spacing[5]}px`, borderBottom: `1px solid ${colors.borderSubtle}`, display: "flex", alignItems: "center", gap: spacing[3] }}>
          <span style={{ fontSize: typography.sizes.md.fontSize, fontWeight: typography.weights.bold, color: totalStale > 0 ? colors.danger : colors.success }}>
            {totalStale > 0 ? `Stale (${totalStale})` : "No Stale Items"}
          </span>
        </div>
        {staleItems.length === 0 ? (
          <div style={{ padding: spacing[5], color: colors.success, fontSize: typography.sizes.sm.fontSize, textAlign: "center" }}>
            All caught up — no stale records
          </div>
        ) : (
          <div>
            {staleItems.map(item => (
              <div key={item.id} style={{ ...ROW, background: `${colors.dangerBg}` }}>
                <span style={TYPE_BADGE(item.recordType)}>{item.recordType}</span>
                <span style={{ flex: 1, color: colors.textPrimary, fontSize: typography.sizes.sm.fontSize }}>
                  {item.recordType === "CB" ? (item.memberCompany || item.memberId || "Unknown") : (item.memberName || item.memberId || "Unknown")}
                </span>
                {item.recordType === "PT" && item.product && (
                  <span style={{ color: colors.textTertiary, fontSize: typography.sizes.xs.fontSize, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product}</span>
                )}
                <span style={{ color: colors.textTertiary, fontSize: typography.sizes.xs.fontSize, whiteSpace: "nowrap" }}>{formatDate(item.createdAt)}</span>
                <span style={{
                  fontSize: typography.sizes.xs.fontSize, fontWeight: typography.weights.bold,
                  borderRadius: radius.full, padding: "2px 8px",
                  color: colors.danger, background: colors.dangerBg, border: `1px solid ${colors.danger}`,
                  whiteSpace: "nowrap",
                }}>
                  STALE — {timeOverdue(item.staleSince)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Fresh Assigned Items */}
      {(freshItems.length > 0) && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: `${spacing[4]}px ${spacing[5]}px`, borderBottom: `1px solid ${colors.borderSubtle}` }}>
            <span style={{ fontSize: typography.sizes.md.fontSize, fontWeight: typography.weights.bold, color: colors.textPrimary }}>
              My Assigned ({totalFresh})
            </span>
          </div>
          <div>
            {freshItems.map(item => (
              <div key={item.id} style={ROW}>
                <span style={TYPE_BADGE(item.recordType)}>{item.recordType}</span>
                <span style={{ flex: 1, color: colors.textPrimary, fontSize: typography.sizes.sm.fontSize }}>
                  {item.recordType === "CB" ? (item.memberCompany || item.memberId || "Unknown") : (item.memberName || item.memberId || "Unknown")}
                </span>
                {item.recordType === "PT" && item.product && (
                  <span style={{ color: colors.textTertiary, fontSize: typography.sizes.xs.fontSize, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product}</span>
                )}
                <span style={{ color: colors.textTertiary, fontSize: typography.sizes.xs.fontSize, whiteSpace: "nowrap" }}>{formatDate(item.createdAt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {totalStale === 0 && totalFresh === 0 && (
        <EmptyState title="No records assigned to you" />
      )}
    </div>
  );
}

// Exported for use in CSTracking stale overview
export function StaleOverviewCard({ API }: { API: string }) {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API}/api/stale-summary`);
        if (res.ok) {
          const data: StaleSummaryResponse = await res.json();
          setAgents(data.agents.filter(a => a.totalStale > 0));
        }
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [API]);

  if (loading) return null;

  return (
    <Card style={{ padding: `${spacing[4]}px`, marginBottom: spacing[4] }}>
      <div style={{ fontSize: typography.sizes.md.fontSize, fontWeight: typography.weights.bold, color: colors.textPrimary, marginBottom: spacing[3] }}>
        Stale Overview
      </div>
      {agents.length === 0 ? (
        <div style={{ color: colors.success, fontSize: typography.sizes.sm.fontSize }}>No stale items across all agents</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={baseThStyle}>Agent</th>
              <th style={{ ...baseThStyle, textAlign: "center" }}>Stale CB</th>
              <th style={{ ...baseThStyle, textAlign: "center" }}>Stale PT</th>
              <th style={{ ...baseThStyle, textAlign: "center" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {agents.map(agent => (
              <tr key={agent.name}>
                <td style={baseTdStyle}>{agent.name}</td>
                <td style={{ ...baseTdStyle, textAlign: "center", color: agent.staleChargebacks > 0 ? colors.danger : colors.textTertiary, fontWeight: agent.staleChargebacks > 0 ? typography.weights.bold : undefined }}>
                  {agent.staleChargebacks}
                </td>
                <td style={{ ...baseTdStyle, textAlign: "center", color: agent.stalePendingTerms > 0 ? colors.danger : colors.textTertiary, fontWeight: agent.stalePendingTerms > 0 ? typography.weights.bold : undefined }}>
                  {agent.stalePendingTerms}
                </td>
                <td style={{ ...baseTdStyle, textAlign: "center", color: colors.danger, fontWeight: typography.weights.bold }}>
                  {agent.totalStale}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
