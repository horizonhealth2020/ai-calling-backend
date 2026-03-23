"use client";
import { useState, useEffect } from "react";
import { PageShell } from "@ops/ui";
import type { NavItem } from "@ops/ui";
import { useSocketContext } from "@/lib/SocketProvider";
import { authFetch } from "@ops/auth/client";
import CSSubmissions from "./CSSubmissions";
import CSTracking from "./CSTracking";
import { ClipboardList, BarChart3 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

export default function CSPage() {
  const [activeTab, setActiveTab] = useState("tracking");
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const { socket } = useSocketContext();

  // Fetch user roles at parent level (same as original cs-dashboard)
  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API}/api/session/me`);
        if (res.ok) {
          const data = await res.json();
          setUserRoles(data.roles || []);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const canManageCS = userRoles.includes("SUPER_ADMIN") || userRoles.includes("OWNER_VIEW");

  const navItems: NavItem[] = canManageCS
    ? [
        { icon: <ClipboardList size={18} />, label: "Submissions", key: "submissions" },
        { icon: <BarChart3 size={18} />, label: "Tracking", key: "tracking" },
      ]
    : [{ icon: <BarChart3 size={18} />, label: "Tracking", key: "tracking" }];

  const effectiveTab = canManageCS ? activeTab : "tracking";

  return (
    <PageShell
      compact
      title="Customer Service"
      subtitle="Chargebacks & Pending Terms"
      navItems={navItems}
      activeNav={effectiveTab}
      onNavChange={(k) => setActiveTab(k)}
    >
      {effectiveTab === "submissions" && <CSSubmissions socket={socket} API={API} />}
      {effectiveTab === "tracking" && <CSTracking socket={socket} API={API} userRoles={userRoles} canManageCS={canManageCS} />}
    </PageShell>
  );
}
