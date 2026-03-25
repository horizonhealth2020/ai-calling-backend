"use client";
import { useState, type FormEvent } from "react";
import { Badge, AnimatedNumber, Button, Card, EmptyState } from "@ops/ui";
import { colors, spacing, radius, baseInputStyle, baseLabelStyle, baseThStyle, baseTdStyle } from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar } from "@ops/utils";
import {
  Users, Plus, Edit3, Trash2, Save, AlertTriangle, CheckCircle,
} from "lucide-react";

const C = colors;
const S = spacing;
const R = radius;

const inputStyle: React.CSSProperties = {
  ...baseInputStyle,
  boxSizing: "border-box",
};

const SMALL_INP: React.CSSProperties = {
  ...baseInputStyle,
  padding: "6px 10px",
  fontSize: 13,
  width: 90,
  textAlign: "right",
  boxSizing: "border-box",
};

const LBL: React.CSSProperties = { ...baseLabelStyle };

const thStyle: React.CSSProperties = {
  ...baseThStyle,
  background: C.bgSurface,
  position: "sticky",
  top: 0,
};
const thRight: React.CSSProperties = { ...thStyle, textAlign: "right" };
const thCenter: React.CSSProperties = { ...thStyle, textAlign: "center" };
const tdStyle: React.CSSProperties = { ...baseTdStyle, borderBottom: "none" };
const tdRight: React.CSSProperties = { ...tdStyle, textAlign: "right" };
const tdCenter: React.CSSProperties = { ...tdStyle, textAlign: "center" };

/* ── Types ──────────────────────────────────────────────────── */

type BonusCategory = { name: string; isDeduction: boolean };
type ServiceAgent = { id: string; name: string; basePay: number; active: boolean };
type ServiceEntry = {
  id: string; basePay: number; bonusAmount: number; deductionAmount: number;
  frontedAmount?: number; totalPay: number; bonusBreakdown?: Record<string, number>;
  status: string; notes?: string; serviceAgent: { name: string; basePay: number };
};
type Period = {
  id: string; weekStart: string; weekEnd: string; quarterLabel: string;
  status: string; entries: unknown[]; serviceEntries: ServiceEntry[];
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}-${dd}-${d.getUTCFullYear()}`;
}

/* ── Service Agent Card ───────────────────────────────────────── */

function ServiceAgentCard({
  agent, onSave,
}: {
  agent: ServiceAgent;
  onSave: (id: string, data: Partial<ServiceAgent>) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ name: agent.name, basePay: String(agent.basePay) });
  const [saving, setSaving] = useState(false);

  return (
    <Card
      className="hover-lift interactive-card"
      padding="sm"
      style={{ padding: S[5], display: "flex", justifyContent: "space-between", alignItems: edit ? "flex-start" : "center", gap: S[3] }}
    >
      {!edit ? (
        <>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary }}>{agent.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
              Base Pay: <span style={{ color: C.textSecondary, fontWeight: 600 }}>{formatDollar(Number(agent.basePay))}</span>
              {!agent.active && <span style={{ marginLeft: 6, color: C.textMuted }}> {"\u00B7"} Inactive</span>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEdit(true)} style={{ flexShrink: 0 }}>
            <Edit3 size={12} /> Edit
          </Button>
        </>
      ) : (
        <div style={{ display: "grid", gap: S[2], width: "100%" }}>
          <input className="input-focus" style={inputStyle} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
          <input className="input-focus" style={inputStyle} type="number" step="0.01" value={d.basePay} placeholder="Base Pay ($)" onChange={e => setD(x => ({ ...x, basePay: e.target.value }))} />
          <div style={{ display: "flex", gap: S[2] }}>
            <Button
              variant="success"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                await onSave(agent.id, { name: d.name, basePay: Number(d.basePay) });
                setEdit(false); setSaving(false);
              }}
            >
              <Save size={13} /> {saving ? "Saving..." : "Save"}
            </Button>
            <Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ── Props ──────────────────────────────────────────────────── */

export interface PayrollServiceProps {
  API: string;
  periods: Period[];
  serviceAgents: ServiceAgent[];
  setServiceAgents: React.Dispatch<React.SetStateAction<ServiceAgent[]>>;
  bonusCategories: BonusCategory[];
  setBonusCategories: React.Dispatch<React.SetStateAction<BonusCategory[]>>;
  refreshPeriods: () => Promise<void>;
}

/* ── Component ──────────────────────────────────────────────── */

export default function PayrollService({
  API, periods, serviceAgents, setServiceAgents,
  bonusCategories, setBonusCategories, refreshPeriods,
}: PayrollServiceProps) {
  const [newServiceAgent, setNewServiceAgent] = useState({ name: "", basePay: "" });
  const [svcMsg, setSvcMsg] = useState("");
  const [svcPeriodId, setSvcPeriodId] = useState(periods.length > 0 ? periods[0].id : "");
  const [svcBonuses, setSvcBonuses] = useState<Record<string, Record<string, string>>>({});
  const [svcFronted, setSvcFronted] = useState<Record<string, string>>({});
  const [newCatName, setNewCatName] = useState("");
  const [newCatDeduction, setNewCatDeduction] = useState(false);

  async function saveServiceAgent(id: string, data: Partial<ServiceAgent>) {
    try {
      const res = await authFetch(`${API}/api/service-agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setServiceAgents(prev => prev.map(a => a.id === id ? updated : a));
        setSvcMsg("Agent updated");
      } else {
        const err = await res.json().catch(() => ({}));
        setSvcMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      setSvcMsg(`Error: ${message}`);
    }
  }

  async function addServiceAgent(e: FormEvent) {
    e.preventDefault(); setSvcMsg("");
    try {
      const res = await authFetch(`${API}/api/reps/create-synced`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newServiceAgent.name, basePay: Number(newServiceAgent.basePay) }),
      });
      if (res.ok) {
        const data = await res.json();
        setServiceAgents(prev => [...prev, data.serviceAgent]);
        setNewServiceAgent({ name: "", basePay: "" });
        setSvcMsg("Customer service agent added successfully");
      } else {
        const err = await res.json().catch(() => ({}));
        setSvcMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      setSvcMsg(`Error: ${message}`);
    }
  }

  async function submitServiceBonus(agentId: string) {
    const breakdown = svcBonuses[agentId];
    if (!svcPeriodId) return;
    setSvcMsg("");
    try {
      const bonusBreakdown: Record<string, number> = {};
      if (breakdown) {
        for (const [cat, val] of Object.entries(breakdown)) {
          bonusBreakdown[cat] = Number(val) || 0;
        }
      }
      const frontedAmount = Number(svcFronted[agentId]) || 0;
      const res = await authFetch(`${API}/api/payroll/service-entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceAgentId: agentId, payrollPeriodId: svcPeriodId, bonusBreakdown, frontedAmount }),
      });
      if (res.ok) {
        setSvcMsg("Service payroll entry saved");
        await refreshPeriods();
      } else {
        const err = await res.json().catch(() => ({}));
        setSvcMsg(`Error: ${err.error ?? "Failed"}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      setSvcMsg(`Error: ${message}`);
    }
  }

  async function saveBonusCategories(cats: BonusCategory[]) {
    setSvcMsg("");
    try {
      const res = await authFetch(`${API}/api/settings/service-bonus-categories`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: cats }),
      });
      if (res.ok) {
        setBonusCategories(await res.json());
        setSvcMsg("Bonus categories updated");
      } else {
        const err = await res.json().catch(() => ({}));
        setSvcMsg(`Error: ${err.error ?? "Failed"}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      setSvcMsg(`Error: ${message}`);
    }
  }

  return (
    <div className="animate-fade-in" style={{ display: "grid", gap: S[6] }}>
      {/* Top two-column config */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S[5] }} className="stack-mobile">
        {/* Service Agents */}
        <Card style={{ borderRadius: R["2xl"] }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S[4] }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Service Agents</h3>
              <p style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 0" }}>Manage agents with base pay</p>
            </div>
          </div>

          <div style={{ display: "grid", gap: S[2], marginBottom: S[4] }}>
            {serviceAgents.length === 0 && (
              <EmptyState
                icon={<Users size={28} />}
                title="No service agents yet"
                description="Add your first service agent below."
              />
            )}
            {serviceAgents.map(a => (
              <ServiceAgentCard key={a.id} agent={a} onSave={saveServiceAgent} />
            ))}
          </div>

          {/* Add agent form */}
          <form onSubmit={addServiceAgent} style={{ borderTop: `1px solid ${C.borderSubtle}`, paddingTop: S[4], display: "grid", gap: S[2] }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: S[1] }}>
              Add Agent
            </div>
            <input className="input-focus" style={inputStyle} value={newServiceAgent.name} placeholder="Full name *" required onChange={e => setNewServiceAgent(x => ({ ...x, name: e.target.value }))} />
            <input className="input-focus" style={inputStyle} type="number" step="0.01" value={newServiceAgent.basePay} placeholder="Base Pay ($) *" required onChange={e => setNewServiceAgent(x => ({ ...x, basePay: e.target.value }))} />
            <Button variant="success" type="submit">
              <Plus size={13} /> Add Agent
            </Button>
          </form>
        </Card>

        {/* Bonus Categories */}
        <Card style={{ borderRadius: R["2xl"] }}>
          <div style={{ marginBottom: S[4] }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Bonus Categories</h3>
            <p style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 0" }}>Configure bonus/deduction columns</p>
          </div>

          <div style={{ display: "grid", gap: S[2], marginBottom: S[4] }}>
            {bonusCategories.length === 0 && (
              <p style={{ color: C.textMuted, fontSize: 13, margin: 0 }}>No categories configured.</p>
            )}
            {bonusCategories.map((cat, i) => (
              <div
                key={cat.name}
                style={{
                  display: "flex", alignItems: "center", gap: S[2],
                  padding: "10px 14px",
                  background: C.bgSurfaceRaised,
                  borderRadius: R.lg,
                  border: `1px solid ${C.borderSubtle}`,
                }}
              >
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: cat.isDeduction ? C.danger : C.textPrimary }}>
                  {cat.name}
                </span>
                <Badge color={cat.isDeduction ? C.danger : C.success} dot>
                  {cat.isDeduction ? "Deduction" : "Bonus"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => saveBonusCategories(bonusCategories.filter((_, j) => j !== i))}
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: C.danger, padding: "4px 8px" }}
                >
                  <Trash2 size={11} />
                </Button>
              </div>
            ))}
          </div>

          {/* Add category */}
          <div style={{ borderTop: `1px solid ${C.borderSubtle}`, paddingTop: S[4] }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: S[3] }}>
              Add Category
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: S[2], alignItems: "end" }}>
              <div>
                <label style={LBL}>Name</label>
                <input
                  className="input-focus"
                  style={inputStyle}
                  value={newCatName}
                  placeholder="e.g. Flips"
                  onChange={e => setNewCatName(e.target.value)}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: S[1], fontSize: 12, color: C.textSecondary, paddingBottom: 4, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input type="checkbox" checked={newCatDeduction} onChange={e => setNewCatDeduction(e.target.checked)} />
                Deduction
              </label>
              <Button
                variant="success"
                type="button"
                onClick={() => {
                  if (!newCatName.trim()) return;
                  saveBonusCategories([...bonusCategories, { name: newCatName.trim(), isDeduction: newCatDeduction }]);
                  setNewCatName(""); setNewCatDeduction(false);
                }}
              >
                <Plus size={13} /> Add
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Weekly Payroll input table */}
      <Card style={{ borderRadius: R["2xl"] }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: S[5] }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>Weekly Payroll Entry</h3>
            <p style={{ color: C.textMuted, fontSize: 13, margin: "4px 0 0" }}>Enter bonus amounts per category for each service agent</p>
          </div>
          <div style={{ minWidth: 220 }}>
            <label style={LBL}>Payroll Period</label>
            <select
              className="input-focus"
              style={{ ...inputStyle, height: 40 }}
              value={svcPeriodId}
              onChange={e => setSvcPeriodId(e.target.value)}
            >
              {periods.map(p => (
                <option key={p.id} value={p.id}>{fmtDate(p.weekStart)} {"\u2013"} {fmtDate(p.weekEnd)}</option>
              ))}
            </select>
          </div>
        </div>

        {bonusCategories.length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: 13 }}>Add bonus categories above to start entering payroll.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Agent</th>
                  <th style={thRight}>Base Pay</th>
                  <th style={{ ...thCenter, color: C.danger }}>Fronted</th>
                  {bonusCategories.map(cat => (
                    <th key={cat.name} style={{ ...thCenter, color: cat.isDeduction ? C.danger : C.textTertiary }}>
                      {cat.name}
                    </th>
                  ))}
                  <th style={{ ...thRight, color: C.info }}>Total</th>
                  <th style={thCenter}></th>
                </tr>
              </thead>
              <tbody>
                {serviceAgents.filter(a => a.active).map((agent) => {
                  const key = agent.id;
                  const currentPeriod = periods.find(p => p.id === svcPeriodId);
                  const existingEntry = currentPeriod?.serviceEntries?.find(se => se.serviceAgent.name === agent.name);
                  const vals = svcBonuses[key] ?? (existingEntry?.bonusBreakdown
                    ? Object.fromEntries(Object.entries(existingEntry.bonusBreakdown).map(([k, v]) => [k, String(v)]))
                    : {});
                  const frontedVal = svcFronted[key] ?? String(existingEntry?.frontedAmount ?? 0);
                  const basePay = Number(agent.basePay);
                  const frontedNum = Number(frontedVal) || 0;
                  let total = basePay - frontedNum;
                  for (const cat of bonusCategories) {
                    const amt = Number(vals[cat.name]) || 0;
                    total += cat.isDeduction ? -amt : amt;
                  }

                  return (
                    <tr
                      key={key}
                      className="row-hover"
                      style={{ borderTop: `1px solid ${C.borderSubtle}` }}
                    >
                      <td style={{ ...tdStyle, fontWeight: 600, color: C.textPrimary }}>
                        {agent.name}
                        {existingEntry && (
                          <span style={{ fontSize: 10, color: C.info, marginLeft: 6, fontWeight: 500 }}>
                            saved
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdRight, color: C.textSecondary, fontWeight: 600 }}>
                        {formatDollar(basePay)}
                      </td>
                      <td style={{ ...tdCenter, padding: "6px 4px" }}>
                        <input
                          className="input-focus"
                          style={{
                            ...SMALL_INP, width: 72, textAlign: "center",
                            background: frontedNum > 0 ? "rgba(248,113,113,0.10)" : SMALL_INP.background,
                            color: frontedNum > 0 ? C.danger : C.textPrimary,
                          }}
                          type="number" step="0.01" placeholder="0"
                          value={frontedVal === "0" ? "" : frontedVal}
                          onChange={e => setSvcFronted(prev => ({ ...prev, [key]: e.target.value }))}
                        />
                      </td>
                      {bonusCategories.map(cat => (
                        <td key={cat.name} style={{ ...tdCenter, padding: "6px 4px" }}>
                          <input
                            className="input-focus"
                            style={{
                              ...SMALL_INP, width: 68, textAlign: "center",
                              background: cat.isDeduction && Number(vals[cat.name] || 0) > 0 ? "rgba(248,113,113,0.10)" : SMALL_INP.background,
                              color: cat.isDeduction ? C.danger : C.textPrimary,
                            }}
                            type="number" step="0.01" placeholder="0"
                            value={vals[cat.name] ?? ""}
                            onChange={e => setSvcBonuses(prev => ({ ...prev, [key]: { ...vals, [cat.name]: e.target.value } }))}
                          />
                        </td>
                      ))}
                      <td style={{ ...tdRight, fontWeight: 800, fontSize: 15, color: C.info }}>
                        <AnimatedNumber value={total} prefix="$" decimals={2} />
                      </td>
                      <td style={tdCenter}>
                        <Button
                          variant="primary"
                          size="sm"
                          type="button"
                          onClick={() => submitServiceBonus(agent.id)}
                        >
                          <Save size={12} /> Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Service status message */}
      {svcMsg && (
        <div style={{
          display: "flex", alignItems: "center", gap: S[2],
          padding: "12px 16px",
          background: svcMsg.startsWith("Error") ? "rgba(248,113,113,0.08)" : "rgba(52,211,153,0.08)",
          border: `1px solid ${svcMsg.startsWith("Error") ? "rgba(248,113,113,0.2)" : "rgba(52,211,153,0.2)"}`,
          borderRadius: R.lg,
          color: svcMsg.startsWith("Error") ? C.danger : C.success,
          fontWeight: 600, fontSize: 13,
        }}>
          {svcMsg.startsWith("Error") ? <AlertTriangle size={14} /> : <CheckCircle size={14} />}
          {svcMsg}
        </div>
      )}
    </div>
  );
}
