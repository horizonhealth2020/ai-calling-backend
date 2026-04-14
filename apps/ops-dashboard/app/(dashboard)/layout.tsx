"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, ChevronDown, Menu } from "lucide-react";
import { SocketProvider, useSocketContext } from "@/lib/SocketProvider";
import { getTabsForRoles, type TabConfig } from "@/lib/roles";
import { decodeRolesFromToken } from "@/lib/auth";
import { getToken, clearToken, captureTokenFromUrl } from "@ops/auth/client";
import { colors, spacing, radius, typography, motion, useIsMobile, MobileDrawer } from "@ops/ui";

/* -- Styles -- */

const TAB_INACTIVE: React.CSSProperties = {
  padding: `${spacing[2]}px ${spacing[4]}px`,
  borderRadius: radius.full,
  fontSize: typography.sizes.sm.fontSize,
  fontWeight: typography.weights.medium,
  color: colors.textTertiary,
  textDecoration: "none",
  transition: `background ${motion.duration.fast} ${motion.easing.out}, color ${motion.duration.fast} ${motion.easing.out}`,
  cursor: "pointer",
};

const TAB_ACTIVE: React.CSSProperties = {
  ...TAB_INACTIVE,
  background: `color-mix(in srgb, ${colors.primary500} 15%, transparent)`,
  color: colors.primary400,
  fontWeight: typography.weights.semibold,
};

const LOGOUT_BTN: React.CSSProperties = {
  marginLeft: "auto",
  display: "inline-flex",
  alignItems: "center",
  gap: spacing[1],
  padding: `${spacing[1]}px ${spacing[3]}px`,
  borderRadius: radius.md,
  border: "none",
  background: "transparent",
  color: colors.textTertiary,
  fontSize: typography.sizes.xs.fontSize,
  fontWeight: typography.weights.medium,
  cursor: "pointer",
  transition: `color ${motion.duration.fast} ${motion.easing.out}, background ${motion.duration.fast} ${motion.easing.out}`,
};

const DISCONNECT_BANNER: React.CSSProperties = {
  padding: `${spacing[2]}px ${spacing[4]}px`,
  background: colors.warningBg,
  color: colors.warning,
  fontSize: typography.sizes.xs.fontSize,
  fontWeight: typography.weights.semibold,
  textAlign: "center",
  borderBottom: `1px solid ${colors.borderSubtle}`,
};

/* -- Inner layout that consumes socket context -- */

function DashboardInner({ tabs, children }: { tabs: TabConfig[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const { disconnected } = useSocketContext();
  const [hovered, setHovered] = useState(false);
  const [delayedHovered, setDelayedHovered] = useState(false);
  const { isMobile, mounted } = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (hovered) {
      setDelayedHovered(true);
    } else {
      const timer = setTimeout(() => setDelayedHovered(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [hovered]);

  const activeTab = tabs.find((t) => pathname.startsWith(t.path));
  // Mobile nav is gated on `mounted` so SSR and first client render produce
  // identical markup (the desktop nav), preventing React hydration mismatches.
  const showMobileNav = mounted && isMobile && tabs.length > 1;

  function handleLogout() {
    clearToken();
    window.location.href = "/";
  }

  const expanded = delayedHovered || !activeTab;

  return (
    <>
      {disconnected && (
        <div style={DISCONNECT_BANNER}>
          Connection lost. Reconnecting...
        </div>
      )}
      {showMobileNav && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: spacing[3],
              padding: `${spacing[2]}px ${spacing[4]}px`,
              borderBottom: `1px solid ${colors.borderSubtle}`,
              background: colors.bgSurface,
            }}
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
              aria-expanded={drawerOpen}
              aria-controls="dashboard-main-drawer"
              className="touch-target"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: colors.textSecondary,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: radius.md,
                padding: spacing[1],
              }}
            >
              <Menu size={20} />
            </button>
            <span
              style={{
                fontSize: typography.sizes.sm.fontSize,
                fontWeight: typography.weights.semibold,
                color: colors.textPrimary,
                flex: 1,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {activeTab?.label ?? "Menu"}
            </span>
            <button
              type="button"
              style={{ ...LOGOUT_BTN, marginLeft: 0 }}
              onClick={handleLogout}
              title="Sign out"
              className="touch-target"
            >
              <LogOut size={14} />
            </button>
          </div>
          <MobileDrawer
            id="dashboard-main-drawer"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            ariaLabel="Main navigation"
            side="left"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[1] }}>
              {tabs.map((tab) => {
                const isActive = pathname.startsWith(tab.path);
                return (
                  <Link
                    key={tab.path}
                    href={tab.path}
                    onClick={() => setDrawerOpen(false)}
                    className="touch-target"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: `${spacing[3]}px ${spacing[4]}px`,
                      borderRadius: radius.md,
                      fontSize: typography.sizes.base.fontSize,
                      fontWeight: isActive ? typography.weights.semibold : typography.weights.medium,
                      color: isActive ? colors.primary400 : colors.textSecondary,
                      background: isActive ? `color-mix(in srgb, ${colors.primary500} 15%, transparent)` : "transparent",
                      textDecoration: "none",
                    }}
                  >
                    {tab.label}
                  </Link>
                );
              })}
              <div style={{ height: 1, background: colors.borderSubtle, margin: `${spacing[2]}px 0` }} />
              <button
                type="button"
                onClick={() => { setDrawerOpen(false); handleLogout(); }}
                className="touch-target"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[2],
                  padding: `${spacing[3]}px ${spacing[4]}px`,
                  borderRadius: radius.md,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: colors.textSecondary,
                  fontSize: typography.sizes.base.fontSize,
                  fontWeight: typography.weights.medium,
                  textAlign: "left",
                  width: "100%",
                }}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </MobileDrawer>
        </>
      )}
      {!showMobileNav && tabs.length > 1 && (
        <nav
          onTouchEnd={(e) => { e.preventDefault(); setHovered(h => !h); }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[1],
            padding: expanded ? `${spacing[3]}px ${spacing[6]}px` : `${spacing[1]}px ${spacing[6]}px`,
            borderBottom: `1px solid ${colors.borderSubtle}`,
            background: colors.bgSurface,
            transition: `padding ${motion.duration.fast} ${motion.easing.out}`,
            overflow: "hidden",
          }}
        >
          {expanded ? (
            <>
              {tabs.map((tab) => {
                const isActive = pathname.startsWith(tab.path);
                return (
                  <Link
                    key={tab.path}
                    href={tab.path}
                    style={isActive ? TAB_ACTIVE : TAB_INACTIVE}
                  >
                    {tab.label}
                  </Link>
                );
              })}
              <button
                type="button"
                style={LOGOUT_BTN}
                onClick={handleLogout}
                title="Sign out"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <span style={{
                fontSize: typography.sizes.xs.fontSize,
                fontWeight: typography.weights.semibold,
                color: colors.primary400,
                letterSpacing: "0.02em",
              }}>
                {activeTab?.label}
              </span>
              <ChevronDown size={12} style={{ color: colors.textMuted }} />
              <button
                type="button"
                style={{ ...LOGOUT_BTN, fontSize: typography.sizes.xs.fontSize, padding: `0 ${spacing[2]}px` }}
                onClick={handleLogout}
                title="Sign out"
              >
                <LogOut size={12} />
              </button>
            </>
          )}
        </nav>
      )}
      {tabs.length <= 1 && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: `${spacing[1]}px ${spacing[6]}px`, borderBottom: `1px solid ${colors.borderSubtle}`, background: colors.bgSurface }}>
          <button
            type="button"
            style={LOGOUT_BTN}
            onClick={handleLogout}
            title="Sign out"
          >
            <LogOut size={12} />
          </button>
        </div>
      )}
      {children}
    </>
  );
}

/* -- Dashboard layout -- */

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<TabConfig[]>([]);

  useEffect(() => {
    const token = captureTokenFromUrl() || getToken();
    if (token) {
      const roles = decodeRolesFromToken(token);
      setTabs(getTabsForRoles(roles));
    }
  }, []);

  const apiUrl = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

  return (
    <SocketProvider apiUrl={apiUrl}>
      <DashboardInner tabs={tabs}>
        {children}
      </DashboardInner>
    </SocketProvider>
  );
}
