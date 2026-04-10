"use client";
import { useState, useEffect, useMemo } from "react";
import { Badge, AnimatedNumber, Button, ConfirmModal } from "@ops/ui";
import { colors, spacing, radius, motion, semanticColors, colorAlpha, typography } from "@ops/ui";
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
      style={{ ...SMALL_INP, width: 100, fontSize: typography.sizes.xs.fontSize, padding: "4px 8px" }}
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
    <div style={{ fontSize: typography.sizes.xs.fontSize, fontWeight: 400, color: C.textMuted, fontStyle: "italic", marginTop: 4, lineHeight: "1.45" }}>
      Carried from prev week
    </div>
  );
}

/* ── EditableSaleRow ────────────────────────────────────────── */

function EditableSaleRow({
  entry, onSaleUpdate, onApprove, onUnapprove, onDelete, products, highlighted, isPaid, isLate,
}: {
  entry: Entry;
  onSaleUpdate: (saleId: string, data: Record<string, unknown>) => void | Promise<void>;
  onApprove: (saleId: string) => void | Promise<void>;
  onUnapprove: (saleId: string) => void | Promise<void>;
  onDelete: (saleId: string) => void | Promise<void>;
  products: Product[];
  highlighted?: boolean;
  isPaid?: boolean;
  isLate?: boolean;
}) {
  const HIGHLIGHT_GLOW = { boxShadow: `0 0 20px ${colorAlpha(semanticColors.accentTealMid, 0.4)}, inset 0 0 20px ${colorAlpha(semanticColors.accentTealMid, 0.05)}` };
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
  // Phase 47 Sub-feature 4 (D-13/D-17): ACA covering-child edit slot.
  // Seeded from entry.acaAttached if one exists at edit-open time. null = no child.
  // Object = create-or-update child. The save handler sends this via PATCH /sales/:id
  // as the canonical `acaChild` payload field (single source of truth).
  const [acaChild, setAcaChild] = useState<{ productId: string; memberCount: number } | null>(() => {
    if (entry.acaAttached?.productId) {
      return {
        productId: entry.acaAttached.productId,
        memberCount: entry.acaAttached.memberCount ?? 1,
      };
    }
    return null;
  });
  const [saving, setSaving] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const hasNotes = !!entry.sale?.notes;

  const fee = entry.sale?.enrollmentFee != null ? Number(entry.sale.enrollmentFee) : null;
  const needsApproval = !!entry.halvingReason && !entry.sale?.commissionApproved;
  const isApproved = !!entry.halvingReason && !!entry.sale?.commissionApproved;
  const saleStatus = entry.sale?.status ?? "RAN";
  const statusCfg = SALE_STATUS_COLORS[saleStatus] ?? SALE_STATUS_COLORS.RAN;

  const rowBg: React.CSSProperties = entry.status === "CLAWBACK_CROSS_PERIOD"
    ? { backgroundColor: "rgba(251,146,60,0.10)", borderLeft: "3px solid rgba(251,146,60,0.6)" }
    : entry.status === "ZEROED_OUT_IN_PERIOD"
    ? { backgroundColor: "rgba(234,179,8,0.10)", borderLeft: "3px solid rgba(234,179,8,0.6)" }
    : entry.status === "CLAWBACK_APPLIED"
    ? { backgroundColor: colorAlpha(semanticColors.statusDead, 0.08), borderLeft: `3px solid ${colorAlpha(semanticColors.statusDead, 0.4)}` }
    : (saleStatus === "DECLINED" || saleStatus === "DEAD")
    ? { backgroundColor: colorAlpha(semanticColors.statusPending, 0.08), borderLeft: `3px solid ${colorAlpha(semanticColors.statusPending, 0.4)}` }
    : needsApproval
    ? { borderLeft: `3px solid ${colorAlpha(semanticColors.dangerLight, 0.5)}` }
    : entry.sale?.paymentType === "ACH"
    ? { backgroundColor: "rgba(52,211,153,0.08)", borderLeft: "3px solid rgba(52,211,153,0.5)" }
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
        ...(isLate ? { borderLeft: `3px solid ${semanticColors.statusPending}`, background: colorAlpha(semanticColors.statusPending, 0.04) } : {}),
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
            display: "block", fontSize: typography.sizes.xs.fontSize, color: semanticColors.statusPending,
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
            {/* Addon rows (ACA_PL rows render a # members input instead of $ premium) */}
            {addonItems.map((addon, idx) => {
              const selectedProduct = products.find(p => p.id === addon.productId);
              const isAca = selectedProduct?.type === "ACA_PL";
              return (
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
                {isAca ? (
                  <input
                    className="input-focus"
                    style={{ ...SMALL_INP, width: 82 }}
                    type="number" min={1} step={1} placeholder="# members"
                    aria-label="Member count"
                    title="Number of ACA members (commission = flat rate x members)"
                    value={addon.premium || "1"}
                    onChange={e => {
                      const v = parseInt(e.target.value, 10);
                      const next = Number.isFinite(v) && v >= 1 ? String(v) : "1";
                      setAddonItems(prev => prev.map((a, i) => i === idx ? { ...a, premium: next } : a));
                    }}
                  />
                ) : (
                  <input
                    className="input-focus"
                    style={{ ...SMALL_INP, width: 82 }}
                    type="number" step="0.01" placeholder="Premium"
                    value={addon.premium}
                    onChange={e => setAddonItems(prev => prev.map((a, i) => i === idx ? { ...a, premium: e.target.value } : a))}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setAddonItems(prev => prev.filter((_, i) => i !== idx))}
                  style={{ background: colorAlpha(semanticColors.statusDead, 0.12), border: `1px solid ${colorAlpha(semanticColors.statusDead, 0.25)}`, color: semanticColors.statusDead, borderRadius: 4, padding: "3px 6px", cursor: "pointer", fontSize: typography.sizes.xs.fontSize, lineHeight: 1 }}
                  title="Remove add-on"
                >
                  <X size={10} />
                </button>
                {isAca && (
                  <span style={{ fontSize: 10, color: C.textMuted, fontStyle: "italic" }}># members</span>
                )}
              </div>
              );
            })}
            {/* Phase 47 Sub-feature 4 (D-17): existing ACA covering-child row with X button */}
            {acaChild && (
              <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 6px", background: "rgba(14,165,233,0.08)", borderRadius: 4, border: "1px solid rgba(14,165,233,0.2)" }}>
                <span style={{ fontSize: 10, color: C.info ?? C.accentTeal, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>ACA</span>
                <select
                  className="input-focus"
                  style={{ ...SMALL_INP, width: 130, textAlign: "left" }}
                  value={acaChild.productId}
                  onChange={e => setAcaChild(c => (c ? { ...c, productId: e.target.value } : c))}
                  aria-label="ACA carrier"
                >
                  {products.filter(p => p.active && p.type === "ACA_PL").map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  className="input-focus"
                  style={{ ...SMALL_INP, width: 62 }}
                  type="number" min={1} step={1}
                  aria-label="ACA member count"
                  value={String(acaChild.memberCount)}
                  onChange={e => {
                    const v = parseInt(e.target.value, 10);
                    setAcaChild(c => (c ? { ...c, memberCount: Number.isFinite(v) && v >= 1 ? v : 1 } : c));
                  }}
                />
                <span style={{ fontSize: 10, color: C.textMuted, fontStyle: "italic" }}># members</span>
                <button
                  type="button"
                  onClick={() => setAcaChild(null)}
                  aria-label="Remove ACA child"
                  title="Remove ACA covering sale"
                  style={{ background: colorAlpha(semanticColors.statusDead, 0.12), border: `1px solid ${colorAlpha(semanticColors.statusDead, 0.25)}`, color: semanticColors.statusDead, borderRadius: 4, padding: "3px 6px", cursor: "pointer", fontSize: typography.sizes.xs.fontSize, lineHeight: 1, marginLeft: "auto" }}
                >
                  <X size={10} />
                </button>
              </div>
            )}
            {/* Add product button */}
            <button
              type="button"
              onClick={() => setAddonItems(prev => [...prev, { productId: "", premium: "" }])}
              style={{ display: "flex", alignItems: "center", gap: 4, background: colorAlpha(semanticColors.accentTealMid, 0.08), border: `1px solid ${colorAlpha(semanticColors.accentTealMid, 0.2)}`, color: semanticColors.accentTealMid, borderRadius: 4, padding: "4px 8px", cursor: "pointer", fontSize: typography.sizes.xs.fontSize, width: "fit-content" }}
            >
              <Plus size={10} /> Add Product
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {/* Core product — color by actual product type */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <Badge color={
                entry.sale?.product?.type === "ACA_PL" ? semanticColors.accentPurple
                : entry.sale?.product?.type === "ADDON" ? semanticColors.accentGreenMid
                : entry.sale?.product?.type === "AD_D" ? C.warning
                : semanticColors.accentBlue
              } size="sm">{entry.sale?.product?.name ?? "\u2014"}</Badge>
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
                  color={
                    addon.product.type === "AD_D" ? C.warning
                    : addon.product.type === "ACA_PL" ? semanticColors.accentPurple
                    : addon.product.type === "CORE" ? semanticColors.accentBlue
                    : semanticColors.accentGreenMid
                  }
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
            {/* GAP-45-07: ACA rendered as its own product chip with the bundled flat commission */}
            {entry.acaAttached && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <Badge color={semanticColors.accentPurple} size="sm">{entry.acaAttached.productName ?? "ACA"}</Badge>
                <span style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>
                  {formatDollar(Number(entry.acaAttached.payoutAmount))}
                </span>
              </div>
            )}
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
        <span style={{ color: (entry.status === "CLAWBACK_CROSS_PERIOD" || entry.status === "ZEROED_OUT_IN_PERIOD") ? C.danger : C.textPrimary, fontWeight: 700 }}>
          {(entry.status === "CLAWBACK_CROSS_PERIOD" || entry.status === "ZEROED_OUT_IN_PERIOD")
            ? formatDollar(Number(entry.netAmount ?? 0))
            : formatDollar(Number(entry.payoutAmount))}
        </span>
        {entry.halvingReason && (
          <div style={{ fontSize: typography.sizes.xs.fontSize, color: C.warning, marginTop: 2, fontStyle: "italic" }}>
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
                // Phase 47 Sub-feature 4 — CANONICAL ACA-ROW HOIST FLOW.
                // ACA_PL rows are HOISTED OUT of addonItems and sent as the
                // canonical top-level `acaChild` payload field. The backend
                // PATCH /sales/:id handler expects exactly one ACA field:
                //   undefined = no change, null = remove, object = create/replace.
                // If a newly-picked ACA_PL addon row exists AND an existing
                // acaChild seed exists, the newly-picked row WINS (replaces).
                const acaRows = addonItems.filter(a => {
                  if (!a.productId) return false;
                  const prod = products.find(p => p.id === a.productId);
                  return prod?.type === "ACA_PL";
                });
                const nonAcaAddonItems = addonItems.filter(a => {
                  if (!a.productId) return false;
                  const prod = products.find(p => p.id === a.productId);
                  return prod?.type !== "ACA_PL";
                });

                let acaChildPayload: { productId: string; memberCount: number } | null | undefined;
                if (acaRows.length > 0) {
                  // Newly-picked ACA_PL row wins over any existing acaChild seed.
                  if (acaChild) {
                    // eslint-disable-next-line no-console
                    console.warn("[ACA] Newly-picked ACA_PL addon row replacing existing acaChild seed");
                  }
                  const last = acaRows[acaRows.length - 1];
                  const count = parseInt(last.premium, 10);
                  acaChildPayload = {
                    productId: last.productId,
                    memberCount: Number.isFinite(count) && count >= 1 ? count : 1,
                  };
                } else if (entry.acaAttached && !acaChild) {
                  // User removed the existing child via the X button.
                  acaChildPayload = null;
                } else if (acaChild) {
                  // Existing child edited (or unchanged) via the ACA slot.
                  acaChildPayload = { productId: acaChild.productId, memberCount: acaChild.memberCount };
                } else {
                  acaChildPayload = undefined; // no change
                }

                const addonProductIds = nonAcaAddonItems.map(a => a.productId);
                const addonPremiums: Record<string, number> = {};
                nonAcaAddonItems.forEach(a => {
                  addonPremiums[a.productId] = a.premium ? Number(a.premium) : 0;
                });

                const payload: Record<string, unknown> = {
                  memberName: saleData.memberName,
                  memberId: saleData.memberId || null,
                  enrollmentFee: saleData.enrollmentFee ? Number(saleData.enrollmentFee) : null,
                  notes: saleData.notes || null,
                  productId: saleData.productId || undefined,
                  premium: saleData.premium ? Number(saleData.premium) : undefined,
                  addonProductIds,
                  addonPremiums,
                };
                if (acaChildPayload !== undefined) {
                  payload.acaChild = acaChildPayload;
                }

                await onSaleUpdate(entry.sale!.id, payload);
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
                setAcaChild(entry.acaAttached?.productId
                  ? { productId: entry.acaAttached.productId, memberCount: entry.acaAttached.memberCount ?? 1 }
                  : null);
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
                style={{ background: colorAlpha(semanticColors.statusPending, 0.12), color: C.warning, border: `1px solid ${colorAlpha(semanticColors.statusPending, 0.25)}` }}
              >
                <XCircle size={12} /> Unapprove
              </Button>
            )}
            {entry.sale && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(entry.sale!.id)}
                style={{ background: colorAlpha(semanticColors.statusDead, 0.1), border: `1px solid ${colorAlpha(semanticColors.statusDead, 0.2)}`, color: semanticColors.statusDead }}
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
            background: colorAlpha(semanticColors.accentTealLight, 0.04),
            borderTop: `1px solid ${C.borderSubtle}`,
            borderBottom: `1px solid ${C.borderSubtle}`,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}>
            <FileText size={13} style={{ color: C.textMuted, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: typography.sizes.sm.fontSize, color: C.textSecondary, whiteSpace: "pre-wrap" }}>{entry.sale?.notes}</span>
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
  onSaleUpdate: (saleId: string, data: Record<string, unknown>) => void | Promise<void>;
  onApprove: (saleId: string) => void | Promise<void>;
  onUnapprove: (saleId: string) => void | Promise<void>;
  onDelete: (saleId: string) => void | Promise<void>;
  onPrint: () => void;
  onMarkPaid: () => void;
  onMarkUnpaid: () => void;
  onApproveChangeRequest: (id: string) => void | Promise<void>;
  onRejectChangeRequest: (id: string) => void | Promise<void>;
  onApproveEditRequest: (id: string) => void | Promise<void>;
  onRejectEditRequest: (id: string) => void | Promise<void>;
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

  const totalBonus = adjustment ? Number(adjustment.bonusAmount) : 0;
  const totalFronted = adjustment ? Number(adjustment.frontedAmount) : 0;
  const totalHold = adjustment ? Number(adjustment.holdAmount) : 0;

  const needsApprovalCount = entries.filter(e => !!e.halvingReason && !e.sale?.commissionApproved).length;
  const allApproved = entries.length > 0 && entries.every(e => !e.halvingReason || e.sale?.commissionApproved);

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

  const allPaid = entries.length > 0 && entries.every(e => e.status === "PAID" || e.status === "ZEROED_OUT" || e.status === "CLAWBACK_APPLIED" || e.status === "ZEROED_OUT_IN_PERIOD" || e.status === "CLAWBACK_CROSS_PERIOD");
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
      background: isSelected ? colorAlpha(semanticColors.accentTealMid, 0.03) : "transparent",
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
          <span style={{ fontWeight: 700, fontSize: typography.sizes.md.fontSize, color: C.textPrimary }}>
            {fmtDate(period.weekStart)} {"\u2013"} {fmtDate(period.weekEnd)}
          </span>
          {period.status !== "FINALIZED" ? (
            <span
              style={{ cursor: "pointer" }}
              title={period.status === "OPEN" ? "Click to close period" : "Click to reopen period"}
              onClick={(e) => {
                e.stopPropagation();
                const newStatus = period.status === "OPEN" ? "LOCKED" : "OPEN";
                const label = newStatus === "LOCKED" ? "close" : "reopen";
                const btnLabel = newStatus === "LOCKED" ? "Close" : "Reopen";
                requestConfirm(`${btnLabel} Period`, `Are you sure you want to ${label} this period?`, "primary", btnLabel, async () => {
                  const res = await authFetch(`${API}/api/payroll/periods/${period.id}/status`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: newStatus }),
                  });
                  if (res.ok) refreshPeriods();
                });
              }}
            >
              <Badge color={statusCfg.color} dot>{statusCfg.label}</Badge>
            </span>
          ) : (
            <Badge color={statusCfg.color} dot>{statusCfg.label}</Badge>
          )}
          {needsApprovalCount > 0 && (
            <Badge color={C.danger} size="sm">
              {needsApprovalCount} unapproved
            </Badge>
          )}
          {allApproved && entries.some(e => !!e.halvingReason) && (
            <Badge color={C.success} size="sm">
              All approved
            </Badge>
          )}
        </div>
        <div style={{ display: "flex", gap: S[3], alignItems: "center" }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(ev) => { ev.stopPropagation(); onPrint(); }}
            style={{ background: C.infoBg, border: `1px solid ${colorAlpha(semanticColors.accentTealLight, 0.2)}`, color: C.info }}
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
              style={{ background: colorAlpha(semanticColors.statusDead, 0.1), border: `1px solid ${colorAlpha(semanticColors.statusDead, 0.2)}`, color: semanticColors.statusDead }}>
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
              <div style={{ fontSize: typography.sizes.md.fontSize, fontWeight: 700, color: C.textPrimary }}>{formatDollar(agentGross)}</div>
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
                  background: Number(headerFronted) > 0 ? colorAlpha(semanticColors.statusPending, 0.10) : SMALL_INP.background,
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
                  background: Number(headerHold) > 0 ? colorAlpha(semanticColors.statusPending, 0.10) : SMALL_INP.background,
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
                  <div style={{ fontSize: typography.sizes.md.fontSize, fontWeight: 700, color: liveNet >= 0 ? C.success : C.danger }}>
                    <AnimatedNumber value={liveNet} prefix="$" decimals={2} />
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Commission table */}
          {entries.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: typography.sizes.sm.fontSize, minWidth: 860 }}>
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
                    onUnapprove={(saleId: string) => requestConfirm("Unapprove Commission", "This will revert the approved commission. Continue?", "danger", "Unapprove", async () => onUnapprove(saleId))}
                    onDelete={onDelete}
                    highlighted={highlightedEntryIds.has(e.id)}
                    isPaid={allPaid}
                    isLate={isLateEntry(e)}
                  />
                ))}
                {/* Subtotal */}
                <tr style={{ borderTop: `2px solid ${C.borderDefault}`, background: C.bgSurface }}>
                  <td colSpan={5} style={{ ...tdStyle, fontWeight: 700, fontSize: typography.sizes.xs.fontSize, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Subtotal</td>
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
              borderLeft: `3px solid ${semanticColors.warningAmber}`,
              backgroundColor: "rgba(245, 158, 11, 0.08)",
              padding: "12px",
              borderRadius: "8px",
              margin: `${S[3]}px ${S[5]}px ${S[4]}px`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Clock size={14} style={{ color: semanticColors.warningAmber }} />
                <span style={{ fontWeight: 700, fontSize: typography.sizes.sm.fontSize, color: semanticColors.warningAmber }}>
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
                      <div style={{ fontSize: typography.sizes.sm.fontSize, color: C.textPrimary, fontWeight: 600 }}>
                        <span style={{
                          background: "rgba(96,165,250,0.1)", color: semanticColors.accentBlueBright,
                          fontSize: typography.sizes.xs.fontSize, fontWeight: 700, padding: "2px 6px",
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
                      <div style={{ fontSize: typography.sizes.sm.fontSize, color: C.textPrimary, fontWeight: 600 }}>
                        <span style={{
                          background: colorAlpha(semanticColors.accentPurple, 0.1), color: semanticColors.accentPurple,
                          fontSize: typography.sizes.xs.fontSize, fontWeight: 700, padding: "2px 6px",
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
      <ConfirmModal open={confirmState.open} title={confirmState.title} message={confirmState.message} variant={confirmState.variant} confirmLabel={confirmState.confirmLabel} loading={confirmState.loading} onConfirm={handleConfirm} onCancel={() => setConfirmState(s => ({ ...s, open: false }))} />
    </div>
  );
}
