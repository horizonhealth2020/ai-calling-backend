"use client";

import React, { useState, useEffect, useCallback } from "react";
import { colors, spacing, radius, shadows, typography, motion } from "./tokens";
import { ThemeToggle } from "./ThemeToggle";

/* ── Types ─────────────────────────────────────────────────────── */

export interface NavItem {
  icon: React.ReactNode;
  label: string;
  key: string;
  badge?: number;
}

export interface PageShellProps {
  title: string;
  subtitle?: string;
  navItems?: NavItem[];
  activeNav?: string;
  onNavChange?: (key: string) => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/* ── Static style constants ────────────────────────────────────── */

const SHELL: React.CSSProperties = {
  fontFamily: typography.fontSans,
  margin: 0,
  minHeight: "100vh",
  background: colors.bgRoot,
  color: colors.textPrimary,
  display: "flex",
  flexDirection: "row",
};

const SIDEBAR: React.CSSProperties = {
  width: 240,
  minWidth: 240,
  height: "100vh",
  position: "fixed",
  top: 0,
  left: 0,
  background: colors.bgSurface,
  borderRight: `1px solid ${colors.borderSubtle}`,
  display: "flex",
  flexDirection: "column",
  zIndex: 100,
  boxShadow: shadows.lg,
};

const LOGO_AREA: React.CSSProperties = {
  padding: `${spacing[6]}px ${spacing[5]}px ${spacing[5]}px`,
  borderBottom: `1px solid ${colors.borderSubtle}`,
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  flexShrink: 0,
};

const LOGO_BADGE: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: radius.xl,
  background: colors.accentGradient,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
  fontWeight: typography.weights.extrabold,
  color: "#fff",
  flexShrink: 0,
  boxShadow: shadows.glowPrimary,
};

const LOGO_TEXT_WRAP: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 1,
  minWidth: 0,
};

const LOGO_TITLE: React.CSSProperties = {
  fontSize: typography.sizes.sm.fontSize,
  fontWeight: typography.weights.bold,
  color: colors.textPrimary,
  letterSpacing: typography.tracking.tight,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const LOGO_SUBTITLE: React.CSSProperties = {
  fontSize: typography.sizes.xs.fontSize,
  color: colors.textMuted,
  fontWeight: typography.weights.medium,
  letterSpacing: typography.tracking.caps,
  textTransform: "uppercase" as const,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const NAV_LIST: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: `${spacing[3]}px 0`,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const SIDEBAR_FOOTER: React.CSSProperties = {
  padding: `${spacing[4]}px ${spacing[5]}px`,
  borderTop: `1px solid ${colors.borderSubtle}`,
  flexShrink: 0,
};

const SIDEBAR_FOOTER_TEXT: React.CSSProperties = {
  fontSize: typography.sizes.xs.fontSize,
  color: colors.textMuted,
  fontWeight: typography.weights.medium,
  letterSpacing: typography.tracking.caps,
  textTransform: "uppercase" as const,
};

const CONTENT_WRAP: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh",
  minWidth: 0,
};

const TOPBAR: React.CSSProperties = {
  height: 64,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `0 ${spacing[8]}px`,
  borderBottom: `1px solid ${colors.borderSubtle}`,
  background: colors.bgSurface,
  position: "sticky",
  top: 0,
  zIndex: 50,
};

const TOPBAR_LEFT: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 2,
  minWidth: 0,
};

const PAGE_TITLE: React.CSSProperties = {
  margin: 0,
  fontSize: typography.sizes.lg.fontSize,
  fontWeight: typography.weights.bold,
  letterSpacing: typography.tracking.tight,
  color: colors.textPrimary,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const PAGE_SUBTITLE: React.CSSProperties = {
  fontSize: typography.sizes.xs.fontSize,
  color: colors.textTertiary,
  fontWeight: typography.weights.medium,
};

const MAIN_CONTENT: React.CSSProperties = {
  flex: 1,
  padding: `${spacing[8]}px`,
  minWidth: 0,
};

/* Mobile layout */

const MOBILE_SHELL: React.CSSProperties = {
  fontFamily: typography.fontSans,
  margin: 0,
  minHeight: "100vh",
  background: colors.bgRoot,
  color: colors.textPrimary,
  display: "flex",
  flexDirection: "column",
  paddingBottom: "calc(60px + env(safe-area-inset-bottom))",
};

const MOBILE_TOPBAR: React.CSSProperties = {
  height: 56,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  gap: spacing[3],
  padding: `0 ${spacing[4]}px`,
  borderBottom: `1px solid ${colors.borderSubtle}`,
  background: colors.bgSurface,
  position: "sticky",
  top: 0,
  zIndex: 50,
};

const MOBILE_LOGO_BADGE: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: radius.lg,
  background: colors.accentGradient,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: typography.weights.extrabold,
  color: "#fff",
  flexShrink: 0,
};

const MOBILE_PAGE_TITLE: React.CSSProperties = {
  margin: 0,
  fontSize: typography.sizes.base.fontSize,
  fontWeight: typography.weights.bold,
  letterSpacing: typography.tracking.tight,
  color: colors.textPrimary,
  flex: 1,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const MOBILE_CONTENT: React.CSSProperties = {
  flex: 1,
  padding: `${spacing[4]}px`,
  minWidth: 0,
};

const BOTTOM_NAV: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  height: "calc(60px + env(safe-area-inset-bottom))",
  background: colors.bgSurface,
  borderTop: `1px solid ${colors.borderDefault}`,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-around",
  paddingTop: spacing[2],
  paddingBottom: "env(safe-area-inset-bottom)",
  zIndex: 100,
};

/* ── Nav Item badge ─────────────────────────────────────────── */

const BADGE_PILL: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 18,
  height: 18,
  borderRadius: radius.full,
  background: colors.primary500,
  color: "#fff",
  fontSize: 10,
  fontWeight: typography.weights.bold,
  lineHeight: 1,
  padding: "0 5px",
};

/* ── Sidebar NavItem ─────────────────────────────────────────── */

function SidebarNavItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: spacing[3],
    padding: `10px ${spacing[4]}px`,
    margin: `2px ${spacing[2]}px`,
    borderRadius: radius.lg,
    cursor: "pointer",
    userSelect: "none",
    position: "relative",
    transition: `background ${motion.duration.fast} ${motion.easing.out}, color ${motion.duration.fast} ${motion.easing.out}`,
    background: isActive
      ? colors.bgSurfaceRaised
      : hovered
      ? colors.bgSurfaceRaised
      : "transparent",
    color: isActive ? colors.textPrimary : colors.textTertiary,
    borderLeft: isActive ? `3px solid ${colors.primary500}` : "3px solid transparent",
    paddingLeft: isActive
      ? `${spacing[4] - 3}px`
      : hovered
      ? `${spacing[4] - 3}px`
      : `${spacing[4]}px`,
  };

  const labelStyle: React.CSSProperties = {
    flex: 1,
    fontSize: typography.sizes.sm.fontSize,
    fontWeight: isActive ? typography.weights.semibold : typography.weights.medium,
    letterSpacing: typography.tracking.normal,
    transition: `color ${motion.duration.fast} ${motion.easing.out}`,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const iconWrap: React.CSSProperties = {
    width: 18,
    height: 18,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    opacity: isActive ? 1 : hovered ? 0.85 : 0.6,
    transition: `opacity ${motion.duration.fast} ${motion.easing.out}`,
    color: isActive ? colors.primary400 : "inherit",
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive ? "page" : undefined}
      style={itemStyle}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={iconWrap}>{item.icon}</span>
      <span style={labelStyle}>{item.label}</span>
      {item.badge !== undefined && item.badge > 0 && (
        <span style={BADGE_PILL}>{item.badge > 99 ? "99+" : item.badge}</span>
      )}
    </div>
  );
}

/* ── Bottom NavItem ─────────────────────────────────────────── */

function BottomNavItem({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}) {
  const [pressed, setPressed] = useState(false);

  const itemStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    flex: 1,
    padding: `${spacing[1]}px ${spacing[2]}px`,
    cursor: "pointer",
    userSelect: "none",
    position: "relative",
    color: isActive ? colors.primary400 : colors.textMuted,
    transform: pressed ? "scale(0.92)" : "scale(1)",
    transition: `color ${motion.duration.fast} ${motion.easing.out}, transform ${motion.duration.instant} ${motion.easing.out}`,
  };

  const iconWrap: React.CSSProperties = {
    width: 22,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: isActive ? typography.weights.semibold : typography.weights.medium,
    lineHeight: 1.2,
    letterSpacing: typography.tracking.wide,
    maxWidth: 60,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const badgeDot: React.CSSProperties = {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: radius.full,
    background: colors.primary500,
    color: "#fff",
    fontSize: 9,
    fontWeight: typography.weights.bold,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 3px",
    lineHeight: 1,
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-current={isActive ? "page" : undefined}
      style={itemStyle}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
    >
      <span style={iconWrap}>
        {item.icon}
        {item.badge !== undefined && item.badge > 0 && (
          <span style={badgeDot}>{item.badge > 9 ? "9+" : item.badge}</span>
        )}
      </span>
      <span style={labelStyle}>{isActive ? item.label : item.label}</span>
    </div>
  );
}

/* ── Main PageShell ─────────────────────────────────────────── */

export function PageShell({
  title,
  subtitle,
  navItems = [],
  activeNav,
  onNavChange,
  headerRight,
  children,
}: PageShellProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  const checkMobile = useCallback(() => {
    setIsMobile(window.innerWidth < 1024);
  }, []);

  useEffect(() => {
    checkMobile();
    setMounted(true);
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [checkMobile]);

  // Avoid layout flash: render desktop until mounted
  if (!mounted) {
    return (
      <div style={{ ...SHELL, visibility: "hidden" }}>
        <div style={SIDEBAR} />
        <div style={{ ...CONTENT_WRAP, marginLeft: 240 }}>
          <div style={TOPBAR} />
          <main style={MAIN_CONTENT}>{children}</main>
        </div>
      </div>
    );
  }

  /* ── Mobile layout ─────────────────────────────────────────── */

  if (isMobile) {
    return (
      <div style={MOBILE_SHELL} className="animate-fade-in">
        {/* Mobile top bar */}
        <div style={MOBILE_TOPBAR}>
          <div style={MOBILE_LOGO_BADGE}>H</div>
          <h1 style={MOBILE_PAGE_TITLE}>{title}</h1>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: spacing[2] }}>
            {headerRight}
            <ThemeToggle />
          </div>
        </div>

        {/* Page content */}
        <main style={MOBILE_CONTENT}>{children}</main>

        {/* Bottom nav bar */}
        {navItems.length > 0 && (
          <nav aria-label="Main navigation" style={BOTTOM_NAV}>
            {navItems.map((item) => (
              <BottomNavItem
                key={item.key}
                item={item}
                isActive={activeNav === item.key}
                onClick={() => onNavChange?.(item.key)}
              />
            ))}
          </nav>
        )}
      </div>
    );
  }

  /* ── Desktop layout ────────────────────────────────────────── */

  return (
    <div style={SHELL}>
      {/* Sidebar */}
      {navItems.length > 0 && (
        <aside aria-label="Sidebar navigation" style={SIDEBAR} className="animate-slide-in-left">
          {/* Logo area */}
          <div style={LOGO_AREA}>
            <div style={LOGO_BADGE}>H</div>
            <div style={LOGO_TEXT_WRAP}>
              <span style={LOGO_TITLE}>Horizon Health</span>
              <span style={LOGO_SUBTITLE}>Operations</span>
            </div>
          </div>

          {/* Nav items */}
          <nav style={NAV_LIST} aria-label="Primary navigation">
            {navItems.map((item) => (
              <SidebarNavItem
                key={item.key}
                item={item}
                isActive={activeNav === item.key}
                onClick={() => onNavChange?.(item.key)}
              />
            ))}
          </nav>

          {/* Footer */}
          <div style={SIDEBAR_FOOTER}>
            <span style={SIDEBAR_FOOTER_TEXT}>Ops Platform</span>
          </div>
        </aside>
      )}

      {/* Content column */}
      <div
        style={{
          ...CONTENT_WRAP,
          marginLeft: navItems.length > 0 ? 240 : 0,
        }}
        className="animate-fade-in"
      >
        {/* Top bar */}
        <div style={TOPBAR}>
          <div style={TOPBAR_LEFT}>
            <h1 style={PAGE_TITLE}>{title}</h1>
            {subtitle && <span style={PAGE_SUBTITLE}>{subtitle}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: spacing[3], flexShrink: 0 }}>
            {headerRight}
            <ThemeToggle />
          </div>
        </div>

        {/* Page content */}
        <main style={MAIN_CONTENT}>{children}</main>
      </div>
    </div>
  );
}

/* ── Re-exports ─────────────────────────────────────────────── */

export * from "./components";
export * from "./tokens";
export { ThemeProvider, useTheme } from "./ThemeProvider";
export { ThemeToggle } from "./ThemeToggle";
