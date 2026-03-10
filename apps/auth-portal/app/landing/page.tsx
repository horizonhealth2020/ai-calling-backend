"use client";
import { useEffect, useState } from "react";
import { captureTokenFromUrl, getToken } from "@ops/auth/client";

const DASHBOARD_MAP: Record<string, { label: string; description: string; url: string; color: string }> = {
  SUPER_ADMIN: { label: "Owner Dashboard", description: "KPIs, agent performance, user management", url: process.env.OWNER_DASHBOARD_URL || "", color: "#7c3aed" },
  OWNER_VIEW: { label: "Owner Dashboard", description: "KPIs, agent performance overview", url: process.env.OWNER_DASHBOARD_URL || "", color: "#7c3aed" },
  MANAGER: { label: "Manager Dashboard", description: "Sales entry, agents, lead sources, tracker", url: process.env.MANAGER_DASHBOARD_URL || "", color: "#2563eb" },
  PAYROLL: { label: "Payroll Dashboard", description: "Payroll periods, chargebacks, products", url: process.env.PAYROLL_DASHBOARD_URL || "", color: "#059669" },
};

export default function Landing() {
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    captureTokenFromUrl();
    const params = new URLSearchParams(window.location.search);
    const r = params.get("roles");
    if (r) {
      setRoles(r.split(","));
      // Clean roles from URL
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
    window.location.href = dest.toString();
  }

  // Deduplicate (SUPER_ADMIN and OWNER_VIEW both point to Owner Dashboard)
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
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f9fafb", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 480, width: "100%", padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 8, textAlign: "center" }}>
          Choose a Dashboard
        </h1>
        <p style={{ color: "#6b7280", fontSize: 14, textAlign: "center", marginBottom: 32 }}>
          Your account has access to multiple dashboards.
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          {dashboards.map(role => {
            const d = DASHBOARD_MAP[role];
            return (
              <button
                key={role}
                onClick={() => goTo(d.url)}
                style={{
                  display: "block", width: "100%", padding: "20px 24px", background: "white",
                  border: `2px solid #e5e7eb`, borderRadius: 12, cursor: "pointer", textAlign: "left",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = d.color)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}
              >
                <div style={{ fontWeight: 700, fontSize: 16, color: d.color, marginBottom: 4 }}>{d.label}</div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>{d.description}</div>
              </button>
            );
          })}
        </div>

        {dashboards.length === 0 && (
          <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>
            No dashboards available. Contact your admin.
          </div>
        )}
      </div>
    </main>
  );
}
