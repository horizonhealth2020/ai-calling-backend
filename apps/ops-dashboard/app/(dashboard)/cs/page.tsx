"use client";
import { useState, useEffect } from "react";
import { PageShell, ToastProvider, useToast } from "@ops/ui";
import type { NavItem } from "@ops/ui";
import { useSocketContext } from "@/lib/SocketProvider";
import { authFetch } from "@ops/auth/client";
import CSSubmissions from "./CSSubmissions";
import CSTracking from "./CSTracking";
import CSAnalytics from "./CSAnalytics";
import { ClipboardList, BarChart3, PieChart } from "lucide-react";

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

function CSPageInner() {
  const { toast } = useToast();
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
      } catch { toast("error", "Failed to load CS role data"); }
    })();
  }, []);

  const canManageCS = userRoles.includes("SUPER_ADMIN") || userRoles.includes("OWNER_VIEW");

  const navItems: NavItem[] = canManageCS
    ? [
        { icon: <ClipboardList size={18} />, label: "Submissions", key: "submissions" },
        { icon: <BarChart3 size={18} />, label: "Tracking", key: "tracking" },
        { icon: <PieChart size={18} />, label: "Analytics", key: "analytics" },
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
      {effectiveTab === "analytics" && <CSAnalytics API={API} />}
    </PageShell>
  );
}

export default function CSPage() {
  return (
    <ToastProvider>
      <CSPageInner />
    </ToastProvider>
  );
}
