"use client";
import React, { useState, useEffect, FormEvent } from "react";
import { PageShell } from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

type Tab = "sales" | "tracker" | "agent-sales" | "audits" | "config" | "ai-prompts";
type Agent = { id: string; name: string; email?: string; userId?: string; extension?: string; displayOrder: number; active?: boolean; auditEnabled?: boolean };
type Product = {
  id: string; name: string; active: boolean; type: "CORE" | "ADDON" | "AD_D";
  premiumThreshold?: number | null; commissionBelow?: number | null; commissionAbove?: number | null;
  bundledCommission?: number | null; standaloneCommission?: number | null; enrollFeeThreshold?: number | null; notes?: string | null;
};
type LeadSource = { id: string; name: string; listId?: string; costPerLead: number; active?: boolean; callBufferSeconds?: number };
type TrackerEntry = { agent: string; salesCount: number; premiumTotal: number; totalLeadCost: number; costPerSale: number };
type CallAudit = {
  id: string; agentId: string; callDate: string; score: number; status: string;
  coachingNotes?: string; transcription?: string; aiSummary?: string; aiScore?: number;
  aiCoachingNotes?: string; recordingUrl?: string;
  agent: { id: string; name: string };
};
type CallCount = { agentId: string; agentName: string; leadSourceId: string; leadSourceName: string; callCount: number; totalLeadCost: number };
type Sale = { id: string; saleDate: string; memberName: string; memberId?: string; carrier: string; premium: number; status: string; notes?: string; agent: { id: string; name: string }; product: { id: string; name: string }; leadSource: { id: string; name: string } };
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

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

// ── Receipt parser ──────────────────────────────────────────────────
type ParsedProduct = { name: string; price: string; isAddon: boolean; enrollmentFee?: string };
type ParseResult = {
  memberId?: string; memberName?: string; status?: string; saleDate?: string;
  premium?: string; carrier?: string; enrollmentFee?: string; addonNames: string[];
  parsedProducts: ParsedProduct[]; paymentType?: "CC" | "ACH";
};

function parseReceipt(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const t = lines.join(" ");
  const out: ParseResult = { addonNames: [], parsedProducts: [] };

  // ── Member section ──
  // ID: 686756360
  const idMatch = t.match(/(?:MemberID|ID):\s*(\d+)/);
  if (idMatch) out.memberId = idMatch[1];

  // Member name: line after "ID: xxx" or after "MemberID: xxx"
  // In copy-paste: "ID: 686756360\nRobert Malone\n1002 S..."
  for (let i = 0; i < lines.length; i++) {
    if (/^(?:MemberID|ID):\s*\d+/.test(lines[i])) {
      // Name might be on same line (MemberID: 123 Robert Malone) or next line
      const sameLine = lines[i].match(/(?:MemberID|ID):\s*\d+\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)/);
      if (sameLine) { out.memberName = sameLine[1].trim(); }
      else if (i + 1 < lines.length && /^[A-Z][a-zA-Z'-]+\s+[A-Z]/.test(lines[i + 1]) && !/^\d/.test(lines[i + 1])) {
        out.memberName = lines[i + 1].trim();
      }
      break;
    }
  }

  // ── Sale section ──
  // SALE on March 11, 2026 - Approved
  const st = t.match(/SALE on .+?[-\u2013]\s*(Approved|Rejected|Cancelled|Submitted)/i);
  if (st) out.status = st[1].toUpperCase();

  // Date: 03/11/2026
  const dt = t.match(/Date:\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (dt) out.saleDate = `${dt[3]}-${dt[1]}-${dt[2]}`;

  // Amount: $298.64
  const am = t.match(/Amount:\s*\$?([\d,]+\.?\d*)/);
  if (am) out.premium = am[1].replace(/,/g, "");

  // ── Products section ──
  // Find the "Products" header and parse each product block
  // Each product: "ProductName [- Add-on]\nPlan details - ID: XXXX - Payment: N\n[Enrollment $XX.XX] Product $XX.XX"
  let totalEnrollment = 0;
  const productsIdx = lines.findIndex(l => /^Products$/i.test(l));
  if (productsIdx >= 0) {
    // Collect lines from Products header until "Total" or "Payment" section
    const productLines: string[] = [];
    for (let i = productsIdx + 1; i < lines.length; i++) {
      if (/^Total\s+\$/.test(lines[i]) || /^Payment$/i.test(lines[i])) break;
      productLines.push(lines[i]);
    }

    // Join and split by product blocks — each product starts with a name line
    // Pattern: product blocks are separated by "Product $XX.XX" endings
    const joined = productLines.join(" ");

    // Split on "Product  $XX.XX" boundaries to find individual products
    const productBlockRe = /Product\s+\$([\d,]+\.?\d*)/g;
    let pm: RegExpExecArray | null;
    const blocks: { text: string; price: string }[] = [];
    let prevIdx = 0;
    while ((pm = productBlockRe.exec(joined)) !== null) {
      blocks.push({ text: joined.substring(prevIdx, pm.index), price: pm[1].replace(/,/g, "") });
      prevIdx = pm.index + pm[0].length;
    }

    for (const block of blocks) {
      const bt = block.text.trim();
      // Extract product name (everything before "Individual", "Family", "Employee", or "- ID:")
      const nameMatch = bt.match(/^([A-Za-z][A-Za-z0-9&\s/+'.()-]+?)(?:\s+(?:Individual|Family|Employee|Member)\b|\s+-\s+ID:)/i);
      if (nameMatch) {
        const rawName = nameMatch[1].trim();
        const isAddon = /[-\u2013]\s*Add-on/i.test(rawName) || /\bAdd-on\b/i.test(rawName);
        const cleanName = rawName.replace(/\s*[-\u2013]\s*Add-on\s*/gi, "").replace(/\s+Add-on\s*/gi, "").trim();

        // Check for enrollment fee in this block
        const efMatch = bt.match(/Enrollment\s+\$?([\d,]+\.?\d*)/);
        let enrollFee: string | undefined;
        if (efMatch) {
          enrollFee = efMatch[1].replace(/,/g, "");
          totalEnrollment += Number(enrollFee);
        }

        out.parsedProducts.push({ name: cleanName, price: block.price, isAddon, enrollmentFee: enrollFee });
        if (isAddon) out.addonNames.push(cleanName);
      }
    }

    // Carrier = first non-addon product name
    const primary = out.parsedProducts.find(p => !p.isAddon);
    if (primary) out.carrier = primary.name;
  }

  if (totalEnrollment > 0) out.enrollmentFee = totalEnrollment.toFixed(2);

  // ── Payment section ──
  // Type: BANK = ACH, anything else = CC
  const payType = t.match(/Payment\s+Type:\s*(\w+)/i) || t.match(/Type:\s*(BANK|CARD|CC|ACH|CREDIT)/i);
  if (payType) {
    const pt = payType[1].toUpperCase();
    out.paymentType = (pt === "BANK" || pt === "ACH") ? "ACH" : "CC";
  }

  // ── Fallback for inline format (MemberID: 123 Name...) ──
  if (!out.memberName && !out.memberId) {
    const mid = t.match(/MemberID:\s*(\d+)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)/);
    if (mid) { out.memberId = mid[1]; out.memberName = mid[2].trim(); }
  }

  // Fallback enrollment fee if products section didn't have it
  if (!out.enrollmentFee) {
    const efRe = /Enrollment\s+\$?([\d,]+\.?\d*)/g;
    let efm: RegExpExecArray | null;
    let ef = 0;
    while ((efm = efRe.exec(t)) !== null) ef += Number(efm[1].replace(/,/g, ""));
    if (ef > 0) out.enrollmentFee = ef.toFixed(2);
  }

  return out;
}

function matchProduct(name: string, products: Product[]): Product | undefined {
  const lower = name.toLowerCase();
  // 1. Exact match
  const exact = products.find(p => p.name.toLowerCase() === lower);
  if (exact) return exact;
  // 2. Word-boundary match (product name is a whole word in receipt or vice versa)
  const wordMatch = products.find(p => {
    const pn = p.name.toLowerCase();
    const re1 = new RegExp(`\\b${pn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    const re2 = new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    return re1.test(lower) || re2.test(pn);
  });
  if (wordMatch) return wordMatch;
  // 3. Substring fallback — prefer longest matching product name
  const subs = products.filter(p => {
    const pn = p.name.toLowerCase();
    return pn.includes(lower) || lower.includes(pn);
  });
  if (subs.length > 0) return subs.sort((a, b) => b.name.length - a.name.length)[0];
  return undefined;
}

// ── Editable row components ─────────────────────────────────────────
function AgentRow({ agent, onSave, onDelete }: { agent: Agent; onSave: (id: string, data: Partial<Agent>) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ name: agent.name, email: agent.email ?? "", extension: agent.extension ?? "" });
  const [saving, setSaving] = useState(false);
  if (!edit) return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>{agent.name}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          {agent.email ? `CRM User ID: ${agent.email}` : ""}
          {agent.email && agent.extension ? " \u00b7 " : ""}
          {agent.extension ? `Tracking: ${agent.extension}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setEdit(true)} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, background: "rgba(30,41,59,0.5)", cursor: "pointer", color: "#94a3b8", fontWeight: 600 }}>Edit</button>
        <button onClick={() => { if (confirm(`Delete agent "${agent.name}"? This will deactivate them.`)) onDelete(agent.id); }} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, background: "rgba(239,68,68,0.1)", cursor: "pointer", color: "#f87171", fontWeight: 600 }}>Delete</button>
      </div>
    </div>
  );
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "grid", gap: 8 }}>
      <input style={INP} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
      <input style={INP} value={d.email} placeholder="CRM User ID" onChange={e => setD(x => ({ ...x, email: e.target.value }))} />
      <input style={INP} value={d.extension} placeholder="Tracking Extension" onChange={e => setD(x => ({ ...x, extension: e.target.value }))} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={BTN()} disabled={saving} onClick={async () => { setSaving(true); await onSave(agent.id, d); setEdit(false); setSaving(false); }}>Save</button>
        <button onClick={() => setEdit(false)} style={CANCEL_BTN}>Cancel</button>
      </div>
    </div>
  );
}

function LeadSourceRow({ ls, onSave, onDelete }: { ls: LeadSource; onSave: (id: string, data: Partial<LeadSource>) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [edit, setEdit] = useState(false);
  const [d, setD] = useState({ name: ls.name, listId: ls.listId ?? "", costPerLead: String(ls.costPerLead), callBufferSeconds: String(ls.callBufferSeconds ?? 0) });
  const [saving, setSaving] = useState(false);
  if (!edit) return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>{ls.name}</div>
        <div style={{ fontSize: 12, color: "#64748b" }}>${ls.costPerLead}/lead{ls.listId ? ` \u00b7 List: ${ls.listId}` : ""}{(ls.callBufferSeconds ?? 0) > 0 ? ` \u00b7 Buffer: ${ls.callBufferSeconds}s` : ""}</div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => setEdit(true)} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, background: "rgba(30,41,59,0.5)", cursor: "pointer", color: "#94a3b8", fontWeight: 600 }}>Edit</button>
        <button onClick={() => { if (confirm(`Delete lead source "${ls.name}"?`)) onDelete(ls.id); }} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid rgba(239,68,68,0.2)", borderRadius: 6, background: "rgba(239,68,68,0.1)", cursor: "pointer", color: "#f87171", fontWeight: 600 }}>Delete</button>
      </div>
    </div>
  );
  return (
    <div style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "grid", gap: 8 }}>
      <input style={INP} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
      <input style={INP} value={d.listId} placeholder="CRM List ID" onChange={e => setD(x => ({ ...x, listId: e.target.value }))} />
      <input style={{ ...INP, width: "50%" }} type="number" step="0.01" value={d.costPerLead} placeholder="Cost per lead" onChange={e => setD(x => ({ ...x, costPerLead: e.target.value }))} />
      <input style={{ ...INP, width: "50%" }} type="number" min="0" value={d.callBufferSeconds} placeholder="Call buffer (seconds)" onChange={e => setD(x => ({ ...x, callBufferSeconds: e.target.value }))} />
      <div style={{ display: "flex", gap: 8 }}>
        <button style={BTN()} disabled={saving} onClick={async () => { setSaving(true); await onSave(ls.id, { ...d, costPerLead: Number(d.costPerLead), callBufferSeconds: Number(d.callBufferSeconds) }); setEdit(false); setSaving(false); }}>Save</button>
        <button onClick={() => setEdit(false)} style={CANCEL_BTN}>Cancel</button>
      </div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = { CORE: "Core", ADDON: "Add-on", AD_D: "AD&D" };
const TYPE_COLORS: Record<string, string> = { CORE: "#3b82f6", ADDON: "#8b5cf6", AD_D: "#f59e0b" };

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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "#e2e8f0" }}>{product.name}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLORS[product.type], background: `${TYPE_COLORS[product.type]}15`, padding: "2px 8px", borderRadius: 10 }}>{TYPE_LABELS[product.type]}</span>
          {!product.active && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>Inactive</span>}
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {product.type === "CORE" && product.premiumThreshold != null && (
            <span>Threshold: ${Number(product.premiumThreshold).toFixed(2)} \u00b7 Below: {product.commissionBelow ?? "\u2014"}% \u00b7 Above: {product.commissionAbove ?? "\u2014"}%</span>
          )}
          {product.type !== "CORE" && (
            <span>Bundled: {product.bundledCommission ?? "\u2014"}% \u00b7 Standalone: {product.standaloneCommission ?? "\u2014"}%</span>
          )}
          {product.notes && <span style={{ marginLeft: 8, fontStyle: "italic" }}>{product.notes}</span>}
        </div>
      </div>
      <button onClick={() => setEdit(true)} style={{ padding: "5px 12px", fontSize: 12, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, background: "rgba(30,41,59,0.5)", cursor: "pointer", color: "#94a3b8", fontWeight: 600, flexShrink: 0 }}>Edit</button>
    </div>
  );

  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, alignItems: "end" }}>
        <div><label style={LBL}>Name</label><input style={INP} value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} /></div>
        <div><label style={LBL}>Type</label>
          <select style={{ ...INP, height: 42 }} value={d.type} onChange={e => setD(x => ({ ...x, type: e.target.value as Product["type"] }))}>
            <option value="CORE">Core</option><option value="ADDON">Add-on</option><option value="AD_D">AD&D</option>
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, paddingBottom: 4, color: "#94a3b8" }}>
          <input type="checkbox" checked={d.active} onChange={e => setD(x => ({ ...x, active: e.target.checked }))} /> Active
        </label>
      </div>
      {isCore ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div><label style={LBL}>Premium Threshold ($)</label><input style={INP} type="number" step="0.01" value={d.premiumThreshold} placeholder="e.g. 300" onChange={e => setD(x => ({ ...x, premiumThreshold: e.target.value }))} /></div>
          <div><label style={LBL}>Commission Below (%)</label><input style={INP} type="number" step="0.01" value={d.commissionBelow} placeholder="e.g. 25" onChange={e => setD(x => ({ ...x, commissionBelow: e.target.value }))} /></div>
          <div><label style={LBL}>Commission Above (%)</label><input style={INP} type="number" step="0.01" value={d.commissionAbove} placeholder="e.g. 30" onChange={e => setD(x => ({ ...x, commissionAbove: e.target.value }))} /></div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div><label style={LBL}>Bundled Commission (%)</label><input style={INP} type="number" step="0.01" value={d.bundledCommission} placeholder={d.type === "AD_D" ? "e.g. 70" : "e.g. 30"} onChange={e => setD(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
          <div><label style={LBL}>Standalone Commission (%)</label><input style={INP} type="number" step="0.01" value={d.standaloneCommission} placeholder={d.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setD(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
          <div><label style={LBL}>Enroll Fee Threshold ($)</label><input style={INP} type="number" step="0.01" value={d.enrollFeeThreshold} placeholder="e.g. 50" onChange={e => setD(x => ({ ...x, enrollFeeThreshold: e.target.value }))} /></div>
        </div>
      )}
      <div><label style={LBL}>Notes</label><input style={INP} value={d.notes} placeholder="Optional notes" onChange={e => setD(x => ({ ...x, notes: e.target.value }))} /></div>
      <div style={{ display: "flex", gap: 8 }}>
        <button style={BTN()} disabled={saving} onClick={async () => {
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
        }}>Save</button>
        <button onClick={() => setEdit(false)} style={CANCEL_BTN}>Cancel</button>
      </div>
    </div>
  );
}

// ── Status badge ────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    APPROVED: { bg: "rgba(16,185,129,0.15)", color: "#34d399" },
    REJECTED: { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
    CANCELLED: { bg: "rgba(100,116,139,0.15)", color: "#94a3b8" },
    SUBMITTED: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  };
  const s = map[status] ?? map.SUBMITTED;
  return <span style={{ padding: "3px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color }}>{status}</span>;
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

  const blankForm = () => ({ saleDate: new Date().toISOString().slice(0, 10), agentId: "", memberName: "", memberId: "", carrier: "", productId: "", premium: "", effectiveDate: "", leadSourceId: "", enrollmentFee: "", addonProductIds: [] as string[], status: "SUBMITTED", notes: "", paymentType: "" as "CC" | "ACH" | "" });
  const [form, setForm] = useState(blankForm());
  const [receipt, setReceipt] = useState("");
  const [parsed, setParsed] = useState(false);

  const [newAgent, setNewAgent] = useState({ name: "", email: "", extension: "" });
  const [newLS, setNewLS] = useState({ name: "", listId: "", costPerLead: "" });
  const [cfgMsg, setCfgMsg] = useState("");

  // Call audits state
  const [audits, setAudits] = useState<CallAudit[]>([]);
  const [auditsLoaded, setAuditsLoaded] = useState(false);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const [editingAudit, setEditingAudit] = useState<string | null>(null);
  const [auditEdit, setAuditEdit] = useState({ score: 0, status: "", coachingNotes: "" });

  // AI prompt state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPromptLoaded, setAiPromptLoaded] = useState(false);
  const [aiPromptMsg, setAiPromptMsg] = useState("");

  // Audit duration filter state
  const [auditMinSec, setAuditMinSec] = useState(0);
  const [auditMaxSec, setAuditMaxSec] = useState(0);
  const [auditDurationLoaded, setAuditDurationLoaded] = useState(false);
  const [auditDurationMsg, setAuditDurationMsg] = useState("");

  // Call counts state
  const [callCounts, setCallCounts] = useState<CallCount[]>([]);
  const [callCountsLoaded, setCallCountsLoaded] = useState(false);

  useEffect(() => {
    captureTokenFromUrl();
    Promise.all([
      authFetch(`${API}/api/agents`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/products`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/lead-sources`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/tracker/summary`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/sales?range=week`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([a, p, ls, tr, sl]) => {
      setAgents(a); setProducts(p); setLeadSources(ls); setTracker(tr); setSalesList(sl);
      setForm(f => ({ ...f, agentId: a[0]?.id ?? "", productId: p[0]?.id ?? "", leadSourceId: ls[0]?.id ?? "" }));
      setLoading(false);
    });
  }, []);

  // Lazy-load data when switching to specific tabs
  useEffect(() => {
    if (tab === "audits" && !auditsLoaded) {
      authFetch(`${API}/api/call-audits`).then(r => r.ok ? r.json() : []).then(setAudits).catch(() => {});
      setAuditsLoaded(true);
    }
    if (tab === "ai-prompts" && !aiPromptLoaded) {
      authFetch(`${API}/api/settings/ai-audit-prompt`).then(r => r.ok ? r.json() : { prompt: "" }).then(d => setAiPrompt(d.prompt)).catch(() => {});
      setAiPromptLoaded(true);
    }
    if (tab === "ai-prompts" && !auditDurationLoaded) {
      authFetch(`${API}/api/settings/audit-duration`).then(r => r.ok ? r.json() : { minSeconds: 0, maxSeconds: 0 }).then(d => { setAuditMinSec(d.minSeconds); setAuditMaxSec(d.maxSeconds); }).catch(() => {});
      setAuditDurationLoaded(true);
    }
    if (tab === "tracker" && !callCountsLoaded) {
      authFetch(`${API}/api/call-counts?range=week`).then(r => r.ok ? r.json() : []).then(setCallCounts).catch(() => {});
      setCallCountsLoaded(true);
    }
  }, [tab]);

  const [parsedInfo, setParsedInfo] = useState<{ enrollmentFee?: string; premium?: string; coreProduct?: string; parsedProducts: ParsedProduct[]; addons: { name: string; matched: boolean; productName?: string; productId?: string }[] }>({ addons: [], parsedProducts: [] });

  function handleParse() {
    if (!receipt.trim()) return;
    const p = parseReceipt(receipt);
    const coreMatch = p.carrier ? matchProduct(p.carrier, products) : undefined;
    const addonMatches = p.addonNames.map(name => {
      const match = matchProduct(name, products);
      return { name, matched: !!match, productName: match?.name, productId: match?.id };
    });
    const addonProductIds = addonMatches.filter(a => a.productId).map(a => a.productId!);
    const { addonNames: _, parsedProducts, enrollmentFee, paymentType: parsedPaymentType, ...formFields } = p;
    setForm(f => ({ ...f, ...formFields, enrollmentFee: enrollmentFee ?? f.enrollmentFee, addonProductIds, productId: coreMatch?.id ?? f.productId, paymentType: parsedPaymentType ?? f.paymentType }));
    setParsedInfo({ enrollmentFee, premium: p.premium, coreProduct: coreMatch ? coreMatch.name : p.carrier, parsedProducts, addons: addonMatches });
    setParsed(true);
  }

  function clearReceipt() {
    setReceipt("");
    setParsed(false);
    setForm(f => ({ ...blankForm(), agentId: f.agentId, productId: f.productId, leadSourceId: f.leadSourceId }));
  }

  async function submitSale(e: FormEvent) {
    e.preventDefault(); setMsg("");
    try {
      const res = await authFetch(`${API}/api/sales`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, premium: Number(form.premium), enrollmentFee: form.enrollmentFee ? Number(form.enrollmentFee) : null, paymentType: form.paymentType || undefined }) });
      if (res.ok) {
        setMsg("Sale submitted successfully");
        clearReceipt();
        authFetch(`${API}/api/tracker/summary`).then(r => r.ok ? r.json() : []).then(setTracker).catch(() => {});
        authFetch(`${API}/api/sales?range=week`).then(r => r.ok ? r.json() : []).then(setSalesList).catch(() => {});
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: any) {
      setMsg(`Error: Unable to reach API server \u2014 ${e.message ?? "network error"}`);
    }
  }

  async function saveAgent(id: string, data: Partial<Agent>) {
    try {
      const res = await authFetch(`${API}/api/agents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (res.ok) { setAgents(prev => prev.map(a => a.id === id ? { ...a, ...data } : a)); setCfgMsg("Agent updated"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function deleteAgent(id: string) {
    try {
      const res = await authFetch(`${API}/api/agents/${id}`, { method: "DELETE" });
      if (res.ok) { setAgents(prev => prev.filter(a => a.id !== id)); setCfgMsg("Agent deleted"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function addAgent(e: FormEvent) {
    e.preventDefault(); setCfgMsg("");
    try {
      const res = await authFetch(`${API}/api/agents`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newAgent.name, email: newAgent.email || undefined, extension: newAgent.extension || undefined }) });
      if (res.ok) { const a = await res.json(); setAgents(prev => [...prev, a]); setNewAgent({ name: "", email: "", extension: "" }); setCfgMsg("Agent added"); }
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
      if (res.ok) { setLeadSources(prev => prev.filter(ls => ls.id !== id)); setCfgMsg("Lead source deleted"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  async function addLeadSource(e: FormEvent) {
    e.preventDefault(); setCfgMsg("");
    try {
      const res = await authFetch(`${API}/api/lead-sources`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newLS.name, listId: newLS.listId || undefined, costPerLead: Number(newLS.costPerLead) || 0 }) });
      if (res.ok) { const ls = await res.json(); setLeadSources(prev => [...prev, ls]); setNewLS({ name: "", listId: "", costPerLead: "" }); setCfgMsg("Lead source added"); }
      else { const err = await res.json().catch(() => ({})); setCfgMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
    } catch (e: any) { setCfgMsg(`Error: Unable to reach API \u2014 ${e.message ?? "network error"}`); }
  }

  if (loading) return <PageShell title="Manager Dashboard"><p style={{ color: "#64748b" }}>Loading\u2026</p></PageShell>;

  const TAB_LABELS: Record<Tab, string> = { sales: "Sales Entry", tracker: "Agent Tracker", "agent-sales": "Agent Sales", audits: "Call Audits", config: "Config", "ai-prompts": "AI Prompts" };

  return (
    <PageShell title="Manager Dashboard">
      {/* Tab Navigation */}
      <nav style={{ display: "flex", gap: 6, marginBottom: 28, padding: 4, background: "rgba(15,23,42,0.4)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)", width: "fit-content" }}>
        {(["sales", "tracker", "agent-sales", "audits", "config", "ai-prompts"] as Tab[]).map(t => (
          <button key={t} style={tabBtn(tab === t)} onClick={() => setTab(t)}>{TAB_LABELS[t]}</button>
        ))}
      </nav>

      {/* ── Sales Entry ── */}
      {tab === "sales" && (
        <form onSubmit={submitSale} style={{ maxWidth: 900 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={LBL}>Agent</label>
              <select style={{ ...INP, height: 42 }} value={form.agentId} onChange={e => setForm(f => ({ ...f, agentId: e.target.value }))}>
                {agents.filter(a => a.active !== false).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={LBL}>Paste Sale Receipt</label>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <textarea
                  style={{ ...INP, height: 80, resize: "vertical", fontFamily: "monospace", fontSize: 12 } as React.CSSProperties}
                  value={receipt}
                  placeholder={"MemberID: 686724349 Marc Fahrlander\u2026\nSALE on March 9, 2026 - Approved\nDate:03/09/2026\u2026Amount:$436.43\u2026"}
                  onChange={e => { setReceipt(e.target.value); setParsed(false); }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={handleParse} style={BTN("#059669")}>Parse</button>
                  <button type="button" onClick={clearReceipt} style={CANCEL_BTN}>Clear</button>
                </div>
              </div>
              {parsed && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#34d399", fontWeight: 600 }}>\u2713 Receipt parsed \u2014 review fields below</p>}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div><label style={LBL}>Member Name</label><input style={INP} value={form.memberName} required onChange={e => setForm(f => ({ ...f, memberName: e.target.value }))} /></div>
            <div><label style={LBL}>Member ID</label><input style={INP} value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))} /></div>
            <div><label style={LBL}>Sale Date</label><input style={INP} type="date" value={form.saleDate} required onChange={e => setForm(f => ({ ...f, saleDate: e.target.value }))} /></div>
            <div><label style={LBL}>Status</label>
              <select style={INP} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {["SUBMITTED","APPROVED","REJECTED","CANCELLED"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={LBL}>Carrier</label><input style={INP} value={form.carrier} required onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} /></div>
            <div><label style={LBL}>Premium ($)</label><input style={INP} type="number" step="0.01" min="0" value={form.premium} required onChange={e => setForm(f => ({ ...f, premium: e.target.value }))} /></div>
            <div><label style={LBL}>Effective Date</label><input style={INP} type="date" value={form.effectiveDate} required onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} /></div>
            <div><label style={LBL}>Product</label>
              <select style={INP} value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>
                {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div><label style={LBL}>Lead Source</label>
              <select style={INP} value={form.leadSourceId} onChange={e => setForm(f => ({ ...f, leadSourceId: e.target.value }))}>
                {leadSources.filter(ls => ls.active !== false).map(ls => <option key={ls.id} value={ls.id}>{ls.name}</option>)}
              </select>
            </div>
            <div><label style={LBL}>Enrollment Fee ($)</label><input style={INP} type="number" step="0.01" min="0" value={form.enrollmentFee} onChange={e => setForm(f => ({ ...f, enrollmentFee: e.target.value }))} /></div>
            <div><label style={LBL}>Notes</label><input style={INP} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>

            {parsed && (parsedInfo.parsedProducts.length > 0 || parsedInfo.coreProduct) && (
              <div style={{ gridColumn: "1/-1", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399", marginBottom: 10 }}>Parsed from Receipt</div>

                {/* Product breakdown table */}
                {parsedInfo.parsedProducts.length > 0 && (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 12 }}>
                    <thead><tr>
                      <th style={{ padding: "6px 8px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#64748b", borderBottom: "1px solid rgba(16,185,129,0.2)" }}>Product</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#64748b", borderBottom: "1px solid rgba(16,185,129,0.2)" }}>Type</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", fontSize: 11, fontWeight: 700, color: "#64748b", borderBottom: "1px solid rgba(16,185,129,0.2)" }}>Matched</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#64748b", borderBottom: "1px solid rgba(16,185,129,0.2)" }}>Price</th>
                    </tr></thead>
                    <tbody>
                      {parsedInfo.parsedProducts.map((pp, i) => {
                        const matched = matchProduct(pp.name, products);
                        return (
                          <tr key={i} style={{ borderTop: "1px solid rgba(16,185,129,0.1)" }}>
                            <td style={{ padding: "6px 8px", color: "#e2e8f0" }}>
                              {matched ? (
                                <select style={{ ...INP, padding: "4px 8px", fontSize: 12, width: "auto", minWidth: 180 }} defaultValue={matched.id} onChange={e => {
                                  if (!pp.isAddon) setForm(f => ({ ...f, productId: e.target.value }));
                                  else setForm(f => ({ ...f, addonProductIds: f.addonProductIds.map((id, idx) => idx === i - 1 ? e.target.value : id) }));
                                }}>
                                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                              ) : (
                                <span style={{ color: "#f87171" }}>{pp.name} (not matched)</span>
                              )}
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "center" }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: pp.isAddon ? "#8b5cf6" : "#3b82f6", background: pp.isAddon ? "rgba(139,92,246,0.15)" : "rgba(59,130,246,0.15)", padding: "2px 8px", borderRadius: 10 }}>
                                {pp.isAddon ? "Add-on" : "Primary"}
                              </span>
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "center" }}>
                              {matched ? <span style={{ color: "#34d399", fontWeight: 700 }}>\u2713</span> : <span style={{ color: "#f87171" }}>\u2717</span>}
                            </td>
                            <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 600, color: "#e2e8f0" }}>${pp.price}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}

                {/* Summary boxes */}
                <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                  {parsedInfo.premium && (
                    <div style={{ background: "rgba(16,185,129,0.12)", borderRadius: 8, padding: "8px 14px" }}>
                      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700 }}>PREMIUM TOTAL</span>
                      <div style={{ fontWeight: 800, fontSize: 18, color: "#34d399" }}>${parsedInfo.premium}</div>
                    </div>
                  )}
                  {parsedInfo.enrollmentFee && (
                    <div style={{ background: "rgba(251,191,36,0.12)", borderRadius: 8, padding: "8px 14px" }}>
                      <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700 }}>ENROLLMENT FEE</span>
                      <div style={{ fontWeight: 800, fontSize: 18, color: "#fbbf24" }}>${parsedInfo.enrollmentFee}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div style={{ gridColumn: "1/-1" }}>
              <label style={LBL}>Payment Type *</label>
              <div style={{ display: "flex", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: form.paymentType === "CC" ? "#60a5fa" : "#94a3b8", cursor: "pointer", fontWeight: form.paymentType === "CC" ? 700 : 400 }}>
                  <input type="radio" name="paymentType" value="CC" checked={form.paymentType === "CC"} onChange={() => setForm(f => ({ ...f, paymentType: "CC" }))} /> Credit Card
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: form.paymentType === "ACH" ? "#60a5fa" : "#94a3b8", cursor: "pointer", fontWeight: form.paymentType === "ACH" ? 700 : 400 }}>
                  <input type="radio" name="paymentType" value="ACH" checked={form.paymentType === "ACH"} onChange={() => setForm(f => ({ ...f, paymentType: "ACH" }))} /> ACH
                </label>
              </div>
            </div>

            <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 16, paddingTop: 4 }}>
              <button type="submit" style={BTN()} disabled={!form.paymentType}>Submit Sale</button>
              {msg && <span style={{ color: msg.startsWith("Sale") ? "#34d399" : "#f87171", fontWeight: 600, fontSize: 14 }}>{msg}</span>}
            </div>
          </div>
        </form>
      )}

      {/* ── Agent Tracker ── */}
      {tab === "tracker" && (() => {
        // Merge call counts into tracker by agent name
        const callCountByAgent = new Map<string, number>();
        for (const cc of callCounts) {
          callCountByAgent.set(cc.agentName, (callCountByAgent.get(cc.agentName) ?? 0) + cc.callCount);
        }
        return (
          <div style={CARD}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                {["Rank", "Agent", "Calls", "Total Sales", "Premium Total", "Cost per Sale"].map((h, i) => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: i >= 2 ? "right" : "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {[...tracker].sort((a, b) => b.salesCount - a.salesCount).map((row, i) => {
                  const agentCalls = callCountByAgent.get(row.agent) ?? 0;
                  return (
                    <tr key={row.agent} style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                      <td style={{ padding: "12px 16px", color: i === 0 ? "#fbbf24" : "#64748b", fontWeight: 700 }}>{i === 0 ? "\uD83E\uDD47" : `#${i + 1}`}</td>
                      <td style={{ padding: "12px 16px", fontWeight: 600, color: "#e2e8f0" }}>{row.agent}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#818cf8" }}>{agentCalls || "\u2014"}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#e2e8f0" }}>{row.salesCount}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#34d399", fontWeight: 700 }}>${Number(row.premiumTotal).toFixed(2)}</td>
                      <td style={{ padding: "12px 16px", textAlign: "right", color: "#fbbf24", fontWeight: 600 }}>{row.costPerSale > 0 ? `$${Number(row.costPerSale).toFixed(2)}` : "\u2014"}</td>
                    </tr>
                  );
                })}
                {tracker.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#475569" }}>No sales data yet</td></tr>}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* ── Agent Sales ── */}
      {tab === "agent-sales" && (() => {
        const getDayOfWeek = (dateStr: string) => {
          const d = new Date(dateStr + "T12:00:00");
          const jsDay = d.getDay();
          return jsDay === 0 ? 6 : jsDay - 1;
        };
        const filtered = salesDay === "all"
          ? salesList
          : salesList.filter(s => getDayOfWeek(s.saleDate.slice(0, 10)) === DAYS.indexOf(salesDay as typeof DAYS[number]));

        const byAgent = new Map<string, Sale[]>();
        for (const s of filtered) {
          const name = s.agent.name;
          if (!byAgent.has(name)) byAgent.set(name, []);
          byAgent.get(name)!.push(s);
        }

        return (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", padding: 4, background: "rgba(15,23,42,0.4)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)", width: "fit-content" }}>
              <button style={tabBtn(salesDay === "all")} onClick={() => setSalesDay("all")}>All Week</button>
              {DAYS.map(day => (
                <button key={day} style={tabBtn(salesDay === day)} onClick={() => setSalesDay(day)}>{day}</button>
              ))}
            </div>

            {byAgent.size === 0 && <div style={CARD}><p style={{ color: "#475569", margin: 0 }}>No sales for this period</p></div>}

            {[...byAgent.entries()].map(([agentName, sales]) => (
              <div key={agentName} style={{ ...CARD, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>{agentName}</h3>
                  <span style={{ fontSize: 13, color: "#64748b" }}>{sales.length} sale{sales.length !== 1 ? "s" : ""} \u00b7 <span style={{ color: "#34d399", fontWeight: 700 }}>${sales.reduce((s, x) => s + Number(x.premium), 0).toFixed(2)}</span> premium</span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead><tr>
                    {["Date", "Member", "Carrier", "Product", "Lead Source", "Premium", "Status"].map((h, i) => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: i === 5 ? "right" : i === 6 ? "center" : "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {sales.map(s => (
                      <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                        <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{new Date(s.saleDate).toLocaleDateString()}</td>
                        <td style={{ padding: "10px 12px", color: "#e2e8f0" }}>{s.memberName}{s.memberId ? ` (${s.memberId})` : ""}</td>
                        <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{s.carrier}</td>
                        <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{s.product.name}</td>
                        <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{s.leadSource.name}</td>
                        <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 700, color: "#34d399" }}>${Number(s.premium).toFixed(2)}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}><StatusBadge status={s.status} /></td>
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
      {tab === "audits" && (
        <div style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Call Audits</h3>
            <button style={BTN()} onClick={() => { authFetch(`${API}/api/call-audits`).then(r => r.ok ? r.json() : []).then(setAudits).catch(() => {}); }}>Refresh</button>
          </div>
          {audits.length === 0 && <p style={{ color: "#64748b", margin: 0 }}>No audit records yet. Audits are created automatically when Convoso sends call recordings via webhook.</p>}
          {audits.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr>
                {["Date", "Agent", "Score", "AI Summary", "Status", "Actions"].map((h, i) => (
                  <th key={h} style={{ padding: "10px 12px", textAlign: i === 2 ? "center" : "left", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {audits.map(a => {
                  const scoreColor = a.score >= 80 ? "#34d399" : a.score >= 60 ? "#fbbf24" : "#f87171";
                  const isExpanded = expandedAudit === a.id;
                  const isEditing = editingAudit === a.id;
                  return (
                    <React.Fragment key={a.id}>
                      <tr style={{ borderTop: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }} onClick={() => setExpandedAudit(isExpanded ? null : a.id)}>
                        <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{new Date(a.callDate).toLocaleDateString()}</td>
                        <td style={{ padding: "10px 12px", color: "#e2e8f0" }}>{a.agent.name}</td>
                        <td style={{ padding: "10px 12px", textAlign: "center" }}>
                          <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700, background: `${scoreColor}20`, color: scoreColor }}>{a.score}</span>
                        </td>
                        <td style={{ padding: "10px 12px", color: "#94a3b8", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.aiSummary ?? "—"}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: a.status === "ai_reviewed" ? "rgba(99,102,241,0.15)" : "rgba(52,211,153,0.15)", color: a.status === "ai_reviewed" ? "#818cf8" : "#34d399" }}>{a.status}</span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <button style={{ ...CANCEL_BTN, padding: "4px 10px", fontSize: 11 }} onClick={e => { e.stopPropagation(); setEditingAudit(isEditing ? null : a.id); setAuditEdit({ score: a.score, status: a.status, coachingNotes: a.coachingNotes ?? "" }); }}>Edit</button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr><td colSpan={6} style={{ padding: "16px 12px", background: "rgba(15,23,42,0.4)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div>
                              <div style={LBL}>AI Coaching Notes</div>
                              <p style={{ color: "#cbd5e1", fontSize: 13, margin: "4px 0 12px", lineHeight: 1.5 }}>{a.aiCoachingNotes ?? "—"}</p>
                              {a.recordingUrl && <><div style={LBL}>Recording</div><audio controls src={a.recordingUrl} style={{ width: "100%", marginTop: 4 }} /></>}
                            </div>
                            <div>
                              <div style={LBL}>Transcription</div>
                              <div style={{ color: "#94a3b8", fontSize: 12, maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap", lineHeight: 1.5, background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: 12 }}>{a.transcription ?? "No transcription available"}</div>
                            </div>
                          </div>
                        </td></tr>
                      )}
                      {isEditing && (
                        <tr><td colSpan={6} style={{ padding: "16px 12px", background: "rgba(15,23,42,0.3)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                          <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
                            <div><label style={LBL}>Score</label><input type="number" min={0} max={100} style={{ ...INP, width: 80 }} value={auditEdit.score} onChange={e => setAuditEdit(x => ({ ...x, score: Number(e.target.value) }))} /></div>
                            <div><label style={LBL}>Status</label><input style={{ ...INP, width: 140 }} value={auditEdit.status} onChange={e => setAuditEdit(x => ({ ...x, status: e.target.value }))} /></div>
                            <div style={{ flex: 1 }}><label style={LBL}>Coaching Notes</label><input style={INP} value={auditEdit.coachingNotes} onChange={e => setAuditEdit(x => ({ ...x, coachingNotes: e.target.value }))} /></div>
                            <button style={BTN("#059669")} onClick={async () => {
                              try {
                                const res = await authFetch(`${API}/api/call-audits/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(auditEdit) });
                                if (res.ok) {
                                  const updated = await res.json();
                                  setAudits(prev => prev.map(x => x.id === a.id ? updated : x));
                                  setEditingAudit(null);
                                }
                              } catch {}
                            }}>Save</button>
                            <button style={CANCEL_BTN} onClick={() => setEditingAudit(null)}>Cancel</button>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Config ── */}
      {tab === "config" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={CARD}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Agents</h3>
            {agents.map(a => <AgentRow key={a.id} agent={a} onSave={saveAgent} onDelete={deleteAgent} />)}
            <form onSubmit={addAgent} style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Add Agent</div>
              <input style={INP} value={newAgent.name} placeholder="Name *" required onChange={e => setNewAgent(x => ({ ...x, name: e.target.value }))} />
              <input style={INP} value={newAgent.email} placeholder="CRM User ID" onChange={e => setNewAgent(x => ({ ...x, email: e.target.value }))} />
              <input style={INP} value={newAgent.extension} placeholder="Tracking Extension" onChange={e => setNewAgent(x => ({ ...x, extension: e.target.value }))} />
              <button type="submit" style={BTN("#059669")}>Add Agent</button>
            </form>
          </div>

          <div style={CARD}>
            <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Lead Sources</h3>
            {leadSources.map(ls => <LeadSourceRow key={ls.id} ls={ls} onSave={saveLeadSource} onDelete={deleteLeadSource} />)}
            <form onSubmit={addLeadSource} style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", display: "grid", gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>Add Lead Source</div>
              <input style={INP} value={newLS.name} placeholder="Name *" required onChange={e => setNewLS(x => ({ ...x, name: e.target.value }))} />
              <input style={INP} value={newLS.listId} placeholder="CRM List ID" onChange={e => setNewLS(x => ({ ...x, listId: e.target.value }))} />
              <input style={{ ...INP, width: "60%" }} type="number" step="0.01" value={newLS.costPerLead} placeholder="Cost per lead ($)" onChange={e => setNewLS(x => ({ ...x, costPerLead: e.target.value }))} />
              <button type="submit" style={BTN("#059669")}>Add Lead Source</button>
            </form>
          </div>

          {cfgMsg && <div style={{ gridColumn: "1/-1", color: cfgMsg.startsWith("Error") ? "#f87171" : "#34d399", fontWeight: 600, fontSize: 14 }}>{cfgMsg}</div>}
        </div>
      )}

      {/* ── AI Prompts ── */}
      {tab === "ai-prompts" && (
        <div style={{ maxWidth: 800 }}>
          <div style={CARD}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Call Audit System Prompt</h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>
              This prompt instructs GPT-4o-mini how to evaluate call transcriptions. It should request a JSON response with score, summary, and coachingNotes fields.
            </p>
            <textarea
              style={{ ...INP, minHeight: 240, fontFamily: "monospace", fontSize: 13, lineHeight: 1.6, resize: "vertical" }}
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Enter your system prompt for AI call auditing..."
            />
            <div style={{ display: "flex", gap: 12, marginTop: 16, alignItems: "center" }}>
              <button style={BTN("#059669")} onClick={async () => {
                try {
                  setAiPromptMsg("");
                  const res = await authFetch(`${API}/api/settings/ai-audit-prompt`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: aiPrompt }) });
                  if (res.ok) setAiPromptMsg("Saved");
                  else { const err = await res.json().catch(() => ({})); setAiPromptMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
                } catch (e: any) { setAiPromptMsg(`Error: ${e.message ?? "network error"}`); }
              }}>Save Prompt</button>
              {aiPromptMsg && <span style={{ fontSize: 13, fontWeight: 600, color: aiPromptMsg.startsWith("Error") ? "#f87171" : "#34d399" }}>{aiPromptMsg}</span>}
            </div>
          </div>

          <div style={{ ...CARD, marginTop: 20 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Agent Audit Settings</h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>
              Check agents whose call recordings should be sent for AI auditing. Unchecked agents will have their recordings skipped.
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              {agents.filter(a => a.active !== false).map(a => (
                <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "8px 12px", borderRadius: 8, background: "rgba(15,23,42,0.4)", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <input
                    type="checkbox"
                    checked={!!a.auditEnabled}
                    onChange={async (e) => {
                      const val = e.target.checked;
                      setAgents(prev => prev.map(ag => ag.id === a.id ? { ...ag, auditEnabled: val } : ag));
                      try {
                        const res = await authFetch(`${API}/api/agents/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auditEnabled: val }) });
                        if (!res.ok) setAgents(prev => prev.map(ag => ag.id === a.id ? { ...ag, auditEnabled: !val } : ag));
                      } catch { setAgents(prev => prev.map(ag => ag.id === a.id ? { ...ag, auditEnabled: !val } : ag)); }
                    }}
                    style={{ width: 16, height: 16, accentColor: "#3b82f6", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0" }}>{a.name}</span>
                  {a.email && <span style={{ fontSize: 12, color: "#64748b" }}>({a.email})</span>}
                </label>
              ))}
            </div>
          </div>

          <div style={{ ...CARD, marginTop: 20 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Call Duration Filter</h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>
              Only audit calls within this duration range. Set to 0 to disable a limit.
            </p>
            <div style={{ display: "flex", gap: 16, alignItems: "end" }}>
              <div>
                <label style={LBL}>Min Seconds</label>
                <input style={{ ...INP, width: 120 }} type="number" min="0" value={auditMinSec} onChange={e => setAuditMinSec(Number(e.target.value))} />
              </div>
              <div>
                <label style={LBL}>Max Seconds</label>
                <input style={{ ...INP, width: 120 }} type="number" min="0" value={auditMaxSec} onChange={e => setAuditMaxSec(Number(e.target.value))} />
              </div>
              <button style={BTN("#059669")} onClick={async () => {
                try {
                  setAuditDurationMsg("");
                  const res = await authFetch(`${API}/api/settings/audit-duration`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ minSeconds: auditMinSec, maxSeconds: auditMaxSec }) });
                  if (res.ok) setAuditDurationMsg("Saved");
                  else { const err = await res.json().catch(() => ({})); setAuditDurationMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`); }
                } catch (e: any) { setAuditDurationMsg(`Error: ${e.message ?? "network error"}`); }
              }}>Save</button>
            </div>
            {auditDurationMsg && <span style={{ fontSize: 13, fontWeight: 600, marginTop: 8, display: "block", color: auditDurationMsg.startsWith("Error") ? "#f87171" : "#34d399" }}>{auditDurationMsg}</span>}
          </div>

          <div style={{ ...CARD, marginTop: 20 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>Webhook Configuration</h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 12px" }}>Configure Convoso to POST to this endpoint after each call:</p>
            <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 14, fontFamily: "monospace", fontSize: 13, color: "#34d399", wordBreak: "break-all" }}>
              POST {API || "https://your-api-domain.com"}/api/webhooks/convoso
            </div>
            <div style={{ marginTop: 12, fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              <div><strong style={{ color: "#94a3b8" }}>Header:</strong> x-webhook-secret: your-secret</div>
              <div><strong style={{ color: "#94a3b8" }}>Body:</strong> {`{ "agent_user": "crm-user-id", "list_id": "crm-list-id", "recording_url": "https://...", "call_timestamp": "ISO-8601", "call_duration_seconds": 120 }`}</div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
