"use client";
import { useState, useEffect, FormEvent } from "react";
import { PageShell } from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";
type Tab = "periods" | "chargebacks" | "exports" | "products" | "service";
type SaleAddonInfo = { product: { id: string; name: string; type: string } };
type SaleInfo = { id: string; memberName: string; memberId?: string; carrier: string; premium: number; enrollmentFee: number | null; commissionApproved: boolean; status: string; notes?: string; product: { id: string; name: string; type: string }; addons?: SaleAddonInfo[] };
type Entry = { id: string; payoutAmount: number; adjustmentAmount: number; bonusAmount: number; frontedAmount: number; netAmount: number; status: string; sale?: SaleInfo; agent?: { name: string } };
type BonusCategory = { name: string; isDeduction: boolean };
type ServiceEntry = { id: string; basePay: number; bonusAmount: number; totalPay: number; bonusBreakdown?: Record<string, number>; status: string; notes?: string; serviceAgent: { name: string; basePay: number } };
type Period = { id: string; weekStart: string; weekEnd: string; quarterLabel: string; status: string; entries: Entry[]; serviceEntries: ServiceEntry[] };
type ProductType = "CORE" | "ADDON" | "AD_D";
type Product = { id: string; name: string; active: boolean; type: ProductType; premiumThreshold?: number | null; commissionBelow?: number | null; commissionAbove?: number | null; bundledCommission?: number | null; standaloneCommission?: number | null; enrollFeeThreshold?: number | null; notes?: string };
type ServiceAgent = { id: string; name: string; basePay: number; active: boolean };
type ExportRange = "week" | "month" | "quarter";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  OPEN: { bg: "rgba(59,130,246,0.18)", color: "#60a5fa" },
  LOCKED: { bg: "rgba(251,191,36,0.18)", color: "#fbbf24" },
  FINALIZED: { bg: "rgba(16,185,129,0.18)", color: "#34d399" },
};

const INP: React.CSSProperties = { padding: "10px 14px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 14, width: "100%", boxSizing: "border-box", color: "#e2e8f0", outline: "none", transition: "border-color 0.2s ease" };
const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
const CARD: React.CSSProperties = { background: "linear-gradient(135deg, rgba(30,41,59,0.55), rgba(15,23,42,0.65))", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 24, transition: "border-color 0.2s ease, box-shadow 0.2s ease" };
const BTN = (color = "#3b82f6"): React.CSSProperties => ({ padding: "10px 20px", background: color === "#3b82f6" ? "linear-gradient(135deg, #3b82f6, #6366f1)" : color === "#059669" ? "linear-gradient(135deg, #059669, #10b981)" : color, color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: `0 2px 12px ${color}40`, transition: "box-shadow 0.2s ease, transform 0.15s ease" });
const CANCEL_BTN: React.CSSProperties = { padding: "10px 16px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, background: "rgba(30,41,59,0.5)", cursor: "pointer", fontSize: 13, color: "#94a3b8", transition: "border-color 0.2s ease" };
const SMALL_INP: React.CSSProperties = { ...INP, padding: "6px 10px", fontSize: 13, width: 90, textAlign: "right" };

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "10px 20px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.25s ease",
    background: active ? "rgba(59,130,246,0.12)" : "transparent",
    color: active ? "#60a5fa" : "#64748b",
    boxShadow: active ? "inset 0 -2px 0 #3b82f6, 0 2px 12px rgba(59,130,246,0.2)" : "none",
    borderBottom: active ? "none" : "2px solid transparent",
    letterSpacing: active ? "0.01em" : "0",
  };
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getUTCFullYear()}`;
}

const TYPE_LABELS: Record<ProductType, string> = { CORE: "Core Product", ADDON: "Add-on", AD_D: "AD&D" };
const TYPE_COLORS: Record<ProductType, string> = { CORE: "#3b82f6", ADDON: "#8b5cf6", AD_D: "#f59e0b" };

// ── Editable Sale Row ───────────────────────────────────────────
function EditableSaleRow({ entry, onSaleUpdate, onBonusFrontedUpdate, onApprove }: {
  entry: Entry;
  onSaleUpdate: (saleId: string, data: Record<string, unknown>) => Promise<void>;
  onBonusFrontedUpdate: (entryId: string, bonus: number, fronted: number) => Promise<void>;
  onApprove: (saleId: string) => Promise<void>;
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
  const [saving, setSaving] = useState(false);

  const fee = entry.sale?.enrollmentFee != null ? Number(entry.sale.enrollmentFee) : null;
  const needsApproval = fee !== null && fee < 99 && !entry.sale?.commissionApproved;
  const isHalved = needsApproval;

  return (
    <tr style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: isHalved ? "rgba(239,68,68,0.05)" : "transparent" }}>
      <td style={{ padding: "10px 10px", color: "#e2e8f0" }}>{entry.agent?.name ?? "\u2014"}</td>
      <td style={{ padding: "10px 10px" }}>
        {editSale ? (
          <input style={{ ...SMALL_INP, width: 120, textAlign: "left" }} value={saleData.memberName} onChange={e => setSaleData(d => ({ ...d, memberName: e.target.value }))} />
        ) : (
          <span style={{ color: "#94a3b8", cursor: "pointer" }} onClick={() => setEditSale(true)}>
            {entry.sale?.memberName ?? "\u2014"}{entry.sale?.memberId ? ` (${entry.sale.memberId})` : ""}
          </span>
        )}
      </td>
      <td style={{ padding: "10px 10px" }}>
        {editSale ? (
          <input style={{ ...SMALL_INP, width: 100, textAlign: "left" }} value={saleData.carrier} onChange={e => setSaleData(d => ({ ...d, carrier: e.target.value }))} />
        ) : (
          <span style={{ color: "#94a3b8" }}>{entry.sale?.product?.name ?? "\u2014"}</span>
        )}
      </td>
      <td style={{ padding: "10px 10px", textAlign: "right" }}>
        {editSale ? (
          <input style={SMALL_INP} type="number" step="0.01" value={saleData.premium} onChange={e => setSaleData(d => ({ ...d, premium: e.target.value }))} />
        ) : (
          <span style={{ color: isHalved ? "#f87171" : "#94a3b8", fontWeight: isHalved ? 700 : 400 }}>
            {fee !== null ? `$${fee.toFixed(2)}` : "\u2014"}
          </span>
        )}
      </td>
      <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "#e2e8f0" }}>
        ${Number(entry.payoutAmount).toFixed(2)}
      </td>
      <td style={{ padding: "10px 6px", textAlign: "right" }}>
        <input
          style={{ ...SMALL_INP, width: 75, background: Number(bonus) > 0 ? "rgba(16,185,129,0.12)" : SMALL_INP.background, color: Number(bonus) > 0 ? "#34d399" : "#e2e8f0" }}
          type="number" step="0.01" value={bonus}
          onChange={e => setBonus(e.target.value)}
          onBlur={() => onBonusFrontedUpdate(entry.id, Number(bonus) || 0, Number(fronted) || 0)}
        />
      </td>
      <td style={{ padding: "10px 6px", textAlign: "right" }}>
        <input
          style={{ ...SMALL_INP, width: 75, background: Number(fronted) > 0 ? "rgba(239,68,68,0.12)" : SMALL_INP.background, color: Number(fronted) > 0 ? "#f87171" : "#e2e8f0" }}
          type="number" step="0.01" value={fronted}
          onChange={e => setFronted(e.target.value)}
          onBlur={() => onBonusFrontedUpdate(entry.id, Number(bonus) || 0, Number(fronted) || 0)}
        />
      </td>
      <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "#34d399" }}>
        ${Number(entry.netAmount).toFixed(2)}
      </td>
      <td style={{ padding: "10px 10px", textAlign: "center" }}>
        {editSale ? (
          <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
            <button disabled={saving} onClick={async () => {
              setSaving(true);
              await onSaleUpdate(entry.sale!.id, {
                memberName: saleData.memberName,
                memberId: saleData.memberId || null,
                carrier: saleData.carrier,
                premium: Number(saleData.premium),
                notes: saleData.notes || null,
              });
              setEditSale(false); setSaving(false);
            }} style={{ padding: "4px 10px", background: "linear-gradient(135deg, #059669, #10b981)", color: "white", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save</button>
            <button onClick={() => setEditSale(false)} style={{ padding: "4px 8px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, background: "transparent", color: "#94a3b8", fontSize: 11, cursor: "pointer" }}>X</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
            <button onClick={() => setEditSale(true)} style={{ padding: "4px 8px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, background: "rgba(30,41,59,0.5)", color: "#94a3b8", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Edit</button>
            {needsApproval && (
              <button onClick={() => onApprove(entry.sale!.id)} style={{ padding: "4px 10px", background: "linear-gradient(135deg, #059669, #10b981)", color: "white", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Approve</button>
            )}
            {entry.sale?.commissionApproved && fee !== null && fee < 99 && (
              <span style={{ color: "#34d399", fontSize: 11, fontWeight: 700 }}>OK</span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Product Row ─────────────────────────────────────────────────
function ProductRow({ product, onSave, onDelete }: { product: Product; onSave: (id: string, data: Partial<Product>) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({
    name: product.name, active: product.active, type: product.type, notes: product.notes ?? "",
    premiumThreshold: String(product.premiumThreshold ?? ""), commissionBelow: String(product.commissionBelow ?? ""), commissionAbove: String(product.commissionAbove ?? ""),
    bundledCommission: String(product.bundledCommission ?? ""), standaloneCommission: String(product.standaloneCommission ?? ""),
    enrollFeeThreshold: String(product.enrollFeeThreshold ?? ""),
  });
  const [saving, setSaving] = useState(false);

  if (!edit) {
    const col = TYPE_COLORS[product.type];
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>{product.name}</span>
            <span style={{ background: col + "18", color: col, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{TYPE_LABELS[product.type]}</span>
            {!product.active && <span style={{ color: "#64748b", fontSize: 11 }}>(Inactive)</span>}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {product.type === "CORE" && <>
              {product.commissionBelow != null && <span>Below ${product.premiumThreshold}: {product.commissionBelow}%</span>}
              {product.commissionAbove != null && <span> \u00b7 Above ${product.premiumThreshold}: {product.commissionAbove}%</span>}
            </>}
            {(product.type === "ADDON" || product.type === "AD_D") && <>
              {product.bundledCommission != null && <span>Bundled: {product.bundledCommission}%</span>}
              {product.bundledCommission == null && product.type === "ADDON" && <span>Bundled: matches core</span>}
              {product.standaloneCommission != null && <span> \u00b7 Standalone: {product.standaloneCommission}%</span>}
            </>}
            {product.notes ? ` \u00b7 ${product.notes}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={() => setEdit(true)} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, background: "rgba(30,41,59,0.5)", cursor: "pointer", color: "#94a3b8", fontWeight: 600 }}>Edit</button>
          <button onClick={() => { if (confirm(`Delete product "${product.name}"? This will deactivate it.`)) onDelete(product.id); }} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, background: "rgba(239,68,68,0.1)", cursor: "pointer", color: "#f87171", fontWeight: 600 }}>Delete</button>
        </div>
      </div>
    );
  }

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
    <div style={{ padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <div><label style={LBL}>Name</label><input style={INP} value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} /></div>
        <div><label style={LBL}>Type</label>
          <select style={{ ...INP, height: 42 }} value={d.type} onChange={e => setD(x => ({ ...x, type: e.target.value as ProductType }))}>
            <option value="CORE">Core Product</option><option value="ADDON">Add-on</option><option value="AD_D">AD&D</option>
          </select>
        </div>
      </div>
      {d.type === "CORE" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div><label style={LBL}>Premium Threshold ($)</label><input style={INP} type="number" step="0.01" value={d.premiumThreshold} placeholder="e.g. 250" onChange={e => setD(x => ({ ...x, premiumThreshold: e.target.value }))} /></div>
          <div><label style={LBL}>Commission Below (%)</label><input style={INP} type="number" step="0.01" value={d.commissionBelow} placeholder="e.g. 30" onChange={e => setD(x => ({ ...x, commissionBelow: e.target.value }))} /></div>
          <div><label style={LBL}>Commission Above (%)</label><input style={INP} type="number" step="0.01" value={d.commissionAbove} placeholder="e.g. 40" onChange={e => setD(x => ({ ...x, commissionAbove: e.target.value }))} /></div>
        </div>
      )}
      {(d.type === "ADDON" || d.type === "AD_D") && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div><label style={LBL}>Bundled Commission (%){d.type === "ADDON" ? " \u2014 blank = match core" : ""}</label><input style={INP} type="number" step="0.01" value={d.bundledCommission} placeholder={d.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setD(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
          <div><label style={LBL}>Standalone Commission (%)</label><input style={INP} type="number" step="0.01" value={d.standaloneCommission} placeholder={d.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setD(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
          <div><label style={LBL}>Enroll Fee Threshold ($)</label><input style={INP} type="number" step="0.01" value={d.enrollFeeThreshold} placeholder="e.g. 50" onChange={e => setD(x => ({ ...x, enrollFeeThreshold: e.target.value }))} /></div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, alignItems: "end" }}>
        <div><label style={LBL}>Notes</label><input style={INP} value={d.notes} placeholder="Notes" onChange={e => setD(x => ({ ...x, notes: e.target.value }))} /></div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, paddingBottom: 4, color: "#94a3b8" }}>
          <input type="checkbox" checked={d.active} onChange={e => setD(x => ({ ...x, active: e.target.checked }))} /> Active
        </label>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={BTN()} disabled={saving} onClick={handleSave}>Save</button>
        <button onClick={() => setEdit(false)} style={CANCEL_BTN}>Cancel</button>
      </div>
    </div>
  );
}

// ── Service Agent Row ───────────────────────────────────────────
function ServiceAgentRow({ agent, onSave }: { agent: ServiceAgent; onSave: (id: string, data: Partial<ServiceAgent>) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ name: agent.name, basePay: String(agent.basePay) });
  const [saving, setSaving] = useState(false);
  if (!edit) return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>{agent.name}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>Base Pay: ${Number(agent.basePay).toFixed(2)}{!agent.active ? " \u00b7 Inactive" : ""}</div>
      </div>
      <button onClick={() => setEdit(true)} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, background: "rgba(30,41,59,0.5)", cursor: "pointer", color: "#94a3b8", fontWeight: 600 }}>Edit</button>
    </div>
  );
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "grid", gap: 8 }}>
      <input style={INP} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
      <input style={INP} type="number" step="0.01" value={d.basePay} placeholder="Base Pay ($)" onChange={e => setD(x => ({ ...x, basePay: e.target.value }))} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={BTN()} disabled={saving} onClick={async () => { setSaving(true); await onSave(agent.id, { name: d.name, basePay: Number(d.basePay) }); setEdit(false); setSaving(false); }}>Save</button>
        <button onClick={() => setEdit(false)} style={CANCEL_BTN}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function PayrollDashboard() {
  const [tab, setTab] = useState<Tab>("periods");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [serviceAgents, setServiceAgents] = useState<ServiceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [chargebackForm, setChargebackForm] = useState({ memberName: "", memberId: "", notes: "" });
  const [chargebackMsg, setChargebackMsg] = useState("");
  const [exportRange, setExportRange] = useState<ExportRange>("week");
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState<{ name: string; type: ProductType; notes: string; premiumThreshold: string; commissionBelow: string; commissionAbove: string; bundledCommission: string; standaloneCommission: string; enrollFeeThreshold: string }>({ name: "", type: "CORE", notes: "", premiumThreshold: "", commissionBelow: "", commissionAbove: "", bundledCommission: "", standaloneCommission: "", enrollFeeThreshold: "" });
  const [cfgMsg, setCfgMsg] = useState("");

  // Service staff state
  const [newServiceAgent, setNewServiceAgent] = useState({ name: "", basePay: "" });
  const [svcMsg, setSvcMsg] = useState("");
  const [svcPeriodId, setSvcPeriodId] = useState("");
  const [svcBonuses, setSvcBonuses] = useState<Record<string, Record<string, string>>>({});
  const [bonusCategories, setBonusCategories] = useState<BonusCategory[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDeduction, setNewCatDeduction] = useState(false);;

  useEffect(() => {
    captureTokenFromUrl();
    Promise.all([
      authFetch(`${API}/api/payroll/periods`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/products`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/service-agents`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/settings/service-bonus-categories`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([p, prod, sa, cats]) => {
      setPeriods(p);
      setProducts(prod);
      setServiceAgents(sa);
      setBonusCategories(cats);
      if (p.length > 0) setSvcPeriodId(p[0].id);
      setLoading(false);
    });
  }, []);

  async function refreshPeriods() {
    const p = await authFetch(`${API}/api/payroll/periods`).then(r => r.ok ? r.json() : periods).catch(() => periods);
    setPeriods(p);
  }

  async function submitChargeback(e: FormEvent) {
    e.preventDefault(); setChargebackMsg("");
    try {
      const body = Object.fromEntries(Object.entries(chargebackForm).filter(([, v]) => v));
      const res = await authFetch(`${API}/api/clawbacks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setChargebackMsg("Chargeback processed successfully"); setChargebackForm({ memberName: "", memberId: "", notes: "" }); }
      else { const err = await res.json().catch(() => ({})); setChargebackMsg(`Error: ${err.error ?? "No matching sale found"}`); }
    } catch (e: any) { setChargebackMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function updateSale(saleId: string, data: Record<string, unknown>) {
    try {
      const res = await authFetch(`${API}/api/sales/${saleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) { await refreshPeriods(); }
      else { const err = await res.json().catch(() => ({})); alert(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { alert(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function updateBonusFronted(entryId: string, bonusAmount: number, frontedAmount: number) {
    try {
      await authFetch(`${API}/api/payroll/entries/${entryId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bonusAmount, frontedAmount }) });
      await refreshPeriods();
    } catch { /* silent — values will refresh on next load */ }
  }

  async function toggleApproval(saleId: string, approved: boolean) {
    const res = await authFetch(`${API}/api/sales/${saleId}/approve-commission`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved }) });
    if (res.ok) await refreshPeriods();
  }

  function filterPeriodsByRange(range: ExportRange): Period[] {
    const now = new Date();
    return periods.filter(p => {
      const start = new Date(p.weekStart);
      if (range === "week") { const d = new Date(now); d.setDate(now.getDate() - 7); return start >= d; }
      if (range === "month") { const d = new Date(now); d.setMonth(now.getMonth() - 1); return start >= d; }
      const d = new Date(now); d.setMonth(now.getMonth() - 3); return start >= d;
    });
  }

  function exportCSV(range: ExportRange) {
    const filtered = filterPeriodsByRange(range);
    const rows = [["Week Start","Week End","Quarter","Status","Entries","Gross","Net"]];
    filtered.forEach(p => {
      const gross = p.entries.reduce((s, e) => s + Number(e.payoutAmount), 0);
      const net = p.entries.reduce((s, e) => s + Number(e.netAmount), 0);
      rows.push([p.weekStart, p.weekEnd, p.quarterLabel, p.status, String(p.entries.length), gross.toFixed(2), net.toFixed(2)]);
    });
    const label = range === "week" ? "weekly" : range === "month" ? "monthly" : "quarterly";
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })), download: `payroll-${label}.csv` });
    a.click();
  }

  function exportDetailedCSV(range: ExportRange) {
    const filtered = filterPeriodsByRange(range);
    const esc = (v: string) => v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    const rows = [["Week Start","Week End","Quarter","Agent","Member ID","Member Name","Core","Add-on","AD&D","Enroll Fee","Commission","Bonus","Fronted","Net"]];
    for (const p of filtered) {
      for (const e of p.entries) {
        const byType: Record<string, string[]> = { CORE: [], ADDON: [], AD_D: [] };
        if (e.sale?.product?.type) byType[e.sale.product.type]?.push(e.sale.product.name);
        if (e.sale?.addons) for (const ad of e.sale.addons) byType[ad.product.type]?.push(ad.product.name);
        const fee = e.sale?.enrollmentFee != null ? Number(e.sale.enrollmentFee).toFixed(2) : "";
        rows.push([
          fmtDate(p.weekStart), fmtDate(p.weekEnd), p.quarterLabel,
          esc(e.agent?.name ?? "Unknown"), e.sale?.memberId ?? "", esc(e.sale?.memberName ?? ""),
          esc(byType.CORE.join(", ")), esc(byType.ADDON.join(", ")), esc(byType.AD_D.join(", ")),
          fee, Number(e.payoutAmount).toFixed(2), Number(e.bonusAmount).toFixed(2),
          Number(e.frontedAmount).toFixed(2), Number(e.netAmount).toFixed(2),
        ]);
      }
    }
    const label = range === "week" ? "weekly" : range === "month" ? "monthly" : "quarterly";
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })), download: `payroll-detailed-${label}.csv` });
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
  .core { color: #2563eb; font-weight: 600; }
  .addon { color: #7c3aed; font-weight: 600; }
  .add { color: #d97706; font-weight: 600; }
  .subtotal td { border-top: 2px solid #cbd5e1; font-weight: 700; border-bottom: none; }
  @media print { body { padding: 0; } .agent-card { padding: 16px 0; } }
</style></head><body>` +
    agents.map(([agentName, entries]) => {
      const agentGross = entries.reduce((s, e) => s + Number(e.payoutAmount), 0);
      const agentBonus = entries.reduce((s, e) => s + Number(e.bonusAmount), 0);
      const agentFronted = entries.reduce((s, e) => s + Number(e.frontedAmount), 0);
      const agentNet = entries.reduce((s, e) => s + Number(e.netAmount), 0);
      return `<div class="agent-card">
  <div class="header">
    <h1>${agentName}</h1>
    <div class="meta">Sunday ${fmtDate(period.weekStart)} – Saturday ${fmtDate(period.weekEnd)} &nbsp;·&nbsp; ${period.quarterLabel} &nbsp;·&nbsp; ${entries.length} sale${entries.length !== 1 ? "s" : ""}</div>
  </div>
  <div class="summary">
    <div class="summary-item"><div class="summary-label">Commission</div><div class="summary-value">$${agentGross.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Bonuses</div><div class="summary-value green">+$${agentBonus.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Fronted</div><div class="summary-value red">-$${agentFronted.toFixed(2)}</div></div>
    <div class="summary-item"><div class="summary-label">Net Payout</div><div class="summary-value green">$${agentNet.toFixed(2)}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Member ID</th><th>Member Name</th><th class="center">Core</th><th class="center">Add-on</th><th class="center">AD&D</th>
      <th class="right">Enroll Fee</th><th class="right">Commission</th><th class="right">Bonus</th><th class="right">Fronted</th><th class="right">Net</th>
    </tr></thead>
    <tbody>` +
      entries.map(e => {
        const byType: Record<string, {name:string,premium?:number}[]> = { CORE: [], ADDON: [], AD_D: [] };
        if (e.sale?.product?.type) byType[e.sale.product.type]?.push({ name: e.sale.product.name, premium: Number(e.sale.premium) });
        if (e.sale?.addons) for (const ad of e.sale.addons) byType[ad.product.type]?.push({ name: ad.product.name });
        const printProd = (items: {name:string,premium?:number}[]) => items.length ? items.map(p => p.name + (p.premium != null ? `<br><span style="font-size:10px;color:#64748b">$${p.premium.toFixed(2)}</span>` : "")).join(", ") : "—";
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
        <td class="right red">${Number(e.frontedAmount) > 0 ? "$" + Number(e.frontedAmount).toFixed(2) : "$0.00"}</td>
        <td class="right green" style="font-weight:700">$${Number(e.netAmount).toFixed(2)}</td>
      </tr>`;
      }).join("") +
      `<tr class="subtotal">
        <td colspan="6" class="right">SUBTOTAL</td>
        <td class="right">$${agentGross.toFixed(2)}</td>
        <td class="right green">$${agentBonus.toFixed(2)}</td>
        <td class="right red">$${agentFronted.toFixed(2)}</td>
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
  .header { border-bottom: 2px solid #7c3aed; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 800; color: #7c3aed; }
  .header .meta { font-size: 13px; color: #64748b; margin-top: 4px; }
  .total { font-size: 16px; font-weight: 800; color: #7c3aed; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { padding: 8px 8px; text-align: left; font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #e2e8f0; }
  td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; }
  .right { text-align: right; } .center { text-align: center; }
  .green { color: #059669; } .red { color: #dc2626; } .purple { color: #7c3aed; font-weight: 700; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="header">
  <h1>Customer Service Payroll</h1>
  <div class="meta">Sunday ${fmtDate(period.weekStart)} – Saturday ${fmtDate(period.weekEnd)} &nbsp;·&nbsp; ${period.quarterLabel}</div>
</div>
<div class="total">Total: $${total.toFixed(2)}</div>
<table>
  <thead><tr><th>Name</th><th class="right">Base Pay</th>${cats.map(c => `<th class="center"${c.isDeduction ? ' style="color:#dc2626"' : ""}>${c.name}</th>`).join("")}<th class="right" style="color:#7c3aed">Total</th></tr></thead>
  <tbody>${serviceEntries.map(se => {
      const bd = (se.bonusBreakdown ?? {}) as Record<string, number>;
      return `<tr><td style="font-weight:600">${se.serviceAgent.name}</td><td class="right">$${Number(se.basePay).toFixed(2)}</td>${cats.map(c => {
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
      const res = await authFetch(`${API}/api/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) { const updated = await res.json(); setProducts(prev => prev.map(p => p.id === id ? updated : p)); setCfgMsg("Product updated"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function deleteProduct(id: string) {
    try {
      const res = await authFetch(`${API}/api/products/${id}`, { method: "DELETE" });
      if (res.ok) { setProducts(prev => prev.filter(p => p.id !== id)); setCfgMsg("Product deleted"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault(); setCfgMsg("");
    try {
      const body: Record<string, unknown> = { name: newProduct.name, type: newProduct.type, notes: newProduct.notes || undefined };
      if (newProduct.type === "CORE") {
        if (newProduct.premiumThreshold) body.premiumThreshold = Number(newProduct.premiumThreshold);
        if (newProduct.commissionBelow) body.commissionBelow = Number(newProduct.commissionBelow);
        if (newProduct.commissionAbove) body.commissionAbove = Number(newProduct.commissionAbove);
      } else {
        if (newProduct.bundledCommission) body.bundledCommission = Number(newProduct.bundledCommission);
        if (newProduct.standaloneCommission) body.standaloneCommission = Number(newProduct.standaloneCommission);
        if (newProduct.enrollFeeThreshold) body.enrollFeeThreshold = Number(newProduct.enrollFeeThreshold);
      }
      const res = await authFetch(`${API}/api/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { const p = await res.json(); setProducts(prev => [...prev, p]); setNewProduct({ name: "", type: "CORE", notes: "", premiumThreshold: "", commissionBelow: "", commissionAbove: "", bundledCommission: "", standaloneCommission: "", enrollFeeThreshold: "" }); setCfgMsg("Product added"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  // Service agent CRUD
  async function saveServiceAgent(id: string, data: Partial<ServiceAgent>) {
    try {
      const res = await authFetch(`${API}/api/service-agents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) { const updated = await res.json(); setServiceAgents(prev => prev.map(a => a.id === id ? updated : a)); setSvcMsg("Agent updated"); }
      else { const err = await res.json().catch(() => ({})); setSvcMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setSvcMsg(`Error: ${e.message ?? "network error"}`); }
  }

  async function addServiceAgent(e: FormEvent) {
    e.preventDefault(); setSvcMsg("");
    try {
      const res = await authFetch(`${API}/api/service-agents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newServiceAgent.name, basePay: Number(newServiceAgent.basePay) }) });
      if (res.ok) { const a = await res.json(); setServiceAgents(prev => [...prev, a]); setNewServiceAgent({ name: "", basePay: "" }); setSvcMsg("Customer service agent added successfully"); }
      else { const err = await res.json().catch(() => ({})); setSvcMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setSvcMsg(`Error: ${e.message ?? "network error"}`); }
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
      const res = await authFetch(`${API}/api/payroll/service-entries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceAgentId: agentId, payrollPeriodId: svcPeriodId, bonusBreakdown }) });
      if (res.ok) { setSvcMsg("Service payroll entry saved"); await refreshPeriods(); }
      else { const err = await res.json().catch(() => ({})); setSvcMsg(`Error: ${err.error ?? "Failed"}`); }
    } catch (e: any) { setSvcMsg(`Error: ${e.message ?? "network error"}`); }
  }

  async function saveBonusCategories(cats: BonusCategory[]) {
    setSvcMsg("");
    try {
      const res = await authFetch(`${API}/api/settings/service-bonus-categories`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categories: cats }) });
      if (res.ok) { setBonusCategories(await res.json()); setSvcMsg("Bonus categories updated"); }
      else { const err = await res.json().catch(() => ({})); setSvcMsg(`Error: ${err.error ?? "Failed"}`); }
    } catch (e: any) { setSvcMsg(`Error: ${e.message ?? "network error"}`); }
  }

  if (loading) return <PageShell title="Payroll Dashboard"><p style={{ color: "#64748b" }}>Loading\u2026</p></PageShell>;

  const TAB_LABELS: Record<Tab, string> = { periods: "Payroll Weeks", chargebacks: "Chargebacks", exports: "Exports", products: "Products", service: "Customer Service" };

  return (
    <PageShell title="Payroll Dashboard">
      <nav style={{ display: "flex", gap: 4, marginBottom: 24, padding: "4px 6px", background: "rgba(15,23,42,0.5)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", width: "fit-content" }}>
        {(["periods","chargebacks","exports","products","service"] as Tab[]).map(t => (
          <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>{TAB_LABELS[t]}</button>
        ))}
      </nav>

      {/* ── Payroll Weeks ── */}
      {tab === "periods" && (
        <div style={{ display: "grid", gap: 14 }}>
          {periods.map(p => {
            const gross = p.entries.reduce((s, e) => s + Number(e.payoutAmount), 0);
            const totalBonus = p.entries.reduce((s, e) => s + Number(e.bonusAmount ?? 0), 0);
            const totalFronted = p.entries.reduce((s, e) => s + Number(e.frontedAmount ?? 0), 0);
            const net = p.entries.reduce((s, e) => s + Number(e.netAmount), 0);
            const svcTotal = (p.serviceEntries ?? []).reduce((s, e) => s + Number(e.totalPay), 0);
            const sc = STATUS_COLORS[p.status] ?? { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" };
            const expanded = expandedPeriod === p.id;
            const needsApproval = p.entries.filter(e => e.sale && e.sale.enrollmentFee !== null && Number(e.sale.enrollmentFee) < 99 && !e.sale.commissionApproved);

            // Group entries by agent
            const byAgent = new Map<string, Entry[]>();
            for (const e of p.entries) {
              const name = e.agent?.name ?? "Unknown";
              if (!byAgent.has(name)) byAgent.set(name, []);
              byAgent.get(name)!.push(e);
            }

            return (
              <div key={p.id} style={CARD}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, cursor: "pointer" }} onClick={() => setExpandedPeriod(expanded ? null : p.id)}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: 16, color: "#f1f5f9", letterSpacing: "0.01em" }}>{fmtDate(p.weekStart)}--{fmtDate(p.weekEnd)}</span>
                    <span style={{ marginLeft: 10, fontSize: 13, color: "#64748b" }}>{p.quarterLabel}</span>
                    {needsApproval.length > 0 && <span style={{ marginLeft: 10, background: "rgba(251,191,36,0.15)", color: "#fbbf24", padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, boxShadow: "0 0 8px rgba(251,191,36,0.15)" }}>{needsApproval.length} need approval</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {p.entries.length > 0 && <button onClick={e => { e.stopPropagation(); printAgentCards([...byAgent.entries()], p); }} style={{ padding: "5px 14px", fontSize: 11, fontWeight: 700, border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, background: "rgba(59,130,246,0.1)", color: "#60a5fa", cursor: "pointer", transition: "box-shadow 0.2s ease", boxShadow: "0 1px 4px rgba(59,130,246,0.1)" }}>Print All</button>}
                    <span style={{ background: sc.bg, color: sc.color, padding: "4px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", boxShadow: `0 0 8px ${sc.color}20` }}>{p.status}</span>
                    <span style={{ fontSize: 12, color: "#475569" }}>{expanded ? "\u25B2" : "\u25BC"}</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }}>Entries</div>
                    <div style={{ fontWeight: 900, fontSize: 26, color: "#e2e8f0" }}>{p.entries.length}</div>
                  </div>
                  <div style={{ background: "rgba(59,130,246,0.04)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(59,130,246,0.08)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }}>Commission</div>
                    <div style={{ fontWeight: 900, fontSize: 26, background: "linear-gradient(135deg, #60a5fa, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties}>${gross.toFixed(2)}</div>
                  </div>
                  <div style={{ background: "rgba(16,185,129,0.04)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(16,185,129,0.08)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }}>Bonuses</div>
                    <div style={{ fontWeight: 900, fontSize: 26, color: "#34d399" }}>+${totalBonus.toFixed(2)}</div>
                  </div>
                  <div style={{ background: "rgba(239,68,68,0.04)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(239,68,68,0.08)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }}>Fronted</div>
                    <div style={{ fontWeight: 900, fontSize: 26, color: "#f87171" }}>-${totalFronted.toFixed(2)}</div>
                  </div>
                  <div style={{ background: "rgba(16,185,129,0.06)", borderRadius: 10, padding: "14px 16px", border: "1px solid rgba(16,185,129,0.1)" }}>
                    <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em" }}>Net Payout</div>
                    <div style={{ fontWeight: 900, fontSize: 26, background: "linear-gradient(135deg, #34d399, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties}>${net.toFixed(2)}</div>
                  </div>
                </div>

                {/* Customer service totals if any */}
                {(p.serviceEntries ?? []).length > 0 && (
                  <div style={{ marginTop: 10, padding: "12px 16px", background: "rgba(139,92,246,0.08)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid rgba(139,92,246,0.12)" }}>
                    <span style={{ fontSize: 13, color: "#a78bfa", fontWeight: 700 }}>Customer Service ({p.serviceEntries.length})</span>
                    <span style={{ fontSize: 16, fontWeight: 900, background: "linear-gradient(135deg, #a78bfa, #c084fc)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties}>${svcTotal.toFixed(2)}</span>
                  </div>
                )}

                {expanded && (
                  <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14, display: "grid", gap: 16 }}>
                    {/* Per-agent boxes */}
                    {(() => {
                      const agentEntries = [...byAgent.entries()].map(([name, ents]) => ({ name, entries: ents, net: ents.reduce((s, e) => s + Number(e.netAmount), 0), gross: ents.reduce((s, e) => s + Number(e.payoutAmount), 0) }));
                      const sorted = [...agentEntries].sort((a, b) => b.net - a.net);
                      const top3 = new Set(sorted.slice(0, 3).filter(a => a.net > 0).map(a => a.name));
                      return agentEntries.map(({ name: agentName, entries, net: agentNet, gross: agentGross }) => {
                      const isTopEarner = top3.has(agentName);
                      return (
                        <div key={agentName} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 16, borderLeft: isTopEarner ? "3px solid #10b981" : "1px solid rgba(255,255,255,0.06)", transition: "border-color 0.2s ease" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 15, color: "#e2e8f0" }}>{agentName}</span>
                              <span style={{ marginLeft: 10, fontSize: 12, color: "#64748b" }}>{entries.length} sale{entries.length !== 1 ? "s" : ""}</span>
                            </div>
                            <div style={{ display: "flex", gap: 16, fontSize: 13, alignItems: "center" }}>
                              <span style={{ color: "#94a3b8" }}>Commission: <strong style={{ color: "#e2e8f0", fontSize: 14 }}>${agentGross.toFixed(2)}</strong></span>
                              <span style={{ color: "#94a3b8" }}>Net: <strong style={{ color: "#34d399", fontSize: 14 }}>${agentNet.toFixed(2)}</strong></span>
                              <button onClick={e2 => { e2.stopPropagation(); printAgentCards([[agentName, entries]], p); }} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, border: "1px solid rgba(59,130,246,0.2)", borderRadius: 6, background: "rgba(59,130,246,0.1)", color: "#60a5fa", cursor: "pointer", transition: "box-shadow 0.2s ease" }}>Print</button>
                            </div>
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                            Sunday {fmtDate(p.weekStart)} \u2013 Saturday {fmtDate(p.weekEnd)}
                          </div>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 800 }}>
                              <thead><tr>
                                <th style={{ padding: "8px 8px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>Member ID</th>
                                <th style={{ padding: "8px 8px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>Member Name</th>
                                <th style={{ padding: "8px 6px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>Core</th>
                                <th style={{ padding: "8px 6px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>Add-on</th>
                                <th style={{ padding: "8px 6px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>AD&D</th>
                                <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>Enroll Fee</th>
                                <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>Commission</th>
                                <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>Bonus</th>
                                <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>Fronted</th>
                                <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>Net</th>
                                <th style={{ padding: "8px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>Actions</th>
                              </tr></thead>
                              <tbody>
                                {entries.map(e => {
                                  const fee = e.sale?.enrollmentFee != null ? Number(e.sale.enrollmentFee) : null;
                                  const needsApprovalRow = fee !== null && fee < 99 && !e.sale?.commissionApproved;
                                  const isApproved = e.sale?.commissionApproved && fee !== null && fee < 99;
                                  // Collect product names by type with premium
                                  const byType: Record<string, {name:string, premium?:number}[]> = { CORE: [], ADDON: [], AD_D: [] };
                                  if (e.sale?.product?.type) byType[e.sale.product.type]?.push({ name: e.sale.product.name, premium: Number(e.sale.premium) });
                                  if (e.sale?.addons) for (const a of e.sale.addons) byType[a.product.type]?.push({ name: a.product.name });
                                  const prodCell = (items: {name:string,premium?:number}[], color: string) => items.length ? (
                                    <>{items.map((p, i) => <div key={i}><span style={{ fontWeight: 600 }}>{p.name}</span>{p.premium != null && <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>${p.premium.toFixed(2)}</div>}</div>)}</>
                                  ) : "\u2014";
                                  return (
                                    <tr key={e.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: needsApprovalRow ? "rgba(239,68,68,0.05)" : "transparent" }}>
                                      <td style={{ padding: "8px 8px", color: "#94a3b8", fontSize: 12 }}>{e.sale?.memberId ?? "\u2014"}</td>
                                      <td style={{ padding: "8px 8px", color: "#e2e8f0", fontWeight: 500 }}>{e.sale?.memberName ?? "\u2014"}</td>
                                      <td style={{ padding: "8px 6px", textAlign: "center", fontSize: 12, color: byType.CORE.length ? "#3b82f6" : "#334155" }}>{prodCell(byType.CORE, "#3b82f6")}</td>
                                      <td style={{ padding: "8px 6px", textAlign: "center", fontSize: 12, color: byType.ADDON.length ? "#8b5cf6" : "#334155" }}>{prodCell(byType.ADDON, "#8b5cf6")}</td>
                                      <td style={{ padding: "8px 6px", textAlign: "center", fontSize: 12, color: byType.AD_D.length ? "#f59e0b" : "#334155" }}>{prodCell(byType.AD_D, "#f59e0b")}</td>
                                      <td style={{ padding: "8px 8px", textAlign: "right", color: needsApprovalRow ? "#f87171" : "#94a3b8", fontWeight: needsApprovalRow ? 700 : 400 }}>
                                        {fee !== null ? `$${fee.toFixed(2)}` : "\u2014"}
                                      </td>
                                      <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, color: "#e2e8f0" }}>${Number(e.payoutAmount).toFixed(2)}</td>
                                      <td style={{ padding: "8px 8px", textAlign: "right", color: Number(e.bonusAmount) > 0 ? "#34d399" : "#94a3b8" }}>${Number(e.bonusAmount).toFixed(2)}</td>
                                      <td style={{ padding: "8px 8px", textAlign: "right", color: Number(e.frontedAmount) > 0 ? "#f87171" : "#94a3b8" }}>${Number(e.frontedAmount).toFixed(2)}</td>
                                      <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, color: "#34d399" }}>${Number(e.netAmount).toFixed(2)}</td>
                                      <td style={{ padding: "8px 8px", textAlign: "center" }}>
                                        {(needsApprovalRow || isApproved) && (
                                          <button onClick={() => toggleApproval(e.sale!.id, !e.sale!.commissionApproved)} style={{ padding: "4px 12px", background: isApproved ? "linear-gradient(135deg, #059669, #10b981)" : "rgba(251,191,36,0.12)", color: isApproved ? "white" : "#fbbf24", border: isApproved ? "none" : "1px solid rgba(251,191,36,0.25)", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", boxShadow: isApproved ? "0 0 12px rgba(16,185,129,0.4), 0 0 4px rgba(16,185,129,0.2)" : "0 0 8px rgba(251,191,36,0.15)", transition: "all 0.2s ease" }}>{isApproved ? "Approved" : "Pending"}</button>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                                {/* Agent subtotal row */}
                                <tr style={{ borderTop: "2px solid rgba(255,255,255,0.08)" }}>
                                  <td colSpan={5} style={{ padding: "8px 8px", fontWeight: 700, fontSize: 12, color: "#64748b", textAlign: "right" }}>SUBTOTAL</td>
                                  <td style={{ padding: "8px 8px", textAlign: "right", color: "#94a3b8", fontSize: 12 }}></td>
                                  <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, color: "#e2e8f0" }}>${agentGross.toFixed(2)}</td>
                                  <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, color: "#34d399" }}>${entries.reduce((s, e) => s + Number(e.bonusAmount), 0).toFixed(2)}</td>
                                  <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 700, color: "#f87171" }}>${entries.reduce((s, e) => s + Number(e.frontedAmount), 0).toFixed(2)}</td>
                                  <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 800, color: "#34d399" }}>${agentNet.toFixed(2)}</td>
                                  <td></td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    });
                    })()}

                    {/* Customer Service box */}
                    {(p.serviceEntries ?? []).length > 0 && (
                      <div style={{ background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.15)", borderRadius: 12, padding: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, paddingBottom: 10, borderBottom: "1px solid rgba(139,92,246,0.15)" }}>
                          <span style={{ fontWeight: 700, fontSize: 15, color: "#a78bfa" }}>Customer Service</span>
                          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#a78bfa" }}>Total: ${svcTotal.toFixed(2)}</span>
                            <button onClick={e2 => { e2.stopPropagation(); printServiceCards(p.serviceEntries, p, bonusCategories); }} style={{ padding: "4px 12px", fontSize: 11, fontWeight: 600, border: "1px solid rgba(139,92,246,0.2)", borderRadius: 6, background: "rgba(139,92,246,0.1)", color: "#a78bfa", cursor: "pointer" }}>Print</button>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
                          Sunday {fmtDate(p.weekStart)} {"\u2013"} Saturday {fmtDate(p.weekEnd)}
                        </div>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 500 }}>
                            <thead><tr>
                              <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(139,92,246,0.15)" }}>Name</th>
                              <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(139,92,246,0.15)" }}>Base Pay</th>
                              {bonusCategories.map(cat => (
                                <th key={cat.name} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontWeight: 700, color: cat.isDeduction ? "#f87171" : "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid rgba(139,92,246,0.15)", whiteSpace: "nowrap" }}>{cat.name}</th>
                              ))}
                              <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(139,92,246,0.15)" }}>Total</th>
                            </tr></thead>
                            <tbody>
                              {p.serviceEntries.map(se => {
                                const bd = (se.bonusBreakdown ?? {}) as Record<string, number>;
                                return (
                                  <tr key={se.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                    <td style={{ padding: "8px 10px", color: "#e2e8f0", fontWeight: 600 }}>{se.serviceAgent.name}</td>
                                    <td style={{ padding: "8px 8px", textAlign: "right", color: "#94a3b8" }}>${Number(se.basePay).toFixed(2)}</td>
                                    {bonusCategories.map(cat => {
                                      const amt = bd[cat.name] ?? 0;
                                      return (
                                        <td key={cat.name} style={{ padding: "8px 6px", textAlign: "center", color: amt > 0 ? (cat.isDeduction ? "#f87171" : "#34d399") : "#334155", fontWeight: amt > 0 ? 700 : 400, fontSize: 12 }}>
                                          {amt > 0 ? `$${amt.toFixed(2)}` : "\u2014"}
                                        </td>
                                      );
                                    })}
                                    <td style={{ padding: "8px 8px", textAlign: "right", color: "#a78bfa", fontWeight: 700 }}>${Number(se.totalPay).toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {p.entries.length === 0 && (p.serviceEntries ?? []).length === 0 && (
                      <div style={{ padding: 24, textAlign: "center", color: "#475569" }}>No entries for this period</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {periods.length === 0 && <div style={{ padding: 48, textAlign: "center", color: "#475569", ...CARD }}>No payroll periods found</div>}
        </div>
      )}

      {/* ── Chargebacks ── */}
      {tab === "chargebacks" && (
        <div style={{ maxWidth: 520 }}>
          <p style={{ color: "#64748b", marginTop: 0, marginBottom: 20, fontSize: 14 }}>Match by Member ID (preferred) or Member Name to process a chargeback.</p>
          <form onSubmit={submitChargeback} style={{ ...CARD, display: "grid", gap: 16 }}>
            <div><label style={LBL}>Member ID <span style={{ color: "#475569", fontWeight: 400 }}>(preferred)</span></label><input style={INP} value={chargebackForm.memberId} placeholder="e.g. M-12345" onChange={e => setChargebackForm(f => ({ ...f, memberId: e.target.value }))} /></div>
            <div><label style={LBL}>Member Name <span style={{ color: "#475569", fontWeight: 400 }}>(if no ID)</span></label><input style={INP} value={chargebackForm.memberName} placeholder="e.g. John Doe" onChange={e => setChargebackForm(f => ({ ...f, memberName: e.target.value }))} /></div>
            <div><label style={LBL}>Notes</label><textarea style={{ ...INP, height: 80, resize: "vertical" } as React.CSSProperties} value={chargebackForm.notes} onChange={e => setChargebackForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button type="submit" style={{ padding: "12px 28px", background: "linear-gradient(135deg, #dc2626, #ef4444)", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14, boxShadow: "0 2px 12px rgba(220,38,38,0.35)", transition: "box-shadow 0.2s ease, transform 0.15s ease" }}>Process Chargeback</button>
              {chargebackMsg && <span style={{ color: chargebackMsg.startsWith("Chargeback") ? "#34d399" : "#f87171", fontWeight: 600, fontSize: 14 }}>{chargebackMsg}</span>}
            </div>
          </form>
        </div>
      )}

      {/* ── Exports ── */}
      {tab === "exports" && (
        <div style={{ maxWidth: 460 }}>
          <p style={{ color: "#64748b", marginTop: 0, fontSize: 14, marginBottom: 20 }}>Download payroll period data as a CSV file.</p>
          <div style={CARD}>
            <div style={{ marginBottom: 20 }}>
              <label style={LBL}>Time Range</label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["week", "month", "quarter"] as ExportRange[]).map(r => (
                  <button key={r} onClick={() => setExportRange(r)} style={{
                    padding: "8px 20px",
                    border: exportRange === r ? "1px solid rgba(59,130,246,0.4)" : "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    background: exportRange === r ? "rgba(59,130,246,0.15)" : "rgba(15,23,42,0.6)",
                    color: exportRange === r ? "#60a5fa" : "#64748b",
                    fontWeight: exportRange === r ? 700 : 500,
                    cursor: "pointer", fontSize: 13,
                    boxShadow: exportRange === r ? "0 0 8px rgba(59,130,246,0.15)" : "none",
                    transition: "all 0.2s ease",
                  }}>
                    {{ week: "Week", month: "Month", quarter: "Quarter" }[r]}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button onClick={() => exportCSV(exportRange)} style={BTN()}>Download Summary CSV</button>
              <button onClick={() => exportDetailedCSV(exportRange)} style={BTN("#059669")}>Download Detailed CSV</button>
            </div>
            <p style={{ color: "#475569", fontSize: 13, marginTop: 14, marginBottom: 0 }}><strong style={{ color: "#94a3b8" }}>Summary:</strong> week range, status, entries, gross and net per period.</p>
            <p style={{ color: "#475569", fontSize: 13, marginTop: 6, marginBottom: 0 }}><strong style={{ color: "#94a3b8" }}>Detailed:</strong> per-entry rows matching payroll card format — agent, member, products, fees, commission, bonus, fronted, net.</p>
          </div>
        </div>
      )}

      {/* ── Products ── */}
      {tab === "products" && (
        <div style={{ maxWidth: 700 }}>
          <div style={CARD}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Products & Commission</h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>Configure product types and commission rates.</p>

            {products.map(p => <ProductRow key={p.id} product={p} onSave={saveProduct} onDelete={deleteProduct} />)}
            {products.length === 0 && <p style={{ color: "#475569", margin: "16px 0" }}>No products configured yet.</p>}

            <div style={{ marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", marginBottom: 14 }}>Add New Product</div>
              <form onSubmit={addProduct} style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                  <div><label style={LBL}>Name</label><input style={INP} value={newProduct.name} placeholder="Product name *" required onChange={e => setNewProduct(x => ({ ...x, name: e.target.value }))} /></div>
                  <div><label style={LBL}>Type</label>
                    <select style={{ ...INP, height: 42 }} value={newProduct.type} onChange={e => setNewProduct(x => ({ ...x, type: e.target.value as ProductType }))}>
                      <option value="CORE">Core Product</option><option value="ADDON">Add-on</option><option value="AD_D">AD&D</option>
                    </select>
                  </div>
                </div>
                {newProduct.type === "CORE" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div><label style={LBL}>Premium Threshold ($)</label><input style={INP} type="number" step="0.01" value={newProduct.premiumThreshold} placeholder="e.g. 250" onChange={e => setNewProduct(x => ({ ...x, premiumThreshold: e.target.value }))} /></div>
                    <div><label style={LBL}>Commission Below (%)</label><input style={INP} type="number" step="0.01" value={newProduct.commissionBelow} placeholder="e.g. 30" onChange={e => setNewProduct(x => ({ ...x, commissionBelow: e.target.value }))} /></div>
                    <div><label style={LBL}>Commission Above (%)</label><input style={INP} type="number" step="0.01" value={newProduct.commissionAbove} placeholder="e.g. 40" onChange={e => setNewProduct(x => ({ ...x, commissionAbove: e.target.value }))} /></div>
                  </div>
                )}
                {(newProduct.type === "ADDON" || newProduct.type === "AD_D") && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div><label style={LBL}>Bundled Commission (%){newProduct.type === "ADDON" ? " \u2014 blank = match core" : ""}</label><input style={INP} type="number" step="0.01" value={newProduct.bundledCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setNewProduct(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
                    <div><label style={LBL}>Standalone Commission (%)</label><input style={INP} type="number" step="0.01" value={newProduct.standaloneCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setNewProduct(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
                    <div><label style={LBL}>Enroll Fee Threshold ($)</label><input style={INP} type="number" step="0.01" value={newProduct.enrollFeeThreshold} placeholder="e.g. 50" onChange={e => setNewProduct(x => ({ ...x, enrollFeeThreshold: e.target.value }))} /></div>
                  </div>
                )}
                <input style={INP} value={newProduct.notes} placeholder="Notes" onChange={e => setNewProduct(x => ({ ...x, notes: e.target.value }))} />
                <button type="submit" style={BTN("#059669")}>Add Product</button>
              </form>
              {cfgMsg && <div style={{ marginTop: 12, color: cfgMsg.startsWith("Error") ? "#f87171" : "#34d399", fontWeight: 600, fontSize: 14 }}>{cfgMsg}</div>}
            </div>

            <div style={{ marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
              <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                <strong style={{ color: "#64748b" }}>Enrollment fee rules:</strong> $125 \u2192 +$10 bonus \u00b7 $99 \u2192 $0 \u00b7 Below $99 \u2192 halves all commission (unless approved) \u00b7 Standalone add-ons: $50 threshold instead of $99
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Service Staff ── */}
      {tab === "service" && (
        <div style={{ display: "grid", gap: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            {/* Service Agents list */}
            <div style={CARD}>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Customer Service</h3>
              <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>Manage customer service agents with base pay.</p>

              {serviceAgents.map(a => <ServiceAgentRow key={a.id} agent={a} onSave={saveServiceAgent} />)}
              {serviceAgents.length === 0 && <p style={{ color: "#475569", margin: "16px 0" }}>No service agents yet.</p>}

              <form onSubmit={addServiceAgent} style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", display: "grid", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Add Customer Service Agent</div>
                <input style={INP} value={newServiceAgent.name} placeholder="Name *" required onChange={e => setNewServiceAgent(x => ({ ...x, name: e.target.value }))} />
                <input style={INP} type="number" step="0.01" value={newServiceAgent.basePay} placeholder="Base Pay ($) *" required onChange={e => setNewServiceAgent(x => ({ ...x, basePay: e.target.value }))} />
                <button type="submit" style={BTN("#059669")}>Add Service Agent</button>
              </form>
            </div>

            {/* Bonus Categories Config */}
            <div style={CARD}>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Bonus Categories</h3>
              <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>Configure bonus/deduction columns for service payroll.</p>

              {bonusCategories.map((cat, i) => (
                <div key={cat.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: cat.isDeduction ? "#f87171" : "#e2e8f0" }}>{cat.name}</span>
                  <span style={{ fontSize: 11, color: cat.isDeduction ? "#f87171" : "#34d399", fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: cat.isDeduction ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)" }}>{cat.isDeduction ? "Deduction" : "Bonus"}</span>
                  <button onClick={() => { const next = bonusCategories.filter((_, j) => j !== i); saveBonusCategories(next); }} style={{ padding: "3px 8px", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 4, background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>×</button>
                </div>
              ))}
              {bonusCategories.length === 0 && <p style={{ color: "#475569", margin: "16px 0", fontSize: 13 }}>No categories configured.</p>}

              <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "1fr auto auto", gap: 8, alignItems: "end" }}>
                <div>
                  <label style={{ ...LBL, fontSize: 10 }}>Category Name</label>
                  <input style={INP} value={newCatName} placeholder="e.g. Flips" onChange={e => setNewCatName(e.target.value)} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8", paddingBottom: 4 }}>
                  <input type="checkbox" checked={newCatDeduction} onChange={e => setNewCatDeduction(e.target.checked)} /> Deduction
                </label>
                <button type="button" onClick={() => {
                  if (!newCatName.trim()) return;
                  saveBonusCategories([...bonusCategories, { name: newCatName.trim(), isDeduction: newCatDeduction }]);
                  setNewCatName(""); setNewCatDeduction(false);
                }} style={BTN("#059669")}>Add</button>
              </div>
            </div>
          </div>

          {/* Weekly Payroll — per-category inputs */}
          <div style={CARD}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Weekly Payroll</h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>Enter bonus amounts per category for each service agent.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={LBL}>Payroll Period</label>
              <select style={{ ...INP, height: 42 }} value={svcPeriodId} onChange={e => setSvcPeriodId(e.target.value)}>
                {periods.map(p => <option key={p.id} value={p.id}>{fmtDate(p.weekStart)} \u2013 {fmtDate(p.weekEnd)}</option>)}
              </select>
            </div>

            {bonusCategories.length === 0 && <p style={{ color: "#475569", fontSize: 13 }}>Add bonus categories above to start entering payroll.</p>}

            {bonusCategories.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
                  <thead><tr>
                    <th style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Agent</th>
                    <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Base Pay</th>
                    {bonusCategories.map(cat => (
                      <th key={cat.name} style={{ padding: "8px 6px", textAlign: "center", fontSize: 10, fontWeight: 700, color: cat.isDeduction ? "#f87171" : "#64748b", textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>{cat.name}</th>
                    ))}
                    <th style={{ padding: "8px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>Total</th>
                    <th style={{ padding: "8px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}></th>
                  </tr></thead>
                  <tbody>
                    {serviceAgents.filter(a => a.active).map(agent => {
                      const key = agent.id;
                      const currentPeriod = periods.find(p => p.id === svcPeriodId);
                      const existingEntry = currentPeriod?.serviceEntries?.find(se => se.serviceAgent.name === agent.name);
                      // Initialize from existing breakdown or empty
                      const vals = svcBonuses[key] ?? (existingEntry?.bonusBreakdown ? Object.fromEntries(Object.entries(existingEntry.bonusBreakdown).map(([k, v]) => [k, String(v)])) : {});
                      const basePay = Number(agent.basePay);
                      let total = basePay;
                      for (const cat of bonusCategories) {
                        const amt = Number(vals[cat.name]) || 0;
                        total += cat.isDeduction ? -amt : amt;
                      }

                      return (
                        <tr key={key} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          <td style={{ padding: "8px 10px", color: "#e2e8f0", fontWeight: 600 }}>
                            {agent.name}
                            {existingEntry && <span style={{ fontSize: 10, color: "#a78bfa", marginLeft: 6 }}>✓ saved</span>}
                          </td>
                          <td style={{ padding: "8px 8px", textAlign: "right", color: "#94a3b8", fontWeight: 600 }}>${basePay.toFixed(2)}</td>
                          {bonusCategories.map(cat => (
                            <td key={cat.name} style={{ padding: "4px 4px", textAlign: "center" }}>
                              <input
                                style={{ ...SMALL_INP, width: 65, textAlign: "center", background: cat.isDeduction && Number(vals[cat.name] || 0) > 0 ? "rgba(239,68,68,0.12)" : SMALL_INP.background, color: cat.isDeduction ? "#f87171" : "#e2e8f0" }}
                                type="number" step="0.01" placeholder="0"
                                value={vals[cat.name] ?? ""}
                                onChange={e => setSvcBonuses(prev => ({ ...prev, [key]: { ...vals, [cat.name]: e.target.value } }))}
                              />
                            </td>
                          ))}
                          <td style={{ padding: "8px 8px", textAlign: "right", fontWeight: 800, fontSize: 14, color: "#a78bfa" }}>${total.toFixed(2)}</td>
                          <td style={{ padding: "8px 6px", textAlign: "center" }}>
                            <button type="button" onClick={() => submitServiceBonus(agent.id)} style={{ padding: "5px 14px", background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {svcMsg && <div style={{ color: svcMsg.startsWith("Error") ? "#f87171" : "#34d399", fontWeight: 600, fontSize: 14 }}>{svcMsg}</div>}
        </div>
      )}
    </PageShell>
  );
}
