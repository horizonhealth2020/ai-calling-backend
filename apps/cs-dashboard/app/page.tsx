"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  PageShell,
  Card,
  Button,
  EmptyState,
  AnimatedNumber,
  ToastProvider,
  useToast,
  spacing,
  colors,
  typography,
  motion,
  baseInputStyle,
  baseThStyle,
  baseTdStyle,
  baseCardStyle,
  baseLabelStyle,
  radius,
} from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";
import { formatDollar, formatNegDollar, formatDate } from "@ops/utils";
import { ClipboardList, BarChart3, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, Search, Filter, Download } from "lucide-react";

/* ── Types ──────────────────────────────────────────────────────── */

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

interface RepRoster {
  id: string;
  name: string;
  active: boolean;
}

interface WeeklyTotal {
  total: number;
  count: number;
  weekStart: string;
  weekEnd: string;
}

/* ── Parser Functions ───────────────────────────────────────────── */

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

  // Join multi-line records: if a line has <=3 tab-separated fields (date+type header),
  // join it with the next line (the data line)
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

    // Row-number detection: if fields[0] is a bare integer and fields[1] looks like a date
    if (/^\d+$/.test(fields[0].trim()) && /\d{1,2}-[A-Za-z]{3}-\d{2}/.test(fields[1])) {
      fields = fields.slice(1);
    }

    // Skip "Product" label field if present after date+type
    let offset = 0;
    if (fields[2] && fields[2].trim() === "Product") {
      offset = 1;
    }

    // Extract transaction type from transactionDescription (last pipe segment)
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

    // Parse member info pipe group
    if (fields[9 + offset]) {
      const memberParts = fields[9 + offset].split("|").map((p) => p.trim());
      row.memberCompany = memberParts[0] || null;
      row.memberId = memberParts[1] || null;
    }

    // Parse agent info pipe group
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

let _rrIndex = 0;

function assignRoundRobin(
  records: ConsolidatedRecord[],
  activeReps: string[]
): ConsolidatedRecord[] {
  if (activeReps.length === 0) return records.map((r) => ({ ...r, assignedTo: "" }));
  return records.map((r) => {
    const rep = activeReps[_rrIndex % activeReps.length];
    _rrIndex++;
    return { ...r, assignedTo: rep };
  });
}

/* ── Pending Terms Types ──────────────────────────────────────── */

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

/* ── Pending Terms Parser Functions ───────────────────────────── */

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

  // Group into 3-line records using isRecordStart to find boundaries
  const groups: string[][] = [];
  let i = 0;
  while (i < lines.length) {
    if (isRecordStart(lines[i])) {
      groups.push([lines[i], lines[i + 1] || "", lines[i + 2] || ""]);
      i += 3;
    } else {
      i++; // skip orphan lines (headers, etc.)
    }
  }

  for (const group of groups) {
    const line1 = group[0].split("\t");
    const line2 = group[1].split("\t");
    const line3 = group[2].split("\t");

    // Line 1: skip optional row number prefix
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
      // f[6] is email -- IGNORE
      product: f[7] ? f[7].trim() || null : null,
      // f[8] is enrollAmount -- IGNORE
      monthlyAmount: f[9] ? parsePendingDollar(f[9]) : null,
      paid: f[10] ? f[10].trim() || null : null,
      // Line 2 fields
      inactive: line2[0] ? (line2[0].trim().toLowerCase() === "inactive" ? true : line2[0].trim().toLowerCase() === "active" ? false : null) : null,
      createdDate: line2[1] ? parseMDYDate(line2[1]) : null,
      firstBilling: line2[2] ? parseMDYDate(line2[2]) : null,
      activeDate: line2[3] ? parseMDYDate(line2[3]) : null,
      nextBilling: line2[4] ? parseMDYDate(line2[4]) : null,
      holdDate: line2[5] ? parseMDYDate(line2[5]) : null,
      // Line 3 fields
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

function assignPtRoundRobin(
  records: ConsolidatedPendingRecord[],
  activeReps: string[]
): ConsolidatedPendingRecord[] {
  if (activeReps.length === 0) return records.map((r) => ({ ...r, assignedTo: "" }));
  return records.map((r) => {
    const rep = activeReps[_rrIndex % activeReps.length];
    _rrIndex++;
    return { ...r, assignedTo: rep };
  });
}

function getCurrentWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const sun = new Date(now);
  sun.setDate(now.getDate() - day);
  const sat = new Date(sun);
  sat.setDate(sun.getDate() + 6);
  return {
    start: `${sun.getMonth() + 1}/${sun.getDate()}`,
    end: `${sat.getMonth() + 1}/${sat.getDate()}`,
  };
}

/* ── Style Constants ────────────────────────────────────────────── */

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

const TICKER_CARD: React.CSSProperties = {
  ...baseCardStyle,
  background: colors.dangerBg,
};

const TICKER_VALUE: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: colors.danger,
  lineHeight: "1.2",
};

const TICKER_LABEL: React.CSSProperties = {
  ...typography.sizes.xs,
  fontWeight: 700,
  color: colors.textTertiary,
  textTransform: "uppercase" as const,
  letterSpacing: typography.tracking.caps,
  marginBottom: spacing[2],
  display: "block",
};

const TICKER_SUB: React.CSSProperties = {
  ...typography.sizes.sm,
  color: colors.textSecondary,
  marginTop: spacing[1],
  display: "block",
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

const TYPE_OPTIONS = ["Chargeback", "Chargeback Reversal", "Refund Reversal"];

/* ── Tab Type ───────────────────────────────────────────────────── */

type Tab = "submissions" | "tracking";

/* ── Main Dashboard ─────────────────────────────────────────────── */

const API = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_OPS_API_URL || "")
  : "";

export default function CSDashboard() {
  const [tab, setTab] = useState<Tab>("submissions");

  useEffect(() => { captureTokenFromUrl(); }, []);

  const navItems = [
    { icon: <ClipboardList size={18} />, label: "Submissions", key: "submissions" },
    { icon: <BarChart3 size={18} />, label: "Tracking", key: "tracking" },
  ];

  return (
    <PageShell
      title="Customer Service"
      subtitle="Chargebacks & Pending Terms"
      navItems={navItems}
      activeNav={tab}
      onNavChange={(k) => setTab(k as Tab)}
    >
      {tab === "submissions" && <SubmissionsTab />}
      {tab === "tracking" && <TrackingTab />}
    </PageShell>
  );
}

/* ── Submissions Tab ────────────────────────────────────────────── */

function SubmissionsTab() {
  const [rawText, setRawText] = useState("");
  const [records, setRecords] = useState<ConsolidatedRecord[]>([]);
  const [reps, setReps] = useState<RepRoster[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newRepName, setNewRepName] = useState("");

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
  }, []);

  useEffect(() => {
    fetchReps();
  }, [fetchReps]);

  const handleTextChange = (text: string) => {
    setRawText(text);
    if (text.trim()) {
      const parsed = parseChargebackText(text);
      const consolidated = consolidateByMember(parsed);
      // Use ref to always get current reps
      const currentActive = repsRef.current.filter((r) => r.active).map((r) => r.name);
      const assigned = assignRoundRobin(consolidated, currentActive);
      setRecords(assigned);
    } else {
      setRecords([]);
    }
  };

  const handlePtTextChange = (text: string) => {
    setPtRawPaste(text);
    if (text.trim()) {
      const parsed = parsePendingTermsText(text);
      const consolidated = consolidatePendingByMember(parsed);
      _rrIndex = 0;
      const currentActive = repsRef.current.filter((r) => r.active).map((r) => r.name);
      const assigned = assignPtRoundRobin(consolidated, currentActive);
      setPtRecords(assigned);
    } else {
      setPtRecords([]);
    }
  };

  // When reps change, re-assign existing records
  useEffect(() => {
    const currentActive = reps.filter((r) => r.active).map((r) => r.name);
    if (records.length > 0) {
      setRecords((prev) => assignRoundRobin(prev, currentActive));
    }
    if (ptRecords.length > 0) {
      setPtRecords((prev) => assignPtRoundRobin(prev, currentActive));
    }
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
        onRepsChange={setReps}
        onSidebarToggle={() => setSidebarOpen((o) => !o)}
        onSubmittingChange={setSubmitting}
        onNewRepNameChange={setNewRepName}
        onRawTextClear={() => { setRawText(""); setRecords([]); }}
        rerunRoundRobin={assignRoundRobin}
        ptRawPaste={ptRawPaste}
        ptRecords={ptRecords}
        ptSubmitting={ptSubmitting}
        onPtTextChange={handlePtTextChange}
        onPtRecordsChange={setPtRecords}
        onPtSubmittingChange={setPtSubmitting}
        onPtRawPasteClear={() => { setPtRawPaste(""); setPtRecords([]); }}
      />
    </ToastProvider>
  );
}

/* ── Submissions Content (inner, uses useToast) ─────────────────── */

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
  rerunRoundRobin: (records: ConsolidatedRecord[], activeReps: string[]) => ConsolidatedRecord[];
  ptRawPaste: string;
  ptRecords: ConsolidatedPendingRecord[];
  ptSubmitting: boolean;
  onPtTextChange: (text: string) => void;
  onPtRecordsChange: (records: ConsolidatedPendingRecord[]) => void;
  onPtSubmittingChange: (v: boolean) => void;
  onPtRawPasteClear: () => void;
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
  ptRawPaste,
  ptRecords,
  ptSubmitting,
  onPtTextChange,
  onPtRecordsChange,
  onPtSubmittingChange,
  onPtRawPasteClear,
}: SubmissionsContentProps) {
  const { toast } = useToast();
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

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

  /* ── Rep Roster handlers ── */

  const handleAddRep = async () => {
    const name = newRepName.trim();
    if (!name) return;
    try {
      const res = await authFetch(`${API}/api/cs-rep-roster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const rep = await res.json();
        const newReps = [...reps, rep];
        onRepsChange(newReps);
        onNewRepNameChange("");
        if (records.length > 0) {
          const newActive = newReps.filter((r) => r.active).map((r) => r.name);
          onRecordsChange(rerunRoundRobin(records, newActive));
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
          onRecordsChange(rerunRoundRobin(records, newActive));
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
          onRecordsChange(rerunRoundRobin(records, newActive));
        }
      }
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: "flex", gap: spacing[6] }}>
      {/* Main Content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: spacing[6], minWidth: 0 }}>
        {/* Paste Area */}
        <Card>
          <h3 style={SECTION_HEADING}>Chargeback Submissions</h3>
          <textarea
            style={TEXTAREA}
            placeholder="Paste chargeback data from spreadsheet here..."
            value={rawText}
            onChange={(e) => onTextChange(e.target.value)}
            disabled={submitting}
          />
          {!rawText && records.length === 0 && (
            <EmptyState
              title="Paste Chargeback Data"
              description="Paste tab-separated chargeback rows from your spreadsheet. Records will be parsed and grouped by member automatically."
            />
          )}
        </Card>

        {/* Preview Table */}
        {records.length > 0 && (
          <Card padding="none">
            <div style={{ padding: `${spacing[4]}px ${spacing[6]}px 0` }}>
              <h3 style={SECTION_HEADING}>
                Preview ({records.length} record{records.length !== 1 ? "s" : ""})
              </h3>
            </div>
            <div style={TABLE_WRAP}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...baseThStyle, width: 120 }}>Date Posted</th>
                    <th style={baseThStyle}>Member</th>
                    <th style={{ ...baseThStyle, width: 110 }}>Member ID</th>
                    <th style={baseThStyle}>Product</th>
                    <th style={{ ...baseThStyle, width: 160 }}>Transaction Type</th>
                    <th style={{ ...baseThStyle, width: 110 }}>Total</th>
                    <th style={{ ...baseThStyle, width: 140 }}>Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec, idx) => (
                    <tr
                      key={idx}
                      onMouseEnter={() => setHoveredRow(idx)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        background: hoveredRow === idx ? colors.bgSurfaceRaised : "transparent",
                        transition: `background ${motion.duration.fast} ${motion.easing.out}`,
                      }}
                    >
                      {/* Date Posted */}
                      <td style={baseTdStyle}>
                        <input
                          type="date"
                          style={COMPACT_INPUT}
                          value={rec.postedDate ?? ""}
                          onChange={(e) => updateRecord(idx, "postedDate", e.target.value)}
                          disabled={submitting}
                        />
                      </td>
                      {/* Member */}
                      <td style={baseTdStyle}>
                        <input
                          type="text"
                          style={COMPACT_INPUT}
                          value={rec.memberCompany}
                          onChange={(e) => updateRecord(idx, "memberCompany", e.target.value)}
                          disabled={submitting}
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
                      {/* Transaction Type */}
                      <td style={baseTdStyle}>
                        <select
                          style={COMPACT_INPUT}
                          value={rec.type ?? ""}
                          onChange={(e) => updateRecord(idx, "type", e.target.value)}
                          disabled={submitting}
                        >
                          <option value="">--</option>
                          {TYPE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                          {rec.type && !TYPE_OPTIONS.includes(rec.type) && (
                            <option value={rec.type}>{rec.type}</option>
                          )}
                        </select>
                      </td>
                      {/* Total */}
                      <td style={baseTdStyle}>
                        <input
                          type="text"
                          style={COMPACT_INPUT}
                          value={formatDollar(rec.totalAmount)}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9.]/g, "");
                            const num = parseFloat(raw);
                            if (!isNaN(num)) updateRecord(idx, "totalAmount", num);
                          }}
                          disabled={submitting}
                        />
                      </td>
                      {/* Assigned To */}
                      <td style={baseTdStyle}>
                        <select
                          style={COMPACT_INPUT}
                          value={rec.assignedTo}
                          onChange={(e) => updateRecord(idx, "assignedTo", e.target.value)}
                          disabled={submitting}
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
                onClick={handleSubmit}
                disabled={submitting || records.length === 0}
                loading={submitting}
              >
                {submitting ? "Submitting..." : "Submit Chargebacks"}
              </Button>
            </div>
          </Card>
        )}

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

/* ── Rep Row Sub-Component ──────────────────────────────────────── */

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

/* ── Sort Header ────────────────────────────────────────────────── */

function SortHeader({ label, sortKey, currentSort, currentDir, onSort }: {
  label: string;
  sortKey: string;
  currentSort: string | null;
  currentDir: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  return (
    <th
      style={{ ...baseThStyle, cursor: "pointer", userSelect: "none" }}
      onClick={() => onSort(sortKey)}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        {currentSort === sortKey && (
          currentDir === "asc"
            ? <ChevronUp size={12} />
            : <ChevronDown size={12} />
        )}
      </span>
    </th>
  );
}

/* ── Tracking Tab ───────────────────────────────────────────────── */

function TrackingTab() {
  // Data
  const [chargebacks, setChargebacks] = useState<any[]>([]);
  const [pendingTerms, setPendingTerms] = useState<any[]>([]);
  const [totals, setTotals] = useState<{ totalChargebacks: number; totalRecovered: number; recordCount: number } | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Search (shared between both tables)
  const [searchTerm, setSearchTerm] = useState("");

  // Chargeback filters
  const [cbFiltersOpen, setCbFiltersOpen] = useState(false);
  const [cbFilters, setCbFilters] = useState({
    dateFrom: "", dateTo: "", product: "", memberCompany: "", memberAgentCompany: "", amountMin: "", amountMax: "",
  });

  // Chargeback sort (default: submittedAt desc)
  const [cbSortKey, setCbSortKey] = useState<string>("submittedAt");
  const [cbSortDir, setCbSortDir] = useState<"asc" | "desc">("desc");

  // Pending terms filters (placeholder for Plan 02)
  const [ptFiltersOpen, setPtFiltersOpen] = useState(false);
  const [ptFilters, setPtFilters] = useState({
    agent: "", state: "", product: "", holdReason: "", dateFrom: "", dateTo: "",
  });

  // Pending terms sort (default: holdDate desc)
  const [ptSortKey, setPtSortKey] = useState<string>("holdDate");
  const [ptSortDir, setPtSortDir] = useState<"asc" | "desc">("desc");


  // Data fetching
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [totalsRes, cbRes, ptRes, meRes] = await Promise.all([
        authFetch(`${API}/api/chargebacks/totals`),
        authFetch(`${API}/api/chargebacks`),
        authFetch(`${API}/api/pending-terms`),
        authFetch(`${API}/api/session/me`),
      ]);
      if (totalsRes.ok) setTotals(await totalsRes.json());
      if (cbRes.ok) setChargebacks(await cbRes.json());
      if (ptRes.ok) setPendingTerms(await ptRes.json());
      if (meRes.ok) {
        const me = await meRes.json();
        if (me?.roles) setUserRoles(me.roles);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Chargeback filter/search/sort pipeline
  const filteredChargebacks = useMemo(() => {
    let result = chargebacks;

    // Search (case-insensitive partial match)
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter((cb: any) =>
        (cb.payeeName || "").toLowerCase().includes(q) ||
        (cb.memberAgentCompany || "").toLowerCase().includes(q) ||
        (cb.memberId || "").toLowerCase().includes(q) ||
        (cb.memberAgentId || "").toLowerCase().includes(q)
      );
    }

    // Filters
    if (cbFilters.product) result = result.filter((cb: any) => (cb.product || "").toLowerCase().includes(cbFilters.product.toLowerCase()));
    if (cbFilters.memberCompany) result = result.filter((cb: any) => (cb.memberCompany || "").toLowerCase().includes(cbFilters.memberCompany.toLowerCase()));
    if (cbFilters.memberAgentCompany) result = result.filter((cb: any) => (cb.memberAgentCompany || "").toLowerCase().includes(cbFilters.memberAgentCompany.toLowerCase()));
    if (cbFilters.dateFrom) result = result.filter((cb: any) => cb.postedDate && cb.postedDate.split("T")[0] >= cbFilters.dateFrom);
    if (cbFilters.dateTo) result = result.filter((cb: any) => cb.postedDate && cb.postedDate.split("T")[0] <= cbFilters.dateTo);
    if (cbFilters.amountMin) result = result.filter((cb: any) => Math.abs(parseFloat(cb.chargebackAmount || "0")) >= parseFloat(cbFilters.amountMin));
    if (cbFilters.amountMax) result = result.filter((cb: any) => Math.abs(parseFloat(cb.chargebackAmount || "0")) <= parseFloat(cbFilters.amountMax));

    // Sort
    if (cbSortKey) {
      result = [...result].sort((a: any, b: any) => {
        let aVal = a[cbSortKey] ?? "";
        let bVal = b[cbSortKey] ?? "";
        // Numeric sort for amount fields
        if (cbSortKey === "chargebackAmount" || cbSortKey === "totalAmount") {
          aVal = parseFloat(aVal) || 0;
          bVal = parseFloat(bVal) || 0;
        }
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return cbSortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [chargebacks, searchTerm, cbFilters, cbSortKey, cbSortDir]);

  // Pending terms filter + search + sort pipeline
  const filteredPending = useMemo(() => {
    let result = pendingTerms;

    // Shared search (case-insensitive partial match)
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter((pt: any) =>
        (pt.memberName || "").toLowerCase().includes(q) ||
        (pt.memberId || "").toLowerCase().includes(q) ||
        (pt.agentName || "").toLowerCase().includes(q) ||
        (pt.agentIdField || "").toLowerCase().includes(q) ||
        (pt.phone || "").toLowerCase().includes(q)
      );
    }

    // Pending terms filters
    if (ptFilters.agent) result = result.filter((pt: any) => (pt.agentName || "").toLowerCase().includes(ptFilters.agent.toLowerCase()));
    if (ptFilters.state) result = result.filter((pt: any) => (pt.state || "").toLowerCase().includes(ptFilters.state.toLowerCase()));
    if (ptFilters.product) result = result.filter((pt: any) => (pt.product || "").toLowerCase().includes(ptFilters.product.toLowerCase()));
    if (ptFilters.holdReason) result = result.filter((pt: any) => (pt.holdReason || "").toLowerCase().includes(ptFilters.holdReason.toLowerCase()));
    if (ptFilters.dateFrom) {
      result = result.filter((pt: any) =>
        (pt.holdDate && pt.holdDate.split("T")[0] >= ptFilters.dateFrom) ||
        (pt.nextBilling && pt.nextBilling.split("T")[0] >= ptFilters.dateFrom)
      );
    }
    if (ptFilters.dateTo) {
      result = result.filter((pt: any) =>
        (pt.holdDate && pt.holdDate.split("T")[0] <= ptFilters.dateTo) ||
        (pt.nextBilling && pt.nextBilling.split("T")[0] <= ptFilters.dateTo)
      );
    }

    // Sort within groups (sort individual records, grouping happens after)
    if (ptSortKey) {
      result = [...result].sort((a: any, b: any) => {
        let aVal = a[ptSortKey] ?? "";
        let bVal = b[ptSortKey] ?? "";
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return ptSortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [pendingTerms, searchTerm, ptFilters, ptSortKey, ptSortDir]);


  // Summary bar stats (computed from FULL unfiltered dataset, not filtered)
  const ptSummary = useMemo(() => {
    const total = pendingTerms.length;
    const reasonCounts = new Map<string, number>();
    let urgentCount = 0;
    const now = new Date();
    const sevenDaysOut = new Date(now);
    sevenDaysOut.setDate(now.getDate() + 7);
    const sevenDaysStr = sevenDaysOut.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    pendingTerms.forEach((pt: any) => {
      const reason = pt.holdReason || "No Reason";
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      if (pt.nextBilling) {
        const nb = pt.nextBilling.split("T")[0];
        if (nb >= todayStr && nb <= sevenDaysStr) urgentCount++;
      }
    });

    return {
      total,
      reasons: Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1]),
      urgentCount,
    };
  }, [pendingTerms]);

  // Delete handler
  const handleDeleteCb = async (id: string) => {
    try {
      const res = await authFetch(`${API}/api/chargebacks/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setChargebacks((prev) => prev.filter((cb: any) => cb.id !== id));
        const totalsRes = await authFetch(`${API}/api/chargebacks/totals`);
        if (totalsRes.ok) setTotals(await totalsRes.json());
      }
    } catch { /* ignore */ }
  };

  // Delete pending term handler
  const handleDeletePt = async (id: string) => {
    try {
      const res = await authFetch(`${API}/api/pending-terms/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setPendingTerms((prev) => prev.filter((pt: any) => pt.id !== id));
      }
    } catch { /* ignore */ }
  };

  // Sort toggle handler
  const handleCbSort = (key: string) => {
    if (cbSortKey === key) {
      setCbSortDir(cbSortDir === "asc" ? "desc" : "asc");
    } else {
      setCbSortKey(key);
      setCbSortDir("asc");
    }
  };

  // Clear filters helper
  const hasCbFilters = Object.values(cbFilters).some(v => v !== "");
  const clearCbFilters = () => setCbFilters({ dateFrom: "", dateTo: "", product: "", memberCompany: "", memberAgentCompany: "", amountMin: "", amountMax: "" });

  // Pending terms sort handler
  const handlePtSort = (key: string) => {
    if (ptSortKey === key) {
      setPtSortDir(ptSortDir === "asc" ? "desc" : "asc");
    } else {
      setPtSortKey(key);
      setPtSortDir("asc");
    }
  };

  const hasPtFilters = Object.values(ptFilters).some(v => v !== "");
  const clearPtFilters = () => setPtFilters({ agent: "", state: "", product: "", holdReason: "", dateFrom: "", dateTo: "" });


  // Role check
  const canExport = userRoles.includes("SUPER_ADMIN") || userRoles.includes("OWNER_VIEW");

  // Date format helper - uses shared formatDate from @ops/utils

  // CSV Export
  const exportCSV = () => {
    const esc = (v: string) => v.includes(",") || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
    const rows: string[][] = [];

    rows.push(["--- CHARGEBACKS ---"]);
    rows.push(["Date Posted", "Member", "Member ID", "Product", "Type", "Total", "Assigned To", "Submitted"]);
    filteredChargebacks.forEach((cb: any) => {
      rows.push([
        esc(formatDate(cb.postedDate)),
        esc(cb.memberCompany || "--"),
        esc(cb.memberId || "--"),
        esc(cb.product || "--"),
        esc(cb.type || "--"),
        esc(cb.chargebackAmount ? formatDollar(parseFloat(cb.chargebackAmount)) : "--"),
        esc(cb.assignedTo || "Unassigned"),
        esc(formatDate(cb.submittedAt)),
      ]);
    });

    rows.push([]);
    rows.push(["--- PENDING TERMS ---"]);
    rows.push(["Member Name", "Member ID", "Phone", "Product", "Hold Date", "Next Billing", "Assigned To"]);
    filteredPending.forEach((pt: any) => {
      rows.push([
        esc(pt.memberName || "--"),
        esc(pt.memberId || "--"),
        esc(pt.phone || "--"),
        esc(pt.product || "--"),
        esc(formatDate(pt.holdDate)),
        esc(formatDate(pt.nextBilling)),
        esc(pt.assignedTo || "Unassigned"),
      ]);
    });

    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" })),
      download: `cs-tracking-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${spacing[6]}px` }}>
      {/* KPI Bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: `${spacing[4]}px` }}>
        {/* Total Chargebacks */}
        <Card style={{ ...baseCardStyle, background: colors.dangerBg }}>
          <span style={TICKER_LABEL}>TOTAL CHARGEBACKS</span>
          <div style={{ ...TICKER_VALUE, color: colors.danger }}>
            <AnimatedNumber value={totals?.totalChargebacks ?? 0} decimals={2} prefix="$" duration={600} />
          </div>
          <span style={TICKER_SUB}>{totals?.recordCount ?? 0} records</span>
        </Card>

        {/* Total Recovered */}
        <Card style={{ ...baseCardStyle, background: colors.successBg }}>
          <span style={TICKER_LABEL}>TOTAL RECOVERED</span>
          <div style={{ ...TICKER_VALUE, color: colors.success }}>
            <AnimatedNumber value={0} decimals={2} prefix="$" duration={600} />
          </div>
          <span style={TICKER_SUB}>resolution tracking</span>
        </Card>

        {/* Net Exposure */}
        <Card style={{ ...baseCardStyle, background: (totals?.totalChargebacks ?? 0) > 0 ? colors.dangerBg : colors.successBg }}>
          <span style={TICKER_LABEL}>NET EXPOSURE</span>
          <div style={{ ...TICKER_VALUE, color: (totals?.totalChargebacks ?? 0) > 0 ? colors.danger : colors.success }}>
            <AnimatedNumber value={(totals?.totalChargebacks ?? 0) - (totals?.totalRecovered ?? 0)} decimals={2} prefix="$" duration={600} />
          </div>
          <span style={TICKER_SUB}>chargebacks - recovered</span>
        </Card>

        {/* Records */}
        <Card style={baseCardStyle}>
          <span style={TICKER_LABEL}>RECORDS</span>
          <div style={{ ...TICKER_VALUE, color: colors.textPrimary }}>
            <AnimatedNumber value={totals?.recordCount ?? 0} decimals={0} duration={600} />
          </div>
          <span style={TICKER_SUB}>all submissions</span>
        </Card>
      </div>

      {/* Search + Filter + Export row */}
      <div style={{ display: "flex", gap: `${spacing[2]}px`, alignItems: "center" }}>
        {/* Search input */}
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: colors.textMuted, pointerEvents: "none" }} />
          <input
            style={{ ...baseInputStyle, paddingLeft: 36, width: "100%" }}
            placeholder="Search by name, ID, company, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              aria-label="Clear search"
              onClick={() => setSearchTerm("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: colors.textMuted, padding: 2, display: "flex", alignItems: "center" }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => { setCbFiltersOpen(!cbFiltersOpen); setPtFiltersOpen(!ptFiltersOpen); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${colors.borderDefault}`, borderRadius: radius.md, padding: "8px 12px", color: colors.textSecondary, cursor: "pointer", fontSize: 13 }}
        >
          <Filter size={14} />
          Filters
          {(cbFiltersOpen || ptFiltersOpen) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Export CSV */}
        {canExport && (
          <button
            onClick={exportCSV}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${colors.borderDefault}`, borderRadius: radius.md, padding: "8px 12px", color: colors.textSecondary, cursor: "pointer", fontSize: 13 }}
          >
            <Download size={14} /> Export CSV
          </button>
        )}
      </div>

      {/* Chargeback Filter Panel */}
      {cbFiltersOpen && (
        <div style={{ background: colors.bgSurfaceInset, borderRadius: radius.lg, padding: `${spacing[4]}px`, marginTop: `${spacing[2]}px` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={baseLabelStyle}>Chargeback Filters</span>
            {hasCbFilters && (
              <button onClick={clearCbFilters} style={{ background: "transparent", border: "none", color: colors.accentTeal, cursor: "pointer", fontSize: 12 }}>
                Clear Filters
              </button>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: `${spacing[4]}px`, marginTop: `${spacing[2]}px` }}>
            <div>
              <label style={baseLabelStyle}>Date From</label>
              <input type="date" style={baseInputStyle} value={cbFilters.dateFrom} onChange={(e) => setCbFilters({ ...cbFilters, dateFrom: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Date To</label>
              <input type="date" style={baseInputStyle} value={cbFilters.dateTo} onChange={(e) => setCbFilters({ ...cbFilters, dateTo: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Product</label>
              <input type="text" style={baseInputStyle} placeholder="Filter by product" value={cbFilters.product} onChange={(e) => setCbFilters({ ...cbFilters, product: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Member Company</label>
              <input type="text" style={baseInputStyle} placeholder="Filter by company" value={cbFilters.memberCompany} onChange={(e) => setCbFilters({ ...cbFilters, memberCompany: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Member Agent Company</label>
              <input type="text" style={baseInputStyle} placeholder="Filter by agent company" value={cbFilters.memberAgentCompany} onChange={(e) => setCbFilters({ ...cbFilters, memberAgentCompany: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Amount Min ($)</label>
              <input type="number" style={baseInputStyle} placeholder="Min amount" value={cbFilters.amountMin} onChange={(e) => setCbFilters({ ...cbFilters, amountMin: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Amount Max ($)</label>
              <input type="number" style={baseInputStyle} placeholder="Max amount" value={cbFilters.amountMax} onChange={(e) => setCbFilters({ ...cbFilters, amountMax: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {/* Pending Terms Filter Panel */}
      {ptFiltersOpen && (
        <div style={{
          background: colors.bgSurfaceInset,
          borderRadius: radius.lg,
          padding: `${spacing[4]}px`,
          marginTop: `${spacing[2]}px`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={baseLabelStyle}>Pending Terms Filters</span>
            {hasPtFilters && (
              <button onClick={clearPtFilters} style={{ background: "transparent", border: "none", color: colors.accentTeal, cursor: "pointer", fontSize: 12 }}>
                Clear Filters
              </button>
            )}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: `${spacing[4]}px`,
            marginTop: `${spacing[2]}px`,
          }}>
            <div>
              <label style={baseLabelStyle}>Agent</label>
              <input style={baseInputStyle} type="text" placeholder="Filter by agent" value={ptFilters.agent} onChange={e => setPtFilters({ ...ptFilters, agent: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>State</label>
              <input style={baseInputStyle} type="text" placeholder="Filter by state" value={ptFilters.state} onChange={e => setPtFilters({ ...ptFilters, state: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Product</label>
              <input style={baseInputStyle} type="text" placeholder="Filter by product" value={ptFilters.product} onChange={e => setPtFilters({ ...ptFilters, product: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Hold Reason</label>
              <input style={baseInputStyle} type="text" placeholder="Keyword" value={ptFilters.holdReason} onChange={e => setPtFilters({ ...ptFilters, holdReason: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Date From</label>
              <input style={baseInputStyle} type="date" value={ptFilters.dateFrom} onChange={e => setPtFilters({ ...ptFilters, dateFrom: e.target.value })} />
            </div>
            <div>
              <label style={baseLabelStyle}>Date To</label>
              <input style={baseInputStyle} type="date" value={ptFilters.dateTo} onChange={e => setPtFilters({ ...ptFilters, dateTo: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      {/* Chargeback Table */}
      <Card>
        <h3 style={SECTION_HEADING}>Chargeback Tracking</h3>
        {error ? (
          <EmptyState title="Failed to Load Records" description="Check your connection and reload the page. If the problem continues, contact your administrator." />
        ) : chargebacks.length === 0 && !loading ? (
          <EmptyState title="No Chargebacks Yet" description="Chargeback records will appear here once submissions are processed." />
        ) : filteredChargebacks.length === 0 && chargebacks.length > 0 ? (
          <EmptyState title="No Chargebacks Found" description="No chargebacks match your current search or filters. Try adjusting your criteria." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <SortHeader label="Date Posted" sortKey="postedDate" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Member" sortKey="memberCompany" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Member ID" sortKey="memberId" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Product" sortKey="product" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Type" sortKey="type" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Total" sortKey="chargebackAmount" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Assigned To" sortKey="assignedTo" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <SortHeader label="Submitted" sortKey="submittedAt" currentSort={cbSortKey} currentDir={cbSortDir} onSort={handleCbSort} />
                  <th style={{ ...baseThStyle, width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredChargebacks.map((cb: any) => (
                  <tr key={cb.id}>
                    <td style={baseTdStyle}>{formatDate(cb.postedDate)}</td>
                    <td style={{ ...baseTdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cb.memberCompany || "--"}</td>
                    <td style={baseTdStyle}>{cb.memberId || "--"}</td>
                    <td style={{ ...baseTdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cb.product || "--"}</td>
                    <td style={baseTdStyle}>{cb.type || "--"}</td>
                    <td style={{ ...baseTdStyle, color: colors.danger }}>{cb.chargebackAmount ? formatDollar(parseFloat(cb.chargebackAmount)) : "--"}</td>
                    <td style={baseTdStyle}>{cb.assignedTo || "Unassigned"}</td>
                    <td style={baseTdStyle}>{formatDate(cb.submittedAt)}</td>
                    <td style={baseTdStyle}>
                      <button
                        onClick={() => handleDeleteCb(cb.id)}
                        aria-label="Delete record"
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: colors.textMuted,
                          padding: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = colors.danger; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = colors.textMuted; }}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pending Terms Summary Bar */}
      <Card style={{ padding: `${spacing[4]}px` }}>
        <div style={{ display: "flex", alignItems: "center", gap: `${spacing[6]}px`, flexWrap: "wrap" }}>
          {/* Total */}
          <div>
            <span style={TICKER_LABEL}>TOTAL PENDING</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: colors.textPrimary }}>{ptSummary.total}</div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 40, background: colors.borderSubtle }} />

          {/* Hold reason categories */}
          <div style={{ display: "flex", gap: `${spacing[2]}px`, flexWrap: "wrap", flex: 1 }}>
            {ptSummary.reasons.map(([reason, count]) => (
              <span key={reason} style={{
                display: "inline-block",
                padding: "4px 10px",
                background: colors.bgSurfaceInset,
                borderRadius: radius.md,
                fontSize: 12,
                color: colors.textSecondary,
              }}>
                {reason.toUpperCase()}: {count}
              </span>
            ))}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 40, background: colors.borderSubtle }} />

          {/* Urgent */}
          <div>
            <span style={TICKER_LABEL}>DUE WITHIN 7 DAYS</span>
            <div style={{ fontSize: 22, fontWeight: 700, color: colors.danger }}>{ptSummary.urgentCount}</div>
          </div>
        </div>
      </Card>

      {/* Pending Terms Table */}
      <Card>
        <h3 style={SECTION_HEADING}>Pending Terms Tracking</h3>
        {error ? (
          <EmptyState title="Failed to Load Records" description="Check your connection and reload the page. If the problem continues, contact your administrator." />
        ) : pendingTerms.length === 0 && !loading ? (
          <EmptyState title="No Pending Terms Yet" description="Pending terms records will appear here once submissions are processed." />
        ) : filteredPending.length === 0 && pendingTerms.length > 0 ? (
          <EmptyState title="No Pending Terms Found" description="No pending terms match your current search or filters. Try adjusting your criteria." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <SortHeader label="Member Name" sortKey="memberName" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Member ID" sortKey="memberId" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Phone" sortKey="phone" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Product" sortKey="product" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Hold Date" sortKey="holdDate" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Next Billing" sortKey="nextBilling" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <SortHeader label="Assigned To" sortKey="assignedTo" currentSort={ptSortKey} currentDir={ptSortDir} onSort={handlePtSort} />
                  <th style={{ ...baseThStyle, width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredPending.map((pt: any) => (
                  <tr key={pt.id}>
                    <td style={baseTdStyle}>{pt.memberName || "--"}</td>
                    <td style={baseTdStyle}>{pt.memberId || "--"}</td>
                    <td style={baseTdStyle}>{pt.phone || "--"}</td>
                    <td style={{ ...baseTdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={pt.product || undefined}>{pt.product || "--"}</td>
                    <td style={{ ...baseTdStyle, color: colors.danger }}>{formatDate(pt.holdDate)}</td>
                    <td style={{ ...baseTdStyle, color: colors.success }}>{formatDate(pt.nextBilling)}</td>
                    <td style={baseTdStyle}>{pt.assignedTo || "Unassigned"}</td>
                    <td style={baseTdStyle}>
                      <button
                        onClick={() => handleDeletePt(pt.id)}
                        aria-label="Delete record"
                        style={{
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          color: colors.textMuted,
                          padding: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.color = colors.danger; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.color = colors.textMuted; }}
                      >
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
