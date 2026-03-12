import React from "react";

export const PageShell = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <main style={{
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    minHeight: "100vh",
    background: "#0a0a0f",
    color: "#e2e8f0",
  }}>
    <div style={{ borderTop: "2px solid #2563eb" }} />
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 32px 48px" }}>
      <header style={{
        padding: "24px 0 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        marginBottom: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 4,
            background: "#2563eb",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "white",
          }}>H</div>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "#f1f5f9",
            }}>{title}</h1>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Horizon Health Operations
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  </main>
);
