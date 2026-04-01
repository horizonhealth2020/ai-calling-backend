"use client";
import { useState, useEffect, useMemo } from "react";
import { Badge, AnimatedNumber, Button, useToast, Card, EmptyState } from "@ops/ui";
import { colors, spacing, radius, shadows, motion, baseInputStyle, baseThStyle, baseTdStyle } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar, formatDate } from "@ops/utils";
import {
  Calendar, AlertTriangle, Users,
  ChevronDown, CheckCircle,
  XCircle, Printer, Plus, Edit3, Trash2,
  Save, X, Check, Clock, FileText,
} from "lucide-react";

/* ── Types ──────────────────────────────────────────────────── */

type SaleAddonInfo = { productId: string; premium: number | null; product: { id: string; name: string; type: string } };
type SaleInfo = {
  id: string; memberName: string; memberId?: string; carrier: string;
  premium: number; enrollmentFee: number | null; commissionApproved: boolean;
  status: string; notes?: string; memberCount?: number | null;
  product: { id: string; name: string; type: string; flatCommission?: number | null };
  addons?: SaleAddonInfo[];
};
type Entry = {
  id: string; payoutAmount: number; adjustmentAmount: number; bonusAmount: number;
  frontedAmount: number; holdAmount: number; netAmount: number; status: string;
  halvingReason?: string | null;
  sale?: SaleInfo; agent?: { name: string };
};
type BonusCategory = { name: string; isDeduction: boolean };
type ServiceEntry = {
  id: string; basePay: number; bonusAmount: number; deductionAmount: number;
  frontedAmount?: number; totalPay: number; bonusBreakdown?: Record<string, number>;
  status: string; notes?: string; serviceAgent: { name: string; basePay: number };
};
type Period = {
  id: string; weekStart: string; weekEnd: string; quarterLabel: string;
  status: string; entries: Entry[]; serviceEntries: ServiceEntry[];
};
type ProductType = "CORE" | "ADDON" | "AD_D";
type Product = {
  id: string; name: string; active: boolean; type: ProductType;
  premiumThreshold?: number | null; commissionBelow?: number | null;
  commissionAbove?: number | null; bundledCommission?: number | null;
  standaloneCommission?: number | null; enrollFeeThreshold?: number | null;
  notes?: string;
};
type StatusChangeRequest = {
  id: string;
  saleId: string;
  oldStatus: string;
  newStatus: string;
  status: string;
  requestedAt: string;
  sale: { agentId: string; memberName: string; memberId?: string; product: { name: string } };
  requester: { name: string; email: string };
};
type SaleEditRequest = {
  id: string;
  saleId: string;
  changes: Record<string, { old: unknown; new: unknown }>;
  status: string;
  requestedAt: string;
  sale: { agentId: string; memberName: string; memberId?: string; product: { name: string } };
  requester: { name: string; email: string };
};

type Alert = {
  id: string;
  agentId: string | null;
  agentName: string | null;
  customerName: string | null;
  amount: number | null;
  createdAt: string;
};

type AlertPeriod = { id: string; weekStart: string; weekEnd: string };

type SocketClient = import("socket.io-client").Socket;

/* ── Design tokens (local aliases) ─────────────────────────── */

const C = colors;
const S = spacing;
const R = radius;

/* ── Style constants ─────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  ...baseInputStyle,
  boxSizing: "border-box",
};

const SMALL_INP: React.CSSProperties = {
  ...baseInputStyle,
  padding: "6px 10px",
  fontSize: 13,
  width: 90,
  textAlign: "right",
  boxSizing: "border-box",
};

const thStyle: React.CSSProperties = {
  ...baseThStyle,
  background: C.bgSurface,
  position: "sticky",
  top: 0,
};

const thRight: React.CSSProperties = { ...thStyle, textAlign: "right" };
const thCenter: React.CSSProperties = { ...thStyle, textAlign: "center" };

const tdStyle: React.CSSProperties = { ...baseTdStyle, borderBottom: "none" };
const tdRight: React.CSSProperties = { ...tdStyle, textAlign: "right" };
const tdCenter: React.CSSProperties = { ...tdStyle, textAlign: "center" };

/* ── Status config ───────────────────────────────────────────── */

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  OPEN:      { color: C.accentTeal,  label: "Open" },
  LOCKED:    { color: C.danger,      label: "Closed" },
  FINALIZED: { color: C.success,     label: "Finalized" },
};

const SALE_STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  RAN:      { bg: "rgba(52,211,153,0.12)", color: "#34d399", label: "Ran" },
  DECLINED: { bg: "rgba(248,113,113,0.12)", color: "#f87171", label: "Declined" },
  DEAD:     { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", label: "Dead" },
};

/** Returns true if the payroll entry counts toward period totals (RAN sales only) */
function isActiveEntry(e: Entry): boolean {
  if (e.status === "ZEROED_OUT") return false;
  if (e.sale?.status && e.sale.status !== "RAN") return false;
  return true;
}

/* ── Enrollment bonus constants ──────────────────────────────── */

const ENROLLMENT_BONUS_THRESHOLD = 125;

const ENROLLMENT_BADGE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  background: C.warningBg,
  color: C.warning,
  fontSize: 11,
  fontWeight: 700,
  borderRadius: 9999,
  padding: "2px 6px",
  marginLeft: 4,
};

const ACA_BADGE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: 11,
  fontWeight: 600,
  color: C.info,
  background: C.infoBg,
  padding: "4px 8px",
  borderRadius: 9999,
  marginLeft: 8,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

/* ── Helpers ─────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getUTCFullYear()}`;
}

/* ── Editable Sale Row ───────────────────────────────────────── */

function EditableSaleRow({
  entry, onSaleUpdate, onBonusFrontedUpdate, onApprove, onUnapprove, onDelete, products, highlighted, isPaid, isLate,
}: {
  entry: Entry;
  onSaleUpdate: (saleId: string, data: Record<string, unknown>) => Promise<void>;
  onBonusFrontedUpdate: (entryId: string, bonus: number, fronted: number, hold: number) => Promise<void>;
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
  const needsApproval = fee !== null && fee < 99 && !entry.sale?.commissionApproved;
  const isApproved = entry.sale?.commissionApproved && fee !== null && fee < 99;
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

/* ── Stat mini-card ──────────────────────────────────────────── */

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

/* ── Agent Pay Card ──────────────────────────────────────────── */

function AgentPayCard({
  agentName, entries, agentGross, agentNet, activeCount, isTopEarner,
  period, products, allAgents, pendingRequests, pendingEditRequests,
  approvingId, rejectingId, approvingEditId, rejectingEditId,
  onSaleUpdate, onBonusFrontedUpdate, onApprove, onUnapprove, onDelete,
  onPrint, onMarkPaid, onMarkUnpaid,
  onApproveChangeRequest, onRejectChangeRequest,
  onApproveEditRequest, onRejectEditRequest,
  highlightedEntryIds,
}: {
  agentName: string;
  entries: Entry[];
  agentGross: number;
  agentNet: number;
  activeCount: number;
  isTopEarner: boolean;
  period: Period;
  products: Product[];
  allAgents: { id: string; name: string }[];
  pendingRequests: StatusChangeRequest[];
  pendingEditRequests: SaleEditRequest[];
  approvingId: string | null;
  rejectingId: string | null;
  approvingEditId: string | null;
  rejectingEditId: string | null;
  onSaleUpdate: (saleId: string, data: Record<string, unknown>) => Promise<void>;
  onBonusFrontedUpdate: (entryId: string, bonus: number, fronted: number, hold: number) => Promise<void>;
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
}) {
  const activeEntries = entries.filter(isActiveEntry);
  const totalBonus = activeEntries.reduce((s, e) => s + Number(e.bonusAmount), 0);
  const totalFronted = activeEntries.reduce((s, e) => s + Number(e.frontedAmount), 0);
  const totalHold = activeEntries.reduce((s, e) => s + Number(e.holdAmount ?? 0), 0);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const aId = a.sale?.memberId;
      const bId = b.sale?.memberId;
      // Entries without member ID sort to top (D-06)
      if (!aId && !bId) return 0;
      if (!aId) return -1;
      if (!bId) return 1;
      // Numeric sort by member ID when both are numbers
      const aNum = parseInt(aId, 10);
      const bNum = parseInt(bId, 10);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      // Fallback to string comparison for non-numeric IDs
      return aId.localeCompare(bId);
    });
  }, [entries]);

  const [showAllEntries, setShowAllEntries] = useState(false);
  const COLLAPSED_LIMIT = 5;
  const visibleEntries = showAllEntries ? sortedEntries : sortedEntries.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = sortedEntries.length - COLLAPSED_LIMIT;

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
    const newTotal = Number(rawValue) || 0;
    let currentTotal: number;
    if (field === "bonus") currentTotal = totalBonus;
    else if (field === "fronted") currentTotal = totalFronted;
    else currentTotal = totalHold;

    if (Math.abs(newTotal - currentTotal) < 0.005) return;

    const delta = newTotal - currentTotal;
    const firstActive = activeEntries[0] ?? entries[0];
    if (!firstActive) return;

    const newBonus = field === "bonus" ? Number(firstActive.bonusAmount) + delta : Number(firstActive.bonusAmount);
    const newFronted = field === "fronted" ? Number(firstActive.frontedAmount) + delta : Number(firstActive.frontedAmount);
    const newHold = field === "hold" ? Number(firstActive.holdAmount ?? 0) + delta : Number(firstActive.holdAmount ?? 0);
    await onBonusFrontedUpdate(firstActive.id, newBonus, newFronted, newHold);
  };

  const HEADER_LBL: React.CSSProperties = {
    fontSize: 11, color: C.textMuted, textTransform: "uppercase",
    letterSpacing: "0.06em", fontWeight: 700, marginBottom: 2,
  };

  const agentObj = allAgents.find(a => a.name === agentName);
  const agentPending = agentObj ? pendingRequests.filter(r => r.sale.agentId === agentObj.id) : [];
  const agentEditPending = agentObj ? pendingEditRequests.filter(r => r.sale.agentId === agentObj.id) : [];
  const totalPending = agentPending.length + agentEditPending.length;

  return (
    <div style={{
      background: C.bgSurfaceRaised,
      border: `1px solid ${isTopEarner ? "rgba(20,184,166,0.25)" : C.borderSubtle}`,
      borderRadius: R.xl,
      opacity: allPaid ? 0.7 : 1,
      transition: "opacity 150ms ease-out",
    }}>
      {/* Agent header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: `${S[4]}px ${S[5]}px`,
        borderBottom: `1px solid ${C.borderSubtle}`,
        background: isTopEarner ? "rgba(20,184,166,0.04)" : "transparent",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: S[3] }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary }}>{agentName}</span>
          {isTopEarner && <Badge color={C.primary400}>Top Earner</Badge>}
          <span style={{ fontSize: 12, color: C.textMuted }}>
            {activeCount} sale{activeCount !== 1 ? "s" : ""}
            {activeCount !== entries.length && <span style={{ color: C.textTertiary }}> ({entries.length - activeCount} zeroed)</span>}
          </span>
        </div>
        <div style={{ display: "flex", gap: S[3], fontSize: 13, alignItems: "center" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={onPrint}
            style={{ background: C.infoBg, border: `1px solid rgba(45,212,191,0.2)`, color: C.info }}
          >
            <Printer size={11} /> Print
          </Button>
          {entries.length > 0 && (allPaid ? (
            period.status !== "OPEN" ? (
              <Button variant="ghost" size="sm" disabled
                title="Cannot unpay a closed period"
                style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: C.success, opacity: 0.5, cursor: "not-allowed" }}>
                <CheckCircle size={11} /> Paid
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onMarkUnpaid}
                style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: C.success }}>
                <CheckCircle size={11} /> Mark Unpaid
              </Button>
            )
          ) : (
            <Button variant="ghost" size="sm" onClick={onMarkPaid}
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
              <XCircle size={11} /> Unpaid
            </Button>
          ))}
        </div>
      </div>

      {/* Financial summary strip */}
      <div style={{
        display: "flex", gap: 16, alignItems: "center",
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
          <div style={HEADER_LBL}>Bonus</div>
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
        </div>
        <div>
          <div style={HEADER_LBL}>Fronted</div>
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
          <div style={HEADER_LBL}>Hold</div>
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
        </div>
        <div style={{ marginLeft: "auto" }}>
          <div style={HEADER_LBL}>Net</div>
          {(() => {
            const liveNet = agentGross + (Number(headerBonus) || 0) - (Number(headerFronted) || 0) - (Number(headerHold) || 0);
            return (
              <div style={{ fontSize: 16, fontWeight: 700, color: liveNet >= 0 ? C.success : C.danger }}>
                <AnimatedNumber value={liveNet} prefix="$" decimals={2} />
              </div>
            );
          })()}
        </div>
      </div>

      {/* Date range */}
      <div style={{ padding: `${S[2]}px ${S[5]}px`, fontSize: 12, color: C.textMuted, borderBottom: `1px solid ${C.borderSubtle}` }}>
        Sunday {fmtDate(period.weekStart)} – Saturday {fmtDate(period.weekEnd)}
      </div>

      {/* Commission table */}
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
            {visibleEntries.map(e => (
              <EditableSaleRow
                key={e.id}
                entry={e}
                products={products}
                onSaleUpdate={onSaleUpdate}
                onBonusFrontedUpdate={onBonusFrontedUpdate}
                onApprove={onApprove}
                onUnapprove={onUnapprove}
                onDelete={onDelete}
                highlighted={highlightedEntryIds.has(e.id)}
                isPaid={allPaid}
                isLate={isLateEntry(e)}
              />
            ))}
            {/* Agent subtotal */}
            <tr style={{ borderTop: `2px solid ${C.borderDefault}`, background: C.bgSurface }}>
              <td colSpan={5} style={{ ...tdStyle, fontWeight: 700, fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Subtotal</td>
              <td style={{ ...tdRight, fontWeight: 700, color: C.textPrimary }}>{formatDollar(agentGross)}</td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* Show more / Show less toggle */}
      {entries.length > COLLAPSED_LIMIT && (
        <button
          onClick={() => setShowAllEntries(prev => !prev)}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.borderDefault}`,
            borderRadius: R.md,
            padding: `${S[2]}px ${S[4]}px`,
            fontSize: 14,
            fontWeight: 400,
            color: C.textSecondary,
            cursor: "pointer",
            width: "calc(100% - 40px)",
            textAlign: "center" as const,
            margin: `${S[2]}px ${S[5]}px`,
            transition: "all 150ms ease-out",
          }}
          onMouseEnter={e => {
            (e.target as HTMLElement).style.background = C.bgSurfaceRaised;
            (e.target as HTMLElement).style.color = C.textPrimary;
          }}
          onMouseLeave={e => {
            (e.target as HTMLElement).style.background = "rgba(255,255,255,0.03)";
            (e.target as HTMLElement).style.color = C.textSecondary;
          }}
        >
          {showAllEntries ? "Show less" : `Show ${hiddenCount} more`}
        </button>
      )}

      {/* Pending Approval Requests for this agent */}
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
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [approvingEditId, setApprovingEditId] = useState<string | null>(null);
  const [rejectingEditId, setRejectingEditId] = useState<string | null>(null);
  const [printMenuPeriod, setPrintMenuPeriod] = useState<string | null>(null);
  const [highlightedEntryIds] = useState<Set<string>>(new Set());
  const [approvingAlertId, setApprovingAlertId] = useState<string | null>(null);
  const [alertPeriods, setAlertPeriods] = useState<Record<string, { id: string; weekStart: string; weekEnd: string }[]>>({});

  async function fetchAgentPeriods(agentId: string, alertId: string) {
    if (!agentId) return;
    const res = await authFetch(`${API}/api/alerts/agent-periods/${agentId}`);
    if (res.ok) {
      const data = await res.json();
      setAlertPeriods(prev => ({ ...prev, [alertId]: data }));
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

  async function updateBonusFronted(entryId: string, bonusAmount: number, frontedAmount: number, holdAmount: number) {
    try {
      const res = await authFetch(`${API}/api/payroll/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bonusAmount, frontedAmount, holdAmount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast("error", `Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
      await refreshPeriods();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      toast("error", `Error: Unable to reach API \u2014 ${message}`);
      await refreshPeriods();
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

  function printAgentCards(agents: [string, Entry[]][], period: Period) {
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Payroll - ${fmtDate(period.weekStart)} to ${fmtDate(period.weekEnd)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; background: #fff; padding: 20px; }
  .agent-card { page-break-after: always; padding: 24px 0; }
  .agent-card:last-child { page-break-after: auto; }
  .header { border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 800; }
  .header .meta { font-size: 13px; color: #64748b; margin-top: 4px; }
  .summary { display: flex; gap: 24px; margin-bottom: 16px; }
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
  @media print { body { padding: 0; } .agent-card { padding: 16px 0; } }
</style></head><body>` +
      agents.map(([agentName, entries]) => {
        const agentGross   = entries.reduce((s, e) => s + Number(e.payoutAmount), 0);
        const agentBonus   = entries.reduce((s, e) => s + Number(e.bonusAmount), 0);
        const agentFronted = entries.reduce((s, e) => s + Number(e.frontedAmount), 0);
        const agentHold    = entries.reduce((s, e) => s + Number(e.holdAmount ?? 0), 0);
        const agentNet     = entries.reduce((s, e) => s + Number(e.netAmount), 0);
        return `<div class="agent-card">
  <div class="header">
    <h1>${agentName}</h1>
    <div class="meta">Sunday ${fmtDate(period.weekStart)} \u2013 Saturday ${fmtDate(period.weekEnd)} &nbsp;\u00B7&nbsp; ${period.quarterLabel} &nbsp;\u00B7&nbsp; ${entries.length} sale${entries.length !== 1 ? "s" : ""}</div>
  </div>
  <div class="summary">
    <div class="summary-item"><div class="summary-label">Commission</div><div class="summary-value">$${agentGross.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Bonuses</div><div class="summary-value green">+$${agentBonus.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Fronted</div><div class="summary-value" style="color:#d97706">$${agentFronted.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Hold</div><div class="summary-value" style="color:#d97706">-$${agentHold.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Net Payout</div><div class="summary-value green">$${agentNet.toFixed(2)}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Member ID</th><th>Member Name</th><th class="center">Core</th><th class="center">Add-on</th><th class="center">AD&D</th>
      <th class="right">Enroll Fee</th><th class="right">Commission</th><th class="right">Net</th>
    </tr></thead>
    <tbody>` +
          entries.map(e => {
            const byType: Record<string, { name: string; premium?: number }[]> = { CORE: [], ADDON: [], AD_D: [] };
            if (e.sale?.product?.type) byType[e.sale.product.type]?.push({ name: e.sale.product.name, premium: Number(e.sale.premium) });
            if (e.sale?.addons) for (const ad of e.sale.addons) byType[ad.product.type]?.push({ name: ad.product.name, premium: ad.premium != null ? Number(ad.premium) : undefined });
            const printProd = (items: { name: string; premium?: number }[]) => items.length
              ? items.map(p => p.name + (p.premium != null ? `<br><span style="font-size:10px;color:#64748b">$${p.premium.toFixed(2)}</span>` : "")).join(", ")
              : "\u2014";
            const fee = e.sale?.enrollmentFee != null ? `$${Number(e.sale.enrollmentFee).toFixed(2)}` : "\u2014";
            const flags: string[] = [];
            if (e.halvingReason) flags.push(`<div class="flag flag-warn">${e.halvingReason}</div>`);
            const enrollFee = e.sale?.enrollmentFee != null ? Number(e.sale.enrollmentFee) : 0;
            if (enrollFee >= 125) flags.push(`<div class="flag flag-bonus">+$10 enrollment bonus</div>`);
            const flagHtml = flags.length > 0 ? flags.join("") : "";
            return `<tr>
        <td>${e.sale?.memberId ?? "\u2014"}</td>
        <td>${e.sale?.memberName ?? "\u2014"}${flagHtml}</td>
        <td class="center core">${printProd(byType.CORE)}</td>
        <td class="center addon">${printProd(byType.ADDON)}</td>
        <td class="center add">${printProd(byType.AD_D)}</td>
        <td class="right">${fee}</td>
        <td class="right" style="font-weight:700">$${Number(e.payoutAmount).toFixed(2)}</td>
        <td class="right green" style="font-weight:700">$${Number(e.netAmount).toFixed(2)}</td>
      </tr>`;
          }).join("") +
          `<tr class="subtotal">
        <td colspan="6" class="right">SUBTOTAL</td>
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
                            <select
                              style={{ ...inputStyle, width: "auto", minWidth: 160, fontSize: 12, padding: "4px 8px" }}
                              defaultValue=""
                              onChange={e => { if (e.target.value) handleApproveAlert(alert.id, e.target.value); }}
                            >
                              <option value="" disabled>Select period...</option>
                              {(alertPeriods[alert.id] || []).map((p: AlertPeriod) => (
                                <option key={p.id} value={p.id}>
                                  {fmtDate(p.weekStart)} {"\u2013"} {fmtDate(p.weekEnd)}
                                </option>
                              ))}
                              {(!alertPeriods[alert.id] || alertPeriods[alert.id].length === 0) && (
                                <option disabled>No open periods found</option>
                              )}
                            </select>
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
                                    const openPeriods = ((data || []) as (AlertPeriod & { status?: string })[]).filter((p) => p.status === "OPEN").map((p) => ({ id: p.id, weekStart: p.weekStart, weekEnd: p.weekEnd }));
                                    setAlertPeriods(prev => ({ ...prev, [alert.id]: openPeriods }));
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

      {periods.length === 0 && (
        <Card style={{ borderRadius: R["2xl"] }}>
          <EmptyState
            icon={<Calendar size={32} />}
            title="No payroll periods found"
            description="Periods will appear here when sales are entered."
          />
        </Card>
      )}

      {periods.map(p => {
        const activeEntries = p.entries.filter(isActiveEntry);
        const gross        = activeEntries.reduce((s, e) => s + Number(e.payoutAmount), 0);
        const totalBonus   = activeEntries.reduce((s, e) => s + Number(e.bonusAmount ?? 0), 0);
        const totalFronted = activeEntries.reduce((s, e) => s + Number(e.frontedAmount ?? 0), 0);
        const totalHold    = activeEntries.reduce((s, e) => s + Number(e.holdAmount ?? 0), 0);
        const net          = p.entries.reduce((s, e) => s + Number(e.netAmount), 0);
        const svcTotal     = (p.serviceEntries ?? []).reduce((s, e) => s + Number(e.totalPay), 0);
        const expanded     = expandedPeriod === p.id;
        const statusCfg    = STATUS_BADGE[p.status] ?? { color: C.textSecondary, label: p.status };
        const needsApproval = p.entries.filter(
          e => e.sale && e.sale.enrollmentFee !== null && Number(e.sale.enrollmentFee) < 99 && !e.sale.commissionApproved
        );

        const byAgent = new Map<string, Entry[]>();
        for (const e of p.entries) {
          const name = e.agent?.name ?? "Unknown";
          if (!byAgent.has(name)) byAgent.set(name, []);
          byAgent.get(name)!.push(e);
        }
        for (const agent of allAgents) {
          if (!byAgent.has(agent.name)) byAgent.set(agent.name, []);
        }

        const hasUnpaidInClosed = p.status === "LOCKED" && p.entries.some(e => e.status === "PENDING");

        return (
          <Card key={p.id} style={{ borderRadius: R["2xl"], ...(hasUnpaidInClosed ? { border: `2px solid ${C.danger}`, boxShadow: "0 0 12px rgba(239,68,68,0.15)" } : {}) }} className="animate-fade-in-up">
            {/* Period header */}
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: S[5] }}
              onClick={() => setExpandedPeriod(expanded ? null : p.id)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: S[3], flexWrap: "wrap" }}>
                <span style={{ fontWeight: 800, fontSize: 17, color: C.textPrimary, letterSpacing: "-0.01em" }}>
                  {fmtDate(p.weekStart)} {"\u2013"} {fmtDate(p.weekEnd)}
                </span>
                <span style={{ fontSize: 13, color: C.textMuted }}>{p.quarterLabel}</span>
                {p.status !== "FINALIZED" ? (
                  <span
                    style={{ cursor: "pointer" }}
                    title={p.status === "OPEN" ? "Click to close period" : "Click to reopen period"}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const newStatus = p.status === "OPEN" ? "LOCKED" : "OPEN";
                      const label = newStatus === "LOCKED" ? "close" : "reopen";
                      if (!window.confirm(`Are you sure you want to ${label} this period?`)) return;
                      const res = await authFetch(`${API}/api/payroll/periods/${p.id}/status`, {
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
                {hasUnpaidInClosed && (
                  <Badge color={C.danger}>
                    <AlertTriangle size={10} style={{ marginRight: 3 }} />
                    Unpaid agents
                  </Badge>
                )}
                {needsApproval.length > 0 && (
                  <Badge color={C.danger}>
                    <AlertTriangle size={10} style={{ marginRight: 3 }} />
                    {needsApproval.length} need approval
                  </Badge>
                )}
                {pendingRequests.length > 0 && (
                  <Badge color={C.warning}>
                    <Clock size={10} style={{ marginRight: 3 }} />
                    {pendingRequests.length} status change{pendingRequests.length !== 1 ? "s" : ""} pending
                  </Badge>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: S[3] }}>
                {(p.entries.length > 0 || (p.serviceEntries ?? []).length > 0) && (
                  <div style={{ position: "relative" }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={ev => { ev.stopPropagation(); setPrintMenuPeriod(printMenuPeriod === p.id ? null : p.id); }}
                      style={{ background: C.infoBg, border: `1px solid rgba(45,212,191,0.2)`, color: C.info }}
                    >
                      <Printer size={12} /> Print
                    </Button>
                    {printMenuPeriod === p.id && (
                      <div
                        onClick={ev => ev.stopPropagation()}
                        style={{
                          position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50,
                          background: C.bgSurface, border: `1px solid ${C.borderDefault}`,
                          borderRadius: R.lg, minWidth: 200,
                          boxShadow: shadows.lg, overflow: "hidden",
                        }}
                      >
                        <button
                          className="btn-hover"
                          onClick={() => {
                            printAgentCards([...byAgent.entries()], p);
                            printServiceCards(p.serviceEntries, p, bonusCategories);
                            setPrintMenuPeriod(null);
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "10px 14px", background: "transparent", border: "none", color: C.textPrimary, fontSize: 13, cursor: "pointer", textAlign: "left" }}
                        >
                          <Printer size={12} /> Print All
                        </button>
                        {[...byAgent.entries()].map(([agentName, agentEntries]) => (
                          <button
                            key={agentName}
                            className="btn-hover"
                            onClick={() => { printAgentCards([[agentName, agentEntries]], p); setPrintMenuPeriod(null); }}
                            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px 8px 28px", background: "transparent", border: "none", color: C.textSecondary, fontSize: 12, cursor: "pointer", textAlign: "left" }}
                          >
                            {agentName}
                          </button>
                        ))}
                        {(p.serviceEntries ?? []).map(se => (
                          <button
                            key={se.id}
                            className="btn-hover"
                            onClick={() => { printServiceCards([se], p, bonusCategories); setPrintMenuPeriod(null); }}
                            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 14px 8px 28px", background: "transparent", border: "none", color: "#a78bfa", fontSize: 12, cursor: "pointer", textAlign: "left" }}
                          >
                            {se.serviceAgent.name} (CS)
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async (ev) => {
                    ev.stopPropagation();
                    const entryCount = p.entries.length + (p.serviceEntries ?? []).length;
                    const msg = entryCount > 0
                      ? `Delete this period and its ${entryCount} payroll entries? This cannot be undone.`
                      : `Delete this empty period?`;
                    if (!window.confirm(msg)) return;
                    const res = await authFetch(`${API}/api/payroll/periods/${p.id}`, { method: "DELETE" });
                    if (res.ok) refreshPeriods();
                    else {
                      const err = await res.json().catch(() => ({}));
                      alert(err.error ?? `Delete failed (${res.status})`);
                    }
                  }}
                  title="Delete period"
                >
                  <Trash2 size={12} />
                </Button>
                {(() => {
                  const allEntries = [...p.entries, ...(p.serviceEntries ?? [])];
                  const allPaid = allEntries.length > 0 && allEntries.every(e => e.status === "PAID");
                  return allPaid ? <Badge color={C.success}>PAID</Badge> : null;
                })()}
                <div
                  style={{
                    color: C.textMuted,
                    transition: `transform ${motion.duration.fast} ${motion.easing.out}`,
                    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: S[3] }} className="grid-mobile-1">
              <StatMini label="Entries" value={activeEntries.length} prefix="" color={C.textPrimary} />
              <StatMini label="Commission" value={gross} />
              <StatMini label="Bonuses" value={totalBonus} color={C.success} />
              <StatMini label="Fronted" value={totalFronted} color={C.danger} />
              <StatMini label="Hold" value={totalHold} color={C.warning} />
              <StatMini label="Net Payout" value={net} color={net >= 0 ? C.success : C.danger} />
            </div>

            {/* Service total row */}
            {(p.serviceEntries ?? []).length > 0 && (
              <div style={{
                marginTop: S[3], padding: "10px 16px",
                background: C.infoBg,
                border: `1px solid rgba(45,212,191,0.15)`,
                borderRadius: R.lg,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 13, color: C.info, fontWeight: 600 }}>
                  Customer Service ({p.serviceEntries.length} agents)
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.info }}>
                  <AnimatedNumber value={svcTotal} prefix="$" decimals={2} />
                </span>
              </div>
            )}

            {/* Expanded content */}
            {expanded && (
              <div
                className="animate-slide-down"
                style={{ marginTop: S[5], borderTop: `1px solid ${C.borderSubtle}`, paddingTop: S[5], display: "grid", gap: S[4] }}
              >
                {/* Per-agent sections */}
                {(() => {
                  const agentEntries = [...byAgent.entries()].map(([name, ents]) => {
                    const active = ents.filter(isActiveEntry);
                    return {
                      name,
                      entries: ents,
                      net: ents.reduce((s, e) => s + Number(e.netAmount), 0),
                      gross: active.reduce((s, e) => s + Number(e.payoutAmount), 0),
                      activeCount: active.length,
                    };
                  });
                  // Agents with sales sort by premium desc; agents without sort alphabetically
                  const sorted = [...agentEntries].sort((a, b) => {
                    if (a.activeCount > 0 && b.activeCount > 0) return b.gross - a.gross;
                    if (a.activeCount > 0) return -1;
                    if (b.activeCount > 0) return 1;
                    return a.name.localeCompare(b.name);
                  });
                  const top3 = new Set(sorted.slice(0, 3).filter(a => a.net > 0).map(a => a.name));

                  return sorted.map(({ name: agentName, entries, net: agentNet, gross: agentGross, activeCount }, agentIdx) => {
                    const isTopEarner = top3.has(agentName);
                    return (
                      <div
                        key={agentName}
                        className={`animate-fade-in-up stagger-${Math.min(agentIdx + 1, 10)}`}
                      >
                        <AgentPayCard
                          agentName={agentName}
                          entries={entries}
                          agentGross={agentGross}
                          agentNet={agentNet}
                          activeCount={activeCount}
                          isTopEarner={isTopEarner}
                          period={p}
                          products={products}
                          allAgents={allAgents}
                          pendingRequests={pendingRequests}
                          pendingEditRequests={pendingEditRequests}
                          approvingId={approvingId}
                          rejectingId={rejectingId}
                          approvingEditId={approvingEditId}
                          rejectingEditId={rejectingEditId}
                          onSaleUpdate={updateSale}
                          onBonusFrontedUpdate={updateBonusFronted}
                          onApprove={id => toggleApproval(id, true)}
                          onUnapprove={unapproveCommission}
                          onDelete={deleteSale}
                          onPrint={() => printAgentCards([[agentName, entries]], p)}
                          onMarkPaid={() => markEntriesPaid(entries.map(e => e.id), [], agentName)}
                          onMarkUnpaid={() => markEntriesUnpaid(entries.map(e => e.id), [], agentName)}
                          onApproveChangeRequest={approveChangeRequest}
                          onRejectChangeRequest={rejectChangeRequest}
                          onApproveEditRequest={approveEditRequest}
                          onRejectEditRequest={rejectEditRequest}
                          highlightedEntryIds={highlightedEntryIds}
                        />
                      </div>
                    );
                  });
                })()}

                {/* Customer Service -- per-agent cards */}
                {(p.serviceEntries ?? []).length > 0 && (
                  <>
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: `${S[3]}px ${S[4]}px`,
                      background: C.infoBg,
                      border: `1px solid rgba(45,212,191,0.15)`,
                      borderRadius: R.lg,
                    }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: C.info }}>Customer Service</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.info }}>
                        Total: <AnimatedNumber value={svcTotal} prefix="$" decimals={2} />
                      </span>
                    </div>

                    {p.serviceEntries.map((se, seIdx) => {
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
                  </>
                )}

                {p.entries.length === 0 && (p.serviceEntries ?? []).length === 0 && (
                  <EmptyState
                    icon={<Users size={32} />}
                    title="No entries for this period"
                    description="Entries will appear here when sales are entered for this period."
                  />
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
