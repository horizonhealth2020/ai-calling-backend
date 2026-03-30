"use client";
import React, { useState, useEffect } from "react";
import { PageShell, ToastProvider, Button, colors, radius } from "@ops/ui";
import { useSocketContext } from "@/lib/SocketProvider";
import { decodeRolesFromToken } from "@/lib/auth";
import { getToken, authFetch } from "@ops/auth/client";
import {
  BarChart3,
  Activity,
  Settings,
  Users,
  Database,
  X,
  Target,
} from "lucide-react";
import OwnerOverview from "./OwnerOverview";
import OwnerKPIs from "./OwnerKPIs";
import OwnerConfig from "./OwnerConfig";
import OwnerUsers from "./OwnerUsers";
import OwnerScoring from "./OwnerScoring";

type ActiveSection = "overview" | "kpis" | "config" | "users" | "scoring";
type StorageStats = { dbSizeMB: number; planLimitMB: number; usagePct: number; thresholdPct: number; alertActive: boolean };

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

const STORAGE_ALERT: React.CSSProperties = {
  background: "rgba(234, 179, 8, 0.08)",
  borderLeft: `4px solid ${colors.warning ?? "#eab308"}`,
  borderRadius: radius.lg,
  padding: "12px 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 16,
  gap: 12,
};

function OwnerPageInner() {
  const { socket } = useSocketContext();
  const [activeTab, setActiveTab] = useState<ActiveSection>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace("#", "");
      if (["overview", "kpis", "config", "users", "scoring"].includes(hash)) return hash as ActiveSection;
    }
    return "overview";
  });
  useEffect(() => { window.location.hash = activeTab; }, [activeTab]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [storageAlertDismissed, setStorageAlertDismissed] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (token) {
      const roles = decodeRolesFromToken(token);
      setIsSuperAdmin(roles.includes("SUPER_ADMIN"));
    }

    // Fetch storage stats on mount
    authFetch(`${API}/api/storage-stats`).then((r) => r.ok ? r.json() : null).then(setStorageStats).catch(() => {});
  }, []);

  const navItems = [
    { icon: <BarChart3 size={18} />, label: "Dashboard", key: "overview" },
    { icon: <Activity size={18} />, label: "KPIs", key: "kpis" },
    { icon: <Target size={18} />, label: "Scoring", key: "scoring" },
    { icon: <Settings size={18} />, label: "AI Config", key: "config" },
    ...(isSuperAdmin ? [{ icon: <Users size={18} />, label: "Users", key: "users" }] : []),
  ];

  const subtitleMap: Record<ActiveSection, string> = {
    overview: "Performance overview and agent leaderboard",
    kpis: "Agent retention metrics and chargeback tracking",
    scoring: "AI audit scores and agent quality trends",
    config: "AI audit settings and scoring controls",
    users: "Platform users and role management",
  };

  return (
    <PageShell
      compact
      title="Owner Dashboard"
      subtitle={subtitleMap[activeTab]}
      navItems={navItems}
      activeNav={activeTab}
      onNavChange={(key) => setActiveTab(key as ActiveSection)}
    >
      {/* Storage Alert Banner */}
      {storageStats?.alertActive && !storageAlertDismissed && (
        <div style={STORAGE_ALERT}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <Database size={18} color={colors.warning ?? "#eab308"} />
            <span style={{ fontSize: 13, color: colors.textPrimary }}>
              Database storage at {storageStats.usagePct}% capacity ({storageStats.dbSizeMB} MB / {storageStats.planLimitMB} MB)
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" size="sm" onClick={() => setActiveTab("config")}>
              Manage Data
            </Button>
            <button
              aria-label="Dismiss storage alert"
              onClick={() => setStorageAlertDismissed(true)}
              style={{
                background: "transparent",
                border: "none",
                color: colors.textMuted,
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {activeTab === "overview" && <OwnerOverview socket={socket} API={API} />}
      {activeTab === "kpis" && <OwnerKPIs API={API} />}
      {activeTab === "scoring" && <OwnerScoring API={API} />}
      {activeTab === "config" && <OwnerConfig API={API} />}
      {activeTab === "users" && isSuperAdmin && <OwnerUsers API={API} />}
    </PageShell>
  );
}

export default function OwnerPage() {
  return (
    <ToastProvider>
      <OwnerPageInner />
    </ToastProvider>
  );
}
