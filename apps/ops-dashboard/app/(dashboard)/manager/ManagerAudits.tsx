"use client";
import React, { useState, useEffect } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProgressRing,
  useToast,
  colors,
  spacing,
  radius,
  typography,
  baseInputStyle,
  baseLabelStyle,
  baseButtonStyle,
  baseThStyle,
  baseTdStyle,
  semanticColors,
  colorAlpha,
} from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import { formatDateTime } from "@ops/utils";
import {
  Edit3,
  Save,
  X,
  Headphones,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
  Star,
  Lightbulb,
  MessageSquare,
  AlertCircle,
  Mic,
  Filter,
} from "lucide-react";

/* -- Types -- */

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
  convosoCallLog?: { leadPhone: string | null } | null;
};

type SocketClient = import("socket.io-client").Socket;

export interface ManagerAuditsProps {
  socket: SocketClient | null;
  API: string;
}

/* -- Helpers -- */

function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

/* -- Style constants -- */

const LBL: React.CSSProperties = { ...baseLabelStyle };

const OUTCOME_COLORS: Record<string, { bg: string; color: string }> = {
  sold: { bg: "rgba(74,222,128,0.12)", color: semanticColors.accentGreen },
  lost: { bg: colorAlpha(semanticColors.dangerLight, 0.12), color: semanticColors.dangerLight },
  callback_scheduled: { bg: colorAlpha(semanticColors.statusPending, 0.12), color: semanticColors.statusPending },
  not_qualified: { bg: "rgba(148,163,184,0.12)", color: semanticColors.neutralLightGray },
  incomplete: { bg: "rgba(251,146,60,0.12)", color: semanticColors.warningOrange },
};

const PRIORITY_COLORS: Record<number, { bg: string; color: string }> = {
  1: { bg: colorAlpha(semanticColors.dangerLight, 0.15), color: semanticColors.dangerLight },
  2: { bg: colorAlpha(semanticColors.statusPending, 0.15), color: semanticColors.statusPending },
  3: { bg: colorAlpha(semanticColors.accentTealLight, 0.15), color: semanticColors.accentTealLight },
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
  borderLeft: `3px solid ${colorAlpha(semanticColors.accentTealLight, 0.4)}`,
  paddingLeft: 12,
  fontStyle: "italic",
  color: colors.textSecondary,
  margin: "8px 0",
  fontSize: typography.sizes.sm.fontSize,
  lineHeight: 1.6,
};

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

/* -- Component -- */

export default function ManagerAudits({ socket, API }: ManagerAuditsProps) {
  const { toast } = useToast();
  const [audits, setAudits] = useState<CallAudit[]>([]);
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const [editingAudit, setEditingAudit] = useState<string | null>(null);
  const [auditEdit, setAuditEdit] = useState({ score: 0, status: "", coachingNotes: "", callOutcome: "", managerSummary: "" });
  const [processingCalls, setProcessingCalls] = useState<Array<{ callLogId: string; agentName: string; status?: string; attempt?: number }>>([]);
  const [transcriptOpen, setTranscriptOpen] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  useEffect(() => {
    // Fetch agent list for filter dropdown
    authFetch(`${API}/api/call-audits/agents`).then(r => r.ok ? r.json() : []).then(setAgents).catch(() => { toast("error", "Failed to load audit agents"); });
  }, [API]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("limit", "30");
    if (selectedAgentId) params.set("agentId", selectedAgentId);
    // No date range = API defaults to last 24h

    authFetch(`${API}/api/call-audits?${params.toString()}`)
      .then(r => r.ok ? r.json() : { audits: [], nextCursor: null })
      .then((data: { audits: CallAudit[]; nextCursor: string | null }) => {
        setAudits(data.audits);
        setNextCursor(data.nextCursor);
      })
      .catch(() => { toast("error", "Failed to load audits"); });
  }, [API, selectedAgentId]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "30");
      params.set("cursor", nextCursor);
      if (selectedAgentId) params.set("agentId", selectedAgentId);

      const res = await authFetch(`${API}/api/call-audits?${params.toString()}`);
      if (res.ok) {
        const data: { audits: CallAudit[]; nextCursor: string | null } = await res.json();
        setAudits(prev => [...prev, ...data.audits]);
        setNextCursor(data.nextCursor);
      }
    } catch { toast("error", "Failed to run audit"); } finally {
      setLoadingMore(false);
    }
  };

  /* -- Socket events for real-time audit updates -- */
  useEffect(() => {
    if (!socket) return;
    const onProcessingStarted = (data: { callLogId: string; agentName: string }) => {
      setProcessingCalls(prev => [...prev, data]);
    };
    const onAuditStatus = (data: { callLogId: string; status: string; attempt?: number }) => {
      setProcessingCalls(prev => prev.map(p => p.callLogId === data.callLogId ? { ...p, status: data.status, attempt: data.attempt } : p));
    };
    const onNewAudit = (audit: CallAudit) => {
      setProcessingCalls(prev => prev.filter(p => p.callLogId !== audit.id));
      setAudits(prev => [audit, ...prev.filter(a => a.id !== audit.id)]);
    };
    const onProcessingFailed = (data: { callLogId: string; error: string }) => {
      setProcessingCalls(prev => prev.filter(p => p.callLogId !== data.callLogId));
    };

    socket.on("processing_started", onProcessingStarted);
    socket.on("audit_status", onAuditStatus);
    socket.on("new_audit", onNewAudit);
    socket.on("processing_failed", onProcessingFailed);

    return () => {
      socket.off("processing_started", onProcessingStarted);
      socket.off("audit_status", onAuditStatus);
      socket.off("new_audit", onNewAudit);
      socket.off("processing_failed", onProcessingFailed);
    };
  }, [socket]);

  return (
    <Card className="animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <SectionHeader icon={<Headphones size={18} />} title="Call Audits" count={audits.length} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Filter size={14} style={{ color: colors.textMuted }} />
            <select
              className="input-focus"
              style={{ ...baseInputStyle, width: 180, fontSize: 12, padding: "4px 8px" }}
              value={selectedAgentId}
              onChange={e => setSelectedAgentId(e.target.value)}
            >
              <option value="">All Agents</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("limit", "30");
              if (selectedAgentId) params.set("agentId", selectedAgentId);
              authFetch(`${API}/api/call-audits?${params.toString()}`)
                .then(r => r.ok ? r.json() : { audits: [], nextCursor: null })
                .then((data: { audits: CallAudit[]; nextCursor: string | null }) => {
                  setAudits(data.audits);
                  setNextCursor(data.nextCursor);
                })
                .catch(() => { toast("error", "Failed to refresh audits"); });
            }}
          >
            <RefreshCw size={14} />Refresh
          </Button>
        </div>
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
                background: colorAlpha(semanticColors.accentTealMid, 0.08),
                border: `1px solid ${colorAlpha(semanticColors.accentTealMid, 0.2)}`,
                borderRadius: radius.lg,
                fontSize: typography.sizes.sm.fontSize,
                color: colors.textSecondary,
              }}
            >
              <div style={{
                width: 16,
                height: 16,
                border: `2px solid ${colorAlpha(semanticColors.accentTealMid, 0.3)}`,
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
                {["Date", "Agent", "Phone", "Outcome", "Score", "Summary", "Actions"].map((h, i) => (
                  <th key={h} style={{ ...baseThStyle, textAlign: i === 4 ? "center" : "left", ...(i === 2 ? { minWidth: 130 } : {}) }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audits.map((a, auditIdx) => {
                const scoreColor = a.score >= 80 ? colors.success : a.score >= 60 ? colors.warning : colors.danger;
                const isExpanded = expandedAudit === a.id;
                const isEditing = editingAudit === a.id;
                const outcomeStyle = a.callOutcome ? (OUTCOME_COLORS[a.callOutcome] ?? { bg: "rgba(148,163,184,0.12)", color: semanticColors.neutralLightGray }) : null;
                const summaryText = a.managerSummary ?? a.aiSummary;
                return (
                  <React.Fragment key={a.id}>
                    <tr
                      className={`row-hover animate-fade-in-up stagger-${Math.min(auditIdx + 1, 10)}`}
                      style={{ cursor: "pointer" }}
                      onClick={() => setExpandedAudit(isExpanded ? null : a.id)}
                    >
                      <td style={baseTdStyle}>{formatDateTime(a.callDate)}</td>
                      <td style={{ ...baseTdStyle, color: colors.textPrimary, fontWeight: 500 }}>{a.agent.name}</td>
                      <td style={baseTdStyle}>
                        {a.convosoCallLog?.leadPhone
                          ? formatPhone(a.convosoCallLog.leadPhone)
                          : <span style={{ color: colors.textMuted }}>&mdash;</span>}
                      </td>
                      <td style={baseTdStyle}>
                        {outcomeStyle ? (
                          <span style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: radius.full,
                            fontSize: typography.sizes.xs.fontSize,
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
                      <td style={{ ...baseTdStyle, textAlign: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                          <ProgressRing progress={a.score} size={32} strokeWidth={3} color={scoreColor} />
                          <span style={{ fontSize: typography.sizes.sm.fontSize, fontWeight: 700, color: scoreColor }}>{a.score}</span>
                        </div>
                      </td>
                      <td style={{ ...baseTdStyle, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {summaryText ?? <span style={{ color: colors.textMuted }}>&mdash;</span>}
                      </td>
                      <td style={baseTdStyle}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <Button
                            variant="ghost"
                            size="sm"
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
                          </Button>
                          <span style={{ color: colors.textMuted, fontSize: 12 }}>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded details row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, borderBottom: `1px solid ${colors.borderSubtle}` }}>
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
                                <div style={{ fontSize: typography.sizes.xs.fontSize, fontWeight: 700, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                                  {a.managerSummary ? "Manager Summary" : "AI Summary"}
                                </div>
                                <p style={{ margin: 0, fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, lineHeight: 1.7 }}>
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
                                          fontSize: typography.sizes.xs.fontSize,
                                          fontWeight: 800,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}>
                                          P{cp.priority}
                                        </span>
                                        <div>
                                          <div style={{ fontSize: typography.sizes.sm.fontSize, fontWeight: 700, color: colors.textPrimary, marginBottom: 4 }}>{cp.focus_area}</div>
                                          <div style={{ fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, lineHeight: 1.6 }}>{cp.talking_point}</div>
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
                                      border: `1px solid ${colorAlpha(semanticColors.dangerLight, 0.15)}`,
                                    }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                        <span style={{
                                          display: "inline-block",
                                          padding: "2px 10px",
                                          borderRadius: radius.full,
                                          fontSize: typography.sizes.xs.fontSize,
                                          fontWeight: 700,
                                          background: colorAlpha(semanticColors.dangerLight, 0.12),
                                          color: semanticColors.dangerLight,
                                        }}>
                                          {CATEGORY_LABELS[issue.category] ?? issue.category}
                                        </span>
                                        {issue.timestamp_hint && (
                                          <span style={{ fontSize: typography.sizes.xs.fontSize, color: colors.textMuted }}>{issue.timestamp_hint}</span>
                                        )}
                                      </div>
                                      <p style={{ margin: "0 0 8px", fontSize: typography.sizes.sm.fontSize, color: colors.textPrimary, fontWeight: 500 }}>{issue.what_happened}</p>
                                      <div style={{ marginBottom: 4, fontSize: typography.sizes.xs.fontSize, fontWeight: 600, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Agent said:</div>
                                      <div style={QUOTE_BLOCK}>{issue.agent_quote}</div>
                                      <div style={{ marginBottom: 4, fontSize: typography.sizes.xs.fontSize, fontWeight: 600, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Customer said:</div>
                                      <div style={QUOTE_BLOCK}>{issue.customer_quote}</div>
                                      <div style={{ marginTop: 10, marginBottom: 4, fontSize: typography.sizes.xs.fontSize, fontWeight: 600, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Why it's a problem:</div>
                                      <p style={{ margin: "0 0 8px", fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, lineHeight: 1.6 }}>{issue.why_its_a_problem}</p>
                                      <div style={{ marginBottom: 4, fontSize: typography.sizes.xs.fontSize, fontWeight: 600, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Recommended response:</div>
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
                                  <Star size={15} style={{ color: semanticColors.statusPending }} />
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
                                      <p style={{ margin: "0 0 8px", fontSize: typography.sizes.sm.fontSize, color: colors.textPrimary, fontWeight: 500 }}>{win.what_happened}</p>
                                      <div style={QUOTE_BLOCK}>{win.agent_quote}</div>
                                      <div style={{ marginTop: 8, fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, lineHeight: 1.6 }}>
                                        <span style={{ fontWeight: 600, color: semanticColors.accentGreen }}>Why it worked: </span>
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
                                  <Lightbulb size={15} style={{ color: semanticColors.statusPending }} />
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
                                      border: `1px solid ${colorAlpha(semanticColors.statusPending, 0.15)}`,
                                    }}>
                                      <div style={{ fontSize: 12, fontWeight: 700, color: semanticColors.statusPending, marginBottom: 6 }}>{mo.moment}</div>
                                      <p style={{ margin: "0 0 8px", fontSize: typography.sizes.sm.fontSize, color: colors.textSecondary, lineHeight: 1.6 }}>
                                        <span style={{ fontWeight: 600, color: colors.textPrimary }}>What should have happened: </span>
                                        {mo.what_should_have_happened}
                                      </p>
                                      <div style={{ marginBottom: 4, fontSize: typography.sizes.xs.fontSize, fontWeight: 600, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.05em" }}>Suggested script:</div>
                                      <div style={{
                                        ...QUOTE_BLOCK,
                                        borderLeftColor: colorAlpha(semanticColors.statusPending, 0.4),
                                      }}>{mo.suggested_script}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Transcript -- collapsible */}
                            {a.transcription && (
                              <div style={{ marginBottom: 20 }}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  style={{
                                    marginBottom: 8,
                                  }}
                                  onClick={() => setTranscriptOpen(transcriptOpen === a.id ? null : a.id)}
                                >
                                  <MessageSquare size={13} />
                                  {transcriptOpen === a.id ? "Hide" : "Show"} Transcript
                                  {transcriptOpen === a.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </Button>
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
                                <div style={{ fontSize: typography.sizes.xs.fontSize, fontWeight: 700, color: colors.textTertiary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Recording</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                  <a
                                    href={a.recordingUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-hover"
                                    style={{ ...baseButtonStyle, padding: "6px 12px", background: "transparent", border: `1px solid ${colors.borderDefault}`, color: colors.textSecondary, borderRadius: radius.md, fontSize: 12, display: "inline-flex", textDecoration: "none" }}
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
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div className="animate-fade-in" style={{ padding: 20, background: colorAlpha(semanticColors.accentTealMid, 0.04), borderTop: `1px solid ${colors.borderSubtle}` }}>
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                              <div>
                                <label style={LBL}>Score</label>
                                <input
                                  className="input-focus"
                                  type="number"
                                  min={0}
                                  max={100}
                                  style={{ ...baseInputStyle, width: 80 }}
                                  value={auditEdit.score}
                                  onChange={e => setAuditEdit(x => ({ ...x, score: Number(e.target.value) }))}
                                />
                              </div>
                              <div>
                                <label style={LBL}>Status</label>
                                <input
                                  className="input-focus"
                                  style={{ ...baseInputStyle, width: 140 }}
                                  value={auditEdit.status}
                                  onChange={e => setAuditEdit(x => ({ ...x, status: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label style={LBL}>Outcome</label>
                                <select
                                  className="input-focus"
                                  style={{ ...baseInputStyle, width: 160 }}
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
                                  style={baseInputStyle}
                                  value={auditEdit.coachingNotes}
                                  onChange={e => setAuditEdit(x => ({ ...x, coachingNotes: e.target.value }))}
                                />
                              </div>
                              <div style={{ flex: 2, minWidth: 240 }}>
                                <label style={LBL}>Manager Summary</label>
                                <input
                                  className="input-focus"
                                  style={baseInputStyle}
                                  placeholder="Override AI summary with your own notes..."
                                  value={auditEdit.managerSummary}
                                  onChange={e => setAuditEdit(x => ({ ...x, managerSummary: e.target.value }))}
                                />
                              </div>
                              <Button
                                variant="success"
                                size="sm"
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
                              </Button>
                              <Button variant="secondary" size="sm" onClick={() => setEditingAudit(null)}>
                                <X size={14} />Cancel
                              </Button>
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
          {nextCursor && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                style={{ opacity: loadingMore ? 0.5 : 1 }}
              >
                {loadingMore ? "Loading..." : "Load More Audits"}
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
