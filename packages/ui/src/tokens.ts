"use client";
/* ── Design Tokens ─────────────────────────────────────────────── */
/* Single source of truth for the Ops Platform design system.      */
/* Values reference CSS custom properties defined in theme.css     */
/* so they respond to light/dark theme switching automatically.    */

export const colors = {
  // Backgrounds
  bgRoot: "var(--bg-root)",
  bgSurface: "var(--bg-surface)",
  bgSurfaceRaised: "var(--bg-surface-raised)",
  bgSurfaceOverlay: "var(--bg-surface-overlay)",
  bgSurfaceInset: "var(--bg-surface-inset)",

  // Borders
  borderSubtle: "var(--border-subtle)",
  borderDefault: "var(--border-default)",
  borderStrong: "var(--border-strong)",
  borderFocus: "var(--border-focus)",

  // Primary (teal)
  primary300: "var(--primary-300)",
  primary400: "var(--primary-400)",
  primary500: "var(--primary-500)",
  primary600: "var(--primary-600)",
  primary700: "var(--primary-700)",
  accentTeal: "var(--accent-teal)",
  accentGradient: "var(--accent-gradient)",

  // Semantic
  success: "var(--success)",
  successBg: "var(--success-bg)",
  warning: "var(--warning)",
  warningBg: "var(--warning-bg)",
  danger: "var(--danger)",
  dangerBg: "var(--danger-bg)",
  info: "var(--info)",
  infoBg: "var(--info-bg)",

  // Text
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  textTertiary: "var(--text-tertiary)",
  textMuted: "var(--text-muted)",
  textInverse: "var(--text-inverse)",

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
  sm: "var(--shadow-sm)",
  md: "var(--shadow-md)",
  lg: "var(--shadow-lg)",
  xl: "var(--shadow-xl)",
  glowPrimary: "var(--shadow-glow-primary)",
  glowSuccess: "var(--shadow-glow-success)",
  glowDanger: "var(--shadow-glow-danger)",
  glowWarning: "var(--shadow-glow-warning)",
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

export const baseThStyle: React.CSSProperties = {
  padding: "10px 14px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: colors.textTertiary,
  textTransform: "uppercase",
  letterSpacing: typography.tracking.caps,
  borderBottom: `1px solid ${colors.borderSubtle}`,
  whiteSpace: "nowrap",
};

export const baseTdStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 13,
  color: colors.textSecondary,
  borderBottom: `1px solid ${colors.borderSubtle}`,
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
