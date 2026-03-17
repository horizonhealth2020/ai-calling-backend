"use client";
import { useState, useEffect, useCallback, useRef } from "react";
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
} from "@ops/ui";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";
import { ClipboardList, BarChart3, ChevronLeft, ChevronRight, X } from "lucide-react";

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

/* ── Formatting Helpers ─────────────────────────────────────────── */

function formatDollar(n: number): string {
  return "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNegDollar(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `-$${abs}`;
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

  // When reps change, re-assign existing records
  useEffect(() => {
    if (records.length > 0) {
      const currentActive = reps.filter((r) => r.active).map((r) => r.name);
      setRecords((prev) => assignRoundRobin(prev, currentActive));
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

        {/* Pending Terms placeholder */}
        <Card>
          <h3 style={SECTION_HEADING}>Pending Terms Submissions</h3>
          <EmptyState
            title="Paste Pending Terms Data"
            description="Paste raw pending terms text here to parse and submit records. This feature is coming in the next update."
          />
        </Card>
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

/* ── Tracking Tab ───────────────────────────────────────────────── */

function TrackingTab() {
  const [weeklyTotal, setWeeklyTotal] = useState<WeeklyTotal | null>(null);
  const [chargebacks, setChargebacks] = useState<Array<{
    id: string;
    postedDate: string | null;
    memberCompany: string | null;
    product: string | null;
    type: string | null;
    totalAmount: string | null;
    chargebackAmount: string | null;
    assignedTo: string | null;
    submittedAt: string;
  }>>([]);

  const fetchData = useCallback(async () => {
    try {
      const [totalRes, cbRes] = await Promise.all([
        authFetch(`${API}/api/chargebacks/weekly-total`),
        authFetch(`${API}/api/chargebacks`),
      ]);
      if (totalRes.ok) setWeeklyTotal(await totalRes.json());
      if (cbRes.ok) setChargebacks(await cbRes.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id: string) => {
    try {
      const res = await authFetch(`${API}/api/chargebacks/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 204) {
        setChargebacks((prev) => prev.filter((cb) => cb.id !== id));
        // Refresh ticker after delete
        const totalRes = await authFetch(`${API}/api/chargebacks/weekly-total`);
        if (totalRes.ok) setWeeklyTotal(await totalRes.json());
      }
    } catch { /* ignore */ }
  };

  const tickerTotal = weeklyTotal ? Math.abs(weeklyTotal.total) : 0;
  const tickerCount = weeklyTotal?.count ?? 0;
  const weekRange = weeklyTotal
    ? (() => {
        const ws = new Date(weeklyTotal.weekStart);
        const we = new Date(weeklyTotal.weekEnd);
        return `${ws.getUTCMonth() + 1}/${ws.getUTCDate()}-${we.getUTCMonth() + 1}/${we.getUTCDate()}`;
      })()
    : (() => {
        const r = getCurrentWeekRange();
        return `${r.start}-${r.end}`;
      })();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: `${spacing[6]}px` }}>
      {/* Weekly Ticker */}
      <Card style={TICKER_CARD}>
        <span style={TICKER_LABEL}>WEEKLY CHARGEBACKS</span>
        <div style={TICKER_VALUE}>
          <AnimatedNumber value={tickerTotal} decimals={2} prefix="$" duration={600} />
        </div>
        <span style={TICKER_SUB}>
          {tickerCount} records — Week of {weekRange}
        </span>
      </Card>

      {/* Chargeback Tracking */}
      <Card>
        <h3 style={SECTION_HEADING}>Chargeback Tracking</h3>
        {chargebacks.length === 0 ? (
          <EmptyState
            title="No Chargebacks Yet"
            description="Chargeback records will appear here once submissions are processed."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={baseThStyle}>Date Posted</th>
                  <th style={baseThStyle}>Member</th>
                  <th style={{ ...baseThStyle, width: 110 }}>Member ID</th>
                  <th style={baseThStyle}>Product</th>
                  <th style={baseThStyle}>Type</th>
                  <th style={baseThStyle}>Total</th>
                  <th style={baseThStyle}>Assigned To</th>
                  <th style={baseThStyle}>Submitted</th>
                  <th style={{ ...baseThStyle, width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {chargebacks.map((cb) => (
                  <tr key={cb.id}>
                    <td style={baseTdStyle}>{cb.postedDate ? (() => { const [y, m, d] = cb.postedDate.split("T")[0].split("-"); return `${parseInt(m)}/${parseInt(d)}/${y}`; })() : "--"}</td>
                    <td style={baseTdStyle}>{cb.memberCompany || "--"}</td>
                    <td style={baseTdStyle}>{cb.memberId || "--"}</td>
                    <td style={{ ...baseTdStyle, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={cb.product || undefined}>{cb.product || "--"}</td>
                    <td style={baseTdStyle}>{cb.type || "--"}</td>
                    <td style={baseTdStyle}>{cb.totalAmount ? `$${parseFloat(cb.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "--"}</td>
                    <td style={baseTdStyle}>{cb.assignedTo || "Unassigned"}</td>
                    <td style={baseTdStyle}>{new Date(cb.submittedAt).toLocaleDateString("en-US")}</td>
                    <td style={baseTdStyle}>
                      <button
                        onClick={() => handleDelete(cb.id)}
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

      <Card>
        <h3 style={SECTION_HEADING}>Pending Terms Tracking</h3>
        <EmptyState
          title="No Pending Terms Yet"
          description="Pending terms records will appear here once submissions are processed."
        />
      </Card>
    </div>
  );
}
