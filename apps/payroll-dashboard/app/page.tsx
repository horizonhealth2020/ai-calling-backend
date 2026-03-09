"use client";
import { useState, useEffect, FormEvent } from "react";
import { PageShell } from "@ops/ui";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";
type Tab = "periods" | "clawbacks" | "exports";
type Entry = { id: string; payoutAmount: number; netAmount: number; status: string };
type Period = { id: string; weekStart: string; weekEnd: string; quarterLabel: string; status: string; entries: Entry[] };
const STATUS_COLORS: Record<string, string> = { OPEN: "#2563eb", LOCKED: "#d97706", FINALIZED: "#16a34a" };
const INP: React.CSSProperties = { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: "100%", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };
function tabBtn(active: boolean): React.CSSProperties {
  return { padding: "8px 18px", border: "none", background: "transparent", cursor: "pointer", borderBottom: active ? "2px solid #2563eb" : "2px solid transparent", fontWeight: active ? 700 : 400, color: active ? "#2563eb" : "#6b7280", fontSize: 14 };
}

export default function PayrollDashboard() {
  const [tab, setTab] = useState<Tab>("periods");
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [clawbackForm, setClawbackForm] = useState({ memberName: "", memberId: "", notes: "" });
  const [clawbackMsg, setClawbackMsg] = useState("");

  useEffect(() => {
    fetch(`${API}/api/payroll/periods`, { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setPeriods(d); setLoading(false); });
  }, []);

  async function submitClawback(e: FormEvent) {
    e.preventDefault(); setClawbackMsg("");
    const body = Object.fromEntries(Object.entries(clawbackForm).filter(([, v]) => v));
    const res = await fetch(`${API}/api/clawbacks`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    if (res.ok) { setClawbackMsg("Clawback processed successfully"); setClawbackForm({ memberName: "", memberId: "", notes: "" }); }
    else { const err = await res.json().catch(() => ({})); setClawbackMsg(`Error: ${err.error ?? "No matching sale found"}`); }
  }

  function exportCSV() {
    const rows = [["Week Start","Week End","Quarter","Status","Entries","Gross","Net"]];
    periods.forEach(p => {
      const gross = p.entries.reduce((s, e) => s + Number(e.payoutAmount), 0);
      const net = p.entries.reduce((s, e) => s + Number(e.netAmount), 0);
      rows.push([p.weekStart, p.weekEnd, p.quarterLabel, p.status, String(p.entries.length), gross.toFixed(2), net.toFixed(2)]);
    });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })), download: "payroll.csv" });
    a.click();
  }

  if (loading) return <PageShell title="Payroll Dashboard"><p style={{ color: "#6b7280" }}>Loading…</p></PageShell>;

  return (
    <PageShell title="Payroll Dashboard">
      <nav style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 24 }}>
        {(["periods","clawbacks","exports"] as Tab[]).map(t => (
          <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>
            {{ periods: "Payroll Weeks", clawbacks: "Clawbacks", exports: "Exports" }[t]}
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

      {tab === "clawbacks" && (
        <div style={{ maxWidth: 520 }}>
          <p style={{ color: "#6b7280", marginTop: 0, marginBottom: 20 }}>Match by Member ID (preferred) or Member Name to process a clawback.</p>
          <form onSubmit={submitClawback} style={{ display: "grid", gap: 16 }}>
            <div><label style={LBL}>Member ID <span style={{ color: "#9ca3af", fontWeight: 400 }}>(preferred)</span></label><input style={INP} value={clawbackForm.memberId} placeholder="e.g. M-12345" onChange={e => setClawbackForm(f => ({ ...f, memberId: e.target.value }))} /></div>
            <div><label style={LBL}>Member Name <span style={{ color: "#9ca3af", fontWeight: 400 }}>(if no ID)</span></label><input style={INP} value={clawbackForm.memberName} placeholder="e.g. John Doe" onChange={e => setClawbackForm(f => ({ ...f, memberName: e.target.value }))} /></div>
            <div><label style={LBL}>Notes</label><textarea style={{ ...INP, height: 80, resize: "vertical" } as React.CSSProperties} value={clawbackForm.notes} onChange={e => setClawbackForm(f => ({ ...f, notes: e.target.value }))} /></div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <button type="submit" style={{ padding: "10px 24px", background: "#dc2626", color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>Process Clawback</button>
              {clawbackMsg && <span style={{ color: clawbackMsg.startsWith("Clawback") ? "#16a34a" : "#dc2626", fontWeight: 600 }}>{clawbackMsg}</span>}
            </div>
          </form>
        </div>
      )}

      {tab === "exports" && (
        <div style={{ maxWidth: 420 }}>
          <p style={{ color: "#6b7280", marginTop: 0 }}>Download payroll period data as a CSV file.</p>
          <button onClick={exportCSV} style={{ padding: "10px 24px", background: "#2563eb", color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer" }}>Download Payroll CSV</button>
          <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 12 }}>Includes: week range, status, entries, gross and net payout per period.</p>
        </div>
      )}
    </PageShell>
  );
}
