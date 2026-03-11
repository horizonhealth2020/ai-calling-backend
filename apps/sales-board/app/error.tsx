"use client";
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #111827 50%, #0f172a 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 440, padding: 40 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>!</div>
        <h1 style={{ color: "#e2e8f0", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Something went wrong</h1>
        <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>{error.message || "An unexpected error occurred."}</p>
        <button onClick={reset} style={{ padding: "10px 24px", background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "white", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 14 }}>Try Again</button>
      </div>
    </main>
  );
}
