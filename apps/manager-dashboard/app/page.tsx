"use client";
import React, { useState, useEffect, useRef, FormEvent } from "react";
import {
  PageShell,
  Badge,
  AnimatedNumber,
  EmptyState,
  ProgressRing,
  colors,
  spacing,
  radius,
  shadows,
  typography,
  motion,
  baseInputStyle,
  baseLabelStyle,
  baseButtonStyle,
} from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";
import {
  FileText,
  Users,
  BarChart3,
  Headphones,
  Settings,
  Plus,
  Edit3,
  Trash2,
  Save,
  X,
  Check,
  XCircle,
  Upload,
  ClipboardList,
  Trophy,
  Medal,
  Award,
  Filter,
  Mic,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
  Star,
  Lightbulb,
  MessageSquare,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

/* ── Types ───────────────────────────────────────────────────── */

type Tab = "entry" | "tracker" | "sales" | "audits" | "config";
type Agent = { id: string; name: string; email?: string; userId?: string; extension?: string; displayOrder: number; active?: boolean; auditEnabled?: boolean };
type Product = {
  id: string; name: string; active: boolean; type: "CORE" | "ADDON" | "AD_D";
  premiumThreshold?: number | null; commissionBelow?: number | null; commissionAbove?: number | null;
  bundledCommission?: number | null; standaloneCommission?: number | null; enrollFeeThreshold?: number | null; notes?: string | null;
};
type LeadSource = { id: string; name: string; listId?: string; costPerLead: number; active?: boolean; callBufferSeconds?: number };
type TrackerEntry = { agent: string; salesCount: number; premiumTotal: number; totalLeadCost: number; costPerSale: number };
type AuditIssue = { category: string; timestamp_hint?: string; what_happened: string; agent_quote: string; customer_quote: string; why_its_a_problem: string; recommended_response: string };
type AuditWin = { what_happened: string; agent_quote: string; why_it_worked: string };
type MissedOpportunity = { moment: string; what_should_have_happened: string; suggested_script: string };
type CoachingPriority = { priority: number; focus_area: string; talking_point: string };
type CallAudit = {
  id: string; agentId: string; callDate: string; score: number; status: string;
  coachingNotes?: string; transcription?: string; aiSummary?: string; aiScore?: number;
  aiCoachingNotes?: string; recordingUrl?: string;
  callOutcome?: string; callDurationEstimate?: string;
  issues?: AuditIssue[]; wins?: AuditWin[];
  missedOpportunities?: MissedOpportunity[];
  suggestedCoaching?: CoachingPriority[];
  managerSummary?: string;
  agent: { id: string; name: string };
};
type CallCount = { agentId: string; agentName: string; leadSourceId: string; leadSourceName: string; callCount: number; totalLeadCost: number };
type Sale = { id: string; saleDate: string; memberName: string; memberId?: string; carrier: string; premium: number; status: string; notes?: string; agent: { id: string; name: string }; product: { id: string; name: string }; leadSource: { id: string; name: string } };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/* ── Nav items ───────────────────────────────────────────────── */

const NAV_ITEMS = [
  { icon: <FileText size={18} />, label: "Sales Entry", key: "entry" },
  { icon: <Users size={18} />, label: "Agent Tracker", key: "tracker" },
  { icon: <BarChart3 size={18} />, label: "Agent Sales", key: "sales" },
  { icon: <Headphones size={18} />, label: "Call Audits", key: "audits" },
  { icon: <Settings size={18} />, label: "Config", key: "config" },
];

/* ── Style constants ─────────────────────────────────────────── */

const PODIUM_BORDERS = [
  `3px solid ${colors.gold}`,
  `3px solid ${colors.silver}`,
  `3px solid ${colors.bronze}`,
];

const INP: React.CSSProperties = {
  ...baseInputStyle,
  boxSizing: "border-box",
};

const LBL: React.CSSProperties = { ...baseLabelStyle };

const CARD: React.CSSProperties = {
  background: colors.bgSurface,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: radius.xl,
  padding: spacing[6],
};

const ICON_BTN: React.CSSProperties = {
  ...baseButtonStyle,
  padding: "6px 8px",
  background: "transparent",
  border: `1px solid ${colors.borderDefault}`,
  color: colors.textSecondary,
  borderRadius: radius.md,
  fontSize: 12,
};

const DANGER_BTN: React.CSSProperties = {
  ...baseButtonStyle,
  padding: "6px 8px",
  background: colors.dangerBg,
  border: `1px solid rgba(248,113,113,0.2)`,
  color: colors.danger,
  borderRadius: radius.md,
  fontSize: 12,
};

const SUCCESS_BTN: React.CSSProperties = {
  ...baseButtonStyle,
  padding: "8px 16px",
  background: "rgba(52,211,153,0.1)",
  border: `1px solid rgba(52,211,153,0.2)`,
  color: colors.success,
  borderRadius: radius.md,
  fontSize: 13,
  fontWeight: 600,
};

const CANCEL_BTN: React.CSSProperties = {
  ...baseButtonStyle,
  padding: "8px 16px",
  background: "rgba(30,41,59,0.5)",
  border: `1px solid ${colors.borderDefault}`,
  color: colors.textSecondary,
  borderRadius: radius.md,
  fontSize: 13,
};

const SUBMIT_BTN: React.CSSProperties = {
  ...baseButtonStyle,
  padding: "14px 32px",
  background: colors.accentGradient,
  color: "#fff",
  borderRadius: radius.xl,
  fontWeight: 700,
  fontSize: 15,
  minHeight: 48,
  boxShadow: `${shadows.glowPrimary}, 0 4px 20px rgba(20,184,166,0.3)`,
  letterSpacing: "0.02em",
  width: "100%",
};

const TH: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: colors.textTertiary,
  textTransform: "uppercase",
  letterSpacing: typography.tracking.caps,
  borderBottom: `1px solid ${colors.borderSubtle}`,
  whiteSpace: "nowrap",
};

const TD: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  color: colors.textSecondary,
  borderBottom: `1px solid ${colors.borderSubtle}`,
};

const OUTCOME_COLORS: Record<string, { bg: string; color: string }> = {
  sold: { bg: "rgba(74,222,128,0.12)", color: "#4ade80" },
  lost: { bg: "rgba(248,113,113,0.12)", color: "#f87171" },
  callback_scheduled: { bg: "rgba(251,191,36,0.12)", color: "#fbbf24" },
  not_qualified: { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" },
  incomplete: { bg: "rgba(251,146,60,0.12)", color: "#fb923c" },
};

const PRIORITY_COLORS: Record<number, { bg: string; color: string }> = {
  1: { bg: "rgba(248,113,113,0.15)", color: "#f87171" },
  2: { bg: "rgba(251,191,36,0.15)", color: "#fbbf24" },
  3: { bg: "rgba(45,212,191,0.15)", color: "#2dd4bf" },
};

const CATEGORY_LABELS: Record<string, string> = {
  missed_discovery: "Missed Discovery",
  weak_objection_handling: "Weak Objection Handling",
  missed_close_opportunity: "Missed Close",
  lost_control: "Lost Control",
  poor_rebuttal: "Poor Rebuttal",
  no_urgency: "No Urgency",
  no_tie_down: "No Tie-Down",
  talked_too_much: "Talked Too Much",
  didnt_listen: "Didn't Listen",
  compliance_concern: "Compliance",
  pricing_issue: "Pricing Issue",
  rapport_failure: "Rapport Failure",
};

const QUOTE_BLOCK: React.CSSProperties = {
  borderLeft: "3px solid rgba(45,212,191,0.4)",
  paddingLeft: 12,
  fontStyle: "italic",
  color: colors.textSecondary,
  margin: "8px 0",
  fontSize: 13,
  lineHeight: 1.6,
};

/* ── Receipt parser ──────────────────────────────────────────── */

type ParsedProduct = { name: string; price: string; isAddon: boolean; enrollmentFee?: string };
type ParseResult = {
  memberId?: string; memberName?: string; status?: string; saleDate?: string;
  premium?: string; carrier?: string; enrollmentFee?: string; addonNames: string[];
  parsedProducts: ParsedProduct[]; paymentType?: "CC" | "ACH"; memberState?: string;
};

function parseReceipt(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const t = lines.join(" ");
  const out: ParseResult = { addonNames: [], parsedProducts: [] };

  const idMatch = t.match(/(?:MemberID|ID):\s*(\d+)/);
  if (idMatch) out.memberId = idMatch[1];

  for (let i = 0; i < lines.length; i++) {
    if (/^(?:MemberID|ID):\s*\d+/.test(lines[i])) {
      const sameLine = lines[i].match(/(?:MemberID|ID):\s*\d+\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)/);
      if (sameLine) { out.memberName = sameLine[1].trim(); }
      else if (i + 1 < lines.length && /^[A-Z][a-zA-Z'-]+\s+[A-Z]/.test(lines[i + 1]) && !/^\d/.test(lines[i + 1])) {
        out.memberName = lines[i + 1].trim();
      }
      break;
    }
  }

  const st = t.match(/SALE on .+?[-\u2013]\s*(Approved|Rejected|Cancelled|Submitted)/i);
  if (st) out.status = st[1].toUpperCase();

  const dt = t.match(/Date:\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (dt) out.saleDate = `${dt[3]}-${dt[1]}-${dt[2]}`;

  const am = t.match(/Amount:\s*\$?([\d,]+\.?\d*)/);
  if (am) out.premium = am[1].replace(/,/g, "");

  let totalEnrollment = 0;
  const productsIdx = lines.findIndex(l => /^Products$/i.test(l));
  if (productsIdx >= 0) {
    const productLines: string[] = [];
    for (let i = productsIdx + 1; i < lines.length; i++) {
      if (/^Total\s+\$/.test(lines[i]) || /^Payment$/i.test(lines[i])) break;
      productLines.push(lines[i]);
    }
    const joined = productLines.join(" ");
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
      const nameMatch = bt.match(/^([A-Za-z][A-Za-z0-9&\s/+'.()-]+?)(?:\s+(?:Individual|Family|Employee|Member)\b|\s+-\s+ID:)/i);
      if (nameMatch) {
        const rawName = nameMatch[1].trim();
        const isAddon = /[-\u2013]\s*Add-on/i.test(rawName) || /\bAdd-on\b/i.test(rawName);
        const cleanName = rawName.replace(/\s*[-\u2013]\s*Add-on\s*/gi, "").replace(/\s+Add-on\s*/gi, "").trim();
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
    const primary = out.parsedProducts.find(p => !p.isAddon);
    if (primary) out.carrier = primary.name;
  }

  if (totalEnrollment > 0) out.enrollmentFee = totalEnrollment.toFixed(2);

  const payType = t.match(/Payment\s+Type:\s*(\w+)/i) || t.match(/Type:\s*(BANK|CARD|CC|ACH|CREDIT)/i);
  if (payType) {
    const pt = payType[1].toUpperCase();
    out.paymentType = (pt === "BANK" || pt === "ACH") ? "ACH" : "CC";
  }

  if (!out.memberName && !out.memberId) {
    const mid = t.match(/MemberID:\s*(\d+)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)/);
    if (mid) { out.memberId = mid[1]; out.memberName = mid[2].trim(); }
  }

  const stateMatch = t.match(/,\s*([A-Z]{2})\s+\d{5}/);
  if (stateMatch) out.memberState = stateMatch[1];

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
  const exact = products.find(p => p.name.toLowerCase() === lower);
  if (exact) return exact;
  const wordMatch = products.find(p => {
    const pn = p.name.toLowerCase();
    const re1 = new RegExp(`\\b${pn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    const re2 = new RegExp(`\\b${lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    return re1.test(lower) || re2.test(pn);
  });
  if (wordMatch) return wordMatch;
  const subs = products.filter(p => {
    const pn = p.name.toLowerCase();
    return pn.includes(lower) || lower.includes(pn);
  });
  if (subs.length > 0) return subs.sort((a, b) => b.name.length - a.name.length)[0];
  return undefined;
}

/* ── Status Badge ────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: colors.success,
    REJECTED: colors.danger,
    CANCELLED: colors.textSecondary,
    SUBMITTED: colors.warning,
  };
  const c = map[status] ?? colors.warning;
  return <Badge color={c} variant="subtle" size="sm" dot>{status}</Badge>;
}

/* ── AgentRow component ──────────────────────────────────────── */

function AgentRow({ agent, onSave, onDelete }: {
  agent: Agent;
  onSave: (id: string, data: Partial<Agent>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [d, setD] = useState({ name: agent.name, email: agent.email ?? "", extension: agent.extension ?? "" });
  const [saving, setSaving] = useState(false);

  if (edit) {
    return (
      <div className="animate-fade-in" style={{ padding: "14px 0", borderBottom: `1px solid ${colors.borderSubtle}`, display: "grid", gap: 8 }}>
        <input className="input-focus" style={INP} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
        <input className="input-focus" style={INP} value={d.email} placeholder="CRM User ID" onChange={e => setD(x => ({ ...x, email: e.target.value }))} />
        <input className="input-focus" style={INP} value={d.extension} placeholder="Tracking Extension" onChange={e => setD(x => ({ ...x, extension: e.target.value }))} />
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-hover" disabled={saving} style={SUCCESS_BTN} onClick={async () => {
            setSaving(true); await onSave(agent.id, d); setEdit(false); setSaving(false);
          }}>
            <Save size={14} />{saving ? "Saving..." : "Save"}
          </button>
          <button className="btn-hover" style={CANCEL_BTN} onClick={() => setEdit(false)}>
            <X size={14} />Cancel
          </button>
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
        <button className="btn-hover" style={SUCCESS_BTN} onClick={() => onSave(agent.id, { active: true })} title="Reactivate agent">
          Reactivate
        </button>
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
          <div className="animate-fade-in" style={{ display: "flex", gap: 6, alignItems: "center", background: colors.dangerBg, border: `1px solid rgba(248,113,113,0.25)`, borderRadius: radius.md, padding: "6px 10px" }}>
            <span style={{ fontSize: 12, color: colors.danger, fontWeight: 600 }}>Remove agent?</span>
            <button className="btn-hover" style={{ ...DANGER_BTN, padding: "4px 10px" }} onClick={() => { onDelete(agent.id); setConfirmDelete(false); }}>Yes</button>
            <button className="btn-hover" style={{ ...CANCEL_BTN, padding: "4px 10px" }} onClick={() => setConfirmDelete(false)}>No</button>
          </div>
        ) : (
          <>
            <button className="btn-hover" style={ICON_BTN} onClick={() => setEdit(true)} title="Edit agent">
              <Edit3 size={13} />
            </button>
            <button className="btn-hover" style={DANGER_BTN} onClick={() => setConfirmDelete(true)} title="Delete agent">
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── LeadSourceRow component ─────────────────────────────────── */

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
        <input className="input-focus" style={INP} value={d.name} placeholder="Name" onChange={e => setD(x => ({ ...x, name: e.target.value }))} />
        <input className="input-focus" style={INP} value={d.listId} placeholder="CRM List ID" onChange={e => setD(x => ({ ...x, listId: e.target.value }))} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input className="input-focus" style={INP} type="number" step="0.01" value={d.costPerLead} placeholder="Cost per lead" onChange={e => setD(x => ({ ...x, costPerLead: e.target.value }))} />
          <input className="input-focus" style={INP} type="number" min="0" value={d.callBufferSeconds} placeholder="Call buffer (s)" onChange={e => setD(x => ({ ...x, callBufferSeconds: e.target.value }))} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-hover" disabled={saving} style={SUCCESS_BTN} onClick={async () => {
            setSaving(true);
            await onSave(ls.id, { ...d, costPerLead: Number(d.costPerLead), callBufferSeconds: Number(d.callBufferSeconds) });
            setEdit(false); setSaving(false);
          }}>
            <Save size={14} />{saving ? "Saving..." : "Save"}
          </button>
          <button className="btn-hover" style={CANCEL_BTN} onClick={() => setEdit(false)}>
            <X size={14} />Cancel
          </button>
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
            <button className="btn-hover" style={{ ...DANGER_BTN, padding: "4px 10px" }} onClick={() => { onDelete(ls.id); setConfirmDelete(false); }}>Yes</button>
            <button className="btn-hover" style={{ ...CANCEL_BTN, padding: "4px 10px" }} onClick={() => setConfirmDelete(false)}>No</button>
          </div>
        ) : (
          <>
            <button className="btn-hover" style={ICON_BTN} onClick={() => setEdit(true)} title="Edit lead source">
              <Edit3 size={13} />
            </button>
            <button className="btn-hover" style={DANGER_BTN} onClick={() => setConfirmDelete(true)} title="Delete lead source">
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ── ProductRow component ────────────────────────────────────── */

const TYPE_LABELS: Record<string, string> = { CORE: "Core", ADDON: "Add-on", AD_D: "AD&D" };
const TYPE_COLORS: Record<string, string> = { CORE: colors.primary400, ADDON: colors.info, AD_D: colors.warning };

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
            <span>Threshold: ${Number(product.premiumThreshold).toFixed(2)} \u00b7 Below: {product.commissionBelow ?? "\u2014"}% \u00b7 Above: {product.commissionAbove ?? "\u2014"}%</span>
          )}
          {product.type !== "CORE" && (
            <span>Bundled: {product.bundledCommission ?? "\u2014"}% \u00b7 Standalone: {product.standaloneCommission ?? "\u2014"}%</span>
          )}
          {product.notes && <span style={{ marginLeft: 8, fontStyle: "italic", color: colors.textMuted }}>{product.notes}</span>}
        </div>
      </div>
      <button className="btn-hover" style={{ ...ICON_BTN, flexShrink: 0, marginLeft: 12 }} onClick={() => setEdit(true)}>
        <Edit3 size={13} />
      </button>
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ padding: "16px 0", borderBottom: `1px solid ${colors.borderSubtle}`, display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr auto", gap: 8, alignItems: "end" }}>
        <div><label style={LBL}>Name</label><input className="input-focus" style={INP} value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} /></div>
        <div><label style={LBL}>Type</label>
          <select className="input-focus" style={{ ...INP, height: 42 }} value={d.type} onChange={e => setD(x => ({ ...x, type: e.target.value as Product["type"] }))}>
            <option value="CORE">Core</option><option value="ADDON">Add-on</option><option value="AD_D">AD&D</option>
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, paddingBottom: 4, color: colors.textSecondary, cursor: "pointer" }}>
          <input type="checkbox" checked={d.active} onChange={e => setD(x => ({ ...x, active: e.target.checked }))} /> Active
        </label>
      </div>
      {isCore ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div><label style={LBL}>Premium Threshold ($)</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.premiumThreshold} placeholder="e.g. 300" onChange={e => setD(x => ({ ...x, premiumThreshold: e.target.value }))} /></div>
          <div><label style={LBL}>Commission Below (%)</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.commissionBelow} placeholder="e.g. 25" onChange={e => setD(x => ({ ...x, commissionBelow: e.target.value }))} /></div>
          <div><label style={LBL}>Commission Above (%)</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.commissionAbove} placeholder="e.g. 30" onChange={e => setD(x => ({ ...x, commissionAbove: e.target.value }))} /></div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <div><label style={LBL}>Bundled Commission (%)</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.bundledCommission} placeholder={d.type === "AD_D" ? "e.g. 70" : "e.g. 30"} onChange={e => setD(x => ({ ...x, bundledCommission: e.target.value }))} /></div>
          <div><label style={LBL}>Standalone Commission (%)</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.standaloneCommission} placeholder={d.type === "AD_D" ? "e.g. 35" : "e.g. 30"} onChange={e => setD(x => ({ ...x, standaloneCommission: e.target.value }))} /></div>
          <div><label style={LBL}>Enroll Fee Threshold ($)</label><input className="input-focus" style={INP} type="number" step="0.01" value={d.enrollFeeThreshold} placeholder="e.g. 50" onChange={e => setD(x => ({ ...x, enrollFeeThreshold: e.target.value }))} /></div>
        </div>
      )}
      <div><label style={LBL}>Notes</label><input className="input-focus" style={INP} value={d.notes} placeholder="Optional notes" onChange={e => setD(x => ({ ...x, notes: e.target.value }))} /></div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn-hover" disabled={saving} style={SUCCESS_BTN} onClick={async () => {
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
        </button>
        <button className="btn-hover" style={CANCEL_BTN} onClick={() => setEdit(false)}>
          <X size={14} />Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Section header helper ───────────────────────────────────── */

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

/* ── Main page ───────────────────────────────────────────────── */

export default function ManagerDashboard() {
  const [tab, setTab] = useState<Tab>("entry");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [tracker, setTracker] = useState<TrackerEntry[]>([]);
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [salesDay, setSalesDay] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [submitting, setSubmitting] = useState(false);

  const blankForm = () => ({
    saleDate: new Date().toISOString().slice(0, 10),
    agentId: "", memberName: "", memberId: "", carrier: "", productId: "",
    premium: "", effectiveDate: "", leadSourceId: "", enrollmentFee: "",
    addonProductIds: [] as string[], status: "SUBMITTED", notes: "",
    paymentType: "" as "CC" | "ACH" | "", memberState: "",
  });
  const [form, setForm] = useState(blankForm());
  const [addonPremiums, setAddonPremiums] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState("");
  const [parsed, setParsed] = useState(false);

  const [newAgent, setNewAgent] = useState({ name: "", email: "", extension: "" });
  const [newLS, setNewLS] = useState({ name: "", listId: "", costPerLead: "" });
  const [cfgMsg, setCfgMsg] = useState("");

  const [audits, setAudits] = useState<CallAudit[]>([]);
  const [auditsLoaded, setAuditsLoaded] = useState(false);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const [editingAudit, setEditingAudit] = useState<string | null>(null);
  const [auditEdit, setAuditEdit] = useState({ score: 0, status: "", coachingNotes: "", callOutcome: "", managerSummary: "" });
  const [processingCalls, setProcessingCalls] = useState<Array<{ callLogId: string; agentName: string; status?: string; attempt?: number }>>([]);
  const [transcriptOpen, setTranscriptOpen] = useState<string | null>(null);

  const [callCounts, setCallCounts] = useState<CallCount[]>([]);
  const [callCountsLoaded, setCallCountsLoaded] = useState(false);

  const [parsedInfo, setParsedInfo] = useState<{
    enrollmentFee?: string; premium?: string; coreProduct?: string;
    parsedProducts: ParsedProduct[];
    addons: { name: string; matched: boolean; productName?: string; productId?: string }[];
  }>({ addons: [], parsedProducts: [] });

  useEffect(() => {
    captureTokenFromUrl();
    Promise.all([
      authFetch(`${API}/api/agents?all=true`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/products`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/lead-sources`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/tracker/summary`).then(r => r.ok ? r.json() : []).catch(() => []),
      authFetch(`${API}/api/sales?range=week`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([a, p, ls, tr, sl]) => {
      setAgents(a); setProducts(p); setLeadSources(ls); setTracker(tr); setSalesList(sl);
      setForm(f => ({ ...f, agentId: "", productId: p[0]?.id ?? "", leadSourceId: ls[0]?.id ?? "" }));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (tab === "audits" && !auditsLoaded) {
      authFetch(`${API}/api/call-audits`).then(r => r.ok ? r.json() : []).then(setAudits).catch(() => {});
      setAuditsLoaded(true);
    }
    if (tab === "tracker" && !callCountsLoaded) {
      authFetch(`${API}/api/call-counts?range=week`).then(r => r.ok ? r.json() : []).then(setCallCounts).catch(() => {});
      setCallCountsLoaded(true);
    }
  }, [tab]);

  useEffect(() => {
    if (tab !== "audits") return;
    let socket: any = null;
    import("socket.io-client").then(({ io }) => {
      socket = io(API, { transports: ["websocket", "polling"] });
      socket.on("processing_started", (data: { callLogId: string; agentName: string }) => {
        setProcessingCalls(prev => [...prev, data]);
      });
      socket.on("audit_status", (data: { callLogId: string; status: string; attempt?: number }) => {
        setProcessingCalls(prev => prev.map(p => p.callLogId === data.callLogId ? { ...p, status: data.status, attempt: data.attempt } : p));
      });
      socket.on("new_audit", (audit: CallAudit) => {
        setProcessingCalls(prev => prev.filter(p => p.callLogId !== audit.id));
        setAudits(prev => [audit, ...prev.filter(a => a.id !== audit.id)]);
      });
      socket.on("processing_failed", (data: { callLogId: string; error: string }) => {
        setProcessingCalls(prev => prev.filter(p => p.callLogId !== data.callLogId));
      });
    });
    return () => { socket?.disconnect(); };
  }, [tab]);

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
    setAddonPremiums({});
    setForm(f => ({ ...blankForm(), agentId: f.agentId, productId: f.productId, leadSourceId: f.leadSourceId }));
  }

  async function submitSale(e: FormEvent) {
    e.preventDefault(); setMsg(null); setSubmitting(true);
    try {
      const addonPremiumsPayload = form.addonProductIds.reduce((acc, id) => {
        if (addonPremiums[id]) acc[id] = Number(addonPremiums[id]);
        return acc;
      }, {} as Record<string, number>);
      const res = await authFetch(`${API}/api/sales`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          premium: Number(form.premium),
          enrollmentFee: form.enrollmentFee ? Number(form.enrollmentFee) : null,
          paymentType: form.paymentType || undefined,
          memberState: form.memberState || undefined,
          addonPremiums: addonPremiumsPayload,
        }),
      });
      if (res.ok) {
        setMsg({ text: "Sale submitted successfully", type: "success" });
        clearTimeout(msgTimerRef.current);
        msgTimerRef.current = setTimeout(() => setMsg(null), 5000);
        clearReceipt();
        authFetch(`${API}/api/tracker/summary`).then(r => r.ok ? r.json() : []).then(setTracker).catch(() => {});
        authFetch(`${API}/api/sales?range=week`).then(r => r.ok ? r.json() : []).then(setSalesList).catch(() => {});
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ text: `Failed to create sale (${res.status}): ${err.error ?? "Unknown error"}`, type: "error" });
      }
    } catch (e: any) {
      setMsg({ text: `Unable to reach API server \u2014 ${e.message ?? "network error"}`, type: "error" });
    } finally {
      setSubmitting(false);
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

  async function deleteSale(id: string) {
    if (!window.confirm("Permanently delete this sale? This removes it from payroll and tracking.")) return;
    try {
      const res = await authFetch(`${API}/api/sales/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSalesList(prev => prev.filter(s => s.id !== id));
        authFetch(`${API}/api/tracker/summary`).then(r => r.ok ? r.json() : []).then(setTracker).catch(() => {});
        setMsg({ text: "Sale deleted", type: "success" });
        clearTimeout(msgTimerRef.current);
        msgTimerRef.current = setTimeout(() => setMsg(null), 5000);
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ text: `Failed to delete sale (${res.status}): ${err.error ?? "Unknown error"}`, type: "error" });
      }
    } catch (e: any) { setMsg({ text: `Unable to reach API \u2014 ${e.message ?? "network error"}`, type: "error" }); }
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
      if (res.ok || res.status === 204) { setLeadSources(prev => prev.filter(x => x.id !== id)); setCfgMsg("Lead source deleted"); }
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

  if (loading) {
    return (
      <PageShell title="Manager Dashboard" navItems={NAV_ITEMS} activeNav={tab} onNavChange={k => setTab(k as Tab)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 64, borderRadius: radius.xl, background: colors.bgSurfaceRaised, animation: "pulse 1.5s ease-in-out infinite", opacity: 0.6 }} />
          ))}
        </div>
      </PageShell>
    );
  }

  /* ── Tab content ─────────────────────────────────────────────── */

  return (
    <PageShell
      title="Manager Dashboard"
      subtitle="Sales operations and team management"
      navItems={NAV_ITEMS}
      activeNav={tab}
      onNavChange={k => setTab(k as Tab)}
    >

      {/* ── Sales Entry ────────────────────────────────────────────── */}
      {tab === "entry" && (
        <div className="animate-fade-in" style={{ maxWidth: 900 }}>
          {msg && (
            <div className="animate-fade-in-up" style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: radius.xl,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              background: msg.type === "success" ? colors.successBg : colors.dangerBg,
              border: `1px solid ${msg.type === "success" ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
              color: msg.type === "success" ? colors.success : colors.danger,
            }}>
              {msg.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              {msg.text}
            </div>
          )}
          <form onSubmit={submitSale}>
            {/* Top row: Agent + Receipt */}
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, marginBottom: 20 }} className="stack-mobile">

              {/* Agent selector */}
              <div>
                <label style={LBL}>Agent</label>
                <select
                  className="input-focus"
                  style={{ ...INP, height: 42 }}
                  value={form.agentId}
                  onChange={e => setForm(f => ({ ...f, agentId: e.target.value }))}
                >
                  <option value="" disabled>Select agent...</option>
                  {agents.filter(a => a.active !== false).map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Receipt paste area */}
              <div>
                <label style={LBL}>Paste Sale Receipt</label>
                <div style={{ position: "relative" }}>
                  <textarea
                    className="input-focus"
                    style={{
                      ...INP,
                      height: 100,
                      resize: "vertical",
                      fontFamily: typography.fontMono,
                      fontSize: 12,
                      borderStyle: "dashed",
                      borderWidth: 2,
                      borderColor: parsed ? colors.success : colors.borderStrong,
                      borderRadius: radius.xl,
                      paddingRight: parsed ? 40 : 14,
                    } as React.CSSProperties}
                    value={receipt}
                    placeholder={"MemberID: 686724349 Marc Fahrlander\u2026\nSALE on March 9, 2026 - Approved\nDate:03/09/2026\u2026Amount:$436.43\u2026"}
                    onChange={e => { setReceipt(e.target.value); setParsed(false); }}
                  />
                  {parsed && (
                    <div style={{ position: "absolute", top: 10, right: 12, color: colors.success }}>
                      <CheckCircle size={18} />
                    </div>
                  )}
                  {!receipt && (
                    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none", color: colors.textMuted, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, opacity: 0.5 }}>
                      <ClipboardList size={28} />
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn-hover" onClick={handleParse} style={{ ...SUCCESS_BTN }}>
                    <Upload size={14} />Parse Receipt
                  </button>
                  {receipt && (
                    <button type="button" className="btn-hover" style={CANCEL_BTN} onClick={clearReceipt}>
                      <X size={14} />Clear
                    </button>
                  )}
                </div>
                {parsed && (
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: colors.success, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <Check size={13} />Receipt parsed successfully — review fields below
                  </p>
                )}
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, marginBottom: 20 }} />

            {/* Form fields grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="grid-mobile-1">
              <div className="animate-fade-in-up stagger-1">
                <label style={LBL}>Member Name</label>
                <input className="input-focus" style={INP} value={form.memberName} required onChange={e => setForm(f => ({ ...f, memberName: e.target.value }))} />
              </div>
              <div className="animate-fade-in-up stagger-2">
                <label style={LBL}>Member ID</label>
                <input className="input-focus" style={INP} value={form.memberId} onChange={e => setForm(f => ({ ...f, memberId: e.target.value }))} />
              </div>
              <div className="animate-fade-in-up stagger-3">
                <label style={LBL}>Sale Date</label>
                <input className="input-focus" style={INP} type="date" value={form.saleDate} required onChange={e => setForm(f => ({ ...f, saleDate: e.target.value }))} />
              </div>
              <div className="animate-fade-in-up stagger-4">
                <label style={LBL}>Status</label>
                <select className="input-focus" style={{ ...INP }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                  {["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="animate-fade-in-up stagger-5">
                <label style={LBL}>Carrier</label>
                <input className="input-focus" style={INP} value={form.carrier} required onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))} />
              </div>
              <div className="animate-fade-in-up stagger-6">
                <label style={LBL}>Premium ($)</label>
                <input className="input-focus" style={INP} type="number" step="0.01" min="0" value={form.premium} required onChange={e => setForm(f => ({ ...f, premium: e.target.value }))} />
              </div>
              <div className="animate-fade-in-up stagger-7">
                <label style={LBL}>Effective Date</label>
                <input className="input-focus" style={INP} type="date" value={form.effectiveDate} required onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} />
              </div>
              <div className="animate-fade-in-up stagger-8">
                <label style={LBL}>Product</label>
                <select className="input-focus" style={{ ...INP }} value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {/* Add-on Products */}
              {(() => {
                const addonProducts = products.filter(p => p.active && (p.type === "ADDON" || p.type === "AD_D") && p.id !== form.productId);
                return (
                  <div className="animate-fade-in-up stagger-9" style={{ gridColumn: "1/-1" }}>
                    <label style={LBL}>Add-on Products</label>
                    <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: radius.lg, padding: spacing[3] }}>
                      {addonProducts.length === 0 ? (
                        <span style={{ fontSize: 13, color: colors.textTertiary }}>No add-on products available</span>
                      ) : (
                        addonProducts.map(ap => {
                          const isChecked = form.addonProductIds.includes(ap.id);
                          return (
                            <div key={ap.id}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  style={{ accentColor: colors.primary400 }}
                                  onChange={e => {
                                    if (e.target.checked) {
                                      setForm(f => ({ ...f, addonProductIds: [...f.addonProductIds, ap.id] }));
                                    } else {
                                      setForm(f => ({ ...f, addonProductIds: f.addonProductIds.filter(id => id !== ap.id) }));
                                      setAddonPremiums(prev => { const next = { ...prev }; delete next[ap.id]; return next; });
                                    }
                                  }}
                                />
                                <span style={{ fontSize: 13, color: colors.textPrimary, flex: 1 }}>{ap.name}</span>
                                <Badge color={ap.type === "AD_D" ? colors.warning : colors.info} variant="subtle" size="sm">
                                  {ap.type === "AD_D" ? "AD&D" : "ADDON"}
                                </Badge>
                              </div>
                              {isChecked && (
                                <div style={{ paddingLeft: 28, paddingBottom: 6 }}>
                                  <input
                                    className="input-focus"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="Addon premium ($)"
                                    value={addonPremiums[ap.id] ?? ""}
                                    onChange={e => setAddonPremiums(prev => ({ ...prev, [ap.id]: e.target.value }))}
                                    style={{ ...INP, width: 160 }}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="animate-fade-in-up stagger-10">
                <label style={LBL}>Lead Source</label>
                <select className="input-focus" style={{ ...INP }} value={form.leadSourceId} onChange={e => setForm(f => ({ ...f, leadSourceId: e.target.value }))}>
                  {leadSources.filter(ls => ls.active !== false).map(ls => (
                    <option key={ls.id} value={ls.id}>{ls.name}</option>
                  ))}
                </select>
              </div>
              <div className="animate-fade-in-up stagger-11">
                <label style={LBL}>Enrollment Fee ($)</label>
                <input className="input-focus" style={INP} type="number" step="0.01" min="0" value={form.enrollmentFee} onChange={e => setForm(f => ({ ...f, enrollmentFee: e.target.value }))} />
              </div>
              <div>
                <label style={LBL}>Notes</label>
                <input className="input-focus" style={INP} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label style={LBL}>Member State</label>
                <input className="input-focus" style={INP} value={form.memberState} maxLength={2} placeholder="e.g. FL" onChange={e => setForm(f => ({ ...f, memberState: e.target.value.toUpperCase() }))} />
              </div>

              {/* Parsed receipt info card */}
              {parsed && (parsedInfo.parsedProducts.length > 0 || parsedInfo.coreProduct) && (
                <div className="animate-slide-in-right" style={{
                  gridColumn: "1/-1",
                  background: colors.successBg,
                  border: `1px solid rgba(52,211,153,0.2)`,
                  borderLeft: `3px solid ${colors.success}`,
                  borderRadius: radius.xl,
                  padding: spacing[5],
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <CheckCircle size={16} color={colors.success} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: colors.success }}>Parsed from Receipt</span>
                  </div>

                  {/* Product matching table */}
                  {parsedInfo.parsedProducts.length > 0 && (
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 16 }}>
                      <thead>
                        <tr>
                          {["Product", "Type", "Matched", "Price"].map((h, i) => (
                            <th key={h} style={{ ...TH, textAlign: i === 2 ? "center" : i === 3 ? "right" : "left", borderBottom: `1px solid rgba(52,211,153,0.2)`, color: colors.textTertiary }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedInfo.parsedProducts.map((pp, i) => {
                          const matched = matchProduct(pp.name, products);
                          return (
                            <tr key={i} style={{ borderTop: `1px solid rgba(52,211,153,0.08)` }}>
                              <td style={{ ...TD, color: colors.textPrimary, borderBottom: "none" }}>
                                {matched ? (
                                  <select
                                    className="input-focus"
                                    style={{ ...INP, padding: "4px 8px", fontSize: 12, width: "auto", minWidth: 180, background: colors.bgSurfaceInset }}
                                    defaultValue={matched.id}
                                    onChange={e => {
                                      if (!pp.isAddon) setForm(f => ({ ...f, productId: e.target.value }));
                                      else setForm(f => ({ ...f, addonProductIds: f.addonProductIds.map((id, idx) => idx === i - 1 ? e.target.value : id) }));
                                    }}
                                  >
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                ) : (
                                  <span style={{ color: colors.danger }}>{pp.name} (not matched)</span>
                                )}
                              </td>
                              <td style={{ ...TD, textAlign: "center", borderBottom: "none" }}>
                                <Badge color={pp.isAddon ? colors.info : colors.primary400} variant="subtle" size="sm">
                                  {pp.isAddon ? "Add-on" : "Primary"}
                                </Badge>
                              </td>
                              <td style={{ ...TD, textAlign: "center", borderBottom: "none" }}>
                                {matched
                                  ? <Check size={14} color={colors.success} />
                                  : <XCircle size={14} color={colors.danger} />}
                              </td>
                              <td style={{ ...TD, textAlign: "right", fontWeight: 600, color: colors.textPrimary, borderBottom: "none" }}>${pp.price}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {/* Summary boxes */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {parsedInfo.premium && (
                      <div style={{ background: "rgba(16,185,129,0.12)", borderRadius: radius.xl, padding: "10px 18px", border: `1px solid rgba(52,211,153,0.15)`, minWidth: 120 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: colors.textTertiary, letterSpacing: typography.tracking.caps, textTransform: "uppercase", marginBottom: 4 }}>PREMIUM TOTAL</div>
                        <div style={{ fontWeight: 900, fontSize: 22, background: "linear-gradient(135deg, #34d399, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties}>
                          <AnimatedNumber value={Number(parsedInfo.premium)} prefix="$" decimals={2} />
                        </div>
                      </div>
                    )}
                    {parsedInfo.enrollmentFee && (
                      <div style={{ background: colors.warningBg, borderRadius: radius.xl, padding: "10px 18px", border: `1px solid rgba(251,191,36,0.15)`, minWidth: 140 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: colors.textTertiary, letterSpacing: typography.tracking.caps, textTransform: "uppercase", marginBottom: 4 }}>ENROLLMENT FEE</div>
                        <div style={{ fontWeight: 900, fontSize: 22, background: "linear-gradient(135deg, #fbbf24, #f59e0b)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties}>
                          <AnimatedNumber value={Number(parsedInfo.enrollmentFee)} prefix="$" decimals={2} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Payment type selector */}
              <div style={{ gridColumn: "1/-1", borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 18 }}>
                <label style={LBL}>Payment Type *</label>
                <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
                  {(["CC", "ACH"] as const).map(pt => (
                    <label
                      key={pt}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 20px",
                        borderRadius: radius.xl,
                        border: form.paymentType === pt
                          ? `2px solid ${colors.primary500}`
                          : `2px solid ${colors.borderDefault}`,
                        background: form.paymentType === pt
                          ? `rgba(20,184,166,0.1)`
                          : "transparent",
                        cursor: "pointer",
                        transition: `all ${motion.duration.fast} ${motion.easing.out}`,
                        color: form.paymentType === pt ? colors.primary300 : colors.textSecondary,
                        fontWeight: form.paymentType === pt ? 700 : 500,
                        fontSize: 14,
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="radio"
                        name="paymentType"
                        value={pt}
                        checked={form.paymentType === pt}
                        onChange={() => setForm(f => ({ ...f, paymentType: pt }))}
                        style={{ accentColor: colors.primary500 }}
                      />
                      {pt === "CC" ? "Credit Card" : "ACH / Bank"}
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit row */}
              <div style={{ gridColumn: "1/-1", paddingTop: 8 }}>
                <button
                  type="submit"
                  className="btn-hover"
                  style={{ ...SUBMIT_BTN, opacity: (!form.paymentType || submitting) ? 0.6 : 1 }}
                  disabled={!form.paymentType || submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
                      Submitting...
                    </>
                  ) : (
                    <>Submit Sale</>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── Agent Tracker ─────────────────────────────────────────── */}
      {tab === "tracker" && (() => {
        const callCountByAgent = new Map<string, number>();
        for (const cc of callCounts) {
          callCountByAgent.set(cc.agentName, (callCountByAgent.get(cc.agentName) ?? 0) + cc.callCount);
        }
        const sorted = [...tracker].sort((a, b) => b.salesCount - a.salesCount);
        return (
          <div className="animate-fade-in" style={{ ...CARD }}>
            <SectionHeader icon={<Trophy size={18} />} title="Agent Performance" count={sorted.length} />
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Rank", "Agent", "Calls", "Sales", "Premium Total", "Cost / Sale"].map((h, i) => (
                      <th key={h} style={{ ...TH, textAlign: i >= 2 ? "right" : "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row, i) => {
                    const agentCalls = callCountByAgent.get(row.agent) ?? 0;
                    const isTop = i < 3;
                    const rankIcon = i === 0 ? <Trophy size={15} color={colors.gold} /> : i === 1 ? <Medal size={15} color={colors.silver} /> : i === 2 ? <Award size={15} color={colors.bronze} /> : null;
                    return (
                      <tr
                        key={row.agent}
                        className={`animate-fade-in-up stagger-${Math.min(i + 1, 10)} row-hover`}
                        style={{
                          borderLeft: PODIUM_BORDERS[i] ?? "3px solid transparent",
                          background: isTop ? `rgba(${i === 0 ? "251,191,36" : i === 1 ? "148,163,184" : "205,127,50"},0.03)` : "transparent",
                        }}
                      >
                        <td style={{ ...TD, fontWeight: 700 }}>
                          {rankIcon ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {rankIcon}
                              {i < 3 && (
                                <Badge
                                  color={i === 0 ? colors.gold : i === 1 ? colors.silver : colors.bronze}
                                  variant="subtle"
                                  size="sm"
                                >
                                  #{i + 1}
                                </Badge>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: colors.textMuted }}>#{i + 1}</span>
                          )}
                        </td>
                        <td style={{ ...TD, fontWeight: isTop ? 700 : 500, color: isTop ? colors.textPrimary : colors.textSecondary, fontSize: isTop ? 14 : 13 }}>
                          {row.agent}
                        </td>
                        <td style={{ ...TD, textAlign: "right", color: colors.primary400, fontWeight: 600 }}>
                          {agentCalls ? <AnimatedNumber value={agentCalls} /> : <span style={{ color: colors.textMuted }}>\u2014</span>}
                        </td>
                        <td style={{ ...TD, textAlign: "right", fontWeight: isTop ? 700 : 400, color: colors.textPrimary }}>
                          <AnimatedNumber value={row.salesCount} />
                        </td>
                        <td style={{ ...TD, textAlign: "right" }}>
                          <span style={{ fontWeight: 800, fontSize: isTop ? 16 : 14, background: "linear-gradient(135deg, #34d399, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties}>
                            <AnimatedNumber value={Number(row.premiumTotal)} prefix="$" decimals={2} />
                          </span>
                        </td>
                        <td style={{ ...TD, textAlign: "right", color: colors.warning, fontWeight: 600 }}>
                          {row.costPerSale > 0
                            ? <AnimatedNumber value={Number(row.costPerSale)} prefix="$" decimals={2} />
                            : <span style={{ color: colors.textMuted }}>\u2014</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {tracker.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState icon={<BarChart3 size={32} />} title="No sales data yet" description="Sales will appear here once agents submit entries." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── Agent Sales ───────────────────────────────────────────── */}
      {tab === "sales" && (() => {
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
          <div className="animate-fade-in">
            {/* Day filter pills */}
            <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
              {["all", ...DAYS].map(day => (
                <button
                  key={day}
                  className="btn-hover"
                  style={{
                    padding: "6px 14px",
                    borderRadius: radius.full,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: salesDay === day ? 700 : 500,
                    background: salesDay === day ? colors.primary500 : "rgba(30,41,59,0.5)",
                    color: salesDay === day ? "#fff" : colors.textTertiary,
                    transition: `all ${motion.duration.fast} ${motion.easing.out}`,
                  }}
                  onClick={() => setSalesDay(day)}
                >
                  {day === "all" ? "All Week" : day}
                </button>
              ))}
            </div>

            {byAgent.size === 0 && (
              <div style={CARD}>
                <EmptyState icon={<BarChart3 size={32} />} title="No sales for this period" description="Try selecting a different day or check that sales have been submitted." />
              </div>
            )}

            {[...byAgent.entries()].map(([agentName, sales], agentIdx) => {
              const premiumTotal = sales.reduce((s, x) => s + Number(x.premium), 0);
              return (
                <div key={agentName} className={`animate-fade-in-up stagger-${Math.min(agentIdx + 1, 10)}`} style={{ ...CARD, marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${colors.borderSubtle}`, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>{agentName}</h3>
                      <Badge color={colors.primary400} variant="subtle" size="sm">{sales.length} sale{sales.length !== 1 ? "s" : ""}</Badge>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 18, background: "linear-gradient(135deg, #34d399, #10b981)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } as React.CSSProperties}>
                      <AnimatedNumber value={premiumTotal} prefix="$" decimals={2} />
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr>
                          {["Date", "Member", "Carrier", "Product", "Lead Source", "Premium", "Status", ""].map((h, i) => (
                            <th key={h || `actions-${i}`} style={{ ...TH, textAlign: i === 5 ? "right" : i === 6 ? "center" : "left" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sales.map(s => (
                          <tr key={s.id} className="row-hover">
                            <td style={TD}>{new Date(s.saleDate).toLocaleDateString(undefined, { timeZone: "UTC" })}</td>
                            <td style={{ ...TD, color: colors.textPrimary, fontWeight: 500 }}>{s.memberName}{s.memberId ? ` (${s.memberId})` : ""}</td>
                            <td style={TD}>{s.carrier}</td>
                            <td style={TD}>{s.product.name}</td>
                            <td style={TD}>{s.leadSource.name}</td>
                            <td style={{ ...TD, textAlign: "right", fontWeight: 700, color: colors.success }}>${Number(s.premium).toFixed(2)}</td>
                            <td style={{ ...TD, textAlign: "center" }}><StatusBadge status={s.status} /></td>
                            <td style={{ ...TD, textAlign: "center" }}>
                              <button
                                className="btn-hover"
                                style={{ ...DANGER_BTN, padding: "4px 6px" }}
                                title="Delete sale"
                                onClick={() => deleteSale(s.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Call Audits ───────────────────────────────────────────── */}
      {tab === "audits" && (
        <div className="animate-fade-in" style={CARD}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <SectionHeader icon={<Headphones size={18} />} title="Call Audits" count={audits.length} />
            <button
              className="btn-hover"
              style={ICON_BTN}
              onClick={() => {
                authFetch(`${API}/api/call-audits`).then(r => r.ok ? r.json() : []).then(setAudits).catch(() => {});
              }}
            >
              <RefreshCw size={14} />Refresh
            </button>
          </div>

          {/* Processing indicator */}
          {processingCalls.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {processingCalls.map(pc => (
                <div
                  key={pc.callLogId}
                  className="animate-fade-in"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 16px",
                    background: "rgba(20,184,166,0.08)",
                    border: `1px solid rgba(20,184,166,0.2)`,
                    borderRadius: radius.lg,
                    fontSize: 13,
                    color: colors.textSecondary,
                  }}
                >
                  <div style={{
                    width: 16,
                    height: 16,
                    border: "2px solid rgba(20,184,166,0.3)",
                    borderTopColor: colors.primary400,
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    flexShrink: 0,
                  }} />
                  <span>
                    <span style={{ fontWeight: 600, color: colors.textPrimary }}>{pc.agentName}</span>
                    {" — "}
                    {pc.status ? pc.status.replace(/_/g, " ") : "Processing call recording"}
                    {pc.attempt && pc.attempt > 1 ? ` (attempt ${pc.attempt})` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}

          {audits.length === 0 && processingCalls.length === 0 && (
            <EmptyState
              icon={<Headphones size={36} />}
              title="No audit records yet"
              description="Audits are created automatically when Convoso sends call recordings via webhook."
            />
          )}

          {audits.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Date", "Agent", "Outcome", "Score", "Summary", "Actions"].map((h, i) => (
                      <th key={h} style={{ ...TH, textAlign: i === 3 ? "center" : "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audits.map((a, auditIdx) => {
                    const scoreColor = a.score >= 80 ? colors.success : a.score >= 60 ? colors.warning : colors.danger;
                    const isExpanded = expandedAudit === a.id;
                    const isEditing = editingAudit === a.id;
                    const outcomeStyle = a.callOutcome ? (OUTCOME_COLORS[a.callOutcome] ?? { bg: "rgba(148,163,184,0.12)", color: "#94a3b8" }) : null;
                    const summaryText = a.managerSummary ?? a.aiSummary;
                    return (
                      <React.Fragment key={a.id}>
                        <tr
                          className={`row-hover animate-fade-in-up stagger-${Math.min(auditIdx + 1, 10)}`}
                          style={{ cursor: "pointer" }}
                          onClick={() => setExpandedAudit(isExpanded ? null : a.id)}
                        >
                          <td style={TD}>{new Date(a.callDate).toLocaleDateString()}</td>
                          <td style={{ ...TD, color: colors.textPrimary, fontWeight: 500 }}>{a.agent.name}</td>
                          <td style={TD}>
                            {outcomeStyle ? (
                              <span style={{
                                display: "inline-block",
                                padding: "2px 10px",
                                borderRadius: radius.full,
                                fontSize: 11,
                                fontWeight: 700,
                                letterSpacing: "0.04em",
                                textTransform: "capitalize",
                                background: outcomeStyle.bg,
                                color: outcomeStyle.color,
                              }}>
                                {a.callOutcome!.replace(/_/g, " ")}
                              </span>
                            ) : (
                              <span style={{ color: colors.textMuted }}>&mdash;</span>
                            )}
                          </td>
                          <td style={{ ...TD, textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                              <ProgressRing progress={a.score} size={32} strokeWidth={3} color={scoreColor} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: scoreColor }}>{a.score}</span>
                            </div>
                          </td>
                          <td style={{ ...TD, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {summaryText ?? <span style={{ color: colors.textMuted }}>&mdash;</span>}
                          </td>
                          <td style={TD}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <button
                                className="btn-hover"
                                style={{ ...ICON_BTN, fontSize: 12 }}
                                onClick={e => {
                                  e.stopPropagation();
                                  setEditingAudit(isEditing ? null : a.id);
                                  setAuditEdit({
                                    score: a.score,
                                    status: a.status,
                                    coachingNotes: a.coachingNotes ?? "",
                                    callOutcome: a.callOutcome ?? "",
                                    managerSummary: a.managerSummary ?? "",
                                  });
                                }}
                              >
                                <Edit3 size={12} />Edit
                              </button>
                              <span style={{ color: colors.textMuted, fontSize: 12 }}>
                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} style={{ padding: 0, borderBottom: `1px solid ${colors.borderSubtle}` }}>
                              <div className="animate-slide-down" style={{ padding: 24, background: colors.bgSurfaceInset, borderTop: `1px solid ${colors.borderSubtle}` }}>

                                {/* Manager Summary */}
                                {(a.managerSummary ?? a.aiSummary) && (
                                  <div style={{
                                    padding: "14px 18px",
                                    borderRadius: radius.lg,
                                    border: `1px solid ${colors.borderDefault}`,
                                    background: colors.bgSurface,
                                    marginBottom: 20,
                                  }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                                      {a.managerSummary ? "Manager Summary" : "AI Summary"}
                                    </div>
                                    <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary, lineHeight: 1.7 }}>
                                      {a.managerSummary ?? a.aiSummary}
                                    </p>
                                  </div>
                                )}

                                {/* Coaching Priorities */}
                                {a.suggestedCoaching && a.suggestedCoaching.length > 0 && (
                                  <div style={{ marginBottom: 20 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                      <Target size={15} style={{ color: colors.primary400 }} />
                                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                        Coaching Priorities
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                      {a.suggestedCoaching.map((cp, idx) => {
                                        const pColor = PRIORITY_COLORS[cp.priority] ?? PRIORITY_COLORS[3];
                                        return (
                                          <div key={idx} style={{
                                            display: "flex",
                                            gap: 12,
                                            padding: "12px 16px",
                                            borderRadius: radius.lg,
                                            background: colors.bgSurface,
                                            border: `1px solid ${colors.borderSubtle}`,
                                          }}>
                                            <span style={{
                                              flexShrink: 0,
                                              width: 24,
                                              height: 24,
                                              borderRadius: "50%",
                                              background: pColor.bg,
                                              color: pColor.color,
                                              fontSize: 11,
                                              fontWeight: 800,
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                            }}>
                                              P{cp.priority}
                                            </span>
                                            <div>
                                              <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 }}>{cp.focus_area}</div>
                                              <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>{cp.talking_point}</div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Issues */}
                                {a.issues && a.issues.length > 0 && (
                                  <div style={{ marginBottom: 20 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                      <AlertCircle size={15} style={{ color: colors.danger }} />
                                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                        Issues ({a.issues.length})
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                      {a.issues.map((issue, idx) => (
                                        <div key={idx} style={{
                                          padding: "14px 16px",
                                          borderRadius: radius.lg,
                                          background: colors.bgSurface,
                                          border: `1px solid rgba(248,113,113,0.15)`,
                                        }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                            <span style={{
                                              display: "inline-block",
                                              padding: "2px 10px",
                                              borderRadius: radius.full,
                                              fontSize: 11,
                                              fontWeight: 700,
                                              background: "rgba(248,113,113,0.12)",
                                              color: "#f87171",
                                            }}>
                                              {CATEGORY_LABELS[issue.category] ?? issue.category}
                                            </span>
                                            {issue.timestamp_hint && (
                                              <span style={{ fontSize: 11, color: colors.textMuted }}>{issue.timestamp_hint}</span>
                                            )}
                                          </div>
                                          <p style={{ margin: "0 0 8px", fontSize: 13, color: colors.textPrimary, fontWeight: 500 }}>{issue.what_happened}</p>
                                          <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Agent said:</div>
                                          <div style={QUOTE_BLOCK}>{issue.agent_quote}</div>
                                          <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Customer said:</div>
                                          <div style={QUOTE_BLOCK}>{issue.customer_quote}</div>
                                          <div style={{ marginTop: 10, marginBottom: 4, fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Why it's a problem:</div>
                                          <p style={{ margin: "0 0 8px", fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>{issue.why_its_a_problem}</p>
                                          <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recommended response:</div>
                                          <div style={{
                                            ...QUOTE_BLOCK,
                                            borderLeftColor: "rgba(52,211,153,0.4)",
                                            background: "rgba(52,211,153,0.04)",
                                            borderRadius: "0 6px 6px 0",
                                            padding: "8px 12px",
                                          }}>{issue.recommended_response}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Wins */}
                                {a.wins && a.wins.length > 0 && (
                                  <div style={{ marginBottom: 20 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                      <Star size={15} style={{ color: "#fbbf24" }} />
                                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                        Wins ({a.wins.length})
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                      {a.wins.map((win, idx) => (
                                        <div key={idx} style={{
                                          padding: "14px 16px",
                                          borderRadius: radius.lg,
                                          background: colors.bgSurface,
                                          border: `1px solid rgba(74,222,128,0.15)`,
                                        }}>
                                          <p style={{ margin: "0 0 8px", fontSize: 13, color: colors.textPrimary, fontWeight: 500 }}>{win.what_happened}</p>
                                          <div style={QUOTE_BLOCK}>{win.agent_quote}</div>
                                          <div style={{ marginTop: 8, fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>
                                            <span style={{ fontWeight: 600, color: "#4ade80" }}>Why it worked: </span>
                                            {win.why_it_worked}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Missed Opportunities */}
                                {a.missedOpportunities && a.missedOpportunities.length > 0 && (
                                  <div style={{ marginBottom: 20 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                                      <Lightbulb size={15} style={{ color: "#fbbf24" }} />
                                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                        Missed Opportunities ({a.missedOpportunities.length})
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                      {a.missedOpportunities.map((mo, idx) => (
                                        <div key={idx} style={{
                                          padding: "14px 16px",
                                          borderRadius: radius.lg,
                                          background: colors.bgSurface,
                                          border: `1px solid rgba(251,191,36,0.15)`,
                                        }}>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", marginBottom: 6 }}>{mo.moment}</div>
                                          <p style={{ margin: "0 0 8px", fontSize: 13, color: colors.textSecondary, lineHeight: 1.6 }}>
                                            <span style={{ fontWeight: 600, color: colors.textPrimary }}>What should have happened: </span>
                                            {mo.what_should_have_happened}
                                          </p>
                                          <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Suggested script:</div>
                                          <div style={{
                                            ...QUOTE_BLOCK,
                                            borderLeftColor: "rgba(251,191,36,0.4)",
                                          }}>{mo.suggested_script}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Transcript — collapsible */}
                                {a.transcription && (
                                  <div style={{ marginBottom: 20 }}>
                                    <button
                                      className="btn-hover"
                                      style={{
                                        ...ICON_BTN,
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 6,
                                        marginBottom: 8,
                                        padding: "6px 12px",
                                      }}
                                      onClick={() => setTranscriptOpen(transcriptOpen === a.id ? null : a.id)}
                                    >
                                      <MessageSquare size={13} />
                                      {transcriptOpen === a.id ? "Hide" : "Show"} Transcript
                                      {transcriptOpen === a.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>
                                    {transcriptOpen === a.id && (
                                      <div className="animate-slide-down" style={{
                                        color: colors.textSecondary,
                                        fontSize: 12,
                                        maxHeight: 300,
                                        overflowY: "auto",
                                        whiteSpace: "pre-wrap",
                                        lineHeight: 1.7,
                                        background: colors.bgSurface,
                                        border: `1px solid ${colors.borderDefault}`,
                                        borderRadius: radius.lg,
                                        padding: 16,
                                        fontFamily: typography.fontMono,
                                      }}>
                                        {a.transcription}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Recording */}
                                {a.recordingUrl && (
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Recording</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                      <a
                                        href={a.recordingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-hover"
                                        style={{ ...ICON_BTN, display: "inline-flex", textDecoration: "none", padding: "8px 14px" }}
                                      >
                                        <Mic size={14} />Listen to Recording
                                      </a>
                                    </div>
                                    <audio controls src={a.recordingUrl} style={{ width: "100%", marginTop: 10 }} />
                                  </div>
                                )}

                              </div>
                            </td>
                          </tr>
                        )}

                        {/* Edit row */}
                        {isEditing && (
                          <tr>
                            <td colSpan={6} style={{ padding: 0 }}>
                              <div className="animate-fade-in" style={{ padding: 20, background: "rgba(20,184,166,0.04)", borderTop: `1px solid ${colors.borderSubtle}` }}>
                                <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                                  <div>
                                    <label style={LBL}>Score</label>
                                    <input
                                      className="input-focus"
                                      type="number"
                                      min={0}
                                      max={100}
                                      style={{ ...INP, width: 80 }}
                                      value={auditEdit.score}
                                      onChange={e => setAuditEdit(x => ({ ...x, score: Number(e.target.value) }))}
                                    />
                                  </div>
                                  <div>
                                    <label style={LBL}>Status</label>
                                    <input
                                      className="input-focus"
                                      style={{ ...INP, width: 140 }}
                                      value={auditEdit.status}
                                      onChange={e => setAuditEdit(x => ({ ...x, status: e.target.value }))}
                                    />
                                  </div>
                                  <div>
                                    <label style={LBL}>Outcome</label>
                                    <select
                                      className="input-focus"
                                      style={{ ...INP, width: 160 }}
                                      value={auditEdit.callOutcome}
                                      onChange={e => setAuditEdit(x => ({ ...x, callOutcome: e.target.value }))}
                                    >
                                      <option value="">-- None --</option>
                                      <option value="sold">Sold</option>
                                      <option value="lost">Lost</option>
                                      <option value="callback_scheduled">Callback Scheduled</option>
                                      <option value="not_qualified">Not Qualified</option>
                                      <option value="incomplete">Incomplete</option>
                                    </select>
                                  </div>
                                  <div style={{ flex: 1, minWidth: 200 }}>
                                    <label style={LBL}>Coaching Notes</label>
                                    <input
                                      className="input-focus"
                                      style={INP}
                                      value={auditEdit.coachingNotes}
                                      onChange={e => setAuditEdit(x => ({ ...x, coachingNotes: e.target.value }))}
                                    />
                                  </div>
                                  <div style={{ flex: 2, minWidth: 240 }}>
                                    <label style={LBL}>Manager Summary</label>
                                    <input
                                      className="input-focus"
                                      style={INP}
                                      placeholder="Override AI summary with your own notes..."
                                      value={auditEdit.managerSummary}
                                      onChange={e => setAuditEdit(x => ({ ...x, managerSummary: e.target.value }))}
                                    />
                                  </div>
                                  <button
                                    className="btn-hover"
                                    style={SUCCESS_BTN}
                                    onClick={async () => {
                                      try {
                                        const res = await authFetch(`${API}/api/call-audits/${a.id}`, {
                                          method: "PATCH",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({
                                            score: auditEdit.score,
                                            status: auditEdit.status,
                                            coachingNotes: auditEdit.coachingNotes || undefined,
                                            callOutcome: auditEdit.callOutcome || undefined,
                                            managerSummary: auditEdit.managerSummary || undefined,
                                          }),
                                        });
                                        if (res.ok) {
                                          const updated = await res.json();
                                          setAudits(prev => prev.map(x => x.id === a.id ? updated : x));
                                          setEditingAudit(null);
                                        }
                                      } catch {}
                                    }}
                                  >
                                    <Save size={14} />Save
                                  </button>
                                  <button className="btn-hover" style={CANCEL_BTN} onClick={() => setEditingAudit(null)}>
                                    <X size={14} />Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Config ────────────────────────────────────────────────── */}
      {tab === "config" && (
        <div className="animate-fade-in">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="grid-mobile-1">

            {/* Agents card */}
            <div style={CARD}>
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
                <input className="input-focus" style={INP} value={newAgent.name} placeholder="Name *" required onChange={e => setNewAgent(x => ({ ...x, name: e.target.value }))} />
                <input className="input-focus" style={INP} value={newAgent.email} placeholder="CRM User ID" onChange={e => setNewAgent(x => ({ ...x, email: e.target.value }))} />
                <input className="input-focus" style={INP} value={newAgent.extension} placeholder="Tracking Extension" onChange={e => setNewAgent(x => ({ ...x, extension: e.target.value }))} />
                <button type="submit" className="btn-hover" style={{ ...SUCCESS_BTN, justifyContent: "center" }}>
                  <Plus size={14} />Add Agent
                </button>
              </form>
            </div>

            {/* Lead Sources card */}
            <div style={CARD}>
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
                <input className="input-focus" style={INP} value={newLS.name} placeholder="Name *" required onChange={e => setNewLS(x => ({ ...x, name: e.target.value }))} />
                <input className="input-focus" style={INP} value={newLS.listId} placeholder="CRM List ID" onChange={e => setNewLS(x => ({ ...x, listId: e.target.value }))} />
                <input className="input-focus" style={{ ...INP }} type="number" step="0.01" value={newLS.costPerLead} placeholder="Cost per lead ($)" onChange={e => setNewLS(x => ({ ...x, costPerLead: e.target.value }))} />
                <button type="submit" className="btn-hover" style={{ ...SUCCESS_BTN, justifyContent: "center" }}>
                  <Plus size={14} />Add Lead Source
                </button>
              </form>
            </div>

          </div>

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
      )}

    </PageShell>
  );
}
