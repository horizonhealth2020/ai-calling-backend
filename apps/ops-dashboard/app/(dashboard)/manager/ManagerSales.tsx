"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Badge,
  Button,
  Card,
  AnimatedNumber,
  EmptyState,
  colors,
  spacing,
  radius,
  motion,
  baseInputStyle,
  baseLabelStyle,
  baseThStyle,
  baseTdStyle,
  semanticColors,
  colorAlpha,
  typography,
} from "@ops/ui";
import { authFetch, getToken } from "@ops/auth/client";
import { formatDollar, formatDate } from "@ops/utils";
import { useToast, ConfirmModal } from "@ops/ui";
import { HIGHLIGHT_GLOW } from "@ops/socket";
import {
  Edit3,
  Trash2,
  BarChart3,
  FileText,
} from "lucide-react";

/* -- Types -- */

type Agent = { id: string; name: string; email?: string; userId?: string; extension?: string; displayOrder: number; active?: boolean; auditEnabled?: boolean };
type Product = {
  id: string; name: string; active: boolean; type: "CORE" | "ADDON" | "AD_D";
  premiumThreshold?: number | null; commissionBelow?: number | null; commissionAbove?: number | null;
  bundledCommission?: number | null; standaloneCommission?: number | null; enrollFeeThreshold?: number | null; notes?: string | null;
};
type LeadSource = { id: string; name: string; listId?: string; costPerLead: number; active?: boolean; callBufferSeconds?: number };
type Sale = { id: string; saleDate: string; memberName: string; memberId?: string; carrier: string; premium: number; status: string; hasPendingStatusChange?: boolean; hasPendingEditRequest?: boolean; notes?: string; leadPhone?: string | null; acaCoveringSaleId?: string | null; acaAttached?: boolean; acaProductName?: string; agent: { id: string; name: string }; product: { id: string; name: string }; leadSource: { id: string; name: string } };

export interface ManagerSalesProps {
  API: string;
  agents: Agent[];
  products: Product[];
  leadSources: LeadSource[];
  salesList: Sale[];
  setSalesList: React.Dispatch<React.SetStateAction<Sale[]>>;
  highlightedSaleIds: Set<string>;
  onSalesChanged?: () => void;
}

/* -- Helpers -- */

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

/* -- Constants -- */

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const LBL: React.CSSProperties = { ...baseLabelStyle };

const PREVIEW_LABEL: React.CSSProperties = {
  fontSize: typography.sizes.xs.fontSize,
  fontWeight: 700,
  color: colors.textTertiary,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  marginBottom: spacing[2],
};

const EDIT_ROW_EXPANSION: React.CSSProperties = {
  background: colors.bgSurfaceRaised,
  borderTop: "1px solid rgba(255,255,255,0.04)",
  padding: "16px 16px",
};

const DIFF_OLD: React.CSSProperties = {
  fontSize: typography.sizes.base.fontSize,
  color: colors.textMuted,
  textDecoration: "line-through",
};

const DIFF_NEW: React.CSSProperties = {
  fontSize: typography.sizes.base.fontSize,
  color: colors.success,
  fontWeight: 700,
};

const PENDING_EDIT_BADGE: React.CSSProperties = {
  background: "rgba(245,158,11,0.12)",
  color: semanticColors.warningAmber,
  fontSize: typography.sizes.xs.fontSize,
  fontWeight: 700,
  padding: "4px 8px",
  borderRadius: radius.sm,
  display: "inline-block",
};

const STATUS_DISPLAY: Record<string, string> = {
  RAN: "Ran",
  DECLINED: "Declined",
  DEAD: "Dead",
  PENDING_RAN: "Pending Ran",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    RAN: semanticColors.statusRan,
    DECLINED: semanticColors.statusDead,
    DEAD: semanticColors.neutralGray,
    PENDING_RAN: semanticColors.warningAmber,
  };
  const c = map[status] ?? colors.warning;
  const label = STATUS_DISPLAY[status] ?? status;
  return (
    <Badge color={c} variant="subtle" size="sm" dot>
      {status === "PENDING_RAN" ? "\u23F3 " : ""}{label}
    </Badge>
  );
}

/* -- Component -- */

export default function ManagerSales({ API, agents, products, leadSources, salesList, setSalesList, highlightedSaleIds, onSalesChanged }: ManagerSalesProps) {
  const { toast } = useToast();

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

  const [salesDay, setSalesDay] = useState<string>("all");
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());

  /* -- Inline sale editing state -- */
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- form state with dynamic keys for inline sale editing
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- original values for diff comparison
  const [editOriginal, setEditOriginal] = useState<Record<string, any>>({});
  const [editPreview, setEditPreview] = useState<{ commission: number; periodStart: string; periodEnd: string } | null>(null);
  const [, setEditPreviewLoading] = useState(false);
  const editPreviewTimer = useRef<ReturnType<typeof setTimeout>>();
  const editPreviewAbort = useRef<AbortController>();
  const [editSaving, setEditSaving] = useState(false);
  const [userRoles, setUserRoles] = useState<string[]>([]);

  useEffect(() => {
    try {
      const token = getToken();
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (payload.roles) setUserRoles(payload.roles);
      }
    } catch { /* ignore decode errors */ }
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(editPreviewTimer.current);
      if (editPreviewAbort.current) editPreviewAbort.current.abort();
    };
  }, []);

  async function startEdit(saleId: string) {
    setEditingSaleId(null);
    try {
      const res = await authFetch(`${API}/api/sales/${saleId}`);
      if (!res.ok) { toast("error", `Error loading sale details (${res.status})`); return; }
      const sale = await res.json();

      if (sale.hasPendingStatusChange || sale.hasPendingEditRequest) {
        setEditingSaleId(saleId);
        setEditForm({});
        setEditOriginal({ _blocked: true });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic form original for diff comparison
      const original: Record<string, any> = {
        productId: sale.productId,
        premium: Number(sale.premium),
        enrollmentFee: sale.enrollmentFee !== null ? Number(sale.enrollmentFee) : null,
        paymentType: sale.paymentType,
        agentId: sale.agentId,
        addonProductIds: sale.addons ? sale.addons.map((a: { product: { id: string }; premium?: number | null }) => a.product.id) : [],
        addonPremiums: sale.addons ? Object.fromEntries(sale.addons.map((a: { product: { id: string }; premium?: number | null }) => [a.product.id, Number(a.premium ?? 0)])) : {},
        carrier: sale.carrier,
        memberName: sale.memberName,
        memberId: sale.memberId || "",
        memberState: sale.memberState || "",
        leadPhone: sale.leadPhone || "",
        saleDate: sale.saleDate ? sale.saleDate.slice(0, 10) : "",
        effectiveDate: sale.effectiveDate ? sale.effectiveDate.slice(0, 10) : "",
        leadSourceId: sale.leadSourceId,
        notes: sale.notes || "",
      };
      setEditOriginal(original);
      setEditForm({ ...original });
      setEditingSaleId(saleId);
      setEditPreview(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      toast("error", `Error: ${message}`);
    }
  }

  function triggerEditPreview(immediate = false) {
    clearTimeout(editPreviewTimer.current);
    const delay = immediate ? 0 : 500;
    editPreviewTimer.current = setTimeout(async () => {
      if (!editForm.productId || !editForm.premium) return;
      if (editPreviewAbort.current) editPreviewAbort.current.abort();
      editPreviewAbort.current = new AbortController();
      setEditPreviewLoading(true);
      try {
        const res = await authFetch(`${API}/api/sales/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: editForm.productId,
            premium: Number(editForm.premium),
            enrollmentFee: editForm.enrollmentFee !== null && editForm.enrollmentFee !== "" ? Number(editForm.enrollmentFee) : null,
            addonProductIds: editForm.addonProductIds || [],
            addonPremiums: editForm.addonPremiums || {},
            paymentType: editForm.paymentType || "CC",
            saleDate: editForm.saleDate || undefined,
          }),
          signal: editPreviewAbort.current.signal,
        });
        if (res.ok) setEditPreview(await res.json());
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== "AbortError") console.warn("Edit preview failed", e);
      } finally {
        setEditPreviewLoading(false);
      }
    }, delay);
  }

  async function saveEdit() {
    if (!editingSaleId) return;
    setEditSaving(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic changes payload for PATCH
    const changes: Record<string, any> = {};
    for (const key of Object.keys(editForm)) {
      if (JSON.stringify(editForm[key]) !== JSON.stringify(editOriginal[key])) {
        changes[key] = editForm[key];
      }
    }
    if (Object.keys(changes).length === 0) {
      toast("info", "No fields changed yet.");
      setEditSaving(false);
      return;
    }

    try {
      const res = await authFetch(`${API}/api/sales/${editingSaleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.editRequest) {
          toast("success", "Edit request submitted for payroll approval.");
        } else {
          toast("success", "Sale updated successfully.");
        }
        setEditingSaleId(null);
        setEditForm({});
        authFetch(`${API}/api/sales?range=week`).then(r => r.ok ? r.json() : []).then(setSalesList).catch(() => { toast("error", "Failed to refresh sales"); });
        onSalesChanged?.();
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", `Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      toast("error", `Error: ${message}`);
    } finally {
      setEditSaving(false);
    }
  }

  async function handleStatusChange(saleId: string, newStatus: string, currentStatus: string) {
    const isReactivation = (currentStatus === "DEAD" || currentStatus === "DECLINED") && newStatus === "RAN";
    if (isReactivation) {
      requestConfirm("Create Change Request", "This will create a change request for payroll approval. Continue?", "primary", "Create Request", () => doStatusChange(saleId, newStatus));
      return;
    }
    doStatusChange(saleId, newStatus);
  }

  async function doStatusChange(saleId: string, newStatus: string) {
    try {
      const res = await authFetch(`${API}/api/sales/${saleId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.changeRequest) {
          setMsg({ text: "Change request submitted for payroll approval", type: "success" });
          clearTimeout(msgTimerRef.current);
          msgTimerRef.current = setTimeout(() => setMsg(null), 5000);
        }
        authFetch(`${API}/api/sales?range=week`).then(r => r.ok ? r.json() : []).then(setSalesList).catch(() => { toast("error", "Failed to refresh sales"); });
        onSalesChanged?.();
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ text: `Failed to update status (${res.status}): ${err.error ?? "Unknown error"}`, type: "error" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      setMsg({ text: `Unable to reach API \u2014 ${message}`, type: "error" });
    }
  }

  function deleteSale(id: string) {
    requestConfirm("Delete Sale", "Permanently delete this sale? This removes it from payroll and tracking.", "danger", "Delete", async () => {
      try {
        const res = await authFetch(`${API}/api/sales/${id}`, { method: "DELETE" });
        if (res.ok) {
          setSalesList(prev => prev.filter(s => s.id !== id));
          onSalesChanged?.();
          setMsg({ text: "Sale deleted", type: "success" });
          clearTimeout(msgTimerRef.current);
          msgTimerRef.current = setTimeout(() => setMsg(null), 5000);
        } else {
          const err = await res.json().catch(() => ({}));
          setMsg({ text: `Failed to delete sale (${res.status}): ${err.error ?? "Unknown error"}`, type: "error" });
        }
      } catch (e: unknown) { const message = e instanceof Error ? e.message : "network error"; setMsg({ text: `Unable to reach API \u2014 ${message}`, type: "error" }); }
    });
  }

  const getDayOfWeek = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    const jsDay = d.getDay();
    return jsDay === 0 ? 6 : jsDay - 1;
  };
  const filtered = salesDay === "all"
    ? salesList
    : salesList.filter(s => getDayOfWeek(s.saleDate.slice(0, 10)) === DAYS.indexOf(salesDay as typeof DAYS[number]));

  // ── GAP-45-06: Fold ACA covering child sales into their parent rows ──
  // Mirrors the two-pass fold in PayrollPeriods.tsx (GAP-45-04). The API
  // returns two Sale rows for an ACA-attached entry: the parent (Complete
  // Care, etc.) and the ACA child whose acaCoveringSaleId points back at
  // the parent. Visually we want ONE row per logical sale and the per-agent
  // 'N sales' badge to count logical (post-fold) sales.
  //
  // Pass 1: index ACA child sales by parent id.
  const acaChildrenByParentId = new Map<string, Sale[]>();
  for (const s of filtered) {
    if (s.acaCoveringSaleId) {
      if (!acaChildrenByParentId.has(s.acaCoveringSaleId)) acaChildrenByParentId.set(s.acaCoveringSaleId, []);
      acaChildrenByParentId.get(s.acaCoveringSaleId)!.push(s);
    }
  }
  // Pass 2: emit non-child rows; skip child rows that have a present parent.
  // GAP-45-07: tag the parent with acaAttached so the Product cell can render
  // ACA as a visible second product on the same row.
  const foldedSales: Sale[] = [];
  for (const s of filtered) {
    if (s.acaCoveringSaleId) continue;
    const children = acaChildrenByParentId.get(s.id);
    if (children && children.length > 0) {
      foldedSales.push({ ...s, acaAttached: true, acaProductName: children[0].product.name });
    } else {
      foldedSales.push(s);
    }
  }
  // Pass 3 (defensive): if an ACA child has no matching parent in the
  // current visible window (orphaned data), surface it as a standalone row
  // so payroll is not silently dropped.
  for (const [parentId, children] of acaChildrenByParentId) {
    const hasParent = filtered.some(s => s.id === parentId && !s.acaCoveringSaleId);
    if (!hasParent) {
      for (const orphan of children) foldedSales.push(orphan);
    }
  }

  const byAgent = new Map<string, Sale[]>();
  for (const s of foldedSales) {
    const name = s.agent.name;
    if (!byAgent.has(name)) byAgent.set(name, []);
    byAgent.get(name)!.push(s);
  }

  return (
    <div className="animate-fade-in">
      {msg && (
        <div className="animate-fade-in-up" style={{
          marginBottom: 16,
          padding: "12px 16px",
          borderRadius: radius.xl,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: typography.sizes.base.fontSize,
          fontWeight: 600,
          background: msg.type === "success" ? colors.successBg : colors.dangerBg,
          border: `1px solid ${msg.type === "success" ? "rgba(52,211,153,0.2)" : colorAlpha(semanticColors.dangerLight, 0.2)}`,
          color: msg.type === "success" ? colors.success : colors.danger,
        }}>
          {msg.text}
        </div>
      )}

      {/* Day filter pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {["all", ...DAYS].map(day => (
          <button
            key={day}
            className="btn-hover"
            style={{
              padding: "6px 14px",
              borderRadius: radius.full,
              border: "none",
              cursor: "pointer",
              fontSize: typography.sizes.sm.fontSize,
              fontWeight: salesDay === day ? 700 : 500,
              background: salesDay === day ? colors.primary500 : "rgba(30,41,59,0.5)",
              color: salesDay === day ? semanticColors.white : colors.textTertiary,
              transition: `all ${motion.duration.fast} ${motion.easing.out}`,
            }}
            onClick={() => setSalesDay(day)}
          >
            {day === "all" ? "All Week" : day}
          </button>
        ))}
      </div>

      {byAgent.size === 0 && (
        <Card>
          <EmptyState icon={<BarChart3 size={32} />} title="No sales for this period" description="Try selecting a different day or check that sales have been submitted." />
        </Card>
      )}

      {[...byAgent.entries()].map(([agentName, sales], agentIdx) => {
        const premiumTotal = sales.reduce((s, x) => {
          const saleWithAddons = x as Sale & { addons?: { premium?: number | null }[] };
          const addonTotal = saleWithAddons.addons?.reduce((aSum: number, a) => aSum + Number(a.premium ?? 0), 0) ?? 0;
          return s + Number(x.premium ?? 0) + addonTotal;
        }, 0);
        return (
          <Card key={agentName} className={`animate-fade-in-up stagger-${Math.min(agentIdx + 1, 10)}`} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${colors.borderSubtle}`, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <h3 style={{ margin: 0, fontSize: typography.sizes.md.fontSize, fontWeight: 700, color: colors.textPrimary }}>{agentName}</h3>
                <Badge color={colors.primary400} variant="subtle" size="sm">{sales.length} sale{sales.length !== 1 ? "s" : ""}</Badge>
              </div>
              <div style={{ fontWeight: 800, fontSize: typography.sizes.lg.fontSize, background: `linear-gradient(135deg, ${semanticColors.accentGreenBright}, ${semanticColors.accentGreenMid})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties}>
                <AnimatedNumber value={premiumTotal} prefix="$" decimals={2} />
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: typography.sizes.sm.fontSize }}>
                <thead>
                  <tr>
                    {["Date", "Member", "Carrier", "Product", "Lead Source", "Phone", "Premium", "Status", "", "", ""].map((h, i) => (
                      <th key={h || `col-${i}`} style={{ ...baseThStyle, textAlign: i === 6 ? "right" : i === 7 ? "center" : "left", ...(i === 5 ? { minWidth: 130 } : {}) }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <React.Fragment key={s.id}>
                    <tr className="row-hover" style={{ transition: "box-shadow 1.5s ease-out", ...(highlightedSaleIds.has(s.id) ? HIGHLIGHT_GLOW : {}) }}>
                      <td style={baseTdStyle}>{formatDate(s.saleDate)}</td>
                      <td style={{ ...baseTdStyle, color: colors.textPrimary, fontWeight: 500 }}>{s.memberName}{s.memberId ? ` (${s.memberId})` : ""}</td>
                      <td style={baseTdStyle}>{s.carrier}</td>
                      <td style={baseTdStyle}>{s.product.name}{s.acaAttached ? ` + ${s.acaProductName ?? "ACA"}` : ""}</td>
                      <td style={baseTdStyle}>{s.leadSource.name}</td>
                      <td style={baseTdStyle}>
                        {s.leadPhone
                          ? formatPhone(s.leadPhone)
                          : <span style={{ color: colors.textMuted }}>&mdash;</span>}
                      </td>
                      <td style={{ ...baseTdStyle, textAlign: "right", fontWeight: 700, color: colors.success }}>{(() => {
                        const saleWithAddons = s as Sale & { addons?: { premium?: number | null }[] };
                        const addonTotal = saleWithAddons.addons?.reduce((aSum: number, a) => aSum + Number(a.premium ?? 0), 0) ?? 0;
                        const rowTotal = Number(s.premium ?? 0) + addonTotal;
                        return formatDollar(rowTotal);
                      })()}</td>
                      <td style={{ ...baseTdStyle, textAlign: "center" }}>
                        {s.hasPendingStatusChange ? (
                          <StatusBadge status="PENDING_RAN" />
                        ) : (
                          <select
                            className="input-focus"
                            value={s.status}
                            onChange={e => handleStatusChange(s.id, e.target.value, s.status)}
                            style={{
                              padding: "4px 8px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: radius.full,
                              border: "none",
                              cursor: "pointer",
                              color: semanticColors.white,
                              background: s.status === "RAN" ? semanticColors.statusRan : s.status === "DECLINED" ? semanticColors.statusDead : s.status === "DEAD" ? semanticColors.neutralGray : colors.warning,
                              appearance: "auto" as React.CSSProperties["appearance"],
                            }}
                          >
                            <option value="RAN">Ran</option>
                            <option value="DECLINED">Declined</option>
                            <option value="DEAD">Dead</option>
                          </select>
                        )}
                      </td>
                      <td style={{ ...baseTdStyle, textAlign: "center" }}>
                        {s.notes ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedNoteIds(prev => {
                              const next = new Set(prev);
                              if (next.has(s.id)) next.delete(s.id); else next.add(s.id);
                              return next;
                            })}
                            aria-label="Toggle notes"
                            title="View notes"
                            style={{ color: expandedNoteIds.has(s.id) ? colors.primary400 : colors.textMuted }}
                          >
                            <FileText size={14} />
                          </Button>
                        ) : (
                          <span style={{ color: colors.borderSubtle }}>&mdash;</span>
                        )}
                      </td>
                      <td style={{ ...baseTdStyle, textAlign: "center" }}>
                        {s.hasPendingEditRequest ? (
                          <span style={PENDING_EDIT_BADGE}>Edit Pending</span>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(s.id)}
                            aria-label="Edit sale"
                            aria-expanded={editingSaleId === s.id}
                          >
                            <Edit3 size={14} />
                          </Button>
                        )}
                      </td>
                      <td style={{ ...baseTdStyle, textAlign: "center" }}>
                        <Button
                          variant="danger"
                          size="sm"
                          style={{ padding: "4px 6px" }}
                          title="Delete sale"
                          onClick={() => deleteSale(s.id)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                    {expandedNoteIds.has(s.id) && s.notes && (
                      <tr>
                        <td colSpan={11} style={{ padding: 0 }}>
                          <div className="animate-slide-down" style={{
                            padding: "10px 20px",
                            background: colorAlpha(semanticColors.accentTealLight, 0.04),
                            borderTop: `1px solid ${colors.borderSubtle}`,
                            borderBottom: `1px solid ${colors.borderSubtle}`,
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                          }}>
                            <FileText size={13} style={{ color: colors.textMuted, flexShrink: 0, marginTop: 1 }} />
                            <span style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, whiteSpace: "pre-wrap" }}>{s.notes}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {editingSaleId === s.id && (
                      <tr>
                        <td colSpan={11} style={{ padding: 0 }}>
                          <div style={EDIT_ROW_EXPANSION} className="animate-slide-down">
                            {editOriginal._blocked ? (
                              <div style={{ fontSize: typography.sizes.base.fontSize, color: semanticColors.warningAmber, padding: spacing[4] }}>
                                A change is already pending. Wait for payroll to review before editing.
                              </div>
                            ) : (
                              <>
                                <div style={{ ...PREVIEW_LABEL, marginBottom: spacing[4] }}>Edit Sale</div>
                                {/* Two-column grid of editable fields */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing[4] }}>
                                  {/* Row 1: Product dropdown (full width) */}
                                  <div style={{ gridColumn: "1 / -1" }}>
                                    <label style={LBL}>Product</label>
                                    <select autoFocus className="input-focus" style={{ ...baseInputStyle, height: 42 }} value={editForm.productId || ""}
                                      onChange={e => { setEditForm((f: Record<string, any>) => ({ ...f, productId: e.target.value })); triggerEditPreview(true); }}>
                                      <option value="" disabled>Select product...</option>
                                      {products.filter(p => p.active !== false && p.type === "CORE").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                  </div>

                                  {/* Row 2: Premium | Enrollment Fee */}
                                  <div>
                                    <label style={LBL}>Premium</label>
                                    <input className="input-focus" style={baseInputStyle} type="number" step="0.01" value={editForm.premium ?? ""}
                                      onChange={e => { setEditForm((f: Record<string, any>) => ({ ...f, premium: e.target.value })); triggerEditPreview(false); }} />
                                  </div>
                                  <div>
                                    <label style={LBL}>Enrollment Fee</label>
                                    <input className="input-focus" style={baseInputStyle} type="number" step="0.01" value={editForm.enrollmentFee ?? ""}
                                      onChange={e => { setEditForm((f: Record<string, any>) => ({ ...f, enrollmentFee: e.target.value })); triggerEditPreview(false); }} />
                                  </div>

                                  {/* Row 3: Payment Type | Agent */}
                                  <div>
                                    <label style={LBL}>Payment Type</label>
                                    <select className="input-focus" style={{ ...baseInputStyle, height: 42 }} value={editForm.paymentType || ""}
                                      onChange={e => { setEditForm((f: Record<string, any>) => ({ ...f, paymentType: e.target.value })); triggerEditPreview(true); }}>
                                      <option value="CC">CC</option>
                                      <option value="ACH">ACH</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label style={LBL}>Agent</label>
                                    <select className="input-focus" style={{ ...baseInputStyle, height: 42 }} value={editForm.agentId || ""}
                                      onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, agentId: e.target.value }))}>
                                      <option value="" disabled>Select agent...</option>
                                      {agents.filter(a => a.active !== false).map(a => (
                                        <option key={a.id} value={a.id}>{a.name}</option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Row 4: Addons (full width) */}
                                  <div style={{ gridColumn: "1 / -1" }}>
                                    <label style={LBL}>Add-on Products</label>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                      {products.filter(p => p.active && (p.type === "ADDON" || p.type === "AD_D")).map(ap => {
                                        const isChecked = (editForm.addonProductIds || []).includes(ap.id);
                                        return (
                                          <label key={ap.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: colors.textPrimary, cursor: "pointer" }}>
                                            <input type="checkbox" checked={isChecked} style={{ accentColor: colors.primary400 }}
                                              onChange={e => {
                                                if (e.target.checked) {
                                                  setEditForm((f: Record<string, any>) => ({ ...f, addonProductIds: [...(f.addonProductIds || []), ap.id] }));
                                                } else {
                                                  setEditForm((f: Record<string, any>) => ({
                                                    ...f,
                                                    addonProductIds: (f.addonProductIds || []).filter((id: string) => id !== ap.id),
                                                    addonPremiums: Object.fromEntries(Object.entries(f.addonPremiums || {}).filter(([k]) => k !== ap.id)),
                                                  }));
                                                }
                                                triggerEditPreview(true);
                                              }} />
                                            {ap.name}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Row 5: Carrier | Member Name | Member State | Phone (4 cols) */}
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: spacing[4], gridColumn: "1 / -1" }}>
                                    <div>
                                      <label style={LBL}>Carrier</label>
                                      <input className="input-focus" style={baseInputStyle} value={editForm.carrier ?? ""} onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, carrier: e.target.value }))} />
                                    </div>
                                    <div>
                                      <label style={LBL}>Member Name</label>
                                      <input className="input-focus" style={baseInputStyle} value={editForm.memberName ?? ""} onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, memberName: e.target.value }))} />
                                    </div>
                                    <div>
                                      <label style={LBL}>Member State</label>
                                      <input className="input-focus" style={baseInputStyle} maxLength={2} value={editForm.memberState ?? ""} onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, memberState: e.target.value }))} />
                                    </div>
                                    <div>
                                      <label style={LBL}>Phone</label>
                                      <input
                                        className="input-focus"
                                        style={{ ...baseInputStyle, width: "100%" }}
                                        placeholder="(555) 123-4567"
                                        value={formatPhone(editForm.leadPhone ?? "")}
                                        onChange={e => {
                                          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                                          setEditForm((f: Record<string, any>) => ({ ...f, leadPhone: digits }));
                                        }}
                                      />
                                    </div>
                                  </div>

                                  {/* Row 6: Sale Date | Effective Date | Lead Source (3 cols) */}
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: spacing[4], gridColumn: "1 / -1" }}>
                                    <div>
                                      <label style={LBL}>Sale Date</label>
                                      <input className="input-focus" style={baseInputStyle} type="date" value={editForm.saleDate ?? ""} onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, saleDate: e.target.value }))} />
                                    </div>
                                    <div>
                                      <label style={LBL}>Effective Date</label>
                                      <input className="input-focus" style={baseInputStyle} type="date" value={editForm.effectiveDate ?? ""} onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, effectiveDate: e.target.value }))} />
                                    </div>
                                    <div>
                                      <label style={LBL}>Lead Source</label>
                                      <select className="input-focus" style={{ ...baseInputStyle, height: 42 }} value={editForm.leadSourceId || ""}
                                        onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, leadSourceId: e.target.value }))}>
                                        <option value="" disabled>Select lead source...</option>
                                        {leadSources.filter(ls => ls.active !== false).map(ls => (
                                          <option key={ls.id} value={ls.id}>{ls.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Row 7: Notes (full width) */}
                                  <div style={{ gridColumn: "1 / -1" }}>
                                    <label style={LBL}>Notes</label>
                                    <textarea className="input-focus" style={{ ...baseInputStyle, minHeight: 60 } as React.CSSProperties} value={editForm.notes ?? ""}
                                      onChange={e => setEditForm((f: Record<string, any>) => ({ ...f, notes: e.target.value }))} />
                                  </div>
                                </div>

                                {/* Changes diff section */}
                                <div style={{ marginTop: spacing[4] }} role="status">
                                  <div style={PREVIEW_LABEL}>Changes</div>
                                  {(() => {
                                    const changedKeys = Object.keys(editForm).filter(k =>
                                      JSON.stringify(editForm[k]) !== JSON.stringify(editOriginal[k])
                                    );
                                    if (changedKeys.length === 0) return (
                                      <div style={{ fontSize: typography.sizes.base.fontSize, color: colors.textMuted }}>No fields changed yet.</div>
                                    );
                                    return (
                                      <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }} className="animate-fade-in-up">
                                        {changedKeys.map(k => (
                                          <div key={k} style={{ display: "flex", gap: spacing[2], alignItems: "center" }}>
                                            <span style={{ fontSize: typography.sizes.base.fontSize, color: colors.textSecondary, minWidth: 120 }}>{k}:</span>
                                            <span style={DIFF_OLD}>{String(editOriginal[k])}</span>
                                            <span style={{ color: colors.textMuted }}>&rarr;</span>
                                            <span style={DIFF_NEW}>{String(editForm[k])}</span>
                                          </div>
                                        ))}
                                        {editPreview && (
                                          <div style={{ display: "flex", gap: spacing[2], alignItems: "center" }}>
                                            <span style={{ fontSize: typography.sizes.base.fontSize, color: colors.textSecondary, minWidth: 120 }}>Commission:</span>
                                            <span style={DIFF_NEW}>{formatDollar(editPreview.commission)}</span>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>

                                {/* Action buttons */}
                                <div style={{ marginTop: spacing[4], display: "flex", gap: spacing[3], justifyContent: "flex-end" }}>
                                  <Button variant="secondary" size="sm" onClick={() => { setEditingSaleId(null); setEditForm({}); }}>
                                    Discard Changes
                                  </Button>
                                  <Button
                                    variant="success"
                                    size="sm"
                                    onClick={saveEdit}
                                    disabled={editSaving}
                                  >
                                    {editSaving ? "Saving..." : (userRoles.includes("PAYROLL") || userRoles.includes("SUPER_ADMIN") ? "Save Changes" : "Submit for Approval")}
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
      <ConfirmModal open={confirmState.open} title={confirmState.title} message={confirmState.message} variant={confirmState.variant} confirmLabel={confirmState.confirmLabel} loading={confirmState.loading} onConfirm={handleConfirm} onCancel={() => setConfirmState(s => ({ ...s, open: false }))} />
    </div>
  );
}
