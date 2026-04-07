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
} from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDollar } from "@ops/utils";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

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
      // preview=true: client only previews assignments. Cursor advance happens
      // server-side inside the POST /chargebacks and POST /pending-terms transactions
      // so paste/refresh/rep-change effects no longer drift the round-robin cursor.
      const res = await authFetch(`${API}/api/reps/batch-assign?type=${type}&count=${count}&preview=true`);
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

  const handleTextChange = async (text: string) => {
    setRawText(text);
    if (text.trim()) {
      const parsed = parseChargebackText(text);
      const consolidated = consolidateByMember(parsed);
      const assignments = await fetchBatchAssign("chargeback", consolidated.length);
      setRecords(assignRoundRobinLocal(consolidated, assignments));
    } else {
      setRecords([]);
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
        onRepsChange={setReps}
        onSidebarToggle={() => setSidebarOpen((o) => !o)}
        onSubmittingChange={setSubmitting}
        onNewRepNameChange={setNewRepName}
        onRawTextClear={() => { setRawText(""); setRecords([]); }}
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
        body: JSON.stringify({ records, rawPaste: rawText, batchId, source: "CS" }),
      });
      if (res.status === 201) {
        const data = await res.json() as {
          count: number;
          alertCount?: number;
          alertAttempted?: number;
          alertFailed?: number;
        };
        onRawTextClear();
        // GAP-46-UAT-05 (46-10): surface alert pipeline outcome so CS sees when
        // their submission queued alerts (matched or manual-review) and when any
        // failed to write. Silent on the happy "0 alerts" path to avoid noise.
        const attempted = data.alertAttempted ?? 0;
        const failed = data.alertFailed ?? 0;
        const succeeded = data.alertCount ?? 0;
        let msg = `${data.count} chargebacks submitted`;
        if (attempted > 0) {
          if (failed > 0) {
            msg += ` · ${succeeded}/${attempted} alerts queued (${failed} failed)`;
          } else {
            msg += ` · ${succeeded} alert${succeeded === 1 ? "" : "s"} queued for payroll review`;
          }
        }
        toast(failed > 0 ? "error" : "success", msg);
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
        {/* Paste Area */}
        <Card>
          <h3 style={SECTION_HEADING}>Chargeback Submissions</h3>
          <textarea
            style={TEXTAREA}
            placeholder="Paste chargeback data from spreadsheet here..."
            value={rawText}
            onChange={(e) => onTextChange(e.target.value)}
          />
          {!rawText && (
            <EmptyState
              title="Paste Chargeback Data"
              description="Paste tab-separated chargeback rows from your spreadsheet. Records will be parsed and consolidated by member automatically."
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
                    <th style={{ ...baseThStyle, width: 140 }}>Agent</th>
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
                      <td style={baseTdStyle}>
                        <input
                          type="date"
                          style={COMPACT_INPUT}
                          value={rec.postedDate ?? ""}
                          onChange={(e) => updateRecord(idx, "postedDate", e.target.value)}
                          disabled={submitting}
                        />
                      </td>
                      <td style={baseTdStyle}>
                        <input
                          type="text"
                          style={COMPACT_INPUT}
                          value={rec.memberCompany}
                          onChange={(e) => updateRecord(idx, "memberCompany", e.target.value)}
                          disabled={submitting}
                        />
                      </td>
                      <td style={baseTdStyle}>
                        <span style={{ color: colors.textSecondary }}>{rec.memberId || "--"}</span>
                      </td>
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
                      <td style={baseTdStyle}>
                        <select
                          style={{ ...COMPACT_INPUT, color: rec.memberAgentCompany ? colors.textPrimary : colors.textMuted }}
                          value={rec.memberAgentCompany ?? ""}
                          onChange={(e) => updateRecord(idx, "memberAgentCompany", e.target.value)}
                          disabled={submitting}
                        >
                          <option value="">Unknown</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.name}>{a.name}</option>
                          ))}
                          {rec.memberAgentCompany && !agents.some(a => a.name === rec.memberAgentCompany) && (
                            <option value={rec.memberAgentCompany}>{rec.memberAgentCompany}</option>
                          )}
                        </select>
                      </td>
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
