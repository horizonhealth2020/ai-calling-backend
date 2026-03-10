"use client";
import { useState, useEffect, FormEvent } from "react";
import { PageShell } from "@ops/ui";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";
type Tab = "periods" | "chargebacks" | "exports" | "products";
type SaleInfo = { id: string; memberName: string; memberId?: string; enrollmentFee: number | null; commissionApproved: boolean; product: { name: string; type: string } };
type Entry = { id: string; payoutAmount: number; netAmount: number; status: string; sale?: SaleInfo; agent?: { name: string } };
type Period = { id: string; weekStart: string; weekEnd: string; quarterLabel: string; status: string; entries: Entry[] };
type ProductType = "CORE" | "ADDON" | "AD_D";
type Product = { id: string; name: string; active: boolean; type: ProductType; premiumThreshold?: number | null; commissionBelow?: number | null; commissionAbove?: number | null; bundledCommission?: number | null; standaloneCommission?: number | null; notes?: string };
type ExportRange = "week" | "month" | "quarter";
const STATUS_COLORS: Record<string, string> = { OPEN: "#2563eb", LOCKED: "#d97706", FINALIZED: "#16a34a" };
const INP: React.CSSProperties = { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: "100%", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };
const CARD: React.CSSProperties = { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20 };
const BTN = (color = "#2563eb"): React.CSSProperties => ({ padding: "8px 18px", background: color, color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 });
function tabBtn(active: boolean): React.CSSProperties {
  return { padding: "8px 18px", border: "none", background: "transparent", cursor: "pointer", borderBottom: active ? "2px solid #2563eb" : "2px solid transparent", fontWeight: active ? 700 : 400, color: active ? "#2563eb" : "#6b7280", fontSize: 14 };
}

const TYPE_LABELS: Record<ProductType, string> = { CORE: "Core Product", ADDON: "Add-on", AD_D: "AD&D" };
const TYPE_COLORS: Record<ProductType, string> = { CORE: "#2563eb", ADDON: "#7c3aed", AD_D: "#d97706" };

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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</span>
            <span style={{ background: col + "18", color: col, padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{TYPE_LABELS[product.type]}</span>
            {!product.active && <span style={{ color: "#9ca3af", fontSize: 11 }}>(Inactive)</span>}
          </div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            {product.type === "CORE" && <>
              {product.commissionBelow != null && <span>Below ${product.premiumThreshold}: {product.commissionBelow}%</span>}
              {product.commissionAbove != null && <span> · Above ${product.premiumThreshold}: {product.commissionAbove}%</span>}
            </>}
            {(product.type === "ADDON" || product.type === "AD_D") && <>
              {product.bundledCommission != null && <span>Bundled: {product.bundledCommission}%</span>}
              {product.bundledCommission == null && product.type === "ADDON" && <span>Bundled: matches core</span>}
              {product.standaloneCommission != null && <span> · Standalone: {product.standaloneCommission}%</span>}
            </>}
            {product.notes ? ` · ${product.notes}` : ""}
          </div>
        </div>
        <button onClick={() => setEdit(true)} style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, background: "white", cursor: "pointer" }}>Edit</button>
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
    <div style={{ padding: "12px 0", borderBottom: "1px solid #f3f4f6", display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
        <div><label style={LBL}>Name</label><input style={INP} value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} /></div>
        <div><label style={LBL}>Type</label>
          <select style={{ ...INP, height: 40 }} value={d.type} onChange={e => setD(x => ({ ...x, type: e.target.value as ProductType }))}>
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
          <div><label style={LBL}>Bundled Commission (%){d.type === "ADDON" ? " — leave blank to match core" : ""}</label><input style={INP} type="number" step="0.01" value={d.bundledCommission} placeholder={d.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setD(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
          <div><label style={LBL}>Standalone Commission (%)</label><input style={INP} type="number" step="0.01" value={d.standaloneCommission} placeholder={d.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setD(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, alignItems: "end" }}>
        <div><label style={LBL}>Notes</label><input style={INP} value={d.notes} placeholder="Notes" onChange={e => setD(x => ({ ...x, notes: e.target.value }))} /></div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, paddingBottom: 4 }}>
          <input type="checkbox" checked={d.active} onChange={e => setD(x => ({ ...x, active: e.target.checked }))} /> Active
        </label>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button style={BTN()} disabled={saving} onClick={handleSave}>Save</button>
        <button onClick={() => setEdit(false)} style={{ padding: "8px 14px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 13 }}>Cancel</button>
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

  // Product config state
  const [newProduct, setNewProduct] = useState<{ name: string; type: ProductType; notes: string; premiumThreshold: string; commissionBelow: string; commissionAbove: string; bundledCommission: string; standaloneCommission: string }>({ name: "", type: "CORE", notes: "", premiumThreshold: "", commissionBelow: "", commissionAbove: "", bundledCommission: "", standaloneCommission: "" });
  const [cfgMsg, setCfgMsg] = useState("");

  useEffect(() => {
    const o = { credentials: "include" as const };
    Promise.all([
      fetch(`${API}/api/payroll/periods`, o).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/products`, o).then(r => r.ok ? r.json() : []),
    ]).then(([p, prod]) => { setPeriods(p); setProducts(prod); setLoading(false); });
  }, []);

  async function submitChargeback(e: FormEvent) {
    e.preventDefault(); setChargebackMsg("");
    const body = Object.fromEntries(Object.entries(chargebackForm).filter(([, v]) => v));
    const res = await fetch(`${API}/api/clawbacks`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    if (res.ok) { setChargebackMsg("Chargeback processed successfully"); setChargebackForm({ memberName: "", memberId: "", notes: "" }); }
    else { const err = await res.json().catch(() => ({})); setChargebackMsg(`Error: ${err.error ?? "No matching sale found"}`); }
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
    const res = await fetch(`${API}/api/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
    if (res.ok) { const updated = await res.json(); setProducts(prev => prev.map(p => p.id === id ? updated : p)); }
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault(); setCfgMsg("");
    const body: Record<string, unknown> = { name: newProduct.name, type: newProduct.type, notes: newProduct.notes || undefined };
    if (newProduct.type === "CORE") {
      if (newProduct.premiumThreshold) body.premiumThreshold = Number(newProduct.premiumThreshold);
      if (newProduct.commissionBelow) body.commissionBelow = Number(newProduct.commissionBelow);
      if (newProduct.commissionAbove) body.commissionAbove = Number(newProduct.commissionAbove);
    } else {
      if (newProduct.bundledCommission) body.bundledCommission = Number(newProduct.bundledCommission);
      if (newProduct.standaloneCommission) body.standaloneCommission = Number(newProduct.standaloneCommission);
    }
    const res = await fetch(`${API}/api/products`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    if (res.ok) { const p = await res.json(); setProducts(prev => [...prev, p]); setNewProduct({ name: "", type: "CORE", notes: "", premiumThreshold: "", commissionBelow: "", commissionAbove: "", bundledCommission: "", standaloneCommission: "" }); setCfgMsg("Product added"); }
    else setCfgMsg("Error adding product");
  }

  async function approveCommission(saleId: string) {
    const res = await fetch(`${API}/api/sales/${saleId}/approve-commission`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include" });
    if (res.ok) {
      // Refresh periods to get updated commission
      const o = { credentials: "include" as const };
      const updated = await fetch(`${API}/api/payroll/periods`, o).then(r => r.ok ? r.json() : periods);
      setPeriods(updated);
    }
  }

  if (loading) return <PageShell title="Payroll Dashboard"><p style={{ color: "#6b7280" }}>Loading…</p></PageShell>;

  return (
    <PageShell title="Payroll Dashboard">
      <nav style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 24 }}>
        {(["periods","chargebacks","exports","products"] as Tab[]).map(t => (
          <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>
            {{ periods: "Payroll Weeks", chargebacks: "Chargebacks", exports: "Exports", products: "Products" }[t]}
          </button>
        ))}
      </nav>

      {tab === "periods" && (
        <div style={{ display: "grid", gap: 16 }}>
          {periods.map(p => {
            const gross = p.entries.reduce((s, e) => s + Number(e.payoutAmount), 0);
            const net = p.entries.reduce((s, e) => s + Number(e.netAmount), 0);
            const col = STATUS_COLORS[p.status] ?? "#6b7280";
            const expanded = expandedPeriod === p.id;
            const needsApproval = p.entries.filter(e => e.sale && e.sale.enrollmentFee !== null && Number(e.sale.enrollmentFee) < 99 && !e.sale.commissionApproved);
            return (
              <div key={p.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, cursor: "pointer" }} onClick={() => setExpandedPeriod(expanded ? null : p.id)}>
                  <div>
                    <span style={{ fontWeight: 700, fontSize: 16 }}>{p.weekStart} – {p.weekEnd}</span>
                    <span style={{ marginLeft: 10, fontSize: 13, color: "#6b7280" }}>{p.quarterLabel}</span>
                    {needsApproval.length > 0 && <span style={{ marginLeft: 10, background: "#fef2f2", color: "#dc2626", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{needsApproval.length} need approval</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ background: col + "22", color: col, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{p.status}</span>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>{expanded ? "▲" : "▼"}</span>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                  <div><div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Entries</div><div style={{ fontWeight: 700, fontSize: 20 }}>{p.entries.length}</div></div>
                  <div><div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Gross Payout</div><div style={{ fontWeight: 700, fontSize: 20 }}>${gross.toFixed(2)}</div></div>
                  <div><div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Net Payout</div><div style={{ fontWeight: 700, fontSize: 20, color: "#16a34a" }}>${net.toFixed(2)}</div></div>
                </div>

                {expanded && p.entries.length > 0 && (
                  <div style={{ marginTop: 16, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead><tr style={{ background: "#f9fafb" }}>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Agent</th>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Member</th>
                        <th style={{ padding: "8px 10px", textAlign: "left" }}>Product</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Enrollment Fee</th>
                        <th style={{ padding: "8px 10px", textAlign: "right" }}>Commission</th>
                        <th style={{ padding: "8px 10px", textAlign: "center" }}>Status</th>
                        <th style={{ padding: "8px 10px", textAlign: "center" }}>Action</th>
                      </tr></thead>
                      <tbody>{p.entries.map(e => {
                        const fee = e.sale?.enrollmentFee != null ? Number(e.sale.enrollmentFee) : null;
                        const needsApproval = fee !== null && fee < 99 && !e.sale?.commissionApproved;
                        const isHalved = needsApproval;
                        return (
                          <tr key={e.id} style={{ borderTop: "1px solid #f3f4f6", background: isHalved ? "#fef2f2" : "white" }}>
                            <td style={{ padding: "8px 10px" }}>{e.agent?.name ?? "—"}</td>
                            <td style={{ padding: "8px 10px" }}>{e.sale?.memberName ?? "—"}{e.sale?.memberId ? ` (${e.sale.memberId})` : ""}</td>
                            <td style={{ padding: "8px 10px" }}>{e.sale?.product?.name ?? "—"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: isHalved ? "#dc2626" : undefined, fontWeight: isHalved ? 700 : 400 }}>{fee !== null ? `$${fee.toFixed(2)}` : "—"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600 }}>${Number(e.netAmount).toFixed(2)}{isHalved ? " (halved)" : ""}</td>
                            <td style={{ padding: "8px 10px", textAlign: "center" }}><span style={{ fontSize: 11, fontWeight: 600 }}>{e.status}</span></td>
                            <td style={{ padding: "8px 10px", textAlign: "center" }}>
                              {needsApproval && (
                                <button onClick={() => approveCommission(e.sale!.id)} style={{ padding: "4px 12px", background: "#059669", color: "white", border: "none", borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Approve</button>
                              )}
                              {e.sale?.commissionApproved && fee !== null && fee < 99 && (
                                <span style={{ color: "#059669", fontSize: 11, fontWeight: 700 }}>Approved</span>
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
          {periods.length === 0 && <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", background: "white", borderRadius: 8, border: "1px solid #e5e7eb" }}>No payroll periods found</div>}
        </div>
      )}

      {tab === "chargebacks" && (
        <div style={{ maxWidth: 520 }}>
          <p style={{ color: "#6b7280", marginTop: 0, marginBottom: 20 }}>Match by Member ID (preferred) or Member Name to process a chargeback.</p>
          <form onSubmit={submitChargeback} style={{ display: "grid", gap: 16 }}>
            <div><label style={LBL}>Member ID <span style={{ color: "#9ca3af", fontWeight: 400 }}>(preferred)</span></label><input style={INP} value={chargebackForm.memberId} placeholder="e.g. M-12345" onChange={e => setChargebackForm(f => ({ ...f, memberId: e.target.value }))} /></div>
            <div><label style={LBL}>Member Name <span style={{ color: "#9ca3af", fontWeight: 400 }}>(if no ID)</span></label><input style={INP} value={chargebackForm.memberName} placeholder="e.g. John Doe" onChange={e => setChargebackForm(f => ({ ...f, memberName: e.target.value }))} /></div>
            <div><label style={LBL}>Notes</label><textarea style={{ ...INP, height: 80, resize: "vertical" } as React.CSSProperties} value={chargebackForm.notes} onChange={e => setChargebackForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button type="submit" style={{ padding: "10px 24px", background: "#dc2626", color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>Process Chargeback</button>
              {chargebackMsg && <span style={{ color: chargebackMsg.startsWith("Chargeback") ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{chargebackMsg}</span>}
            </div>
          </form>
        </div>
      )}

      {tab === "exports" && (
        <div style={{ maxWidth: 420 }}>
          <p style={{ color: "#6b7280", marginTop: 0 }}>Download payroll period data as a CSV file.</p>
          <div style={{ marginBottom: 16 }}>
            <label style={LBL}>Time Range</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["week", "month", "quarter"] as ExportRange[]).map(r => (
                <button key={r} onClick={() => setExportRange(r)} style={{ padding: "6px 16px", border: exportRange === r ? "2px solid #2563eb" : "1px solid #d1d5db", borderRadius: 6, background: exportRange === r ? "#eff6ff" : "white", color: exportRange === r ? "#2563eb" : "#374151", fontWeight: exportRange === r ? 700 : 400, cursor: "pointer", fontSize: 13 }}>
                  {{ week: "Week", month: "Month", quarter: "Quarter" }[r]}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => exportCSV(exportRange)} style={{ padding: "10px 24px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>Download Payroll CSV</button>
          <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 12 }}>Includes: week range, status, entries, gross and net payout per period.</p>
        </div>
      )}

      {tab === "products" && (
        <div style={{ maxWidth: 640 }}>
          <div style={CARD}>
            <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700 }}>Products & Commission</h3>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "0 0 16px" }}>Configure product types and commission rates. Core products use premium threshold rates. Add-ons and AD&D use bundled/standalone rates.</p>

            {products.map(p => <ProductRow key={p.id} product={p} onSave={saveProduct} />)}
            {products.length === 0 && <p style={{ color: "#9ca3af", margin: "16px 0" }}>No products configured yet.</p>}

            <div style={{ marginTop: 20, borderTop: "1px solid #e5e7eb", paddingTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 }}>Add New Product</div>
              <form onSubmit={addProduct} style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}>
                  <div><label style={LBL}>Name</label><input style={INP} value={newProduct.name} placeholder="Product name *" required onChange={e => setNewProduct(x => ({ ...x, name: e.target.value }))} /></div>
                  <div><label style={LBL}>Type</label>
                    <select style={{ ...INP, height: 40 }} value={newProduct.type} onChange={e => setNewProduct(x => ({ ...x, type: e.target.value as ProductType }))}>
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
                    <div><label style={LBL}>Bundled Commission (%){newProduct.type === "ADDON" ? " — blank = match core" : ""}</label><input style={INP} type="number" step="0.01" value={newProduct.bundledCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 70" : "blank = match core"} onChange={e => setNewProduct(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
                    <div><label style={LBL}>Standalone Commission (%)</label><input style={INP} type="number" step="0.01" value={newProduct.standaloneCommission} placeholder={newProduct.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setNewProduct(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
                  </div>
                )}

                <input style={INP} value={newProduct.notes} placeholder="Notes" onChange={e => setNewProduct(x => ({ ...x, notes: e.target.value }))} />
                <button type="submit" style={BTN("#059669")}>Add Product</button>
              </form>
              {cfgMsg && <div style={{ marginTop: 12, color: cfgMsg.startsWith("Error") ? "#dc2626" : "#16a34a", fontWeight: 600, fontSize: 14 }}>{cfgMsg}</div>}
            </div>

            <div style={{ marginTop: 20, borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
              <div style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
                <strong>Enrollment fee rules:</strong> $125 → +$10 bonus · $99 → $0 · Below $99 → halves all commission (unless approved) · Standalone add-ons: $50 threshold instead of $99
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
