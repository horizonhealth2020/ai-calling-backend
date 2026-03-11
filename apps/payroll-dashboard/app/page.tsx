"use client";
import { useState, useEffect, FormEvent } from "react";
import { PageShell } from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";
type Tab = "periods" | "chargebacks" | "exports" | "products" | "service";
type SaleInfo = { id: string; memberName: string; memberId?: string; carrier: string; premium: number; enrollmentFee: number | null; commissionApproved: boolean; status: string; notes?: string; product: { name: string; type: string } };
type Entry = { id: string; payoutAmount: number; adjustmentAmount: number; bonusAmount: number; frontedAmount: number; netAmount: number; status: string; sale?: SaleInfo; agent?: { name: string } };
type ServiceEntry = { id: string; basePay: number; bonusAmount: number; totalPay: number; status: string; notes?: string; serviceAgent: { name: string; basePay: number } };
type Period = { id: string; weekStart: string; weekEnd: string; quarterLabel: string; status: string; entries: Entry[]; serviceEntries: ServiceEntry[] };
type ProductType = "CORE" | "ADDON" | "AD_D";
type Product = { id: string; name: string; active: boolean; type: ProductType; premiumThreshold?: number | null; commissionBelow?: number | null; commissionAbove?: number | null; bundledCommission?: number | null; standaloneCommission?: number | null; notes?: string };
type ServiceAgent = { id: string; name: string; basePay: number; active: boolean };
type ExportRange = "week" | "month" | "quarter";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  OPEN: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" },
  LOCKED: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  FINALIZED: { bg: "rgba(16,185,129,0.15)", color: "#34d399" },
};

const INP: React.CSSProperties = { padding: "10px 14px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 14, width: "100%", boxSizing: "border-box", color: "#e2e8f0", outline: "none" };
const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
const CARD: React.CSSProperties = { background: "linear-gradient(135deg, rgba(30,41,59,0.5), rgba(15,23,42,0.6))", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 24 };
const BTN = (color = "#3b82f6"): React.CSSProperties => ({ padding: "10px 20px", background: color === "#3b82f6" ? "linear-gradient(135deg, #3b82f6, #6366f1)" : color === "#059669" ? "linear-gradient(135deg, #059669, #10b981)" : color, color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13, boxShadow: `0 2px 8px ${color}30` });
const CANCEL_BTN: React.CSSProperties = { padding: "10px 16px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, background: "rgba(30,41,59,0.5)", cursor: "pointer", fontSize: 13, color: "#94a3b8" };
const SMALL_INP: React.CSSProperties = { ...INP, padding: "6px 10px", fontSize: 13, width: 90, textAlign: "right" };

function tabBtn(active: boolean): React.CSSProperties {
  return {
    padding: "8px 20px", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.2s",
    background: active ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "transparent",
    color: active ? "#ffffff" : "#64748b",
    boxShadow: active ? "0 2px 8px rgba(59,130,246,0.3)" : "none",
  };
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
function ProductRow({ product, onSave }: { product: Product; onSave: (id: string, data: Partial<Product>) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({
    name: product.name, active: product.active, type: product.type, notes: product.notes ?? "",
    premiumThreshold: String(product.premiumThreshold ?? ""), commissionBelow: String(product.commissionBelow ?? ""), commissionAbove: String(product.commissionAbove ?? ""),
    bundledCommission: String(product.bundledCommission ?? ""), standaloneCommission: String(product.standaloneCommission ?? ""),
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
        <button onClick={() => setEdit(true)} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, background: "rgba(30,41,59,0.5)", cursor: "pointer", color: "#94a3b8", fontWeight: 600 }}>Edit</button>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div><label style={LBL}>Bundled Commission (%){d.type === "ADDON" ? " \u2014 leave blank to match core" : ""}</label><input style={INP} type="number" step="0.01" value={d.bundledCommission} placeholder={d.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setD(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
          <div><label style={LBL}>Standalone Commission (%)</label><input style={INP} type="number" step="0.01" value={d.standaloneCommission} placeholder={d.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setD(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
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

  const [newProduct, setNewProduct] = useState<{ name: string; type: ProductType; notes: string; premiumThreshold: string; commissionBelow: string; commissionAbove: string; bundledCommission: string; standaloneCommission: string }>({ name: "", type: "CORE", notes: "", premiumThreshold: "", commissionBelow: "", commissionAbove: "", bundledCommission: "", standaloneCommission: "" });
  const [cfgMsg, setCfgMsg] = useState("");

  // Service staff state
  const [newServiceAgent, setNewServiceAgent] = useState({ name: "", basePay: "" });
  const [svcMsg, setSvcMsg] = useState("");
  const [svcPeriodId, setSvcPeriodId] = useState("");
  const [svcBonuses, setSvcBonuses] = useState<Record<string, { agentId: string; bonus: string; notes: string }>>({});

  useEffect(() => {
    captureTokenFromUrl();
    Promise.all([
      authFetch(`${API}/api/payroll/periods`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/products`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/service-agents`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([p, prod, sa]) => {
      setPeriods(p);
      setProducts(prod);
      setServiceAgents(sa);
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

  async function approveCommission(saleId: string) {
    const res = await authFetch(`${API}/api/sales/${saleId}/approve-commission`, { method: "PATCH", headers: { "Content-Type": "application/json" } });
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

  async function saveProduct(id: string, data: Partial<Product>) {
    try {
      const res = await authFetch(`${API}/api/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) { const updated = await res.json(); setProducts(prev => prev.map(p => p.id === id ? updated : p)); setCfgMsg("Product updated"); }
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
      }
      const res = await authFetch(`${API}/api/products`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { const p = await res.json(); setProducts(prev => [...prev, p]); setNewProduct({ name: "", type: "CORE", notes: "", premiumThreshold: "", commissionBelow: "", commissionAbove: "", bundledCommission: "", standaloneCommission: "" }); setCfgMsg("Product added"); }
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
      if (res.ok) { const a = await res.json(); setServiceAgents(prev => [...prev, a]); setNewServiceAgent({ name: "", basePay: "" }); setSvcMsg("Customer service agent added"); }
      else { const err = await res.json().catch(() => ({})); setSvcMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setSvcMsg(`Error: ${e.message ?? "network error"}`); }
  }

  async function submitServiceBonus(agentId: string) {
    const b = svcBonuses[agentId];
    if (!b || !svcPeriodId) return;
    setSvcMsg("");
    try {
      const res = await authFetch(`${API}/api/payroll/service-entries`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceAgentId: agentId, payrollPeriodId: svcPeriodId, bonusAmount: Number(b.bonus) || 0, notes: b.notes || undefined }) });
      if (res.ok) { setSvcMsg("Service payroll entry saved"); await refreshPeriods(); }
      else { const err = await res.json().catch(() => ({})); setSvcMsg(`Error: ${err.error ?? "Failed"}`); }
    } catch (e: any) { setSvcMsg(`Error: ${e.message ?? "network error"}`); }
  }

  if (loading) return <PageShell title="Payroll Dashboard"><p style={{ color: "#64748b" }}>Loading\u2026</p></PageShell>;

  const TAB_LABELS: Record<Tab, string> = { periods: "Payroll Weeks", chargebacks: "Chargebacks", exports: "Exports", products: "Products", service: "Service Staff" };

  return (
    <PageShell title="Payroll Dashboard">
      <nav style={{ display: "flex", gap: 6, marginBottom: 28, padding: 4, background: "rgba(15,23,42,0.4)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)", width: "fit-content" }}>
        {(["periods","chargebacks","exports","products","service"] as Tab[]).map(t => (
          <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>{TAB_LABELS[t]}</button>
        ))}
      </nav>

      {/* ── Payroll Weeks ── */}
      {tab === "periods" && (
        <div style={{ display: "grid", gap: 16 }}>
          {periods.map(p => {
            const gross = p.entries.reduce((s, e) => s + Number(e.payoutAmount), 0);
            const totalBonus = p.entries.reduce((s, e) => s + Number(e.bonusAmount ?? 0), 0);
            const totalFronted = p.entries.reduce((s, e) => s + Number(e.frontedAmount ?? 0), 0);
            const net = p.entries.reduce((s, e) => s + Number(e.netAmount), 0);
            const svcTotal = (p.serviceEntries ?? []).reduce((s, e) => s + Number(e.totalPay), 0);
            const sc = STATUS_COLORS[p.status] ?? { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" };
            const expanded = expandedPeriod === p.id;
            const needsApproval = p.entries.filter(e => e.sale && e.sale.enrollmentFee !== null && Number(e.sale.enrollmentFee) < 99 && !e.sale.commissionApproved);
            return (
              <div key={p.id} style={CARD}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, cursor: "pointer" }} onClick={() => setExpandedPeriod(expanded ? null : p.id)}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 16, color: "#e2e8f0" }}>{p.weekStart} \u2013 {p.weekEnd}</span>
                    <span style={{ marginLeft: 10, fontSize: 13, color: "#64748b" }}>{p.quarterLabel}</span>
                    {needsApproval.length > 0 && <span style={{ marginLeft: 10, background: "rgba(239,68,68,0.15)", color: "#f87171", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{needsApproval.length} need approval</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ background: sc.bg, color: sc.color, padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{p.status}</span>
                    <span style={{ fontSize: 12, color: "#475569" }}>{expanded ? "\u25B2" : "\u25BC"}</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Entries</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: "#e2e8f0" }}>{p.entries.length}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Commission</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: "#e2e8f0" }}>${gross.toFixed(2)}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Bonuses</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: "#34d399" }}>+${totalBonus.toFixed(2)}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Fronted</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: "#f87171" }}>-${totalFronted.toFixed(2)}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Net Payout</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: "#34d399" }}>${net.toFixed(2)}</div>
                  </div>
                </div>

                {/* Service staff totals if any */}
                {(p.serviceEntries ?? []).length > 0 && (
                  <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(139,92,246,0.08)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#a78bfa", fontWeight: 600 }}>Service Staff ({p.serviceEntries.length})</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#a78bfa" }}>${svcTotal.toFixed(2)}</span>
                  </div>
                )}

                {expanded && (
                  <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
                    {p.entries.length > 0 && (
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 900 }}>
                          <thead><tr>
                            {["Agent", "Member", "Product", "Enroll Fee", "Commission", "Bonus", "Fronted", "Net", "Actions"].map((h, i) => (
                              <th key={h} style={{ padding: "10px 10px", textAlign: i >= 3 && i <= 7 ? "right" : i === 8 ? "center" : "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {p.entries.map(e => (
                              <EditableSaleRow key={e.id} entry={e} onSaleUpdate={updateSale} onBonusFrontedUpdate={updateBonusFronted} onApprove={approveCommission} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Service entries detail */}
                    {(p.serviceEntries ?? []).length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 8 }}>Service Staff Payroll</div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead><tr>
                            {["Name", "Base Pay", "Bonus", "Total", "Notes"].map((h, i) => (
                              <th key={h} style={{ padding: "8px 10px", textAlign: i >= 1 && i <= 3 ? "right" : "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {p.serviceEntries.map(se => (
                              <tr key={se.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                <td style={{ padding: "8px 10px", color: "#e2e8f0", fontWeight: 600 }}>{se.serviceAgent.name}</td>
                                <td style={{ padding: "8px 10px", textAlign: "right", color: "#94a3b8" }}>${Number(se.basePay).toFixed(2)}</td>
                                <td style={{ padding: "8px 10px", textAlign: "right", color: Number(se.bonusAmount) > 0 ? "#34d399" : "#94a3b8", fontWeight: Number(se.bonusAmount) > 0 ? 700 : 400 }}>${Number(se.bonusAmount).toFixed(2)}</td>
                                <td style={{ padding: "8px 10px", textAlign: "right", color: "#a78bfa", fontWeight: 700 }}>${Number(se.totalPay).toFixed(2)}</td>
                                <td style={{ padding: "8px 10px", color: "#64748b", fontStyle: "italic" }}>{se.notes ?? ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
              <button type="submit" style={{ padding: "12px 28px", background: "linear-gradient(135deg, #dc2626, #ef4444)", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14, boxShadow: "0 2px 8px rgba(220,38,38,0.3)" }}>Process Chargeback</button>
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
                  }}>
                    {{ week: "Week", month: "Month", quarter: "Quarter" }[r]}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => exportCSV(exportRange)} style={BTN()}>Download Payroll CSV</button>
            <p style={{ color: "#475569", fontSize: 13, marginTop: 14, marginBottom: 0 }}>Includes: week range, status, entries, gross and net payout per period.</p>
          </div>
        </div>
      )}

      {/* ── Products ── */}
      {tab === "products" && (
        <div style={{ maxWidth: 700 }}>
          <div style={CARD}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Products & Commission</h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>Configure product types and commission rates.</p>

            {products.map(p => <ProductRow key={p.id} product={p} onSave={saveProduct} />)}
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div><label style={LBL}>Bundled Commission (%){newProduct.type === "ADDON" ? " \u2014 blank = match core" : ""}</label><input style={INP} type="number" step="0.01" value={newProduct.bundledCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setNewProduct(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
                    <div><label style={LBL}>Standalone Commission (%)</label><input style={INP} type="number" step="0.01" value={newProduct.standaloneCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setNewProduct(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Service Agents list */}
          <div style={CARD}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Customer Service Agents</h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>Manage customer service staff with base pay and bonuses.</p>

            {serviceAgents.map(a => <ServiceAgentRow key={a.id} agent={a} onSave={saveServiceAgent} />)}
            {serviceAgents.length === 0 && <p style={{ color: "#475569", margin: "16px 0" }}>No service agents yet.</p>}

            <form onSubmit={addServiceAgent} style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Add Service Agent</div>
              <input style={INP} value={newServiceAgent.name} placeholder="Name *" required onChange={e => setNewServiceAgent(x => ({ ...x, name: e.target.value }))} />
              <input style={INP} type="number" step="0.01" value={newServiceAgent.basePay} placeholder="Base Pay ($) *" required onChange={e => setNewServiceAgent(x => ({ ...x, basePay: e.target.value }))} />
              <button type="submit" style={BTN("#059669")}>Add Service Agent</button>
            </form>
          </div>

          {/* Assign bonuses to a period */}
          <div style={CARD}>
            <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Weekly Payroll</h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>Enter bonuses for each service agent per payroll period.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={LBL}>Payroll Period</label>
              <select style={{ ...INP, height: 42 }} value={svcPeriodId} onChange={e => setSvcPeriodId(e.target.value)}>
                {periods.map(p => <option key={p.id} value={p.id}>{p.weekStart} \u2013 {p.weekEnd}</option>)}
              </select>
            </div>

            {serviceAgents.filter(a => a.active).map(agent => {
              const key = agent.id;
              const b = svcBonuses[key] ?? { agentId: agent.id, bonus: "0", notes: "" };
              // Check if there's already an entry for this period
              const currentPeriod = periods.find(p => p.id === svcPeriodId);
              const existingEntry = currentPeriod?.serviceEntries?.find(se => se.serviceAgent.name === agent.name);

              return (
                <div key={key} style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>{agent.name}</span>
                      <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>Base: ${Number(agent.basePay).toFixed(2)}</span>
                    </div>
                    {existingEntry && <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 700 }}>Saved: ${Number(existingEntry.totalPay).toFixed(2)}</span>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "100px 1fr auto", gap: 8, alignItems: "end" }}>
                    <div>
                      <label style={{ ...LBL, fontSize: 10 }}>Bonus ($)</label>
                      <input style={INP} type="number" step="0.01" value={b.bonus} placeholder="0" onChange={e => setSvcBonuses(prev => ({ ...prev, [key]: { ...b, agentId: agent.id, bonus: e.target.value } }))} />
                    </div>
                    <div>
                      <label style={{ ...LBL, fontSize: 10 }}>Notes</label>
                      <input style={INP} value={b.notes} placeholder="Optional" onChange={e => setSvcBonuses(prev => ({ ...prev, [key]: { ...b, agentId: agent.id, notes: e.target.value } }))} />
                    </div>
                    <button type="button" onClick={() => submitServiceBonus(agent.id)} style={BTN()}>Save</button>
                  </div>
                </div>
              );
            })}
          </div>

          {svcMsg && <div style={{ gridColumn: "1/-1", color: svcMsg.startsWith("Error") ? "#f87171" : "#34d399", fontWeight: 600, fontSize: 14 }}>{svcMsg}</div>}
        </div>
      )}
    </PageShell>
  );
}
