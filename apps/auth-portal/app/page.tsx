export default function AuthPortal() {
  const inp: React.CSSProperties = { display: "block", width: "100%", padding: "10px 12px", marginBottom: 20, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 15, boxSizing: "border-box", outline: "none" };
  const lbl: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 };
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <div style={{ background: "white", padding: 40, borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)", width: "100%", maxWidth: 400 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800, color: "#111827" }}>INS Ops</h1>
        <p style={{ margin: "0 0 28px", color: "#6b7280", fontSize: 14 }}>Sign in to your dashboard</p>
        <form action="/api/login" method="post">
          <label style={lbl}>Email</label>
          <input name="email" type="email" placeholder="you@example.com" required style={inp} />
          <label style={lbl}>Password</label>
          <input name="password" type="password" placeholder="••••••••" required style={inp} />
          <button type="submit" style={{ width: "100%", padding: "11px 0", background: "#2563eb", color: "white", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Sign In
          </button>
        </form>
      </div>
    </main>
  );
}
