"use client";
import { useState, useEffect, FormEvent } from "react";
import { PageShell } from "@ops/ui";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

type Tab = "sales" | "tracker" | "agent-sales" | "audits" | "config";
type Agent = { id: string; name: string; email?: string; userId?: string; extension?: string; displayOrder: number };
type Product = { id: string; name: string; active: boolean };
type LeadSource = { id: string; name: string; listId?: string; costPerLead: number };
type TrackerEntry = { agent: string; salesCount: number; premiumTotal: number; totalLeadCost: number; costPerSale: number };
type Sale = { id: string; saleDate: string; memberName: string; memberId?: string; carrier: string; premium: number; status: string; notes?: string; agent: { id: string; name: string }; product: { id: string; name: string }; leadSource: { id: string; name: string } };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const INP: React.CSSProperties = { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: "100%", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };
const CARD: React.CSSProperties = { background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20 };
const BTN = (color = "#2563eb"): React.CSSProperties => ({ padding: "8px 18px", background: color, color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 });

function tabBtn(active: boolean): React.CSSProperties {
  return { padding: "8px 18px", border: "none", background: "transparent", cursor: "pointer", borderBottom: active ? "2px solid #2563eb" : "2px solid transparent", fontWeight: active ? 700 : 400, color: active ? "#2563eb" : "#6b7280", fontSize: 14 };
}

// ── Receipt parser ──────────────────────────────────────────────────
function parseReceipt(text: string) {
  const t = text.replace(/\r?\n/g, " ").replace(/\s+/g, " ");
  const out: Record<string, string> = {};

  // MemberID + Name: "MemberID: 686724349 Marc Fahrlander 812 S …"
  const mid = t.match(/MemberID:\s*(\d+)\s+((?:[A-Z][a-zA-Z'-]+\s+){1,3}[A-Z][a-zA-Z'-]+)/);
  if (mid) { out.memberId = mid[1]; out.memberName = mid[2].trim(); }

  // Status: "SALE on March 9, 2026 - Approved"
  const st = t.match(/SALE on .+?[-–]\s*(Approved|Rejected|Cancelled|Submitted)/i);
  if (st) out.status = st[1].toUpperCase();

  // Date: "Date:03/09/2026"
  const dt = t.match(/Date:(\d{2})\/(\d{2})\/(\d{4})/);
  if (dt) out.saleDate = `${dt[3]}-${dt[1]}-${dt[2]}`;

  // Amount: "Amount:$436.43"
  const am = t.match(/Amount:\$?([\d,]+\.?\d*)/);
  if (am) out.premium = am[1].replace(/,/g, "");

  // First product / carrier: text between "Products" and " - Plan"/" Member"/" - Add"
  const pr = t.match(/Products([A-Za-z][^$\d]{3,50?)(?:\s*[-–]\s*Plan|\s+Member\s+-|\s*[-–]\s*Add-on)/);
  if (pr) out.carrier = pr[1].trim();

  return out;
}

// ── Editable row components ─────────────────────────────────────────
function AgentRow({ agent, onSave }: { agent: Agent; onSave: (id: string, data: Partial<Agent>) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ name: agent.name, email: agent.email ?? "", extension: agent.extension ?? "" });
  const [saving, setSaving] = useState(false);
  if (!edit) return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{agent.name}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {agent.email ? `CRM User ID: ${agent.email}` : ""}
          {agent.email && agent.extension ? " · " : ""}
          {agent.extension ? `Tracking: ${agent.extension}` : ""}
        </div>
      </div>
      <button onClick={() => setEdit(true)} style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, background: "white", cursor: "pointer" }}>Edit</button>
    </div>
  );
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6", display: "grid", gap: 8 }}>
      <input style={INP} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
      <input style={INP} value={d.email} placeholder="CRM User ID" onChange={e => setD(x => ({ ...x, email: e.target.value }))} />
      <input style={INP} value={d.extension} placeholder="Tracking Extension" onChange={e => setD(x => ({ ...x, extension: e.target.value }))} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={BTN()} disabled={saving} onClick={async () => { setSaving(true); await onSave(agent.id, d); setEdit(false); setSaving(false); }}>Save</button>
        <button onClick={() => setEdit(false)} style={{ padding: "8px 14px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 13 }}>Cancel</button>
      </div>
    </div>
  );
}

function LeadSourceRow({ ls, onSave }: { ls: LeadSource; onSave: (id: string, data: Partial<LeadSource>) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ name: ls.name, listId: ls.listId ?? "", costPerLead: String(ls.costPerLead) });
  const [saving, setSaving] = useState(false);
  if (!edit) return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{ls.name}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>${ls.costPerLead}/lead{ls.listId ? ` · List: ${ls.listId}` : ""}</div>
      </div>
      <button onClick={() => setEdit(true)} style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, background: "white", cursor: "pointer" }}>Edit</button>
    </div>
  );
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6", display: "grid", gap: 8 }}>
      <input style={INP} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
      <input style={INP} value={d.listId} placeholder="CRM List ID" onChange={e => setD(x => ({ ...x, listId: e.target.value }))} />
      <input style={{ ...INP, width: "50%" }} type="number" step="0.01" value={d.costPerLead} placeholder="Cost per lead" onChange={e => setD(x => ({ ...x, costPerLead: e.target.value }))} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={BTN()} disabled={saving} onClick={async () => { setSaving(true); await onSave(ls.id, { ...d, costPerLead: Number(d.costPerLead) }); setEdit(false); setSaving(false); }}>Save</button>
        <button onClick={() => setEdit(false)} style={{ padding: "8px 14px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 13 }}>Cancel</button>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const [tab, setTab] = useState<Tab>("sales");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [tracker, setTracker] = useState<TrackerEntry[]>([]);
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [salesDay, setSalesDay] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Sales form
  const blankForm = () => ({ saleDate: new Date().toISOString().slice(0, 10), agentId: "", memberName: "", memberId: "", carrier: "", productId: "", premium: "", effectiveDate: "", leadSourceId: "", status: "SUBMITTED", notes: "" });
  const [form, setForm] = useState(blankForm());
  const [receipt, setReceipt] = useState("");
  const [parsed, setParsed] = useState(false);

  // Config new-item forms
  const [newAgent, setNewAgent] = useState({ name: "", email: "", extension: "" });
  const [newLS, setNewLS] = useState({ name: "", listId: "", costPerLead: "" });
  const [cfgMsg, setCfgMsg] = useState("");

  useEffect(() => {
    const o = { credentials: "include" as const };
    Promise.all([
      fetch(`${API}/api/agents`, o).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/products`, o).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/lead-sources`, o).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/tracker/summary`, o).then(r => r.ok ? r.json() : []),
      fetch(`${API}/api/sales?range=week`, o).then(r => r.ok ? r.json() : []),
    ]).then(([a, p, ls, tr, sl]) => {
      setAgents(a); setProducts(p); setLeadSources(ls); setTracker(tr); setSalesList(sl);
      setForm(f => ({ ...f, agentId: a[0]?.id ?? "", productId: p[0]?.id ?? "", leadSourceId: ls[0]?.id ?? "" }));
      setLoading(false);
    });
  }, []);

  function handleParse() {
    if (!receipt.trim()) return;
    const p = parseReceipt(receipt);
    setForm(f => ({ ...f, ...p }));
    setParsed(true);
  }

  function clearReceipt() {
    setReceipt("");
    setParsed(false);
    setForm(f => ({ ...blankForm(), agentId: f.agentId, productId: f.productId, leadSourceId: f.leadSourceId }));
  }

  async function submitSale(e: FormEvent) {
    e.preventDefault(); setMsg("");
    const res = await fetch(`${API}/api/sales`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...form, premium: Number(form.premium) }) });
    if (res.ok) {
      setMsg("Sale submitted successfully");
      clearReceipt();
      fetch(`${API}/api/tracker/summary`, { credentials: "include" }).then(r => r.json()).then(setTracker);
      fetch(`${API}/api/sales?range=week`, { credentials: "include" }).then(r => r.json()).then(setSalesList);
    } else {
      const err = await res.json().catch(() => ({}));
      setMsg(`Error: ${err.error ?? "Submission failed"}`);
    }
  }

  async function saveAgent(id: string, data: Partial<Agent>) {
    const res = await fetch(`${API}/api/agents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
    if (res.ok) setAgents(prev => prev.map(a => a.id === id ? { ...a, ...data } : a));
  }

  async function addAgent(e: FormEvent) {
    e.preventDefault(); setCfgMsg("");
    const res = await fetch(`${API}/api/agents`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...newAgent, costPerLead: undefined }) });
    if (res.ok) { const a = await res.json(); setAgents(prev => [...prev, a]); setNewAgent({ name: "", email: "", extension: "" }); setCfgMsg("Agent added"); }
    else setCfgMsg("Error adding agent");
  }

  async function saveLeadSource(id: string, data: Partial<LeadSource>) {
    const res = await fetch(`${API}/api/lead-sources/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
    if (res.ok) setLeadSources(prev => prev.map(ls => ls.id === id ? { ...ls, ...data } : ls));
  }

  async function addLeadSource(e: FormEvent) {
    e.preventDefault(); setCfgMsg("");
    const res = await fetch(`${API}/api/lead-sources`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ ...newLS, costPerLead: Number(newLS.costPerLead) || 0 }) });
    if (res.ok) { const ls = await res.json(); setLeadSources(prev => [...prev, ls]); setNewLS({ name: "", listId: "", costPerLead: "" }); setCfgMsg("Lead source added"); }
    else setCfgMsg("Error adding lead source");
  }

  if (loading) return <PageShell title="Manager Dashboard"><p style={{ color: "#6b7280" }}>Loading…</p></PageShell>;

  return (
    <PageShell title="Manager Dashboard">
      <nav style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 24 }}>
        {(["sales", "tracker", "agent-sales", "audits", "config"] as Tab[]).map(t => (
          <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>
            {{ sales: "Sales Entry", tracker: "Agent Tracker", "agent-sales": "Agent Sales", audits: "Call Audits", config: "Config" }[t]}
          </button>
        ))}
      </nav>

      {/* ── Sales Entry ── */}
      {tab === "sales" && (
        <form onSubmit={submitSale} style={{ maxWidth: 860 }}>
          {/* Step 1: Agent + Receipt */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={LBL}>Agent</label>
              <select style={{ ...INP, height: 42 }} value={form.agentId} onChange={e => setForm(f => ({ ...f, agentId: e.target.value }))}>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Paste Sale Receipt</label>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <textarea
                  style={{ ...INP, height: 80, resize: "vertical", fontFamily: "monospace", fontSize: 12 } as React.CSSProperties}
                  value={receipt}
                  placeholder={"MemberID: 686724349 Marc Fahrlander…\nSALE on March 9, 2026 - Approved\nDate:03/09/2026…Amount:$436.43…"}
                  onChange={e => { setReceipt(e.target.value); setParsed(false); }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={handleParse} style={BTN("#059669")}>Parse</button>
                  <button type="button" onClick={clearReceipt} style={{ padding: "8px 14px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 13 }}>Clear</button>
                </div>
              </div>
              {parsed && <p style={{ margin: "4px 0 0", fontSize: 12, color: "#059669", fontWeight: 600 }}>✓ Receipt parsed — review fields below</p>}
            </div>
          </div>

          {/* Step 2: Parsed + remaining fields */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label style={LBL}>Member Name</label>
              <input style={INP} value={form.memberName} required onChange={e => setForm(f => ({ ...f, memberName: e.target.value }))} />
            </div>
            <div>
              <label style={LBL}>Member ID</label>
              <input style={INP} value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))} />
            </div>
            <div>
              <label style={LBL}>Sale Date</label>
              <input style={INP} type="date" value={form.saleDate} required onChange={e => setForm(f => ({ ...f, saleDate: e.target.value }))} />
            </div>
            <div>
              <label style={LBL}>Status</label>
              <select style={INP} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {["SUBMITTED","APPROVED","REJECTED","CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Carrier</label>
              <input style={INP} value={form.carrier} required onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} />
            </div>
            <div>
              <label style={LBL}>Premium ($)</label>
              <input style={INP} type="number" step="0.01" min="0" value={form.premium} required onChange={e => setForm(f => ({ ...f, premium: e.target.value }))} />
            </div>
            <div>
              <label style={LBL}>Effective Date</label>
              <input style={INP} type="date" value={form.effectiveDate} required onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} />
            </div>
            <div>
              <label style={LBL}>Product</label>
              <select style={INP} value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Lead Source</label>
              <select style={INP} value={form.leadSourceId} onChange={e => setForm(f => ({ ...f, leadSourceId: e.target.value }))}>
                {leadSources.map(ls => <option key={ls.id} value={ls.id}>{ls.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Notes</label>
              <input style={INP} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 16, paddingTop: 4 }}>
              <button type="submit" style={BTN()}>Submit Sale</button>
              {msg && <span style={{ color: msg.startsWith("Sale") ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{msg}</span>}
            </div>
          </div>
        </form>
      )}

      {/* ── Agent Tracker ── */}
      {tab === "tracker" && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <thead><tr style={{ background: "#f3f4f6" }}>
            <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Rank</th>
            <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Agent</th>
            <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Total Sales</th>
            <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Premium Total</th>
            <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Cost per Sale</th>
          </tr></thead>
          <tbody>
            {[...tracker].sort((a, b) => b.salesCount - a.salesCount).map((row, i) => (
              <tr key={row.agent} style={{ borderTop: "1px solid #e5e7eb", background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                <td style={{ padding: "10px 16px", color: "#6b7280", fontWeight: 600 }}>#{i + 1}</td>
                <td style={{ padding: "10px 16px", fontWeight: 600 }}>{row.agent}</td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>{row.salesCount}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>${Number(row.premiumTotal).toFixed(2)}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "#d97706", fontWeight: 600 }}>{row.costPerSale > 0 ? `$${Number(row.costPerSale).toFixed(2)}` : "—"}</td>
              </tr>
            ))}
            {tracker.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No sales data yet</td></tr>}
          </tbody>
        </table>
      )}

      {/* ── Agent Sales ── */}
      {tab === "agent-sales" && (() => {
        const getDayOfWeek = (dateStr: string) => {
          const d = new Date(dateStr + "T12:00:00");
          const jsDay = d.getDay(); // 0=Sun
          return jsDay === 0 ? 6 : jsDay - 1; // convert to 0=Mon..6=Sun
        };
        const filtered = salesDay === "all"
          ? salesList
          : salesList.filter(s => getDayOfWeek(s.saleDate.slice(0, 10)) === DAYS.indexOf(salesDay as typeof DAYS[number]));

        // Group by agent
        const byAgent = new Map<string, Sale[]>();
        for (const s of filtered) {
          const name = s.agent.name;
          if (!byAgent.has(name)) byAgent.set(name, []);
          byAgent.get(name)!.push(s);
        }

        return (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <button style={{ ...tabBtn(salesDay === "all"), borderBottom: salesDay === "all" ? "2px solid #2563eb" : "2px solid transparent" }} onClick={() => setSalesDay("all")}>All Week</button>
              {DAYS.map(day => (
                <button key={day} style={{ ...tabBtn(salesDay === day), borderBottom: salesDay === day ? "2px solid #2563eb" : "2px solid transparent" }} onClick={() => setSalesDay(day)}>{day}</button>
              ))}
            </div>

            {byAgent.size === 0 && <div style={CARD}><p style={{ color: "#9ca3af", margin: 0 }}>No sales for this period</p></div>}

            {[...byAgent.entries()].map(([agentName, sales]) => (
              <div key={agentName} style={{ ...CARD, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{agentName}</h3>
                  <span style={{ fontSize: 13, color: "#6b7280" }}>{sales.length} sale{sales.length !== 1 ? "s" : ""} · ${sales.reduce((s, x) => s + Number(x.premium), 0).toFixed(2)} premium</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr style={{ background: "#f9fafb" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Date</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Member</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Carrier</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Product</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600 }}>Lead Source</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600 }}>Premium</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", fontWeight: 600 }}>Status</th>
                  </tr></thead>
                  <tbody>
                    {sales.map(s => (
                      <tr key={s.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px 12px" }}>{new Date(s.saleDate).toLocaleDateString()}</td>
                        <td style={{ padding: "8px 12px" }}>{s.memberName}{s.memberId ? ` (${s.memberId})` : ""}</td>
                        <td style={{ padding: "8px 12px" }}>{s.carrier}</td>
                        <td style={{ padding: "8px 12px" }}>{s.product.name}</td>
                        <td style={{ padding: "8px 12px" }}>{s.leadSource.name}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "#16a34a" }}>${Number(s.premium).toFixed(2)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "center" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 9999, fontSize: 11, fontWeight: 600, background: s.status === "APPROVED" ? "#dcfce7" : s.status === "REJECTED" ? "#fee2e2" : s.status === "CANCELLED" ? "#f3f4f6" : "#fef9c3", color: s.status === "APPROVED" ? "#166534" : s.status === "REJECTED" ? "#991b1b" : s.status === "CANCELLED" ? "#6b7280" : "#854d0e" }}>{s.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Call Audits ── */}
      {tab === "audits" && <div style={CARD}><p style={{ color: "#6b7280", margin: 0 }}>Call audit records will appear here once added via the API.</p></div>}

      {/* ── Config ── */}
      {tab === "config" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

          {/* Agents */}
          <div style={CARD}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Agents</h3>
            {agents.map(a => <AgentRow key={a.id} agent={a} onSave={saveAgent} />)}
            <form onSubmit={addAgent} style={{ marginTop: 16, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Add Agent</div>
              <input style={INP} value={newAgent.name} placeholder="Name *" required onChange={e => setNewAgent(x => ({ ...x, name: e.target.value }))} />
              <input style={INP} value={newAgent.email} placeholder="CRM User ID" onChange={e => setNewAgent(x => ({ ...x, email: e.target.value }))} />
              <input style={INP} value={newAgent.extension} placeholder="Tracking Extension" onChange={e => setNewAgent(x => ({ ...x, extension: e.target.value }))} />
              <button type="submit" style={BTN("#059669")}>Add Agent</button>
            </form>
          </div>

          {/* Lead Sources */}
          <div style={CARD}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Lead Sources</h3>
            {leadSources.map(ls => <LeadSourceRow key={ls.id} ls={ls} onSave={saveLeadSource} />)}
            <form onSubmit={addLeadSource} style={{ marginTop: 16, display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Add Lead Source</div>
              <input style={INP} value={newLS.name} placeholder="Name *" required onChange={e => setNewLS(x => ({ ...x, name: e.target.value }))} />
              <input style={INP} value={newLS.listId} placeholder="CRM List ID" onChange={e => setNewLS(x => ({ ...x, listId: e.target.value }))} />
              <input style={{ ...INP, width: "60%" }} type="number" step="0.01" value={newLS.costPerLead} placeholder="Cost per lead ($)" onChange={e => setNewLS(x => ({ ...x, costPerLead: e.target.value }))} />
              <button type="submit" style={BTN("#059669")}>Add Lead Source</button>
            </form>
          </div>

          {cfgMsg && <div style={{ gridColumn: "1/-1", color: cfgMsg.startsWith("Error") ? "#dc2626" : "#16a34a", fontWeight: 600, fontSize: 14 }}>{cfgMsg}</div>}
        </div>
      )}
    </PageShell>
  );
}
