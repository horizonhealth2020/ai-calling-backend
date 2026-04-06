"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  Button,
  EmptyState,
  ToastProvider,
  useToast,
  spacing,
  colors,
  typography,
  motion,
  baseInputStyle,
  baseThStyle,
  baseTdStyle,
  Badge,
} from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar } from "@ops/utils";
import { ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react";

type SocketClient = import("socket.io-client").Socket;

/* -- Types -- */

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

interface ConsolidatedRecord {
  postedDate: string | null;
  type: string | null;
  payeeId: string | null;
  payeeName: string | null;
  payoutPercent: number | null;
  chargebackAmount: number;
  totalAmount: number;
  transactionDescription: string | null;
  product: string;
  memberCompany: string;
  memberId: string;
  memberAgentCompany: string | null;
  memberAgentId: string | null;
  assignedTo: string;
}

interface ReviewProduct {
  id: string;
  name: string;
  type: string;
  premium: number;
  selected: boolean;
}

interface MatchedSaleInfo {
  id: string;
  memberName: string;
  agentName: string;
  agentId: string;
  products: Array<{ id: string; name: string; type: string; premium: number }>;
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

interface PendingParsedRow {
  agentName: string | null;
  agentIdField: string | null;
  memberId: string | null;
  memberName: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  product: string | null;
  monthlyAmount: number | null;
  paid: string | null;
  createdDate: string | null;
  firstBilling: string | null;
  activeDate: string | null;
  nextBilling: string | null;
  holdDate: string | null;
  holdReason: string | null;
  inactive: boolean | null;
  lastTransactionType: string | null;
}

interface ConsolidatedPendingRecord extends Omit<PendingParsedRow, 'product' | 'monthlyAmount'> {
  product: string;
  monthlyAmount: number;
  assignedTo: string;
}

/* -- Parser Functions -- */

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

function consolidateByMember(rows: ParsedRow[]): ConsolidatedRecord[] {
  const groups = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const key = row.memberId ?? row.memberCompany ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return Array.from(groups.entries()).map(([, memberRows]) => ({
    postedDate: memberRows[0].postedDate,
    type: memberRows[0].type,
    payeeId: memberRows[0].payeeId,
    payeeName: memberRows[0].payeeName,
    payoutPercent: memberRows[0].payoutPercent,
    chargebackAmount: memberRows.reduce((s, r) => s + (r.chargebackAmount ?? 0), 0),
    totalAmount: Math.abs(memberRows.reduce((s, r) => s + (r.chargebackAmount ?? 0), 0)),
    transactionDescription: memberRows[0].transactionDescription,
    product: memberRows
      .map((r) => r.product)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", "),
    memberCompany: memberRows[0].memberCompany ?? "",
    memberId: memberRows[0].memberId ?? "",
    memberAgentCompany: memberRows[0].memberAgentCompany ?? null,
    memberAgentId: memberRows[0].memberAgentId ?? null,
    assignedTo: "",
  }));
}

function assignRoundRobinLocal(
  records: ConsolidatedRecord[],
  assignments: string[]
): ConsolidatedRecord[] {
  return records.map((r, i) => ({ ...r, assignedTo: assignments[i] ?? "" }));
}

/* -- Pending Terms Parser Functions -- */

function parseMDYDate(raw: string): string | null {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const m = match[1].padStart(2, "0");
  const d = match[2].padStart(2, "0");
  return `${match[3]}-${m}-${d}`;
}

function parsePendingDollar(raw: string): number | null {
  const trimmed = raw.trim().replace(/[$,]/g, "");
  if (!trimmed) return null;
  const n = parseFloat(trimmed);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

function parseAgentInfo(raw: string): { agentName: string | null; agentIdField: string | null } {
  const match = raw.match(/^.+\s-\s(.+?)\s*\((\d+)\)$/);
  if (!match) return { agentName: null, agentIdField: null };
  return { agentName: match[1].trim(), agentIdField: match[2] };
}

function isRecordStart(line: string): boolean {
  const fields = line.split("\t");
  const first = fields[0].trim();
  const candidate = /^\d+$/.test(first) ? (fields[1] || "").trim() : first;
  return /^.+\s-\s.+\(\d+\)$/.test(candidate);
}

function parsePendingTermsText(raw: string): PendingParsedRow[] {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const rows: PendingParsedRow[] = [];

  const groups: string[][] = [];
  let i = 0;
  while (i < lines.length) {
    if (isRecordStart(lines[i])) {
      groups.push([lines[i], lines[i + 1] || "", lines[i + 2] || ""]);
      i += 3;
    } else {
      i++;
    }
  }

  for (const group of groups) {
    const line1 = group[0].split("\t");
    const line2 = group[1].split("\t");
    const line3 = group[2].split("\t");

    let f = line1;
    if (/^\d+$/.test((f[0] || "").trim()) && f.length > 1) {
      f = f.slice(1);
    }

    const agentInfoStr = (f[0] || "").trim();
    const { agentName, agentIdField } = parseAgentInfo(agentInfoStr);

    const row: PendingParsedRow = {
      agentName,
      agentIdField,
      memberId: f[1] ? f[1].trim() || null : null,
      memberName: f[2] ? f[2].trim() || null : null,
      city: f[3] ? f[3].trim() || null : null,
      state: f[4] ? f[4].trim() || null : null,
      phone: f[5] ? f[5].trim() || null : null,
      product: f[7] ? f[7].trim() || null : null,
      monthlyAmount: f[9] ? parsePendingDollar(f[9]) : null,
      paid: f[10] ? f[10].trim() || null : null,
      inactive: line2[0] ? (line2[0].trim().toLowerCase() === "inactive" ? true : line2[0].trim().toLowerCase() === "active" ? false : null) : null,
      createdDate: line2[1] ? parseMDYDate(line2[1]) : null,
      firstBilling: line2[2] ? parseMDYDate(line2[2]) : null,
      activeDate: line2[3] ? parseMDYDate(line2[3]) : null,
      nextBilling: line2[4] ? parseMDYDate(line2[4]) : null,
      holdDate: line2[5] ? parseMDYDate(line2[5]) : null,
      holdReason: line3[0] ? line3[0].trim() || null : null,
      lastTransactionType: line3[2] ? line3[2].trim() || null : null,
    };

    rows.push(row);
  }

  return rows;
}

function consolidatePendingByMember(rows: PendingParsedRow[]): ConsolidatedPendingRecord[] {
  const groups = new Map<string, PendingParsedRow[]>();
  for (const row of rows) {
    const key = row.memberId ?? "unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }
  return Array.from(groups.entries()).map(([, memberRows]) => ({
    ...memberRows[0],
    product: memberRows
      .map((r) => r.product)
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", "),
    monthlyAmount: Math.round(memberRows.reduce((s, r) => s + (r.monthlyAmount ?? 0), 0) * 100) / 100,
    assignedTo: "",
  }));
}

function assignPtRoundRobinLocal(
  records: ConsolidatedPendingRecord[],
  assignments: string[]
): ConsolidatedPendingRecord[] {
  return records.map((r, i) => ({ ...r, assignedTo: assignments[i] ?? "" }));
}

/* -- Style Constants -- */

const SECTION_HEADING: React.CSSProperties = {
  margin: `0 0 ${spacing[4]}px`,
  fontSize: 16,
  fontWeight: 600,
  color: colors.textPrimary,
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

const SIDEBAR_STYLE: React.CSSProperties = {
  borderLeft: `1px solid ${colors.borderSubtle}`,
  background: colors.bgSurface,
  padding: spacing[5],
  transition: `max-width ${motion.duration.normal} ${motion.easing.out}, padding ${motion.duration.normal} ${motion.easing.out}`,
  overflow: "hidden",
  flexShrink: 0,
};

const SUMMARY_BAR: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[4],
  padding: `${spacing[4]}px ${spacing[6]}px`,
  borderBottom: `1px solid ${colors.borderSubtle}`,
  background: colors.bgSurface,
};

const PRODUCT_CHECKBOX_WRAP: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 13,
  color: colors.textSecondary,
  cursor: "pointer",
  marginRight: spacing[2],
};

const REMOVE_BTN: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  color: colors.textTertiary,
  padding: 4,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const TYPE_OPTIONS = ["Chargeback", "Chargeback Reversal", "Refund Reversal"];

/* -- Props -- */

interface CSSubmissionsProps {
  socket: SocketClient | null;
  API: string;
}

/* -- Main Component -- */

export default function CSSubmissions({ socket, API }: CSSubmissionsProps) {
  const [rawText, setRawText] = useState("");
  const [records, setRecords] = useState<ConsolidatedRecord[]>([]);
  const [reps, setReps] = useState<RepRoster[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newRepName, setNewRepName] = useState("");

  // Review state (chargeback batch review)
  const [reviewRecords, setReviewRecords] = useState<ReviewRow[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  // Pending terms state
  const [ptRawPaste, setPtRawPaste] = useState("");
  const [ptRecords, setPtRecords] = useState<ConsolidatedPendingRecord[]>([]);
  const [ptSubmitting, setPtSubmitting] = useState(false);

  const activeRepNames = reps.filter((r) => r.active).map((r) => r.name);
  const repsRef = useRef(reps);
  repsRef.current = reps;

  const fetchReps = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/api/cs-rep-roster`);
      if (res.ok) {
        const data = await res.json();
        setReps(data);
      }
    } catch { /* ignore */ }
  }, [API]);

  useEffect(() => {
    fetchReps();
    authFetch(`${API}/api/agents`).then(r => r.ok ? r.json() : []).then(setAgents).catch(() => {});
  }, [fetchReps, API]);

  const fetchBatchAssign = async (type: "chargeback" | "pending_term", count: number): Promise<string[]> => {
    try {
      const res = await authFetch(`${API}/api/reps/batch-assign?type=${type}&count=${count}`);
      if (res.ok) {
        const data = await res.json();
        return data.assignments ?? [];
      }
    } catch { /* fallback below */ }
    console.warn(`[CSSubmissions] batch-assign API failed for type=${type}, using local fallback`);
    // Fallback: local round-robin with random offset to avoid always-start-at-0 bias
    const active = repsRef.current.filter((r) => r.active).map((r) => r.name);
    if (active.length === 0) return Array(count).fill("");
    const offset = Math.floor(Math.random() * active.length);
    return Array.from({ length: count }, (_, i) => active[(offset + i) % active.length]);
  };

  const handleTextChange = (text: string) => {
    setRawText(text);
    if (!text.trim()) {
      setRecords([]);
      setReviewRecords([]);
    }
  };

  const handleParseAndPreview = async () => {
    if (!rawText.trim()) return;
    setPreviewing(true);
    try {
      // Parse the raw text into individual rows (do NOT consolidate -- per STATE.md pitfall)
      const parsed = parseChargebackText(rawText);
      if (parsed.length === 0) {
        setPreviewing(false);
        return;
      }

      // Call preview API
      const res = await authFetch(`${API}/api/chargebacks/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: parsed }),
      });

      if (!res.ok) {
        setPreviewing(false);
        return;
      }

      const data = await res.json();
      const previews: any[] = data.previews;

      // Get round-robin assignments
      const assignments = await fetchBatchAssign("chargeback", previews.length);

      // Transform preview response into ReviewRow[]
      const rows: ReviewRow[] = previews.map((p: any, i: number) => {
        // For MATCHED (single sale), populate products from the matched sale
        let products: ReviewProduct[] = [];
        if (p.matchStatus === "MATCHED" && p.matchedSales.length === 1) {
          products = p.matchedSales[0].products.map((prod: any) => ({
            ...prod,
            selected: true, // All products start checked
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
      // network error -- handled in SubmissionsContent via toast
    } finally {
      setPreviewing(false);
    }
  };

  const handlePtTextChange = async (text: string) => {
    setPtRawPaste(text);
    if (text.trim()) {
      const parsed = parsePendingTermsText(text);
      const consolidated = consolidatePendingByMember(parsed);
      const assignments = await fetchBatchAssign("pending_term", consolidated.length);
      setPtRecords(assignPtRoundRobinLocal(consolidated, assignments));
    } else {
      setPtRecords([]);
    }
  };

  // When reps change, re-assign existing records using persisted round-robin
  useEffect(() => {
    (async () => {
      if (records.length > 0) {
        const cbAssign = await fetchBatchAssign("chargeback", records.length);
        setRecords((prev) => assignRoundRobinLocal(prev, cbAssign));
      }
      if (ptRecords.length > 0) {
        const ptAssign = await fetchBatchAssign("pending_term", ptRecords.length);
        setPtRecords((prev) => assignPtRoundRobinLocal(prev, ptAssign));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reps]);

  return (
    <ToastProvider>
      <SubmissionsContent
        rawText={rawText}
        records={records}
        reps={reps}
        sidebarOpen={sidebarOpen}
        submitting={submitting}
        newRepName={newRepName}
        activeRepNames={activeRepNames}
        onTextChange={handleTextChange}
        onRecordsChange={setRecords}
        reviewRecords={reviewRecords}
        onReviewRecordsChange={setReviewRecords}
        previewing={previewing}
        onPreviewingChange={setPreviewing}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onParseAndPreview={handleParseAndPreview}
        onRepsChange={setReps}
        onSidebarToggle={() => setSidebarOpen((o) => !o)}
        onSubmittingChange={setSubmitting}
        onNewRepNameChange={setNewRepName}
        onRawTextClear={() => { setRawText(""); setRecords([]); setReviewRecords([]); }}
        rerunRoundRobin={async (recs, _activeReps) => {
          const assignments = await fetchBatchAssign("chargeback", recs.length);
          return assignRoundRobinLocal(recs, assignments);
        }}
        ptRawPaste={ptRawPaste}
        ptRecords={ptRecords}
        ptSubmitting={ptSubmitting}
        onPtTextChange={handlePtTextChange}
        onPtRecordsChange={setPtRecords}
        onPtSubmittingChange={setPtSubmitting}
        onPtRawPasteClear={() => { setPtRawPaste(""); setPtRecords([]); }}
        agents={agents}
        API={API}
      />
    </ToastProvider>
  );
}

/* -- Submissions Content (inner, uses useToast) -- */

interface SubmissionsContentProps {
  rawText: string;
  records: ConsolidatedRecord[];
  reps: RepRoster[];
  sidebarOpen: boolean;
  submitting: boolean;
  newRepName: string;
  activeRepNames: string[];
  onTextChange: (text: string) => void;
  onRecordsChange: (records: ConsolidatedRecord[]) => void;
  onRepsChange: (reps: RepRoster[]) => void;
  onSidebarToggle: () => void;
  onSubmittingChange: (v: boolean) => void;
  onNewRepNameChange: (v: string) => void;
  onRawTextClear: () => void;
  rerunRoundRobin: (records: ConsolidatedRecord[], activeReps: string[]) => Promise<ConsolidatedRecord[]>;
  reviewRecords: ReviewRow[];
  onReviewRecordsChange: React.Dispatch<React.SetStateAction<ReviewRow[]>>;
  previewing: boolean;
  onPreviewingChange: (v: boolean) => void;
  statusFilter: string | null;
  onStatusFilterChange: (v: string | null) => void;
  onParseAndPreview: () => void;
  ptRawPaste: string;
  ptRecords: ConsolidatedPendingRecord[];
  ptSubmitting: boolean;
  onPtTextChange: (text: string) => void;
  onPtRecordsChange: (records: ConsolidatedPendingRecord[]) => void;
  onPtSubmittingChange: (v: boolean) => void;
  onPtRawPasteClear: () => void;
  agents: { id: string; name: string }[];
  API: string;
}

function SubmissionsContent({
  rawText,
  records,
  reps,
  sidebarOpen,
  submitting,
  newRepName,
  activeRepNames,
  onTextChange,
  onRecordsChange,
  onRepsChange,
  onSidebarToggle,
  onSubmittingChange,
  onNewRepNameChange,
  onRawTextClear,
  rerunRoundRobin,
  reviewRecords,
  onReviewRecordsChange,
  previewing,
  onPreviewingChange,
  statusFilter,
  onStatusFilterChange,
  onParseAndPreview,
  ptRawPaste,
  ptRecords,
  ptSubmitting,
  onPtTextChange,
  onPtRecordsChange,
  onPtSubmittingChange,
  onPtRawPasteClear,
  agents,
  API,
}: SubmissionsContentProps) {
  const { toast } = useToast();
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [hoveredRemoveIdx, setHoveredRemoveIdx] = useState<number | null>(null);

  // Toggle product checkbox and auto-recalculate amount
  const toggleProduct = (rowIdx: number, productId: string) => {
    onReviewRecordsChange(reviewRecords.map((row, i) => {
      if (i !== rowIdx) return row;
      const products = row.products.map(p =>
        p.id === productId ? { ...p, selected: !p.selected } : p
      );
      const autoAmount = products.filter(p => p.selected).reduce((sum, p) => sum + p.premium, 0);
      return {
        ...row,
        products,
        chargebackAmount: row.amountManuallyOverridden ? row.chargebackAmount : -autoAmount,
      };
    }));
  };

  // Handle sale selection for MULTIPLE matches
  const selectSale = (rowIdx: number, saleId: string) => {
    onReviewRecordsChange(reviewRecords.map((row, i) => {
      if (i !== rowIdx) return row;
      const sale = row.matchedSales.find(s => s.id === saleId);
      if (!sale) return row;
      const products: ReviewProduct[] = sale.products.map(p => ({ ...p, selected: true }));
      const autoAmount = products.reduce((sum, p) => sum + p.premium, 0);
      return {
        ...row,
        matchStatus: "MATCHED" as const,
        selectedSaleId: saleId,
        products,
        chargebackAmount: row.amountManuallyOverridden ? row.chargebackAmount : -autoAmount,
      };
    }));
  };

  // Remove row with undo toast
  const removeReviewRow = (idx: number) => {
    const removed = reviewRecords[idx];
    onReviewRecordsChange(reviewRecords.filter((_, i) => i !== idx));
    toast("info", `Removed ${removed.memberCompany || removed.memberId || "entry"}`, {
      duration: 5000,
      action: {
        label: "Undo",
        onClick: () => {
          onReviewRecordsChange(prev => {
            const next = [...prev];
            next.splice(idx, 0, removed);
            return next;
          });
        },
      },
    });
  };

  // Update review row field
  const updateReviewField = (idx: number, field: keyof ReviewRow, value: any) => {
    onReviewRecordsChange(reviewRecords.map((r, i) => {
      if (i !== idx) return r;
      if (field === "chargebackAmount") {
        return { ...r, [field]: value, amountManuallyOverridden: true };
      }
      return { ...r, [field]: value };
    }));
  };

  // Submit reviewed batch
  const handleReviewSubmit = async () => {
    if (reviewRecords.length === 0) return;
    onSubmittingChange(true);
    try {
      const batchId = crypto.randomUUID();
      // CRITICAL: Include selectedSaleId so the API honors user-resolved MULTIPLE matches (D-03)
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
        selectedSaleId: r.selectedSaleId,  // Forward user's sale selection to API
      }));

      const res = await authFetch(`${API}/api/chargebacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: submitRecords, rawPaste: rawText, batchId }),
      });

      if (res.status === 201) {
        const data = await res.json();
        onRawTextClear();
        onReviewRecordsChange([]);
        onStatusFilterChange(null);
        toast("success", `${data.count} chargebacks submitted`);
      } else {
        toast("error", `Submit failed (${res.status})`);
      }
    } catch {
      toast("error", "Submit failed (network error)");
    } finally {
      onSubmittingChange(false);
    }
  };

  const handleSubmit = async () => {
    if (records.length === 0) {
      toast("error", "No valid records to submit");
      return;
    }
    onSubmittingChange(true);
    try {
      const batchId = crypto.randomUUID();
      const res = await authFetch(`${API}/api/chargebacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records, rawPaste: rawText, batchId }),
      });
      if (res.status === 201) {
        const data = await res.json();
        onRawTextClear();
        toast("success", `${data.count} chargebacks submitted`);
      } else {
        toast("error", `Failed to submit (${res.status})`);
      }
    } catch {
      toast("error", "Failed to submit (network error)");
    } finally {
      onSubmittingChange(false);
    }
  };

  const updateRecord = (index: number, field: keyof ConsolidatedRecord, value: string | number) => {
    onRecordsChange(
      records.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const updatePtRecord = (index: number, field: keyof ConsolidatedPendingRecord, value: string | number | boolean | null) => {
    onPtRecordsChange(
      ptRecords.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const handlePtSubmit = async () => {
    if (ptRecords.length === 0) {
      toast("error", "No valid records to submit");
      return;
    }
    onPtSubmittingChange(true);
    try {
      const batchId = crypto.randomUUID();
      const res = await authFetch(`${API}/api/pending-terms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: ptRecords.map((r) => ({
            agentName: r.agentName,
            agentIdField: r.agentIdField,
            memberId: r.memberId,
            memberName: r.memberName,
            city: r.city,
            state: r.state,
            phone: r.phone,
            product: r.product,
            monthlyAmount: r.monthlyAmount,
            paid: r.paid,
            createdDate: r.createdDate,
            firstBilling: r.firstBilling,
            activeDate: r.activeDate,
            nextBilling: r.nextBilling,
            holdDate: r.holdDate,
            holdReason: r.holdReason,
            inactive: r.inactive,
            lastTransactionType: r.lastTransactionType,
            assignedTo: r.assignedTo,
          })),
          rawPaste: ptRawPaste,
          batchId,
        }),
      });
      if (res.status === 201) {
        const data = await res.json();
        onPtRawPasteClear();
        toast("success", `${data.count} pending terms submitted`);
      } else {
        toast("error", `Failed to submit (${res.status})`);
      }
    } catch {
      toast("error", "Failed to submit (network error)");
    } finally {
      onPtSubmittingChange(false);
    }
  };

  /* -- Rep Roster handlers -- */

  const handleAddRep = async () => {
    const name = newRepName.trim();
    if (!name) return;
    try {
      const res = await authFetch(`${API}/api/reps/create-synced`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        const newReps = [...reps, data.csRep];
        onRepsChange(newReps);
        onNewRepNameChange("");
        if (records.length > 0) {
          const newActive = newReps.filter((r) => r.active).map((r) => r.name);
          onRecordsChange(await rerunRoundRobin(records, newActive));
        }
      }
    } catch { /* ignore */ }
  };

  const handleToggleRep = async (rep: RepRoster) => {
    try {
      const res = await authFetch(`${API}/api/cs-rep-roster/${rep.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !rep.active }),
      });
      if (res.ok) {
        const updated = await res.json();
        const newReps = reps.map((r) => (r.id === updated.id ? updated : r));
        onRepsChange(newReps);
        if (records.length > 0) {
          const newActive = newReps.filter((r) => r.active).map((r) => r.name);
          onRecordsChange(await rerunRoundRobin(records, newActive));
        }
      }
    } catch { /* ignore */ }
  };

  const handleRemoveRep = async (rep: RepRoster) => {
    try {
      const res = await authFetch(`${API}/api/cs-rep-roster/${rep.id}`, {
        method: "DELETE",
      });
      if (res.ok || res.status === 204) {
        const newReps = reps.filter((r) => r.id !== rep.id);
        onRepsChange(newReps);
        if (records.length > 0) {
          const newActive = newReps.filter((r) => r.active).map((r) => r.name);
          onRecordsChange(await rerunRoundRobin(records, newActive));
        }
      }
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: "flex", gap: spacing[6] }}>
      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: spacing[6], minWidth: 0 }}>
        {/* Paste Area -- hidden when review records exist */}
        {reviewRecords.length === 0 && (
          <Card>
            <h3 style={SECTION_HEADING}>Chargeback Submissions</h3>
            <textarea
              style={TEXTAREA}
              placeholder="Paste chargeback data from spreadsheet here..."
              value={rawText}
              onChange={(e) => onTextChange(e.target.value)}
              disabled={previewing}
            />
            {rawText.trim() && (
              <div style={{ marginTop: spacing[4], display: "flex", justifyContent: "flex-end" }}>
                <Button
                  variant="primary"
                  onClick={onParseAndPreview}
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
              <div style={{ padding: `${spacing[4]}px ${spacing[6]}px 0` }}>
                <h3 style={{ ...SECTION_HEADING, fontWeight: 700 }}>Review Batch</h3>
              </div>

              {/* Summary Bar */}
              <div style={SUMMARY_BAR} role="toolbar" aria-label="Filter by match status">
                <button
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                  onClick={() => onStatusFilterChange(statusFilter === "MATCHED" ? null : "MATCHED")}
                >
                  <Badge color={colors.success} variant={statusFilter === "MATCHED" ? "solid" : "subtle"} size="md">
                    {matchedCount} Matched
                  </Badge>
                </button>
                <button
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                  onClick={() => onStatusFilterChange(statusFilter === "MULTIPLE" ? null : "MULTIPLE")}
                >
                  <Badge color={colors.warning} variant={statusFilter === "MULTIPLE" ? "solid" : "subtle"} size="md">
                    {multipleCount} Multiple
                  </Badge>
                </button>
                <button
                  style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
                  onClick={() => onStatusFilterChange(statusFilter === "UNMATCHED" ? null : "UNMATCHED")}
                >
                  <Badge color={colors.danger} variant={statusFilter === "UNMATCHED" ? "solid" : "subtle"} size="md">
                    {unmatchedCount} Unmatched
                  </Badge>
                </button>
                <span style={{ marginLeft: "auto", color: colors.danger, fontWeight: typography.weights.bold, fontSize: 16 }}>
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
                            background: hoveredRow === idx ? colors.bgSurfaceRaised : "transparent",
                            transition: `background ${motion.duration.fast} ${motion.easing.out}`,
                          }}
                        >
                          {/* Status */}
                          <td style={baseTdStyle}>
                            <Badge
                              color={rec.matchStatus === "MATCHED" ? colors.success : rec.matchStatus === "MULTIPLE" ? colors.warning : colors.danger}
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
                              <div style={{ fontSize: 11, color: colors.textTertiary }}>{rec.memberId}</div>
                            )}
                          </td>

                          {/* Agent */}
                          <td style={baseTdStyle}>
                            <span style={{ color: agentName ? colors.textPrimary : colors.textMuted }}>
                              {agentName || "--"}
                            </span>
                          </td>

                          {/* Products */}
                          <td style={baseTdStyle}>
                            {rec.matchStatus === "UNMATCHED" && (
                              <span style={{ color: colors.textMuted }}>--</span>
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
                              <span style={{ color: colors.textMuted }}>--</span>
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
                                color: hoveredRemoveIdx === idx ? colors.danger : colors.textTertiary,
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
                gap: spacing[3],
                padding: `${spacing[4]}px ${spacing[6]}px`,
                borderTop: `1px solid ${colors.borderSubtle}`,
              }}>
                <Button
                  variant="ghost"
                  onClick={() => {
                    onReviewRecordsChange([]);
                    onStatusFilterChange(null);
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

        {/* Pending Terms Parser */}
        <Card>
          <h3 style={SECTION_HEADING}>Pending Terms Submissions</h3>
          <textarea
            style={TEXTAREA}
            placeholder="Paste pending terms data from spreadsheet here..."
            value={ptRawPaste}
            onChange={(e) => onPtTextChange(e.target.value)}
            disabled={ptSubmitting}
          />
          {!ptRawPaste && ptRecords.length === 0 && (
            <EmptyState
              title="Paste Pending Terms Data"
              description="Paste tab-separated pending terms rows from your spreadsheet. Records will be parsed and grouped by member automatically."
            />
          )}
        </Card>

        {/* Pending Terms Preview Table */}
        {ptRecords.length > 0 && (
          <Card padding="none">
            <div style={{ padding: `${spacing[4]}px ${spacing[6]}px 0` }}>
              <h3 style={SECTION_HEADING}>
                Pending Terms Preview ({ptRecords.length} record{ptRecords.length !== 1 ? "s" : ""})
              </h3>
            </div>
            <div style={TABLE_WRAP}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={baseThStyle}>Member Name</th>
                    <th style={{ ...baseThStyle, width: 120 }}>Member ID</th>
                    <th style={baseThStyle}>Product</th>
                    <th style={{ ...baseThStyle, width: 120 }}>Monthly Amt</th>
                    <th style={{ ...baseThStyle, width: 140 }}>Hold Date</th>
                    <th style={{ ...baseThStyle, width: 150 }}>Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {ptRecords.map((rec, idx) => (
                    <tr key={idx}>
                      {/* Member Name (editable) */}
                      <td style={baseTdStyle}>
                        <input
                          type="text"
                          style={COMPACT_INPUT}
                          value={rec.memberName ?? ""}
                          onChange={(e) => updatePtRecord(idx, "memberName", e.target.value)}
                          disabled={ptSubmitting}
                        />
                      </td>
                      {/* Member ID (read-only) */}
                      <td style={baseTdStyle}>
                        <span style={{ color: colors.textSecondary }}>{rec.memberId || "--"}</span>
                      </td>
                      {/* Product (read-only) */}
                      <td style={baseTdStyle}>
                        <span
                          style={{
                            display: "block",
                            maxWidth: 240,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: colors.textSecondary,
                          }}
                          title={rec.product || undefined}
                        >
                          {rec.product || <span style={{ color: colors.textMuted }}>--</span>}
                        </span>
                      </td>
                      {/* Monthly Amt (editable) */}
                      <td style={baseTdStyle}>
                        <input
                          type="number"
                          step="0.01"
                          style={COMPACT_INPUT}
                          value={rec.monthlyAmount}
                          onChange={(e) => {
                            const num = parseFloat(e.target.value);
                            if (!isNaN(num)) updatePtRecord(idx, "monthlyAmount", Math.round(num * 100) / 100);
                          }}
                          disabled={ptSubmitting}
                        />
                      </td>
                      {/* Hold Date (editable) */}
                      <td style={baseTdStyle}>
                        <input
                          type="date"
                          style={COMPACT_INPUT}
                          value={rec.holdDate ?? ""}
                          onChange={(e) => updatePtRecord(idx, "holdDate", e.target.value)}
                          disabled={ptSubmitting}
                        />
                      </td>
                      {/* Assigned To (editable select) */}
                      <td style={baseTdStyle}>
                        <select
                          style={COMPACT_INPUT}
                          value={rec.assignedTo}
                          onChange={(e) => updatePtRecord(idx, "assignedTo", e.target.value)}
                          disabled={ptSubmitting}
                        >
                          <option value="">Unassigned</option>
                          {activeRepNames.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Submit Bar */}
            <div style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: `${spacing[4]}px ${spacing[6]}px`,
              borderTop: `1px solid ${colors.borderSubtle}`,
            }}>
              <Button
                variant="primary"
                onClick={handlePtSubmit}
                disabled={ptSubmitting || ptRecords.length === 0}
                loading={ptSubmitting}
              >
                {ptSubmitting ? "Submitting..." : "Submit Pending Terms"}
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Sidebar Toggle */}
      <div style={{ position: "relative" }}>
        <button
          onClick={onSidebarToggle}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          style={{
            position: "absolute",
            left: -16,
            top: 8,
            zIndex: 10,
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: colors.bgSurfaceRaised,
            border: `1px solid ${colors.borderDefault}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.textSecondary,
            padding: 0,
          }}
        >
          {sidebarOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Rep Roster Sidebar */}
        <div
          style={{
            ...SIDEBAR_STYLE,
            maxWidth: sidebarOpen ? 240 : 0,
            width: 240,
            padding: sidebarOpen ? spacing[5] : 0,
          }}
        >
          <h3 style={{
            ...typography.sizes.md,
            fontWeight: 700,
            color: colors.textPrimary,
            margin: `0 0 ${spacing[4]}px`,
            whiteSpace: "nowrap",
          }}>
            Rep Roster
          </h3>

          {/* Rep List */}
          <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
            {reps.map((rep) => (
              <RepRow
                key={rep.id}
                rep={rep}
                onToggle={() => handleToggleRep(rep)}
                onRemove={() => handleRemoveRep(rep)}
              />
            ))}
          </div>

          {/* No active reps warning */}
          {reps.length > 0 && activeRepNames.length === 0 && (
            <p style={{
              ...typography.sizes.xs,
              color: colors.warning,
              margin: `${spacing[3]}px 0 0`,
            }}>
              No active reps -- records will be unassigned
            </p>
          )}

          {reps.length === 0 && (
            <p style={{
              ...typography.sizes.xs,
              color: colors.warning,
              margin: `${spacing[3]}px 0 0`,
            }}>
              No active reps -- records will be unassigned
            </p>
          )}

          {/* Add Rep Form */}
          <div style={{
            display: "flex",
            gap: spacing[2],
            marginTop: spacing[4],
            whiteSpace: "nowrap",
          }}>
            <input
              style={{ ...COMPACT_INPUT, flex: 1, minWidth: 0 }}
              placeholder="Rep name"
              value={newRepName}
              onChange={(e) => onNewRepNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddRep(); }}
            />
            <Button variant="ghost" size="sm" onClick={handleAddRep}>
              Add Rep
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -- Rep Row Sub-Component -- */

function RepRow({
  rep,
  onToggle,
  onRemove,
}: {
  rep: RepRoster;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: spacing[2],
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Active toggle */}
      <button
        onClick={onToggle}
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          border: `2px solid ${rep.active ? colors.primary500 : colors.borderDefault}`,
          background: rep.active ? colors.primary500 : "transparent",
          cursor: "pointer",
          flexShrink: 0,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: `all ${motion.duration.fast} ${motion.easing.out}`,
        }}
        aria-label={rep.active ? `Deactivate ${rep.name}` : `Activate ${rep.name}`}
      >
        {rep.active && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Rep name */}
      <span style={{
        ...typography.sizes.sm,
        color: rep.active ? colors.textPrimary : colors.textMuted,
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {rep.name}
      </span>

      {/* Remove X */}
      {hovered && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${rep.name}`}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: colors.textMuted,
            padding: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
