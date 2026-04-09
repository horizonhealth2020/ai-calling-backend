"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
import {
  Card,
  EmptyState,
  AnimatedNumber,
  ToastProvider,
  useToast,
  DateRangeFilter,
  KPI_PRESETS,
  spacing,
  colors,
  typography,
  motion,
  baseInputStyle,
  baseThStyle,
  baseTdStyle,
  baseCardStyle,
  baseLabelStyle,
  baseButtonStyle,
  radius,
  ConfirmModal,
} from "@ops/ui";
import type { DateRangeFilterValue } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar, formatDate } from "@ops/utils";
import { ChevronUp, ChevronDown, X, Search, Filter, Download } from "lucide-react";

type SocketClient = import("socket.io-client").Socket;

/* -- Style Constants -- */

const SECTION_HEADING: React.CSSProperties = {
  margin: `0 0 ${spacing[4]}px`,
  fontSize: 16,
  fontWeight: 600,
  color: colors.textPrimary,
};

const TICKER_VALUE: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: colors.danger,
  lineHeight: "1.2",
};

const TICKER_LABEL: React.CSSProperties = {
  ...typography.sizes.xs,
  fontWeight: 700,
  color: colors.textTertiary,
  textTransform: "uppercase" as const,
  letterSpacing: typography.tracking.caps,
  marginBottom: spacing[2],
  display: "block",
};

const TICKER_SUB: React.CSSProperties = {
  ...typography.sizes.sm,
  color: colors.textSecondary,
  marginTop: spacing[1],
  display: "block",
};

/* -- Props -- */

interface CSTrackingProps {
  socket: SocketClient | null;
  API: string;
  userRoles: string[];
  canManageCS: boolean;
}

/* -- Sort Header -- */

function SortHeader({ label, sortKey, currentSort, currentDir, onSort }: {
  label: string;
  sortKey: string;
  currentSort: string | null;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  return (
    <th
      style={{ ...baseThStyle, cursor: "pointer", userSelect: "none" }}
      onClick={() => onSort(sortKey)}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {currentSort === sortKey && (
          currentDir === "asc"
            ? <ChevronUp size={12} />
            : <ChevronDown size={12} />
        )}
      </span>
    </th>
  );
}

/* -- Date range helper -- */

function buildDateParams(dr: DateRangeFilterValue): string {
  if (dr.preset === "custom" && dr.from && dr.to) return `&range=custom&from=${dr.from}&to=${dr.to}`;
  if (dr.preset && dr.preset !== "custom") return `&range=${dr.preset}`;
  return "";
}

/* -- Types -- */

type Chargeback = {
  id: string;
  postedDate: string | null;
  chargebackAmount: string | null;
  totalAmount: string | null;
  product: string | null;
  type: string | null;
  memberCompany: string | null;
  memberAgentCompany: string | null;
  memberId: string | null;
  payeeName: string | null;
  memberAgentId: string | null;
  assignedTo: string | null;
  matchStatus: string | null;
  submittedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionType: string | null;
  resolutionNote: string | null;
  resolver: { name: string } | null;
  agentName: string | null;
  notes: string | null;
  resolution: string | null;
};

type PendingTerm = {
  id: string;
  memberName: string | null;
  memberId: string | null;
  phone: string | null;
  agentName: string | null;
  agentIdField: string | null;
  state: string | null;
  product: string | null;
  holdReason: string | null;
  holdDate: string | null;
  nextBilling: string | null;
  assignedTo: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionType: string | null;
  resolutionNote: string | null;
  resolver: { name: string } | null;
  notes: string | null;
  resolution: string | null;
  sale: { saleDate: string | null; premium: number | null } | null;
};

/* -- Main Component -- */

export default function CSTracking({ socket, API, userRoles, canManageCS }: CSTrackingProps) {
  return (
    <ToastProvider>
      <TrackingTabInner socket={socket} API={API} userRoles={userRoles} canManageCS={canManageCS} />
    </ToastProvider>
  );
}

function TrackingTabInner({ socket, API, userRoles, canManageCS }: CSTrackingProps) {
  /* ── Confirm modal state ─────────────────────────────────── */
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; message: string;
    variant: "primary" | "danger"; confirmLabel: string;
    loading: boolean; onConfirm: () => Promise<void> | void;
  }>({ open: false, title: "", message: "", variant: "primary", confirmLabel: "Confirm", loading: false, onConfirm: () => {} });

  function requestConfirm(title: string, message: string, variant: "primary" | "danger", confirmLabel: string, action: () => Promise<void> | void) {
    setConfirmState({ open: true, title, message, variant, confirmLabel, loading: false, onConfirm: action });
  }
  async function handleConfirm() {
    setConfirmState(s => ({ ...s, loading: true }));
    try { await confirmState.onConfirm(); } finally { setConfirmState(s => ({ ...s, open: false, loading: false })); }
  }

  const [dateRange, setDateRange] = useState<DateRangeFilterValue>({ preset: "week" });
  // Data
  const [chargebacks, setChargebacks] = useState<Chargeback[]>([]);
  const [pendingTerms, setPendingTerms] = useState<PendingTerm[]>([]);
  const [totals, setTotals] = useState<{ totalChargebacks: number; totalRecovered: number; recordCount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Search (shared between both tables)
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Chargeback filters
  const [cbFiltersOpen, setCbFiltersOpen] = useState(false);
  const [cbFilters, setCbFilters] = useState({
    dateFrom: "", dateTo: "", product: "", memberCompany: "", memberAgentCompany: "", amountMin: "", amountMax: "",
  });

  // Chargeback sort (default: submittedAt desc)
  const [cbSortKey, setCbSortKey] = useState<string>("submittedAt");
  const [cbSortDir, setCbSortDir] = useState<"asc" | "desc">("desc");

  // Pending terms filters
  const [ptFiltersOpen, setPtFiltersOpen] = useState(false);
  const [ptFilters, setPtFilters] = useState({
    agent: "", state: "", product: "", holdReason: "", dateFrom: "", dateTo: "",
  });

  // Pending terms sort (default: holdDate desc)
  const [ptSortKey, setPtSortKey] = useState<string>("holdDate");
  const [ptSortDir, setPtSortDir] = useState<"asc" | "desc">("desc");

  // Status filter (Open / Resolved / All)
  type StatusFilter = "open" | "resolved" | "all";
  const [cbStatusFilter, setCbStatusFilter] = useState<StatusFilter>("open");
  const [ptStatusFilter, setPtStatusFilter] = useState<StatusFilter>("open");

  // Resolve panel state
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [resolveType, setResolveType] = useState<string>("");

  const { toast } = useToast();

  // Data fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    const dp = buildDateParams(dateRange);
    try {
      const [totalsRes, cbRes, ptRes] = await Promise.all([
        authFetch(`${API}/api/chargebacks/totals?_=1${dp}`),
        authFetch(`${API}/api/chargebacks?_=1${dp}`),
        authFetch(`${API}/api/pending-terms?_=1${dp}`),
      ]);
      if (totalsRes.ok) setTotals(await totalsRes.json());
      if (cbRes.ok) setChargebacks(await cbRes.json());
      if (ptRes.ok) setPendingTerms(await ptRes.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [API, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Socket.IO: auto-refresh when CS data changes (via socket prop from context)
  useEffect(() => {
    if (!socket) return;
    const handler = () => { fetchData(); };
    socket.on("cs:changed", handler);
    return () => { socket.off("cs:changed", handler); };
  }, [socket, fetchData]);

  // Chargeback filter/search/sort pipeline
  const filteredChargebacks = useMemo(() => {
    let result = chargebacks;

    // Status filter (before other filters)
    if (cbStatusFilter === "open") result = result.filter((cb) => !cb.resolvedAt);
    else if (cbStatusFilter === "resolved") result = result.filter((cb) => !!cb.resolvedAt);

    // Search (case-insensitive partial match, debounced)
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((cb) =>
        (cb.payeeName || "").toLowerCase().includes(q) ||
        (cb.memberAgentCompany || "").toLowerCase().includes(q) ||
        (cb.memberId || "").toLowerCase().includes(q) ||
        (cb.memberAgentId || "").toLowerCase().includes(q)
      );
    }

    // Filters
    if (cbFilters.product) result = result.filter((cb) => (cb.product || "").toLowerCase().includes(cbFilters.product.toLowerCase()));
    if (cbFilters.memberCompany) result = result.filter((cb) => (cb.memberCompany || "").toLowerCase().includes(cbFilters.memberCompany.toLowerCase()));
    if (cbFilters.memberAgentCompany) result = result.filter((cb) => (cb.memberAgentCompany || "").toLowerCase().includes(cbFilters.memberAgentCompany.toLowerCase()));
    if (cbFilters.dateFrom) result = result.filter((cb) => cb.postedDate && cb.postedDate.split("T")[0] >= cbFilters.dateFrom);
    if (cbFilters.dateTo) result = result.filter((cb) => cb.postedDate && cb.postedDate.split("T")[0] <= cbFilters.dateTo);
    if (cbFilters.amountMin) result = result.filter((cb) => Math.abs(parseFloat(cb.chargebackAmount || "0")) >= parseFloat(cbFilters.amountMin));
    if (cbFilters.amountMax) result = result.filter((cb) => Math.abs(parseFloat(cb.chargebackAmount || "0")) <= parseFloat(cbFilters.amountMax));

    // Sort
    if (cbSortKey) {
      result = [...result].sort((a, b) => {
        let aVal: string | number = (a[cbSortKey as keyof Chargeback] as string) ?? "";
        let bVal: string | number = (b[cbSortKey as keyof Chargeback] as string) ?? "";
        if (cbSortKey === "chargebackAmount" || cbSortKey === "totalAmount") {
          aVal = parseFloat(aVal as string) || 0;
          bVal = parseFloat(bVal as string) || 0;
        }
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return cbSortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [chargebacks, debouncedSearch, cbFilters, cbSortKey, cbSortDir, cbStatusFilter]);

  // Pending terms filter + search + sort pipeline
  const filteredPending = useMemo(() => {
    let result = pendingTerms;

    // Status filter (before other filters)
    if (ptStatusFilter === "open") result = result.filter((pt) => !pt.resolvedAt);
    else if (ptStatusFilter === "resolved") result = result.filter((pt) => !!pt.resolvedAt);

    // Shared search (case-insensitive partial match, debounced)
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((pt) =>
        (pt.memberName || "").toLowerCase().includes(q) ||
        (pt.memberId || "").toLowerCase().includes(q) ||
        (pt.agentName || "").toLowerCase().includes(q) ||
        (pt.agentIdField || "").toLowerCase().includes(q) ||
        (pt.phone || "").toLowerCase().includes(q)
      );
    }

    // Pending terms filters
    if (ptFilters.agent) result = result.filter((pt) => (pt.agentName || "").toLowerCase().includes(ptFilters.agent.toLowerCase()));
    if (ptFilters.state) result = result.filter((pt) => (pt.state || "").toLowerCase().includes(ptFilters.state.toLowerCase()));
    if (ptFilters.product) result = result.filter((pt) => (pt.product || "").toLowerCase().includes(ptFilters.product.toLowerCase()));
    if (ptFilters.holdReason) result = result.filter((pt) => (pt.holdReason || "").toLowerCase().includes(ptFilters.holdReason.toLowerCase()));
    if (ptFilters.dateFrom) {
      result = result.filter((pt) =>
        (pt.holdDate && pt.holdDate.split("T")[0] >= ptFilters.dateFrom) ||
        (pt.nextBilling && pt.nextBilling.split("T")[0] >= ptFilters.dateFrom)
      );
    }
    if (ptFilters.dateTo) {
      result = result.filter((pt) =>
        (pt.holdDate && pt.holdDate.split("T")[0] <= ptFilters.dateTo) ||
        (pt.nextBilling && pt.nextBilling.split("T")[0] <= ptFilters.dateTo)
      );
    }

    // Sort
    if (ptSortKey) {
      result = [...result].sort((a, b) => {
        const aVal = (a[ptSortKey as keyof PendingTerm] as string) ?? "";
        const bVal = (b[ptSortKey as keyof PendingTerm] as string) ?? "";
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return ptSortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [pendingTerms, debouncedSearch, ptFilters, ptSortKey, ptSortDir, ptStatusFilter]);

  // Summary bar stats (computed from FULL unfiltered dataset, not filtered)
  const ptSummary = useMemo(() => {
    const total = pendingTerms.length;
    const reasonCounts = new Map<string, number>();
    pendingTerms.forEach((pt) => {
      const reason = pt.holdReason || "No Reason";
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    });

    return {
      total,
      reasons: Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1]),
    };
  }, [pendingTerms]);

  // Delete handler
  const handleDeleteCb = async (id: string) => {
    try {
      const res = await authFetch(`${API}/api/chargebacks/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setChargebacks((prev) => prev.filter((cb) => cb.id !== id));
        toast("success", "Chargeback deleted");
        const totalsRes = await authFetch(`${API}/api/chargebacks/totals`);
        if (totalsRes.ok) setTotals(await totalsRes.json());
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error || `Delete failed (${res.status})`);
      }
    } catch { toast("error", "Delete request failed"); }
  };

  // Delete pending term handler
  const handleDeletePt = async (id: string) => {
    try {
      const res = await authFetch(`${API}/api/pending-terms/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setPendingTerms((prev) => prev.filter((pt) => pt.id !== id));
      }
    } catch { toast("error", "Failed to delete pending term"); }
  };

  // Resolve/Unresolve handlers
  const handleResolveCb = async (id: string) => {
    if (!resolveType || !resolveNote.trim()) return;
    const prev = chargebacks.find((cb) => cb.id === id);
    setChargebacks(cs => cs.map((cb) => cb.id === id ? {
      ...cb,
      resolvedAt: new Date().toISOString(),
      resolvedBy: "you",
      resolutionType: resolveType,
      resolutionNote: resolveNote.trim(),
      resolver: { name: "You" },
    } : cb));
    setExpandedRowId(null);
    setResolveNote("");
    setResolveType("");
    try {
      const res = await authFetch(`${API}/api/chargebacks/${id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionType: resolveType, resolutionNote: resolveNote.trim() }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setChargebacks(cs => cs.map((cb) => cb.id === id ? { ...cb, ...updated } : cb));
      const totalsRes = await authFetch(`${API}/api/chargebacks/totals`);
      if (totalsRes.ok) setTotals(await totalsRes.json());
      toast("success", `Chargeback marked as ${resolveType}`);
    } catch {
      if (prev) setChargebacks(cs => cs.map((cb) => cb.id === id ? prev : cb));
      toast("error", "Failed to resolve -- try again");
    }
  };

  const handleUnresolveCb = async (id: string) => {
    const prev = chargebacks.find((cb) => cb.id === id);
    setChargebacks(cs => cs.map((cb) => cb.id === id ? {
      ...cb, resolvedAt: null, resolvedBy: null, resolutionType: null, resolutionNote: null, resolver: null,
    } : cb));
    try {
      const res = await authFetch(`${API}/api/chargebacks/${id}/unresolve`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      const totalsRes = await authFetch(`${API}/api/chargebacks/totals`);
      if (totalsRes.ok) setTotals(await totalsRes.json());
      toast("success", "Resolution cleared");
    } catch {
      if (prev) setChargebacks(cs => cs.map((cb) => cb.id === id ? prev : cb));
      toast("error", "Failed to clear resolution -- try again");
    }
  };

  const handleResolvePt = async (id: string) => {
    if (!resolveType || !resolveNote.trim()) return;
    const prev = pendingTerms.find((pt) => pt.id === id);
    setPendingTerms(pts => pts.map((pt) => pt.id === id ? {
      ...pt,
      resolvedAt: new Date().toISOString(),
      resolvedBy: "you",
      resolutionType: resolveType,
      resolutionNote: resolveNote.trim(),
      resolver: { name: "You" },
    } : pt));
    setExpandedRowId(null);
    setResolveNote("");
    setResolveType("");
    try {
      const res = await authFetch(`${API}/api/pending-terms/${id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionType: resolveType, resolutionNote: resolveNote.trim() }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setPendingTerms(pts => pts.map((pt) => pt.id === id ? { ...pt, ...updated } : pt));
      toast("success", `Pending term marked as ${resolveType}`);
    } catch {
      if (prev) setPendingTerms(pts => pts.map((pt) => pt.id === id ? prev : pt));
      toast("error", "Failed to resolve -- try again");
    }
  };

  const handleUnresolvePt = async (id: string) => {
    const prev = pendingTerms.find((pt) => pt.id === id);
    setPendingTerms(pts => pts.map((pt) => pt.id === id ? {
      ...pt, resolvedAt: null, resolvedBy: null, resolutionType: null, resolutionNote: null, resolver: null,
    } : pt));
    try {
      const res = await authFetch(`${API}/api/pending-terms/${id}/unresolve`, { method: "PATCH" });
      if (!res.ok) throw new Error();
      toast("success", "Resolution cleared");
    } catch {
      if (prev) setPendingTerms(pts => pts.map((pt) => pt.id === id ? prev : pt));
      toast("error", "Failed to clear resolution -- try again");
    }
  };

  // Sort toggle handler
  const handleCbSort = (key: string) => {
    if (cbSortKey === key) {
      setCbSortDir(cbSortDir === "asc" ? "desc" : "asc");
    } else {
      setCbSortKey(key);
      setCbSortDir("asc");
    }
  };

  // Clear filters helper
  const hasCbFilters = Object.values(cbFilters).some(v => v !== "");
  const clearCbFilters = () => setCbFilters({ dateFrom: "", dateTo: "", product: "", memberCompany: "", memberAgentCompany: "", amountMin: "", amountMax: "" });

  // Pending terms sort handler
  const handlePtSort = (key: string) => {
    if (ptSortKey === key) {
      setPtSortDir(ptSortDir === "asc" ? "desc" : "asc");
    } else {
      setPtSortKey(key);
      setPtSortDir("asc");
    }
  };

  const hasPtFilters = Object.values(ptFilters).some(v => v !== "");
  const clearPtFilters = () => setPtFilters({ agent: "", state: "", product: "", holdReason: "", dateFrom: "", dateTo: "" });

  // Role check
  const canExport = canManageCS;

  // Export date filter
  const [exportDateFilter, setExportDateFilter] = useState<DateRangeFilterValue>({ preset: "30d" });

  function filterByDateRange<T extends Record<string, unknown>>(data: T[], dateField: string, filter: DateRangeFilterValue): T[] {
    let from: Date | null = null;
    let to: Date | null = null;
    if (filter.preset === "custom" && filter.from && filter.to) {
      from = new Date(filter.from + "T00:00:00");
      to = new Date(filter.to + "T23:59:59.999");
    } else if (filter.preset === "week") {
      const now = new Date();
      const day = now.getDay();
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      to = new Date(); to.setHours(23, 59, 59, 999);
    } else if (filter.preset === "last_week") {
      const now = new Date();
      const day = now.getDay();
      const thisSunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
      from = new Date(thisSunday); from.setDate(from.getDate() - 7);
      to = new Date(thisSunday); to.setMilliseconds(-1);
    } else if (filter.preset === "7d") {
      from = new Date(); from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0);
      to = new Date(); to.setHours(23, 59, 59, 999);
    } else if (filter.preset === "30d") {
      from = new Date(); from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0);
      to = new Date(); to.setHours(23, 59, 59, 999);
    } else if (filter.preset === "month") {
      from = new Date(); from.setDate(1); from.setHours(0, 0, 0, 0);
      to = new Date(); to.setHours(23, 59, 59, 999);
    }
    if (!from || !to) return data;
    return data.filter(item => {
      const raw = item[dateField] as string | null | undefined;
      if (!raw) return false;
      const d = new Date(raw);
      return d >= from! && d <= to!;
    });
  }

  // CSV Export
  const exportCSV = () => {
    const esc = (v: string) => v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    const rows: string[][] = [];

    const exportCbs = filterByDateRange(filteredChargebacks, "postedDate", exportDateFilter);
    const exportPts = filterByDateRange(filteredPending, "holdDate", exportDateFilter);

    rows.push(["--- CHARGEBACKS ---"]);
    rows.push(["Date Posted", "Member", "Member ID", "Product", "Type", "Total", "Assigned To", "Match Status", "Submitted"]);
    exportCbs.forEach((cb) => {
      rows.push([
        esc(formatDate(cb.postedDate)),
        esc(cb.memberCompany || "--"),
        esc(cb.memberId || "--"),
        esc(cb.product || "--"),
        esc(cb.type || "--"),
        esc(cb.chargebackAmount ? formatDollar(parseFloat(cb.chargebackAmount)) : "--"),
        esc(cb.assignedTo || "Unassigned"),
        esc(cb.matchStatus || "--"),
        esc(formatDate(cb.submittedAt)),
      ]);
    });

    rows.push([]);
    rows.push(["--- PENDING TERMS ---"]);
    rows.push(["Member Name", "Member ID", "Phone", "Product", "Hold Date", "Next Billing", "Assigned To"]);
    exportPts.forEach((pt) => {
      rows.push([
        esc(pt.memberName || "--"),
        esc(pt.memberId || "--"),
        esc(pt.phone || "--"),
        esc(pt.product || "--"),
        esc(formatDate(pt.holdDate)),
        esc(formatDate(pt.nextBilling)),
        esc(pt.assignedTo || "Unassigned"),
      ]);
    });

    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })),
      download: `cs-tracking-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${spacing[6]}px` }}>
      {/* Date Range Filter */}
      <DateRangeFilter value={dateRange} onChange={setDateRange} presets={KPI_PRESETS} />

      {/* KPI Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: `${spacing[4]}px` }}>
        {/* Total Chargebacks */}
        <Card style={{ ...baseCardStyle, background: colors.dangerBg }}>
          <span style={TICKER_LABEL}>TOTAL CHARGEBACKS</span>
          <div style={{ ...TICKER_VALUE, color: colors.danger }}>
            <AnimatedNumber value={totals?.totalChargebacks ?? 0} decimals={2} prefix="$" duration={600} />
          </div>
          <span style={TICKER_SUB}>{totals?.recordCount ?? 0} records</span>
        </Card>

        {/* Total Recovered */}
        <Card style={{ ...baseCardStyle, background: colors.successBg }}>
          <span style={TICKER_LABEL}>TOTAL RECOVERED</span>
          <div style={{ ...TICKER_VALUE, color: colors.success }}>
            <AnimatedNumber value={totals?.totalRecovered ?? 0} decimals={2} prefix="$" duration={600} />
          </div>
          <span style={TICKER_SUB}>resolution tracking</span>
        </Card>

        {/* Net Exposure */}
        <Card style={{ ...baseCardStyle, background: (totals?.totalChargebacks ?? 0) > 0 ? colors.dangerBg : colors.successBg }}>
          <span style={TICKER_LABEL}>NET EXPOSURE</span>
          <div style={{ ...TICKER_VALUE, color: (totals?.totalChargebacks ?? 0) > 0 ? colors.danger : colors.success }}>
            <AnimatedNumber value={(totals?.totalChargebacks ?? 0) - (totals?.totalRecovered ?? 0)} decimals={2} prefix="$" duration={600} />
          </div>
          <span style={TICKER_SUB}>chargebacks - recovered</span>
        </Card>

        {/* Records */}
        <Card style={baseCardStyle}>
          <span style={TICKER_LABEL}>RECORDS</span>
          <div style={{ ...TICKER_VALUE, color: colors.textPrimary }}>
            <AnimatedNumber value={totals?.recordCount ?? 0} decimals={0} duration={600} />
          </div>
          <span style={TICKER_SUB}>all submissions</span>
        </Card>
      </div>

      {/* Search + Filter + Export row */}
      <div style={{ display: "flex", gap: `${spacing[2]}px`, alignItems: "center" }}>
        {/* Search input */}
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, pointerEvents: "none" }} />
          <input
            style={{ ...baseInputStyle, paddingLeft: 36, width: "100%" }}
            placeholder="Search by name, ID, company, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              aria-label="Clear search"
              onClick={() => setSearchTerm("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: colors.textMuted, padding: 2, display: "flex", alignItems: "center" }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => { setCbFiltersOpen(!cbFiltersOpen); setPtFiltersOpen(!ptFiltersOpen); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${colors.borderDefault}`, borderRadius: radius.md, padding: "8px 12px", color: colors.textSecondary, cursor: "pointer", fontSize: 13 }}
        >
          <Filter size={14} />
          Filters
          {(cbFiltersOpen || ptFiltersOpen) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Export date range + CSV */}
        {canExport && (
          <>
            <DateRangeFilter value={exportDateFilter} onChange={setExportDateFilter} presets={KPI_PRESETS} />
            <button
              onClick={exportCSV}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${colors.borderDefault}`, borderRadius: radius.md, padding: "8px 12px", color: colors.textSecondary, cursor: "pointer", fontSize: 13, flexShrink: 0 }}
            >
              <Download size={14} /> Export CSV
            </button>
          </>
        )}
      </div>

      {/* Chargeback Filter Panel */}
      {cbFiltersOpen && (
        <div style={{ background: colors.bgSurfaceInset, borderRadius: radius.lg, padding: `${spacing[4]}px`, marginTop: `${spacing[2]}px` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={baseLabelStyle}>Chargeback Filters</span>
            {hasCbFilters && (
              <button onClick={clearCbFilters} style={{ background: "transparent", border: "none", color: colors.accentTeal, cursor: "pointer", fontSize: 12 }}>
                Clear Filters
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: `${spacing[4]}px`, marginTop: `${spacing[2]}px` }}>
            <div>
              <label style={baseLabelStyle}>Date From</label>
              <input type="date" style={baseInputStyle} value={cbFilters.dateFrom} onChange={(e) => setCbFilters({ ...cbFilters, dateFrom: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Date To</label>
              <input type="date" style={baseInputStyle} value={cbFilters.dateTo} onChange={(e) => setCbFilters({ ...cbFilters, dateTo: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Product</label>
              <input type="text" style={baseInputStyle} placeholder="Filter by product" value={cbFilters.product} onChange={(e) => setCbFilters({ ...cbFilters, product: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Member Company</label>
              <input type="text" style={baseInputStyle} placeholder="Filter by company" value={cbFilters.memberCompany} onChange={(e) => setCbFilters({ ...cbFilters, memberCompany: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Member Agent Company</label>
              <input type="text" style={baseInputStyle} placeholder="Filter by agent company" value={cbFilters.memberAgentCompany} onChange={(e) => setCbFilters({ ...cbFilters, memberAgentCompany: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Amount Min ($)</label>
              <input type="number" style={baseInputStyle} placeholder="Min amount" value={cbFilters.amountMin} onChange={(e) => setCbFilters({ ...cbFilters, amountMin: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Amount Max ($)</label>
              <input type="number" style={baseInputStyle} placeholder="Max amount" value={cbFilters.amountMax} onChange={(e) => setCbFilters({ ...cbFilters, amountMax: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {/* Pending Terms Filter Panel */}
      {ptFiltersOpen && (
        <div style={{
          background: colors.bgSurfaceInset,
          borderRadius: radius.lg,
          padding: `${spacing[4]}px`,
          marginTop: `${spacing[2]}px`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={baseLabelStyle}>Pending Terms Filters</span>
            {hasPtFilters && (
              <button onClick={clearPtFilters} style={{ background: "transparent", border: "none", color: colors.accentTeal, cursor: "pointer", fontSize: 12 }}>
                Clear Filters
              </button>
            )}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: `${spacing[4]}px`,
            marginTop: `${spacing[2]}px`,
          }}>
            <div>
              <label style={baseLabelStyle}>Agent</label>
              <input style={baseInputStyle} type="text" placeholder="Filter by agent" value={ptFilters.agent} onChange={e => setPtFilters({ ...ptFilters, agent: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>State</label>
              <input style={baseInputStyle} type="text" placeholder="Filter by state" value={ptFilters.state} onChange={e => setPtFilters({ ...ptFilters, state: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Product</label>
              <input style={baseInputStyle} type="text" placeholder="Filter by product" value={ptFilters.product} onChange={e => setPtFilters({ ...ptFilters, product: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Hold Reason</label>
              <input style={baseInputStyle} type="text" placeholder="Keyword" value={ptFilters.holdReason} onChange={e => setPtFilters({ ...ptFilters, holdReason: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Date From</label>
              <input style={baseInputStyle} type="date" value={ptFilters.dateFrom} onChange={e => setPtFilters({ ...ptFilters, dateFrom: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Date To</label>
              <input style={baseInputStyle} type="date" value={ptFilters.dateTo} onChange={e => setPtFilters({ ...ptFilters, dateTo: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {/* Chargeback Table */}
      <Card>
        <h3 style={SECTION_HEADING}>Chargeback Tracking</h3>

        {/* Status Pill Toggle */}
        <div style={{ display: "flex", gap: spacing[2], marginBottom: spacing[4] }}>
          {(["open", "resolved", "all"] as const).map(s => (
            <button
              key={s}
              onClick={() => setCbStatusFilter(s)}
              style={{
                background: cbStatusFilter === s ? colors.primary500 : "transparent",
                color: cbStatusFilter === s ? colors.textInverse : colors.textSecondary,
                border: cbStatusFilter === s ? "1px solid transparent" : `1px solid ${colors.borderDefault}`,
                fontWeight: cbStatusFilter === s ? typography.weights.bold : typography.weights.normal,
                fontSize: typography.sizes.sm.fontSize,
                borderRadius: radius.full,
                padding: "8px 16px",
                cursor: "pointer",
                transition: `all ${motion.duration.fast} ${motion.easing.out}`,
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {error ? (
          <EmptyState title="Failed to Load Records" description="Check your connection and reload the page. If the problem continues, contact your administrator." />
        ) : chargebacks.length === 0 && !loading ? (
          <EmptyState title="No Chargebacks Yet" description="Chargeback records will appear here once submissions are processed." />
        ) : filteredChargebacks.length === 0 && chargebacks.length > 0 ? (
          <EmptyState
            title={cbStatusFilter === "open" ? "No open chargebacks" : cbStatusFilter === "resolved" ? "No resolved chargebacks" : "No chargebacks recorded"}
            description="Try changing the status filter or adjusting your search criteria."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <SortHeader label="Date Posted" sortKey="postedDate" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Member" sortKey="memberCompany" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Member ID" sortKey="memberId" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Product" sortKey="product" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Type" sortKey="type" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Total" sortKey="chargebackAmount" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Assigned To" sortKey="assignedTo" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Match" sortKey="matchStatus" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Submitted" sortKey="submittedAt" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <th style={{ ...baseThStyle, width: 160 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredChargebacks.map((cb) => {
                  const cbColCount = 10;
                  return (
                    <React.Fragment key={cb.id}>
                      <tr style={{ opacity: cb.resolvedAt ? 0.5 : 1 }}>
                        <td style={baseTdStyle}>{formatDate(cb.postedDate)}</td>
                        <td style={{ ...baseTdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cb.memberCompany || "--"}</td>
                        <td style={baseTdStyle}>{cb.memberId || "--"}</td>
                        <td style={{ ...baseTdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cb.product || "--"}</td>
                        <td style={baseTdStyle}>{cb.type || "--"}</td>
                        <td style={{ ...baseTdStyle, color: colors.danger }}>{cb.chargebackAmount ? formatDollar(parseFloat(cb.chargebackAmount)) : "--"}</td>
                        <td style={baseTdStyle}>{cb.assignedTo || "Unassigned"}</td>
                        <td style={baseTdStyle}>
                          {cb.matchStatus === "MATCHED" ? (
                            <span style={{ color: colors.success, fontSize: typography.sizes.xs.fontSize, fontWeight: typography.weights.bold }}>
                              Matched
                            </span>
                          ) : cb.matchStatus === "MULTIPLE" ? (
                            <span style={{ color: colors.warning, fontSize: typography.sizes.xs.fontSize, fontWeight: typography.weights.bold }}>
                              Review
                            </span>
                          ) : cb.matchStatus === "UNMATCHED" ? (
                            <span style={{ color: colors.danger, fontSize: typography.sizes.xs.fontSize, fontWeight: typography.weights.bold }}>
                              No Match
                            </span>
                          ) : (
                            <span style={{ color: colors.textTertiary, fontSize: typography.sizes.xs.fontSize }}>--</span>
                          )}
                        </td>
                        <td style={baseTdStyle}>{formatDate(cb.submittedAt)}</td>
                        <td style={baseTdStyle}>
                          {!cb.resolvedAt ? (
                            <button
                              onClick={() => { setExpandedRowId(expandedRowId === cb.id ? null : cb.id); setResolveNote(""); setResolveType(""); }}
                              style={{ color: colors.primary500, background: "transparent", border: "none", cursor: "pointer", fontSize: typography.sizes.sm.fontSize, fontWeight: typography.weights.bold, padding: 0 }}
                            >Resolve</button>
                          ) : (
                            <div>
                              <span style={{
                                fontSize: typography.sizes.xs.fontSize,
                                fontWeight: typography.weights.bold,
                                textTransform: "uppercase" as const,
                                letterSpacing: "0.06em",
                                borderRadius: radius.full,
                                padding: "4px 8px",
                                color: cb.resolutionType === "recovered" ? colors.success : colors.danger,
                                background: cb.resolutionType === "recovered" ? colors.successBg : colors.dangerBg,
                              }}>
                                {cb.resolutionType}
                              </span>
                              <div style={{ fontSize: typography.sizes.xs.fontSize, color: colors.textTertiary, lineHeight: typography.sizes.xs.lineHeight, marginTop: 4 }}>
                                Resolved by {cb.resolver?.name || "Unknown"} | {formatDate(cb.resolvedAt)}
                              </div>
                              {cb.resolutionNote && (
                                <div style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, fontStyle: "italic" }}>
                                  {cb.resolutionNote}
                                </div>
                              )}
                              <button onClick={() => requestConfirm("Unresolve Chargeback", "This will move the chargeback back to active tracking. Continue?", "danger", "Unresolve", () => handleUnresolveCb(cb.id))} style={{
                                color: colors.textTertiary, background: "transparent", border: "none",
                                cursor: "pointer", fontSize: typography.sizes.sm.fontSize, padding: 0, marginTop: 4,
                              }}>Unresolve</button>
                            </div>
                          )}
                          {canManageCS && !cb.resolvedAt && (
                            <button
                              onClick={() => requestConfirm("Delete Chargeback", "Permanently delete this chargeback record?", "danger", "Delete", () => handleDeleteCb(cb.id))}
                              aria-label="Delete record"
                              style={{
                                background: "transparent", border: "none", cursor: "pointer",
                                color: colors.textMuted, padding: 4, display: "inline-flex", alignItems: "center", marginLeft: 8,
                              }}
                              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = colors.danger; }}
                              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = colors.textMuted; }}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedRowId === cb.id && (
                        <tr>
                          <td colSpan={cbColCount} style={{ padding: 0, border: "none" }}>
                            <div style={{
                              padding: spacing[5],
                              background: colors.bgSurfaceInset,
                              borderTop: `1px solid ${colors.borderSubtle}`,
                              display: "flex",
                              flexDirection: "column" as const,
                              gap: spacing[4],
                            }}>
                              <label style={baseLabelStyle}>Resolution Type</label>
                              <div style={{ display: "flex", gap: spacing[2] }}>
                                {["recovered", "closed"].map(t => (
                                  <button key={t} onClick={() => setResolveType(t)} style={{
                                    background: resolveType === t
                                      ? (t === "recovered" ? colors.successBg : colors.dangerBg)
                                      : "transparent",
                                    color: resolveType === t
                                      ? (t === "recovered" ? colors.success : colors.danger)
                                      : colors.textSecondary,
                                    border: resolveType === t
                                      ? `1px solid ${t === "recovered" ? colors.success : colors.danger}`
                                      : `1px solid ${colors.borderDefault}`,
                                    borderRadius: radius.full,
                                    padding: "8px 16px",
                                    fontSize: typography.sizes.sm.fontSize,
                                    fontWeight: typography.weights.bold,
                                    cursor: "pointer",
                                    transition: `all ${motion.duration.fast} ${motion.easing.out}`,
                                  }}>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                  </button>
                                ))}
                              </div>
                              <label style={baseLabelStyle}>Resolution Note</label>
                              <textarea
                                value={resolveNote}
                                onChange={e => setResolveNote(e.target.value)}
                                placeholder="Describe the resolution outcome..."
                                style={{ ...baseInputStyle, minHeight: 80, resize: "vertical" as const }}
                              />
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing[2] }}>
                                <button onClick={() => { setExpandedRowId(null); setResolveNote(""); setResolveType(""); }}
                                  style={{ ...baseButtonStyle, background: "transparent", color: colors.textSecondary, border: `1px solid ${colors.borderDefault}` }}>
                                  Discard
                                </button>
                                <button
                                  onClick={() => handleResolveCb(cb.id)}
                                  disabled={!resolveType || !resolveNote.trim()}
                                  style={{
                                    ...baseButtonStyle,
                                    background: (!resolveType || !resolveNote.trim()) ? colors.bgSurfaceInset : colors.primary500,
                                    color: (!resolveType || !resolveNote.trim()) ? colors.textMuted : colors.textInverse,
                                    cursor: (!resolveType || !resolveNote.trim()) ? "not-allowed" : "pointer",
                                    opacity: (!resolveType || !resolveNote.trim()) ? 0.5 : 1,
                                  }}>
                                  Save Resolution
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pending Terms Summary Bar */}
      <Card style={{ padding: `${spacing[4]}px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: `${spacing[6]}px`, flexWrap: "wrap" }}>
          {/* Total */}
          <div>
            <span style={TICKER_LABEL}>TOTAL PENDING</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: colors.textPrimary }}>{ptSummary.total}</div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 40, background: colors.borderSubtle }} />

          {/* Hold reason categories */}
          <div style={{ display: "flex", gap: `${spacing[2]}px`, flexWrap: "wrap", flex: 1 }}>
            {ptSummary.reasons.map(([reason, count]) => (
              <span key={reason} style={{
                display: "inline-block",
                padding: "4px 10px",
                background: colors.bgSurfaceInset,
                borderRadius: radius.md,
                fontSize: 12,
                color: colors.textSecondary,
              }}>
                {reason.toUpperCase()}: {count}
              </span>
            ))}
          </div>

        </div>
      </Card>

      {/* Pending Terms Table */}
      <Card>
        <h3 style={SECTION_HEADING}>Pending Terms Tracking</h3>

        {/* Status Pill Toggle */}
        <div style={{ display: "flex", gap: spacing[2], marginBottom: spacing[4] }}>
          {(["open", "resolved", "all"] as const).map(s => (
            <button
              key={s}
              onClick={() => setPtStatusFilter(s)}
              style={{
                background: ptStatusFilter === s ? colors.primary500 : "transparent",
                color: ptStatusFilter === s ? colors.textInverse : colors.textSecondary,
                border: ptStatusFilter === s ? "1px solid transparent" : `1px solid ${colors.borderDefault}`,
                fontWeight: ptStatusFilter === s ? typography.weights.bold : typography.weights.normal,
                fontSize: typography.sizes.sm.fontSize,
                borderRadius: radius.full,
                padding: "8px 16px",
                cursor: "pointer",
                transition: `all ${motion.duration.fast} ${motion.easing.out}`,
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {error ? (
          <EmptyState title="Failed to Load Records" description="Check your connection and reload the page. If the problem continues, contact your administrator." />
        ) : pendingTerms.length === 0 && !loading ? (
          <EmptyState title="No Pending Terms Yet" description="Pending terms records will appear here once submissions are processed." />
        ) : filteredPending.length === 0 && pendingTerms.length > 0 ? (
          <EmptyState
            title={ptStatusFilter === "open" ? "No pending terms to review" : ptStatusFilter === "resolved" ? "No resolved pending terms" : "No pending terms recorded"}
            description="Try changing the status filter or adjusting your search criteria."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <SortHeader label="Member Name" sortKey="memberName" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Member ID" sortKey="memberId" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Phone" sortKey="phone" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Product" sortKey="product" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Hold Date" sortKey="holdDate" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Next Billing" sortKey="nextBilling" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Assigned To" sortKey="assignedTo" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <th style={{ ...baseThStyle, width: 160 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.map((pt) => {
                  const ptColCount = 8;
                  return (
                    <React.Fragment key={pt.id}>
                      <tr style={{ opacity: pt.resolvedAt ? 0.5 : 1 }}>
                        <td style={baseTdStyle}>{pt.memberName || "--"}</td>
                        <td style={baseTdStyle}>{pt.memberId || "--"}</td>
                        <td style={baseTdStyle}>{pt.phone || "--"}</td>
                        <td style={{ ...baseTdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={pt.product || undefined}>{pt.product || "--"}</td>
                        <td style={{ ...baseTdStyle, color: colors.danger }}>{formatDate(pt.holdDate)}</td>
                        <td style={{ ...baseTdStyle, color: colors.success }}>{formatDate(pt.nextBilling)}</td>
                        <td style={baseTdStyle}>{pt.assignedTo || "Unassigned"}</td>
                        <td style={baseTdStyle}>
                          {!pt.resolvedAt ? (
                            <button
                              onClick={() => { setExpandedRowId(expandedRowId === pt.id ? null : pt.id); setResolveNote(""); setResolveType(""); }}
                              style={{ color: colors.primary500, background: "transparent", border: "none", cursor: "pointer", fontSize: typography.sizes.sm.fontSize, fontWeight: typography.weights.bold, padding: 0 }}
                            >Resolve</button>
                          ) : (
                            <div>
                              <span style={{
                                fontSize: typography.sizes.xs.fontSize,
                                fontWeight: typography.weights.bold,
                                textTransform: "uppercase" as const,
                                letterSpacing: "0.06em",
                                borderRadius: radius.full,
                                padding: "4px 8px",
                                color: pt.resolutionType === "saved" ? colors.success : colors.danger,
                                background: pt.resolutionType === "saved" ? colors.successBg : colors.dangerBg,
                              }}>
                                {pt.resolutionType}
                              </span>
                              <div style={{ fontSize: typography.sizes.xs.fontSize, color: colors.textTertiary, lineHeight: typography.sizes.xs.lineHeight, marginTop: 4 }}>
                                Resolved by {pt.resolver?.name || "Unknown"} | {formatDate(pt.resolvedAt)}
                              </div>
                              {pt.resolutionNote && (
                                <div style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, fontStyle: "italic" }}>
                                  {pt.resolutionNote}
                                </div>
                              )}
                              <button onClick={() => requestConfirm("Unresolve Pending Term", "This will move the pending term back to active tracking. Continue?", "danger", "Unresolve", () => handleUnresolvePt(pt.id))} style={{
                                color: colors.textTertiary, background: "transparent", border: "none",
                                cursor: "pointer", fontSize: typography.sizes.sm.fontSize, padding: 0, marginTop: 4,
                              }}>Unresolve</button>
                            </div>
                          )}
                          {canManageCS && !pt.resolvedAt && (
                            <button
                              onClick={() => requestConfirm("Delete Pending Term", "Permanently delete this pending term record?", "danger", "Delete", () => handleDeletePt(pt.id))}
                              aria-label="Delete record"
                              style={{
                                background: "transparent", border: "none", cursor: "pointer",
                                color: colors.textMuted, padding: 4, display: "inline-flex", alignItems: "center", marginLeft: 8,
                              }}
                              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = colors.danger; }}
                              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = colors.textMuted; }}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {expandedRowId === pt.id && (
                        <tr>
                          <td colSpan={ptColCount} style={{ padding: 0, border: "none" }}>
                            <div style={{
                              padding: spacing[5],
                              background: colors.bgSurfaceInset,
                              borderTop: `1px solid ${colors.borderSubtle}`,
                              display: "flex",
                              flexDirection: "column" as const,
                              gap: spacing[4],
                            }}>
                              <label style={baseLabelStyle}>Resolution Type</label>
                              <div style={{ display: "flex", gap: spacing[2] }}>
                                {["saved", "cancelled"].map(t => (
                                  <button key={t} onClick={() => setResolveType(t)} style={{
                                    background: resolveType === t
                                      ? (t === "saved" ? colors.successBg : colors.dangerBg)
                                      : "transparent",
                                    color: resolveType === t
                                      ? (t === "saved" ? colors.success : colors.danger)
                                      : colors.textSecondary,
                                    border: resolveType === t
                                      ? `1px solid ${t === "saved" ? colors.success : colors.danger}`
                                      : `1px solid ${colors.borderDefault}`,
                                    borderRadius: radius.full,
                                    padding: "8px 16px",
                                    fontSize: typography.sizes.sm.fontSize,
                                    fontWeight: typography.weights.bold,
                                    cursor: "pointer",
                                    transition: `all ${motion.duration.fast} ${motion.easing.out}`,
                                  }}>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                  </button>
                                ))}
                              </div>
                              <label style={baseLabelStyle}>Resolution Note</label>
                              <textarea
                                value={resolveNote}
                                onChange={e => setResolveNote(e.target.value)}
                                placeholder="Describe the resolution outcome..."
                                style={{ ...baseInputStyle, minHeight: 80, resize: "vertical" as const }}
                              />
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing[2] }}>
                                <button onClick={() => { setExpandedRowId(null); setResolveNote(""); setResolveType(""); }}
                                  style={{ ...baseButtonStyle, background: "transparent", color: colors.textSecondary, border: `1px solid ${colors.borderDefault}` }}>
                                  Discard
                                </button>
                                <button
                                  onClick={() => handleResolvePt(pt.id)}
                                  disabled={!resolveType || !resolveNote.trim()}
                                  style={{
                                    ...baseButtonStyle,
                                    background: (!resolveType || !resolveNote.trim()) ? colors.bgSurfaceInset : colors.primary500,
                                    color: (!resolveType || !resolveNote.trim()) ? colors.textMuted : colors.textInverse,
                                    cursor: (!resolveType || !resolveNote.trim()) ? "not-allowed" : "pointer",
                                    opacity: (!resolveType || !resolveNote.trim()) ? 0.5 : 1,
                                  }}>
                                  Save Resolution
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ConfirmModal open={confirmState.open} title={confirmState.title} message={confirmState.message} variant={confirmState.variant} confirmLabel={confirmState.confirmLabel} loading={confirmState.loading} onConfirm={handleConfirm} onCancel={() => setConfirmState(s => ({ ...s, open: false }))} />
    </div>
  );
}
