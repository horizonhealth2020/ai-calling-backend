"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { Badge, AnimatedNumber, Button, useToast, Card, EmptyState } from "@ops/ui";
import { colors, spacing, radius } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar, formatDate } from "@ops/utils";
import {
  Calendar, AlertTriangle,
  CheckCircle,
  XCircle, Printer,
  Check, X, Users,
} from "lucide-react";
import {
  type Entry, type BonusCategory, type ServiceEntry, type AgentAdjustment,
  type Period, type Product, type StatusChangeRequest, type SaleEditRequest,
  type Alert, type AlertPeriod, type SocketClient, type AgentData, type AgentPeriodData,
  inputStyle, thStyle, thRight, thCenter, tdStyle, tdRight, tdCenter,
  isActiveEntry, fmtDate,
} from "./payroll-types";
import { AgentCard } from "./AgentCard";
import { AgentSidebar } from "./AgentSidebar";
import { type SidebarAgent } from "./payroll-types";

/* ── Design tokens (local aliases) ─────────────────────────── */

const C = colors;
const S = spacing;
const R = radius;

const LAYOUT: React.CSSProperties = {
  display: "flex",
  flex: 1,
  minHeight: 0,
  height: "calc(100vh - 320px)",
  overflow: "hidden",
};
const CONTENT_AREA: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflowY: "auto" as const,
  padding: S[4],
};

/* ── StatMini ───────────────────────────────────────────────── */

function StatMini({
  label, value, color, prefix = "$",
}: {
  label: string; value: number; color?: string; prefix?: string;
}) {
  return (
    <div style={{
      background: C.bgSurfaceRaised,
      borderRadius: R.lg,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <div style={{ fontSize: 10, color: C.textTertiary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 20, color: color ?? C.textPrimary }}>
        <AnimatedNumber value={value} prefix={prefix} decimals={2} />
      </div>
    </div>
  );
}

/* ── Props ──────────────────────────────────────────────────── */

export interface PayrollPeriodsProps {
  socket: SocketClient | null;
  API: string;
  periods: Period[];
  setPeriods: React.Dispatch<React.SetStateAction<Period[]>>;
  products: Product[];
  allAgents: { id: string; name: string }[];
  bonusCategories: BonusCategory[];
  pendingRequests: StatusChangeRequest[];
  setPendingRequests: React.Dispatch<React.SetStateAction<StatusChangeRequest[]>>;
  pendingEditRequests: SaleEditRequest[];
  setPendingEditRequests: React.Dispatch<React.SetStateAction<SaleEditRequest[]>>;
  alerts: Alert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  loadingAlerts: boolean;
  highlightedAlertIds: Set<string>;
  refreshPeriods: () => Promise<void>;
}

/* ── Main component ─────────────────────────────────────────── */

export default function PayrollPeriods({
  socket, API, periods, setPeriods, products, allAgents, bonusCategories,
  pendingRequests, setPendingRequests, pendingEditRequests, setPendingEditRequests,
  alerts, setAlerts, loadingAlerts, highlightedAlertIds, refreshPeriods,
}: PayrollPeriodsProps) {
  const { toast } = useToast();
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvingEditId, setApprovingEditId] = useState<string | null>(null);
  const [rejectingEditId, setRejectingEditId] = useState<string | null>(null);
  const [highlightedEntryIds] = useState<Set<string>>(new Set());
  const [approvingAlertId, setApprovingAlertId] = useState<string | null>(null);
  const [alertPeriods, setAlertPeriods] = useState<Record<string, { id: string; weekStart: string; weekEnd: string }[]>>({});
  const [selectedAlertPeriod, setSelectedAlertPeriod] = useState<Record<string, string>>({});

  /* ── Agent-level expand/collapse state ───────────────────── */
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [expandedWeeks, setExpandedWeeks] = useState<Map<string, Set<string>>>(new Map());
  const [selectedWeek, setSelectedWeek] = useState<Map<string, string>>(new Map());

  /* ── Sidebar agent selection state ─────────────────────── */
  const [selectedAgent, setSelectedAgent] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("payroll_selectedAgent") ?? null;
    }
    return null;
  });
  const [visibleCount, setVisibleCount] = useState(4);
  const contentRef = useRef<HTMLDivElement>(null);
  const selectedAgentRef = useRef<string | null>(selectedAgent);

  /* ── Agent-first data regrouping ─────────────────────────── */
  const agentData = useMemo(() => {
    const map = new Map<string, AgentData>();

    // Seed from allAgents (D-03: all agents shown unless inactive)
    for (const agent of allAgents) {
      map.set(agent.name, { agentId: agent.id, agentName: agent.name, periods: [] });
    }

    for (const p of periods) {
      const byAgent = new Map<string, Entry[]>();
      for (const e of p.entries) {
        const name = e.agent?.name ?? "Unknown";
        if (!byAgent.has(name)) byAgent.set(name, []);
        byAgent.get(name)!.push(e);
      }
      // CARRY-08: include agents from adjustments with zero sales
      if (p.agentAdjustments) {
        for (const adj of p.agentAdjustments) {
          const name = adj.agent?.name ?? "Unknown";
          if (!byAgent.has(name)) byAgent.set(name, []);
        }
      }

      for (const [agentName, entries] of byAgent) {
        if (!map.has(agentName)) {
          map.set(agentName, { agentId: "unknown", agentName, periods: [] });
        }
        const active = entries.filter(isActiveEntry);
        const adj = p.agentAdjustments?.find(a => a.agent?.name === agentName);
        const gross = active.reduce((s, e) => s + Number(e.payoutAmount), 0);
        const bonus = adj ? Number(adj.bonusAmount) : 0;
        const fronted = adj ? Number(adj.frontedAmount) : 0;
        const hold = adj ? Number(adj.holdAmount) : 0;
        map.get(agentName)!.periods.push({
          period: p,
          entries,
          adjustment: adj,
          gross,
          net: gross + bonus + fronted - hold,
          activeCount: active.length,
        });
      }
    }

    return map;
  }, [periods, allAgents]);

  /* ── Initialize expand/selected state when data changes ──── */
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      // First load: all agents expanded, default weeks expanded
      initializedRef.current = true;
      setExpandedAgents(new Set(agentData.keys()));

      const weekMap = new Map<string, Set<string>>();
      const selMap = new Map<string, string>();
      for (const [agentName, data] of agentData) {
        const sorted = [...data.periods].sort((a, b) =>
          new Date(b.period.weekStart).getTime() - new Date(a.period.weekStart).getTime()
        );
        const expandedIds = new Set(sorted.slice(0, 2).map(p => p.period.id));
        weekMap.set(agentName, expandedIds);
        if (sorted.length > 0) selMap.set(agentName, sorted[0].period.id);
      }
      setExpandedWeeks(weekMap);
      setSelectedWeek(selMap);
      return;
    }

    // Subsequent updates: only add state for NEW agents, preserve existing
    setExpandedWeeks(prev => {
      const next = new Map(prev);
      for (const [agentName, data] of agentData) {
        if (!next.has(agentName)) {
          const sorted = [...data.periods].sort((a, b) =>
            new Date(b.period.weekStart).getTime() - new Date(a.period.weekStart).getTime()
          );
          next.set(agentName, new Set(sorted.slice(0, 2).map(p => p.period.id)));
        }
      }
      return next;
    });
    setSelectedWeek(prev => {
      const next = new Map(prev);
      for (const [agentName, data] of agentData) {
        if (!next.has(agentName)) {
          const sorted = [...data.periods].sort((a, b) =>
            new Date(b.period.weekStart).getTime() - new Date(a.period.weekStart).getTime()
          );
          if (sorted.length > 0) next.set(agentName, sorted[0].period.id);
        }
      }
      return next;
    });
  }, [agentData]);

  // Keep ref in sync with state + persist to sessionStorage
  useEffect(() => {
    selectedAgentRef.current = selectedAgent;
    if (selectedAgent) sessionStorage.setItem("payroll_selectedAgent", selectedAgent);
    else sessionStorage.removeItem("payroll_selectedAgent");
  }, [selectedAgent]);

  // Restore selection after socket-driven data refresh
  useEffect(() => {
    if (selectedAgentRef.current && agentData.has(selectedAgentRef.current)) {
      setSelectedAgent(selectedAgentRef.current);
    }
  }, [agentData]);

  function handleSelectAgent(agentName: string) {
    setSelectedAgent(agentName);
    setVisibleCount(4);
    contentRef.current?.scrollTo({ top: 0 });
  }

  /* ── Current-week totals for summary strip ──────────────── */
  const currentWeekTotals = useMemo(() => {
    // Find the most recent period
    const sortedPeriods = [...periods].sort((a, b) =>
      new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
    );
    const current = sortedPeriods[0];
    if (!current) return null;

    const activeEntries = current.entries.filter(isActiveEntry);
    const gross = activeEntries.reduce((s, e) => s + Number(e.payoutAmount), 0);
    const bonus = (current.agentAdjustments ?? []).reduce((s, a) => s + Number(a.bonusAmount ?? 0), 0);
    const fronted = (current.agentAdjustments ?? []).reduce((s, a) => s + Number(a.frontedAmount ?? 0), 0);
    const hold = (current.agentAdjustments ?? []).reduce((s, a) => s + Number(a.holdAmount ?? 0), 0);
    const net = gross + bonus + fronted - hold;
    const svcTotal = (current.serviceEntries ?? []).reduce((s, e) => s + Number(e.totalPay), 0);

    return {
      period: current,
      entries: activeEntries.length,
      gross,
      bonus,
      fronted,
      hold,
      net,
      svcTotal,
    };
  }, [periods]);

  /* ── Agent sorting ───────────────────────────────────────── */
  // Identify the current (most recent) period for sidebar earnings
  const currentPeriodId = useMemo(() => {
    if (periods.length === 0) return null;
    const sorted = [...periods].sort((a, b) =>
      new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
    );
    return sorted[0].id;
  }, [periods]);

  const sortedAgents = useMemo(() => {
    const agentEntries = [...agentData.entries()].map(([name, data]) => {
      // Use current week period specifically, not "most recent with data"
      const currentPeriod = data.periods.find(p => p.period.id === currentPeriodId);
      return {
        agentName: name,
        data,
        gross: currentPeriod?.gross ?? 0,
        net: currentPeriod?.net ?? 0,
        activeCount: currentPeriod?.activeCount ?? 0,
      };
    });

    // Top 3 by earnings (before alphabetical sort)
    const byEarnings = [...agentEntries].sort((a, b) => b.gross - a.gross);
    const top3 = new Set(
      byEarnings.slice(0, 3).filter(a => a.net > 0).map(a => a.agentName)
    );

    // D-03: Alphabetical sort for sidebar display
    const result = [...agentEntries].sort((a, b) =>
      a.agentName.localeCompare(b.agentName)
    );

    return result.map(a => ({
      ...a,
      isTopEarner: top3.has(a.agentName),
    }));
  }, [agentData, currentPeriodId]);

  /* ── Agent status helper ─────────────────────────────────── */

  function getAgentStatus(agentPeriods: AgentPeriodData[]): "paid" | "unpaid" | "partial" | null {
    if (agentPeriods.length === 0) return null;
    // Use current week period, not just most recent with data
    const current = currentPeriodId
      ? agentPeriods.find(p => p.period.id === currentPeriodId)
      : null;
    // Fall back to most recent if agent has no current week entry
    const target = current ?? [...agentPeriods].sort((a, b) =>
      new Date(b.period.weekStart).getTime() - new Date(a.period.weekStart).getTime()
    )[0];
    if (!target) return null;
    const entries = target.entries;
    if (entries.length === 0) return null;
    const paidStatuses = ["PAID", "ZEROED_OUT", "CLAWBACK_APPLIED"];
    const allPaid = entries.every(e => paidStatuses.includes(e.status));
    const nonePaid = entries.every(e => !paidStatuses.includes(e.status));
    if (allPaid) return "paid";
    if (nonePaid) return "unpaid";
    return "partial";
  }

  /* ── Sidebar agent lists ────────────────────────────────── */

  const sidebarSalesAgents: SidebarAgent[] = useMemo(() =>
    sortedAgents.map(a => ({
      agentName: a.agentName,
      agentId: a.data.agentId,
      gross: a.gross,
      net: a.net,
      activeCount: a.activeCount,
      isTopEarner: a.isTopEarner,
      isCS: false,
      status: getAgentStatus(a.data.periods),
    })),
    [sortedAgents]
  );

  const sidebarCSAgents: SidebarAgent[] = useMemo(() => {
    // Group service entries by agent name across all periods
    const csMap = new Map<string, { totalPay: number; statuses: string[] }>();
    for (const p of periods) {
      for (const se of (p.serviceEntries ?? [])) {
        const name = se.serviceAgent.name;
        if (!csMap.has(name)) csMap.set(name, { totalPay: 0, statuses: [] });
        const entry = csMap.get(name)!;
        entry.totalPay += Number(se.totalPay);
        entry.statuses.push(se.status);
      }
    }
    return [...csMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, data]) => {
        const allPaid = data.statuses.length > 0 && data.statuses.every(s => s === "PAID");
        const nonePaid = data.statuses.length > 0 && data.statuses.every(s => s !== "PAID");
        let status: "paid" | "unpaid" | "partial" | null = null;
        if (data.statuses.length > 0) {
          status = allPaid ? "paid" : nonePaid ? "unpaid" : "partial";
        }
        return {
          agentName: name,
          agentId: name,
          gross: data.totalPay,
          net: data.totalPay,
          activeCount: data.statuses.length,
          isTopEarner: false,
          isCS: true,
          status,
        };
      });
  }, [periods]);

  /* ── Selected agent data for content area ───────────────── */

  const isCSAgent = sidebarCSAgents.some(a => a.agentName === selectedAgent);
  const selectedSalesData = selectedAgent && !isCSAgent ? agentData.get(selectedAgent) : null;
  const selectedAgentSorted = selectedSalesData
    ? [...selectedSalesData.periods].sort((a, b) =>
        new Date(b.period.weekStart).getTime() - new Date(a.period.weekStart).getTime()
      )
    : [];
  const visiblePeriods = selectedAgentSorted.slice(0, visibleCount);
  const hasMorePeriods = selectedAgentSorted.length > visibleCount;
  const selectedIsTopEarner = sortedAgents.find(a => a.agentName === selectedAgent)?.isTopEarner ?? false;

  // CS agent data for content area
  const selectedCSEntries = selectedAgent && isCSAgent
    ? periods
        .filter(p => (p.serviceEntries ?? []).some(se => se.serviceAgent.name === selectedAgent))
        .map(p => ({
          period: p,
          entries: (p.serviceEntries ?? []).filter(se => se.serviceAgent.name === selectedAgent),
        }))
    : [];

  /* ── Auto-expand visible periods for selected agent (D-10) ─ */

  useEffect(() => {
    if (!selectedAgent) return;
    setExpandedWeeks(prev => {
      const next = new Map(prev);
      const currentSet = new Set(next.get(selectedAgent) ?? []);
      // Expand all visible periods for this agent
      for (const pd of visiblePeriods) {
        currentSet.add(pd.period.id);
      }
      next.set(selectedAgent, currentSet);
      return next;
    });
  }, [selectedAgent, visibleCount]);

  /* ── Alert handlers ──────────────────────────────────────── */

  async function fetchAgentPeriods(agentId: string, alertId: string) {
    if (!agentId) return;
    const res = await authFetch(`${API}/api/alerts/agent-periods/${agentId}`);
    if (res.ok) {
      const data = await res.json();
      setAlertPeriods(prev => ({ ...prev, [alertId]: data }));
      // Auto-select the first (oldest) period
      if (data.length > 0) {
        setSelectedAlertPeriod(prev => ({ ...prev, [alertId]: data[0].id }));
      }
    }
  }

  async function handleApproveAlert(alertId: string, periodId: string) {
    try {
      const res = await authFetch(`${API}/api/alerts/${alertId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodId }),
      });
      if (res.ok) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
        setApprovingAlertId(null);
        toast("success", "Alert approved and clawback created");
        refreshPeriods();
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error || `Request failed (${res.status})`);
      }
    } catch { toast("error", "Failed to approve alert"); }
  }

  async function handleClearAlert(alertId: string) {
    if (!confirm("Clear this alert? It will be permanently dismissed and no clawback will be created.")) return;
    try {
      const res = await authFetch(`${API}/api/alerts/${alertId}/clear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
        toast("success", "Alert cleared");
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error || `Request failed (${res.status})`);
      }
    } catch { toast("error", "Failed to clear alert"); }
  }

  /* ── Change / edit request handlers ──────────────────────── */

  async function approveChangeRequest(requestId: string) {
    setApprovingId(requestId);
    try {
      const res = await authFetch(`${API}/api/status-change-requests/${requestId}/approve`, { method: "POST" });
      if (res.ok) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
        await refreshPeriods();
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", `Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      toast("error", `Error: Unable to reach API \u2014 ${message}`);
    } finally {
      setApprovingId(null);
    }
  }

  async function rejectChangeRequest(requestId: string) {
    setRejectingId(requestId);
    try {
      const res = await authFetch(`${API}/api/status-change-requests/${requestId}/reject`, { method: "POST" });
      if (res.ok) {
        setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", `Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      toast("error", `Error: Unable to reach API \u2014 ${message}`);
    } finally {
      setRejectingId(null);
    }
  }

  async function approveEditRequest(requestId: string, saleInFinalized?: boolean) {
    if (saleInFinalized) {
      const confirmed = window.confirm(
        "Approving this edit will create an adjustment entry in the next open period. Commission difference will be applied there. Continue?"
      );
      if (!confirmed) return;
    }
    setApprovingEditId(requestId);
    try {
      const res = await authFetch(`${API}/api/sale-edit-requests/${requestId}/approve`, { method: "POST" });
      if (res.ok) {
        setPendingEditRequests(prev => prev.filter(r => r.id !== requestId));
        await refreshPeriods();
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", `Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      toast("error", `Error: Unable to reach API \u2014 ${message}`);
    } finally {
      setApprovingEditId(null);
    }
  }

  async function rejectEditRequest(requestId: string) {
    if (!window.confirm("Reject this edit request? The sale will remain unchanged.")) return;
    setRejectingEditId(requestId);
    try {
      const res = await authFetch(`${API}/api/sale-edit-requests/${requestId}/reject`, { method: "POST" });
      if (res.ok) {
        setPendingEditRequests(prev => prev.filter(r => r.id !== requestId));
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", `Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      toast("error", `Error: Unable to reach API \u2014 ${message}`);
    } finally {
      setRejectingEditId(null);
    }
  }

  /* ── Sale handlers ───────────────────────────────────────── */

  async function deleteSale(saleId: string) {
    if (!window.confirm("Permanently delete this sale? This removes it from payroll and tracking.")) return;
    const res = await authFetch(`${API}/api/sales/${saleId}`, { method: "DELETE" });
    if (res.ok) await refreshPeriods();
  }

  async function updateSale(saleId: string, data: Record<string, unknown>) {
    try {
      const res = await authFetch(`${API}/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        await refreshPeriods();
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", `Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      toast("error", `Error: Unable to reach API \u2014 ${message}`);
    }
  }

  async function toggleApproval(saleId: string, approved: boolean) {
    const res = await authFetch(`${API}/api/sales/${saleId}/approve-commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    if (res.ok) await refreshPeriods();
  }

  async function unapproveCommission(saleId: string) {
    const res = await authFetch(`${API}/api/sales/${saleId}/unapprove-commission`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) await refreshPeriods();
  }

  /* ── Paid/unpaid handlers ────────────────────────────────── */

  async function markEntriesPaid(entryIds: string[], serviceEntryIds: string[], label: string) {
    if (entryIds.length === 0 && serviceEntryIds.length === 0) return;
    if (!window.confirm(`Mark ${label} as PAID?`)) return;
    try {
      const res = await authFetch(`${API}/api/payroll/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryIds, serviceEntryIds }),
      });
      if (res.ok) {
        await refreshPeriods();
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      toast("error", `Unable to reach API \u2014 ${message}`);
    }
  }

  async function markEntriesUnpaid(entryIds: string[], serviceEntryIds: string[], label: string) {
    if (!window.confirm(`Mark this period as unpaid? This will revert the paid status for ${label}.`)) return;
    const res = await authFetch(`${API}/api/payroll/mark-unpaid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds, serviceEntryIds }),
    });
    if (res.ok) {
      await refreshPeriods();
    } else {
      const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }));
      alert(err.error || `Request failed (${res.status})`);
    }
  }

  /* ── Print functions ─────────────────────────────────────── */

  function printAgentCards(agents: [string, Entry[]][], period: Period) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payroll - ${fmtDate(period.weekStart)} to ${fmtDate(period.weekEnd)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { margin: 6mm 10mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; background: #fff; padding: 8px; }
  .agent-card { page-break-after: always; padding: 4px 0; }
  .agent-card:last-child { page-break-after: auto; }
  .header { border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 8px; }
  .header h1 { font-size: 20px; font-weight: 800; }
  .summary { display: flex; gap: 24px; margin-bottom: 10px; }
  .summary-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 16px; }
  .summary-label { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .summary-value { font-size: 18px; font-weight: 800; margin-top: 2px; }
  .green { color: #059669; } .red { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { padding: 8px 6px; text-align: left; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #e2e8f0; }
  td { padding: 7px 6px; border-bottom: 1px solid #f1f5f9; }
  .right { text-align: right; }
  .center { text-align: center; }
  .core { color: #14b8a6; font-weight: 600; }
  .addon { color: #0d9488; font-weight: 600; }
  .add { color: #d97706; font-weight: 600; }
  .subtotal td { border-top: 2px solid #cbd5e1; font-weight: 700; border-bottom: none; }
  .flag { font-size: 10px; font-style: italic; margin-top: 2px; }
  .flag-warn { color: #d97706; }
  .flag-bonus { color: #059669; }
  .prod-group { display: inline-flex; gap: 8px; flex-wrap: wrap; }
  .prod-block { display: inline-flex; flex-direction: column; align-items: center; }
  .prod-name { font-size: 11px; font-weight: 600; white-space: nowrap; max-width: 90px; overflow: hidden; text-overflow: ellipsis; }
  .prod-premium { font-size: 10px; color: #64748b; }
  .pill { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; margin-right: 4px; }
  .pill-approved { background: #d1fae5; color: #059669; }
  .pill-warn { background: #fef3c7; color: #d97706; }
  @media print { body { padding: 0; } .agent-card { padding: 2px 0; } }
</style></head><body>` +
      agents.map(([agentName, entries]) => {
        const agentGross   = entries.reduce((s, e) => s + Number(e.payoutAmount), 0);
        const agentAdj = period.agentAdjustments?.find((a: AgentAdjustment) => a.agent?.name === agentName);
        const agentBonus   = agentAdj ? Number(agentAdj.bonusAmount) : 0;
        const agentFronted = agentAdj ? Number(agentAdj.frontedAmount) : 0;
        const agentHold    = agentAdj ? Number(agentAdj.holdAmount) : 0;
        const agentNet     = agentGross + agentBonus + agentFronted - agentHold;
        return `<div class="agent-card">
  <div class="header">
    <h1>${agentName} <span style="font-size:13px;font-weight:400;color:#64748b;margin-left:8px">${entries.length} sale${entries.length !== 1 ? "s" : ""}</span></h1>
    <div style="font-size:13px;color:#64748b;margin-top:4px">Week of ${fmtDate(period.weekStart)} - ${fmtDate(period.weekEnd)}</div>
  </div>
  <div class="summary">
    <div class="summary-item"><div class="summary-label">Commission</div><div class="summary-value">$${agentGross.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Bonuses</div><div class="summary-value green">+$${agentBonus.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Fronted</div><div class="summary-value" style="color:#f59e0b">+$${agentFronted.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Hold</div><div class="summary-value" style="color:#ef4444">-$${agentHold.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Net Payout</div><div class="summary-value green">$${agentNet.toFixed(2)}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Member ID</th><th>Member Name</th><th class="center">Core</th><th class="center">Add-on</th><th class="center">AD&D</th>
      <th class="right">Enroll Fee</th><th class="right">Commission</th>
    </tr></thead>
    <tbody>` +
          entries.map(e => {
            const byType: Record<string, { name: string; premium?: number }[]> = { CORE: [], ADDON: [], AD_D: [] };
            if (e.sale?.product?.type) byType[e.sale.product.type]?.push({ name: e.sale.product.name, premium: Number(e.sale.premium) });
            if (e.sale?.addons) for (const ad of e.sale.addons) byType[ad.product.type]?.push({ name: ad.product.name, premium: ad.premium != null ? Number(ad.premium) : undefined });
            const printProd = (items: { name: string; premium?: number }[]) => items.length
              ? `<div class="prod-group">${items.map(p => `<div class="prod-block"><span class="prod-name">${p.name}</span>${p.premium != null ? `<span class="prod-premium">$${p.premium.toFixed(2)}</span>` : ""}</div>`).join("")}</div>`
              : "\u2014";
            const commFlags: string[] = [];
            if (e.halvingReason && e.sale?.commissionApproved) {
              commFlags.push(`<div class="pill pill-approved">Approved</div>`);
            } else if (e.halvingReason) {
              commFlags.push(`<div class="pill pill-warn">Half commission</div>`);
            }
            const commFlagHtml = commFlags.length > 0 ? commFlags.join("") : "";
            const enrollFee = e.sale?.enrollmentFee != null ? Number(e.sale.enrollmentFee) : 0;
            const enrollBonusHtml = enrollFee >= 125 ? `<div class="flag flag-bonus">+$10</div>` : "";
            const fee = e.sale?.enrollmentFee != null ? `$${Number(e.sale.enrollmentFee).toFixed(2)}` : "\u2014";
            return `<tr>
        <td>${e.sale?.memberId ?? "\u2014"}</td>
        <td>${e.sale?.memberName ?? "\u2014"}</td>
        <td class="center core">${printProd(byType.CORE)}</td>
        <td class="center addon">${printProd(byType.ADDON)}</td>
        <td class="center add">${printProd(byType.AD_D)}</td>
        <td class="right">${fee}${enrollBonusHtml}</td>
        <td class="right" style="font-weight:700">${commFlagHtml}$${Number(e.payoutAmount).toFixed(2)}</td>
      </tr>`;
          }).join("") +
          `<tr class="subtotal">
        <td colspan="5" class="right">SUBTOTAL</td>
        <td class="right">$${agentGross.toFixed(2)}</td>
        <td class="right green">$${agentNet.toFixed(2)}</td>
      </tr>
    </tbody></table></div>`;
      }).join("") +
      `</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  }

  function printServiceCards(serviceEntries: ServiceEntry[], period: Period, cats: BonusCategory[]) {
    const total = serviceEntries.reduce((s, se) => s + Number(se.totalPay), 0);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Service Payroll - ${fmtDate(period.weekStart)} to ${fmtDate(period.weekEnd)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; background: #fff; padding: 20px; }
  .header { border-bottom: 2px solid #14b8a6; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 800; color: #14b8a6; }
  .header .meta { font-size: 13px; color: #64748b; margin-top: 4px; }
  .total { font-size: 16px; font-weight: 800; color: #14b8a6; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { padding: 8px 8px; text-align: left; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #e2e8f0; }
  td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; }
  .right { text-align: right; } .center { text-align: center; }
  .green { color: #059669; } .red { color: #dc2626; } .purple { color: #14b8a6; font-weight: 700; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="header">
  <h1>Customer Service Payroll</h1>
  <div class="meta">Sunday ${fmtDate(period.weekStart)} \u2013 Saturday ${fmtDate(period.weekEnd)} &nbsp;\u00B7&nbsp; ${period.quarterLabel}</div>
</div>
<div class="total">Total: $${total.toFixed(2)}</div>
<table>
  <thead><tr><th>Name</th><th class="right">Base Pay</th><th class="right" style="color:#dc2626">Fronted</th>${cats.map(c => `<th class="center"${c.isDeduction ? ' style="color:#dc2626"' : ""}>${c.name}</th>`).join("")}<th class="right" style="color:#14b8a6">Total</th></tr></thead>
  <tbody>${serviceEntries.map(se => {
      const bd = (se.bonusBreakdown ?? {}) as Record<string, number>;
      const fAmt = Number(se.frontedAmount ?? 0);
      return `<tr><td style="font-weight:600">${se.serviceAgent.name}</td><td class="right">$${Number(se.basePay).toFixed(2)}</td><td class="right red">${fAmt > 0 ? "$" + fAmt.toFixed(2) : "\u2014"}</td>${cats.map(c => {
        const amt = bd[c.name] ?? 0;
        return `<td class="center ${amt > 0 ? (c.isDeduction ? "red" : "green") : ""}">${amt > 0 ? "$" + amt.toFixed(2) : "\u2014"}</td>`;
      }).join("")}<td class="right purple">$${Number(se.totalPay).toFixed(2)}</td></tr>`;
    }).join("")}</tbody>
</table>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  }

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div className="animate-fade-in" style={{ display: "grid", gap: S[4] }}>

      {/* Chargeback Alerts */}
      <div style={{
        background: C.bgSurface,
        borderLeft: `4px solid ${C.danger}`,
        borderRadius: R["2xl"],
        padding: S[4],
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: alerts.length > 0 ? S[3] : 0,
          fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const,
          letterSpacing: "0.06em", color: C.textTertiary,
        }}>
          <AlertTriangle size={14} />
          Chargeback Alerts
          {alerts.length > 0 && (
            <span style={{
              background: C.dangerBg, color: C.danger,
              fontSize: 11, fontWeight: 700, borderRadius: 9999, padding: "2px 8px",
            }}>{alerts.length}</span>
          )}
        </div>
        {!loadingAlerts && alerts.length === 0 && (
          <div style={{ color: C.textMuted, fontSize: 13, padding: `${S[2]}px 0` }}>
            No pending alerts. Chargeback alerts will appear here when submitted from the CS dashboard.
          </div>
        )}
        {alerts.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Agent Name</th>
                  <th style={thStyle}>Customer</th>
                  <th style={thRight}>Amount</th>
                  <th style={thStyle}>Date Submitted</th>
                  <th style={thCenter}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => {
                  const highlighted = highlightedAlertIds.has(alert.id);
                  const HIGHLIGHT_GLOW = { boxShadow: "0 0 20px rgba(20,184,166,0.4), inset 0 0 20px rgba(20,184,166,0.05)" };
                  return (
                    <tr key={alert.id} style={{
                      ...(highlighted ? HIGHLIGHT_GLOW : {}),
                      transition: "background 0.3s",
                    }}>
                      <td style={tdStyle}>{alert.agentName || "Unknown"}</td>
                      <td style={tdStyle}>{alert.customerName || "Unknown"}</td>
                      <td style={tdRight}>{alert.amount != null ? formatDollar(Number(alert.amount)) : "--"}</td>
                      <td style={tdStyle}>{formatDate(alert.createdAt)}</td>
                      <td style={{ ...tdCenter, display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                        {approvingAlertId === alert.id ? (
                          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                              <span style={{ fontSize: 11, color: C.textMuted, fontStyle: "italic" }}>Oldest open period pre-selected</span>
                              <select
                                style={{ ...inputStyle, width: "auto", minWidth: 160, fontSize: 12, padding: "4px 8px" }}
                                value={selectedAlertPeriod[alert.id] || ""}
                                onChange={e => setSelectedAlertPeriod(prev => ({ ...prev, [alert.id]: e.target.value }))}
                              >
                                {(!alertPeriods[alert.id] || alertPeriods[alert.id].length === 0) ? (
                                  <option value="" disabled>No open periods found</option>
                                ) : (
                                  (alertPeriods[alert.id] || []).map((p: AlertPeriod) => (
                                    <option key={p.id} value={p.id}>
                                      {fmtDate(p.weekStart)} {"\u2013"} {fmtDate(p.weekEnd)}
                                    </option>
                                  ))
                                )}
                              </select>
                            </div>
                            <Button
                              size="sm"
                              variant="success"
                              disabled={!selectedAlertPeriod[alert.id]}
                              onClick={() => {
                                if (selectedAlertPeriod[alert.id]) {
                                  handleApproveAlert(alert.id, selectedAlertPeriod[alert.id]);
                                }
                              }}
                            >
                              <Check size={12} style={{ marginRight: 3 }} /> Approve
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setApprovingAlertId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => {
                                setApprovingAlertId(alert.id);
                                if (alert.agentId) {
                                  fetchAgentPeriods(alert.agentId, alert.id);
                                } else {
                                  authFetch(`${API}/api/payroll/periods`).then(r => r.ok ? r.json() : []).then(data => {
                                    const openPeriods = ((data || []) as (AlertPeriod & { status?: string })[])
                                      .filter((p) => p.status === "OPEN")
                                      .map((p) => ({ id: p.id, weekStart: p.weekStart, weekEnd: p.weekEnd }))
                                      .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());
                                    setAlertPeriods(prev => ({ ...prev, [alert.id]: openPeriods }));
                                    if (openPeriods.length > 0) {
                                      setSelectedAlertPeriod(prev => ({ ...prev, [alert.id]: openPeriods[0].id }));
                                    }
                                  });
                                }
                              }}
                            >
                              <Check size={12} style={{ marginRight: 3 }} />
                              Approve Alert
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleClearAlert(alert.id)}
                            >
                              <X size={12} style={{ marginRight: 3 }} />
                              Clear Alert
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Current week summary strip */}
      {currentWeekTotals && (
        <div style={{ marginBottom: S[5] }}>
          <div style={{ fontSize: 12, color: C.textMuted, fontWeight: 600, marginBottom: S[2], display: "flex", alignItems: "center", gap: S[2] }}>
            <Calendar size={13} />
            {fmtDate(currentWeekTotals.period.weekStart)} {"\u2013"} {fmtDate(currentWeekTotals.period.weekEnd)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: S[3] }} className="grid-mobile-1">
            <StatMini label="Entries" value={currentWeekTotals.entries} prefix="" color={C.textPrimary} />
            <StatMini label="Commission" value={currentWeekTotals.gross} />
            <StatMini label="Bonuses" value={currentWeekTotals.bonus} color={C.success} />
            <StatMini label="Fronted" value={currentWeekTotals.fronted} color={C.warning} />
            <StatMini label="Hold" value={currentWeekTotals.hold} color={C.danger} />
            <StatMini label="Net Payout" value={currentWeekTotals.net} color={currentWeekTotals.net >= 0 ? C.success : C.danger} />
          </div>
        </div>
      )}

      {periods.length === 0 && (
        <Card style={{ borderRadius: R["2xl"] }}>
          <EmptyState
            icon={<Calendar size={32} />}
            title="No payroll periods found"
            description="Periods will appear here when sales are entered."
          />
        </Card>
      )}

      {/* Sidebar + Content layout */}
      {periods.length > 0 && (
        <div style={LAYOUT}>
          <AgentSidebar
            salesAgents={sidebarSalesAgents}
            csAgents={sidebarCSAgents}
            selectedAgent={selectedAgent}
            onSelectAgent={handleSelectAgent}
          />
          <div ref={contentRef} style={CONTENT_AREA}>
            {!selectedAgent && (
              <Card style={{ borderRadius: R["2xl"], marginTop: S[8] }}>
                <EmptyState
                  icon={<Users size={32} />}
                  title="Select an Agent"
                  description="Choose an agent from the sidebar to view their pay periods."
                />
              </Card>
            )}

            {selectedAgent && !isCSAgent && selectedSalesData && visiblePeriods.length === 0 && (
              <Card style={{ borderRadius: R["2xl"], marginTop: S[8] }}>
                <EmptyState
                  icon={<Users size={32} />}
                  title={selectedAgent}
                  description="No sales entries for the current period."
                />
              </Card>
            )}

            {selectedAgent && !isCSAgent && selectedSalesData && visiblePeriods.length > 0 && (
              <>
                <AgentCard
                  agentName={selectedAgent}
                  agentData={visiblePeriods}
                  isTopEarner={selectedIsTopEarner}
                  expanded={true}
                  onToggleExpand={() => {}}
                  expandedWeeks={expandedWeeks.get(selectedAgent) ?? new Set()}
                  selectedWeekId={selectedWeek.get(selectedAgent) ?? null}
                  onToggleWeek={(periodId) => {
                    setExpandedWeeks(prev => {
                      const next = new Map(prev);
                      const agentSet = new Set(next.get(selectedAgent!) ?? []);
                      if (agentSet.has(periodId)) agentSet.delete(periodId);
                      else agentSet.add(periodId);
                      next.set(selectedAgent!, agentSet);
                      return next;
                    });
                  }}
                  onSelectWeek={(periodId) => {
                    setSelectedWeek(prev => {
                      const next = new Map(prev);
                      next.set(selectedAgent!, periodId);
                      return next;
                    });
                  }}
                  products={products}
                  allAgents={allAgents}
                  pendingRequests={pendingRequests}
                  pendingEditRequests={pendingEditRequests}
                  approvingId={approvingId}
                  rejectingId={rejectingId}
                  approvingEditId={approvingEditId}
                  rejectingEditId={rejectingEditId}
                  onSaleUpdate={updateSale}
                  onApprove={id => toggleApproval(id, true)}
                  onUnapprove={unapproveCommission}
                  onDelete={deleteSale}
                  onPrintWeek={(name, entries, period) => printAgentCards([[name, entries]], period)}
                  onMarkPaid={(entryIds, svcIds, name) => markEntriesPaid(entryIds, svcIds, name)}
                  onMarkUnpaid={(entryIds, svcIds, name) => markEntriesUnpaid(entryIds, svcIds, name)}
                  onApproveChangeRequest={approveChangeRequest}
                  onRejectChangeRequest={rejectChangeRequest}
                  onApproveEditRequest={approveEditRequest}
                  onRejectEditRequest={rejectEditRequest}
                  highlightedEntryIds={highlightedEntryIds}
                  API={API}
                  refreshPeriods={refreshPeriods}
                />
                {hasMorePeriods && (
                  <div style={{ textAlign: "center" as const, padding: S[4] }}>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={() => setVisibleCount(selectedAgentSorted.length)}
                      onKeyDown={(e) => { if (e.key === "Enter") setVisibleCount(selectedAgentSorted.length); }}
                      style={{
                        color: C.accentTeal,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Load More Periods
                    </span>
                  </div>
                )}
              </>
            )}

            {selectedAgent && isCSAgent && selectedCSEntries.length > 0 && (
              <div>
                {selectedCSEntries.map(({ period: p, entries: csEntries }) => {
                  const svcTotal = csEntries.reduce((s, e) => s + Number(e.totalPay), 0);
                  return (
                    <div key={`cs-${p.id}`}>
                      <div style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: `${S[3]}px ${S[4]}px`,
                        background: C.infoBg,
                        border: `1px solid rgba(45,212,191,0.15)`,
                        borderRadius: R.lg,
                        marginBottom: S[3],
                      }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: C.info }}>
                          {selectedAgent} - {fmtDate(p.weekStart)} to {fmtDate(p.weekEnd)}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.info }}>
                          Total: <AnimatedNumber value={svcTotal} prefix="$" decimals={2} />
                        </span>
                      </div>
                      {csEntries.map((se, seIdx) => {
                        const bd = (se.bonusBreakdown ?? {}) as Record<string, number>;
                        const seFronted = Number(se.frontedAmount ?? 0);
                        return (
                          <div
                            key={se.id}
                            className={`animate-fade-in-up stagger-${Math.min(seIdx + 1, 10)}`}
                            style={{
                              background: C.bgSurfaceRaised,
                              border: `1px solid rgba(45,212,191,0.15)`,
                              borderRadius: R.xl,
                              marginBottom: S[3],
                            }}
                          >
                            <div style={{
                              display: "flex", justifyContent: "space-between", alignItems: "center",
                              padding: `${S[4]}px ${S[5]}px`,
                              borderBottom: `1px solid rgba(45,212,191,0.1)`,
                              background: C.infoBg,
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: S[3] }}>
                                <span style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary }}>{se.serviceAgent.name}</span>
                                <Badge color={C.info} size="sm">CS</Badge>
                              </div>
                              <div style={{ display: "flex", gap: S[3], fontSize: 13, alignItems: "center" }}>
                                <span style={{ color: C.textMuted }}>Base: <strong style={{ color: C.textPrimary }}>{formatDollar(Number(se.basePay))}</strong></span>
                                <span style={{ color: C.textMuted }}>Total: <strong style={{ color: C.info }}>{formatDollar(Number(se.totalPay))}</strong></span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => printServiceCards([se], p, bonusCategories)}
                                  style={{ background: C.infoBg, border: `1px solid rgba(45,212,191,0.2)`, color: C.info }}
                                >
                                  <Printer size={11} /> Print
                                </Button>
                                {se.status === "PAID" ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => markEntriesUnpaid([], [se.id], se.serviceAgent.name)}
                                    style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: C.success }}
                                  >
                                    <CheckCircle size={11} /> Paid
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => markEntriesPaid([], [se.id], se.serviceAgent.name)}
                                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
                                  >
                                    <XCircle size={11} /> Unpaid
                                  </Button>
                                )}
                              </div>
                            </div>

                            <div style={{ padding: `${S[2]}px ${S[5]}px`, fontSize: 12, color: C.textMuted, borderBottom: `1px solid ${C.borderSubtle}` }}>
                              Sunday {fmtDate(p.weekStart)} {"\u2013"} Saturday {fmtDate(p.weekEnd)}
                            </div>

                            <div style={{ padding: `${S[4]}px ${S[5]}px` }}>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: S[3] }}>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Base Pay</div>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>{formatDollar(Number(se.basePay))}</div>
                                </div>
                                {seFronted > 0 && (
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: C.danger, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Fronted</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: C.danger }}>{formatDollar(seFronted)}</div>
                                  </div>
                                )}
                                {bonusCategories.map(cat => {
                                  const amt = bd[cat.name] ?? 0;
                                  if (amt === 0) return null;
                                  return (
                                    <div key={cat.name}>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: cat.isDeduction ? C.danger : C.success, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{cat.name}</div>
                                      <div style={{ fontSize: 15, fontWeight: 700, color: cat.isDeduction ? C.danger : C.success }}>{formatDollar(amt)}</div>
                                    </div>
                                  );
                                })}
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: C.info, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Total Pay</div>
                                  <div style={{ fontSize: 15, fontWeight: 700, color: C.info }}>{formatDollar(Number(se.totalPay))}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
