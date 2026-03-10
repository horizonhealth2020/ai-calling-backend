import React from "react";

export const PageShell = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <main style={{
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0a0a0f 0%, #111827 50%, #0f172a 100%)",
    color: "#e2e8f0",
  }}>
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 32px 48px" }}>
      <header style={{
        padding: "28px 0 24px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        marginBottom: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <h1 style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            background: "linear-gradient(135deg, #f1f5f9, #94a3b8)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>{title}</h1>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Horizon Health Operations
          </div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 800, color: "white",
        }}>H</div>
      </header>
      {children}
    </div>
  </main>
);
