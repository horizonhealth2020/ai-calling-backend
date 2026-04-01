"use client";
import { useState, useEffect, useMemo } from "react";
import { Badge, AnimatedNumber, Button } from "@ops/ui";
import { colors, spacing, radius, motion } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar } from "@ops/utils";
import {
  ChevronDown, CheckCircle,
  XCircle, Printer, Plus, Edit3, Trash2,
  Save, X, Check, Clock, FileText,
} from "lucide-react";
import {
  type Entry, type Period, type Product, type AgentAdjustment,
  type StatusChangeRequest, type SaleEditRequest,
  SMALL_INP, thStyle, thRight, thCenter, tdStyle, tdRight, tdCenter,
  STATUS_BADGE, SALE_STATUS_COLORS, ENROLLMENT_BONUS_THRESHOLD, ENROLLMENT_BADGE,
  ACA_BADGE, EDITABLE_LBL, HEADER_LBL, isActiveEntry, fmtDate,
} from "./payroll-types";

const C = colors;
const S = spacing;
const R = radius;

/* ── EditableLabel ──────────────────────────────────────────── */

function EditableLabel({ value, onChange, defaultLabel, carryoverColor }: {
  value: string | null;
  onChange: (v: string) => void;
  defaultLabel: string;
  carryoverColor?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? defaultLabel);

  useEffect(() => { setDraft(value ?? defaultLabel); }, [value, defaultLabel]);

  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") setEditing(true); }}
        style={{
          ...EDITABLE_LBL,
          display: "block",
          cursor: "pointer",
          color: carryoverColor ?? C.textMuted,
          padding: "4px 0",
        }}
      >
        {value ?? defaultLabel}
      </span>
    );
  }

  return (
    <input
      autoFocus
      style={{ ...SMALL_INP, width: 100, fontSize: 11, padding: "4px 8px" }}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { onChange(draft); setEditing(false); }}
      onKeyDown={e => {
        if (e.key === "Enter") { onChange(draft); setEditing(false); }
        if (e.key === "Escape") { setDraft(value ?? defaultLabel); setEditing(false); }
      }}
    />
  );
}

/* ── CarryoverHint ──────────────────────────────────────────── */

function CarryoverHint({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div style={{ fontSize: 11, fontWeight: 400, color: C.textMuted, fontStyle: "italic", marginTop: 4, lineHeight: "1.45" }}>
      Carried from prev week
    </div>
  );
}

/* ── EditableSaleRow ────────────────────────────────────────── */

function EditableSaleRow({
  entry, onSaleUpdate, onApprove, onUnapprove, onDelete, products, highlighted, isPaid, isLate,
}: {
  entry: Entry;
  onSaleUpdate: (saleId: string, data: Record<string, unknown>) => Promise<void>;
  onApprove: (saleId: string) => Promise<void>;
  onUnapprove: (saleId: string) => Promise<void>;
  onDelete: (saleId: string) => Promise<void>;
  products: Product[];
  highlighted?: boolean;
  isPaid?: boolean;
  isLate?: boolean;
}) {
  const HIGHLIGHT_GLOW = { boxShadow: "0 0 20px rgba(20,184,166,0.4), inset 0 0 20px rgba(20,184,166,0.05)" };
  const [editSale, setEditSale] = useState(false);
  const [saleData, setSaleData] = useState({
    memberName: entry.sale?.memberName ?? "",
    memberId: entry.sale?.memberId ?? "",
    carrier: entry.sale?.carrier ?? "",
    premium: String(entry.sale?.premium ?? ""),
    enrollmentFee: String(entry.sale?.enrollmentFee ?? ""),
    notes: entry.sale?.notes ?? "",
    productId: entry.sale?.product?.id ?? "",
  });
  const [addonItems, setAddonItems] = useState<{ productId: string; premium: string }[]>(
    () => (entry.sale?.addons ?? []).map(a => ({ productId: a.product.id, premium: String(a.premium ?? "") }))
  );
  const [saving, setSaving] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const hasNotes = !!entry.sale?.notes;

  const fee = entry.sale?.enrollmentFee != null ? Number(entry.sale.enrollmentFee) : null;
  const needsApproval = !!entry.halvingReason && !entry.sale?.commissionApproved;
  const isApproved = !!entry.halvingReason && !!entry.sale?.commissionApproved;
  const saleStatus = entry.sale?.status ?? "RAN";
  const statusCfg = SALE_STATUS_COLORS[saleStatus] ?? SALE_STATUS_COLORS.RAN;

  const rowBg: React.CSSProperties = entry.status === "CLAWBACK_APPLIED"
    ? { backgroundColor: "rgba(239,68,68,0.08)", borderLeft: "3px solid rgba(239,68,68,0.4)" }
    : (saleStatus === "DECLINED" || saleStatus === "DEAD")
    ? { backgroundColor: "rgba(251,191,36,0.08)", borderLeft: "3px solid rgba(251,191,36,0.4)" }
    : needsApproval
    ? { borderLeft: "3px solid rgba(248,113,113,0.5)" }
    : { borderLeft: "3px solid transparent" };

  return (
    <>
    <tr
      className="row-hover"
      style={{
        borderTop: `1px solid ${C.borderSubtle}`,
        ...rowBg,
        transition: "box-shadow 1.5s ease-out",
        ...(highlighted ? HIGHLIGHT_GLOW : {}),
        ...(isLate ? { borderLeft: "3px solid #fbbf24", background: "rgba(251,191,36,0.04)" } : {}),
      }}
    >
      <td style={tdStyle}><span style={{ color: C.textPrimary, fontWeight: 500 }}>{entry.agent?.name ?? "\u2014"}</span></td>

      {/* Sale status badge */}
      <td style={tdCenter}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
          background: statusCfg.bg, color: statusCfg.color,
          textTransform: "uppercase", letterSpacing: "0.04em",
        }}>
          {statusCfg.label}
        </span>
        {isLate && (
          <span style={{
            display: "block", fontSize: 11, color: "#fbbf24",
            fontWeight: 700, marginTop: 2,
          }}>
            Arrived after paid
          </span>
        )}
      </td>

      <td style={tdStyle}>
        {editSale ? (
          <input
            className="input-focus"
            style={{ ...SMALL_INP, width: 130, textAlign: "left" }}
            value={saleData.memberName}
            onChange={e => setSaleData(d => ({ ...d, memberName: e.target.value }))}
          />
        ) : (
          <span style={{ color: C.textSecondary, cursor: "pointer" }} onClick={() => setEditSale(true)}>
            {entry.sale?.memberName ?? "\u2014"}
            {entry.sale?.memberId ? <span style={{ color: C.textMuted }}> ({entry.sale.memberId})</span> : ""}
          </span>
        )}
      </td>

      <td style={tdStyle}>
        {editSale ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Core product row */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <select
                className="input-focus"
                style={{ ...SMALL_INP, width: 140, textAlign: "left" }}
                value={saleData.productId}
                onChange={e => setSaleData(d => ({ ...d, productId: e.target.value }))}
              >
                <option value="">{"\u2014"} Core product {"\u2014"}</option>
                {products.filter(p => p.active).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input
                className="input-focus"
                style={{ ...SMALL_INP, width: 82 }}
                type="number" step="0.01" placeholder="Premium"
                value={saleData.premium}
                onChange={e => setSaleData(d => ({ ...d, premium: e.target.value }))}
              />
            </div>
            {/* Addon rows */}
            {addonItems.map((addon, idx) => (
              <div key={idx} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <select
                  className="input-focus"
                  style={{ ...SMALL_INP, width: 140, textAlign: "left" }}
                  value={addon.productId}
                  onChange={e => setAddonItems(prev => prev.map((a, i) => i === idx ? { ...a, productId: e.target.value } : a))}
                >
                  <option value="">{"\u2014"} Add-on {"\u2014"}</option>
                  {products.filter(p => p.active && p.type !== "CORE").map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  className="input-focus"
                  style={{ ...SMALL_INP, width: 82 }}
                  type="number" step="0.01" placeholder="Premium"
                  value={addon.premium}
                  onChange={e => setAddonItems(prev => prev.map((a, i) => i === idx ? { ...a, premium: e.target.value } : a))}
                />
                <button
                  type="button"
                  onClick={() => setAddonItems(prev => prev.filter((_, i) => i !== idx))}
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", borderRadius: 4, padding: "3px 6px", cursor: "pointer", fontSize: 11, lineHeight: 1 }}
                  title="Remove add-on"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            {/* Add product button */}
            <button
              type="button"
              onClick={() => setAddonItems(prev => [...prev, { productId: "", premium: "" }])}
              style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(20,184,166,0.08)", border: "1px solid rgba(20,184,166,0.2)", color: "#14b8a6", borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: 11, width: "fit-content" }}
            >
              <Plus size={10} /> Add Product
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {/* Core product */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Badge color={C.primary400} size="sm">{entry.sale?.product?.name ?? "\u2014"}</Badge>
              {entry.sale?.product?.type === "ACA_PL" && <span style={ACA_BADGE}>ACA</span>}
              {entry.sale?.premium != null && (
                <span style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                  {formatDollar(Number(entry.sale.premium))}
                </span>
              )}
            </div>
            {/* Addon & AD&D products side by side */}
            {entry.sale?.addons?.map((addon) => (
              <div key={addon.product.id} style={{ display: "flex", flexDirection: "column" }}>
                <Badge
                  color={addon.product.type === "AD_D" ? C.warning : C.accentTeal}
                  size="sm"
                >
                  {addon.product.name}
                </Badge>
                {addon.premium != null && (
                  <span style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                    {formatDollar(Number(addon.premium))}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </td>

      <td style={tdRight}>
        {editSale ? (
          <input
            className="input-focus"
            style={SMALL_INP}
            type="number" step="0.01"
            value={saleData.enrollmentFee}
            onChange={e => setSaleData(d => ({ ...d, enrollmentFee: e.target.value }))}
          />
        ) : (
          <span style={{ color: needsApproval ? C.danger : C.textSecondary, fontWeight: needsApproval ? 700 : 400 }}>
            {fee !== null ? formatDollar(fee) : "\u2014"}
            {fee !== null && fee >= ENROLLMENT_BONUS_THRESHOLD && (
              <span style={ENROLLMENT_BADGE}>+10</span>
            )}
          </span>
        )}
      </td>

      <td style={tdRight}>
        {entry.sale?.product?.type === "ACA_PL" && entry.sale?.memberCount ? (
          <span style={{ color: C.textPrimary, fontWeight: 700 }}>
            ${(Number(entry.sale.product.flatCommission ?? 0)).toFixed(2)} x {entry.sale.memberCount} members = {formatDollar(Number(entry.payoutAmount))}
          </span>
        ) : (
          <span style={{ color: C.textPrimary, fontWeight: 700 }}>
            {formatDollar(Number(entry.payoutAmount))}
          </span>
        )}
        {entry.halvingReason && (
          <div style={{ fontSize: 11, color: C.warning, marginTop: 2, fontStyle: "italic" }}>
            {entry.halvingReason}
          </div>
        )}
      </td>

      {/* Actions */}
      <td style={tdCenter}>
        {editSale ? (
          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
            <Button
              variant="success"
              size="sm"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                const addonProductIds = addonItems.filter(a => a.productId).map(a => a.productId);
                const addonPremiums: Record<string, number> = {};
                addonItems.filter(a => a.productId).forEach(a => {
                  addonPremiums[a.productId] = a.premium ? Number(a.premium) : 0;
                });
                await onSaleUpdate(entry.sale!.id, {
                  memberName: saleData.memberName,
                  memberId: saleData.memberId || null,
                  enrollmentFee: saleData.enrollmentFee ? Number(saleData.enrollmentFee) : null,
                  notes: saleData.notes || null,
                  productId: saleData.productId || undefined,
                  premium: saleData.premium ? Number(saleData.premium) : undefined,
                  addonProductIds,
                  addonPremiums,
                });
                setEditSale(false); setSaving(false);
              }}
            >
              <Save size={12} /> Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditSale(false);
                setAddonItems((entry.sale?.addons ?? []).map(a => ({ productId: a.product.id, premium: String(a.premium ?? "") })));
              }}
            >
              <X size={12} />
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
            {hasNotes && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotes(n => !n)}
                title="View notes"
                style={{ color: showNotes ? C.primary400 : C.textMuted }}
              >
                <FileText size={12} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditSale(true)}
            >
              <Edit3 size={12} /> Edit
            </Button>
            {needsApproval && (
              <Button
                variant="success"
                size="sm"
                onClick={() => onApprove(entry.sale!.id)}
              >
                <CheckCircle size={12} /> Approve
              </Button>
            )}
            {isApproved && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onUnapprove(entry.sale!.id)}
                style={{ background: "rgba(251,191,36,0.12)", color: C.warning, border: "1px solid rgba(251,191,36,0.25)" }}
              >
                <XCircle size={12} /> Unapprove
              </Button>
            )}
            {entry.sale && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(entry.sale!.id)}
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
              >
                <Trash2 size={12} />
              </Button>
            )}
          </div>
        )}
      </td>
    </tr>
    {showNotes && hasNotes && (
      <tr>
        <td colSpan={7} style={{ padding: 0 }}>
          <div style={{
            padding: "10px 20px",
            background: "rgba(45,212,191,0.04)",
            borderTop: `1px solid ${C.borderSubtle}`,
            borderBottom: `1px solid ${C.borderSubtle}`,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}>
            <FileText size={13} style={{ color: C.textMuted, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: C.textSecondary, whiteSpace: "pre-wrap" }}>{entry.sale?.notes}</span>
          </div>
        </td>
      </tr>
    )}
    </>
  );
}

/* ── WeekSection Props ──────────────────────────────────────── */

interface WeekSectionProps {
  agentName: string;
  entries: Entry[];
  period: Period;
  adjustment?: AgentAdjustment;
  agentGross: number;
  agentNet: number;
  activeCount: number;
  products: Product[];
  allAgents: { id: string; name: string }[];
  pendingRequests: StatusChangeRequest[];
  pendingEditRequests: SaleEditRequest[];
  approvingId: string | null;
  rejectingId: string | null;
  approvingEditId: string | null;
  rejectingEditId: string | null;
  expanded: boolean;
  isSelected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onSaleUpdate: (saleId: string, data: Record<string, unknown>) => Promise<void>;
  onApprove: (saleId: string) => Promise<void>;
  onUnapprove: (saleId: string) => Promise<void>;
  onDelete: (saleId: string) => Promise<void>;
  onPrint: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
  onApproveChangeRequest: (id: string) => Promise<void>;
  onRejectChangeRequest: (id: string) => Promise<void>;
  onApproveEditRequest: (id: string) => Promise<void>;
  onRejectEditRequest: (id: string) => Promise<void>;
  highlightedEntryIds: Set<string>;
  API: string;
  refreshPeriods: () => Promise<void>;
}

/* ── WeekSection Component ──────────────────────────────────── */

export function WeekSection({
  agentName, entries, period, adjustment,
  agentGross, agentNet, activeCount,
  products, allAgents, pendingRequests, pendingEditRequests,
  approvingId, rejectingId, approvingEditId, rejectingEditId,
  expanded, isSelected, onToggleExpand, onSelect,
  onSaleUpdate, onApprove, onUnapprove, onDelete,
  onPrint, onMarkPaid, onMarkUnpaid,
  onApproveChangeRequest, onRejectChangeRequest,
  onApproveEditRequest, onRejectEditRequest,
  highlightedEntryIds, API, refreshPeriods,
}: WeekSectionProps) {
  const totalBonus = adjustment ? Number(adjustment.bonusAmount) : 0;
  const totalFronted = adjustment ? Number(adjustment.frontedAmount) : 0;
  const totalHold = adjustment ? Number(adjustment.holdAmount) : 0;

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const aId = a.sale?.memberId;
      const bId = b.sale?.memberId;
      if (!aId && !bId) return 0;
      if (!aId) return -1;
      if (!bId) return 1;
      const aNum = parseInt(aId, 10);
      const bNum = parseInt(bId, 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return aId.localeCompare(bId);
    });
  }, [entries]);

  const allPaid = entries.length > 0 && entries.every(e => e.status === "PAID" || e.status === "ZEROED_OUT" || e.status === "CLAWBACK_APPLIED");
  const hasPaidSiblings = entries.some(e => e.status === "PAID");
  const isLateEntry = (e: Entry) => e.status === "PENDING" && hasPaidSiblings;

  const [headerBonus, setHeaderBonus] = useState(String(totalBonus.toFixed(2)));
  const [headerFronted, setHeaderFronted] = useState(String(totalFronted.toFixed(2)));
  const [headerHold, setHeaderHold] = useState(String(totalHold.toFixed(2)));

  useEffect(() => {
    setHeaderBonus(totalBonus.toFixed(2));
    setHeaderFronted(totalFronted.toFixed(2));
    setHeaderHold(totalHold.toFixed(2));
  }, [totalBonus, totalFronted, totalHold]);

  const handleHeaderBlur = async (field: "bonus" | "fronted" | "hold", rawValue: string) => {
    const newVal = Number(rawValue) || 0;
    if (!adjustment?.id) {
      const agentId = entries[0]?.agent?.name
        ? allAgents.find(a => a.name === entries[0]?.agent?.name)?.id ?? adjustment?.agentId
        : adjustment?.agentId;
      if (!agentId) return;
      const body: Record<string, unknown> = {
        agentId,
        payrollPeriodId: period.id,
      };
      if (field === "bonus") body.bonusAmount = newVal;
      else if (field === "fronted") body.frontedAmount = newVal;
      else body.holdAmount = newVal;
      const res = await authFetch(`${API}/api/payroll/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) refreshPeriods();
      return;
    }
    const body: Record<string, number> = {};
    if (field === "bonus") body.bonusAmount = newVal;
    else if (field === "fronted") body.frontedAmount = newVal;
    else body.holdAmount = newVal;
    const res = await authFetch(`${API}/api/payroll/adjustments/${adjustment.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) refreshPeriods();
  };

  const statusCfg = STATUS_BADGE[period.status] ?? { color: C.textSecondary, label: period.status };

  const agentObj = allAgents.find(a => a.name === agentName);
  const agentPending = agentObj ? pendingRequests.filter(r => r.sale.agentId === agentObj.id) : [];
  const agentEditPending = agentObj ? pendingEditRequests.filter(r => r.sale.agentId === agentObj.id) : [];
  const totalPending = agentPending.length + agentEditPending.length;

  return (
    <div style={{
      borderLeft: isSelected ? `3px solid ${C.accentTeal}` : "3px solid transparent",
      background: isSelected ? "rgba(20,184,166,0.03)" : "transparent",
      transition: "all 150ms ease-out",
    }}>
      {/* Week header */}
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: `${S[3]}px ${S[5]}px`,
          cursor: "pointer",
          borderBottom: expanded ? `1px solid ${C.borderSubtle}` : "none",
          background: "rgba(255,255,255,0.02)",
        }}
        onClick={() => { onToggleExpand(); onSelect(); }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: S[3] }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: C.textPrimary }}>
            {fmtDate(period.weekStart)} {"\u2013"} {fmtDate(period.weekEnd)}
          </span>
          {period.status !== "FINALIZED" ? (
            <span
              style={{ cursor: "pointer" }}
              title={period.status === "OPEN" ? "Click to close period" : "Click to reopen period"}
              onClick={async (e) => {
                e.stopPropagation();
                const newStatus = period.status === "OPEN" ? "LOCKED" : "OPEN";
                const label = newStatus === "LOCKED" ? "close" : "reopen";
                if (!window.confirm(`Are you sure you want to ${label} this period?`)) return;
                const res = await authFetch(`${API}/api/payroll/periods/${period.id}/status`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: newStatus }),
                });
                if (res.ok) refreshPeriods();
              }}
            >
              <Badge color={statusCfg.color} dot>{statusCfg.label}</Badge>
            </span>
          ) : (
            <Badge color={statusCfg.color} dot>{statusCfg.label}</Badge>
          )}
        </div>
        <div style={{ display: "flex", gap: S[3], alignItems: "center" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(ev) => { ev.stopPropagation(); onPrint(); }}
            style={{ background: C.infoBg, border: `1px solid rgba(45,212,191,0.2)`, color: C.info }}
          >
            <Printer size={12} /> Print Week
          </Button>
          {entries.length > 0 && (allPaid ? (
            period.status !== "OPEN" ? (
              <Button variant="ghost" size="sm" disabled
                title="Cannot unpay a closed period"
                style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: C.success, opacity: 0.5, cursor: "not-allowed" }}>
                <CheckCircle size={11} /> Paid
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); onMarkUnpaid(); }}
                style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: C.success }}>
                <CheckCircle size={11} /> Mark Unpaid
              </Button>
            )
          ) : (
            <Button variant="ghost" size="sm" onClick={(ev) => { ev.stopPropagation(); onMarkPaid(); }}
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
              <XCircle size={11} /> Unpaid
            </Button>
          ))}
          <div
            style={{
              color: C.textMuted,
              transition: `transform 150ms ${motion.easing.out}`,
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <ChevronDown size={14} />
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="animate-slide-down">
          {/* Financial strip */}
          <div style={{
            display: "flex", gap: 16, alignItems: "flex-end",
            padding: "10px 20px",
            background: "rgba(255,255,255,0.02)",
            borderBottom: `1px solid ${C.borderSubtle}`,
            flexWrap: "wrap",
          }}>
            <div>
              <div style={HEADER_LBL}>Commission</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{formatDollar(agentGross)}</div>
            </div>
            <div>
              <EditableLabel
                value={adjustment?.bonusLabel ?? null}
                defaultLabel="Bonus"
                carryoverColor={adjustment?.bonusFromCarryover ? C.success : undefined}
                onChange={async (label) => {
                  if (adjustment?.id) {
                    await authFetch(`${API}/api/payroll/adjustments/${adjustment.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ bonusLabel: label === "Bonus" ? null : label }),
                    });
                    refreshPeriods();
                  }
                }}
              />
              <input
                className="input-focus"
                disabled={allPaid}
                style={{
                  ...SMALL_INP, width: 90,
                  background: Number(headerBonus) > 0 ? "rgba(52,211,153,0.10)" : SMALL_INP.background,
                  color: Number(headerBonus) > 0 ? C.success : C.textPrimary,
                  fontWeight: 700,
                  ...(allPaid ? { pointerEvents: "none" as const, background: "transparent", border: "1px solid transparent", cursor: "default" } : {}),
                }}
                type="number" step="0.01" min="0"
                value={headerBonus}
                onChange={e => setHeaderBonus(e.target.value)}
                onBlur={() => handleHeaderBlur("bonus", headerBonus)}
              />
              <CarryoverHint show={!!adjustment?.bonusFromCarryover && Number(headerBonus) > 0} />
            </div>
            <div>
              <div style={{ ...HEADER_LBL, padding: "4px 0" }}>Fronted</div>
              <input
                className="input-focus"
                disabled={allPaid}
                style={{
                  ...SMALL_INP, width: 90,
                  background: Number(headerFronted) > 0 ? "rgba(251,191,36,0.10)" : SMALL_INP.background,
                  color: Number(headerFronted) > 0 ? C.warning : C.textPrimary,
                  fontWeight: 700,
                  ...(allPaid ? { pointerEvents: "none" as const, background: "transparent", border: "1px solid transparent", cursor: "default" } : {}),
                }}
                type="number" step="0.01" min="0"
                value={headerFronted}
                onChange={e => setHeaderFronted(e.target.value)}
                onBlur={() => handleHeaderBlur("fronted", headerFronted)}
              />
            </div>
            <div>
              <EditableLabel
                value={adjustment?.holdFromCarryover && Number(headerHold) > 0 ? (adjustment?.holdLabel ?? null) : null}
                defaultLabel="Hold"
                carryoverColor={adjustment?.holdFromCarryover && Number(headerHold) > 0 ? C.warning : undefined}
                onChange={async (label) => {
                  if (adjustment?.id) {
                    await authFetch(`${API}/api/payroll/adjustments/${adjustment.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ holdLabel: label === "Hold" ? null : label }),
                    });
                    refreshPeriods();
                  }
                }}
              />
              <input
                className="input-focus"
                disabled={allPaid}
                style={{
                  ...SMALL_INP, width: 90,
                  background: Number(headerHold) > 0 ? "rgba(251,191,36,0.10)" : SMALL_INP.background,
                  color: Number(headerHold) > 0 ? C.warning : C.textPrimary,
                  fontWeight: 700,
                  ...(allPaid ? { pointerEvents: "none" as const, background: "transparent", border: "1px solid transparent", cursor: "default" } : {}),
                }}
                type="number" step="0.01" min="0"
                value={headerHold}
                onChange={e => setHeaderHold(e.target.value)}
                onBlur={() => handleHeaderBlur("hold", headerHold)}
              />
              <CarryoverHint show={!!adjustment?.holdFromCarryover && Number(headerHold) > 0} />
            </div>
            <div style={{ marginLeft: "auto" }}>
              <div style={HEADER_LBL}>Net</div>
              {(() => {
                const liveNet = agentGross + (Number(headerBonus) || 0) + (Number(headerFronted) || 0) - (Number(headerHold) || 0);
                return (
                  <div style={{ fontSize: 16, fontWeight: 700, color: liveNet >= 0 ? C.success : C.danger }}>
                    <AnimatedNumber value={liveNet} prefix="$" decimals={2} />
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Commission table */}
          {entries.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Agent</th>
                  <th style={thCenter}>Status</th>
                  <th style={thStyle}>Member</th>
                  <th style={thStyle}>Product</th>
                  <th style={thRight}>Enroll Fee</th>
                  <th style={thRight}>Commission</th>
                  <th style={thCenter}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map(e => (
                  <EditableSaleRow
                    key={e.id}
                    entry={e}
                    products={products}
                    onSaleUpdate={onSaleUpdate}
                    onApprove={onApprove}
                    onUnapprove={onUnapprove}
                    onDelete={onDelete}
                    highlighted={highlightedEntryIds.has(e.id)}
                    isPaid={allPaid}
                    isLate={isLateEntry(e)}
                  />
                ))}
                {/* Subtotal */}
                <tr style={{ borderTop: `2px solid ${C.borderDefault}`, background: C.bgSurface }}>
                  <td colSpan={5} style={{ ...tdStyle, fontWeight: 700, fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Subtotal</td>
                  <td style={{ ...tdRight, fontWeight: 700, color: C.textPrimary }}>{formatDollar(agentGross)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
          )}

          {/* Pending Approval Requests */}
          {totalPending > 0 && (
            <div style={{
              borderLeft: "3px solid #f59e0b",
              backgroundColor: "rgba(245, 158, 11, 0.08)",
              padding: "12px",
              borderRadius: "8px",
              margin: `${S[3]}px ${S[5]}px ${S[4]}px`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Clock size={14} style={{ color: "#f59e0b" }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: "#f59e0b" }}>
                  Pending Approvals ({totalPending} pending)
                </span>
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {agentPending.map(req => (
                  <div key={req.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 12px",
                    background: "rgba(245, 158, 11, 0.06)",
                    border: "1px solid rgba(245, 158, 11, 0.15)",
                    borderRadius: 6, flexWrap: "wrap", gap: 8,
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
                        <span style={{
                          background: "rgba(96,165,250,0.1)", color: "#60a5fa",
                          fontSize: 11, fontWeight: 700, padding: "2px 6px",
                          borderRadius: R.sm, marginRight: S[2],
                        }}>Status Change</span>
                        {req.sale.memberName}{req.sale.memberId && ` (${req.sale.memberId})`} {"\u2014"} {req.sale.product.name}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: SALE_STATUS_COLORS[req.oldStatus]?.bg ?? "transparent",
                          color: SALE_STATUS_COLORS[req.oldStatus]?.color ?? C.textMuted,
                        }}>
                          {SALE_STATUS_COLORS[req.oldStatus]?.label ?? req.oldStatus}
                        </span>
                        <span style={{ margin: "0 4px", color: C.textTertiary }}>{"\u2192"}</span>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                          background: SALE_STATUS_COLORS[req.newStatus]?.bg ?? "transparent",
                          color: SALE_STATUS_COLORS[req.newStatus]?.color ?? C.textMuted,
                        }}>
                          {SALE_STATUS_COLORS[req.newStatus]?.label ?? req.newStatus}
                        </span>
                        <span style={{ marginLeft: 8 }}>by {req.requester.name} {"\u00B7"} {fmtDate(req.requestedAt)}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <Button variant="success" size="sm" disabled={approvingId === req.id}
                        onClick={() => onApproveChangeRequest(req.id)}>
                        <CheckCircle size={11} /> {approvingId === req.id ? "..." : "Approve"}
                      </Button>
                      <Button variant="danger" size="sm" disabled={rejectingId === req.id}
                        onClick={() => onRejectChangeRequest(req.id)}>
                        <XCircle size={11} /> {rejectingId === req.id ? "..." : "Reject"}
                      </Button>
                    </div>
                  </div>
                ))}
                {agentEditPending.map(req => (
                  <div key={req.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 12px",
                    background: "rgba(245, 158, 11, 0.06)",
                    border: "1px solid rgba(245, 158, 11, 0.15)",
                    borderRadius: 6, flexWrap: "wrap", gap: 8,
                  }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontSize: 13, color: C.textPrimary, fontWeight: 600 }}>
                        <span style={{
                          background: "rgba(168,85,247,0.1)", color: "#a855f7",
                          fontSize: 11, fontWeight: 700, padding: "2px 6px",
                          borderRadius: R.sm, marginRight: S[2],
                        }}>Edit Request</span>
                        {req.sale.memberName}{req.sale.memberId && ` (${req.sale.memberId})`} {"\u2014"} {req.sale.product.name}
                      </div>
                      <div style={{ fontSize: 12, color: C.textMuted }}>
                        {Object.entries(req.changes).map(([field, val]) => (
                          <span key={field} style={{ marginRight: 8 }}>
                            <strong style={{ color: C.textSecondary }}>{field}:</strong>{" "}
                            <span style={{ textDecoration: "line-through", opacity: 0.6 }}>{String(val.old)}</span>{" "}
                            {"\u2192"} {String(val.new)}
                          </span>
                        ))}
                        <span style={{ marginLeft: 8 }}>by {req.requester.name} {"\u00B7"} {fmtDate(req.requestedAt)}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <Button variant="success" size="sm" disabled={approvingEditId === req.id}
                        onClick={() => onApproveEditRequest(req.id)}>
                        <CheckCircle size={11} /> {approvingEditId === req.id ? "..." : "Approve"}
                      </Button>
                      <Button variant="danger" size="sm" disabled={rejectingEditId === req.id}
                        onClick={() => onRejectEditRequest(req.id)}>
                        <XCircle size={11} /> {rejectingEditId === req.id ? "..." : "Reject"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
