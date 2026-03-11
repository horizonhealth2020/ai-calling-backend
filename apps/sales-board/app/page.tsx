"use client";
import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";
const INTERVAL = 30_000;

type AgentStat = { count: number; premium: number };
type DayRow = { label: string; agents: Record<string, AgentStat>; totalSales: number; totalPremium: number };
type DetailedData = {
  agents: string[];
  weeklyDays: DayRow[];
  weeklyTotals: Record<string, AgentStat>;
  grandTotalSales: number;
  grandTotalPremium: number;
  todayStats: Record<string, AgentStat>;
};

const fmt$ = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RANK_STYLES: Record<number, { bg: string; border: string; glow: string; icon: string }> = {
  0: { bg: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)", border: "#fbbf24", glow: "0 0 30px rgba(251,191,36,0.4)", icon: "\u{1F947}" },
  1: { bg: "linear-gradient(135deg, #d1d5db 0%, #9ca3af 50%, #6b7280 100%)", border: "#9ca3af", glow: "0 0 20px rgba(156,163,175,0.3)", icon: "\u{1F948}" },
  2: { bg: "linear-gradient(135deg, #d97706 0%, #b45309 50%, #92400e 100%)", border: "#d97706", glow: "0 0 20px rgba(217,119,6,0.3)", icon: "\u{1F949}" },
};

const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

function PodiumCard({ rank, name, count, premium }: { rank: number; name: string; count: number; premium: number }) {
  const style = RANK_STYLES[rank] ?? { bg: "#1e293b", border: "#334155", glow: "none", icon: "" };
  const height = rank === 0 ? 220 : rank === 1 ? 180 : 160;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end",
      order: rank === 0 ? 1 : rank === 1 ? 0 : 2,
    }}>
      <div style={{
        width: rank === 0 ? 200 : 170, height, borderRadius: "16px 16px 0 0",
        background: style.bg, border: `2px solid ${style.border}`, borderBottom: "none",
        boxShadow: style.glow,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "20px 16px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 60%)", pointerEvents: "none" }} />
        <div style={{ fontSize: 40, marginBottom: 8, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}>{style.icon}</div>
        <div style={{ fontSize: rank === 0 ? 18 : 16, fontWeight: 900, color: "#111", textShadow: "0 1px 2px rgba(255,255,255,0.3)", textAlign: "center", lineHeight: 1.2, marginBottom: 8 }}>{name}</div>
        <div style={{ fontSize: rank === 0 ? 36 : 28, fontWeight: 900, color: "#111", textShadow: "0 1px 2px rgba(255,255,255,0.3)" }}>{count}</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(0,0,0,0.6)" }}>{fmt$(premium)}</div>
      </div>
    </div>
  );
}

function DailyView({ data }: { data: DetailedData }) {
  const { agents, todayStats, weeklyTotals } = data;

  const sorted = [...agents].sort((a, b) => (todayStats[b]?.count ?? 0) - (todayStats[a]?.count ?? 0));
  const top3 = sorted.slice(0, 3).map(a => ({ name: a, count: todayStats[a]?.count ?? 0, premium: todayStats[a]?.premium ?? 0 }));
  const rest = sorted.slice(3);

  return (
    <div>
      {/* Podium */}
      {top3.length > 0 && (
        <div style={{
          display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 12,
          marginBottom: 40, padding: "40px 0 0",
        }}>
          {top3.map((a, i) => <PodiumCard key={a.name} rank={i} name={a.name} count={a.count} premium={a.premium} />)}
        </div>
      )}

      {/* Remaining agents */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {rest.map((agent, i) => {
          const todayStat = todayStats[agent];
          const weekStat = weeklyTotals[agent];
          return (
            <div key={agent} style={{
              background: "linear-gradient(135deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))",
              border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12,
              padding: "20px 24px",
              backdropFilter: "blur(10px)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: "#475569", width: 28 }}>#{i + 4}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>{agent}</span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Today</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: todayStat?.count ? "#34d399" : "#334155" }}>{todayStat?.count ?? 0}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{fmt$(todayStat?.premium ?? 0)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Week</div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: weekStat?.count ? "#60a5fa" : "#334155" }}>{weekStat?.count ?? 0}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{fmt$(weekStat?.premium ?? 0)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyView({ data }: { data: DetailedData }) {
  const { agents, weeklyDays, weeklyTotals, grandTotalSales, grandTotalPremium } = data;
  const dayMap: Record<string, DayRow> = {};
  for (const d of weeklyDays) dayMap[d.label] = d;

  const sorted = [...agents].sort((a, b) => (weeklyTotals[b]?.count ?? 0) - (weeklyTotals[a]?.count ?? 0));

  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ padding: "14px 20px", textAlign: "left", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(15,23,42,0.8)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky" as const, top: 0 }}>Agent</th>
            {WEEK_DAYS.map(day => (
              <th key={day} style={{ padding: "14px 16px", textAlign: "center", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(15,23,42,0.8)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky" as const, top: 0 }}>{day.slice(0, 3)}</th>
            ))}
            <th style={{ padding: "14px 16px", textAlign: "center", fontSize: 11, fontWeight: 800, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(15,23,42,0.8)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky" as const, top: 0 }}>Total</th>
            <th style={{ padding: "14px 16px", textAlign: "right", fontSize: 11, fontWeight: 800, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(15,23,42,0.8)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky" as const, top: 0 }}>Premium</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((agent, i) => {
            const total = weeklyTotals[agent];
            const isTop = i < 3;
            return (
              <tr key={agent} style={{ background: isTop ? "rgba(251,191,36,0.04)" : i % 2 === 0 ? "rgba(30,41,59,0.4)" : "transparent" }}>
                <td style={{ padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontWeight: 700, color: "#e2e8f0" }}>
                  <span style={{ color: isTop ? "#fbbf24" : "#475569", marginRight: 10, fontWeight: 800, fontSize: 13 }}>#{i + 1}</span>
                  {agent}
                  {i === 0 && <span style={{ marginLeft: 8, fontSize: 16 }}>{"\u{1F451}"}</span>}
                </td>
                {WEEK_DAYS.map(day => {
                  const stat = dayMap[day]?.agents[agent];
                  return (
                    <td key={day} style={{ padding: "14px 16px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      {stat ? (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 900, color: stat.count >= 3 ? "#34d399" : stat.count >= 1 ? "#60a5fa" : "#334155" }}>{stat.count}</div>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 1 }}>{fmt$(stat.premium)}</div>
                        </>
                      ) : <span style={{ color: "#1e293b" }}>&mdash;</span>}
                    </td>
                  );
                })}
                <td style={{ padding: "14px 16px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 20, fontWeight: 900, color: isTop ? "#fbbf24" : "#34d399" }}>{total?.count ?? 0}</td>
                <td style={{ padding: "14px 16px", textAlign: "right", borderBottom: "1px solid rgba(255,255,255,0.04)", fontWeight: 700, color: "#94a3b8", fontSize: 14 }}>{fmt$(total?.premium ?? 0)}</td>
              </tr>
            );
          })}
          <tr style={{ background: "rgba(251,191,36,0.08)" }}>
            <td style={{ padding: "16px 20px", fontWeight: 900, color: "#fbbf24", fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", borderTop: "2px solid rgba(251,191,36,0.2)" }}>Team Total</td>
            {WEEK_DAYS.map(day => {
              const d = dayMap[day];
              return (
                <td key={day} style={{ padding: "16px", textAlign: "center", borderTop: "2px solid rgba(251,191,36,0.2)" }}>
                  {d ? <div style={{ fontSize: 18, fontWeight: 900, color: "#fbbf24" }}>{d.totalSales}</div> : <span style={{ color: "#1e293b" }}>&mdash;</span>}
                </td>
              );
            })}
            <td style={{ padding: "16px", textAlign: "center", borderTop: "2px solid rgba(251,191,36,0.2)", fontSize: 24, fontWeight: 900, color: "#fbbf24" }}>{grandTotalSales}</td>
            <td style={{ padding: "16px", textAlign: "right", borderTop: "2px solid rgba(251,191,36,0.2)", fontSize: 16, fontWeight: 800, color: "#fbbf24" }}>{fmt$(grandTotalPremium)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function SalesBoard() {
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [data, setData] = useState<DetailedData | null>(null);
  const [lastUpdated, setLastUpdated] = useState("\u2014");
  const [tick, setTick] = useState(INTERVAL / 1000);

  async function refresh() {
    const res = await fetch(`${API}/api/sales-board/detailed`).catch(() => null);
    if (res?.ok) {
      setData(await res.json());
      setLastUpdated(new Date().toLocaleTimeString());
    }
    setTick(INTERVAL / 1000);
  }

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, INTERVAL);
    const cd = setInterval(() => setTick((t) => Math.max(0, t - 1)), 1000);
    return () => { clearInterval(poll); clearInterval(cd); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalToday = data ? Object.values(data.todayStats).reduce((s, v) => s + v.count, 0) : 0;
  const totalPremToday = data ? Object.values(data.todayStats).reduce((s, v) => s + v.premium, 0) : 0;

  return (
    <main style={{
      background: "linear-gradient(180deg, #020617 0%, #0a0a1a 30%, #0f172a 100%)",
      minHeight: "100vh",
      padding: "0 40px 48px",
      fontFamily: "'Inter', -apple-system, sans-serif",
      color: "white",
    }}>
      {/* Hero Header */}
      <div style={{
        padding: "40px 0 32px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        marginBottom: 32,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#f59e0b", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>Live Leaderboard</div>
            <h1 style={{
              margin: 0, fontSize: 42, fontWeight: 900, lineHeight: 1,
              background: "linear-gradient(135deg, #ffffff 0%, #e2e8f0 40%, #94a3b8 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              letterSpacing: "-0.03em",
            }}>Sales Arena</h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>Updated {lastUpdated}</div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 12px", borderRadius: 20,
              background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}>LIVE</span>
              <span style={{ fontSize: 11, color: "#475569" }}>{tick}s</span>
            </div>
          </div>
        </div>

        {/* Today Stats Bar */}
        {data && (
          <div style={{ display: "flex", gap: 24, marginTop: 28 }}>
            <div style={{
              padding: "16px 28px", borderRadius: 12,
              background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.02))",
              border: "1px solid rgba(34,197,94,0.15)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Today&apos;s Sales</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#34d399" }}>{totalToday}</div>
            </div>
            <div style={{
              padding: "16px 28px", borderRadius: 12,
              background: "linear-gradient(135deg, rgba(251,191,36,0.1), rgba(251,191,36,0.02))",
              border: "1px solid rgba(251,191,36,0.15)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Today&apos;s Premium</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#f59e0b" }}>{fmt$(totalPremToday)}</div>
            </div>
            <div style={{
              padding: "16px 28px", borderRadius: 12,
              background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.02))",
              border: "1px solid rgba(99,102,241,0.15)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Weekly Total</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#6366f1" }}>{data.grandTotalSales}</div>
            </div>
            <div style={{
              padding: "16px 28px", borderRadius: 12,
              background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.02))",
              border: "1px solid rgba(99,102,241,0.15)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Weekly Premium</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "#6366f1" }}>{fmt$(data.grandTotalPremium)}</div>
            </div>
          </div>
        )}
      </div>

      {/* View Toggle */}
      <div style={{ display: "flex", marginBottom: 28, gap: 4, background: "rgba(15,23,42,0.6)", borderRadius: 10, padding: 4, width: "fit-content", border: "1px solid rgba(255,255,255,0.06)" }}>
        {(["daily", "weekly"] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: "10px 32px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
            borderRadius: 8, textTransform: "uppercase", letterSpacing: "0.05em",
            background: view === v ? "linear-gradient(135deg, #3b82f6, #6366f1)" : "transparent",
            color: view === v ? "#fff" : "#64748b",
            boxShadow: view === v ? "0 4px 12px rgba(59,130,246,0.3)" : "none",
            transition: "all 0.2s",
          }}>{v}</button>
        ))}
      </div>

      {!data ? (
        <div style={{ padding: 60, textAlign: "center", color: "#334155", background: "rgba(15,23,42,0.5)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Loading...</div>
          <div style={{ fontSize: 14 }}>Fetching live data</div>
        </div>
      ) : data.agents.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", color: "#334155", background: "rgba(15,23,42,0.5)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>No Agents Yet</div>
          <div style={{ fontSize: 14 }}>Add agents in the Manager Dashboard</div>
        </div>
      ) : view === "weekly" ? (
        <WeeklyView data={data} />
      ) : (
        <DailyView data={data} />
      )}
    </main>
  );
}
