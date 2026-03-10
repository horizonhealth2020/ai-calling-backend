"use client";
import { useState, useEffect, FormEvent } from "react";
import { PageShell } from "@ops/ui";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";
type Tab = "periods" | "chargebacks" | "exports" | "products";
type Entry = { id: string; payoutAmount: number; netAmount: number; status: string };
type Period = { id: string; weekStart: string; weekEnd: string; quarterLabel: string; status: string; entries: Entry[] };
type Product = { id: string; name: string; active: boolean; notes?: string };
type ExportRange = "week" | "month" | "quarter";
const STATUS_COLORS: Record<string, string> = { OPEN: "#2563eb", LOCKED: "#d97706", FINALIZED: "#16a34a" };
const INP: React.CSSProperties = { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: "100%", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };
const CARD: React.CSSProperties = { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20 };
const BTN = (color = "#2563eb"): React.CSSProperties => ({ padding: "8px 18px", background: color, color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 });
function tabBtn(active: boolean): React.CSSProperties {
  return { padding: "8px 18px", border: "none", background: "transparent", cursor: "pointer", borderBottom: active ? "2px solid #2563eb" : "2px solid transparent", fontWeight: active ? 700 : 400, color: active ? "#2563eb" : "#6b7280", fontSize: 14 };
}

function ProductRow({ product, onSave }: { product: Product; onSave: (id: string, data: Partial<Product>) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ name: product.name, active: product.active, notes: product.notes ?? "" });
  const [saving, setSaving] = useState(false);
  if (!edit) return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</div>
        <div style={{ fontSize: 12, color: product.active ? "#16a34a" : "#9ca3af" }}>{product.active ? "Active" : "Inactive"}{product.notes ? ` · ${product.notes}` : ""}</div>
      </div>
      <button onClick={() => setEdit(true)} style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, background: "white", cursor: "pointer" }}>Edit</button>
    </div>
  );
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6", display: "grid", gap: 8 }}>
      <input style={INP} value={d.name} placeholder="Product name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
      <input style={INP} value={d.notes} placeholder="Notes" onChange={e => setD(x => ({ ...x, notes: e.target.value }))} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <input type="checkbox" checked={d.active} onChange={e => setD(x => ({ ...x, active: e.target.checked }))} /> Active
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={BTN()} disabled={saving} onClick={async () => { setSaving(true); await onSave(product.id, d); setEdit(false); setSaving(false); }}>Save</button>
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

  // Product config state
  const [newProduct, setNewProduct] = useState({ name: "", notes: "" });
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
      if (range === "week") {
        const oneWeekAgo = new Date(now);
        oneWeekAgo.setDate(now.getDate() - 7);
        return start >= oneWeekAgo;
      } else if (range === "month") {
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(now.getMonth() - 1);
        return start >= oneMonthAgo;
      } else {
        const oneQuarterAgo = new Date(now);
        oneQuarterAgo.setMonth(now.getMonth() - 3);
        return start >= oneQuarterAgo;
      }
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
    if (res.ok) setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }

  async function addProduct(e: FormEvent) {
    e.preventDefault(); setCfgMsg("");
    const res = await fetch(`${API}/api/products`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(newProduct) });
    if (res.ok) { const p = await res.json(); setProducts(prev => [...prev, p]); setNewProduct({ name: "", notes: "" }); setCfgMsg("Product added"); }
    else setCfgMsg("Error adding product");
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
            return (
              <div key={p.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div><span style={{ fontWeight: 700, fontSize: 16 }}>{p.weekStart} – {p.weekEnd}</span><span style={{ marginLeft: 10, fontSize: 13, color: "#6b7280" }}>{p.quarterLabel}</span></div>
                  <span style={{ background: col + "22", color: col, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{p.status}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                  <div><div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Entries</div><div style={{ fontWeight: 700, fontSize: 20 }}>{p.entries.length}</div></div>
                  <div><div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Gross Payout</div><div style={{ fontWeight: 700, fontSize: 20 }}>${gross.toFixed(2)}</div></div>
                  <div><div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>Net Payout</div><div style={{ fontWeight: 700, fontSize: 20, color: "#16a34a" }}>${net.toFixed(2)}</div></div>
                </div>
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
        <div style={{ maxWidth: 520 }}>
          <div style={CARD}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Products</h3>
            {products.map(p => <ProductRow key={p.id} product={p} onSave={saveProduct} />)}
            {products.length === 0 && <p style={{ color: "#9ca3af", margin: 0 }}>No products configured yet.</p>}
            <form onSubmit={addProduct} style={{ marginTop: 16, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Add Product</div>
              <input style={INP} value={newProduct.name} placeholder="Product name *" required onChange={e => setNewProduct(x => ({ ...x, name: e.target.value }))} />
              <input style={INP} value={newProduct.notes} placeholder="Notes" onChange={e => setNewProduct(x => ({ ...x, notes: e.target.value }))} />
              <button type="submit" style={BTN("#059669")}>Add Product</button>
            </form>
            {cfgMsg && <div style={{ marginTop: 12, color: cfgMsg.startsWith("Error") ? "#dc2626" : "#16a34a", fontWeight: 600, fontSize: 14 }}>{cfgMsg}</div>}
          </div>
        </div>
      )}
    </PageShell>
  );
}
