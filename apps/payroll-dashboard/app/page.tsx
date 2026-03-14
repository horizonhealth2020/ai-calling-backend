"use client";
import { useState, useEffect, FormEvent } from "react";
import { PageShell, Badge, AnimatedNumber, SkeletonCard } from "@ops/ui";
import { colors, spacing, radius, shadows, motion, baseCardStyle, baseInputStyle, baseLabelStyle, baseButtonStyle } from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";
import {
  Calendar, AlertTriangle, FileDown, Package, Users,
  ChevronDown, ChevronUp, Lock, Unlock, CheckCircle,
  XCircle, Download, Printer, Plus, Edit3, Trash2,
  Save, X, Check, RefreshCw,
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
type ExportRange = "week" | "month" | "quarter";

/* ── Design tokens (local aliases) ─────────────────────────── */

const C = colors;
const S = spacing;
const R = radius;

/* ── Style constants ─────────────────────────────────────────── */

const CARD: React.CSSProperties = {
  ...baseCardStyle,
  borderRadius: R["2xl"],
};

const CARD_SM: React.CSSProperties = {
  background: C.bgSurface,
  border: `1px solid ${C.borderDefault}`,
  borderRadius: R.xl,
  padding: S[5],
};

const INP: React.CSSProperties = {
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

const BTN_PRIMARY: React.CSSProperties = {
  ...baseButtonStyle,
  background: C.primary600,
  color: "#fff",
};

const BTN_SUCCESS: React.CSSProperties = {
  ...baseButtonStyle,
  background: "#059669",
  color: "#fff",
};

const BTN_DANGER: React.CSSProperties = {
  ...baseButtonStyle,
  background: "#dc2626",
  color: "#fff",
};

const BTN_GHOST: React.CSSProperties = {
  ...baseButtonStyle,
  background: "transparent",
  border: `1px solid ${C.borderDefault}`,
  color: C.textSecondary,
};

const BTN_WARNING: React.CSSProperties = {
  ...baseButtonStyle,
  background: "rgba(251,191,36,0.12)",
  border: "1px solid rgba(251,191,36,0.25)",
  color: C.warning,
};

const BTN_ICON: React.CSSProperties = {
  ...baseButtonStyle,
  padding: "6px 10px",
  fontSize: 12,
  gap: 4,
};

const TH: React.CSSProperties = {
  padding: "10px 10px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 700,
  color: C.textTertiary,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: `1px solid ${C.borderDefault}`,
  whiteSpace: "nowrap",
  background: C.bgSurface,
  position: "sticky",
  top: 0,
};

const TH_R: React.CSSProperties = { ...TH, textAlign: "right" };
const TH_C: React.CSSProperties = { ...TH, textAlign: "center" };

const TD: React.CSSProperties = { padding: "10px 10px", fontSize: 13 };
const TD_R: React.CSSProperties = { ...TD, textAlign: "right" };
const TD_C: React.CSSProperties = { ...TD, textAlign: "center" };

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
  entry, onSaleUpdate, onBonusFrontedUpdate, onApprove, onUnapprove, onDelete,
}: {
  entry: Entry;
  onSaleUpdate: (saleId: string, data: Record<string, unknown>) => Promise<void>;
  onBonusFrontedUpdate: (entryId: string, bonus: number, fronted: number, hold: number) => Promise<void>;
  onApprove: (saleId: string) => Promise<void>;
  onUnapprove: (saleId: string) => Promise<void>;
  onDelete: (saleId: string) => Promise<void>;
}) {
  const [editSale, setEditSale] = useState(false);
  const [saleData, setSaleData] = useState({
    memberName: entry.sale?.memberName ?? "",
    memberId: entry.sale?.memberId ?? "",
    carrier: entry.sale?.carrier ?? "",
    premium: String(entry.sale?.premium ?? ""),
    notes: entry.sale?.notes ?? "",
  });
  const [bonus, setBonus] = useState(String(entry.bonusAmount ?? 0));
  const [fronted, setFronted] = useState(String(entry.frontedAmount ?? 0));
  const [hold, setHold] = useState(String(entry.holdAmount ?? 0));
  const [saving, setSaving] = useState(false);

  const fee = entry.sale?.enrollmentFee != null ? Number(entry.sale.enrollmentFee) : null;
  const needsApproval = fee !== null && fee < 99 && !entry.sale?.commissionApproved;
  const isApproved = entry.sale?.commissionApproved && fee !== null && fee < 99;
  const net = Number(entry.netAmount);

  const rowBg: React.CSSProperties = needsApproval
    ? { borderLeft: "3px solid rgba(248,113,113,0.5)" }
    : { borderLeft: "3px solid transparent" };

  return (
    <tr
      className="row-hover"
      style={{ borderTop: `1px solid ${C.borderSubtle}`, ...rowBg }}
    >
      <td style={TD}><span style={{ color: C.textPrimary, fontWeight: 500 }}>{entry.agent?.name ?? "—"}</span></td>

      <td style={TD}>
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

      <td style={TD}>
        {editSale ? (
          <input
            className="input-focus"
            style={{ ...SMALL_INP, width: 110, textAlign: "left" }}
            value={saleData.carrier}
            onChange={e => setSaleData(d => ({ ...d, carrier: e.target.value }))}
          />
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {/* Core product */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Badge color={C.primary400} size="sm">{entry.sale?.product?.name ?? "—"}</Badge>
              {entry.sale?.premium != null && (
                <span style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>${Number(entry.sale.premium).toFixed(2)}</span>
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

      <td style={TD_R}>
        {editSale ? (
          <input
            className="input-focus"
            style={SMALL_INP}
            type="number" step="0.01"
            value={saleData.premium}
            onChange={e => setSaleData(d => ({ ...d, premium: e.target.value }))}
          />
        ) : (
          <span style={{ color: needsApproval ? C.danger : C.textSecondary, fontWeight: needsApproval ? 700 : 400 }}>
            {fee !== null ? `$${fee.toFixed(2)}` : "—"}
          </span>
        )}
      </td>

      <td style={TD_R}>
        <span style={{ color: C.textPrimary, fontWeight: 700 }}>
          ${Number(entry.payoutAmount).toFixed(2)}
        </span>
      </td>

      {/* Bonus — green bg when > 0 */}
      <td style={{ ...TD_R, padding: "8px 6px" }}>
        <input
          className="input-focus"
          style={{
            ...SMALL_INP, width: 78,
            background: Number(bonus) > 0 ? "rgba(52,211,153,0.10)" : SMALL_INP.background,
            color: Number(bonus) > 0 ? C.success : C.textPrimary,
          }}
          type="number" step="0.01" value={bonus}
          onChange={e => setBonus(e.target.value)}
          onBlur={() => onBonusFrontedUpdate(entry.id, Number(bonus) || 0, Number(fronted) || 0, Number(hold) || 0)}
        />
      </td>

      {/* Fronted — red bg when > 0 */}
      <td style={{ ...TD_R, padding: "8px 6px" }}>
        <input
          className="input-focus"
          style={{
            ...SMALL_INP, width: 78,
            background: Number(fronted) > 0 ? "rgba(248,113,113,0.10)" : SMALL_INP.background,
            color: Number(fronted) > 0 ? C.danger : C.textPrimary,
          }}
          type="number" step="0.01" value={fronted}
          onChange={e => setFronted(e.target.value)}
          onBlur={() => onBonusFrontedUpdate(entry.id, Number(bonus) || 0, Number(fronted) || 0, Number(hold) || 0)}
        />
      </td>

      {/* Hold — amber bg when > 0 */}
      <td style={{ ...TD_R, padding: "8px 6px" }}>
        <input
          className="input-focus"
          style={{
            ...SMALL_INP, width: 78,
            background: Number(hold) > 0 ? "rgba(251,191,36,0.10)" : SMALL_INP.background,
            color: Number(hold) > 0 ? C.warning : C.textPrimary,
          }}
          type="number" step="0.01" value={hold}
          onChange={e => setHold(e.target.value)}
          onBlur={() => onBonusFrontedUpdate(entry.id, Number(bonus) || 0, Number(fronted) || 0, Number(hold) || 0)}
        />
      </td>

      {/* Net — animated, color by sign */}
      <td style={TD_R}>
        <span style={{ fontWeight: 700, color: net >= 0 ? C.success : C.danger }}>
          <AnimatedNumber value={net} prefix="$" decimals={2} />
        </span>
      </td>

      {/* Actions */}
      <td style={TD_C}>
        {editSale ? (
          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
            <button
              className="btn-hover"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onSaleUpdate(entry.sale!.id, {
                  memberName: saleData.memberName,
                  memberId: saleData.memberId || null,
                  carrier: saleData.carrier,
                  premium: Number(saleData.premium),
                  notes: saleData.notes || null,
                });
                setEditSale(false); setSaving(false);
              }}
              style={{ ...BTN_ICON, background: "#059669", color: "#fff", border: "none" }}
            >
              <Save size={12} /> Save
            </button>
            <button
              className="btn-hover"
              onClick={() => setEditSale(false)}
              style={{ ...BTN_ICON, ...BTN_GHOST }}
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
            <button
              className="btn-hover"
              onClick={() => setEditSale(true)}
              style={{ ...BTN_ICON, ...BTN_GHOST }}
            >
              <Edit3 size={12} /> Edit
            </button>
            {needsApproval && (
              <button
                className="btn-hover"
                onClick={() => onApprove(entry.sale!.id)}
                style={{ ...BTN_ICON, background: "#059669", color: "#fff", border: "none" }}
              >
                <CheckCircle size={12} /> Approve
              </button>
            )}
            {isApproved && (
              <button
                className="btn-hover"
                onClick={() => onUnapprove(entry.sale!.id)}
                style={{ ...BTN_ICON, ...BTN_WARNING }}
              >
                <XCircle size={12} /> Unapprove
              </button>
            )}
            {entry.sale && (
              <button
                className="btn-hover"
                onClick={() => onDelete(entry.sale!.id)}
                style={{ ...BTN_ICON, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
              >
                <Trash2 size={12} />
              </button>
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
                <button
                  className="btn-hover"
                  onClick={() => setEdit(true)}
                  style={{ ...BTN_ICON, ...BTN_GHOST }}
                >
                  <Edit3 size={12} /> Edit
                </button>
                <button
                  className="btn-hover"
                  onClick={() => setShowDeleteConfirm(true)}
                  style={{ ...BTN_ICON, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: C.danger }}
                >
                  <Trash2 size={12} />
                </button>
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
                  <button
                    className="btn-hover"
                    onClick={() => { onDelete(product.id); setShowDeleteConfirm(false); }}
                    style={{ ...BTN_ICON, background: "#dc2626", color: "#fff", border: "none" }}
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                  <button
                    className="btn-hover"
                    onClick={() => setShowDeleteConfirm(false)}
                    style={{ ...BTN_ICON, ...BTN_GHOST }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: "grid", gap: S[3] }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: S[2] }}>
              <div>
                <label style={LBL}>Name</label>
                <input className="input-focus" style={INP} value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
              </div>
              <div>
                <label style={LBL}>Type</label>
                <select className="input-focus" style={{ ...INP, height: 42 }} value={d.type} onChange={e => setD(x => ({ ...x, type: e.target.value as ProductType }))}>
                  <option value="CORE">Core Product</option>
                  <option value="ADDON">Add-on</option>
                  <option value="AD_D">AD&D</option>
                </select>
              </div>
            </div>

            {d.type === "CORE" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                <div><label style={LBL}>Premium Threshold ($)</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.premiumThreshold} placeholder="e.g. 250" onChange={e => setD(x => ({ ...x, premiumThreshold: e.target.value }))} /></div>
                <div><label style={LBL}>Commission Below (%)</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.commissionBelow} placeholder="e.g. 30" onChange={e => setD(x => ({ ...x, commissionBelow: e.target.value }))} /></div>
                <div><label style={LBL}>Commission Above (%)</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.commissionAbove} placeholder="e.g. 40" onChange={e => setD(x => ({ ...x, commissionAbove: e.target.value }))} /></div>
              </div>
            )}

            {(d.type === "ADDON" || d.type === "AD_D") && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                <div><label style={LBL}>Bundled Commission (%){d.type === "ADDON" ? " — blank = match core" : ""}</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.bundledCommission} placeholder={d.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setD(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
                <div><label style={LBL}>Standalone Commission (%)</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.standaloneCommission} placeholder={d.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setD(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
                <div><label style={LBL}>Enroll Fee Threshold ($)</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.enrollFeeThreshold} placeholder="e.g. 50" onChange={e => setD(x => ({ ...x, enrollFeeThreshold: e.target.value }))} /></div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: S[2], alignItems: "end" }}>
              <div><label style={LBL}>Notes</label><input className="input-focus" style={INP} value={d.notes} placeholder="Notes" onChange={e => setD(x => ({ ...x, notes: e.target.value }))} /></div>
              <label style={{ display: "flex", alignItems: "center", gap: S[2], fontSize: 13, paddingBottom: 6, color: C.textSecondary, cursor: "pointer" }}>
                <input type="checkbox" checked={d.active} onChange={e => setD(x => ({ ...x, active: e.target.checked }))} /> Active
              </label>
            </div>

            <div style={{ display: "flex", gap: S[2] }}>
              <button className="btn-hover" style={BTN_SUCCESS} disabled={saving} onClick={handleSave}>
                <Save size={14} /> {saving ? "Saving…" : "Save"}
              </button>
              <button className="btn-hover" style={BTN_GHOST} onClick={() => setEdit(false)}>Cancel</button>
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
    <div
      className="hover-lift interactive-card"
      style={{ ...CARD_SM, display: "flex", justifyContent: "space-between", alignItems: edit ? "flex-start" : "center", gap: S[3] }}
    >
      {!edit ? (
        <>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              Base Pay: <span style={{ color: C.textSecondary, fontWeight: 600 }}>${Number(agent.basePay).toFixed(2)}</span>
              {!agent.active && <span style={{ marginLeft: 6, color: C.textMuted }}> · Inactive</span>}
            </div>
          </div>
          <button className="btn-hover" onClick={() => setEdit(true)} style={{ ...BTN_ICON, ...BTN_GHOST, flexShrink: 0 }}>
            <Edit3 size={12} /> Edit
          </button>
        </>
      ) : (
        <div style={{ display: "grid", gap: S[2], width: "100%" }}>
          <input className="input-focus" style={INP} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
          <input className="input-focus" style={INP} type="number" step="0.01" value={d.basePay} placeholder="Base Pay ($)" onChange={e => setD(x => ({ ...x, basePay: e.target.value }))} />
          <div style={{ display: "flex", gap: S[2] }}>
            <button
              className="btn-hover"
              style={BTN_SUCCESS}
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onSave(agent.id, { name: d.name, basePay: Number(d.basePay) });
                setEdit(false); setSaving(false);
              }}
            >
              <Save size={13} /> {saving ? "Saving…" : "Save"}
            </button>
            <button className="btn-hover" style={BTN_GHOST} onClick={() => setEdit(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
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

/* ── Main Page ───────────────────────────────────────────────── */

export default function PayrollDashboard() {
  const [tab, setTab] = useState<Tab>("periods");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [serviceAgents, setServiceAgents] = useState<ServiceAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const [chargebackForm, setChargebackForm] = useState({ memberName: "", memberId: "", notes: "" });
  const [chargebackMsg, setChargebackMsg] = useState("");

  const [exportRange, setExportRange] = useState<ExportRange>("week");
  const [exporting, setExporting] = useState(false);

  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

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

  useEffect(() => {
    captureTokenFromUrl();
    Promise.all([
      authFetch(`${API}/api/payroll/periods`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/products`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/service-agents`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/settings/service-bonus-categories`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/agents`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([p, prod, sa, cats, agents]) => {
      setPeriods(p);
      setProducts(prod);
      setServiceAgents(sa);
      setBonusCategories(cats);
      setAllAgents(agents);
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
        alert(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) {
      alert(`Error: Unable to reach API — ${e.message ?? "network error"}`);
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
    if (!window.confirm(`Mark ${label} as UNPAID?`)) return;
    const res = await authFetch(`${API}/api/payroll/mark-unpaid`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds, serviceEntryIds }),
    });
    if (res.ok) await refreshPeriods();
  }

  function filterPeriodsByRange(range: ExportRange): Period[] {
    const now = new Date();
    return periods.filter(p => {
      const start = new Date(p.weekStart);
      if (range === "week")    { const d = new Date(now); d.setDate(now.getDate() - 7);        return start >= d; }
      if (range === "month")   { const d = new Date(now); d.setMonth(now.getMonth() - 1);      return start >= d; }
      const d = new Date(now); d.setMonth(now.getMonth() - 3); return start >= d;
    });
  }

  function exportCSV(range: ExportRange) {
    const filtered = filterPeriodsByRange(range);
    const rows = [["Week Start", "Week End", "Quarter", "Status", "Entries", "Gross", "Net"]];
    filtered.forEach(p => {
      const gross = p.entries.reduce((s, e) => s + Number(e.payoutAmount), 0);
      const net   = p.entries.reduce((s, e) => s + Number(e.netAmount), 0);
      rows.push([p.weekStart, p.weekEnd, p.quarterLabel, p.status, String(p.entries.length), gross.toFixed(2), net.toFixed(2)]);
    });
    const label = range === "week" ? "weekly" : range === "month" ? "monthly" : "quarterly";
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })),
      download: `payroll-${label}.csv`,
    });
    a.click();
  }

  function exportDetailedCSV(range: ExportRange) {
    const filtered = filterPeriodsByRange(range);
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
    const label = range === "week" ? "weekly" : range === "month" ? "monthly" : "quarterly";
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })),
      download: `payroll-detailed-${label}.csv`,
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
      const res = await authFetch(`${API}/api/service-agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newServiceAgent.name, basePay: Number(newServiceAgent.basePay) }),
      });
      if (res.ok) {
        const a = await res.json();
        setServiceAgents(prev => [...prev, a]);
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
      {/* ── Payroll Periods ───────────────────────────────────── */}
      {tab === "periods" && (
        <div className="animate-fade-in" style={{ display: "grid", gap: S[4] }}>
          {periods.length === 0 && (
            <div style={{ ...CARD, textAlign: "center", padding: "48px 24px", color: C.textMuted }}>
              No payroll periods found
            </div>
          )}

          {periods.map(p => {
            const gross        = p.entries.reduce((s, e) => s + Number(e.payoutAmount), 0);
            const totalBonus   = p.entries.reduce((s, e) => s + Number(e.bonusAmount ?? 0), 0);
            const totalFronted = p.entries.reduce((s, e) => s + Number(e.frontedAmount ?? 0), 0);
            const totalHold    = p.entries.reduce((s, e) => s + Number(e.holdAmount ?? 0), 0);
            const net          = p.entries.reduce((s, e) => s + Number(e.netAmount), 0);
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
              <div key={p.id} style={CARD} className="animate-fade-in-up">
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
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: S[3] }}>
                    {(p.entries.length > 0 || (p.serviceEntries ?? []).length > 0) && (
                      <div style={{ position: "relative" }}>
                        <button
                          className="btn-hover"
                          onClick={ev => { ev.stopPropagation(); setPrintMenuPeriod(printMenuPeriod === p.id ? null : p.id); }}
                          style={{ ...BTN_ICON, background: C.infoBg, border: `1px solid rgba(45,212,191,0.2)`, color: C.info }}
                        >
                          <Printer size={12} /> Print
                        </button>
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
                  <StatMini label="Entries" value={p.entries.length} prefix="" color={C.textPrimary} />
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
                      const agentEntries = [...byAgent.entries()].map(([name, ents]) => ({
                        name,
                        entries: ents,
                        net: ents.reduce((s, e) => s + Number(e.netAmount), 0),
                        gross: ents.reduce((s, e) => s + Number(e.payoutAmount), 0),
                      }));
                      const sorted = [...agentEntries].sort((a, b) => b.net - a.net);
                      const top3 = new Set(sorted.slice(0, 3).filter(a => a.net > 0).map(a => a.name));

                      return agentEntries.map(({ name: agentName, entries, net: agentNet, gross: agentGross }, agentIdx) => {
                        const isTopEarner = top3.has(agentName);
                        return (
                          <div
                            key={agentName}
                            className={`animate-fade-in-up stagger-${Math.min(agentIdx + 1, 10)}`}
                            style={{
                              background: C.bgSurfaceRaised,
                              border: `1px solid ${isTopEarner ? "rgba(20,184,166,0.25)" : C.borderSubtle}`,
                              borderRadius: R.xl,
                              overflow: "hidden",
                            }}
                          >
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
                                  {entries.length} sale{entries.length !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <div style={{ display: "flex", gap: S[5], fontSize: 13, alignItems: "center" }}>
                                <span style={{ color: C.textMuted }}>Commission: <strong style={{ color: C.textPrimary }}>${agentGross.toFixed(2)}</strong></span>
                                <span style={{ color: C.textMuted }}>Net: <strong style={{ color: agentNet >= 0 ? C.success : C.danger }}>${agentNet.toFixed(2)}</strong></span>
                                <button
                                  className="btn-hover"
                                  onClick={() => printAgentCards([[agentName, entries]], p)}
                                  style={{ ...BTN_ICON, background: C.infoBg, border: `1px solid rgba(45,212,191,0.2)`, color: C.info }}
                                >
                                  <Printer size={11} /> Print
                                </button>
                                {entries.every(e => e.status === "PAID") ? (
                                  <button
                                    className="btn-hover"
                                    onClick={() => markEntriesUnpaid(entries.map(e => e.id), [], agentName)}
                                    style={{ ...BTN_ICON, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: C.success }}
                                  >
                                    <CheckCircle size={11} /> Paid
                                  </button>
                                ) : (
                                  <button
                                    className="btn-hover"
                                    onClick={() => markEntriesPaid(entries.map(e => e.id), [], agentName)}
                                    style={{ ...BTN_ICON, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
                                  >
                                    <XCircle size={11} /> Unpaid
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Date range */}
                            <div style={{ padding: `${S[2]}px ${S[5]}px`, fontSize: 12, color: C.textMuted, borderBottom: `1px solid ${C.borderSubtle}` }}>
                              Sunday {fmtDate(p.weekStart)} – Saturday {fmtDate(p.weekEnd)}
                            </div>

                            {/* Commission table */}
                            <div style={{ overflowX: "auto" }}>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 860 }}>
                                <thead>
                                  <tr>
                                    <th style={TH}>Agent</th>
                                    <th style={TH}>Member</th>
                                    <th style={TH}>Product</th>
                                    <th style={TH_R}>Enroll Fee</th>
                                    <th style={TH_R}>Commission</th>
                                    <th style={TH_R}>Bonus</th>
                                    <th style={TH_R}>Fronted</th>
                                    <th style={TH_R}>Hold</th>
                                    <th style={TH_R}>Net</th>
                                    <th style={TH_C}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {entries.map(e => (
                                    <EditableSaleRow
                                      key={e.id}
                                      entry={e}
                                      onSaleUpdate={updateSale}
                                      onBonusFrontedUpdate={updateBonusFronted}
                                      onApprove={id => toggleApproval(id, true)}
                                      onUnapprove={unapproveCommission}
                                      onDelete={deleteSale}
                                    />
                                  ))}
                                  {/* Agent subtotal */}
                                  <tr style={{ borderTop: `2px solid ${C.borderDefault}`, background: C.bgSurface }}>
                                    <td colSpan={4} style={{ ...TD, fontWeight: 700, fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Subtotal</td>
                                    <td style={{ ...TD_R, fontWeight: 700, color: C.textPrimary }}>${agentGross.toFixed(2)}</td>
                                    <td style={{ ...TD_R, fontWeight: 700, color: C.success }}>${entries.reduce((s, e) => s + Number(e.bonusAmount), 0).toFixed(2)}</td>
                                    <td style={{ ...TD_R, fontWeight: 700, color: C.danger }}>${entries.reduce((s, e) => s + Number(e.frontedAmount), 0).toFixed(2)}</td>
                                    <td style={{ ...TD_R, fontWeight: 700, color: C.warning }}>${entries.reduce((s, e) => s + Number(e.holdAmount ?? 0), 0).toFixed(2)}</td>
                                    <td style={{ ...TD_R, fontWeight: 700, color: agentNet >= 0 ? C.success : C.danger }}>
                                      <AnimatedNumber value={agentNet} prefix="$" decimals={2} />
                                    </td>
                                    <td />
                                  </tr>
                                </tbody>
                              </table>
                            </div>
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
                                overflow: "hidden",
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
                                  <span style={{ color: C.textMuted }}>Base: <strong style={{ color: C.textPrimary }}>${Number(se.basePay).toFixed(2)}</strong></span>
                                  <span style={{ color: C.textMuted }}>Total: <strong style={{ color: C.info }}>${Number(se.totalPay).toFixed(2)}</strong></span>
                                  <button
                                    className="btn-hover"
                                    onClick={() => printServiceCards([se], p, bonusCategories)}
                                    style={{ ...BTN_ICON, background: C.infoBg, border: `1px solid rgba(45,212,191,0.2)`, color: C.info }}
                                  >
                                    <Printer size={11} /> Print
                                  </button>
                                  {se.status === "PAID" ? (
                                    <button
                                      className="btn-hover"
                                      onClick={() => markEntriesUnpaid([], [se.id], se.serviceAgent.name)}
                                      style={{ ...BTN_ICON, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: C.success }}
                                    >
                                      <CheckCircle size={11} /> Paid
                                    </button>
                                  ) : (
                                    <button
                                      className="btn-hover"
                                      onClick={() => markEntriesPaid([], [se.id], se.serviceAgent.name)}
                                      style={{ ...BTN_ICON, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}
                                    >
                                      <XCircle size={11} /> Unpaid
                                    </button>
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
                                    <div style={{ fontSize: 15, fontWeight: 700, color: C.textPrimary }}>${Number(se.basePay).toFixed(2)}</div>
                                  </div>
                                  {seFronted > 0 && (
                                    <div>
                                      <div style={{ fontSize: 10, fontWeight: 700, color: C.danger, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Fronted</div>
                                      <div style={{ fontSize: 15, fontWeight: 700, color: C.danger }}>${seFronted.toFixed(2)}</div>
                                    </div>
                                  )}
                                  {bonusCategories.map(cat => {
                                    const amt = bd[cat.name] ?? 0;
                                    if (amt === 0) return null;
                                    return (
                                      <div key={cat.name}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: cat.isDeduction ? C.danger : C.success, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{cat.name}</div>
                                        <div style={{ fontSize: 15, fontWeight: 700, color: cat.isDeduction ? C.danger : C.success }}>${amt.toFixed(2)}</div>
                                      </div>
                                    );
                                  })}
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: C.info, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>Total Pay</div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: C.info }}>${Number(se.totalPay).toFixed(2)}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {p.entries.length === 0 && (p.serviceEntries ?? []).length === 0 && (
                      <div style={{ padding: "32px 0", textAlign: "center", color: C.textMuted, fontSize: 14 }}>
                        No entries for this period
                      </div>
                    )}
                  </div>
                )}
              </div>
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

          <div style={CARD}>
            <form onSubmit={submitChargeback} style={{ display: "grid", gap: S[5] }}>
              <div>
                <label style={LBL}>Member ID <span style={{ color: C.textMuted, fontWeight: 400, textTransform: "none", fontSize: 11 }}>(preferred)</span></label>
                <input
                  className="input-focus"
                  style={INP}
                  value={chargebackForm.memberId}
                  placeholder="e.g. M-12345"
                  onChange={e => setChargebackForm(f => ({ ...f, memberId: e.target.value }))}
                />
              </div>
              <div>
                <label style={LBL}>Member Name <span style={{ color: C.textMuted, fontWeight: 400, textTransform: "none", fontSize: 11 }}>(if no ID)</span></label>
                <input
                  className="input-focus"
                  style={INP}
                  value={chargebackForm.memberName}
                  placeholder="e.g. John Doe"
                  onChange={e => setChargebackForm(f => ({ ...f, memberName: e.target.value }))}
                />
              </div>
              <div>
                <label style={LBL}>Notes</label>
                <textarea
                  className="input-focus"
                  style={{ ...INP, height: 88, resize: "vertical" } as React.CSSProperties}
                  value={chargebackForm.notes}
                  onChange={e => setChargebackForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: S[4], flexWrap: "wrap" }}>
                <button className="btn-hover" type="submit" style={BTN_DANGER}>
                  <XCircle size={15} /> Process Chargeback
                </button>
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
          </div>
        </div>
      )}

      {/* ── Exports ───────────────────────────────────────────── */}
      {tab === "exports" && (
        <div className="animate-fade-in" style={{ maxWidth: 560 }}>
          <p style={{ color: C.textMuted, marginTop: 0, fontSize: 14, marginBottom: S[5], lineHeight: 1.7 }}>
            Download payroll period data as a CSV file. Choose a time range and export format.
          </p>

          <div style={CARD}>
            {/* Range selector */}
            <div style={{ marginBottom: S[6] }}>
              <label style={LBL}>Time Range</label>
              <div style={{ display: "flex", gap: S[2] }}>
                {(["week", "month", "quarter"] as ExportRange[]).map((r, i) => {
                  const active = exportRange === r;
                  return (
                    <button
                      key={r}
                      className={`btn-hover animate-fade-in-up stagger-${i + 1}`}
                      onClick={() => setExportRange(r)}
                      style={{
                        padding: "10px 20px",
                        border: active ? `1px solid rgba(20,184,166,0.4)` : `1px solid ${C.borderDefault}`,
                        borderRadius: R.lg,
                        background: active ? "rgba(20,184,166,0.12)" : C.bgSurfaceInset,
                        color: active ? C.primary400 : C.textMuted,
                        fontWeight: active ? 700 : 500,
                        cursor: "pointer", fontSize: 13,
                        boxShadow: active ? shadows.glowPrimary : "none",
                        transition: `all ${motion.duration.fast} ${motion.easing.out}`,
                      }}
                    >
                      {{ week: "This Week", month: "This Month", quarter: "This Quarter" }[r]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Export actions */}
            <div style={{ display: "grid", gap: S[3] }}>
              {/* Summary CSV */}
              <div style={{
                ...CARD_SM,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary, marginBottom: 4 }}>Summary CSV</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>Week range, status, entries count, gross and net per period</div>
                </div>
                <button
                  className="btn-hover"
                  onClick={() => { setExporting(true); exportCSV(exportRange); setTimeout(() => setExporting(false), 800); }}
                  style={{ ...BTN_GHOST, flexShrink: 0 }}
                >
                  <Download size={14} /> Export
                </button>
              </div>

              {/* Detailed CSV */}
              <div style={{
                ...CARD_SM,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary, marginBottom: 4 }}>Detailed CSV</div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>Per-entry rows — agent, member, products, fees, commission, bonus, fronted, net</div>
                </div>
                <button
                  className="btn-hover"
                  onClick={() => { setExporting(true); exportDetailedCSV(exportRange); setTimeout(() => setExporting(false), 800); }}
                  style={{ ...BTN_PRIMARY, flexShrink: 0 }}
                >
                  <Download size={14} /> Export
                </button>
              </div>
            </div>
          </div>
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
            <button
              className="btn-hover"
              onClick={() => setShowAddProduct(v => !v)}
              style={{ ...BTN_PRIMARY }}
            >
              <Plus size={14} /> Add Product
            </button>
          </div>

          {/* Add product form */}
          {showAddProduct && (
            <div className="animate-slide-down" style={{ ...CARD, marginBottom: S[5] }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary, marginBottom: S[4] }}>New Product</div>
              <form onSubmit={addProduct} style={{ display: "grid", gap: S[3] }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: S[2] }}>
                  <div>
                    <label style={LBL}>Name</label>
                    <input className="input-focus" style={INP} value={newProduct.name} placeholder="Product name *" required onChange={e => setNewProduct(x => ({ ...x, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={LBL}>Type</label>
                    <select className="input-focus" style={{ ...INP, height: 42 }} value={newProduct.type} onChange={e => setNewProduct(x => ({ ...x, type: e.target.value as ProductType }))}>
                      <option value="CORE">Core Product</option>
                      <option value="ADDON">Add-on</option>
                      <option value="AD_D">AD&D</option>
                    </select>
                  </div>
                </div>
                {newProduct.type === "CORE" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                    <div><label style={LBL}>Premium Threshold ($)</label><input className="input-focus" style={INP} type="number" step="0.01" value={newProduct.premiumThreshold} placeholder="e.g. 250" onChange={e => setNewProduct(x => ({ ...x, premiumThreshold: e.target.value }))} /></div>
                    <div><label style={LBL}>Commission Below (%)</label><input className="input-focus" style={INP} type="number" step="0.01" value={newProduct.commissionBelow} placeholder="e.g. 30" onChange={e => setNewProduct(x => ({ ...x, commissionBelow: e.target.value }))} /></div>
                    <div><label style={LBL}>Commission Above (%)</label><input className="input-focus" style={INP} type="number" step="0.01" value={newProduct.commissionAbove} placeholder="e.g. 40" onChange={e => setNewProduct(x => ({ ...x, commissionAbove: e.target.value }))} /></div>
                  </div>
                )}
                {(newProduct.type === "ADDON" || newProduct.type === "AD_D") && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: S[2] }}>
                    <div><label style={LBL}>Bundled Commission (%){newProduct.type === "ADDON" ? " — blank = match core" : ""}</label><input className="input-focus" style={INP} type="number" step="0.01" value={newProduct.bundledCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setNewProduct(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
                    <div><label style={LBL}>Standalone Commission (%)</label><input className="input-focus" style={INP} type="number" step="0.01" value={newProduct.standaloneCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setNewProduct(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
                    <div><label style={LBL}>Enroll Fee Threshold ($)</label><input className="input-focus" style={INP} type="number" step="0.01" value={newProduct.enrollFeeThreshold} placeholder="e.g. 50" onChange={e => setNewProduct(x => ({ ...x, enrollFeeThreshold: e.target.value }))} /></div>
                  </div>
                )}
                <input className="input-focus" style={INP} value={newProduct.notes} placeholder="Notes (optional)" onChange={e => setNewProduct(x => ({ ...x, notes: e.target.value }))} />
                <div style={{ display: "flex", gap: S[2], alignItems: "center", flexWrap: "wrap" }}>
                  <button className="btn-hover" type="submit" style={BTN_SUCCESS}>
                    <Plus size={14} /> Add Product
                  </button>
                  <button className="btn-hover" type="button" onClick={() => setShowAddProduct(false)} style={BTN_GHOST}>Cancel</button>
                  {cfgMsg && (
                    <span style={{ color: cfgMsg.startsWith("Error") ? C.danger : C.success, fontWeight: 600, fontSize: 13 }}>
                      {cfgMsg}
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Product grid */}
          {products.length === 0 ? (
            <div style={{ ...CARD, textAlign: "center", color: C.textMuted, padding: "40px 24px" }}>
              No products configured yet. Add your first product above.
            </div>
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
            <div style={CARD}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S[4] }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Service Agents</h3>
                  <p style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 0" }}>Manage agents with base pay</p>
                </div>
              </div>

              <div style={{ display: "grid", gap: S[2], marginBottom: S[4] }}>
                {serviceAgents.length === 0 && (
                  <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>No service agents yet.</p>
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
                <input className="input-focus" style={INP} value={newServiceAgent.name} placeholder="Full name *" required onChange={e => setNewServiceAgent(x => ({ ...x, name: e.target.value }))} />
                <input className="input-focus" style={INP} type="number" step="0.01" value={newServiceAgent.basePay} placeholder="Base Pay ($) *" required onChange={e => setNewServiceAgent(x => ({ ...x, basePay: e.target.value }))} />
                <button className="btn-hover" type="submit" style={BTN_SUCCESS}>
                  <Plus size={13} /> Add Agent
                </button>
              </form>
            </div>

            {/* Bonus Categories */}
            <div style={CARD}>
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
                    <button
                      className="btn-hover"
                      onClick={() => saveBonusCategories(bonusCategories.filter((_, j) => j !== i))}
                      style={{ ...BTN_ICON, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: C.danger, padding: "4px 8px" }}
                    >
                      <Trash2 size={11} />
                    </button>
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
                      style={INP}
                      value={newCatName}
                      placeholder="e.g. Flips"
                      onChange={e => setNewCatName(e.target.value)}
                    />
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: S[1], fontSize: 12, color: C.textSecondary, paddingBottom: 4, cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={newCatDeduction} onChange={e => setNewCatDeduction(e.target.checked)} />
                    Deduction
                  </label>
                  <button
                    className="btn-hover"
                    type="button"
                    onClick={() => {
                      if (!newCatName.trim()) return;
                      saveBonusCategories([...bonusCategories, { name: newCatName.trim(), isDeduction: newCatDeduction }]);
                      setNewCatName(""); setNewCatDeduction(false);
                    }}
                    style={BTN_SUCCESS}
                  >
                    <Plus size={13} /> Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Weekly Payroll input table */}
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S[5] }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Weekly Payroll Entry</h3>
                <p style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 0" }}>Enter bonus amounts per category for each service agent</p>
              </div>
              <div style={{ minWidth: 220 }}>
                <label style={LBL}>Payroll Period</label>
                <select
                  className="input-focus"
                  style={{ ...INP, height: 40 }}
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
                      <th style={TH}>Agent</th>
                      <th style={TH_R}>Base Pay</th>
                      <th style={{ ...TH_C, color: C.danger }}>Fronted</th>
                      {bonusCategories.map(cat => (
                        <th key={cat.name} style={{ ...TH_C, color: cat.isDeduction ? C.danger : C.textTertiary }}>
                          {cat.name}
                        </th>
                      ))}
                      <th style={{ ...TH_R, color: C.info }}>Total</th>
                      <th style={TH_C}></th>
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
                          <td style={{ ...TD, fontWeight: 600, color: C.textPrimary }}>
                            {agent.name}
                            {existingEntry && (
                              <span style={{ fontSize: 10, color: C.info, marginLeft: 6, fontWeight: 500 }}>
                                saved
                              </span>
                            )}
                          </td>
                          <td style={{ ...TD_R, color: C.textSecondary, fontWeight: 600 }}>
                            ${basePay.toFixed(2)}
                          </td>
                          <td style={{ ...TD_C, padding: "6px 4px" }}>
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
                            <td key={cat.name} style={{ ...TD_C, padding: "6px 4px" }}>
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
                          <td style={{ ...TD_R, fontWeight: 800, fontSize: 15, color: C.info }}>
                            <AnimatedNumber value={total} prefix="$" decimals={2} />
                          </td>
                          <td style={TD_C}>
                            <button
                              className="btn-hover"
                              type="button"
                              onClick={() => submitServiceBonus(agent.id)}
                              style={{ ...BTN_ICON, ...BTN_PRIMARY }}
                            >
                              <Save size={12} /> Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

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
