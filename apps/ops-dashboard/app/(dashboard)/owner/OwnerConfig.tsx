"use client";
import React, { useState, useEffect } from "react";
import { formatDollar } from "@ops/utils";
import {
  Badge,
  Button,
  useToast,
  colors,
  radius,
  typography,
  motion,
  baseCardStyle,
  baseInputStyle,
  baseLabelStyle,
} from "@ops/ui";
import { authFetch } from "@ops/auth/client";
import {
  Shield,
  Save,
  Database,
  RotateCcw,
} from "lucide-react";

type AgentInfo = { id: string; name: string; email?: string; active?: boolean; auditEnabled?: boolean };

/* -- Inline style constants -- */

const CARD: React.CSSProperties = {
  ...baseCardStyle,
  borderRadius: radius["2xl"],
};

const LBL: React.CSSProperties = {
  ...baseLabelStyle,
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: typography.sizes.md.fontSize,
  fontWeight: typography.weights.bold,
  color: colors.textPrimary,
  letterSpacing: typography.tracking.tight,
  margin: 0,
};

const SECTION_SUBTITLE: React.CSSProperties = {
  fontSize: typography.sizes.sm.fontSize,
  color: colors.textTertiary,
  margin: "4px 0 0",
};

const INP: React.CSSProperties = {
  ...baseInputStyle,
  boxSizing: "border-box" as const,
};

/* -- ConfigSection -- */

function ConfigSection({
  agents,
  aiPrompt,
  setAiPrompt,
  aiPromptLoaded,
  auditMinSec,
  setAuditMinSec,
  auditMaxSec,
  setAuditMaxSec,
  auditDurationLoaded,
  setAgents,
  API,
}: {
  agents: AgentInfo[];
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  aiPromptLoaded: boolean;
  auditMinSec: number;
  setAuditMinSec: (v: number) => void;
  auditMaxSec: number;
  setAuditMaxSec: (v: number) => void;
  auditDurationLoaded: boolean;
  setAgents: React.Dispatch<React.SetStateAction<AgentInfo[]>>;
  API: string;
}) {
  const { toast } = useToast();
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingDuration, setSavingDuration] = useState(false);

  // AI stats & controls
  const [aiStats, setAiStats] = useState<{ todaySpent: number; todayCount: number; dailyBudget: number; queuedCount: number; estimatedMonthly: number } | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [autoScoring, setAutoScoring] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [aiScoringEnabled, setAiScoringEnabled] = useState(false);
  const [togglingAiScoring, setTogglingAiScoring] = useState(false);

  // Convoso polling controls
  const [convosoEnabled, setConvosoEnabled] = useState(false);
  const [togglingConvoso, setTogglingConvoso] = useState(false);
  const [bizStart, setBizStart] = useState("08:00");
  const [bizEnd, setBizEnd] = useState("18:00");
  const [savingBizHours, setSavingBizHours] = useState(false);

  useEffect(() => {
    authFetch(`${API}/api/ai/usage-stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setAiStats(d);
          setBudgetInput(String(d.dailyBudget));
        }
      })
      .catch(() => {});
    authFetch(`${API}/api/settings/ai-scoring-enabled`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAiScoringEnabled(d.enabled); })
      .catch(() => {});
    authFetch(`${API}/api/settings/convoso-polling`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setConvosoEnabled(d.enabled);
          setBizStart(d.businessHoursStart);
          setBizEnd(d.businessHoursEnd);
        }
      })
      .catch(() => {});
  }, [API]);

  async function handleAutoScore() {
    setAutoScoring(true);
    try {
      const res = await authFetch(`${API}/api/ai/auto-score`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast("success", data.message || `${data.queued} calls queued`);
        const sr = await authFetch(`${API}/api/ai/usage-stats`);
        if (sr.ok) {
          const sd = await sr.json();
          setAiStats(sd);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      toast("error", `Unable to reach API \u2014 ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setAutoScoring(false);
    }
  }

  async function handleSaveBudget() {
    setSavingBudget(true);
    try {
      const res = await authFetch(`${API}/api/ai/budget`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyBudget: parseFloat(budgetInput) || 0 }),
      });
      if (res.ok) {
        const data = await res.json();
        toast("success", `Daily budget updated to ${formatDollar(data.dailyBudget)}`);
        setAiStats((prev) => prev ? { ...prev, dailyBudget: data.dailyBudget } : prev);
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      toast("error", `Unable to reach API \u2014 ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setSavingBudget(false);
    }
  }

  async function toggleAiScoring() {
    setTogglingAiScoring(true);
    try {
      const res = await authFetch(`${API}/api/settings/ai-scoring-enabled`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !aiScoringEnabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiScoringEnabled(data.enabled);
        toast("success", `AI scoring ${data.enabled ? "enabled" : "disabled"}`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      toast("error", `Unable to reach API — ${e instanceof Error ? e.message : "network error"}`);
    } finally { setTogglingAiScoring(false); }
  }

  async function toggleConvoso() {
    setTogglingConvoso(true);
    try {
      const res = await authFetch(`${API}/api/settings/convoso-polling`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !convosoEnabled }),
      });
      if (res.ok) {
        setConvosoEnabled(!convosoEnabled);
        toast("success", `Convoso polling ${!convosoEnabled ? "enabled" : "disabled"}`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      toast("error", `Unable to reach API — ${e instanceof Error ? e.message : "network error"}`);
    } finally { setTogglingConvoso(false); }
  }

  async function handleSaveBizHours() {
    setSavingBizHours(true);
    try {
      const res = await authFetch(`${API}/api/settings/convoso-polling`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessHoursStart: bizStart, businessHoursEnd: bizEnd }),
      });
      if (res.ok) {
        toast("success", `Business hours updated: ${bizStart} – ${bizEnd}`);
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      toast("error", `Unable to reach API — ${e instanceof Error ? e.message : "network error"}`);
    } finally { setSavingBizHours(false); }
  }

  async function handleSavePrompt() {
    setSavingPrompt(true);
    try {
      const res = await authFetch(`${API}/api/settings/ai-audit-prompt`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (res.ok) {
        toast("success", "AI audit prompt saved");
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      toast("error", `Unable to reach API \u2014 ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setSavingPrompt(false);
    }
  }

  async function handleSaveDuration() {
    setSavingDuration(true);
    try {
      const res = await authFetch(`${API}/api/settings/audit-duration`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minSeconds: auditMinSec, maxSeconds: auditMaxSec }),
      });
      if (res.ok) {
        toast("success", "Duration filter saved");
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error ?? `Request failed (${res.status})`);
      }
    } catch (e: unknown) {
      toast("error", `Unable to reach API \u2014 ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setSavingDuration(false);
    }
  }

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ ...SECTION_TITLE, fontSize: typography.sizes.lg.fontSize }}>AI Configuration</h2>
        <p style={SECTION_SUBTITLE}>Manage call audit prompts, agent settings, and AI scoring</p>
      </div>

      {/* AI Audit Prompt */}
      <div className="animate-fade-in-up stagger-1" style={{ ...CARD, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h3 style={SECTION_TITLE}>Call Audit System Prompt</h3>
            <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>
              Instructs GPT-4o-mini how to evaluate call transcriptions. Should request a JSON response with{" "}
              <code style={{ fontSize: 12, color: colors.primary400, background: colors.bgSurfaceInset, padding: "1px 5px", borderRadius: 3 }}>
                score, summary, coachingNotes
              </code>{" "}
              fields.
            </p>
          </div>
          <Shield size={20} color={colors.primary400} style={{ flexShrink: 0, marginTop: 2 }} />
        </div>
        {!aiPromptLoaded ? (
          <div style={{ height: 200, background: colors.bgSurfaceInset, borderRadius: radius.lg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: colors.textMuted, fontSize: 13 }}>Loading prompt...</span>
          </div>
        ) : (
          <textarea
            className="input-focus"
            style={{
              ...INP,
              minHeight: 480,
              fontFamily: typography.fontMono,
              fontSize: 13,
              lineHeight: 1.7,
              resize: "vertical",
              boxSizing: "border-box",
            }}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="Enter your system prompt for AI call auditing..."
          />
        )}
        <div style={{ marginTop: 16 }}>
          <Button variant="success" icon={<Save size={14} />} loading={savingPrompt} onClick={handleSavePrompt}>
            Save Prompt
          </Button>
        </div>
      </div>

      {/* Agent Audit Settings */}
      <div className="animate-fade-in-up stagger-2" style={{ ...CARD, marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={SECTION_TITLE}>Agent Audit Settings</h3>
          <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>
            Enable AI call auditing for individual agents. Unchecked agents will have their recordings skipped.
          </p>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {agents.filter((a) => a.active !== false).map((a) => (
            <label
              key={a.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
                padding: "10px 14px",
                borderRadius: radius.lg,
                background: a.auditEnabled ? colors.successBg : colors.bgSurfaceInset,
                border: `1px solid ${a.auditEnabled ? colors.success + "30" : colors.borderSubtle}`,
                transition: `all ${motion.duration.fast} ${motion.easing.out}`,
              }}
            >
              <input
                type="checkbox"
                checked={!!a.auditEnabled}
                onChange={async (e) => {
                  const val = e.target.checked;
                  setAgents((prev) => prev.map((ag) => (ag.id === a.id ? { ...ag, auditEnabled: val } : ag)));
                  try {
                    const res = await authFetch(`${API}/api/agents/${a.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ auditEnabled: val }),
                    });
                    if (!res.ok) {
                      setAgents((prev) => prev.map((ag) => (ag.id === a.id ? { ...ag, auditEnabled: !val } : ag)));
                    }
                  } catch {
                    setAgents((prev) => prev.map((ag) => (ag.id === a.id ? { ...ag, auditEnabled: !val } : ag)));
                  }
                }}
                style={{ width: 15, height: 15, accentColor: colors.success, cursor: "pointer" }}
              />
              <span style={{ fontSize: 14, fontWeight: typography.weights.semibold, color: colors.textPrimary }}>
                {a.name}
              </span>
              {a.email && (
                <span style={{ fontSize: 12, color: colors.textTertiary }}>({a.email})</span>
              )}
              <div style={{ marginLeft: "auto" }}>
                {a.auditEnabled ? (
                  <Badge color={colors.success} dot size="sm">Audit On</Badge>
                ) : (
                  <Badge color={colors.textMuted} size="sm">Skipped</Badge>
                )}
              </div>
            </label>
          ))}
          {agents.filter((a) => a.active !== false).length === 0 && (
            <p style={{ color: colors.textMuted, fontSize: 13, padding: "12px 0" }}>No active agents found.</p>
          )}
        </div>
      </div>

      {/* Call Duration Filter */}
      <div className="animate-fade-in-up stagger-3" style={{ ...CARD, marginBottom: 20 }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={SECTION_TITLE}>Call Duration Filter</h3>
          <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>
            Only audit calls within this duration range. Set to 0 to disable a limit.
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={LBL}>Min Seconds</label>
            <input
              className="input-focus"
              style={{ ...baseInputStyle, boxSizing: "border-box", width: 140 }}
              type="number"
              min="0"
              value={auditMinSec}
              onChange={(e) => setAuditMinSec(Number(e.target.value))}
              disabled={!auditDurationLoaded}
            />
          </div>
          <div>
            <label style={LBL}>Max Seconds</label>
            <input
              className="input-focus"
              style={{ ...baseInputStyle, boxSizing: "border-box", width: 140 }}
              type="number"
              min="0"
              value={auditMaxSec}
              onChange={(e) => setAuditMaxSec(Number(e.target.value))}
              disabled={!auditDurationLoaded}
            />
          </div>
          <Button variant="success" icon={<Save size={14} />} loading={savingDuration} onClick={handleSaveDuration}>
            Save Filter
          </Button>
        </div>
      </div>

      {/* AI Scoring & Cost Controls */}
      <div className="animate-fade-in-up stagger-5" style={{ ...CARD, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={SECTION_TITLE}>AI Scoring & Cost Controls</h3>
            <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>
              Monitor AI usage, set budget caps, and trigger batch scoring of eligible calls.
            </p>
          </div>
          <button
            onClick={toggleAiScoring}
            disabled={togglingAiScoring}
            style={{
              padding: "6px 16px", borderRadius: radius.lg, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              background: aiScoringEnabled ? colors.success : "rgba(239,68,68,0.15)",
              color: aiScoringEnabled ? "#fff" : colors.danger,
              opacity: togglingAiScoring ? 0.6 : 1,
              transition: "all 150ms ease-out", flexShrink: 0,
            }}
          >
            {togglingAiScoring ? "..." : aiScoringEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>

        {/* Usage Stats */}
        {aiStats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
            <div style={{ background: colors.bgSurfaceInset, borderRadius: radius.lg, padding: "14px 16px", border: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Today's Spend</div>
              <div style={{ fontSize: 20, fontWeight: typography.weights.bold, color: colors.textPrimary }}>
                {formatDollar(aiStats.todaySpent)}
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                of {formatDollar(aiStats.dailyBudget)} budget
              </div>
            </div>
            <div style={{ background: colors.bgSurfaceInset, borderRadius: radius.lg, padding: "14px 16px", border: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Calls Scored Today</div>
              <div style={{ fontSize: 20, fontWeight: typography.weights.bold, color: colors.textPrimary }}>
                {aiStats.todayCount}
              </div>
            </div>
            <div style={{ background: colors.bgSurfaceInset, borderRadius: radius.lg, padding: "14px 16px", border: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Queued</div>
              <div style={{ fontSize: 20, fontWeight: typography.weights.bold, color: aiStats.queuedCount > 0 ? colors.warning : colors.textPrimary }}>
                {aiStats.queuedCount}
              </div>
            </div>
            <div style={{ background: colors.bgSurfaceInset, borderRadius: radius.lg, padding: "14px 16px", border: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>Est. Monthly</div>
              <div style={{ fontSize: 20, fontWeight: typography.weights.bold, color: colors.textPrimary }}>
                {formatDollar(aiStats.estimatedMonthly)}
              </div>
            </div>
          </div>
        )}

        {/* Budget Control */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 16 }}>
          <div>
            <label style={LBL}>Daily Budget Cap ($)</label>
            <input
              className="input-focus"
              style={{ ...INP, width: 160 }}
              type="number"
              min="0"
              max="1000"
              step="0.50"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
            />
          </div>
          <Button variant="success" icon={<Save size={14} />} loading={savingBudget} onClick={handleSaveBudget}>
            Update Budget
          </Button>
        </div>

        {/* Auto-Score Trigger */}
        <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 16 }}>
          <p style={{ ...SECTION_SUBTITLE, marginBottom: 12 }}>
            Queue all eligible calls (2+ min with recording, not yet scored) for AI analysis.
          </p>
          <Button variant="primary" loading={autoScoring} onClick={handleAutoScore}>
            Score Eligible Calls
          </Button>
        </div>
      </div>

      {/* Convoso Polling Controls */}
      <div className="animate-fade-in-up stagger-6" style={{ ...CARD, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <h3 style={SECTION_TITLE}>Convoso Call Log Polling</h3>
            <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>
              Automatically pulls call logs from Convoso to track agent KPIs. Runs every 10 minutes during business hours.
            </p>
          </div>
          <button
            onClick={toggleConvoso}
            disabled={togglingConvoso}
            style={{
              padding: "6px 16px", borderRadius: radius.lg, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 700,
              background: convosoEnabled ? colors.success : "rgba(239,68,68,0.15)",
              color: convosoEnabled ? "#fff" : colors.danger,
              opacity: togglingConvoso ? 0.6 : 1,
              transition: "all 150ms ease-out", flexShrink: 0,
            }}
          >
            {togglingConvoso ? "..." : convosoEnabled ? "Enabled" : "Disabled"}
          </button>
        </div>

        {/* Business Hours */}
        <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 12 }}>
            Business Hours
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <label style={LBL}>Start Time</label>
              <input className="input-focus" style={{ ...INP, width: 120 }} type="time" value={bizStart} onChange={(e) => setBizStart(e.target.value)} />
            </div>
            <div>
              <label style={LBL}>End Time</label>
              <input className="input-focus" style={{ ...INP, width: 120 }} type="time" value={bizEnd} onChange={(e) => setBizEnd(e.target.value)} />
            </div>
            <Button variant="success" icon={<Save size={14} />} loading={savingBizHours} onClick={handleSaveBizHours}>
              Save Hours
            </Button>
          </div>
          <p style={{ ...SECTION_SUBTITLE, marginTop: 8 }}>
            Polling only runs between these hours. Outside this window, the poller skips its cycle.
          </p>
        </div>
      </div>
    </div>
  );
}

/* -- OwnerConfig -- */

/* -- DataArchiveSection -- */

type ArchiveTableStat = { name: string; rowCount: number; oldestRecord: string | null; newestRecord: string | null };
type ArchiveBatch = { batchId: string; table: string; archivedAt: string; count: number };
type ArchiveStats = { tables: ArchiveTableStat[]; batches: ArchiveBatch[] };
type ArchiveResult = { count: number };

function DataArchiveSection({ API }: { API: string }) {
  const { toast } = useToast();
  const [archiveStats, setArchiveStats] = useState<ArchiveStats | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveDays, setArchiveDays] = useState(90);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [archivePreviewCounts, setArchivePreviewCounts] = useState<{ total: number; tables: { name: string; count: number }[] } | null>(null);
  const [archivePreviewLoading, setArchivePreviewLoading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchArchiveStats = async () => {
    try {
      const res = await authFetch(`${API}/api/archive/stats`);
      if (res.ok) setArchiveStats(await res.json());
    } catch {}
  };

  const fetchArchivePreview = async (days: number) => {
    setArchivePreviewLoading(true);
    try {
      const res = await authFetch(`${API}/api/archive/preview?cutoffDays=${days}`);
      if (res.ok) setArchivePreviewCounts(await res.json());
    } catch {}
    setArchivePreviewLoading(false);
  };

  useEffect(() => {
    fetchArchiveStats();
  }, [API]);

  const handleArchive = async () => {
    setArchiveLoading(true);
    try {
      const res = await authFetch(`${API}/api/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cutoffDays: archiveDays, tables: ["call_audits", "convoso_call_logs", "app_audit_log"] }),
      });
      if (res.ok) {
        const data = await res.json();
        const total = data.results.reduce((s: number, r: ArchiveResult) => s + r.count, 0);
        toast("success", `Archived ${total.toLocaleString()} records`);
        setArchiveConfirm(false);
        setArchivePreviewCounts(null);
        fetchArchiveStats();
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error || `Archive failed (${res.status})`);
      }
    } catch { toast("error", "Archive request failed"); }
    setArchiveLoading(false);
  };

  const handleRestore = async (batchId: string) => {
    setRestoring(batchId);
    try {
      const res = await authFetch(`${API}/api/archive/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId }),
      });
      if (res.ok) {
        const data = await res.json();
        const total = data.results.reduce((s: number, r: ArchiveResult) => s + r.count, 0);
        toast("success", `Restored ${total.toLocaleString()} records`);
        fetchArchiveStats();
      } else {
        const err = await res.json().catch(() => ({}));
        toast("error", err.error || `Restore failed (${res.status})`);
      }
    } catch { toast("error", "Restore request failed"); }
    setRestoring(null);
  };

  return (
    <div className="animate-fade-in-up stagger-6" style={{ ...CARD, marginBottom: 20, marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h3 style={SECTION_TITLE}>Data Archive</h3>
          <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>Archive old logs to reduce database size</p>
        </div>
        <Database size={20} color={colors.primary400} style={{ flexShrink: 0, marginTop: 2 }} />
      </div>

      {/* Stats Cards */}
      {archiveStats?.tables && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
          {archiveStats.tables.map((t) => (
            <div key={t.name} style={{ background: colors.bgSurfaceInset, borderRadius: radius.lg, padding: "12px 16px", flex: "1 1 200px", minWidth: 180, border: `1px solid ${colors.borderSubtle}` }}>
              <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 4 }}>{t.name.replace(/_/g, " ")}</div>
              <div style={{ fontSize: 20, fontWeight: typography.weights.bold, color: colors.textPrimary }}>{(t.rowCount ?? 0).toLocaleString()}</div>
              {(t.oldestRecord || t.newestRecord) && (
                <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
                  {t.oldestRecord ? new Date(t.oldestRecord).toLocaleDateString() : "?"} &ndash; {t.newestRecord ? new Date(t.newestRecord).toLocaleDateString() : "?"}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Archive Controls */}
      <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={LBL}>Archive records older than (days)</label>
            <input
              className="input-focus"
              style={{ ...INP, width: 140 }}
              type="number"
              min="1"
              value={archiveDays}
              onChange={(e) => { setArchiveDays(Number(e.target.value)); setArchiveConfirm(false); setArchivePreviewCounts(null); }}
            />
          </div>
          {!archiveConfirm ? (
            <Button variant="primary" loading={archivePreviewLoading} onClick={() => { fetchArchivePreview(archiveDays).then(() => setArchiveConfirm(true)); }}>
              Archive All Tables
            </Button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {archivePreviewLoading ? (
                <span style={{ fontSize: 13, color: colors.textMuted }}>Loading preview...</span>
              ) : archivePreviewCounts ? (
                <>
                  <span style={{ fontSize: 13, color: colors.warning }}>
                    This will archive {archivePreviewCounts.total.toLocaleString()} records older than {archiveDays} days.
                  </span>
                  <Button variant="danger" loading={archiveLoading} onClick={handleArchive}>
                    Confirm
                  </Button>
                  <Button variant="ghost" onClick={() => { setArchiveConfirm(false); setArchivePreviewCounts(null); }}>
                    Cancel
                  </Button>
                </>
              ) : (
                <span style={{ fontSize: 13, color: colors.textMuted }}>No preview available</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Batch History */}
      {archiveStats?.batches && archiveStats.batches.length > 0 && (
        <div style={{ borderTop: `1px solid ${colors.borderSubtle}`, paddingTop: 16 }}>
          <h4 style={{ ...SECTION_TITLE, fontSize: typography.sizes.sm.fontSize, marginBottom: 12 }}>Archive History</h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: `1px solid ${colors.borderSubtle}` }}>Batch ID</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: `1px solid ${colors.borderSubtle}` }}>Table</th>
                  <th style={{ textAlign: "left", padding: "8px 12px", fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: `1px solid ${colors.borderSubtle}` }}>Date</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: `1px solid ${colors.borderSubtle}` }}>Records</th>
                  <th style={{ textAlign: "right", padding: "8px 12px", fontSize: 11, color: colors.textTertiary, textTransform: "uppercase" as const, letterSpacing: "0.05em", borderBottom: `1px solid ${colors.borderSubtle}` }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {archiveStats.batches.map((b) => (
                  <tr key={b.batchId + b.table}>
                    <td style={{ padding: "8px 12px", fontSize: 13, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}`, fontFamily: typography.fontMono }}>{b.batchId.slice(0, 8)}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{b.table.replace(/_/g, " ")}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13, color: colors.textSecondary, borderBottom: `1px solid ${colors.borderSubtle}` }}>{new Date(b.archivedAt).toLocaleDateString()}</td>
                    <td style={{ padding: "8px 12px", fontSize: 13, color: colors.textPrimary, borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: "right", fontWeight: typography.weights.semibold }}>{b.count.toLocaleString()}</td>
                    <td style={{ padding: "8px 12px", borderBottom: `1px solid ${colors.borderSubtle}`, textAlign: "right" }}>
                      <button
                        onClick={() => handleRestore(b.batchId)}
                        disabled={restoring === b.batchId}
                        style={{
                          background: "transparent",
                          border: `1px solid ${colors.borderSubtle}`,
                          borderRadius: radius.md,
                          color: colors.primary500,
                          cursor: restoring === b.batchId ? "wait" : "pointer",
                          fontSize: 12,
                          fontWeight: typography.weights.semibold,
                          padding: "4px 10px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          opacity: restoring === b.batchId ? 0.5 : 1,
                        }}
                      >
                        <RotateCcw size={12} />
                        {restoring === b.batchId ? "Restoring..." : "Restore"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* -- OwnerConfig -- */

export default function OwnerConfig({ API }: { API: string }) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiPromptLoaded, setAiPromptLoaded] = useState(false);
  const [auditMinSec, setAuditMinSec] = useState(0);
  const [auditMaxSec, setAuditMaxSec] = useState(0);
  const [auditDurationLoaded, setAuditDurationLoaded] = useState(false);

  useEffect(() => {
    // Fetch agents
    authFetch(`${API}/api/agents`).then((r) => r.ok ? r.json() : []).then(setAgents).catch(() => {});

    // Fetch audit duration
    authFetch(`${API}/api/settings/audit-duration`)
      .then((r) => r.ok ? r.json() : { minSeconds: 0, maxSeconds: 0 })
      .then((d) => { setAuditMinSec(d.minSeconds); setAuditMaxSec(d.maxSeconds); setAuditDurationLoaded(true); })
      .catch(() => { setAuditDurationLoaded(true); });

    // Fetch AI prompt with retry
    const loadPrompt = (attempt: number) => {
      authFetch(`${API}/api/settings/ai-audit-prompt`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then((d: { prompt?: string }) => {
          setAiPrompt(d.prompt ?? "");
          setAiPromptLoaded(true);
        })
        .catch(() => {
          if (attempt < 2) {
            setTimeout(() => loadPrompt(attempt + 1), 1000);
          } else {
            setAiPromptLoaded(true);
          }
        });
    };
    loadPrompt(0);
  }, [API]);

  return (
    <div className="animate-fade-in">
      <ConfigSection
        agents={agents}
        aiPrompt={aiPrompt}
        setAiPrompt={setAiPrompt}
        aiPromptLoaded={aiPromptLoaded}
        auditMinSec={auditMinSec}
        setAuditMinSec={setAuditMinSec}
        auditMaxSec={auditMaxSec}
        setAuditMaxSec={setAuditMaxSec}
        auditDurationLoaded={auditDurationLoaded}
        setAgents={setAgents}
        API={API}
      />
      <div style={{ maxWidth: 820 }}>
        <DataArchiveSection API={API} />
      </div>
    </div>
  );
}
