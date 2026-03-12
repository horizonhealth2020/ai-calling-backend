"use client";
import { useState, FormEvent } from "react";

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "12px 14px",
  background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6, fontSize: 14, color: "#e2e8f0", boxSizing: "border-box",
  outline: "none",
};
const LABEL_STYLE: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" };

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "change-password">("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string).trim();
    const password = form.get("password") as string;

    let res: Response;
    try {
      res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
      return;
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Invalid credentials. Please try again.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    if (data.redirect) {
      window.location.href = data.redirect;
    }
  }

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string).trim();
    const currentPassword = form.get("currentPassword") as string;
    const newPassword = form.get("newPassword") as string;
    const confirmPassword = form.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      setLoading(false);
      return;
    }

    let res: Response;
    try {
      res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, currentPassword, newPassword }),
      });
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
      return;
    }

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data.error || `Request failed (${res.status})`);
      return;
    }

    setSuccess("Password changed successfully! Redirecting to sign in...");
    setTimeout(() => { setMode("login"); setSuccess(""); setError(""); }, 2000);
  }

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#0a0a0f",
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <div style={{ borderTop: "2px solid #2563eb", width: 48, margin: "0 auto 28px", borderRadius: 1 }} />

        <div style={{
          width: 40, height: 40, borderRadius: 6, margin: "0 auto 20px",
          background: "#2563eb",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 700, color: "white",
        }}>H</div>

        <h1 style={{
          margin: "0 0 6px", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em",
          color: "#f1f5f9",
        }}>{mode === "login" ? "Welcome back" : "Change Password"}</h1>
        <p style={{ margin: "0 0 28px", color: "#475569", fontSize: 14, fontWeight: 500 }}>
          {mode === "login" ? "Sign in to Horizon Health Operations" : "Update your account password"}
        </p>

        <section style={{
          background: "rgba(15,23,42,0.8)",
          border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8,
          padding: "28px 24px",
        }}>
          {mode === "login" ? (
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 18, textAlign: "left" }}>
                <label htmlFor="email" style={LABEL_STYLE}>Email</label>
                <input id="email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" style={INPUT_STYLE} />
              </div>
              <div style={{ marginBottom: 24, textAlign: "left" }}>
                <label htmlFor="password" style={LABEL_STYLE}>Password</label>
                <input id="password" name="password" type="password" required minLength={8} autoComplete="current-password" style={INPUT_STYLE} />
              </div>

              {error && (
                <div style={{ margin: "0 0 18px", padding: "10px 14px", borderRadius: 6, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{error}</div>
              )}

              <button type="submit" disabled={loading} style={{
                width: "100%", padding: "12px 18px",
                background: loading ? "#334155" : "#2563eb",
                color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "0.01em",
              }}>
                {loading ? "Signing in\u2026" : "Sign In"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: 18, textAlign: "left" }}>
                <label htmlFor="cp-email" style={LABEL_STYLE}>Email</label>
                <input id="cp-email" name="email" type="email" required autoComplete="email" placeholder="you@company.com" style={INPUT_STYLE} />
              </div>
              <div style={{ marginBottom: 18, textAlign: "left" }}>
                <label htmlFor="cp-current" style={LABEL_STYLE}>Current Password</label>
                <input id="cp-current" name="currentPassword" type="password" required minLength={8} autoComplete="current-password" style={INPUT_STYLE} />
              </div>
              <div style={{ marginBottom: 18, textAlign: "left" }}>
                <label htmlFor="cp-new" style={LABEL_STYLE}>New Password</label>
                <input id="cp-new" name="newPassword" type="password" required minLength={8} autoComplete="new-password" style={INPUT_STYLE} />
              </div>
              <div style={{ marginBottom: 24, textAlign: "left" }}>
                <label htmlFor="cp-confirm" style={LABEL_STYLE}>Confirm New Password</label>
                <input id="cp-confirm" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" style={INPUT_STYLE} />
              </div>

              {error && (
                <div style={{ margin: "0 0 18px", padding: "10px 14px", borderRadius: 6, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{error}</div>
              )}
              {success && (
                <div style={{ margin: "0 0 18px", padding: "10px 14px", borderRadius: 6, background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)", color: "#34d399", fontSize: 13, fontWeight: 600, textAlign: "center" }}>{success}</div>
              )}

              <button type="submit" disabled={loading} style={{
                width: "100%", padding: "12px 18px",
                background: loading ? "#334155" : "#2563eb",
                color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "0.01em",
              }}>
                {loading ? "Updating\u2026" : "Change Password"}
              </button>
            </form>
          )}
        </section>

        <button
          onClick={() => { setMode(mode === "login" ? "change-password" : "login"); setError(""); setSuccess(""); }}
          style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", marginTop: 16, fontWeight: 600 }}
        >
          {mode === "login" ? "Change Password" : "Back to Sign In"}
        </button>

        <p style={{ marginTop: 12, fontSize: 11, color: "#334155", letterSpacing: "0.04em", textTransform: "uppercase" }}>Horizon Health Operations</p>
      </div>
    </main>
  );
}
