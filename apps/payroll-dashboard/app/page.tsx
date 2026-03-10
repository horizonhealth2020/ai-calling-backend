"use client";
import { useState, useEffect, FormEvent } from "react";
import { PageShell } from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";
type Tab = "periods" | "chargebacks" | "exports" | "products";
type SaleInfo = { id: string; memberName: string; memberId?: string; enrollmentFee: number | null; commissionApproved: boolean; product: { name: string; type: string } };
type Entry = { id: string; payoutAmount: number; netAmount: number; status: string; sale?: SaleInfo; agent?: { name: string } };
type Period = { id: string; weekStart: string; weekEnd: string; quarterLabel: string; status: string; entries: Entry[] };
type ProductType = "CORE" | "ADDON" | "AD_D";
type Product = { id: string; name: string; active: boolean; type: ProductType; premiumThreshold?: number | null; commissionBelow?: number | null; commissionAbove?: number | null; bundledCommission?: number | null; standaloneCommission?: number | null; notes?: string };
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
    setEdit(false);
    setSaving(false);
  };

  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <div><label style={LBL}>Name</label><input style={INP} value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} /></div>
        <div><label style={LBL}>Type</label>
          <select style={{ ...INP, height: 42 }} value={d.type} onChange={e => setD(x => ({ ...x, type: e.target.value as ProductType }))}>
            <option value="CORE">Core Product</option>
            <option value="ADDON">Add-on</option>
            <option value="AD_D">AD&D</option>
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

export default function PayrollDashboard() {
  const [tab, setTab] = useState<Tab>("periods");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [chargebackForm, setChargebackForm] = useState({ memberName: "", memberId: "", notes: "" });
  const [chargebackMsg, setChargebackMsg] = useState("");
  const [exportRange, setExportRange] = useState<ExportRange>("week");
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

  const [newProduct, setNewProduct] = useState<{ name: string; type: ProductType; notes: string; premiumThreshold: string; commissionBelow: string; commissionAbove: string; bundledCommission: string; standaloneCommission: string }>({ name: "", type: "CORE", notes: "", premiumThreshold: "", commissionBelow: "", commissionAbove: "", bundledCommission: "", standaloneCommission: "" });
  const [cfgMsg, setCfgMsg] = useState("");

  useEffect(() => {
    captureTokenFromUrl();
    Promise.all([
      authFetch(`${API}/api/payroll/periods`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/products`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([p, prod]) => { setPeriods(p); setProducts(prod); setLoading(false); });
  }, []);

  async function submitChargeback(e: FormEvent) {
    e.preventDefault(); setChargebackMsg("");
    try {
      const body = Object.fromEntries(Object.entries(chargebackForm).filter(([, v]) => v));
      const res = await authFetch(`${API}/api/clawbacks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) { setChargebackMsg("Chargeback processed successfully"); setChargebackForm({ memberName: "", memberId: "", notes: "" }); }
      else { const err = await res.json().catch(() => ({})); setChargebackMsg(`Error: ${err.error ?? "No matching sale found"}`); }
    } catch (e: any) { setChargebackMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
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
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? "Failed to update product"}`); }
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
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? "Failed to add product"}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function approveCommission(saleId: string) {
    const res = await authFetch(`${API}/api/sales/${saleId}/approve-commission`, { method: "PATCH", headers: { "Content-Type": "application/json" } });
    if (res.ok) {
      const updated = await authFetch(`${API}/api/payroll/periods`).then(r => r.ok ? r.json() : periods);
      setPeriods(updated);
    }
  }

  if (loading) return <PageShell title="Payroll Dashboard"><p style={{ color: "#64748b" }}>Loading\u2026</p></PageShell>;

  const TAB_LABELS: Record<Tab, string> = { periods: "Payroll Weeks", chargebacks: "Chargebacks", exports: "Exports", products: "Products" };

  return (
    <PageShell title="Payroll Dashboard">
      {/* Tab Navigation */}
      <nav style={{ display: "flex", gap: 6, marginBottom: 28, padding: 4, background: "rgba(15,23,42,0.4)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)", width: "fit-content" }}>
        {(["periods","chargebacks","exports","products"] as Tab[]).map(t => (
          <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>{TAB_LABELS[t]}</button>
        ))}
      </nav>

      {/* ── Payroll Weeks ── */}
      {tab === "periods" && (
        <div style={{ display: "grid", gap: 16 }}>
          {periods.map(p => {
            const gross = p.entries.reduce((s, e) => s + Number(e.payoutAmount), 0);
            const net = p.entries.reduce((s, e) => s + Number(e.netAmount), 0);
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
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Entries</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: "#e2e8f0" }}>{p.entries.length}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Gross Payout</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: "#e2e8f0" }}>${gross.toFixed(2)}</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>Net Payout</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: "#34d399" }}>${net.toFixed(2)}</div>
                  </div>
                </div>

                {expanded && p.entries.length > 0 && (
                  <div style={{ marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead><tr>
                        {["Agent", "Member", "Product", "Enrollment Fee", "Commission", "Status", "Action"].map((h, i) => (
                          <th key={h} style={{ padding: "10px 10px", textAlign: i === 3 || i === 4 ? "right" : i >= 5 ? "center" : "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>{p.entries.map(e => {
                        const fee = e.sale?.enrollmentFee != null ? Number(e.sale.enrollmentFee) : null;
                        const needsApproval = fee !== null && fee < 99 && !e.sale?.commissionApproved;
                        const isHalved = needsApproval;
                        return (
                          <tr key={e.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)", background: isHalved ? "rgba(239,68,68,0.05)" : "transparent" }}>
                            <td style={{ padding: "10px 10px", color: "#e2e8f0" }}>{e.agent?.name ?? "\u2014"}</td>
                            <td style={{ padding: "10px 10px", color: "#94a3b8" }}>{e.sale?.memberName ?? "\u2014"}{e.sale?.memberId ? ` (${e.sale.memberId})` : ""}</td>
                            <td style={{ padding: "10px 10px", color: "#94a3b8" }}>{e.sale?.product?.name ?? "\u2014"}</td>
                            <td style={{ padding: "10px 10px", textAlign: "right", color: isHalved ? "#f87171" : "#94a3b8", fontWeight: isHalved ? 700 : 400 }}>{fee !== null ? `$${fee.toFixed(2)}` : "\u2014"}</td>
                            <td style={{ padding: "10px 10px", textAlign: "right", fontWeight: 700, color: "#e2e8f0" }}>${Number(e.netAmount).toFixed(2)}{isHalved ? " (halved)" : ""}</td>
                            <td style={{ padding: "10px 10px", textAlign: "center" }}><span style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8" }}>{e.status}</span></td>
                            <td style={{ padding: "10px 10px", textAlign: "center" }}>
                              {needsApproval && (
                                <button onClick={() => approveCommission(e.sale!.id)} style={{ padding: "5px 14px", background: "linear-gradient(135deg, #059669, #10b981)", color: "white", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                              )}
                              {e.sale?.commissionApproved && fee !== null && fee < 99 && (
                                <span style={{ color: "#34d399", fontSize: 11, fontWeight: 700 }}>Approved</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
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
            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>Configure product types and commission rates. Core products use premium threshold rates. Add-ons and AD&D use bundled/standalone rates.</p>

            {products.map(p => <ProductRow key={p.id} product={p} onSave={saveProduct} />)}
            {products.length === 0 && <p style={{ color: "#475569", margin: "16px 0" }}>No products configured yet.</p>}

            <div style={{ marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8", marginBottom: 14 }}>Add New Product</div>
              <form onSubmit={addProduct} style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                  <div><label style={LBL}>Name</label><input style={INP} value={newProduct.name} placeholder="Product name *" required onChange={e => setNewProduct(x => ({ ...x, name: e.target.value }))} /></div>
                  <div><label style={LBL}>Type</label>
                    <select style={{ ...INP, height: 42 }} value={newProduct.type} onChange={e => setNewProduct(x => ({ ...x, type: e.target.value as ProductType }))}>
                      <option value="CORE">Core Product</option>
                      <option value="ADDON">Add-on</option>
                      <option value="AD_D">AD&D</option>
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
    </PageShell>
  );
}
