"use client";
import { useState, useEffect, useCallback } from "react";
import { PageShell } from "@ops/ui";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";
type Range = "today" | "week" | "month";
type Summary = { salesCount: number; premiumTotal: number; clawbacks: number; openPayrollPeriods: number };
type TrackerEntry = { agent: string; salesCount: number; premiumTotal: number; totalLeadCost: number; costPerSale: number };
const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

const RANGE_LABELS: { value: Range; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

function StatCard({ label, value, color = "#111827" }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 8, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", marginBottom: 24 }}>
      {RANGE_LABELS.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          style={{
            padding: "8px 20px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            border: "none",
            background: value === r.value ? "#111827" : "white",
            color: value === r.value ? "white" : "#374151",
            transition: "background 0.15s, color 0.15s",
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export default function OwnerDashboard() {
  const [range, setRange] = useState<Range>("today");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tracker, setTracker] = useState<TrackerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback((r: Range) => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/owner/summary?range=${r}`, { credentials: "include" }).then(res => res.ok ? res.json() : null),
      fetch(`${API}/api/tracker/summary?range=${r}`, { credentials: "include" }).then(res => res.ok ? res.json() : []),
    ]).then(([s, t]) => { setSummary(s); setTracker(t); setLoading(false); });
  }, []);

  useEffect(() => { fetchData(range); }, [range, fetchData]);

  const handleRangeChange = (r: Range) => setRange(r);

  const rangeSubtitle = range === "today" ? "Today" : range === "week" ? "Sun – Sat" : "Rolling 30 days";

  return (
    <PageShell title="Owner Dashboard">
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
        <RangeToggle value={range} onChange={handleRangeChange} />
        <span style={{ fontSize: 13, color: "#6b7280" }}>{rangeSubtitle}</span>
      </div>

      {loading ? (
        <p style={{ color: "#6b7280" }}>Loading…</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 32 }}>
            <StatCard label="Total Sales" value={summary?.salesCount ?? "—"} />
            <StatCard label="Premium Total" value={fmt.format(Number(summary?.premiumTotal ?? 0))} color="#16a34a" />
            <StatCard label="Chargebacks" value={summary?.clawbacks ?? "—"} color="#dc2626" />
            <StatCard label="Open Payroll Periods" value={summary?.openPayrollPeriods ?? "—"} color="#d97706" />
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px", color: "#111827" }}>Agent Performance</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "white", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
            <thead><tr style={{ background: "#f3f4f6" }}>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Rank</th>
              <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 13, fontWeight: 600 }}>Agent</th>
              <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Sales</th>
              <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Premium Total</th>
              <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Avg Premium</th>
              <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 13, fontWeight: 600 }}>Cost per Sale</th>
            </tr></thead>
            <tbody>
              {[...tracker].sort((a, b) => b.premiumTotal - a.premiumTotal).map((row, i) => (
                <tr key={row.agent} style={{ borderTop: "1px solid #e5e7eb", background: i % 2 === 0 ? "white" : "#f9fafb" }}>
                  <td style={{ padding: "10px 16px", color: "#6b7280", fontWeight: 600 }}>#{i + 1}</td>
                  <td style={{ padding: "10px 16px", fontWeight: 600 }}>{row.agent}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right" }}>{row.salesCount}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#16a34a", fontWeight: 600 }}>{fmt.format(Number(row.premiumTotal))}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#6b7280" }}>{row.salesCount > 0 ? fmt.format(Number(row.premiumTotal) / row.salesCount) : "—"}</td>
                  <td style={{ padding: "10px 16px", textAlign: "right", color: "#d97706", fontWeight: 600 }}>{row.costPerSale > 0 ? fmt.format(row.costPerSale) : "—"}</td>
                </tr>
              ))}
              {tracker.length === 0 && <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#9ca3af" }}>No agent data yet</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </PageShell>
  );
}
