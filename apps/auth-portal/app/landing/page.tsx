"use client";
import { useEffect, useState } from "react";
import { captureTokenFromUrl, getToken } from "@ops/auth/client";

const DASHBOARD_MAP: Record<string, { label: string; description: string; url: string; color: string; gradient: string; icon: string }> = {
  SUPER_ADMIN: { label: "Owner Dashboard", description: "KPIs, agent performance, user management", url: process.env.OWNER_DASHBOARD_URL || "", color: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)", icon: "\u{1F451}" },
  OWNER_VIEW: { label: "Owner Dashboard", description: "KPIs, agent performance overview", url: process.env.OWNER_DASHBOARD_URL || "", color: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)", icon: "\u{1F4CA}" },
  MANAGER: { label: "Manager Dashboard", description: "Sales entry, agents, lead sources, tracker", url: process.env.MANAGER_DASHBOARD_URL || "", color: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)", icon: "\u{1F3AF}" },
  PAYROLL: { label: "Payroll Dashboard", description: "Payroll periods, chargebacks, products", url: process.env.PAYROLL_DASHBOARD_URL || "", color: "#10b981", gradient: "linear-gradient(135deg, #10b981, #059669)", icon: "\u{1F4B0}" },
};

export default function Landing() {
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    captureTokenFromUrl();
    const params = new URLSearchParams(window.location.search);
    const r = params.get("roles");
    if (r) {
      setRoles(r.split(","));
      params.delete("roles");
      const clean = params.toString();
      const newUrl = window.location.pathname + (clean ? `?${clean}` : "");
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  function goTo(url: string) {
    const token = getToken();
    const dest = new URL(url);
    if (token) dest.searchParams.set("session_token", token);
    window.open(dest.toString(), "_blank");
  }

  const seen = new Set<string>();
  const dashboards = roles
    .filter(r => DASHBOARD_MAP[r])
    .filter(r => {
      const url = DASHBOARD_MAP[r].url;
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #020617 0%, #0a0a1a 40%, #111827 100%)",
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: 32,
    }}>
      <div style={{ maxWidth: 520, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: "0 auto 20px",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 900, color: "white",
            boxShadow: "0 8px 32px rgba(99,102,241,0.3)",
          }}>H</div>
          <h1 style={{
            fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 8px",
            background: "linear-gradient(135deg, #f1f5f9, #94a3b8)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Choose a Dashboard</h1>
          <p style={{ color: "#475569", fontSize: 14, margin: 0, fontWeight: 500 }}>
            Your account has access to multiple dashboards.
          </p>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {dashboards.map(role => {
            const d = DASHBOARD_MAP[role];
            return (
              <button
                key={role}
                onClick={() => goTo(d.url)}
                style={{
                  display: "flex", alignItems: "center", gap: 18, width: "100%",
                  padding: "22px 24px", textAlign: "left", cursor: "pointer",
                  background: "linear-gradient(135deg, rgba(30,41,59,0.6), rgba(15,23,42,0.8))",
                  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14,
                  backdropFilter: "blur(10px)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = d.color + "40"; e.currentTarget.style.boxShadow = `0 4px 20px ${d.color}15`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                  background: d.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, boxShadow: `0 4px 12px ${d.color}30`,
                }}>{d.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#e2e8f0", marginBottom: 2 }}>{d.label}</div>
                  <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{d.description}</div>
                </div>
              </button>
            );
          })}
        </div>

        {dashboards.length === 0 && (
          <div style={{
            textAlign: "center", color: "#475569", padding: 48,
            background: "rgba(15,23,42,0.5)", borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6, color: "#64748b" }}>No dashboards available</div>
            <div style={{ fontSize: 14 }}>Contact your admin for access.</div>
          </div>
        )}
      </div>
    </main>
  );
}
