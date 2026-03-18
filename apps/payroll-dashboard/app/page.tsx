"use client";
import { useState, useEffect, useCallback, useRef, FormEvent } from "react";
import { PageShell, Badge, AnimatedNumber, SkeletonCard, Button, ToastProvider, useToast, Card, EmptyState, DateRangeFilter } from "@ops/ui";
import type { DateRangeFilterValue } from "@ops/ui";
import { colors, spacing, radius, shadows, motion, baseInputStyle, baseLabelStyle, baseThStyle, baseTdStyle } from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";
import { formatDollar, formatDate } from "@ops/utils";
import { useSocket, DISCONNECT_BANNER, HIGHLIGHT_GLOW } from "@ops/socket";
import type { SaleChangedPayload } from "@ops/socket";
import {
  Calendar, AlertTriangle, FileDown, Package, Users,
  ChevronDown, ChevronUp, Lock, Unlock, CheckCircle,
  XCircle, Download, Printer, Plus, Edit3, Trash2,
  Save, X, Check, RefreshCw, Clock,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

type Tab = "periods" | "chargebacks" | "exports" | "products" | "service";
type SaleAddonInfo = { product: { id: string; name: string; type: string } };
type SaleInfo = {
  id: string; memberName: string; memberId?: string; carrier: string;
  premium: number; enrollmentFee: number | null; commissionApproved: boolean;
  status: string; notes?: string;
  product: { id: string; name: string; type: string };
  addons?: SaleAddonInfo[];
};
type Entry = {
  id: string; payoutAmount: number; adjustmentAmount: number; bonusAmount: number;
  frontedAmount: number; holdAmount: number; netAmount: number; status: string;
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
type ServiceAgent = { id: string; name: string; basePay: number; active: boolean };
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
  changes: Record<string, { old: any; new: any }>;
  status: string;
  requestedAt: string;
  sale: { agentId: string; memberName: string; memberId?: string; product: { name: string } };
  requester: { name: string; email: string };
};
/* ExportRange replaced by DateRangeFilterValue from @ops/ui */

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

const LBL: React.CSSProperties = { ...baseLabelStyle };


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
  LOCKED:    { color: C.warning,     label: "Locked" },
  FINALIZED: { color: C.success,     label: "Finalized" },
};

const TYPE_LABELS: Record<ProductType, string> = {
  CORE: "Core", ADDON: "Add-on", AD_D: "AD&D",
};

const TYPE_COLORS: Record<ProductType, string> = {
  CORE: C.primary400, ADDON: C.accentTeal, AD_D: C.warning,
};

const SALE_STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  RAN:      { bg: "rgba(52,211,153,0.12)", color: "#34d399", label: "Ran" },
  DECLINED: { bg: "rgba(248,113,113,0.12)", color: "#f87171", label: "Declined" },
  DEAD:     { bg: "rgba(148,163,184,0.12)", color: "#94a3b8", label: "Dead" },
};

/** Returns true if the payroll entry counts toward period totals (RAN sales only) */
function isActiveEntry(e: Entry): boolean {
  // If the entry was ZEROED_OUT, it's for a Dead/Declined sale
  if (e.status === "ZEROED_OUT") return false;
  // If sale status is available, check it directly
  if (e.sale?.status && e.sale.status !== "RAN") return false;
  return true;
}

/* ── Enrollment bonus constants ──────────────────────────────── */

/** Enrollment fee >= this threshold triggers the enrollment bonus -- must match server-side constant */
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

/* ── Helpers ─────────────────────────────────────────────────── */

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getUTCFullYear()}`;
}

/* ── Nav items ───────────────────────────────────────────────── */

const NAV_ITEMS = [
  { icon: <Calendar size={18} />,       label: "Periods",    key: "periods" },
  { icon: <AlertTriangle size={18} />,  label: "Chargebacks",key: "chargebacks" },
  { icon: <FileDown size={18} />,       label: "Exports",    key: "exports" },
  { icon: <Package size={18} />,        label: "Products",   key: "products" },
  { icon: <Users size={18} />,          label: "Customer Service", key: "service" },
];

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
  const [bonus, setBonus] = useState(String(entry.bonusAmount ?? 0));
  const [fronted, setFronted] = useState(String(entry.frontedAmount ?? 0));
  const [hold, setHold] = useState(String(entry.holdAmount ?? 0));
  const [saving, setSaving] = useState(false);

  const fee = entry.sale?.enrollmentFee != null ? Number(entry.sale.enrollmentFee) : null;
  const needsApproval = fee !== null && fee < 99 && !entry.sale?.commissionApproved;
  const isApproved = entry.sale?.commissionApproved && fee !== null && fee < 99;
  const net = Number(entry.netAmount);
  const saleStatus = entry.sale?.status ?? "RAN";
  const isZeroed = !isActiveEntry(entry);
  const statusCfg = SALE_STATUS_COLORS[saleStatus] ?? SALE_STATUS_COLORS.RAN;

  const rowBg: React.CSSProperties = entry.status === "CLAWBACK_APPLIED"
    ? { backgroundColor: "rgba(239,68,68,0.08)", borderLeft: "3px solid rgba(239,68,68,0.4)" }
    : (saleStatus === "DECLINED" || saleStatus === "DEAD")
    ? { backgroundColor: "rgba(251,191,36,0.08)", borderLeft: "3px solid rgba(251,191,36,0.4)" }
    : needsApproval
    ? { borderLeft: "3px solid rgba(248,113,113,0.5)" }
    : { borderLeft: "3px solid transparent" };

  return (
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
      <td style={tdStyle}><span style={{ color: C.textPrimary, fontWeight: 500 }}>{entry.agent?.name ?? "—"}</span></td>

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
            {entry.sale?.memberName ?? "—"}
            {entry.sale?.memberId ? <span style={{ color: C.textMuted }}> ({entry.sale.memberId})</span> : ""}
          </span>
        )}
      </td>

      <td style={tdStyle}>
        {editSale ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <select
              className="input-focus"
              style={{ ...SMALL_INP, width: 140, textAlign: "left" }}
              value={saleData.productId}
              onChange={e => setSaleData(d => ({ ...d, productId: e.target.value }))}
            >
              <option value="">— Select —</option>
              {products.filter(p => p.active).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input
              className="input-focus"
              style={{ ...SMALL_INP, width: 90 }}
              type="number" step="0.01" placeholder="Premium"
              value={saleData.premium}
              onChange={e => setSaleData(d => ({ ...d, premium: e.target.value }))}
            />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {/* Core product */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Badge color={C.primary400} size="sm">{entry.sale?.product?.name ?? "—"}</Badge>
              {entry.sale?.premium != null && (
                <span style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{formatDollar(Number(entry.sale.premium))}</span>
              )}
            </div>
            {/* Addon & AD&D products side by side */}
            {entry.sale?.addons?.map((addon: { product: { id: string; name: string; type: string } }) => (
              <div key={addon.product.id} style={{ display: "flex", flexDirection: "column" }}>
                <Badge
                  color={addon.product.type === "AD_D" ? C.warning : C.accentTeal}
                  size="sm"
                >
                  {addon.product.name}
                </Badge>
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
            {fee !== null ? formatDollar(fee) : "—"}
            {fee !== null && fee >= ENROLLMENT_BONUS_THRESHOLD && (
              <span style={ENROLLMENT_BADGE}>+10</span>
            )}
          </span>
        )}
      </td>

      <td style={tdRight}>
        <span style={{ color: C.textPrimary, fontWeight: 700 }}>
          {formatDollar(Number(entry.payoutAmount))}
        </span>
      </td>

      {/* Net — animated, color by sign */}
      <td style={tdRight}>
        <span style={{ fontWeight: 700, color: net >= 0 ? C.success : C.danger }}>
          <AnimatedNumber value={net} prefix="$" decimals={2} />
        </span>
      </td>

      {/* Actions */}
      <td style={tdCenter}>
        {isPaid ? null : editSale ? (
          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
            <Button
              variant="success"
              size="sm"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onSaleUpdate(entry.sale!.id, {
                  memberName: saleData.memberName,
                  memberId: saleData.memberId || null,
                  enrollmentFee: saleData.enrollmentFee ? Number(saleData.enrollmentFee) : null,
                  notes: saleData.notes || null,
                  productId: saleData.productId || undefined,
                  premium: saleData.premium ? Number(saleData.premium) : undefined,
                });
                setEditSale(false); setSaving(false);
              }}
            >
              <Save size={12} /> Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditSale(false)}
            >
              <X size={12} />
            </Button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
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
  );
}

/* ── Product Card ─────────────────────────────────────────────── */

function ProductCard({
  product, onSave, onDelete,
}: {
  product: Product;
  onSave: (id: string, data: Partial<Product>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [d, setD] = useState({
    name: product.name, active: product.active, type: product.type, notes: product.notes ?? "",
    premiumThreshold: String(product.premiumThreshold ?? ""),
    commissionBelow: String(product.commissionBelow ?? ""),
    commissionAbove: String(product.commissionAbove ?? ""),
    bundledCommission: String(product.bundledCommission ?? ""),
    standaloneCommission: String(product.standaloneCommission ?? ""),
    enrollFeeThreshold: String(product.enrollFeeThreshold ?? ""),
  });
  const [saving, setSaving] = useState(false);
  const col = TYPE_COLORS[product.type];

  const cardStyle: React.CSSProperties = {
    background: C.bgSurface,
    border: `1px solid ${C.borderDefault}`,
    borderRadius: R.xl,
    overflow: "hidden",
    transition: `box-shadow ${motion.duration.fast} ${motion.easing.out}, transform ${motion.duration.fast} ${motion.easing.out}`,
  };

  const topBorderStyle: React.CSSProperties = {
    height: 3,
    background: col,
    width: "100%",
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(product.id, {
      name: d.name, active: d.active, type: d.type as ProductType, notes: d.notes || undefined,
      premiumThreshold: d.premiumThreshold ? Number(d.premiumThreshold) : null,
      commissionBelow: d.commissionBelow ? Number(d.commissionBelow) : null,
      commissionAbove: d.commissionAbove ? Number(d.commissionAbove) : null,
      bundledCommission: d.bundledCommission ? Number(d.bundledCommission) : null,
      standaloneCommission: d.standaloneCommission ? Number(d.standaloneCommission) : null,
      enrollFeeThreshold: d.enrollFeeThreshold ? Number(d.enrollFeeThreshold) : null,
    });
    setEdit(false); setSaving(false);
  };

  return (
    <div className="hover-lift animate-fade-in-up" style={cardStyle}>
      <div style={topBorderStyle} />
      <div style={{ padding: S[5] }}>
        {!edit ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S[3] }}>
              <div style={{ display: "flex", alignItems: "center", gap: S[2], flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary }}>{product.name}</span>
                <Badge color={col}>{TYPE_LABELS[product.type]}</Badge>
                <span
                  onClick={(e) => { e.stopPropagation(); onSave(product.id, { active: !product.active }); }}
                  style={{ cursor: "pointer" }}
                  title={product.active ? "Click to deactivate" : "Click to activate"}
                >
                  <Badge color={product.active ? C.success : C.textMuted} dot>
                    {product.active ? "Active" : "Inactive"}
                  </Badge>
                </span>
              </div>
              <div style={{ display: "flex", gap: S[2], flexShrink: 0 }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEdit(true)}
                >
                  <Edit3 size={12} /> Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: C.danger }}
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>

            <div style={{ fontSize: 12, color: C.textMuted, lineHeight: 1.7 }}>
              {product.type === "CORE" && (
                <>
                  {product.commissionBelow != null && <span>Below ${product.premiumThreshold}: <strong style={{ color: C.textSecondary }}>{product.commissionBelow}%</strong></span>}
                  {product.commissionAbove != null && <span> · Above ${product.premiumThreshold}: <strong style={{ color: C.textSecondary }}>{product.commissionAbove}%</strong></span>}
                </>
              )}
              {(product.type === "ADDON" || product.type === "AD_D") && (
                <>
                  {product.bundledCommission != null && <span>Bundled: <strong style={{ color: C.textSecondary }}>{product.bundledCommission}%</strong></span>}
                  {product.bundledCommission == null && product.type === "ADDON" && <span style={{ color: C.textMuted }}>Bundled: matches core</span>}
                  {product.standaloneCommission != null && <span> · Standalone: <strong style={{ color: C.textSecondary }}>{product.standaloneCommission}%</strong></span>}
                </>
              )}
              {product.notes ? <span> · {product.notes}</span> : ""}
            </div>

            {/* Inline delete confirm bar */}
            {showDeleteConfirm && (
              <div
                className="animate-slide-down"
                style={{
                  marginTop: S[3], padding: "10px 14px",
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: R.lg,
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: S[3],
                }}
              >
                <span style={{ fontSize: 13, color: C.danger }}>
                  Delete &ldquo;{product.name}&rdquo;? This will deactivate it.
                </span>
                <div style={{ display: "flex", gap: S[2], flexShrink: 0 }}>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => { onDelete(product.id); setShowDeleteConfirm(false); }}
                  >
                    <Trash2 size={11} /> Delete
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "grid", gap: S[3] }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: S[2] }}>
              <div>
                <label style={LBL}>Name</label>
                <input className="input-focus" style={inputStyle} value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
              </div>
              <div>
                <label style={LBL}>Type</label>
                <select className="input-focus" style={{ ...inputStyle, height: 42 }} value={d.type} onChange={e => setD(x => ({ ...x, type: e.target.value as ProductType }))}>
                  <option value="CORE">Core Product</option>
                  <option value="ADDON">Add-on</option>
                  <option value="AD_D">AD&D</option>
                </select>
              </div>
            </div>

            {d.type === "CORE" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                <div><label style={LBL}>Premium Threshold ($)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.premiumThreshold} placeholder="e.g. 250" onChange={e => setD(x => ({ ...x, premiumThreshold: e.target.value }))} /></div>
                <div><label style={LBL}>Commission Below (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.commissionBelow} placeholder="e.g. 30" onChange={e => setD(x => ({ ...x, commissionBelow: e.target.value }))} /></div>
                <div><label style={LBL}>Commission Above (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.commissionAbove} placeholder="e.g. 40" onChange={e => setD(x => ({ ...x, commissionAbove: e.target.value }))} /></div>
              </div>
            )}

            {(d.type === "ADDON" || d.type === "AD_D") && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                <div><label style={LBL}>Bundled Commission (%){d.type === "ADDON" ? " — blank = match core" : ""}</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.bundledCommission} placeholder={d.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setD(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
                <div><label style={LBL}>Standalone Commission (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.standaloneCommission} placeholder={d.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setD(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
                <div><label style={LBL}>Enroll Fee Threshold ($)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.enrollFeeThreshold} placeholder="e.g. 50" onChange={e => setD(x => ({ ...x, enrollFeeThreshold: e.target.value }))} /></div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: S[2], alignItems: "end" }}>
              <div><label style={LBL}>Notes</label><input className="input-focus" style={inputStyle} value={d.notes} placeholder="Notes" onChange={e => setD(x => ({ ...x, notes: e.target.value }))} /></div>
              <label style={{ display: "flex", alignItems: "center", gap: S[2], fontSize: 13, paddingBottom: 6, color: C.textSecondary, cursor: "pointer" }}>
                <input type="checkbox" checked={d.active} onChange={e => setD(x => ({ ...x, active: e.target.checked }))} /> Active
              </label>
            </div>

            <div style={{ display: "flex", gap: S[2] }}>
              <Button variant="success" disabled={saving} onClick={handleSave}>
                <Save size={14} /> {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Service Agent Card ───────────────────────────────────────── */

function ServiceAgentCard({
  agent, onSave,
}: {
  agent: ServiceAgent;
  onSave: (id: string, data: Partial<ServiceAgent>) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ name: agent.name, basePay: String(agent.basePay) });
  const [saving, setSaving] = useState(false);

  return (
    <Card
      className="hover-lift interactive-card"
      padding="sm"
      style={{ padding: S[5], display: "flex", justifyContent: "space-between", alignItems: edit ? "flex-start" : "center", gap: S[3] }}
    >
      {!edit ? (
        <>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              Base Pay: <span style={{ color: C.textSecondary, fontWeight: 600 }}>{formatDollar(Number(agent.basePay))}</span>
              {!agent.active && <span style={{ marginLeft: 6, color: C.textMuted }}> · Inactive</span>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEdit(true)} style={{ flexShrink: 0 }}>
            <Edit3 size={12} /> Edit
          </Button>
        </>
      ) : (
        <div style={{ display: "grid", gap: S[2], width: "100%" }}>
          <input className="input-focus" style={inputStyle} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
          <input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.basePay} placeholder="Base Pay ($)" onChange={e => setD(x => ({ ...x, basePay: e.target.value }))} />
          <div style={{ display: "flex", gap: S[2] }}>
            <Button
              variant="success"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onSave(agent.id, { name: d.name, basePay: Number(d.basePay) });
                setEdit(false); setSaving(false);
              }}
            >
              <Save size={13} /> {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
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

/* ── Loading skeleton ────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div style={{ display: "grid", gap: S[4] }}>
      {[1, 2, 3].map(i => <SkeletonCard key={i} height={140} />)}
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

  const [showAllEntries, setShowAllEntries] = useState(false);
  const COLLAPSED_LIMIT = 5;
  const visibleEntries = showAllEntries ? entries : entries.slice(0, COLLAPSED_LIMIT);
  const hiddenCount = entries.length - COLLAPSED_LIMIT;

  const allPaid = entries.length > 0 && entries.every(e => e.status === "PAID" || e.status === "ZEROED_OUT" || e.status === "CLAWBACK_APPLIED");
  const hasPaidSiblings = entries.some(e => e.status === "PAID");
  const isLateEntry = (e: Entry) => e.status === "PENDING" && hasPaidSiblings;

  const [headerBonus, setHeaderBonus] = useState(String(totalBonus.toFixed(2)));
  const [headerFronted, setHeaderFronted] = useState(String(totalFronted.toFixed(2)));
  const [headerHold, setHeaderHold] = useState(String(totalHold.toFixed(2)));

  // Sync header values when entries change externally
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

  // Pending approvals for this agent
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
          {entries.every(e => e.status === "PAID") ? (
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
          )}
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
            type="number" step="0.01"
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
              background: Number(headerFronted) > 0 ? "rgba(248,113,113,0.10)" : SMALL_INP.background,
              color: Number(headerFronted) > 0 ? C.danger : C.textPrimary,
              fontWeight: 700,
              ...(allPaid ? { pointerEvents: "none" as const, background: "transparent", border: "1px solid transparent", cursor: "default" } : {}),
            }}
            type="number" step="0.01"
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
            type="number" step="0.01"
            value={headerHold}
            onChange={e => setHeaderHold(e.target.value)}
            onBlur={() => handleHeaderBlur("hold", headerHold)}
          />
        </div>
        <div style={{ marginLeft: "auto" }}>
          <div style={HEADER_LBL}>Net</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: agentNet >= 0 ? C.success : C.danger }}>
            <AnimatedNumber value={agentNet} prefix="$" decimals={2} />
          </div>
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
              <th style={thRight}>Net</th>
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
              <td style={{ ...tdRight, fontWeight: 700, color: agentNet >= 0 ? C.success : C.danger }}>
                <AnimatedNumber value={agentNet} prefix="$" decimals={2} />
              </td>
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
                    {req.sale.memberName}{req.sale.memberId && ` (${req.sale.memberId})`} — {req.sale.product.name}
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
                    <span style={{ margin: "0 4px", color: C.textTertiary }}>&rarr;</span>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                      background: SALE_STATUS_COLORS[req.newStatus]?.bg ?? "transparent",
                      color: SALE_STATUS_COLORS[req.newStatus]?.color ?? C.textMuted,
                    }}>
                      {SALE_STATUS_COLORS[req.newStatus]?.label ?? req.newStatus}
                    </span>
                    <span style={{ marginLeft: 8 }}>by {req.requester.name} &middot; {fmtDate(req.requestedAt)}</span>
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
                    {req.sale.memberName}{req.sale.memberId && ` (${req.sale.memberId})`} — {req.sale.product.name}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>
                    {Object.entries(req.changes).map(([field, val]) => (
                      <span key={field} style={{ marginRight: 8 }}>
                        <strong style={{ color: C.textSecondary }}>{field}:</strong>{" "}
                        <span style={{ textDecoration: "line-through", opacity: 0.6 }}>{String(val.old)}</span>{" "}
                        &rarr; {String(val.new)}
                      </span>
                    ))}
                    <span style={{ marginLeft: 8 }}>by {req.requester.name} &middot; {fmtDate(req.requestedAt)}</span>
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

/* ── Main Page ───────────────────────────────────────────────── */

export default function PayrollDashboard() {
  return (
    <ToastProvider>
      <PayrollDashboardInner />
    </ToastProvider>
  );
}

function PayrollDashboardInner() {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("periods");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [serviceAgents, setServiceAgents] = useState<ServiceAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const [chargebackForm, setChargebackForm] = useState({ memberName: "", memberId: "", notes: "" });
  const [chargebackMsg, setChargebackMsg] = useState("");

  const [exportDateFilter, setExportDateFilter] = useState<DateRangeFilterValue>({ preset: "30d" });
  const [exporting, setExporting] = useState(false);

  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<StatusChangeRequest[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [pendingEditRequests, setPendingEditRequests] = useState<SaleEditRequest[]>([]);
  const [approvingEditId, setApprovingEditId] = useState<string | null>(null);
  const [rejectingEditId, setRejectingEditId] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState<{
    name: string; type: ProductType; notes: string;
    premiumThreshold: string; commissionBelow: string; commissionAbove: string;
    bundledCommission: string; standaloneCommission: string; enrollFeeThreshold: string;
  }>({
    name: "", type: "CORE", notes: "",
    premiumThreshold: "", commissionBelow: "", commissionAbove: "",
    bundledCommission: "", standaloneCommission: "", enrollFeeThreshold: "",
  });
  const [cfgMsg, setCfgMsg] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);

  const [newServiceAgent, setNewServiceAgent] = useState({ name: "", basePay: "" });
  const [svcMsg, setSvcMsg] = useState("");
  const [svcPeriodId, setSvcPeriodId] = useState("");
  const [svcBonuses, setSvcBonuses] = useState<Record<string, Record<string, string>>>({});
  const [svcFronted, setSvcFronted] = useState<Record<string, string>>({});
  const [bonusCategories, setBonusCategories] = useState<BonusCategory[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDeduction, setNewCatDeduction] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [allAgents, setAllAgents] = useState<{ id: string; name: string }[]>([]);
  const [printMenuPeriod, setPrintMenuPeriod] = useState<string | null>(null);
  const [highlightedEntryIds, setHighlightedEntryIds] = useState<Set<string>>(new Set());

  // Payroll alerts state
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [alertPeriods, setAlertPeriods] = useState<Record<string, { id: string; weekStart: string; weekEnd: string }[]>>({});
  const [approvingAlertId, setApprovingAlertId] = useState<string | null>(null);
  const [highlightedAlertIds, setHighlightedAlertIds] = useState<Set<string>>(new Set());

  // Ref for expanded period to avoid stale closures in socket callback
  const expandedPeriodRef = useRef(expandedPeriod);
  expandedPeriodRef.current = expandedPeriod;

  const highlightEntry = (id: string) => {
    setHighlightedEntryIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setHighlightedEntryIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }, 100);
  };

  // Socket.IO: sale:changed handler — patches local state directly (no API refetch)
  const handleSaleChanged = useCallback((payload: SaleChangedPayload) => {
    if (payload.type !== "created" && payload.type !== "status_changed") return;

    // Filter payroll entries to those matching any period we have locally
    const matchingEntries = payload.payrollEntries;
    if (matchingEntries.length === 0) return;

    // Highlight entries
    matchingEntries.forEach(e => highlightEntry(e.id));

    // Patch periods state directly
    setPeriods(prev => prev.map(period => {
      const periodEntries = matchingEntries.filter(e => e.periodId === period.id);
      if (periodEntries.length === 0) return period;

      const updatedEntries = [...period.entries];
      for (const pe of periodEntries) {
        const existingIdx = updatedEntries.findIndex(e => e.id === pe.id);
        const newEntry: Entry = {
          id: pe.id,
          payoutAmount: pe.payoutAmount,
          adjustmentAmount: pe.adjustmentAmount,
          bonusAmount: pe.bonusAmount,
          frontedAmount: pe.frontedAmount,
          holdAmount: pe.holdAmount,
          netAmount: pe.netAmount,
          status: pe.status,
          sale: {
            id: payload.sale.id,
            memberName: payload.sale.memberName,
            memberId: payload.sale.memberId,
            carrier: payload.sale.carrier,
            premium: payload.sale.premium,
            enrollmentFee: payload.sale.enrollmentFee,
            commissionApproved: false,
            status: payload.sale.status,
            product: payload.sale.product,
            addons: payload.sale.addons,
          },
          agent: { name: payload.sale.agent.name },
        };
        if (existingIdx >= 0) {
          updatedEntries[existingIdx] = newEntry;
        } else {
          updatedEntries.push(newEntry);
        }
      }
      return { ...period, entries: updatedEntries };
    }));
  }, []);

  // Wire up Socket.IO — reconnect triggers full refetch
  const fetchAlerts = useCallback(() => {
    authFetch(`${API}/api/alerts`).then(r => r.ok ? r.json() : []).then(data => {
      if (Array.isArray(data)) setAlerts(data);
    }).catch(() => {});
  }, []);

  const { disconnected } = useSocket(API, handleSaleChanged, () => { refreshPeriods(); fetchAlerts(); }, {
    "alert:created": (data: any) => {
      fetchAlerts();
      // Highlight new alert
      if (data?.alertId) {
        setHighlightedAlertIds(prev => new Set(prev).add(data.alertId));
        setTimeout(() => {
          setHighlightedAlertIds(prev => { const next = new Set(prev); next.delete(data.alertId); return next; });
        }, 100);
      }
    },
    "alert:resolved": (data: { alertId: string }) => {
      setAlerts(prev => prev.filter(a => a.id !== data.alertId));
    },
  });

  useEffect(() => {
    captureTokenFromUrl();
    Promise.all([
      authFetch(`${API}/api/payroll/periods`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/products`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/service-agents`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/settings/service-bonus-categories`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/agents`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/status-change-requests?status=PENDING`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/sale-edit-requests?status=PENDING`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/alerts`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([p, prod, sa, cats, agents, scr, editReqs, alertsData]) => {
      setPeriods(p);
      setProducts(prod);
      setServiceAgents(sa);
      setBonusCategories(cats);
      setAllAgents(agents);
      setPendingRequests(scr);
      setPendingEditRequests(editReqs);
      if (Array.isArray(alertsData)) setAlerts(alertsData);
      setLoadingAlerts(false);
      if (p.length > 0) setSvcPeriodId(p[0].id);
      setLoading(false);
    });
  }, []);

  async function refreshPeriods() {
    const p = await authFetch(`${API}/api/payroll/periods`)
      .then(r => r.ok ? r.json() : periods)
      .catch(() => periods);
    setPeriods(p);
  }

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

  async function refreshPendingRequests() {
    const scr = await authFetch(`${API}/api/status-change-requests?status=PENDING`)
      .then(r => r.ok ? r.json() : pendingRequests)
      .catch(() => pendingRequests);
    setPendingRequests(scr);
  }

  async function refreshPendingEditRequests() {
    const editReqs = await authFetch(`${API}/api/sale-edit-requests?status=PENDING`)
      .then(r => r.ok ? r.json() : pendingEditRequests)
      .catch(() => pendingEditRequests);
    setPendingEditRequests(editReqs);
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
    } catch (e: any) {
      toast("error", `Error: Unable to reach API — ${e.message ?? "network error"}`);
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
    } catch (e: any) {
      toast("error", `Error: Unable to reach API — ${e.message ?? "network error"}`);
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
    } catch (e: any) {
      toast("error", `Error: Unable to reach API — ${e.message ?? "network error"}`);
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
    } catch (e: any) {
      toast("error", `Error: Unable to reach API — ${e.message ?? "network error"}`);
    } finally {
      setRejectingEditId(null);
    }
  }

  async function submitChargeback(e: FormEvent) {
    e.preventDefault(); setChargebackMsg("");
    try {
      const body = Object.fromEntries(Object.entries(chargebackForm).filter(([, v]) => v));
      const res = await authFetch(`${API}/api/clawbacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setChargebackMsg("Chargeback processed successfully");
        setChargebackForm({ memberName: "", memberId: "", notes: "" });
      } else {
        const err = await res.json().catch(() => ({}));
        setChargebackMsg(`Error: ${err.error ?? "No matching sale found"}`);
      }
    } catch (e: any) {
      setChargebackMsg(`Error: Unable to reach API — ${e.message ?? "network error"}`);
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
    } catch (e: any) {
      toast("error", `Error: Unable to reach API — ${e.message ?? "network error"}`);
    }
  }

  async function updateBonusFronted(
    entryId: string,
    bonusAmount: number,
    frontedAmount: number,
    holdAmount: number,
  ) {
    try {
      await authFetch(`${API}/api/payroll/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bonusAmount, frontedAmount, holdAmount }),
      });
      await refreshPeriods();
    } catch { /* silent — values will refresh on next load */ }
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
    if (!window.confirm(`Mark ${label} as PAID?`)) return;
    const res = await authFetch(`${API}/api/payroll/mark-paid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds, serviceEntryIds }),
    });
    if (res.ok) await refreshPeriods();
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

  function filterPeriodsByDateRange(filter: DateRangeFilterValue): Period[] {
    let from: Date | null = null;
    let to: Date | null = null;
    if (filter.preset === "custom" && filter.from && filter.to) {
      from = new Date(filter.from + "T00:00:00");
      to = new Date(filter.to + "T23:59:59.999");
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
    if (!from || !to) return periods;
    return periods.filter(p => {
      const start = new Date(p.weekStart);
      return start >= from! && start <= to!;
    });
  }

  function exportCSV() {
    const filtered = filterPeriodsByDateRange(exportDateFilter);
    const rows = [["Week Start", "Week End", "Quarter", "Status", "Entries", "Gross", "Net"]];
    filtered.forEach(p => {
      const active = p.entries.filter(isActiveEntry);
      const gross = active.reduce((s, e) => s + Number(e.payoutAmount), 0);
      const net   = active.reduce((s, e) => s + Number(e.netAmount), 0);
      rows.push([p.weekStart, p.weekEnd, p.quarterLabel, p.status, String(active.length), gross.toFixed(2), net.toFixed(2)]);
    });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })),
      download: `payroll-summary.csv`,
    });
    a.click();
  }

  function exportDetailedCSV() {
    const filtered = filterPeriodsByDateRange(exportDateFilter);
    const esc = (v: string) => v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    const rows = [["Week Start","Week End","Quarter","Agent","Member ID","Member Name","Core","Add-on","AD&D","Enroll Fee","Commission","Bonus","Fronted","Hold","Net"]];
    for (const p of filtered) {
      // Sort entries by agent name for grouping
      const sortedEntries = [...p.entries].sort((a, b) =>
        (a.agent?.name ?? "").localeCompare(b.agent?.name ?? "")
      );
      let currentAgent = "";
      let agentCommission = 0, agentBonus = 0, agentFronted = 0, agentHold = 0, agentNet = 0;
      for (const e of sortedEntries) {
        const agentName = e.agent?.name ?? "Unknown";
        // When agent changes, output subtotal for previous agent
        if (agentName !== currentAgent) {
          if (currentAgent !== "") {
            rows.push([
              "", "", "", esc(currentAgent + " — Subtotal"), "", "",
              "", "", "", "",
              agentCommission.toFixed(2), agentBonus.toFixed(2),
              agentFronted.toFixed(2), agentHold.toFixed(2), agentNet.toFixed(2),
            ]);
            rows.push([""]); // blank separator
          }
          currentAgent = agentName;
          agentCommission = 0; agentBonus = 0; agentFronted = 0; agentHold = 0; agentNet = 0;
        }
        const byType: Record<string, string[]> = { CORE: [], ADDON: [], AD_D: [] };
        if (e.sale?.product?.type) byType[e.sale.product.type]?.push(e.sale.product.name);
        if (e.sale?.addons) for (const ad of e.sale.addons) byType[ad.product.type]?.push(ad.product.name);
        const fee = e.sale?.enrollmentFee != null ? Number(e.sale.enrollmentFee).toFixed(2) : "";
        const commission = Number(e.payoutAmount);
        const bonus = Number(e.bonusAmount);
        const fronted = Number(e.frontedAmount);
        const hold = Number(e.holdAmount ?? 0);
        const net = Number(e.netAmount);
        agentCommission += commission; agentBonus += bonus; agentFronted += fronted; agentHold += hold; agentNet += net;
        rows.push([
          fmtDate(p.weekStart), fmtDate(p.weekEnd), p.quarterLabel,
          esc(agentName), e.sale?.memberId ?? "", esc(e.sale?.memberName ?? ""),
          esc(byType.CORE.join(", ")), esc(byType.ADDON.join(", ")), esc(byType.AD_D.join(", ")),
          fee, commission.toFixed(2), bonus.toFixed(2),
          fronted.toFixed(2), hold.toFixed(2), net.toFixed(2),
        ]);
      }
      // Final agent subtotal
      if (currentAgent !== "") {
        rows.push([
          "", "", "", esc(currentAgent + " — Subtotal"), "", "",
          "", "", "", "",
          agentCommission.toFixed(2), agentBonus.toFixed(2),
          agentFronted.toFixed(2), agentHold.toFixed(2), agentNet.toFixed(2),
        ]);
        rows.push([""]); // blank separator between periods
      }
    }
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })),
      download: `payroll-detailed.csv`,
    });
    a.click();
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
    <div class="meta">Sunday ${fmtDate(period.weekStart)} – Saturday ${fmtDate(period.weekEnd)} &nbsp;·&nbsp; ${period.quarterLabel} &nbsp;·&nbsp; ${entries.length} sale${entries.length !== 1 ? "s" : ""}</div>
  </div>
  <div class="summary">
    <div class="summary-item"><div class="summary-label">Commission</div><div class="summary-value">$${agentGross.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Bonuses</div><div class="summary-value green">+$${agentBonus.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Fronted</div><div class="summary-value red">-$${agentFronted.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Hold</div><div class="summary-value" style="color:#d97706">-$${agentHold.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Net Payout</div><div class="summary-value green">$${agentNet.toFixed(2)}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Member ID</th><th>Member Name</th><th class="center">Core</th><th class="center">Add-on</th><th class="center">AD&D</th>
      <th class="right">Enroll Fee</th><th class="right">Commission</th><th class="right">Bonus</th><th class="right">Net</th>
    </tr></thead>
    <tbody>` +
          entries.map(e => {
            const byType: Record<string, { name: string; premium?: number }[]> = { CORE: [], ADDON: [], AD_D: [] };
            if (e.sale?.product?.type) byType[e.sale.product.type]?.push({ name: e.sale.product.name, premium: Number(e.sale.premium) });
            if (e.sale?.addons) for (const ad of e.sale.addons) byType[ad.product.type]?.push({ name: ad.product.name });
            const printProd = (items: { name: string; premium?: number }[]) => items.length
              ? items.map(p => p.name + (p.premium != null ? `<br><span style="font-size:10px;color:#64748b">$${p.premium.toFixed(2)}</span>` : "")).join(", ")
              : "—";
            const fee = e.sale?.enrollmentFee != null ? `$${Number(e.sale.enrollmentFee).toFixed(2)}` : "—";
            return `<tr>
        <td>${e.sale?.memberId ?? "—"}</td>
        <td>${e.sale?.memberName ?? "—"}</td>
        <td class="center core">${printProd(byType.CORE)}</td>
        <td class="center addon">${printProd(byType.ADDON)}</td>
        <td class="center add">${printProd(byType.AD_D)}</td>
        <td class="right">${fee}</td>
        <td class="right" style="font-weight:700">$${Number(e.payoutAmount).toFixed(2)}</td>
        <td class="right green">${Number(e.bonusAmount) > 0 ? "$" + Number(e.bonusAmount).toFixed(2) : "$0.00"}</td>
        <td class="right green" style="font-weight:700">$${Number(e.netAmount).toFixed(2)}</td>
      </tr>`;
          }).join("") +
          `<tr class="subtotal">
        <td colspan="6" class="right">SUBTOTAL</td>
        <td class="right">$${agentGross.toFixed(2)}</td>
        <td class="right green">$${agentBonus.toFixed(2)}</td>
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
  <div class="meta">Sunday ${fmtDate(period.weekStart)} – Saturday ${fmtDate(period.weekEnd)} &nbsp;·&nbsp; ${period.quarterLabel}</div>
</div>
<div class="total">Total: $${total.toFixed(2)}</div>
<table>
  <thead><tr><th>Name</th><th class="right">Base Pay</th><th class="right" style="color:#dc2626">Fronted</th>${cats.map(c => `<th class="center"${c.isDeduction ? ' style="color:#dc2626"' : ""}>${c.name}</th>`).join("")}<th class="right" style="color:#14b8a6">Total</th></tr></thead>
  <tbody>${serviceEntries.map(se => {
      const bd = (se.bonusBreakdown ?? {}) as Record<string, number>;
      const fAmt = Number(se.frontedAmount ?? 0);
      return `<tr><td style="font-weight:600">${se.serviceAgent.name}</td><td class="right">$${Number(se.basePay).toFixed(2)}</td><td class="right red">${fAmt > 0 ? "$" + fAmt.toFixed(2) : "—"}</td>${cats.map(c => {
        const amt = bd[c.name] ?? 0;
        return `<td class="center ${amt > 0 ? (c.isDeduction ? "red" : "green") : ""}">${amt > 0 ? "$" + amt.toFixed(2) : "—"}</td>`;
      }).join("")}<td class="right purple">$${Number(se.totalPay).toFixed(2)}</td></tr>`;
    }).join("")}</tbody>
</table>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
  }

  async function saveProduct(id: string, data: Partial<Product>) {
    try {
      const res = await authFetch(`${API}/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts(prev => prev.map(p => p.id === id ? updated : p));
        setCfgMsg("Product updated");
      } else {
        const err = await res.json().catch(() => ({}));
        setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) {
      setCfgMsg(`Error: Unable to reach API — ${e.message ?? "network error"}`);
    }
  }

  async function deleteProduct(id: string) {
    try {
      const res = await authFetch(`${API}/api/products/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== id));
        setCfgMsg("Product deleted");
      } else {
        const err = await res.json().catch(() => ({}));
        setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) {
      setCfgMsg(`Error: Unable to reach API — ${e.message ?? "network error"}`);
    }
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault(); setCfgMsg("");
    try {
      const body: Record<string, unknown> = {
        name: newProduct.name,
        type: newProduct.type,
        notes: newProduct.notes || undefined,
      };
      if (newProduct.type === "CORE") {
        if (newProduct.premiumThreshold) body.premiumThreshold = Number(newProduct.premiumThreshold);
        if (newProduct.commissionBelow)  body.commissionBelow  = Number(newProduct.commissionBelow);
        if (newProduct.commissionAbove)  body.commissionAbove  = Number(newProduct.commissionAbove);
      } else {
        if (newProduct.bundledCommission)    body.bundledCommission    = Number(newProduct.bundledCommission);
        if (newProduct.standaloneCommission) body.standaloneCommission = Number(newProduct.standaloneCommission);
        if (newProduct.enrollFeeThreshold)   body.enrollFeeThreshold   = Number(newProduct.enrollFeeThreshold);
      }
      const res = await authFetch(`${API}/api/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const p = await res.json();
        setProducts(prev => [...prev, p]);
        setNewProduct({ name: "", type: "CORE", notes: "", premiumThreshold: "", commissionBelow: "", commissionAbove: "", bundledCommission: "", standaloneCommission: "", enrollFeeThreshold: "" });
        setCfgMsg("Product added");
        setShowAddProduct(false);
      } else {
        const err = await res.json().catch(() => ({}));
        setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) {
      setCfgMsg(`Error: Unable to reach API — ${e.message ?? "network error"}`);
    }
  }

  async function saveServiceAgent(id: string, data: Partial<ServiceAgent>) {
    try {
      const res = await authFetch(`${API}/api/service-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setServiceAgents(prev => prev.map(a => a.id === id ? updated : a));
        setSvcMsg("Agent updated");
      } else {
        const err = await res.json().catch(() => ({}));
        setSvcMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) {
      setSvcMsg(`Error: ${e.message ?? "network error"}`);
    }
  }

  async function addServiceAgent(e: FormEvent) {
    e.preventDefault(); setSvcMsg("");
    try {
      // Use synced creation to create both ServiceAgent + CsRepRoster
      const res = await authFetch(`${API}/api/reps/create-synced`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newServiceAgent.name, basePay: Number(newServiceAgent.basePay) }),
      });
      if (res.ok) {
        const data = await res.json();
        setServiceAgents(prev => [...prev, data.serviceAgent]);
        setNewServiceAgent({ name: "", basePay: "" });
        setSvcMsg("Customer service agent added successfully");
      } else {
        const err = await res.json().catch(() => ({}));
        setSvcMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) {
      setSvcMsg(`Error: ${e.message ?? "network error"}`);
    }
  }

  async function submitServiceBonus(agentId: string) {
    const breakdown = svcBonuses[agentId];
    if (!svcPeriodId) return;
    setSvcMsg("");
    try {
      const bonusBreakdown: Record<string, number> = {};
      if (breakdown) {
        for (const [cat, val] of Object.entries(breakdown)) {
          bonusBreakdown[cat] = Number(val) || 0;
        }
      }
      const frontedAmount = Number(svcFronted[agentId]) || 0;
      const res = await authFetch(`${API}/api/payroll/service-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceAgentId: agentId, payrollPeriodId: svcPeriodId, bonusBreakdown, frontedAmount }),
      });
      if (res.ok) {
        setSvcMsg("Service payroll entry saved");
        await refreshPeriods();
      } else {
        const err = await res.json().catch(() => ({}));
        setSvcMsg(`Error: ${err.error ?? "Failed"}`);
      }
    } catch (e: any) {
      setSvcMsg(`Error: ${e.message ?? "network error"}`);
    }
  }

  async function saveBonusCategories(cats: BonusCategory[]) {
    setSvcMsg("");
    try {
      const res = await authFetch(`${API}/api/settings/service-bonus-categories`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: cats }),
      });
      if (res.ok) {
        setBonusCategories(await res.json());
        setSvcMsg("Bonus categories updated");
      } else {
        const err = await res.json().catch(() => ({}));
        setSvcMsg(`Error: ${err.error ?? "Failed"}`);
      }
    } catch (e: any) {
      setSvcMsg(`Error: ${e.message ?? "network error"}`);
    }
  }

  /* ── Pending approval badge count for Periods nav ── */
  const totalNeedingApproval = periods.reduce((sum, p) =>
    sum + p.entries.filter(e => e.sale && e.sale.enrollmentFee !== null && Number(e.sale.enrollmentFee) < 99 && !e.sale.commissionApproved).length, 0
  );

  const navItemsWithBadges = NAV_ITEMS.map(item =>
    item.key === "periods" && totalNeedingApproval > 0
      ? { ...item, badge: totalNeedingApproval }
      : item
  );

  if (loading) {
    return (
      <PageShell
        title="Payroll Dashboard"
        subtitle="Loading data..."
        navItems={NAV_ITEMS}
        activeNav={tab}
        onNavChange={key => setTab(key as Tab)}
      >
        <LoadingSkeleton />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Payroll Dashboard"
      subtitle="Commission, payroll periods & service management"
      navItems={navItemsWithBadges}
      activeNav={tab}
      onNavChange={key => setTab(key as Tab)}
    >
      {disconnected && <div style={DISCONNECT_BANNER}>Connection lost. Reconnecting...</div>}

      {/* ── Payroll Periods ───────────────────────────────────── */}
      {tab === "periods" && (
        <div className="animate-fade-in" style={{ display: "grid", gap: S[4] }}>

          {/* ── Chargeback Alerts ─────────────────────────────── */}
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
                                  {(alertPeriods[alert.id] || []).map((p: any) => (
                                    <option key={p.id} value={p.id}>
                                      {fmtDate(p.weekStart)} – {fmtDate(p.weekEnd)}
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
                                    // Fetch open periods - use agentId if available, otherwise fetch all open periods
                                    if (alert.agentId) {
                                      fetchAgentPeriods(alert.agentId, alert.id);
                                    } else {
                                      // Fetch all open periods as fallback
                                      authFetch(`${API}/api/payroll/periods`).then(r => r.ok ? r.json() : []).then(data => {
                                        const openPeriods = (data || []).filter((p: any) => p.status === "OPEN").map((p: any) => ({ id: p.id, weekStart: p.weekStart, weekEnd: p.weekEnd }));
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
            const net          = activeEntries.reduce((s, e) => s + Number(e.netAmount), 0);
            const svcTotal     = (p.serviceEntries ?? []).reduce((s, e) => s + Number(e.totalPay), 0);
            const expanded     = expandedPeriod === p.id;
            const statusCfg    = STATUS_BADGE[p.status] ?? { color: C.textSecondary, label: p.status };
            const needsApproval = p.entries.filter(
              e => e.sale && e.sale.enrollmentFee !== null && Number(e.sale.enrollmentFee) < 99 && !e.sale.commissionApproved
            );

            // Group entries by agent
            const byAgent = new Map<string, Entry[]>();
            for (const e of p.entries) {
              const name = e.agent?.name ?? "Unknown";
              if (!byAgent.has(name)) byAgent.set(name, []);
              byAgent.get(name)!.push(e);
            }
            // Include all active agents even with 0 entries
            for (const agent of allAgents) {
              if (!byAgent.has(agent.name)) byAgent.set(agent.name, []);
            }

            return (
              <Card key={p.id} style={{ borderRadius: R["2xl"] }} className="animate-fade-in-up">
                {/* Period header — clickable to collapse/expand */}
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", marginBottom: S[5] }}
                  onClick={() => setExpandedPeriod(expanded ? null : p.id)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: S[3], flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 17, color: C.textPrimary, letterSpacing: "-0.01em" }}>
                      {fmtDate(p.weekStart)} – {fmtDate(p.weekEnd)}
                    </span>
                    <span style={{ fontSize: 13, color: C.textMuted }}>{p.quarterLabel}</span>
                    <Badge color={statusCfg.color} dot>{statusCfg.label}</Badge>
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
                          net: active.reduce((s, e) => s + Number(e.netAmount), 0),
                          gross: active.reduce((s, e) => s + Number(e.payoutAmount), 0),
                          activeCount: active.length,
                        };
                      });
                      const sorted = [...agentEntries].sort((a, b) => b.net - a.net);
                      const top3 = new Set(sorted.slice(0, 3).filter(a => a.net > 0).map(a => a.name));

                      return agentEntries.map(({ name: agentName, entries, net: agentNet, gross: agentGross, activeCount }, agentIdx) => {
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

                    {/* Customer Service — per-agent cards */}
                    {(p.serviceEntries ?? []).length > 0 && (
                      <>
                        {/* CS section header */}
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

                        {/* Individual CS agent cards */}
                        {p.serviceEntries.map((se, seIdx) => {
                          const bd = (se.bonusBreakdown ?? {}) as Record<string, number>;
                          const seFronted = Number(se.frontedAmount ?? 0);
                          const bonusTotal = bonusCategories.filter(c => !c.isDeduction).reduce((s, c) => s + (bd[c.name] ?? 0), 0);
                          const deductionTotal = bonusCategories.filter(c => c.isDeduction).reduce((s, c) => s + (bd[c.name] ?? 0), 0);
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
                              {/* Agent header */}
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

                              {/* Date range */}
                              <div style={{ padding: `${S[2]}px ${S[5]}px`, fontSize: 12, color: C.textMuted, borderBottom: `1px solid ${C.borderSubtle}` }}>
                                Sunday {fmtDate(p.weekStart)} – Saturday {fmtDate(p.weekEnd)}
                              </div>

                              {/* Pay breakdown */}
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
      )}

      {/* ── Chargebacks ───────────────────────────────────────── */}
      {tab === "chargebacks" && (
        <div className="animate-fade-in" style={{ maxWidth: 540 }}>
          <p style={{ color: C.textMuted, marginTop: 0, marginBottom: S[5], fontSize: 14, lineHeight: 1.7 }}>
            Match by Member ID (preferred) or Member Name to process a chargeback. A deduction entry will be applied to the current week.
          </p>

          <Card style={{ borderRadius: R["2xl"] }}>
            <form onSubmit={submitChargeback} style={{ display: "grid", gap: S[5] }}>
              <div>
                <label style={LBL}>Member ID <span style={{ color: C.textMuted, fontWeight: 400, textTransform: "none", fontSize: 11 }}>(preferred)</span></label>
                <input
                  className="input-focus"
                  style={inputStyle}
                  value={chargebackForm.memberId}
                  placeholder="e.g. M-12345"
                  onChange={e => setChargebackForm(f => ({ ...f, memberId: e.target.value }))}
                />
              </div>
              <div>
                <label style={LBL}>Member Name <span style={{ color: C.textMuted, fontWeight: 400, textTransform: "none", fontSize: 11 }}>(if no ID)</span></label>
                <input
                  className="input-focus"
                  style={inputStyle}
                  value={chargebackForm.memberName}
                  placeholder="e.g. John Doe"
                  onChange={e => setChargebackForm(f => ({ ...f, memberName: e.target.value }))}
                />
              </div>
              <div>
                <label style={LBL}>Notes</label>
                <textarea
                  className="input-focus"
                  style={{ ...inputStyle, height: 88, resize: "vertical" } as React.CSSProperties}
                  value={chargebackForm.notes}
                  onChange={e => setChargebackForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: S[4], flexWrap: "wrap" }}>
                <Button variant="danger" type="submit">
                  <XCircle size={15} /> Process Chargeback
                </Button>
                {chargebackMsg && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: S[2],
                    color: chargebackMsg.startsWith("Chargeback") ? C.success : C.danger,
                    fontWeight: 600, fontSize: 13,
                  }}>
                    {chargebackMsg.startsWith("Chargeback")
                      ? <CheckCircle size={14} />
                      : <AlertTriangle size={14} />}
                    {chargebackMsg}
                  </div>
                )}
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── Exports ───────────────────────────────────────────── */}
      {tab === "exports" && (
        <div className="animate-fade-in" style={{ maxWidth: 560 }}>
          <p style={{ color: C.textMuted, marginTop: 0, fontSize: 14, marginBottom: S[5], lineHeight: 1.7 }}>
            Download payroll period data as a CSV file. Choose a time range and export format.
          </p>

          <Card style={{ borderRadius: R["2xl"] }}>
            {/* Date range selector */}
            <div style={{ marginBottom: S[6] }}>
              <label style={LBL}>Date Range</label>
              <DateRangeFilter value={exportDateFilter} onChange={setExportDateFilter} />
            </div>

            {/* Export actions */}
            <div style={{ display: "grid", gap: S[3] }}>
              {/* Summary CSV */}
              <Card padding="sm" style={{ padding: S[5], display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary, marginBottom: 4 }}>Summary CSV</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>Week range, status, entries count, gross and net per period</div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => { setExporting(true); exportCSV(); setTimeout(() => setExporting(false), 800); }}
                  style={{ flexShrink: 0 }}
                >
                  <Download size={14} /> Export
                </Button>
              </Card>

              {/* Detailed CSV */}
              <Card padding="sm" style={{ padding: S[5], display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary, marginBottom: 4 }}>Detailed CSV</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>Per-entry rows — agent, member, products, fees, commission, bonus, fronted, net</div>
                </div>
                <Button
                  variant="primary"
                  onClick={() => { setExporting(true); exportDetailedCSV(); setTimeout(() => setExporting(false), 800); }}
                  style={{ flexShrink: 0 }}
                >
                  <Download size={14} /> Export
                </Button>
              </Card>
            </div>
          </Card>
        </div>
      )}

      {/* ── Products ──────────────────────────────────────────── */}
      {tab === "products" && (
        <div className="animate-fade-in" style={{ maxWidth: 800 }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: S[5] }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: C.textPrimary }}>Products & Commission</h2>
              <p style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 0" }}>Configure product types and commission rates</p>
            </div>
            <Button
              variant="primary"
              onClick={() => setShowAddProduct(v => !v)}
            >
              <Plus size={14} /> Add Product
            </Button>
          </div>

          {/* Add product form */}
          {showAddProduct && (
            <Card className="animate-slide-down" style={{ borderRadius: R["2xl"], marginBottom: S[5] }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary, marginBottom: S[4] }}>New Product</div>
              <form onSubmit={addProduct} style={{ display: "grid", gap: S[3] }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: S[2] }}>
                  <div>
                    <label style={LBL}>Name</label>
                    <input className="input-focus" style={inputStyle} value={newProduct.name} placeholder="Product name *" required onChange={e => setNewProduct(x => ({ ...x, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={LBL}>Type</label>
                    <select className="input-focus" style={{ ...inputStyle, height: 42 }} value={newProduct.type} onChange={e => setNewProduct(x => ({ ...x, type: e.target.value as ProductType }))}>
                      <option value="CORE">Core Product</option>
                      <option value="ADDON">Add-on</option>
                      <option value="AD_D">AD&D</option>
                    </select>
                  </div>
                </div>
                {newProduct.type === "CORE" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                    <div><label style={LBL}>Premium Threshold ($)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.premiumThreshold} placeholder="e.g. 250" onChange={e => setNewProduct(x => ({ ...x, premiumThreshold: e.target.value }))} /></div>
                    <div><label style={LBL}>Commission Below (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.commissionBelow} placeholder="e.g. 30" onChange={e => setNewProduct(x => ({ ...x, commissionBelow: e.target.value }))} /></div>
                    <div><label style={LBL}>Commission Above (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.commissionAbove} placeholder="e.g. 40" onChange={e => setNewProduct(x => ({ ...x, commissionAbove: e.target.value }))} /></div>
                  </div>
                )}
                {(newProduct.type === "ADDON" || newProduct.type === "AD_D") && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                    <div><label style={LBL}>Bundled Commission (%){newProduct.type === "ADDON" ? " — blank = match core" : ""}</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.bundledCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setNewProduct(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
                    <div><label style={LBL}>Standalone Commission (%)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.standaloneCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setNewProduct(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
                    <div><label style={LBL}>Enroll Fee Threshold ($)</label><input className="input-focus" style={inputStyle} type="number" step="0.01" value={newProduct.enrollFeeThreshold} placeholder="e.g. 50" onChange={e => setNewProduct(x => ({ ...x, enrollFeeThreshold: e.target.value }))} /></div>
                  </div>
                )}
                <input className="input-focus" style={inputStyle} value={newProduct.notes} placeholder="Notes (optional)" onChange={e => setNewProduct(x => ({ ...x, notes: e.target.value }))} />
                <div style={{ display: "flex", gap: S[2], alignItems: "center", flexWrap: "wrap" }}>
                  <Button variant="success" type="submit">
                    <Plus size={14} /> Add Product
                  </Button>
                  <Button variant="ghost" type="button" onClick={() => setShowAddProduct(false)}>Cancel</Button>
                  {cfgMsg && (
                    <span style={{ color: cfgMsg.startsWith("Error") ? C.danger : C.success, fontWeight: 600, fontSize: 13 }}>
                      {cfgMsg}
                    </span>
                  )}
                </div>
              </form>
            </Card>
          )}

          {/* Product grid */}
          {products.length === 0 ? (
            <Card style={{ borderRadius: R["2xl"] }}>
              <EmptyState
                icon={<Package size={32} />}
                title="No products configured yet"
                description="Add your first product above."
              />
            </Card>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S[4] }} className="grid-mobile-1">
              {products.map((p, i) => (
                <div key={p.id} className={`animate-fade-in-up stagger-${Math.min(i + 1, 10)}`}>
                  <ProductCard product={p} onSave={saveProduct} onDelete={deleteProduct} />
                </div>
              ))}
            </div>
          )}

          {/* Global cfgMsg outside add form */}
          {!showAddProduct && cfgMsg && (
            <div style={{ marginTop: S[4], color: cfgMsg.startsWith("Error") ? C.danger : C.success, fontWeight: 600, fontSize: 13 }}>
              {cfgMsg}
            </div>
          )}

          {/* Enrollment fee rules note */}
          <div style={{
            marginTop: S[5], padding: S[4],
            background: C.bgSurface,
            border: `1px solid ${C.borderSubtle}`,
            borderRadius: R.lg,
            fontSize: 12, color: C.textMuted, lineHeight: 1.7,
          }}>
            <strong style={{ color: C.textTertiary }}>Enrollment fee rules:</strong>{" "}
            $125 → +$10 bonus · $99 → $0 · Below $99 → halves all commission (unless approved) · Standalone add-ons: $50 threshold instead of $99
          </div>
        </div>
      )}

      {/* ── Service Staff ──────────────────────────────────────── */}
      {tab === "service" && (
        <div className="animate-fade-in" style={{ display: "grid", gap: S[6] }}>
          {/* Top two-column config */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S[5] }} className="stack-mobile">
            {/* Service Agents */}
            <Card style={{ borderRadius: R["2xl"] }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S[4] }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Service Agents</h3>
                  <p style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 0" }}>Manage agents with base pay</p>
                </div>
              </div>

              <div style={{ display: "grid", gap: S[2], marginBottom: S[4] }}>
                {serviceAgents.length === 0 && (
                  <EmptyState
                    icon={<Users size={28} />}
                    title="No service agents yet"
                    description="Add your first service agent below."
                  />
                )}
                {serviceAgents.map(a => (
                  <ServiceAgentCard key={a.id} agent={a} onSave={saveServiceAgent} />
                ))}
              </div>

              {/* Add agent form */}
              <form onSubmit={addServiceAgent} style={{ borderTop: `1px solid ${C.borderSubtle}`, paddingTop: S[4], display: "grid", gap: S[2] }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: S[1] }}>
                  Add Agent
                </div>
                <input className="input-focus" style={inputStyle} value={newServiceAgent.name} placeholder="Full name *" required onChange={e => setNewServiceAgent(x => ({ ...x, name: e.target.value }))} />
                <input className="input-focus" style={inputStyle} type="number" step="0.01" value={newServiceAgent.basePay} placeholder="Base Pay ($) *" required onChange={e => setNewServiceAgent(x => ({ ...x, basePay: e.target.value }))} />
                <Button variant="success" type="submit">
                  <Plus size={13} /> Add Agent
                </Button>
              </form>
            </Card>

            {/* Bonus Categories */}
            <Card style={{ borderRadius: R["2xl"] }}>
              <div style={{ marginBottom: S[4] }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Bonus Categories</h3>
                <p style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 0" }}>Configure bonus/deduction columns</p>
              </div>

              <div style={{ display: "grid", gap: S[2], marginBottom: S[4] }}>
                {bonusCategories.length === 0 && (
                  <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>No categories configured.</p>
                )}
                {bonusCategories.map((cat, i) => (
                  <div
                    key={cat.name}
                    style={{
                      display: "flex", alignItems: "center", gap: S[2],
                      padding: "10px 14px",
                      background: C.bgSurfaceRaised,
                      borderRadius: R.lg,
                      border: `1px solid ${C.borderSubtle}`,
                    }}
                  >
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: cat.isDeduction ? C.danger : C.textPrimary }}>
                      {cat.name}
                    </span>
                    <Badge color={cat.isDeduction ? C.danger : C.success} dot>
                      {cat.isDeduction ? "Deduction" : "Bonus"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => saveBonusCategories(bonusCategories.filter((_, j) => j !== i))}
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: C.danger, padding: "4px 8px" }}
                    >
                      <Trash2 size={11} />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add category */}
              <div style={{ borderTop: `1px solid ${C.borderSubtle}`, paddingTop: S[4] }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: S[3] }}>
                  Add Category
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: S[2], alignItems: "end" }}>
                  <div>
                    <label style={LBL}>Name</label>
                    <input
                      className="input-focus"
                      style={inputStyle}
                      value={newCatName}
                      placeholder="e.g. Flips"
                      onChange={e => setNewCatName(e.target.value)}
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: S[1], fontSize: 12, color: C.textSecondary, paddingBottom: 4, cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={newCatDeduction} onChange={e => setNewCatDeduction(e.target.checked)} />
                    Deduction
                  </label>
                  <Button
                    variant="success"
                    type="button"
                    onClick={() => {
                      if (!newCatName.trim()) return;
                      saveBonusCategories([...bonusCategories, { name: newCatName.trim(), isDeduction: newCatDeduction }]);
                      setNewCatName(""); setNewCatDeduction(false);
                    }}
                  >
                    <Plus size={13} /> Add
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Weekly Payroll input table */}
          <Card style={{ borderRadius: R["2xl"] }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S[5] }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Weekly Payroll Entry</h3>
                <p style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 0" }}>Enter bonus amounts per category for each service agent</p>
              </div>
              <div style={{ minWidth: 220 }}>
                <label style={LBL}>Payroll Period</label>
                <select
                  className="input-focus"
                  style={{ ...inputStyle, height: 40 }}
                  value={svcPeriodId}
                  onChange={e => setSvcPeriodId(e.target.value)}
                >
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{fmtDate(p.weekStart)} – {fmtDate(p.weekEnd)}</option>
                  ))}
                </select>
              </div>
            </div>

            {bonusCategories.length === 0 ? (
              <p style={{ color: C.textMuted, fontSize: 13 }}>Add bonus categories above to start entering payroll.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Agent</th>
                      <th style={thRight}>Base Pay</th>
                      <th style={{ ...thCenter, color: C.danger }}>Fronted</th>
                      {bonusCategories.map(cat => (
                        <th key={cat.name} style={{ ...thCenter, color: cat.isDeduction ? C.danger : C.textTertiary }}>
                          {cat.name}
                        </th>
                      ))}
                      <th style={{ ...thRight, color: C.info }}>Total</th>
                      <th style={thCenter}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceAgents.filter(a => a.active).map((agent, agentIdx) => {
                      const key = agent.id;
                      const currentPeriod = periods.find(p => p.id === svcPeriodId);
                      const existingEntry = currentPeriod?.serviceEntries?.find(se => se.serviceAgent.name === agent.name);
                      const vals = svcBonuses[key] ?? (existingEntry?.bonusBreakdown
                        ? Object.fromEntries(Object.entries(existingEntry.bonusBreakdown).map(([k, v]) => [k, String(v)]))
                        : {});
                      const frontedVal = svcFronted[key] ?? String(existingEntry?.frontedAmount ?? 0);
                      const basePay = Number(agent.basePay);
                      const frontedNum = Number(frontedVal) || 0;
                      let total = basePay - frontedNum;
                      for (const cat of bonusCategories) {
                        const amt = Number(vals[cat.name]) || 0;
                        total += cat.isDeduction ? -amt : amt;
                      }

                      return (
                        <tr
                          key={key}
                          className="row-hover"
                          style={{ borderTop: `1px solid ${C.borderSubtle}` }}
                        >
                          <td style={{ ...tdStyle, fontWeight: 600, color: C.textPrimary }}>
                            {agent.name}
                            {existingEntry && (
                              <span style={{ fontSize: 10, color: C.info, marginLeft: 6, fontWeight: 500 }}>
                                saved
                              </span>
                            )}
                          </td>
                          <td style={{ ...tdRight, color: C.textSecondary, fontWeight: 600 }}>
                            {formatDollar(basePay)}
                          </td>
                          <td style={{ ...tdCenter, padding: "6px 4px" }}>
                            <input
                              className="input-focus"
                              style={{
                                ...SMALL_INP, width: 72, textAlign: "center",
                                background: frontedNum > 0 ? "rgba(248,113,113,0.10)" : SMALL_INP.background,
                                color: frontedNum > 0 ? C.danger : C.textPrimary,
                              }}
                              type="number" step="0.01" placeholder="0"
                              value={frontedVal === "0" ? "" : frontedVal}
                              onChange={e => setSvcFronted(prev => ({ ...prev, [key]: e.target.value }))}
                            />
                          </td>
                          {bonusCategories.map(cat => (
                            <td key={cat.name} style={{ ...tdCenter, padding: "6px 4px" }}>
                              <input
                                className="input-focus"
                                style={{
                                  ...SMALL_INP, width: 68, textAlign: "center",
                                  background: cat.isDeduction && Number(vals[cat.name] || 0) > 0 ? "rgba(248,113,113,0.10)" : SMALL_INP.background,
                                  color: cat.isDeduction ? C.danger : C.textPrimary,
                                }}
                                type="number" step="0.01" placeholder="0"
                                value={vals[cat.name] ?? ""}
                                onChange={e => setSvcBonuses(prev => ({ ...prev, [key]: { ...vals, [cat.name]: e.target.value } }))}
                              />
                            </td>
                          ))}
                          <td style={{ ...tdRight, fontWeight: 800, fontSize: 15, color: C.info }}>
                            <AnimatedNumber value={total} prefix="$" decimals={2} />
                          </td>
                          <td style={tdCenter}>
                            <Button
                              variant="primary"
                              size="sm"
                              type="button"
                              onClick={() => submitServiceBonus(agent.id)}
                            >
                              <Save size={12} /> Save
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Service status message */}
          {svcMsg && (
            <div style={{
              display: "flex", alignItems: "center", gap: S[2],
              padding: "12px 16px",
              background: svcMsg.startsWith("Error") ? "rgba(248,113,113,0.08)" : "rgba(52,211,153,0.08)",
              border: `1px solid ${svcMsg.startsWith("Error") ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)"}`,
              borderRadius: R.lg,
              color: svcMsg.startsWith("Error") ? C.danger : C.success,
              fontWeight: 600, fontSize: 13,
            }}>
              {svcMsg.startsWith("Error") ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
              {svcMsg}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
