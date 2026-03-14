export default function NotFound() {
  const authUrl = process.env.AUTH_PORTAL_URL || "http://localhost:3011";
  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #111827 50%, #0f172a 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 440, padding: 40 }}>
        <div style={{ fontSize: 64, fontWeight: 800, background: "linear-gradient(135deg, #14b8a6, #0d9488)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>404</div>
        <h1 style={{ color: "#e2e8f0", fontSize: 20, fontWeight: 700, margin: "8px 0" }}>Page not found</h1>
        <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>The page you're looking for doesn't exist.</p>
        <a href={authUrl} style={{ padding: "10px 24px", background: "linear-gradient(135deg, #14b8a6, #0d9488)", color: "white", border: "none", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>Back to Login</a>
      </div>
    </main>
  );
}
