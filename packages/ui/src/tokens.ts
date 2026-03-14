"use client";
/* ── Design Tokens ─────────────────────────────────────────────── */
/* Single source of truth for the Ops Platform design system.      */
/* Used by both TypeScript components (inline styles) and CSS      */
/* custom properties (theme.css).                                  */

export const colors = {
  // Backgrounds
  bgRoot: "#07080d",
  bgSurface: "#0c1021",
  bgSurfaceRaised: "#111827",
  bgSurfaceOverlay: "#1a2236",
  bgSurfaceInset: "#060810",

  // Borders
  borderSubtle: "rgba(255,255,255,0.04)",
  borderDefault: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.12)",
  borderFocus: "#3b82f6",

  // Primary (blue-indigo for premium feel)
  primary300: "#a5b4fc",
  primary400: "#818cf8",
  primary500: "#6366f1",
  primary600: "#4f46e5",
  primary700: "#4338ca",
  accentBlue: "#3b82f6",
  accentGradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",

  // Semantic
  success: "#34d399",
  successBg: "rgba(52,211,153,0.08)",
  warning: "#fbbf24",
  warningBg: "rgba(251,191,36,0.08)",
  danger: "#f87171",
  dangerBg: "rgba(248,113,113,0.08)",
  info: "#60a5fa",
  infoBg: "rgba(96,165,250,0.08)",

  // Text
  textPrimary: "#f1f5f9",
  textSecondary: "#94a3b8",
  textTertiary: "#64748b",
  textMuted: "#475569",
  textInverse: "#0f172a",

  // Status (for badges/pills)
  gold: "#fbbf24",
  silver: "#d1d5db",
  bronze: "#d97706",
} as const;

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  full: 9999,
} as const;

export const typography = {
  fontSans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontMono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",

  sizes: {
    xs: { fontSize: 11, lineHeight: "1.45" },
    sm: { fontSize: 13, lineHeight: "1.5" },
    base: { fontSize: 14, lineHeight: "1.6" },
    md: { fontSize: 16, lineHeight: "1.5" },
    lg: { fontSize: 18, lineHeight: "1.4" },
    xl: { fontSize: 22, lineHeight: "1.3" },
    "2xl": { fontSize: 28, lineHeight: "1.2" },
    "3xl": { fontSize: 36, lineHeight: "1.1" },
    display: { fontSize: 48, lineHeight: "1.05" },
  },

  weights: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  tracking: {
    tight: "-0.02em",
    normal: "0",
    wide: "0.04em",
    caps: "0.06em",
  },
} as const;

export const shadows = {
  sm: "0 1px 2px rgba(0,0,0,0.3)",
  md: "0 4px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.2)",
  lg: "0 8px 24px rgba(0,0,0,0.3), 0 2px 8px rgba(0,0,0,0.2)",
  xl: "0 16px 48px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.25)",
  glowPrimary: "0 0 24px rgba(99,102,241,0.15)",
  glowSuccess: "0 0 24px rgba(52,211,153,0.12)",
  glowDanger: "0 0 24px rgba(248,113,113,0.12)",
  glowWarning: "0 0 24px rgba(251,191,36,0.12)",
} as const;

export const motion = {
  duration: {
    instant: "75ms",
    fast: "150ms",
    normal: "250ms",
    slow: "400ms",
    slower: "600ms",
  },
  easing: {
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
    bounce: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
} as const;

/* ── Inline-style helpers ─────────────────────────────────────── */

export const baseCardStyle: React.CSSProperties = {
  background: colors.bgSurface,
  border: `1px solid ${colors.borderDefault}`,
  borderRadius: radius.xl,
  padding: spacing[6],
};

export const baseInputStyle: React.CSSProperties = {
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
};

export const baseLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: colors.textTertiary,
  textTransform: "uppercase",
  letterSpacing: typography.tracking.caps,
  marginBottom: 6,
  display: "block",
};

export const baseButtonStyle: React.CSSProperties = {
  padding: "10px 20px",
  border: "none",
  borderRadius: radius.md,
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  transition: `all ${motion.duration.fast} ${motion.easing.out}`,
};
