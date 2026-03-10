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

const cellStyle: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "center",
  borderBottom: "1px solid #334155",
};

const headerCellStyle: React.CSSProperties = {
  ...cellStyle,
  fontWeight: 800,
  fontSize: 14,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  background: "#1e293b",
  borderBottom: "2px solid #475569",
  position: "sticky" as const,
  top: 0,
};

const totalRowStyle: React.CSSProperties = {
  ...cellStyle,
  fontWeight: 800,
  background: "#1e3a52",
  borderBottom: "2px solid #475569",
};

function WeeklyView({ data }: { data: DetailedData }) {
  const { agents, weeklyDays, weeklyTotals, grandTotalSales, grandTotalPremium } = data;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#0f172a" }}>
        <thead>
          <tr>
            <th style={{ ...headerCellStyle, textAlign: "left", minWidth: 120 }}>Day</th>
            {agents.map((a) => (
              <th key={a} style={{ ...headerCellStyle, minWidth: 120 }}>{a}</th>
            ))}
            <th style={{ ...headerCellStyle, minWidth: 110, color: "#f59e0b" }}>Total Sales</th>
            <th style={{ ...headerCellStyle, minWidth: 130, color: "#f59e0b" }}>Total Premium</th>
          </tr>
        </thead>
        <tbody>
          {weeklyDays.map((day) => (
            <tr key={day.label} style={{ transition: "background 0.15s" }}>
              <td style={{ ...cellStyle, textAlign: "left", fontWeight: 700, color: "#e2e8f0" }}>{day.label}</td>
              {agents.map((a) => {
                const stat = day.agents[a];
                return (
                  <td key={a} style={cellStyle}>
                    {stat ? (
                      <>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#34d399" }}>{stat.count}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{fmt$(stat.premium)}</div>
                      </>
                    ) : (
                      <span style={{ color: "#334155" }}>—</span>
                    )}
                  </td>
                );
              })}
              <td style={{ ...cellStyle, fontWeight: 800, fontSize: 18, color: "#34d399" }}>{day.totalSales}</td>
              <td style={{ ...cellStyle, fontWeight: 700, color: "#f1f5f9" }}>{fmt$(day.totalPremium)}</td>
            </tr>
          ))}
          {/* Totals row */}
          <tr>
            <td style={{ ...totalRowStyle, textAlign: "left", color: "#f59e0b" }}>TOTALS</td>
            {agents.map((a) => {
              const stat = weeklyTotals[a];
              return (
                <td key={a} style={totalRowStyle}>
                  {stat ? (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 900, color: "#34d399" }}>{stat.count}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{fmt$(stat.premium)}</div>
                    </>
                  ) : (
                    <span style={{ color: "#334155" }}>—</span>
                  )}
                </td>
              );
            })}
            <td style={{ ...totalRowStyle, fontSize: 22, fontWeight: 900, color: "#f59e0b" }}>{grandTotalSales}</td>
            <td style={{ ...totalRowStyle, fontSize: 16, fontWeight: 800, color: "#f59e0b" }}>{fmt$(grandTotalPremium)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DailyView({ data }: { data: DetailedData }) {
  const { agents, todayStats, weeklyTotals } = data;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#0f172a" }}>
        <thead>
          <tr>
            <th style={{ ...headerCellStyle, textAlign: "left", minWidth: 140 }}>Metric</th>
            {agents.map((a) => (
              <th key={a} style={{ ...headerCellStyle, minWidth: 140 }}>{a}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Today section */}
          <tr>
            <td colSpan={agents.length + 1} style={{ padding: "14px 16px", fontWeight: 900, fontSize: 16, color: "#f59e0b", background: "#1e293b", borderBottom: "2px solid #475569", letterSpacing: "0.03em" }}>
              Today
            </td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, textAlign: "left", fontWeight: 700, color: "#e2e8f0" }}>Total Sales</td>
            {agents.map((a) => {
              const stat = todayStats[a];
              return (
                <td key={a} style={cellStyle}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#34d399" }}>{stat?.count ?? 0}</div>
                </td>
              );
            })}
          </tr>
          <tr>
            <td style={{ ...cellStyle, textAlign: "left", fontWeight: 700, color: "#e2e8f0" }}>Avg Premium</td>
            {agents.map((a) => {
              const stat = todayStats[a];
              const avg = stat && stat.count > 0 ? stat.premium / stat.count : 0;
              return (
                <td key={a} style={cellStyle}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{fmt$(avg)}</div>
                </td>
              );
            })}
          </tr>

          {/* Week section */}
          <tr>
            <td colSpan={agents.length + 1} style={{ padding: "14px 16px", fontWeight: 900, fontSize: 16, color: "#f59e0b", background: "#1e293b", borderBottom: "2px solid #475569", borderTop: "2px solid #475569", letterSpacing: "0.03em" }}>
              This Week
            </td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, textAlign: "left", fontWeight: 700, color: "#e2e8f0" }}>Total Sales</td>
            {agents.map((a) => {
              const stat = weeklyTotals[a];
              return (
                <td key={a} style={cellStyle}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: "#34d399" }}>{stat?.count ?? 0}</div>
                </td>
              );
            })}
          </tr>
          <tr>
            <td style={{ ...cellStyle, textAlign: "left", fontWeight: 700, color: "#e2e8f0" }}>Total Premium</td>
            {agents.map((a) => {
              const stat = weeklyTotals[a];
              return (
                <td key={a} style={cellStyle}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{fmt$(stat?.premium ?? 0)}</div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function SalesBoard() {
  const [view, setView] = useState<"daily" | "weekly">("daily");
  const [data, setData] = useState<DetailedData | null>(null);
  const [lastUpdated, setLastUpdated] = useState("—");
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

  const toggleBtnBase: React.CSSProperties = {
    padding: "10px 28px",
    fontSize: 15,
    fontWeight: 800,
    border: "none",
    cursor: "pointer",
    transition: "all 0.2s",
  };

  return (
    <main style={{ background: "#0f172a", minHeight: "100vh", padding: "32px 40px", fontFamily: "'Inter','Segoe UI',sans-serif", color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: "#f1f5f9" }}>🏆 Sales Leaderboard</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>Live rankings · Auto-refreshes every 30s</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Updated: {lastUpdated}</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Next refresh in {tick}s</div>
        </div>
      </div>

      {/* Toggle */}
      <div style={{ display: "flex", marginBottom: 24, borderRadius: 10, overflow: "hidden", border: "1px solid #334155", width: "fit-content" }}>
        <button
          onClick={() => setView("daily")}
          style={{
            ...toggleBtnBase,
            background: view === "daily" ? "#3b82f6" : "#1e293b",
            color: view === "daily" ? "#fff" : "#64748b",
            borderRadius: "10px 0 0 10px",
          }}
        >
          Daily
        </button>
        <button
          onClick={() => setView("weekly")}
          style={{
            ...toggleBtnBase,
            background: view === "weekly" ? "#3b82f6" : "#1e293b",
            color: view === "weekly" ? "#fff" : "#64748b",
            borderRadius: "0 10px 10px 0",
          }}
        >
          Weekly
        </button>
      </div>

      {!data ? (
        <div style={{ padding: 40, textAlign: "center", color: "#475569", background: "#1e293b", borderRadius: 12, border: "1px solid #334155" }}>Loading...</div>
      ) : data.agents.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#475569", background: "#1e293b", borderRadius: 12, border: "1px solid #334155" }}>No agents found</div>
      ) : view === "weekly" ? (
        <WeeklyView data={data} />
      ) : (
        <DailyView data={data} />
      )}
    </main>
  );
}
