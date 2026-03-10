"use client";
import { useState, FormEvent } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

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

  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "linear-gradient(135deg, #020617 0%, #0a0a1a 40%, #111827 100%)",
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: 24,
    }}>
      <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, margin: "0 auto 24px",
          background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, fontWeight: 900, color: "white",
          boxShadow: "0 8px 32px rgba(99,102,241,0.3)",
        }}>H</div>

        <h1 style={{
          margin: "0 0 6px", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em",
          background: "linear-gradient(135deg, #f1f5f9, #94a3b8)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Welcome back</h1>
        <p style={{ margin: "0 0 32px", color: "#475569", fontSize: 14, fontWeight: 500 }}>
          Sign in to Horizon Health Operations
        </p>

        <section style={{
          background: "linear-gradient(135deg, rgba(30,41,59,0.6), rgba(15,23,42,0.8))",
          border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16,
          padding: "32px 28px",
          backdropFilter: "blur(20px)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20, textAlign: "left" }}>
              <label htmlFor="email" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</label>
              <input
                id="email" name="email" type="email" required autoComplete="email"
                placeholder="you@company.com"
                style={{
                  width: "100%", padding: "12px 14px",
                  background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, fontSize: 14, color: "#e2e8f0", boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ marginBottom: 28, textAlign: "left" }}>
              <label htmlFor="password" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</label>
              <input
                id="password" name="password" type="password" required minLength={8}
                autoComplete="current-password"
                style={{
                  width: "100%", padding: "12px 14px",
                  background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10, fontSize: 14, color: "#e2e8f0", boxSizing: "border-box",
                  outline: "none",
                }}
              />
            </div>

            {error && (
              <div style={{
                margin: "0 0 20px", padding: "10px 14px", borderRadius: 10,
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171", fontSize: 13, fontWeight: 600, textAlign: "center",
              }}>{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              style={{
                width: "100%", padding: "13px 18px",
                background: loading ? "#334155" : "linear-gradient(135deg, #3b82f6, #6366f1)",
                color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 4px 16px rgba(59,130,246,0.3)",
                letterSpacing: "0.02em",
              }}
            >
              {loading ? "Signing in\u2026" : "Sign In"}
            </button>
          </form>
        </section>

        <p style={{ marginTop: 24, fontSize: 12, color: "#334155" }}>Horizon Health Operations Platform</p>
      </div>
    </main>
  );
}
