"use client";
import React, { useState, useEffect, useCallback } from "react";
import { PageShell } from "@ops/ui";
import type { NavItem } from "@ops/ui";
import { SkeletonCard, ToastProvider } from "@ops/ui";
import { useSocketContext } from "@/lib/SocketProvider";
import { captureTokenFromUrl, authFetch } from "@ops/auth/client";
import type { SaleChangedPayload } from "@ops/socket";
import {
  FileText,
  Users,
  BarChart3,
  Headphones,
  Settings,
} from "lucide-react";

import ManagerEntry from "./ManagerEntry";
import ManagerTracker from "./ManagerTracker";
import ManagerSales from "./ManagerSales";
import ManagerAudits from "./ManagerAudits";
import ManagerConfig from "./ManagerConfig";

/* -- Types -- */

type Tab = "entry" | "tracker" | "sales" | "audits" | "config";
type Agent = { id: string; name: string; email?: string; userId?: string; extension?: string; displayOrder: number; active?: boolean; auditEnabled?: boolean };
type Product = {
  id: string; name: string; active: boolean; type: "CORE" | "ADDON" | "AD_D";
  premiumThreshold?: number | null; commissionBelow?: number | null; commissionAbove?: number | null;
  bundledCommission?: number | null; standaloneCommission?: number | null; enrollFeeThreshold?: number | null; notes?: string | null;
};
type LeadSource = { id: string; name: string; listId?: string; costPerLead: number; active?: boolean; callBufferSeconds?: number };
type TrackerEntry = { agent: string; salesCount: number; premiumTotal: number; totalLeadCost: number; costPerSale: number; commissionTotal: number; todaySalesCount: number; todayPremium: number };
type Sale = { id: string; saleDate: string; memberName: string; memberId?: string; carrier: string; premium: number; status: string; hasPendingStatusChange?: boolean; hasPendingEditRequest?: boolean; notes?: string; agent: { id: string; name: string }; product: { id: string; name: string }; leadSource: { id: string; name: string } };

const API = process.env.NEXT_PUBLIC_OPS_API_URL ?? "";

/* -- Nav items -- */

const NAV_ITEMS: NavItem[] = [
  { icon: <FileText size={18} />, label: "Sales Entry", key: "entry" },
  { icon: <Users size={18} />, label: "Performance Tracker", key: "tracker" },
  { icon: <BarChart3 size={18} />, label: "Agent Sales", key: "sales" },
  { icon: <Headphones size={18} />, label: "Call Audits", key: "audits" },
  { icon: <Settings size={18} />, label: "Config", key: "config" },
];

/* -- Inner component that uses ToastProvider context -- */

function ManagerPageInner() {
  const { socket } = useSocketContext();
  const [activeTab, setActiveTab] = useState<Tab>("entry");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leadSources, setLeadSources] = useState<LeadSource[]>([]);
  const [tracker, setTracker] = useState<TrackerEntry[]>([]);
  const [salesList, setSalesList] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  /* -- Real-time highlight state -- */
  const [highlightedSaleIds, setHighlightedSaleIds] = useState<Set<string>>(new Set());
  const [highlightedAgentNames, setHighlightedAgentNames] = useState<Set<string>>(new Set());

  const highlightSale = useCallback((id: string, agentName?: string) => {
    setHighlightedSaleIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setHighlightedSaleIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }, 100);
    if (agentName) {
      setHighlightedAgentNames(prev => new Set(prev).add(agentName));
      setTimeout(() => {
        setHighlightedAgentNames(prev => { const next = new Set(prev); next.delete(agentName); return next; });
      }, 100);
    }
  }, []);

  /* -- Shared data loaders -- */

  const loadAgents = useCallback(() => {
    return authFetch(`${API}/api/agents?all=true`).then(r => r.ok ? r.json() : []).then(setAgents).catch(() => {});
  }, []);

  const loadProducts = useCallback(() => {
    return authFetch(`${API}/api/products`).then(r => r.ok ? r.json() : []).then(setProducts).catch(() => {});
  }, []);

  const loadLeadSources = useCallback(() => {
    return authFetch(`${API}/api/lead-sources`).then(r => r.ok ? r.json() : []).then(setLeadSources).catch(() => {});
  }, []);

  const loadTracker = useCallback(() => {
    return authFetch(`${API}/api/tracker/summary`).then(r => r.ok ? r.json() : { agents: [] }).then(data => setTracker(data.agents ?? [])).catch(() => {});
  }, []);

  const loadSales = useCallback(() => {
    return authFetch(`${API}/api/sales?range=week`).then(r => r.ok ? r.json() : []).then(setSalesList).catch(() => {});
  }, []);

  /* -- Initial load -- */
  useEffect(() => {
    captureTokenFromUrl();
    Promise.all([
      loadAgents(),
      loadProducts(),
      loadLeadSources(),
      loadTracker(),
      loadSales(),
    ]).then(() => setLoading(false));
  }, [loadAgents, loadProducts, loadLeadSources, loadTracker, loadSales]);

  /* -- Socket.IO sale:changed handler at orchestrator level -- */
  useEffect(() => {
    if (!socket) return;
    const handleSaleChanged = (payload: SaleChangedPayload) => {
      if (payload.type !== "created" && payload.type !== "status_changed") return;

      highlightSale(payload.sale.id, payload.sale.agent.name);

      // Patch tracker state (include addon premiums)
      const addonPrem = payload.sale.addons?.reduce((s: number, a) => s + Number((a as { premium?: number | null }).premium ?? 0), 0) ?? 0;
      const totalPrem = payload.sale.premium + addonPrem;
      setTracker(prev => {
        const agentName = payload.sale.agent.name;
        const exists = prev.some(t => t.agent === agentName);
        if (exists) {
          return prev.map(t =>
            t.agent === agentName
              ? { ...t, salesCount: t.salesCount + 1, premiumTotal: t.premiumTotal + totalPrem }
              : t
          );
        }
        return [...prev, { agent: agentName, salesCount: 1, premiumTotal: totalPrem, totalLeadCost: 0, costPerSale: 0, commissionTotal: 0, todaySalesCount: 1, todayPremium: totalPrem }];
      });

      // Patch salesList
      setSalesList(prev => {
        const newSale: Sale = {
          id: payload.sale.id,
          saleDate: payload.sale.saleDate,
          memberName: payload.sale.memberName,
          memberId: payload.sale.memberId,
          carrier: payload.sale.carrier,
          premium: payload.sale.premium,
          status: payload.sale.status,
          notes: undefined,
          agent: payload.sale.agent,
          product: payload.sale.product,
          leadSource: { id: "", name: "" },
        };
        return [newSale, ...prev.filter(s => s.id !== newSale.id)];
      });
    };

    socket.on("sale:changed", handleSaleChanged);
    return () => { socket.off("sale:changed", handleSaleChanged); };
  }, [socket, highlightSale]);

  /* -- Cross-tab refresh callbacks -- */

  const handleSaleCreated = useCallback(() => {
    loadTracker();
    loadSales();
  }, [loadTracker, loadSales]);

  const handleSalesChanged = useCallback(() => {
    loadTracker();
  }, [loadTracker]);

  if (loading) {
    return (
      <PageShell compact title="Manager Dashboard" navItems={NAV_ITEMS} activeNav={activeTab} onNavChange={k => setActiveTab(k as Tab)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} height={64} />)}
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      compact
      title="Manager Dashboard"
      subtitle="Sales operations and team management"
      navItems={NAV_ITEMS}
      activeNav={activeTab}
      onNavChange={k => setActiveTab(k as Tab)}
    >
      {activeTab === "entry" && (
        <ManagerEntry
          API={API}
          agents={agents}
          products={products}
          leadSources={leadSources}
          onSaleCreated={handleSaleCreated}
        />
      )}
      {activeTab === "tracker" && (
        <ManagerTracker
          API={API}
          tracker={tracker}
          setTracker={setTracker}
          highlightedAgentNames={highlightedAgentNames}
        />
      )}
      {activeTab === "sales" && (
        <ManagerSales
          API={API}
          agents={agents}
          products={products}
          leadSources={leadSources}
          salesList={salesList}
          setSalesList={setSalesList}
          highlightedSaleIds={highlightedSaleIds}
          onSalesChanged={handleSalesChanged}
        />
      )}
      {activeTab === "audits" && (
        <ManagerAudits
          socket={socket}
          API={API}
        />
      )}
      {activeTab === "config" && (
        <ManagerConfig
          API={API}
          agents={agents}
          products={products}
          leadSources={leadSources}
          refreshAgents={loadAgents}
          refreshProducts={loadProducts}
          refreshLeadSources={loadLeadSources}
          setAgents={setAgents}
          setLeadSources={setLeadSources}
        />
      )}
    </PageShell>
  );
}

export default function ManagerPage() {
  return (
    <ToastProvider>
      <ManagerPageInner />
    </ToastProvider>
  );
}
