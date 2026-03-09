const authPortalUrl = process.env.AUTH_PORTAL_URL;

export default function AuthPortalEntryPage() {
  const loginHref = authPortalUrl ? `${authPortalUrl}/login` : "#";

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f3f4f6", fontFamily: "Inter, Segoe UI, sans-serif", padding: 24 }}>
      <section style={{ width: "100%", maxWidth: 420, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 28, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 24, color: "#111827" }}>Centralized Sign In</h1>
        <p style={{ margin: "10px 0 20px", color: "#6b7280" }}>
          Sign in through the Auth Portal using your username and password.
        </p>
        <a
          href={loginHref}
          style={{ display: "inline-block", padding: "10px 18px", borderRadius: 8, background: "#2563eb", color: "#fff", textDecoration: "none", fontWeight: 700 }}
        >
          Go to Login
        </a>
      </section>
    </main>
  );
}
