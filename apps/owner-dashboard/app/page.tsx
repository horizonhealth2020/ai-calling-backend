"use client";
import { useState, useEffect, useCallback, FormEvent } from "react";
import { PageShell } from "@ops/ui";

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

const INP: React.CSSProperties = { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: "100%", boxSizing: "border-box" };
const LBL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };
const BTN = (color = "#2563eb"): React.CSSProperties => ({ padding: "8px 18px", background: color, color: "white", border: "none", borderRadius: 6, fontWeight: 700, cursor: "pointer", fontSize: 13 });

function tabBtn(active: boolean): React.CSSProperties {
  return { padding: "8px 18px", border: "none", background: "transparent", cursor: "pointer", borderBottom: active ? "2px solid #2563eb" : "2px solid transparent", fontWeight: active ? 700 : 400, color: active ? "#2563eb" : "#6b7280", fontSize: 14 };
}

function StatCard({ label, value, color = "#111827" }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", marginBottom: 24 }}>
      {RANGE_LABELS.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          style={{
            padding: "8px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            border: "none",
            background: value === r.value ? "#111827" : "white",
            color: value === r.value ? "white" : "#374151",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = { SUPER_ADMIN: "#7c3aed", MANAGER: "#2563eb", OWNER_VIEW: "#16a34a", PAYROLL: "#d97706", SERVICE: "#6b7280", ADMIN: "#0891b2" };

function RoleBadge({ role }: { role: string }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: ROLE_COLORS[role] ?? "#6b7280", color: "white", marginRight: 4, display: "inline-block" }}>{role}</span>;
}

function RoleCheckboxes({ selected, onChange }: { selected: string[]; onChange: (roles: string[]) => void }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {ROLES.map(r => {
        const checked = selected.includes(r);
        return (
          <label key={r} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 13, padding: "4px 10px", borderRadius: 6, border: `1px solid ${checked ? ROLE_COLORS[r] : "#d1d5db"}`, background: checked ? ROLE_COLORS[r] + "18" : "white" }}>
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked ? [...selected, r] : selected.filter(x => x !== r))} style={{ accentColor: ROLE_COLORS[r] }} />
            <span style={{ fontWeight: checked ? 700 : 400, color: checked ? ROLE_COLORS[r] : "#374151" }}>{r}</span>
          </label>
        );
      })}
    </div>
  );
}

function UserRow({ user, onSave }: { user: User; onSave: (id: string, data: Partial<User> & { password?: string }) => Promise<string | null> }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ name: user.name, email: user.email, roles: user.roles, active: user.active, password: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  if (!edit) return (
    <tr style={{ borderTop: "1px solid #e5e7eb" }}>
      <td style={{ padding: "10px 16px", fontWeight: 600 }}>{user.name}</td>
      <td style={{ padding: "10px 16px", color: "#6b7280", fontSize: 13 }}>{user.email}</td>
      <td style={{ padding: "10px 16px" }}>{user.roles.map(r => <RoleBadge key={r} role={r} />)}</td>
      <td style={{ padding: "10px 16px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: user.active ? "#16a34a" : "#9ca3af" }}>{user.active ? "Active" : "Inactive"}</span>
      </td>
      <td style={{ padding: "10px 16px" }}>
        <button onClick={() => setEdit(true)} style={{ padding: "4px 10px", fontSize: 12, border: "1px solid #d1d5db", borderRadius: 4, background: "white", cursor: "pointer" }}>Edit</button>
      </td>
    </tr>
  );

  return (
    <tr style={{ borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
      <td colSpan={5} style={{ padding: "12px 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div><label style={LBL}>Name</label><input style={INP} value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} /></div>
          <div><label style={LBL}>Email</label><input style={INP} value={d.email} onChange={e => setD(x => ({ ...x, email: e.target.value }))} /></div>
          <div><label style={LBL}>New Password <span style={{ fontWeight: 400, color: "#9ca3af" }}>(leave blank to keep)</span></label><input style={INP} type="password" placeholder="••••••••" value={d.password} onChange={e => setD(x => ({ ...x, password: e.target.value }))} /></div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Roles</label>
          <RoleCheckboxes selected={d.roles} onChange={roles => setD(x => ({ ...x, roles }))} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={LBL}>Status</label>
          <select style={{ ...INP, width: "auto" }} value={String(d.active)} onChange={e => setD(x => ({ ...x, active: e.target.value === "true" }))}>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
        {err && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 8 }}>{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button style={BTN()} disabled={saving || d.roles.length === 0} onClick={async () => {
            setSaving(true); setErr("");
            const payload: any = { name: d.name, email: d.email, roles: d.roles, active: d.active };
            if (d.password) payload.password = d.password;
            const e = await onSave(user.id, payload);
            if (e) { setErr(e); setSaving(false); } else setEdit(false);
          }}>Save</button>
          <button onClick={() => { setEdit(false); setErr(""); }} style={{ padding: "8px 14px", border: "1px solid #d1d5db", borderRadius: 6, background: "white", cursor: "pointer", fontSize: 13 }}>Cancel</button>
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

  // Users state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", roles: ["MANAGER"] as string[] });
  const [createMsg, setCreateMsg] = useState("");

  const fetchData = useCallback((r: Range) => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/owner/summary?range=${r}`, { credentials: "include" }).then(res => res.ok ? res.json() : null),
      fetch(`${API}/api/tracker/summary?range=${r}`, { credentials: "include" }).then(res => res.ok ? res.json() : []),
      fetch(`${API}/api/session/me`, { credentials: "include" }).then(res => res.ok ? res.json() : null),
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
      fetch(`${API}/api/users`, { credentials: "include" })
        .then(r => r.ok ? r.json() : [])
        .then(u => { setUsers(u); setUsersLoaded(true); });
    }
  }, [tab, isSuperAdmin, usersLoaded]);

  async function saveUser(id: string, data: Partial<User> & { password?: string }): Promise<string | null> {
    const res = await fetch(`${API}/api/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
    if (res.ok) { const u = await res.json(); setUsers(prev => prev.map(x => x.id === id ? u : x)); return null; }
    const err = await res.json().catch(() => ({}));
    return err.error ?? "Failed to save";
  }

  async function createUser(e: FormEvent) {
    e.preventDefault(); setCreateMsg("");
    const res = await fetch(`${API}/api/users`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(newUser) });
    if (res.ok) {
      const u = await res.json();
      setUsers(prev => [u, ...prev]);
      setNewUser({ name: "", email: "", password: "", roles: ["MANAGER"] });
      setCreateMsg("User created successfully");
    } else {
      const err = await res.json().catch(() => ({}));
      setCreateMsg(err.error ?? "Failed to create user");
    }
  }

  const rangeSubtitle = range === "today" ? "Today" : range === "week" ? "Sun – Sat" : "Rolling 30 days";

  if (loading) return <PageShell title="Owner Dashboard"><p style={{ color: "#6b7280" }}>Loading…</p></PageShell>;

  return (
    <PageShell title="Owner Dashboard">
      <nav style={{ display: "flex", borderBottom: "1px solid #e5e7eb", marginBottom: 24 }}>
        <button style={tabBtn(tab === "overview")} onClick={() => setTab("overview")}>Overview</button>
        {isSuperAdmin && <button style={tabBtn(tab === "users")} onClick={() => setTab("users")}>User Management</button>}
      </nav>

      {/* ── Overview ── */}
      {tab === "overview" && <>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <RangeToggle value={range} onChange={setRange} />
          <span style={{ fontSize: 13, color: "#6b7280" }}>{rangeSubtitle}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 32 }}>
          <StatCard label="Total Sales" value={summary?.salesCount ?? "—"} />
          <StatCard label="Premium Total" value={fmt.format(Number(summary?.premiumTotal ?? 0))} color="#16a34a" />
          <StatCard label="Chargebacks" value={summary?.clawbacks ?? "—"} color="#dc2626" />
          <StatCard label="Open Payroll Periods" value={summary?.openPayrollPeriods ?? "—"} color="#d97706" />
        </div>

        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "#111827" }}>Agent Performance</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          <thead><tr style={{ background: "#f3f4f6" }}>
            <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Rank</th>
            <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Agent</th>
            <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Sales</th>
            <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Premium Total</th>
            <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Avg Premium</th>
            <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Cost per Sale</th>
          </tr></thead>
          <tbody>
            {[...tracker].sort((a, b) => b.premiumTotal - a.premiumTotal).map((row, i) => (
              <tr key={row.agent} style={{ borderTop: "1px solid #e5e7eb", background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                <td style={{ padding: "10px 16px", color: "#6b7280", fontWeight: 600 }}>#{i + 1}</td>
                <td style={{ padding: "10px 16px", fontWeight: 600 }}>{row.agent}</td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>{row.salesCount}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>{fmt.format(Number(row.premiumTotal))}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "#6b7280" }}>{row.salesCount > 0 ? fmt.format(Number(row.premiumTotal) / row.salesCount) : "—"}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "#d97706", fontWeight: 600 }}>{row.costPerSale > 0 ? fmt.format(row.costPerSale) : "—"}</td>
              </tr>
            ))}
            {tracker.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No agent data yet</td></tr>}
          </tbody>
        </table>
      </>}

      {/* ── User Management (SUPER_ADMIN only) ── */}
      {tab === "users" && isSuperAdmin && (
        <div>
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: 20, marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>Create User</h3>
            <form onSubmit={createUser}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div><label style={LBL}>Name</label><input style={INP} required value={newUser.name} onChange={e => setNewUser(x => ({ ...x, name: e.target.value }))} /></div>
                <div><label style={LBL}>Email</label><input style={INP} type="email" required value={newUser.email} onChange={e => setNewUser(x => ({ ...x, email: e.target.value }))} /></div>
                <div><label style={LBL}>Password (min 8 chars)</label><input style={INP} type="password" required minLength={8} value={newUser.password} onChange={e => setNewUser(x => ({ ...x, password: e.target.value }))} /></div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={LBL}>Roles</label>
                <RoleCheckboxes selected={newUser.roles} onChange={roles => setNewUser(x => ({ ...x, roles }))} />
              </div>
              <button type="submit" disabled={newUser.roles.length === 0} style={{ ...BTN("#059669"), opacity: newUser.roles.length === 0 ? 0.5 : 1 }}>Create User</button>
              {createMsg && <p style={{ margin: "10px 0 0", fontSize: 13, fontWeight: 600, color: createMsg.includes("success") ? "#16a34a" : "#dc2626" }}>{createMsg}</p>}
            </form>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            <thead><tr style={{ background: "#f3f4f6" }}>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Name</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Email</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Roles</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Status</th>
              <th style={{ padding: "10px 16px" }}></th>
            </tr></thead>
            <tbody>
              {users.map(u => <UserRow key={u.id} user={u} onSave={saveUser} />)}
              {users.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No users found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
