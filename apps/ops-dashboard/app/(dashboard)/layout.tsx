"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, ChevronDown } from "lucide-react";
import { SocketProvider, useSocketContext } from "@/lib/SocketProvider";
import { DateRangeProvider } from "@/lib/DateRangeContext";
import { getTabsForRoles, type TabConfig } from "@/lib/roles";
import { decodeRolesFromToken } from "@/lib/auth";
import { getToken, clearToken, captureTokenFromUrl } from "@ops/auth/client";
import { colors, spacing, radius, typography, motion } from "@ops/ui";

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

  useEffect(() => {
    if (hovered) {
      setDelayedHovered(true);
    } else {
      const timer = setTimeout(() => setDelayedHovered(false), 400);
      return () => clearTimeout(timer);
    }
  }, [hovered]);

  const activeTab = tabs.find((t) => pathname.startsWith(t.path));

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
      {tabs.length > 1 && (
        <nav
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
      <DateRangeProvider>
        <DashboardInner tabs={tabs}>
          {children}
        </DashboardInner>
      </DateRangeProvider>
    </SocketProvider>
  );
}
