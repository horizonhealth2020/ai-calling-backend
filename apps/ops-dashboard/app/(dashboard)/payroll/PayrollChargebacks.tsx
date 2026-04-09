"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef, type FormEvent } from "react";
import {
  Button, Card, EmptyState, useToast,
  colors, spacing, typography, motion, radius,
  baseInputStyle, baseLabelStyle, baseThStyle, baseTdStyle,
  Badge,
} from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar } from "@ops/utils";
import { CheckCircle, XCircle, AlertTriangle, Search, X, Loader2 } from "lucide-react";

const C = colors;
const S = spacing;
const R = radius;

/* ── Types ──────────────────────────────────────────────────── */

interface ParsedRow {
  postedDate: string | null;
  type: string | null;
  payeeId: string | null;
  payeeName: string | null;
  payoutPercent: number | null;
  chargebackAmount: number | null;
  totalAmount: number | null;
  transactionDescription: string | null;
  product: string | null;
  memberCompany: string | null;
  memberId: string | null;
  memberAgentCompany: string | null;
  memberAgentId: string | null;
}

interface ReviewProduct {
  id: string;
  name: string;
  type: string;
  premium: number;
  // Phase 47 WR-04: commission is the actual clawback basis the server uses.
  // premium is retained for display only; never use it as the chargeback total.
  commission: number;
  selected: boolean;
}

interface MatchedSaleInfo {
  id: string;
  memberName: string;
  agentName: string;
  agentId: string;
  fullCommission?: number;
  products: Array<{ id: string; name: string; type: string; premium: number; commission: number }>;
}

interface ReviewRow {
  postedDate: string | null;
  type: string | null;
  payeeId: string | null;
  payeeName: string | null;
  payoutPercent: number | null;
  chargebackAmount: number;
  totalAmount: number | null;
  transactionDescription: string | null;
  product: string | null;
  memberCompany: string | null;
  memberId: string | null;
  memberAgentCompany: string | null;
  memberAgentId: string | null;
  matchStatus: "MATCHED" | "MULTIPLE" | "UNMATCHED";
  matchedSales: MatchedSaleInfo[];
  selectedSaleId: string | null;
  products: ReviewProduct[];
  amountManuallyOverridden: boolean;
  assignedTo: string;
}

interface RepRoster {
  id: string;
  name: string;
  active: boolean;
}

type LookupProduct = {
  id: string;
  name: string;
  type: string;
  premium: number;
  commission: number;
};
type LookupResult = {
  saleId: string;
  memberName: string;
  memberId: string | null;
  agentName: string;
  agentId: string;
  premium: number;
  enrollmentFee: number | null;
  products: LookupProduct[];
  fullCommission: number;
};

const MINI_LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: C.textTertiary,
  marginBottom: 2,
};
const MINI_VALUE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: C.textPrimary,
};

/* ── Parser Helpers ─────────────────────────────────────────── */

const MONTH_MAP: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDateField(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const monthStr = match[2].toLowerCase();
  const yearShort = parseInt(match[3], 10);
  const month = MONTH_MAP[monthStr];
  if (month === undefined) return null;
  const year = yearShort < 50 ? 2000 + yearShort : 1900 + yearShort;
  const d = new Date(year, month, day);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseChargebackAmount(raw: string): number | null {
  const match = raw.match(/\(\$([\d,]+\.\d{2})\)/);
  if (!match) return null;
  return -parseFloat(match[1].replace(/,/g, ""));
}

function parseDollarAmount(raw: string): number | null {
  const match = raw.match(/\$?([\d,]+\.\d{2})/);
  if (!match) return null;
  return parseFloat(match[1].replace(/,/g, ""));
}

function parsePercent(raw: string): number | null {
  const match = raw.match(/(\d+(?:\.\d+)?)%/);
  if (!match) return null;
  return parseFloat(match[1]);
}

function parseChargebackText(raw: string): ParsedRow[] {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const rows: ParsedRow[] = [];

  const joinedLines: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const fieldCount = lines[i].split("\t").length;
    if (fieldCount <= 3 && i + 1 < lines.length) {
      joinedLines.push(lines[i] + "\t" + lines[i + 1]);
      i += 2;
    } else {
      joinedLines.push(lines[i]);
      i++;
    }
  }

  for (const line of joinedLines) {
    let fields = line.split("\t");
    if (fields.length < 2) continue;

    if (/^\d+$/.test(fields[0].trim()) && /\d{1,2}-[A-Za-z]{3}-\d{2}/.test(fields[1])) {
      fields = fields.slice(1);
    }

    let offset = 0;
    if (fields[2] && fields[2].trim() === "Product") {
      offset = 1;
    }

    const txnDesc = fields[7 + offset] ? fields[7 + offset].trim() : "";
    const txnParts = txnDesc.split("|").map((p) => p.trim());
    const extractedType = txnParts[txnParts.length - 1] || null;

    const row: ParsedRow = {
      postedDate: fields[0] ? parseDateField(fields[0]) : null,
      type: extractedType,
      payeeId: fields[2 + offset] ? fields[2 + offset].trim() || null : null,
      payeeName: fields[3 + offset] ? fields[3 + offset].trim() || null : null,
      payoutPercent: fields[4 + offset] ? parsePercent(fields[4 + offset]) : null,
      chargebackAmount: fields[5 + offset] ? parseChargebackAmount(fields[5 + offset]) : null,
      totalAmount: fields[6 + offset] ? parseDollarAmount(fields[6 + offset]) : null,
      transactionDescription: fields[7 + offset] ? fields[7 + offset].trim() || null : null,
      product: fields[8 + offset] ? fields[8 + offset].trim() || null : null,
      memberCompany: null,
      memberId: null,
      memberAgentCompany: null,
      memberAgentId: null,
    };

    if (fields[9 + offset]) {
      const memberParts = fields[9 + offset].split("|").map((p) => p.trim());
      row.memberCompany = memberParts[0] || null;
      row.memberId = memberParts[1] || null;
    }

    if (fields[10 + offset]) {
      const agentParts = fields[10 + offset].split("|").map((p) => p.trim());
      row.memberAgentCompany = agentParts[0] || null;
      row.memberAgentId = agentParts[1] || null;
    }

    rows.push(row);
  }

  return rows;
}

/* ── Style Constants ────────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  ...baseInputStyle,
  boxSizing: "border-box",
};

const LBL: React.CSSProperties = { ...baseLabelStyle };

const SECTION_HEADING: React.CSSProperties = {
  margin: `0 0 ${S[4]}px`,
  fontSize: 16,
  fontWeight: 600,
  color: C.textPrimary,
};

const TEXTAREA: React.CSSProperties = {
  ...baseInputStyle,
  minHeight: 120,
  resize: "vertical" as const,
  fontFamily: typography.fontMono,
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box" as const,
};

const TABLE_WRAP: React.CSSProperties = {
  width: "100%",
  overflowX: "auto" as const,
};

const COMPACT_INPUT: React.CSSProperties = {
  ...baseInputStyle,
  padding: "6px 8px",
  fontSize: 13,
  boxSizing: "border-box" as const,
};

const SUMMARY_BAR: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: S[4],
  padding: `${S[4]}px ${S[6]}px`,
  borderBottom: `1px solid ${C.borderSubtle}`,
  background: C.bgSurface,
};

const PRODUCT_CHECKBOX_WRAP: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 13,
  color: C.textSecondary,
  cursor: "pointer",
  marginRight: S[2],
};

const REMOVE_BTN: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: C.textTertiary,
  padding: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const PRODUCT_TYPE_COLORS: Record<string, { bg: string; fg: string }> = {
  CORE: { bg: "rgba(20,184,166,0.15)", fg: "#14b8a6" },
  ADDON: { bg: "rgba(13,148,136,0.15)", fg: "#0d9488" },
  AD_D: { bg: "rgba(217,119,6,0.15)", fg: "#d97706" },
  ACA_PL: { bg: "rgba(59,130,246,0.15)", fg: "#3b82f6" },
};

/* ── Props ──────────────────────────────────────────────────── */

export interface PayrollChargebacksProps {
  API: string;
}

/* ── Component ──────────────────────────────────────────────── */

export default function PayrollChargebacks({ API }: PayrollChargebacksProps) {
  const { toast } = useToast();

  /* ── Batch review state ──────────────────────────────────── */
  const [rawText, setRawText] = useState("");
  const [reviewRecords, setReviewRecords] = useState<ReviewRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reps, setReps] = useState<RepRoster[]>([]);
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredRemoveIdx, setHoveredRemoveIdx] = useState<number | null>(null);

  const repsRef = useRef(reps);
  repsRef.current = reps;
  const activeRepNames = reps.filter((r) => r.active).map((r) => r.name);

  /* ── Single chargeback lookup state ──────────────────────── */
  const [chargebackForm, setChargebackForm] = useState({ memberName: "", memberId: "", notes: "" });
  const [chargebackMsg, setChargebackMsg] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [allSelected, setAllSelected] = useState(true);

  /* ── Live net deduction (sum of selected products' canonical commission) ── */
  const liveNetDeduction = useMemo(() => {
    if (!lookupResult) return 0;
    return lookupResult.products
      .filter(p => selectedProductIds.includes(p.id))
      .reduce((sum, p) => sum + p.commission, 0);
  }, [selectedProductIds, lookupResult]);

  /* ── Fetch rep roster ────────────────────────────────────── */

  const fetchReps = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/api/cs-rep-roster`);
      if (res.ok) setReps(await res.json());
    } catch { /* ignore */ }
  }, [API]);

  useEffect(() => { fetchReps(); }, [fetchReps]);

  /* ── Batch assign helper ─────────────────────────────────── */

  const fetchBatchAssign = async (count: number): Promise<string[]> => {
    try {
      const res = await authFetch(`${API}/api/reps/batch-assign?type=chargeback&count=${count}`);
      if (res.ok) {
        const data = await res.json();
        return data.assignments ?? [];
      }
    } catch { /* fallback below */ }
    const active = repsRef.current.filter((r) => r.active).map((r) => r.name);
    if (active.length === 0) return Array(count).fill("");
    const offset = Math.floor(Math.random() * active.length);
    return Array.from({ length: count }, (_, i) => active[(offset + i) % active.length]);
  };

  /* ── Batch review handlers ───────────────────────────────── */

  const handleTextChange = (text: string) => {
    setRawText(text);
    if (!text.trim()) setReviewRecords([]);
  };

  const handleParseAndPreview = async () => {
    if (!rawText.trim()) return;
    setPreviewing(true);
    try {
      const parsed = parseChargebackText(rawText);
      if (parsed.length === 0) { setPreviewing(false); return; }

      const res = await authFetch(`${API}/api/chargebacks/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: parsed }),
      });

      if (!res.ok) { setPreviewing(false); return; }

      const data = await res.json();
      const previews: any[] = data.previews;
      const assignments = await fetchBatchAssign(previews.length);

      const rows: ReviewRow[] = previews.map((p: any, i: number) => {
        let products: ReviewProduct[] = [];
        if (p.matchStatus === "MATCHED" && p.matchedSales.length === 1) {
          products = p.matchedSales[0].products.map((prod: any) => ({
            ...prod,
            selected: true,
          }));
        }
        return {
          postedDate: p.postedDate,
          type: p.type,
          payeeId: p.payeeId,
          payeeName: p.payeeName,
          payoutPercent: p.payoutPercent,
          chargebackAmount: p.chargebackAmount,
          totalAmount: p.totalAmount,
          transactionDescription: p.transactionDescription,
          product: p.product,
          memberCompany: p.memberCompany,
          memberId: p.memberId,
          memberAgentCompany: p.memberAgentCompany,
          memberAgentId: p.memberAgentId,
          matchStatus: p.matchStatus,
          matchedSales: p.matchedSales,
          selectedSaleId: p.selectedSaleId,
          products,
          amountManuallyOverridden: false,
          assignedTo: assignments[i] ?? "",
        };
      });

      setReviewRecords(rows);
      setStatusFilter(null);
    } catch {
      toast("error", "Preview failed (network error)");
    } finally {
      setPreviewing(false);
    }
  };

  const toggleProduct = (rowIdx: number, productId: string) => {
    setReviewRecords(prev => prev.map((row, i) => {
      if (i !== rowIdx) return row;
      const products = row.products.map(p =>
        p.id === productId ? { ...p, selected: !p.selected } : p
      );
      // Phase 47 WR-04: sum per-product COMMISSION (the real clawback basis)
      // rather than premium. Previously the displayed total could diverge
      // from what the server actually wrote (server uses payoutAmount).
      const autoAmount = products
        .filter(p => p.selected)
        .reduce((sum, p) => sum + (Number(p.commission) || 0), 0);
      return {
        ...row,
        products,
        chargebackAmount: row.amountManuallyOverridden ? row.chargebackAmount : -autoAmount,
      };
    }));
  };

  const selectSale = (rowIdx: number, saleId: string) => {
    setReviewRecords(prev => prev.map((row, i) => {
      if (i !== rowIdx) return row;
      const sale = row.matchedSales.find(s => s.id === saleId);
      if (!sale) return row;
      const products: ReviewProduct[] = sale.products.map(p => ({ ...p, selected: true }));
      // Phase 47 WR-04: use commission, not premium. See toggleProduct comment.
      const autoAmount = products.reduce((sum, p) => sum + (Number(p.commission) || 0), 0);
      return {
        ...row,
        matchStatus: "MATCHED" as const,
        selectedSaleId: saleId,
        products,
        chargebackAmount: row.amountManuallyOverridden ? row.chargebackAmount : -autoAmount,
      };
    }));
  };

  const removeReviewRow = (idx: number) => {
    const removed = reviewRecords[idx];
    setReviewRecords(prev => prev.filter((_, i) => i !== idx));
    toast("info", `Removed ${removed.memberCompany || removed.memberId || "entry"}`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          setReviewRecords(prev => {
            const next = [...prev];
            next.splice(idx, 0, removed);
            return next;
          });
        },
      },
    });
  };

  const updateReviewField = (idx: number, field: keyof ReviewRow, value: any) => {
    setReviewRecords(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      if (field === "chargebackAmount") {
        return { ...r, [field]: value, amountManuallyOverridden: true };
      }
      return { ...r, [field]: value };
    }));
  };

  const handleReviewSubmit = async () => {
    if (reviewRecords.length === 0) return;
    setSubmitting(true);
    try {
      const batchId = crypto.randomUUID();
      const submitRecords = reviewRecords.map(r => ({
        postedDate: r.postedDate,
        type: r.type,
        payeeId: r.payeeId,
        payeeName: r.payeeName,
        payoutPercent: r.payoutPercent,
        chargebackAmount: r.chargebackAmount,
        totalAmount: r.totalAmount,
        transactionDescription: r.transactionDescription,
        product: r.product,
        memberCompany: r.memberCompany,
        memberId: r.memberId,
        memberAgentCompany: r.matchedSales.length > 0 && r.selectedSaleId
          ? r.matchedSales.find(s => s.id === r.selectedSaleId)?.agentName ?? r.memberAgentCompany
          : r.memberAgentCompany,
        memberAgentId: r.memberAgentId,
        assignedTo: r.assignedTo,
        selectedSaleId: r.selectedSaleId,
      }));

      const res = await authFetch(`${API}/api/chargebacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: submitRecords, rawPaste: rawText, batchId, source: "PAYROLL" }),
      });

      if (res.status === 201) {
        const data = await res.json();
        setRawText("");
        setReviewRecords([]);
        setStatusFilter(null);
        toast("success", `${data.count} chargebacks submitted`);
      } else {
        toast("error", `Submit failed (${res.status})`);
      }
    } catch {
      toast("error", "Submit failed (network error)");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Single chargeback lookup handlers ───────────────────── */

  async function lookupSale() {
    setChargebackMsg("");
    setLookupResult(null);
    setSelectedProductIds([]);
    setAllSelected(true);

    const { memberId, memberName } = chargebackForm;
    if (!memberId && !memberName) {
      setChargebackMsg("Error: Enter a Member ID or Member Name to look up");
      return;
    }

    setLookupLoading(true);
    try {
      const params = new URLSearchParams();
      if (memberId) params.set("memberId", memberId);
      else if (memberName) params.set("memberName", memberName);

      const res = await authFetch(`${API}/api/clawbacks/lookup?${params}`);
      if (res.ok) {
        const data: LookupResult = await res.json();
        setLookupResult(data);
        setSelectedProductIds(data.products.map(p => p.id));
        setAllSelected(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setChargebackMsg(`Error: ${err.error ?? `Request failed (${res.status})`}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      setChargebackMsg(`Error: Unable to reach API \u2014 ${message}`);
    } finally {
      setLookupLoading(false);
    }
  }

  function toggleLookupProduct(productId: string) {
    setSelectedProductIds(prev => {
      const next = prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId];
      setAllSelected(lookupResult ? next.length === lookupResult.products.length : false);
      return next;
    });
  }

  function toggleAll() {
    if (!lookupResult) return;
    if (allSelected) {
      setSelectedProductIds([]);
      setAllSelected(false);
    } else {
      setSelectedProductIds(lookupResult.products.map(p => p.id));
      setAllSelected(true);
    }
  }

  async function submitChargeback(e: FormEvent) {
    e.preventDefault();
    setChargebackMsg("");

    if (!lookupResult) {
      setChargebackMsg("Error: Look up a sale first before processing chargeback");
      return;
    }

    if (selectedProductIds.length === 0) {
      setChargebackMsg("Error: Select at least one product to chargeback");
      return;
    }

    try {
      const body: Record<string, unknown> = {};
      if (chargebackForm.memberId) body.memberId = chargebackForm.memberId;
      if (chargebackForm.memberName) body.memberName = chargebackForm.memberName;
      if (chargebackForm.notes) body.notes = chargebackForm.notes;
      if (!allSelected) {
        body.productIds = selectedProductIds;
      }

      const res = await authFetch(`${API}/api/clawbacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const suffix = allSelected ? "" : ` (${selectedProductIds.length} of ${lookupResult.products.length} products)`;
        setChargebackMsg(`Chargeback processed successfully${suffix}`);
        setChargebackForm({ memberName: "", memberId: "", notes: "" });
        setLookupResult(null);
        setSelectedProductIds([]);
        setAllSelected(true);
      } else {
        const err = await res.json().catch(() => ({}));
        setChargebackMsg(`Error: ${err.error ?? "No matching sale found"}`);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "network error";
      setChargebackMsg(`Error: Unable to reach API \u2014 ${message}`);
    }
  }

  function handleInputChange(field: "memberId" | "memberName", value: string) {
    setChargebackForm(f => ({ ...f, [field]: value }));
    if (lookupResult) {
      setLookupResult(null);
      setSelectedProductIds([]);
      setAllSelected(true);
    }
  }

  /* ── Render ──────────────────────────────────────────────── */

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: S[6] }}>
      {/* ═══ Batch Chargeback Review ═══ */}

      {/* Paste Area -- hidden when review records exist */}
      {reviewRecords.length === 0 && (
        <Card>
          <h3 style={SECTION_HEADING}>Batch Chargeback Review</h3>
          <textarea
            style={TEXTAREA}
            placeholder="Paste chargeback data from spreadsheet here..."
            value={rawText}
            onChange={(e) => handleTextChange(e.target.value)}
            disabled={previewing}
          />
          {rawText.trim() && (
            <div style={{ marginTop: S[4], display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="primary"
                onClick={handleParseAndPreview}
                disabled={!rawText.trim() || previewing}
                loading={previewing}
              >
                {previewing ? (
                  <><Loader2 size={14} style={{ animation: "spin 1s linear infinite", marginRight: 6 }} />Matching...</>
                ) : "Parse & Preview"}
              </Button>
            </div>
          )}
          {!rawText && (
            <EmptyState
              title="Paste Chargeback Data"
              description="Paste tab-separated chargeback rows from your spreadsheet. Records will be parsed and matched to sales automatically."
            />
          )}
        </Card>
      )}

      {/* Review Table */}
      {reviewRecords.length > 0 && (() => {
        const matchedCount = reviewRecords.filter(r => r.matchStatus === "MATCHED").length;
        const multipleCount = reviewRecords.filter(r => r.matchStatus === "MULTIPLE").length;
        const unmatchedCount = reviewRecords.filter(r => r.matchStatus === "UNMATCHED").length;
        const totalAmount = reviewRecords.reduce((sum, r) => sum + Math.abs(Number(r.chargebackAmount)), 0);
        const filteredRecords = reviewRecords
          .map((r, originalIdx) => ({ ...r, _originalIdx: originalIdx }))
          .filter(r => !statusFilter || r.matchStatus === statusFilter);

        return (
          <Card padding="none">
            <div style={{ padding: `${S[4]}px ${S[6]}px 0` }}>
              <h3 style={{ ...SECTION_HEADING, fontWeight: 700 }}>Review Batch</h3>
            </div>

            {/* Summary Bar */}
            <div style={SUMMARY_BAR} role="toolbar" aria-label="Filter by match status">
              <button
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                onClick={() => setStatusFilter(statusFilter === "MATCHED" ? null : "MATCHED")}
              >
                <Badge color={C.success} variant={statusFilter === "MATCHED" ? "solid" : "subtle"} size="md">
                  {matchedCount} Matched
                </Badge>
              </button>
              <button
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                onClick={() => setStatusFilter(statusFilter === "MULTIPLE" ? null : "MULTIPLE")}
              >
                <Badge color={C.warning} variant={statusFilter === "MULTIPLE" ? "solid" : "subtle"} size="md">
                  {multipleCount} Multiple
                </Badge>
              </button>
              <button
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                onClick={() => setStatusFilter(statusFilter === "UNMATCHED" ? null : "UNMATCHED")}
              >
                <Badge color={C.danger} variant={statusFilter === "UNMATCHED" ? "solid" : "subtle"} size="md">
                  {unmatchedCount} Unmatched
                </Badge>
              </button>
              <span style={{ marginLeft: "auto", color: C.danger, fontWeight: typography.weights.bold, fontSize: 16 }}>
                Total: {formatDollar(totalAmount)}
              </span>
            </div>

            {/* Review Table */}
            <div style={TABLE_WRAP}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...baseThStyle, width: 90 }}>Status</th>
                    <th style={{ ...baseThStyle, minWidth: 140 }}>Member</th>
                    <th style={{ ...baseThStyle, minWidth: 120 }}>Agent</th>
                    <th style={{ ...baseThStyle, minWidth: 200 }}>Products</th>
                    <th style={{ ...baseThStyle, width: 100 }}>Amount</th>
                    <th style={{ ...baseThStyle, width: 130 }}>Rep</th>
                    <th style={{ ...baseThStyle, width: 44 }}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((rec) => {
                    const idx = rec._originalIdx;
                    const selectedSale = rec.selectedSaleId
                      ? rec.matchedSales.find(s => s.id === rec.selectedSaleId)
                      : rec.matchedSales.length === 1 ? rec.matchedSales[0] : null;
                    const agentName = selectedSale?.agentName ?? null;

                    return (
                      <tr
                        key={idx}
                        onMouseEnter={() => setHoveredRow(idx)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{
                          background: hoveredRow === idx ? C.bgSurfaceRaised : "transparent",
                          transition: `background ${motion.duration.fast} ${motion.easing.out}`,
                        }}
                      >
                        {/* Status */}
                        <td style={baseTdStyle}>
                          <Badge
                            color={rec.matchStatus === "MATCHED" ? C.success : rec.matchStatus === "MULTIPLE" ? C.warning : C.danger}
                            variant="subtle"
                            size="sm"
                          >
                            {rec.matchStatus}
                          </Badge>
                        </td>

                        {/* Member */}
                        <td style={baseTdStyle}>
                          <div>{rec.memberCompany || "--"}</div>
                          {rec.memberId && (
                            <div style={{ fontSize: 11, color: C.textTertiary }}>{rec.memberId}</div>
                          )}
                        </td>

                        {/* Agent */}
                        <td style={baseTdStyle}>
                          <span style={{ color: agentName ? C.textPrimary : C.textMuted }}>
                            {agentName || "--"}
                          </span>
                        </td>

                        {/* Products */}
                        <td style={baseTdStyle}>
                          {rec.matchStatus === "UNMATCHED" && (
                            <span style={{ color: C.textMuted }}>--</span>
                          )}
                          {rec.matchStatus === "MULTIPLE" && !rec.selectedSaleId && (
                            <select
                              style={{ ...COMPACT_INPUT, width: "auto" }}
                              value=""
                              onChange={(e) => selectSale(idx, e.target.value)}
                              aria-label={`Select matching sale for ${rec.memberCompany || rec.memberId}`}
                            >
                              <option value="" disabled>Select matching sale...</option>
                              {rec.matchedSales.map(sale => (
                                <option key={sale.id} value={sale.id}>
                                  {sale.agentName} - {sale.memberName} ({sale.products.length} products)
                                </option>
                              ))}
                            </select>
                          )}
                          {(rec.matchStatus === "MATCHED" || (rec.matchStatus === "MULTIPLE" && rec.selectedSaleId)) && rec.products.length > 0 && (
                            <div>
                              {rec.products.map(prod => (
                                <label key={prod.id} style={PRODUCT_CHECKBOX_WRAP}>
                                  <input
                                    type="checkbox"
                                    checked={prod.selected}
                                    onChange={() => toggleProduct(idx, prod.id)}
                                  />
                                  {prod.name} ({formatDollar(prod.premium)})
                                </label>
                              ))}
                            </div>
                          )}
                          {(rec.matchStatus === "MATCHED" || (rec.matchStatus === "MULTIPLE" && rec.selectedSaleId)) && rec.products.length === 0 && (
                            <span style={{ color: C.textMuted }}>--</span>
                          )}
                        </td>

                        {/* Amount */}
                        <td style={baseTdStyle}>
                          <input
                            type="text"
                            style={COMPACT_INPUT}
                            value={formatDollar(Math.abs(Number(rec.chargebackAmount)))}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9.]/g, "");
                              const num = parseFloat(raw);
                              if (!isNaN(num)) updateReviewField(idx, "chargebackAmount", -num);
                            }}
                          />
                        </td>

                        {/* Rep */}
                        <td style={baseTdStyle}>
                          <select
                            style={COMPACT_INPUT}
                            value={rec.assignedTo}
                            onChange={(e) => updateReviewField(idx, "assignedTo", e.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {activeRepNames.map(name => (
                              <option key={name} value={name}>{name}</option>
                            ))}
                          </select>
                        </td>

                        {/* Remove */}
                        <td style={baseTdStyle}>
                          <button
                            style={{
                              ...REMOVE_BTN,
                              color: hoveredRemoveIdx === idx ? C.danger : C.textTertiary,
                              transition: `color ${motion.duration.fast} ${motion.easing.out}`,
                            }}
                            onClick={() => removeReviewRow(idx)}
                            onMouseEnter={() => setHoveredRemoveIdx(idx)}
                            onMouseLeave={() => setHoveredRemoveIdx(null)}
                            aria-label={`Remove ${rec.memberCompany || rec.memberId || "entry"}`}
                            title="Remove from batch"
                          >
                            <X size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: S[3],
              padding: `${S[4]}px ${S[6]}px`,
              borderTop: `1px solid ${C.borderSubtle}`,
            }}>
              <Button
                variant="ghost"
                onClick={() => {
                  setReviewRecords([]);
                  setStatusFilter(null);
                }}
              >
                Clear Batch
              </Button>
              <Button
                variant="primary"
                onClick={handleReviewSubmit}
                disabled={submitting || reviewRecords.length === 0}
                loading={submitting}
              >
                {submitting ? "Submitting..." : "Submit Batch"}
              </Button>
            </div>
          </Card>
        );
      })()}

      {/* ═══ Single Chargeback Lookup ═══ */}

      <div style={{ maxWidth: 540 }}>
        <h3 style={SECTION_HEADING}>Single Chargeback Lookup</h3>
        <p style={{ color: C.textMuted, marginTop: 0, marginBottom: S[5], fontSize: 14, lineHeight: 1.7 }}>
          Look up a sale by Member ID (preferred) or Member Name, select products to chargeback, then process. Chargebacks target the oldest open payroll period.
        </p>

        <Card style={{ borderRadius: R["2xl"] }}>
          <form onSubmit={submitChargeback} style={{ display: "grid", gap: S[5] }}>
            {/* Step 1: Member lookup */}
            <div>
              <label style={LBL}>Member ID <span style={{ color: C.textMuted, fontWeight: 400, textTransform: "none", fontSize: 11 }}>(preferred)</span></label>
              <input
                className="input-focus"
                style={inputStyle}
                value={chargebackForm.memberId}
                placeholder="e.g. M-12345"
                onChange={e => handleInputChange("memberId", e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (!lookupResult) lookupSale(); } }}
              />
            </div>
            <div>
              <label style={LBL}>Member Name <span style={{ color: C.textMuted, fontWeight: 400, textTransform: "none", fontSize: 11 }}>(if no ID)</span></label>
              <input
                className="input-focus"
                style={inputStyle}
                value={chargebackForm.memberName}
                placeholder="e.g. John Doe"
                onChange={e => handleInputChange("memberName", e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (!lookupResult) lookupSale(); } }}
              />
            </div>

            {!lookupResult && (
              <Button
                variant="secondary"
                type="button"
                onClick={lookupSale}
                disabled={lookupLoading || (!chargebackForm.memberId && !chargebackForm.memberName)}
                style={{ justifySelf: "start" }}
              >
                <Search size={14} style={{ marginRight: 4 }} />
                {lookupLoading ? "Looking up..." : "Lookup Sale"}
              </Button>
            )}

            {/* Step 2a: Sale info + live net deduction preview */}
            {lookupResult && (
              <div style={{
                display: "grid",
                gap: S[2],
                padding: S[3],
                background: C.bgSurfaceRaised,
                borderRadius: R.md,
                border: `1px solid ${C.borderSubtle}`,
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: S[3] }}>
                  <div>
                    <div style={MINI_LABEL}>Agent</div>
                    <div style={MINI_VALUE}>{lookupResult.agentName}</div>
                  </div>
                  <div>
                    <div style={MINI_LABEL}>Member</div>
                    <div style={MINI_VALUE}>{lookupResult.memberName}</div>
                  </div>
                  <div>
                    <div style={MINI_LABEL}>Premium</div>
                    <div style={MINI_VALUE}>{formatDollar(lookupResult.premium)}</div>
                  </div>
                  <div>
                    <div style={MINI_LABEL}>Enrollment Fee</div>
                    <div style={MINI_VALUE}>
                      {lookupResult.enrollmentFee != null ? formatDollar(lookupResult.enrollmentFee) : "—"}
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: S[2], paddingTop: S[2], borderTop: `1px solid ${C.borderSubtle}` }}>
                  <div style={MINI_LABEL}>Net Chargeback (deducted from agent)</div>
                  <div style={{ fontSize: 20, color: C.danger, fontWeight: 800 }}>
                    −{formatDollar(liveNetDeduction)}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2b: Product selection */}
            {lookupResult && (
              <div style={{
                background: C.bgSurfaceRaised,
                borderRadius: R.lg,
                padding: S[4],
                border: `1px solid ${C.borderSubtle}`,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const,
                  letterSpacing: "0.06em", color: C.textTertiary, marginBottom: S[3],
                }}>
                  Products on sale ({lookupResult.products.length})
                </div>

                {/* All Products toggle */}
                <label style={{
                  display: "flex", alignItems: "center", gap: S[2],
                  padding: `${S[2]}px 0`, cursor: "pointer",
                  borderBottom: `1px solid ${C.borderSubtle}`, marginBottom: S[2],
                }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    style={{ accentColor: C.primary500, width: 16, height: 16 }}
                  />
                  <span style={{ fontWeight: 700, fontSize: 13, color: C.textPrimary }}>All Products</span>
                </label>

                {/* Individual products */}
                {lookupResult.products.map(p => {
                  const typeColor = PRODUCT_TYPE_COLORS[p.type] ?? { bg: "rgba(148,163,184,0.15)", fg: "#94a3b8" };
                  return (
                    <label key={p.id} style={{
                      display: "flex", alignItems: "center", gap: S[2],
                      padding: `${S[2]}px 0`, cursor: "pointer",
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedProductIds.includes(p.id)}
                        onChange={() => toggleLookupProduct(p.id)}
                        style={{ accentColor: C.primary500, width: 16, height: 16 }}
                      />
                      <span style={{ fontSize: 13, color: C.textPrimary }}>{p.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: "2px 6px",
                        borderRadius: 4, background: typeColor.bg, color: typeColor.fg,
                        textTransform: "uppercase" as const,
                      }}>
                        {p.type.replace("_", " ")}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <div>
              <label style={LBL}>Notes</label>
              <textarea
                className="input-focus"
                style={{ ...inputStyle, height: 88, resize: "vertical" } as React.CSSProperties}
                value={chargebackForm.notes}
                onChange={e => setChargebackForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: S[4], flexWrap: "wrap" }}>
              {lookupResult && (
                <Button
                  variant="danger"
                  type="submit"
                  disabled={selectedProductIds.length === 0}
                >
                  <XCircle size={15} /> Process Chargeback
                </Button>
              )}
              {chargebackMsg && (
                <div style={{
                  display: "flex", alignItems: "center", gap: S[2],
                  color: chargebackMsg.startsWith("Chargeback") ? C.success : C.danger,
                  fontWeight: 600, fontSize: 13,
                }}>
                  {chargebackMsg.startsWith("Chargeback")
                    ? <CheckCircle size={14} />
                    : <AlertTriangle size={14} />}
                  {chargebackMsg}
                </div>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
