"use client";
import React, { useState, useEffect, useRef, FormEvent } from "react";
import {
  Badge,
  Button,
  Input,
  Select,
  colors,
  spacing,
  radius,
  shadows,
  typography,
  motion,
  baseInputStyle,
  baseLabelStyle,
  semanticColors,
  colorAlpha,
} from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar } from "@ops/utils";
import { US_STATES } from "@ops/types";
import {
  Plus,
  Check,
  XCircle,
  Upload,
  X,
  ClipboardList,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

/* -- Types -- */

type Agent = { id: string; name: string; email?: string; userId?: string; extension?: string; displayOrder: number; active?: boolean; auditEnabled?: boolean };
type Product = {
  id: string; name: string; active: boolean; type: "CORE" | "ADDON" | "AD_D" | "ACA_PL";
  premiumThreshold?: number | null; commissionBelow?: number | null; commissionAbove?: number | null;
  bundledCommission?: number | null; standaloneCommission?: number | null; enrollFeeThreshold?: number | null; notes?: string | null;
};
type LeadSource = { id: string; name: string; listId?: string; costPerLead: number; active?: boolean; callBufferSeconds?: number };

type ParsedProduct = { name: string; price: string; isAddon: boolean; enrollmentFee?: string };
type ParseResult = {
  memberId?: string; memberName?: string; status?: string; saleDate?: string;
  premium?: string; carrier?: string; enrollmentFee?: string; addonNames: string[];
  parsedProducts: ParsedProduct[]; paymentType?: "CC" | "ACH"; memberState?: string;
};

export interface ManagerEntryProps {
  API: string;
  agents: Agent[];
  products: Product[];
  leadSources: LeadSource[];
  onSaleCreated?: () => void;
}

/* -- Style constants -- */

const LBL: React.CSSProperties = { ...baseLabelStyle };

const PREVIEW_PANEL: React.CSSProperties = {
  background: colors.bgSurface,
  border: `1px solid ${colorAlpha(semanticColors.accentTealMid, 0.15)}`,
  borderRadius: radius.xl,
  padding: spacing[6],
  marginBottom: spacing[4],
};

const PREVIEW_TOTAL: React.CSSProperties = {
  fontSize: typography.sizes.lg.fontSize,
  fontWeight: 700,
  color: colors.primary400,
  lineHeight: 1.4,
};

const PREVIEW_LINE: React.CSSProperties = {
  fontSize: typography.sizes.base.fontSize,
  color: colors.textSecondary,
  display: "flex",
  justifyContent: "space-between",
  padding: `${spacing[1]}px 0`,
};

const PREVIEW_LABEL: React.CSSProperties = {
  fontSize: typography.sizes.xs.fontSize,
  fontWeight: 700,
  color: colors.textTertiary,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  marginBottom: spacing[2],
};

const ACA_FIELDS: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 120px",
  gap: 16,
  marginTop: 8,
  padding: 12,
  background: "rgba(255,255,255,0.03)",
  borderRadius: 8,
  border: `1px solid ${colors.borderSubtle}`,
};
const ACA_FORM_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

/* -- Receipt parser -- */

function mapParsedStatus(raw: string): string {
  const normalized = raw.toUpperCase().trim();
  const statusMap: Record<string, string> = {
    "APPROVED": "RAN",
    "SALE": "RAN",
    "ACTIVE": "RAN",
    "COMPLETED": "RAN",
    "SUBMITTED": "RAN",
    "RAN": "RAN",
    "DECLINED": "DECLINED",
    "REJECTED": "DECLINED",
    "CANCELLED": "DEAD",
    "CANCELED": "DEAD",
    "DEAD": "DEAD",
    "VOID": "DEAD",
    "VOIDED": "DEAD",
  };
  return statusMap[normalized] || "RAN";
}

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
  if (st) out.status = mapParsedStatus(st[1]);

  const dt = t.match(/Date:\s*(\d{2})\/(\d{2})\/(\d{4})/);
  if (dt) out.saleDate = `${dt[3]}-${dt[1]}-${dt[2]}`;

  const am = t.match(/Amount:\s*\$?([\d,]+\.?\d*)/);
  if (am) out.premium = am[1].replace(/,/g, "");

  let totalEnrollment = 0;
  let enrollmentFound = false;
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
      const nameMatch = bt.match(/^([A-Za-z][A-Za-z0-9&$\s/+'.()-]+?)(?:\s+(?:Individual|Family|Employee|Member)\b|\s+-\s+ID:)/i);
      if (nameMatch) {
        const rawName = nameMatch[1].trim();
        const isAddon = /[-\u2013]\s*Add[-\s]?on/i.test(rawName) || /\bAdd[-\s]?on\b/i.test(rawName);
        const cleanName = rawName.replace(/\s*[-\u2013]\s*Add[-\s]?on\s*/gi, "").replace(/\s+Add[-\s]?on\s*/gi, "").trim();
        const efMatch = bt.match(/Enrollment\s+\$?([\d,]+\.?\d*)/);
        let enrollFee: string | undefined;
        if (efMatch) {
          enrollFee = efMatch[1].replace(/,/g, "");
          totalEnrollment += Number(enrollFee);
          enrollmentFound = true;
        }
        out.parsedProducts.push({ name: cleanName, price: block.price, isAddon, enrollmentFee: enrollFee });
        if (isAddon) out.addonNames.push(cleanName);
      }
    }
    const primary = out.parsedProducts.find(p => !p.isAddon);
    if (primary) out.carrier = primary.name;
  }

  if (enrollmentFound) out.enrollmentFee = totalEnrollment.toFixed(2);

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
  if (!out.memberState) {
    const stateMatch2 = t.match(/\b([A-Z]{2})\s+\d{5}/);
    if (stateMatch2) out.memberState = stateMatch2[1];
  }

  if (!out.enrollmentFee) {
    const efRe = /Enrollment\s+\$?([\d,]+\.?\d*)/g;
    let efm: RegExpExecArray | null;
    let ef = 0;
    let efFound = false;
    while ((efm = efRe.exec(t)) !== null) { ef += Number(efm[1].replace(/,/g, "")); efFound = true; }
    if (efFound) out.enrollmentFee = ef.toFixed(2);
  }

  return out;
}

function matchProduct(name: string, products: Product[]): Product | undefined {
  const lower = name.toLowerCase().trim();
  // 1. Exact match
  const exact = products.find(p => p.name.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Containment with length guard (prevents "AME" matching "AmeriCare")
  // Uses includes() instead of regex \b to handle special chars ($, ,) in product names
  const subs = products.filter(p => {
    const pn = p.name.toLowerCase();
    const shorter = Math.min(pn.length, lower.length);
    const longer = Math.max(pn.length, lower.length);
    return shorter / longer > 0.5 && (pn.includes(lower) || lower.includes(pn));
  });
  if (subs.length > 0) return subs.sort((a, b) => b.name.length - a.name.length)[0];

  return undefined;
}

/* -- Component -- */

export default function ManagerEntry({ API, agents, products, leadSources, onSaleCreated }: ManagerEntryProps) {
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const msgTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const blankForm = () => ({
    saleDate: new Date().toISOString().slice(0, 10),
    agentId: "", memberName: "", memberId: "", carrier: "", productId: "",
    premium: "", effectiveDate: "", leadSourceId: "", enrollmentFee: "",
    addonProductIds: [] as string[], status: "", notes: "",
    paymentType: "" as "CC" | "ACH" | "", memberState: "",
  });
  const [form, setForm] = useState(blankForm());
  const [addonPremiums, setAddonPremiums] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState("");
  const [parsed, setParsed] = useState(false);

  /* ACA state */
  const [includeAca, setIncludeAca] = useState(false);
  const [acaMode, setAcaMode] = useState<"bundled" | "standalone">("bundled");
  const [acaCarrier, setAcaCarrier] = useState("");
  const [acaMemberCount, setAcaMemberCount] = useState("1");
  const [acaStandaloneAgent, setAcaStandaloneAgent] = useState("");
  const [acaStandaloneMemberName, setAcaStandaloneMemberName] = useState("");
  const [acaStandaloneCarrier, setAcaStandaloneCarrier] = useState("");
  const [acaStandaloneMemberCount, setAcaStandaloneMemberCount] = useState("1");
  const [acaStandaloneSaleDate, setAcaStandaloneSaleDate] = useState(new Date().toISOString().slice(0, 10));

  const [parsedInfo, setParsedInfo] = useState<{
    enrollmentFee?: string; premium?: string; totalPremium?: string; coreProduct?: string;
    parsedProducts: ParsedProduct[];
    addons: { name: string; matched: boolean; productName?: string; productId?: string }[];
  }>({ addons: [], parsedProducts: [] });

  /* -- Commission preview state -- */
  const previewTimer = useRef<ReturnType<typeof setTimeout>>();
  const previewAbort = useRef<AbortController>();
  const [previewData, setPreviewData] = useState<{
    commission: number;
    periodStart: string;
    periodEnd: string;
    halvingReason: string | null;
    breakdown: { hasBundleRequirement: boolean; hasCore: boolean; enrollmentFee: number | null; paymentType: string };
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  function triggerPreview(immediate = false) {
    clearTimeout(previewTimer.current);
    const delay = immediate ? 0 : 500;
    previewTimer.current = setTimeout(async () => {
      if (!form.productId || !form.premium) {
        setPreviewData(null);
        return;
      }
      if (previewAbort.current) previewAbort.current.abort();
      previewAbort.current = new AbortController();
      setPreviewLoading(true);
      setPreviewError(false);
      try {
        const res = await authFetch(`${API}/api/sales/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: form.productId,
            premium: Number(form.premium),
            enrollmentFee: form.enrollmentFee ? Number(form.enrollmentFee) : null,
            addonProductIds: form.addonProductIds || [],
            addonPremiums: Object.fromEntries(
              Object.entries(addonPremiums).filter(([, v]) => v).map(([k, v]) => [k, Number(v)])
            ),
            paymentType: form.paymentType || "CC",
            status: form.status || "RAN",
            saleDate: form.saleDate || undefined,
            memberState: form.memberState || null,
          }),
          signal: previewAbort.current.signal,
        });
        if (res.ok) {
          setPreviewData(await res.json());
          setPreviewError(false);
        } else {
          setPreviewError(true);
        }
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== "AbortError") setPreviewError(true);
      } finally {
        setPreviewLoading(false);
      }
    }, delay);
  }

  useEffect(() => {
    return () => {
      clearTimeout(previewTimer.current);
      if (previewAbort.current) previewAbort.current.abort();
    };
  }, []);

  function handleParse() {
    if (!receipt.trim()) return;
    const p = parseReceipt(receipt);
    const addonMatches = p.addonNames.map(name => {
      const match = matchProduct(name, products);
      const parsedEntry = p.parsedProducts.find(pp => pp.isAddon && pp.name.toLowerCase() === name.toLowerCase());
      return { name, matched: !!match, productName: match?.name, productId: match?.id, price: parsedEntry?.price };
    });
    const addonProductIds = addonMatches.filter(a => a.productId).map(a => a.productId!);

    const coreProductEntry = p.parsedProducts.find(pp => !pp.isAddon);
    const coreProductMatch = coreProductEntry ? matchProduct(coreProductEntry.name, products) : undefined;

    let corePremium: string | undefined;
    if (coreProductEntry?.price) {
      corePremium = coreProductEntry.price;
    } else {
      let effectivePremium = p.premium;
      if (p.premium && p.enrollmentFee) {
        const productOnlyPremium = Number(p.premium) - Number(p.enrollmentFee);
        if (productOnlyPremium > 0) {
          effectivePremium = productOnlyPremium.toFixed(2);
        }
      }
      corePremium = effectivePremium;
    }

    const parsedAddonPremiums: Record<string, string> = {};
    addonMatches.forEach(a => {
      if (a.productId && a.price) {
        parsedAddonPremiums[a.productId] = a.price;
      }
    });

    setForm(f => ({
      ...f,
      memberName: p.memberName ?? f.memberName,
      memberId: p.memberId ?? f.memberId,
      status: p.status ?? f.status,
      saleDate: p.saleDate ?? f.saleDate,
      premium: corePremium ?? f.premium,
      carrier: p.carrier ?? f.carrier,
      enrollmentFee: p.enrollmentFee ?? f.enrollmentFee,
      memberState: p.memberState ?? f.memberState,
      paymentType: p.paymentType ?? f.paymentType,
      ...(coreProductMatch ? { productId: coreProductMatch.id } : {}),
      addonProductIds,
    }));
    setAddonPremiums(parsedAddonPremiums);
    const addonTotal = addonMatches.reduce((sum, a) => sum + (a.price ? Number(a.price) : 0), 0);
    const totalPrem = (corePremium ? Number(corePremium) : 0) + addonTotal;
    setParsedInfo({
      enrollmentFee: p.enrollmentFee,
      premium: corePremium,
      totalPremium: totalPrem > 0 ? totalPrem.toFixed(2) : undefined,
      coreProduct: p.carrier,
      parsedProducts: p.parsedProducts,
      addons: addonMatches,
    });
    setParsed(true);
  }

  function clearReceipt() {
    setReceipt("");
    setParsed(false);
    setAddonPremiums({});
    setForm(blankForm());
  }

  async function submitSale(e: FormEvent) {
    e.preventDefault(); setMsg(null);
    // Belt-and-suspenders: if main form is empty but standalone ACA has values, bail out.
    // The standalone ACA path uses its own Button with type="button" and its own onClick handler.
    // This guards against any future regression where a nested button bubbles up as form submit.
    const mainFormEmpty = !form.agentId && !form.productId && !form.memberName.trim() && !form.premium;
    const standaloneAcaInUse = !!(acaStandaloneAgent || acaStandaloneMemberName.trim() || acaStandaloneCarrier || (acaStandaloneMemberCount && acaStandaloneMemberCount !== "1"));
    if (mainFormEmpty && standaloneAcaInUse) {
      return;
    }
    const errors: Record<string, string> = {};
    if (!form.agentId) errors.agentId = "Select an agent";
    if (!form.productId) errors.productId = "Select a product";
    if (!form.saleDate) errors.saleDate = "Enter a sale date";
    if (!form.status) errors.status = "Select a status";
    if (!form.memberName.trim()) errors.memberName = "Enter member name";
    if (form.premium !== undefined && form.premium !== null && form.premium !== "" && Number(form.premium) < 0) errors.premium = "Premium cannot be negative";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setSubmitting(true);
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
          carrier: form.carrier || undefined,
          paymentType: form.paymentType || undefined,
          memberState: form.memberState || undefined,
          addonPremiums: addonPremiumsPayload,
        }),
      });
      if (res.ok) {
        const sale = await res.json();
        /* If ACA checkbox is checked, create linked ACA sale */
        // Phase 47 WR-07: surface ACA bundle failures. Previously the catch only
        // console.error'd and the success toast fired regardless, so users saw
        // "Sale submitted successfully" while the ACA child silently went missing.
        let acaBundleError: string | null = null;
        if (includeAca && acaCarrier) {
          const acaProduct = products.find(p => p.id === acaCarrier && p.type === "ACA_PL");
          if (acaProduct) {
            try {
              const acaRes = await authFetch(`${API}/api/sales/aca`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  agentId: form.agentId,
                  memberName: form.memberName,
                  carrier: acaProduct.name,
                  memberCount: parseInt(acaMemberCount, 10) || 1,
                  productId: acaProduct.id,
                  saleDate: form.saleDate || undefined,
                  acaCoveringSaleId: sale.id,
                }),
              });
              if (!acaRes.ok) {
                const err = await acaRes.json().catch(() => ({}));
                acaBundleError = `Sale saved, but ACA bundle failed (${acaRes.status}): ${err.error ?? "unknown"}. Add the ACA entry manually.`;
                console.error("ACA entry failed:", acaRes.status, err);
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : "network error";
              acaBundleError = `Sale saved, but ACA bundle request failed: ${message}. Add the ACA entry manually.`;
              console.error("ACA entry failed:", err);
            }
          }
          setIncludeAca(false);
          setAcaCarrier("");
          setAcaMemberCount("1");
        }
        setFieldErrors({});
        if (acaBundleError) {
          setMsg({ text: acaBundleError, type: "error" });
        } else {
          setMsg({ text: "Sale submitted successfully", type: "success" });
        }
        clearTimeout(msgTimerRef.current);
        msgTimerRef.current = setTimeout(() => setMsg(null), 5000);
        clearReceipt();
        onSaleCreated?.();
      } else {
        const err = await res.json().catch(() => ({}));
        setMsg({ text: `Failed to create sale (${res.status}): ${err.error ?? "Unknown error"}`, type: "error" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      setMsg({ text: `Unable to reach API server \u2014 ${message}`, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: 1200 }}>
      {msg && (
        <div className="animate-fade-in-up" style={{
          marginBottom: 16,
          padding: "12px 16px",
          borderRadius: radius.xl,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: typography.sizes.base.fontSize,
          fontWeight: 600,
          background: msg.type === "success" ? colors.successBg : colors.dangerBg,
          border: `1px solid ${msg.type === "success" ? "rgba(52,211,153,0.2)" : colorAlpha(semanticColors.dangerLight, 0.2)}`,
          color: msg.type === "success" ? colors.success : colors.danger,
        }}>
          {msg.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {msg.text}
        </div>
      )}
      <form onSubmit={submitSale}>
        {/* Two-column layout: Form (left) + Receipt/Addons (right) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, alignItems: "start" }} className="stack-mobile">

        {/* -- LEFT COLUMN: Form fields -- */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="grid-mobile-1">
          <div className="animate-fade-in-up stagger-1">
            <Select
              label="Agent"
              error={fieldErrors.agentId}
              value={form.agentId}
              onChange={e => { setForm(f => ({ ...f, agentId: e.target.value })); setFieldErrors(fe => { const n = { ...fe }; delete n.agentId; return n; }); }}
            >
              <option value="" disabled>Select agent...</option>
              {agents.filter(a => a.active !== false).map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </div>
          <div className="animate-fade-in-up stagger-1">
            <label style={LBL}>Lead Source</label>
            <select className="input-focus" style={baseInputStyle} value={form.leadSourceId} required onChange={e => { setForm(f => ({ ...f, leadSourceId: e.target.value })); setFieldErrors(fe => { const n = { ...fe }; delete n.leadSourceId; return n; }); }}>
              <option value="" disabled>Select lead source...</option>
              {leadSources.filter(ls => ls.active !== false).map(ls => (
                <option key={ls.id} value={ls.id}>{ls.name}</option>
              ))}
            </select>
          </div>
          <div className="animate-fade-in-up stagger-2">
            <Input label="Member Name" error={fieldErrors.memberName} value={form.memberName} required onChange={e => { setForm(f => ({ ...f, memberName: e.target.value })); setFieldErrors(fe => { const n = { ...fe }; delete n.memberName; return n; }); }} />
          </div>
          <div className="animate-fade-in-up stagger-2">
            <label style={LBL}>Member ID</label>
            <input className="input-focus" style={baseInputStyle} value={form.memberId} onChange={e => { setForm(f => ({ ...f, memberId: e.target.value })); setFieldErrors(fe => { const n = { ...fe }; delete n.memberId; return n; }); }} />
          </div>
          <div className="animate-fade-in-up stagger-3">
            <label style={LBL}>Member State</label>
            <select className="input-focus" style={{ ...baseInputStyle, height: 42 }}
              value={form.memberState}
              onChange={e => setForm(f => ({ ...f, memberState: e.target.value }))}>
              <option value="">Select state...</option>
              {US_STATES.map(s => <option key={s.code} value={s.code}>{s.code} - {s.name}</option>)}
            </select>
          </div>
          <div className="animate-fade-in-up stagger-3">
            <Input label="Sale Date" error={fieldErrors.saleDate} type="date" value={form.saleDate} required onChange={e => { setForm(f => ({ ...f, saleDate: e.target.value })); setFieldErrors(fe => { const n = { ...fe }; delete n.saleDate; return n; }); }} />
          </div>
          <div className="animate-fade-in-up stagger-4">
            <label style={LBL}>Effective Date</label>
            <input className="input-focus" style={baseInputStyle} type="date" value={form.effectiveDate} required onChange={e => setForm(f => ({ ...f, effectiveDate: e.target.value }))} />
          </div>
          <div className="animate-fade-in-up stagger-4">
            <Select label="Product" error={fieldErrors.productId} value={form.productId} required onChange={e => { setForm(f => ({ ...f, productId: e.target.value })); setFieldErrors(fe => { const n = { ...fe }; delete n.productId; return n; }); triggerPreview(true); }}>
              <option value="" disabled>Select product...</option>
              {products.filter(p => p.active !== false && p.type === "CORE").map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
          <div className="animate-fade-in-up stagger-5">
            <label style={LBL}>Carrier</label>
            <input className="input-focus" style={baseInputStyle} value={form.carrier} placeholder="Optional" onChange={e => { setForm(f => ({ ...f, carrier: e.target.value })); setFieldErrors(fe => { const n = { ...fe }; delete n.carrier; return n; }); }} />
          </div>
          <div className="animate-fade-in-up stagger-5">
            <Select label="Status *" error={fieldErrors.status} value={form.status} required onChange={e => { setForm(f => ({ ...f, status: e.target.value })); setFieldErrors(fe => { const n = { ...fe }; delete n.status; return n; }); }}>
              <option value="" disabled>Select status...</option>
              <option value="RAN">Ran</option>
              <option value="DECLINED">Declined</option>
              <option value="DEAD">Dead</option>
            </Select>
          </div>
          <div className="animate-fade-in-up stagger-6">
            <Input label="Premium ($)" error={fieldErrors.premium} type="number" step="0.01" min="0" value={form.premium} required onChange={e => { setForm(f => ({ ...f, premium: e.target.value })); setFieldErrors(fe => { const n = { ...fe }; delete n.premium; return n; }); triggerPreview(false); }} />
          </div>
          <div className="animate-fade-in-up stagger-6">
            <label style={LBL}>Enrollment Fee ($)</label>
            <input className="input-focus" style={baseInputStyle} type="number" step="0.01" min="0" value={form.enrollmentFee} onChange={e => { setForm(f => ({ ...f, enrollmentFee: e.target.value })); setFieldErrors(fe => { const n = { ...fe }; delete n.enrollmentFee; return n; }); triggerPreview(false); }} />
          </div>
          <div className="animate-fade-in-up stagger-7" style={{ gridColumn: "1/-1" }}>
            <label style={LBL}>Notes</label>
            <input className="input-focus" style={baseInputStyle} value={form.notes} onChange={e => { setForm(f => ({ ...f, notes: e.target.value })); setFieldErrors(fe => { const n = { ...fe }; delete n.notes; return n; }); }} />
          </div>

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
                      ? colorAlpha(semanticColors.accentTealMid, 0.1)
                      : "transparent",
                    cursor: "pointer",
                    transition: `all ${motion.duration.fast} ${motion.easing.out}`,
                    color: form.paymentType === pt ? colors.primary300 : colors.textSecondary,
                    fontWeight: form.paymentType === pt ? 700 : 500,
                    fontSize: typography.sizes.base.fontSize,
                    userSelect: "none",
                  }}
                >
                  <input
                    type="radio"
                    name="paymentType"
                    value={pt}
                    checked={form.paymentType === pt}
                    onChange={() => { setForm(f => ({ ...f, paymentType: pt })); setFieldErrors(fe => { const n = { ...fe }; delete n.paymentType; return n; }); triggerPreview(true); }}
                    style={{ accentColor: colors.primary500 }}
                  />
                  {pt === "CC" ? "Credit Card" : "ACH / Bank"}
                </label>
              ))}
            </div>
            {!form.paymentType && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: colors.warning }}>Please select a payment type before submitting</p>
            )}
          </div>

          {/* Submit row */}
          <div style={{ gridColumn: "1/-1", paddingTop: 8 }}>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={submitting}
              disabled={!form.paymentType || !form.status || submitting}
              style={{
                padding: "14px 32px",
                borderRadius: radius.xl,
                fontWeight: 700,
                fontSize: 15,
                minHeight: 48,
                boxShadow: `${shadows.glowPrimary}, 0 4px 20px ${colorAlpha(semanticColors.accentTealMid, 0.3)}`,
                letterSpacing: "0.02em",
              }}
            >
              {submitting ? "Submitting..." : "Submit Sale"}
            </Button>
          </div>
        </div>
        {/* -- END LEFT COLUMN -- */}

        {/* -- RIGHT COLUMN: Preview + Receipt Parser + Add-ons -- */}
        <div style={{ position: "sticky", top: 20 }}>
          {/* Commission Preview Panel */}
          <div style={PREVIEW_PANEL} aria-live="polite">
            <div style={PREVIEW_LABEL}>
              {previewLoading ? "CALCULATING..." : "COMMISSION PREVIEW"}
            </div>

            {!form.productId ? (
              <div style={{ fontSize: typography.sizes.base.fontSize, color: colors.textMuted }}>
                Select a product to see commission preview.
              </div>
            ) : previewError ? (
              <div style={{ fontSize: typography.sizes.xs.fontSize, color: colors.danger }}>
                Preview unavailable — commission will be calculated on submission.
              </div>
            ) : (
              <>
                <div style={{
                  ...PREVIEW_TOTAL,
                  ...(previewLoading ? { animation: "pulse 1.5s ease-in-out infinite", opacity: 0.6 } : {}),
                }}>
                  {previewData ? formatDollar(previewData.commission) : "$0.00"}
                </div>

                {previewData && (
                  <div style={{ marginTop: spacing[3], display: "flex", flexDirection: "column", gap: spacing[1] }}>
                    <div style={PREVIEW_LINE}>
                      <span>Bundle</span>
                      <span>{!previewData.breakdown.hasCore
                            ? "Standalone"
                            : previewData.halvingReason
                              ? previewData.halvingReason
                              : previewData.breakdown.hasBundleRequirement
                                ? "Bundle requirement met"
                                : "No bundle requirement"}</span>
                    </div>

                    {previewData.breakdown.enrollmentFee !== null && previewData.breakdown.enrollmentFee >= 125 && (
                      <div style={{ ...PREVIEW_LINE, color: colors.success }}>
                        <span>Enrollment bonus</span>
                        <span>+$10.00</span>
                      </div>
                    )}

                    <div style={PREVIEW_LINE}>
                      <span>Period</span>
                      <span>{new Date(previewData.periodStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {" – "}
                        {new Date(previewData.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ACA Plan */}
          <div style={{ background: colors.bgSurface, borderRadius: radius.xl, border: `1px solid ${includeAca ? colorAlpha(semanticColors.accentTealMid, 0.3) : colors.borderDefault}`, padding: spacing[5], marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={includeAca}
                onChange={(e) => setIncludeAca(e.target.checked)}
                style={{ accentColor: colors.primary400 }}
              />
              <label style={{ ...LBL, fontSize: typography.sizes.sm.fontSize, margin: 0, cursor: "pointer" }} onClick={() => setIncludeAca(!includeAca)}>
                Include ACA Plan
              </label>
            </div>

            {includeAca && (
              <div style={{ marginTop: 12 }}>
                {/* Bundled / Standalone toggle */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  {(["bundled", "standalone"] as const).map(mode => (
                    <label
                      key={mode}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        padding: "8px 12px",
                        borderRadius: radius.lg,
                        border: acaMode === mode
                          ? `2px solid ${colors.primary500}`
                          : `2px solid ${colors.borderDefault}`,
                        background: acaMode === mode ? colorAlpha(semanticColors.accentTealMid, 0.1) : "transparent",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: acaMode === mode ? 700 : 500,
                        color: acaMode === mode ? colors.primary300 : colors.textSecondary,
                        transition: `all ${motion.duration.fast} ${motion.easing.out}`,
                      }}
                    >
                      <input
                        type="radio"
                        name="acaMode"
                        value={mode}
                        checked={acaMode === mode}
                        onChange={() => setAcaMode(mode)}
                        style={{ accentColor: colors.primary500 }}
                      />
                      {mode === "bundled" ? "Bundled" : "Standalone"}
                    </label>
                  ))}
                </div>

                {acaMode === "bundled" ? (
                  <>
                    <div style={ACA_FIELDS}>
                      <div>
                        <label style={LBL}>Carrier</label>
                        <select
                          className="input-focus"
                          style={{ ...baseInputStyle, height: 42 }}
                          value={acaCarrier}
                          onChange={(e) => setAcaCarrier(e.target.value)}
                        >
                          <option value="">Select ACA carrier...</option>
                          {products.filter(p => p.type === "ACA_PL" && p.active).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={LBL}>Members</label>
                        <input
                          type="number"
                          min={1}
                          className="input-focus"
                          style={baseInputStyle}
                          placeholder="1"
                          value={acaMemberCount}
                          onChange={(e) => setAcaMemberCount(e.target.value)}
                        />
                      </div>
                    </div>
                    <p style={{ margin: "8px 0 0", fontSize: typography.sizes.xs.fontSize, color: colors.textTertiary }}>
                      ACA will be submitted with the sale above — meets bundle requirement
                    </p>
                  </>
                ) : (
                  <>
                    <div style={ACA_FORM_GRID}>
                      <div>
                        <label style={LBL}>Agent</label>
                        <select
                          className="input-focus"
                          style={{ ...baseInputStyle, height: 42 }}
                          value={acaStandaloneAgent}
                          onChange={(e) => setAcaStandaloneAgent(e.target.value)}
                        >
                          <option value="">Select agent...</option>
                          {agents.filter(a => a.active !== false).map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Input
                          label="Member Name"
                          placeholder="Member full name"
                          value={acaStandaloneMemberName}
                          onChange={(e) => setAcaStandaloneMemberName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={LBL}>Carrier</label>
                        <select
                          className="input-focus"
                          style={{ ...baseInputStyle, height: 42 }}
                          value={acaStandaloneCarrier}
                          onChange={(e) => setAcaStandaloneCarrier(e.target.value)}
                        >
                          <option value="">Select ACA carrier...</option>
                          {products.filter(p => p.type === "ACA_PL" && p.active).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={LBL}>Members</label>
                        <input
                          type="number"
                          min={1}
                          className="input-focus"
                          style={baseInputStyle}
                          placeholder="1"
                          value={acaStandaloneMemberCount}
                          onChange={(e) => setAcaStandaloneMemberCount(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={LBL}>Sale Date</label>
                        <input
                          type="date"
                          className="input-focus"
                          style={baseInputStyle}
                          value={acaStandaloneSaleDate}
                          onChange={(e) => setAcaStandaloneSaleDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={async () => {
                          if (!acaStandaloneAgent) { setMsg({ text: "Select an agent", type: "error" }); return; }
                          if (!acaStandaloneMemberName.trim()) { setMsg({ text: "Member name is required", type: "error" }); return; }
                          if (!acaStandaloneCarrier) { setMsg({ text: "Select an ACA carrier", type: "error" }); return; }
                          const count = parseInt(acaStandaloneMemberCount, 10);
                          if (!count || count < 1) { setMsg({ text: "Member count must be at least 1", type: "error" }); return; }
                          const acaProduct = products.find(p => p.id === acaStandaloneCarrier && p.type === "ACA_PL");
                          if (!acaProduct) { setMsg({ text: "Selected ACA product not found", type: "error" }); return; }
                          try {
                            const resp = await authFetch(`${API}/api/sales/aca`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                agentId: acaStandaloneAgent,
                                memberName: acaStandaloneMemberName,
                                carrier: acaProduct.name,
                                memberCount: count,
                                productId: acaProduct.id,
                                saleDate: acaStandaloneSaleDate || undefined,
                              }),
                            });
                            if (!resp.ok) {
                              const err = await resp.json().catch(() => ({}));
                              throw new Error(err.error || `Request failed (${resp.status})`);
                            }
                            setMsg({ text: "ACA entry submitted", type: "success" });
                            clearTimeout(msgTimerRef.current);
                            msgTimerRef.current = setTimeout(() => setMsg(null), 5000);
                            setAcaStandaloneAgent("");
                            setAcaStandaloneMemberName("");
                            setAcaStandaloneCarrier("");
                            setAcaStandaloneMemberCount("1");
                            setAcaStandaloneSaleDate(new Date().toISOString().slice(0, 10));
                            onSaleCreated?.();
                          } catch (err: unknown) {
                            const message = err instanceof Error ? err.message : "Request failed. Check connection and try again.";
                            setMsg({ text: message, type: "error" });
                          }
                        }}
                      >
                        Submit ACA Entry
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Receipt paste area */}
          <div style={{ background: colors.bgSurface, borderRadius: radius.xl, border: `1px solid ${colors.borderDefault}`, padding: spacing[5], marginBottom: 16 }}>
            <label style={{ ...LBL, fontSize: typography.sizes.sm.fontSize, display: "flex", alignItems: "center", gap: 6 }}>
              <ClipboardList size={14} />Paste Sale Receipt
            </label>
            <div style={{ position: "relative" }}>
              <textarea
                className="input-focus"
                style={{
                  ...baseInputStyle,
                  height: 120,
                  resize: "vertical",
                  fontFamily: typography.fontMono,
                  fontSize: typography.sizes.xs.fontSize,
                  borderStyle: "dashed",
                  borderWidth: 2,
                  borderColor: parsed ? colors.success : colors.borderStrong,
                  borderRadius: radius.lg,
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
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Button type="button" variant="success" size="sm" onClick={handleParse}>
                <Upload size={13} />Parse Receipt
              </Button>
              {receipt && (
                <Button type="button" variant="secondary" size="sm" onClick={clearReceipt}>
                  <X size={13} />Clear
                </Button>
              )}
            </div>

            {parsed && (
              <p style={{ margin: "8px 0 0", fontSize: typography.sizes.xs.fontSize, color: colors.success, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Check size={12} />Parsed — fields filled in form
              </p>
            )}

            {/* Parsed receipt info */}
            {parsed && (parsedInfo.parsedProducts.length > 0 || parsedInfo.coreProduct) && (
              <div className="animate-fade-in" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid rgba(52,211,153,0.2)` }}>
                {parsedInfo.parsedProducts.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    {parsedInfo.parsedProducts.map((pp, i) => {
                      const matched = matchProduct(pp.name, products);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", fontSize: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {matched ? <Check size={12} color={colors.success} /> : <XCircle size={12} color={colors.danger} />}
                            <span style={{ color: colors.textPrimary }}>{matched ? matched.name : pp.name}</span>
                            <Badge color={pp.isAddon ? colors.info : colors.primary400} variant="subtle" size="sm">
                              {pp.isAddon ? "Add-on" : "Core"}
                            </Badge>
                          </div>
                          <span style={{ fontWeight: 600, color: colors.textPrimary }}>${pp.price}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {parsedInfo.totalPremium && (
                    <div style={{ background: colorAlpha(semanticColors.accentGreenMid, 0.12), borderRadius: radius.lg, padding: "6px 12px", border: "1px solid rgba(52,211,153,0.15)", flex: 1, minWidth: 100 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: colors.textTertiary, letterSpacing: typography.tracking.caps, textTransform: "uppercase" }}>TOTAL PREMIUM</div>
                      <div style={{ fontWeight: 800, fontSize: typography.sizes.md.fontSize, color: colors.success }}>${parsedInfo.totalPremium}</div>
                    </div>
                  )}
                  {parsedInfo.enrollmentFee && (
                    <div style={{ background: colors.warningBg, borderRadius: radius.lg, padding: "6px 12px", border: `1px solid ${colorAlpha(semanticColors.statusPending, 0.15)}`, flex: 1, minWidth: 100 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: colors.textTertiary, letterSpacing: typography.tracking.caps, textTransform: "uppercase" }}>ENROLL FEE</div>
                      <div style={{ fontWeight: 800, fontSize: typography.sizes.md.fontSize, color: colors.warning }}>${parsedInfo.enrollmentFee}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Add-on Products */}
          {(() => {
            const addonProducts = products
              .filter(p => p.active && (p.type === "ADDON" || p.type === "AD_D") && p.id !== form.productId)
              .sort((a, b) => {
                if (a.type !== b.type) return a.type === "ADDON" ? -1 : 1;
                return a.name.localeCompare(b.name);
              });
            return (
              <div style={{ background: colors.bgSurface, borderRadius: radius.xl, border: `1px solid ${colors.borderDefault}`, padding: spacing[5] }}>
                <label style={{ ...LBL, fontSize: typography.sizes.sm.fontSize, display: "flex", alignItems: "center", gap: 6 }}>
                  <Plus size={14} />Add-on Products
                </label>
                <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: radius.lg, padding: spacing[2] }}>
                  {addonProducts.length === 0 ? (
                    <span style={{ fontSize: 12, color: colors.textTertiary }}>No add-on products available</span>
                  ) : (
                    addonProducts.map(ap => {
                      const isChecked = form.addonProductIds.includes(ap.id);
                      return (
                        <div key={ap.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
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
                                triggerPreview(true);
                              }}
                            />
                            <span style={{ fontSize: 12, color: colors.textPrimary, flex: 1 }}>{ap.name}</span>
                            <Badge color={ap.type === "AD_D" ? colors.warning : colors.info} variant="subtle" size="sm">
                              {ap.type === "AD_D" ? "AD&D" : "ADDON"}
                            </Badge>
                          </div>
                          {isChecked && (
                            <div style={{ paddingLeft: 26, paddingBottom: 10 }}>
                              <label style={{ ...LBL, fontSize: typography.sizes.xs.fontSize, marginBottom: 4 }}>Premium ($)</label>
                              <input
                                className="input-focus"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={addonPremiums[ap.id] ?? ""}
                                onChange={e => setAddonPremiums(prev => ({ ...prev, [ap.id]: e.target.value }))}
                                style={{ ...baseInputStyle, width: "100%", fontSize: typography.sizes.sm.fontSize }}
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

        </div>
        {/* -- END RIGHT COLUMN -- */}

        </div>
      </form>
    </div>
  );
}
