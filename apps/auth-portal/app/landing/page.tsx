"use client";
import { useEffect, useState } from "react";
import { captureTokenFromUrl, getToken } from "@ops/auth/client";
import {
  ChevronRight,
  Shield,
  BarChart3,
  DollarSign,
  Users,
  Settings,
  LogOut,
} from "lucide-react";
import {
  colors,
  spacing,
  radius,
  shadows,
  typography,
  motion,
  baseButtonStyle,
} from "@ops/ui";

/* ── Dashboard config ───────────────────────────────────────── */

interface DashboardConfig {
  label: string;
  description: string;
  url: string;
  color: string;
  gradient: string;
  Icon: React.ElementType;
}

const DASHBOARD_MAP: Record<string, DashboardConfig> = {
  SUPER_ADMIN: {
    label: "Owner Dashboard",
    description: "KPIs, agent performance, user management",
    url: process.env.OWNER_DASHBOARD_URL || "",
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    Icon: Settings,
  },
  OWNER_VIEW: {
    label: "Owner Dashboard",
    description: "KPIs, agent performance overview",
    url: process.env.OWNER_DASHBOARD_URL || "",
    color: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
    Icon: BarChart3,
  },
  MANAGER: {
    label: "Manager Dashboard",
    description: "Sales entry, agents, lead sources, tracker",
    url: process.env.MANAGER_DASHBOARD_URL || "",
    color: "#3b82f6",
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    Icon: Users,
  },
  PAYROLL: {
    label: "Payroll Dashboard",
    description: "Payroll periods, chargebacks, products",
    url: process.env.PAYROLL_DASHBOARD_URL || "",
    color: "#10b981",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    Icon: DollarSign,
  },
};

/* ── Static style constants ─────────────────────────────────── */

const BG: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: `${spacing[8]}px ${spacing[6]}px`,
  position: "relative",
  overflow: "hidden",
  background: colors.bgRoot,
};

const BG_MESH: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundImage: [
    "radial-gradient(ellipse 80% 60% at 20% 10%, rgba(99,102,241,0.12) 0%, transparent 60%)",
    "radial-gradient(ellipse 60% 50% at 80% 90%, rgba(139,92,246,0.10) 0%, transparent 55%)",
    "radial-gradient(ellipse 40% 40% at 60% 30%, rgba(59,130,246,0.07) 0%, transparent 50%)",
  ].join(", "),
  animation: "gradientShift 12s ease infinite",
  backgroundSize: "200% 200%",
  pointerEvents: "none",
};

const CONTAINER: React.CSSProperties = {
  width: "100%",
  maxWidth: 640,
  position: "relative",
  zIndex: 1,
};

const HEADER: React.CSSProperties = {
  textAlign: "center",
  marginBottom: spacing[10],
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
};

const HEADING: React.CSSProperties = {
  margin: `0 0 ${spacing[2]}px`,
  fontSize: 26,
  fontWeight: typography.weights.extrabold,
  letterSpacing: typography.tracking.tight,
  background: "linear-gradient(135deg, #f1f5f9, #94a3b8)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent",
};

const SUBHEADING: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  color: colors.textMuted,
  fontWeight: typography.weights.medium,
};

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: spacing[3],
};

const EMPTY_STATE: React.CSSProperties = {
  textAlign: "center",
  padding: `${spacing[12]}px ${spacing[8]}px`,
  background: colors.bgSurface,
  borderRadius: radius["2xl"],
  border: `1px solid ${colors.borderSubtle}`,
};

const LOGOUT_BTN: React.CSSProperties = {
  ...baseButtonStyle,
  marginTop: spacing[6],
  background: "none",
  border: `1px solid ${colors.borderDefault}`,
  color: colors.textTertiary,
  fontSize: 13,
  borderRadius: radius.lg,
  padding: `${spacing[3]}px ${spacing[5]}px`,
  display: "flex",
  alignItems: "center",
  gap: spacing[2],
  cursor: "pointer",
  transition: `all ${motion.duration.fast} ${motion.easing.out}`,
};

/* ── Stagger class by index ─────────────────────────────────── */

function staggerClass(i: number): string {
  // clamp to stagger-1..stagger-10
  return `stagger-${Math.min(i + 1, 10)}`;
}

/* ── Dashboard card ─────────────────────────────────────────── */

function DashboardCard({
  role,
  config,
  index,
  onClick,
}: {
  role: string;
  config: DashboardConfig;
  index: number;
  onClick: () => void;
}) {
  const { label, description, color, gradient, Icon } = config;

  const CARD: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: spacing[5],
    width: "100%",
    padding: `${spacing[5]}px ${spacing[6]}px`,
    textAlign: "left",
    cursor: "pointer",
    background: colors.bgSurface,
    border: `1px solid ${colors.borderDefault}`,
    borderLeft: `3px solid ${color}`,
    borderRadius: radius["2xl"],
    backdropFilter: "blur(10px)",
    boxSizing: "border-box",
  };

  const ICON_CIRCLE: React.CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    flexShrink: 0,
    background: gradient,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 4px 14px ${color}35`,
  };

  const TEXT_WRAP: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
  };

  const LABEL: React.CSSProperties = {
    display: "block",
    fontWeight: typography.weights.semibold,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 3,
    letterSpacing: typography.tracking.tight,
  };

  const DESC: React.CSSProperties = {
    display: "block",
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    lineHeight: "1.45",
  };

  const ARROW: React.CSSProperties = {
    color: colors.textMuted,
    flexShrink: 0,
    transition: `transform ${motion.duration.fast} ${motion.easing.out}, color ${motion.duration.fast} ${motion.easing.out}`,
  };

  return (
    <button
      key={role}
      onClick={onClick}
      style={CARD}
      className={`interactive-card hover-lift animate-fade-in-up ${staggerClass(index)}`}
      aria-label={`Open ${label}`}
      onMouseEnter={(e) => {
        const arrow = e.currentTarget.querySelector<HTMLElement>("[data-arrow]");
        if (arrow) {
          arrow.style.transform = "translateX(3px)";
          arrow.style.color = color;
        }
      }}
      onMouseLeave={(e) => {
        const arrow = e.currentTarget.querySelector<HTMLElement>("[data-arrow]");
        if (arrow) {
          arrow.style.transform = "translateX(0)";
          arrow.style.color = colors.textMuted;
        }
      }}
    >
      <div style={ICON_CIRCLE}>
        <Icon size={22} color="#fff" strokeWidth={2} />
      </div>

      <div style={TEXT_WRAP}>
        <span style={LABEL}>{label}</span>
        <span style={DESC}>{description}</span>
      </div>

      <span data-arrow style={ARROW}>
        <ChevronRight size={18} />
      </span>
    </button>
  );
}

/* ── Main page ──────────────────────────────────────────────── */

export default function Landing() {
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    captureTokenFromUrl();
    const params = new URLSearchParams(window.location.search);
    const r = params.get("roles");
    if (r) {
      setRoles(r.split(","));
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
    window.open(dest.toString(), "_blank");
  }

  const seen = new Set<string>();
  const dashboards = roles
    .filter((r) => DASHBOARD_MAP[r])
    .filter((r) => {
      const url = DASHBOARD_MAP[r].url;
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });

  return (
    <main style={BG}>
      {/* Animated gradient mesh background */}
      <div style={BG_MESH} aria-hidden="true" />

      <div style={CONTAINER}>
        {/* Header */}
        <div style={HEADER} className="animate-fade-in-down">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: spacing[4] }}>
            <div style={LOGO_BADGE} className="animate-scale-in stagger-1">
              H
            </div>
          </div>
          <h1 style={HEADING} className="animate-fade-in-up stagger-2">
            Select Dashboard
          </h1>
          <p style={SUBHEADING} className="animate-fade-in-up stagger-3">
            {dashboards.length > 1
              ? "Your account has access to multiple dashboards."
              : dashboards.length === 1
              ? "Your dashboard is ready."
              : "No dashboards are assigned to your account."}
          </p>
        </div>

        {/* Dashboard cards grid */}
        {dashboards.length > 0 ? (
          <div style={GRID}>
            {dashboards.map((role, i) => (
              <DashboardCard
                key={role}
                role={role}
                config={DASHBOARD_MAP[role]}
                index={i}
                onClick={() => goTo(DASHBOARD_MAP[role].url)}
              />
            ))}
          </div>
        ) : (
          <div style={EMPTY_STATE} className="animate-fade-in-up stagger-3">
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.xl,
                background: colors.bgSurfaceRaised,
                border: `1px solid ${colors.borderDefault}`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing[4],
              }}
            >
              <Shield size={24} color={colors.textMuted} />
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: typography.weights.semibold,
                color: colors.textSecondary,
                marginBottom: spacing[2],
              }}
            >
              No dashboards available
            </div>
            <div style={{ fontSize: 13, color: colors.textTertiary }}>
              Contact your administrator for access.
            </div>
          </div>
        )}

        {/* Logout / go back */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            style={LOGOUT_BTN}
            className="btn-hover"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
