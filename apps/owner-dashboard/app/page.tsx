"use client";
import { useState, useEffect, useCallback, FormEvent } from "react";
import { PageShell } from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";
type Tab = "overview" | "users";
type Range = "today" | "week" | "month";
type Summary = { salesCount: number; premiumTotal: number; clawbacks: number; openPayrollPeriods: number };
type TrackerEntry = { agent: string; salesCount: number; premiumTotal: number; totalLeadCost: number; costPerSale: number };
type User = { id: string; name: string; email: string; roles: string[]; active: boolean; createdAt: string };

const ROLES = ["SUPER_ADMIN", "OWNER_VIEW", "MANAGER", "PAYROLL", "SERVICE", "ADMIN"] as const;
const RANGE_LABELS: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];
const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// ── Dark theme styles ──
const INP: React.CSSProperties = { padding: "10px 14px", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 14, color: "#e2e8f0", width: "100%", boxSizing: "border-box", outline: "none" };
const LBL: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
const BTN = (bg = "#2563eb"): React.CSSProperties => ({ padding: "10px 22px", background: bg, color: "white", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", fontSize: 13 });
const CARD: React.CSSProperties = { background: "rgba(15,23,42,0.8)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: 24 };
const TH: React.CSSProperties = { padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "1px solid rgba(255,255,255,0.06)", textAlign: "left" };
const TD: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)" };

const ROLE_COLORS: Record<string, string> = { SUPER_ADMIN: "#2563eb", MANAGER: "#3b82f6", OWNER_VIEW: "#059669", PAYROLL: "#d97706", SERVICE: "#64748b", ADMIN: "#0891b2" };

function RoleBadge({ role }: { role: string }) {
  const c = ROLE_COLORS[role] ?? "#64748b";
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: c + "20", color: c, marginRight: 4, display: "inline-block", letterSpacing: "0.03em" }}>{role}</span>;
}

function RoleCheckboxes({ selected, onChange }: { selected: string[]; onChange: (roles: string[]) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {ROLES.map(r => {
        const checked = selected.includes(r);
        const c = ROLE_COLORS[r];
        return (
          <label key={r} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 12, padding: "5px 10px", borderRadius: 6, border: `1px solid ${checked ? c + "40" : "rgba(255,255,255,0.06)"}`, background: checked ? c + "15" : "transparent" }}>
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked ? [...selected, r] : selected.filter(x => x !== r))} style={{ accentColor: c }} />
            <span style={{ fontWeight: checked ? 700 : 500, color: checked ? c : "#94a3b8" }}>{r}</span>
          </label>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{ ...CARD, borderLeft: `3px solid ${accent}` }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}

function UserRow({ user, onSave, onDelete }: { user: User; onSave: (id: string, data: Partial<User> & { password?: string }) => Promise<string | null>; onDelete: (id: string) => Promise<string | null> }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ name: user.name, email: user.email, roles: user.roles, active: user.active, password: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  if (!edit) return (
    <tr>
      <td style={{ ...TD, fontWeight: 600, color: "#e2e8f0" }}>{user.name}</td>
      <td style={{ ...TD, color: "#64748b", fontSize: 13 }}>{user.email}</td>
      <td style={TD}>{user.roles.map(r => <RoleBadge key={r} role={r} />)}</td>
      <td style={TD}>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: user.active ? "rgba(34,197,94,0.1)" : "rgba(100,116,139,0.1)", color: user.active ? "#4ade80" : "#64748b" }}>{user.active ? "Active" : "Inactive"}</span>
      </td>
      <td style={{ ...TD, display: "flex", gap: 6 }}>
        <button onClick={() => setEdit(true)} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, background: "transparent", color: "#94a3b8", cursor: "pointer", fontWeight: 600 }}>Edit</button>
        <button onClick={async () => { if (confirm(`Delete user "${user.name}"?`)) { const e = await onDelete(user.id); if (e) alert(e); } }} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, background: "rgba(239,68,68,0.08)", color: "#f87171", cursor: "pointer", fontWeight: 700 }}>Delete</button>
      </td>
    </tr>
  );

  return (
    <tr>
      <td colSpan={5} style={{ ...TD, background: "rgba(15,23,42,0.4)", padding: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div><label style={LBL}>Name</label><input style={INP} value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} /></div>
          <div><label style={LBL}>Email</label><input style={INP} value={d.email} onChange={e => setD(x => ({ ...x, email: e.target.value }))} /></div>
          <div><label style={LBL}>New Password</label><input style={INP} type="password" placeholder="Leave blank to keep" value={d.password} onChange={e => setD(x => ({ ...x, password: e.target.value }))} /></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={LBL}>Roles</label>
          <RoleCheckboxes selected={d.roles} onChange={roles => setD(x => ({ ...x, roles }))} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={LBL}>Status</label>
          <select style={{ ...INP, width: "auto" }} value={String(d.active)} onChange={e => setD(x => ({ ...x, active: e.target.value === "true" }))}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        {err && <div style={{ color: "#f87171", fontSize: 13, marginBottom: 10, padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 6 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ ...BTN(), opacity: saving || d.roles.length === 0 ? 0.4 : 1 }} disabled={saving || d.roles.length === 0} onClick={async () => {
            setSaving(true); setErr("");
            const payload: any = { name: d.name, email: d.email, roles: d.roles, active: d.active };
            if (d.password) payload.password = d.password;
            const e = await onSave(user.id, payload);
            if (e) { setErr(e); setSaving(false); } else setEdit(false);
          }}>Save</button>
          <button onClick={() => { setEdit(false); setErr(""); }} style={{ padding: "10px 18px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, background: "transparent", color: "#94a3b8", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Cancel</button>
        </div>
      </td>
    </tr>
  );
}

export default function OwnerDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<Range>("today");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tracker, setTracker] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", roles: ["MANAGER"] as string[] });
  const [createMsg, setCreateMsg] = useState("");

  useEffect(() => {
    captureTokenFromUrl();
    try {
      const token = localStorage.getItem("ops_session_token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload?.roles?.includes("SUPER_ADMIN")) setIsSuperAdmin(true);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchData = useCallback((r: Range) => {
    setLoading(true);
    Promise.all([
      authFetch(`${API}/api/owner/summary?range=${r}`).then(res => res.ok ? res.json() : null).catch(() => null),
      authFetch(`${API}/api/tracker/summary?range=${r}`).then(res => res.ok ? res.json() : []).catch(() => []),
      authFetch(`${API}/api/session/me`).then(res => res.ok ? res.json() : null).catch(() => null),
    ]).then(([s, t, me]) => {
      setSummary(s);
      setTracker(t);
      if (me?.roles?.includes("SUPER_ADMIN")) setIsSuperAdmin(true);
      setLoading(false);
    });
  }, []);

  useEffect(() => { fetchData(range); }, [range, fetchData]);

  useEffect(() => {
    if (tab === "users" && !usersLoaded && isSuperAdmin) {
      authFetch(`${API}/api/users`)
        .then(r => r.ok ? r.json() : [])
        .then(u => { setUsers(u); setUsersLoaded(true); })
        .catch(() => { setUsers([]); setUsersLoaded(true); });
    }
  }, [tab, isSuperAdmin, usersLoaded]);

  async function saveUser(id: string, data: Partial<User> & { password?: string }): Promise<string | null> {
    try {
      const res = await authFetch(`${API}/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) { const u = await res.json(); setUsers(prev => prev.map(x => x.id === id ? u : x)); return null; }
      const err = await res.json().catch(() => ({}));
      return err.error ?? "Failed to save";
    } catch (e: any) { return `Unable to reach API — ${e.message ?? "network error"}`; }
  }

  async function deleteUser(id: string): Promise<string | null> {
    try {
      const res = await authFetch(`${API}/api/users/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) { setUsers(prev => prev.filter(x => x.id !== id)); return null; }
      const err = await res.json().catch(() => ({}));
      return err.error ?? "Failed to delete user";
    } catch (e: any) { return `Unable to reach API — ${e.message ?? "network error"}`; }
  }

  async function createUser(e: FormEvent) {
    e.preventDefault(); setCreateMsg("");
    try {
      const res = await authFetch(`${API}/api/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newUser) });
      if (res.ok) {
        const u = await res.json();
        setUsers(prev => [u, ...prev]);
        setNewUser({ name: "", email: "", password: "", roles: ["MANAGER"] });
        setCreateMsg("User created successfully");
      } else {
        const err = await res.json().catch(() => ({}));
        setCreateMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) {
      setCreateMsg(`Error: Unable to reach API — ${e.message ?? "network error"}`);
    }
  }

  if (loading) return <PageShell title="Owner Dashboard"><p style={{ color: "#475569" }}>Loading\u2026</p></PageShell>;

  return (
    <PageShell title="Owner Dashboard">
      {/* Tab Nav */}
      <nav style={{ display: "flex", gap: 0, marginBottom: 28, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {([["overview", "Overview"], ...(isSuperAdmin ? [["users", "User Management"]] : [])] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "10px 20px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", background: "transparent",
            color: tab === key ? "#e2e8f0" : "#64748b",
            borderBottom: tab === key ? "2px solid #2563eb" : "2px solid transparent",
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </nav>

      {/* ── Overview ── */}
      {tab === "overview" && <>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 4, background: "rgba(15,23,42,0.4)", borderRadius: 8, padding: 3, border: "1px solid rgba(255,255,255,0.04)" }}>
            {RANGE_LABELS.map(r => (
              <button key={r.value} onClick={() => setRange(r.value)} style={{
                padding: "7px 18px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer", borderRadius: 6,
                background: range === r.value ? "rgba(255,255,255,0.08)" : "transparent",
                color: range === r.value ? "#e2e8f0" : "#475569",
              }}>{r.label}</button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 36 }}>
          <StatCard label="Total Sales" value={summary?.salesCount ?? "\u2014"} accent="#3b82f6" />
          <StatCard label="Premium Total" value={fmt.format(Number(summary?.premiumTotal ?? 0))} accent="#10b981" />
          <StatCard label="Chargebacks" value={summary?.clawbacks ?? "\u2014"} accent="#ef4444" />
          <StatCard label="Open Payroll" value={summary?.openPayrollPeriods ?? "\u2014"} accent="#f59e0b" />
        </div>

        <h2 style={{ fontSize: 13, fontWeight: 600, margin: "0 0 14px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>Agent Performance</h2>
        <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>
              <th style={TH}>Rank</th>
              <th style={TH}>Agent</th>
              <th style={{ ...TH, textAlign: "right" }}>Sales</th>
              <th style={{ ...TH, textAlign: "right" }}>Premium</th>
              <th style={{ ...TH, textAlign: "right" }}>Avg</th>
              <th style={{ ...TH, textAlign: "right" }}>Cost/Sale</th>
            </tr></thead>
            <tbody>
              {[...tracker].sort((a, b) => b.premiumTotal - a.premiumTotal).map((row, i) => (
                <tr key={row.agent} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                  <td style={{ ...TD, fontWeight: 800, color: i < 3 ? "#fbbf24" : "#475569", fontSize: 13 }}>#{i + 1}</td>
                  <td style={{ ...TD, fontWeight: 700, color: "#e2e8f0" }}>{row.agent}</td>
                  <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: "#94a3b8" }}>{row.salesCount}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#34d399", fontWeight: 700 }}>{fmt.format(Number(row.premiumTotal))}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#64748b" }}>{row.salesCount > 0 ? fmt.format(Number(row.premiumTotal) / row.salesCount) : "\u2014"}</td>
                  <td style={{ ...TD, textAlign: "right", color: "#f59e0b", fontWeight: 600 }}>{row.costPerSale > 0 ? fmt.format(row.costPerSale) : "\u2014"}</td>
                </tr>
              ))}
              {tracker.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#334155" }}>No agent data yet</td></tr>}
            </tbody>
          </table>
        </div>
      </>}

      {/* ── User Management ── */}
      {tab === "users" && isSuperAdmin && (
        <div>
          <div style={{ ...CARD, marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>Create User</h3>
            <form onSubmit={createUser}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div><label style={LBL}>Name</label><input style={INP} required value={newUser.name} onChange={e => setNewUser(x => ({ ...x, name: e.target.value }))} /></div>
                <div><label style={LBL}>Email</label><input style={INP} type="email" required value={newUser.email} onChange={e => setNewUser(x => ({ ...x, email: e.target.value }))} /></div>
                <div><label style={LBL}>Password (min 8)</label><input style={INP} type="password" required minLength={8} value={newUser.password} onChange={e => setNewUser(x => ({ ...x, password: e.target.value }))} /></div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={LBL}>Roles</label>
                <RoleCheckboxes selected={newUser.roles} onChange={roles => setNewUser(x => ({ ...x, roles }))} />
              </div>
              <button type="submit" disabled={newUser.roles.length === 0} style={{ ...BTN("#059669"), opacity: newUser.roles.length === 0 ? 0.4 : 1 }}>Create User</button>
              {createMsg && <p style={{ margin: "12px 0 0", fontSize: 13, fontWeight: 700, padding: "8px 12px", borderRadius: 6, background: createMsg.includes("success") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: createMsg.includes("success") ? "#4ade80" : "#f87171" }}>{createMsg}</p>}
            </form>
          </div>

          <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={TH}>Name</th>
                <th style={TH}>Email</th>
                <th style={TH}>Roles</th>
                <th style={TH}>Status</th>
                <th style={TH}></th>
              </tr></thead>
              <tbody>
                {users.map(u => <UserRow key={u.id} user={u} onSave={saveUser} onDelete={deleteUser} />)}
                {users.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#334155" }}>No users found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </PageShell>
  );
}
