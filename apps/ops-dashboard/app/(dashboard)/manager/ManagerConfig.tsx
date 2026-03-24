"use client";
import React, { useState, FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  Input,
  colors,
  spacing,
  radius,
  typography,
  motion,
  baseInputStyle,
  baseLabelStyle,
} from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar } from "@ops/utils";
import {
  Users,
  Filter,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Settings,
} from "lucide-react";

/* -- Types -- */

type Agent = { id: string; name: string; email?: string; userId?: string; extension?: string; displayOrder: number; active?: boolean; auditEnabled?: boolean };
type Product = {
  id: string; name: string; active: boolean; type: "CORE" | "ADDON" | "AD_D";
  premiumThreshold?: number | null; commissionBelow?: number | null; commissionAbove?: number | null;
  bundledCommission?: number | null; standaloneCommission?: number | null; enrollFeeThreshold?: number | null; notes?: string | null;
};
type LeadSource = { id: string; name: string; listId?: string; costPerLead: number; active?: boolean; callBufferSeconds?: number };

export interface ManagerConfigProps {
  API: string;
  agents: Agent[];
  products: Product[];
  leadSources: LeadSource[];
  refreshAgents: () => void;
  refreshProducts: () => void;
  refreshLeadSources: () => void;
  setAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  setLeadSources: React.Dispatch<React.SetStateAction<LeadSource[]>>;
}

/* -- Style constants -- */

const LBL: React.CSSProperties = { ...baseLabelStyle };

const TYPE_LABELS: Record<string, string> = { CORE: "Core", ADDON: "Add-on", AD_D: "AD&D" };
const TYPE_COLORS: Record<string, string> = { CORE: colors.primary400, ADDON: colors.info, AD_D: colors.warning };

/* -- Section header helper -- */

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: spacing[5] }}>
      <div style={{ color: colors.primary400 }}>{icon}</div>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: colors.textPrimary }}>{title}</h3>
      {count !== undefined && (
        <Badge color={colors.primary400} variant="subtle" size="sm">{count}</Badge>
      )}
    </div>
  );
}

/* -- AgentRow component -- */

function AgentRow({ agent, onSave, onDelete }: {
  agent: Agent;
  onSave: (id: string, data: Partial<Agent>) => Promise<void>;
  onDelete: (id: string, permanent: boolean) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [d, setD] = useState({ name: agent.name, email: agent.email ?? "", extension: agent.extension ?? "" });
  const [saving, setSaving] = useState(false);

  if (edit) {
    return (
      <div className="animate-fade-in" style={{ padding: "14px 0", borderBottom: `1px solid ${colors.borderSubtle}`, display: "grid", gap: 8 }}>
        <input className="input-focus" style={baseInputStyle} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
        <input className="input-focus" style={baseInputStyle} value={d.email} placeholder="CRM User ID" onChange={e => setD(x => ({ ...x, email: e.target.value }))} />
        <input className="input-focus" style={baseInputStyle} value={d.extension} placeholder="Tracking Extension" onChange={e => setD(x => ({ ...x, extension: e.target.value }))} />
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="success" size="sm" disabled={saving} onClick={async () => {
            setSaving(true); await onSave(agent.id, d); setEdit(false); setSaving(false);
          }}>
            <Save size={14} />{saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEdit(false)}>
            <X size={14} />Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (agent.active === false) {
    return (
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 8px", borderBottom: `1px solid ${colors.borderSubtle}`, borderRadius: radius.md, opacity: 0.5 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: colors.textMuted, textDecoration: "line-through" }}>{agent.name}</div>
          <div style={{ fontSize: 11, color: colors.textMuted }}>Inactive</div>
        </div>
        <Button variant="success" size="sm" onClick={() => onSave(agent.id, { active: true })} title="Reactivate agent">
          Reactivate
        </Button>
      </div>
    );
  }

  return (
    <div className="row-hover" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 8px", borderBottom: `1px solid ${colors.borderSubtle}`, borderRadius: radius.md, transition: `background ${motion.duration.fast}` }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary }}>{agent.name}</div>
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
          {agent.email ? `CRM: ${agent.email}` : ""}
          {agent.email && agent.extension ? " \u00b7 " : ""}
          {agent.extension ? `Ext: ${agent.extension}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {confirmDelete ? (
          <div className="animate-fade-in" style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", background: colors.dangerBg, border: `1px solid rgba(248,113,113,0.25)`, borderRadius: radius.md, padding: "6px 10px" }}>
            <span style={{ fontSize: 12, color: colors.danger, fontWeight: 600 }}>Remove agent?</span>
            <Button variant="secondary" size="sm" style={{ padding: "4px 10px", borderColor: "rgba(251,191,36,0.4)", color: "#fbbf24" }} onClick={() => { onDelete(agent.id, false); setConfirmDelete(false); }}>Deactivate</Button>
            <Button variant="danger" size="sm" style={{ padding: "4px 10px" }} onClick={() => { onDelete(agent.id, true); setConfirmDelete(false); }}>Delete Permanently</Button>
            <Button variant="secondary" size="sm" style={{ padding: "4px 10px" }} onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEdit(true)} title="Edit agent">
              <Edit3 size={13} />
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} title="Delete agent">
              <Trash2 size={13} />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* -- LeadSourceRow component -- */

function LeadSourceRow({ ls, onSave, onDelete }: {
  ls: LeadSource;
  onSave: (id: string, data: Partial<LeadSource>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [d, setD] = useState({ name: ls.name, listId: ls.listId ?? "", costPerLead: String(ls.costPerLead), callBufferSeconds: String(ls.callBufferSeconds ?? 0) });
  const [saving, setSaving] = useState(false);

  if (edit) {
    return (
      <div className="animate-fade-in" style={{ padding: "14px 0", borderBottom: `1px solid ${colors.borderSubtle}`, display: "grid", gap: 8 }}>
        <input className="input-focus" style={baseInputStyle} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
        <input className="input-focus" style={baseInputStyle} value={d.listId} placeholder="CRM List ID" onChange={e => setD(x => ({ ...x, listId: e.target.value }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input className="input-focus" style={baseInputStyle} type="number" step="0.01" value={d.costPerLead} placeholder="Cost per lead" onChange={e => setD(x => ({ ...x, costPerLead: e.target.value }))} />
          <input className="input-focus" style={baseInputStyle} type="number" min="0" value={d.callBufferSeconds} placeholder="Call buffer (s)" onChange={e => setD(x => ({ ...x, callBufferSeconds: e.target.value }))} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="success" size="sm" disabled={saving} onClick={async () => {
            setSaving(true);
            await onSave(ls.id, { ...d, costPerLead: Number(d.costPerLead), callBufferSeconds: Number(d.callBufferSeconds) });
            setEdit(false); setSaving(false);
          }}>
            <Save size={14} />{saving ? "Saving..." : "Save"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setEdit(false)}>
            <X size={14} />Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="row-hover" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 8px", borderBottom: `1px solid ${colors.borderSubtle}`, borderRadius: radius.md, transition: `background ${motion.duration.fast}` }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary }}>{ls.name}</div>
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
          ${ls.costPerLead}/lead{ls.listId ? ` \u00b7 List: ${ls.listId}` : ""}{(ls.callBufferSeconds ?? 0) > 0 ? ` \u00b7 Buffer: ${ls.callBufferSeconds}s` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        {confirmDelete ? (
          <div className="animate-fade-in" style={{ display: "flex", gap: 6, alignItems: "center", background: colors.dangerBg, border: `1px solid rgba(248,113,113,0.25)`, borderRadius: radius.md, padding: "6px 10px" }}>
            <span style={{ fontSize: 12, color: colors.danger, fontWeight: 600 }}>Remove source?</span>
            <Button variant="danger" size="sm" style={{ padding: "4px 10px" }} onClick={() => { onDelete(ls.id); setConfirmDelete(false); }}>Yes</Button>
            <Button variant="secondary" size="sm" style={{ padding: "4px 10px" }} onClick={() => setConfirmDelete(false)}>No</Button>
          </div>
        ) : (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEdit(true)} title="Edit lead source">
              <Edit3 size={13} />
            </Button>
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} title="Delete lead source">
              <Trash2 size={13} />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* -- ProductRow component -- */

function ProductRow({ product, onSave }: { product: Product; onSave: (id: string, data: Partial<Product>) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({
    name: product.name, type: product.type, active: product.active,
    premiumThreshold: product.premiumThreshold != null ? String(product.premiumThreshold) : "",
    commissionBelow: product.commissionBelow != null ? String(product.commissionBelow) : "",
    commissionAbove: product.commissionAbove != null ? String(product.commissionAbove) : "",
    bundledCommission: product.bundledCommission != null ? String(product.bundledCommission) : "",
    standaloneCommission: product.standaloneCommission != null ? String(product.standaloneCommission) : "",
    enrollFeeThreshold: product.enrollFeeThreshold != null ? String(product.enrollFeeThreshold) : "",
    notes: product.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const isCore = d.type === "CORE";

  if (!edit) return (
    <div className="row-hover" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 8px", borderBottom: `1px solid ${colors.borderSubtle}`, borderRadius: radius.md }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: colors.textPrimary }}>{product.name}</span>
          <Badge color={TYPE_COLORS[product.type]} variant="subtle" size="sm">{TYPE_LABELS[product.type]}</Badge>
          {!product.active && <Badge color={colors.danger} variant="subtle" size="sm">Inactive</Badge>}
        </div>
        <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 3 }}>
          {product.type === "CORE" && product.premiumThreshold != null && (
            <span>Threshold: {formatDollar(Number(product.premiumThreshold))} {"\u00b7"} Below: {product.commissionBelow ?? "\u2014"}% {"\u00b7"} Above: {product.commissionAbove ?? "\u2014"}%</span>
          )}
          {product.type !== "CORE" && (
            <span>Bundled: {product.bundledCommission ?? "\u2014"}% {"\u00b7"} Standalone: {product.standaloneCommission ?? "\u2014"}%</span>
          )}
          {product.notes && <span style={{ marginLeft: 8, fontStyle: "italic", color: colors.textMuted }}>{product.notes}</span>}
        </div>
      </div>
      <Button variant="ghost" size="sm" style={{ flexShrink: 0, marginLeft: 12 }} onClick={() => setEdit(true)}>
        <Edit3 size={13} />
      </Button>
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ padding: "16px 0", borderBottom: `1px solid ${colors.borderSubtle}`, display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, alignItems: "end" }}>
        <div><label style={LBL}>Name</label><input className="input-focus" style={baseInputStyle} value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} /></div>
        <div><label style={LBL}>Type</label>
          <select className="input-focus" style={{ ...baseInputStyle, height: 42 }} value={d.type} onChange={e => setD(x => ({ ...x, type: e.target.value as Product["type"] }))}>
            <option value="CORE">Core</option><option value="ADDON">Add-on</option><option value="AD_D">AD&D</option>
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, paddingBottom: 4, color: colors.textSecondary, cursor: "pointer" }}>
          <input type="checkbox" checked={d.active} onChange={e => setD(x => ({ ...x, active: e.target.checked }))} /> Active
        </label>
      </div>
      {isCore ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div><label style={LBL}>Premium Threshold ($)</label><input className="input-focus" style={baseInputStyle} type="number" step="0.01" value={d.premiumThreshold} placeholder="e.g. 300" onChange={e => setD(x => ({ ...x, premiumThreshold: e.target.value }))} /></div>
          <div><label style={LBL}>Commission Below (%)</label><input className="input-focus" style={baseInputStyle} type="number" step="0.01" value={d.commissionBelow} placeholder="e.g. 25" onChange={e => setD(x => ({ ...x, commissionBelow: e.target.value }))} /></div>
          <div><label style={LBL}>Commission Above (%)</label><input className="input-focus" style={baseInputStyle} type="number" step="0.01" value={d.commissionAbove} placeholder="e.g. 30" onChange={e => setD(x => ({ ...x, commissionAbove: e.target.value }))} /></div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div><label style={LBL}>Bundled Commission (%)</label><input className="input-focus" style={baseInputStyle} type="number" step="0.01" value={d.bundledCommission} placeholder={d.type === "AD_D" ? "e.g. 70" : "e.g. 30"} onChange={e => setD(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
          <div><label style={LBL}>Standalone Commission (%)</label><input className="input-focus" style={baseInputStyle} type="number" step="0.01" value={d.standaloneCommission} placeholder={d.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setD(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
          <div><label style={LBL}>Enroll Fee Threshold ($)</label><input className="input-focus" style={baseInputStyle} type="number" step="0.01" value={d.enrollFeeThreshold} placeholder="e.g. 50" onChange={e => setD(x => ({ ...x, enrollFeeThreshold: e.target.value }))} /></div>
        </div>
      )}
      <div><label style={LBL}>Notes</label><input className="input-focus" style={baseInputStyle} value={d.notes} placeholder="Optional notes" onChange={e => setD(x => ({ ...x, notes: e.target.value }))} /></div>
      <div style={{ display: "flex", gap: 8 }}>
        <Button variant="success" size="sm" disabled={saving} onClick={async () => {
          setSaving(true);
          await onSave(product.id, {
            name: d.name, type: d.type, active: d.active, notes: d.notes || null,
            premiumThreshold: d.premiumThreshold ? Number(d.premiumThreshold) : null,
            commissionBelow: d.commissionBelow ? Number(d.commissionBelow) : null,
            commissionAbove: d.commissionAbove ? Number(d.commissionAbove) : null,
            bundledCommission: d.bundledCommission ? Number(d.bundledCommission) : null,
            standaloneCommission: d.standaloneCommission ? Number(d.standaloneCommission) : null,
            enrollFeeThreshold: d.enrollFeeThreshold ? Number(d.enrollFeeThreshold) : null,
          } as Partial<Product>);
          setEdit(false); setSaving(false);
        }}>
          <Save size={14} />{saving ? "Saving..." : "Save"}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setEdit(false)}>
          <X size={14} />Cancel
        </Button>
      </div>
    </div>
  );
}

/* -- Component -- */

export default function ManagerConfig({ API, agents, products, leadSources, refreshAgents, refreshProducts, refreshLeadSources, setAgents, setLeadSources }: ManagerConfigProps) {
  const [newAgent, setNewAgent] = useState({ name: "", email: "", extension: "" });
  const [newLS, setNewLS] = useState({ name: "", listId: "", costPerLead: "" });
  const [cfgMsg, setCfgMsg] = useState("");
  const [cfgFieldErrors, setCfgFieldErrors] = useState<Record<string, string>>({});

  async function saveAgent(id: string, data: Partial<Agent>) {
    try {
      const res = await authFetch(`${API}/api/agents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) { setAgents(prev => prev.map(a => a.id === id ? { ...a, ...data } : a)); setCfgMsg("Agent updated"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function deleteAgent(id: string, permanent: boolean) {
    try {
      const url = permanent ? `${API}/api/agents/${id}?permanent=true` : `${API}/api/agents/${id}`;
      const res = await authFetch(url, { method: "DELETE" });
      if (res.ok) {
        if (permanent) {
          setAgents(prev => prev.filter(a => a.id !== id));
          setCfgMsg("Agent permanently deleted");
        } else {
          setAgents(prev => prev.map(a => a.id === id ? { ...a, active: false } : a));
          setCfgMsg("Agent deactivated");
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function addAgent(e: FormEvent) {
    e.preventDefault(); setCfgMsg("");
    const errs: Record<string, string> = {};
    if (!newAgent.name.trim()) errs.agentName = "Agent name is required";
    setCfgFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      const res = await authFetch(`${API}/api/agents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newAgent.name, email: newAgent.email || undefined, extension: newAgent.extension || undefined }) });
      if (res.ok) { const a = await res.json(); setAgents(prev => [...prev, a]); setNewAgent({ name: "", email: "", extension: "" }); setCfgFieldErrors({}); setCfgMsg("Agent added"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function saveProduct(id: string, data: Partial<Product>) {
    try {
      const res = await authFetch(`${API}/api/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) { refreshProducts(); setCfgMsg("Product updated"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function saveLeadSource(id: string, data: Partial<LeadSource>) {
    try {
      const res = await authFetch(`${API}/api/lead-sources/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) { setLeadSources(prev => prev.map(ls => ls.id === id ? { ...ls, ...data } : ls)); setCfgMsg("Lead source updated"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function deleteLeadSource(id: string) {
    try {
      const res = await authFetch(`${API}/api/lead-sources/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) { setLeadSources(prev => prev.filter(x => x.id !== id)); setCfgMsg("Lead source deleted"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function addLeadSource(e: FormEvent) {
    e.preventDefault(); setCfgMsg("");
    const errs: Record<string, string> = {};
    if (!newLS.name.trim()) errs.lsName = "Lead source name is required";
    setCfgFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      const res = await authFetch(`${API}/api/lead-sources`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newLS.name, listId: newLS.listId || undefined, costPerLead: Number(newLS.costPerLead) || 0 }) });
      if (res.ok) { const ls = await res.json(); setLeadSources(prev => [...prev, ls]); setNewLS({ name: "", listId: "", costPerLead: "" }); setCfgFieldErrors({}); setCfgMsg("Lead source added"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="grid-mobile-1">

        {/* Agents card */}
        <Card>
          <SectionHeader icon={<Users size={18} />} title="Agents" count={agents.length} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            {agents.map(a => (
              <AgentRow key={a.id} agent={a} onSave={saveAgent} onDelete={deleteAgent} />
            ))}
          </div>
          <form
            onSubmit={addAgent}
            style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${colors.borderSubtle}`, display: "grid", gap: 8 }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.textTertiary, marginBottom: 4, textTransform: "uppercase", letterSpacing: typography.tracking.caps }}>Add Agent</div>
            <Input label="Name" error={cfgFieldErrors.agentName} value={newAgent.name} onChange={e => { setNewAgent(x => ({ ...x, name: e.target.value })); setCfgFieldErrors(fe => { const n = { ...fe }; delete n.agentName; return n; }); }} />
            <Input label="CRM User ID" value={newAgent.email} onChange={e => setNewAgent(x => ({ ...x, email: e.target.value }))} />
            <Input label="Tracking Extension" value={newAgent.extension} onChange={e => setNewAgent(x => ({ ...x, extension: e.target.value }))} />
            <Button type="submit" variant="success" size="sm" fullWidth>
              <Plus size={14} />Add Agent
            </Button>
          </form>
        </Card>

        {/* Lead Sources card */}
        <Card>
          <SectionHeader icon={<Filter size={18} />} title="Lead Sources" count={leadSources.length} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            {leadSources.map(ls => (
              <LeadSourceRow key={ls.id} ls={ls} onSave={saveLeadSource} onDelete={deleteLeadSource} />
            ))}
          </div>
          <form
            onSubmit={addLeadSource}
            style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${colors.borderSubtle}`, display: "grid", gap: 8 }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.textTertiary, marginBottom: 4, textTransform: "uppercase", letterSpacing: typography.tracking.caps }}>Add Lead Source</div>
            <Input label="Name" error={cfgFieldErrors.lsName} value={newLS.name} onChange={e => { setNewLS(x => ({ ...x, name: e.target.value })); setCfgFieldErrors(fe => { const n = { ...fe }; delete n.lsName; return n; }); }} />
            <Input label="CRM List ID" value={newLS.listId} onChange={e => setNewLS(x => ({ ...x, listId: e.target.value }))} />
            <Input label="Cost per lead ($)" type="number" step="0.01" value={newLS.costPerLead} onChange={e => setNewLS(x => ({ ...x, costPerLead: e.target.value }))} />
            <Button type="submit" variant="success" size="sm" fullWidth>
              <Plus size={14} />Add Lead Source
            </Button>
          </form>
        </Card>

      </div>

      {/* Products section */}
      <Card style={{ marginTop: 20 }}>
        <SectionHeader icon={<Settings size={18} />} title="Products" count={products.length} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {products.map(p => (
            <ProductRow key={p.id} product={p} onSave={saveProduct} />
          ))}
        </div>
      </Card>

      {/* Config status message */}
      {cfgMsg && (
        <div className="animate-fade-in-up" style={{
          marginTop: 16,
          padding: "12px 16px",
          borderRadius: radius.xl,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 14,
          fontWeight: 600,
          background: cfgMsg.startsWith("Error") ? colors.dangerBg : colors.successBg,
          border: `1px solid ${cfgMsg.startsWith("Error") ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)"}`,
          color: cfgMsg.startsWith("Error") ? colors.danger : colors.success,
        }}>
          {cfgMsg.startsWith("Error") ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {cfgMsg}
        </div>
      )}
    </div>
  );
}
