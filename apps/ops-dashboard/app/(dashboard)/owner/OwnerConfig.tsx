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
        <div style={{ marginBottom: 16 }}>
          <h3 style={SECTION_TITLE}>AI Scoring & Cost Controls</h3>
          <p style={{ ...SECTION_SUBTITLE, marginTop: 4 }}>
            Monitor AI usage, set budget caps, and trigger batch scoring of eligible calls.
          </p>
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
    </div>
  );
}
