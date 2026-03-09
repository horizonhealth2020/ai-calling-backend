"use client";
import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";
const INTERVAL = 30_000;
type Entry = { agent: string; count: number; premium: number };
const MEDAL = ["🥇","🥈","🥉"];

function Board({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <div>
      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16, color: "#f1f5f9" }}>{title}</h2>
      {entries.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", color: "#475569", background: "#1e293b", borderRadius: 12, border: "1px solid #334155" }}>No sales recorded yet</div>
      )}
      {entries.map((e, i) => (
        <div key={e.agent} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", marginBottom: 10, background: i === 0 ? "#1e3a52" : "#1e293b", borderRadius: 12, border: `1px solid ${i === 0 ? "#f59e0b55" : "#334155"}`, boxShadow: i === 0 ? "0 0 20px #f59e0b22" : "none" }}>
          <span style={{ fontSize: 24, width: 36, textAlign: "center" }}>{MEDAL[i] ?? <span style={{ color: "#64748b", fontWeight: 800 }}>{i + 1}</span>}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#f1f5f9" }}>{e.agent}</div>
            <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>${Number(e.premium).toLocaleString("en-US", { minimumFractionDigits: 2 })} premium</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#34d399", lineHeight: 1 }}>{e.count}</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>sales</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SalesBoard() {
  const [data, setData] = useState<{ daily: Entry[]; weekly: Entry[] }>({ daily: [], weekly: [] });
  const [lastUpdated, setLastUpdated] = useState("—");
  const [tick, setTick] = useState(INTERVAL / 1000);

  async function refresh() {
    const res = await fetch(`${API}/api/sales-board/summary`).catch(() => null);
    if (res?.ok) { setData(await res.json()); setLastUpdated(new Date().toLocaleTimeString()); }
    setTick(INTERVAL / 1000);
  }

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, INTERVAL);
    const cd = setInterval(() => setTick(t => Math.max(0, t - 1)), 1000);
    return () => { clearInterval(poll); clearInterval(cd); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ background: "#0f172a", minHeight: "100vh", padding: "32px 40px", fontFamily: "'Inter','Segoe UI',sans-serif", color: "white" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 36 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: "#f1f5f9" }}>🏆 Sales Leaderboard</h1>
          <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 14 }}>Live rankings · Auto-refreshes every 30s</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13, color: "#64748b" }}>Updated: {lastUpdated}</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>Next refresh in {tick}s</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
        <Board title="Today" entries={data.daily} />
        <Board title="This Week" entries={data.weekly} />
      </div>
    </main>
  );
}
