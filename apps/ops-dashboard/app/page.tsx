"use client";
import { useState, useEffect, FormEvent } from "react";
import { Mail, Lock, Eye, EyeOff, KeyRound, LogIn, ArrowLeft } from "lucide-react";
import { Input, Button, Card } from "@ops/ui";
import {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  motion,
  baseLabelStyle,
} from "@ops/ui";
import { captureTokenFromUrl, getToken } from "@ops/auth/client";
import { decodeRolesFromToken } from "@/lib/auth";
import { getDefaultTab } from "@/lib/roles";

/* -- Static style constants -- */

const BG: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: spacing[6],
  position: "relative",
  overflow: "hidden",
  background: colors.bgRoot,
};

const BG_MESH: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: [
    "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(20,184,166,0.12) 0%, transparent 60%)",
    "radial-gradient(ellipse 60% 50% at 80% 90%, rgba(13,148,136,0.10) 0%, transparent 55%)",
    "radial-gradient(ellipse 40% 40% at 60% 30%, rgba(94,234,212,0.07) 0%, transparent 50%)",
  ].join(", "),
  animation: "gradientShift 12s ease infinite",
  backgroundSize: "200% 200%",
  pointerEvents: "none",
};

const CARD: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  position: "relative",
  zIndex: 1,
};

const LOGO_WRAP: React.CSSProperties = {
  textAlign: "center",
  marginBottom: spacing[8],
};

const LOGO_BADGE: React.CSSProperties = {
  width: 52,
  height: 52,
  borderRadius: radius.xl,
  background: colors.accentGradient,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 22,
  fontWeight: typography.weights.extrabold,
  color: "#fff",
  boxShadow: `${shadows.glowPrimary}, ${shadows.lg}`,
  marginBottom: spacing[4],
  letterSpacing: typography.tracking.tight,
};

const TITLE: React.CSSProperties = {
  margin: `0 0 ${spacing[1]}px`,
  fontSize: 24,
  fontWeight: typography.weights.bold,
  letterSpacing: typography.tracking.tight,
  color: colors.textPrimary,
};

const SUBTITLE: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: colors.textTertiary,
  fontWeight: typography.weights.medium,
};

const FIELD: React.CSSProperties = {
  marginBottom: spacing[5],
  textAlign: "left",
};

const INPUT_WRAP: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

const INPUT_ICON: React.CSSProperties = {
  position: "absolute",
  left: 12,
  color: colors.textMuted,
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
};

const INPUT_PASSWORD: React.CSSProperties = {
  padding: "10px 14px",
  background: colors.bgSurfaceInset,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: radius.md,
  color: colors.textPrimary,
  fontSize: 14,
  lineHeight: "1.6",
  outline: "none",
  transition: `border-color ${motion.duration.fast} ${motion.easing.out}, box-shadow ${motion.duration.fast} ${motion.easing.out}`,
  width: "100%",
  paddingLeft: 38,
  paddingRight: 42,
  boxSizing: "border-box",
};

const EYE_BTN: React.CSSProperties = {
  position: "absolute",
  right: 10,
  background: "none",
  border: "none",
  color: colors.textMuted,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  padding: 4,
  borderRadius: radius.sm,
  lineHeight: 0,
  transition: `color ${motion.duration.fast} ${motion.easing.out}`,
};

const ERROR_BOX: React.CSSProperties = {
  marginBottom: spacing[4],
  padding: `${spacing[3]}px ${spacing[4]}px`,
  borderRadius: radius.lg,
  background: colors.dangerBg,
  border: `1px solid rgba(248,113,113,0.18)`,
  color: colors.danger,
  fontSize: 13,
  fontWeight: typography.weights.semibold,
  textAlign: "center",
};

const SUCCESS_BOX: React.CSSProperties = {
  marginBottom: spacing[4],
  padding: `${spacing[3]}px ${spacing[4]}px`,
  borderRadius: radius.lg,
  background: colors.successBg,
  border: `1px solid rgba(52,211,153,0.18)`,
  color: colors.success,
  fontSize: 13,
  fontWeight: typography.weights.semibold,
  textAlign: "center",
};

const FOOTER_TEXT: React.CSSProperties = {
  marginTop: spacing[5],
  textAlign: "center",
  fontSize: 11,
  color: colors.textMuted,
  letterSpacing: typography.tracking.caps,
  textTransform: "uppercase",
};

/* -- Password input with show/hide toggle -- */

function PasswordInput({
  id,
  name,
  placeholder,
  autoComplete,
  minLength,
  error,
}: {
  id: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <div style={INPUT_WRAP}>
        <span style={INPUT_ICON}>
          <Lock size={15} />
        </span>
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          style={{
            ...INPUT_PASSWORD,
            borderColor: error ? colors.danger : undefined,
          }}
          className="input-focus"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
          style={EYE_BTN}
        >
          {visible ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
      {error && <span style={{ fontSize: 12, color: colors.danger, marginTop: 4, display: "block" }}>{error}</span>}
    </>
  );
}

/* -- Main page -- */

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "change-password">("login");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // On mount: check for existing token and auto-redirect returning users
  useEffect(() => {
    const token = captureTokenFromUrl();
    if (!token) {
      const stored = getToken();
      if (stored) {
        const roles = decodeRolesFromToken(stored);
        if (roles.length > 0) {
          window.location.href = getDefaultTab(roles);
        }
      }
      return;
    }
    const roles = decodeRolesFromToken(token);
    if (roles.length > 0) {
      window.location.href = getDefaultTab(roles);
    }
  }, []);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string).trim();
    const password = form.get("password") as string;

    const errors: Record<string, string> = {};
    if (!email) errors.email = "Enter your email";
    if (!password) errors.password = "Enter your password";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) { setLoading(false); return; }

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
      setFieldErrors({});
      window.location.href = data.redirect;
    }
  }

  async function handleChangePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string).trim();
    const currentPassword = form.get("currentPassword") as string;
    const newPassword = form.get("newPassword") as string;
    const confirmPassword = form.get("confirmPassword") as string;

    const errors: Record<string, string> = {};
    if (!email) errors.email = "Enter your email";
    if (!currentPassword) errors.currentPassword = "Enter your current password";
    if (!newPassword) errors.newPassword = "Enter a new password";
    else if (newPassword.length < 8) errors.newPassword = "Password must be at least 8 characters";
    if (!confirmPassword) errors.confirmPassword = "Confirm your new password";
    else if (newPassword !== confirmPassword) errors.confirmPassword = "Passwords do not match";
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) { setLoading(false); return; }

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
    setTimeout(() => {
      setMode("login");
      setSuccess("");
      setError("");
    }, 2000);
  }

  function switchMode() {
    setMode(mode === "login" ? "change-password" : "login");
    setError("");
    setSuccess("");
    setFieldErrors({});
  }

  const isLogin = mode === "login";

  return (
    <main style={BG}>
      {/* Animated gradient mesh background */}
      <div style={BG_MESH} aria-hidden="true" />

      <div style={CARD} className="animate-scale-in">
        {/* Logo + brand */}
        <div style={LOGO_WRAP}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: spacing[4] }}>
            <div style={LOGO_BADGE} className="animate-scale-in stagger-1">
              H
            </div>
          </div>
          <h1 style={TITLE} className="animate-fade-in-up stagger-2">
            {isLogin ? "Welcome back" : "Change Password"}
          </h1>
          <p style={SUBTITLE} className="animate-fade-in-up stagger-3">
            {isLogin
              ? "Sign in to Horizon Operations"
              : "Update your account password"}
          </p>
        </div>

        {/* Form card */}
        <Card style={{ padding: `${spacing[8]}px ${spacing[6]}px`, boxShadow: shadows.xl, borderRadius: radius["2xl"] }} className="animate-fade-in-up stagger-2">
          {isLogin ? (
            <form onSubmit={handleLogin} noValidate>
              {/* Email field */}
              <div style={FIELD} className="animate-fade-in-up stagger-3">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  label="Email"
                  icon={<Mail size={15} />}
                  error={fieldErrors.email}
                />
              </div>

              {/* Password field */}
              <div
                style={{ ...FIELD, marginBottom: spacing[6] }}
                className="animate-fade-in-up stagger-4"
              >
                <label htmlFor="password" style={baseLabelStyle}>
                  Password
                </label>
                <PasswordInput
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="--------"
                  minLength={8}
                  error={fieldErrors.password}
                />
              </div>

              {/* Error */}
              {error && (
                <div style={ERROR_BOX} className="animate-fade-in-up">
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button type="submit" variant="primary" fullWidth loading={loading} icon={<LogIn size={16} />}>
                Sign In
              </Button>
            </form>
          ) : (
            <form onSubmit={handleChangePassword} noValidate className="animate-slide-down">
              {/* Email */}
              <div style={FIELD} className="animate-fade-in-up stagger-1">
                <Input
                  id="cp-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  label="Email"
                  icon={<Mail size={15} />}
                  error={fieldErrors.email}
                />
              </div>

              {/* Current password */}
              <div style={FIELD} className="animate-fade-in-up stagger-2">
                <label htmlFor="cp-current" style={baseLabelStyle}>
                  Current Password
                </label>
                <PasswordInput
                  id="cp-current"
                  name="currentPassword"
                  autoComplete="current-password"
                  placeholder="--------"
                  minLength={8}
                  error={fieldErrors.currentPassword}
                />
              </div>

              {/* New password */}
              <div style={FIELD} className="animate-fade-in-up stagger-3">
                <label htmlFor="cp-new" style={baseLabelStyle}>
                  New Password
                </label>
                <PasswordInput
                  id="cp-new"
                  name="newPassword"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  minLength={8}
                  error={fieldErrors.newPassword}
                />
              </div>

              {/* Confirm new password */}
              <div
                style={{ ...FIELD, marginBottom: spacing[6] }}
                className="animate-fade-in-up stagger-4"
              >
                <label htmlFor="cp-confirm" style={baseLabelStyle}>
                  Confirm New Password
                </label>
                <PasswordInput
                  id="cp-confirm"
                  name="confirmPassword"
                  autoComplete="new-password"
                  placeholder="Repeat new password"
                  minLength={8}
                  error={fieldErrors.confirmPassword}
                />
              </div>

              {/* Error / Success */}
              {error && (
                <div style={ERROR_BOX} className="animate-fade-in-up">
                  {error}
                </div>
              )}
              {success && (
                <div style={SUCCESS_BOX} className="animate-fade-in-up">
                  {success}
                </div>
              )}

              {/* Submit */}
              <Button type="submit" variant="primary" fullWidth loading={loading} icon={<KeyRound size={16} />}>
                Change Password
              </Button>
            </form>
          )}
        </Card>

        {/* Toggle mode */}
        <Button
          variant="ghost"
          fullWidth
          onClick={switchMode}
          style={{ marginTop: spacing[4], border: `1px solid ${colors.borderDefault}`, borderRadius: radius.lg }}
          icon={isLogin ? <KeyRound size={14} /> : <ArrowLeft size={14} />}
        >
          {isLogin ? "Change Password" : "Back to Sign In"}
        </Button>

        <p style={FOOTER_TEXT}>Horizon Operations</p>
      </div>
    </main>
  );
}
