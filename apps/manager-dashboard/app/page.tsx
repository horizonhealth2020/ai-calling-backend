"use client";
import { useState, useEffect, FormEvent } from "react";
import { PageShell } from "@ops/ui";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

type Tab = "sales" | "tracker" | "audits" | "config";
type Agent = { id: string; name: string; displayOrder: number };
type Product = { id: string; name: string; active: boolean };
type LeadSource = { id: string; name: string; costPerLead: number };
type TrackerEntry = { agent: string; salesCount: number; premiumTotal: number };

const INP: React.CSSProperties = { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: "100%", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };
const CARD: React.CSSProperties = { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16 };

function tabBtn(active: boolean): React.CSSProperties {
  return { padding: "8px 18px", border: "none", background: "transparent", cursor: "pointer", borderBottom: active ? "2px solid #2563eb" : "2px solid transparent", fontWeight: active ? 700 : 400, color: active ? "#2563eb" : "#6b7280", fontSize: 14 };
}

export default function ManagerDashboard() {
  const [tab, setTab] = useState<Tab>("sales");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [tracker, setTracker] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ saleDate: new Date().toISOString().slice(0, 10), agentId: "", memberName: "", memberId: "", carrier: "", productId: "", premium: "", effectiveDate: "", leadSourceId: "", status: "SUBMITTED", notes: "" });

  useEffect(() => {
    async function init() {
      const o = { credentials: "include" as const };
      const [a, p, ls, tr] = await Promise.all([
        fetch(`${API}/api/agents`, o).then(r => r.ok ? r.json() : []),
        fetch(`${API}/api/products`, o).then(r => r.ok ? r.json() : []),
        fetch(`${API}/api/lead-sources`, o).then(r => r.ok ? r.json() : []),
        fetch(`${API}/api/tracker/summary`, o).then(r => r.ok ? r.json() : []),
      ]);
      setAgents(a); setProducts(p); setLeadSources(ls); setTracker(tr);
      setForm(f => ({ ...f, agentId: a[0]?.id ?? "", productId: p[0]?.id ?? "", leadSourceId: ls[0]?.id ?? "" }));
      setLoading(false);
    }
    init();
  }, []);

  async function submitSale(e: FormEvent) {
    e.preventDefault(); setMsg("");
    const res = await fetch(`${API}/api/sales`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...form, premium: Number(form.premium) }) });
    if (res.ok) {
      setMsg("Sale submitted successfully");
      setForm(f => ({ ...f, memberName: "", memberId: "", carrier: "", premium: "", effectiveDate: "", notes: "" }));
      fetch(`${API}/api/tracker/summary`, { credentials: "include" }).then(r => r.json()).then(setTracker);
    } else {
      const err = await res.json().catch(() => ({}));
      setMsg(`Error: ${err.error ?? "Submission failed"}`);
    }
  }

  if (loading) return <PageShell title="Manager Dashboard"><p style={{ color: "#6b7280" }}>Loading…</p></PageShell>;

  return (
    <PageShell title="Manager Dashboard">
      <nav style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 24 }}>
        {(["sales", "tracker", "audits", "config"] as Tab[]).map(t => (
          <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>
            {{ sales: "Sales Entry", tracker: "Agent Tracker", audits: "Call Audits", config: "Config" }[t]}
          </button>
        ))}
      </nav>

      {tab === "sales" && (
        <form onSubmit={submitSale} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 820 }}>
          <div><label style={LBL}>Sale Date</label><input style={INP} type="date" value={form.saleDate} required onChange={e => setForm(f => ({ ...f, saleDate: e.target.value }))} /></div>
          <div><label style={LBL}>Agent</label><select style={INP} value={form.agentId} onChange={e => setForm(f => ({ ...f, agentId: e.target.value }))}>{agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          <div><label style={LBL}>Member Name</label><input style={INP} value={form.memberName} required onChange={e => setForm(f => ({ ...f, memberName: e.target.value }))} /></div>
          <div><label style={LBL}>Member ID <span style={{ color: "#9ca3af", fontWeight: 400 }}>(optional)</span></label><input style={INP} value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))} /></div>
          <div><label style={LBL}>Carrier</label><input style={INP} value={form.carrier} required onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} /></div>
          <div><label style={LBL}>Product</label><select style={INP} value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div><label style={LBL}>Premium ($)</label><input style={INP} type="number" step="0.01" min="0" value={form.premium} required onChange={e => setForm(f => ({ ...f, premium: e.target.value }))} /></div>
          <div><label style={LBL}>Effective Date</label><input style={INP} type="date" value={form.effectiveDate} required onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} /></div>
          <div><label style={LBL}>Lead Source</label><select style={INP} value={form.leadSourceId} onChange={e => setForm(f => ({ ...f, leadSourceId: e.target.value }))}>{leadSources.map(ls => <option key={ls.id} value={ls.id}>{ls.name}</option>)}</select></div>
          <div><label style={LBL}>Status</label><select style={INP} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>{["SUBMITTED","APPROVED","REJECTED","CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
          <div style={{ gridColumn: "1/-1" }}><label style={LBL}>Notes</label><textarea style={{ ...INP, height: 72, resize: "vertical" } as React.CSSProperties} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 16 }}>
            <button type="submit" style={{ padding: "10px 28px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>Submit Sale</button>
            {msg && <span style={{ color: msg.startsWith("Sale") ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{msg}</span>}
          </div>
        </form>
      )}

      {tab === "tracker" && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <thead><tr style={{ background: "#f3f4f6" }}>
            <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Rank</th>
            <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Agent</th>
            <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Total Sales</th>
            <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Premium Total</th>
          </tr></thead>
          <tbody>
            {[...tracker].sort((a, b) => b.salesCount - a.salesCount).map((row, i) => (
              <tr key={row.agent} style={{ borderTop: "1px solid #e5e7eb", background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                <td style={{ padding: "10px 16px", color: "#6b7280", fontWeight: 600 }}>#{i + 1}</td>
                <td style={{ padding: "10px 16px", fontWeight: 600 }}>{row.agent}</td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>{row.salesCount}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>${Number(row.premiumTotal).toFixed(2)}</td>
              </tr>
            ))}
            {tracker.length === 0 && <tr><td colSpan={4} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No sales data yet</td></tr>}
          </tbody>
        </table>
      )}

      {tab === "audits" && <div style={CARD}><p style={{ color: "#6b7280", margin: 0 }}>Call audit records will appear here once added via the API.</p></div>}

      {tab === "config" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div style={CARD}><h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Agents ({agents.length})</h3>{agents.map(a => <div key={a.id} style={{ padding: "6px 0", borderBottom: "1px solid #f3f4f6", fontSize: 14 }}>{a.name}</div>)}</div>
          <div style={CARD}><h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Products ({products.length})</h3>{products.map(p => <div key={p.id} style={{ padding: "6px 0", borderBottom: "1px solid #f3f4f6", fontSize: 14 }}>{p.name}{!p.active && <span style={{ color: "#9ca3af" }}> (inactive)</span>}</div>)}</div>
          <div style={CARD}><h3 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700 }}>Lead Sources ({leadSources.length})</h3>{leadSources.map(ls => <div key={ls.id} style={{ padding: "6px 0", borderBottom: "1px solid #f3f4f6", fontSize: 14 }}>{ls.name} <span style={{ color: "#6b7280" }}>${ls.costPerLead}/lead</span></div>)}</div>
        </div>
      )}
    </PageShell>
  );
}
